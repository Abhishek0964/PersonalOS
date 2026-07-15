import type { Folder, FolderNode } from '../types/domain';

export function buildFolderTree(folders: Folder[], rootParentId: string | null = null): FolderNode[] {
  const nodeMap = new Map<string, FolderNode>();
  const roots: FolderNode[] = [];

  for (const folder of folders) {
    nodeMap.set(folder.id, { folder, children: [], depth: 0 });
  }

  for (const folder of folders) {
    const node = nodeMap.get(folder.id)!;
    if (folder.parent_id === rootParentId || (rootParentId === null && !folder.parent_id)) {
      roots.push(node);
    } else if (folder.parent_id && nodeMap.has(folder.parent_id)) {
      const parent = nodeMap.get(folder.parent_id)!;
      parent.children.push(node);
    }
  }

  const setDepth = (nodes: FolderNode[], depth: number) => {
    for (const node of nodes) {
      node.depth = depth;
      setDepth(node.children, depth + 1);
    }
  };
  setDepth(roots, 0);

  return roots;
}

export function flattenFolderTree(nodes: FolderNode[]): FolderNode[] {
  const result: FolderNode[] = [];
  const walk = (list: FolderNode[]) => {
    for (const node of list) {
      result.push(node);
      walk(node.children);
    }
  };
  walk(nodes);
  return result;
}

export function getDescendantFolderIds(folders: Folder[], folderId: string): string[] {
  const ids: string[] = [folderId];
  let added = true;
  while (added) {
    added = false;
    for (const folder of folders) {
      if (folder.parent_id && ids.includes(folder.parent_id) && !ids.includes(folder.id)) {
        ids.push(folder.id);
        added = true;
      }
    }
  }
  return ids;
}
