/*
  # Fix Critical RLS Security Issues

  This migration addresses critical security issues:

  ## 1. Enable RLS on Brokers Table
  - The `brokers` table is public but RLS was not enabled
  - Add policy to allow authenticated users to view broker data

  ## 2. Fix Waitlist RLS Policy
  - Replace overly permissive policy with one that validates email format
  - Prevents spam and malformed email submissions

  ## Important Notes
  - No breaking changes to application functionality
  - Brokers table is reference data, so read access is granted to all authenticated users
*/

-- ============================================================================
-- Enable RLS on Brokers Table
-- ============================================================================

ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;

-- Brokers are reference data, so allow authenticated users to read them
CREATE POLICY "Authenticated users can view brokers"
  ON brokers
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- Fix Waitlist RLS Policy
-- ============================================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can insert emails" ON waitlist;

-- Create a more restrictive policy that validates email format
CREATE POLICY "Valid emails can be inserted"
  ON waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL 
    AND email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND length(email) <= 255
  );