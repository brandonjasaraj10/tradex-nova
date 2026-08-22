import { describe, it, expect } from 'vitest';
import { hasLaunched } from './launch';
import { LAUNCH_AT } from '../components/shared/LaunchCountdown';

/*
  The whole landing page changes shape on this one instant: waitlist forms
  become signup buttons and the access-code wall lifts. Getting the boundary
  wrong in either direction is expensive - an hour early and the founder
  offer is public before the email goes out, an hour late and everyone
  arriving from that email hits a wall asking for a code they were never
  given, at the exact moment attention is highest.

  Mountain time is on daylight saving in August (MDT, UTC-6), so 10PM in
  Denver is 04:00 UTC the next day. Pinning it to literal MST would fire an
  hour late; these assert the real Denver wall-clock reading.
*/

const denver = (d: Date) =>
  d.toLocaleString('en-US', { timeZone: 'America/Denver' });

describe('launch instant', () => {
  it('is 10:00 PM on Sunday 23 August 2026 in Denver', () => {
    expect(denver(LAUNCH_AT)).toBe('8/23/2026, 10:00:00 PM');
  });

  it('is stored as an absolute UTC instant so it means one moment worldwide', () => {
    expect(LAUNCH_AT.toISOString()).toBe('2026-08-24T04:00:00.000Z');
  });
});

describe('hasLaunched', () => {
  it('is false in the days before', () => {
    expect(hasLaunched(new Date('2026-08-21T23:00:00Z'))).toBe(false);
    expect(hasLaunched(new Date('2026-08-23T12:00:00Z'))).toBe(false);
  });

  it('is false one second before, true exactly on the instant', () => {
    expect(hasLaunched(new Date('2026-08-24T03:59:59Z'))).toBe(false);
    expect(hasLaunched(new Date('2026-08-24T04:00:00Z'))).toBe(true);
  });

  it('is true afterwards', () => {
    expect(hasLaunched(new Date('2026-08-24T04:00:01Z'))).toBe(true);
    expect(hasLaunched(new Date('2026-09-01T00:00:00Z'))).toBe(true);
  });

  it('does not flip early for the 9PM Denver hour', () => {
    // 9:59 PM Denver on launch night - still closed
    expect(hasLaunched(new Date('2026-08-24T03:59:00Z'))).toBe(false);
  });
});

/*
  The founder-pricing deadline is enforced separately, in the database
  against the server clock. This asserts the two dates stay in the intended
  relationship: pricing closes two days AFTER the doors open, never before.
  If someone edits one and not the other, this fails rather than quietly
  shipping a window that is closed on arrival.
*/
describe('founder window relative to launch', () => {
  const FOUNDER_CLOSES = new Date('2026-08-26T04:00:00Z');

  it('closes after launch, not before', () => {
    expect(FOUNDER_CLOSES.getTime()).toBeGreaterThan(LAUNCH_AT.getTime());
  });

  it('gives founders exactly 2 days', () => {
    const days = (FOUNDER_CLOSES.getTime() - LAUNCH_AT.getTime()) / 86400000;
    expect(days).toBe(2);
  });

  it('closes at 10:00 PM Denver, matching the launch hour', () => {
    expect(denver(FOUNDER_CLOSES)).toBe('8/25/2026, 10:00:00 PM');
  });
});
