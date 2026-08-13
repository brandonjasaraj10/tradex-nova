# Complete Setup Guide - Your TradeX Platform

## Current Status ✅

Your database is **already hosted on Bolt** through Supabase:
- **URL**: `https://irtlwmpcfzjrlrxicxbk.supabase.co`
- **Project ID**: `irtlwmpcfzjrlrxicxbk`
- **Status**: Live and operational
- **Migrations**: All 75+ database migrations are applied
- **Edge Functions**: All 20 function files are written and ready to deploy

## What You Need to Do

### Step 1: Add API Secrets to Supabase

1. Go to your Supabase project settings:
   https://supabase.com/dashboard/project/irtlwmpcfzjrlrxicxbk/settings/vault

2. Click **"New secret"** and add each of these:

**MetaAPI (for broker connections):**
```
Name: METAAPI_TOKEN
Value: eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiJkNzhiZGE2NDcyN2QyN2Y0NjJiYTE1OTQwN2MwNTdiMSIsImFjY2Vzc1J1bGVzIjpbeyJpZCI6InRyYWRpbmctYWNjb3VudC1tYW5hZ2VtZW50LWFwaSIsIm1ldGhvZHMiOlsidHJhZGluZy1hY2NvdW50LW1hbmFnZW1lbnQtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVzdC1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcnBjLWFwaSIsIm1ldGhvZHMiOlsibWV0YWFwaS1hcGk6d3M6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVhbC10aW1lLXN0cmVhbWluZy1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOndzOnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJtZXRhc3RhdHMtYXBpIiwibWV0aG9kcyI6WyJtZXRhc3RhdHMtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6InJpc2stbWFuYWdlbWVudC1hcGkiLCJtZXRob2RzIjpbInJpc2stbWFuYWdlbWVudC1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoiY29weWZhY3RvcnktYXBpIiwibWV0aG9kcyI6WyJjb3B5ZmFjdG9yeS1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoibXQtbWFuYWdlci1hcGkiLCJtZXRob2RzIjpbIm10LW1hbmFnZXItYXBpOnJlc3Q6ZGVhbGluZzoqOioiLCJtdC1tYW5hZ2VyLWFwaTpyZXN0OnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJiaWxsaW5nLWFwaSIsIm1ldGhvZHMiOlsiYmlsbGluZy1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfV0sImlnbm9yZVJhdGVMaW1pdHMiOmZhbHNlLCJ0b2tlbklkIjoiMjAyMTAyMTMiLCJpbXBlcnNvbmF0ZWQiOmZhbHNlLCJyZWFsVXNlcklkIjoiZDc4YmRhNjQ3MjdkMjdmNDYyYmExNTk0MDdjMDU3YjEiLCJpYXQiOjE3NjM0NDc2MTB9.iuWUTVgJlTtiDwe2fpYS0Li2ZtKtftZHGc6cub0KMpVz6O5Pnr8IYsDGobEY6GQDSicnLXv3_FSG7I8aWwwv94g7ecqK-KW0RKxDzPDsecJkp4CMdWqm34zkv9fZQogxn8jlwXlAGQEtzYOf8dQ7e3JAfJlngXSFMfFEeKdXgbdBW4novw5RiDYmGTqZTPunrKROoU_5KaiwMrAi3z83oFIHgvDrrLR6H6FEbeM4egb6D0XmeWYo_6sFhg2XwBk7llDmSEQc5VFQiporPaXF4otc7zVecvwMgDSkoECk2YcQ3Kjx109Xeej0Jh0P6_aRNlcgU-WxKUWaDIgaL8ewpbs_6f9xxXL9Cf-IuNBvWIM1ulmaivkDthsyUQ7M6-E_bYairos5yzFub4qeceienszLNEWCP_P-lU3nFtzE6X0ZNl-xQK17115qr2NhXYleN3Len3VeRpXRN-hSnO9rv7ubHVfk4hiaFA6fJ2aE9KMLrME7jETJ_fU3BYjbUTtipNpkGz5NZ2UQhdOcCAY2KDWC48rK7tnyNGbomAWB7Dv9f5Mph2kJhPaOHCamYYpCg4l8GpIgZF7K2h5jD7AvtvSoEarDL2zD9x8d7-e316flARXUJBze6eeenZ3RdHJbwmU5mtflF3WvjUBtueg98UE289S1bGGzCDQ7dMrn_rs
```

**ElevenLabs (for voice features):**
```
Name: ELEVENLABS_API_KEY
Value: sk_83e28624f068e0d0501c4152ca2b3af17ba6d5170e41ff67
```

**OpenAI (for Nova AI assistant):**
```
Name: OPENAI_API_KEY
Value: [Get from https://platform.openai.com/api-keys]
Note: You'll need to get this from your OpenAI account (starts with sk-proj- or sk-)
```

**Stripe (for payments):**
```
Name: STRIPE_SECRET_KEY
Value: [Get from https://dashboard.stripe.com/apikeys]
Note: Use sk_test_... for testing or sk_live_... for production
```

**Optional - Resend (for password reset emails):**
```
Name: RESEND_API_KEY
Value: [Get from https://resend.com/api-keys if you want email functionality]
```

### Step 2: Deploy Edge Functions

You have 2 options:

**Option A - Supabase Dashboard (Recommended):**

1. Go to: https://supabase.com/dashboard/project/irtlwmpcfzjrlrxicxbk/functions
2. You should see all your functions listed
3. Click **"Deploy function"** or the deploy button for each function
4. The functions will be deployed from your local code

**Option B - Using Supabase CLI:**

```bash
# Install Supabase CLI globally
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref irtlwmpcfzjrlrxicxbk

# Deploy all functions at once
supabase functions deploy

# Or deploy individually
supabase functions deploy nova-chat
supabase functions deploy nova-tts
supabase functions deploy process-voice-journal
# ... etc for all 20 functions
```

### Step 3: Set Up Stripe Webhook

After deploying the functions:

1. Go to: https://dashboard.stripe.com/webhooks
2. Click **"Add endpoint"**
3. **Endpoint URL**: `https://irtlwmpcfzjrlrxicxbk.supabase.co/functions/v1/stripe-webhook`
4. **Events to listen to**:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click **"Add endpoint"**
6. Copy the **"Signing secret"** (starts with `whsec_...`)
7. Go back to Supabase Vault and add:
   ```
   Name: STRIPE_WEBHOOK_SECRET
   Value: whsec_... (your signing secret)
   ```

### Step 4: Initialize Stripe Products (One-time setup)

After everything is deployed, call this function once to create your Stripe products:

```bash
curl -X POST \
  'https://irtlwmpcfzjrlrxicxbk.supabase.co/functions/v1/setup-stripe-product' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json'
```

Your anon key is in your `.env` file: `VITE_SUPABASE_ANON_KEY`

---

## All 20 Edge Functions to Deploy

1. **nova-chat** - AI assistant conversations
2. **nova-tts** - Text-to-speech for voice responses
3. **process-voice-journal** - Voice journal transcription
4. **log-journal-entry** - Save journal entries
5. **analyze-trading-performance** - Performance analytics
6. **generate-insights** - AI-generated insights
7. **generate-report** - Trading reports
8. **generate-tips** - Personalized tips
9. **broker-api** - Generic broker integration
10. **import-statement** - Import trading statements
11. **metatrader-sync** - MetaTrader synchronization
12. **mt4-webhook** - MetaTrader webhook handler
13. **sync-all-brokers** - Sync all broker accounts
14. **create-subscription** - Create new subscriptions
15. **activate-subscription** - Activate subscriptions
16. **manage-subscription** - Manage subscriptions
17. **setup-stripe-product** - Initialize Stripe products
18. **stripe-checkout** - Checkout session creation
19. **stripe-webhook** - Stripe webhook handler
20. **password-reset** - Password reset functionality

---

## Verification

After deployment, verify everything works:

1. **Check function logs**: https://supabase.com/dashboard/project/irtlwmpcfzjrlrxicxbk/logs/edge-functions
2. **Test a function**:
   ```bash
   curl https://irtlwmpcfzjrlrxicxbk.supabase.co/functions/v1/nova-chat \
     -H 'Authorization: Bearer YOUR_ANON_KEY'
   ```
3. **Check your app**: Visit your TradeX app and test features

---

## Summary

✅ **Already Done:**
- Bolt-hosted Supabase database is live
- All 75+ database migrations applied
- All 20 Edge Function files written
- Frontend configured

📋 **You Need To Do:**
1. Add 4-5 API secrets to Supabase Vault (5 minutes)
2. Deploy 20 Edge Functions via dashboard or CLI (5-10 minutes)
3. Set up Stripe webhook (2 minutes)
4. Initialize Stripe products with one API call (30 seconds)

**Total time**: 15-20 minutes

After that, your entire TradeX platform is fully operational!
