/*
  # Fix foreign key constraints to allow broker connection deletion

  1. Changes
    - Update `trades.broker_id` FK to SET NULL on delete (was NO ACTION)
    - Update `journal_entries.broker_connection_id` FK to SET NULL on delete (was NO ACTION)

  2. Reason
    - When a user disconnects/deletes a trading account, the foreign key constraints
      with NO ACTION were blocking the deletion entirely
    - Changing to SET NULL preserves the user's trade history (trades are not deleted)
      while allowing the broker connection to be removed
    - Both columns are already nullable, so this is safe

  3. Important Notes
    - Existing trades and journal entries will have their broker reference set to NULL
      when the associated broker connection is deleted
    - No data is lost -- only the link to the broker connection is removed
*/

ALTER TABLE trades
  DROP CONSTRAINT IF EXISTS trades_broker_id_fkey,
  ADD CONSTRAINT trades_broker_id_fkey
    FOREIGN KEY (broker_id)
    REFERENCES broker_connections(id)
    ON DELETE SET NULL;

ALTER TABLE journal_entries
  DROP CONSTRAINT IF EXISTS journal_entries_broker_connection_id_fkey,
  ADD CONSTRAINT journal_entries_broker_connection_id_fkey
    FOREIGN KEY (broker_connection_id)
    REFERENCES broker_connections(id)
    ON DELETE SET NULL;
