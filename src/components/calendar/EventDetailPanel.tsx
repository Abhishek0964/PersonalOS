import { useState } from 'react';
import {
  X, Clock, MapPin, Link2, Calendar, Repeat, Bell, Edit3, Trash2, Tag as TagIcon, Plus,
} from 'lucide-react';
import type { CalendarEvent, RecurrenceRule } from '../../types/domain';
import { useEvent, useDeleteEvent, useEventTags, useEventReminders, useCreateReminder, useDeleteReminder } from '../../hooks/useCalendarEvents';
import { useEntities } from '../../hooks/useEntities';
import { useTasks } from '../../hooks/useTasks';
import { useToastStore } from '../../stores/toastStore';
import { EventFormModal } from './EventFormModal';

interface Props {
  eventId: string;
  workspaceId: string;
  onClose: () => void;
}

export function EventDetailPanel({ eventId, workspaceId, onClose }: Props) {
  const [showEdit, setShowEdit] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(15);
  const { data: event, isError } = useEvent(eventId);
  const deleteEvent = useDeleteEvent();
  const createReminder = useCreateReminder();
  const deleteReminder = useDeleteReminder();
  const showToast = useToastStore((s) => s.showToast);
  const { data: tags } = useEventTags(eventId);
  const { data: reminders } = useEventReminders(eventId);
  const { data: entities } = useEntities(workspaceId);
  const { data: tasks } = useTasks(workspaceId);

  if (!event) {
    if (isError) {
      return (
        <div className="fixed inset-0 z-40 flex justify-end bg-surface-0/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
          <div className="w-full max-w-md h-full bg-surface-50 border-l border-surface-400/30 flex flex-col items-center justify-center gap-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-gray-400">Failed to load event</p>
            <button onClick={onClose} className="btn-secondary">Close</button>
          </div>
        </div>
      );
    }
    return (
      <div className="fixed inset-0 z-40 flex justify-end bg-surface-0/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
        <div className="w-full max-w-md h-full bg-surface-50 border-l border-surface-400/30 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <div className="skeleton w-6 h-6 rounded-full" />
        </div>
      </div>
    );
  }

  const linkedEntity = (entities ?? []).find((e) => e.id === event.entity_id);
  const linkedTask = (tasks?.items ?? []).find((t) => t.id === event.task_id);
  const recurrence = (event.recurrence as RecurrenceRule | null) ?? { frequency: 'none' };

  const handleDelete = async () => {
    try {
      await deleteEvent.mutateAsync(event.id);
      showToast('success', 'Event deleted');
      onClose();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleAddReminder = async () => {
    if (reminderMinutes <= 0) return;
    const remindAt = new Date(new Date(event.start_time).getTime() - reminderMinutes * 60000).toISOString();
    try {
      await createReminder.mutateAsync({
        workspace_id: workspaceId,
        calendar_event_id: event.id,
        title: `Reminder: ${event.title}`,
        remind_at: remindAt,
      });
      showToast('success', 'Reminder added');
      setReminderMinutes(15);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to add reminder');
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      await deleteReminder.mutateAsync({ id, eventId: event.id });
      showToast('success', 'Reminder removed');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to remove reminder');
    }
  };

  const formatDateTime = (dt: string): string => {
    if (event.all_day) return new Date(dt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return new Date(dt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const recurrenceLabel = recurrence.frequency === 'none' ? 'Does not repeat'
    : `Every ${recurrence.interval ?? 1} ${recurrence.frequency}${(recurrence.interval ?? 1) > 1 ? 's' : ''}`;

  return (
    <>
      <div className="fixed inset-0 z-40 flex justify-end bg-surface-0/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
        <div className="w-full max-w-md h-full bg-surface-50 border-l border-surface-400/30 overflow-y-auto animate-slide-down" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-surface-400/30 sticky top-0 bg-surface-50 z-10">
            <h2 className="text-base font-semibold text-white truncate flex-1">Event Details</h2>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => setShowEdit(true)} className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded" title="Edit event">
                <Edit3 className="w-4 h-4" />
              </button>
              <button onClick={handleDelete} className="text-gray-500 hover:text-error-400 transition-colors p-1.5 rounded" title="Delete event">
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-5">
            <h3 className="text-lg font-semibold text-white">{event.title}</h3>

            {event.description && (
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{event.description}</p>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-gray-500 shrink-0" />
                <span className="text-gray-300">{formatDateTime(event.start_time)} — {formatDateTime(event.end_time)}</span>
              </div>
              {event.all_day && (
                <div className="badge bg-primary-600/15 text-primary-300">All-day</div>
              )}
              {event.location && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="text-gray-300">{event.location}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Repeat className="w-4 h-4 text-gray-500 shrink-0" />
                <span className="text-gray-300">{recurrenceLabel}</span>
              </div>
            </div>

            {linkedEntity && (
              <div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5"><Link2 className="w-3.5 h-3.5" /> Linked Entity</div>
                <div className="flex items-center gap-2 rounded-lg border border-surface-400/30 bg-surface-200/30 px-3 py-2">
                  <span className="badge bg-primary-600/15 text-primary-300">{linkedEntity.entity_type}</span>
                  <span className="text-sm text-gray-200">{linkedEntity.name}</span>
                </div>
              </div>
            )}

            {linkedTask && (
              <div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5"><Calendar className="w-3.5 h-3.5" /> Linked Task</div>
                <div className="flex items-center gap-2 rounded-lg border border-surface-400/30 bg-surface-200/30 px-3 py-2">
                  <span className="text-sm text-gray-200">{linkedTask.title}</span>
                </div>
              </div>
            )}

            {(tags ?? []).length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5"><TagIcon className="w-3.5 h-3.5" /> Tags</div>
                <div className="flex flex-wrap gap-2">
                  {(tags ?? []).map((tag) => (
                    <span key={tag.id} className="badge" style={{ backgroundColor: (tag.color ?? '#6b7280') + '20', color: tag.color ?? '#6b7280' }}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color ?? '#6b7280' }} />
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Reminders */}
            <div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5"><Bell className="w-3.5 h-3.5" /> Reminders</div>
              <div className="space-y-1.5">
                {(reminders ?? []).map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-sm group">
                    <Bell className="w-3.5 h-3.5 text-warning-400" />
                    <span className="text-gray-300 flex-1">{new Date(r.remind_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    <button onClick={() => handleDeleteReminder(r.id)} className="text-gray-600 hover:text-error-400 transition-colors p-0.5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-gray-500 shrink-0" />
                  <input
                    type="number"
                    min={1}
                    value={reminderMinutes}
                    onChange={(e) => setReminderMinutes(Number(e.target.value))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddReminder(); } }}
                    placeholder="minutes before"
                    className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none border-b border-surface-400/30 focus:border-primary-500/50 transition-colors pb-1"
                  />
                  <button onClick={handleAddReminder} className="btn-ghost py-1 px-2 text-xs">Add</button>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-surface-400/20 text-xs text-gray-600 space-y-1">
              <p>Created: {formatDateTime(event.created_at)}</p>
              <p>Updated: {formatDateTime(event.updated_at)}</p>
            </div>
          </div>
        </div>
      </div>

      {showEdit && event && (
        <EventFormModal workspaceId={workspaceId} event={event} onClose={() => setShowEdit(false)} />
      )}
    </>
  );
}
