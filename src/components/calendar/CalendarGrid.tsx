import { useMemo, useState, useRef, useCallback } from 'react';
import { Clock, MapPin, Calendar as CalendarIcon } from 'lucide-react';
import type { CalendarEvent, CalendarViewType } from '../../types/domain';

interface Props {
  view: CalendarViewType;
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick?: (start: Date, end: Date) => void;
  onEventDrop?: (eventId: string, newStart: Date, newEnd: Date) => void;
  onEventResize?: (eventId: string, newEnd: Date) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getMonthGrid(date: Date): Date[] {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const startDay = firstOfMonth.getDay();
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - startDay);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });
}

function getWeekDays(date: Date): Date[] {
  const dayOfWeek = date.getDay();
  const start = new Date(date);
  start.setDate(date.getDate() - dayOfWeek);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isDateInRange(date: Date, start: Date, end: Date): boolean {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const s = new Date(start);
  s.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(23, 59, 59, 999);
  return d >= s && d <= e;
}

function getEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter((e) => {
    const eStart = new Date(e.start_time);
    const eEnd = new Date(e.end_time);
    return isDateInRange(day, eStart, eEnd);
  });
}

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

function formatEventTime(dt: string, allDay: boolean): string {
  if (allDay) return 'All day';
  return new Date(dt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const EVENT_COLORS = [
  'bg-primary-600/20 border-primary-500/40 text-primary-200',
  'bg-accent-600/20 border-accent-500/40 text-accent-200',
  'bg-success-600/20 border-success-500/40 text-success-200',
  'bg-warning-600/20 border-warning-500/40 text-warning-200',
  'bg-error-600/20 border-error-500/40 text-error-200',
];

function getEventColor(event: CalendarEvent, index: number): string {
  const hash = event.id.charCodeAt(0) + event.id.charCodeAt(1) + (event.id.charCodeAt(2) ?? 0);
  return EVENT_COLORS[hash % EVENT_COLORS.length] ?? EVENT_COLORS[index % EVENT_COLORS.length];
}

function getEventColorBg(event: CalendarEvent): string {
  return getEventColor(event, 0).split(' ')[0];
}

export function CalendarGrid({ view, currentDate, events, onEventClick, onSlotClick, onEventDrop, onEventResize }: Props) {
  if (view === 'month') return <MonthView currentDate={currentDate} events={events} onEventClick={onEventClick} onSlotClick={onSlotClick} />;
  if (view === 'week') return <WeekView currentDate={currentDate} events={events} onEventClick={onEventClick} onSlotClick={onSlotClick} onEventDrop={onEventDrop} />;
  if (view === 'day') return <DayView currentDate={currentDate} events={events} onEventClick={onEventClick} onSlotClick={onSlotClick} onEventDrop={onEventDrop} />;
  return <AgendaView currentDate={currentDate} events={events} onEventClick={onEventClick} />;
}

function MonthView({ currentDate, events, onEventClick, onSlotClick }: Omit<Props, 'view' | 'onEventDrop' | 'onEventResize'>) {
  const grid = useMemo(() => getMonthGrid(currentDate), [currentDate]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="rounded-xl border border-surface-400/40 bg-surface-100 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-surface-400/30">
        {WEEKDAYS.map((day) => (
          <div key={day} className="px-2 py-2 text-center text-xs font-medium text-gray-500">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((day, i) => {
          const dayEvents = getEventsForDay(events, day);
          const isToday = isSameDay(day, today);
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          return (
            <div
              key={i}
              className={`min-h-[80px] sm:min-h-[100px] border-b border-r border-surface-400/20 p-1 cursor-pointer hover:bg-surface-200/30 transition-colors ${!isCurrentMonth ? 'opacity-40' : ''}`}
              onClick={() => onSlotClick?.(day, new Date(day.getTime() + 3600000))}
            >
              <div className={`text-xs font-medium mb-1 ${isToday ? 'bg-primary-600 text-white rounded-full w-6 h-6 flex items-center justify-center' : 'text-gray-400'}`}>
                {day.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((event, idx) => (
                  <button
                    key={event.id + event.start_time}
                    onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                    className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded border truncate ${getEventColor(event, idx)}`}
                  >
                    {event.all_day ? '' : formatEventTime(event.start_time, false) + ' '}
                    {event.title}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-gray-500 px-1.5">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ currentDate, events, onEventClick, onSlotClick, onEventDrop }: Omit<Props, 'view' | 'onEventResize'>) {
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const allDayEvents = events.filter((e) => e.all_day);
  const timedEvents = events.filter((e) => !e.all_day);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);

  const handleDragStart = useCallback((event: CalendarEvent) => {
    setDraggedEvent(event);
  }, []);

  const handleDrop = useCallback((day: Date, hour: number) => {
    if (!draggedEvent || !onEventDrop) return;
    const originalDuration = new Date(draggedEvent.end_time).getTime() - new Date(draggedEvent.start_time).getTime();
    const newStart = new Date(day);
    newStart.setHours(hour, 0, 0, 0);
    const newEnd = new Date(newStart.getTime() + originalDuration);
    onEventDrop(draggedEvent.id, newStart, newEnd);
    setDraggedEvent(null);
  }, [draggedEvent, onEventDrop]);

  return (
    <div className="rounded-xl border border-surface-400/40 bg-surface-100 overflow-hidden">
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-surface-400/30">
        <div></div>
        {weekDays.map((day) => (
          <div key={day.toISOString()} className="px-1 py-2 text-center">
            <div className="text-xs text-gray-500">{WEEKDAYS[day.getDay()]}</div>
            <div className={`text-sm font-medium ${isSameDay(day, today) ? 'bg-primary-600 text-white rounded-full w-7 h-7 flex items-center justify-center mx-auto' : 'text-gray-300'}`}>
              {day.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* All-day events row */}
      {allDayEvents.length > 0 && (
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-surface-400/20">
          <div className="text-[10px] text-gray-600 text-right pr-2 pt-1">All day</div>
          {weekDays.map((day) => {
            const dayAllDayEvents = allDayEvents.filter((e) => isDateInRange(day, new Date(e.start_time), new Date(e.end_time)));
            return (
              <div key={day.toISOString()} className="border-r border-surface-400/10 p-0.5 min-h-[28px]">
                {dayAllDayEvents.map((event, idx) => (
                  <button
                    key={event.id + event.start_time}
                    onClick={() => onEventClick(event)}
                    className={`block w-full text-left text-[10px] px-1 py-0.5 rounded border truncate ${getEventColor(event, idx)}`}
                  >
                    {event.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Hourly grid */}
      <div ref={scrollRef} className="grid grid-cols-[60px_repeat(7,1fr)] max-h-[600px] overflow-y-auto">
        {HOURS.map((hour) => (
          <div key={hour} className="contents">
            <div className="text-[10px] text-gray-600 text-right pr-2 pt-1 border-b border-surface-400/10">{formatHour(hour)}</div>
            {weekDays.map((day) => {
              const slotStart = new Date(day);
              slotStart.setHours(hour, 0, 0, 0);
              const slotEnd = new Date(day);
              slotEnd.setHours(hour + 1, 0, 0, 0);
              const slotEvents = timedEvents.filter((e) => {
                const eStart = new Date(e.start_time);
                const eEnd = new Date(e.end_time);
                return eStart < slotEnd && eEnd > slotStart;
              });
              return (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  className="border-b border-r border-surface-400/10 min-h-[40px] p-0.5 cursor-pointer hover:bg-surface-200/30 transition-colors"
                  onClick={() => onSlotClick?.(slotStart, slotEnd)}
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={() => handleDrop(day, hour)}
                >
                  {slotEvents.map((event, idx) => (
                    <div
                      key={event.id + event.start_time}
                      draggable={!!onEventDrop}
                      onDragStart={() => handleDragStart(event)}
                      onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                      className={`block w-full text-left text-[10px] px-1 py-0.5 rounded border truncate cursor-pointer ${getEventColor(event, idx)}`}
                    >
                      {formatEventTime(event.start_time, false)} {event.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayView({ currentDate, events, onEventClick, onSlotClick, onEventDrop }: Omit<Props, 'view' | 'onEventResize'>) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayEvents = useMemo(() => getEventsForDay(events, currentDate), [events, currentDate]);
  const allDayEvents = dayEvents.filter((e) => e.all_day);
  const timedEvents = dayEvents.filter((e) => !e.all_day);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);

  const handleDrop = useCallback((hour: number) => {
    if (!draggedEvent || !onEventDrop) return;
    const originalDuration = new Date(draggedEvent.end_time).getTime() - new Date(draggedEvent.start_time).getTime();
    const newStart = new Date(currentDate);
    newStart.setHours(hour, 0, 0, 0);
    const newEnd = new Date(newStart.getTime() + originalDuration);
    onEventDrop(draggedEvent.id, newStart, newEnd);
    setDraggedEvent(null);
  }, [draggedEvent, onEventDrop, currentDate]);

  return (
    <div className="rounded-xl border border-surface-400/40 bg-surface-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-400/30">
        <div className="text-xs text-gray-500">{currentDate.toLocaleDateString(undefined, { weekday: 'long' })}</div>
        <div className={`text-lg font-semibold ${isSameDay(currentDate, today) ? 'text-primary-300' : 'text-white'}`}>
          {currentDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      </div>
      {allDayEvents.length > 0 && (
        <div className="px-4 py-2 border-b border-surface-400/20 space-y-1">
          {allDayEvents.map((event, idx) => (
            <button key={event.id + event.start_time} onClick={() => onEventClick(event)} className={`block w-full text-left text-xs px-2 py-1 rounded border ${getEventColor(event, idx)}`}>
              All day — {event.title}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-[60px_1fr] max-h-[500px] overflow-y-auto">
        {HOURS.map((hour) => {
          const slotStart = new Date(currentDate);
          slotStart.setHours(hour, 0, 0, 0);
          const slotEnd = new Date(currentDate);
          slotEnd.setHours(hour + 1, 0, 0, 0);
          const slotEvents = timedEvents.filter((e) => {
            const eStart = new Date(e.start_time);
            const eEnd = new Date(e.end_time);
            return eStart < slotEnd && eEnd > slotStart;
          });
          return (
            <div key={hour} className="contents">
              <div className="text-[10px] text-gray-600 text-right pr-2 pt-1 border-b border-surface-400/10">{formatHour(hour)}</div>
              <div
                className="border-b border-surface-400/10 min-h-[48px] p-1 cursor-pointer hover:bg-surface-200/30 transition-colors"
                onClick={() => onSlotClick?.(slotStart, slotEnd)}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={() => handleDrop(hour)}
              >
                {slotEvents.map((event, idx) => (
                  <div
                    key={event.id + event.start_time}
                    draggable={!!onEventDrop}
                    onDragStart={() => setDraggedEvent(event)}
                    onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                    className={`block w-full text-left text-xs px-2 py-1 rounded border mb-1 cursor-pointer ${getEventColor(event, idx)}`}
                  >
                    <div className="font-medium">{event.title}</div>
                    <div className="flex items-center gap-1 text-[10px] opacity-70">
                      <Clock className="w-2.5 h-2.5" /> {formatEventTime(event.start_time, false)}
                      {event.location && <><MapPin className="w-2.5 h-2.5" /> {event.location}</>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaView({ currentDate, events, onEventClick }: Omit<Props, 'view' | 'onSlotClick' | 'onEventDrop' | 'onEventResize'>) {
  const sorted = useMemo(() => [...events].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()), [events]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = sorted.filter((e) => new Date(e.start_time) >= today);

  if (upcoming.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CalendarIcon className="w-10 h-10 text-gray-600 mb-3" />
        <p className="text-sm text-gray-400">No upcoming events</p>
      </div>
    );
  }

  let lastDate = '';

  return (
    <div className="space-y-1">
      {upcoming.map((event) => {
        const eventDate = new Date(event.start_time).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        const showDate = eventDate !== lastDate;
        lastDate = eventDate;
        return (
          <div key={event.id + event.start_time}>
            {showDate && (
              <div className="text-xs font-medium text-gray-500 mt-3 mb-1 px-2">{eventDate}</div>
            )}
            <button
              onClick={() => onEventClick(event)}
              className="flex items-center gap-3 w-full rounded-lg border border-surface-400/30 bg-surface-100 p-3 hover:bg-surface-200/50 transition-colors text-left"
            >
              <div className={`w-1 h-10 rounded-full ${getEventColorBg(event)}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-200 truncate">{event.title}</div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  {formatEventTime(event.start_time, event.all_day)}
                  {event.location && <><MapPin className="w-3 h-3" /> {event.location}</>}
                </div>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
