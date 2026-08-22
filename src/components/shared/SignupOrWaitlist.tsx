import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import WaitlistCapture from './WaitlistCapture';
import { useHasLaunched } from '../../lib/launch';

/*
  One call-to-action that changes itself at launch.

  Before Sunday 23 Aug 10PM MDT the landing page is collecting waitlist
  emails; after it, the product is open and the same spots should send
  people straight to signup. Both states live here so the three places the
  landing page asks for action can never drift apart - one saying "join the
  waitlist" while another says "start free trial" is the kind of thing
  nobody notices until a customer points it out.

  Flipping on a shared timestamp rather than a deploy means nothing has to
  be shipped at 10PM on a Sunday, and anyone already sitting on the page
  waiting sees it change under them rather than staring at a stale form.
*/

interface Props {
  /** waitlist placeholder text, pre-launch only */
  placeholder?: string;
  /*
    Kept separate rather than one shared footnote: the pre-launch lines all
    say "join before launch", which reads as nonsense once the product is
    open. A single prop rendered in both states left that text sitting under
    a "Start your free trial" button.
  */
  preLaunchFootnote?: React.ReactNode;
  postLaunchFootnote?: React.ReactNode;
  className?: string;
}

export default function SignupOrWaitlist({
  placeholder = 'Enter your email',
  preLaunchFootnote,
  postLaunchFootnote,
  className = '',
}: Props) {
  const launched = useHasLaunched();

  if (!launched) {
    return (
      <div className={className}>
        <WaitlistCapture
          size="lg"
          placeholder={placeholder}
          buttonText="Join Waitlist"
          variant="stacked"
        />
        {preLaunchFootnote}
      </div>
    );
  }

  return (
    <div className={className}>
      {/*
        "Start My Free Trial", not "Get Started": across SaaS pricing pages
        "Get Started" reads as freemium, while "Start Free Trial" is used
        almost exclusively by time-limited trials - which is what this is.
        First person ("My" over "Your") tests 15-20% better.

        Deliberately not "No credit card required", despite that line
        lifting conversion: Stripe collects a card before the trial starts,
        so it would be false and the customer would find out at checkout.
        The subtext below says only things that are actually true.

        White rather than the app's blue - on a near-black page the
        highest-contrast element should be the one action worth taking.

        The gradient runs white into a light silver rather than staying flat,
        with a bright inset line along the top edge and a soft outer bloom.
        That reads as polished metal catching light instead of a plain white
        rectangle, which is what makes it feel considered rather than default
        - the same reason the headline uses a gradient instead of solid white.
      */}
      <Link
        to="/auth?mode=signup"
        className="group w-full inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-base font-semibold text-black
                   bg-gradient-to-b from-white via-white to-neutral-300
                   ring-1 ring-white/70
                   shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_36px_-12px_rgba(255,255,255,0.5)]
                   transition-all duration-300
                   hover:from-white hover:via-white hover:to-neutral-200
                   hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_16px_44px_-12px_rgba(255,255,255,0.7)]"
      >
        Start My Free Trial
        <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
      </Link>
      <p className="mt-3 text-sm text-gray-400 text-center">
        7 days free · No charge today · Cancel anytime
      </p>
      {postLaunchFootnote}
    </div>
  );
}
