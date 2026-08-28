import { useState, useEffect } from 'react';
import ConfirmModal from '../components/shared/ConfirmModal';
import { useAuth } from '../lib/auth';
import {
  getUserConfluences,
  getTradingPlanSettings,
  createConfluence,
  updateConfluence,
  deleteConfluence,
  initializeDefaultConfluences,
  type Confluence
} from '../services/confluences';
import {
  getTradingRules,
  createTradingRule,
  updateTradingRule,
  deleteTradingRule,
  type TradingRule
} from '../services/tradingRules';
import {
  getPsychologyChecks,
  createPsychologyCheck,
  updatePsychologyCheck,
  deletePsychologyCheck,
  seedStarterChecks,
  type PsychologyCheck
} from '../services/psychologyChecks';
import { CheckCircle2, Circle, Plus, X, Edit2, Save, Trash2, GripVertical, Brain, Check } from 'lucide-react';
import Card from '../components/shared/Card';
import PageLoader from '../components/shared/PageLoader';

type TabType = 'confluences' | 'rules' | 'psychology';

export default function Checklists() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('confluences');
  const [confluences, setConfluences] = useState<Confluence[]>([]);
  const [rules, setRules] = useState<TradingRule[]>([]);
  const [psychChecks, setPsychChecks] = useState<PsychologyCheck[]>([]);
  const [minConfluences, setMinConfluences] = useState(3);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [ruleCategory, setRuleCategory] = useState<TradingRule['category']>('strategy');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string }>({ isOpen: false, id: '' });

  useEffect(() => {
    loadData();
  }, [user]);

  async function loadData() {
    if (!user) return;

    try {
      setIsLoading(true);
      const [confluencesData, settings, rulesData, psychData] = await Promise.all([
        getUserConfluences(),
        getTradingPlanSettings(),
        getTradingRules(user.id),
        getPsychologyChecks(user.id)
      ]);

      if (confluencesData.length === 0) {
        await initializeDefaultConfluences();
        const newConfluences = await getUserConfluences();
        setConfluences(newConfluences);
      } else {
        setConfluences(confluencesData);
      }

      if (settings) {
        setMinConfluences(settings.min_confluences_required);
      }

      setRules(rulesData);

      /*
        Seed the starter list on first visit, the same way confluences are
        seeded above. An empty checklist gives no clue what belongs on one,
        and "what should I even ask myself?" is the hard part of building a
        pre-trade routine - much harder than editing a list already there.
      */
      if (psychData.length === 0) {
        setPsychChecks(await seedStarterChecks(user.id));
      } else {
        setPsychChecks(psychData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleConfluence(id: string) {
    const confluence = confluences.find(c => c.id === id);
    if (!confluence) return;

    try {
      const updated = await updateConfluence(id, { enabled: !confluence.enabled });
      setConfluences(confluences.map(c => c.id === id ? updated : c));
    } catch (error) {
      console.error('Error toggling confluence:', error);
    }
  }

  async function handleToggleRule(id: string) {
    const rule = rules.find(r => r.id === id);
    if (!rule) return;

    try {
      const updated = await updateTradingRule(id, { enabled: !rule.enabled });
      setRules(rules.map(r => r.id === id ? updated : r));
    } catch (error) {
      console.error('Error toggling rule:', error);
    }
  }

  async function handleTogglePsychCheck(id: string) {
    const check = psychChecks.find(c => c.id === id);
    if (!check) return;

    try {
      const updated = await updatePsychologyCheck(id, { enabled: !check.enabled });
      setPsychChecks(psychChecks.map(c => c.id === id ? updated : c));
    } catch (error) {
      console.error('Error toggling psychology check:', error);
    }
  }

  async function handleEdit(item: Confluence | TradingRule | PsychologyCheck) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditDescription(item.description || '');
    if ('category' in item) {
      setRuleCategory(item.category);
    }
  }

  async function handleSaveEdit() {
    if (!editingId) return;

    try {
      if (activeTab === 'confluences') {
        const updated = await updateConfluence(editingId, {
          name: editName,
          description: editDescription
        });
        setConfluences(confluences.map(c => c.id === editingId ? updated : c));
      } else if (activeTab === 'psychology') {
        const updated = await updatePsychologyCheck(editingId, {
          name: editName,
          description: editDescription
        });
        setPsychChecks(psychChecks.map(c => c.id === editingId ? updated : c));
      } else {
        const updated = await updateTradingRule(editingId, {
          name: editName,
          description: editDescription,
          category: ruleCategory
        });
        setRules(rules.map(r => r.id === editingId ? updated : r));
      }
      setEditingId(null);
      setEditName('');
      setEditDescription('');
    } catch (error) {
      console.error('Error saving edit:', error);
    }
  }

  function handleDelete(id: string) {
    setDeleteConfirm({ isOpen: true, id });
  }

  async function executeDelete(id: string) {
    setDeleteConfirm({ isOpen: false, id: '' });
    try {
      if (activeTab === 'confluences') {
        await deleteConfluence(id);
        setConfluences(confluences.filter(c => c.id !== id));
      } else if (activeTab === 'psychology') {
        await deletePsychologyCheck(id);
        setPsychChecks(psychChecks.filter(c => c.id !== id));
      } else {
        await deleteTradingRule(id);
        setRules(rules.filter(r => r.id !== id));
      }
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  }

  async function handleAddNew() {
    if (!newItemName.trim() || !user) return;

    try {
      if (activeTab === 'confluences') {
        const newConfluence = await createConfluence({
          name: newItemName,
          description: newItemDescription,
          enabled: true,
          order_index: confluences.length
        });
        setConfluences([...confluences, newConfluence]);
      } else if (activeTab === 'psychology') {
        const newCheck = await createPsychologyCheck({
          user_id: user.id,
          name: newItemName,
          description: newItemDescription,
          enabled: true,
          order_index: psychChecks.length
        });
        setPsychChecks([...psychChecks, newCheck]);
      } else {
        const newRule = await createTradingRule({
          user_id: user.id,
          name: newItemName,
          description: newItemDescription,
          category: ruleCategory,
          enabled: true,
          order_index: rules.length
        });
        setRules([...rules, newRule]);
      }

      setIsAddingNew(false);
      setNewItemName('');
      setNewItemDescription('');
      setRuleCategory('strategy');
    } catch (error) {
      console.error('Error adding new item:', error);
    }
  }

  const enabledCount =
    activeTab === 'confluences' ? confluences.filter(c => c.enabled).length
    : activeTab === 'psychology' ? psychChecks.filter(c => c.enabled).length
    : rules.filter(r => r.enabled).length;

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <PageLoader />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Trading Checklists</h1>
          <p className="text-gray-400">
            Your setup criteria, your rules, and the questions you ask yourself before entering
          </p>
        </div>

        <div data-tour="checklists-page">
        <div className="flex gap-2 mb-6 border-b border-white/10">
          <button
            onClick={() => setActiveTab('confluences')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'confluences'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Trading Confluences
            <span className="ml-2 text-sm">({confluences.filter(c => c.enabled).length})</span>
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'rules'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Trading Rules
            <span className="ml-2 text-sm">({rules.filter(r => r.enabled).length})</span>
          </button>
          {/*
            The psychology tab carries the icon and the glow the other two do
            not. It is the one asked before entry rather than about the setup,
            and giving it a slightly different weight is what stops it being
            read as a third list of the same kind.
          */}
          <button
            onClick={() => setActiveTab('psychology')}
            className={`px-6 py-3 font-medium transition-all flex items-center gap-2 ${
              activeTab === 'psychology'
                ? 'text-blue-300 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
            style={
              activeTab === 'psychology'
                ? { textShadow: '0 0 12px rgba(59,130,246,0.55)' }
                : undefined
            }
          >
            <Brain
              size={16}
              className={activeTab === 'psychology' ? 'text-blue-300' : ''}
              style={
                activeTab === 'psychology'
                  ? { filter: 'drop-shadow(0 0 5px rgba(59,130,246,0.8))' }
                  : undefined
              }
            />
            Pre-Trade Psychology
            <span className="text-sm">({psychChecks.filter(c => c.enabled).length})</span>
          </button>
        </div>

        <div className="mb-6">
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  {activeTab === 'confluences' ? 'Your Trading Confluences'
                    : activeTab === 'psychology' ? 'Your Pre-Trade Psychology Checklist'
                    : 'Your Trading Rules'}
                </h2>
                <button
                  onClick={() => setIsAddingNew(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add New
                </button>
              </div>

              {activeTab === 'psychology' && (
                <div
                  className="mb-5 p-5 rounded-2xl border border-blue-400/25 bg-gradient-to-br from-blue-500/[0.09] via-blue-500/[0.02] to-transparent"
                  style={{ boxShadow: 'inset 0 0 60px rgba(59,130,246,0.07), 0 0 30px rgba(59,130,246,0.06)' }}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon tile, lifted off the panel with its own glow. */}
                    <div
                      className="flex-shrink-0 w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-400/30 flex items-center justify-center"
                      style={{ boxShadow: '0 0 18px rgba(59,130,246,0.25)' }}
                    >
                      <Brain
                        className="w-5 h-5 text-blue-300"
                        style={{ filter: 'drop-shadow(0 0 6px rgba(59,130,246,0.8))' }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-white">Mental preparation checklist</h3>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                        Run these before you enter, not after. They ask about you rather than the
                        chart &mdash; whether you&rsquo;re calm, rested, and not chasing a loss.
                      </p>
                    </div>

                    {/*
                      A count, not a score. The sales mock shows a percentage,
                      but nothing here has been ticked yet - this tab defines
                      the checklist, it does not run it - so a percentage would
                      be a number with nothing behind it. This is the one real
                      figure the page has.
                    */}
                    <div
                      className="flex-shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-full border border-blue-400/35 bg-blue-500/10"
                      style={{ boxShadow: '0 0 20px rgba(59,130,246,0.18)' }}
                    >
                      <span className="text-xl font-bold text-blue-300 leading-none">{enabledCount}</span>
                      <span className="text-[9px] uppercase tracking-wider text-blue-400/70 mt-1">active</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'confluences' && (
                <div className="mb-4 p-4 bg-white/5 rounded-lg">
                  <p className="text-sm text-gray-400 mb-2">
                    Active confluences: <span className="text-white font-semibold">{enabledCount}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Confluences help you identify high-probability trade setups by checking multiple confirming factors
                  </p>
                </div>
              )}

              {isAddingNew && (
                <div className="mb-4 p-4 bg-white/5 rounded-lg border border-blue-500/30">
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="Name"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      value={newItemDescription}
                      onChange={(e) => setNewItemDescription(e.target.value)}
                      placeholder="Description"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                    {activeTab === 'rules' && (
                      <select
                        value={ruleCategory}
                        onChange={(e) => setRuleCategory(e.target.value as TradingRule['category'])}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500"
                      >
                        <option value="strategy">Strategy</option>
                        <option value="risk_management">Risk Management</option>
                        <option value="timing">Timing</option>
                        <option value="psychology">Psychology</option>
                        <option value="other">Other</option>
                      </select>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddNew}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingNew(false);
                          setNewItemName('');
                          setNewItemDescription('');
                          setRuleCategory('strategy');
                        }}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {(activeTab === 'confluences' ? confluences
                  : activeTab === 'psychology' ? psychChecks
                  : rules).map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-xl border transition-all ${
                      activeTab === 'psychology'
                        ? item.enabled
                          ? 'p-4 border-blue-400/25 bg-gradient-to-br from-blue-500/[0.06] via-transparent to-transparent hover:border-blue-400/45'
                          : 'p-4 border-white/5 bg-white/[0.02] opacity-45 hover:opacity-70'
                        : item.enabled
                          ? 'p-4 bg-white/5 border-white/10'
                          : 'p-4 bg-white/[0.02] border-white/5 opacity-50'
                    }`}
                    style={
                      activeTab === 'psychology' && item.enabled
                        ? { boxShadow: 'inset 0 0 30px rgba(59,130,246,0.05)' }
                        : undefined
                    }
                  >
                    {editingId === item.id ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500"
                        />
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500"
                        />
                        {activeTab === 'rules' && (
                          <select
                            value={ruleCategory}
                            onChange={(e) => setRuleCategory(e.target.value as TradingRule['category'])}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500"
                          >
                            <option value="strategy">Strategy</option>
                            <option value="risk_management">Risk Management</option>
                            <option value="timing">Timing</option>
                            <option value="psychology">Psychology</option>
                            <option value="other">Other</option>
                          </select>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEdit}
                            className="p-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setEditName('');
                              setEditDescription('');
                            }}
                            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() =>
                            activeTab === 'confluences' ? handleToggleConfluence(item.id)
                            : activeTab === 'psychology' ? handleTogglePsychCheck(item.id)
                            : handleToggleRule(item.id)
                          }
                          className="mt-1 flex-shrink-0"
                        >
                          {activeTab === 'psychology' ? (
                            /*
                              A square, filled checkbox rather than the outline
                              circle the other tabs use - it is the one control
                              on this page that reads as something you tick
                              before acting, and the glow marks it as active.
                            */
                            <span
                              className={`flex items-center justify-center w-5 h-5 rounded-md border-2 transition-all ${
                                item.enabled
                                  ? 'bg-blue-500 border-blue-400'
                                  : 'border-gray-600 bg-transparent'
                              }`}
                              style={
                                item.enabled
                                  ? { boxShadow: '0 0 10px rgba(59,130,246,0.55)' }
                                  : undefined
                              }
                            >
                              {item.enabled && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                            </span>
                          ) : item.enabled ? (
                            <CheckCircle2 className="w-5 h-5 text-blue-400" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-600" />
                          )}
                        </button>
                        <div className="flex-1">
                          <h3 className="font-medium mb-1">{item.name}</h3>
                          {item.description && (
                            <p className="text-sm text-gray-400">{item.description}</p>
                          )}
                          {/* Only trading rules carry a category; the typeof
                              check is what narrows it to a string now that the
                              list can also hold psychology checks. */}
                          {activeTab === 'rules' && 'category' in item && typeof item.category === 'string' && (
                            <span className="inline-block mt-2 px-2 py-1 text-xs bg-white/5 rounded">
                              {item.category.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4 text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {activeTab === 'confluences' && confluences.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No confluences yet. Add your first one to get started.
                </div>
              )}

              {activeTab === 'psychology' && psychChecks.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Brain className="w-10 h-10 mx-auto mb-3 text-blue-400/40" />
                  <p className="text-sm">No checks yet.</p>
                  <p className="text-xs mt-1">
                    Add the questions worth asking yourself before you click buy or sell.
                  </p>
                </div>
              )}

              {activeTab === 'rules' && rules.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No trading rules yet. Add your first one to get started.
                </div>
              )}
            </div>
          </Card>
        </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title={`Delete ${activeTab === 'confluences' ? 'Confluence' : 'Rule'}`}
        message="Are you sure you want to delete this item? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => executeDelete(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: '' })}
      />
    </div>
  );
}
