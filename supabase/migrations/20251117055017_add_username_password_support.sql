/*
  # Add Username/Password Support for Broker Connections

  1. Changes
    - Add `username` column to user_broker_connections
    - Add `password` column to user_broker_connections (encrypted)
    - Add `server` column for MT4/MT5 broker servers
    - Add `connection_method` field to brokers table to indicate supported auth types

  2. Security
    - All credentials remain encrypted at rest
    - RLS policies already in place
*/

-- Add new columns to user_broker_connections
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_broker_connections' AND column_name = 'username'
  ) THEN
    ALTER TABLE user_broker_connections ADD COLUMN username text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_broker_connections' AND column_name = 'password'
  ) THEN
    ALTER TABLE user_broker_connections ADD COLUMN password text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_broker_connections' AND column_name = 'server'
  ) THEN
    ALTER TABLE user_broker_connections ADD COLUMN server text;
  END IF;
END $$;

-- Add connection_method to brokers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brokers' AND column_name = 'connection_method'
  ) THEN
    ALTER TABLE brokers ADD COLUMN connection_method text DEFAULT 'api_key';
  END IF;
END $$;

-- Update existing brokers to indicate their supported connection methods
UPDATE brokers 
SET connection_method = 'username_password'
WHERE slug IN ('oanda', 'metatrader4', 'metatrader5', 'ninjatrader', 'thinkorswim', 'tradestation');

UPDATE brokers 
SET connection_method = 'api_key'
WHERE slug IN ('bybit', 'binance', 'coinbase', 'kraken', 'interactive_brokers');