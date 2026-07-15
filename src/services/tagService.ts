import { supabase } from '../lib/supabase';
import type { Tag, TagInsert, TagUpdate, EntityTag } from '../types/domain';

export async function fetchTags(workspaceId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Tag[];
}

export async function fetchTagById(id: string): Promise<Tag | null> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Tag | null;
}

export async function createTag(input: TagInsert): Promise<Tag> {
  const { data, error } = await supabase
    .from('tags')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Tag;
}

export async function updateTag(id: string, updates: TagUpdate): Promise<Tag> {
  const { data, error } = await supabase
    .from('tags')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Tag;
}

export async function deleteTag(id: string): Promise<void> {
  const { error } = await supabase
    .from('tags')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function searchTags(workspaceId: string, searchTerm: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('workspace_id', workspaceId)
    .ilike('name', `%${searchTerm}%`)
    .order('name', { ascending: true })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as Tag[];
}

export async function assignTag(entityId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('entity_tags')
    .insert({ entity_id: entityId, tag_id: tagId });
  if (error && error.code !== '23505') throw error;
}

export async function removeTag(entityId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('entity_tags')
    .delete()
    .eq('entity_id', entityId)
    .eq('tag_id', tagId);
  if (error) throw error;
}

export async function fetchTagsForEntity(entityId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('entity_tags')
    .select('tag_id, tags(id, name, color)')
    .eq('entity_id', entityId);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{ tags: Tag }>).map((row) => row.tags);
}

export async function fetchEntitiesForTag(tagId: string): Promise<EntityTag[]> {
  const { data, error } = await supabase
    .from('entity_tags')
    .select('*')
    .eq('tag_id', tagId);
  if (error) throw error;
  return (data ?? []) as EntityTag[];
}

export async function bulkAssignTags(entityId: string, tagIds: string[]): Promise<void> {
  if (tagIds.length === 0) return;
  const rows = tagIds.map((tagId) => ({ entity_id: entityId, tag_id: tagId }));
  const { error } = await supabase
    .from('entity_tags')
    .upsert(rows, { onConflict: 'entity_id,tag_id' });
  if (error) throw error;
}
