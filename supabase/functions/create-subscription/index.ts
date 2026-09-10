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

    const { priceId } = await req.json();

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
      success_url: `${origin}/dashboard?success=true`,
      cancel_url: `${origin}/payment?canceled=true`,
      // Kept from the previously-deployed version, which had automatic tax
      // when this file didn't - redeploying without it would have quietly
      // switched off tax calculation on every future checkout.
      automatic_tax: { enabled: true },
      // Required by Stripe whenever automatic_tax runs against an existing
      // customer: without it Stripe refuses the session rather than saving
      // the address it just collected.
      customer_update: { address: 'auto' },
      subscription_data: {
        /*
          No trial. Checkout charges on the spot.

          Removed after the first trial cohort converted: of 11 who started
          a trial on 3 September, 1 paid, 6 failed at the first charge, and
          5 of those 6 had never logged a single trade or journal entry. The
          trial was mostly collecting people who never intended to use it,
          and one card started three separate trials under three addresses.

          Existing trials are deliberately left alone - this stops the offer
          being made, it does not revoke anyone already inside one.
        */
        metadata: {
          supabase_user_id: user.id,
        },
      },
      metadata: {
        supabase_user_id: user.id,
      },
    });

    // sessionId is what the current frontend consumes via Stripe.js
    // redirectToCheckout; url is Stripe's current recommendation (that
    // helper is deprecated). Returning both keeps today's frontend working
    // untouched while allowing a straight redirect later.
    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
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
