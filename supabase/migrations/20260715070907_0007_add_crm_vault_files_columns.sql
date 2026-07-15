-- Phase 6/7/8: Add columns for CRM, Vault, and Files

-- Add 'Contact' to entity types (CHECK constraint update)
ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_entity_type_check;
ALTER TABLE entities ADD CONSTRAINT entities_entity_type_check
  CHECK (entity_type IN ('Client', 'Project', 'Personal', 'Meeting', 'Company', 'Course', 'Contact', 'Custom'));

-- Add vault-specific columns to credentials
ALTER TABLE credentials ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES folders(id) ON DELETE SET NULL;
ALTER TABLE credentials ADD COLUMN IF NOT EXISTS category text DEFAULT 'other';
ALTER TABLE credentials ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false;
ALTER TABLE credentials ADD COLUMN IF NOT EXISTS expiry_date timestamptz;
ALTER TABLE credentials ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_credentials_folder_id ON credentials(folder_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_credentials_is_favorite ON credentials(is_favorite) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_credentials_category ON credentials(category) WHERE deleted_at IS NULL;

-- Add is_favorite to files
ALTER TABLE files ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_files_is_favorite ON files(is_favorite) WHERE deleted_at IS NULL;

-- Create file_tags junction table
CREATE TABLE IF NOT EXISTS file_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE file_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_file_tags" ON file_tags;
CREATE POLICY "select_own_file_tags" ON file_tags FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_file_tags" ON file_tags;
CREATE POLICY "insert_own_file_tags" ON file_tags FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_file_tags" ON file_tags;
CREATE POLICY "update_own_file_tags" ON file_tags FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_file_tags" ON file_tags;
CREATE POLICY "delete_own_file_tags" ON file_tags FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_file_tags_file_id ON file_tags(file_id);
CREATE INDEX IF NOT EXISTS idx_file_tags_tag_id ON file_tags(tag_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_file_tags_unique ON file_tags(file_id, tag_id);

-- Create credential_tags junction table
CREATE TABLE IF NOT EXISTS credential_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL REFERENCES credentials(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE credential_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_credential_tags" ON credential_tags;
CREATE POLICY "select_own_credential_tags" ON credential_tags FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_credential_tags" ON credential_tags;
CREATE POLICY "insert_own_credential_tags" ON credential_tags FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_credential_tags" ON credential_tags;
CREATE POLICY "update_own_credential_tags" ON credential_tags FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_credential_tags" ON credential_tags;
CREATE POLICY "delete_own_credential_tags" ON credential_tags FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_credential_tags_credential_id ON credential_tags(credential_id);
CREATE INDEX IF NOT EXISTS idx_credential_tags_tag_id ON credential_tags(tag_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_credential_tags_unique ON credential_tags(credential_id, tag_id);

-- Create a storage bucket for files (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for the files bucket
CREATE POLICY "files_bucket_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'files' AND auth.uid() = owner);

CREATE POLICY "files_bucket_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'files' AND auth.uid() = owner);

CREATE POLICY "files_bucket_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'files' AND auth.uid() = owner)
  WITH CHECK (bucket_id = 'files' AND auth.uid() = owner);

CREATE POLICY "files_bucket_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'files' AND auth.uid() = owner);
