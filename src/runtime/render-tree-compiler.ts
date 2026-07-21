import type { RenderNode, RenderTree } from '../contracts/render';
import { RenderTreeSchema } from '../contracts/render';

export interface CompiledRenderTree {
  tree: RenderTree;
  root: RenderNode;
  nodesById: ReadonlyMap<string, RenderNode>;
  traversal: readonly RenderNode[];
  childrenOf(nodeId: string): readonly RenderNode[];
  ancestorsOf(nodeId: string): readonly RenderNode[];
}

export const compileRenderTree = (input: RenderTree): CompiledRenderTree => {
  const tree = RenderTreeSchema.parse(input);
  const nodesById = new Map<string, RenderNode>();
  for (const node of tree.nodes) {
    if (nodesById.has(node.nodeId)) throw new Error(`Duplicate render node id: ${node.nodeId}`);
    nodesById.set(node.nodeId, node);
  }
  const root = nodesById.get(tree.rootNodeId);
  if (!root) throw new Error(`Render tree ${tree.treeId} has no root node ${tree.rootNodeId}.`);
  if (root.parentNodeId !== undefined) throw new Error(`Render tree root ${root.nodeId} cannot declare a parent.`);

  for (const node of tree.nodes) {
    if (node.nodeId !== root.nodeId && node.parentNodeId === undefined) {
      throw new Error(`Render node ${node.nodeId} is disconnected from root ${root.nodeId}.`);
    }
    if (node.parentNodeId !== undefined) {
      const parent = nodesById.get(node.parentNodeId);
      if (!parent) throw new Error(`Render node ${node.nodeId} references missing parent ${node.parentNodeId}.`);
      if (!parent.children.includes(node.nodeId)) {
        throw new Error(`Render node ${node.nodeId} is not declared by parent ${parent.nodeId}.`);
      }
    }
    for (const childId of node.children) {
      const child = nodesById.get(childId);
      if (!child) throw new Error(`Render node ${node.nodeId} references missing child ${childId}.`);
      if (child.parentNodeId !== node.nodeId) {
        throw new Error(`Render child ${childId} does not point back to parent ${node.nodeId}.`);
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const traversal: RenderNode[] = [];
  const visit = (node: RenderNode) => {
    if (visiting.has(node.nodeId)) throw new Error(`Render tree ${tree.treeId} contains a cycle at ${node.nodeId}.`);
    if (visited.has(node.nodeId)) return;
    visiting.add(node.nodeId);
    traversal.push(node);
    node.children.forEach((childId) => visit(nodesById.get(childId)!));
    visiting.delete(node.nodeId);
    visited.add(node.nodeId);
  };
  visit(root);
  if (visited.size !== nodesById.size) {
    const disconnected = tree.nodes.find((node) => !visited.has(node.nodeId))!;
    throw new Error(`Render node ${disconnected.nodeId} is not reachable from root ${root.nodeId}.`);
  }

  const childrenOf = (nodeId: string): readonly RenderNode[] => {
    const node = nodesById.get(nodeId);
    if (!node) throw new Error(`Unknown render node: ${nodeId}`);
    return Object.freeze(node.children.map((childId) => nodesById.get(childId)!));
  };
  const ancestorsOf = (nodeId: string): readonly RenderNode[] => {
    let node = nodesById.get(nodeId);
    if (!node) throw new Error(`Unknown render node: ${nodeId}`);
    const ancestors: RenderNode[] = [];
    while (node.parentNodeId !== undefined) {
      node = nodesById.get(node.parentNodeId)!;
      ancestors.push(node);
    }
    return Object.freeze(ancestors);
  };

  return Object.freeze({
    tree,
    root,
    nodesById,
    traversal: Object.freeze(traversal),
    childrenOf,
    ancestorsOf,
  });
};
