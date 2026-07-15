import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchNotes,
  fetchRecentNotes,
  fetchNoteById,
  createNote,
  updateNote,
  softDeleteNote,
  togglePinNote,
  fetchTagsForNote,
  assignTagToNote,
  removeTagFromNote,
} from '../services/noteService';
import type { NoteInsert, NoteUpdate, NoteFilters, NoteSort } from '../types/domain';

export function useNotes(
  workspaceId: string | null,
  options?: {
    filters?: NoteFilters;
    sort?: NoteSort;
    limit?: number;
  }
) {
  return useQuery({
    queryKey: ['notes', workspaceId, options],
    queryFn: () => fetchNotes(workspaceId!, options),
    enabled: !!workspaceId,
  });
}

export function useRecentNotes(workspaceId: string | null, limit = 5) {
  return useQuery({
    queryKey: ['notes', 'recent', workspaceId, limit],
    queryFn: () => fetchRecentNotes(workspaceId!, limit),
    enabled: !!workspaceId,
  });
}

export function useNote(noteId: string | null) {
  return useQuery({
    queryKey: ['note', noteId],
    queryFn: () => fetchNoteById(noteId!),
    enabled: !!noteId,
  });
}

export function useNoteTags(noteId: string | null) {
  return useQuery({
    queryKey: ['note-tags', noteId],
    queryFn: () => fetchTagsForNote(noteId!),
    enabled: !!noteId,
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NoteInsert) => createNote(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['notes', variables.workspace_id] });
    },
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: NoteUpdate }) => updateNote(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      qc.invalidateQueries({ queryKey: ['note'] });
    },
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeleteNote(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

export function useTogglePin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isPinned }: { id: string; isPinned: boolean }) => togglePinNote(id, isPinned),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

export function useAssignNoteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, tagId }: { noteId: string; tagId: string }) => assignTagToNote(noteId, tagId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['note-tags', variables.noteId] });
    },
  });
}

export function useRemoveNoteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, tagId }: { noteId: string; tagId: string }) => removeTagFromNote(noteId, tagId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['note-tags', variables.noteId] });
    },
  });
}
