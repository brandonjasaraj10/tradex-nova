import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MiniCalendarProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
}

const parseLocalDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const formatLocalDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function MiniCalendar({ selectedDate, onDateSelect }: MiniCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => parseLocalDate(selectedDate));

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek };
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth);
  const totalDays = daysInMonth + startingDayOfWeek;
  const rows = Math.ceil(totalDays / 7);

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleDateClick = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    onDateSelect(formatLocalDate(date));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const isSelectedDate = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return formatLocalDate(date) === selectedDate;
  };

  const isToday = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  return (
    <div className="bg-[#0A0A0A] border border-white/10 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <h3 className="text-sm font-medium">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        <button
          onClick={handleNextMonth}
          className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map(day => (
          <div key={day} className="text-center text-xs text-gray-400 font-medium py-1">
            {day}
          </div>
        ))}
      </div>

      <div
        className="grid grid-cols-7 gap-1"
        style={{
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          height: `${rows * 2.5}rem`
        }}
      >
        {Array.from({ length: startingDayOfWeek }).map((_, index) => (
          <div key={`empty-${index}`} className="w-full h-full" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, index) => {
          const day = index + 1;
          return (
            <button
              key={day}
              onClick={() => handleDateClick(day)}
              className={`
                w-full h-full flex items-center justify-center text-sm rounded-lg transition-colors
                ${isSelectedDate(day)
                  ? 'bg-blue-400 text-white font-medium'
                  : isToday(day)
                  ? 'bg-white/5 text-white font-medium ring-1 ring-blue-400/50'
                  : 'hover:bg-white/5 text-gray-300'
                }
              `}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
