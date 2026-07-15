import { useState, useCallback, useMemo } from 'react';
import { Plus, CheckSquare, AlertCircle, RefreshCw, Inbox } from 'lucide-react';
import { useTasks, PAGE_SIZE } from '../hooks/useTasks';
import { useWorkspaces } from '../hooks/useWorkspace';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useToastStore } from '../stores/toastStore';
import type { Task, TaskFilters, TaskSort } from '../types/domain';
import { TaskListItem } from '../components/tasks/TaskListItem';
import { TaskFiltersBar } from '../components/tasks/TaskFiltersBar';
import { TaskBulkActions } from '../components/tasks/TaskBulkActions';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { TaskDetailPanel } from '../components/tasks/TaskDetailPanel';

export function TasksPage() {
  const { data: workspaces } = useWorkspaces();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const effectiveWsId = activeWorkspaceId ?? workspaces?.[0]?.id ?? null;
  const showToast = useToastStore((s) => s.showToast);

  const [filters, setFilters] = useState<TaskFilters>({
    status: 'all',
    priority: 'all',
    search: '',
    showCompleted: false,
  });
  const [sort, setSort] = useState<TaskSort>({ field: 'created_at', direction: 'desc' });
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, error, refetch, isFetching } = useTasks(
    effectiveWsId,
    { filters, sort, page }
  );

  const tasks = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasMore = data?.hasMore ?? false;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSelect = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleEdit = useCallback((task: Task) => {
    setEditingTask(task);
    setShowCreate(false);
  }, []);

  const handleOpenDetail = useCallback((task: Task) => {
    setDetailTask(task);
  }, []);

  const handleFiltersChange = (newFilters: TaskFilters) => {
    setFilters(newFilters);
    setPage(0);
    clearSelection();
  };

  const handleSortChange = (newSort: TaskSort) => {
    setSort(newSort);
    setPage(0);
  };

  const allSelected = useMemo(
    () => tasks.length > 0 && tasks.every((t) => selectedIds.has(t.id)),
    [tasks, selectedIds]
  );

  const toggleSelectAll = () => {
    if (allSelected) {
      const next = new Set(selectedIds);
      tasks.forEach((t) => next.delete(t.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      tasks.forEach((t) => next.add(t.id));
      setSelectedIds(next);
    }
  };

  if (!effectiveWsId) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-6">
        <Inbox className="w-12 h-12 text-gray-600 mb-3" />
        <h2 className="text-lg font-semibold text-white">No Workspace</h2>
        <p className="text-sm text-gray-500 mt-1">Create a workspace to start managing tasks.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-600/15 flex items-center justify-center">
            <CheckSquare className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Tasks</h1>
            <p className="text-xs text-gray-500">Manage your tasks, subtasks, and checklists</p>
          </div>
        </div>
        <button onClick={() => { setShowCreate(true); setEditingTask(null); }} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Task</span>
        </button>
      </div>

      {/* Filters */}
      <TaskFiltersBar
        filters={filters}
        sort={sort}
        onFiltersChange={handleFiltersChange}
        onSortChange={handleSortChange}
        resultCount={total}
      />

      {/* Bulk actions */}
      <TaskBulkActions selectedIds={selectedIds} onClear={clearSelection} />

      {/* Select all bar */}
      {tasks.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            className="w-3.5 h-3.5 rounded border-surface-400 bg-surface-200 text-primary-600 focus:ring-primary-500/30"
          />
          <span>Select all on this page</span>
        </div>
      )}

      {/* Task list */}
      {isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="w-10 h-10 text-error-400 mb-3" />
          <p className="text-sm text-gray-400 mb-1">Failed to load tasks</p>
          <p className="text-xs text-gray-600 mb-4">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
          <button onClick={() => refetch()} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      ) : isLoading ? (
        <TaskListSkeleton />
      ) : tasks.length === 0 ? (
        <EmptyState
          hasFilters={
            (filters.search && filters.search.trim() !== '') ||
            (filters.status && filters.status !== 'all') ||
            (filters.priority && filters.priority !== 'all')
          }
          onClearFilters={() => handleFiltersChange({ status: 'all', priority: 'all', search: '', showCompleted: false })}
          onCreate={() => setShowCreate(true)}
        />
      ) : (
        <>
          <div className="space-y-1.5">
            {tasks.map((task) => (
              <TaskListItem
                key={task.id}
                task={task}
                selected={selectedIds.has(task.id)}
                onSelect={handleSelect}
                onEdit={handleEdit}
                onOpenDetail={handleOpenDetail}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => { setPage(Math.max(0, page - 1)); clearSelection(); }}
                disabled={page === 0}
                className="btn-ghost text-xs disabled:opacity-30"
              >
                ← Previous
              </button>
              <span className="text-xs text-gray-500">
                Page {page + 1} of {totalPages} {isFetching && '(loading...)'}
              </span>
              <button
                onClick={() => { setPage(page + 1); clearSelection(); }}
                disabled={!hasMore}
                className="btn-ghost text-xs disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showCreate && (
        <TaskFormModal
          workspaceId={effectiveWsId}
          onClose={() => setShowCreate(false)}
        />
      )}
      {editingTask && (
        <TaskFormModal
          workspaceId={effectiveWsId}
          task={editingTask}
          onClose={() => setEditingTask(null)}
        />
      )}
      {detailTask && (
        <TaskDetailPanel
          key={detailTask.id}
          taskId={detailTask.id}
          workspaceId={effectiveWsId}
          onClose={() => setDetailTask(null)}
        />
      )}
    </div>
  );
}

function TaskListSkeleton() {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-surface-400/30 bg-surface-100 p-3">
          <div className="skeleton w-5 h-5 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 max-w-48 rounded" />
            <div className="flex gap-2">
              <div className="skeleton h-3 w-16 rounded" />
              <div className="skeleton h-3 w-12 rounded" />
            </div>
          </div>
          <div className="skeleton w-4 h-4 rounded shrink-0" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  hasFilters,
  onClearFilters,
  onCreate,
}: {
  hasFilters: boolean;
  onClearFilters: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-surface-200/50 flex items-center justify-center mb-4">
        <CheckSquare className="w-7 h-7 text-gray-600" />
      </div>
      <h3 className="text-base font-medium text-gray-300">
        {hasFilters ? 'No tasks match your filters' : 'No tasks yet'}
      </h3>
      <p className="text-sm text-gray-500 mt-1 max-w-sm">
        {hasFilters
          ? 'Try adjusting your search or filter criteria.'
          : 'Create your first task to start tracking your work.'}
      </p>
      <div className="flex gap-2 mt-4">
        {hasFilters && (
          <button onClick={onClearFilters} className="btn-secondary">
            Clear Filters
          </button>
        )}
        <button onClick={onCreate} className="btn-primary">
          <Plus className="w-4 h-4" /> New Task
        </button>
      </div>
    </div>
  );
}
