import { useState, useMemo, useEffect } from 'react';
import {
  Plus, Search, Users, Building2, User, Calendar, FolderKanban,
  Edit3, Trash2, AlertCircle, RefreshCw, Inbox, Tag as TagIcon, Link2, ChevronRight,
  Loader2, X, Settings2, Check, ChevronUp, ChevronDown,
  LayoutGrid, Columns3, File as FileIcon, Folder as FolderIcon,
} from 'lucide-react';
import { useEntities, useEntityWithRelations, useDeleteEntity, useCreateEntity, useUpdateEntity } from '../hooks/useEntities';
import { useTags, useAssignTag, useRemoveTag } from '../hooks/useTags';
import { useActivityLogs } from '../hooks/useActivityLogs';
import { useFiles } from '../hooks/useFiles';
import {
  useCustomFields,
  useSetCustomFieldValue,
  useDeleteCustomFieldValue,
  useCreateCustomField,
  useDeleteCustomField,
  useUpdateCustomField,
} from '../hooks/useCustomFields';
import { useWorkspaces } from '../hooks/useWorkspace';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useToastStore } from '../stores/toastStore';
import { FolderTree } from '../components/folders/FolderTree';
import type { Entity, CRMEntityType, CRMFilters, CRMSort, EntityInsert, CustomField, CustomFieldValue, CustomFieldInsert, FileItem } from '../types/domain';
import type { FieldType } from '../types/database';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const ENTITY_TYPES: { value: CRMEntityType; label: string; icon: React.ElementType }[] = [
  { value: 'Client', label: 'Client', icon: Users },
  { value: 'Company', label: 'Company', icon: Building2 },
  { value: 'Contact', label: 'Contact', icon: User },
  { value: 'Meeting', label: 'Meeting', icon: Calendar },
  { value: 'Project', label: 'Project', icon: FolderKanban },
];

const SORT_OPTIONS: { value: CRMSort['field']; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'created_at', label: 'Date Created' },
  { value: 'updated_at', label: 'Last Updated' },
];

const entitySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional().default(''),
  entity_type: z.enum(['Client', 'Company', 'Contact', 'Meeting', 'Project']).default('Client'),
  parent_id: z.string().optional().nullable(),
});

type EntityFormData = z.infer<typeof entitySchema>;

export function CRMPage() {
  const { data: workspaces } = useWorkspaces();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const effectiveWsId = activeWorkspaceId ?? workspaces?.[0]?.id ?? null;
  const showToast = useToastStore((s) => s.showToast);

  const [filters, setFilters] = useState<CRMFilters>({ search: '', entityType: 'all' });
  const [sort, setSort] = useState<CRMSort>({ field: 'name', direction: 'asc' });
  const [showForm, setShowForm] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [detailEntityId, setDetailEntityId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'workspace'>('grid');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  const { data: entities, isLoading, isError, error, refetch } = useEntities(effectiveWsId, {
    entityType: filters.entityType !== 'all' ? filters.entityType : undefined,
  });
  const deleteEntity = useDeleteEntity();

  const filtered = useMemo(() => {
    let result = entities ?? [];
    if (filters.search && filters.search.trim()) {
      const term = filters.search.toLowerCase();
      result = result.filter((e) =>
        e.name.toLowerCase().includes(term) || (e.description ?? '').toLowerCase().includes(term)
      );
    }
    const ascending = sort.direction === 'asc';
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sort.field === 'name') cmp = a.name.localeCompare(b.name);
      else cmp = new Date(a[sort.field]).getTime() - new Date(b[sort.field]).getTime();
      return ascending ? cmp : -cmp;
    });
    return result;
  }, [entities, filters.search, sort]);

  if (!effectiveWsId) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-6">
        <Inbox className="w-12 h-12 text-gray-600 mb-3" />
        <h2 className="text-lg font-semibold text-white">No Workspace</h2>
        <p className="text-sm text-gray-500 mt-1">Create a workspace to start managing CRM.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-600/15 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">CRM</h1>
            <p className="text-xs text-gray-500">Clients, companies, contacts, meetings, and projects</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-surface-400/50 bg-surface-200/50 p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-all ${
                viewMode === 'grid' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              onClick={() => setViewMode('workspace')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-all ${
                viewMode === 'workspace' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Workspace View"
            >
              <Columns3 className="w-4 h-4" />
              <span className="hidden sm:inline">Workspace</span>
            </button>
          </div>
          <button onClick={() => { setEditingEntity(null); setShowForm(true); }} className="btn-primary">
            <Plus className="w-4 h-4" /><span className="hidden sm:inline">New Entry</span>
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search CRM..."
            value={filters.search ?? ''}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="input-field pl-10 py-2"
          />
        </div>
        <select
          value={filters.entityType ?? 'all'}
          onChange={(e) => setFilters({ ...filters, entityType: e.target.value as CRMEntityType | 'all' })}
          className="input-field py-2 w-auto min-w-[120px]"
        >
          <option value="all">All Types</option>
          {ENTITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select
          value={sort.field}
          onChange={(e) => setSort({ ...sort, field: e.target.value as CRMSort['field'] })}
          className="input-field py-2 w-auto min-w-[120px]"
        >
          {SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <button onClick={() => setSort({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' })} className="btn-ghost py-2 px-3">
          {sort.direction === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      {/* Type filter pills */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilters({ ...filters, entityType: 'all' })}
          className={`badge transition-all ${filters.entityType === 'all' ? 'bg-primary-600/20 text-primary-300 ring-1 ring-primary-500/30' : 'bg-surface-200/50 text-gray-400 hover:bg-surface-300'}`}
        >
          All
        </button>
        {ENTITY_TYPES.map((t) => {
          const Icon = t.icon;
          const isActive = filters.entityType === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setFilters({ ...filters, entityType: isActive ? 'all' : t.value })}
              className={`badge transition-all ${isActive ? 'bg-primary-600/20 text-primary-300 ring-1 ring-primary-500/30' : 'bg-surface-200/50 text-gray-400 hover:bg-surface-300'}`}
            >
              <Icon className="w-3 h-3" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="w-10 h-10 text-error-400 mb-3" />
          <p className="text-sm text-gray-400 mb-1">Failed to load CRM data</p>
          <p className="text-xs text-gray-600 mb-4">{error instanceof Error ? error.message : 'An error occurred'}</p>
          <button onClick={() => refetch()} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Retry</button>
        </div>
      ) : isLoading ? (
        <CRMSkeleton />
      ) : viewMode === 'workspace' ? (
        <WorkspaceView
          workspaceId={effectiveWsId}
          entities={filtered}
          selectedEntityId={selectedEntityId}
          onSelectEntity={setSelectedEntityId}
          onEditEntity={(e) => { setEditingEntity(e); setShowForm(true); }}
          onDeleteEntity={(id) => deleteEntity.mutate(id)}
          onOpenDetail={(id) => setDetailEntityId(id)}
        />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-surface-200/50 flex items-center justify-center mb-4">
            <Users className="w-7 h-7 text-gray-600" />
          </div>
          <h3 className="text-base font-medium text-gray-300">{filters.search ? 'No results found' : 'No CRM entries yet'}</h3>
          <p className="text-sm text-gray-500 mt-1">{filters.search ? 'Try adjusting your search.' : 'Create your first CRM entry to get started.'}</p>
          <button onClick={() => { setEditingEntity(null); setShowForm(true); }} className="btn-primary mt-4">
            <Plus className="w-4 h-4" /> New Entry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((entity) => {
            const typeConfig = ENTITY_TYPES.find((t) => t.value === entity.entity_type);
            const Icon = typeConfig?.icon ?? Users;
            return (
              <EntityCard
                key={entity.id}
                entity={entity}
                icon={Icon}
                onClick={() => setDetailEntityId(entity.id)}
                onEdit={() => { setEditingEntity(entity); setShowForm(true); }}
              />
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <EntityFormModal
          workspaceId={effectiveWsId}
          entity={editingEntity}
          onClose={() => { setShowForm(false); setEditingEntity(null); }}
        />
      )}
      {detailEntityId && (
        <EntityDetailPanel
          entityId={detailEntityId}
          workspaceId={effectiveWsId}
          onClose={() => setDetailEntityId(null)}
          onEdit={() => { const e = entities?.find(x => x.id === detailEntityId); if (e) { setEditingEntity(e); setShowForm(true); } }}
        />
      )}
    </div>
  );
}

function WorkspaceView({
  workspaceId,
  entities,
  selectedEntityId,
  onSelectEntity,
  onEditEntity,
  onDeleteEntity,
  onOpenDetail,
}: {
  workspaceId: string;
  entities: Entity[];
  selectedEntityId: string | null;
  onSelectEntity: (id: string | null) => void;
  onEditEntity: (entity: Entity) => void;
  onDeleteEntity: (id: string) => void;
  onOpenDetail: (id: string) => void;
}) {
  // Auto-select first entity if none selected
  useEffect(() => {
    if (!selectedEntityId && entities.length > 0) {
      onSelectEntity(entities[0].id);
    }
  }, [selectedEntityId, entities, onSelectEntity]);

  const selectedEntity = useMemo(
    () => entities.find((e) => e.id === selectedEntityId) ?? null,
    [entities, selectedEntityId],
  );

  const { data: entityWithRelations } = useEntityWithRelations(selectedEntityId);
  const { data: activityLogs } = useActivityLogs(workspaceId, { entityId: selectedEntityId ?? undefined });
  const { data: customFields } = useCustomFields(workspaceId, selectedEntity?.entity_type);
  const { data: files } = useFiles(workspaceId, { filters: { entityId: selectedEntityId ?? 'all' } });

  const setCustomFieldValue = useSetCustomFieldValue();
  const deleteCustomFieldValue = useDeleteCustomFieldValue();
  const assignTag = useAssignTag();
  const removeTag = useRemoveTag();
  const showToast = useToastStore((s) => s.showToast);

  const entityTags = useMemo(() => {
    if (!entityWithRelations?.tags) return [];
    return entityWithRelations.tags;
  }, [entityWithRelations]);

  const fieldValuesMap = useMemo(() => {
    const map = new Map<string, CustomFieldValue>();
    if (entityWithRelations?.customFieldValues) {
      for (const fv of entityWithRelations.customFieldValues) {
        map.set(fv.custom_field_id, fv);
      }
    }
    return map;
  }, [entityWithRelations]);

  const handleDelete = (id: string) => {
    if (confirm('Delete this entity? This cannot be undone.')) {
      onDeleteEntity(id);
    }
  };

  return (
    <div className="flex gap-3 h-[calc(100vh-220px)] min-h-[400px]">
      {/* Left pane: entity navigation list (200px) */}
      <div className="w-[200px] shrink-0 rounded-xl border border-surface-400/30 bg-surface-100 overflow-y-auto">
        <div className="sticky top-0 bg-surface-100/95 backdrop-blur-sm px-3 py-2.5 border-b border-surface-400/30">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Entities</span>
        </div>
        <div className="py-1">
          {entities.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <Users className="w-5 h-5 text-gray-600 mx-auto mb-1.5" />
              <p className="text-xs text-gray-500">No entities</p>
            </div>
          ) : (
            entities.map((entity) => {
              const typeConfig = ENTITY_TYPES.find((t) => t.value === entity.entity_type);
              const Icon = typeConfig?.icon ?? Users;
              const isSelected = entity.id === selectedEntityId;
              return (
                <button
                  key={entity.id}
                  onClick={() => onSelectEntity(entity.id)}
                  className={`group w-full flex items-center gap-2 px-3 py-2 text-left transition-all ${
                    isSelected ? 'bg-primary-600/15 text-primary-300' : 'text-gray-300 hover:bg-surface-200/50'
                  }`}
                >
                  <Icon className="shrink-0 w-4 h-4 text-gray-400" />
                  <span className="flex-1 min-w-0 truncate text-sm">{entity.name}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Middle pane: FolderTree + file list (flexible) */}
      <div className="flex-1 min-w-0 rounded-xl border border-surface-400/30 bg-surface-100 overflow-y-auto">
        {selectedEntity ? (
          <div className="p-3">
            <div className="mb-3 flex items-center gap-2">
              {(() => {
                const typeConfig = ENTITY_TYPES.find((t) => t.value === selectedEntity.entity_type);
                const Icon = typeConfig?.icon ?? Users;
                return <Icon className="w-5 h-5 text-primary-400" />;
              })()}
              <h2 className="text-sm font-semibold text-gray-100">{selectedEntity.name}</h2>
              <span className="text-xs text-gray-500">· Workspace</span>
            </div>
            <FolderTree
              workspaceId={workspaceId}
              entityScope={selectedEntity.id}
              showAllOption
              allOptionLabel="All folders"
            />
            <div className="mt-4 pt-3 border-t border-surface-400/30">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Files</span>
                <span className="text-xs text-gray-600">{files?.length ?? 0}</span>
              </div>
              {files && files.length > 0 ? (
                <div className="space-y-1">
                  {files.map((file: FileItem) => (
                    <div
                      key={file.id}
                      className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-200/50 transition-colors"
                    >
                      <FileIcon className="shrink-0 w-4 h-4 text-gray-400" />
                      <span className="flex-1 min-w-0 truncate text-sm text-gray-300">{file.name}</span>
                      {file.size_bytes != null && (
                        <span className="text-xs text-gray-600">
                          {file.size_bytes < 1024 ? `${file.size_bytes} B` : file.size_bytes < 1024 * 1024 ? `${(file.size_bytes / 1024).toFixed(1)} KB` : `${(file.size_bytes / 1024 / 1024).toFixed(1)} MB`}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-2 py-4 text-center">
                  <FileIcon className="w-5 h-5 text-gray-600 mx-auto mb-1.5" />
                  <p className="text-xs text-gray-500">No files for this entity</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <FolderKanban className="w-8 h-8 text-gray-600 mb-2" />
            <p className="text-sm text-gray-500">Select an entity to view its workspace</p>
          </div>
        )}
      </div>

      {/* Right pane: entity details (380px) */}
      <div className="w-[380px] shrink-0 rounded-xl border border-surface-400/30 bg-surface-100 overflow-y-auto">
        {selectedEntity ? (
          <div className="p-4">
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary-600/15 flex items-center justify-center shrink-0">
                {(() => {
                  const typeConfig = ENTITY_TYPES.find((t) => t.value === selectedEntity.entity_type);
                  const Icon = typeConfig?.icon ?? Users;
                  return <Icon className="w-5 h-5 text-primary-400" />;
                })()}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-gray-100 break-words">{selectedEntity.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{selectedEntity.entity_type}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => onEditEntity(selectedEntity)} className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-surface-200 rounded-md transition-all" title="Edit">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(selectedEntity.id)} className="p-1.5 text-gray-500 hover:text-error-400 hover:bg-error-600/10 rounded-md transition-all" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Description */}
            {selectedEntity.description ? (
              <div className="mb-4">
                <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">Description</h3>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{selectedEntity.description}</p>
              </div>
            ) : null}

            {/* Related entities */}
            {entityWithRelations?.children && entityWithRelations.children.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">Related ({entityWithRelations.children.length})</h3>
                <div className="space-y-1">
                  {entityWithRelations.children.map((child) => {
                    const typeConfig = ENTITY_TYPES.find((t) => t.value === child.entity_type);
                    const Icon = typeConfig?.icon ?? Users;
                    return (
                      <button
                        key={child.id}
                        onClick={() => onSelectEntity(child.id)}
                        className="flex items-center gap-2 text-sm text-gray-300 hover:text-primary-300 transition-colors w-full text-left"
                      >
                        <Icon className="w-4 h-4 text-gray-400" />
                        <span className="truncate">{child.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Custom fields */}
            {customFields && customFields.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">Custom Fields</h3>
                <div className="space-y-2">
                  {customFields.map((field: CustomField) => {
                    const fv = fieldValuesMap.get(field.id);
                    return (
                      <div key={field.id} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-500">{field.field_name}</span>
                        <span className="text-sm text-gray-300">{fv?.field_value ?? '—'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tags */}
            <div className="mb-4">
              <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">Tags</h3>
              {entityTags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {entityTags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                      style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                      <button
                        onClick={() => removeTag.mutate({ entityId: selectedEntity.id, tagId: tag.id })}
                        className="ml-0.5 text-gray-500 hover:text-error-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-600">No tags</p>
              )}
            </div>

            {/* Activity history */}
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">Activity</h3>
              {activityLogs && activityLogs.length > 0 ? (
                <div className="space-y-2">
                  {activityLogs.slice(0, 10).map((log) => (
                    <div key={log.id} className="flex items-start gap-2 text-xs">
                      <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary-500 mt-1" />
                      <div className="min-w-0">
                        <p className="text-gray-300">{log.action}</p>
                        <p className="text-gray-600">{new Date(log.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-600">No activity yet</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <Users className="w-8 h-8 text-gray-600 mb-2" />
            <p className="text-sm text-gray-500">Select an entity to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

function EntityCard({ entity, icon: Icon, onClick, onEdit }: { entity: Entity; icon: React.ElementType; onClick: () => void; onEdit: () => void }) {
  return (
    <div
      onClick={onClick}
      className="group relative rounded-xl border border-surface-400/30 bg-surface-100 p-4 cursor-pointer hover:border-surface-400/50 hover:bg-surface-200/30 transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary-600/15 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-gray-100 truncate">{entity.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{entity.entity_type}</p>
          {entity.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{entity.description}</p>}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-500 hover:text-gray-300">
          <Edit3 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function EntityFormModal({ workspaceId, entity, onClose }: { workspaceId: string; entity: Entity | null; onClose: () => void }) {
  const isEdit = !!entity;
  const createEntity = useCreateEntity();
  const updateEntity = useUpdateEntity();
  const showToast = useToastStore((s) => s.showToast);
  const { data: entities } = useEntities(workspaceId);

  const form = useForm<EntityFormData>({
    resolver: zodResolver(entitySchema),
    defaultValues: {
      name: entity?.name ?? '',
      description: entity?.description ?? '',
      entity_type: (entity?.entity_type as EntityFormData['entity_type']) ?? 'Client',
      parent_id: entity?.parent_id ?? null,
    },
  });

  const onSubmit = async (data: EntityFormData) => {
    try {
      if (isEdit && entity) {
        await updateEntity.mutateAsync({ id: entity.id, updates: data });
        showToast('success', 'Entry updated');
      } else {
        await createEntity.mutateAsync({ ...data, workspace_id: workspaceId } as EntityInsert);
        showToast('success', 'Entry created');
      }
      form.reset();
      onClose();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const isSubmitting = form.formState.isSubmitting;
  const entityType = form.watch('entity_type');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-0/70 backdrop-blur-sm animate-fade-in p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-surface-400/40 bg-surface-100 shadow-elevated animate-scale-in">
        <div className="flex items-center justify-between p-5 border-b border-surface-400/30 sticky top-0 bg-surface-100 z-10">
          <h2 className="text-lg font-semibold text-white">{isEdit ? 'Edit Entry' : 'New CRM Entry'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Type</label>
            <div className="flex gap-2 flex-wrap">
              {ENTITY_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => form.setValue('entity_type', t.value)}
                    className={`badge transition-all ${entityType === t.value ? 'bg-primary-600/20 text-primary-300 ring-1 ring-primary-500/30' : 'bg-surface-200/50 text-gray-400 hover:bg-surface-300'}`}
                  >
                    <Icon className="w-3 h-3" /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Name <span className="text-error-400">*</span></label>
            <input type="text" autoFocus className="input-field" {...form.register('name')} />
            {form.formState.errors.name && <p className="mt-1.5 text-xs text-error-400">{form.formState.errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
            <textarea rows={3} className="input-field resize-none" {...form.register('description')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Parent Entity</label>
            <select className="input-field" {...form.register('parent_id')}>
              <option value="">No parent</option>
              {(entities ?? []).filter((e) => e.id !== entity?.id).map((e) => (
                <option key={e.id} value={e.id}>{e.name} ({e.entity_type})</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-2 sticky bottom-0 bg-surface-100 pb-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : isEdit ? 'Save Changes' : 'Create Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom Fields: inline-editable values section + Manage Fields modal
// ---------------------------------------------------------------------------

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Checkbox' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'url', label: 'URL' },
  { value: 'currency', label: 'Currency' },
];

const SELECTABLE_FIELD_TYPES: FieldType[] = ['select', 'multiselect'];

/** Parse a stored string field_value into a string[] for multiselect fields. */
function parseMultiValue(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return raw ? [raw] : [];
  }
}

/** Serialize a string[] into a JSON string for storage as field_value. */
function serializeMultiValue(values: string[]): string {
  return JSON.stringify(values);
}

function CustomFieldsSection({
  workspaceId,
  entityId,
  entityType,
  customFieldValues,
}: {
  workspaceId: string;
  entityId: string;
  entityType: string;
  customFieldValues: CustomFieldValue[];
}) {
  const { data: fieldDefs, isLoading } = useCustomFields(workspaceId, entityType);
  const setValue = useSetCustomFieldValue();
  const deleteValue = useDeleteCustomFieldValue();
  const showToast = useToastStore((s) => s.showToast);
  const [manageOpen, setManageOpen] = useState(false);

  // Track which field is currently being edited (by custom field id).
  const [editingId, setEditingId] = useState<string | null>(null);

  // Build a lookup of current values keyed by custom_field_id.
  const valueMap = useMemo(() => {
    const map = new Map<string, CustomFieldValue>();
    for (const v of customFieldValues) map.set(v.custom_field_id, v);
    return map;
  }, [customFieldValues]);

  const sortedDefs = useMemo(
    () => [...(fieldDefs ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    [fieldDefs]
  );

  const handleSave = async (field: CustomField, raw: string | string[] | null) => {
    // Normalize the value for storage.
    let stored: string | null;
    if (Array.isArray(raw)) {
      stored = raw.length > 0 ? serializeMultiValue(raw) : null;
    } else if (raw === '' || raw === null) {
      stored = null;
    } else {
      stored = raw;
    }

    try {
      if (stored === null) {
        await deleteValue.mutateAsync({ customFieldId: field.id, entityId });
      } else {
        await setValue.mutateAsync({ customFieldId: field.id, entityId, fieldValue: stored });
      }
      setEditingId(null);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save field');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-xs text-gray-500">Custom Fields</div>
        <button
          onClick={() => setManageOpen(true)}
          className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
          title="Manage custom field definitions"
        >
          <Settings2 className="w-3.5 h-3.5" /> Manage
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading fields…
        </div>
      ) : sortedDefs.length === 0 ? (
        <div className="text-xs text-gray-600 py-2">
          No custom fields yet. Click <span className="text-primary-400">Manage</span> to add one.
        </div>
      ) : (
        <div className="space-y-2">
          {sortedDefs.map((field) => {
            const value = valueMap.get(field.id);
            const isEditing = editingId === field.id;
            return (
              <div key={field.id} className="rounded-lg border border-surface-400/30 bg-surface-200/30 px-3 py-2">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-xs font-medium text-gray-300">{field.field_name}</span>
                  {field.is_required && <span className="text-error-400 text-xs">*</span>}
                </div>
                <CustomFieldValueEditor
                  field={field}
                  currentValue={value?.field_value ?? null}
                  isEditing={isEditing}
                  onStartEdit={() => setEditingId(field.id)}
                  onSave={(raw) => handleSave(field, raw)}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            );
          })}
        </div>
      )}

      {manageOpen && (
        <ManageFieldsModal
          workspaceId={workspaceId}
          entityType={entityType}
          onClose={() => setManageOpen(false)}
        />
      )}
    </div>
  );
}

function CustomFieldValueEditor({
  field,
  currentValue,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
}: {
  field: CustomField;
  currentValue: string | null;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (value: string | string[] | null) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [multiSelected, setMultiSelected] = useState<string[]>([]);

  // Initialize local state when entering edit mode.
  useEffect(() => {
    if (!isEditing) return;
    if (field.field_type === 'multiselect') {
      setMultiSelected(parseMultiValue(currentValue));
    } else {
      setText(currentValue ?? '');
    }
  }, [isEditing, field.field_type, currentValue]);

  const options: string[] = Array.isArray(
    (field.field_options as { options?: string[] } | null)?.options
  )
    ? ((field.field_options as { options: string[] }).options)
    : [];

  const commit = (raw: string | string[] | null) => onSave(raw);

  // --- Display (non-editing) states -----------------------------------------------------------
  if (!isEditing) {
    if (field.field_type === 'boolean') {
      const checked = currentValue === 'true';
      return (
        <button
          onClick={() => commit(checked ? 'false' : 'true')}
          className="flex items-center gap-2 text-sm text-gray-200 group"
          title={checked ? 'Uncheck' : 'Check'}
        >
          <span
            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              checked ? 'bg-primary-600 border-primary-600' : 'border-surface-400/50 bg-surface-100'
            }`}
          >
            {checked && <Check className="w-3 h-3 text-white" />}
          </span>
          <span className="text-xs text-gray-500 group-hover:text-gray-400">
            {checked ? 'Yes' : 'No'}
          </span>
        </button>
      );
    }

    if (field.field_type === 'multiselect') {
      const selected = parseMultiValue(currentValue);
      if (selected.length === 0) {
        return <DisplayValue empty onEdit={onStartEdit} />;
      }
      return (
        <div onClick={onStartEdit} className="cursor-pointer">
          <div className="flex flex-wrap gap-1">
            {selected.map((opt) => (
              <span key={opt} className="badge bg-primary-600/15 text-primary-300 text-xs">
                {opt}
              </span>
            ))}
          </div>
        </div>
      );
    }

    if (field.field_type === 'select') {
      return (
        <DisplayValue
          value={currentValue ?? ''}
          empty={true}
          onEdit={onStartEdit}
        />
      );
    }

    // text, number, date, email, phone, url, currency, textarea
    return <DisplayValue value={currentValue ?? ''} empty={true} onEdit={onStartEdit} />;
  }

  // --- Editing states --------------------------------------------------------------------------
  const baseInput =
    'w-full bg-surface-100 border border-primary-500/40 rounded-md px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-500';

  if (field.field_type === 'textarea') {
    return (
      <textarea
        autoFocus
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => commit(text)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            commit(text);
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        className={`${baseInput} resize-none`}
      />
    );
  }

  if (field.field_type === 'select') {
    return (
      <select
        autoFocus
        value={text}
        onChange={(e) => {
          setText(e.target.value);
        }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        className={baseInput}
      >
        <option value="">— Select —</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (field.field_type === 'multiselect') {
    const toggle = (opt: string) => {
      setMultiSelected((prev) =>
        prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
      );
    };
    return (
      <div className="space-y-1">
        {options.length === 0 && (
          <p className="text-xs text-gray-600">No options defined for this field.</p>
        )}
        {options.map((opt) => {
          const checked = multiSelected.includes(opt);
          return (
            <label key={opt} className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
              <span
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  checked ? 'bg-primary-600 border-primary-600' : 'border-surface-400/50 bg-surface-100'
                }`}
              >
                {checked && <Check className="w-3 h-3 text-white" />}
              </span>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(opt)}
                className="sr-only"
              />
              <span>{opt}</span>
            </label>
          );
        })}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => commit(multiSelected)}
            className="btn-primary text-xs px-2 py-1"
          >
            <Check className="w-3.5 h-3.5" /> Save
          </button>
          <button onClick={onCancel} className="btn-secondary text-xs px-2 py-1">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (field.field_type === 'boolean') {
    const checked = text === 'true';
    return (
      <div className="flex items-center gap-2">
        <button
          autoFocus
          onClick={() => {
            const next = !checked ? 'true' : 'false';
            setText(next);
            commit(next);
          }}
          className="flex items-center gap-2 text-sm text-gray-200"
        >
          <span
            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              checked ? 'bg-primary-600 border-primary-600' : 'border-surface-400/50 bg-surface-100'
            }`}
          >
            {checked && <Check className="w-3 h-3 text-white" />}
          </span>
          <span className="text-xs text-gray-500">{checked ? 'Yes' : 'No'}</span>
        </button>
        <button onClick={onCancel} className="btn-secondary text-xs px-2 py-1">
          Cancel
        </button>
      </div>
    );
  }

  // text, number, date, email, phone, url, currency
  const inputType: React.InputHTMLAttributes<HTMLInputElement>['type'] =
    field.field_type === 'number'
      ? 'number'
      : field.field_type === 'date'
      ? 'date'
      : field.field_type === 'email'
      ? 'email'
      : field.field_type === 'phone'
      ? 'tel'
      : field.field_type === 'url'
      ? 'url'
      : 'text';

  return (
    <input
      autoFocus
      type={inputType}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => commit(text)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit(text);
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      className={baseInput}
    />
  );
}

/** Read-only display of a single field value; click to edit. */
function DisplayValue({
  value,
  empty,
  onEdit,
}: {
  value: string;
  empty?: boolean;
  onEdit: () => void;
}) {
  if (!value || (empty && value.trim() === '')) {
    return (
      <button
        onClick={onEdit}
        className="text-xs text-gray-600 hover:text-primary-400 transition-colors italic"
      >
        Click to add value
      </button>
    );
  }
  return (
    <div onClick={onEdit} className="cursor-pointer text-sm text-gray-200 whitespace-pre-wrap break-words">
      {value}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manage Fields modal: create / delete / reorder field definitions
// ---------------------------------------------------------------------------

const newFieldSchema = z.object({
  field_name: z.string().min(1, 'Name is required').max(100),
  field_type: z.enum([
    'text', 'number', 'date', 'select', 'boolean', 'email', 'phone', 'url', 'currency', 'textarea', 'multiselect',
  ]),
  is_required: z.boolean(),
});

function ManageFieldsModal({
  workspaceId,
  entityType,
  onClose,
}: {
  workspaceId: string;
  entityType: string;
  onClose: () => void;
}) {
  const { data: fieldDefs, isLoading } = useCustomFields(workspaceId, entityType);
  const createField = useCreateCustomField();
  const deleteField = useDeleteCustomField();
  const updateField = useUpdateCustomField();
  const showToast = useToastStore((s) => s.showToast);

  const [showAddForm, setShowAddForm] = useState(false);
  const [optionsText, setOptionsText] = useState('');

  const form = useForm<z.infer<typeof newFieldSchema>>({
    resolver: zodResolver(newFieldSchema),
    defaultValues: { field_name: '', field_type: 'text', is_required: false },
  });

  const sortedDefs = useMemo(
    () => [...(fieldDefs ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    [fieldDefs]
  );

  const watchedType = form.watch('field_type');
  const needsOptions = SELECTABLE_FIELD_TYPES.includes(watchedType);

  const handleCreate = async (values: z.infer<typeof newFieldSchema>) => {
    const maxOrder = sortedDefs.reduce((max, f) => Math.max(max, f.sort_order), -1);
    const insert: CustomFieldInsert = {
      workspace_id: workspaceId,
      entity_type: entityType,
      field_name: values.field_name,
      field_type: values.field_type,
      is_required: values.is_required,
      sort_order: maxOrder + 1,
    };
    if (needsOptions) {
      const options = optionsText
        .split('\n')
        .map((o) => o.trim())
        .filter(Boolean);
      insert.field_options = { options };
    }
    try {
      await createField.mutateAsync(insert);
      showToast('success', 'Field created');
      form.reset({ field_name: '', field_type: 'text', is_required: false });
      setOptionsText('');
      setShowAddForm(false);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to create field');
    }
  };

  const handleDelete = async (field: CustomField) => {
    if (!confirm(`Delete field "${field.field_name}"? This will remove it from all entries of this type.`)) return;
    try {
      await deleteField.mutateAsync(field.id);
      showToast('success', 'Field deleted');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete field');
    }
  };

  const moveField = async (field: CustomField, direction: 'up' | 'down') => {
    const index = sortedDefs.findIndex((f) => f.id === field.id);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sortedDefs.length) return;
    const swapField = sortedDefs[swapIndex];
    try {
      // Swap sort_order values between the two fields.
      await Promise.all([
        updateField.mutateAsync({ id: field.id, updates: { sort_order: swapField.sort_order } }),
        updateField.mutateAsync({ id: swapField.id, updates: { sort_order: field.sort_order } }),
      ]);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to reorder field');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface-0/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] bg-surface-50 rounded-xl border border-surface-400/30 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-surface-400/30">
          <div>
            <h2 className="text-base font-semibold text-white">Manage Custom Fields</h2>
            <p className="text-xs text-gray-500">For entity type: {entityType}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : sortedDefs.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No custom fields defined yet.</p>
          ) : (
            sortedDefs.map((field, index) => (
              <div
                key={field.id}
                className="flex items-center gap-2 rounded-lg border border-surface-400/30 bg-surface-200/30 px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-gray-200 truncate">{field.field_name}</span>
                    {field.is_required && <span className="text-error-400 text-xs">*</span>}
                  </div>
                  <span className="text-xs text-gray-500">
                    {FIELD_TYPE_OPTIONS.find((o) => o.value === field.field_type)?.label ?? field.field_type}
                    {SELECTABLE_FIELD_TYPES.includes(field.field_type) &&
                      Array.isArray((field.field_options as { options?: string[] } | null)?.options) &&
                      ` · ${((field.field_options as { options: string[] }).options).length} options`}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => moveField(field, 'up')}
                    disabled={index === 0}
                    className="text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-1 rounded"
                    title="Move up"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveField(field, 'down')}
                    disabled={index === sortedDefs.length - 1}
                    className="text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-1 rounded"
                    title="Move down"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(field)}
                    className="text-gray-500 hover:text-error-400 transition-colors p-1 rounded ml-1"
                    title="Delete field"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-surface-400/30 p-4">
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="btn-secondary w-full flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Field
            </button>
          ) : (
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Field Name</label>
                <input
                  className="input-field"
                  placeholder="e.g. Deal Stage"
                  {...form.register('field_name')}
                />
                {form.formState.errors.field_name && (
                  <p className="text-xs text-error-400 mt-1">{form.formState.errors.field_name.message}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Field Type</label>
                <select className="input-field" {...form.register('field_type')}>
                  {FIELD_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {needsOptions && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Options (one per line)
                  </label>
                  <textarea
                    rows={4}
                    className="input-field resize-none"
                    placeholder={'Option 1\nOption 2\nOption 3'}
                    value={optionsText}
                    onChange={(e) => setOptionsText(e.target.value)}
                  />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input type="checkbox" {...form.register('is_required')} className="rounded" />
                Required
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    form.reset();
                    setOptionsText('');
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createField.isPending}
                  className="btn-primary flex-1 flex items-center justify-center gap-1.5"
                >
                  {createField.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                  ) : (
                    <><Plus className="w-4 h-4" /> Create</>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function EntityDetailPanel({ entityId, workspaceId, onClose, onEdit }: { entityId: string; workspaceId: string; onClose: () => void; onEdit: () => void }) {
  const { data, isLoading, isError } = useEntityWithRelations(entityId);
  const deleteEntity = useDeleteEntity();
  const showToast = useToastStore((s) => s.showToast);
  const { data: activityLogs } = useActivityLogs(workspaceId, entityId);
  const { data: allTags } = useTags(workspaceId);
  const assignTag = useAssignTag();
  const removeTag = useRemoveTag();
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (data?.tags) setSelectedTagIds(new Set(data.tags.map((t) => t.id)));
  }, [data?.tags]);

  const toggleTag = async (tagId: string) => {
    const next = new Set(selectedTagIds);
    try {
      if (next.has(tagId)) { await removeTag.mutateAsync({ entityId, tagId }); next.delete(tagId); }
      else { await assignTag.mutateAsync({ entityId, tagId }); next.add(tagId); }
      setSelectedTagIds(next);
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed to update tags'); }
  };

  const handleDelete = async () => {
    try { await deleteEntity.mutateAsync(entityId); showToast('success', 'Entry deleted'); onClose(); }
    catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed to delete'); }
  };

  if (isLoading) return <DetailSkeleton onClose={onClose} />;
  if (isError || !data?.entity) return <DetailError onClose={onClose} />;

  const { entity, tags, children, customFieldValues } = data;
  const typeConfig = ENTITY_TYPES.find((t) => t.value === entity.entity_type);
  const Icon = typeConfig?.icon ?? Users;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-surface-0/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-surface-50 border-l border-surface-400/30 overflow-y-auto animate-slide-down" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-surface-400/30 sticky top-0 bg-surface-50 z-10">
          <h2 className="text-base font-semibold text-white truncate flex-1">CRM Details</h2>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded" title="Edit"><Edit3 className="w-4 h-4" /></button>
            <button onClick={handleDelete} className="text-gray-500 hover:text-error-400 transition-colors p-1.5 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="p-4 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-600/15 flex items-center justify-center shrink-0">
              <Icon className="w-6 h-6 text-primary-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{entity.name}</h3>
              <p className="text-xs text-gray-500">{entity.entity_type}</p>
            </div>
          </div>
          {entity.description && <p className="text-sm text-gray-300 whitespace-pre-wrap">{entity.description}</p>}

          <CustomFieldsSection
            workspaceId={workspaceId}
            entityId={entity.id}
            entityType={entity.entity_type}
            customFieldValues={customFieldValues ?? []}
          />

          {children.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-1.5">Related Entries</div>
              <div className="space-y-1">
                {children.map((child) => {
                  const childConfig = ENTITY_TYPES.find((t) => t.value === child.entity_type);
                  const ChildIcon = childConfig?.icon ?? ChevronRight;
                  return (
                    <div key={child.id} className="flex items-center gap-2 rounded-lg border border-surface-400/30 bg-surface-200/30 px-3 py-2">
                      <ChildIcon className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-sm text-gray-200">{child.name}</span>
                      <span className="text-xs text-gray-600 ml-auto">{child.entity_type}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(allTags ?? []).length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5"><TagIcon className="w-3.5 h-3.5" /> Tags</div>
              <div className="flex flex-wrap gap-2">
                {(allTags ?? []).map((tag) => {
                  const isSelected = selectedTagIds.has(tag.id);
                  return (
                    <button key={tag.id} onClick={() => toggleTag(tag.id)}
                      className={`badge transition-all ${isSelected ? 'ring-1 ring-primary-500/30' : 'bg-surface-200/50 text-gray-400 hover:bg-surface-300'}`}
                      style={isSelected ? { backgroundColor: (tag.color ?? '#3b82f6') + '20', color: tag.color ?? '#3b82f6' } : undefined}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color ?? '#6b7280' }} />{tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(activityLogs ?? []).length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-1.5">Activity History</div>
              <div className="space-y-1">
                {(activityLogs ?? []).slice(0, 10).map((log) => (
                  <div key={log.id} className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                    <span className="capitalize">{log.action}</span>
                    <span className="text-gray-600 ml-auto">{new Date(log.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-surface-400/20 text-xs text-gray-600 space-y-1">
            <p>Created: {new Date(entity.created_at).toLocaleDateString()}</p>
            <p>Updated: {new Date(entity.updated_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CRMSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-surface-400/30 bg-surface-100 p-4">
          <div className="flex items-start gap-3">
            <div className="skeleton w-10 h-10 rounded-lg" />
            <div className="flex-1"><div className="skeleton h-4 max-w-32 rounded mb-2" /><div className="skeleton h-3 w-16 rounded" /></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailSkeleton({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-surface-0/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-surface-50 border-l border-surface-400/30 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <div className="skeleton w-6 h-6 rounded-full" />
      </div>
    </div>
  );
}

function DetailError({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-surface-0/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-surface-50 border-l border-surface-400/30 flex flex-col items-center justify-center gap-4" onClick={(e) => e.stopPropagation()}>
        <AlertCircle className="w-8 h-8 text-error-400" />
        <p className="text-sm text-gray-400">Failed to load details</p>
        <button onClick={onClose} className="btn-secondary">Close</button>
      </div>
    </div>
  );
}
