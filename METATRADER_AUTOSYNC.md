# MetaTrader 4/5 Auto-Sync Implementation

## Overview

This implementation provides **real broker auto-sync** for MetaTrader 4 and MetaTrader 5 accounts using MetaApi cloud service. Users can connect their MT4/MT5 accounts with just their broker credentials (server, login, password) and trades will automatically sync every few hours.

## How It Works

### User Flow

1. User goes to Settings → Connect Broker
2. Selects MetaTrader 4 or MetaTrader 5
3. Enters:
   - Account Name (custom label)
   - Server (e.g., "ICMarkets-Demo01")
   - Login/Account Number
   - Password (investor or regular password)
4. Clicks Connect
5. System:
   - Creates MetaApi cloud account
   - Deploys and connects to MT4/MT5 server
   - Imports all historical trades
   - Sets status to "connected"
6. Auto-sync runs every 3 hours to keep trades updated

### Architecture

```
User → BrokerConnect UI → BrokerService → MetaTrader Sync Edge Function → MetaApi Cloud → MT4/MT5 Server
                                                                           ↓
                                                            Trades stored in Supabase
```

## Technical Implementation

### 1. Database Schema

**Added fields to `user_broker_connections`:**
- `metaapi_account_id` (TEXT) - Stores MetaApi cloud account ID for reconnection
- `platform` (TEXT) - Either 'mt4' or 'mt5'
- `is_auto_sync_enabled` (BOOLEAN) - Flag to enable/disable auto-sync

### 2. Edge Functions

#### `/metatrader-sync` (Authenticated)

**POST `/metatrader-sync/connect`**
- Creates MetaApi account
- Deploys and waits for connection
- Imports initial trade history
- Returns connection status

Body:
```json
{
  "broker_id": "uuid",
  "account_name": "My FTMO Account",
  "platform": "mt5",
  "server": "FTMO-Demo",
  "login": "12345678",
  "password": "investor_password",
  "start_date": "2024-01-01T00:00:00Z" // optional
}
```

**POST `/metatrader-sync/sync/{connectionId}`**
- Syncs new trades since last sync
- Updates trade counts
- Returns sync results

#### `/sync-all-brokers` (Cron Protected)

**POST `/sync-all-brokers`**
- Finds all active MetaTrader connections with auto-sync enabled
- Syncs each account sequentially
- Updates last_synced_at timestamps
- Returns summary of sync results

Headers required:
- `X-Cron-Secret`: Matches `CRON_SECRET` environment variable

### 3. Frontend Integration

**BrokerService (`src/services/brokerService.ts`)**

The service automatically detects MetaTrader connections and routes them to the MetaApi sync endpoint:

```typescript
async connectBroker(params: ConnectBrokerParams) {
  const isMetaTrader = params.broker_slug === 'metatrader4' || params.broker_slug === 'metatrader5';

  if (isMetaTrader) {
    // Route to MetaApi sync endpoint
    const platform = params.broker_slug === 'metatrader4' ? 'mt4' : 'mt5';
    // Call /metatrader-sync/connect
  } else {
    // Use regular broker-api
  }
}
```

**BrokerConnect UI (`src/components/broker/BrokerConnect.tsx`)**

Already supports MetaTrader with username/password fields. No changes needed!

### 4. Environment Variables

**Required:**
- `METAAPI_TOKEN` - Your MetaApi API token from metaapi.cloud

**Optional:**
- `CRON_SECRET` - Secret for protecting the sync-all-brokers endpoint (defaults to "CHANGE_ME_IN_PRODUCTION")

## Setup Instructions

### 1. Get MetaApi Token

1. Sign up at [metaapi.cloud](https://metaapi.cloud)
2. Create an API token
3. Add to Supabase edge function secrets:
   ```bash
   supabase secrets set METAAPI_TOKEN=your_token_here
   ```

### 2. Setup Auto-Sync Cron Job

The `/sync-all-brokers` endpoint needs to be called every 3 hours. You have several options:

#### Option A: GitHub Actions (Recommended)

Create `.github/workflows/sync-brokers.yml`:

```yaml
name: Sync MetaTrader Accounts

on:
  schedule:
    - cron: '0 */3 * * *'  # Every 3 hours
  workflow_dispatch:  # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Sync
        run: |
          curl -X POST \\
            -H "X-Cron-Secret: ${{ secrets.CRON_SECRET }}" \\
            https://YOUR_SUPABASE_URL/functions/v1/sync-all-brokers
```

#### Option B: cron-job.org

1. Go to [cron-job.org](https://cron-job.org)
2. Create a new cron job
3. URL: `https://YOUR_SUPABASE_URL/functions/v1/sync-all-brokers`
4. Schedule: Every 3 hours
5. Add header: `X-Cron-Secret: your_secret_here`

#### Option C: Vercel Cron (if hosting on Vercel)

Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/sync-brokers",
    "schedule": "0 */3 * * *"
  }]
}
```

Create `pages/api/sync-brokers.ts`:
```typescript
export default async function handler(req, res) {
  const response = await fetch(
    'https://YOUR_SUPABASE_URL/functions/v1/sync-all-brokers',
    {
      method: 'POST',
      headers: { 'X-Cron-Secret': process.env.CRON_SECRET }
    }
  );
  const data = await response.json();
  res.json(data);
}
```

### 3. Set Cron Secret

```bash
# For edge functions
supabase secrets set CRON_SECRET=your_secure_random_string

# For GitHub Actions
# Add CRON_SECRET to repository secrets
```

## Features

### ✅ What's Implemented

- **Direct broker auto-sync** - No EA or file upload needed
- **MT4 and MT5 support** - Both platforms fully supported
- **Initial history import** - Imports all past trades on first connect
- **Automatic background sync** - Keeps trades updated every 3 hours
- **Open position tracking** - Syncs P&L for open trades
- **Duplicate prevention** - Won't import same trade twice
- **Error handling** - Graceful error messages and retry logic
- **Connection status tracking** - connecting → connected → error states
- **Manual sync button** - Users can trigger sync anytime
- **Auto-sync toggle** - Users can enable/disable per connection

### 🔒 Security Features

- **Investor password support** - Users can use read-only passwords
- **Encrypted storage** - Passwords stored securely in database
- **Server-side only** - All MetaApi calls happen in edge functions
- **No credential exposure** - Passwords never returned in API responses
- **Cron protection** - Sync endpoint protected with secret key

### 📊 Data Synced

For each trade:
- Ticket/Order ID
- Symbol
- Side (buy/sell)
- Volume/Lot size
- Entry time & price
- Exit time & price (if closed)
- Profit/Loss
- Commission
- Swap
- Comment/Notes
- Full raw trade data (for debugging)

## Testing

### Test the Connection Flow

1. Go to Settings page
2. Click "Connect Broker"
3. Select "MetaTrader 5" (or MT4)
4. Enter test account details:
   - Account Name: "Test MT5"
   - Server: "ICMarkets-Demo"
   - Login: Your demo account number
   - Password: Your demo password
5. Click "Connect"
6. Wait ~30 seconds for deployment
7. Check that trades appear in Dashboard

### Test Manual Sync

1. Go to Settings page
2. Find your MT5 connection
3. Click the sync button (↻)
4. Verify new trades are imported

### Test Auto-Sync

1. Wait 3 hours (or trigger cron manually)
2. Check that `last_synced_at` updates
3. Verify new trades appear automatically

## Troubleshooting

### Connection Fails

**Problem:** "Failed to connect MetaTrader account"

**Solutions:**
- Verify server name is exact (case-sensitive)
- Check login/password are correct
- Try investor password instead of regular password
- Check MetaApi has available slots (free tier limited)
- Check edge function logs for detailed error

### No Trades Importing

**Problem:** Connection succeeds but no trades appear

**Solutions:**
- Check if account has any closed trades
- Verify `start_date` isn't too recent
- Check edge function logs
- Try manual sync button
- Check MetaApi dashboard for account status

### Auto-Sync Not Running

**Problem:** Trades don't update automatically

**Solutions:**
- Verify cron job is configured and running
- Check `X-Cron-Secret` header is correct
- Check `is_auto_sync_enabled` is true
- Check edge function logs during cron execution
- Test cron endpoint manually with curl

### MetaApi Token Issues

**Problem:** "METAAPI_TOKEN environment variable is not set"

**Solutions:**
- Run: `supabase secrets set METAAPI_TOKEN=your_token`
- Verify token is valid on metaapi.cloud
- Redeploy edge functions after setting secret

## Monitoring

### Check Sync Status

Query to see all active sync connections:

```sql
SELECT
  account_name,
  platform,
  status,
  last_synced_at,
  trades_count,
  is_auto_sync_enabled,
  last_error
FROM user_broker_connections
WHERE metaapi_account_id IS NOT NULL
ORDER BY last_synced_at DESC;
```

### View Recent Syncs

```sql
SELECT
  ubc.account_name,
  COUNT(t.id) as trade_count,
  MAX(t.entry_time) as latest_trade
FROM user_broker_connections ubc
LEFT JOIN trades t ON t.broker_connection_id = ubc.id
WHERE ubc.metaapi_account_id IS NOT NULL
GROUP BY ubc.id, ubc.account_name;
```

## Limitations & Future Enhancements

### Current Limitations

- MetaApi free tier: 10 accounts max
- Sync interval: 3 hours (not real-time)
- Historical data: Limited by MetaApi retention
- No streaming quotes or live P&L updates

### Potential Enhancements

1. **Real-time sync** - Use MetaApi WebSocket streaming for instant updates
2. **Custom sync intervals** - Per-user sync frequency settings
3. **Multi-server support** - Connect multiple servers per user
4. **Strategy filtering** - Sync only specific magic numbers
5. **Position monitoring** - Real-time open position tracking
6. **Alert system** - Notify users of large losses or wins
7. **Performance metrics** - Track sync speed and reliability

## API Reference

### MetaApi Integration

This implementation uses MetaApi REST API:

**Base URLs:**
- Provisioning: `https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai`
- Trading: `https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai`

**Key Endpoints Used:**
- `POST /users/current/accounts` - Create account
- `POST /users/current/accounts/{id}/deploy` - Deploy account
- `GET /users/current/accounts/{id}` - Check status
- `GET /users/current/accounts/{id}/history-orders/time` - Get trades

**Documentation:** [metaapi.cloud/docs](https://metaapi.cloud/docs)

## Support

For issues or questions:

1. Check edge function logs in Supabase dashboard
2. Check MetaApi account status at metaapi.cloud
3. Review this documentation
4. Check Supabase edge function deployment status

---

**Implementation completed successfully!** 🎉

MetaTrader 4 and 5 auto-sync is now fully operational, giving Tradex a competitive feature similar to TradeZella's broker integration.
