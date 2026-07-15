import { useState, useMemo, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Search, AlertCircle,
  RefreshCw, Inbox, Link2, Unlink, PanelRightClose, PanelRightOpen, CheckSquare, Square,
} from 'lucide-react';
import { useEvents, useSearchAllEvents, useMoveEvent, useUpdateEvent } from '../hooks/useCalendarEvents';
import { useTasks, useToggleTaskComplete } from '../hooks/useTasks';
import { useWorkspaces } from '../hooks/useWorkspace';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useToastStore } from '../stores/toastStore';
import { expandRecurringEvents } from '../services/calendarEventService';
import type { CalendarEvent, CalendarViewType, Task } from '../types/domain';
import type { TaskPriority } from '../types/database';
import { CalendarGrid } from '../components/calendar/CalendarGrid';
import { EventFormModal } from '../components/calendar/EventFormModal';
import { EventDetailPanel } from '../components/calendar/EventDetailPanel';
import { TaskFormModal } from '../components/tasks/TaskFormModal';

const VIEW_OPTIONS: { value: CalendarViewType; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
  { value: 'agenda', label: 'Agenda' },
];

const PRIORITY_BADGE: Record<TaskPriority, { label: string; classes: string }> = {
  low: { label: 'Low', classes: 'bg-gray-500/15 text-gray-400' },
  medium: { label: 'Med', classes: 'bg-warning-500/15 text-warning-400' },
  high: { label: 'High', classes: 'bg-accent-500/15 text-accent-400' },
  urgent: { label: 'Urg', classes: 'bg-error-500/15 text-error-400' },
};

function getRangeStart(view: CalendarViewType, date: Date): Date {
  if (view === 'month') {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    return new Date(first.getFullYear(), first.getMonth(), first.getDate() - first.getDay());
  }
  if (view === 'week') {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (view === 'day') {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function getRangeEnd(view: CalendarViewType, date: Date): Date {
  if (view === 'month') {
    const start = getRangeStart('month', date);
    const end = new Date(start);
    end.setDate(start.getDate() + 42);
    return end;
  }
  if (view === 'week') {
    const start = getRangeStart('week', date);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return end;
  }
  if (view === 'day') {
    const start = getRangeStart('day', date);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    return end;
  }
  const end = new Date();
  end.setMonth(end.getMonth() + 3);
  return end;
}

export function CalendarPage() {
  const { data: workspaces } = useWorkspaces();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const effectiveWsId = activeWorkspaceId ?? workspaces?.[0]?.id ?? null;
  const showToast = useToastStore((s) => s.showToast);

  const [view, setView] = useState<CalendarViewType>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCreate, setShowCreate] = useState(false);
  const [defaultStart, setDefaultStart] = useState<string | undefined>();
  const [defaultEnd, setDefaultEnd] = useState<string | undefined>();
  const [detailEventId, setDetailEventId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Task sidebar state
  const [showTaskSidebar, setShowTaskSidebar] = useState(true);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [linkModeTaskId, setLinkModeTaskId] = useState<string | null>(null);

  const rangeStart = useMemo(() => getRangeStart(view, currentDate), [view, currentDate]);
  const rangeEnd = useMemo(() => getRangeEnd(view, currentDate), [view, currentDate]);

  const { data: rawEvents, isLoading, isError, error, refetch } = useEvents(
    effectiveWsId,
    rangeStart.toISOString(),
    rangeEnd.toISOString()
  );

  const { data: searchResults } = useSearchAllEvents(effectiveWsId, search.trim());

  const { data: tasksPage } = useTasks(effectiveWsId, {
    sort: { field: 'due_date', direction: 'asc' },
  });
  const tasks: Task[] = tasksPage?.items ?? [];

  const toggleTaskComplete = useToggleTaskComplete();
  const updateEvent = useUpdateEvent();

  const events = useMemo(() => {
    return expandRecurringEvents(rawEvents ?? [], rangeStart, rangeEnd);
  }, [rawEvents, rangeStart, rangeEnd]);

  const moveEvent = useMoveEvent();

  const navigate = (direction: number) => {
    const next = new Date(currentDate);
    if (view === 'month') next.setMonth(next.getMonth() + direction);
    else if (view === 'week') next.setDate(next.getDate() + direction * 7);
    else if (view === 'day') next.setDate(next.getDate() + direction);
    else next.setDate(next.getDate() + direction * 7);
    setCurrentDate(next);
  };

  const goToToday = () => setCurrentDate(new Date());

  const handleSlotClick = useCallback((start: Date, end: Date) => {
    setDefaultStart(start.toISOString());
    setDefaultEnd(end.toISOString());
    setShowCreate(true);
  }, []);

  const handleEventClick = useCallback((event: CalendarEvent) => {
    // If in link mode, link the active task to this event instead of opening detail.
    if (linkModeTaskId) {
      updateEvent.mutate(
        { id: event.id, updates: { task_id: linkModeTaskId } },
        {
          onSuccess: () => {
            showToast('success', 'Task linked to event');
            setLinkModeTaskId(null);
          },
          onError: (err) => showToast('error', err instanceof Error ? err.message : 'Failed to link task'),
        }
      );
      return;
    }
    setDetailEventId(event.id);
  }, [linkModeTaskId, updateEvent, showToast]);

  const handleEventDrop = useCallback((eventId: string, newStart: Date, newEnd: Date) => {
    moveEvent.mutate(
      { id: eventId, newStartTime: newStart.toISOString(), newEndTime: newEnd.toISOString() },
      { onError: (err) => showToast('error', err instanceof Error ? err.message : 'Failed to move event') }
    );
  }, [moveEvent, showToast]);

  const handleSearchSelect = (event: CalendarEvent) => {
    setSearch('');
    setShowSearchResults(false);
    const eventDate = new Date(event.start_time);
    setCurrentDate(new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate()));
    setDetailEventId(event.id);
  };

  const handleToggleTask = (task: Task) => {
    const isDone = task.status === 'done';
    toggleTaskComplete.mutate(
      { id: task.id, isDone: !isDone },
      {
        onError: (err) => showToast('error', err instanceof Error ? err.message : 'Failed to update task'),
      }
    );
  };

  const handleUnlinkTask = (taskId: string) => {
    // Find the event currently linked to this task and clear its task_id.
    const linkedEvent = events.find((e) => e.task_id === taskId);
    if (!linkedEvent) return;
    updateEvent.mutate(
      { id: linkedEvent.id, updates: { task_id: null } },
      {
        onSuccess: () => showToast('success', 'Task unlinked from event'),
        onError: (err) => showToast('error', err instanceof Error ? err.message : 'Failed to unlink task'),
      }
    );
  };

  const headerLabel = useMemo(() => {
    if (view === 'month') return currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    if (view === 'week') {
      const start = getRangeStart('week', currentDate);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    if (view === 'day') return currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    return 'Upcoming Events';
  }, [view, currentDate]);

  if (!effectiveWsId) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-6">
        <Inbox className="w-12 h-12 text-gray-600 mb-3" />
        <h2 className="text-lg font-semibold text-white">No Workspace</h2>
        <p className="text-sm text-gray-500 mt-1">Create a workspace to start managing events.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-600/15 flex items-center justify-center">
            <CalendarIcon className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Calendar</h1>
            <p className="text-xs text-gray-500">Schedule and manage your events</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTaskSidebar((v) => !v)}
            className="btn-ghost p-2 hidden lg:inline-flex"
            title={showTaskSidebar ? 'Hide task sidebar' : 'Show task sidebar'}
          >
            {showTaskSidebar ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>
          <button onClick={() => { setDefaultStart(undefined); setDefaultEnd(undefined); setShowCreate(true); }} className="btn-primary">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Event</span>
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={goToToday} className="btn-secondary text-xs py-1.5 px-3">Today</button>
          <button onClick={() => navigate(1)} className="btn-ghost p-2"><ChevronRight className="w-4 h-4" /></button>
          <h2 className="text-sm font-medium text-gray-300 ml-2">{headerLabel}</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Global search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none z-10" />
            <input
              type="text"
              placeholder="Search all events..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowSearchResults(true); }}
              onFocus={() => setShowSearchResults(true)}
              onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
              className="input-field pl-10 py-1.5 text-xs w-40 sm:w-56"
            />
            {showSearchResults && search.trim() && (searchResults ?? []).length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 z-50 rounded-lg border border-surface-400/40 bg-surface-100 shadow-elevated py-1 max-h-64 overflow-y-auto">
                {(searchResults ?? []).map((event) => (
                  <button
                    key={event.id}
                    onMouseDown={() => handleSearchSelect(event)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-surface-200/60 transition-colors"
                  >
                    <div className="w-1 h-8 rounded-full bg-primary-500" />
                    <div className="min-w-0">
                      <div className="text-sm text-gray-200 truncate">{event.title}</div>
                      <div className="text-[10px] text-gray-500">
                        {new Date(event.start_time).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex rounded-lg border border-surface-400/40 bg-surface-100 overflow-hidden">
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setView(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === opt.value ? 'bg-primary-600 text-white' : 'text-gray-400 hover:bg-surface-200/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar + Task sidebar */}
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          {/* Calendar content */}
          {isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="w-10 h-10 text-error-400 mb-3" />
              <p className="text-sm text-gray-400 mb-1">Failed to load events</p>
              <p className="text-xs text-gray-600 mb-4">{error instanceof Error ? error.message : 'An unexpected error occurred'}</p>
              <button onClick={() => refetch()} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Retry</button>
            </div>
          ) : isLoading ? (
            <CalendarSkeleton />
          ) : events.length === 0 && view !== 'agenda' ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-surface-200/50 flex items-center justify-center mb-4">
                <CalendarIcon className="w-7 h-7 text-gray-600" />
              </div>
              <h3 className="text-base font-medium text-gray-300">No events for this period</h3>
              <p className="text-sm text-gray-500 mt-1">Click on a time slot or the New Event button to create one.</p>
              <button onClick={() => { setDefaultStart(undefined); setDefaultEnd(undefined); setShowCreate(true); }} className="btn-primary mt-4">
                <Plus className="w-4 h-4" /> New Event
              </button>
            </div>
          ) : (
            <CalendarGrid
              view={view}
              currentDate={currentDate}
              events={events}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
              onEventDrop={handleEventDrop}
            />
          )}

          {linkModeTaskId && (
            <div className="mt-3 rounded-lg border border-primary-500/40 bg-primary-600/10 px-3 py-2 text-xs text-primary-300 flex items-center justify-between">
              <span>
                Link mode active — click an event to link this task.{' '}
                <button
                  onClick={() => setLinkModeTaskId(null)}
                  className="underline hover:text-primary-200"
                >
                  Cancel
                </button>
              </span>
            </div>
          )}
        </div>

        {/* Task sidebar */}
        {showTaskSidebar && (
          <aside className="hidden lg:flex flex-col w-[280px] shrink-0 rounded-xl border border-surface-400/40 bg-surface-100 overflow-hidden self-start sticky top-4 max-h-[calc(100vh-2rem)]">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-surface-400/30">
              <h3 className="text-sm font-semibold text-white">Tasks</h3>
              <button
                onClick={() => setShowTaskForm(true)}
                className="btn-ghost p-1.5"
                title="New task"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-2 space-y-1">
              {tasks.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-8">No tasks yet. Create one to link to events.</p>
              ) : (
                tasks.map((task) => {
                  const isDone = task.status === 'done';
                  const isLinked = events.some((e) => e.task_id === task.id);
                  const isLinkMode = linkModeTaskId === task.id;
                  return (
                    <div
                      key={task.id}
                      className={`flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                        isLinkMode ? 'bg-primary-600/15 ring-1 ring-primary-500/30' : 'hover:bg-surface-200/40'
                      }`}
                    >
                      <button
                        onClick={() => handleToggleTask(task)}
                        className="mt-0.5 shrink-0 text-gray-500 hover:text-primary-400 transition-colors"
                        title={isDone ? 'Mark as not done' : 'Mark as done'}
                      >
                        {isDone ? <CheckSquare className="w-4 h-4 text-primary-400" /> : <Square className="w-4 h-4" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className={`text-sm truncate ${isDone ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                          {task.title}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {task.due_date && (
                            <span className="text-[10px] text-gray-500">
                              {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                          <span className={`badge text-[10px] px-1.5 py-0 ${PRIORITY_BADGE[task.priority].classes}`}>
                            {PRIORITY_BADGE[task.priority].label}
                          </span>
                          {isLinked && (
                            <span className="text-[10px] text-primary-400 flex items-center gap-0.5">
                              <Link2 className="w-3 h-3" /> linked
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (isLinkMode) {
                            setLinkModeTaskId(null);
                          } else if (isLinked) {
                            handleUnlinkTask(task.id);
                          } else {
                            setLinkModeTaskId(task.id);
                          }
                        }}
                        className={`shrink-0 p-1 rounded transition-colors ${
                          isLinkMode
                            ? 'text-primary-300 bg-primary-600/20'
                            : isLinked
                              ? 'text-primary-400 hover:bg-surface-200/60'
                              : 'text-gray-500 hover:text-gray-300 hover:bg-surface-200/60'
                        }`}
                        title={
                          isLinkMode
                            ? 'Cancel link mode'
                            : isLinked
                              ? 'Unlink from event'
                              : 'Link to an event (click an event after)'
                        }
                      >
                        {isLinked ? <Unlink className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <EventFormModal
          workspaceId={effectiveWsId}
          defaultStart={defaultStart}
          defaultEnd={defaultEnd}
          onClose={() => setShowCreate(false)}
        />
      )}
      {showTaskForm && (
        <TaskFormModal
          workspaceId={effectiveWsId}
          onClose={() => setShowTaskForm(false)}
        />
      )}
      {detailEventId && (
        <EventDetailPanel
          key={detailEventId}
          eventId={detailEventId}
          workspaceId={effectiveWsId}
          onClose={() => setDetailEventId(null)}
        />
      )}
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="rounded-xl border border-surface-400/40 bg-surface-100 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-surface-400/30">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="px-2 py-2"><div className="skeleton h-4 rounded" /></div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="min-h-[80px] sm:min-h-[100px] border-b border-r border-surface-400/20 p-1">
            <div className="skeleton h-4 w-6 rounded mb-1" />
            <div className="skeleton h-3 w-full rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
