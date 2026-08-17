import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, CreditCard as Edit, Trash, Folder, Calendar, Save, X, ChevronLeft, ChevronRight, Settings, BookOpen, LineChart, Image, Tag as TagIcon, DollarSign, TrendingUp, TrendingDown, Maximize2, CheckSquare, Square, Upload, Brain, FileText, Mic, MicOff } from 'lucide-react';
import Card from '../components/shared/Card';
import Button from '../components/shared/Button';
import ConfirmModal from '../components/shared/ConfirmModal';
import MiniCalendar from '../components/journal/MiniCalendar';
import { RichTextEditor } from '../components/journal/RichTextEditor';
import { PsychologyTemplate } from '../components/journal/PsychologyTemplate';
import NovaJournalAssistant from '../components/journal/NovaJournalAssistant';
import { useDataSync } from '../lib/dataSync';
import { useAccount } from '../lib/accountContext';
import {
  getFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  getEntriesByFolder,
  getEntryByDate,
  getEntriesByDate,
  createEntry,
  updateEntry,
  deleteEntry,
  JournalFolder,
  JournalEntry,
} from '../services/journalService';
import { getTrades } from '../services/trades';
import type { Trade } from '../types/trade';
import { getUserConfluences, type Confluence } from '../services/confluences';
import { supabase } from '../lib/supabase';
import {
  getTradingRules,
  getJournalEntryConfluences,
  getJournalEntryRules,
  batchUpdateJournalEntryConfluences,
  batchUpdateJournalEntryRules,
  type TradingRule
} from '../services/tradingRules';
import { useVoice } from '../hooks/useVoice';
import { processVoiceJournalEntry, type VoiceJournalData } from '../services/voiceJournal';
import { correctTradingTerms } from '../utils/tradingVocabulary';

const DEFAULT_FOLDERS = [
  { name: 'Daily Journal', description: 'Daily trading reflections and general entries', icon: 'Calendar', color: '#3B82F6', template_type: 'default' },
  { name: 'Notes', description: 'General notes and documentation', icon: 'file-text', color: '#3B82F6', template_type: 'notes' },
];

const FOLDER_ICONS = {
  BookOpen,
  LineChart,
  Calendar,
  Folder,
  'file-text': FileText,
};

const generateDefaultTitle = (date: string, entryNumber: number) => {
  const [y, m, d] = date.split('-').map(Number);
  const formattedDate = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}-${y}`;
  return `${formattedDate} Entry ${entryNumber}`;
};

const formatLocalDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function Journal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { refreshTrigger, forceRefresh } = useDataSync();
  const { selectedAccount } = useAccount();
  const [folders, setFolders] = useState<JournalFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<JournalFolder | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const initialDate = searchParams.get('date') || formatLocalDate(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [dailyEntries, setDailyEntries] = useState<JournalEntry[]>([]);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(null);
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [editingFolder, setEditingFolder] = useState<JournalFolder | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isLoadingEntryRef = React.useRef(false);
  const currentEntryRef = React.useRef<JournalEntry | null>(null);
  const selectedFolderRef = React.useRef<JournalFolder | null>(null);
  const selectedDateRef = React.useRef<string>(formatLocalDate(new Date()));
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [dailyPnL, setDailyPnL] = useState<number>(0);

  const [folderForm, setFolderForm] = useState({
    name: '',
    description: '',
    icon: 'Folder',
    color: '#3B82F6',
    template_type: 'default',
  });

  const [entryForm, setEntryForm] = useState({
    title: generateDefaultTitle(formatLocalDate(new Date()), 1),
    content: '',
    mood: '',
    symbol: '',
    direction: '' as string,
    trade_duration: '',
    position_size: '',
    manual_pnl: '',
    tags: [] as string[],
    before_screenshots: [] as Array<{ url: string; label: string }>,
    after_screenshots: [] as Array<{ url: string; label: string }>,
    pre_market_notes: '',
    post_market_notes: '',
    template_data: {},
  });

  const [newTag, setNewTag] = useState('');
  const [beforeScreenshotUrl, setBeforeScreenshotUrl] = useState('');
  const [beforeScreenshotLabel, setBeforeScreenshotLabel] = useState('');
  const [afterScreenshotUrl, setAfterScreenshotUrl] = useState('');
  const [afterScreenshotLabel, setAfterScreenshotLabel] = useState('');
  const [expandedImage, setExpandedImage] = useState<{ url: string; label: string } | null>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState<'before' | 'after' | null>(null);
  const [showNovaAssistant, setShowNovaAssistant] = useState(false);

  const [userConfluences, setUserConfluences] = useState<Confluence[]>([]);
  const [userRules, setUserRules] = useState<TradingRule[]>([]);
  const [confluenceStatus, setConfluenceStatus] = useState<Map<string, boolean | null>>(new Map());
  const [ruleStatus, setRuleStatus] = useState<Map<string, boolean | null>>(new Map());
  const [checklistTab, setChecklistTab] = useState<'confluences' | 'rules'>('confluences');
  const [showPsychologyTemplate, setShowPsychologyTemplate] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'warning' | 'default';
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', confirmLabel: 'Confirm', variant: 'danger', onConfirm: () => {} });

  const { isListening, isSupported, transcript, startListening, stopListening } = useVoice({
    onTranscript: async (text) => {
      // Apply trading term corrections before processing
      const correctedText = correctTradingTerms(text);
      await handleVoiceTranscript(correctedText);
    }
  });

  currentEntryRef.current = currentEntry;
  selectedFolderRef.current = selectedFolder;
  selectedDateRef.current = selectedDate;

  const urlDateHandled = React.useRef(false);
  useEffect(() => {
    if (urlDateHandled.current) return;
    const urlDate = searchParams.get('date');
    if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) {
      urlDateHandled.current = true;
      setSelectedDate(urlDate);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('date');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams]);

  const loadingRef = React.useRef(false);

  useEffect(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    loadFolders().finally(() => { loadingRef.current = false; });
    loadConfluencesAndRules();
  }, [refreshTrigger]);

  const loadConfluencesAndRules = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [confluences, rules] = await Promise.all([
        getUserConfluences(),
        getTradingRules(user.id)
      ]);

      setUserConfluences(confluences.filter(c => c.enabled));
      setUserRules(rules.filter(r => r.enabled));
    } catch (error) {
      console.error('Error loading confluences and rules:', error);
    }
  };

  // Sync psychology template mood rating with entry mood field
  useEffect(() => {
    const moodRating = entryForm.template_data?.pre_trade_mindset?.mood_rating;
    if (moodRating !== undefined && moodRating !== null) {
      // Convert mood rating (1-10) to descriptive text with numeric value
      let moodText = '';
      if (moodRating <= 3) {
        moodText = `Poor (${moodRating}/10)`;
      } else if (moodRating <= 5) {
        moodText = `Below Average (${moodRating}/10)`;
      } else if (moodRating <= 7) {
        moodText = `Good (${moodRating}/10)`;
      } else {
        moodText = `Excellent (${moodRating}/10)`;
      }

      // Only update if different to avoid infinite loops
      if (entryForm.mood !== moodText) {
        setEntryForm(prev => ({ ...prev, mood: moodText }));
      }
    }
  }, [entryForm.template_data?.pre_trade_mindset?.mood_rating]);

  useEffect(() => {
    if (selectedFolder && selectedDate) {
      loadDailyEntries(selectedFolder.id, selectedDate);
      loadDailyTrades();
    }
    // Nova's assistant panel shares one ongoing conversation across the
    // whole app, not one per entry - without this, switching to a new
    // entry could show it already open with a previous entry's chat
    // still in it, which reads as Nova auto-analyzing the new one.
    setShowNovaAssistant(false);
  }, [selectedFolder, selectedDate, selectedAccount]);

  useEffect(() => {
    const handleNovaToolCall = async (event: CustomEvent) => {
      const { tool_calls } = event.detail;

      for (const toolCall of tool_calls) {
        if (toolCall.name === 'log_journal_entry') {
          console.log('Nova logged a journal entry, refreshing...');

          if (selectedFolder && selectedDate) {
            await loadDailyEntries(selectedFolder.id, selectedDate);

            const entries = await getEntriesByDate(selectedFolder.id, selectedDate);
            if (entries.length > 0) {
              const latestEntry = entries[entries.length - 1];
              setCurrentEntry(latestEntry);
              setEditingEntryId(latestEntry.id);

              if (latestEntry.template_data) {
                setEntryForm({
                  title: latestEntry.title || '',
                  content: latestEntry.content || '',
                  mood: latestEntry.mood || '',
                  tags: latestEntry.tags || [],
                  symbol: latestEntry.symbol || '',
                  trade_duration: latestEntry.trade_duration || '',
                  position_size: latestEntry.position_size || '',
                  manual_pnl: latestEntry.manual_pnl || undefined,
                  linked_entry_id: latestEntry.linked_entry_id || null,
                });
              }
            }
          }
        }
      }
    };

    window.addEventListener('nova-tool-call', handleNovaToolCall as EventListener);
    return () => {
      window.removeEventListener('nova-tool-call', handleNovaToolCall as EventListener);
    };
  }, [selectedFolder, selectedDate]);

  useEffect(() => {
    if (!currentEntry && selectedDate) {
      setEntryForm(prev => ({
        ...prev,
        title: generateDefaultTitle(selectedDate, dailyEntries.length + 1)
      }));
    }
  }, [selectedDate, dailyEntries.length, currentEntry]);

  const loadDailyTrades = async () => {
    try {
      const [sy, sm, sd] = selectedDate.split('-').map(Number);
      const startDate = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
      const endDate = new Date(sy, sm - 1, sd, 23, 59, 59, 999);

      const trades = await getTrades({
        dateRange: [startDate, endDate],
      }, selectedAccount?.id);

      setRecentTrades(trades);

      // Calculate P&L from trades
      const tradesPnL = trades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);

      // Get all journal entries for the selected date across all folders to calculate manual P&L
      const { data: allDayEntries } = await supabase
        .from('journal_entries')
        .select('manual_pnl')
        .eq('entry_date', selectedDate);

      // Calculate manual P&L from all journal entries for the day
      const manualPnL = (allDayEntries || []).reduce((sum, entry) => {
        return sum + (entry.manual_pnl || 0);
      }, 0);

      // Set total daily P&L (trades + manual entries)
      setDailyPnL(tradesPnL + manualPnL);
    } catch (error) {
      console.error('Error loading daily trades:', error);
    }
  };

  // Auto-save functionality
  const entryFormRef = React.useRef(entryForm);
  const confluenceStatusRef = React.useRef(confluenceStatus);
  const ruleStatusRef = React.useRef(ruleStatus);
  entryFormRef.current = entryForm;
  confluenceStatusRef.current = confluenceStatus;
  ruleStatusRef.current = ruleStatus;

  const hasTemplateContent = (data: any): boolean => {
    if (!data || typeof data !== 'object') return false;
    for (const key in data) {
      const value = data[key];
      if (value === null || value === undefined) continue;
      if (typeof value === 'string' && value.trim()) return true;
      if (typeof value === 'number') return true;
      if (typeof value === 'boolean') return true;
      if (Array.isArray(value) && value.length > 0) return true;
      if (typeof value === 'object' && hasTemplateContent(value)) return true;
    }
    return false;
  };

  const checkHasContent = (form: typeof entryForm) => {
    return !!(
      form.content?.trim() ||
      form.mood?.trim() ||
      form.symbol?.trim() ||
      form.trade_duration?.trim() ||
      (form.position_size?.trim() && form.position_size.trim() !== '0') ||
      (form.manual_pnl && form.manual_pnl.trim() !== '') ||
      (form.tags && form.tags.length > 0) ||
      (form.before_screenshots && form.before_screenshots.length > 0) ||
      (form.after_screenshots && form.after_screenshots.length > 0) ||
      form.pre_market_notes?.trim() ||
      form.post_market_notes?.trim() ||
      hasTemplateContent(form.template_data)
    );
  };

  const autoSaveEntry = async () => {
    const folder = selectedFolderRef.current;
    const date = selectedDateRef.current;
    const entry = currentEntryRef.current;
    const form = entryFormRef.current;
    const confStatus = confluenceStatusRef.current;
    const rlStatus = ruleStatusRef.current;

    if (!folder || !date) return;

    const hasContent = checkHasContent(form);
    if (!hasContent && !entry) return;

    setIsSaving(true);
    try {
      let entryId: string;
      let savedEntry: JournalEntry;

      const parsedManualPnl = form.manual_pnl && form.manual_pnl.trim() !== ''
        ? parseFloat(form.manual_pnl)
        : null;
      const parsedPositionSize = form.position_size && form.position_size.trim() !== ''
        ? parseFloat(form.position_size)
        : null;

      const dataToSave = {
        ...form,
        manual_pnl: parsedManualPnl,
        position_size: parsedPositionSize,
        direction: form.direction || null,
        entry_date: date
      };

      if (entry) {
        savedEntry = await updateEntry(entry.id, dataToSave);
        entryId = entry.id;
        setDailyEntries(prev => prev.map(e => e.id === savedEntry.id ? savedEntry : e));
      } else {
        savedEntry = await createEntry({
          folder_id: folder.id,
          ...dataToSave,
        });
        setCurrentEntry(savedEntry);
        currentEntryRef.current = savedEntry;
        setEditingEntryId(savedEntry.id);
        setDailyEntries(prev => [...prev, savedEntry]);
        setEntries(prev => [...prev, savedEntry]);
        entryId = savedEntry.id;
      }

      const confluenceUpdates = Array.from(confStatus.entries())
        .filter(([_, status]) => status !== null)
        .map(([id, present]) => ({
          confluence_id: id,
          checked: true,
          present: present,
          notes: ''
        }));

      const ruleUpdates = Array.from(rlStatus.entries())
        .filter(([_, status]) => status !== null)
        .map(([id, followed]) => ({
          rule_id: id,
          followed: followed!,
          notes: ''
        }));

      await Promise.all([
        confluenceUpdates.length > 0 ? batchUpdateJournalEntryConfluences(entryId, confluenceUpdates) : Promise.resolve(),
        ruleUpdates.length > 0 ? batchUpdateJournalEntryRules(entryId, ruleUpdates) : Promise.resolve()
      ]);

      loadDailyTrades();
    } catch (error) {
      console.error('Error auto-saving entry:', error);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedFolder || !selectedDate) return;
    if (isLoadingEntryRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (!isLoadingEntryRef.current) {
        autoSaveEntry();
      }
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [entryForm, confluenceStatus, ruleStatus]);

  useEffect(() => {
    if (selectedFolder) {
      loadEntries(selectedFolder.id);
    }
  }, [selectedFolder]);

  const loadFolders = async () => {
    try {
      setLoading(true);
      let data = await getFolders();

      if (data.length === 0) {
        for (let i = 0; i < DEFAULT_FOLDERS.length; i++) {
          const folder = DEFAULT_FOLDERS[i];
          try {
            await createFolder({ ...folder, order_index: i });
          } catch {
            // ignore duplicate creation from strict mode
          }
        }
        data = await getFolders();
      }

      setFolders(data);
      setSelectedFolder(prev => {
        if (prev) {
          const updated = data.find(f => f.id === prev.id);
          return updated || data[0] || null;
        }
        return data[0] || null;
      });
    } catch (error) {
      console.error('Error loading folders:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEntries = async (folderId: string) => {
    try {
      const data = await getEntriesByFolder(folderId);
      setEntries(data);
    } catch (error) {
      console.error('Error loading entries:', error);
    }
  };

  const loadDailyEntries = async (folderId: string, date: string) => {
    try {
      isLoadingEntryRef.current = true;
      const entries = await getEntriesByDate(folderId, date);
      setDailyEntries(entries);

      if (entries.length > 0) {
        const entryToEdit = entries[entries.length - 1];
        await loadEntryForEditing(entryToEdit);
      } else {
        resetEntryForm(entries);
      }
    } catch (error) {
      console.error('Error loading daily entries:', error);
    } finally {
      setTimeout(() => { isLoadingEntryRef.current = false; }, 100);
    }
  };

  const loadEntryForEditing = async (entry: JournalEntry) => {
    setCurrentEntry(entry);
    currentEntryRef.current = entry;
    setEditingEntryId(entry.id);

    setEntryForm({
      title: entry.title || '',
      content: entry.content || '',
      mood: entry.mood || '',
      symbol: entry.symbol || '',
      direction: entry.direction || '',
      trade_duration: entry.trade_duration || '',
      position_size: entry.position_size != null ? String(entry.position_size) : '',
      manual_pnl: entry.manual_pnl != null ? String(entry.manual_pnl) : '',
      tags: entry.tags || [],
      before_screenshots: entry.before_screenshots || [],
      after_screenshots: entry.after_screenshots || [],
      pre_market_notes: entry.pre_market_notes || '',
      post_market_notes: entry.post_market_notes || '',
      template_data: entry.template_data || {},
    });

    setShowPsychologyTemplate(false);

    const [confluenceData, ruleData] = await Promise.all([
      getJournalEntryConfluences(entry.id),
      getJournalEntryRules(entry.id)
    ]);

    setConfluenceStatus(new Map(
      confluenceData.map(c => [c.confluence_id, c.present])
    ));
    setRuleStatus(new Map(
      ruleData.map(r => [r.rule_id, r.followed])
    ));
  };

  const resetEntryForm = (entries?: JournalEntry[]) => {
    setCurrentEntry(null);
    currentEntryRef.current = null;
    setEditingEntryId(null);

    const entryNumber = (entries || dailyEntries).length + 1;
    const defaultTitle = generateDefaultTitle(selectedDate, entryNumber);

    setEntryForm({
      title: defaultTitle,
      content: '',
      mood: '',
      symbol: '',
      direction: '',
      trade_duration: '',
      position_size: '',
      manual_pnl: '',
      tags: [],
      before_screenshots: [],
      after_screenshots: [],
      pre_market_notes: '',
      post_market_notes: '',
      template_data: {},
    });
    setConfluenceStatus(new Map());
    setRuleStatus(new Map());
    setShowPsychologyTemplate(false);
  };

  const handleAddAnotherEntry = async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (checkHasContent(entryForm) || currentEntry) {
      await autoSaveEntry();
    }
    if (selectedFolder) {
      const freshEntries = await getEntriesByDate(selectedFolder.id, selectedDate);
      setDailyEntries(freshEntries);
      resetEntryForm(freshEntries);
    }
  };

  const handleVoiceTranscript = async (text: string) => {
    setIsProcessingVoice(true);
    try {
      const voiceData: VoiceJournalData = await processVoiceJournalEntry(text, entryForm);

      setEntryForm(prev => ({
        ...prev,
        title: voiceData.title || prev.title,
        symbol: voiceData.symbol || prev.symbol,
        direction: voiceData.direction || prev.direction,
        trade_duration: voiceData.trade_duration || prev.trade_duration,
        position_size: voiceData.position_size || prev.position_size,
        manual_pnl: voiceData.manual_pnl !== undefined ? voiceData.manual_pnl : prev.manual_pnl,
        content: voiceData.content
          ? (prev.content && prev.content.trim().length > 0
              ? `${prev.content}\n\n${voiceData.content}`
              : voiceData.content
            )
          : prev.content,
        tags: voiceData.tags && voiceData.tags.length > 0
          ? [...new Set([...prev.tags, ...voiceData.tags])]
          : prev.tags,
        pre_market_notes: voiceData.pre_market_notes
          ? (prev.pre_market_notes && prev.pre_market_notes.trim().length > 0
              ? `${prev.pre_market_notes}\n\n${voiceData.pre_market_notes}`
              : voiceData.pre_market_notes
            )
          : prev.pre_market_notes,
        post_market_notes: voiceData.post_market_notes
          ? (prev.post_market_notes && prev.post_market_notes.trim().length > 0
              ? `${prev.post_market_notes}\n\n${voiceData.post_market_notes}`
              : voiceData.post_market_notes
            )
          : prev.post_market_notes,
        template_data: voiceData.template_data ? {
          ...prev.template_data,
          ...voiceData.template_data,
          pre_trade_mindset: {
            ...(prev.template_data?.pre_trade_mindset || {}),
            ...(voiceData.template_data?.pre_trade_mindset || {})
          },
          emotional_checkin: {
            ...(prev.template_data?.emotional_checkin || {}),
            ...(voiceData.template_data?.emotional_checkin || {}),
            emotions: [
              ...(prev.template_data?.emotional_checkin?.emotions || []),
              ...(voiceData.template_data?.emotional_checkin?.emotions || [])
            ].filter((v, i, a) => a.indexOf(v) === i)
          },
          post_trade_reflection: {
            ...(prev.template_data?.post_trade_reflection || {}),
            ...(voiceData.template_data?.post_trade_reflection || {})
          },
          affirmations: [
            ...(prev.template_data?.affirmations || []),
            ...(voiceData.template_data?.affirmations || [])
          ],
          psychological_wins: [
            ...(prev.template_data?.psychological_wins || []),
            ...(voiceData.template_data?.psychological_wins || [])
          ],
          trigger_tracking: [
            ...(prev.template_data?.trigger_tracking || []),
            ...(voiceData.template_data?.trigger_tracking || [])
          ],
          stress_levels: {
            ...(prev.template_data?.stress_levels || {}),
            ...(voiceData.template_data?.stress_levels || {})
          },
          cognitive_distortions: [
            ...(prev.template_data?.cognitive_distortions || []),
            ...(voiceData.template_data?.cognitive_distortions || [])
          ].filter((v, i, a) => a.indexOf(v) === i),
          end_of_day_summary: {
            ...(prev.template_data?.end_of_day_summary || {}),
            ...(voiceData.template_data?.end_of_day_summary || {})
          },
          decision_quality_score: voiceData.template_data?.decision_quality_score || prev.template_data?.decision_quality_score
        } : prev.template_data
      }));

      if (voiceData.template_data && Object.keys(voiceData.template_data).length > 0) {
        setShowPsychologyTemplate(true);
      }
    } catch (error) {
      console.error('Error processing voice input:', error);
      setEntryForm(prev => ({
        ...prev,
        content: prev.content ? `${prev.content}\n\n${text}` : text
      }));
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleCreateFolder = async () => {
    try {
      const newFolder = await createFolder({
        ...folderForm,
        order_index: folders.length,
      });
      setFolders([...folders, newFolder]);
      setShowFolderForm(false);
      setFolderForm({ name: '', description: '', icon: 'Folder', color: '#3B82F6' });
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  const handleUpdateFolder = async () => {
    if (!editingFolder) return;
    try {
      const updated = await updateFolder(editingFolder.id, folderForm);
      setFolders(folders.map(f => f.id === updated.id ? updated : f));
      setEditingFolder(null);
      setShowFolderForm(false);
      setFolderForm({ name: '', description: '', icon: 'Folder', color: '#3B82F6' });
    } catch (error) {
      console.error('Error updating folder:', error);
    }
  };

  const handleDeleteFolder = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Folder',
      message: 'This will permanently delete this folder and all its entries. This action cannot be undone.',
      confirmLabel: 'Delete Folder',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          await deleteFolder(id);
          const newFolders = folders.filter(f => f.id !== id);
          setFolders(newFolders);
          if (selectedFolder?.id === id) {
            setSelectedFolder(newFolders[0] || null);
          }
        } catch (error) {
          console.error('Error deleting folder:', error);
        }
      },
    });
  };

  const handleDeleteEntry = () => {
    if (!currentEntry) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Entry',
      message: 'Are you sure you want to delete this entry? This action cannot be undone.',
      confirmLabel: 'Delete Entry',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          await deleteEntry(currentEntry.id);
          setEntries(entries.filter(e => e.id !== currentEntry.id));
          const updatedDailyEntries = dailyEntries.filter(e => e.id !== currentEntry.id);
          setDailyEntries(updatedDailyEntries);

          if (updatedDailyEntries.length > 0) {
            loadEntryForEditing(updatedDailyEntries[updatedDailyEntries.length - 1]);
          } else {
            resetEntryForm(updatedDailyEntries);
          }

          loadDailyTrades();
        } catch (error) {
          console.error('Error deleting entry:', error);
        }
      },
    });
  };

  const handleAddTag = () => {
    if (newTag.trim() && !entryForm.tags.includes(newTag.trim())) {
      setEntryForm({ ...entryForm, tags: [...entryForm.tags, newTag.trim()] });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEntryForm({
      ...entryForm,
      tags: entryForm.tags.filter(tag => tag !== tagToRemove),
    });
  };

  const handleAddScreenshot = (type: 'before' | 'after') => {
    if (type === 'before') {
      if (!beforeScreenshotUrl.trim()) return;
      setEntryForm({
        ...entryForm,
        before_screenshots: [
          ...entryForm.before_screenshots,
          { url: beforeScreenshotUrl.trim(), label: beforeScreenshotLabel.trim() || 'Untitled' }
        ],
      });
      setBeforeScreenshotUrl('');
      setBeforeScreenshotLabel('');
    } else {
      if (!afterScreenshotUrl.trim()) return;
      setEntryForm({
        ...entryForm,
        after_screenshots: [
          ...entryForm.after_screenshots,
          { url: afterScreenshotUrl.trim(), label: afterScreenshotLabel.trim() || 'Untitled' }
        ],
      });
      setAfterScreenshotUrl('');
      setAfterScreenshotLabel('');
    }
  };

  const handleRemoveScreenshot = (type: 'before' | 'after', index: number) => {
    if (type === 'before') {
      setEntryForm({
        ...entryForm,
        before_screenshots: entryForm.before_screenshots.filter((_, i) => i !== index),
      });
    } else {
      setEntryForm({
        ...entryForm,
        after_screenshots: entryForm.after_screenshots.filter((_, i) => i !== index),
      });
    }
  };

  const handleFileUpload = async (type: 'before' | 'after', file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    setUploadingScreenshot(type);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('journal-screenshots')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('journal-screenshots')
        .getPublicUrl(fileName);

      const label = type === 'before' ? beforeScreenshotLabel || file.name : afterScreenshotLabel || file.name;

      if (type === 'before') {
        setEntryForm({
          ...entryForm,
          before_screenshots: [
            ...entryForm.before_screenshots,
            { url: publicUrl, label }
          ],
        });
        setBeforeScreenshotLabel('');
      } else {
        setEntryForm({
          ...entryForm,
          after_screenshots: [
            ...entryForm.after_screenshots,
            { url: publicUrl, label }
          ],
        });
        setAfterScreenshotLabel('');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingScreenshot(null);
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(formatLocalDate(date));
  };

  const formatDate = (dateString: string) => {
    const [y, m, d] = dateString.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const openFolderForm = (folder?: JournalFolder) => {
    if (folder) {
      setEditingFolder(folder);
      setFolderForm({
        name: folder.name,
        description: folder.description || '',
        icon: folder.icon || 'Folder',
        color: folder.color,
        template_type: folder.template_type || 'default',
      });
    } else {
      setEditingFolder(null);
      setFolderForm({ name: '', description: '', icon: 'Folder', color: '#3B82F6', template_type: 'default' });
    }
    setShowFolderForm(true);
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading journal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>
        <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 pt-6" data-tour="journal-header">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Journal</h1>
            <p className="text-sm sm:text-base text-gray-400 mt-1">Organize your thoughts and trades</p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 mb-6">
          <motion.div variants={fadeInUp} className="lg:col-span-4">
            <div data-tour="journal-folders">
              <Card variant="default" className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium">Folders</h2>
                </div>
                <div className="space-y-2">
                  {folders.map((folder) => {
                    const IconComponent = FOLDER_ICONS[folder.icon as keyof typeof FOLDER_ICONS] || Folder;
                    return (
                      <div
                        key={folder.id}
                        onClick={() => setSelectedFolder(folder)}
                        className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedFolder?.id === folder.id
                            ? 'bg-blue-400/10 border border-blue-400/20'
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${folder.color}20` }}
                          >
                            <IconComponent size={20} style={{ color: folder.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium truncate">{folder.name}</h3>
                            {folder.description && (
                              <p className="text-xs text-gray-400 truncate">{folder.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            <Card variant="default" className="p-4 mt-4">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Calendar size={18} />
                Calendar
              </h2>
              <MiniCalendar selectedDate={selectedDate} onDateSelect={setSelectedDate} />
            </Card>

            <Card variant="default" className="p-4 mt-4">
              <h2 className="text-lg font-medium mb-4">Recent Entries</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {entries.slice(0, 10).map((entry) => (
                  <div
                    key={entry.id}
                    onClick={() => setSelectedDate(entry.entry_date)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      entry.entry_date === selectedDate
                        ? 'bg-blue-400/10 border border-blue-400/20'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-400">
                        {new Date(entry.entry_date + 'T00:00:00').toLocaleDateString()}
                      </div>
                      {entry.symbol && (
                        <span className="text-xs text-blue-400 font-medium">{entry.symbol}</span>
                      )}
                    </div>
                    {entry.title && (
                      <div className="text-sm font-medium mt-1 truncate">{entry.title}</div>
                    )}
                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">{entry.content?.replace(/<[^>]*>/g, '')}</div>
                  </div>
                ))}
                {entries.length === 0 && (
                  <div className="text-center text-gray-400 text-sm py-8">
                    No entries yet
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          <motion.div variants={fadeInUp} className="lg:col-span-8" data-tour="journal-editor">
            <Card variant="default" className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => navigateDate('prev')}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setShowDatePicker(!showDatePicker)}
                      className="text-left hover:text-blue-400 transition-colors"
                    >
                      <h2 className="text-xl font-medium">{formatDate(selectedDate)}</h2>
                      {selectedFolder && (
                        <p className="text-sm text-gray-400">{selectedFolder.name}</p>
                      )}
                    </button>
                    {showDatePicker && (
                      <div className="absolute top-full left-0 mt-2 z-50">
                        <div
                          className="fixed inset-0"
                          onClick={() => setShowDatePicker(false)}
                        />
                        <div className="relative bg-[#0A0A0A] border border-blue-400/20 rounded-lg p-3 shadow-2xl backdrop-blur-sm">
                          <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => {
                              setSelectedDate(e.target.value);
                              setShowDatePicker(false);
                            }}
                            className="bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-400/50 transition-colors [color-scheme:dark]"
                            style={{
                              colorScheme: 'dark'
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => navigateDate('next')}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  {isSaving && (
                    <span className="text-xs text-gray-400">Saving...</span>
                  )}
                  {isProcessingVoice && (
                    <span className="text-xs text-blue-400 animate-pulse">Processing voice...</span>
                  )}
                  {isSupported && (
                    <button
                      onClick={toggleVoiceInput}
                      disabled={isProcessingVoice}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                        isListening
                          ? 'bg-gray-500/20 text-gray-300 border border-gray-400/40 animate-pulse'
                          : 'bg-blue-400/10 text-blue-400 border border-blue-400/20 hover:bg-blue-400/20'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      title="Voice journal entry"
                      data-tour="journal-voice-input"
                    >
                      {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                      <span className="text-sm">
                        {isListening ? 'Stop Recording' : 'Voice Input'}
                      </span>
                    </button>
                  )}
                  {selectedFolder?.template_type !== 'notes' && (
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${dailyPnL >= 0 ? 'bg-blue-500/10' : 'bg-gray-500/10'}`}>
                      {dailyPnL >= 0 ? <TrendingUp size={18} className="text-blue-400" /> : <TrendingDown size={18} className="text-gray-400" />}
                      <span className={`text-sm font-medium ${dailyPnL >= 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                        ${dailyPnL >= 0 ? '+' : ''}{dailyPnL.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {currentEntry && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash size={16} />}
                      onClick={handleDeleteEntry}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>

              {dailyEntries.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-400">
                      {dailyEntries.length} {dailyEntries.length === 1 ? 'Entry' : 'Entries'} for this day
                    </h3>
                    <button
                      onClick={handleAddAnotherEntry}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-400/10 hover:bg-blue-400/20 text-blue-400 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Plus size={16} />
                      Add Another Entry
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {dailyEntries.map((entry, index) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => loadEntryForEditing(entry)}
                        className={`p-4 rounded-lg border transition-all cursor-pointer ${
                          editingEntryId === entry.id
                            ? 'border-blue-400 bg-blue-400/5'
                            : 'border-white/10 hover:border-white/20 bg-white/5'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {editingEntryId === entry.id && entryForm.title ? (
                                <h4 className="font-medium text-white truncate">{entryForm.title}</h4>
                              ) : entry.title ? (
                                <h4 className="font-medium text-white truncate">{entry.title}</h4>
                              ) : (
                                <h4 className="font-medium text-gray-400 truncate">Untitled Entry</h4>
                              )}
                              {selectedFolder?.template_type !== 'notes' && (editingEntryId === entry.id ? entryForm.symbol : entry.symbol) && (
                                <span className="px-2 py-0.5 bg-blue-400/10 text-blue-400 text-xs rounded">
                                  {editingEntryId === entry.id ? entryForm.symbol : entry.symbol}
                                </span>
                              )}
                              {selectedFolder?.template_type !== 'notes' && (editingEntryId === entry.id ? entryForm.mood : entry.mood) && (
                                <span className="px-2 py-0.5 bg-blue-400/10 text-blue-400 text-xs rounded" title="Mood">
                                  {editingEntryId === entry.id ? entryForm.mood : entry.mood}
                                </span>
                              )}
                            </div>
                            {selectedFolder?.template_type !== 'notes' && ((editingEntryId === entry.id && entryForm.manual_pnl) || entry.manual_pnl) && (
                              <div className={`text-sm font-medium ${parseFloat((editingEntryId === entry.id ? entryForm.manual_pnl : entry.manual_pnl?.toString()) || '0') >= 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                                {parseFloat((editingEntryId === entry.id ? entryForm.manual_pnl : entry.manual_pnl?.toString()) || '0') >= 0 ? '+' : ''}${parseFloat((editingEntryId === entry.id ? entryForm.manual_pnl : entry.manual_pnl?.toString()) || '0').toFixed(2)}
                              </div>
                            )}
                            {((editingEntryId === entry.id ? entryForm.content : entry.content) && (editingEntryId === entry.id ? entryForm.content : entry.content).length > 0) && (
                              <p className="text-sm text-gray-400 mt-1 line-clamp-2">{(editingEntryId === entry.id ? entryForm.content : entry.content).replace(/<[^>]*>/g, '').substring(0, 100)}...</p>
                            )}
                          </div>
                          {editingEntryId === entry.id && (
                            <div className="flex-shrink-0">
                              <span className="px-2 py-1 bg-blue-400/20 text-blue-400 text-xs rounded-full font-medium">Editing</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {dailyEntries.length === 0 && (
                <div className="mb-6">
                  <button
                    onClick={handleAddAnotherEntry}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-400/10 hover:bg-blue-400/20 text-blue-400 rounded-lg text-sm font-medium transition-colors border border-blue-400/20"
                  >
                    <Plus size={18} />
                    Create Your First Entry for This Day
                  </button>
                </div>
              )}

              {selectedFolder?.template_type === 'notes' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                    <input
                      type="text"
                      value={entryForm.title}
                      onChange={(e) => setEntryForm({ ...entryForm, title: e.target.value })}
                      placeholder="Entry title (optional)"
                      className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors"
                    />
                  </div>

                  <div>
                    <RichTextEditor
                      label="Content"
                      content={entryForm.content}
                      onChange={(content) => setEntryForm({ ...entryForm, content })}
                      placeholder="Start writing your notes..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                      <input
                        type="text"
                        value={entryForm.title}
                        onChange={(e) => setEntryForm({ ...entryForm, title: e.target.value })}
                        placeholder="Entry title (optional)"
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                        <DollarSign size={16} />
                        Profit/Loss
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={entryForm.manual_pnl}
                          onChange={(e) => setEntryForm({ ...entryForm, manual_pnl: e.target.value })}
                          placeholder="Enter your P&L"
                          className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors"
                        />
                        {entryForm.manual_pnl && (
                          <div className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 ${parseFloat(entryForm.manual_pnl) >= 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                            {parseFloat(entryForm.manual_pnl) >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                            <span className="text-xs font-medium">
                              {parseFloat(entryForm.manual_pnl) >= 0 ? '+' : ''}{parseFloat(entryForm.manual_pnl).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Position Size</label>
                      <input
                        type="text"
                        value={entryForm.position_size}
                        onChange={(e) => setEntryForm({ ...entryForm, position_size: e.target.value })}
                        placeholder="e.g., 1 lot, 100 shares"
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors"
                      />
                    </div>
                  </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Symbol/Pair</label>
                    <input
                      type="text"
                      value={entryForm.symbol}
                      onChange={(e) => setEntryForm({ ...entryForm, symbol: e.target.value.toUpperCase() })}
                      placeholder="e.g., AAPL, EUR/USD"
                      className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Direction</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEntryForm({ ...entryForm, direction: entryForm.direction === 'LONG' ? '' : 'LONG' })}
                        className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all border ${
                          entryForm.direction === 'LONG'
                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                            : 'bg-[#0A0A0A] text-gray-400 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <TrendingUp size={14} />
                        Long
                      </button>
                      <button
                        type="button"
                        onClick={() => setEntryForm({ ...entryForm, direction: entryForm.direction === 'SHORT' ? '' : 'SHORT' })}
                        className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all border ${
                          entryForm.direction === 'SHORT'
                            ? 'bg-gray-500/20 text-gray-300 border-gray-500/40'
                            : 'bg-[#0A0A0A] text-gray-400 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <TrendingDown size={14} />
                        Short
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Trade Duration</label>
                    <input
                      type="text"
                      value={entryForm.trade_duration}
                      onChange={(e) => setEntryForm({ ...entryForm, trade_duration: e.target.value })}
                      placeholder="e.g., 30 minutes"
                      className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Psychology</label>
                    <button
                      type="button"
                      onClick={() => setShowPsychologyTemplate(!showPsychologyTemplate)}
                      className={`w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm transition-colors border h-[42px] ${
                        showPsychologyTemplate
                          ? 'bg-blue-400/20 text-blue-400 border-blue-400/40'
                          : 'bg-blue-400/10 text-blue-400 hover:bg-blue-400/20 border-blue-400/20'
                      }`}
                    >
                      <Brain size={16} />
                      {showPsychologyTemplate ? 'Hide Psychology Journal' : 'Add Psychology Journal'}
                    </button>
                  </div>
                </div>

                {showPsychologyTemplate && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border border-blue-400/20 rounded-lg p-6 bg-blue-400/5"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Brain className="text-blue-400" size={20} />
                      <h3 className="text-lg font-semibold text-white">Trading Psychology Journal</h3>
                    </div>
                    <PsychologyTemplate
                      data={entryForm.template_data}
                      onChange={(data) => setEntryForm({ ...entryForm, template_data: data })}
                    />
                  </motion.div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <TagIcon size={16} />
                    Tags
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      placeholder="Add a tag..."
                      className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 transition-colors"
                    />
                    <button
                      onClick={handleAddTag}
                      className="flex-shrink-0 px-4 py-2.5 bg-blue-400/10 hover:bg-blue-400/20 text-blue-400 rounded-lg text-sm font-medium transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  {entryForm.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {entryForm.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-400/10 text-blue-400 rounded-full text-xs font-medium"
                        >
                          {tag}
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:text-red-400 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <RichTextEditor
                    label="Main Content"
                    content={entryForm.content}
                    onChange={(content) => setEntryForm({ ...entryForm, content })}
                    placeholder="Write your thoughts here..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                      <Image size={16} />
                      Before Screenshots
                    </label>
                    <div className="space-y-2 mb-3">
                      <input
                        type="text"
                        placeholder="Screenshot URL"
                        value={beforeScreenshotUrl}
                        onChange={(e) => setBeforeScreenshotUrl(e.target.value)}
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400/50"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Label (optional)"
                          value={beforeScreenshotLabel}
                          onChange={(e) => setBeforeScreenshotLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddScreenshot('before');
                            }
                          }}
                          className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400/50"
                        />
                        <button
                          onClick={() => handleAddScreenshot('before')}
                          disabled={!beforeScreenshotUrl.trim()}
                          className="flex-shrink-0 px-4 py-2 bg-blue-400/10 hover:bg-blue-400/20 text-blue-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Add URL
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload('before', file);
                            e.target.value = '';
                          }}
                          className="hidden"
                          id="before-file-upload"
                        />
                        <label
                          htmlFor="before-file-upload"
                          className={`flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-400/10 hover:bg-blue-400/20 text-blue-400 rounded-lg text-sm font-medium transition-colors cursor-pointer ${uploadingScreenshot === 'before' ? 'opacity-50 cursor-wait' : ''}`}
                        >
                          <Upload size={16} />
                          {uploadingScreenshot === 'before' ? 'Uploading...' : 'Upload Image'}
                        </label>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {entryForm.before_screenshots.map((screenshot, index) => (
                        <div key={index} className="relative group cursor-pointer" onClick={() => setExpandedImage(screenshot)}>
                          <img
                            src={screenshot.url}
                            alt={screenshot.label}
                            className="w-full h-32 object-cover rounded-lg border border-white/10"
                            onError={(e) => {
                              e.currentTarget.src = 'https://via.placeholder.com/400x200?text=Invalid+Image';
                            }}
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 rounded-b-lg">
                            <p className="text-xs text-white font-medium truncate">{screenshot.label}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedImage(screenshot);
                            }}
                            className="absolute top-2 left-2 p-1.5 bg-blue-500/80 hover:bg-blue-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Maximize2 size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveScreenshot('before', index);
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-gray-500/80 hover:bg-gray-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      ))}
                      {entryForm.before_screenshots.length === 0 && (
                        <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-white/10 rounded-lg">
                          No screenshots added
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                      <Image size={16} />
                      After Screenshots
                    </label>
                    <div className="space-y-2 mb-3">
                      <input
                        type="text"
                        placeholder="Screenshot URL"
                        value={afterScreenshotUrl}
                        onChange={(e) => setAfterScreenshotUrl(e.target.value)}
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400/50"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Label (optional)"
                          value={afterScreenshotLabel}
                          onChange={(e) => setAfterScreenshotLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddScreenshot('after');
                            }
                          }}
                          className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400/50"
                        />
                        <button
                          onClick={() => handleAddScreenshot('after')}
                          disabled={!afterScreenshotUrl.trim()}
                          className="flex-shrink-0 px-4 py-2 bg-blue-400/10 hover:bg-blue-400/20 text-blue-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Add URL
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload('after', file);
                            e.target.value = '';
                          }}
                          className="hidden"
                          id="after-file-upload"
                        />
                        <label
                          htmlFor="after-file-upload"
                          className={`flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-400/10 hover:bg-blue-400/20 text-blue-400 rounded-lg text-sm font-medium transition-colors cursor-pointer ${uploadingScreenshot === 'after' ? 'opacity-50 cursor-wait' : ''}`}
                        >
                          <Upload size={16} />
                          {uploadingScreenshot === 'after' ? 'Uploading...' : 'Upload Image'}
                        </label>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {entryForm.after_screenshots.map((screenshot, index) => (
                        <div key={index} className="relative group cursor-pointer" onClick={() => setExpandedImage(screenshot)}>
                          <img
                            src={screenshot.url}
                            alt={screenshot.label}
                            className="w-full h-32 object-cover rounded-lg border border-white/10"
                            onError={(e) => {
                              e.currentTarget.src = 'https://via.placeholder.com/400x200?text=Invalid+Image';
                            }}
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 rounded-b-lg">
                            <p className="text-xs text-white font-medium truncate">{screenshot.label}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedImage(screenshot);
                            }}
                            className="absolute top-2 left-2 p-1.5 bg-blue-500/80 hover:bg-blue-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Maximize2 size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveScreenshot('after', index);
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-gray-500/80 hover:bg-gray-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      ))}
                      {entryForm.after_screenshots.length === 0 && (
                        <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-white/10 rounded-lg">
                          No screenshots added
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {!showNovaAssistant && (
                  <button
                    type="button"
                    onClick={() => setShowNovaAssistant(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-400/10 hover:bg-blue-400/20 text-blue-400 rounded-xl text-sm font-medium transition-colors border border-blue-400/20"
                  >
                    <Brain size={16} />
                    Ask Nova About This Entry
                  </button>
                )}

                {showNovaAssistant && (
                  <div>
                    <NovaJournalAssistant
                      currentDate={selectedDate}
                      beforeScreenshots={entryForm.before_screenshots}
                      afterScreenshots={entryForm.after_screenshots}
                      isPsychologyMode={selectedFolder?.template_type === 'psychology'}
                      onExtractContent={(data) => {
                        setEntryForm(prev => ({
                          ...prev,
                          ...data,
                          content: data.content || prev.content,
                        }));
                      }}
                      onExtractPsychology={(data) => {
                        setEntryForm(prev => ({
                          ...prev,
                          template_data: {
                            ...prev.template_data,
                            ...data
                          }
                        }));
                      }}
                    />
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                    <CheckSquare size={16} />
                    Trading Rules & Confluences
                  </h3>
                  <div className="flex gap-2 mb-4 border-b border-white/10">
                    <button
                      onClick={() => setChecklistTab('confluences')}
                      className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                        checklistTab === 'confluences'
                          ? 'border-blue-400 text-blue-400'
                          : 'border-transparent text-gray-400 hover:text-white'
                      }`}
                    >
                      Confluences
                      {userConfluences.length > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-white/10 rounded">
                          {userConfluences.length}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setChecklistTab('rules')}
                      className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                        checklistTab === 'rules'
                          ? 'border-blue-400 text-blue-400'
                          : 'border-transparent text-gray-400 hover:text-white'
                      }`}
                    >
                      Rules
                      {userRules.length > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-white/10 rounded">
                          {userRules.length}
                        </span>
                      )}
                    </button>
                  </div>

                  {checklistTab === 'confluences' && (
                    <div>
                      {userConfluences.length > 0 ? (
                        <>
                          <p className="text-xs text-gray-400 mb-3">
                            Mark each confluence (blue = present, grey = absent)
                          </p>
                          <div className="space-y-2">
                            {userConfluences.map((confluence) => (
                              <button
                                key={confluence.id}
                                onClick={() => {
                                  const newMap = new Map(confluenceStatus);
                                  const currentValue = newMap.get(confluence.id);
                                  if (currentValue === undefined || currentValue === null) {
                                    newMap.set(confluence.id, true);
                                  } else if (currentValue === true) {
                                    newMap.set(confluence.id, false);
                                  } else {
                                    newMap.set(confluence.id, null);
                                  }
                                  setConfluenceStatus(newMap);
                                }}
                                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors text-left w-full ${
                                  confluenceStatus.get(confluence.id) === true
                                    ? 'border-blue-400 bg-blue-400/10'
                                    : confluenceStatus.get(confluence.id) === false
                                    ? 'border-gray-400 bg-gray-400/10'
                                    : 'border-white/10 hover:border-white/20'
                                }`}
                              >
                                <div className="flex-shrink-0">
                                  {confluenceStatus.get(confluence.id) === true ? (
                                    <CheckSquare size={18} className="text-blue-400" />
                                  ) : confluenceStatus.get(confluence.id) === false ? (
                                    <X size={18} className="text-gray-400" />
                                  ) : (
                                    <Square size={18} className="text-gray-400" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white">{confluence.name}</p>
                                  {confluence.description && (
                                    <p className="text-xs text-gray-400 mt-0.5">{confluence.description}</p>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-400">Present:</span>
                              <span className="text-blue-400 font-medium">
                                {Array.from(confluenceStatus.values()).filter(v => v === true).length} / {userConfluences.length}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm mt-1">
                              <span className="text-gray-400">Absent:</span>
                              <span className="text-gray-400 font-medium">
                                {Array.from(confluenceStatus.values()).filter(v => v === false).length} / {userConfluences.length}
                              </span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-6 text-gray-400 text-sm bg-white/5 rounded-lg">
                          <p className="mb-2">No confluences set up yet.</p>
                          <p className="text-xs">Visit Settings to create your trading confluences.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {checklistTab === 'rules' && (
                    <div>
                      {userRules.length > 0 ? (
                        <>
                          <p className="text-xs text-gray-400 mb-3">
                            Mark each rule (blue = followed, grey = not followed)
                          </p>
                          <div className="space-y-2">
                            {userRules.map((rule) => (
                              <button
                                key={rule.id}
                                onClick={() => {
                                  const newMap = new Map(ruleStatus);
                                  const currentValue = newMap.get(rule.id);
                                  if (currentValue === undefined || currentValue === null) {
                                    newMap.set(rule.id, true);
                                  } else if (currentValue === true) {
                                    newMap.set(rule.id, false);
                                  } else {
                                    newMap.set(rule.id, null);
                                  }
                                  setRuleStatus(newMap);
                                }}
                                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors text-left w-full ${
                                  ruleStatus.get(rule.id) === true
                                    ? 'border-blue-400 bg-blue-400/10'
                                    : ruleStatus.get(rule.id) === false
                                    ? 'border-gray-400 bg-gray-400/10'
                                    : 'border-white/10 hover:border-white/20'
                                }`}
                              >
                                <div className="flex-shrink-0">
                                  {ruleStatus.get(rule.id) === true ? (
                                    <CheckSquare size={18} className="text-blue-400" />
                                  ) : ruleStatus.get(rule.id) === false ? (
                                    <X size={18} className="text-gray-400" />
                                  ) : (
                                    <Square size={18} className="text-gray-400" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white">{rule.name}</p>
                                  {rule.description && (
                                    <p className="text-xs text-gray-400 mt-0.5">{rule.description}</p>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-400">Followed:</span>
                              <span className="text-blue-400 font-medium">
                                {Array.from(ruleStatus.values()).filter(v => v === true).length} / {userRules.length}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm mt-1">
                              <span className="text-gray-400">Not Followed:</span>
                              <span className="text-gray-400 font-medium">
                                {Array.from(ruleStatus.values()).filter(v => v === false).length} / {userRules.length}
                              </span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-6 text-gray-400 text-sm bg-white/5 rounded-lg">
                          <p className="mb-2">No rules set up yet.</p>
                          <p className="text-xs">Visit Settings to create your trading rules.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              )}

              {recentTrades.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                    <LineChart size={16} />
                    Today's Trades ({recentTrades.length})
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {recentTrades.map((trade) => (
                      <div
                        key={trade.id}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${trade.direction === 'LONG' ? 'bg-green-400' : 'bg-red-400'}`} />
                          <div>
                            <p className="text-sm font-medium">{trade.symbol}</p>
                            <p className="text-xs text-gray-400">{trade.setup || 'No setup'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${(trade.pnl || 0) >= 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                            ${(trade.pnl || 0) >= 0 ? '+' : ''}{(trade.pnl || 0).toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-400">{trade.quantity} shares</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        </div>

      </motion.div>

      <AnimatePresence>
        {showFolderForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowFolderForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-xl font-semibold mb-6">
                {editingFolder ? 'Edit Folder' : 'Create Folder'}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Folder Name</label>
                  <input
                    type="text"
                    value={folderForm.name}
                    onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
                    className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400/50"
                    placeholder="Enter folder name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                  <textarea
                    value={folderForm.description}
                    onChange={(e) => setFolderForm({ ...folderForm, description: e.target.value })}
                    className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400/50 resize-none"
                    rows={3}
                    placeholder="Enter folder description"
                  />
                </div>
                <div className="flex gap-3 justify-end pt-4">
                  <Button
                    variant="ghost"
                    onClick={() => setShowFolderForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={editingFolder ? handleUpdateFolder : handleCreateFolder}
                  >
                    {editingFolder ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {expandedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setExpandedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-6xl max-h-[90vh] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setExpandedImage(null)}
                className="absolute -top-12 right-0 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
              <img
                src={expandedImage.url}
                alt={expandedImage.label}
                className="w-full h-full object-contain rounded-lg"
                onError={(e) => {
                  e.currentTarget.src = 'https://via.placeholder.com/800x600?text=Invalid+Image';
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 rounded-b-lg">
                <p className="text-lg text-white font-medium">{expandedImage.label}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
