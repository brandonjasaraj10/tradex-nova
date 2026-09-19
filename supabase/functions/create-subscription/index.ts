import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Stripe } from "npm:stripe@13.10.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const body = await req.json();
    const priceId = body?.priceId;
    /*
      Embedded checkout keeps the card form on our own page instead of
      sending people to checkout.stripe.com. Same Checkout Session either
      way - the card fields are still Stripe's iframe, so card numbers never
      touch us and PCI scope does not move.

      Requested by the caller rather than switched on here, because this
      function deploys the moment it is saved while the frontend ships on a
      push. For however long those are out of step, an old bundle asks for
      the redirect it knows how to handle and gets exactly what it got
      yesterday.
    */
    const embedded = body?.embedded === true;

    if (!priceId) {
      throw new Error('Price ID is required');
    }

    /*
      Founder pricing is waitlist-only, and this is the only place that can
      actually enforce it. The founder price ids ship inside the frontend
      bundle, so without this check anyone could POST one here and lock in
      $14.99 forever regardless of whether they ever joined the waitlist.

      is_founder_eligible() derives the email from the caller's signed JWT,
      so it answers only about the authenticated user and can't be spoofed
      by anything in the request body.
    */
    const founderPriceIds = [
      Deno.env.get('STRIPE_FOUNDER_MONTHLY_PRICE_ID'),
      Deno.env.get('STRIPE_FOUNDER_ANNUAL_PRICE_ID'),
    ].filter((id): id is string => Boolean(id));

    if (founderPriceIds.includes(priceId)) {
      const { data: eligible, error: eligibilityError } = await supabase.rpc('is_founder_eligible');

      if (eligibilityError) {
        console.error('Founder eligibility check failed:', eligibilityError);
        throw new Error('Could not verify founding member eligibility');
      }

      if (eligible !== true) {
        throw new Error(
          'Founding member pricing is only available to people who joined the waitlist.',
        );
      }
    }

    let customerId: string | undefined;

    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingSub?.stripe_customer_id) {
      customerId = existingSub.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;
    }

    const origin = req.headers.get('origin') || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      /*
        An embedded session has no hosted page to send anyone to, so it takes
        a return_url and rejects success_url/cancel_url. Stripe puts the real
        session id into {CHECKOUT_SESSION_ID} on the way back, which is what
        lets the landing page tell a completed checkout from someone who
        simply typed the URL.
      */
      ...(embedded
        ? {
          ui_mode: 'embedded' as const,
          return_url: `${origin}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
        }
        : {
          success_url: `${origin}/dashboard?success=true`,
          cancel_url: `${origin}/payment?canceled=true`,
        }),
      // Kept from the previously-deployed version, which had automatic tax
      // when this file didn't - redeploying without it would have quietly
      // switched off tax calculation on every future checkout.
      automatic_tax: { enabled: true },
      // Required by Stripe whenever automatic_tax runs against an existing
      // customer: without it Stripe refuses the session rather than saving
      // the address it just collected.
      customer_update: { address: 'auto' },
      /*
        Always collect a card, even though the first invoice is $0.

        The whole trial design rests on having a card to authorise. Stripe
        will happily run a trial without one and then discover at day three
        that there is nothing to charge, which is the failure this is built
        to avoid.
      */
      payment_method_collection: 'always' as const,
      subscription_data: {
        /*
          Three days, card required, converts on its own.

          The trial came back after the numbers were actually looked at. Both
          models ran in the same window: 22 people took the 7-day trial and 3
          are still paying; 16 were charged on the spot and none of them are.
          The hard paywall collected money once and retained nobody.

          What killed the old trial was not people saying no. 17 of those 22
          never reached a successful charge - dead cards, prepaid cards, cards
          with nothing on them. Research puts a card-required auto-converting
          trial at 35-55% conversion; this one managed 14%, and the gap is
          almost entirely those 17.

          So the card is now authorised for the real amount at signup - see
          the note on the webhook's verifyTrialCard - rather than the $0
          validation Stripe does by default. A card that cannot hold $29.99
          today will not pay $29.99 on Thursday, and it is far better for
          everyone to find that out now.

          Three rather than seven: the point is to find out whether they will
          journal at all, which shows up on day one or not at all, and a
          shorter window is a shorter time for us to be carrying somebody
          who has already decided.
        */
        trial_period_days: 3,
        trial_settings: {
          /*
            No card, no trial. Belt and braces alongside
            payment_method_collection above.
          */
          end_behavior: { missing_payment_method: 'cancel' as const },
        },
        metadata: {
          supabase_user_id: user.id,
        },
      },
      metadata: {
        supabase_user_id: user.id,
      },
    });

    /*
      sessionId is what the current frontend consumes via Stripe.js
      redirectToCheckout; url is Stripe's current recommendation (that
      helper is deprecated). Returning both keeps today's frontend working
      untouched while allowing a straight redirect later.

      clientSecret is the embedded path, and is null on a hosted session -
      so a caller that asked for embedded and got null knows to fall back
      rather than mounting an empty iframe.
    */
    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url,
        clientSecret: session.client_secret ?? null,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Create subscription error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 400,
      },
    );
  }
});
