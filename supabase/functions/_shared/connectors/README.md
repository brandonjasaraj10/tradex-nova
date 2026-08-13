# Broker Connector Architecture

This directory contains the broker-agnostic connector architecture for TradeX. The system is designed to support multiple brokers with different authentication methods through a unified interface.

## Architecture Overview

The connector architecture follows a layered approach:

```
┌─────────────────────────────────────────────┐
│         Edge Functions (Endpoints)          │
│  /metatrader-sync, /sync-all-brokers       │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│           Sync Engine (Core Logic)          │
│  - Connection loading                       │
│  - Connector selection                      │
│  - Trade normalization                      │
│  - Database upsert                          │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│       Broker Connectors (Adapters)          │
│  - MetaApiConnector (MT4/MT5)              │
│  - cTraderConnector (future)               │
│  - TradolockerConnector (future)           │
└─────────────────────────────────────────────┘
```

## Directory Structure

```
_shared/connectors/
├── README.md                    # This file
├── index.ts                     # Main exports
├── types.ts                     # TypeScript interfaces
├── baseConnector.ts             # Base connector interface
├── syncEngine.ts                # Unified sync engine
├── metatrader/
│   └── metaapiConnector.ts      # MetaAPI connector implementation
└── utils/
    ├── normalizeTrade.ts        # Trade normalization utilities
    └── upsertTrades.ts          # Database upsert utilities
```

## Core Components

### 1. Types (`types.ts`)

Defines all TypeScript interfaces:
- `BrokerConnection`: Database connection record
- `RawTrade`: Broker-specific trade format
- `NormalizedTrade`: Unified trade format
- `SyncResult`: Sync operation result
- `ConnectPayload`: Connection request payload

### 2. Base Connector (`baseConnector.ts`)

Interface that all broker connectors must implement:

```typescript
interface IBrokerConnector {
  connect(payload: ConnectPayload): Promise<Partial<BrokerConnection>>;
  disconnect(connectionId: string): Promise<void>;
  backfill(connection: BrokerConnection, fromDate: Date, toDate: Date): Promise<RawTrade[]>;
  incrementalSync(connection: BrokerConnection): Promise<RawTrade[]>;
  healthCheck(connection: BrokerConnection): Promise<HealthCheckResult>;
}
```

### 3. Sync Engine (`syncEngine.ts`)

The core orchestration layer that:
1. Loads connection from database
2. Selects appropriate connector based on broker + auth_type
3. Fetches raw trades from broker
4. Normalizes trades to unified format
5. Upserts trades to database
6. Updates connection statistics

**Key Methods:**
- `syncConnection(connectionId, mode)`: Syncs a single connection
- `syncAllConnections()`: Syncs all enabled connections

### 4. Normalization Utils (`utils/normalizeTrade.ts`)

Converts broker-specific trade formats to unified schema:
- Maps different side formats (buy/sell/long/short)
- Calculates duration
- Determines asset class
- Standardizes timestamps

### 5. Upsert Utils (`utils/upsertTrades.ts`)

Handles database operations:
- `upsertTrades()`: Inserts or updates trades
- `updateConnectionStats()`: Updates connection metadata

## Adding a New Broker

To add support for a new broker (e.g., cTrader):

### Step 1: Create Connector Class

```typescript
// _shared/connectors/ctrader/ctraderConnector.ts
import { BaseBrokerConnector } from '../baseConnector.ts';

export class CTraderConnector extends BaseBrokerConnector {
  async connect(payload: ConnectPayload): Promise<Partial<BrokerConnection>> {
    // Implement cTrader connection logic
  }

  async backfill(connection, fromDate, toDate): Promise<RawTrade[]> {
    // Fetch historical trades
  }

  async incrementalSync(connection): Promise<RawTrade[]> {
    // Fetch new trades since last sync
  }

  async healthCheck(connection): Promise<HealthCheckResult> {
    // Check connection status
  }
}
```

### Step 2: Register Connector

Update `syncEngine.ts`:

```typescript
private getConnector(connection: BrokerConnection): IBrokerConnector {
  if (connection.broker === 'metatrader' && connection.auth_type === 'metaapi') {
    return new MetaApiConnector(this.metaapiToken);
  }

  if (connection.broker === 'ctrader' && connection.auth_type === 'oauth') {
    return new CTraderConnector(this.ctraderApiKey);
  }

  throw new Error(`Unsupported broker/auth combination`);
}
```

### Step 3: Update Database

Add broker to enum in migration:

```sql
ALTER TABLE user_broker_connections
DROP CONSTRAINT IF EXISTS user_broker_connections_broker_check;

ALTER TABLE user_broker_connections
ADD CONSTRAINT user_broker_connections_broker_check
CHECK (broker IN ('metatrader', 'ctrader', 'tradelocker', 'tradovate', 'ninjatrader'));
```

### Step 4: Export Connector

Update `index.ts`:

```typescript
export { CTraderConnector } from './ctrader/ctraderConnector.ts';
```

## Unified Trade Schema

All brokers must normalize to this schema:

```typescript
{
  user_id: string;
  broker: 'metatrader' | 'ctrader' | ...;
  connection_id: string;
  external_trade_id: string;
  broker_trade_id: string;
  symbol: string;
  side: 'buy' | 'sell' | 'long' | 'short';
  entry_time: string;
  exit_time?: string;
  duration_seconds?: number;
  quantity?: number;
  entry_price: number;
  exit_price?: number;
  profit: number;
  commission?: number;
  swap?: number;
  asset_class: 'forex' | 'stocks' | 'crypto' | 'futures';
  raw_broker_payload: object;
}
```

## Sync Modes

### Backfill Mode
- Fetches historical trades (typically 90 days)
- Used during initial connection setup
- More resource intensive

### Incremental Mode
- Fetches only new trades since last sync
- Used by scheduled cron jobs
- Efficient for regular syncing

## Error Handling

The system includes comprehensive error handling:
- Connection errors are logged to `last_error` field
- Failed syncs don't block other connections
- Status is updated to 'error' on failure
- Successful syncs clear previous errors

## Best Practices

1. **Authentication**: Store credentials securely in encrypted fields
2. **Rate Limiting**: Implement delays between broker API calls
3. **Idempotency**: Use unique trade IDs to prevent duplicates
4. **Logging**: Log important events for debugging
5. **Error Recovery**: Implement retry logic for transient failures

## Testing

To test a new connector:

1. Create a test connection in database
2. Call connector's `connect()` method
3. Verify `backfill()` returns trades
4. Test `incrementalSync()` with cursor
5. Validate trade normalization
6. Confirm database upsert works

## Current Implementations

### MetaAPI Connector
- **Broker**: MetaTrader 4/5
- **Auth**: MetaAPI cloud API
- **Status**: Production ready
- **Features**: Full backfill and incremental sync

## Future Brokers

Planned integrations:
- cTrader (OAuth)
- TradeLocker (API key)
- Tradovate (OAuth)
- NinjaTrader (Bridge)

## Support

For questions or issues with the connector architecture, please refer to:
- Database schema: `/supabase/migrations/`
- Edge functions: `/supabase/functions/`
- Type definitions: `types.ts`
