import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useClampedPanel } from '../../hooks/useClampedPanel';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Plus, FileUp, X, Info, ShieldCheck, RefreshCw, Eye, EyeOff } from 'lucide-react';
import Button from './Button';
import CSVUpload from '../broker/CSVUpload';
import { supabase, getCurrentUser } from '../../lib/supabase';
import { brokerService, type BrokerFromAPI } from '../../services/brokerService';
import { useToast } from '../../lib/toastContext';
import { useDateRange, allTimeRange } from '../../lib/dateRangeContext';
import { BROKER_SYNC_ENABLED } from '../../lib/featureFlags';
import { connectMetaTraderAccount, syncMetaTraderAccount } from '../../services/metaTraderConnect';
import { searchMtServers, type MtServerSuggestion } from '../../services/mtServers';
import AccountLimitReached from '../broker/AccountLimitReached';
import { getSyncAccessState } from '../../services/syncAccess';
import { useAuth } from '../../lib/auth';

/*
  Which platform the account actually runs on, asked separately from which
  broker or prop firm it is with. A firm like FTMO or Alpha Capital lets the
  trader pick between MetaTrader, cTrader, DXtrade and TradeLocker, and each
  of those would need its own sync integration - so the broker name on its
  own tells us nothing about whether we could ever sync the account.

  Required, because an optional version of this question can't be read: a
  blank could mean "didn't know" or "couldn't be bothered", and those need
  different responses from us. "Not sure" is a valid answer so nobody is
  blocked, and it is kept separate from "Other" - one means we asked someone
  who can't tell us, the other means a platform is missing from this list.
*/
const TRADING_PLATFORMS = [
  { value: 'mt5', label: 'MetaTrader 5' },
  { value: 'mt4', label: 'MetaTrader 4' },
  { value: 'ctrader', label: 'cTrader' },
  { value: 'dxtrade', label: 'DXtrade' },
  { value: 'match_trader', label: 'Match-Trader' },
  { value: 'tradelocker', label: 'TradeLocker' },
  { value: 'tradovate', label: 'Tradovate' },
  { value: 'rithmic', label: 'Rithmic' },
  { value: 'ninjatrader', label: 'NinjaTrader' },
  { value: 'tradingview', label: 'TradingView' },
  { value: 'other', label: 'Other - not listed' },
  { value: 'unsure', label: "Not sure" },
];

interface Account {
  id: string;
  account_name: string | null;
  broker_type: string;
  is_active: boolean;
  is_synced?: boolean;
  last_sync?: string | null;
}

/* "Synced 5m ago" reads better than a timestamp nobody wants to decode. */
function formatLastSync(iso?: string | null): string {
  if (!iso) return 'Never synced';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Synced just now';
  if (mins < 60) return `Synced ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Synced ${hours}h ago`;
  return `Synced ${Math.floor(hours / 24)}d ago`;
}

interface AccountSelectorProps {
  accounts: Account[];
  selectedAccount: Account | null;
  onAccountChange: (account: Account | null) => void;
  onAccountsUpdate?: () => void;
}

export default function AccountSelector({ accounts, selectedAccount, onAccountChange, onAccountsUpdate }: AccountSelectorProps) {
  const { showToast } = useToast();
  /*
    Ending a trial early changes the subscription the whole app reads from,
    not just this panel. Without refreshing it, Settings and the paywall gate
    would go on believing the trial was still running until the next full
    page load - so somebody who had just paid would still be told they were
    on a trial.
  */
  const { refreshSubscription } = useAuth();
  const { setDateRange } = useDateRange();
  const [isOpen, setIsOpen] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  useBodyScrollLock(showAddAccount || showCSVUpload);
  const [brokers, setBrokers] = useState<BrokerFromAPI[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [selectedBrokerId, setSelectedBrokerId] = useState('');
  const [otherBrokerName, setOtherBrokerName] = useState('');
  const [startingBalance, setStartingBalance] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [ownershipType, setOwnershipType] = useState<'personal' | 'funded' | 'prop'>('personal');
  const [platform, setPlatform] = useState('');
  const [mtLogin, setMtLogin] = useState('');
  const [mtServer, setMtServer] = useState('');
  const [mtInvestorPassword, setMtInvestorPassword] = useState('');
  const [connectStatus, setConnectStatus] = useState('');
  /*
    An investor password is copied out of MetaTrader and is usually a jumble
    of characters nobody can type reliably. Not being able to check it turns
    one typo into "Invalid account credentials", which reads as the feature
    being broken rather than a mistyped character.
  */
  const [showInvestorPassword, setShowInvestorPassword] = useState(false);
  /*
    Set only when the backend refused on allowance. Null the rest of the time,
    which is what keeps the panel out of the way of every other outcome.
  */
  const [limitInfo, setLimitInfo] = useState<
    { limit: number; onTrial: boolean; connectionId: string } | null
  >(null);
  const [serverSuggestions, setServerSuggestions] = useState<MtServerSuggestion[]>([]);
  const [showServerList, setShowServerList] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const selectorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelShift = useClampedPanel(isOpen, selectorRef, panelRef);

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


  /*
    Look up matching servers as the user types. Debounced because this
    leaves our servers and reaches MetaApi, and `cancelled` guards the
    common case of a reply landing after the user has typed on.
  */
  useEffect(() => {
    if (!BROKER_SYNC_ENABLED || (platform !== 'mt4' && platform !== 'mt5')) {
      setServerSuggestions([]);
      return;
    }
    if (mtServer.trim().length < 2) {
      setServerSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const results = await searchMtServers(platform, mtServer);
      if (!cancelled) setServerSuggestions(results);
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [platform, mtServer]);

  /*
    The connect fields only make sense for a platform we can actually reach.
    Everything else - cTrader, Tradovate, TradingView - has no integration
    yet, so offering the form there would promise something we can't do.
  */
  const canAutoSync = BROKER_SYNC_ENABLED && (platform === 'mt4' || platform === 'mt5');

  /*
    Syncing is opt-in by simply filling the fields in, rather than by a
    checkbox that hides them. Any one of the three counts as intent, so a
    half-filled form is caught as a mistake instead of silently creating a
    manual account the user thought was connected.
  */
  const autoSync = canAutoSync &&
    Boolean(mtLogin.trim() || mtServer.trim() || mtInvestorPassword);

  /*
    Manual sync. The backend upserts on the broker's own trade id, so this
    is safe to press repeatedly - it re-reads the same trades rather than
    duplicating them.
  */
  const handleSyncNow = async (account: Account) => {
    setSyncingId(account.id);
    const result = await syncMetaTraderAccount(account.id);
    setSyncingId(null);

    if (!result.ok) {
      showToast(result.error || 'Could not sync that account.', 'error');
      return;
    }
    showToast(
      result.imported
        ? `Synced ${result.imported} trade${result.imported === 1 ? '' : 's'}.`
        : 'Already up to date.',
      'success',
    );
    onAccountsUpdate?.();
  };

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) return;
    if (!autoSync && (!startingBalance || parseFloat(startingBalance) <= 0)) {
      showToast('Enter a starting balance for the account.', 'error');
      return;
    }
    if (selectedBrokerId === '__other__' && !otherBrokerName.trim()) {
      showToast('Enter the name of your broker or prop firm.', 'error');
      return;
    }
    if (!platform) {
      showToast('Choose the platform you trade on.', 'error');
      return;
    }
    if (canAutoSync && autoSync) {
      if (!mtLogin.trim() || !mtServer.trim() || !mtInvestorPassword) {
        showToast('Account number, server and investor password are all needed to connect.', 'error');
        return;
      }
    }

    setIsCreating(true);
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const isOther = selectedBrokerId === '__other__';
      const selectedBroker = brokers.find(b => b.id === selectedBrokerId);

      const connectionData: any = {
        user_id: user.id,
        account_name: newAccountName.trim(),
        status: 'connected',
        broker_type: isOther ? otherBrokerName.trim() : (selectedBroker?.name || 'manual'),
        /*
          A placeholder for a syncing account - the first sync overwrites
          both from the broker's own deposit history.
        */
        starting_balance: parseFloat(startingBalance) || 0,
        current_balance: parseFloat(startingBalance) || 0,
        currency,
        ownership_type: ownershipType,
      };

      if (selectedBrokerId && !isOther) {
        connectionData.broker_id = selectedBrokerId;
      }

      connectionData.platform = platform;

      const { data: created, error } = await supabase
        .from('user_broker_connections')
        .insert(connectionData)
        .select('id, account_name, broker_id')
        .single();

      if (error) throw error;

      // Not shown to the user - just lets us see which unlisted
      // brokers/prop firms come up most so we know what to add next.
      if (isOther) {
        await supabase.from('broker_requests').insert({
          user_id: user.id,
          requested_name: otherBrokerName.trim(),
        });
      }

      /*
        The account row exists either way. Syncing is an extra step on top
        of it, so a failed connection leaves the user with a working manual
        account and a message explaining what to fix - never a lost account
        or a half-made one.
      */
      /*
        Whether the allowance refused this connection.

        A local rather than reading limitInfo back, because setState has not
        applied by the time the cleanup below runs - and the cleanup is what
        this decides.
      */
      let hitAccountLimit = false;

      if (canAutoSync && autoSync && created?.id) {
        setConnectStatus('Connecting to your broker...');
        const result = await connectMetaTraderAccount({
          connectionId: created.id,
          login: mtLogin.trim(),
          server: mtServer.trim(),
          password: mtInvestorPassword,
          platform: platform === 'mt4' ? 'mt4' : 'mt5',
        });
        setConnectStatus('');

        if (!result.ok && result.limitReached) {
          /*
            Not a toast. This is the one connect failure the user resolves by
            deciding something rather than correcting something, and a message
            that fades while they are still reading it cannot carry a choice.
            The panel stays until they act on it or dismiss it.

            The account itself was created and kept - it works by hand and by
            CSV import, and deleting it because syncing was refused would
            throw away something they can use while they think about it.
          */
          hitAccountLimit = true;
          const state = await getSyncAccessState();
          setLimitInfo({
            limit: result.limit ?? 1,
            onTrial: state.onTrial,
            connectionId: created.id,
          });
        } else if (!result.ok) {
          showToast(`Account created, but syncing didn't connect: ${result.error}`, 'error');
        } else {
          /*
            Import now rather than waiting for the schedule, and keep trying
            for a couple of minutes.

            One attempt is not enough. MetaApi provisions the account and
            then goes and pulls the broker's history, which is not ready at
            a predictable moment - measured on this project's own accounts
            at under 92 seconds once and still not ready at 144 seconds
            another time. A single sync that lands in that gap imports
            nothing, and the trader is looking at an empty account they just
            connected.

            This also runs when the account has not reported CONNECTED yet.
            That check used to gate the import entirely, so an account that
            took a moment longer than the connect poll waited got no import
            at all - which is exactly what happened on the account that
            prompted this.

            Stops at the first attempt that brings something back. The
            scheduled sync remains the backstop for anyone who closes the
            tab.
          */
          setConnectStatus('Importing your trades...');

          const ATTEMPTS = 7;
          const GAP_MS = 20000;
          let imported = 0;

          for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
            const run = await syncMetaTraderAccount(created.id);
            if (run.ok && (run.imported ?? 0) > 0) {
              imported = run.imported ?? 0;
              break;
            }
            if (attempt < ATTEMPTS - 1) {
              /*
                Says how long rather than counting attempts. "3 of 7" invites
                somebody to wonder what happens at 7; "a minute or two" tells
                them it is normal and they can stop watching.
              */
              setConnectStatus(
                'Pulling your history from your broker. This can take a minute or two.',
              );
              await new Promise((r) => setTimeout(r, GAP_MS));
            }
          }

          setConnectStatus('');
          showToast(
            imported > 0
              ? `Account connected. Imported ${imported} trades.`
              : 'Account connected. Your broker is still sending your history — it will appear on its own within a few minutes.',
            'success',
          );
        }
      }

      /*
        Widen to all time for a newly added account. A brand new account's
        history is almost always older than the default last-30-days window,
        so the first thing a user saw after connecting was an empty
        dashboard - the trades were there, just outside the range.
      */
      setDateRange(allTimeRange());

      /*
        Everything below closes the form and empties it. Both are wrong when
        the allowance has just refused the connection.

        The panel offering the add-on renders inside this form, so closing it
        takes the choice off screen the instant it appears - which is what
        happened the first time this was tested end to end. And the fields it
        clears are the ones the retry needs: after the purchase goes through,
        the connection is attempted again with the login, server and investor
        password still in state, precisely so nobody has to find their
        investor password a second time. Emptying them would make the retry
        submit three blank strings.
      */
      if (hitAccountLimit) {
        setConnectStatus('');
        return;
      }

      setShowAddAccount(false);
      setNewAccountName('');
      setSelectedBrokerId('');
      setOtherBrokerName('');
      setStartingBalance('');
      setCurrency('USD');
      setOwnershipType('personal');
      setPlatform('');
      setMtLogin('');
      setMtServer('');
      setMtInvestorPassword('');
      setConnectStatus('');
      setIsOpen(false);

      /*
        Switch to the account that was just created.

        Creating one only refreshed the list; the selector stayed on whatever
        was chosen before, so the dashboard did not change and it looked like
        nothing had happened - you had to go back and pick the new account
        yourself to see the balance you had just set. Nobody creates an
        account in order to keep looking at a different one.

        Selected before the refresh so the switch is immediate; the refetch
        then reconciles this against the full list. broker_type is resolved
        there from broker_id, so this stands in with the same fallback the
        transform uses until it lands.
      */
      if (created) {
        onAccountChange({
          id: created.id,
          account_name: created.account_name,
          broker_type: isOther ? otherBrokerName.trim() : (selectedBroker?.name || 'Manual'),
          is_active: false,
        });
      }

      onAccountsUpdate?.();
    } catch (error) {
      console.error('Create account error:', error);
      showToast('Could not create that account. Please try again.', 'error');
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
    <div className={`relative ${isOpen ? 'z-30' : 'z-10'}`} ref={selectorRef}>
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
            key="account-panel"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1, x: panelShift }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            /*
              Anchored left on a phone, right from sm up.

              right-0 pins the panel's right edge to the trigger's, so it grows
              leftward - and this trigger sits near the left of the screen, so
              anything wider than the trigger ran off past x=0 and lost its
              first 45px. Anchoring left means it grows into the empty space
              instead, and the max-width stops it reaching the other edge.

              Not fixed positioning like the notification panel: that trigger
              lives in the fixed header, while this one scrolls with the page,
              so a fixed panel would drift away from its button.
            */
            ref={panelRef}
            className="absolute top-12 left-0 right-auto sm:left-auto sm:right-0 z-30 bg-[#0A0A0A] border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[200px] max-w-[calc(100vw-2rem)]"
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
                    /*
                      A row rather than a single button now: a connected
                      account carries its own "sync now" control, which can't
                      be nested inside the button that selects the account.
                    */
                    <div
                      key={account.id}
                      className={`w-full rounded-lg text-sm transition-colors flex items-center ${
                        selectedAccount?.id === account.id
                          ? 'bg-blue-400/10 text-blue-400'
                          : 'hover:bg-white/5 text-gray-300'
                      }`}
                    >
                      <button
                        onClick={() => handleAccountSelect(account)}
                        className="flex-1 text-left px-3 py-2 flex items-center justify-between min-w-0"
                      >
                        <div className="min-w-0">
                          <div className="truncate">{account.account_name || account.broker_type}</div>
                          {account.account_name && (
                            <div className="text-xs text-gray-500 truncate">
                              {account.broker_type}
                              {account.is_synced && (
                                <> &middot; {formatLastSync(account.last_sync)}</>
                              )}
                            </div>
                          )}
                        </div>
                        {selectedAccount?.id === account.id && <Check size={16} className="ml-2 shrink-0" />}
                      </button>

                      {BROKER_SYNC_ENABLED && account.is_synced && (
                        <button
                          type="button"
                          onClick={() => handleSyncNow(account)}
                          disabled={syncingId === account.id}
                          title="Sync now"
                          className="px-3 py-2 text-gray-400 hover:text-[#3B82F6] disabled:text-gray-600 transition-colors"
                        >
                          <RefreshCw
                            size={14}
                            className={syncingId === account.id ? 'animate-spin' : ''}
                          />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                {/*
                  Only offered when a specific account is selected, because an
                  import has to land somewhere. This used to open regardless -
                  including on "All Accounts" - and the trades were written
                  with no account at all, which makes them invisible to every
                  balance on the site while still counting in Total P&L.

                  Disabled rather than hidden, with the reason on the button,
                  so somebody looking for the feature finds it and learns what
                  to do instead of concluding it does not exist.
                */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!selectedAccount) return;
                    setIsOpen(false);
                    setShowCSVUpload(true);
                  }}
                  disabled={!selectedAccount}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 border ${
                    selectedAccount
                      ? 'bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue-light border-brand-blue-light/20'
                      : 'text-gray-500 border-white/10 cursor-not-allowed'
                  }`}
                >
                  <FileUp size={16} />
                  <span>
                    {selectedAccount ? 'Import CSV File' : 'Pick an account to import into'}
                  </span>
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

      {/*
        Both dialogs render into document.body rather than here.

        They are full-screen overlays, but sitting inside this component's
        positioned wrapper trapped them in its stacking context - so their
        z-50 counted for nothing beyond it. Opening one sets isOpen false,
        which drops that wrapper to z-10, and the View Reports menu at z-20
        then painted straight over the dialog. A portal puts them at the top
        level where a full-screen dialog belongs, out of reach of whatever
        the controls row does with its own layering.
      */}
      {showAddAccount && createPortal(
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
                  setStartingBalance('');
                  setCurrency('USD');
                  setOwnershipType('personal');
                  setPlatform('');
                  setMtLogin('');
                  setMtServer('');
                  setMtInvestorPassword('');
                  setConnectStatus('');
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
                  Broker / Prop Firm
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
                  Trading Platform *
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                >
                  <option value="">Select a platform...</option>
                  {TRADING_PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  The software you actually place trades in. Pick "Not sure" if
                  you don't know - it helps us build automatic syncing for the
                  platforms people really use.
                </p>
              </div>

              {canAutoSync && (
                <div className="rounded-lg border border-[#3B82F6]/30 p-4"
                     style={{ boxShadow: '0 0 20px rgba(59,130,246,0.15), inset 0 0 40px rgba(59,130,246,0.05)' }}>
                  <div className="flex items-start gap-2">
                    <RefreshCw size={16} className="text-[#3B82F6] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-white">
                        Sync this account automatically
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Pulls your closed trades in from {platform === 'mt5' ? 'MetaTrader 5' : 'MetaTrader 4'} so you
                        don't have to log them by hand. Leave these blank to track this
                        account by hand instead.
                      </p>
                    </div>
                  </div>

                  {true && (
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Account Number
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={mtLogin}
                          onChange={(e) => setMtLogin(e.target.value)}
                          placeholder="e.g., 5012345"
                          className="w-full px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Server
                        </label>
                        {/*
                          Hand-rolled rather than a <datalist>. The native one
                          renders in the operating system's own styling - light
                          grey, its own font, anchored off to the side - which
                          looks like a browser artifact rather than part of the
                          app. This is still a plain text input underneath, so a
                          server missing from MetaApi's catalogue can be typed in
                          full: it suggests without ever restricting.
                        */}
                        <div className="relative">
                          <input
                            type="text"
                            autoComplete="off"
                            value={mtServer}
                            onChange={(e) => { setMtServer(e.target.value); setShowServerList(true); }}
                            onFocus={() => setShowServerList(true)}
                            onBlur={() => window.setTimeout(() => setShowServerList(false), 150)}
                            placeholder="Start typing your broker, e.g. FTMO"
                            className="w-full px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                          />
                          {showServerList && serverSuggestions.length > 0 && (
                            <div className="absolute z-10 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[#3B82F6]/30 bg-[#0B0B0B] shadow-xl">
                              {serverSuggestions.map((sug) => (
                                <button
                                  key={`${sug.broker}-${sug.server}`}
                                  type="button"
                                  /*
                                    onMouseDown, not onClick: the input's blur
                                    fires first and would close this list before
                                    a click ever landed.
                                  */
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setMtServer(sug.server);
                                    setShowServerList(false);
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-[#3B82F6]/10 transition-colors border-b border-white/5 last:border-b-0"
                                >
                                  <span className="block text-sm text-white">{sug.server}</span>
                                  <span className="block text-xs text-gray-500">{sug.broker}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Type your broker's name to see matching servers, or enter it
                          yourself - exactly as it appears in your terminal under
                          Tools &rarr; Options &rarr; Server.
                        </p>
                      </div>

                      <div>
                        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-300 mb-2">
                          Investor Password
                          {/*
                            The read-only nature of an investor password is the
                            entire reason it is safe to hand over, so it gets an
                            icon and a badge rather than only a line of small
                            grey text underneath that nobody reads.
                          */}
                          <span
                            className="text-gray-500"
                            title="An investor password is MetaTrader's read-only login. It can view your account but cannot place, change or close a trade, and cannot withdraw."
                          >
                            <Info size={14} />
                          </span>
                        </label>
                        <div className="relative">
                          <input
                            type={showInvestorPassword ? 'text' : 'password'}
                            autoComplete="off"
                            value={mtInvestorPassword}
                            onChange={(e) => setMtInvestorPassword(e.target.value)}
                            placeholder="Read-only password"
                            className="w-full pl-4 pr-11 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                          />
                          {/*
                            Hidden by default, so the password is not sitting
                            in plain sight on a screen somebody might be
                            sharing - revealing it is a deliberate act.
                          */}
                          <button
                            type="button"
                            onClick={() => setShowInvestorPassword((v) => !v)}
                            aria-label={showInvestorPassword ? 'Hide password' : 'Show password'}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-md
                              text-gray-500 hover:text-gray-300 transition-colors"
                          >
                            {showInvestorPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        <div className="flex items-start gap-1.5 mt-2 text-xs text-[#3B82F6]">
                          <ShieldCheck size={14} className="mt-px shrink-0" />
                          <span>
                            Read-only access. An investor password can look at your
                            account but can't place, close or change a trade, and can't
                            withdraw.
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1.5">
                          This is your <strong className="text-gray-400">investor</strong> password, not the
                          one you log in with. We pass it to our data provider once to set the
                          connection up and never store it.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/*
                Hidden once the account is going to sync: the broker knows
                the real opening balance, and asking is an invitation to get
                it wrong. The first tester typed 200000.1 for an account
                that opened at exactly 200000, and that dime would have
                skewed their return percentage permanently.
              */}
              <div className={autoSync ? 'hidden' : ''}>
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

            {connectStatus && (
              <p className="text-xs text-blue-400 mt-4 text-right">{connectStatus}</p>
            )}

            {/*
              Shown in place of the usual footer once the allowance refused
              the connection, so the next thing under their cursor is the
              decision rather than a "Create account" button for an account
              that already exists.
            */}
            {limitInfo && (
              <div className="mt-5">
                <AccountLimitReached
                  limit={limitInfo.limit}
                  onTrial={limitInfo.onTrial}
                  onDismiss={() => {
                    setLimitInfo(null);
                    setShowAddAccount(false);
                    loadBrokers();
                  }}
                  onUnlocked={async () => {
                    /*
                      Retry the connection they were already making rather
                      than asking them to type the server and password again.
                      They are still in the form; the credentials are still
                      in state; the only thing that was missing was the
                      allowance, and it is there now.
                    */
                    setLimitInfo(null);
                    /*
                      Before anything else: the subscription they are now on
                      is different from the one the app has cached.
                    */
                    await refreshSubscription();
                    setConnectStatus('Connecting to your broker...');
                    const retry = await connectMetaTraderAccount({
                      connectionId: limitInfo.connectionId,
                      login: mtLogin.trim(),
                      server: mtServer.trim(),
                      password: mtInvestorPassword,
                      platform: platform === 'mt4' ? 'mt4' : 'mt5',
                    });
                    setConnectStatus('');
                    if (retry.ok) {
                      showToast(
                        'Subscribed and connected. Your trades will start arriving shortly.',
                        'success',
                      );
                      setShowAddAccount(false);
                    } else {
                      showToast(`Subscribed, but syncing didn't connect: ${retry.error}`, 'error');
                    }
                    loadBrokers();
                  }}
                />
              </div>
            )}

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
                  setPlatform('');
                  setMtLogin('');
                  setMtServer('');
                  setMtInvestorPassword('');
                  setConnectStatus('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateAccount}
                isLoading={isCreating}
                disabled={!newAccountName.trim() || (!autoSync && (!startingBalance || parseFloat(startingBalance) <= 0)) || !platform || (selectedBrokerId === '__other__' && !otherBrokerName.trim())}
              >
                Create Account
              </Button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {showCSVUpload && selectedAccount && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <CSVUpload
            connectionId={selectedAccount.id}
            onClose={() => setShowCSVUpload(false)}
            onSuccess={() => {
              setShowCSVUpload(false);
              onAccountsUpdate?.();
            }}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
