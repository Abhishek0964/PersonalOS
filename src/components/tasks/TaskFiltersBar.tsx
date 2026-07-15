import { Search, Filter, X } from 'lucide-react';
import type { TaskFilters, TaskSort } from '../../types/domain';
import type { TaskStatus, TaskPriority } from '../../types/database';

interface Props {
  filters: TaskFilters;
  sort: TaskSort;
  onFiltersChange: (filters: TaskFilters) => void;
  onSortChange: (sort: TaskSort) => void;
  resultCount: number;
}

const STATUS_OPTIONS: { value: TaskStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

const PRIORITY_OPTIONS: { value: TaskPriority | 'all'; label: string }[] = [
  { value: 'all', label: 'All Priority' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'created_at', label: 'Date Created' },
  { value: 'title', label: 'Title' },
  { value: 'due_date', label: 'Due Date' },
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
];

export function TaskFiltersBar({ filters, sort, onFiltersChange, onSortChange, resultCount }: Props) {
  const hasActiveFilters =
    (filters.status && filters.status !== 'all') ||
    (filters.priority && filters.priority !== 'all') ||
    (filters.search && filters.search.trim() !== '');

  const clearFilters = () => {
    onFiltersChange({ ...filters, status: 'all', priority: 'all', search: '' });
  };

  return (
    <div className="space-y-3">
      {/* Search + sort row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={filters.search ?? ''}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="input-field pl-10 py-2"
          />
        </div>
        <select
          value={sort.field}
          onChange={(e) => onSortChange({ ...sort, field: e.target.value as TaskSort['field'] })}
          className="input-field py-2 w-auto min-w-[140px]"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          onClick={() => onSortChange({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' })}
          className="btn-ghost py-2 px-3"
          title={sort.direction === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sort.direction === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      {/* Filter dropdowns row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-gray-500 shrink-0" />
        <select
          value={filters.status ?? 'all'}
          onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
          className="input-field py-1.5 text-xs w-auto min-w-[120px]"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={filters.priority ?? 'all'}
          onChange={(e) => onFiltersChange({ ...filters, priority: e.target.value })}
          className="input-field py-1.5 text-xs w-auto min-w-[120px]"
        >
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.showCompleted ?? false}
            onChange={(e) => onFiltersChange({ ...filters, showCompleted: e.target.checked })}
            className="w-3.5 h-3.5 rounded border-surface-400 bg-surface-200 text-primary-600 focus:ring-primary-500/30"
          />
          Show completed
        </label>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="btn-ghost py-1.5 px-2 text-xs">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
        <span className="text-xs text-gray-500 ml-auto">
          {resultCount} {resultCount === 1 ? 'task' : 'tasks'}
        </span>
      </div>
    </div>
  );
}
