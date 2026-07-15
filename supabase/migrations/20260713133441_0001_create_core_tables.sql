/*
# Create Core Foundation Tables

## Overview
This migration establishes the foundational database schema for PersonalOS.
It creates the core tables needed for authentication, workspace management,
dynamic sidebar navigation, folder hierarchy, and the universal entity system.

## New Tables

### 1. profiles
- Extends Supabase auth.users with application-specific profile data.
- `id` (uuid, PK, references auth.users) — one-to-one with the auth user.
- `email` (text) — cached email for quick lookups.
- `display_name` (text) — user's display name.
- `avatar_url` (text) — profile picture URL.
- `timezone` (text) — user's timezone for calendar/events.
- `preferences` (jsonb) — UI and app preferences (theme, layout, etc.).

### 2. workspaces
- Top-level container for all user data. Each user can have multiple workspaces.
- `id` (uuid, PK)
- `name` (text, not null)
- `description` (text)
- `icon` (text) — lucide icon name for the workspace.
- `color` (text) — hex color for workspace branding.
- `user_id` (uuid, not null, default auth.uid()) — owner.
- `is_archived` (boolean, default false)
- `deleted_at` (timestamptz, nullable) — soft delete.
- `created_at`, `updated_at` (timestamptz)

### 3. navigation_items
- Database-driven sidebar navigation. Replaces hardcoded sidebar items.
- `id` (uuid, PK)
- `workspace_id` (uuid, FK to workspaces)
- `label` (text, not null) — display label.
- `icon` (text) — lucide icon name.
- `route` (text) — frontend route path.
- `sort_order` (int, default 0) — display order.
- `is_visible` (boolean, default true) — toggle visibility.
- `user_id` (uuid, not null, default auth.uid())
- `created_at`, `updated_at`

### 4. folders
- Unlimited nesting within a workspace. Organizes entities hierarchically.
- `id` (uuid, PK)
- `workspace_id` (uuid, FK to workspaces)
- `parent_id` (uuid, FK to folders, nullable) — self-reference for nesting.
- `name` (text, not null)
- `icon` (text)
- `sort_order` (int, default 0)
- `user_id` (uuid, not null, default auth.uid())
- `deleted_at` (timestamptz, nullable) — soft delete.
- `created_at`, `updated_at`

### 5. entities
- Universal object system. Represents Clients, Projects, Personal items, etc.
- `id` (uuid, PK)
- `workspace_id` (uuid, FK to workspaces)
- `folder_id` (uuid, FK to folders, nullable)
- `parent_id` (uuid, FK to entities, nullable) — self-reference for child entities.
- `entity_type` (text, not null) — Client, Project, Personal, Meeting, Company, Course, Custom.
- `name` (text, not null)
- `description` (text)
- `status` (text) — user-defined status.
- `metadata` (jsonb, default '{}') — flexible key-value data.
- `user_id` (uuid, not null, default auth.uid())
- `deleted_at` (timestamptz, nullable) — soft delete.
- `created_at`, `updated_at`

## Utility Functions

### update_updated_at()
- Trigger function that auto-updates updated_at on any row modification.
- Reusable across all tables with an updated_at column.

### handle_new_user()
- Trigger function that auto-creates a profile row when a new auth user signs up.

### handle_new_workspace()
- Trigger function that seeds default navigation items when a workspace is created.
- Creates 7 default items: Dashboard, Tasks, Calendar, Clients, Notes, Files, Vault.

## Security (RLS)
- RLS enabled on ALL tables.
- Owner-scoped policies: each authenticated user can only access their own rows.
- 4 policies per table (SELECT, INSERT, UPDATE, DELETE).
- profiles uses auth.uid() = id (the profile ID IS the user ID).
- All other tables use auth.uid() = user_id.

## Indexes
- workspaces.user_id, navigation_items.workspace_id, folders.workspace_id,
  folders.parent_id, entities.workspace_id, entities.folder_id,
  entities.parent_id, entities.entity_type, entities.user_id.

## Important Notes
1. All owner columns default to auth.uid() so frontend inserts that omit
   user_id still satisfy INSERT RLS policies.
2. Soft delete uses deleted_at (nullable). Queries filter WHERE deleted_at IS NULL.
3. The handle_new_user trigger runs as SECURITY DEFINER to insert into profiles.
4. The handle_new_workspace trigger auto-seeds navigation items for new workspaces.
5. All tables use UUID primary keys via gen_random_uuid().
*/

-- ============================================================
-- UTILITY FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PROFILES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  avatar_url text,
  timezone text DEFAULT 'UTC',
  preferences jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- WORKSPACES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text DEFAULT 'Briefcase',
  color text DEFAULT '#3b82f6',
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  is_archived boolean DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_workspaces" ON workspaces;
CREATE POLICY "select_own_workspaces" ON workspaces FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_workspaces" ON workspaces;
CREATE POLICY "insert_own_workspaces" ON workspaces FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_workspaces" ON workspaces;
CREATE POLICY "update_own_workspaces" ON workspaces FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_workspaces" ON workspaces;
CREATE POLICY "delete_own_workspaces" ON workspaces FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS workspaces_updated_at ON workspaces;
CREATE TRIGGER workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON workspaces(user_id) WHERE deleted_at IS NULL;

-- ============================================================
-- NAVIGATION_ITEMS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS navigation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  label text NOT NULL,
  icon text,
  route text NOT NULL,
  sort_order int DEFAULT 0,
  is_visible boolean DEFAULT true,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE navigation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_navigation_items" ON navigation_items;
CREATE POLICY "select_own_navigation_items" ON navigation_items FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_navigation_items" ON navigation_items;
CREATE POLICY "insert_own_navigation_items" ON navigation_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_navigation_items" ON navigation_items;
CREATE POLICY "update_own_navigation_items" ON navigation_items FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_navigation_items" ON navigation_items;
CREATE POLICY "delete_own_navigation_items" ON navigation_items FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS navigation_items_updated_at ON navigation_items;
CREATE TRIGGER navigation_items_updated_at
  BEFORE UPDATE ON navigation_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_navigation_items_workspace_id ON navigation_items(workspace_id) WHERE is_visible = true;

-- ============================================================
-- FOLDERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text DEFAULT 'Folder',
  sort_order int DEFAULT 0,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_folders" ON folders;
CREATE POLICY "select_own_folders" ON folders FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_folders" ON folders;
CREATE POLICY "insert_own_folders" ON folders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_folders" ON folders;
CREATE POLICY "update_own_folders" ON folders FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_folders" ON folders;
CREATE POLICY "delete_own_folders" ON folders FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS folders_updated_at ON folders;
CREATE TRIGGER folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_folders_workspace_id ON folders(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id) WHERE deleted_at IS NULL;

-- ============================================================
-- ENTITIES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES folders(id) ON DELETE SET NULL,
  parent_id uuid REFERENCES entities(id) ON DELETE CASCADE,
  entity_type text NOT NULL DEFAULT 'Personal',
  name text NOT NULL,
  description text,
  status text,
  metadata jsonb DEFAULT '{}'::jsonb,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_entities" ON entities;
CREATE POLICY "select_own_entities" ON entities FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_entities" ON entities;
CREATE POLICY "insert_own_entities" ON entities FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_entities" ON entities;
CREATE POLICY "update_own_entities" ON entities FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_entities" ON entities;
CREATE POLICY "delete_own_entities" ON entities FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS entities_updated_at ON entities;
CREATE TRIGGER entities_updated_at
  BEFORE UPDATE ON entities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_entities_workspace_id ON entities(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_entities_folder_id ON entities(folder_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_entities_parent_id ON entities(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_entities_entity_type ON entities(entity_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_entities_user_id ON entities(user_id) WHERE deleted_at IS NULL;

-- ============================================================
-- TRIGGER FUNCTIONS
-- ============================================================

-- Auto-create profile when a new auth user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-create default navigation items when a workspace is created
CREATE OR REPLACE FUNCTION handle_new_workspace()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO navigation_items (workspace_id, label, icon, route, sort_order, user_id)
  VALUES
    (NEW.id, 'Dashboard', 'LayoutDashboard', '/dashboard', 1, NEW.user_id),
    (NEW.id, 'Tasks', 'CheckSquare', '/tasks', 2, NEW.user_id),
    (NEW.id, 'Calendar', 'Calendar', '/calendar', 3, NEW.user_id),
    (NEW.id, 'Clients', 'Users', '/clients', 4, NEW.user_id),
    (NEW.id, 'Notes', 'StickyNote', '/notes', 5, NEW.user_id),
    (NEW.id, 'Files', 'FolderOpen', '/files', 6, NEW.user_id),
    (NEW.id, 'Vault', 'Lock', '/vault', 7, NEW.user_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_workspace_created ON workspaces;
CREATE TRIGGER on_workspace_created
  AFTER INSERT ON workspaces
  FOR EACH ROW EXECUTE FUNCTION handle_new_workspace();