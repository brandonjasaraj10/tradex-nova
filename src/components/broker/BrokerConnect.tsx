import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link2, AlertCircle, X, CheckCircle2, ArrowRight, LineChart, Coins, Globe2, Eye, EyeOff, RefreshCw, Zap, Search } from 'lucide-react';
import Button from '../shared/Button';
import { brokerService, type BrokerFromAPI, type ConnectBrokerParams } from '../../services/brokerService';

interface BrokerConnectProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function BrokerConnect({ onClose, onSuccess }: BrokerConnectProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBroker, setSelectedBroker] = useState<BrokerFromAPI | null>(null);
  const [brokers, setBrokers] = useState<BrokerFromAPI[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [credentials, setCredentials] = useState({
    account_name: '',
    account_type: 'live', // live, challenge, verification, funded
    api_key: '',
    api_secret: '',
    access_token: '',
    account_id: '',
    username: '',
    password: '',
    server: '',
    starting_balance: '',
    currency: 'USD',
    ownership_type: 'personal' as 'personal' | 'funded' | 'prop',
  });

  useEffect(() => {
    loadBrokers();
  }, []);

  const loadBrokers = async () => {
    setIsLoading(true);
    const data = await brokerService.getAvailableBrokers();
    setBrokers(data.filter(b => b.status === 'live'));
    setIsLoading(false);
  };

  const categories = [
    {
      id: 'stocks',
      name: 'Stock Brokers',
      icon: LineChart,
      description: 'Connect stock trading accounts',
    },
    {
      id: 'forex',
      name: 'Forex Brokers',
      icon: Globe2,
      description: 'Connect forex trading accounts',
    },
    {
      id: 'crypto',
      name: 'Crypto Exchanges',
      icon: Coins,
      description: 'Connect cryptocurrency exchanges',
    },
    {
      id: 'prop_firm',
      name: 'Prop Firms',
      icon: Zap,
      description: 'Connect funded accounts, challenges & verifications',
    },
    {
      id: 'multi_asset',
      name: 'Multi-Asset Brokers',
      icon: Zap,
      description: 'Brokers supporting multiple asset classes',
    },
  ];

  const filteredBrokers = brokers.filter(broker => {
    const matchesCategory = selectedCategory === 'all' || broker.category === selectedCategory;
    const matchesSearch = searchQuery === '' ||
      broker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      broker.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleConnect = async () => {
    console.log('🔌 Starting connection process...');
    setIsConnecting(true);
    setError('');

    try {
      if (!selectedBroker) throw new Error('Please select a broker');
      if (!credentials.account_name) throw new Error('Please enter an account name');
      if (!credentials.starting_balance || parseFloat(credentials.starting_balance) <= 0) {
        throw new Error('Please enter a valid starting balance');
      }

      console.log('✅ Selected broker:', selectedBroker.slug, selectedBroker.category);
      console.log('✅ Credentials:', {
        account_name: credentials.account_name,
        account_type: credentials.account_type,
        username: credentials.username ? '***' : 'empty',
        password: credentials.password ? '***' : 'empty',
        server: credentials.server || 'empty',
        starting_balance: credentials.starting_balance,
        currency: credentials.currency,
        ownership_type: credentials.ownership_type
      });

      let connectionParams: ConnectBrokerParams = {
        broker_slug: selectedBroker.slug,
        broker_id: selectedBroker.id,
        account_name: credentials.account_name,
        connection_type: 'api_key',
        starting_balance: parseFloat(credentials.starting_balance),
        currency: credentials.currency,
        ownership_type: credentials.ownership_type,
      };

      // Username/Password brokers (MT4/MT5, Oanda, Prop Firms, etc.)
      const usernamePasswordBrokers = [
        'oanda', 'metatrader-4', 'metatrader-5', 'ninjatrader', 'thinkorswim', 'tradestation',
        'ftmo', 'the5ers', 'myforexfunds', 'thefundedtrader', 'trueforexfunds', 'fundednext', 'topstep', 'earn2trade'
      ];

      if (usernamePasswordBrokers.includes(selectedBroker.slug)) {
        console.log('📝 Using username/password auth');
        if (!credentials.username) throw new Error('Please enter your account number/username');
        if (!credentials.password) throw new Error('Please enter your password');

        const isPropFirm = selectedBroker.category === 'prop_firm';
        const isMetaTrader = selectedBroker.slug === 'metatrader-4' || selectedBroker.slug === 'metatrader-5';

        if ((isPropFirm || isMetaTrader) && !credentials.server) {
          throw new Error('Please enter your server address');
        }

        connectionParams = {
          ...connectionParams,
          connection_type: 'credentials',
          account_type: credentials.account_type,
          username: credentials.username,
          password: credentials.password,
          server: credentials.server || undefined,
        };
      }
      // API Key brokers (Bybit, Binance, etc.)
      else if (selectedBroker.slug === 'bybit') {
        console.log('🔑 Using API key auth (Bybit)');
        if (!credentials.api_key) throw new Error('Please enter your API Key');
        if (!credentials.api_secret) throw new Error('Please enter your API Secret');
        connectionParams = {
          ...connectionParams,
          api_key: credentials.api_key,
          api_secret: credentials.api_secret,
        };
      } else {
        console.log('🔑 Using API key auth (generic)');
        if (!credentials.api_key) throw new Error('Please enter your API Key');
        connectionParams = {
          ...connectionParams,
          api_key: credentials.api_key,
          api_secret: credentials.api_secret || undefined,
        };
      }

      console.log('🚀 Sending connection request...');
      const result = await brokerService.connectBroker(connectionParams);
      console.log('📨 Connection result:', result);

      if (result.success) {
        console.log('✅ Connection successful!');
        onSuccess?.();
        onClose();
      } else {
        console.error('❌ Connection failed:', result.error);
        setError(result.error || 'Failed to connect. Please check your credentials.');
      }
    } catch (err) {
      console.error('❌ Error during connection:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsConnecting(false);
      console.log('🏁 Connection process finished');
    }
  };

  const getCredentialFields = () => {
    if (!selectedBroker) return null;

    const usernamePasswordBrokers = [
      'oanda', 'metatrader-4', 'metatrader-5', 'ninjatrader', 'thinkorswim', 'tradestation',
      'ftmo', 'the5ers', 'myforexfunds', 'thefundedtrader', 'trueforexfunds', 'fundednext', 'topstep', 'earn2trade'
    ];

    // Username/Password auth (simple login)
    if (usernamePasswordBrokers.includes(selectedBroker.slug)) {
      const needsServer = ['metatrader-4', 'metatrader-5'].includes(selectedBroker.slug);
      const isPropFirm = selectedBroker.category === 'prop_firm';

      return (
        <>
          {isPropFirm && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Account Type *
              </label>
              <select
                className="input-field"
                value={credentials.account_type}
                onChange={(e) => setCredentials(prev => ({ ...prev, account_type: e.target.value }))}
              >
                <option value="challenge">Challenge Account</option>
                <option value="verification">Verification Account</option>
                <option value="funded">Funded Account</option>
                <option value="live">Live Account</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select the account type you're connecting
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Account Number / Username *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="Enter your account number"
              value={credentials.username}
              onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-field pr-10"
                placeholder="Enter your password"
                value={credentials.password}
                onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              You can use your regular password or read-only password (recommended for security)
            </p>
          </div>
          {(needsServer || isPropFirm) && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Server *
              </label>
              {isPropFirm ? (
                <>
                  <select
                    className="input-field mb-2"
                    value={credentials.server || 'custom'}
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        setCredentials(prev => ({ ...prev, server: e.target.value }));
                      } else {
                        setCredentials(prev => ({ ...prev, server: '' }));
                      }
                    }}
                  >
                    <option value="custom">Custom Server (Enter Below)</option>
                    <optgroup label="FTMO">
                      <option value="FTMO-Server">FTMO-Server</option>
                      <option value="FTMO-Server2">FTMO-Server2</option>
                      <option value="FTMO-Server3">FTMO-Server3</option>
                      <option value="FTMO-Demo">FTMO-Demo</option>
                    </optgroup>
                    <optgroup label="MyForexFunds">
                      <option value="MyForexFunds-Demo">MyForexFunds-Demo</option>
                      <option value="MyForexFunds-Live">MyForexFunds-Live</option>
                    </optgroup>
                    <optgroup label="The5ers">
                      <option value="The5ers-Demo">The5ers-Demo</option>
                      <option value="The5ers-Live">The5ers-Live</option>
                    </optgroup>
                    <optgroup label="The Funded Trader">
                      <option value="TheFundedTrader-Demo">TheFundedTrader-Demo</option>
                      <option value="TheFundedTrader-Live">TheFundedTrader-Live</option>
                    </optgroup>
                    <optgroup label="True Forex Funds">
                      <option value="TrueForexFunds-Demo">TrueForexFunds-Demo</option>
                      <option value="TrueForexFunds-Live">TrueForexFunds-Live</option>
                    </optgroup>
                    <optgroup label="FundedNext">
                      <option value="FundedNext-Demo">FundedNext-Demo</option>
                      <option value="FundedNext-Live">FundedNext-Live</option>
                    </optgroup>
                  </select>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Or enter custom server address"
                    value={credentials.server}
                    onChange={(e) => setCredentials(prev => ({ ...prev, server: e.target.value }))}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Select from common servers above, or enter your custom server address. Find this in your prop firm email or MT4/MT5 platform.
                  </p>
                </>
              ) : (
                <>
                  <select
                    className="input-field mb-2"
                    value={credentials.server || 'custom'}
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        setCredentials(prev => ({ ...prev, server: e.target.value }));
                      } else {
                        setCredentials(prev => ({ ...prev, server: '' }));
                      }
                    }}
                  >
                    <option value="custom">Custom Server (Enter Below)</option>
                    <optgroup label="IC Markets">
                      <option value="ICMarkets-Live">ICMarkets-Live</option>
                      <option value="ICMarkets-Demo">ICMarkets-Demo</option>
                      <option value="ICMarketsSC-Demo">ICMarketsSC-Demo</option>
                    </optgroup>
                    <optgroup label="Pepperstone">
                      <option value="Pepperstone-Live">Pepperstone-Live</option>
                      <option value="Pepperstone-Demo">Pepperstone-Demo</option>
                    </optgroup>
                    <optgroup label="XM">
                      <option value="XMGlobal-Real">XMGlobal-Real</option>
                      <option value="XMGlobal-Demo">XMGlobal-Demo</option>
                    </optgroup>
                    <optgroup label="Admiral Markets">
                      <option value="AdmiralMarkets-Live">AdmiralMarkets-Live</option>
                      <option value="AdmiralMarkets-Demo">AdmiralMarkets-Demo</option>
                    </optgroup>
                    <optgroup label="FXCM">
                      <option value="FXCM-USDReal">FXCM-USDReal</option>
                      <option value="FXCM-USDDemo">FXCM-USDDemo</option>
                    </optgroup>
                    <optgroup label="Exness">
                      <option value="Exness-MT5Real">Exness-MT5Real</option>
                      <option value="Exness-MT5Demo">Exness-MT5Demo</option>
                    </optgroup>
                  </select>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Or enter custom server address"
                    value={credentials.server}
                    onChange={(e) => setCredentials(prev => ({ ...prev, server: e.target.value }))}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Select from common servers above, or enter your custom server address. Find this in your broker's email or MT4/MT5 platform.
                  </p>
                </>
              )}
            </div>
          )}
        </>
      );
    }

    // API Key auth (Bybit specific)
    if (selectedBroker.slug === 'bybit') {
      return (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              API Key *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="Enter your Bybit API Key"
              value={credentials.api_key}
              onChange={(e) => setCredentials(prev => ({ ...prev, api_key: e.target.value }))}
            />
            <p className="text-xs text-gray-500 mt-1">
              Get your API key from Bybit {'>'} Account {'>'} API Management
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              API Secret *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-field pr-10"
                placeholder="Enter your Bybit API Secret"
                value={credentials.api_secret}
                onChange={(e) => setCredentials(prev => ({ ...prev, api_secret: e.target.value }))}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </>
      );
    }

    // Generic API Key auth
    return (
      <>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            API Key *
          </label>
          <input
            type="text"
            className="input-field"
            placeholder="Enter your API Key"
            value={credentials.api_key}
            onChange={(e) => setCredentials(prev => ({ ...prev, api_key: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            API Secret (Optional)
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className="input-field pr-10"
              placeholder="Enter your API Secret"
              value={credentials.api_secret}
              onChange={(e) => setCredentials(prev => ({ ...prev, api_secret: e.target.value }))}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      </>
    );
  };

  const renderContent = () => {
    const usernamePasswordBrokers = [
      'oanda', 'metatrader-4', 'metatrader-5', 'ninjatrader', 'thinkorswim', 'tradestation',
      'ftmo', 'the5ers', 'myforexfunds', 'thefundedtrader', 'trueforexfunds', 'fundednext', 'topstep', 'earn2trade'
    ];

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-gold-400" />
        </div>
      );
    }

    if (selectedBroker) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-start gap-4 p-4 rounded-lg bg-white/5">
            <div className="w-10 h-10 rounded-lg bg-gold-400/10 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-gold-400" />
            </div>
            <div>
              <h3 className="font-medium">{selectedBroker.name}</h3>
              <p className="text-sm text-gray-400 mt-1">
                {selectedBroker.supports_auto_sync ? '✓ Auto-sync enabled' : 'Manual import only'}
              </p>
              {usernamePasswordBrokers.includes(selectedBroker.slug) && (
                <p className="text-xs text-blue-400 mt-1">
                  ℹ️ Uses account login (regular or read-only password accepted)
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Account Name *
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g., My Trading Account"
                value={credentials.account_name}
                onChange={(e) => setCredentials(prev => ({ ...prev, account_name: e.target.value }))}
              />
              <p className="text-xs text-gray-500 mt-1">
                Give this connection a name for easy identification
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Starting Balance *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input-field pl-12"
                  placeholder="0.00"
                  value={credentials.starting_balance}
                  onChange={(e) => setCredentials(prev => ({ ...prev, starting_balance: e.target.value }))}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {credentials.currency}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Your account balance at the time of connection
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Currency
                </label>
                <select
                  className="input-field"
                  value={credentials.currency}
                  onChange={(e) => setCredentials(prev => ({ ...prev, currency: e.target.value }))}
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
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Account Type
                </label>
                <select
                  className="input-field"
                  value={credentials.ownership_type}
                  onChange={(e) => setCredentials(prev => ({ ...prev, ownership_type: e.target.value as 'personal' | 'funded' | 'prop' }))}
                >
                  <option value="personal">Personal</option>
                  <option value="funded">Funded (Prop Firm)</option>
                  <option value="prop">Prop Firm</option>
                </select>
              </div>
            </div>

            {getCredentialFields()}

            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-xs text-blue-400">
                <strong>Security:</strong> Your credentials are encrypted and stored securely. We never have access to your trading account or funds.
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-4">
            <Button
              variant="ghost"
              onClick={() => {
                setSelectedBroker(null);
                setCredentials({
                  account_name: '',
                  account_type: 'live',
                  api_key: '',
                  api_secret: '',
                  access_token: '',
                  account_id: '',
                  username: '',
                  password: '',
                  server: '',
                  starting_balance: '',
                  currency: 'USD',
                  ownership_type: 'personal',
                });
                setError('');
              }}
            >
              Back
            </Button>
            <Button
              variant="primary"
              onClick={handleConnect}
              isLoading={isConnecting}
            >
              Connect {selectedBroker.name}
            </Button>
          </div>
        </motion.div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search brokers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:border-gold-400/50 focus:ring-2 focus:ring-gold-400/20 outline-none transition-all"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white focus:border-gold-400/50 focus:ring-2 focus:ring-gold-400/20 outline-none transition-all"
          >
            <option value="all">All Brokers</option>
            <option value="forex">Forex</option>
            <option value="stocks">Stocks</option>
            <option value="crypto">Crypto</option>
            <option value="prop_firm">Prop Firms</option>
            <option value="multi_asset">Multi-Asset</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
          {filteredBrokers.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-gray-400">
              No brokers found matching your search
            </div>
          ) : (
            filteredBrokers.map((broker) => (
              <motion.button
                key={broker.id}
                onClick={() => setSelectedBroker(broker)}
                whileHover={{ scale: 1.02 }}
                className="p-4 rounded-lg bg-black/40 border border-white/5 hover:border-gold-400/50 hover:bg-black/60 transition-all text-left"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-base">{broker.name}</h3>
                  {broker.supports_auto_sync && (
                    <span className="flex items-center gap-1 text-xs bg-gold-400/10 text-gold-400 px-2 py-1 rounded border border-gold-400/20">
                      <Zap className="w-3 h-3" />
                      Auto
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 capitalize">
                  {broker.category.replace('_', ' ')}
                </p>
              </motion.button>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-black/95 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl max-w-4xl w-full">
      <div className="p-6 border-b border-white/10 bg-black/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold-400/10 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-gold-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium">Connect Trading Account</h2>
              <p className="text-sm text-gray-400">Auto-sync your trades from {brokers.length}+ supported brokers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-6 flex items-center gap-2 text-sm">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${!selectedBroker ? 'bg-gold-400 text-dark-700' : 'bg-white/5 text-gray-400'}`}>
            <span className="w-4 h-4 flex items-center justify-center rounded-full bg-black/20">1</span>
            Select Broker
          </div>
          <ArrowRight size={12} className="text-gray-600" />
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${selectedBroker ? 'bg-gold-400 text-dark-700' : 'bg-white/5 text-gray-400'}`}>
            <span className="w-4 h-4 flex items-center justify-center rounded-full bg-black/20">2</span>
            Connect
          </div>
        </div>

        {selectedBroker && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <button
              onClick={() => {
                setSelectedBroker(null);
                setCredentials({
                  account_name: '',
                  account_type: 'live',
                  api_key: '',
                  api_secret: '',
                  access_token: '',
                  account_id: '',
                  username: '',
                  password: '',
                  server: '',
                  starting_balance: '',
                  currency: 'USD',
                  ownership_type: 'personal',
                });
                setError('');
              }}
              className="text-gray-400 hover:text-white transition-colors"
            >
              All Brokers
            </button>
            <span className="text-gray-600">/</span>
            <span className="text-white">{selectedBroker.name}</span>
          </div>
        )}
      </div>

      <div className="p-6 bg-black/40">
        {renderContent()}
      </div>
    </div>
  );
}
