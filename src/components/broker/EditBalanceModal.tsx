import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, DollarSign, AlertCircle } from 'lucide-react';
import Button from '../shared/Button';
import { supabase } from '../../lib/supabase';
import type { BrokerConnection } from '../../services/brokerService';

interface EditBalanceModalProps {
  connection: BrokerConnection;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditBalanceModal({ connection, onClose, onSuccess }: EditBalanceModalProps) {
  const [startingBalance, setStartingBalance] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [ownershipType, setOwnershipType] = useState<'personal' | 'funded' | 'prop'>('personal');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (connection.starting_balance) {
      setStartingBalance(connection.starting_balance.toString());
    }
    if (connection.currency) {
      setCurrency(connection.currency);
    }
    if (connection.ownership_type) {
      setOwnershipType(connection.ownership_type);
    }
  }, [connection]);

  const handleSave = async () => {
    if (!startingBalance || parseFloat(startingBalance) <= 0) {
      setError('Please enter a valid starting balance');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const balanceValue = parseFloat(startingBalance);
      console.log('Updating balance for connection:', connection.id);
      console.log('New values:', { balanceValue, currency, ownershipType });

      // First update the basic fields
      const { data: updateData, error: updateError } = await supabase
        .from('user_broker_connections')
        .update({
          starting_balance: balanceValue,
          current_balance: balanceValue,
          currency,
          ownership_type: ownershipType,
          last_balance_update: new Date().toISOString(),
        })
        .eq('id', connection.id)
        .select();

      console.log('Update result:', { updateData, updateError });

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      if (!updateData || updateData.length === 0) {
        throw new Error('No rows were updated. Please check permissions.');
      }

      // Recalculate balance based on existing trades
      console.log('Recalculating balance...');
      const { data: calcData, error: calcError } = await supabase.rpc('calculate_account_balance', {
        connection_id: connection.id
      });

      console.log('Calculation result:', { calcData, calcError });

      if (calcError) {
        console.error('Error recalculating balance:', calcError);
        setError(`Balance updated but recalculation failed: ${calcError.message}`);
        // Still call onSuccess as the main update worked
        onSuccess();
        return;
      }

      console.log('Balance successfully updated!');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error updating balance:', err);
      setError(err instanceof Error ? err.message : 'Failed to update balance');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 rounded-xl p-6 max-w-md w-full border border-white/10"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Edit Balance Information</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-400 mb-4">
                Account: <span className="text-white font-medium">{connection.account_name}</span>
              </p>
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
                  className="w-full px-4 py-2.5 pl-12 bg-black/30 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  placeholder="0.00"
                  value={startingBalance}
                  onChange={(e) => setStartingBalance(e.target.value)}
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
                  className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-lg text-white focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
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
                  className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-lg text-white focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  value={ownershipType}
                  onChange={(e) => setOwnershipType(e.target.value as 'personal' | 'funded' | 'prop')}
                >
                  <option value="personal">Personal</option>
                  <option value="funded">Funded (Prop Firm)</option>
                  <option value="prop">Prop Firm</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-xs text-blue-400">
                <strong>Note:</strong> Setting your starting balance will recalculate your current balance based on all existing trades in this account.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              isLoading={isSaving}
            >
              Save Balance
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
