import { useState } from 'react';
import { Trash2, CheckSquare, X, Flag } from 'lucide-react';
import type { TaskUpdate } from '../../types/domain';
import type { TaskStatus, TaskPriority } from '../../types/database';
import { useBulkDeleteTasks, useBulkUpdateTasks } from '../../hooks/useTasks';
import { useToastStore } from '../../stores/toastStore';

interface Props {
  selectedIds: Set<string>;
  onClear: () => void;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export function TaskBulkActions({ selectedIds, onClear }: Props) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const bulkDelete = useBulkDeleteTasks();
  const bulkUpdate = useBulkUpdateTasks();
  const showToast = useToastStore((s) => s.showToast);

  const count = selectedIds.size;
  if (count === 0) return null;

  const ids = Array.from(selectedIds);

  const handleBulkStatus = async (status: TaskStatus) => {
    setShowStatusMenu(false);
    const updates: TaskUpdate = {
      status,
      completed_at: status === 'done' ? new Date().toISOString() : null,
    };
    try {
      await bulkUpdate.mutateAsync({ ids, updates });
      showToast('success', `Updated ${count} tasks`);
      onClear();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update tasks');
    }
  };

  const handleBulkPriority = async (priority: TaskPriority) => {
    setShowPriorityMenu(false);
    try {
      await bulkUpdate.mutateAsync({ ids, updates: { priority } });
      showToast('success', `Updated ${count} tasks`);
      onClear();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update tasks');
    }
  };

  const handleBulkDelete = async () => {
    try {
      await bulkDelete.mutateAsync(ids);
      showToast('success', `Deleted ${count} tasks`);
      onClear();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete tasks');
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary-500/30 bg-primary-600/10 px-3 py-2 animate-slide-down">
      <span className="text-sm font-medium text-primary-300">
        {count} selected
      </span>

      <div className="w-px h-5 bg-surface-400/40" />

      {/* Bulk status */}
      <div className="relative">
        <button
          onClick={() => { setShowStatusMenu(!showStatusMenu); setShowPriorityMenu(false); }}
          className="btn-ghost py-1.5 px-2 text-xs"
        >
          <CheckSquare className="w-3.5 h-3.5" /> Status
        </button>
        {showStatusMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowStatusMenu(false)} />
            <div className="absolute left-0 top-9 z-20 w-32 rounded-lg border border-surface-400/40 bg-surface-100 shadow-elevated py-1 animate-scale-in">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleBulkStatus(opt.value)}
                  className="block w-full px-3 py-1.5 text-xs text-gray-300 hover:bg-surface-200/60 transition-colors text-left"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bulk priority */}
      <div className="relative">
        <button
          onClick={() => { setShowPriorityMenu(!showPriorityMenu); setShowStatusMenu(false); }}
          className="btn-ghost py-1.5 px-2 text-xs"
        >
          <Flag className="w-3.5 h-3.5" /> Priority
        </button>
        {showPriorityMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowPriorityMenu(false)} />
            <div className="absolute left-0 top-9 z-20 w-32 rounded-lg border border-surface-400/40 bg-surface-100 shadow-elevated py-1 animate-scale-in">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleBulkPriority(opt.value)}
                  className="block w-full px-3 py-1.5 text-xs text-gray-300 hover:bg-surface-200/60 transition-colors text-left capitalize"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Delete */}
      <button onClick={handleBulkDelete} className="btn-ghost py-1.5 px-2 text-xs text-error-400 hover:bg-error-600/10">
        <Trash2 className="w-3.5 h-3.5" /> Delete
      </button>

      {/* Clear selection */}
      <button onClick={onClear} className="btn-ghost py-1.5 px-2 text-xs ml-auto">
        <X className="w-3.5 h-3.5" /> Clear
      </button>
    </div>
  );
}
