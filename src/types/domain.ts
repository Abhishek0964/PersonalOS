import type { Database } from './database';

export type Folder = Database['folders']['Row'];
export type FolderInsert = Database['folders']['Insert'];
export type FolderUpdate = Database['folders']['Update'];

export type Entity = Database['entities']['Row'];
export type EntityInsert = Database['entities']['Insert'];
export type EntityUpdate = Database['entities']['Update'];

export type Tag = Database['tags']['Row'];
export type TagInsert = Database['tags']['Insert'];
export type TagUpdate = Database['tags']['Update'];

export type EntityTag = Database['entity_tags']['Row'];

export type CustomField = Database['custom_fields']['Row'];
export type CustomFieldInsert = Database['custom_fields']['Insert'];
export type CustomFieldUpdate = Database['custom_fields']['Update'];

export type CustomFieldValue = Database['custom_field_values']['Row'];
export type CustomFieldValueInsert = Database['custom_field_values']['Insert'];
export type CustomFieldValueUpdate = Database['custom_field_values']['Update'];

export type ActivityLog = Database['activity_logs']['Row'];
export type ActivityLogInsert = Database['activity_logs']['Insert'];

export interface FolderNode {
  folder: Folder;
  children: FolderNode[];
  depth: number;
}

export interface EntityWithTags extends Entity {
  tags?: Tag[];
}

export interface EntityWithRelations extends Entity {
  tags?: Tag[];
  parent?: Entity | null;
  children?: Entity[];
  customFieldValues?: CustomFieldValue[];
}

export type ActivityAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'restored'
  | 'archived'
  | 'assigned'
  | 'unassigned';

export interface ActivityLogEntry {
  workspace_id: string;
  entity_id?: string | null;
  action: ActivityAction | string;
  entity_type: string;
  metadata?: Record<string, unknown>;
}

export type Task = Database['tasks']['Row'];
export type TaskInsert = Database['tasks']['Insert'];
export type TaskUpdate = Database['tasks']['Update'];

export interface ChecklistItem {
  text: string;
  done: boolean;
}

export interface TaskFilters {
  status?: string | 'all';
  priority?: string | 'all';
  folderId?: string | 'all';
  entityId?: string | 'all';
  search?: string;
  showCompleted?: boolean;
}

export type TaskSortField = 'title' | 'due_date' | 'priority' | 'status' | 'created_at';
export type SortDirection = 'asc' | 'desc';

export interface TaskSort {
  field: TaskSortField;
  direction: SortDirection;
}

export interface TaskPage {
  items: Task[];
  total: number;
  hasMore: boolean;
}

export type CalendarEvent = Database['calendar_events']['Row'];
export type CalendarEventInsert = Database['calendar_events']['Insert'];
export type CalendarEventUpdate = Database['calendar_events']['Update'];

export type Note = Database['notes']['Row'];
export type NoteInsert = Database['notes']['Insert'];
export type NoteUpdate = Database['notes']['Update'];

export type NoteTag = Database['note_tags']['Row'];
export type CalendarEventTag = Database['calendar_event_tags']['Row'];

export interface CalendarEventFilters {
  search?: string;
  allDay?: boolean | 'all';
  entityId?: string | 'all';
  taskId?: string | 'all';
  startDate?: string;
  endDate?: string;
}

export type CalendarViewType = 'month' | 'week' | 'day' | 'agenda';

export interface RecurrenceRule {
  frequency: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  endDate?: string | null;
}

export interface NoteFilters {
  search?: string;
  folderId?: string | 'all';
  entityId?: string | 'all';
  isPinned?: boolean;
}

export type NoteSortField = 'title' | 'created_at' | 'updated_at' | 'is_pinned';
export interface NoteSort {
  field: NoteSortField;
  direction: SortDirection;
}

// CRM
export type CRMEntityType = 'Client' | 'Company' | 'Contact' | 'Meeting' | 'Project';

export interface CRMFilters {
  search?: string;
  entityType?: CRMEntityType | 'all';
  parentId?: string | null;
  tagId?: string | 'all';
}

export type CRMSortField = 'name' | 'created_at' | 'updated_at';
export interface CRMSort {
  field: CRMSortField;
  direction: SortDirection;
}

// Vault
export type Credential = Database['credentials']['Row'];
export type CredentialInsert = Database['credentials']['Insert'];
export type CredentialUpdate = Database['credentials']['Update'];
export type CredentialTag = Database['credential_tags']['Row'];

export interface CredentialFilters {
  search?: string;
  credentialType?: string | 'all';
  folderId?: string | 'all';
  isFavorite?: boolean;
  category?: string | 'all';
}

export type CredentialSortField = 'name' | 'created_at' | 'updated_at' | 'expiry_date';
export interface CredentialSort {
  field: CredentialSortField;
  direction: SortDirection;
}

export interface EncryptedPayload {
  iv: string;
  ciphertext: string;
  salt: string;
}

// Files
export type FileItem = Database['files']['Row'];
export type FileItemInsert = Database['files']['Insert'];
export type FileItemUpdate = Database['files']['Update'];
export type FileTag = Database['file_tags']['Row'];

export interface FileFilters {
  search?: string;
  folderId?: string | 'all';
  entityId?: string | 'all';
  isFavorite?: boolean;
  mimeType?: string | 'all';
}

export type FileSortField = 'name' | 'created_at' | 'updated_at' | 'size_bytes';
export interface FileSort {
  field: FileSortField;
  direction: SortDirection;
}
