import { describe, it, expect } from 'vitest';
import { tradeOutcome, valueColorClass, parseOutcomeQuery } from './formatMetrics';

describe('tradeOutcome', () => {
  it('calls a profitable trade a win', () => {
    expect(tradeOutcome(4000)).toBe('win');
    expect(tradeOutcome(0.01)).toBe('win');
  });

  it('calls a losing trade a loss', () => {
    expect(tradeOutcome(-1000)).toBe('loss');
    expect(tradeOutcome(-0.01)).toBe('loss');
  });

  /*
    The case worth pinning down. A trade closed at exactly the entry price has
    not lost anything, and this label is counted and searched - so calling it a
    loss would misstate someone's record on the page they use to judge it.
  */
  it('treats an exactly flat trade as breakeven, not a loss', () => {
    expect(tradeOutcome(0)).toBe('breakeven');
    expect(tradeOutcome(-0)).toBe('breakeven');
  });

  it('does not label a missing or broken number as a win or a loss', () => {
    expect(tradeOutcome(NaN)).toBe('breakeven');
    expect(tradeOutcome(Infinity)).toBe('breakeven');
  });
});

describe('valueColorClass', () => {
  it('agrees with tradeOutcome about what counts as a gain', () => {
    expect(valueColorClass(500)).toContain('blue');
    expect(valueColorClass(-500)).toContain('gray');
    // Zero is neutral in both, so a flat trade is never painted as profit.
    expect(valueColorClass(0)).toContain('gray');
    expect(tradeOutcome(0)).toBe('breakeven');
  });
});

describe('parseOutcomeQuery', () => {
  it('reads the bare outcome words, and their plurals', () => {
    expect(parseOutcomeQuery('win')).toBe('win');
    expect(parseOutcomeQuery('wins')).toBe('win');
    expect(parseOutcomeQuery('loss')).toBe('loss');
    expect(parseOutcomeQuery('losses')).toBe('loss');
    expect(parseOutcomeQuery('even')).toBe('breakeven');
  });

  it('ignores case and surrounding spaces', () => {
    expect(parseOutcomeQuery('  LOSS ')).toBe('loss');
  });

  /*
    The bug this was written for. Trading notes are full of "stop loss", so a
    substring search for "loss" returned nearly every winner too. A bare
    "loss" must filter by outcome; a phrase containing it must not.
  */
  it('leaves phrases containing an outcome word to the text search', () => {
    expect(parseOutcomeQuery('stop loss')).toBeNull();
    expect(parseOutcomeQuery('cut the loss early')).toBeNull();
    expect(parseOutcomeQuery('winning streak')).toBeNull();
  });

  it('returns null for anything that is not an outcome word', () => {
    expect(parseOutcomeQuery('btc')).toBeNull();
    expect(parseOutcomeQuery('')).toBeNull();
    expect(parseOutcomeQuery('4000')).toBeNull();
  });
});
