import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';

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

    if (transformedAccounts.length > 0 && !selectedAccount) {
      setSelectedAccountState(transformedAccounts[0]);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [user]);

  const setSelectedAccount = async (account: Account | null) => {
    setSelectedAccountState(account);
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
