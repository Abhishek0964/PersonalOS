import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useWorkspaces } from '../../hooks/useWorkspace';
import { useWorkspaceStore } from '../../stores/workspaceStore';

export function AppLayout() {
  const { data: workspaces } = useWorkspaces();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);

  useEffect(() => {
    if (workspaces && workspaces.length > 0 && !activeWorkspaceId) {
      setActiveWorkspace(workspaces[0].id);
    }
    if (workspaces && workspaces.length > 0 && activeWorkspaceId) {
      const stillExists = workspaces.some((w) => w.id === activeWorkspaceId);
      if (!stillExists) {
        setActiveWorkspace(workspaces[0].id);
      }
    }
  }, [workspaces, activeWorkspaceId, setActiveWorkspace]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
