import { useEffect, useState } from 'react';
import { LAUNCH_AT } from '../components/shared/LaunchCountdown';

/*
  Whether TradeX has opened to the public yet.

  The site has to behave differently either side of Sunday 23 Aug 2026,
  10:00 PM MDT: before it, the point of the page is collecting waitlist
  emails behind an access code; after it, anyone can sign up directly.

  Driven off the same LAUNCH_AT instant the countdown uses, so the two can
  never disagree - a page showing "we're live" beside a waitlist form would
  be worse than either state on its own. It also means nobody has to deploy
  anything at 10PM on a Sunday night: the site changes itself.

  This is presentation only. It decides which form a visitor sees, not who
  is allowed to pay - founder pricing is enforced in the database against
  the server's clock, so a visitor with a wrong system clock can see the
  signup form early but still cannot buy at a price they aren't entitled to.
*/
export function hasLaunched(now: Date = new Date()): boolean {
  return now.getTime() >= LAUNCH_AT.getTime();
}

/*
  Hook form, which re-renders the moment launch passes.

  People will be sitting on this page waiting for 10PM. Reading the value
  once on mount would leave them staring at a waitlist form and a countdown
  reading zero until they thought to refresh; this flips the page under them
  at the exact second instead. The timer stops as soon as it has fired, so
  it isn't running forever afterwards.
*/
export function useHasLaunched(): boolean {
  const [launched, setLaunched] = useState(() => hasLaunched());

  useEffect(() => {
    if (launched) return;
    const id = setInterval(() => {
      if (hasLaunched()) {
        setLaunched(true);
        clearInterval(id);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [launched]);

  return launched;
}
