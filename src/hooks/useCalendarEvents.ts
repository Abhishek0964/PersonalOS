import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchEvents,
  searchAllEvents,
  fetchEventsFiltered,
  fetchEventById,
  createEvent,
  updateEvent,
  softDeleteEvent,
  moveEvent,
  resizeEvent,
  fetchTagsForEvent,
  assignTagToEvent,
  removeTagFromEvent,
  fetchRemindersForEvent,
  createReminder,
  deleteReminder,
} from '../services/calendarEventService';
import type { CalendarEventInsert, CalendarEventUpdate, CalendarEventFilters } from '../types/domain';

export function useEvents(workspaceId: string | null, startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['events', workspaceId, startDate, endDate],
    queryFn: () => fetchEvents(workspaceId!, startDate, endDate),
    enabled: !!workspaceId,
  });
}

export function useEventsFiltered(workspaceId: string | null, filters: CalendarEventFilters) {
  return useQuery({
    queryKey: ['events-filtered', workspaceId, filters],
    queryFn: () => fetchEventsFiltered(workspaceId!, filters),
    enabled: !!workspaceId,
  });
}

export function useSearchAllEvents(workspaceId: string | null, searchTerm: string) {
  return useQuery({
    queryKey: ['events-search', workspaceId, searchTerm],
    queryFn: () => searchAllEvents(workspaceId!, searchTerm),
    enabled: !!workspaceId && searchTerm.trim().length > 0,
  });
}

export function useEvent(eventId: string | null) {
  return useQuery({
    queryKey: ['event', eventId],
    queryFn: () => fetchEventById(eventId!),
    enabled: !!eventId,
  });
}

export function useEventTags(eventId: string | null) {
  return useQuery({
    queryKey: ['event-tags', eventId],
    queryFn: () => fetchTagsForEvent(eventId!),
    enabled: !!eventId,
  });
}

export function useEventReminders(eventId: string | null) {
  return useQuery({
    queryKey: ['event-reminders', eventId],
    queryFn: () => fetchRemindersForEvent(eventId!),
    enabled: !!eventId,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CalendarEventInsert) => createEvent(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['events', variables.workspace_id] });
      qc.invalidateQueries({ queryKey: ['events-filtered', variables.workspace_id] });
    },
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: CalendarEventUpdate }) => updateEvent(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['events-filtered'] });
      qc.invalidateQueries({ queryKey: ['event'] });
    },
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeleteEvent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['events-filtered'] });
    },
  });
}

export function useMoveEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newStartTime, newEndTime }: { id: string; newStartTime: string; newEndTime: string }) =>
      moveEvent(id, newStartTime, newEndTime),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['events-filtered'] });
    },
  });
}

export function useResizeEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newEndTime }: { id: string; newEndTime: string }) => resizeEvent(id, newEndTime),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['events-filtered'] });
    },
  });
}

export function useAssignEventTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, tagId }: { eventId: string; tagId: string }) => assignTagToEvent(eventId, tagId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['event-tags', variables.eventId] });
    },
  });
}

export function useRemoveEventTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, tagId }: { eventId: string; tagId: string }) => removeTagFromEvent(eventId, tagId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['event-tags', variables.eventId] });
    },
  });
}

export function useCreateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { workspace_id: string; calendar_event_id: string; title: string; remind_at: string }) =>
      createReminder(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['event-reminders', variables.calendar_event_id] });
    },
  });
}

export function useDeleteReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, eventId }: { id: string; eventId: string }) => deleteReminder(id),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['event-reminders', variables.eventId] });
    },
  });
}
