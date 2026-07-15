import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchTags,
  fetchTagById,
  createTag,
  updateTag,
  deleteTag,
  searchTags,
  assignTag,
  removeTag,
  fetchTagsForEntity,
  bulkAssignTags,
} from '../services/tagService';
import type { TagInsert, TagUpdate } from '../types/domain';

export function useTags(workspaceId: string | null) {
  return useQuery({
    queryKey: ['tags', workspaceId],
    queryFn: () => fetchTags(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useTag(tagId: string | null) {
  return useQuery({
    queryKey: ['tag', tagId],
    queryFn: () => fetchTagById(tagId!),
    enabled: !!tagId,
  });
}

export function useSearchTags(workspaceId: string | null, searchTerm: string) {
  return useQuery({
    queryKey: ['tags', 'search', workspaceId, searchTerm],
    queryFn: () => searchTags(workspaceId!, searchTerm),
    enabled: !!workspaceId && searchTerm.length > 0,
  });
}

export function useTagsForEntity(entityId: string | null) {
  return useQuery({
    queryKey: ['entity-tags', entityId],
    queryFn: () => fetchTagsForEntity(entityId!),
    enabled: !!entityId,
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TagInsert) => createTag(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['tags', variables.workspace_id] });
    },
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: TagUpdate }) => updateTag(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTag(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
      qc.invalidateQueries({ queryKey: ['entity-tags'] });
    },
  });
}

export function useAssignTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entityId, tagId }: { entityId: string; tagId: string }) => assignTag(entityId, tagId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['entity-tags', variables.entityId] });
    },
  });
}

export function useRemoveTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entityId, tagId }: { entityId: string; tagId: string }) => removeTag(entityId, tagId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['entity-tags', variables.entityId] });
    },
  });
}

export function useBulkAssignTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entityId, tagIds }: { entityId: string; tagIds: string[] }) =>
      bulkAssignTags(entityId, tagIds),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['entity-tags', variables.entityId] });
    },
  });
}
