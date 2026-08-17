import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wallet, TrendingUp, TrendingDown, DollarSign, RefreshCw, X, AlertCircle } from 'lucide-react';
import Card from '../shared/Card';
import { balanceService, type BalanceData } from '../../services/balanceService';
import { useAccount } from '../../lib/accountContext';

export default function BalanceCard() {
  const { selectedAccount } = useAccount();
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNotification, setShowNotification] = useState(true);

  useEffect(() => {
    loadBalance();
  }, [selectedAccount]);

  const loadBalance = async () => {
    setIsLoading(true);
    try {
      let data: BalanceData | null = null;

      if (selectedAccount) {
        data = await balanceService.getAccountBalance(selectedAccount.id);
      } else {
        data = await balanceService.getCombinedBalance();
      }

      setBalanceData(data);
    } catch (error) {
      console.error('Error loading balance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!selectedAccount) return;

    setIsRefreshing(true);
    await balanceService.recalculateBalance(selectedAccount.id);
    await loadBalance();
    setIsRefreshing(false);
  };

  const formatCurrency = (value: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-white/5 rounded w-24 mb-4"></div>
          <div className="h-8 bg-white/5 rounded w-32 mb-2"></div>
          <div className="h-3 bg-white/5 rounded w-20"></div>
        </div>
      </Card>
    );
  }

  const hasNoBalance = !balanceData || balanceData.starting_balance === 0;
  const shouldShowNotification = hasNoBalance && showNotification;

  if (shouldShowNotification) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className="relative"
      >
        <div className="p-4 rounded-lg bg-gradient-to-r from-blue-500/10 via-blue-400/5 to-blue-500/10 border-2 border-blue-400/30 shadow-lg shadow-blue-500/20"
          style={{
            boxShadow: '0 0 30px rgba(59, 130, 246, 0.15), 0 0 60px rgba(59, 130, 246, 0.1), inset 0 0 20px rgba(59, 130, 246, 0.05)'
          }}
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-400/30 shadow-md shadow-blue-500/20">
              <AlertCircle className="w-5 h-5 text-blue-400" style={{
                filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.6))'
              }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-300 mb-1">Set Your Account Balance</p>
              <p className="text-xs text-gray-300 leading-relaxed">
                Track your performance by adding your starting balance. Go to <span className="font-medium text-blue-400">Settings → Personal Info</span> and it's under <span className="font-medium text-blue-400">Trading Accounts</span>. Click the dollar icon ($) next to your account.
              </p>
            </div>
            <button
              onClick={() => setShowNotification(false)}
              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-blue-500/20 transition-colors group"
              title="Dismiss"
            >
              <X className="w-4 h-4 text-blue-400/70 group-hover:text-blue-400" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (hasNoBalance) {
    return null;
  }

  const isProfitable = balanceData.net_pnl >= 0;

  return (
    <Card className="p-6 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Wallet className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Account Balance</p>
              <p className="text-xs text-gray-500">
                {!selectedAccount ? 'All Accounts' : 'Selected Account'}
              </p>
            </div>
          </div>

          {selectedAccount && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Recalculate balance"
            >
              <RefreshCw className={`w-4 h-4 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mb-4">
            <div className="text-3xl font-bold text-white mb-1">
              {formatCurrency(balanceData.current_balance, balanceData.currency)}
            </div>
            <div className="text-sm text-gray-400">
              Started with {formatCurrency(balanceData.starting_balance, balanceData.currency)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-black/20 border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <p className="text-xs text-gray-400">Net P&L</p>
              </div>
              <p className={`text-lg font-semibold ${isProfitable ? 'text-blue-400' : 'text-gray-400'}`}>
                {isProfitable ? '+' : ''}{formatCurrency(balanceData.net_pnl, balanceData.currency)}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-black/20 border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                {isProfitable ? (
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-gray-400" />
                )}
                <p className="text-xs text-gray-400">Return</p>
              </div>
              <p className={`text-lg font-semibold ${isProfitable ? 'text-blue-400' : 'text-gray-400'}`}>
                {formatPercent(balanceData.percent_change)}
              </p>
            </div>
          </div>

          {balanceData.last_balance_update && (
            <p className="text-xs text-gray-500 mt-3">
              Last updated: {new Date(balanceData.last_balance_update).toLocaleString()}
            </p>
          )}
        </motion.div>
      </div>
    </Card>
  );
}
