# ✅ TradeX Deployment Checklist

Copy this checklist and mark items as you complete them!

---

## Pre-Deployment (Already Done)

- [x] Database hosted on Bolt
- [x] All migrations applied
- [x] Frontend built successfully
- [x] Environment variables configured
- [x] All Edge Function code written
- [x] MetaAPI token obtained
- [x] ElevenLabs API key obtained
- [x] OpenAI API key obtained

---

## Step 1: Add Secrets to Supabase Vault (5 min)

**Go to**: https://supabase.com/dashboard/project/irtlwmpcfzjrlrxicxbk/settings/vault

- [ ] Click "New secret"
- [ ] Add `METAAPI_TOKEN` (copy from SECRETS_SETUP.md)
- [ ] Add `ELEVENLABS_API_KEY` (copy from SECRETS_SETUP.md)
- [ ] Add `OPENAI_API_KEY` (copy from SECRETS_SETUP.md)
- [ ] Wait 2 minutes for secrets to propagate

---

## Step 2: Deploy Edge Functions (5-10 min)

**Go to**: https://supabase.com/dashboard/project/irtlwmpcfzjrlrxicxbk/functions

### Option A - Dashboard Method
- [ ] Open Functions page
- [ ] Deploy `nova-chat`
- [ ] Deploy `nova-tts`
- [ ] Deploy `process-voice-journal`
- [ ] Deploy `log-journal-entry`
- [ ] Deploy `analyze-trading-performance`
- [ ] Deploy `generate-insights`
- [ ] Deploy `generate-report`
- [ ] Deploy `generate-tips`
- [ ] Deploy `broker-api`
- [ ] Deploy `import-statement`
- [ ] Deploy `metatrader-sync`
- [ ] Deploy `mt4-webhook`
- [ ] Deploy `sync-all-brokers`
- [ ] Deploy `create-subscription`
- [ ] Deploy `activate-subscription`
- [ ] Deploy `manage-subscription`
- [ ] Deploy `setup-stripe-product`
- [ ] Deploy `stripe-checkout`
- [ ] Deploy `stripe-webhook`
- [ ] Deploy `password-reset`

### Option B - CLI Method
- [ ] Install Supabase CLI: `npm install -g supabase`
- [ ] Login: `supabase login`
- [ ] Link project: `supabase link --project-ref irtlwmpcfzjrlrxicxbk`
- [ ] Deploy all: `supabase functions deploy`

---

## Step 3: Verify Deployment (2 min)

- [ ] Check function logs: https://supabase.com/dashboard/project/irtlwmpcfzjrlrxicxbk/logs/edge-functions
- [ ] Verify all 21 functions show as "Active"
- [ ] Test Nova chat function:
```bash
curl -X POST 'https://irtlwmpcfzjrlrxicxbk.supabase.co/functions/v1/nova-chat' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"message": "Hello!"}'
```

---

## Step 4: Setup Stripe (Optional - For Payments)

Only complete if you want payment processing:

- [ ] Get Stripe secret key from: https://dashboard.stripe.com/apikeys
- [ ] Add `STRIPE_SECRET_KEY` to Supabase Vault
- [ ] Go to: https://dashboard.stripe.com/webhooks
- [ ] Click "Add endpoint"
- [ ] Set URL: `https://irtlwmpcfzjrlrxicxbk.supabase.co/functions/v1/stripe-webhook`
- [ ] Select events:
  - [ ] customer.subscription.created
  - [ ] customer.subscription.updated
  - [ ] customer.subscription.deleted
  - [ ] invoice.payment_succeeded
  - [ ] invoice.payment_failed
- [ ] Copy webhook signing secret (starts with `whsec_`)
- [ ] Add `STRIPE_WEBHOOK_SECRET` to Supabase Vault
- [ ] Initialize Stripe products:
```bash
curl -X POST \
  'https://irtlwmpcfzjrlrxicxbk.supabase.co/functions/v1/setup-stripe-product' \
  -H 'Authorization: Bearer YOUR_ANON_KEY'
```

---

## Step 5: Final Testing (5 min)

- [ ] Open your TradeX app
- [ ] Create a test account
- [ ] Test Nova AI assistant
- [ ] Try voice journaling
- [ ] Connect a broker account (optional)
- [ ] Check analytics page
- [ ] Verify all features work

---

## 🎉 Launch Complete!

When all items are checked, your TradeX platform is fully operational!

### What You've Deployed:
✅ Complete trading journal platform
✅ AI-powered assistant (Nova)
✅ Voice transcription & journaling
✅ Real-time broker synchronization
✅ Advanced analytics & insights
✅ Automated performance reports
✅ Payment processing (if Stripe configured)

---

**Estimated Total Time**: 15-25 minutes

**Need Help?** Check the logs:
- https://supabase.com/dashboard/project/irtlwmpcfzjrlrxicxbk/logs
