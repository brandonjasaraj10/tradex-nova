import { describe, it, expect } from 'vitest';
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
