# Production Setup - Auto-Sync Configuration

## Step 1: Add Secrets to Supabase

Navigate to your Supabase Dashboard:
**Project Settings → Edge Functions → Secrets**

Add these two secrets:

### Secret 1: METAAPI_TOKEN
```
Name: METAAPI_TOKEN
Value: eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiJkNzhiZGE2NDcyN2QyN2Y0NjJiYTE1OTQwN2MwNTdiMSIsImFjY2Vzc1J1bGVzIjpbeyJpZCI6Im1ldGFhcGktcmVzdC1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVhbC10aW1lLXN0cmVhbWluZy1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOndzOnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19XSwiaWdub3JlUmF0ZUxpbWl0cyI6ZmFsc2UsInRva2VuSWQiOiIyMDIxMDIxMyIsImltcGVyc29uYXRlZCI6ZmFsc2UsInJlYWxVc2VySWQiOiJkNzhiZGE2NDcyN2QyN2Y0NjJiYTE1OTQwN2MwNTdiMSIsImlhdCI6MTc2NzQzMDU2M30.ZDrEgj3la_KgVa9Yk7vu7Izte3JVUAcNxf4JJuKa5B415-5ePEjIEkhBGaxw57tuXk5XbzAbgaThjB0col4rsXSGuOR9P87d-36s09Tvoh3QKFr8Rcj0lv4ShtuU34NGNQmFL8z_22EGLwKuS45pWONyWg17E8VSp_nQ28TNEA8l02u6h5tzR5KwFsbAx25ZttOqyDkpR38ytGnGkef-OPW7n7ziEIE_fdGddjdeq0K2y9WqKpwzqyyZnSQ-p_jLQUx33vYw3rftKGD9KArNKfL5s5X09Q1sBOMxcXzgxavYFeCxknRUjkdvS6jhZtTZua49BjGQskgTza7tQVDaAXQ2o7SZThiGDlYZzj2gVsCR0bWOyF0EJJp0kvrdADst9YxHNIKfT0RwRyVnzerf285VA6PMDshUqBs2bpeE2vJ4czTcLBw4oGgFtNjBcXEZMMz8xBrXHFF_S2lDqBm4OYjy4i4aGsyss_nJ3hTBb2dj87M4hCL4DKXFa8fexmXRjOXAMyZCHX7Qg8-427fGz8x-ms31diqfYERH6tEYeomiHnpQycfbb-dJG8ocA5dq08wLprvjD1YOonKNo3NSx_3bBQ7mbrWqZEQDJSSH0BTcwr3Umi9N3cr9nNIPQW1wmqMdQ6lSlPhms_mBhpKgr5Nh42jkJY9Wop07n79YTmA
```

### Secret 2: CRON_SECRET
```
Name: CRON_SECRET
Value: 4vA0KzKAp7l7JHPvmSV0VTkvCI6nTQi23LLpxRWORNI=
```

**IMPORTANT:** After adding these secrets, wait 1-2 minutes for them to propagate to all edge functions.

## Step 2: Set Up Cron Job

Open your Supabase **SQL Editor** and run this SQL:

```sql
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule auto-sync to run every 10 minutes
SELECT cron.schedule(
  'sync-all-metatrader-accounts',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.api_url') || '/functions/v1/sync-all-brokers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', '4vA0KzKAp7l7JHPvmSV0VTkvCI6nTQi23LLpxRWORNI='
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Note:** Replace `current_setting('app.settings.api_url')` with your actual Supabase URL if needed:
```sql
url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-all-brokers',
```

### Verify Cron Job

Check that the cron job was created successfully:

```sql
SELECT * FROM cron.job WHERE jobname = 'sync-all-metatrader-accounts';
```

You should see a row with:
- `jobname`: sync-all-metatrader-accounts
- `schedule`: */10 * * * *
- `active`: true

## Step 3: Test the Setup

### Test 1: Verify Secrets

Test that the MetaAPI token is accessible:

```bash
curl -X GET "https://YOUR_PROJECT_REF.supabase.co/functions/v1/metatrader-sync/debug" \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

Expected response should show:
```json
{
  "hasMetaApiToken": true,
  "tokenLength": 1234,
  "tokenPrefix": "eyJhbGciOi..."
}
```

### Test 2: Manual Sync Test

Trigger the sync manually to test:

```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-all-brokers" \
  -H "X-Cron-Secret: 4vA0KzKAp7l7JHPvmSV0VTkvCI6nTQi23LLpxRWORNI=" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "total_accounts": 0,
  "synced_successfully": 0,
  "failed": 0,
  "results": [],
  "message": "No accounts to sync"
}
```

(Initially shows 0 accounts since no users have connected yet)

## Step 4: Monitor Cron Execution

### View Cron Job Logs

```sql
SELECT
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-all-metatrader-accounts')
ORDER BY start_time DESC
LIMIT 20;
```

### Check Edge Function Logs

1. Go to **Edge Functions** in Supabase Dashboard
2. Select `sync-all-brokers`
3. Click **Logs** tab
4. Look for executions every 10 minutes

## Step 5: Connect Your First MT4/MT5 Account

1. Log in to your TradeX app
2. Go to **Settings → Broker Connections**
3. Click **Connect Broker**
4. Select **MetaTrader 4** or **MetaTrader 5**
5. Enter your MT4/MT5 credentials:
   - Login (account number)
   - Password
   - Server (e.g., "ICMarkets-Demo01")
6. Click **Connect**

The system will:
- Create a MetaAPI cloud account
- Deploy the account (30-60 seconds)
- Import your historical trades
- Enable auto-sync by default

## Troubleshooting

### Cron Job Not Running

If the cron job isn't executing:

1. Check if pg_cron extension is enabled:
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

2. Check if the cron job is active:
```sql
SELECT * FROM cron.job;
```

3. Try unscheduling and rescheduling:
```sql
SELECT cron.unschedule('sync-all-metatrader-accounts');
-- Then run the schedule command again
```

### MetaAPI Token Not Working

If you get token errors:

1. Verify the secret is exactly named `METAAPI_TOKEN` (case-sensitive)
2. Wait 2 minutes after adding the secret
3. Check token validity at metaapi.cloud dashboard
4. Ensure token has proper permissions (reader + writer)

### Sync Errors

Check for errors in the database:

```sql
SELECT
  account_name,
  platform,
  status,
  last_synced_at,
  last_error
FROM user_broker_connections
WHERE metaapi_account_id IS NOT NULL
ORDER BY created_at DESC;
```

## Security Notes

- Never commit `METAAPI_TOKEN` or `CRON_SECRET` to version control
- These values are stored securely in Supabase Edge Functions secrets
- Rotate secrets every 90 days for security
- Monitor MetaAPI dashboard for unauthorized access

## What's Next?

- Users can now connect MT4/MT5 accounts
- Trades sync automatically every 10 minutes
- Users can toggle auto-sync on/off per account
- Users can manually trigger sync with "Sync Now" button
- System supports unlimited accounts (within MetaAPI plan limits)

## Support

For issues:
1. Check Edge Function logs in Supabase Dashboard
2. Check cron job execution logs (SQL query above)
3. Verify database errors in `user_broker_connections` table
4. Review MetaAPI dashboard for API usage and errors

---

Setup Date: 2026-01-03
MetaAPI Token Expiry: Check metaapi.cloud dashboard
