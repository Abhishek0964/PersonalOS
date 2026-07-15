import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, X, Calendar, Link2, Plus, Trash2 } from 'lucide-react';
import { useCreateTask, useUpdateTask } from '../../hooks/useTasks';
import { useEntities } from '../../hooks/useEntities';
import { useTags, useTagsForEntity, useAssignTag, useRemoveTag } from '../../hooks/useTags';
import { useLogActivity } from '../../hooks/useActivityLogs';
import { useToastStore } from '../../stores/toastStore';
import type { Task, TaskInsert, TaskUpdate, ChecklistItem } from '../../types/domain';
import type { TaskPriority, TaskStatus } from '../../types/database';

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  description: z.string().max(2000, 'Description is too long').optional().default(''),
  status: z.enum(['todo', 'in_progress', 'done']).default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  due_date: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  entity_id: z.string().optional().nullable(),
});

type FormData = z.infer<typeof schema>;

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'text-gray-400' },
  { value: 'medium', label: 'Medium', color: 'text-warning-400' },
  { value: 'high', label: 'High', color: 'text-accent-400' },
  { value: 'urgent', label: 'Urgent', color: 'text-error-400' },
];

interface Props {
  onClose: () => void;
  workspaceId: string;
  task?: Task | null;
  parentId?: string | null;
  onSaved?: (task: Task) => void;
}

export function TaskFormModal({ onClose, workspaceId, task, parentId, onSaved }: Props) {
  const isEdit = !!task;
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const logActivity = useLogActivity();
  const showToast = useToastStore((s) => s.showToast);

  const { data: entities } = useEntities(workspaceId);
  const { data: tags } = useTags(workspaceId);
  const { data: taskTags } = useTagsForEntity(task?.id ?? null);
  const assignTag = useAssignTag();
  const removeTag = useRemoveTag();

  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    (task?.checklist as ChecklistItem[] | undefined) ?? []
  );
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    new Set((taskTags ?? []).map((t) => t.id))
  );

  // Sync tags when taskTags load (edit mode)
  useEffect(() => {
    if (task && taskTags) {
      setSelectedTagIds(new Set(taskTags.map((t) => t.id)));
    }
  }, [task, taskTags]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      status: (task?.status as TaskStatus) ?? 'todo',
      priority: (task?.priority as TaskPriority) ?? 'medium',
      due_date: task?.due_date ? task.due_date.slice(0, 16) : null,
      start_date: task?.start_date ? task.start_date.slice(0, 16) : null,
      entity_id: task?.entity_id ?? null,
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      const payload: TaskInsert | TaskUpdate = {
        title: data.title,
        description: data.description || null,
        status: data.status,
        priority: data.priority,
        due_date: data.due_date ? new Date(data.due_date).toISOString() : null,
        start_date: data.start_date ? new Date(data.start_date).toISOString() : null,
        entity_id: data.entity_id || null,
        checklist: checklist.length > 0 ? checklist : [],
      };

      if (isEdit && task) {
        await updateTask.mutateAsync({ id: task.id, updates: payload as TaskUpdate });
        showToast('success', 'Task updated');
        onSaved?.(task);
        form.reset();
        onClose();
        // Non-critical: sync tags + log activity (don't block modal close)
        const oldTagIds = new Set((taskTags ?? []).map((t) => t.id));
        Promise.all([
          ...Array.from(selectedTagIds).filter((id) => !oldTagIds.has(id)).map((tagId) =>
            assignTag.mutateAsync({ entityId: task.id, tagId })
          ),
          ...Array.from(oldTagIds).filter((id) => !selectedTagIds.has(id)).map((tagId) =>
            removeTag.mutateAsync({ entityId: task.id, tagId })
          ),
          logActivity.mutateAsync({
            workspace_id: workspaceId,
            entity_id: task.id,
            action: 'updated',
            entity_type: 'task',
            metadata: { title: data.title },
          }),
        ]).catch(() => {/* tag sync / activity log failures are non-critical */});
      } else {
        const created = await createTask.mutateAsync({
          ...(payload as TaskInsert),
          workspace_id: workspaceId,
          parent_id: parentId ?? null,
        });
        showToast('success', 'Task created');
        onSaved?.(created);
        form.reset();
        onClose();
        // Non-critical: assign tags + log activity (don't block modal close)
        Promise.all([
          ...Array.from(selectedTagIds).map((tagId) =>
            assignTag.mutateAsync({ entityId: created.id, tagId })
          ),
          logActivity.mutateAsync({
            workspace_id: workspaceId,
            entity_id: created.id,
            action: 'created',
            entity_type: 'task',
            metadata: { title: data.title },
          }),
        ]).catch(() => {/* tag assignment / activity log failures are non-critical */});
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save task';
      showToast('error', message);
    }
  };

  const isSubmitting = form.formState.isSubmitting;

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    setChecklist([...checklist, { text: newChecklistItem.trim(), done: false }]);
    setNewChecklistItem('');
  };

  const toggleChecklistItem = (index: number) => {
    setChecklist(checklist.map((item, i) => (i === index ? { ...item, done: !item.done } : item)));
  };

  const removeChecklistItem = (index: number) => {
    setChecklist(checklist.filter((_, i) => i !== index));
  };

  const toggleTag = (tagId: string) => {
    const next = new Set(selectedTagIds);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    setSelectedTagIds(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-0/70 backdrop-blur-sm animate-fade-in p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-surface-400/40 bg-surface-100 shadow-elevated animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-400/30 sticky top-0 bg-surface-100 z-10">
          <h2 className="text-lg font-semibold text-white">
            {isEdit ? 'Edit Task' : 'New Task'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Title <span className="text-error-400">*</span>
            </label>
            <input
              type="text"
              autoFocus
              placeholder="Task title"
              className="input-field"
              {...form.register('title')}
            />
            {form.formState.errors.title && (
              <p className="mt-1.5 text-xs text-error-400">{form.formState.errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
            <textarea
              rows={3}
              placeholder="Add details..."
              className="input-field resize-none"
              {...form.register('description')}
            />
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Status</label>
              <select className="input-field" {...form.register('status')}>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Priority</label>
              <select className="input-field" {...form.register('priority')}>
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Start Date
              </label>
              <input type="datetime-local" className="input-field" {...form.register('start_date')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Due Date
              </label>
              <input type="datetime-local" className="input-field" {...form.register('due_date')} />
            </div>
          </div>

          {/* Entity link */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" /> Link to Entity
            </label>
            <select className="input-field" {...form.register('entity_id')}>
              <option value="">No entity</option>
              {(entities ?? []).map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name} ({entity.entity_type})
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          {(tags ?? []).length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Tags</label>
              <div className="flex flex-wrap gap-2">
                {(tags ?? []).map((tag) => {
                  const isSelected = selectedTagIds.has(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`badge transition-all ${
                        isSelected
                          ? 'bg-primary-600/20 text-primary-300 ring-1 ring-primary-500/30'
                          : 'bg-surface-200/50 text-gray-400 hover:bg-surface-300'
                      }`}
                      style={isSelected ? { backgroundColor: (tag.color ?? '#3b82f6') + '20' } : undefined}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: tag.color ?? '#6b7280' }}
                      />
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Checklist */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Checklist</label>
            <div className="space-y-1.5">
              {checklist.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <button
                    type="button"
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
                    type="button"
                    onClick={() => removeChecklistItem(index)}
                    className="text-gray-600 hover:text-error-400 transition-colors"
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

          {/* Actions */}
          <div className="flex gap-2 pt-2 sticky bottom-0 bg-surface-100 pb-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                isEdit ? 'Save Changes' : 'Create Task'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
