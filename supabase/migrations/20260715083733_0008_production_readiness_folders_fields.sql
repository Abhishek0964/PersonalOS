-- Production readiness: add color/favorite to folders, expand field types, add entity_folder auto-creation support

-- Add color and is_favorite to folders
ALTER TABLE folders ADD COLUMN IF NOT EXISTS color text DEFAULT '#6b7280';
ALTER TABLE folders ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_folders_is_favorite ON folders(is_favorite) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id) WHERE deleted_at IS NULL;

-- Expand custom_fields field_type to support more types
ALTER TABLE custom_fields DROP CONSTRAINT IF EXISTS custom_fields_field_type_check;
ALTER TABLE custom_fields ADD CONSTRAINT custom_fields_field_type_check
  CHECK (field_type IN ('text', 'number', 'date', 'select', 'boolean', 'email', 'phone', 'url', 'currency', 'textarea', 'multiselect'));

-- Add entity_id to folders so folders can be owned by an entity
ALTER TABLE folders ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES entities(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_folders_entity_id ON folders(entity_id) WHERE deleted_at IS NULL;
