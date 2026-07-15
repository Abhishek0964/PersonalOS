import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, X, Briefcase } from 'lucide-react';
import { useCreateWorkspace } from '../../hooks/useWorkspace';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useToastStore } from '../../stores/toastStore';
import { resolveIcon } from '../../lib/icons';

const schema = z.object({
  name: z.string().min(2, 'Workspace name must be at least 2 characters'),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const ICON_OPTIONS = ['Briefcase', 'Folder', 'Star', 'Bookmark', 'Layers', 'Globe', 'Database', 'BookOpen'];
const COLOR_OPTIONS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Orange', value: '#f97316' },
];

export function CreateWorkspaceModal({ onClose }: { onClose: () => void }) {
  const createWorkspace = useCreateWorkspace();
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const showToast = useToastStore((s) => s.showToast);
  const [selectedIcon, setSelectedIcon] = useState('Briefcase');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  });

  const onSubmit = async (data: FormData) => {
    try {
      const ws = await createWorkspace.mutateAsync({
        name: data.name,
        description: data.description || null,
        icon: selectedIcon,
        color: selectedColor,
      });
      setActiveWorkspace(ws.id);
      showToast('success', `Workspace "${ws.name}" created`);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create workspace';
      showToast('error', message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-0/70 backdrop-blur-sm animate-fade-in p-4">
      <div className="w-full max-w-md rounded-2xl border border-surface-400/40 bg-surface-100 shadow-elevated animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-400/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-600/20 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-primary-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">New Workspace</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Name <span className="text-error-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Personal, Work, Side Project"
              className="input-field"
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="mt-1.5 text-xs text-error-400">{form.formState.errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
            <input
              type="text"
              placeholder="Optional description"
              className="input-field"
              {...form.register('description')}
            />
          </div>

          {/* Icon Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Icon</label>
            <div className="grid grid-cols-8 gap-1.5">
              {ICON_OPTIONS.map((iconName) => {
                const Icon = resolveIcon(iconName);
                const isSelected = selectedIcon === iconName;
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setSelectedIcon(iconName)}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-primary-600/20 text-primary-300 ring-1 ring-primary-500/30'
                        : 'bg-surface-200/50 text-gray-400 hover:text-gray-200 hover:bg-surface-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setSelectedColor(color.value)}
                  className={`w-7 h-7 rounded-full transition-all ${
                    selectedColor === color.value
                      ? 'ring-2 ring-offset-2 ring-offset-surface-100 scale-110'
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color.value, '--tw-ring-color': color.value } as React.CSSProperties}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createWorkspace.isPending}
              className="btn-primary flex-1"
            >
              {createWorkspace.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Workspace'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
