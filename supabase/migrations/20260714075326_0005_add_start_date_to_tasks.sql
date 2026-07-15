-- Add start_date column to tasks table
-- Required by Phase 3 Task Management: start date support for tasks

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date timestamptz;

CREATE INDEX IF NOT EXISTS idx_tasks_start_date ON tasks(start_date) WHERE deleted_at IS NULL;
