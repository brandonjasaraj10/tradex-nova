import { describe, it, expect } from 'vitest';
import { sanitizeProperties } from './productAnalytics';

/*
  These guard a real leak, not a hypothetical one.

  Calendar day cells are clickable buttons whose visible label is that day's
  profit or loss ("+$1,000"). PostHog's autocapture records the text of
  whatever was clicked, so with default settings every calendar click would
  send a user's actual trading results to a third party - and session-replay
  masking would not catch it, because this travels as an event property
  rather than a recorded frame.

  If someone later removes the sanitizer or PostHog changes property names,
  these fail loudly instead of the app quietly starting to ship P&L.
*/

describe('PostHog property sanitizer', () => {
  it('strips the clicked element text that would carry a P&L figure', () => {
    const clean = sanitizeProperties({
      $event_type: 'click',
      $el_text: '+$1,000',
      $current_url: 'https://www.tradexnova.com/calendar',
    });
    expect(clean.$el_text).toBeUndefined();
    // non-sensitive context is kept, otherwise the data is useless
    expect(clean.$event_type).toBe('click');
  });

  it('strips text from every element in the click chain, not just the target', () => {
    const clean = sanitizeProperties({
      $elements: [
        { tag_name: 'button', $el_text: '+$1,000', attr__class: 'calendar-day' },
        { tag_name: 'div', text: 'Journal entry: revenge traded again', attr__title: '-$430' },
      ],
    });
    const els = clean.$elements as Record<string, unknown>[];
    expect(els[0].$el_text).toBeUndefined();
    expect(els[1].text).toBeUndefined();
    expect(els[1].attr__title).toBeUndefined();
    // structural info survives so the click is still attributable to a feature
    expect(els[0].tag_name).toBe('button');
    expect(els[0].attr__class).toBe('calendar-day');
  });

  it('strips value and aria-label, which also render figures in this app', () => {
    const clean = sanitizeProperties({
      $elements: [{ tag_name: 'input', attr__value: '4250.75', attr__aria_label: 'Profit/Loss' }],
    });
    const els = clean.$elements as Record<string, unknown>[];
    expect(els[0].attr__value).toBeUndefined();
    expect(els[0].attr__aria_label).toBeUndefined();
  });

  it('drops the raw elements chain string, which embeds the same text', () => {
    const clean = sanitizeProperties({
      $elements_chain: 'button:text="+$1,000"nth-child="3"',
    });
    expect(clean.$elements_chain).toBeUndefined();
  });

  it('does not mutate the object it was handed', () => {
    const original = { $el_text: '+$1,000', keep: 'yes' };
    const clean = sanitizeProperties(original);
    expect(original.$el_text).toBe('+$1,000');
    expect(clean.keep).toBe('yes');
  });

  it('handles events with no element data at all', () => {
    expect(() => sanitizeProperties({})).not.toThrow();
    expect(sanitizeProperties({ path: '/dashboard' }).path).toBe('/dashboard');
  });
});
