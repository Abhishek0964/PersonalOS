import { supabase } from '../lib/supabase';
import type { ActivityLog, ActivityLogEntry } from '../types/domain';

export async function logActivity(entry: ActivityLogEntry): Promise<void> {
  const { error } = await supabase.from('activity_logs').insert({
    workspace_id: entry.workspace_id,
    entity_id: entry.entity_id ?? null,
    action: entry.action,
    entity_type: entry.entity_type,
    metadata: entry.metadata ?? {},
  });
  if (error) throw error;
}

export async function fetchActivityLogs(
  workspaceId: string,
  options?: {
    entityId?: string;
    entityType?: string;
    limit?: number;
  }
): Promise<ActivityLog[]> {
  let query = supabase
    .from('activity_logs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (options?.entityId) {
    query = query.eq('entity_id', options.entityId);
  }
  if (options?.entityType) {
    query = query.eq('entity_type', options.entityType);
  }

  const limit = options?.limit ?? 50;
  query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ActivityLog[];
}

export async function fetchActivityForEntity(entityId: string, limit = 20): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ActivityLog[];
}
