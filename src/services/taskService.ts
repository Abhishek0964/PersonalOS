import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';
import type {
  Task,
  TaskInsert,
  TaskUpdate,
  TaskFilters,
  TaskSort,
  TaskPage,
} from '../types/domain';

const PAGE_SIZE = 20;

const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export interface FetchTasksParams {
  workspaceId: string;
  filters?: TaskFilters;
  sort?: TaskSort;
  page?: number;
  parentId?: string | null;
}

export async function fetchTasks(params: FetchTasksParams): Promise<TaskPage> {
  const {
    workspaceId,
    filters = {},
    sort = { field: 'created_at', direction: 'desc' },
    page = 0,
    parentId = null,
  } = params;

  let query = supabase
    .from('tasks')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null);

  // Parent filtering: null = top-level tasks, string = subtasks of that parent
  if (parentId === null) {
    query = query.is('parent_id', null);
  } else {
    query = query.eq('parent_id', parentId);
  }

  // Status filter
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  // Priority filter
  if (filters.priority && filters.priority !== 'all') {
    query = query.eq('priority', filters.priority);
  }

  // Folder filter (via entity_id's folder or direct folder_id if added in future)
  // Tasks link to entities, which link to folders. For now, filter by entity_id.
  if (filters.entityId && filters.entityId !== 'all') {
    query = query.eq('entity_id', filters.entityId);
  }

  // Show/hide completed
  if (!filters.showCompleted) {
    query = query.neq('status', 'done');
  }

  // Search
  if (filters.search && filters.search.trim()) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  // Sorting
  const ascending = sort.direction === 'asc';
  if (sort.field === 'priority') {
    // Priority is text, so we sort by a mapped rank — use raw order as approximation
    query = query.order('priority', { ascending });
  } else {
    query = query.order(sort.field, { ascending });
  }

  // Pagination
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  const items = (data ?? []) as Task[];
  const total = count ?? 0;
  const hasMore = from + items.length < total;

  // Client-side priority sort (since DB can't rank text priorities natively)
  if (sort.field === 'priority') {
    items.sort((a, b) => {
      const ra = PRIORITY_RANK[a.priority ?? 'medium'] ?? 2;
      const rb = PRIORITY_RANK[b.priority ?? 'medium'] ?? 2;
      return ascending ? ra - rb : rb - ra;
    });
  }

  return { items, total, hasMore };
}

export async function fetchTaskById(id: string): Promise<Task | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data as Task | null;
}

export async function fetchSubtasks(parentId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('parent_id', parentId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function createTask(input: TaskInsert): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Task;
}

export async function updateTask(id: string, updates: TaskUpdate): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Task;
}

export async function softDeleteTask(id: string): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function bulkDeleteTasks(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw error;
}

export async function bulkUpdateTasks(ids: string[], updates: TaskUpdate): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('tasks')
    .update(updates)
    .in('id', ids);
  if (error) throw error;
}

export async function reorderTasks(updates: { id: string; sort_order: number }[]): Promise<void> {
  if (updates.length === 0) return;
  const { error } = await supabase
    .from('tasks')
    .upsert(updates.map((u) => ({ id: u.id, sort_order: u.sort_order })));
  if (error) throw error;
}

export async function toggleTaskComplete(id: string, isDone: boolean): Promise<Task> {
  const updates: TaskUpdate = {
    status: isDone ? 'done' : 'todo',
    completed_at: isDone ? new Date().toISOString() : null,
  };
  return updateTask(id, updates);
}

export async function searchTasks(workspaceId: string, searchTerm: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as Task[];
}

export { PAGE_SIZE };
