/*
  # Fix MetaAPI Region Column
  
  1. Changes
    - Add `metaapi_region` column to `user_broker_connections` table (correct table name)
    - Support for region-based MetaAPI endpoint selection ('new-york' or 'london')
    - Default to 'new-york' for existing connections
  
  2. Purpose
    - Fix SSL certificate errors caused by incorrect MetaAPI endpoints
    - Allow users to select optimal region based on broker location
*/

-- Add metaapi_region column to the correct table
ALTER TABLE user_broker_connections 
ADD COLUMN IF NOT EXISTS metaapi_region text DEFAULT 'new-york';

-- Add check constraint to ensure only valid regions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'valid_metaapi_region' 
    AND conrelid = 'user_broker_connections'::regclass
  ) THEN
    ALTER TABLE user_broker_connections
    ADD CONSTRAINT valid_metaapi_region 
    CHECK (metaapi_region IN ('new-york', 'london'));
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN user_broker_connections.metaapi_region IS 'MetaAPI region for optimal endpoint routing (new-york or london)';
