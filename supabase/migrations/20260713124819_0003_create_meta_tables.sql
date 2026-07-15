/*
# Create Meta Tables — Tags, Comments, Activity Logs, Reminders, Custom Fields

## Overview
This migration creates the cross-cutting meta tables that extend the entity
system with tagging, commenting, audit trails, notifications, and user-defined
custom fields.

## New Tables

### 1. tags
- Global tags scoped to a workspace.
- `id` (uuid, PK)
- `workspace_id` (uuid, FK to workspaces)
- `name` (text, not null)
- `color` (text) — hex color.
- `user_id` (uuid, not null, default auth.uid())
- `created_at`, `updated_at`

### 2. entity_tags
- Many-to-many junction between entities and tags.
- `id` (uuid, PK)
- `entity_id` (uuid, FK to entities, CASCADE)
- `tag_id` (uuid, FK to tags, CASCADE)
- `user_id` (uuid, not null, default auth.uid())
- `created_at`

### 3. comments
- Comments attachable to any entity.
- `id` (uuid, PK)
- `entity_id` (uuid, FK to entities, CASCADE)
- `content` (text, not null)
- `user_id` (uuid, not null, default auth.uid())
- `deleted_at`, `created_at`, `updated_at`

### 4. activity_logs
- Audit trail for all entity changes.
- `id` (uuid, PK)
- `workspace_id` (uuid, FK to workspaces)
- `entity_id` (uuid, FK to entities, nullable, SET NULL on delete)
- `action` (text) — created, updated, deleted, etc.
- `entity_type` (text) — the table/type affected.
- `metadata` (jsonb) — before/after or diff data.
- `user_id` (uuid, not null, default auth.uid())
- `created_at`

### 5. reminders
- Notifications/reminders for tasks, events, entities.
- `id` (uuid, PK)
- `workspace_id` (uuid, FK to workspaces)
- `entity_id` (uuid, FK to entities, nullable)
- `task_id` (uuid, FK to tasks, nullable)
- `calendar_event_id` (uuid, FK to calendar_events, nullable)
- `title` (text, not null)
- `remind_at` (timestamptz, not null)
- `is_triggered` (boolean, default false)
- `user_id` (uuid, not null, default auth.uid())
- `created_at`, `updated_at`

### 6. custom_fields
- User-defined field definitions scoped to a workspace and entity type.
- `id` (uuid, PK)
- `workspace_id` (uuid, FK to workspaces)
- `entity_type` (text, not null) — which entity type this field applies to.
- `field_name` (text, not null)
- `field_type` (text) — text, number, date, select, boolean.
- `field_options` (jsonb) — options for select fields.
- `is_required` (boolean, default false)
- `sort_order` (int, default 0)
- `user_id` (uuid, not null, default auth.uid())
- `created_at`, `updated_at`

### 7. custom_field_values
- Values for custom fields on specific entities.
- `id` (uuid, PK)
- `custom_field_id` (uuid, FK to custom_fields, CASCADE)
- `entity_id` (uuid, FK to entities, CASCADE)
- `field_value` (text) — stored as text, cast by frontend.
- `user_id` (uuid, not null, default auth.uid())
- `created_at`, `updated_at`

## Security (RLS)
- RLS enabled on ALL tables.
- Owner-scoped: auth.uid() = user_id on every policy.
- 4 policies per table (SELECT, INSERT, UPDATE, DELETE).

## Indexes
- tags: workspace_id, user_id
- entity_tags: entity_id, tag_id (unique pair)
- comments: entity_id, user_id
- activity_logs: workspace_id, entity_id, user_id
- reminders: workspace_id, entity_id, remind_at, user_id
- custom_fields: workspace_id, entity_type, user_id
- custom_field_values: custom_field_id, entity_id (unique pair), user_id
*/

-- ============================================================
-- TAGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#6b7280',
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tags" ON tags;
CREATE POLICY "select_own_tags" ON tags FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_tags" ON tags;
CREATE POLICY "insert_own_tags" ON tags FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tags" ON tags;
CREATE POLICY "update_own_tags" ON tags FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_tags" ON tags;
CREATE POLICY "delete_own_tags" ON tags FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS tags_updated_at ON tags;
CREATE TRIGGER tags_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_tags_workspace_id ON tags(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);

-- ============================================================
-- ENTITY_TAGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS entity_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE entity_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_entity_tags" ON entity_tags;
CREATE POLICY "select_own_entity_tags" ON entity_tags FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_entity_tags" ON entity_tags;
CREATE POLICY "insert_own_entity_tags" ON entity_tags FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_entity_tags" ON entity_tags;
CREATE POLICY "update_own_entity_tags" ON entity_tags FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_entity_tags" ON entity_tags;
CREATE POLICY "delete_own_entity_tags" ON entity_tags FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_entity_tags_entity_id ON entity_tags(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_tags_tag_id ON entity_tags(tag_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_tags_unique ON entity_tags(entity_id, tag_id);

-- ============================================================
-- COMMENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  content text NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_comments" ON comments;
CREATE POLICY "select_own_comments" ON comments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_comments" ON comments;
CREATE POLICY "insert_own_comments" ON comments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_comments" ON comments;
CREATE POLICY "update_own_comments" ON comments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_comments" ON comments;
CREATE POLICY "delete_own_comments" ON comments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS comments_updated_at ON comments;
CREATE TRIGGER comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_comments_entity_id ON comments(entity_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id) WHERE deleted_at IS NULL;

-- ============================================================
-- ACTIVITY_LOGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entities(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_activity_logs" ON activity_logs;
CREATE POLICY "select_own_activity_logs" ON activity_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_activity_logs" ON activity_logs;
CREATE POLICY "insert_own_activity_logs" ON activity_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_activity_logs" ON activity_logs;
CREATE POLICY "update_own_activity_logs" ON activity_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_activity_logs" ON activity_logs;
CREATE POLICY "delete_own_activity_logs" ON activity_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_workspace_id ON activity_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_id ON activity_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);

-- ============================================================
-- REMINDERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entities(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  calendar_event_id uuid REFERENCES calendar_events(id) ON DELETE CASCADE,
  title text NOT NULL,
  remind_at timestamptz NOT NULL,
  is_triggered boolean DEFAULT false,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_reminders" ON reminders;
CREATE POLICY "select_own_reminders" ON reminders FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_reminders" ON reminders;
CREATE POLICY "insert_own_reminders" ON reminders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_reminders" ON reminders;
CREATE POLICY "update_own_reminders" ON reminders FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_reminders" ON reminders;
CREATE POLICY "delete_own_reminders" ON reminders FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS reminders_updated_at ON reminders;
CREATE TRIGGER reminders_updated_at
  BEFORE UPDATE ON reminders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_reminders_workspace_id ON reminders(workspace_id);
CREATE INDEX IF NOT EXISTS idx_reminders_entity_id ON reminders(entity_id);
CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at);
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);

-- ============================================================
-- CUSTOM_FIELDS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  field_name text NOT NULL,
  field_type text DEFAULT 'text',
  field_options jsonb DEFAULT '{}'::jsonb,
  is_required boolean DEFAULT false,
  sort_order int DEFAULT 0,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_custom_fields" ON custom_fields;
CREATE POLICY "select_own_custom_fields" ON custom_fields FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_custom_fields" ON custom_fields;
CREATE POLICY "insert_own_custom_fields" ON custom_fields FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_custom_fields" ON custom_fields;
CREATE POLICY "update_own_custom_fields" ON custom_fields FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_custom_fields" ON custom_fields;
CREATE POLICY "delete_own_custom_fields" ON custom_fields FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS custom_fields_updated_at ON custom_fields;
CREATE TRIGGER custom_fields_updated_at
  BEFORE UPDATE ON custom_fields
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_custom_fields_workspace_id ON custom_fields(workspace_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_entity_type ON custom_fields(entity_type);
CREATE INDEX IF NOT EXISTS idx_custom_fields_user_id ON custom_fields(user_id);

-- ============================================================
-- CUSTOM_FIELD_VALUES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS custom_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_field_id uuid NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  field_value text,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_custom_field_values" ON custom_field_values;
CREATE POLICY "select_own_custom_field_values" ON custom_field_values FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_custom_field_values" ON custom_field_values;
CREATE POLICY "insert_own_custom_field_values" ON custom_field_values FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_custom_field_values" ON custom_field_values;
CREATE POLICY "update_own_custom_field_values" ON custom_field_values FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_custom_field_values" ON custom_field_values;
CREATE POLICY "delete_own_custom_field_values" ON custom_field_values FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS custom_field_values_updated_at ON custom_field_values;
CREATE TRIGGER custom_field_values_updated_at
  BEFORE UPDATE ON custom_field_values
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_custom_field_values_custom_field_id ON custom_field_values(custom_field_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_entity_id ON custom_field_values(entity_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_field_values_unique ON custom_field_values(custom_field_id, entity_id);