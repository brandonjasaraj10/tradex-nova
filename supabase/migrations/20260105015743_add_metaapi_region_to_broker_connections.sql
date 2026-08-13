/*
  # Add MetaAPI Region Configuration

  1. Changes
    - Add `metaapi_region` column to `broker_connections` table
    - Support for region-based MetaAPI endpoint selection ('new-york' or 'london')
    - Default to 'new-york' for existing connections
  
  2. Purpose
    - Fix SSL certificate errors caused by incorrect MetaAPI endpoints
    - Allow users to select optimal region based on broker location
    - Improve connection reliability and reduce latency
*/

-- Add metaapi_region column with default value
ALTER TABLE broker_connections 
ADD COLUMN IF NOT EXISTS metaapi_region text DEFAULT 'new-york';

-- Add check constraint to ensure only valid regions
ALTER TABLE broker_connections
ADD CONSTRAINT valid_metaapi_region 
CHECK (metaapi_region IN ('new-york', 'london'));

-- Add comment to explain the column
COMMENT ON COLUMN broker_connections.metaapi_region IS 'MetaAPI region for optimal endpoint routing (new-york or london)';