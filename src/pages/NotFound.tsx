import { Link } from 'react-router-dom';
import MascotSays from '../components/shared/MascotSays';

/*
  The 404.

  Rebuilt rather than decorated. It was still on the gold theme this project
  abandoned - text-gold-400, bg-dark-400 - and neither is defined in
  tailwind.config, so they rendered as nothing: an invisible circle behind a
  gold heading that was not gold. It also offered "Back to Dashboard" while
  navigating to the marketing home page, which is the wrong promise for a
  signed-out visitor and the wrong destination for a signed-in one.

  The mascot belongs here, which is not true of most pages. A 404 is a
  moment of confusion rather than a product claim - somebody is lost, and
  nothing on the screen is selling them anything - and that is the category
  of moment a character actually helps with. It is also the cheapest
  possible place to be charming: nobody's decision depends on it.

  The copy says what happened instead of making a trading pun about it. The
  old version - "The trading chart you're looking for seems to have dipped
  off the map. Let's navigate back to more profitable territory" - is the
  kind of writing that reads as filler, and it promised profit on a page
  whose only job is a working link.
*/
export default function NotFound() {
  return (
    <div className="min-h-screen bg-brand-bg text-white flex items-center justify-center px-5 py-12">
      <div className="text-center max-w-sm">
        <MascotSays pose="slump" height={128} side="above" className="mb-8">
          This page does not exist.
        </MascotSays>

        <h1 className="text-[28px] sm:text-[32px] leading-[1.15] font-semibold tracking-[-0.03em] text-white">
          Nothing here
        </h1>
        <p className="mt-3 text-[14.5px] text-gray-400 leading-relaxed text-balance">
          The link is wrong, or the page moved. Neither is your fault.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            to="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-3
              rounded-full bg-white text-black text-[14px] font-medium hover:bg-gray-200 transition-colors"
          >
            Go to your dashboard
          </Link>
          {/*
            Two destinations because there are two kinds of visitor here and
            the old page assumed one. Somebody signed in wants the app;
            somebody who followed a bad link from outside wants the site.
          */}
          <Link
            to="/"
            className="text-[13px] text-gray-500 hover:text-white transition-colors underline underline-offset-[3px] decoration-white/20 hover:decoration-white/50"
          >
            Back to the home page
          </Link>
        </div>
      </div>
    </div>
  );
}
