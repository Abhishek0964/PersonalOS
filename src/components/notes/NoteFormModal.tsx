import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, X, Folder, Link2, Tag as TagIcon } from 'lucide-react';
import { useCreateNote, useUpdateNote, useNoteTags, useAssignNoteTag, useRemoveNoteTag } from '../../hooks/useNotes';
import { useFolders } from '../../hooks/useFolders';
import { useEntities } from '../../hooks/useEntities';
import { useTags } from '../../hooks/useTags';
import { useToastStore } from '../../stores/toastStore';
import type { Note, NoteInsert, NoteUpdate } from '../../types/domain';

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  folder_id: z.string().optional().nullable(),
  entity_id: z.string().optional().nullable(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  onClose: () => void;
  workspaceId: string;
  note?: Note | null;
  onSaved?: (note: Note) => void;
}

export function NoteFormModal({ onClose, workspaceId, note, onSaved }: Props) {
  const isEdit = !!note;
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const assignTag = useAssignNoteTag();
  const removeTag = useRemoveNoteTag();
  const showToast = useToastStore((s) => s.showToast);

  const { data: folders } = useFolders(workspaceId);
  const { data: entities } = useEntities(workspaceId);
  const { data: allTags } = useTags(workspaceId);
  const { data: noteTags } = useNoteTags(note?.id ?? null);

  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (note && noteTags) {
      setSelectedTagIds(new Set(noteTags.map((t) => t.id)));
    }
  }, [note, noteTags]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: note?.title ?? '',
      folder_id: note?.folder_id ?? null,
      entity_id: note?.entity_id ?? null,
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      if (isEdit && note) {
        await updateNote.mutateAsync({ id: note.id, updates: data as NoteUpdate });
        const oldTagIds = new Set((noteTags ?? []).map((t) => t.id));
        Promise.all([
          ...Array.from(selectedTagIds).filter((id) => !oldTagIds.has(id)).map((tagId) =>
            assignTag.mutateAsync({ noteId: note.id, tagId })
          ),
          ...Array.from(oldTagIds).filter((id) => !selectedTagIds.has(id)).map((tagId) =>
            removeTag.mutateAsync({ noteId: note.id, tagId })
          ),
        ]).catch(() => {});
        showToast('success', 'Note updated');
        form.reset();
        onClose();
      } else {
        const created = await createNote.mutateAsync({
          ...(data as NoteInsert),
          workspace_id: workspaceId,
          content: '',
        });
        Promise.all(
          Array.from(selectedTagIds).map((tagId) => assignTag.mutateAsync({ noteId: created.id, tagId }))
        ).catch(() => {});
        showToast('success', 'Note created');
        onSaved?.(created);
        form.reset();
        onClose();
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save note');
    }
  };

  const isSubmitting = form.formState.isSubmitting;
  const toggleTag = (tagId: string) => {
    const next = new Set(selectedTagIds);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    setSelectedTagIds(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-0/70 backdrop-blur-sm animate-fade-in p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-surface-400/40 bg-surface-100 shadow-elevated animate-scale-in">
        <div className="flex items-center justify-between p-5 border-b border-surface-400/30 sticky top-0 bg-surface-100 z-10">
          <h2 className="text-lg font-semibold text-white">{isEdit ? 'Edit Note' : 'New Note'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Title <span className="text-error-400">*</span>
            </label>
            <input type="text" autoFocus placeholder="Note title" className="input-field" {...form.register('title')} />
            {form.formState.errors.title && (
              <p className="mt-1.5 text-xs text-error-400">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5" /> Folder
            </label>
            <select className="input-field" {...form.register('folder_id')}>
              <option value="">No folder</option>
              {(folders ?? []).map((folder) => (
                <option key={folder.id} value={folder.id}>{folder.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" /> Link to Entity
            </label>
            <select className="input-field" {...form.register('entity_id')}>
              <option value="">No entity</option>
              {(entities ?? []).map((entity) => (
                <option key={entity.id} value={entity.id}>{entity.name} ({entity.entity_type})</option>
              ))}
            </select>
          </div>

          {(allTags ?? []).length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5">
                <TagIcon className="w-3.5 h-3.5" /> Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {(allTags ?? []).map((tag) => {
                  const isSelected = selectedTagIds.has(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`badge transition-all ${isSelected ? 'ring-1 ring-primary-500/30' : 'bg-surface-200/50 text-gray-400 hover:bg-surface-300'}`}
                      style={isSelected ? { backgroundColor: (tag.color ?? '#3b82f6') + '20', color: tag.color ?? '#3b82f6' } : undefined}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color ?? '#6b7280' }} />
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2 sticky bottom-0 bg-surface-100 pb-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : isEdit ? 'Save Changes' : 'Create Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
