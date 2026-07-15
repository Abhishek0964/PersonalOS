import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCustomFields,
  fetchCustomFieldById,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  fetchCustomFieldValues,
  setCustomFieldValue,
  deleteCustomFieldValue,
} from '../services/customFieldService';
import type { CustomFieldInsert, CustomFieldUpdate } from '../types/domain';

export function useCustomFields(workspaceId: string | null, entityType?: string) {
  return useQuery({
    queryKey: ['custom-fields', workspaceId, entityType],
    queryFn: () => fetchCustomFields(workspaceId!, entityType),
    enabled: !!workspaceId,
  });
}

export function useCustomField(fieldId: string | null) {
  return useQuery({
    queryKey: ['custom-field', fieldId],
    queryFn: () => fetchCustomFieldById(fieldId!),
    enabled: !!fieldId,
  });
}

export function useCustomFieldValues(entityId: string | null) {
  return useQuery({
    queryKey: ['custom-field-values', entityId],
    queryFn: () => fetchCustomFieldValues(entityId!),
    enabled: !!entityId,
  });
}

export function useCreateCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CustomFieldInsert) => createCustomField(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['custom-fields', variables.workspace_id] });
    },
  });
}

export function useUpdateCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: CustomFieldUpdate }) =>
      updateCustomField(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields'] });
    },
  });
}

export function useDeleteCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCustomField(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields'] });
      qc.invalidateQueries({ queryKey: ['custom-field-values'] });
    },
  });
}

export function useSetCustomFieldValue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      customFieldId,
      entityId,
      fieldValue,
    }: {
      customFieldId: string;
      entityId: string;
      fieldValue: string | null;
    }) => setCustomFieldValue(customFieldId, entityId, fieldValue),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['custom-field-values', variables.entityId] });
    },
  });
}

export function useDeleteCustomFieldValue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ customFieldId, entityId }: { customFieldId: string; entityId: string }) =>
      deleteCustomFieldValue(customFieldId, entityId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['custom-field-values', variables.entityId] });
    },
  });
}
