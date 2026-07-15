import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Database } from '../types/database';

type Workspace = Database['workspaces']['Row'];

interface WorkspaceState {
  activeWorkspaceId: string | null;
  sidebarCollapsed: boolean;
  setActiveWorkspace: (id: string | null) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      activeWorkspaceId: null,
      sidebarCollapsed: false,
      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    }),
    {
      name: 'personalos-workspace',
    }
  )
);

export type { Workspace };
