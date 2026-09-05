import { describe, it, expect } from 'vitest';
import { pairOrdersIntoTrades, type OrderRow } from './csvParser';
import { CSVParser, normalizeSide } from './csvParser';

describe('CSVParser.detectFormat', () => {
  it('detects MT4 format', () => {
    expect(CSVParser.detectFormat(['Ticket', 'Open Time', 'Type', 'Volume'])).toBe('mt4');
  });

  it('detects MT5 format (has magic number column)', () => {
    expect(CSVParser.detectFormat(['Ticket', 'Open Time', 'Type', 'Magic'])).toBe('mt5');
  });

  it('detects generic format', () => {
    expect(CSVParser.detectFormat(['Symbol', 'Profit', 'Side'])).toBe('generic');
  });

  it('returns null for unrecognized headers', () => {
    expect(CSVParser.detectFormat(['Foo', 'Bar'])).toBeNull();
  });
});

describe('CSVParser.parseMT4Row', () => {
  it('parses a valid buy row', () => {
    const row = {
      Ticket: '12345',
      Symbol: 'EURUSD',
      Type: 'buy',
      Volume: '0.5',
      'Open Price': '1.1000',
      'Open Time': '2026.01.01 10:00:00',
      'Close Price': '1.1050',
      'Close Time': '2026.01.01 12:00:00',
      Profit: '50.00',
      Commission: '-1.00',
      Swap: '0.00',
      Comment: 'test',
    };
    const trade = CSVParser.parseMT4Row(row);
    expect(trade).not.toBeNull();
    expect(trade?.symbol).toBe('EURUSD');
    expect(trade?.type).toBe('buy');
    expect(trade?.volume).toBe(0.5);
    expect(trade?.open_price).toBe(1.1);
    expect(trade?.profit).toBe(50);
  });

  it('parses a sell row', () => {
    const row = { Ticket: '1', Symbol: 'GBPUSD', Type: 'sell', Volume: '1', 'Open Price': '1.25', 'Open Time': '2026.01.01 10:00:00' };
    expect(CSVParser.parseMT4Row(row)?.type).toBe('sell');
  });

  it('returns null when Type is neither buy nor sell', () => {
    const row = { Ticket: '1', Symbol: 'EURUSD', Type: 'deposit', Volume: '1', 'Open Price': '1.1', 'Open Time': '2026.01.01 10:00:00' };
    expect(CSVParser.parseMT4Row(row)).toBeNull();
  });

  it('returns null when Type is missing entirely', () => {
    const row = { Ticket: '1', Symbol: 'EURUSD', Volume: '1', 'Open Price': '1.1', 'Open Time': '2026.01.01 10:00:00' };
    expect(CSVParser.parseMT4Row(row)).toBeNull();
  });
});

describe('CSVParser.parseGenericRow', () => {
  it('parses a row with loosely-matching header names', () => {
    const row = { Symbol: 'BTCUSD', Side: 'long', Size: '0.1', EntryPrice: '50000', Date: '2026.01.01 10:00:00', PnL: '100' };
    const trade = CSVParser.parseGenericRow(row);
    expect(trade).not.toBeNull();
    expect(trade?.type).toBe('buy');
    expect(trade?.open_price).toBe(50000);
  });

  it('returns null when required columns cannot be found', () => {
    const row = { Foo: 'bar' };
    expect(CSVParser.parseGenericRow(row)).toBeNull();
  });
});

describe('CSVParser.parseDate', () => {
  it('normalizes MT4-style dot-separated dates', () => {
    expect(CSVParser.parseDate('2026.03.15 14:30:00')).toBe('2026-03-15 14:30:00');
  });

  it('normalizes DD/MM/YYYY dates', () => {
    expect(CSVParser.parseDate('15/03/2026 14:30:00')).toBe('2026-03-15 14:30:00');
  });
});

/*
  The app advertises support for stocks, options, futures, forex and crypto,
  so the importer has to read what those brokers actually export - not just
  MetaTrader. Each fixture below uses the column names and side vocabulary a
  real export from that market uses.

  Before this, detectFormat() demanded headers containing literally "symbol"
  AND "profit", so every one of these files was rejected as "Unsupported CSV
  format" without a single row being read.
*/

function headersOf(csv: string): string[] {
  return csv.trim().split('\n')[0]
    .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    .map(h => h.trim().replace(/^"|"$/g, ''));
}

function rowsOf(csv: string) {
  const lines = csv.trim().split('\n');
  const headers = headersOf(csv);
  return lines.slice(1).map(line => {
    const vals = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
    return row;
  });
}

const FUTURES_CSV = `Contract,B/S,Qty,Avg Price,Exit Price,Bought Timestamp,P/L,Commission
MNQZ5,Buy,4,20050.00,20080.00,2026-08-11 09:35:00,240.00,-5.36
ESZ5,Sell,2,5850.25,5842.00,2026-08-12 13:10:00,825.00,-4.20`;

const OPTIONS_CSV = `Symbol,Action,Qty,Net Price,Exec Time,Realized P&L,Fees
SPY 08/22/26 600 C,BTO,10,2.50,2026-08-18 09:45:00,0,6.50
SPY 08/22/26 600 C,STC,10,3.20,2026-08-18 14:20:00,700.00,6.50`;

const CRYPTO_CSV = `Product,Side,Size,Price,Created At,Total,Fee
BTC-USD,BUY,0.35,61200.00,2026-08-14 11:02:00,21420.00,10.71
ETH-USDT,SELL,4.2,3310.50,2026-08-15 18:44:00,13904.10,6.95`;

const EQUITIES_CSV = `Ticker,Transaction Type,Shares,Entry,Date,Gain/Loss
AAPL,Bought,200,224.10,2026-08-10,750.00
TSLA,Sold Short,50,242.00,2026-08-13,"($315.00)"`;

describe('CSV format detection across markets', () => {
  const cases: [string, string][] = [
    ['futures (Tradovate-style: Contract / B/S / P/L)', FUTURES_CSV],
    ['options (Thinkorswim-style: Action / Net Price)', OPTIONS_CSV],
    ['crypto (Coinbase-style: Product / Size / Total)', CRYPTO_CSV],
    ['equities (Ticker / Transaction Type / Gain-Loss)', EQUITIES_CSV],
  ];

  it.each(cases)('recognises %s', (_label, csv) => {
    expect(CSVParser.detectFormat(headersOf(csv))).toBe('generic');
  });

  it('still recognises MetaTrader exports', () => {
    const mt4 = 'Ticket,Open Time,Symbol,Type,Volume,Open Price,Profit';
    expect(CSVParser.detectFormat(mt4.split(','))).toBe('mt4');
  });

  it('rejects a file with nothing tradeable in it', () => {
    expect(CSVParser.detectFormat(['Name', 'Email', 'Signed Up'])).toBeNull();
  });
});

describe('side normalisation', () => {
  it.each([
    ['Buy', 'buy'], ['Bought', 'buy'], ['BTO', 'buy'], ['B', 'buy'], ['long', 'buy'],
    ['Sell', 'sell'], ['Sold', 'sell'], ['STC', 'sell'], ['S', 'sell'],
    ['Sold Short', 'sell'], ['sell to open', 'sell'],
  ])('reads %s as %s', (input, expected) => {
    expect(normalizeSide(input)).toBe(expected);
  });

  it('returns null when there is no side to read', () => {
    expect(normalizeSide('')).toBeNull();
    expect(normalizeSide(undefined)).toBeNull();
  });
});

describe('parsing rows from each market', () => {
  it('futures: keeps contract symbol and whole-contract quantity', () => {
    const trades = rowsOf(FUTURES_CSV).map(r => CSVParser.parseGenericRow(r));
    expect(trades.every(Boolean)).toBe(true);
    expect(trades[0]).toMatchObject({ symbol: 'MNQZ5', type: 'buy', volume: 4, profit: 240 });
    expect(trades[1]).toMatchObject({ symbol: 'ESZ5', type: 'sell', volume: 2, profit: 825 });
  });

  it('options: reads BTO/STC and keeps the full contract description', () => {
    const trades = rowsOf(OPTIONS_CSV).map(r => CSVParser.parseGenericRow(r));
    expect(trades.every(Boolean)).toBe(true);
    expect(trades[0]!.type).toBe('buy');
    expect(trades[1]!.type).toBe('sell');
    // strike and expiry must survive - they identify the contract
    expect(trades[0]!.symbol).toContain('600 C');
    expect(trades[1]!.profit).toBe(700);
  });

  it('crypto: preserves fractional size rather than rounding it', () => {
    const trades = rowsOf(CRYPTO_CSV).map(r => CSVParser.parseGenericRow(r));
    expect(trades.every(Boolean)).toBe(true);
    expect(trades[0]).toMatchObject({ symbol: 'BTC-USD', type: 'buy', volume: 0.35 });
    expect(trades[1]).toMatchObject({ symbol: 'ETH-USDT', type: 'sell', volume: 4.2 });
  });

  it('equities: reads share counts and accounting-style negative P&L', () => {
    const trades = rowsOf(EQUITIES_CSV).map(r => CSVParser.parseGenericRow(r));
    expect(trades.every(Boolean)).toBe(true);
    expect(trades[0]).toMatchObject({ symbol: 'AAPL', type: 'buy', volume: 200, profit: 750 });
    // "($315.00)" is a loss, not a positive number
    expect(trades[1]).toMatchObject({ symbol: 'TSLA', type: 'sell', volume: 50, profit: -315 });
  });

  it('skips a row with no symbol, and one with neither side nor P&L', () => {
    expect(CSVParser.parseGenericRow({ Symbol: '', Side: 'Buy', 'P/L': '100' })).toBeNull();
    expect(CSVParser.parseGenericRow({ Symbol: 'AAPL', Notes: 'watchlist idea' })).toBeNull();
  });
});

describe('TradingView order pairing', () => {
  const order = (o: Partial<OrderRow>): OrderRow => ({
    symbol: 'FX:EURUSD', side: 'buy', qty: 1000, fillPrice: 1.1, time: '2026-09-02 10:00:00',
    status: 'Filled', commission: 0, ...o,
  });

  it('pairs a buy and a later sell into one completed trade', () => {
    const { trades } = pairOrdersIntoTrades([
      order({ side: 'buy', fillPrice: 1.16156, time: '2026-09-02 10:00:00' }),
      order({ side: 'sell', fillPrice: 1.16246, time: '2026-09-02 11:00:00' }),
    ]);
    expect(trades).toHaveLength(1);
    expect(trades[0].open_price).toBe(1.16156);
    expect(trades[0].close_price).toBe(1.16246);
    expect(trades[0].type).toBe('buy');
    expect(trades[0].profit).toBeCloseTo(0.9, 6);
  });

  /*
    A short opens with a sell. Assuming every trade starts with a buy would
    report the entry and exit the wrong way round and invert the P&L.
  */
  it('treats a sell-first sequence as a short, and profits when price falls', () => {
    const { trades } = pairOrdersIntoTrades([
      order({ side: 'sell', fillPrice: 1.2, time: '2026-09-02 10:00:00' }),
      order({ side: 'buy', fillPrice: 1.1, time: '2026-09-02 11:00:00' }),
    ]);
    expect(trades).toHaveLength(1);
    expect(trades[0].type).toBe('sell');
    expect(trades[0].open_price).toBe(1.2);
    expect(trades[0].profit).toBeCloseTo(100, 6);
  });

  /*
    The exact failure the user hit: unfilled orders export with a fill price
    of 0.00000. Importing those as trades would invent vast fake losses.
  */
  it('ignores cancelled and rejected orders', () => {
    const { trades, skippedUnfilled } = pairOrdersIntoTrades([
      order({ side: 'buy', status: 'Cancelled', fillPrice: 0 }),
      order({ side: 'sell', status: 'Rejected', fillPrice: 0 }),
      order({ side: 'buy', fillPrice: 1.1, time: '2026-09-02 10:00:00' }),
      order({ side: 'sell', fillPrice: 1.2, time: '2026-09-02 11:00:00' }),
    ]);
    expect(skippedUnfilled).toBe(2);
    expect(trades).toHaveLength(1);
  });

  it('matches oldest position first when several are open', () => {
    const { trades } = pairOrdersIntoTrades([
      order({ side: 'buy', fillPrice: 1.0, time: '2026-09-02 10:00:00' }),
      order({ side: 'buy', fillPrice: 1.5, time: '2026-09-02 10:30:00' }),
      order({ side: 'sell', fillPrice: 2.0, time: '2026-09-02 11:00:00' }),
    ]);
    expect(trades).toHaveLength(1);
    expect(trades[0].open_price).toBe(1.0);
  });

  it('splits a close that covers only part of a position', () => {
    const { trades, stillOpen } = pairOrdersIntoTrades([
      order({ side: 'buy', qty: 1000, fillPrice: 1.0, time: '2026-09-02 10:00:00' }),
      order({ side: 'sell', qty: 400, fillPrice: 1.1, time: '2026-09-02 11:00:00' }),
    ]);
    expect(trades).toHaveLength(1);
    expect(trades[0].volume).toBe(400);
    expect(stillOpen).toBe(1);
  });

  /*
    An order still open at export time has no exit, and the trades table
    requires one. It must be reported, never invented.
  */
  it('counts positions left open rather than inventing an exit', () => {
    const { trades, stillOpen } = pairOrdersIntoTrades([
      order({ side: 'buy', fillPrice: 1.1, time: '2026-09-02 10:00:00' }),
    ]);
    expect(trades).toHaveLength(0);
    expect(stillOpen).toBe(1);
  });

  it('keeps different symbols separate', () => {
    const { trades, stillOpen } = pairOrdersIntoTrades([
      order({ symbol: 'FX:EURUSD', side: 'buy', time: '2026-09-02 10:00:00' }),
      order({ symbol: 'FX:GBPUSD', side: 'sell', time: '2026-09-02 11:00:00' }),
    ]);
    expect(trades).toHaveLength(0);
    expect(stillOpen).toBe(2);
  });
});

describe('detecting an order history export', () => {
  // TradingView's own export dialog, verified against TradeZella's and
  // Journalit's import guides.
  const TRADINGVIEW = ['Symbol', 'Side', 'Type', 'Qty', 'Limit price', 'Stop price',
    'Fill price', 'Status', 'Commission', 'Placing time', 'Closing time',
    'Order ID', 'Level ID', 'Leverage', 'Margin'];

  it('routes a TradingView order history to the pairing path', () => {
    expect(CSVParser.detectFormat(TRADINGVIEW)).toBe('orders');
  });

  /*
    A real trade export has an exit and a P&L, so it must keep going down the
    generic path even though it also carries a status column.
  */
  it('leaves a genuine closed-trade export on the generic path', () => {
    expect(CSVParser.detectFormat(
      ['Symbol', 'Side', 'Qty', 'Fill price', 'Status', 'Close price', 'Realized P&L']
    )).toBe('generic');
  });
});
