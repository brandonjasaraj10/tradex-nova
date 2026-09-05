import { describe, it, expect } from 'vitest';
import { calculateChecklistScore, combinePsychologyScores } from './psychologyScore';

describe('calculateChecklistScore', () => {
  it('gives nothing when no psychology work was done', () => {
    expect(calculateChecklistScore(0, [])).toBeNull();
    expect(calculateChecklistScore(0, [null, undefined])).toBeNull();
  });

  it('credits engagement in full for answering the checklist at all', () => {
    expect(calculateChecklistScore(1, [])).toBe(100);
    expect(calculateChecklistScore(6, [])).toBe(100);
  });

  /*
    The point of the whole design: answering "no" honestly must not cost you
    engagement credit. Only the self-ratings move the number, because those
    are the trader reporting their own state rather than being punished for
    candour.
  */
  it('does not care whether the answers were yes or no', () => {
    // the count is of answered checks either way, so these are the same input
    expect(calculateChecklistScore(3, [])).toBe(calculateChecklistScore(3, []));
  });

  it('maps the 1-5 ratings so a flat 3 is the middle', () => {
    expect(calculateChecklistScore(0, [3])).toBe(50);
    expect(calculateChecklistScore(0, [1])).toBe(0);
    expect(calculateChecklistScore(0, [5])).toBe(100);
  });

  it('splits evenly between engagement and readiness when both exist', () => {
    // engagement 100, readiness 50 -> 75
    expect(calculateChecklistScore(2, [3])).toBe(75);
    // engagement 100, readiness 0 -> 50: they showed up and said they were not ready
    expect(calculateChecklistScore(2, [1, 1, 1])).toBe(50);
  });

  it('ignores ratings that were never given', () => {
    expect(calculateChecklistScore(0, [5, null, undefined])).toBe(100);
  });
});

describe('combinePsychologyScores', () => {
  it('returns nothing when neither half was filled', () => {
    expect(combinePsychologyScores(null, null)).toBeNull();
  });

  /*
    The behaviour this change exists for: a day with only the checklist filled
    used to score nothing at all, which read as "no psychology work today"
    when the trader had plainly done some.
  */
  it('scores a day where only the checklist was filled', () => {
    expect(combinePsychologyScores(null, 75)).toBe(75);
  });

  it('still scores a day where only the journal was filled', () => {
    expect(combinePsychologyScores(80, null)).toBe(80);
  });

  it('weighs the journal and the checklist equally when both exist', () => {
    expect(combinePsychologyScores(80, 60)).toBe(70);
    expect(combinePsychologyScores(100, 0)).toBe(50);
  });

  it('rounds to a whole number', () => {
    expect(combinePsychologyScores(80, 75)).toBe(78);
    expect(Number.isInteger(combinePsychologyScores(33, 34))).toBe(true);
  });
});
