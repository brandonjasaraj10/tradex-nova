import { supabase } from '../lib/supabase';

export interface BalanceData {
  starting_balance: number;
  current_balance: number;
  currency: string;
  net_pnl: number;
  percent_change: number;
  last_balance_update?: string;
}

export interface BalanceAdjustment {
  id: string;
  broker_connection_id: string;
  adjustment_type: 'deposit' | 'withdrawal' | 'manual_correction';
  amount: number;
  previous_balance: number;
  new_balance: number;
  reason?: string;
  created_at: string;
}

export class BalanceService {
  private static instance: BalanceService;

  private constructor() {}

  static getInstance(): BalanceService {
    if (!BalanceService.instance) {
      BalanceService.instance = new BalanceService();
    }
    return BalanceService.instance;
  }

  async getAccountBalance(connectionId: string): Promise<BalanceData | null> {
    try {
      const { data: connection, error } = await supabase
        .from('user_broker_connections')
        .select('starting_balance, current_balance, currency, last_balance_update')
        .eq('id', connectionId)
        .single();

      if (error || !connection) {
        console.error('Error fetching balance:', error);
        return null;
      }

      const net_pnl = connection.current_balance - connection.starting_balance;
      const percent_change = connection.starting_balance > 0
        ? (net_pnl / connection.starting_balance) * 100
        : 0;

      return {
        starting_balance: connection.starting_balance || 0,
        current_balance: connection.current_balance || 0,
        currency: connection.currency || 'USD',
        net_pnl,
        percent_change,
        last_balance_update: connection.last_balance_update,
      };
    } catch (error) {
      console.error('Error getting account balance:', error);
      return null;
    }
  }

  async recalculateBalance(connectionId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('calculate_account_balance', {
        connection_id: connectionId
      });

      if (error) {
        console.error('Error recalculating balance:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error recalculating balance:', error);
      return false;
    }
  }

  async adjustBalance(
    connectionId: string,
    adjustmentType: 'deposit' | 'withdrawal' | 'manual_correction',
    amount: number,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Get current balance
      const { data: connection, error: fetchError } = await supabase
        .from('user_broker_connections')
        .select('current_balance, starting_balance')
        .eq('id', connectionId)
        .single();

      if (fetchError || !connection) {
        return { success: false, error: 'Failed to fetch current balance' };
      }

      const previous_balance = connection.current_balance || connection.starting_balance || 0;
      let new_balance = previous_balance;

      // Calculate new balance based on adjustment type
      if (adjustmentType === 'deposit') {
        new_balance = previous_balance + amount;
      } else if (adjustmentType === 'withdrawal') {
        new_balance = previous_balance - amount;
      } else if (adjustmentType === 'manual_correction') {
        new_balance = amount; // Direct set for manual correction
      }

      // Update starting balance for deposits/withdrawals
      // This ensures future calculations include these adjustments
      const updates: any = {
        current_balance: new_balance,
        last_balance_update: new Date().toISOString(),
      };

      if (adjustmentType === 'deposit' || adjustmentType === 'withdrawal') {
        updates.starting_balance = connection.starting_balance + (adjustmentType === 'deposit' ? amount : -amount);
      } else if (adjustmentType === 'manual_correction') {
        updates.starting_balance = amount;
      }

      // Update connection balance
      const { error: updateError } = await supabase
        .from('user_broker_connections')
        .update(updates)
        .eq('id', connectionId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      // Log the adjustment
      const { error: logError } = await supabase
        .from('balance_adjustments')
        .insert({
          user_id: user.id,
          broker_connection_id: connectionId,
          adjustment_type: adjustmentType,
          amount,
          previous_balance,
          new_balance,
          reason: reason || null,
        });

      if (logError) {
        console.error('Error logging balance adjustment:', logError);
      }

      return { success: true };
    } catch (error) {
      console.error('Error adjusting balance:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  async getBalanceAdjustments(connectionId: string): Promise<BalanceAdjustment[]> {
    try {
      const { data, error } = await supabase
        .from('balance_adjustments')
        .select('*')
        .eq('broker_connection_id', connectionId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching balance adjustments:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching balance adjustments:', error);
      return [];
    }
  }

  async getCombinedBalance(userId?: string): Promise<BalanceData | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const targetUserId = userId || user?.id;

      if (!targetUserId) {
        return null;
      }

      const { data: connections, error } = await supabase
        .from('user_broker_connections')
        .select('starting_balance, current_balance, currency')
        .eq('user_id', targetUserId);

      if (error || !connections || connections.length === 0) {
        return null;
      }

      // Sum up all balances (assuming same currency for now)
      const total_starting = connections.reduce((sum, conn) => sum + (conn.starting_balance || 0), 0);
      const total_current = connections.reduce((sum, conn) => sum + (conn.current_balance || 0), 0);
      const net_pnl = total_current - total_starting;
      const percent_change = total_starting > 0 ? (net_pnl / total_starting) * 100 : 0;

      return {
        starting_balance: total_starting,
        current_balance: total_current,
        currency: connections[0]?.currency || 'USD',
        net_pnl,
        percent_change,
      };
    } catch (error) {
      console.error('Error getting combined balance:', error);
      return null;
    }
  }
}

export const balanceService = BalanceService.getInstance();
