import { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import {
  Plus, StickyNote, Search, Pin, Trash2, Edit3, AlertCircle, RefreshCw,
  Inbox, Clock, Link2, Folder,
} from 'lucide-react';
import { useNotes, useNote, useDeleteNote, useTogglePin, useNoteTags } from '../hooks/useNotes';
import { useWorkspaces } from '../hooks/useWorkspace';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useToastStore } from '../stores/toastStore';
import { useLogActivity } from '../hooks/useActivityLogs';
import type { Note, NoteFilters, NoteSort } from '../../types/domain';
import { NoteFormModal } from '../components/notes/NoteFormModal';
import { FolderTree } from '../components/folders/FolderTree';

const NoteEditor = lazy(() => import('../components/notes/NoteEditor').then(m => ({ default: m.NoteEditor })));

const SORT_OPTIONS: { value: NoteSort['field']; label: string }[] = [
  { value: 'updated_at', label: 'Last Updated' },
  { value: 'created_at', label: 'Date Created' },
  { value: 'title', label: 'Title' },
  { value: 'is_pinned', label: 'Pinned First' },
];

export function NotesPage() {
  const { data: workspaces } = useWorkspaces();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const effectiveWsId = activeWorkspaceId ?? workspaces?.[0]?.id ?? null;
  const showToast = useToastStore((s) => s.showToast);

  const [filters, setFilters] = useState<NoteFilters>({ search: '', folderId: 'all' });
  const [sort, setSort] = useState<NoteSort>({ field: 'is_pinned', direction: 'desc' });
  const [showCreate, setShowCreate] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const { data: notes, isLoading, isError, error, refetch } = useNotes(effectiveWsId, { filters, sort });
  const { data: selectedNote } = useNote(selectedNoteId);

  const handleDelete = async (note: Note) => {
    try {
      await deleteNote.mutateAsync(note.id);
      logActivity.mutate({
        workspace_id: effectiveWsId!,
        entity_id: null,
        action: 'deleted',
        entity_type: 'note',
        metadata: { title: note.title },
      });
      showToast('success', 'Note deleted');
      if (selectedNoteId === note.id) setSelectedNoteId(null);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete note');
    }
  };

  const handleTogglePin = async (note: Note) => {
    try {
      await togglePin.mutateAsync({ id: note.id, isPinned: !note.is_pinned });
      showToast('success', note.is_pinned ? 'Unpinned' : 'Pinned');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update note');
    }
  };

  const deleteNote = useDeleteNote();
  const togglePin = useTogglePin();
  const logActivity = useLogActivity();

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const stripHtml = (html: string): string => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  if (!effectiveWsId) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-6">
        <Inbox className="w-12 h-12 text-gray-600 mb-3" />
        <h2 className="text-lg font-semibold text-white">No Workspace</h2>
        <p className="text-sm text-gray-500 mt-1">Create a workspace to start managing notes.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-600/15 flex items-center justify-center">
            <StickyNote className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Notes</h1>
            <p className="text-xs text-gray-500">Rich text notes with autosave</p>
          </div>
        </div>
        <button onClick={() => { setEditingNote(null); setShowCreate(true); }} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Note</span>
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search notes..."
            value={filters.search ?? ''}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="input-field pl-10 py-2"
          />
        </div>
        <select
          value={sort.field}
          onChange={(e) => setSort({ ...sort, field: e.target.value as NoteSort['field'] })}
          className="input-field py-2 w-auto min-w-[140px]"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          onClick={() => setSort({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' })}
          className="btn-ghost py-2 px-3"
          title={sort.direction === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sort.direction === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_380px_1fr] gap-4">
        {/* Folder tree */}
        <div className="hidden lg:block">
          <FolderTree
            workspaceId={effectiveWsId}
            selectedFolderId={filters.folderId === 'all' ? null : filters.folderId}
            onSelectFolder={(folderId) => setFilters({ ...filters, folderId: folderId ?? 'all' })}
            showAllOption={true}
            allOptionLabel="All Notes"
            entityScope="note"
          />
        </div>

        {/* Notes list */}
        <div className="space-y-2">
          {isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="w-10 h-10 text-error-400 mb-3" />
              <p className="text-sm text-gray-400 mb-1">Failed to load notes</p>
              <p className="text-xs text-gray-600 mb-4">{error instanceof Error ? error.message : 'An error occurred'}</p>
              <button onClick={() => refetch()} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Retry</button>
            </div>
          ) : isLoading ? (
            <NotesListSkeleton />
          ) : (notes ?? []).length === 0 ? (
            <EmptyState
              hasFilters={!!(filters.search && filters.search.trim())}
              onClearFilters={() => setFilters({ search: '', folderId: 'all' })}
              onCreate={() => { setEditingNote(null); setShowCreate(true); }}
            />
          ) : (
            <>
              {(notes ?? []).map((note) => (
                <NoteListItem
                  key={note.id}
                  note={note}
                  selected={selectedNoteId === note.id}
                  onClick={() => setSelectedNoteId(note.id)}
                  onEdit={() => { setEditingNote(note); setShowCreate(true); }}
                  onDelete={() => handleDelete(note)}
                  onTogglePin={() => handleTogglePin(note)}
                  formatDate={formatDate}
                  stripHtml={stripHtml}
                />
              ))}
            </>
          )}
        </div>

        {/* Editor panel */}
        <div className="hidden lg:block">
          {selectedNote ? (
            <div className="rounded-xl border border-surface-400/40 bg-surface-50 h-[calc(100vh-220px)] sticky top-4 overflow-hidden">
              <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="skeleton w-6 h-6 rounded-full" /></div>}>
                <NoteEditor note={selectedNote} workspaceId={effectiveWsId} />
              </Suspense>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-220px)] text-center">
              <StickyNote className="w-10 h-10 text-gray-600 mb-3" />
              <p className="text-sm text-gray-500">Select a note to start editing</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <NoteFormModal
          workspaceId={effectiveWsId}
          note={editingNote}
          onClose={() => { setShowCreate(false); setEditingNote(null); }}
          onSaved={(n) => setSelectedNoteId(n.id)}
        />
      )}
    </div>
  );
}

interface NoteListItemProps {
  note: Note;
  selected: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  formatDate: (d: string) => string;
  stripHtml: (html: string) => string;
}

function NoteListItem({ note, selected, onClick, onEdit, onDelete, onTogglePin, formatDate, stripHtml }: NoteListItemProps) {
  const { data: tags } = useNoteTags(note.id);
  const preview = useMemo(() => {
    const text = stripHtml(note.content ?? '');
    return text.length > 100 ? text.slice(0, 100) + '...' : text;
  }, [note.content, stripHtml]);

  return (
    <div
      onClick={onClick}
      className={`group relative rounded-lg border p-3 cursor-pointer transition-all ${
        selected
          ? 'border-primary-500/40 bg-primary-600/5'
          : 'border-surface-400/30 bg-surface-100 hover:bg-surface-200/50 hover:border-surface-400/50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {note.is_pinned && <Pin className="w-3.5 h-3.5 text-primary-400 shrink-0" />}
          <h3 className="text-sm font-medium text-gray-100 truncate">{note.title}</h3>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); onTogglePin(); }} className="p-1 text-gray-500 hover:text-primary-400 transition-colors" title={note.is_pinned ? 'Unpin' : 'Pin'}>
            <Pin className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1 text-gray-500 hover:text-gray-300 transition-colors" title="Edit">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-gray-500 hover:text-error-400 transition-colors" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {preview && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{preview}</p>}

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className="flex items-center gap-1 text-[10px] text-gray-600">
          <Clock className="w-2.5 h-2.5" /> {formatDate(note.updated_at)}
        </span>
        {(tags ?? []).slice(0, 3).map((tag) => (
          <span key={tag.id} className="badge text-[10px]" style={{ backgroundColor: (tag.color ?? '#6b7280') + '20', color: tag.color ?? '#6b7280' }}>
            {tag.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function NotesListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-surface-400/30 bg-surface-100 p-3">
          <div className="skeleton h-4 max-w-48 rounded mb-2" />
          <div className="skeleton h-3 w-full rounded" />
          <div className="flex gap-2 mt-2">
            <div className="skeleton h-3 w-16 rounded" />
            <div className="skeleton h-3 w-12 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ hasFilters, onClearFilters, onCreate }: { hasFilters: boolean; onClearFilters: () => void; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-surface-200/50 flex items-center justify-center mb-4">
        <StickyNote className="w-7 h-7 text-gray-600" />
      </div>
      <h3 className="text-base font-medium text-gray-300">{hasFilters ? 'No notes match your search' : 'No notes yet'}</h3>
      <p className="text-sm text-gray-500 mt-1 max-w-sm">
        {hasFilters ? 'Try adjusting your search.' : 'Create your first note to get started.'}
      </p>
      <div className="flex gap-2 mt-4">
        {hasFilters && <button onClick={onClearFilters} className="btn-secondary">Clear Search</button>}
        <button onClick={onCreate} className="btn-primary"><Plus className="w-4 h-4" /> New Note</button>
      </div>
    </div>
  );
}
