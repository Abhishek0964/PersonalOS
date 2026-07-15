import { supabase } from '../lib/supabase';
import type { Folder, FolderInsert, FolderUpdate } from '../types/domain';

export async function fetchFolders(workspaceId: string): Promise<Folder[]> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Folder[];
}

export async function fetchFolderById(id: string): Promise<Folder | null> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Folder | null;
}

export async function createFolder(input: FolderInsert): Promise<Folder> {
  const { data, error } = await supabase
    .from('folders')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Folder;
}

export async function updateFolder(id: string, updates: FolderUpdate): Promise<Folder> {
  const { data, error } = await supabase
    .from('folders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Folder;
}

export async function softDeleteFolder(id: string): Promise<void> {
  const { error } = await supabase
    .from('folders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function restoreFolder(id: string): Promise<void> {
  const { error } = await supabase
    .from('folders')
    .update({ deleted_at: null })
    .eq('id', id);
  if (error) throw error;
}

export async function fetchDeletedFolders(workspaceId: string): Promise<Folder[]> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('workspace_id', workspaceId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Folder[];
}

export async function moveFolder(id: string, parentId: string | null): Promise<void> {
  const { error } = await supabase
    .from('folders')
    .update({ parent_id: parentId })
    .eq('id', id);
  if (error) throw error;
}

export async function reorderFolders(updates: { id: string; sort_order: number }[]): Promise<void> {
  if (updates.length === 0) return;
  const { error } = await supabase
    .from('folders')
    .upsert(updates.map((u) => ({ id: u.id, sort_order: u.sort_order })));
  if (error) throw error;
}
