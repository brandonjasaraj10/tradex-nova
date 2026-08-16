import { describe, it, expect } from 'vitest';
import { calculateNOVAScore, type TradeData } from './novaScore';

function makeTrade(overrides: Partial<TradeData>): TradeData {
  return {
    profit_loss: 0,
    entry_time: '2026-01-01T09:00:00Z',
    exit_time: '2026-01-01T10:00:00Z',
    ...overrides,
  };
}

describe('calculateNOVAScore', () => {
  it('returns an all-zero score for no trades', async () => {
    const result = await calculateNOVAScore([]);
    expect(result.overall_score).toBe(0);
    expect(result.total_trades).toBe(0);
    expect(result.win_rate).toBe(0);
  });

  it('gives a 100% win rate for a single winning trade', async () => {
    const result = await calculateNOVAScore([makeTrade({ profit_loss: 100 })]);
    expect(result.win_rate).toBe(100);
    expect(result.total_trades).toBe(1);
  });

  it('gives a 0% win rate for a single losing trade', async () => {
    const result = await calculateNOVAScore([makeTrade({ profit_loss: -50 })]);
    expect(result.win_rate).toBe(0);
  });

  it('computes win rate correctly across mixed trades', async () => {
    const trades = [
      makeTrade({ profit_loss: 100 }),
      makeTrade({ profit_loss: 100 }),
      makeTrade({ profit_loss: -50 }),
      makeTrade({ profit_loss: -50 }),
    ];
    const result = await calculateNOVAScore(trades);
    expect(result.win_rate).toBe(50);
  });

  it('never returns a score outside 0-100 regardless of input extremity', async () => {
    const trades = Array.from({ length: 50 }, (_, i) =>
      makeTrade({ profit_loss: i % 2 === 0 ? 1000000 : -1 })
    );
    const result = await calculateNOVAScore(trades);
    expect(result.overall_score).toBeGreaterThanOrEqual(0);
    expect(result.overall_score).toBeLessThanOrEqual(100);
    expect(result.consistency_score).toBeGreaterThanOrEqual(0);
    expect(result.consistency_score).toBeLessThanOrEqual(100);
  });

  it('treats a break-even trade as not winning', async () => {
    const result = await calculateNOVAScore([makeTrade({ profit_loss: 0 })]);
    expect(result.win_rate).toBe(0);
  });
});
