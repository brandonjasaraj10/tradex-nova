import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

type PresetType = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom';

const presets: { label: string; value: PresetType }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: 'last7days' },
  { label: 'Last 30 Days', value: 'last30days' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'Last Month', value: 'lastMonth' },
  { label: 'This Year', value: 'thisYear' },
  { label: 'Custom', value: 'custom' },
];

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetType>('last30days');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null);
  const [showMonthYearPicker, setShowMonthYearPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
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

  const getPresetRange = (preset: PresetType): DateRange => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (preset) {
      case 'today':
        return { startDate: today, endDate: today };
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { startDate: yesterday, endDate: yesterday };
      }
      case 'last7days': {
        const start = new Date(today);
        start.setDate(start.getDate() - 6);
        return { startDate: start, endDate: today };
      }
      case 'last30days': {
        const start = new Date(today);
        start.setDate(start.getDate() - 29);
        return { startDate: start, endDate: today };
      }
      case 'thisMonth': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { startDate: start, endDate: today };
      }
      case 'lastMonth': {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return { startDate: start, endDate: end };
      }
      case 'thisYear': {
        const start = new Date(now.getFullYear(), 0, 1);
        return { startDate: start, endDate: today };
      }
      default:
        return value;
    }
  };

  const handlePresetClick = (preset: PresetType) => {
    setActivePreset(preset);
    if (preset !== 'custom') {
      const range = getPresetRange(preset);
      onChange(range);
      setIsOpen(false);
    }
  };

  const handleDayClick = (date: Date) => {
    if (activePreset !== 'custom') {
      setActivePreset('custom');
    }

    if (selectingStart) {
      setTempStartDate(date);
      setSelectingStart(false);
    } else {
      if (tempStartDate && date >= tempStartDate) {
        onChange({ startDate: tempStartDate, endDate: date });
        setIsOpen(false);
        setSelectingStart(true);
        setTempStartDate(null);
      } else if (tempStartDate && date < tempStartDate) {
        onChange({ startDate: date, endDate: tempStartDate });
        setIsOpen(false);
        setSelectingStart(true);
        setTempStartDate(null);
      }
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const isDateInRange = (date: Date) => {
    return date >= value.startDate && date <= value.endDate;
  };

  const isDateStart = (date: Date) => {
    return date.toDateString() === value.startDate.toDateString();
  };

  const isDateEnd = (date: Date) => {
    return date.toDateString() === value.endDate.toDateString();
  };

  const formatDateRange = (range: DateRange) => {
    const start = range.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = range.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${start} - ${end}`;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentMonth);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentMonth(newDate);
  };

  const handleMonthYearSelect = (month: number, year: number) => {
    setCurrentMonth(new Date(year, month, 1));
    setShowMonthYearPicker(false);
  };

  const getYearRange = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear; i >= currentYear - 10; i--) {
      years.push(i);
    }
    return years;
  };

  const days = getDaysInMonth(currentMonth);

  return (
    <div className="relative z-30" ref={pickerRef}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-2 px-4 py-2 bg-[#111]/80 border border-white/10 rounded-lg hover:bg-white/5 transition-colors relative z-30"
      >
        <Calendar size={16} />
        <span className="text-sm whitespace-nowrap">{formatDateRange(value)}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-12 right-0 z-30 bg-[#0A0A0A] border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-max"
          >
            <div className="flex">
              <div className="w-48 border-r border-white/10 p-4">
                <h3 className="text-sm font-medium mb-3">Quick Select</h3>
                <div className="space-y-1">
                  {presets.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => handlePresetClick(preset.value)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        activePreset === preset.value
                          ? 'bg-blue-400/10 text-blue-400'
                          : 'hover:bg-white/5 text-gray-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4">
                {!showMonthYearPicker ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={() => navigateMonth('prev')}
                        className="p-1 hover:bg-white/5 rounded transition-colors"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        onClick={() => setShowMonthYearPicker(true)}
                        className="text-sm font-medium hover:bg-white/5 px-2 py-1 rounded transition-colors"
                      >
                        {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </button>
                      <button
                        onClick={() => navigateMonth('next')}
                        className="p-1 hover:bg-white/5 rounded transition-colors"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                    <div key={day} className="w-8 h-8 flex items-center justify-center text-xs text-gray-500">
                      {day}
                    </div>
                  ))}
                </div>

                    <div className="grid grid-cols-7 gap-1">
                  {days.map((day, index) => {
                    if (!day) {
                      return <div key={index} className="w-8 h-8" />;
                    }

                    const inRange = isDateInRange(day);
                    const isStart = isDateStart(day);
                    const isEnd = isDateEnd(day);
                    const isToday = day.toDateString() === new Date().toDateString();

                    return (
                      <button
                        key={index}
                        onClick={() => handleDayClick(day)}
                        className={`
                          w-8 h-8 flex items-center justify-center text-xs rounded transition-colors
                          ${inRange ? 'bg-blue-400/20' : 'hover:bg-white/5'}
                          ${isStart || isEnd ? 'bg-blue-400 text-white font-medium' : ''}
                          ${isToday && !inRange ? 'border border-blue-400' : ''}
                        `}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>

                    {selectingStart && activePreset === 'custom' && (
                      <div className="mt-4 text-xs text-gray-400 text-center">
                        Select start date
                      </div>
                    )}
                    {!selectingStart && activePreset === 'custom' && (
                      <div className="mt-4 text-xs text-gray-400 text-center">
                        Select end date
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-64">
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={() => setShowMonthYearPicker(false)}
                        className="text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        ← Back
                      </button>
                      <span className="text-sm font-medium">{currentMonth.getFullYear()}</span>
                      <div className="w-12" />
                    </div>

                    <div className="max-h-64 overflow-y-auto">
                      {getYearRange().map((year) => (
                        <div key={year} className="mb-4">
                          <div className="text-xs text-gray-500 mb-2 sticky top-0 bg-[#0A0A0A] py-1">{year}</div>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
                            ].map((month, index) => {
                              const isCurrentMonth =
                                currentMonth.getMonth() === index &&
                                currentMonth.getFullYear() === year;

                              return (
                                <button
                                  key={month}
                                  onClick={() => handleMonthYearSelect(index, year)}
                                  className={`
                                    px-3 py-2 rounded text-sm transition-colors
                                    ${
                                      isCurrentMonth
                                        ? 'bg-blue-400 text-white font-medium'
                                        : 'hover:bg-white/5 text-gray-300'
                                    }
                                  `}
                                >
                                  {month}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
