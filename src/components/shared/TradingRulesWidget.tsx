import { useState, useEffect } from 'react';
import { BookOpen, AlertCircle, CheckCircle, TrendingUp, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import Card from './Card';
import PageLoader from './PageLoader';
import { getTradingRules, type TradingRule } from '../../services/tradingRules';
import { getJournalEntryRules } from '../../services/tradingRules';
import { supabase } from '../../lib/supabase';
import { useDataSync } from '../../lib/dataSync';
import { useAccount } from '../../lib/accountContext';

interface RuleWithStats extends TradingRule {
  // null = never tracked yet, which is not the same as 0%
  adherence_rate: number | null;
}

const CATEGORY_ICONS = {
  risk_management: CheckCircle,
  timing: TrendingUp,
  psychology: AlertCircle,
  strategy: BookOpen,
  other: AlertTriangle,
};

export default function TradingRulesWidget() {
  const { refreshTrigger } = useDataSync();
  const { selectedAccount } = useAccount();
  const [rules, setRules] = useState<RuleWithStats[]>([]);
  const [overallAdherence, setOverallAdherence] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  /*
    Recalculates whenever journal data changes or the account is switched,
    the same way every other data panel in the app does. With an empty
    dependency array this ran once on mount and never again, so marking a
    rule followed in the journal left the dashboard showing a stale figure
    until a full page reload - which is what made adherence look dead.
  */
  useEffect(() => {
    loadRulesWithStats();
  }, [refreshTrigger, selectedAccount?.id]);

  async function loadRulesWithStats() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userRules = await getTradingRules(user.id);
      const enabledRules = userRules.filter(r => r.enabled);

      const rulesWithStats = await Promise.all(
        enabledRules.map(async (rule) => {
          const adherenceRate = await calculateRuleAdherence(rule.id);
          return {
            ...rule,
            adherence_rate: adherenceRate,
          };
        })
      );

      setRules(rulesWithStats);

      // Average across rules that have been tracked. Including untracked
      // rules as 0 dragged the overall figure down for rules the trader
      // simply hasn't logged against yet.
      const tracked = rulesWithStats.filter(r => r.adherence_rate !== null);
      setOverallAdherence(
        tracked.length > 0
          ? Math.round(tracked.reduce((sum, r) => sum + (r.adherence_rate as number), 0) / tracked.length)
          : null
      );
    } catch (error) {
      console.error('Error loading rules with stats:', error);
    } finally {
      setLoading(false);
    }
  }

  /*
    Returns null - not 0 - when a rule has never been tracked. They are very
    different statements: 0% means "you broke this every single time", which
    is what a brand new rule used to display before it had ever been marked.

    Scoped to the selected account by joining through journal_entries, the
    same as every other figure on the dashboard. Without that, switching
    accounts left adherence unchanged because it was silently averaging
    every account together.
  */
  async function calculateRuleAdherence(ruleId: string): Promise<number | null> {
    try {
      let query = supabase
        .from('journal_entry_rules')
        .select('followed, journal_entries!inner(account_id)')
        .eq('rule_id', ruleId);

      if (selectedAccount) {
        query = query.eq('journal_entries.account_id', selectedAccount.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (!data || data.length === 0) return null;

      const followedCount = data.filter(entry => entry.followed === true).length;
      return Math.round((followedCount / data.length) * 100);
    } catch (error) {
      console.error('Error calculating adherence:', error);
      return null;
    }
  }

  function getCategoryIcon(category: TradingRule['category']) {
    const Icon = CATEGORY_ICONS[category] || CATEGORY_ICONS.other;
    return Icon;
  }

  function getAdherenceColor(rate: number | null) {
    return rate !== null && rate >= 90 ? 'text-blue-400' : 'text-gray-400';
  }

  function getAdherenceBgColor(rate: number | null) {
    return rate !== null && rate >= 90 ? 'bg-blue-400/10 border-blue-400/20' : 'bg-gray-400/10 border-gray-400/20';
  }

  if (loading) {
    return (
      <Card variant="default" className="p-6">
        <PageLoader className="py-8" />
      </Card>
    );
  }

  return (
    <Card variant="default" className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold">Your Trading Rules</h3>
        </div>
        <Link
          to="/checklists?tab=rules"
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          Edit Rules
        </Link>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400 text-sm mb-4">No trading rules set up yet</p>
          <Link
            to="/checklists?tab=rules"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
          >
            Create Your First Rule
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-6">
            {rules.map((rule) => {
              const Icon = getCategoryIcon(rule.category);
              return (
                <div
                  key={rule.id}
                  className={`p-4 rounded-lg border ${getAdherenceBgColor(rule.adherence_rate)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${getAdherenceBgColor(rule.adherence_rate)}`}>
                      <Icon className={`w-5 h-5 ${getAdherenceColor(rule.adherence_rate)}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white mb-1">{rule.name}</h4>
                      {rule.description && (
                        <p className="text-xs text-gray-400 mb-2">{rule.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-blue-400 font-medium">Active</span>
                        <span className="text-xs text-gray-400">
                          {rule.adherence_rate === null ? (
                            'Not tracked yet'
                          ) : (
                            <>
                              Following <span className={`font-medium ${getAdherenceColor(rule.adherence_rate)}`}>
                                {rule.adherence_rate}%
                              </span> of the time
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Overall Rule Adherence</span>
              <span className={`text-lg font-bold ${getAdherenceColor(overallAdherence)}`}>
                {overallAdherence === null ? '--' : `${overallAdherence}%`}
              </span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  overallAdherence !== null && overallAdherence >= 90 ? 'bg-blue-400' : 'bg-gray-400'
                }`}
                style={{ width: `${overallAdherence ?? 0}%` }}
              />
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
