import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type Workspace = Database['workspaces']['Row'];
type WorkspaceInsert = Database['workspaces']['Insert'];
type WorkspaceUpdate = Database['workspaces']['Update'];
type NavigationItem = Database['navigation_items']['Row'];

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Workspace[];
}

export async function createWorkspace(input: WorkspaceInsert): Promise<Workspace> {
  const { data, error } = await supabase
    .from('workspaces')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Workspace;
}

export async function updateWorkspace(id: string, updates: WorkspaceUpdate): Promise<Workspace> {
  const { data, error } = await supabase
    .from('workspaces')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Workspace;
}

export async function softDeleteWorkspace(id: string): Promise<void> {
  const { error } = await supabase
    .from('workspaces')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function fetchNavigationItems(workspaceId: string): Promise<NavigationItem[]> {
  const { data, error } = await supabase
    .from('navigation_items')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_visible', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as NavigationItem[];
}

export async function updateNavigationItem(
  id: string,
  updates: Partial<Database['navigation_items']['Update']>
): Promise<void> {
  const { error } = await supabase
    .from('navigation_items')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}
