import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useWorkspaces } from '../hooks/useWorkspace';
import {
  CheckSquare, Calendar, Users, StickyNote, FolderOpen,
  Lock, TrendingUp, Clock, ArrowRight, Sparkles, Plus,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateWorkspaceModal } from '../components/layout/CreateWorkspaceModal';

export function DashboardPage() {
  const { data: workspaces } = useWorkspaces();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const effectiveId = activeWorkspaceId ?? workspaces?.[0]?.id ?? null;
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return null;
      const [tasks, events, entities, notes] = await Promise.all([
        supabase.from('tasks').select('id, status, due_date').eq('workspace_id', effectiveId).is('deleted_at', null),
        supabase.from('calendar_events').select('id').eq('workspace_id', effectiveId).is('deleted_at', null),
        supabase.from('entities').select('id, entity_type').eq('workspace_id', effectiveId).is('deleted_at', null),
        supabase.from('notes').select('id').eq('workspace_id', effectiveId).is('deleted_at', null),
      ]);

      const now = new Date();
      const todayTasks = (tasks.data ?? []).filter((t: { id: string; status: string; due_date: string | null }) => {
        if (!t.due_date) return false;
        const due = new Date(t.due_date);
        return due.toDateString() === now.toDateString();
      }).length;

      return {
        totalTasks: tasks.data?.length ?? 0,
        doneTasks: (tasks.data ?? []).filter((t: { id: string; status: string; due_date: string | null }) => t.status === 'done').length,
        todayTasks,
        totalEvents: events.data?.length ?? 0,
        totalEntities: entities.data?.length ?? 0,
        totalNotes: notes.data?.length ?? 0,
      };
    },
    enabled: !!effectiveId,
  });

  if (!effectiveId) {
    return <NoWorkspaceState onCreate={() => setShowCreate(true)} />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your workspace activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Tasks"
          value={isLoading ? '...' : stats?.totalTasks ?? 0}
          sublabel={`${stats?.doneTasks ?? 0} completed`}
          icon={CheckSquare}
          color="primary"
        />
        <StatCard
          label="Due Today"
          value={isLoading ? '...' : stats?.todayTasks ?? 0}
          sublabel="Tasks due today"
          icon={Clock}
          color="accent"
        />
        <StatCard
          label="Calendar Events"
          value={isLoading ? '...' : stats?.totalEvents ?? 0}
          sublabel="Total scheduled"
          icon={Calendar}
          color="secondary"
        />
        <StatCard
          label="Entities"
          value={isLoading ? '...' : stats?.totalEntities ?? 0}
          sublabel="Clients, projects & more"
          icon={Users}
          color="success"
        />
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-base font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <QuickAction icon={Plus} label="New Task" color="primary" onClick={() => navigate('/tasks')} />
          <QuickAction icon={Calendar} label="New Event" color="secondary" onClick={() => navigate('/calendar')} />
          <QuickAction icon={Users} label="New Client" color="accent" onClick={() => navigate('/clients')} />
          <QuickAction icon={StickyNote} label="New Note" color="success" onClick={() => navigate('/notes')} />
          <QuickAction icon={FolderOpen} label="Upload File" color="primary" onClick={() => navigate('/files')} />
          <QuickAction icon={Lock} label="Add Credential" color="error" onClick={() => navigate('/vault')} />
        </div>
      </div>

      {/* Module Overview */}
      <div className="card">
        <h2 className="text-base font-semibold text-white mb-4">Modules</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Tasks', icon: CheckSquare, route: '/tasks', color: 'text-primary-400' },
            { label: 'Calendar', icon: Calendar, route: '/calendar', color: 'text-secondary-400' },
            { label: 'CRM', icon: Users, route: '/clients', color: 'text-accent-400' },
            { label: 'Notes', icon: StickyNote, route: '/notes', color: 'text-success-400' },
            { label: 'Files', icon: FolderOpen, route: '/files', color: 'text-primary-400' },
            { label: 'Vault', icon: Lock, route: '/vault', color: 'text-error-400' },
          ].map((mod) => {
            const ModIcon = mod.icon;
            return (
              <button key={mod.label} onClick={() => navigate(mod.route)} className="flex items-center gap-3 rounded-lg border border-surface-400/30 bg-surface-200/30 p-3 hover:bg-surface-200/50 transition-all">
                <ModIcon className={`w-4 h-4 ${mod.color}`} />
                <span className="text-sm font-medium text-gray-300">{mod.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-600 ml-auto" />
              </button>
            );
          })}
        </div>
      </div>

      {showCreate && <CreateWorkspaceModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  sublabel: string;
  icon: typeof CheckSquare;
  color: 'primary' | 'secondary' | 'accent' | 'success';
}) {
  const colorMap = {
    primary: 'bg-primary-600/15 text-primary-400',
    secondary: 'bg-secondary-600/15 text-secondary-400',
    accent: 'bg-accent-600/15 text-accent-400',
    success: 'bg-success-600/15 text-success-400',
  };

  return (
    <div className="card hover:shadow-elevated transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-white mt-2">{value}</p>
          <p className="text-xs text-gray-500 mt-1">{sublabel}</p>
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  color,
  onClick,
}: {
  icon: typeof CheckSquare;
  label: string;
  color: 'primary' | 'secondary' | 'accent' | 'success' | 'error';
  onClick?: () => void;
}) {
  const colorMap = {
    primary: 'text-primary-400 hover:bg-primary-600/10',
    secondary: 'text-secondary-400 hover:bg-secondary-600/10',
    accent: 'text-accent-400 hover:bg-accent-600/10',
    success: 'text-success-400 hover:bg-success-600/10',
    error: 'text-error-400 hover:bg-error-600/10',
  };

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-lg border border-surface-400/30 bg-surface-200/30 p-4 transition-all ${colorMap[color]}`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-xs font-medium text-gray-300">{label}</span>
    </button>
  );
}

function NoWorkspaceState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-primary-600/15 flex items-center justify-center mb-4">
        <Sparkles className="w-8 h-8 text-primary-400" />
      </div>
      <h2 className="text-xl font-bold text-white">Welcome to PersonalOS</h2>
      <p className="text-sm text-gray-500 mt-2 max-w-sm">
        Create your first workspace to start organizing your tasks, projects, clients, notes, and more.
      </p>
      <button onClick={onCreate} className="btn-primary mt-6">
        <Plus className="w-4 h-4" />
        Create your first workspace
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
