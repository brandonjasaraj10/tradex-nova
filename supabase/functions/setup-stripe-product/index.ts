import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Stripe } from "npm:stripe@13.10.0";

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const existingProducts = await stripe.products.list({ active: true, limit: 10 });
    const existingProduct = existingProducts.data.find(p => p.name === 'TradeX Pro');

    let product;
    if (existingProduct) {
      product = existingProduct;
    } else {
      product = await stripe.products.create({
        name: 'TradeX Pro',
        description: 'Professional Trading Platform - Unlimited trades, advanced analytics, Nova AI assistant, and priority support.',
        metadata: {
          app: 'tradex',
        },
      });
    }

    const existingPrices = await stripe.prices.list({
      product: product.id,
      active: true,
      limit: 10,
    });

    const existingMonthlyPrice = existingPrices.data.find(
      p => p.recurring?.interval === 'month' && p.unit_amount === 2499
    );

    let price;
    if (existingMonthlyPrice) {
      price = existingMonthlyPrice;
    } else {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: 2499,
        currency: 'usd',
        recurring: {
          interval: 'month',
        },
        metadata: {
          app: 'tradex',
          plan: 'pro',
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        product: {
          id: product.id,
          name: product.name,
        },
        price: {
          id: price.id,
          amount: price.unit_amount,
          currency: price.currency,
          interval: price.recurring?.interval,
        },
        message: `Product and price ready! Update your VITE_STRIPE_PRICE_ID to: ${price.id}`,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Setup Stripe product error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 400,
      }
    );
  }
});
