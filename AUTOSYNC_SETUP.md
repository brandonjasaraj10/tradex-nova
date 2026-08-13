# MetaTrader Auto-Sync Setup Guide

This guide explains how to set up and configure the MetaTrader auto-sync system for production use.

## Overview

The TradeX platform supports automatic trade synchronization from MetaTrader 4 and MetaTrader 5 accounts using MetaAPI. Once configured, trades are automatically synced every 10 minutes via a background cron job.

## Architecture

The auto-sync system consists of three main components:

1. **MetaAPI Integration** (`/metatrader-sync`) - Handles MT4/MT5 account connections and individual syncs
2. **Batch Sync Job** (`/sync-all-brokers`) - Runs every 10 minutes via cron to sync all enabled accounts
3. **Webhook EA** (`/mt4-webhook`) - Optional real-time sync via Expert Advisor

## Prerequisites

### 1. MetaAPI Account Setup

1. Create an account at [metaapi.cloud](https://metaapi.cloud)
2. Navigate to your dashboard
3. Go to **API Access** or **Tokens**
4. Generate a new API token
5. Copy the token (it should start with `eyJ...`)

### 2. Supabase Environment Variables

Add the following secrets to your Supabase project:

**Navigate to:** Project Settings → Edge Functions → Secrets

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `METAAPI_TOKEN` | `eyJ...` | Your MetaAPI API token |
| `CRON_SECRET` | `random_secure_string` | Random secret for cron authentication |

**Generate a secure CRON_SECRET:**
```bash
openssl rand -base64 32
```

**Important:** After adding secrets, wait 1-2 minutes for them to propagate to all edge functions.

## Cron Job Configuration

### Option 1: Supabase pg_cron (Recommended)

Execute this SQL in your Supabase SQL Editor:

```sql
-- Schedule auto-sync to run every 10 minutes
SELECT cron.schedule(
  'sync-all-metatrader-accounts',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-all-brokers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', 'YOUR_CRON_SECRET_HERE'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Replace:**
- `YOUR_PROJECT_REF` with your actual Supabase project reference
- `YOUR_CRON_SECRET_HERE` with the CRON_SECRET you generated

**Verify the cron job:**
```sql
SELECT * FROM cron.job WHERE jobname = 'sync-all-metatrader-accounts';
```

**View cron execution logs:**
```sql
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-all-metatrader-accounts')
ORDER BY start_time DESC
LIMIT 10;
```

### Option 2: External Cron (GitHub Actions)

Create `.github/workflows/sync-brokers.yml`:

```yaml
name: Sync MetaTrader Accounts

on:
  schedule:
    # Run every 10 minutes
    - cron: '*/10 * * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Sync
        run: |
          curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-all-brokers \
            -H "X-Cron-Secret: ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json"
```

**Add secret to GitHub:**
- Go to your repository → Settings → Secrets and variables → Actions
- Add `CRON_SECRET` with your generated secret

### Option 3: Vercel Cron

Create `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/sync-brokers",
    "schedule": "*/10 * * * *"
  }]
}
```

Create `pages/api/sync-brokers.ts`:

```typescript
export default async function handler(req, res) {
  const response = await fetch(
    'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-all-brokers',
    {
      method: 'POST',
      headers: {
        'X-Cron-Secret': process.env.CRON_SECRET,
        'Content-Type': 'application/json',
      },
    }
  );

  const data = await response.json();
  res.status(200).json(data);
}
```

## User Setup Instructions

### Connecting a MetaTrader Account

1. Navigate to **Settings → Broker Connections**
2. Click **Connect Broker**
3. Select your broker or **MetaTrader 4/5**
4. Enter:
   - **Account Name** (e.g., "My FTMO Account")
   - **Login** (MT4/MT5 account number)
   - **Password** (MT4/MT5 password)
   - **Server** (e.g., "ICMarkets-Demo01")
   - **Platform** (MT4 or MT5)
5. Click **Connect**

The system will:
- Create a MetaAPI cloud account
- Deploy the account (30-60 seconds)
- Import historical trades
- Enable auto-sync by default

### Managing Auto-Sync

Once connected, users can:

- **Toggle Auto-Sync:** Check/uncheck the "Enable Auto-Sync" checkbox
- **Manual Sync:** Click "Sync Now" to immediately fetch latest trades
- **View Status:** See last sync time and trade count
- **Monitor Errors:** Any sync errors are displayed in the connection card

### Webhook EA (Advanced)

For users who want real-time sync instead of 10-minute intervals:

1. Click "Advanced: Webhook Auto-Sync (Optional)"
2. Copy the Webhook URL and Secret
3. Download the EA (MT4 or MT5 version)
4. Install EA in MetaTrader:
   - Place `.mq4`/`.mq5` file in `Experts` folder
   - Restart MetaTrader
   - Drag EA onto any chart
   - Enter Webhook URL and Secret in EA settings
   - Enable Auto Trading
5. EA will send trades every 5 minutes

## Testing

### Manual Test Sync

Test the sync manually via curl:

```bash
# Get your auth token from the browser (inspect → Network → Copy token)
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/metatrader-sync/sync/CONNECTION_ID \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json"
```

### Test Cron Job

Manually trigger the cron job:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-all-brokers \
  -H "X-Cron-Secret: YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "total_accounts": 3,
  "synced_successfully": 3,
  "failed": 0,
  "results": [
    {
      "connection_id": "...",
      "account_name": "My FTMO Account",
      "success": true,
      "trades_imported": 15
    }
  ]
}
```

## Monitoring

### Database Queries

**Check auto-sync enabled accounts:**
```sql
SELECT
  account_name,
  platform,
  status,
  is_auto_sync_enabled,
  last_synced_at,
  trades_count,
  last_error
FROM user_broker_connections
WHERE metaapi_account_id IS NOT NULL
ORDER BY last_synced_at DESC;
```

**Check recent sync errors:**
```sql
SELECT
  account_name,
  last_error,
  last_synced_at
FROM user_broker_connections
WHERE last_error IS NOT NULL
AND metaapi_account_id IS NOT NULL;
```

### Edge Function Logs

View logs in Supabase Dashboard:
- Go to **Edge Functions**
- Select `sync-all-brokers` or `metatrader-sync`
- Click **Logs** tab

Look for:
- Connection status
- Trade import counts
- Error messages
- Execution time

## Troubleshooting

### MetaAPI Token Not Found

**Error:** `"METAAPI_TOKEN environment variable is not set"`

**Solution:**
1. Verify secret exists: Project Settings → Edge Functions → Secrets
2. Check secret name is exactly `METAAPI_TOKEN` (case-sensitive)
3. Wait 2 minutes after adding secret
4. Redeploy edge functions if needed

### Account Deployment Timeout

**Error:** `"MetaApi account deployment timeout"`

**Causes:**
- Incorrect MT4/MT5 credentials
- Invalid server name
- Broker not supported by MetaAPI
- Network issues

**Solution:**
1. Verify credentials in MT4/MT5 terminal
2. Check exact server name (case-sensitive)
3. Try manual connection test
4. Contact MetaAPI support if broker is not supported

### No Trades Syncing

**Checks:**
1. Is `is_auto_sync_enabled` = true?
2. Is `status` = 'connected'?
3. Does account have trades in MT4/MT5?
4. Is cron job running? Check logs
5. Any errors in `last_error` field?

### Cron Job Not Running

**Supabase pg_cron:**
```sql
-- Check if job exists
SELECT * FROM cron.job WHERE jobname = 'sync-all-metatrader-accounts';

-- Check recent runs
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

**GitHub Actions:**
- Check Actions tab in repository
- Verify cron syntax in workflow file
- Ensure CRON_SECRET is set in repository secrets

### Rate Limiting

MetaAPI free tier limits:
- 10 accounts
- 100 API calls per minute
- Historical data: last 12 months

**Solution:** Upgrade MetaAPI plan or adjust sync frequency.

## Security Best Practices

1. **Never commit secrets** to version control
2. **Use strong CRON_SECRET** (minimum 32 random characters)
3. **Rotate secrets** periodically (every 90 days)
4. **Monitor failed login attempts** in MetaAPI dashboard
5. **Use environment variables** for all sensitive data
6. **Enable RLS policies** on all database tables
7. **Validate webhook secrets** before processing data

## Performance Optimization

### Sync Frequency

Default: Every 10 minutes

**Adjust based on needs:**
- **High-frequency traders:** 5 minutes or use Webhook EA
- **Swing traders:** 30 minutes
- **Position traders:** 1 hour

**Modify cron schedule:**
```sql
-- Every 5 minutes
'*/5 * * * *'

-- Every 30 minutes
'*/30 * * * *'

-- Every hour
'0 * * * *'
```

### Database Indexing

Ensure these indexes exist:

```sql
-- Speed up connection queries
CREATE INDEX IF NOT EXISTS idx_broker_connections_user_autosync
ON user_broker_connections(user_id, is_auto_sync_enabled)
WHERE metaapi_account_id IS NOT NULL;

-- Speed up trade queries
CREATE INDEX IF NOT EXISTS idx_trades_connection_time
ON trades(broker_connection_id, entry_time DESC);
```

## Cost Estimation

### MetaAPI Pricing
- **Free:** 10 accounts, 12 months history
- **Pro:** $99/mo - 100 accounts, unlimited history
- **Enterprise:** Custom pricing

### Supabase Edge Functions
- **Free:** 500K invocations/month
- **Pro:** 2M invocations/month ($25)

**Calculation for 100 users:**
- Cron runs: 144 times/day (every 10 min)
- Per-connection syncs: ~100/day (manual triggers)
- Monthly invocations: ~7,500
- **Well within free tier**

## Future Enhancements

Planned features:
- [ ] cTrader auto-sync
- [ ] Tradovate auto-sync
- [ ] TradeLocker auto-sync
- [ ] NinjaTrader auto-sync
- [ ] Real-time WebSocket sync
- [ ] Sync conflict resolution
- [ ] Batch import optimization
- [ ] Custom sync schedules per account

## Support

For issues or questions:
- Check Edge Function logs
- Review database error messages
- Consult MetaAPI documentation: [docs.metaapi.cloud](https://docs.metaapi.cloud)
- Contact TradeX support

---

Last updated: 2026-01-03
Version: 1.0
