import { supabase } from '../lib/supabase';
import type {
  Entity,
  EntityInsert,
  EntityUpdate,
  Tag,
  CustomFieldValue,
} from '../types/domain';
import type { EntityType } from '../types/database';

export async function fetchEntities(
  workspaceId: string,
  options?: {
    folderId?: string | null;
    entityType?: EntityType;
    parentId?: string | null;
  }
): Promise<Entity[]> {
  let query = supabase
    .from('entities')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (options?.entityType) {
    query = query.eq('entity_type', options.entityType);
  }
  if (options?.parentId !== undefined) {
    if (options.parentId === null) {
      query = query.is('parent_id', null);
    } else {
      query = query.eq('parent_id', options.parentId);
    }
  }
  if (options?.folderId !== undefined) {
    if (options.folderId === null) {
      query = query.is('folder_id', null);
    } else {
      query = query.eq('folder_id', options.folderId);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Entity[];
}

export async function fetchEntityById(id: string): Promise<Entity | null> {
  const { data, error } = await supabase
    .from('entities')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data as Entity | null;
}

export async function fetchEntityWithRelations(id: string): Promise<{
  entity: Entity | null;
  tags: Tag[];
  children: Entity[];
  customFieldValues: CustomFieldValue[];
}> {
  const [entityResult, tagsResult, childrenResult, cfvResult] = await Promise.all([
    supabase.from('entities').select('*').eq('id', id).is('deleted_at', null).maybeSingle(),
    supabase
      .from('entity_tags')
      .select('tag_id, tags(id, name, color)')
      .eq('entity_id', id)
      .then((r) => {
        if (r.error) throw r.error;
        return (r.data ?? []).map((row: Record<string, unknown>) => row.tags) as Tag[];
      }),
    supabase
      .from('entities')
      .select('*')
      .eq('parent_id', id)
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    supabase
      .from('custom_field_values')
      .select('*')
      .eq('entity_id', id),
  ]);

  if (entityResult.error) throw entityResult.error;
  if (childrenResult.error) throw childrenResult.error;
  if (cfvResult.error) throw cfvResult.error;

  return {
    entity: entityResult.data as Entity | null,
    tags: tagsResult,
    children: (childrenResult.data ?? []) as Entity[],
    customFieldValues: (cfvResult.data ?? []) as CustomFieldValue[],
  };
}

export async function createEntity(input: EntityInsert): Promise<Entity> {
  const { data, error } = await supabase
    .from('entities')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Entity;
}

export async function updateEntity(id: string, updates: EntityUpdate): Promise<Entity> {
  const { data, error } = await supabase
    .from('entities')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Entity;
}

export async function softDeleteEntity(id: string): Promise<void> {
  const { error } = await supabase
    .from('entities')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function restoreEntity(id: string): Promise<void> {
  const { error } = await supabase
    .from('entities')
    .update({ deleted_at: null })
    .eq('id', id);
  if (error) throw error;
}

export async function fetchChildEntities(parentId: string): Promise<Entity[]> {
  const { data, error } = await supabase
    .from('entities')
    .select('*')
    .eq('parent_id', parentId)
    .is('deleted_at', null)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Entity[];
}

export async function moveEntity(id: string, parentId: string | null, folderId?: string | null): Promise<void> {
  const updates: EntityUpdate = { parent_id: parentId };
  if (folderId !== undefined) updates.folder_id = folderId;
  const { error } = await supabase
    .from('entities')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function searchEntities(workspaceId: string, searchTerm: string): Promise<Entity[]> {
  const { data, error } = await supabase
    .from('entities')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
    .order('name', { ascending: true })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as Entity[];
}
