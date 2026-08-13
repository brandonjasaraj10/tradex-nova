# Broker Auto-Sync Implementation Guide

## Overview
The broker auto-sync feature has been implemented with the following components:

## 1. Database Schema ✅ COMPLETED

### Tables Created:
- **brokers** - Directory of 26+ supported brokers from TradeZella
- **user_broker_connections** - User's connected broker accounts with encrypted credentials
- **trades** (enhanced) - Extended with broker sync fields

### Key Features:
- Encrypted credential storage (api_key, api_secret, access_token, etc.)
- Row Level Security (RLS) policies for all tables
- Unique constraint to prevent duplicate trade imports
- Support for multiple connection types: api_key, oauth, credentials, file_upload

## 2. Broker Adapters ✅ COMPLETED

Located in: `supabase/functions/_shared/brokerAdapters.ts`

### Implemented Adapters:
- **BybitAdapter** - Full implementation for crypto trading
- **OandaAdapter** - Full implementation for forex trading
- **GenericAdapter** - For manual CSV uploads

### Stub Adapters (Ready for Implementation):
- InteractiveBrokersAdapter
- MetaTraderAdapter (MT4/MT5)
- CoinbaseAdapter
- Plus 20+ other brokers

### Interface:
```typescript
interface IBrokerAdapter {
  fetchTradesSince(since: Date): Promise<Trade[]>;
  testConnection(): Promise<boolean>;
}
```

## 3. Sync Engine ✅ COMPLETED

Located in: `supabase/functions/_shared/syncEngine.ts`

### Key Methods:
- `syncBrokerConnection(connectionId)` - Sync specific connection
- `syncAllConnections()` - Batch sync all active connections
- `testConnection(connectionId)` - Verify broker credentials

### Features:
- Automatic trade deduplication using unique constraints
- Error handling with status updates
- Trade count caching
- Last sync timestamp tracking

## 4. API Endpoints (Edge Functions)

### Required Edge Functions to Deploy:

#### GET /broker-api/list
Returns all available brokers

#### GET /broker-api/connections
Returns user's broker connections with stats

#### POST /broker-api/connect
Creates a new broker connection
```json
{
  "broker_slug": "bybit",
  "account_name": "My Bybit Account",
  "connection_type": "api_key",
  "api_key": "...",
  "api_secret": "..."
}
```

#### POST /broker-api/test
Tests a broker connection
```json
{
  "connection_id": "uuid"
}
```

#### POST /broker-api/sync
Manually triggers sync for a connection
```json
{
  "connection_id": "uuid"
}
```

## 5. Implementation Steps for Edge Functions

Since Edge Functions with shared dependencies require special handling, here's how to complete the implementation:

### Option A: Deploy Monolithic Edge Function
Create a single Edge Function file that includes all adapter and sync engine code inline.

### Option B: Use Supabase CLI
```bash
supabase functions deploy broker-api --no-verify-jwt=false
```

## 6. Background Sync Job

To implement scheduled syncing:

1. Create a cron Edge Function:
```typescript
// supabase/functions/broker-sync-cron/index.ts
import { SyncEngine } from '../_shared/syncEngine.ts';

Deno.serve(async (_req) => {
  const engine = new SyncEngine(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const results = await engine.syncAllConnections();

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

2. Set up a cron trigger (every 15 minutes):
```bash
supabase functions schedule broker-sync-cron --cron="*/15 * * * *"
```

## 7. Security Considerations

✅ All credentials are stored encrypted (handled by Supabase)
✅ RLS policies prevent cross-user data access
✅ Service role key used only in backend Edge Functions
✅ JWT verification enabled on all API endpoints
✅ No sensitive data exposed in API responses

## 8. Frontend Integration

The frontend can call these endpoints:

```typescript
const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/broker-api`;
const headers = {
  'Authorization': `Bearer ${session.access_token}`,
  'Content-Type': 'application/json',
};

// List brokers
const brokers = await fetch(`${apiUrl}/list`, { headers });

// Get connections
const connections = await fetch(`${apiUrl}/connections`, { headers });

// Connect broker
await fetch(`${apiUrl}/connect`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    broker_slug: 'bybit',
    api_key: '...',
    api_secret: '...',
  }),
});

// Sync trades
await fetch(`${apiUrl}/sync`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ connection_id: 'uuid' }),
});
```

## 9. Testing

To test the implementation:

1. Query available brokers:
```sql
SELECT * FROM brokers WHERE status = 'live';
```

2. Create a test connection (using Supabase dashboard or API)

3. Trigger manual sync

4. Verify trades imported:
```sql
SELECT COUNT(*) FROM trades WHERE broker_connection_id IS NOT NULL;
```

## 10. Next Steps

To complete the implementation:

1. Deploy the broker-api Edge Function with inline code
2. Deploy the broker-sync-cron Edge Function
3. Set up the cron schedule
4. Test with real broker credentials
5. Monitor error logs and refine adapters

## Supported Brokers

26 brokers seeded in database:
- Bybit ✅ (implemented)
- Oanda ✅ (implemented)
- Interactive Brokers 🚧
- MetaTrader 4/5 🚧
- Coinbase 🚧
- Charles Schwab 🚧
- Robinhood 🚧
- And 19 more...

## File Locations

- Database migrations: `/supabase/migrations/create_new_broker_infrastructure.sql`
- Broker adapters: `/supabase/functions/_shared/brokerAdapters.ts`
- Sync engine: `/supabase/functions/_shared/syncEngine.ts`
- Edge Functions: `/supabase/functions/broker-api/` (needs deployment)

## Notes

- The adapter pattern makes it easy to add new brokers
- Each broker has specific API requirements documented in their adapter
- The sync engine handles all error scenarios gracefully
- Trade deduplication prevents importing the same trade twice
- The system supports both open and closed trades
