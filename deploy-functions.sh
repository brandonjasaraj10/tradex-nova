#!/bin/bash

# TradeX Edge Functions Deployment Script
# Run this after configuring your Supabase secrets

echo "🚀 Deploying TradeX Edge Functions..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Link to your project (you'll need to login first)
echo "🔗 Linking to Supabase project..."
supabase link --project-ref irtlwmpcfzjrlrxicxbk

# Deploy all functions
echo "📦 Deploying all Edge Functions..."

# Core AI & Voice Functions
echo "  → nova-chat"
supabase functions deploy nova-chat --no-verify-jwt=false

echo "  → nova-tts"
supabase functions deploy nova-tts --no-verify-jwt=false

echo "  → process-voice-journal"
supabase functions deploy process-voice-journal --no-verify-jwt=false

echo "  → log-journal-entry"
supabase functions deploy log-journal-entry --no-verify-jwt=false

# Analytics & Insights
echo "  → analyze-trading-performance"
supabase functions deploy analyze-trading-performance --no-verify-jwt=false

echo "  → generate-insights"
supabase functions deploy generate-insights --no-verify-jwt=false

echo "  → generate-report"
supabase functions deploy generate-report --no-verify-jwt=false

echo "  → generate-tips"
supabase functions deploy generate-tips --no-verify-jwt=false

# Broker & Trading Integration
echo "  → broker-api"
supabase functions deploy broker-api --no-verify-jwt=false

echo "  → import-statement"
supabase functions deploy import-statement --no-verify-jwt=false

echo "  → metatrader-sync"
supabase functions deploy metatrader-sync --no-verify-jwt=false

echo "  → mt4-webhook"
supabase functions deploy mt4-webhook --no-verify-jwt=false

echo "  → sync-all-brokers"
supabase functions deploy sync-all-brokers --no-verify-jwt=false

# Payment & Subscriptions
echo "  → create-subscription"
supabase functions deploy create-subscription --no-verify-jwt=false

echo "  → activate-subscription"
supabase functions deploy activate-subscription --no-verify-jwt=false

echo "  → manage-subscription"
supabase functions deploy manage-subscription --no-verify-jwt=false

echo "  → setup-stripe-product"
supabase functions deploy setup-stripe-product --no-verify-jwt=false

echo "  → stripe-checkout"
supabase functions deploy stripe-checkout --no-verify-jwt=false

echo "  → stripe-webhook"
supabase functions deploy stripe-webhook --no-verify-jwt=true

# Authentication
echo "  → password-reset"
supabase functions deploy password-reset --no-verify-jwt=true

echo "✅ All Edge Functions deployed successfully!"
echo ""
echo "Next steps:"
echo "1. Set up your Stripe webhook at: https://dashboard.stripe.com/webhooks"
echo "2. Use this URL: https://irtlwmpcfzjrlrxicxbk.supabase.co/functions/v1/stripe-webhook"
echo "3. Copy the webhook signing secret and add it to Supabase secrets as STRIPE_WEBHOOK_SECRET"
