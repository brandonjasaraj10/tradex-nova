import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';

// "All Accounts" is a real, deliberate choice that happens to be
// represented as `null`. It needs its own stored sentinel so it can be
// told apart from "the user hasn't picked anything yet" - otherwise
// every refetch silently replaces it with a single account.
const SELECTED_ACCOUNT_KEY = 'tradex_selected_account';
const ALL_ACCOUNTS = 'ALL';

interface Account {
  id: string;
  account_name: string | null;
  broker_type: string;
  is_active: boolean;
}

interface AccountContextType {
  accounts: Account[];
  selectedAccount: Account | null;
  setSelectedAccount: (account: Account | null) => void;
  refreshAccounts: () => Promise<void>;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export function AccountProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccountState] = useState<Account | null>(null);
  const hasResolvedInitialSelection = useRef(false);

  const fetchAccounts = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_broker_connections')
      .select('id, account_name, broker_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching accounts:', error);
      return;
    }

    // broker_id has no real foreign key to brokers (it's stored as
    // plain text), so resolve display names with a separate lookup
    // instead of a PostgREST embed.
    const { data: brokersData } = await supabase.from('brokers').select('id, name, display_name');
    const brokerNameById = new Map((brokersData || []).map(b => [b.id, b.display_name || b.name]));

    const transformedAccounts: Account[] = (data || []).map((item: any) => ({
      id: item.id,
      account_name: item.account_name,
      broker_type: (item.broker_id && brokerNameById.get(item.broker_id)) || 'Manual',
      is_active: false,
    }));

    setAccounts(transformedAccounts);

    if (!hasResolvedInitialSelection.current) {
      // Only ever pick a default once per session. Re-running this on
      // every refetch is what used to wipe out an "All Accounts" choice
      // and silently drop the user back onto a single account.
      hasResolvedInitialSelection.current = true;

      const saved = localStorage.getItem(SELECTED_ACCOUNT_KEY);
      if (saved === ALL_ACCOUNTS) {
        setSelectedAccountState(null);
      } else {
        const savedAccount = saved ? transformedAccounts.find(a => a.id === saved) : undefined;
        setSelectedAccountState(savedAccount || transformedAccounts[0] || null);
      }
      return;
    }

    // Keep the selection pointing at live data, and fall back to "All
    // Accounts" if the selected account was deleted out from under us.
    setSelectedAccountState(prev => {
      if (!prev) return null;
      return transformedAccounts.find(a => a.id === prev.id) || null;
    });
  };

  useEffect(() => {
    fetchAccounts();
  }, [user]);

  const setSelectedAccount = async (account: Account | null) => {
    setSelectedAccountState(account);
    localStorage.setItem(SELECTED_ACCOUNT_KEY, account ? account.id : ALL_ACCOUNTS);
  };

  return (
    <AccountContext.Provider
      value={{
        accounts,
        selectedAccount,
        setSelectedAccount,
        refreshAccounts: fetchAccounts,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return context;
}
