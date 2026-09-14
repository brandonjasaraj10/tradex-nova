import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import {
  SYNC_TABLES,
  zeroVersions,
  applyChanges,
  computeTrigger,
  type SyncTable,
  type Versions,
} from './dataSyncVersions';

export { SYNC_TABLES };
export type { SyncTable };

/*
  Tells the app when its data has changed underneath it.

  Two things were wrong with the original, and both showed up as the app
  feeling sluggish while you used it rather than while it loaded.

  First, there was a single global counter. Any write to any watched table
  bumped it, and every page and widget listening re-ran *all* of its loaders.
  Marking one trading rule followed reloaded the Dashboard's eight queries,
  the Journal, the Calendar, Analytics - including Analytics' AI insight
  generation, which is an edge function call - plus three widgets. A rule
  change has nothing to do with the balance card, and a synced trade has
  nothing to do with the rules widget.

  Now each table carries its own version and a consumer names the tables it
  actually cares about. A component only re-runs when something it depends on
  moved. Calling useDataSync() with no argument still watches everything, so
  anything not yet scoped behaves exactly as before.

  Second, events arrived one at a time and each one triggered a full reload.
  A broker sync writing 25 trades produced 25 separate reload storms. Changes
  are now collected and flushed once, so a burst costs one refresh.
*/

interface DataSyncContextType {
  versions: Versions;
  manualVersion: number;
  forceRefresh: () => void;
  isLoading: boolean;
}

const DataSyncContext = createContext<DataSyncContextType | undefined>(undefined);

/*
  Long enough to swallow the burst a sync produces, short enough that a change
  you made yourself still feels immediate. A single edit lands one frame after
  the round trip either way, because the page that made the edit updates its
  own state directly - this window only governs the echo back to everyone else.
*/
const COALESCE_MS = 400;

export const DataSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [versions, setVersions] = useState<Versions>(zeroVersions);
  const [manualVersion, setManualVersion] = useState(0);
  const [isLoading] = useState(false);

  const pending = useRef<Set<SyncTable>>(new Set());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const forceRefresh = useCallback(() => {
    setManualVersion(v => v + 1);
  }, []);

  const flush = useCallback(() => {
    flushTimer.current = null;
    if (pending.current.size === 0) return;
    const changed = Array.from(pending.current);
    pending.current.clear();
    setVersions(prev => applyChanges(prev, changed));
  }, []);

  const markChanged = useCallback((table: SyncTable) => {
    pending.current.add(table);
    if (flushTimer.current === null) {
      flushTimer.current = setTimeout(flush, COALESCE_MS);
    }
  }, [flush]);

  useEffect(() => {
    if (!user) return;

    /*
      One channel carrying every subscription rather than six.

      Each channel is its own websocket subscription with its own join and
      its own heartbeat; there is no reason for six when they all filter on
      the same user. The nova_score channel is gone entirely - that table has
      no rows and nothing in the app writes to it, so it was a live
      subscription to something that can never fire.
    */
    const channel = supabase.channel(`user-data-${user.id}`);

    for (const table of SYNC_TABLES) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `user_id=eq.${user.id}` },
        () => markChanged(table),
      );
    }

    channel.subscribe();

    return () => {
      if (flushTimer.current !== null) {
        clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
      pending.current.clear();
      supabase.removeChannel(channel);
    };
  }, [user, markChanged]);

  /*
    Memoised. This object used to be rebuilt on every render of the provider,
    so every consumer re-rendered whenever anything here changed even if the
    values it read were identical.
  */
  const value = useMemo(
    () => ({ versions, manualVersion, forceRefresh, isLoading }),
    [versions, manualVersion, forceRefresh, isLoading],
  );

  return <DataSyncContext.Provider value={value}>{children}</DataSyncContext.Provider>;
};

/*
  Pass the tables this component's data actually comes from. The returned
  refreshTrigger changes only when one of them does, so it is safe to keep in
  a useEffect dependency array exactly as the old single counter was.

  With no argument it watches every table, which is the old behaviour.
*/
export const useDataSync = (tables?: readonly SyncTable[]) => {
  const context = useContext(DataSyncContext);
  if (context === undefined) {
    throw new Error('useDataSync must be used within a DataSyncProvider');
  }

  const { versions, manualVersion, forceRefresh, isLoading } = context;
  const watched = tables ?? SYNC_TABLES;
  const key = watched.join(',');

  /*
    A sum, not a tuple: consumers put this straight into a dependency array,
    and a number only changes when one of the watched versions does. Summing
    is safe because versions only ever increase.
  */
  const refreshTrigger = useMemo(
    () => computeTrigger(versions, manualVersion, watched),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [versions, manualVersion, key],
  );

  return { refreshTrigger, forceRefresh, isLoading };
};
