import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchFiles,
  fetchRecentFiles,
  fetchFileById,
  uploadFile,
  downloadFile,
  getFileUrl,
  renameFile,
  updateFile,
  softDeleteFile,
  toggleFileFavorite,
  fetchTagsForFile,
  assignTagToFile,
  removeTagFromFile,
} from '../services/fileService';
import type { FileItemInsert, FileItemUpdate, FileFilters, FileSort } from '../types/domain';

export function useFiles(
  workspaceId: string | null,
  options?: { filters?: FileFilters; sort?: FileSort }
) {
  return useQuery({
    queryKey: ['files', workspaceId, options],
    queryFn: () => fetchFiles(workspaceId!, options),
    enabled: !!workspaceId,
  });
}

export function useRecentFiles(workspaceId: string | null, limit = 10) {
  return useQuery({
    queryKey: ['files', 'recent', workspaceId, limit],
    queryFn: () => fetchRecentFiles(workspaceId!, limit),
    enabled: !!workspaceId,
  });
}

export function useFile(fileId: string | null) {
  return useQuery({
    queryKey: ['file', fileId],
    queryFn: () => fetchFileById(fileId!),
    enabled: !!fileId,
  });
}

export function useFileTags(fileId: string | null) {
  return useQuery({
    queryKey: ['file-tags', fileId],
    queryFn: () => fetchTagsForFile(fileId!),
    enabled: !!fileId,
  });
}

export function useUploadFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, file, options }: { workspaceId: string; file: File; options?: { folderId?: string | null; entityId?: string | null } }) =>
      uploadFile(workspaceId, file, options),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['files', variables.workspaceId] });
    },
  });
}

export function useDownloadFile() {
  return useMutation({
    mutationFn: (file: import('../../types/domain').FileItem) => downloadFile(file),
  });
}

export function useGetFileUrl() {
  return useMutation({
    mutationFn: (file: import('../../types/domain').FileItem) => getFileUrl(file),
  });
}

export function useRenameFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newName }: { id: string; newName: string }) => renameFile(id, newName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['files'] });
    },
  });
}

export function useUpdateFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: FileItemUpdate }) => updateFile(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['files'] });
      qc.invalidateQueries({ queryKey: ['file'] });
    },
  });
}

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, storagePath }: { id: string; storagePath: string }) => softDeleteFile(id, storagePath),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['files'] });
    },
  });
}

export function useToggleFileFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) => toggleFileFavorite(id, isFavorite),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['files'] });
    },
  });
}

export function useAssignFileTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, tagId }: { fileId: string; tagId: string }) => assignTagToFile(fileId, tagId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['file-tags', variables.fileId] });
    },
  });
}

export function useRemoveFileTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, tagId }: { fileId: string; tagId: string }) => removeTagFromFile(fileId, tagId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['file-tags', variables.fileId] });
    },
  });
}
