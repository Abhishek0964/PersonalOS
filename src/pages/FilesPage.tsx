import { useState, useMemo, useRef, useCallback } from 'react';
import {
  Plus, Search, FileText, Image, FileVideo, FileAudio, File, AlertCircle,
  RefreshCw, Inbox, Star, Download, Trash2, Edit3, Upload, FolderOpen,
  Link2, Tag as TagIcon, Loader2, X, Eye, FileCode,
} from 'lucide-react';
import {
  useFiles, useFileTags, useUploadFile, useDeleteFile, useUpdateFile,
  useAssignFileTag, useRemoveFileTag, useGetFileUrl,
} from '../hooks/useFiles';
import { useFolders } from '../hooks/useFolders';
import { useEntities } from '../hooks/useEntities';
import { useTags } from '../hooks/useTags';
import { useWorkspaces } from '../hooks/useWorkspace';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useToastStore } from '../stores/toastStore';
import { formatFileSize, getFileIcon } from '../services/fileService';
import type { FileItem, FileFilters, FileSort } from '../../types/domain';
import { FileViewer } from '../components/files/FileViewer';
import { FolderTree } from '../components/folders/FolderTree';

const SORT_OPTIONS: { value: FileSort['field']; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'created_at', label: 'Date Created' },
  { value: 'updated_at', label: 'Last Updated' },
  { value: 'size_bytes', label: 'File Size' },
];

const MIME_CATEGORIES = [
  { value: 'all', label: 'All Files' },
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Videos' },
  { value: 'audio', label: 'Audio' },
  { value: 'application/pdf', label: 'PDFs' },
  { value: 'text', label: 'Text' },
];

function FileIconByMime({ mimeType, className }: { mimeType: string | null; className?: string }) {
  const type = getFileIcon(mimeType);
  const Icon = type === 'image' ? Image : type === 'video' ? FileVideo : type === 'audio' ? FileAudio
    : type === 'pdf' ? FileText : type === 'text' || type === 'markdown' ? FileCode : File;
  return <Icon className={className} />;
}

export function FilesPage() {
  const { data: workspaces } = useWorkspaces();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const effectiveWsId = activeWorkspaceId ?? workspaces?.[0]?.id ?? null;
  const showToast = useToastStore((s) => s.showToast);

  const [filters, setFilters] = useState<FileFilters>({ search: '', folderId: 'all', mimeType: 'all' });
  const [sort, setSort] = useState<FileSort>({ field: 'created_at', direction: 'desc' });
  const [showFavorites, setShowFavorites] = useState(false);
  const [detailFile, setDetailFile] = useState<FileItem | null>(null);
  const [editingFile, setEditingFile] = useState<FileItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [viewerFile, setViewerFile] = useState<FileItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: files, isLoading, isError, error, refetch } = useFiles(effectiveWsId, {
    filters: { ...filters, isFavorite: showFavorites || undefined },
    sort,
  });
  const uploadFile = useUploadFile();
  const deleteFile = useDeleteFile();

  const handleUpload = useCallback(async (fileList: FileList | File[]) => {
    if (!effectiveWsId) return;
    setUploading(true);
    const items = Array.from(fileList);
    for (const file of items) {
      try {
        await uploadFile.mutateAsync({ workspaceId: effectiveWsId, file });
        showToast('success', `${file.name} uploaded`);
      } catch (err) {
        showToast('error', `Failed to upload ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
    setUploading(false);
  }, [effectiveWsId, uploadFile, showToast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  const handleDelete = async (file: FileItem) => {
    try {
      await deleteFile.mutateAsync({ id: file.id, storagePath: file.storage_path });
      showToast('success', 'File deleted');
      if (detailFile?.id === file.id) setDetailFile(null);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleDownload = async (file: FileItem) => {
    try {
      const { data } = await import('../lib/supabase').then(m => m.supabase.storage.from('files').download(file.storage_path));
      if (!data) throw new Error('Download failed');
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      showToast('success', 'Download started');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to download');
    }
  };

  if (!effectiveWsId) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-6">
        <Inbox className="w-12 h-12 text-gray-600 mb-3" />
        <h2 className="text-lg font-semibold text-white">No Workspace</h2>
        <p className="text-sm text-gray-500 mt-1">Create a workspace to start managing files.</p>
      </div>
    );
  }

  return (
    <div
      className="p-4 sm:p-6 max-w-7xl mx-auto animate-fade-in"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input type="file" ref={fileInputRef} multiple className="hidden" onChange={(e) => { if (e.target.files?.length) handleUpload(e.target.files); e.target.value = ''; }} />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-600/15 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Files</h1>
            <p className="text-xs text-gray-500">Upload, organize, and share files</p>
          </div>
        </div>
        <button onClick={() => fileInputRef.current?.click()} className="btn-primary">
          <Upload className="w-4 h-4" /><span className="hidden sm:inline">Upload</span>
        </button>
      </div>

      {isDragging && (
        <div className="mb-4 rounded-xl border-2 border-dashed border-primary-500/40 bg-primary-600/10 p-8 text-center animate-fade-in">
          <Upload className="w-8 h-8 text-primary-400 mx-auto mb-2" />
          <p className="text-sm text-primary-300">Drop files here to upload</p>
        </div>
      )}

      {uploading && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary-500/30 bg-primary-600/10 px-4 py-2 text-xs text-primary-300">
          <Loader2 className="w-4 h-4 animate-spin" /> Uploading files...
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
        {/* Folder sidebar (large screens only) */}
        <div className="hidden lg:block">
          <FolderTree
            workspaceId={effectiveWsId}
            selectedFolderId={filters.folderId === 'all' ? null : filters.folderId}
            onSelectFolder={(folderId) => setFilters({ ...filters, folderId: folderId ?? 'all' })}
            showAllOption={true}
            allOptionLabel="All Files"
            entityScope="file"
          />
        </div>

        <div>
          {/* Controls */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input type="text" placeholder="Search files..." value={filters.search ?? ''} onChange={(e) => setFilters({ ...filters, search: e.target.value })} className="input-field pl-10 py-2" />
            </div>
            <select value={filters.mimeType ?? 'all'} onChange={(e) => setFilters({ ...filters, mimeType: e.target.value })} className="input-field py-2 w-auto min-w-[120px]">
              {MIME_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select value={sort.field} onChange={(e) => setSort({ ...sort, field: e.target.value as FileSort['field'] })} className="input-field py-2 w-auto min-w-[120px]">
              {SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <button onClick={() => setSort({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' })} className="btn-ghost py-2 px-3">{sort.direction === 'asc' ? '↑' : '↓'}</button>
            <button onClick={() => setShowFavorites(!showFavorites)} className={`btn-ghost py-2 px-3 ${showFavorites ? 'text-warning-400' : ''}`}>
              <Star className={`w-4 h-4 ${showFavorites ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Content */}
          {isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="w-10 h-10 text-error-400 mb-3" />
              <p className="text-sm text-gray-400 mb-1">Failed to load files</p>
              <p className="text-xs text-gray-600 mb-4">{error instanceof Error ? error.message : 'An error occurred'}</p>
              <button onClick={() => refetch()} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Retry</button>
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-surface-400/30 bg-surface-100 p-4">
                  <div className="skeleton w-10 h-10 rounded-lg mb-2" /><div className="skeleton h-3 max-w-32 rounded mb-1" /><div className="skeleton h-2 w-16 rounded" />
                </div>
              ))}
            </div>
          ) : (files ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-surface-200/50 flex items-center justify-center mb-4"><File className="w-7 h-7 text-gray-600" /></div>
              <h3 className="text-base font-medium text-gray-300">{filters.search || showFavorites ? 'No results found' : 'No files yet'}</h3>
              <p className="text-sm text-gray-500 mt-1">{filters.search || showFavorites ? 'Try adjusting your filters.' : 'Upload your first file to get started.'}</p>
              <button onClick={() => fileInputRef.current?.click()} className="btn-primary mt-4"><Upload className="w-4 h-4" /> Upload Files</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {(files ?? []).map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  onClick={() => setViewerFile(file)}
                  onEdit={() => { setEditingFile(file); setShowEditModal(true); }}
                  onDelete={() => handleDelete(file)}
                  onDownload={() => handleDownload(file)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {detailFile && (
        <FileDetailPanel
          file={detailFile}
          workspaceId={effectiveWsId}
          onClose={() => setDetailFile(null)}
          onEdit={() => { setEditingFile(detailFile); setShowEditModal(true); }}
          onDelete={() => handleDelete(detailFile)}
          onDownload={() => handleDownload(detailFile)}
        />
      )}
      {showEditModal && editingFile && (
        <FileEditModal file={editingFile} workspaceId={effectiveWsId} onClose={() => { setShowEditModal(false); setEditingFile(null); }} />
      )}
      {viewerFile && (
        <FileViewer file={viewerFile} workspaceId={effectiveWsId} onClose={() => setViewerFile(null)} />
      )}
    </div>
  );
}

function FileCard({ file, onClick, onEdit, onDelete, onDownload }: {
  file: FileItem; onClick: () => void; onEdit: () => void; onDelete: () => void; onDownload: () => void;
}) {
  const updateFile = useUpdateFile();
  const showToast = useToastStore((s) => s.showToast);

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try { await updateFile.mutateAsync({ id: file.id, updates: { is_favorite: !file.is_favorite } }); }
    catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed to update'); }
  };

  return (
    <div onClick={onClick} className="group relative rounded-xl border border-surface-400/30 bg-surface-100 p-4 cursor-pointer hover:border-surface-400/50 hover:bg-surface-200/30 transition-all">
      <div className="flex items-start gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-primary-600/15 flex items-center justify-center shrink-0">
          <FileIconByMime mimeType={file.mime_type} className="w-5 h-5 text-primary-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-gray-100 truncate">{file.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{formatFileSize(file.size_bytes)}</p>
        </div>
        <button onClick={handleToggleFavorite} className={`p-1 transition-colors ${file.is_favorite ? 'text-warning-400' : 'text-gray-600 hover:text-warning-400'}`}>
          <Star className={`w-3.5 h-3.5 ${file.is_favorite ? 'fill-current' : ''}`} />
        </button>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); onDownload(); }} className="p-1 text-gray-500 hover:text-gray-300 transition-colors" title="Download"><Download className="w-3.5 h-3.5" /></button>
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1 text-gray-500 hover:text-gray-300 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-gray-500 hover:text-error-400 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}

function FileDetailPanel({ file, workspaceId, onClose, onEdit, onDelete, onDownload }: {
  file: FileItem; workspaceId: string; onClose: () => void; onEdit: () => void; onDelete: () => void; onDownload: () => void;
}) {
  const { data: tags } = useFileTags(file.id);
  const { data: folders } = useFolders(workspaceId);
  const { data: entities } = useEntities(workspaceId);
  const { data: allTags } = useTags(workspaceId);
  const assignTag = useAssignFileTag();
  const removeTag = useRemoveFileTag();
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const getUrl = useGetFileUrl();
  const showToast = useToastStore((s) => s.showToast);

  useMemo(() => {
    if (tags) setSelectedTagIds(new Set(tags.map((t) => t.id)));
  }, [tags]);

  useEffect(() => {
    if (file.mime_type?.startsWith('image/')) {
      getUrl.mutate(file, {
        onSuccess: (url) => setPreviewUrl(url),
        onError: () => setPreviewUrl(null),
      });
    }
  }, [file]);

  const toggleTag = async (tagId: string) => {
    const next = new Set(selectedTagIds);
    try {
      if (next.has(tagId)) { await removeTag.mutateAsync({ fileId: file.id, tagId }); next.delete(tagId); }
      else { await assignTag.mutateAsync({ fileId: file.id, tagId }); next.add(tagId); }
      setSelectedTagIds(next);
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed to update tags'); }
  };

  const linkedFolder = (folders ?? []).find((f) => f.id === file.folder_id);
  const linkedEntity = (entities ?? []).find((e) => e.id === file.entity_id);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-surface-0/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-surface-50 border-l border-surface-400/30 overflow-y-auto animate-slide-down" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-surface-400/30 sticky top-0 bg-surface-50 z-10">
          <h2 className="text-base font-semibold text-white truncate flex-1">File Details</h2>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onDownload} className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded" title="Download"><Download className="w-4 h-4" /></button>
            <button onClick={onEdit} className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded" title="Edit"><Edit3 className="w-4 h-4" /></button>
            <button onClick={onDelete} className="text-gray-500 hover:text-error-400 transition-colors p-1.5 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="p-4 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-600/15 flex items-center justify-center shrink-0">
              <FileIconByMime mimeType={file.mime_type} className="w-6 h-6 text-primary-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-white truncate">{file.name}</h3>
              <p className="text-xs text-gray-500">{file.mime_type ?? 'Unknown type'}</p>
            </div>
          </div>

          {previewUrl && (
            <div className="rounded-lg border border-surface-400/30 overflow-hidden">
              <img src={previewUrl} alt={file.name} className="w-full max-h-64 object-contain bg-surface-200/30" />
            </div>
          )}

          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Size</span><span className="text-gray-300">{formatFileSize(file.size_bytes)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="text-gray-300">{file.mime_type ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Created</span><span className="text-gray-300">{new Date(file.created_at).toLocaleDateString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Modified</span><span className="text-gray-300">{new Date(file.updated_at).toLocaleDateString()}</span></div>
          </div>

          {linkedFolder && (
            <div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5"><FolderOpen className="w-3.5 h-3.5" /> Folder</div>
              <div className="flex items-center gap-2 rounded-lg border border-surface-400/30 bg-surface-200/30 px-3 py-2">
                <span className="text-sm text-gray-200">{linkedFolder.name}</span>
              </div>
            </div>
          )}

          {linkedEntity && (
            <div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5"><Link2 className="w-3.5 h-3.5" /> Linked Entity</div>
              <div className="flex items-center gap-2 rounded-lg border border-surface-400/30 bg-surface-200/30 px-3 py-2">
                <span className="badge bg-primary-600/15 text-primary-300">{linkedEntity.entity_type}</span>
                <span className="text-sm text-gray-200">{linkedEntity.name}</span>
              </div>
            </div>
          )}

          {(allTags ?? []).length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5"><TagIcon className="w-3.5 h-3.5" /> Tags</div>
              <div className="flex flex-wrap gap-2">
                {(allTags ?? []).map((tag) => {
                  const isSelected = selectedTagIds.has(tag.id);
                  return (
                    <button key={tag.id} onClick={() => toggleTag(tag.id)}
                      className={`badge transition-all ${isSelected ? 'ring-1 ring-primary-500/30' : 'bg-surface-200/50 text-gray-400 hover:bg-surface-300'}`}
                      style={isSelected ? { backgroundColor: (tag.color ?? '#3b82f6') + '20', color: tag.color ?? '#3b82f6' } : undefined}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color ?? '#6b7280' }} />{tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FileEditModal({ file, workspaceId, onClose }: { file: FileItem; workspaceId: string; onClose: () => void }) {
  const updateFile = useUpdateFile();
  const showToast = useToastStore((s) => s.showToast);
  const { data: folders } = useFolders(workspaceId);
  const { data: entities } = useEntities(workspaceId);
  const [name, setName] = useState(file.name);
  const [folderId, setFolderId] = useState(file.folder_id ?? '');
  const [entityId, setEntityId] = useState(file.entity_id ?? '');

  const handleSave = async () => {
    try {
      await updateFile.mutateAsync({
        id: file.id,
        updates: {
          name,
          folder_id: folderId || null,
          entity_id: entityId || null,
        },
      });
      showToast('success', 'File updated');
      onClose();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-0/70 backdrop-blur-sm animate-fade-in p-4">
      <div className="w-full max-w-md rounded-2xl border border-surface-400/40 bg-surface-100 shadow-elevated animate-scale-in">
        <div className="flex items-center justify-between p-5 border-b border-surface-400/30">
          <h2 className="text-lg font-semibold text-white">Edit File</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5"><FolderOpen className="w-3.5 h-3.5" /> Folder</label>
            <select value={folderId} onChange={(e) => setFolderId(e.target.value)} className="input-field">
              <option value="">No folder</option>
              {(folders ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" /> Entity</label>
            <select value={entityId} onChange={(e) => setEntityId(e.target.value)} className="input-field">
              <option value="">No entity</option>
              {(entities ?? []).map((e) => <option key={e.id} value={e.id}>{e.name} ({e.entity_type})</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} disabled={updateFile.isPending} className="btn-primary flex-1">
              {updateFile.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
