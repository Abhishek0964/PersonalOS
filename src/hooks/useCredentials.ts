import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCredentials,
  fetchCredentialById,
  createCredential,
  updateCredential,
  softDeleteCredential,
  fetchTagsForCredential,
  assignTagToCredential,
  removeTagFromCredential,
} from '../services/credentialService';
import type { CredentialInsert, CredentialUpdate, CredentialFilters, CredentialSort } from '../types/domain';

export function useCredentials(
  workspaceId: string | null,
  options?: { filters?: CredentialFilters; sort?: CredentialSort }
) {
  return useQuery({
    queryKey: ['credentials', workspaceId, options],
    queryFn: () => fetchCredentials(workspaceId!, options),
    enabled: !!workspaceId,
  });
}

export function useCredential(credentialId: string | null) {
  return useQuery({
    queryKey: ['credential', credentialId],
    queryFn: () => fetchCredentialById(credentialId!),
    enabled: !!credentialId,
  });
}

export function useCredentialTags(credentialId: string | null) {
  return useQuery({
    queryKey: ['credential-tags', credentialId],
    queryFn: () => fetchTagsForCredential(credentialId!),
    enabled: !!credentialId,
  });
}

export function useCreateCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CredentialInsert) => createCredential(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['credentials', variables.workspace_id] });
    },
  });
}

export function useUpdateCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: CredentialUpdate }) => updateCredential(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credentials'] });
      qc.invalidateQueries({ queryKey: ['credential'] });
    },
  });
}

export function useDeleteCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeleteCredential(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credentials'] });
    },
  });
}

export function useAssignCredentialTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ credentialId, tagId }: { credentialId: string; tagId: string }) =>
      assignTagToCredential(credentialId, tagId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['credential-tags', variables.credentialId] });
    },
  });
}

export function useRemoveCredentialTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ credentialId, tagId }: { credentialId: string; tagId: string }) =>
      removeTagFromCredential(credentialId, tagId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['credential-tags', variables.credentialId] });
    },
  });
}
