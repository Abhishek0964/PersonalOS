import { useState, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronLeft, Search, LogOut, Briefcase } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useWorkspaces, useNavigationItems } from '../../hooks/useWorkspace';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { resolveIcon } from '../../lib/icons';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { CreateWorkspaceModal } from './CreateWorkspaceModal';

export function Sidebar() {
  const { profile, signOut } = useAuth();
  const { data: workspaces, isLoading: workspacesLoading } = useWorkspaces();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const sidebarCollapsed = useWorkspaceStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [search, setSearch] = useState('');
  const location = useLocation();

  const effectiveWorkspaceId = activeWorkspaceId ?? workspaces?.[0]?.id ?? null;
  const { data: navItems, isLoading: navLoading } = useNavigationItems(effectiveWorkspaceId);

  const activeWorkspace = useMemo(
    () => workspaces?.find((w) => w.id === effectiveWorkspaceId),
    [workspaces, effectiveWorkspaceId]
  );

  const filteredNav = useMemo(() => {
    if (!navItems) return [];
    if (!search) return navItems;
    return navItems.filter((item) =>
      item.label.toLowerCase().includes(search.toLowerCase())
    );
  }, [navItems, search]);

  if (sidebarCollapsed) {
    return <CollapsedSidebar onExpand={toggleSidebar} />;
  }

  return (
    <>
      <aside className="flex flex-col w-64 bg-surface-50 border-r border-surface-400/30 h-screen shrink-0 animate-slide-down">
        {/* Workspace Switcher */}
        <div className="p-3 border-b border-surface-400/30">
          <WorkspaceSwitcher
            workspaces={workspaces ?? []}
            activeWorkspace={activeWorkspace ?? null}
            loading={workspacesLoading}
            onSelect={setActiveWorkspace}
            onCreate={() => setShowCreateModal(true)}
          />
        </div>

        {/* Search */}
        <div className="p-3 border-b border-surface-400/30">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search navigation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md bg-surface-200/60 pl-8 pr-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500/30 transition-all"
            />
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {navLoading ? (
            <NavSkeleton />
          ) : filteredNav.length === 0 ? (
            <EmptyNav search={search} />
          ) : (
            filteredNav.map((item) => {
              const Icon = resolveIcon(item.icon);
              const isActive = location.pathname === item.route ||
                location.pathname.startsWith(item.route + '/');
              return (
                <NavLink
                  key={item.id}
                  to={item.route}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all group ${
                    isActive
                      ? 'bg-primary-600/15 text-primary-300'
                      : 'text-gray-400 hover:bg-surface-200/50 hover:text-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {isActive && (
                    <span className="ml-auto w-1 h-4 rounded-full bg-primary-500" />
                  )}
                </NavLink>
              );
            })
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-surface-400/30 p-3 space-y-2">
          {/* User Profile */}
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-xs font-semibold text-white shrink-0">
              {(profile?.display_name ?? profile?.email ?? 'U')[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-200 truncate">
                {profile?.display_name ?? 'User'}
              </p>
              <p className="text-2xs text-gray-500 truncate">{profile?.email}</p>
            </div>
            <button
              onClick={() => signOut()}
              className="text-gray-500 hover:text-error-400 transition-colors p-1 rounded"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Collapse Button */}
          <button
            onClick={toggleSidebar}
            className="flex items-center gap-2 w-full rounded-md px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-surface-200/50 hover:text-gray-300 transition-all"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Collapse sidebar
          </button>
        </div>
      </aside>

      {showCreateModal && (
        <CreateWorkspaceModal onClose={() => setShowCreateModal(false)} />
      )}
    </>
  );
}

function CollapsedSidebar({ onExpand }: { onExpand: () => void }) {
  const { data: workspaces } = useWorkspaces();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const effectiveWorkspaceId = activeWorkspaceId ?? workspaces?.[0]?.id ?? null;
  const { data: navItems } = useNavigationItems(effectiveWorkspaceId);
  const location = useLocation();

  return (
    <aside className="flex flex-col w-16 bg-surface-50 border-r border-surface-400/30 h-screen shrink-0 items-center py-3 gap-2">
      <button
        onClick={onExpand}
        className="w-9 h-9 rounded-lg bg-surface-200/60 flex items-center justify-center text-gray-400 hover:text-gray-200 hover:bg-surface-300 transition-all"
        title="Expand sidebar"
      >
        <ChevronLeft className="w-4 h-4 rotate-180" />
      </button>

      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shrink-0">
        <Briefcase className="w-4 h-4 text-white" />
      </div>

      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto w-full items-center px-2">
        {navItems?.map((item) => {
          const Icon = resolveIcon(item.icon);
          const isActive = location.pathname === item.route ||
            location.pathname.startsWith(item.route + '/');
          return (
            <NavLink
              key={item.id}
              to={item.route}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                isActive
                  ? 'bg-primary-600/15 text-primary-300'
                  : 'text-gray-400 hover:bg-surface-200/50 hover:text-gray-200'
              }`}
              title={item.label}
            >
              <Icon className="w-4 h-4" />
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

function NavSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <div className="skeleton w-4 h-4 rounded" />
          <div className="skeleton h-3 flex-1 max-w-24" />
        </div>
      ))}
    </div>
  );
}

function EmptyNav({ search }: { search: string }) {
  return (
    <div className="px-3 py-8 text-center">
      <p className="text-xs text-gray-500">
        {search ? 'No items match your search.' : 'No navigation items yet.'}
      </p>
    </div>
  );
}
