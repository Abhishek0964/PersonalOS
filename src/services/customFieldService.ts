import { supabase } from '../lib/supabase';
import type {
  CustomField,
  CustomFieldInsert,
  CustomFieldUpdate,
  CustomFieldValue,
  CustomFieldValueInsert,
  CustomFieldValueUpdate,
} from '../types/domain';
import type { FieldType } from '../types/database';

export async function fetchCustomFields(
  workspaceId: string,
  entityType?: string
): Promise<CustomField[]> {
  let query = supabase
    .from('custom_fields')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('sort_order', { ascending: true })
    .order('field_name', { ascending: true });

  if (entityType) {
    query = query.eq('entity_type', entityType);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CustomField[];
}

export async function fetchCustomFieldById(id: string): Promise<CustomField | null> {
  const { data, error } = await supabase
    .from('custom_fields')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as CustomField | null;
}

export async function createCustomField(input: CustomFieldInsert): Promise<CustomField> {
  const { data, error } = await supabase
    .from('custom_fields')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as CustomField;
}

export async function updateCustomField(id: string, updates: CustomFieldUpdate): Promise<CustomField> {
  const { data, error } = await supabase
    .from('custom_fields')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as CustomField;
}

export async function deleteCustomField(id: string): Promise<void> {
  const { error } = await supabase
    .from('custom_fields')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function fetchCustomFieldValues(entityId: string): Promise<CustomFieldValue[]> {
  const { data, error } = await supabase
    .from('custom_field_values')
    .select('*')
    .eq('entity_id', entityId);
  if (error) throw error;
  return (data ?? []) as CustomFieldValue[];
}

export async function setCustomFieldValue(
  customFieldId: string,
  entityId: string,
  fieldValue: string | null
): Promise<void> {
  const { error } = await supabase
    .from('custom_field_values')
    .upsert(
      { custom_field_id: customFieldId, entity_id: entityId, field_value: fieldValue },
      { onConflict: 'custom_field_id,entity_id' }
    );
  if (error) throw error;
}

export async function deleteCustomFieldValue(customFieldId: string, entityId: string): Promise<void> {
  const { error } = await supabase
    .from('custom_field_values')
    .delete()
    .eq('custom_field_id', customFieldId)
    .eq('entity_id', entityId);
  if (error) throw error;
}

export function validateFieldValue(
  fieldType: FieldType,
  value: string | null,
  isRequired: boolean
): string | null {
  if (isRequired && (!value || value.trim() === '')) {
    return 'This field is required';
  }
  if (!value || value.trim() === '') return null;

  switch (fieldType) {
    case 'number': {
      if (isNaN(Number(value))) return 'Must be a valid number';
      break;
    }
    case 'boolean': {
      if (!['true', 'false'].includes(value.toLowerCase())) return 'Must be true or false';
      break;
    }
    case 'date': {
      if (isNaN(Date.parse(value))) return 'Must be a valid date';
      break;
    }
    case 'select':
    case 'text':
      break;
  }
  return null;
}
