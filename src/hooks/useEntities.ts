import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchEntities,
  fetchEntityById,
  fetchEntityWithRelations,
  createEntity,
  updateEntity,
  softDeleteEntity,
  restoreEntity,
  fetchChildEntities,
  moveEntity,
  searchEntities,
} from '../services/entityService';
import { createFolder } from '../services/folderService';
import type { EntityInsert, EntityUpdate } from '../types/domain';
import type { EntityType } from '../types/database';

export function useEntities(
  workspaceId: string | null,
  options?: {
    folderId?: string | null;
    entityType?: EntityType;
    parentId?: string | null;
  }
) {
  return useQuery({
    queryKey: ['entities', workspaceId, options],
    queryFn: () => fetchEntities(workspaceId!, options),
    enabled: !!workspaceId,
  });
}

export function useEntity(entityId: string | null) {
  return useQuery({
    queryKey: ['entity', entityId],
    queryFn: () => fetchEntityById(entityId!),
    enabled: !!entityId,
  });
}

export function useEntityWithRelations(entityId: string | null) {
  return useQuery({
    queryKey: ['entity-relations', entityId],
    queryFn: () => fetchEntityWithRelations(entityId!),
    enabled: !!entityId,
  });
}

export function useChildEntities(parentId: string | null) {
  return useQuery({
    queryKey: ['entities', 'children', parentId],
    queryFn: () => fetchChildEntities(parentId!),
    enabled: !!parentId,
  });
}

export function useSearchEntities(workspaceId: string | null, searchTerm: string) {
  return useQuery({
    queryKey: ['entities', 'search', workspaceId, searchTerm],
    queryFn: () => searchEntities(workspaceId!, searchTerm),
    enabled: !!workspaceId && searchTerm.length > 0,
  });
}

export function useCreateEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EntityInsert) => {
      const data = await createEntity(input);
      // Auto-create a root folder for the entity (best-effort).
      try {
        await createFolder({
          workspace_id: input.workspace_id,
          entity_id: data.id,
          name: data.name,
          icon: 'folder',
          sort_order: 0,
        });
        qc.invalidateQueries({ queryKey: ['folders', input.workspace_id] });
      } catch (err) {
        console.error('Failed to create root folder for entity:', err);
      }
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['entities', variables.workspace_id] });
    },
  });
}

export function useUpdateEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: EntityUpdate }) => updateEntity(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entities'] });
      qc.invalidateQueries({ queryKey: ['entity'] });
      qc.invalidateQueries({ queryKey: ['entity-relations'] });
    },
  });
}

export function useDeleteEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeleteEntity(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entities'] });
    },
  });
}

export function useRestoreEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreEntity(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entities'] });
    },
  });
}

export function useMoveEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, parentId, folderId }: { id: string; parentId: string | null; folderId?: string | null }) =>
      moveEntity(id, parentId, folderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entities'] });
    },
  });
}
