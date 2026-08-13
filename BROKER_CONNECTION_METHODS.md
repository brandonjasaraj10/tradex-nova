# Broker Connection Methods

This document explains how users connect different types of brokers to TradeX.

## Connection Methods

### 1. Username/Password (Simple Login) ✅

**Supported Brokers:**
- Oanda
- MetaTrader 4 (MT4)
- MetaTrader 5 (MT5)
- NinjaTrader
- ThinkorSwim (TD Ameritrade)
- TradeStation

**Supported Prop Firms:**
- FTMO
- The5ers
- MyForexFunds
- The Funded Trader
- True Forex Funds
- FundedNext
- Topstep
- Earn2Trade

**What Users Enter:**
- **Account Type** (for prop firms only): Challenge, Verification, Funded, or Live
- Account Number / Username
- Password (regular OR read-only/investor password)
- Server (required for prop firms and MT4/MT5, e.g., "FTMO-Server", "ICMarkets-Live")

**User Experience:**
Just like logging into any website - simple username and password.

**Password Options:**
- **Regular Password**: Works perfectly fine, gives full read access
- **Read-Only Password**: Recommended for security - prevents trading but allows viewing history

Both password types work! Users can choose what they're comfortable with.

**Prop Firm Features:**
- **Multiple Accounts**: Connect your Challenge, Verification, and Funded accounts separately
- **Server Field**: Each account has different server details (found in your prop firm email/dashboard)
- **Account Tracking**: Easily track which phase you're in (challenge vs funded)

---

### 2. API Key Authentication 🔑

**Supported Brokers:**
- Bybit
- Binance
- Coinbase
- Kraken
- Interactive Brokers
- Most other crypto exchanges

**What Users Enter:**
- API Key
- API Secret

**Why API Keys?**
These brokers don't support username/password login from third-party apps for security reasons. API keys can be:
- Limited to read-only access
- Revoked without changing account password
- Restricted to specific IP addresses

---

## How It Works in the UI

1. **User clicks "Connect Broker"**
2. **Selects a broker category** (Stocks, Forex, Crypto)
3. **Selects specific broker** (e.g., Oanda, Bybit)
4. **UI automatically shows the right form:**
   - Username/Password for supported brokers
   - API Key fields for others

The form adapts based on what the broker supports!

---

## Database Storage

All credentials are encrypted and stored in the `user_broker_connections` table:

```sql
username          -- Account number/username (for username/password auth)
password          -- Regular or read-only password (encrypted)
server            -- Broker server (for MT4/MT5)
api_key           -- API key (for API auth)
api_secret        -- API secret (encrypted)
access_token      -- OAuth token (for some brokers)
account_id        -- Account identifier
```

---

## Adding New Brokers

To add support for a new broker:

1. Add broker to database (slug, name, category)
2. If it supports username/password:
   - Add slug to `usernamePasswordBrokers` array in `BrokerConnect.tsx`
   - Create adapter in `broker-api` edge function
3. If it requires API keys:
   - It will automatically use the generic API key form
   - Create adapter in `broker-api` edge function

---

## Security Notes

- All credentials are encrypted at rest in Supabase
- Read-only passwords prevent any trading operations
- API keys can be restricted to read-only permissions
- Users can disconnect and revoke access anytime
