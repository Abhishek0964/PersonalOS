import { supabase } from '../lib/supabase';
import type {
  CalendarEvent,
  CalendarEventInsert,
  CalendarEventUpdate,
  CalendarEventFilters,
  RecurrenceRule,
} from '../types/domain';
import type { Tag } from '../types/domain';

export async function fetchEvents(
  workspaceId: string,
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .or(`start_time.lte.${endDate},end_time.gte.${startDate}`)
    .order('start_time', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CalendarEvent[];
}

export async function searchAllEvents(
  workspaceId: string,
  searchTerm: string
): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%`)
    .order('start_time', { ascending: true })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as CalendarEvent[];
}

export async function fetchEventsFiltered(
  workspaceId: string,
  filters: CalendarEventFilters
): Promise<CalendarEvent[]> {
  let query = supabase
    .from('calendar_events')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null);

  if (filters.allDay !== undefined && filters.allDay !== 'all') {
    query = query.eq('all_day', filters.allDay);
  }
  if (filters.entityId && filters.entityId !== 'all') {
    query = query.eq('entity_id', filters.entityId);
  }
  if (filters.taskId && filters.taskId !== 'all') {
    query = query.eq('task_id', filters.taskId);
  }
  if (filters.startDate) {
    query = query.gte('start_time', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('end_time', filters.endDate);
  }
  if (filters.search && filters.search.trim()) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,location.ilike.%${filters.search}%`);
  }

  query = query.order('start_time', { ascending: true }).limit(200);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CalendarEvent[];
}

export async function fetchEventById(id: string): Promise<CalendarEvent | null> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data as CalendarEvent | null;
}

export async function createEvent(input: CalendarEventInsert): Promise<CalendarEvent> {
  const { data, error } = await supabase
    .from('calendar_events')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as CalendarEvent;
}

export async function updateEvent(id: string, updates: CalendarEventUpdate): Promise<CalendarEvent> {
  const { data, error } = await supabase
    .from('calendar_events')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as CalendarEvent;
}

export async function softDeleteEvent(id: string): Promise<void> {
  const { error } = await supabase
    .from('calendar_events')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function moveEvent(
  id: string,
  newStartTime: string,
  newEndTime: string
): Promise<void> {
  const { error } = await supabase
    .from('calendar_events')
    .update({ start_time: newStartTime, end_time: newEndTime })
    .eq('id', id);
  if (error) throw error;
}

export async function resizeEvent(
  id: string,
  newEndTime: string
): Promise<void> {
  const { error } = await supabase
    .from('calendar_events')
    .update({ end_time: newEndTime })
    .eq('id', id);
  if (error) throw error;
}

// Tag operations for calendar events
export async function fetchTagsForEvent(eventId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('calendar_event_tags')
    .select('tag_id, tags(id, name, color)')
    .eq('calendar_event_id', eventId);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{ tags: Tag }>).map((row) => row.tags);
}

export async function assignTagToEvent(eventId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('calendar_event_tags')
    .insert({ calendar_event_id: eventId, tag_id: tagId });
  if (error && error.code !== '23505') throw error;
}

export async function removeTagFromEvent(eventId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('calendar_event_tags')
    .delete()
    .eq('calendar_event_id', eventId)
    .eq('tag_id', tagId);
  if (error) throw error;
}

// Reminder operations
export async function fetchRemindersForEvent(eventId: string) {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('calendar_event_id', eventId)
    .order('remind_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createReminder(input: {
  workspace_id: string;
  calendar_event_id: string;
  title: string;
  remind_at: string;
}): Promise<void> {
  const { error } = await supabase
    .from('reminders')
    .insert(input);
  if (error) throw error;
}

export async function deleteReminder(id: string): Promise<void> {
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// Expand recurring events into individual occurrences for a date range.
// Preserves the original event ID so the detail panel can always look up the base event.
// Adds `_occurrenceStart` and `_occurrenceEnd` as extra fields for display purposes.
export function expandRecurringEvents(
  events: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date
): CalendarEvent[] {
  const result: CalendarEvent[] = [];

  for (const event of events) {
    const recurrence = event.recurrence as RecurrenceRule | null;
    if (!recurrence || recurrence.frequency === 'none' || !recurrence.frequency) {
      result.push(event);
      continue;
    }

    const eventStart = new Date(event.start_time);
    const eventEnd = new Date(event.end_time);
    const duration = eventEnd.getTime() - eventStart.getTime();
    const recurrenceEnd = recurrence.endDate ? new Date(recurrence.endDate) : rangeEnd;
    const interval = recurrence.interval ?? 1;

    let current = new Date(eventStart);
    let count = 0;
    const maxOccurrences = 365;

    while (current <= recurrenceEnd && current <= rangeEnd && count < maxOccurrences) {
      if (current >= rangeStart) {
        result.push({
          ...event,
          start_time: current.toISOString(),
          end_time: new Date(current.getTime() + duration).toISOString(),
        });
      }

      switch (recurrence.frequency) {
        case 'daily':
          current = new Date(current.getTime() + interval * 86400000);
          break;
        case 'weekly':
          current = new Date(current.getTime() + interval * 7 * 86400000);
          break;
        case 'monthly':
          current = new Date(current.getFullYear(), current.getMonth() + interval, current.getDate(), current.getHours(), current.getMinutes());
          break;
        case 'yearly':
          current = new Date(current.getFullYear() + interval, current.getMonth(), current.getDate(), current.getHours(), current.getMinutes());
          break;
        default:
          current = new Date(current.getTime() + interval * 86400000);
      }
      count++;
    }
  }

  return result;
}
