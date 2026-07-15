import { supabase } from '../lib/supabase';
import type {
  FileItem,
  FileItemInsert,
  FileItemUpdate,
  FileFilters,
  FileSort,
} from '../types/domain';
import type { Tag } from '../types/domain';

const BUCKET_NAME = 'files';

export async function fetchFiles(
  workspaceId: string,
  options?: { filters?: FileFilters; sort?: FileSort }
): Promise<FileItem[]> {
  const { filters = {}, sort = { field: 'created_at', direction: 'desc' } } = options ?? {};
  let query = supabase
    .from('files')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null);

  if (filters.search && filters.search.trim()) {
    query = query.or(`name.ilike.%${filters.search}%`);
  }
  if (filters.folderId && filters.folderId !== 'all') {
    if (filters.folderId === 'unassigned') query = query.is('folder_id', null);
    else query = query.eq('folder_id', filters.folderId);
  }
  if (filters.entityId && filters.entityId !== 'all') {
    query = query.eq('entity_id', filters.entityId);
  }
  if (filters.isFavorite !== undefined) query = query.eq('is_favorite', filters.isFavorite);
  if (filters.mimeType && filters.mimeType !== 'all') {
    query = query.ilike('mime_type', `${filters.mimeType}%`);
  }

  const ascending = sort.direction === 'asc';
  query = query.order(sort.field, { ascending });
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as FileItem[];
}

export async function fetchRecentFiles(workspaceId: string, limit = 10): Promise<FileItem[]> {
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as FileItem[];
}

export async function fetchFileById(id: string): Promise<FileItem | null> {
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data as FileItem | null;
}

export async function uploadFile(
  workspaceId: string,
  file: File,
  options?: { folderId?: string | null; entityId?: string | null }
): Promise<FileItem> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const ext = file.name.split('.').pop() ?? '';
  const uniqueName = `${crypto.randomUUID()}.${ext}`;
  const storagePath = `${workspaceId}/${uniqueName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file, { upsert: false });

  if (uploadError) throw uploadError;

  const insert: FileItemInsert = {
    workspace_id: workspaceId,
    folder_id: options?.folderId ?? null,
    entity_id: options?.entityId ?? null,
    name: file.name,
    storage_path: storagePath,
    mime_type: file.type || 'application/octet-stream',
    size_bytes: file.size,
  };

  const { data, error } = await supabase
    .from('files')
    .insert(insert)
    .select()
    .single();
  if (error) throw error;
  return data as FileItem;
}

export async function downloadFile(file: FileItem): Promise<Blob> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(file.storage_path);
  if (error) throw error;
  return data as Blob;
}

export async function getFileUrl(file: FileItem): Promise<string> {
  const { data } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(file.storage_path, 3600);
  return data?.signedUrl ?? '';
}

export async function renameFile(id: string, newName: string): Promise<FileItem> {
  const { data, error } = await supabase
    .from('files')
    .update({ name: newName })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as FileItem;
}

export async function updateFile(id: string, updates: FileItemUpdate): Promise<FileItem> {
  const { data, error } = await supabase
    .from('files')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as FileItem;
}

export async function softDeleteFile(id: string, storagePath: string): Promise<void> {
  const { error: dbError } = await supabase
    .from('files')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (dbError) throw dbError;
  // Also remove from storage
  await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
}

export async function toggleFileFavorite(id: string, isFavorite: boolean): Promise<void> {
  const { error } = await supabase
    .from('files')
    .update({ is_favorite: isFavorite })
    .eq('id', id);
  if (error) throw error;
}

// Tag operations
export async function fetchTagsForFile(fileId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('file_tags')
    .select('tag_id, tags(id, name, color)')
    .eq('file_id', fileId);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{ tags: Tag }>).map((row) => row.tags);
}

export async function assignTagToFile(fileId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('file_tags')
    .insert({ file_id: fileId, tag_id: tagId });
  if (error && error.code !== '23505') throw error;
}

export async function removeTagFromFile(fileId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('file_tags')
    .delete()
    .eq('file_id', fileId)
    .eq('tag_id', tagId);
  if (error) throw error;
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function getFileIcon(mimeType: string | null): string {
  if (!mimeType) return 'file';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('markdown')) return 'markdown';
  if (mimeType.startsWith('text/')) return 'text';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'spreadsheet';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
  return 'file';
}
