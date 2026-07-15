import { useState } from 'react';
import {
  X, CheckCircle2, Circle, Clock, Flag, Calendar, Link2,
  ListChecks, Edit3, Trash2, Plus, FileText,
} from 'lucide-react';
import type { Task, ChecklistItem } from '../../types/domain';
import { useTask, useUpdateTask, useDeleteTask, useSubtasks } from '../../hooks/useTasks';
import { useTagsForEntity } from '../../hooks/useTags';
import { useEntities } from '../../hooks/useEntities';
import { useLogActivity } from '../../hooks/useActivityLogs';
import { useToastStore } from '../../stores/toastStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { TaskFormModal } from './TaskFormModal';

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
  taskId: string;
  workspaceId: string;
  onClose: () => void;
}

export function TaskDetailPanel({ taskId, workspaceId, onClose }: Props) {
  const [showEdit, setShowEdit] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const { data: task, isError } = useTask(taskId);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const logActivity = useLogActivity();
  const showToast = useToastStore((s) => s.showToast);
  const wsId = useWorkspaceStore((s) => s.activeWorkspaceId) ?? workspaceId;

  const { data: subtasks } = useSubtasks(taskId);
  const { data: tags } = useTagsForEntity(taskId);
  const { data: entities } = useEntities(workspaceId);

  if (!task) {
    if (isError) {
      return (
        <div className="fixed inset-0 z-40 flex justify-end bg-surface-0/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
          <div className="w-full max-w-md h-full bg-surface-50 border-l border-surface-400/30 flex flex-col items-center justify-center gap-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-gray-400">Failed to load task</p>
            <button onClick={onClose} className="btn-secondary">Close</button>
          </div>
        </div>
      );
    }
    return (
      <div className="fixed inset-0 z-40 flex justify-end bg-surface-0/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
        <div className="w-full max-w-md h-full bg-surface-50 border-l border-surface-400/30 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <div className="skeleton w-6 h-6 rounded-full" />
        </div>
      </div>
    );
  }

  const linkedEntity = (entities ?? []).find((e) => e.id === task.entity_id);
  const isDone = task.status === 'done';
  const checklist = (task.checklist as ChecklistItem[]) ?? [];

  const handleToggleComplete = async () => {
    try {
      await updateTask.mutateAsync({
        id: task.id,
        updates: {
          status: isDone ? 'todo' : 'done',
          completed_at: isDone ? null : new Date().toISOString(),
        },
      });
      showToast('success', isDone ? 'Task reopened' : 'Task completed');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTask.mutateAsync(task.id);
      logActivity.mutate({
        workspace_id: wsId,
        entity_id: task.id,
        action: 'deleted',
        entity_type: 'task',
        metadata: { title: task.title },
      });
      showToast('success', 'Task deleted');
      onClose();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      await updateTask.mutateAsync({
        id: task.id,
        updates: {
          status,
          completed_at: status === 'done' ? new Date().toISOString() : null,
        },
      });
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const handlePriorityChange = async (priority: string) => {
    try {
      await updateTask.mutateAsync({ id: task.id, updates: { priority } });
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const addChecklistItem = async () => {
    if (!newChecklistItem.trim()) return;
    const updated = [...checklist, { text: newChecklistItem.trim(), done: false }];
    try {
      await updateTask.mutateAsync({ id: task.id, updates: { checklist: updated } });
      setNewChecklistItem('');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update checklist');
    }
  };

  const toggleChecklistItem = async (index: number) => {
    const updated = checklist.map((item, i) =>
      i === index ? { ...item, done: !item.done } : item
    );
    try {
      await updateTask.mutateAsync({ id: task.id, updates: { checklist: updated } });
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update checklist');
    }
  };

  const removeChecklistItem = async (index: number) => {
    const updated = checklist.filter((_, i) => i !== index);
    try {
      await updateTask.mutateAsync({ id: task.id, updates: { checklist: updated } });
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update checklist');
    }
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex justify-end bg-surface-0/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
        <div
          className="w-full max-w-md h-full bg-surface-50 border-l border-surface-400/30 overflow-y-auto animate-slide-down"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-surface-400/30 sticky top-0 bg-surface-50 z-10">
            <h2 className="text-base font-semibold text-white truncate flex-1">Task Details</h2>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setShowEdit(true)}
                className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded"
                title="Edit task"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                className="text-gray-500 hover:text-error-400 transition-colors p-1.5 rounded"
                title="Delete task"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-5">
            {/* Title + complete toggle */}
            <div className="flex items-start gap-3">
              <button onClick={handleToggleComplete} className="mt-0.5 shrink-0">
                {isDone ? (
                  <CheckCircle2 className="w-5 h-5 text-primary-400" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-600 hover:text-primary-400 transition-colors" />
                )}
              </button>
              <h3 className={`text-lg font-semibold ${isDone ? 'text-gray-500 line-through' : 'text-white'}`}>
                {task.title}
              </h3>
            </div>

            {/* Description */}
            {task.description && (
              <div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
                  <FileText className="w-3.5 h-3.5" /> Description
                </div>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            {/* Status */}
            <div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
                <Circle className="w-3.5 h-3.5" /> Status
              </div>
              <div className="flex gap-2">
                {['todo', 'in_progress', 'done'].map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    className={`badge transition-all ${
                      task.status === status
                        ? 'bg-primary-600/20 text-primary-300 ring-1 ring-primary-500/30'
                        : 'bg-surface-200/50 text-gray-400 hover:bg-surface-300'
                    }`}
                  >
                    {STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
                <Flag className="w-3.5 h-3.5" /> Priority
              </div>
              <div className="flex gap-2">
                {['low', 'medium', 'high', 'urgent'].map((priority) => (
                  <button
                    key={priority}
                    onClick={() => handlePriorityChange(priority)}
                    className={`badge transition-all capitalize ${
                      task.priority === priority
                        ? `${PRIORITY_COLORS[priority]} ring-1 ring-current/20`
                        : 'bg-surface-200/50 text-gray-500 hover:bg-surface-300'
                    }`}
                  >
                    {priority}
                  </button>
                ))}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Start Date
                </div>
                <p className="text-sm text-gray-300">{formatDate(task.start_date)}</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
                  <Clock className="w-3.5 h-3.5" /> Due Date
                </div>
                <p className={`text-sm ${task.due_date && !isDone && new Date(task.due_date) < new Date() ? 'text-error-400' : 'text-gray-300'}`}>
                  {formatDate(task.due_date)}
                </p>
              </div>
            </div>

            {/* Entity link */}
            {linkedEntity && (
              <div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Linked Entity
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-surface-400/30 bg-surface-200/30 px-3 py-2">
                  <span className="badge bg-primary-600/15 text-primary-300">{linkedEntity.entity_type}</span>
                  <span className="text-sm text-gray-200">{linkedEntity.name}</span>
                </div>
              </div>
            )}

            {/* Tags */}
            {(tags ?? []).length > 0 && (
              <div>
                <div className="text-xs text-gray-500 mb-1.5">Tags</div>
                <div className="flex flex-wrap gap-2">
                  {(tags ?? []).map((tag) => (
                    <span
                      key={tag.id}
                      className="badge"
                      style={{ backgroundColor: (tag.color ?? '#6b7280') + '20', color: tag.color ?? '#6b7280' }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color ?? '#6b7280' }} />
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Checklist */}
            <div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
                <ListChecks className="w-3.5 h-3.5" /> Checklist
              </div>
              <div className="space-y-1.5">
                {checklist.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 group">
                    <button
                      onClick={() => toggleChecklistItem(index)}
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                        item.done
                          ? 'bg-primary-600 border-primary-500 text-white'
                          : 'border-surface-400 text-transparent hover:border-primary-500'
                      }`}
                    >
                      {item.done && <span className="text-[10px]">✓</span>}
                    </button>
                    <span className={`text-sm flex-1 ${item.done ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                      {item.text}
                    </span>
                    <button
                      onClick={() => removeChecklistItem(index)}
                      className="text-gray-600 hover:text-error-400 transition-colors p-0.5"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-gray-500 shrink-0" />
                  <input
                    type="text"
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addChecklistItem();
                      }
                    }}
                    placeholder="Add checklist item..."
                    className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none border-b border-surface-400/30 focus:border-primary-500/50 transition-colors pb-1"
                  />
                </div>
              </div>
            </div>

            {/* Subtasks */}
            {(subtasks ?? []).length > 0 && (
              <div>
                <div className="text-xs text-gray-500 mb-1.5">Subtasks</div>
                <div className="space-y-1">
                  {(subtasks ?? []).map((subtask) => (
                    <div key={subtask.id} className="flex items-center gap-2 text-sm">
                      {subtask.status === 'done' ? (
                        <CheckCircle2 className="w-4 h-4 text-primary-400 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-600 shrink-0" />
                      )}
                      <span className={subtask.status === 'done' ? 'text-gray-500 line-through' : 'text-gray-300'}>
                        {subtask.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="pt-3 border-t border-surface-400/20 text-xs text-gray-600 space-y-1">
              <p>Created: {formatDate(task.created_at)}</p>
              <p>Updated: {formatDate(task.updated_at)}</p>
            </div>
          </div>
        </div>
      </div>

      {showEdit && (
        <TaskFormModal
          workspaceId={workspaceId}
          task={task}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  );
}
