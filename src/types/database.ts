export type EntityType = 'Client' | 'Project' | 'Personal' | 'Meeting' | 'Company' | 'Course' | 'Contact' | 'Custom';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type CredentialType = 'password' | 'api_key' | 'env_var' | 'token' | 'secure_note' | 'other';
export type FieldType = 'text' | 'number' | 'date' | 'select' | 'boolean' | 'email' | 'phone' | 'url' | 'currency' | 'textarea' | 'multiselect';

export interface Database {
  profiles: {
    Row: {
      id: string;
      email: string;
      display_name: string | null;
      avatar_url: string | null;
      timezone: string;
      preferences: Record<string, unknown>;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id: string;
      email: string;
      display_name?: string | null;
      avatar_url?: string | null;
      timezone?: string;
      preferences?: Record<string, unknown>;
    };
    Update: {
      email?: string;
      display_name?: string | null;
      avatar_url?: string | null;
      timezone?: string;
      preferences?: Record<string, unknown>;
    };
  };

  workspaces: {
    Row: {
      id: string;
      name: string;
      description: string | null;
      icon: string;
      color: string;
      user_id: string;
      is_archived: boolean;
      deleted_at: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      name: string;
      description?: string | null;
      icon?: string;
      color?: string;
      user_id?: string;
      is_archived?: boolean;
    };
    Update: {
      name?: string;
      description?: string | null;
      icon?: string;
      color?: string;
      is_archived?: boolean;
    };
  };

  navigation_items: {
    Row: {
      id: string;
      workspace_id: string;
      label: string;
      icon: string | null;
      route: string;
      sort_order: number;
      is_visible: boolean;
      user_id: string;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      workspace_id: string;
      label: string;
      icon?: string | null;
      route: string;
      sort_order?: number;
      is_visible?: boolean;
      user_id?: string;
    };
    Update: {
      label?: string;
      icon?: string | null;
      route?: string;
      sort_order?: number;
      is_visible?: boolean;
    };
  };

  folders: {
    Row: {
      id: string;
      workspace_id: string;
      parent_id: string | null;
      entity_id: string | null;
      name: string;
      icon: string;
      color: string;
      sort_order: number;
      is_favorite: boolean;
      user_id: string;
      deleted_at: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      workspace_id: string;
      parent_id?: string | null;
      entity_id?: string | null;
      name: string;
      icon?: string;
      color?: string;
      sort_order?: number;
      is_favorite?: boolean;
      user_id?: string;
    };
    Update: {
      parent_id?: string | null;
      entity_id?: string | null;
      name?: string;
      icon?: string;
      color?: string;
      sort_order?: number;
      is_favorite?: boolean;
    };
  };

  entities: {
    Row: {
      id: string;
      workspace_id: string;
      folder_id: string | null;
      parent_id: string | null;
      entity_type: EntityType;
      name: string;
      description: string | null;
      status: string | null;
      metadata: Record<string, unknown>;
      user_id: string;
      deleted_at: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      workspace_id: string;
      folder_id?: string | null;
      parent_id?: string | null;
      entity_type?: EntityType;
      name: string;
      description?: string | null;
      status?: string | null;
      metadata?: Record<string, unknown>;
      user_id?: string;
    };
    Update: {
      folder_id?: string | null;
      parent_id?: string | null;
      entity_type?: EntityType;
      name?: string;
      description?: string | null;
      status?: string | null;
      metadata?: Record<string, unknown>;
    };
  };

  tasks: {
    Row: {
      id: string;
      workspace_id: string;
      entity_id: string | null;
      parent_id: string | null;
      title: string;
      description: string | null;
      status: TaskStatus;
      priority: TaskPriority;
      due_date: string | null;
      start_date: string | null;
      completed_at: string | null;
      recurrence: Record<string, unknown>;
      checklist: Array<{ text: string; done: boolean }>;
      sort_order: number;
      user_id: string;
      deleted_at: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      workspace_id: string;
      entity_id?: string | null;
      parent_id?: string | null;
      title: string;
      description?: string | null;
      status?: TaskStatus;
      priority?: TaskPriority;
      due_date?: string | null;
      start_date?: string | null;
      completed_at?: string | null;
      recurrence?: Record<string, unknown>;
      checklist?: Array<{ text: string; done: boolean }>;
      sort_order?: number;
      user_id?: string;
    };
    Update: {
      entity_id?: string | null;
      parent_id?: string | null;
      title?: string;
      description?: string | null;
      status?: TaskStatus;
      priority?: TaskPriority;
      due_date?: string | null;
      start_date?: string | null;
      completed_at?: string | null;
      recurrence?: Record<string, unknown>;
      checklist?: Array<{ text: string; done: boolean }>;
      sort_order?: number;
    };
  };

  calendar_events: {
    Row: {
      id: string;
      workspace_id: string;
      entity_id: string | null;
      task_id: string | null;
      title: string;
      description: string | null;
      start_time: string;
      end_time: string;
      all_day: boolean;
      location: string | null;
      recurrence: Record<string, unknown>;
      user_id: string;
      deleted_at: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      workspace_id: string;
      entity_id?: string | null;
      task_id?: string | null;
      title: string;
      description?: string | null;
      start_time: string;
      end_time: string;
      all_day?: boolean;
      location?: string | null;
      recurrence?: Record<string, unknown>;
      user_id?: string;
    };
    Update: {
      entity_id?: string | null;
      task_id?: string | null;
      title?: string;
      description?: string | null;
      start_time?: string;
      end_time?: string;
      all_day?: boolean;
      location?: string | null;
      recurrence?: Record<string, unknown>;
    };
  };
  calendar_event_tags: {
    Row: {
      id: string;
      calendar_event_id: string;
      tag_id: string;
      user_id: string;
      created_at: string;
    };
    Insert: {
      calendar_event_id: string;
      tag_id: string;
      user_id?: string;
    };
    Update: Partial<Database['calendar_event_tags']['Insert']>;
  };
  note_tags: {
    Row: {
      id: string;
      note_id: string;
      tag_id: string;
      user_id: string;
      created_at: string;
    };
    Insert: {
      note_id: string;
      tag_id: string;
      user_id?: string;
    };
    Update: Partial<Database['note_tags']['Insert']>;
  };

  notes: {
    Row: {
      id: string;
      workspace_id: string;
      entity_id: string | null;
      folder_id: string | null;
      title: string;
      content: string;
      is_pinned: boolean;
      user_id: string;
      deleted_at: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      workspace_id: string;
      entity_id?: string | null;
      folder_id?: string | null;
      title: string;
      content?: string;
      is_pinned?: boolean;
      user_id?: string;
    };
    Update: {
      entity_id?: string | null;
      folder_id?: string | null;
      title?: string;
      content?: string;
      is_pinned?: boolean;
    };
  };

  files: {
    Row: {
      id: string;
      workspace_id: string;
      entity_id: string | null;
      folder_id: string | null;
      name: string;
      storage_path: string;
      mime_type: string | null;
      size_bytes: number | null;
      is_favorite: boolean;
      user_id: string;
      deleted_at: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      workspace_id: string;
      entity_id?: string | null;
      folder_id?: string | null;
      name: string;
      storage_path: string;
      mime_type?: string | null;
      size_bytes?: number | null;
      is_favorite?: boolean;
      user_id?: string;
    };
    Update: {
      entity_id?: string | null;
      folder_id?: string | null;
      name?: string;
      storage_path?: string;
      mime_type?: string | null;
      size_bytes?: number | null;
      is_favorite?: boolean;
    };
  };
  file_tags: {
    Row: {
      id: string;
      file_id: string;
      tag_id: string;
      user_id: string;
      created_at: string;
    };
    Insert: {
      file_id: string;
      tag_id: string;
      user_id?: string;
    };
    Update: Partial<Database['file_tags']['Insert']>;
  };

  credentials: {
    Row: {
      id: string;
      workspace_id: string;
      entity_id: string | null;
      folder_id: string | null;
      name: string;
      credential_type: CredentialType;
      encrypted_data: string;
      url: string | null;
      username: string | null;
      notes: string | null;
      category: string;
      is_favorite: boolean;
      expiry_date: string | null;
      tags: Record<string, unknown>;
      user_id: string;
      deleted_at: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      workspace_id: string;
      entity_id?: string | null;
      folder_id?: string | null;
      name: string;
      credential_type?: CredentialType;
      encrypted_data: string;
      url?: string | null;
      username?: string | null;
      notes?: string | null;
      category?: string;
      is_favorite?: boolean;
      expiry_date?: string | null;
      tags?: Record<string, unknown>;
      user_id?: string;
    };
    Update: {
      entity_id?: string | null;
      folder_id?: string | null;
      name?: string;
      credential_type?: CredentialType;
      encrypted_data?: string;
      url?: string | null;
      username?: string | null;
      notes?: string | null;
      category?: string;
      is_favorite?: boolean;
      expiry_date?: string | null;
      tags?: Record<string, unknown>;
    };
  };
  credential_tags: {
    Row: {
      id: string;
      credential_id: string;
      tag_id: string;
      user_id: string;
      created_at: string;
    };
    Insert: {
      credential_id: string;
      tag_id: string;
      user_id?: string;
    };
    Update: Partial<Database['credential_tags']['Insert']>;
  };

  tags: {
    Row: {
      id: string;
      workspace_id: string;
      name: string;
      color: string;
      user_id: string;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      workspace_id: string;
      name: string;
      color?: string;
      user_id?: string;
    };
    Update: {
      name?: string;
      color?: string;
    };
  };

  entity_tags: {
    Row: {
      id: string;
      entity_id: string;
      tag_id: string;
      user_id: string;
      created_at: string;
    };
    Insert: {
      entity_id: string;
      tag_id: string;
      user_id?: string;
    };
    Update: Partial<Database['entity_tags']['Insert']>;
  };

  comments: {
    Row: {
      id: string;
      entity_id: string;
      content: string;
      user_id: string;
      deleted_at: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      entity_id: string;
      content: string;
      user_id?: string;
    };
    Update: {
      content?: string;
    };
  };

  activity_logs: {
    Row: {
      id: string;
      workspace_id: string;
      entity_id: string | null;
      action: string;
      entity_type: string;
      metadata: Record<string, unknown>;
      user_id: string;
      created_at: string;
    };
    Insert: {
      workspace_id: string;
      entity_id?: string | null;
      action: string;
      entity_type: string;
      metadata?: Record<string, unknown>;
      user_id?: string;
    };
    Update: {
      action?: string;
      metadata?: Record<string, unknown>;
    };
  };

  reminders: {
    Row: {
      id: string;
      workspace_id: string;
      entity_id: string | null;
      task_id: string | null;
      calendar_event_id: string | null;
      title: string;
      remind_at: string;
      is_triggered: boolean;
      user_id: string;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      workspace_id: string;
      entity_id?: string | null;
      task_id?: string | null;
      calendar_event_id?: string | null;
      title: string;
      remind_at: string;
      is_triggered?: boolean;
      user_id?: string;
    };
    Update: {
      title?: string;
      remind_at?: string;
      is_triggered?: boolean;
    };
  };

  custom_fields: {
    Row: {
      id: string;
      workspace_id: string;
      entity_type: string;
      field_name: string;
      field_type: FieldType;
      field_options: Record<string, unknown>;
      is_required: boolean;
      sort_order: number;
      user_id: string;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      workspace_id: string;
      entity_type: string;
      field_name: string;
      field_type?: FieldType;
      field_options?: Record<string, unknown>;
      is_required?: boolean;
      sort_order?: number;
      user_id?: string;
    };
    Update: {
      field_name?: string;
      field_type?: FieldType;
      field_options?: Record<string, unknown>;
      is_required?: boolean;
      sort_order?: number;
    };
  };

  custom_field_values: {
    Row: {
      id: string;
      custom_field_id: string;
      entity_id: string;
      field_value: string | null;
      user_id: string;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      custom_field_id: string;
      entity_id: string;
      field_value?: string | null;
      user_id?: string;
    };
    Update: {
      field_value?: string | null;
    };
  };
}
