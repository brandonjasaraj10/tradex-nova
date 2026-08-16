import { describe, it, expect } from 'vitest';
import { CSVParser } from './csvParser';

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
