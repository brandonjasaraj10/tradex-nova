import { useState, useEffect, useRef } from 'react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { motion } from 'framer-motion';
import { Link2, CheckCircle2, AlertCircle, Clock, Upload, Plus, X, RefreshCw, DollarSign, Pencil, PauseCircle } from 'lucide-react';
import Button from '../shared/Button';
import ConfirmModal from '../shared/ConfirmModal';
import { brokerService, type BrokerConnection, type BrokerFromAPI } from '../../services/brokerService';
import { supabase, getCurrentUser } from '../../lib/supabase';
import { useToast } from '../../lib/toastContext';
import EditBalanceModal from './EditBalanceModal';
import { useAccount } from '../../lib/accountContext';

export default function BrokerConnectionsList() {
  const { showToast } = useToast();
  /*
    selectedAccount and setSelectedAccount went with the delete handler.
    Pausing never needs to clear the selection, because the account is still
    there and still selectable - which is the whole point of the change.
  */
  const { refreshAccounts } = useAccount();
  const [connections, setConnections] = useState<BrokerConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [showAddAccount, setShowAddAccount] = useState(false);
  useBodyScrollLock(showAddAccount);
  const [brokers, setBrokers] = useState<BrokerFromAPI[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [selectedBrokerId, setSelectedBrokerId] = useState('');
  const [otherBrokerName, setOtherBrokerName] = useState('');
  const [editingBalance, setEditingBalance] = useState<BrokerConnection | null>(null);
  /*
    Renaming an account, inline.

    An account could be named once when it was created and never again -
    so a typo, or a name that stopped fitting after a prop firm change,
    was permanent unless you deleted the account and lost its trades with
    it.
  */
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [savingRename, setSavingRename] = useState(false);
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
        showToast(`Imported ${result.imported} ${result.imported === 1 ? 'trade' : 'trades'}.`, 'success');
        await loadConnections();
      } else {
        showToast(`Import failed: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showToast(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
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
      showToast('Give the account a name first.', 'error');
      return;
    }
    if (!startingBalance || parseFloat(startingBalance) <= 0) {
      showToast('Enter a starting balance for the account.', 'error');
      return;
    }

    if (selectedBrokerId === '__other__' && !otherBrokerName.trim()) {
      showToast('Enter the name of your broker or prop firm.', 'error');
      return;
    }

    setIsCreating(true);
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const isOther = selectedBrokerId === '__other__';
      const selectedBroker = brokers.find(b => b.id === selectedBrokerId);

      const { error } = await supabase
        .from('user_broker_connections')
        .insert({
          user_id: user.id,
          broker_id: isOther ? null : (selectedBrokerId || null),
          broker_type: isOther ? otherBrokerName.trim() : (selectedBroker?.name || 'manual'),
          account_name: newAccountName.trim(),
          status: 'connected',
          starting_balance: parseFloat(startingBalance),
          current_balance: parseFloat(startingBalance),
          currency: currency,
          ownership_type: ownershipType,
        });

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
      await loadConnections();
      await refreshAccounts();
    } catch (error) {
      console.error('Create account error:', error);
      showToast('Could not create that account. Please try again.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const saveRename = async (connection: BrokerConnection) => {
    const nextName = renameValue.trim();
    setRenamingId(null);

    // Unchanged, or emptied entirely: leave the account exactly as it was
    // rather than writing a blank name nothing can be identified by.
    if (!nextName || nextName === connection.account_name) return;

    setSavingRename(true);
    try {
      const { error } = await supabase
        .from('user_broker_connections')
        .update({ account_name: nextName })
        .eq('id', connection.id);

      if (error) throw error;

      await loadConnections();
      await refreshAccounts();
      showToast('Account renamed.', 'success');
    } catch (error) {
      console.error('Rename error:', error);
      showToast(
        error instanceof Error ? error.message : 'Could not rename that account.',
        'error'
      );
    } finally {
      setSavingRename(false);
    }
  };

  const handleDelete = (connectionId: string) => {
    setDisconnectConfirm({ isOpen: true, connectionId });
  };

  /*
    Turning syncing off, which is what the old "remove" button should always
    have done.

    Nothing disappears: the account stays in the list with every trade and
    journal entry, it can still be written to by hand, and the sync slot goes
    back to the plan. The only thing that stops is the account updating
    itself, which is the part that costs money to provide.
  */
  const executePauseSync = async (connectionId: string) => {
    setDisconnectConfirm({ isOpen: false, connectionId: '' });
    setDeletingIds(prev => new Set(prev).add(connectionId));

    try {
      const success = await brokerService.pauseSync(connectionId);

      if (success) {
        await loadConnections();
        await refreshAccounts();
        showToast('Syncing turned off. Your trades are still here.', 'success');
      }
    } catch (error) {
      console.error('Pause sync error:', error);
      showToast(
        error instanceof Error ? error.message : 'Could not turn syncing off.',
        'error'
      );
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(connectionId);
        return newSet;
      });
    }
  };

  /*
    Turning it back on. Free - the parked MetaApi account still holds this
    account's credentials, so this is a restart rather than a new purchase.
    The server refuses if every slot is in use and says which, so the error
    is the upsell.
  */
  const executeResumeSync = async (connectionId: string) => {
    setDeletingIds(prev => new Set(prev).add(connectionId));

    try {
      const success = await brokerService.resumeSync(connectionId);

      if (success) {
        await loadConnections();
        await refreshAccounts();
        showToast('Syncing back on. New trades will appear on their own.', 'success');
      }
    } catch (error) {
      console.error('Resume sync error:', error);
      showToast(
        error instanceof Error ? error.message : 'Could not turn syncing back on.',
        'error'
      );
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

  if (connections.length === 0 && !showAddAccount) {
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
            {/*
              The "Upload CSV File" button that stood here is gone.

              It was shown to people with no accounts, and there is nowhere
              for those trades to go: an imported trade must belong to an
              account or it is invisible to every balance on the site. What
              actually happened is that one user imported, saw nothing appear,
              and imported again - four times in nine minutes - turning twelve
              real trades into forty-eight rows.

              Create the account first, then import into it. The per-account
              upload on each card below already does this correctly.
            */}
            <button
              onClick={() => setShowAddAccount(true)}
              className="px-6 py-3 bg-gradient-to-r from-gold-400/20 to-blue-500/20 hover:from-gold-400/30 hover:to-blue-500/30 text-gold-400 rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2 border border-gold-400/30"
            >
              <Plus size={16} />
              Add Account Manually
            </button>
          </div>
        </div>
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
          <div className="flex flex-wrap items-start justify-between gap-y-3">
            <div className="flex items-start gap-4 flex-1 min-w-[240px]">
              <div className="w-12 h-12 rounded-lg bg-gold-400/10 flex items-center justify-center flex-shrink-0">
                <Link2 className="w-6 h-6 text-gold-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {renamingId === connection.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      disabled={savingRename}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => saveRename(connection)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          saveRename(connection);
                        }
                        // Escape abandons the edit. Clearing the value first
                        // means the blur that follows sees nothing to save.
                        if (e.key === 'Escape') {
                          setRenameValue('');
                          setRenamingId(null);
                        }
                      }}
                      maxLength={60}
                      aria-label="Account name"
                      className="font-medium text-lg bg-black/40 border border-blue-400/40 rounded-md px-2 py-0.5 min-w-0 w-48 focus:outline-none focus:border-blue-400"
                    />
                  ) : (
                    <h3 className="font-medium text-lg">{connection.account_name}</h3>
                  )}
                  {getStatusBadge(connection.status)}
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-white/5 text-gray-400 border border-white/10">
                    <Upload className="w-3 h-3" />
                    Manual Import
                  </span>
                </div>
                <p className="text-sm text-gray-400 mb-2">
                  {connection.brokers?.name
                    || (connection.broker_type && connection.broker_type !== 'manual' ? connection.broker_type : 'Manual Account')}
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
                onClick={() => {
                  setRenameValue(connection.account_name);
                  setRenamingId(connection.id);
                }}
                className="p-2 hover:bg-blue-500/10 rounded-lg transition-colors group"
                title="Rename account"
              >
                <Pencil className="w-4 h-4 text-gray-400 group-hover:text-blue-400 transition-colors" />
              </button>
              <button
                onClick={() => setEditingBalance(connection)}
                className="p-2 hover:bg-blue-500/10 rounded-lg transition-colors group"
                title="Edit balance"
              >
                <DollarSign className="w-5 h-5 text-gray-400 group-hover:text-blue-400 transition-colors" />
              </button>
              {/*
                Pause and resume, not delete.

                A synced account gets a way to stop it costing a slot; a
                paused one gets a way to start again. Deleting for real is
                deliberately not on the card - it is rare, it is the only
                destructive option, and putting it next to the everyday
                control is how people lose an account they meant to pause.
              */}
              {connection.metaapi_account_id && (
                connection.sync_paused_at ? (
                  <button
                    onClick={() => executeResumeSync(connection.id)}
                    disabled={deletingIds.has(connection.id)}
                    className="px-3 py-2 rounded-lg text-[12.5px] font-medium bg-brand-blue/10
                      text-brand-blue hover:bg-brand-blue/20 transition-colors
                      disabled:opacity-60 disabled:cursor-not-allowed"
                    title="Start syncing this account again"
                  >
                    {deletingIds.has(connection.id) ? 'Starting…' : 'Resume syncing'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleDelete(connection.id)}
                    disabled={deletingIds.has(connection.id)}
                    className="p-2 hover:bg-blue-500/10 rounded-lg transition-colors group"
                    title="Turn off syncing - keeps every trade"
                  >
                    <PauseCircle className="w-4 h-4 text-gray-400 group-hover:text-blue-400 transition-colors" />
                  </button>
                )
              )}
            </div>
          </div>
        </motion.div>
      ))}

      <div className="flex justify-center gap-3 pt-4">
        {/*
          Also removed, and this one was pure duplication: every account card
          above already carries its own upload control, which passes that
          account through and imports correctly. This button did the same job
          without knowing which account it meant, which is precisely how the
          trades ended up belonging to none.
        */}
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
            className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Add Trading Account</h2>
              <button
                onClick={() => {
                  setShowAddAccount(false);
                  setNewAccountName('');
                  setSelectedBrokerId('');
                  setOtherBrokerName('');
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

      {/*
        Says what actually happens, which is much less alarming than what
        "Remove Account" implied. The old copy promised trades would survive
        while the account itself vanished from the product - technically true
        and thoroughly misleading.
      */}
      <ConfirmModal
        isOpen={disconnectConfirm.isOpen}
        title="Turn off syncing?"
        message="This account stays here with all its trades, and you can still add trades to it by hand. It just stops updating on its own, and the sync slot goes back to your plan. You can turn it back on any time, free."
        confirmLabel="Turn off syncing"
        variant="warning"
        onConfirm={() => executePauseSync(disconnectConfirm.connectionId)}
        onCancel={() => setDisconnectConfirm({ isOpen: false, connectionId: '' })}
      />
    </div>
  );
}
