import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchTasks,
  fetchTaskById,
  fetchSubtasks,
  createTask,
  updateTask,
  softDeleteTask,
  bulkDeleteTasks,
  bulkUpdateTasks,
  toggleTaskComplete,
  searchTasks,
  reorderTasks,
  PAGE_SIZE,
} from '../services/taskService';
import type { TaskInsert, TaskUpdate, TaskFilters, TaskSort } from '../types/domain';

export function useTasks(
  workspaceId: string | null,
  options?: {
    filters?: TaskFilters;
    sort?: TaskSort;
    page?: number;
    parentId?: string | null;
  }
) {
  return useQuery({
    queryKey: ['tasks', workspaceId, options],
    queryFn: () =>
      fetchTasks({
        workspaceId: workspaceId!,
        filters: options?.filters,
        sort: options?.sort,
        page: options?.page,
        parentId: options?.parentId ?? null,
      }),
    enabled: !!workspaceId,
    placeholderData: (prev) => prev,
  });
}

export function useTask(taskId: string | null) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: () => fetchTaskById(taskId!),
    enabled: !!taskId,
  });
}

export function useSubtasks(parentId: string | null) {
  return useQuery({
    queryKey: ['tasks', 'subtasks', parentId],
    queryFn: () => fetchSubtasks(parentId!),
    enabled: !!parentId,
  });
}

export function useSearchTasks(workspaceId: string | null, searchTerm: string) {
  return useQuery({
    queryKey: ['tasks', 'search', workspaceId, searchTerm],
    queryFn: () => searchTasks(workspaceId!, searchTerm),
    enabled: !!workspaceId && searchTerm.length > 0,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskInsert) => createTask(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['tasks', variables.workspace_id] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: TaskUpdate }) => updateTask(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task'] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeleteTask(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useBulkDeleteTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteTasks(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useBulkUpdateTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, updates }: { ids: string[]; updates: TaskUpdate }) =>
      bulkUpdateTasks(ids, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useToggleTaskComplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isDone }: { id: string; isDone: boolean }) => toggleTaskComplete(id, isDone),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useReorderTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: { id: string; sort_order: number }[]) => reorderTasks(updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export { PAGE_SIZE };
