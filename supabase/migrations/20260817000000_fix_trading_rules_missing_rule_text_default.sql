/*
  # Fix trading_rules: creating a rule from the Dashboard silently failed

  ## Problem
  Found live: the Dashboard's Trading Rules widget lets you type a name
  and description, but clicking "Add Rule" did nothing - no rule
  appeared, no error shown to the user. Root cause confirmed via the
  actual browser console: trading_rules.rule_text is a leftover Bolt-era
  column, NOT NULL with no default, but the current app has used
  name/description instead for a long time and never sets it. Every
  insert has been failing outright with a 23502 not-null violation,
  caught and only console.error'd, exactly like the credentials and
  broker_type NOT NULL issues fixed earlier in broker_connections.

  ## Fix
  Default rule_text to '' so inserts succeed without needing to touch
  createTradingRule() at all - matches the app's real, current model.
*/

ALTER TABLE trading_rules ALTER COLUMN rule_text SET DEFAULT '';
