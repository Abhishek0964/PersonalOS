import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchFolders,
  fetchFolderById,
  createFolder,
  updateFolder,
  softDeleteFolder,
  restoreFolder,
  fetchDeletedFolders,
  moveFolder,
  reorderFolders,
} from '../services/folderService';
import type { FolderInsert, FolderUpdate } from '../types/domain';

export function useFolders(workspaceId: string | null) {
  return useQuery({
    queryKey: ['folders', workspaceId],
    queryFn: () => fetchFolders(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useFolder(folderId: string | null) {
  return useQuery({
    queryKey: ['folder', folderId],
    queryFn: () => fetchFolderById(folderId!),
    enabled: !!folderId,
  });
}

export function useDeletedFolders(workspaceId: string | null) {
  return useQuery({
    queryKey: ['folders', workspaceId, 'deleted'],
    queryFn: () => fetchDeletedFolders(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FolderInsert) => createFolder(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['folders', variables.workspace_id] });
    },
  });
}

export function useUpdateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: FolderUpdate }) => updateFolder(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeleteFolder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

export function useRestoreFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreFolder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

export function useMoveFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, parentId }: { id: string; parentId: string | null }) => moveFolder(id, parentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

export function useReorderFolders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: { id: string; sort_order: number }[]) => reorderFolders(updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}
