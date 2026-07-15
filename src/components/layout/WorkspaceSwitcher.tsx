import { useState, useRef, useEffect } from 'react';
import { Briefcase, ChevronDown, Plus, Check } from 'lucide-react';
import type { Workspace } from '../../stores/workspaceStore';
import { resolveIcon } from '../../lib/icons';

interface Props {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function WorkspaceSwitcher({ workspaces, activeWorkspace, loading, onSelect, onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
        <div className="skeleton w-7 h-7 rounded-lg" />
        <div className="skeleton h-3 flex-1 max-w-20" />
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <button
        onClick={onCreate}
        className="flex items-center gap-2 w-full px-2 py-2 rounded-lg text-sm text-gray-400 hover:bg-surface-200/50 hover:text-gray-200 transition-all"
      >
        <Plus className="w-4 h-4" />
        Create workspace
      </button>
    );
  }

  const Icon = activeWorkspace ? resolveIcon(activeWorkspace.icon) : Briefcase;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg hover:bg-surface-200/50 transition-all group"
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: (activeWorkspace?.color ?? '#3b82f6') + '20' }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: activeWorkspace?.color ?? '#3b82f6' }} />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-medium text-gray-100 truncate">
            {activeWorkspace?.name ?? 'Select workspace'}
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-surface-400/40 bg-surface-100 shadow-elevated z-50 animate-scale-in overflow-hidden">
          <div className="max-h-64 overflow-y-auto p-1">
            {workspaces.map((ws) => {
              const WsIcon = resolveIcon(ws.icon);
              const isActive = ws.id === activeWorkspace?.id;
              return (
                <button
                  key={ws.id}
                  onClick={() => {
                    onSelect(ws.id);
                    setOpen(false);
                  }}
                  className={`flex items-center gap-2.5 w-full px-2 py-2 rounded-md text-sm transition-all ${
                    isActive
                      ? 'bg-surface-300 text-gray-100'
                      : 'text-gray-400 hover:bg-surface-200/60 hover:text-gray-200'
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                    style={{ backgroundColor: (ws.color ?? '#3b82f6') + '20' }}
                  >
                    <WsIcon className="w-3 h-3" style={{ color: ws.color ?? '#3b82f6' }} />
                  </div>
                  <span className="truncate flex-1 text-left">{ws.name}</span>
                  {isActive && <Check className="w-3.5 h-3.5 text-primary-400" />}
                </button>
              );
            })}
          </div>
          <div className="border-t border-surface-400/30 p-1">
            <button
              onClick={() => {
                onCreate();
                setOpen(false);
              }}
              className="flex items-center gap-2.5 w-full px-2 py-2 rounded-md text-sm text-primary-400 hover:bg-primary-600/10 transition-all"
            >
              <Plus className="w-4 h-4" />
              New workspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
