import { supabase } from '../lib/supabase';
import type { Note, NoteInsert, NoteUpdate, NoteFilters, NoteSort, Tag } from '../types/domain';

export async function fetchNotes(
  workspaceId: string,
  options?: {
    filters?: NoteFilters;
    sort?: NoteSort;
    limit?: number;
  }
): Promise<Note[]> {
  const { filters = {}, sort = { field: 'updated_at', direction: 'desc' } } = options ?? {};

  let query = supabase
    .from('notes')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null);

  if (filters.search && filters.search.trim()) {
    query = query.or(`title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`);
  }
  if (filters.folderId && filters.folderId !== 'all') {
    if (filters.folderId === 'unassigned') {
      query = query.is('folder_id', null);
    } else {
      query = query.eq('folder_id', filters.folderId);
    }
  }
  if (filters.entityId && filters.entityId !== 'all') {
    query = query.eq('entity_id', filters.entityId);
  }
  if (filters.isPinned !== undefined) {
    query = query.eq('is_pinned', filters.isPinned);
  }

  const ascending = sort.direction === 'asc';
  if (sort.field === 'is_pinned') {
    query = query.order('is_pinned', { ascending: false }).order('updated_at', { ascending: false });
  } else {
    query = query.order(sort.field, { ascending });
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Note[];
}

export async function fetchRecentNotes(workspaceId: string, limit = 5): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Note[];
}

export async function fetchNoteById(id: string): Promise<Note | null> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data as Note | null;
}

export async function createNote(input: NoteInsert): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Note;
}

export async function updateNote(id: string, updates: NoteUpdate): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Note;
}

export async function softDeleteNote(id: string): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function togglePinNote(id: string, isPinned: boolean): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .update({ is_pinned: isPinned })
    .eq('id', id);
  if (error) throw error;
}

// Tag operations for notes
export async function fetchTagsForNote(noteId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('note_tags')
    .select('tag_id, tags(id, name, color)')
    .eq('note_id', noteId);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{ tags: Tag }>).map((row) => row.tags);
}

export async function assignTagToNote(noteId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('note_tags')
    .insert({ note_id: noteId, tag_id: tagId });
  if (error && error.code !== '23505') throw error;
}

export async function removeTagFromNote(noteId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('note_tags')
    .delete()
    .eq('note_id', noteId)
    .eq('tag_id', tagId);
  if (error) throw error;
}

export async function bulkAssignNoteTags(noteId: string, tagIds: string[]): Promise<void> {
  if (tagIds.length === 0) return;
  const rows = tagIds.map((tagId) => ({ note_id: noteId, tag_id: tagId }));
  const { error } = await supabase
    .from('note_tags')
    .upsert(rows, { onConflict: 'note_id,tag_id' });
  if (error) throw error;
}
