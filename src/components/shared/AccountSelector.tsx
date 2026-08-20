import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Plus, FileUp, X } from 'lucide-react';
import Button from './Button';
import CSVUpload from '../broker/CSVUpload';
import { supabase } from '../../lib/supabase';
import { brokerService, type BrokerFromAPI } from '../../services/brokerService';

interface Account {
  id: string;
  account_name: string | null;
  broker_type: string;
  is_active: boolean;
}

interface AccountSelectorProps {
  accounts: Account[];
  selectedAccount: Account | null;
  onAccountChange: (account: Account | null) => void;
  onAccountsUpdate?: () => void;
}

export default function AccountSelector({ accounts, selectedAccount, onAccountChange, onAccountsUpdate }: AccountSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [brokers, setBrokers] = useState<BrokerFromAPI[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [selectedBrokerId, setSelectedBrokerId] = useState('');
  const [otherBrokerName, setOtherBrokerName] = useState('');
  const [startingBalance, setStartingBalance] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [ownershipType, setOwnershipType] = useState<'personal' | 'funded' | 'prop'>('personal');
  const selectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    loadBrokers();
  }, []);

  const loadBrokers = async () => {
    const data = await brokerService.getAvailableBrokers();
    setBrokers(data.filter(b => b.supported));
  };

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) return;
    if (!startingBalance || parseFloat(startingBalance) <= 0) {
      alert('Please enter a valid starting balance');
      return;
    }
    if (selectedBrokerId === '__other__' && !otherBrokerName.trim()) {
      alert('Please enter the name of your broker or prop firm');
      return;
    }

    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const isOther = selectedBrokerId === '__other__';
      const selectedBroker = brokers.find(b => b.id === selectedBrokerId);

      const connectionData: any = {
        user_id: user.id,
        account_name: newAccountName.trim(),
        status: 'connected',
        broker_type: isOther ? otherBrokerName.trim() : (selectedBroker?.name || 'manual'),
        starting_balance: parseFloat(startingBalance),
        current_balance: parseFloat(startingBalance),
        currency,
        ownership_type: ownershipType,
      };

      if (selectedBrokerId && !isOther) {
        connectionData.broker_id = selectedBrokerId;
      }

      const { error } = await supabase
        .from('user_broker_connections')
        .insert(connectionData);

      if (error) throw error;

      // Not shown to the user - just lets us see which unlisted
      // brokers/prop firms come up most so we know what to add next.
      if (isOther) {
        await supabase.from('broker_requests').insert({
          user_id: user.id,
          requested_name: otherBrokerName.trim(),
        });
      }

      setShowAddAccount(false);
      setNewAccountName('');
      setSelectedBrokerId('');
      setOtherBrokerName('');
      setStartingBalance('');
      setCurrency('USD');
      setOwnershipType('personal');
      setIsOpen(false);
      onAccountsUpdate?.();
    } catch (error) {
      console.error('Create account error:', error);
      alert('Failed to create account');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAccountSelect = (account: Account | null) => {
    onAccountChange(account);
    setIsOpen(false);
  };

  const getDisplayName = (account: Account | null) => {
    if (!account) return 'All Accounts';
    return account.account_name || account.broker_type;
  };

  return (
    <div className="relative z-30" ref={selectorRef}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-2 bg-[#111]/80 border border-white/10 rounded-lg px-4 py-2 hover:bg-white/5 transition-colors"
      >
        <span className="text-sm whitespace-nowrap">{getDisplayName(selectedAccount)}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-12 right-0 z-30 bg-[#0A0A0A] border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[200px]"
          >
            <div className="p-2">
              <button
                onClick={() => handleAccountSelect(null)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                  !selectedAccount
                    ? 'bg-blue-400/10 text-blue-400'
                    : 'hover:bg-white/5 text-gray-300'
                }`}
              >
                <span>All Accounts</span>
                {!selectedAccount && <Check size={16} />}
              </button>

              {accounts.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  {accounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => handleAccountSelect(account)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                        selectedAccount?.id === account.id
                          ? 'bg-blue-400/10 text-blue-400'
                          : 'hover:bg-white/5 text-gray-300'
                      }`}
                    >
                      <div>
                        <div>{account.account_name || account.broker_type}</div>
                        {account.account_name && (
                          <div className="text-xs text-gray-500">{account.broker_type}</div>
                        )}
                      </div>
                      {selectedAccount?.id === account.id && <Check size={16} />}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    setShowCSVUpload(true);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 bg-gradient-to-r from-gold-400/10 to-blue-500/10 hover:from-gold-400/20 hover:to-blue-500/20 text-gold-400 border border-gold-400/20"
                >
                  <FileUp size={16} />
                  <span>Import CSV File</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    setShowAddAccount(true);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 hover:bg-white/5 text-gray-300"
                >
                  <Plus size={16} />
                  <span>Add Account</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showAddAccount && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Add Trading Account</h2>
              <button
                onClick={() => {
                  setShowAddAccount(false);
                  setNewAccountName('');
                  setSelectedBrokerId('');
                  setOtherBrokerName('');
                  setStartingBalance('');
                  setCurrency('USD');
                  setOwnershipType('personal');
                }}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Account Name
                </label>
                <input
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="e.g., My FTMO Challenge"
                  className="w-full px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Broker / Platform
                </label>
                <select
                  value={selectedBrokerId}
                  onChange={(e) => setSelectedBrokerId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                >
                  <option value="">Select a broker...</option>
                  {brokers.map((broker) => (
                    <option key={broker.id} value={broker.id}>
                      {broker.display_name || broker.name}
                    </option>
                  ))}
                  <option value="__other__">Other - not listed</option>
                </select>
                {selectedBrokerId === '__other__' && (
                  <input
                    type="text"
                    value={otherBrokerName}
                    onChange={(e) => setOtherBrokerName(e.target.value)}
                    placeholder="Enter your broker or prop firm's name"
                    className="w-full mt-2 px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Starting Balance *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={startingBalance}
                    onChange={(e) => setStartingBalance(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 pl-14 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    {currency}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Your account balance at the start of tracking
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
                    <option value="AUD">AUD</option>
                    <option value="CAD">CAD</option>
                    <option value="CHF">CHF</option>
                    <option value="NZD">NZD</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Account Type
                  </label>
                  <select
                    value={ownershipType}
                    onChange={(e) => setOwnershipType(e.target.value as 'personal' | 'funded' | 'prop')}
                    className="w-full px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  >
                    <option value="personal">Personal</option>
                    <option value="funded">Funded (Prop Firm)</option>
                    <option value="prop">Prop Firm</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-xs text-blue-400">
                  After creating your account, you can upload your MT4/MT5 statement (HTML or CSV) to import your trade history.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowAddAccount(false);
                  setNewAccountName('');
                  setSelectedBrokerId('');
                  setOtherBrokerName('');
                  setStartingBalance('');
                  setCurrency('USD');
                  setOwnershipType('personal');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateAccount}
                isLoading={isCreating}
                disabled={!newAccountName.trim() || !startingBalance || parseFloat(startingBalance) <= 0 || (selectedBrokerId === '__other__' && !otherBrokerName.trim())}
              >
                Create Account
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {showCSVUpload && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <CSVUpload
            onClose={() => setShowCSVUpload(false)}
            onSuccess={() => {
              setShowCSVUpload(false);
              onAccountsUpdate?.();
            }}
          />
        </div>
      )}
    </div>
  );
}
