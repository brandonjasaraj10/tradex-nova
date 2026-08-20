import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link2, CheckCircle2, AlertCircle, Trash2, Clock, Upload, Plus, X, RefreshCw, FileUp, DollarSign } from 'lucide-react';
import Button from '../shared/Button';
import ConfirmModal from '../shared/ConfirmModal';
import { brokerService, type BrokerConnection, type BrokerFromAPI } from '../../services/brokerService';
import { supabase } from '../../lib/supabase';
import CSVUpload from './CSVUpload';
import EditBalanceModal from './EditBalanceModal';
import { useAccount } from '../../lib/accountContext';

export default function BrokerConnectionsList() {
  const { refreshAccounts, selectedAccount, setSelectedAccount } = useAccount();
  const [connections, setConnections] = useState<BrokerConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [brokers, setBrokers] = useState<BrokerFromAPI[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [selectedBrokerId, setSelectedBrokerId] = useState('');
  const [editingBalance, setEditingBalance] = useState<BrokerConnection | null>(null);
  const [startingBalance, setStartingBalance] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [ownershipType, setOwnershipType] = useState<'personal' | 'funded' | 'prop'>('personal');
  const [disconnectConfirm, setDisconnectConfirm] = useState<{ isOpen: boolean; connectionId: string }>({ isOpen: false, connectionId: '' });

  const handleFileUpload = async (connectionId: string, file: File) => {
    setUploadingIds(prev => new Set(prev).add(connectionId));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('connection_id', connectionId);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-statement`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (result.success) {
        alert(`Successfully imported ${result.imported} trades!`);
        await loadConnections();
      } else {
        alert(`Import failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploadingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(connectionId);
        return newSet;
      });
    }
  };

  useEffect(() => {
    loadConnections();
    loadBrokers();
  }, []);

  const loadConnections = async () => {
    setIsLoading(true);
    const data = await brokerService.getUserConnections();
    setConnections(data);
    setIsLoading(false);
  };

  const loadBrokers = async () => {
    const data = await brokerService.getAvailableBrokers();
    setBrokers(data.filter(b => b.supported));
  };

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) {
      alert('Please enter an account name');
      return;
    }
    if (!startingBalance || parseFloat(startingBalance) <= 0) {
      alert('Please enter a valid starting balance');
      return;
    }

    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const selectedBroker = brokers.find(b => b.id === selectedBrokerId);

      const { error } = await supabase
        .from('user_broker_connections')
        .insert({
          user_id: user.id,
          broker_id: selectedBrokerId || null,
          broker_type: selectedBroker?.name || 'manual',
          account_name: newAccountName.trim(),
          status: 'connected',
          starting_balance: parseFloat(startingBalance),
          current_balance: parseFloat(startingBalance),
          currency: currency,
          ownership_type: ownershipType,
        });

      if (error) throw error;

      setShowAddAccount(false);
      setNewAccountName('');
      setSelectedBrokerId('');
      setStartingBalance('');
      setCurrency('USD');
      setOwnershipType('personal');
      await loadConnections();
      await refreshAccounts();
    } catch (error) {
      console.error('Create account error:', error);
      alert('Failed to create account');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = (connectionId: string) => {
    setDisconnectConfirm({ isOpen: true, connectionId });
  };

  const executeDelete = async (connectionId: string) => {
    setDisconnectConfirm({ isOpen: false, connectionId: '' });
    setDeletingIds(prev => new Set(prev).add(connectionId));

    try {
      const success = await brokerService.disconnectBroker(connectionId);

      if (success) {
        if (selectedAccount?.id === connectionId) {
          setSelectedAccount(null);
        }
        await loadConnections();
        await refreshAccounts();
      }
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(connectionId);
        return newSet;
      });
    }
  };

  const formatDate = (date?: string) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  const formatRelativeTime = (date?: string) => {
    if (!date) return 'Never';
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return formatDate(date);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-blue-500/20 text-blue-400 border border-blue-400/30">
            <CheckCircle2 className="w-3 h-3" />
            Active
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-red-500/20 text-red-400 border border-red-400/30">
            <AlertCircle className="w-3 h-3" />
            Error
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-gray-500/10 text-gray-400 border border-gray-400/20">
            <Clock className="w-3 h-3" />
            Inactive
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-gold-400" />
      </div>
    );
  }

  if (connections.length === 0 && !showAddAccount && !showCSVUpload) {
    return (
      <>
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-gold-400/20 to-blue-500/20 flex items-center justify-center mb-4 border border-gold-400/30">
            <Upload className="w-10 h-10 text-gold-400" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Import Your Trading History</h3>
          <p className="text-gray-400 mb-2 max-w-md mx-auto">
            Create an account and upload CSV or HTML statements from your broker to get started
          </p>
          <p className="text-xs text-gray-500 mb-6 max-w-sm mx-auto">
            Broker auto-sync is coming soon. For now, you can manually import your trade history.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setShowCSVUpload(true)}
              className="px-6 py-3 bg-gradient-to-r from-gold-400 to-blue-500 hover:from-gold-500 hover:to-blue-600 text-white rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2 shadow-lg"
            >
              <FileUp size={16} />
              Upload CSV File
            </button>
            <button
              onClick={() => setShowAddAccount(true)}
              className="px-6 py-3 bg-gradient-to-r from-gold-400/20 to-blue-500/20 hover:from-gold-400/30 hover:to-blue-500/30 text-gold-400 rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2 border border-gold-400/30"
            >
              <Plus size={16} />
              Add Account Manually
            </button>
          </div>
        </div>
        {showCSVUpload && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <CSVUpload
              onClose={() => setShowCSVUpload(false)}
              onSuccess={() => loadConnections()}
            />
          </div>
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {connections.map((connection) => (
        <motion.div
          key={connection.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-xl bg-black/40 border border-white/10 hover:border-gold-400/30 transition-all duration-300"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              <div className="w-12 h-12 rounded-lg bg-gold-400/10 flex items-center justify-center flex-shrink-0">
                <Link2 className="w-6 h-6 text-gold-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-medium text-lg">{connection.account_name}</h3>
                  {getStatusBadge(connection.status)}
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-white/5 text-gray-400 border border-white/10">
                    <Upload className="w-3 h-3" />
                    Manual Import
                  </span>
                </div>
                <p className="text-sm text-gray-400 mb-2">
                  {connection.brokers?.name || 'Manual Account'}
                  {connection.account_type && connection.account_type !== 'live' && (
                    <span className="ml-2 px-2 py-0.5 rounded text-xs bg-blue-500/10 text-blue-400 capitalize">
                      {connection.account_type}
                    </span>
                  )}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-3 p-3 rounded-lg bg-black/20 border border-white/5">
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">Balance</span>
                    {connection.starting_balance && connection.starting_balance > 0 ? (
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: connection.currency || 'USD',
                            minimumFractionDigits: 2,
                          }).format(connection.current_balance || connection.starting_balance)}
                        </span>
                        {connection.current_balance !== connection.starting_balance && (
                          <span className={`text-xs ${(connection.current_balance || 0) >= connection.starting_balance ? 'text-blue-400' : 'text-gray-400'}`}>
                            {((connection.current_balance || 0) >= connection.starting_balance) ? '+' : ''}
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: connection.currency || 'USD',
                              minimumFractionDigits: 2,
                            }).format((connection.current_balance || 0) - connection.starting_balance)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingBalance(connection)}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                      >
                        Set Balance
                      </button>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">Trades</span>
                    <span className="text-sm font-bold text-white">{connection.trades_count || 0}</span>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-xs text-gray-500 block mb-1">Last Import</span>
                    <span className="text-xs font-medium text-white" title={formatDate(connection.last_synced_at)}>
                      {formatRelativeTime(connection.last_synced_at)}
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <input
                    ref={(el) => fileInputRefs.current[connection.id] = el}
                    type="file"
                    accept=".html,.htm,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(connection.id, file);
                    }}
                  />
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Upload size={14} />
                    <span>Export your broker statement (HTML or CSV) and upload it to import trades</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => fileInputRefs.current[connection.id]?.click()}
                disabled={uploadingIds.has(connection.id)}
                className="px-4 py-2 bg-gold-400/20 hover:bg-gold-400/30 text-gold-400 rounded-lg text-sm font-medium transition-all flex items-center gap-2 border border-gold-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                {uploadingIds.has(connection.id) ? 'Uploading...' : 'Import'}
              </button>
              <button
                onClick={() => setEditingBalance(connection)}
                className="p-2 hover:bg-blue-500/10 rounded-lg transition-colors group"
                title="Edit balance"
              >
                <DollarSign className="w-5 h-5 text-gray-400 group-hover:text-blue-400 transition-colors" />
              </button>
              <button
                onClick={() => handleDelete(connection.id)}
                disabled={deletingIds.has(connection.id)}
                className="p-2 hover:bg-red-500/10 rounded-lg transition-colors group"
                title="Remove account"
              >
                <Trash2 className="w-4 h-4 text-gray-400 group-hover:text-red-400 transition-colors" />
              </button>
            </div>
          </div>
        </motion.div>
      ))}

      <div className="flex justify-center gap-3 pt-4">
        <button
          onClick={() => setShowCSVUpload(true)}
          className="px-6 py-3 bg-gradient-to-r from-gold-400 to-blue-500 hover:from-gold-500 hover:to-blue-600 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2 shadow-lg"
        >
          <FileUp size={16} />
          Upload CSV File
        </button>
        <button
          onClick={() => setShowAddAccount(true)}
          className="px-6 py-3 bg-gradient-to-r from-gold-400/20 to-blue-500/20 hover:from-gold-400/30 hover:to-blue-500/30 text-gold-400 rounded-lg text-sm font-medium transition-all flex items-center gap-2 border border-gold-400/30"
        >
          <Plus size={16} />
          Add Another Account
        </button>
      </div>

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
                  Broker / Platform <span className="text-gray-500 text-xs">(Optional)</span>
                </label>
                <select
                  value={selectedBrokerId}
                  onChange={(e) => setSelectedBrokerId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                >
                  <option value="">None - I'll add this later</option>
                  {brokers.map((broker) => (
                    <option key={broker.id} value={broker.id}>
                      {broker.display_name || broker.name}
                    </option>
                  ))}
                </select>
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
                  Create an account and then upload your trade history (CSV or HTML statements) to import your trades.
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
                disabled={!newAccountName.trim() || !startingBalance || parseFloat(startingBalance) <= 0}
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
            onSuccess={() => loadConnections()}
          />
        </div>
      )}

      {editingBalance && (
        <EditBalanceModal
          connection={editingBalance}
          onClose={() => setEditingBalance(null)}
          onSuccess={() => {
            setEditingBalance(null);
            loadConnections();
          }}
        />
      )}

      <ConfirmModal
        isOpen={disconnectConfirm.isOpen}
        title="Remove Account"
        message="Are you sure you want to remove this account? Your existing trades will not be deleted."
        confirmLabel="Remove"
        variant="warning"
        onConfirm={() => executeDelete(disconnectConfirm.connectionId)}
        onCancel={() => setDisconnectConfirm({ isOpen: false, connectionId: '' })}
      />
    </div>
  );
}
