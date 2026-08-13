import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { RealtimeChannel } from '@supabase/supabase-js';

interface DataSyncContextType {
  refreshTrigger: number;
  forceRefresh: () => void;
  isLoading: boolean;
}

const DataSyncContext = createContext<DataSyncContextType | undefined>(undefined);

export const DataSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [channels, setChannels] = useState<RealtimeChannel[]>([]);

  const forceRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (!user) {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
      setChannels([]);
      return;
    }

    const newChannels: RealtimeChannel[] = [];

    const tradesChannel = supabase
      .channel('trades-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trades',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Trades changed:', payload);
          forceRefresh();
        }
      )
      .subscribe();

    newChannels.push(tradesChannel);

    const journalEntriesChannel = supabase
      .channel('journal-entries-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'journal_entries',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Journal entries changed:', payload);
          forceRefresh();
        }
      )
      .subscribe();

    newChannels.push(journalEntriesChannel);

    const confluencesChannel = supabase
      .channel('confluences-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trading_confluences',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Confluences changed:', payload);
          forceRefresh();
        }
      )
      .subscribe();

    newChannels.push(confluencesChannel);

    const tradingRulesChannel = supabase
      .channel('trading-rules-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trading_rules',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Trading rules changed:', payload);
          forceRefresh();
        }
      )
      .subscribe();

    newChannels.push(tradingRulesChannel);

    const novaScoreChannel = supabase
      .channel('nova-score-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'nova_score',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Nova score changed:', payload);
          forceRefresh();
        }
      )
      .subscribe();

    newChannels.push(novaScoreChannel);

    const brokerConnectionsChannel = supabase
      .channel('broker-connections-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'broker_connections',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Broker connections changed:', payload);
          forceRefresh();
        }
      )
      .subscribe();

    newChannels.push(brokerConnectionsChannel);

    const userProfilesChannel = supabase
      .channel('user-profiles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          console.log('User profile changed:', payload);
          forceRefresh();
        }
      )
      .subscribe();

    newChannels.push(userProfilesChannel);

    setChannels(newChannels);

    return () => {
      newChannels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [user, forceRefresh]);

  return (
    <DataSyncContext.Provider value={{ refreshTrigger, forceRefresh, isLoading }}>
      {children}
    </DataSyncContext.Provider>
  );
};

export const useDataSync = () => {
  const context = useContext(DataSyncContext);
  if (context === undefined) {
    throw new Error('useDataSync must be used within a DataSyncProvider');
  }
  return context;
};
