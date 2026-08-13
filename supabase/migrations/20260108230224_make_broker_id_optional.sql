/*
  # Make Broker ID Optional for Trading Accounts

  1. Changes
    - Make `broker_id` nullable in `user_broker_connections` table
    - Allow users to create trading accounts without selecting a broker
    - Users can add broker information later or use manual CSV imports
  
  2. Purpose
    - Provides flexibility for users who want to track trades manually
    - Allows account creation before broker connection is established
    - Supports scenarios where users want to import trades without broker API connection
*/

-- Make broker_id nullable
ALTER TABLE user_broker_connections 
ALTER COLUMN broker_id DROP NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN user_broker_connections.broker_id IS 'Optional broker reference. NULL for manual/CSV-only accounts';
