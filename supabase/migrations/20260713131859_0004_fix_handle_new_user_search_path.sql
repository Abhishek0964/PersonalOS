/*
# Fix handle_new_user search_path to resolve signup 500 error

## Problem
The `handle_new_user()` trigger function on `auth.users` was failing during
real user signups via the Supabase Auth API, causing a 500 error:
"Database error saving new user".

## Root Cause
The `supabase_auth_admin` role (which executes triggers on `auth.users` during
the GoTrue signup flow) has `search_path=auth` as its role configuration.

The original `handle_new_user()` function body contained an unqualified
`INSERT INTO profiles ...`. When executed by `supabase_auth_admin`, PostgreSQL
resolves `profiles` using the search_path `auth`, looking for `auth.profiles`.
That table does not exist — only `public.profiles` exists. This causes a
"relation does not exist" error, which aborts the user creation transaction,
resulting in the 500 error.

When tested via `execute_sql` (which runs as `postgres` with `search_path =
"$user", public, extensions`), the unqualified `profiles` resolves correctly
to `public.profiles`, which is why the trigger appeared to work in testing
but failed in production.

## Fix
1. Recreate `handle_new_user()` with `SET search_path = public, auth` inside
   the function body so it always resolves `profiles` to `public.profiles`
   regardless of the calling role's search_path.
2. Apply the same fix to `handle_new_workspace()` which also uses unqualified
   table references (`navigation_items`) and could fail for the same reason
   if executed in a restricted search_path context.
3. Drop and recreate the trigger on `auth.users` to bind to the updated function.

## No schema changes
No tables, columns, constraints, or RLS policies are changed. Only the two
trigger function bodies are updated with an explicit `SET search_path`.
*/

-- ============================================================
-- Fix handle_new_user: add explicit search_path
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop and recreate the trigger to bind to the updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Fix handle_new_workspace: add explicit search_path
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.navigation_items (workspace_id, label, icon, route, sort_order, user_id)
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
$$;
