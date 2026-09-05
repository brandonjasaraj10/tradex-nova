import { supabase } from '../lib/supabase';

export interface CSVTrade {
  ticket?: string;
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;
  open_price: number;
  close_price?: number;
  open_time: string;
  close_time?: string;
  profit?: number;
  commission?: number;
  swap?: number;
  comment?: string;
}

/*
  Column aliases across brokers and instrument types.

  The app claims support for stocks, options, futures, forex and crypto, but
  the importer only recognised MetaTrader exports plus a "generic" shape that
  required a literal "symbol" AND "profit" header. Nothing else matched, so a
  Tradovate futures export ("Contract", "P/L"), a Coinbase crypto export
  ("Product", "Total") or a Thinkorswim options export ("Qty", "Net Price")
  was rejected outright as "Unsupported CSV format".

  Order matters - the first alias found wins, so more specific names are
  listed before generic ones.
*/
const HEADER_ALIASES = {
  symbol: ['symbol', 'ticker', 'instrument', 'contract', 'product', 'pair', 'market', 'asset', 'security'],
  side: ['side', 'type', 'action', 'direction', 'b/s', 'buy/sell', 'position', 'transaction type'],
  quantity: ['volume', 'lots', 'quantity', 'qty', 'contracts', 'shares', 'size', 'units', 'amount', 'filled'],
  openPrice: ['open price', 'entry price', 'avg price', 'average price', 'fill price', 'net price', 'price', 'entry'],
  closePrice: ['close price', 'exit price', 'closing price', 'exit'],
  openTime: ['open time', 'entry time', 'opened', 'entry date', 'date/time', 'timestamp', 'created at', 'time', 'date'],
  closeTime: ['close time', 'exit time', 'closed', 'exit date'],
  pnl: ['profit', 'pnl', 'p/l', 'p&l', 'realized p&l', 'realized pnl', 'realized', 'net p&l', 'net pnl', 'gain/loss', 'gain', 'return'],
  commission: ['commission', 'commissions', 'fee', 'fees'],
  swap: ['swap', 'rollover', 'funding', 'interest'],
  comment: ['comment', 'note', 'notes', 'description', 'memo'],
} as const;

/*
  Every way a broker writes "this was a buy" or "this was a sell".
  Options platforms use open/close language (BTO = buy to open, STC = sell to
  close), futures platforms often use Bought/Sold or a bare B/S. Checked
  longest-first so "sell to open" isn't matched by a stray "s".
*/
const BUY_WORDS = ['buy to open', 'buy to close', 'bought', 'bto', 'btc_', 'buy', 'long', 'b'];
const SELL_WORDS = ['sell to open', 'sell to close', 'sold', 'stc', 'sto', 'sell', 'short', 's'];

function findKey(row: Record<string, any>, aliases: readonly string[]): string | undefined {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const exact = keys.find(k => k.toLowerCase().trim() === alias);
    if (exact) return exact;
  }
  for (const alias of aliases) {
    const partial = keys.find(k => k.toLowerCase().includes(alias));
    if (partial) return partial;
  }
  return undefined;
}

export function normalizeSide(raw: string | undefined): 'buy' | 'sell' | null {
  if (!raw) return null;
  const v = raw.toLowerCase().trim();
  if (!v) return null;
  // "buy to close" covers a short, so check the sell phrases that contain
  // "buy"/"sell" as whole phrases before falling back to single words.
  for (const w of SELL_WORDS) {
    if (w.length > 1 && v.includes(w)) return 'sell';
  }
  for (const w of BUY_WORDS) {
    if (w.length > 1 && v.includes(w)) return 'buy';
  }
  if (v === 'b') return 'buy';
  if (v === 's') return 'sell';
  return null;
}

function toNumber(raw: any): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  // Strips currency symbols, thousands separators, and accounting-style
  // parentheses for negatives: "($1,234.50)" -> -1234.5
  const s = String(raw).trim();
  const negative = /^\(.*\)$/.test(s);
  const cleaned = s.replace(/[()$€£¥,\s]/g, '');
  const n = parseFloat(cleaned);
  if (isNaN(n)) return undefined;
  return negative ? -Math.abs(n) : n;
}

/*
  TradingView exports orders, not trades.

  Its paper trading account offers one download - "Order history" - and every
  row in it is a single order: a buy or a sell, never a round trip. There is
  no exit price and no P&L column anywhere in the file, which is why importing
  one wrote null into exit_price and the database rejected all 100 rows.

  Both TradeZella and Journalit document the same thing: order history is the
  only export TradingView offers, and the journal is expected to pair the
  orders itself. So that is what this does - match each closing order against
  the open orders it closes, oldest first, and emit the completed round trips.

  Columns, per TradingView's own export dialog: Symbol, Side, Type, Qty,
  Limit price, Stop price, Fill price, Status, Commission, Placing time,
  Closing time, Order ID, Level ID, Leverage, Margin.
*/

interface PendingLeg {
  qty: number;
  price: number;
  time: string;
  commission: number;
}

/** One order row, already normalised out of the CSV. */
export interface OrderRow {
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  fillPrice: number;
  time: string;
  status: string;
  commission: number;
}

/*
  Only filled orders represent something that happened.

  A cancelled or rejected order has no fill price - it shows as 0.00000 in the
  export, which is exactly what appeared in the failing import. Treating those
  as trades at a price of zero would invent enormous fake losses.
*/
export function isFilledOrder(status: string): boolean {
  return status.trim().toLowerCase() === 'filled';
}

export function pairOrdersIntoTrades(orders: OrderRow[]): {
  trades: CSVTrade[];
  stillOpen: number;
  skippedUnfilled: number;
} {
  const filled = orders.filter((o) => isFilledOrder(o.status) && o.fillPrice > 0);
  const skippedUnfilled = orders.length - filled.length;

  // Oldest first, so a closing order is matched against the position that was
  // opened earliest - the FIFO convention brokers and tax rules both use.
  const chronological = [...filled].sort((a, b) => a.time.localeCompare(b.time));

  const openLongs = new Map<string, PendingLeg[]>();
  const openShorts = new Map<string, PendingLeg[]>();
  const trades: CSVTrade[] = [];

  const queue = (m: Map<string, PendingLeg[]>, sym: string) => {
    if (!m.has(sym)) m.set(sym, []);
    return m.get(sym)!;
  };

  for (const order of chronological) {
    // A buy closes a short if one is open, otherwise it opens a long. This is
    // what makes the pairing direction-aware rather than assuming every trade
    // starts with a buy - shorts are opened with a sell.
    const closing = order.side === 'buy' ? queue(openShorts, order.symbol) : queue(openLongs, order.symbol);
    const opening = order.side === 'buy' ? queue(openLongs, order.symbol) : queue(openShorts, order.symbol);

    let remaining = order.qty;

    while (remaining > 0 && closing.length > 0) {
      const leg = closing[0];
      // Partial fills are normal: one order can close part of a position, and
      // one position can be closed by several orders. Match the overlap and
      // leave the remainder of whichever side is larger still open.
      const matched = Math.min(remaining, leg.qty);

      const isLong = order.side === 'sell';
      const entryPrice = leg.price;
      const exitPrice = order.fillPrice;
      const pnl = (isLong ? exitPrice - entryPrice : entryPrice - exitPrice) * matched;

      trades.push({
        symbol: order.symbol,
        type: isLong ? 'buy' : 'sell',
        volume: matched,
        open_price: entryPrice,
        close_price: exitPrice,
        open_time: leg.time,
        close_time: order.time,
        profit: pnl,
        // Split proportionally, so a partial close carries its share rather
        // than the whole order's cost.
        commission: leg.commission * (matched / leg.qty) + order.commission * (matched / order.qty),
      });

      leg.qty -= matched;
      remaining -= matched;
      if (leg.qty <= 0) closing.shift();
    }

    if (remaining > 0) {
      opening.push({ qty: remaining, price: order.fillPrice, time: order.time, commission: order.commission });
    }
  }

  let stillOpen = 0;
  for (const m of [openLongs, openShorts]) {
    for (const legs of m.values()) stillOpen += legs.length;
  }

  return { trades, stillOpen, skippedUnfilled };
}

export class CSVParser {
  static detectFormat(headers: string[]): 'mt4' | 'mt5' | 'generic' | 'orders' | null {
    const headerStr = headers.join(',').toLowerCase();

    if (headerStr.includes('ticket') && headerStr.includes('open time') && headerStr.includes('type')) {
      return headerStr.includes('magic') ? 'mt5' : 'mt4';
    }

    /*
      An order history rather than a trade history.

      TradingView's only paper trading export is one row per order, with a
      fill price and a status but no exit and no P&L anywhere. Read as a
      generic trade list it produced 100 rows with a null exit price, which
      the trades table rejects outright - the import failed completely.
      Recognised here so the orders can be paired into round trips instead.
    */
    const probeAll = Object.fromEntries(headers.map(h => [h, '']));
    const hasStatus = !!findKey(probeAll, ['status']);
    const hasFillPrice = !!findKey(probeAll, ['fill price']);
    const hasClose = !!findKey(probeAll, HEADER_ALIASES.closePrice);
    const hasPnlCol = !!findKey(probeAll, HEADER_ALIASES.pnl);
    if (hasStatus && hasFillPrice && !hasClose && !hasPnlCol) {
      return 'orders';
    }

    /*
      Accept anything we can actually read rather than demanding two exact
      words: an instrument column, plus either a side or a P&L column. That
      covers futures, options, crypto and equity exports whose headers share
      no vocabulary with MetaTrader's.
    */
    const probe = Object.fromEntries(headers.map(h => [h, '']));
    const hasSymbol = !!findKey(probe, HEADER_ALIASES.symbol);
    const hasSide = !!findKey(probe, HEADER_ALIASES.side);
    const hasPnl = !!findKey(probe, HEADER_ALIASES.pnl);

    if (hasSymbol && (hasSide || hasPnl)) {
      return 'generic';
    }

    return null;
  }

  static parseDate(dateStr: string): string {
    const formats = [
      /(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2}):(\d{2})/,
      /(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/,
      /(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})/,
      /(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})/,
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (format === formats[0] || format === formats[1]) {
          const [, year, month, day, hour, minute, second] = match;
          return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
        } else {
          const [, day, month, year, hour, minute, second] = match;
          return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
        }
      }
    }

    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().replace('T', ' ').substring(0, 19);
    }

    return dateStr;
  }

  static parseMT4Row(row: any): CSVTrade | null {
    try {
      const type = row['Type']?.toLowerCase();
      if (!type || (!type.includes('buy') && !type.includes('sell'))) {
        return null;
      }

      return {
        ticket: row['Ticket'] || row['Order'],
        symbol: row['Symbol'],
        type: type.includes('buy') ? 'buy' : 'sell',
        volume: parseFloat(row['Volume'] || row['Lots'] || '0'),
        open_price: parseFloat(row['Price'] || row['Open Price'] || '0'),
        close_price: row['Close Price'] ? parseFloat(row['Close Price']) : undefined,
        open_time: this.parseDate(row['Open Time'] || row['Time']),
        close_time: row['Close Time'] ? this.parseDate(row['Close Time']) : undefined,
        profit: row['Profit'] ? parseFloat(row['Profit']) : undefined,
        commission: row['Commission'] ? parseFloat(row['Commission']) : undefined,
        swap: row['Swap'] ? parseFloat(row['Swap']) : undefined,
        comment: row['Comment'],
      };
    } catch (error) {
      console.error('Error parsing MT4 row:', error);
      return null;
    }
  }

  static parseMT5Row(row: any): CSVTrade | null {
    try {
      const type = row['Type']?.toLowerCase();
      if (!type || (!type.includes('buy') && !type.includes('sell'))) {
        return null;
      }

      return {
        ticket: row['Ticket'] || row['Order'] || row['Deal'],
        symbol: row['Symbol'],
        type: type.includes('buy') ? 'buy' : 'sell',
        volume: parseFloat(row['Volume'] || row['Lots'] || '0'),
        open_price: parseFloat(row['Price'] || row['Open Price'] || '0'),
        close_price: row['Close Price'] ? parseFloat(row['Close Price']) : undefined,
        open_time: this.parseDate(row['Open Time'] || row['Time']),
        close_time: row['Close Time'] ? this.parseDate(row['Close Time']) : undefined,
        profit: row['Profit'] ? parseFloat(row['Profit']) : undefined,
        commission: row['Commission'] ? parseFloat(row['Commission']) : undefined,
        swap: row['Swap'] ? parseFloat(row['Swap']) : undefined,
        comment: row['Comment'],
      };
    } catch (error) {
      console.error('Error parsing MT5 row:', error);
      return null;
    }
  }

  /*
    Tolerant row reader for every non-MetaTrader export. Previously this
    required a symbol, a side, a price AND a time column, all matched by a
    single hard-coded substring, and it dropped the row if any were missing.
    Crypto and options exports routinely lack one of them (a Coinbase fill
    has no "type", a closed-option line may carry only a net P&L), so whole
    files imported as zero trades.

    Now: an instrument plus either a readable side or a P&L is enough. A row
    is only rejected when there is genuinely nothing to record.
  */
  static parseGenericRow(row: any): CSVTrade | null {
    try {
      const symbolKey = findKey(row, HEADER_ALIASES.symbol);
      const sideKey = findKey(row, HEADER_ALIASES.side);
      const qtyKey = findKey(row, HEADER_ALIASES.quantity);
      const openPriceKey = findKey(row, HEADER_ALIASES.openPrice);
      const closePriceKey = findKey(row, HEADER_ALIASES.closePrice);
      const openTimeKey = findKey(row, HEADER_ALIASES.openTime);
      const closeTimeKey = findKey(row, HEADER_ALIASES.closeTime);
      const pnlKey = findKey(row, HEADER_ALIASES.pnl);
      const commissionKey = findKey(row, HEADER_ALIASES.commission);
      const swapKey = findKey(row, HEADER_ALIASES.swap);
      const commentKey = findKey(row, HEADER_ALIASES.comment);

      const symbol = symbolKey ? String(row[symbolKey] || '').trim() : '';
      if (!symbol) return null;

      const side = sideKey ? normalizeSide(row[sideKey]) : null;
      const profit = pnlKey ? toNumber(row[pnlKey]) : undefined;

      // Need at least a direction or a result - a row with neither says
      // nothing about a trade.
      if (!side && profit === undefined) return null;

      // Quantity stays as written: crypto is fractional (0.35 BTC), futures
      // and options are whole contracts, equities are shares. Defaulting a
      // missing size to a made-up number would misstate risk, so leave it 0.
      const volume = qtyKey ? (toNumber(row[qtyKey]) ?? 0) : 0;

      return {
        symbol,
        // With no explicit side, a profitable close reads as a long by
        // convention; the P&L itself is what the journal actually uses.
        type: side ?? 'buy',
        volume,
        open_price: openPriceKey ? (toNumber(row[openPriceKey]) ?? 0) : 0,
        close_price: closePriceKey ? toNumber(row[closePriceKey]) : undefined,
        open_time: openTimeKey ? this.parseDate(row[openTimeKey]) : new Date().toISOString().replace('T', ' ').substring(0, 19),
        close_time: closeTimeKey ? this.parseDate(row[closeTimeKey]) : undefined,
        profit,
        commission: commissionKey ? toNumber(row[commissionKey]) : undefined,
        swap: swapKey ? toNumber(row[swapKey]) : undefined,
        comment: commentKey ? row[commentKey] : undefined,
      };
    } catch (error) {
      console.error('Error parsing generic row:', error);
      return null;
    }
  }

  static async parseCSV(file: File): Promise<{ trades: CSVTrade[], format: string, errors: string[] }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());

          if (lines.length < 2) {
            reject(new Error('CSV file is empty or has no data rows'));
            return;
          }

          const headers = lines[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(h => h.trim().replace(/^"|"$/g, ''));
          const format = this.detectFormat(headers);

          if (!format) {
            reject(new Error('Unsupported CSV format. Please use MT4, MT5, or a generic trading history export.'));
            return;
          }

          const trades: CSVTrade[] = [];
          const errors: string[] = [];
          const orderRows: OrderRow[] = [];

          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
            const row: any = {};

            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });

            if (format === 'orders') {
              orderRows.push({
                symbol: String(row[findKey(row, HEADER_ALIASES.symbol) ?? ''] ?? '').trim(),
                side: normalizeSide(row[findKey(row, HEADER_ALIASES.side) ?? '']) ?? 'buy',
                qty: toNumber(row[findKey(row, HEADER_ALIASES.quantity) ?? '']) ?? 0,
                fillPrice: toNumber(row[findKey(row, ['fill price']) ?? '']) ?? 0,
                // Closing time is when it actually filled; placing time is
                // when it was submitted, which can be much earlier.
                time: String(row[findKey(row, ['closing time', 'placing time']) ?? ''] ?? '').trim(),
                status: String(row[findKey(row, ['status']) ?? ''] ?? '').trim(),
                commission: toNumber(row[findKey(row, HEADER_ALIASES.commission) ?? '']) ?? 0,
              });
              continue;
            }

            let trade: CSVTrade | null = null;

            switch (format) {
              case 'mt4':
                trade = this.parseMT4Row(row);
                break;
              case 'mt5':
                trade = this.parseMT5Row(row);
                break;
              case 'generic':
                trade = this.parseGenericRow(row);
                break;
            }

            if (trade) {
              trades.push(trade);
            } else {
              errors.push(`Row ${i + 1}: Could not parse trade data`);
            }
          }

          if (format === 'orders') {
            const { trades: paired, stillOpen, skippedUnfilled } = pairOrdersIntoTrades(orderRows);
            /*
              Said plainly, because the counts will not match the file and a
              trader would otherwise assume data was lost. Both numbers are
              expected, not faults.
            */
            if (skippedUnfilled > 0) {
              errors.push(`${skippedUnfilled} order${skippedUnfilled === 1 ? ' was' : 's were'} cancelled or never filled, so ${skippedUnfilled === 1 ? 'it was' : 'they were'} skipped.`);
            }
            if (stillOpen > 0) {
              errors.push(`${stillOpen} position${stillOpen === 1 ? ' is' : 's are'} still open, so ${stillOpen === 1 ? 'it has' : 'they have'} no exit price yet and cannot be imported.`);
            }
            resolve({ trades: paired, format, errors });
            return;
          }

          resolve({ trades, format, errors });
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  static async importTrades(trades: CSVTrade[], connectionId?: string): Promise<{ imported: number, updated: number, errors: string[] }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    let imported = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const trade of trades) {
      try {
        /*
          The trades table requires an exit price, an exit date and a P&L -
          it stores completed trades only. Sending null produced a raw
          Postgres constraint error for every row, shown to the user as
          "null value in column exit_price of relation trades violates
          not-null constraint", which tells a trader nothing.

          A row without an exit is a position that has not closed yet. It is
          reported as skipped rather than written with invented values.
        */
        if (trade.close_price == null || trade.profit == null) {
          errors.push(`${trade.symbol}: still open, so it has no exit price or profit yet and was skipped.`);
          continue;
        }

        const tradeData: any = {
          user_id: user.id,
          broker_id: connectionId || null,
          symbol: trade.symbol,
          direction: trade.type === 'buy' ? 'LONG' : 'SHORT',
          quantity: trade.volume,
          entry_price: trade.open_price,
          exit_price: trade.close_price,
          entry_date: trade.open_time,
          exit_date: trade.close_time || trade.open_time,
          pnl: trade.profit,
          fees: (trade.commission || 0) + (trade.swap || 0),
          notes: trade.comment || null,
        };

        const { error } = await supabase
          .from('trades')
          .insert(tradeData);

        if (error) {
          errors.push(`Failed to import ${trade.symbol}: ${error.message}`);
        } else {
          imported++;
        }
      } catch (error) {
        errors.push(`Failed to import ${trade.symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { imported, updated, errors };
  }
}

export const csvParser = CSVParser;
