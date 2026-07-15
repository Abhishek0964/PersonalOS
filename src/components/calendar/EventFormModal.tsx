import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, X, Calendar, MapPin, Link2, Clock, Bell, Repeat, Tag as TagIcon } from 'lucide-react';
import { useCreateEvent, useUpdateEvent, useAssignEventTag, useRemoveEventTag, useEventTags } from '../../hooks/useCalendarEvents';
import { useTags } from '../../hooks/useTags';
import { useEntities } from '../../hooks/useEntities';
import { useTasks } from '../../hooks/useTasks';
import { useCreateReminder } from '../../hooks/useCalendarEvents';
import { useToastStore } from '../../stores/toastStore';
import type { CalendarEvent, CalendarEventInsert, CalendarEventUpdate, RecurrenceRule } from '../../types/domain';

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  description: z.string().max(2000, 'Description is too long').optional().default(''),
  start_time: z.string().min(1, 'Start date is required'),
  end_time: z.string().optional().default(''),
  all_day: z.boolean().default(false),
  location: z.string().optional().default(''),
  entity_id: z.string().optional().nullable(),
  task_id: z.string().optional().nullable(),
  recurrence_frequency: z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']).default('none'),
  recurrence_interval: z.number().int().min(1).max(365).default(1),
  reminder_minutes: z.number().int().min(0).optional(),
}).refine(
  (data) => {
    if (!data.end_time) return true;
    return new Date(data.end_time) >= new Date(data.start_time);
  },
  { message: 'End date must be after start date', path: ['end_time'] }
);

type FormData = z.infer<typeof schema>;

interface Props {
  onClose: () => void;
  workspaceId: string;
  event?: CalendarEvent | null;
  defaultStart?: string;
  defaultEnd?: string;
}

export function EventFormModal({ onClose, workspaceId, event, defaultStart, defaultEnd }: Props) {
  const isEdit = !!event;
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const createReminder = useCreateReminder();
  const assignTag = useAssignEventTag();
  const removeTag = useRemoveEventTag();
  const showToast = useToastStore((s) => s.showToast);

  const { data: entities } = useEntities(workspaceId);
  const { data: tasks } = useTasks(workspaceId);
  const { data: allTags } = useTags(workspaceId);
  const { data: eventTags } = useEventTags(event?.id ?? null);

  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (event && eventTags) {
      setSelectedTagIds(new Set(eventTags.map((t) => t.id)));
    }
  }, [event, eventTags]);

  const toLocalInput = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const recurrence = (event?.recurrence as RecurrenceRule | null) ?? { frequency: 'none' };

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: event?.title ?? '',
      description: event?.description ?? '',
      start_time: event ? toLocalInput(event.start_time) : (defaultStart ?? toLocalInput(new Date().toISOString())),
      end_time: event ? toLocalInput(event.end_time) : (defaultEnd ?? ''),
      all_day: event?.all_day ?? false,
      location: event?.location ?? '',
      entity_id: event?.entity_id ?? null,
      task_id: event?.task_id ?? null,
      recurrence_frequency: (recurrence.frequency as FormData['recurrence_frequency']) ?? 'none',
      recurrence_interval: recurrence.interval ?? 1,
      reminder_minutes: undefined,
    },
  });

  const allDay = form.watch('all_day');

  const onSubmit = async (data: FormData) => {
    try {
      const startTime = new Date(data.start_time).toISOString();
      // If end_time is empty, default to start_time
      const rawEndTime = data.end_time && data.end_time.trim() ? data.end_time : data.start_time;
      let endTime: string;
      if (data.all_day) {
        // For all-day events, end at end of the end date (23:59:59.999)
        const endDate = new Date(rawEndTime);
        endDate.setHours(23, 59, 59, 999);
        endTime = endDate.toISOString();
      } else {
        endTime = new Date(rawEndTime).toISOString();
      }

      const recurrenceRule: RecurrenceRule = {
        frequency: data.recurrence_frequency,
        interval: data.recurrence_interval,
      };

      const payload: CalendarEventInsert | CalendarEventUpdate = {
        title: data.title,
        description: data.description || null,
        start_time: startTime,
        end_time: endTime,
        all_day: data.all_day,
        location: data.location || null,
        entity_id: data.entity_id || null,
        task_id: data.task_id || null,
        recurrence: recurrenceRule as unknown as Record<string, unknown>,
      };

      if (isEdit && event) {
        await updateEvent.mutateAsync({ id: event.id, updates: payload as CalendarEventUpdate });
        const oldTagIds = new Set((eventTags ?? []).map((t) => t.id));
        Promise.all([
          ...Array.from(selectedTagIds).filter((id) => !oldTagIds.has(id)).map((tagId) =>
            assignTag.mutateAsync({ eventId: event.id, tagId })
          ),
          ...Array.from(oldTagIds).filter((id) => !selectedTagIds.has(id)).map((tagId) =>
            removeTag.mutateAsync({ eventId: event.id, tagId })
          ),
        ]).catch(() => {});
        showToast('success', 'Event updated');
        form.reset();
        onClose();
      } else {
        const created = await createEvent.mutateAsync({
          ...(payload as CalendarEventInsert),
          workspace_id: workspaceId,
        });
        Promise.all(
          Array.from(selectedTagIds).map((tagId) => assignTag.mutateAsync({ eventId: created.id, tagId }))
        ).catch(() => {});
        if (data.reminder_minutes !== undefined && data.reminder_minutes > 0) {
          const remindAt = new Date(new Date(startTime).getTime() - data.reminder_minutes * 60000).toISOString();
          createReminder.mutate({
            workspace_id: workspaceId,
            calendar_event_id: created.id,
            title: `Reminder: ${data.title}`,
            remind_at: remindAt,
          });
        }
        showToast('success', 'Event created');
        form.reset();
        onClose();
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save event');
    }
  };

  const isSubmitting = form.formState.isSubmitting;
  const toggleTag = (tagId: string) => {
    const next = new Set(selectedTagIds);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    setSelectedTagIds(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-0/70 backdrop-blur-sm animate-fade-in p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-surface-400/40 bg-surface-100 shadow-elevated animate-scale-in">
        <div className="flex items-center justify-between p-5 border-b border-surface-400/30 sticky top-0 bg-surface-100 z-10">
          <h2 className="text-lg font-semibold text-white">{isEdit ? 'Edit Event' : 'New Event'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Title <span className="text-error-400">*</span>
            </label>
            <input type="text" autoFocus placeholder="Event title" className="input-field" {...form.register('title')} />
            {form.formState.errors.title && (
              <p className="mt-1.5 text-xs text-error-400">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
            <textarea rows={2} placeholder="Add details..." className="input-field resize-none" {...form.register('description')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Start
              </label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                className="input-field"
                {...form.register('start_time')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> End {!allDay && '(optional)'}
              </label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                className="input-field"
                {...form.register('end_time')}
              />
              {form.formState.errors.end_time && (
                <p className="mt-1.5 text-xs text-error-400">{form.formState.errors.end_time.message}</p>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded border-surface-400 bg-surface-200 text-primary-600 focus:ring-primary-500/30" {...form.register('all_day')} />
            All-day event
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Location
            </label>
            <input type="text" placeholder="Add location" className="input-field" {...form.register('location')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" /> Link Entity
              </label>
              <select className="input-field" {...form.register('entity_id')}>
                <option value="">No entity</option>
                {(entities ?? []).map((e) => (
                  <option key={e.id} value={e.id}>{e.name} ({e.entity_type})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Link Task
              </label>
              <select className="input-field" {...form.register('task_id')}>
                <option value="">No task</option>
                {(tasks?.items ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5" /> Recurrence
            </label>
            <div className="flex gap-2">
              <select className="input-field flex-1" {...form.register('recurrence_frequency')}>
                <option value="none">No repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              <input
                type="number"
                min={1}
                max={365}
                className="input-field w-20"
                {...form.register('recurrence_interval', { valueAsNumber: true })}
              />
            </div>
          </div>

          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" /> Reminder (minutes before)
              </label>
              <input
                type="number"
                min={0}
                placeholder="e.g. 15"
                className="input-field"
                {...form.register('reminder_minutes', { valueAsNumber: true })}
              />
            </div>
          )}

          {(allTags ?? []).length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5">
                <TagIcon className="w-3.5 h-3.5" /> Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {(allTags ?? []).map((tag) => {
                  const isSelected = selectedTagIds.has(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`badge transition-all ${isSelected ? 'ring-1 ring-primary-500/30' : 'bg-surface-200/50 text-gray-400 hover:bg-surface-300'}`}
                      style={isSelected ? { backgroundColor: (tag.color ?? '#3b82f6') + '20', color: tag.color ?? '#3b82f6' } : undefined}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color ?? '#6b7280' }} />
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2 sticky bottom-0 bg-surface-100 pb-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : isEdit ? 'Save Changes' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
