import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Folder as FolderIcon,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Edit3,
  Star,
  MoreVertical,
  X,
} from 'lucide-react';
import { useFolders, useCreateFolder, useUpdateFolder, useDeleteFolder, useMoveFolder } from '../../hooks/useFolders';
import { buildFolderTree, flattenFolderTree, getDescendantFolderIds } from '../../lib/tree';
import { useToastStore } from '../../stores/toastStore';
import { resolveIcon } from '../../lib/icons';
import type { Folder, FolderNode } from '../../types/domain';

export interface FolderTreeProps {
  workspaceId: string;
  selectedFolderId?: string | null;
  onSelectFolder?: (folderId: string | null) => void;
  showAllOption?: boolean;
  allOptionLabel?: string;
  entityScope?: string;
  className?: string;
}

const PRESET_COLORS = [
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
];

export function FolderTree({
  workspaceId,
  selectedFolderId,
  onSelectFolder,
  showAllOption = false,
  allOptionLabel = 'All',
  entityScope,
  className,
}: FolderTreeProps) {
  const { data: folders, isLoading, isError, error } = useFolders(workspaceId);
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();
  const moveFolder = useMoveFolder();
  const showToast = useToastStore((s) => s.showToast);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const menuRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  // Filter folders by entityScope if provided
  const scopedFolders = useMemo(() => {
    if (!folders) return [];
    if (!entityScope) return folders;
    return folders.filter((f) => f.entity_id === entityScope);
  }, [folders, entityScope]);

  const tree = useMemo(() => buildFolderTree(scopedFolders), [scopedFolders]);

  // Close menus when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setColorPickerId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus rename input when active
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // Focus new folder input when active
  useEffect(() => {
    if (creating && newFolderInputRef.current) {
      newFolderInputRef.current.focus();
    }
  }, [creating]);

  const toggleExpand = useCallback((folderId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (folderId: string | null) => {
      onSelectFolder?.(folderId);
    },
    [onSelectFolder],
  );

  const handleStartRename = useCallback((folder: Folder) => {
    setRenamingId(folder.id);
    setRenameValue(folder.name);
    setMenuOpenId(null);
  }, []);

  const handleCommitRename = useCallback(async () => {
    if (!renamingId) return;
    const trimmed = renameValue.trim();
    const folder = scopedFolders.find((f) => f.id === renamingId);
    if (!folder) {
      setRenamingId(null);
      return;
    }
    if (!trimmed || trimmed === folder.name) {
      setRenamingId(null);
      return;
    }
    try {
      await updateFolder.mutateAsync({ id: renamingId, updates: { name: trimmed } });
      showToast('success', 'Folder renamed');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to rename folder');
    } finally {
      setRenamingId(null);
    }
  }, [renamingId, renameValue, scopedFolders, updateFolder, showToast]);

  const handleCancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameValue('');
  }, []);

  const handleDelete = useCallback(
    async (folder: Folder) => {
      setMenuOpenId(null);
      try {
        await deleteFolder.mutateAsync(folder.id);
        showToast('success', 'Folder deleted');
        if (selectedFolderId === folder.id) {
          handleSelect(null);
        }
      } catch (err) {
        showToast('error', err instanceof Error ? err.message : 'Failed to delete folder');
      }
    },
    [deleteFolder, showToast, selectedFolderId, handleSelect],
  );

  const handleToggleFavorite = useCallback(
    async (folder: Folder) => {
      setMenuOpenId(null);
      try {
        await updateFolder.mutateAsync({
          id: folder.id,
          updates: { is_favorite: !folder.is_favorite },
        });
        showToast('success', folder.is_favorite ? 'Removed from favorites' : 'Added to favorites');
      } catch (err) {
        showToast('error', err instanceof Error ? err.message : 'Failed to update folder');
      }
    },
    [updateFolder, showToast],
  );

  const handleColorChange = useCallback(
    async (folder: Folder, color: string) => {
      setColorPickerId(null);
      try {
        await updateFolder.mutateAsync({ id: folder.id, updates: { color } });
        showToast('success', 'Folder color updated');
      } catch (err) {
        showToast('error', err instanceof Error ? err.message : 'Failed to update color');
      }
    },
    [updateFolder, showToast],
  );

  // Drag & drop
  const handleDragStart = useCallback((e: React.DragEvent, folderId: string) => {
    e.dataTransfer.setData('text/folder-id', folderId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, folderId: string) => {
      const draggedId = e.dataTransfer.getData('text/folder-id');
      if (!draggedId || draggedId === folderId) return;
      // Prevent dropping into own descendant
      const descendants = getDescendantFolderIds(scopedFolders, draggedId);
      if (descendants.includes(folderId)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverId(folderId);
    },
    [scopedFolders],
  );

  const handleDragLeave = useCallback((_e: React.DragEvent, folderId: string) => {
    setDragOverId((prev) => (prev === folderId ? null : prev));
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetFolderId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverId(null);
      const draggedId = e.dataTransfer.getData('text/folder-id');
      if (!draggedId || draggedId === targetFolderId) return;
      const descendants = getDescendantFolderIds(scopedFolders, draggedId);
      if (descendants.includes(targetFolderId)) {
        showToast('warning', 'Cannot move a folder into its own descendant');
        return;
      }
      const draggedFolder = scopedFolders.find((f) => f.id === draggedId);
      if (draggedFolder && draggedFolder.parent_id === targetFolderId) return; // already there
      try {
        await moveFolder.mutateAsync({ id: draggedId, parentId: targetFolderId });
        // Expand the target so the moved folder is visible
        setExpandedIds((prev) => new Set(prev).add(targetFolderId));
        showToast('success', 'Folder moved');
      } catch (err) {
        showToast('error', err instanceof Error ? err.message : 'Failed to move folder');
      }
    },
    [scopedFolders, moveFolder, showToast],
  );

  const handleRootDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverId(null);
      const draggedId = e.dataTransfer.getData('text/folder-id');
      if (!draggedId) return;
      const draggedFolder = scopedFolders.find((f) => f.id === draggedId);
      if (draggedFolder && !draggedFolder.parent_id) return; // already at root
      try {
        await moveFolder.mutateAsync({ id: draggedId, parentId: null });
        showToast('success', 'Folder moved to root');
      } catch (err) {
        showToast('error', err instanceof Error ? err.message : 'Failed to move folder');
      }
    },
    [scopedFolders, moveFolder, showToast],
  );

  const handleCreateFolder = useCallback(async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setCreating(false);
      setNewName('');
      return;
    }
    try {
      await createFolder.mutateAsync({
        workspace_id: workspaceId,
        name: trimmed,
        entity_id: entityScope ?? null,
      });
      showToast('success', 'Folder created');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to create folder');
    } finally {
      setCreating(false);
      setNewName('');
    }
  }, [newName, createFolder, workspaceId, entityScope, showToast]);

  const renderNode = useCallback(
    (node: FolderNode): React.ReactNode => {
      const { folder, children, depth } = node;
      const isExpanded = expandedIds.has(folder.id);
      const isSelected = selectedFolderId === folder.id;
      const isRenaming = renamingId === folder.id;
      const isDragOver = dragOverId === folder.id;
      const hasChildren = children.length > 0;
      const FolderGlyph = isExpanded ? FolderOpen : FolderIcon;
      const CustomIcon = folder.icon ? resolveIcon(folder.icon) : null;
      const Icon = CustomIcon ?? FolderGlyph;

      return (
        <div key={folder.id}>
          <div
            draggable={!isRenaming}
            onDragStart={(e) => handleDragStart(e, folder.id)}
            onDragOver={(e) => handleDragOver(e, folder.id)}
            onDragLeave={(e) => handleDragLeave(e, folder.id)}
            onDrop={(e) => handleDrop(e, folder.id)}
            onClick={() => handleSelect(folder.id)}
            onDoubleClick={() => handleStartRename(folder)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenuOpenId(folder.id);
            }}
            style={{ paddingLeft: `${depth * 16}px` }}
            className={`group flex items-center gap-1 rounded-md py-1.5 pr-1.5 cursor-pointer transition-all ${
              isSelected
                ? 'bg-primary-600/15 text-primary-300'
                : 'text-gray-300 hover:bg-surface-200/50'
            } ${isDragOver ? 'ring-1 ring-primary-500/40 bg-primary-600/10' : ''}`}
          >
            {/* Expand/collapse toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(folder.id);
              }}
              className={`shrink-0 rounded p-0.5 text-gray-500 hover:text-gray-300 transition-colors ${
                hasChildren ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              tabIndex={hasChildren ? 0 : -1}
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Color dot */}
            <span
              className="shrink-0 w-2 h-2 rounded-full"
              style={{ backgroundColor: folder.color || '#6b7280' }}
            />

            {/* Folder icon */}
            <Icon className="shrink-0 w-4 h-4 text-gray-400" />

            {/* Name or rename input */}
            {isRenaming ? (
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleCommitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommitRename();
                  if (e.key === 'Escape') handleCancelRename();
                }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-w-0 rounded bg-surface-200 px-1.5 py-0.5 text-sm text-gray-100 border border-primary-500/40 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
              />
            ) : (
              <span className="flex-1 min-w-0 truncate text-sm">{folder.name}</span>
            )}

            {/* Favorite star */}
            {folder.is_favorite && (
              <Star className="shrink-0 w-3.5 h-3.5 text-warning-400 fill-current" />
            )}

            {/* More menu trigger */}
            {!isRenaming && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId((prev) => (prev === folder.id ? null : folder.id));
                }}
                className="shrink-0 rounded p-0.5 text-gray-500 opacity-0 group-hover:opacity-100 hover:text-gray-200 hover:bg-surface-300 transition-all"
                title="Folder actions"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Context menu */}
            {menuOpenId === folder.id && (
              <div
                ref={menuRef}
                className="absolute z-30 mt-1 ml-2 rounded-lg border border-surface-400/50 bg-surface-100 shadow-elevated py-1 min-w-[160px] animate-fade-in"
                style={{ top: '100%', left: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => handleStartRename(folder)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-300 hover:bg-surface-200 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Rename
                </button>
                <button
                  onClick={() => handleToggleFavorite(folder)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-300 hover:bg-surface-200 transition-colors"
                >
                  <Star className={`w-3.5 h-3.5 ${folder.is_favorite ? 'fill-current text-warning-400' : ''}`} />
                  {folder.is_favorite ? 'Unfavorite' : 'Favorite'}
                </button>
                <button
                  onClick={() => {
                    setColorPickerId(folder.id);
                    setMenuOpenId(null);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-300 hover:bg-surface-200 transition-colors"
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-surface-400/60"
                    style={{ backgroundColor: folder.color || '#6b7280' }}
                  />
                  Color
                </button>
                <div className="my-1 border-t border-surface-400/40" />
                <button
                  onClick={() => handleDelete(folder)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-error-400 hover:bg-error-600/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            )}

            {/* Color picker popover */}
            {colorPickerId === folder.id && (
              <div
                ref={colorPickerRef}
                className="absolute z-30 mt-1 rounded-lg border border-surface-400/50 bg-surface-100 shadow-elevated p-2 animate-fade-in"
                style={{ top: '100%', left: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-1.5">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleColorChange(folder, color)}
                      className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${
                        folder.color === color ? 'ring-2 ring-white/60 ring-offset-1 ring-offset-surface-100' : ''
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Children */}
          {hasChildren && isExpanded && (
            <div className="transition-all duration-150 animate-fade-in">
              {children.map((child) => renderNode(child))}
            </div>
          )}
        </div>
      );
    },
    [
      expandedIds,
      selectedFolderId,
      renamingId,
      renameValue,
      menuOpenId,
      colorPickerId,
      dragOverId,
      handleDragStart,
      handleDragOver,
      handleDragLeave,
      handleDrop,
      handleSelect,
      handleStartRename,
      handleCommitRename,
      handleCancelRename,
      handleToggleFavorite,
      handleDelete,
      handleColorChange,
      toggleExpand,
    ],
  );

  return (
    <div className={className}>
      {/* Header / New Folder button */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Folders</span>
        <button
          onClick={() => setCreating(true)}
          className="btn-ghost px-1.5 py-1"
          title="New folder"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* New folder inline input */}
      {creating && (
        <div className="mb-2 px-1">
          <div className="flex items-center gap-1">
            <FolderIcon className="w-4 h-4 text-gray-500" />
            <input
              ref={newFolderInputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleCreateFolder}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') {
                  setCreating(false);
                  setNewName('');
                }
              }}
              placeholder="Folder name..."
              className="flex-1 rounded bg-surface-200 px-2 py-1 text-sm text-gray-100 placeholder-gray-500 border border-primary-500/40 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
            />
            <button
              onClick={() => {
                setCreating(false);
                setNewName('');
              }}
              className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* All option */}
      {showAllOption && (
        <div
          onClick={() => handleSelect(null)}
          className={`flex items-center gap-2 rounded-md py-1.5 px-2 cursor-pointer transition-all ${
            selectedFolderId == null
              ? 'bg-primary-600/15 text-primary-300'
              : 'text-gray-300 hover:bg-surface-200/50'
          }`}
        >
          <FolderOpen className="w-4 h-4 text-gray-400" />
          <span className="text-sm">{allOptionLabel}</span>
        </div>
      )}

      {/* Tree */}
      <div
        className="relative"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('text/folder-id')) e.preventDefault();
        }}
        onDrop={handleRootDrop}
      >
        {isLoading ? (
          <div className="space-y-1.5 px-1 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-6 w-full rounded" />
            ))}
          </div>
        ) : isError ? (
          <div className="px-2 py-3 text-center">
            <p className="text-xs text-error-400">
              {error instanceof Error ? error.message : 'Failed to load folders'}
            </p>
          </div>
        ) : tree.length === 0 && !creating ? (
          <div className="px-2 py-4 text-center">
            <FolderIcon className="w-6 h-6 text-gray-600 mx-auto mb-1.5" />
            <p className="text-xs text-gray-500">No folders yet</p>
            <button
              onClick={() => setCreating(true)}
              className="mt-2 text-xs text-primary-400 hover:text-primary-300 transition-colors"
            >
              Create one
            </button>
          </div>
        ) : (
          <div className="space-y-0.5">
            {tree.map((node) => renderNode(node))}
          </div>
        )}
      </div>
    </div>
  );
}

export default FolderTree;
