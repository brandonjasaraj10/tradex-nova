import { useState, useEffect } from 'react';
import { BookOpen, AlertCircle, CheckCircle, TrendingUp, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import Card from './Card';
import PageLoader from './PageLoader';
import { getTradingRules, type TradingRule } from '../../services/tradingRules';
import { getJournalEntryRules } from '../../services/tradingRules';
import { supabase } from '../../lib/supabase';

interface RuleWithStats extends TradingRule {
  adherence_rate: number;
}

const CATEGORY_ICONS = {
  risk_management: CheckCircle,
  timing: TrendingUp,
  psychology: AlertCircle,
  strategy: BookOpen,
  other: AlertTriangle,
};

export default function TradingRulesWidget() {
  const [rules, setRules] = useState<RuleWithStats[]>([]);
  const [overallAdherence, setOverallAdherence] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRulesWithStats();
  }, []);

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

      if (rulesWithStats.length > 0) {
        const avgAdherence = rulesWithStats.reduce((sum, r) => sum + r.adherence_rate, 0) / rulesWithStats.length;
        setOverallAdherence(Math.round(avgAdherence));
      }
    } catch (error) {
      console.error('Error loading rules with stats:', error);
    } finally {
      setLoading(false);
    }
  }

  async function calculateRuleAdherence(ruleId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('journal_entry_rules')
        .select('followed')
        .eq('rule_id', ruleId);

      if (error) throw error;
      if (!data || data.length === 0) return 0;

      const followedCount = data.filter(entry => entry.followed === true).length;
      return Math.round((followedCount / data.length) * 100);
    } catch (error) {
      console.error('Error calculating adherence:', error);
      return 0;
    }
  }

  function getCategoryIcon(category: TradingRule['category']) {
    const Icon = CATEGORY_ICONS[category] || CATEGORY_ICONS.other;
    return Icon;
  }

  function getAdherenceColor(rate: number) {
    return rate >= 90 ? 'text-blue-400' : 'text-gray-400';
  }

  function getAdherenceBgColor(rate: number) {
    return rate >= 90 ? 'bg-blue-400/10 border-blue-400/20' : 'bg-gray-400/10 border-gray-400/20';
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
                          Following <span className={`font-medium ${getAdherenceColor(rule.adherence_rate)}`}>
                            {rule.adherence_rate}%
                          </span> of the time
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
                {overallAdherence}%
              </span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  overallAdherence >= 90 ? 'bg-blue-400' : 'bg-gray-400'
                }`}
                style={{ width: `${overallAdherence}%` }}
              />
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
