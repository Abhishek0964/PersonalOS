/*
# Create Feature Tables — Tasks, Calendar, Notes, Files, Credentials

## Overview
This migration creates the five feature-specific tables that store structured
data alongside the universal entity system. Each table links to a workspace
and optionally to an entity for relationship-first organization.

## New Tables

### 1. tasks
- Task engine with priority, due dates, recurrence, subtasks (self-reference).
- `id` (uuid, PK)
- `workspace_id` (uuid, FK to workspaces)
- `entity_id` (uuid, FK to entities, nullable) — link task to a client/project.
- `parent_id` (uuid, FK to tasks, nullable) — self-reference for subtasks.
- `title` (text, not null)
- `description` (text)
- `status` (text, default 'todo') — todo, in_progress, done.
- `priority` (text, default 'medium') — low, medium, high, urgent.
- `due_date` (timestamptz, nullable)
- `completed_at` (timestamptz, nullable)
- `recurrence` (jsonb) — recurrence rule (rrule-like pattern).
- `checklist` (jsonb) — array of { text, done } objects.
- `sort_order` (int, default 0)
- `user_id` (uuid, not null, default auth.uid())
- `deleted_at`, `created_at`, `updated_at`

### 2. calendar_events
- Calendar events with day/week/month support.
- `id` (uuid, PK)
- `workspace_id` (uuid, FK to workspaces)
- `entity_id` (uuid, FK to entities, nullable) — link to client/project.
- `title` (text, not null)
- `description` (text)
- `start_time` (timestamptz, not null)
- `end_time` (timestamptz, not null)
- `all_day` (boolean, default false)
- `location` (text)
- `recurrence` (jsonb)
- `user_id` (uuid, not null, default auth.uid())
- `deleted_at`, `created_at`, `updated_at`

### 3. notes
- Universal notes with rich text content. Attachable to any entity.
- `id` (uuid, PK)
- `workspace_id` (uuid, FK to workspaces)
- `entity_id` (uuid, FK to entities, nullable) — link to any entity.
- `folder_id` (uuid, FK to folders, nullable)
- `title` (text, not null)
- `content` (text) — rich text / markdown.
- `is_pinned` (boolean, default false)
- `user_id` (uuid, not null, default auth.uid())
- `deleted_at`, `created_at`, `updated_at`

### 4. files
- File metadata. Actual files stored in Supabase Storage.
- `id` (uuid, PK)
- `workspace_id` (uuid, FK to workspaces)
- `entity_id` (uuid, FK to entities, nullable) — link to any entity.
- `folder_id` (uuid, FK to folders, nullable)
- `name` (text, not null) — original file name.
- `storage_path` (text, not null) — path in Supabase Storage bucket.
- `mime_type` (text)
- `size_bytes` (bigint)
- `user_id` (uuid, not null, default auth.uid())
- `deleted_at`, `created_at`, `updated_at`

### 5. credentials
- Secure vault metadata for passwords, API keys, env vars.
- `id` (uuid, PK)
- `workspace_id` (uuid, FK to workspaces)
- `entity_id` (uuid, FK to entities, nullable)
- `name` (text, not null) — descriptive label.
- `credential_type` (text) — password, api_key, env_var, other.
- `encrypted_data` (text, not null) — client-side encrypted payload.
- `url` (text) — associated URL.
- `username` (text) — associated username (not encrypted).
- `notes` (text)
- `user_id` (uuid, not null, default auth.uid())
- `deleted_at`, `created_at`, `updated_at`

## Security (RLS)
- RLS enabled on ALL tables.
- Owner-scoped: auth.uid() = user_id on every policy.
- 4 policies per table (SELECT, INSERT, UPDATE, DELETE).

## Indexes
- tasks: workspace_id, entity_id, parent_id, status, due_date, user_id
- calendar_events: workspace_id, entity_id, start_time, user_id
- notes: workspace_id, entity_id, folder_id, is_pinned, user_id
- files: workspace_id, entity_id, folder_id, user_id
- credentials: workspace_id, entity_id, user_id
*/

-- ============================================================
-- TASKS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entities(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text DEFAULT 'todo',
  priority text DEFAULT 'medium',
  due_date timestamptz,
  completed_at timestamptz,
  recurrence jsonb DEFAULT '{}'::jsonb,
  checklist jsonb DEFAULT '[]'::jsonb,
  sort_order int DEFAULT 0,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tasks" ON tasks;
CREATE POLICY "select_own_tasks" ON tasks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_tasks" ON tasks;
CREATE POLICY "insert_own_tasks" ON tasks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tasks" ON tasks;
CREATE POLICY "update_own_tasks" ON tasks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_tasks" ON tasks;
CREATE POLICY "delete_own_tasks" ON tasks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id ON tasks(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_entity_id ON tasks(entity_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id) WHERE deleted_at IS NULL;

-- ============================================================
-- CALENDAR_EVENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entities(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  all_day boolean DEFAULT false,
  location text,
  recurrence jsonb DEFAULT '{}'::jsonb,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_calendar_events" ON calendar_events;
CREATE POLICY "select_own_calendar_events" ON calendar_events FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_calendar_events" ON calendar_events;
CREATE POLICY "insert_own_calendar_events" ON calendar_events FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_calendar_events" ON calendar_events;
CREATE POLICY "update_own_calendar_events" ON calendar_events FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_calendar_events" ON calendar_events;
CREATE POLICY "delete_own_calendar_events" ON calendar_events FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS calendar_events_updated_at ON calendar_events;
CREATE TRIGGER calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_calendar_events_workspace_id ON calendar_events(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_entity_id ON calendar_events(entity_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id) WHERE deleted_at IS NULL;

-- ============================================================
-- NOTES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entities(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES folders(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text DEFAULT '',
  is_pinned boolean DEFAULT false,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notes" ON notes;
CREATE POLICY "select_own_notes" ON notes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notes" ON notes;
CREATE POLICY "INSERT_own_notes" ON notes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notes" ON notes;
CREATE POLICY "update_own_notes" ON notes FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notes" ON notes;
CREATE POLICY "delete_own_notes" ON notes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS notes_updated_at ON notes;
CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_notes_workspace_id ON notes(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notes_entity_id ON notes(entity_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notes_is_pinned ON notes(is_pinned) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id) WHERE deleted_at IS NULL;

-- ============================================================
-- FILES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entities(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES folders(id) ON DELETE SET NULL,
  name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_files" ON files;
CREATE POLICY "select_own_files" ON files FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_files" ON files;
CREATE POLICY "insert_own_files" ON files FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_files" ON files;
CREATE POLICY "update_own_files" ON files FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_files" ON files;
CREATE POLICY "delete_own_files" ON files FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS files_updated_at ON files;
CREATE TRIGGER files_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_files_workspace_id ON files(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_files_entity_id ON files(entity_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id) WHERE deleted_at IS NULL;

-- ============================================================
-- CREDENTIALS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entities(id) ON DELETE CASCADE,
  name text NOT NULL,
  credential_type text DEFAULT 'password',
  encrypted_data text NOT NULL,
  url text,
  username text,
  notes text,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_credentials" ON credentials;
CREATE POLICY "select_own_credentials" ON credentials FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_credentials" ON credentials;
CREATE POLICY "insert_own_credentials" ON credentials FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_credentials" ON credentials;
CREATE POLICY "update_own_credentials" ON credentials FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_credentials" ON credentials;
CREATE POLICY "delete_own_credentials" ON credentials FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS credentials_updated_at ON credentials;
CREATE TRIGGER credentials_updated_at
  BEFORE UPDATE ON credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_credentials_workspace_id ON credentials(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_credentials_entity_id ON credentials(entity_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_credentials_user_id ON credentials(user_id) WHERE deleted_at IS NULL;