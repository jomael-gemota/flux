import type { CanvasNode } from '../store/workflowStore';

/** Recursively search any config value for {{nodes.<targetId>. expressions. */
export function configReferencesNode(obj: unknown, targetId: string): boolean {
  if (typeof obj === 'string') {
    return new RegExp(
      `\\{\\{\\s*nodes\\.${targetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`
    ).test(obj);
  }
  if (Array.isArray(obj)) return obj.some((v) => configReferencesNode(v, targetId));
  if (obj !== null && typeof obj === 'object') {
    return Object.values(obj as Record<string, unknown>).some((v) =>
      configReferencesNode(v, targetId)
    );
  }
  return false;
}

/** Returns all nodes (excluding the target itself) whose config references the target node's output. */
export function findDependentsOf(targetId: string, allNodes: CanvasNode[]): CanvasNode[] {
  return allNodes.filter(
    (n) => n.id !== targetId && configReferencesNode(n.data.config, targetId)
  );
}
