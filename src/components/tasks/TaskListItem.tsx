import { useState } from 'react';
import {
  CheckCircle2, Circle, Clock, Flag, ChevronDown, ChevronRight,
  Calendar, Link2, ListChecks, MoreHorizontal, Edit3, Trash2,
} from 'lucide-react';
import type { Task } from '../../types/domain';
import { useToggleTaskComplete, useDeleteTask, useSubtasks } from '../../hooks/useTasks';
import { useTagsForEntity } from '../../hooks/useTags';
import { useToastStore } from '../../stores/toastStore';
import { useLogActivity } from '../../hooks/useActivityLogs';
import { useWorkspaceStore } from '../../stores/workspaceStore';

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-error-400 bg-error-600/15',
  high: 'text-accent-400 bg-accent-600/15',
  medium: 'text-warning-400 bg-warning-600/15',
  low: 'text-gray-400 bg-surface-300',
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

interface Props {
  task: Task;
  selected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onEdit: (task: Task) => void;
  onOpenDetail: (task: Task) => void;
}

export function TaskListItem({ task, selected, onSelect, onEdit, onOpenDetail }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const toggleComplete = useToggleTaskComplete();
  const deleteTask = useDeleteTask();
  const logActivity = useLogActivity();
  const showToast = useToastStore((s) => s.showToast);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const { data: subtasks } = useSubtasks(expanded ? task.id : null);
  const { data: tags } = useTagsForEntity(task.id);

  const isDone = task.status === 'done';
  const priorityColor = PRIORITY_COLORS[task.priority ?? 'medium'] ?? PRIORITY_COLORS.medium;

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleComplete.mutateAsync({ id: task.id, isDone: !isDone });
      showToast('success', isDone ? 'Task reopened' : 'Task completed');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update task');
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    try {
      await deleteTask.mutateAsync(task.id);
      if (workspaceId) {
        await logActivity.mutateAsync({
          workspace_id: workspaceId,
          entity_id: task.id,
          action: 'deleted',
          entity_type: 'task',
          metadata: { title: task.title },
        });
      }
      showToast('success', 'Task deleted');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0 && diffDays < 7) return `In ${diffDays} days`;
    if (diffDays < 0 && diffDays > -7) return `${Math.abs(diffDays)} days ago`;
    return date.toLocaleDateString();
  };

  const isOverdue = task.due_date && !isDone && new Date(task.due_date) < new Date();
  const checklistDone = (task.checklist as Array<{ done: boolean }> ?? []).filter((c) => c.done).length;
  const checklistTotal = (task.checklist as Array<{ done: boolean }> ?? []).length;

  return (
    <div
      className={`group relative flex items-start gap-3 rounded-lg border p-3 transition-all cursor-pointer ${
        selected
          ? 'border-primary-500/40 bg-primary-600/5'
          : 'border-surface-400/30 bg-surface-100 hover:bg-surface-200/50 hover:border-surface-400/50'
      } ${isDone ? 'opacity-60' : ''}`}
      onClick={() => onOpenDetail(task)}
    >
      {/* Checkbox */}
      <button
        onClick={handleToggle}
        className="mt-0.5 shrink-0"
        title={isDone ? 'Mark as not done' : 'Mark as done'}
      >
        {isDone ? (
          <CheckCircle2 className="w-5 h-5 text-primary-400" />
        ) : (
          <Circle className="w-5 h-5 text-gray-600 hover:text-primary-400 transition-colors" />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Expand button for subtasks */}
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="text-gray-600 hover:text-gray-300 transition-colors shrink-0"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          <h3 className={`text-sm font-medium truncate ${isDone ? 'text-gray-500 line-through' : 'text-gray-100'}`}>
            {task.title}
          </h3>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-1.5 ml-6 flex-wrap">
          {/* Status badge */}
          <span className={`badge text-[10px] ${
            isDone ? 'bg-success-600/15 text-success-400'
            : task.status === 'in_progress' ? 'bg-primary-600/15 text-primary-300'
            : 'bg-surface-300 text-gray-400'
          }`}>
            {STATUS_LABELS[task.status ?? 'todo'] ?? task.status}
          </span>

          {/* Priority */}
          <span className={`badge text-[10px] ${priorityColor}`}>
            <Flag className="w-2.5 h-2.5" />
            {task.priority ?? 'medium'}
          </span>

          {/* Due date */}
          {task.due_date && (
            <span className={`flex items-center gap-1 text-[10px] ${isOverdue ? 'text-error-400' : 'text-gray-500'}`}>
              <Calendar className="w-2.5 h-2.5" />
              {formatDate(task.due_date)}
              {isOverdue && ' (overdue)'}
            </span>
          )}

          {/* Checklist progress */}
          {checklistTotal > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-gray-500">
              <ListChecks className="w-2.5 h-2.5" />
              {checklistDone}/{checklistTotal}
            </span>
          )}

          {/* Tags */}
          {(tags ?? []).length > 0 && (
            <div className="flex items-center gap-1">
              {(tags ?? []).slice(0, 3).map((tag) => (
                <span
                  key={tag.id}
                  className="badge text-[10px]"
                  style={{ backgroundColor: (tag.color ?? '#6b7280') + '20', color: tag.color ?? '#6b7280' }}
                >
                  {tag.name}
                </span>
              ))}
              {(tags ?? []).length > 3 && (
                <span className="text-[10px] text-gray-500">+{(tags ?? []).length - 3}</span>
              )}
            </div>
          )}
        </div>

        {/* Subtasks */}
        {expanded && (subtasks ?? []).length > 0 && (
          <div className="mt-2 ml-6 space-y-1">
            {(subtasks ?? []).map((subtask) => (
              <div key={subtask.id} className="flex items-center gap-2 text-xs text-gray-400">
                {subtask.status === 'done' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary-400 shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                )}
                <span className={subtask.status === 'done' ? 'line-through text-gray-600' : ''}>
                  {subtask.title}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selection checkbox for bulk actions */}
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => { e.stopPropagation(); onSelect(task.id, e.target.checked); }}
        onClick={(e) => e.stopPropagation()}
        className="mt-1 w-4 h-4 rounded border-surface-400 bg-surface-200 text-primary-600 focus:ring-primary-500/30 shrink-0"
      />

      {/* Actions menu */}
      <div className="relative shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="text-gray-600 hover:text-gray-300 transition-colors p-1 rounded"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
            <div className="absolute right-0 top-8 z-20 w-36 rounded-lg border border-surface-400/40 bg-surface-100 shadow-elevated py-1 animate-scale-in">
              <button
                onClick={(e) => { e.stopPropagation(); setShowMenu(false); onEdit(task); }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-300 hover:bg-surface-200/60 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-error-400 hover:bg-error-600/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
