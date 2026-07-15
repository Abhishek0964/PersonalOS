import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logActivity, fetchActivityLogs, fetchActivityForEntity } from '../services/activityLogService';
import type { ActivityLogEntry } from '../types/domain';

export function useActivityLogs(
  workspaceId: string | null,
  options?: {
    entityId?: string;
    entityType?: string;
    limit?: number;
  }
) {
  return useQuery({
    queryKey: ['activity-logs', workspaceId, options],
    queryFn: () => fetchActivityLogs(workspaceId!, options),
    enabled: !!workspaceId,
  });
}

export function useActivityForEntity(entityId: string | null, limit = 20) {
  return useQuery({
    queryKey: ['activity-logs', 'entity', entityId, limit],
    queryFn: () => fetchActivityForEntity(entityId!, limit),
    enabled: !!entityId,
  });
}

export function useLogActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry: ActivityLogEntry) => logActivity(entry),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['activity-logs', variables.workspace_id] });
      if (variables.entity_id) {
        qc.invalidateQueries({ queryKey: ['activity-logs', 'entity', variables.entity_id] });
      }
    },
  });
}
