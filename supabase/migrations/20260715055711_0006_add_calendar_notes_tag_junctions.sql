-- Add task_id to calendar_events for task relationships
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_task_id ON calendar_events(task_id) WHERE deleted_at IS NULL;

-- Create calendar_event_tags junction table (events use entity_tags via entity_id,
-- but events are not entities, so we need a dedicated junction)
CREATE TABLE IF NOT EXISTS calendar_event_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_event_id uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE calendar_event_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_calendar_event_tags" ON calendar_event_tags;
CREATE POLICY "select_own_calendar_event_tags" ON calendar_event_tags FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_calendar_event_tags" ON calendar_event_tags;
CREATE POLICY "insert_own_calendar_event_tags" ON calendar_event_tags FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_calendar_event_tags" ON calendar_event_tags;
CREATE POLICY "update_own_calendar_event_tags" ON calendar_event_tags FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_calendar_event_tags" ON calendar_event_tags;
CREATE POLICY "delete_own_calendar_event_tags" ON calendar_event_tags FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_calendar_event_tags_event_id ON calendar_event_tags(calendar_event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_event_tags_tag_id ON calendar_event_tags(tag_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_event_tags_unique ON calendar_event_tags(calendar_event_id, tag_id);

-- Create note_tags junction table (notes are not entities, need dedicated junction)
CREATE TABLE IF NOT EXISTS note_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE note_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_note_tags" ON note_tags;
CREATE POLICY "select_own_note_tags" ON note_tags FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_note_tags" ON note_tags;
CREATE POLICY "insert_own_note_tags" ON note_tags FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_note_tags" ON note_tags;
CREATE POLICY "update_own_note_tags" ON note_tags FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_note_tags" ON note_tags;
CREATE POLICY "delete_own_note_tags" ON note_tags FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_note_tags_note_id ON note_tags(note_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id ON note_tags(tag_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_note_tags_unique ON note_tags(note_id, tag_id);
