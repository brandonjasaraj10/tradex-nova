import { describe, it, expect } from 'vitest';
import { calculatePnL } from './trades';
import type { TradeFormData } from '../types/trade';

function trade(overrides: Partial<TradeFormData>): TradeFormData {
  return {
    symbol: 'EURUSD',
    direction: 'LONG',
    entry_price: 100,
    exit_price: 110,
    quantity: 1,
    entry_date: new Date('2026-01-01T00:00:00Z'),
    exit_date: new Date('2026-01-01T01:00:00Z'),
    fees: 0,
    tags: [],
    ...overrides,
  };
}

describe('calculatePnL', () => {
  it('computes a positive LONG trade correctly', () => {
    expect(calculatePnL(trade({ direction: 'LONG', entry_price: 100, exit_price: 110, quantity: 2 }))).toBe(20);
  });

  it('computes a losing LONG trade correctly', () => {
    expect(calculatePnL(trade({ direction: 'LONG', entry_price: 100, exit_price: 90, quantity: 2 }))).toBe(-20);
  });

  it('computes a positive SHORT trade correctly (price fell)', () => {
    expect(calculatePnL(trade({ direction: 'SHORT', entry_price: 100, exit_price: 90, quantity: 3 }))).toBe(30);
  });

  it('computes a losing SHORT trade correctly (price rose)', () => {
    expect(calculatePnL(trade({ direction: 'SHORT', entry_price: 100, exit_price: 110, quantity: 3 }))).toBe(-30);
  });

  it('returns zero when entry and exit prices are equal', () => {
    expect(calculatePnL(trade({ direction: 'LONG', entry_price: 100, exit_price: 100, quantity: 5 }))).toBe(0);
  });
});
