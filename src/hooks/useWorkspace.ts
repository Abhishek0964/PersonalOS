import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchWorkspaces,
  createWorkspace,
  updateWorkspace,
  softDeleteWorkspace,
  fetchNavigationItems,
} from '../services/workspaceService';
import type { Database } from '../types/database';

type WorkspaceInsert = Database['workspaces']['Insert'];
type WorkspaceUpdate = Database['workspaces']['Update'];

export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: fetchWorkspaces,
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkspaceInsert) => createWorkspace(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
  });
}

export function useUpdateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: WorkspaceUpdate }) =>
      updateWorkspace(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
  });
}

export function useDeleteWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeleteWorkspace(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces'] });
      qc.invalidateQueries({ queryKey: ['navigation-items'] });
    },
  });
}

export function useNavigationItems(workspaceId: string | null) {
  return useQuery({
    queryKey: ['navigation-items', workspaceId],
    queryFn: () => fetchNavigationItems(workspaceId!),
    enabled: !!workspaceId,
  });
}
