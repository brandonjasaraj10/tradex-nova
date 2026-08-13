/*
  # Fix Function Search Paths

  This migration fixes search path vulnerabilities in database functions by setting
  an immutable search_path. This prevents search path attacks where malicious users
  could create objects in schemas that would be searched before the intended schema.

  ## Functions Updated
  1. `create_default_folders()` - Sets search_path to public, pg_temp
  2. `update_updated_at_column()` - Sets search_path to public, pg_temp

  ## Important Notes
  - All triggers are recreated to ensure they reference the updated functions
  - No functional changes to application behavior
  - Enhances security by preventing search path manipulation attacks
*/

-- ============================================================================
-- Fix create_default_folders Function
-- ============================================================================

DROP FUNCTION IF EXISTS create_default_folders() CASCADE;

CREATE OR REPLACE FUNCTION create_default_folders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO journal_folders (user_id, name, color, created_at)
  VALUES 
    (NEW.id, 'General', 'blue', now()),
    (NEW.id, 'Weekly Review', 'blue', now()),
    (NEW.id, 'Trade Reviews', 'blue', now());
  
  INSERT INTO notes_folders (user_id, name, color, template_type, created_at)
  VALUES (NEW.id, 'Notes', 'blue', 'notes', now());
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER create_default_folders_trigger
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_folders();

-- ============================================================================
-- Fix update_updated_at_column Function
-- ============================================================================

DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate all triggers that use update_updated_at_column
CREATE TRIGGER update_broker_connections_updated_at
  BEFORE UPDATE ON broker_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trades_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trading_confluences_updated_at
  BEFORE UPDATE ON trading_confluences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nova_score_updated_at
  BEFORE UPDATE ON nova_score
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_journal_folders_updated_at
  BEFORE UPDATE ON journal_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_journal_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trading_rules_updated_at
  BEFORE UPDATE ON trading_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_trading_profiles_updated_at
  BEFORE UPDATE ON user_trading_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_folders_updated_at
  BEFORE UPDATE ON notes_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();