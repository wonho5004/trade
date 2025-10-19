import type { CandleLeafNode, ConditionGroupNode, ConditionNode, IndicatorLeafNode } from '@/types/trading/auto-trading';
import { createIndicatorEntry, createIndicatorGroup, createIndicatorLeaf, createCandleLeaf } from '@/lib/trading/autoTradingDefaults';

export function collectIndicatorNodes(node: ConditionNode, acc: IndicatorLeafNode[] = []): IndicatorLeafNode[] {
  if (node.kind === 'indicator') {
    acc.push(node);
    return acc;
  }
  if (node.kind === 'group') {
    node.children.forEach((child) => collectIndicatorNodes(child, acc));
  }
  return acc;
}

export function replaceIndicatorNode(
  node: ConditionNode,
  targetId: string,
  replacer: (current: IndicatorLeafNode) => IndicatorLeafNode
): ConditionNode {
  if (node.kind === 'indicator') {
    if (node.id === targetId) {
      return replacer(node);
    }
    return node;
  }
  if (node.kind === 'group') {
    const children = node.children.map((child) => replaceIndicatorNode(child, targetId, replacer));
    return { ...node, children };
  }
  return node;
}

export function removeNode(node: ConditionNode, targetId: string): ConditionNode | null {
  if (node.id === targetId) {
    return null;
  }
  if (node.kind === 'group') {
    const children = node.children
      .map((child) => removeNode(child, targetId))
      .filter((child): child is ConditionNode => child != null);
    const next: ConditionGroupNode = { ...node, children };
    // if group becomes empty, keep as empty group (caller should normalize)
    return next;
  }
  return node;
}

export function ensureGroup(node: ConditionNode): ConditionGroupNode {
  if (node.kind === 'group') return node;
  return createIndicatorGroup('and', [node]);
}

export function replaceGroupOperator(node: ConditionNode, groupId: string, operator: ConditionGroupNode['operator']): ConditionNode {
  if (node.kind === 'group') {
    if (node.id === groupId) {
      return { ...node, operator };
    }
    return { ...node, children: node.children.map((c) => replaceGroupOperator(c, groupId, operator)) };
  }
  return node;
}

export function insertChild(node: ConditionNode, parentId: string, child: ConditionNode): ConditionNode {
  if (node.kind === 'group') {
    if (node.id === parentId) {
      return { ...node, children: [...node.children, child] };
    }
    return { ...node, children: node.children.map((c) => insertChild(c, parentId, child)) };
  }
  return node;
}

export function replaceCandleNode(node: ConditionNode, candleId: string, replacer: (current: CandleLeafNode) => CandleLeafNode): ConditionNode {
  if (node.kind === 'candle') {
    if (node.id === candleId) return replacer(node);
    return node;
  }
  if (node.kind === 'group') {
    return { ...node, children: node.children.map((c) => replaceCandleNode(c, candleId, replacer)) };
  }
  return node;
}

export function collectGroupNodes(node: ConditionNode, acc: ConditionGroupNode[] = []): ConditionGroupNode[] {
  if (node.kind === 'group') {
    acc.push(node);
    node.children.forEach((c) => collectGroupNodes(c, acc));
  }
  return acc;
}

function findParent(root: ConditionNode, nodeId: string): { parent: ConditionGroupNode; index: number } | null {
  if (root.kind !== 'group') return null;
  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i];
    if (child.id === nodeId) return { parent: root, index: i };
    if (child.kind === 'group') {
      const res = findParent(child, nodeId);
      if (res) return res;
    }
  }
  return null;
}

export function moveNode(root: ConditionNode, nodeId: string, direction: 'up' | 'down'): ConditionNode {
  const info = findParent(root, nodeId);
  if (!info) return root;
  const { parent, index } = info;
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= parent.children.length) return root;
  const nextChildren = parent.children.slice();
  const [item] = nextChildren.splice(index, 1);
  nextChildren.splice(target, 0, item);
  return replaceGroupChildren(root, parent.id, nextChildren);
}

export function replaceGroupChildren(node: ConditionNode, groupId: string, children: ConditionNode[]): ConditionNode {
  if (node.kind === 'group') {
    if (node.id === groupId) {
      return { ...node, children };
    }
    return { ...node, children: node.children.map((c) => replaceGroupChildren(c, groupId, children)) };
  }
  return node;
}

export function moveNodeToGroup(root: ConditionNode, nodeId: string, targetGroupId: string): ConditionNode {
  const info = findParent(root, nodeId);
  if (!info) return root;
  const { parent, index } = info;
  const child = parent.children[index];
  const newParentChildren = parent.children.slice();
  newParentChildren.splice(index, 1);
  let next = replaceGroupChildren(root, parent.id, newParentChildren);
  next = insertChild(next, targetGroupId, child);
  return next;
}

export function duplicateIndicator(root: ConditionNode, nodeId: string): { root: ConditionNode; newId: string } {
  const info = findParent(root, nodeId);
  if (!info) return { root, newId: nodeId };
  const { parent, index } = info;
  const child = parent.children[index];
  if (child.kind !== 'indicator') return { root, newId: nodeId };
  const entry = createIndicatorEntry(child.indicator.type);
  entry.config = { ...(child.indicator.config as any) };
  const dup = createIndicatorLeaf(entry, child.comparison);
  const nextChildren = parent.children.slice();
  nextChildren.splice(index + 1, 0, dup);
  const nextRoot = replaceGroupChildren(root, parent.id, nextChildren);
  return { root: nextRoot, newId: dup.id };
}

export function moveNodeRelative(
  root: ConditionNode,
  sourceId: string,
  targetId: string,
  position: 'before' | 'after' = 'before'
): ConditionNode {
  const sourceInfo = findParent(root, sourceId);
  const targetInfo = findParent(root, targetId);
  if (!sourceInfo || !targetInfo) return root;
  const sourceParent = sourceInfo.parent;
  const targetParent = targetInfo.parent;
  const sourceIndex = sourceInfo.index;
  const targetIndex = targetInfo.index;
  const sourceNode = sourceParent.children[sourceIndex];

  // Remove source
  const sourceSiblings = sourceParent.children.slice();
  sourceSiblings.splice(sourceIndex, 1);
  let intermediate = replaceGroupChildren(root, sourceParent.id, sourceSiblings);

  // If same parent, and source was before target, target index shifts by -1
  const sameParent = sourceParent.id === targetParent.id;
  const adjustedTargetIndex = sameParent && sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
  const insertIndex = position === 'before' ? adjustedTargetIndex : adjustedTargetIndex + 1;

  // Insert into target parent
  const updatedTargetInfo = findParent(intermediate, targetParent.id);
  if (!updatedTargetInfo) return intermediate;
  const updatedTargetParent = updatedTargetInfo.parent;
  const targetSiblings = updatedTargetParent.children.slice();
  const boundedIndex = Math.max(0, Math.min(insertIndex, targetSiblings.length));
  targetSiblings.splice(boundedIndex, 0, sourceNode);
  return replaceGroupChildren(intermediate, updatedTargetParent.id, targetSiblings);
}

export function isDescendant(root: ConditionNode, ancestorId: string, candidateGroupId: string): boolean {
  const stack: ConditionNode[] = [root];
  let ancestor: ConditionGroupNode | null = null;
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.id === ancestorId && node.kind === 'group') {
      ancestor = node;
      break;
    }
    if (node.kind === 'group') stack.push(...node.children);
  }
  if (!ancestor) return false;
  const queue: ConditionNode[] = [...ancestor.children];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.id === candidateGroupId) return true;
    if (node.kind === 'group') queue.push(...node.children);
  }
  return false;
}

export function duplicateGroup(root: ConditionNode, groupId: string): { root: ConditionNode; newGroupId: string; newIndicators: Array<{ id: string; type: string; config: any }> } {
  const info = findParent(root, groupId);
  if (!info) return { root, newGroupId: groupId, newIndicators: [] };
  const { parent, index } = info;
  const child = parent.children[index];
  if (child.kind !== 'group') return { root, newGroupId: groupId, newIndicators: [] };

  const newIndicators: Array<{ id: string; type: string; config: any }> = [];

  const cloneNodeDeep = (node: ConditionNode): ConditionNode => {
    if (node.kind === 'indicator') {
      const entry = createIndicatorEntry(node.indicator.type as any);
      entry.config = { ...(node.indicator.config as any) };
      const dup = createIndicatorLeaf(entry, node.comparison);
      newIndicators.push({ id: dup.id, type: entry.type, config: entry.config });
      return dup;
    }
    if (node.kind === 'candle') {
      return createCandleLeaf({ ...node.candle });
    }
    // group
    const dupChildren = node.children.map((c) => cloneNodeDeep(c));
    return createIndicatorGroup(node.operator, dupChildren);
  };

  const dupGroup = cloneNodeDeep(child) as ConditionGroupNode;
  const nextChildren = parent.children.slice();
  nextChildren.splice(index + 1, 0, dupGroup);
  const nextRoot = replaceGroupChildren(root, parent.id, nextChildren);
  return { root: nextRoot, newGroupId: dupGroup.id, newIndicators };
}
