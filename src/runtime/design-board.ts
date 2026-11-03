import { DesignBoardChangesSchema, DesignBoardDocumentSchema, type DesignBoardChanges, type DesignBoardDocument } from '../contracts/design-board';

const stable = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);

const changed = <T>(before: readonly T[], after: readonly T[], identity: (value: T) => string) => {
  const previous = new Map(before.map((value) => [identity(value), stable(value)]));
  return after.filter((value) => previous.get(identity(value)) !== stable(value));
};

export function diffDesignBoardDocuments(before: DesignBoardDocument, after: DesignBoardDocument): DesignBoardChanges {
  const pageElements = (document: DesignBoardDocument, id: string) => document.document.elements.filter((element) =>
    String((element as any).customData?.designBoard?.pageId || document.domain.pages[0]?.id) === id);
  const removed = <T>(left: T[], right: T[], identity: (item: T) => string) => {
    const kept = new Set(right.map(identity));
    return left.map(identity).filter((id) => !kept.has(id));
  };
  return DesignBoardChangesSchema.parse({
    ...(stable(before.document.appState) !== stable(after.document.appState) ? { appState: after.document.appState ?? {} } : {}),
    ...(stable(before.domain.pages) !== stable(after.domain.pages) ? { pages: after.domain.pages } : {}),
    scenes: after.domain.pages.filter((page) => stable(pageElements(before, page.id)) !== stable(pageElements(after, page.id)))
      .map((page) => ({ pageId: page.id, elements: pageElements(after, page.id) })),
    nodes: changed(before.domain.nodes, after.domain.nodes, (node) => node.id),
    removedNodeIds: removed(before.domain.nodes, after.domain.nodes, (node) => node.id),
    connections: changed(before.domain.connections, after.domain.connections, (edge) => edge.id),
    removedConnectionIds: removed(before.domain.connections, after.domain.connections, (edge) => edge.id),
    files: changed(before.domain.files, after.domain.files, (file) => file.canonicalUri),
    removedFileUris: removed(before.domain.files, after.domain.files, (file) => file.canonicalUri),
  });
}

export function applyDesignBoardChanges(document: DesignBoardDocument, changes: DesignBoardChanges): DesignBoardDocument {
  changes = DesignBoardChangesSchema.parse(changes);
  const identities = [changes.scenes.map((scene) => scene.pageId), changes.nodes.map((node) => node.id), changes.connections.map((edge) => edge.id), changes.files.map((file) => file.canonicalUri)];
  if (identities.some((ids) => new Set(ids).size !== ids.length)) throw new Error('DESIGN_BOARD_CHANGE_IDENTITIES_DUPLICATE');
  const apply = <T>(previous: T[], updates: T[], removed: string[], identity: (item: T) => string) => {
    const values = new Map(previous.map((item) => [identity(item), item]));
    removed.forEach((id) => values.delete(id));
    updates.forEach((item) => values.set(identity(item), item));
    return [...values.values()];
  };
  const pages = changes.pages || document.domain.pages;
  const pageIds = new Set(pages.map((page) => page.id));
  if (changes.scenes.some((scene) => !pageIds.has(scene.pageId))) throw new Error('DESIGN_BOARD_CHANGE_PAGE_MISSING');
  const scenes = new Map(changes.scenes.map((scene) => [scene.pageId, scene.elements]));
  const elements = pages.flatMap((page) => scenes.get(page.id) ?? document.document.elements.filter((element) =>
    String((element as any).customData?.designBoard?.pageId || document.domain.pages[0]?.id) === page.id));
  const result = { ...document, document: { ...document.document, elements, files: {}, ...(changes.appState === undefined ? {} : { appState: changes.appState }) }, domain: {
    ...document.domain, pages,
    nodes: apply(document.domain.nodes, changes.nodes, changes.removedNodeIds, (node) => node.id).filter((node) => pageIds.has(node.pageId)),
    connections: apply(document.domain.connections, changes.connections, changes.removedConnectionIds, (edge) => edge.id).filter((edge) => pageIds.has(edge.pageId)),
    files: apply(document.domain.files, changes.files, changes.removedFileUris, (file) => file.canonicalUri),
  } };
  return DesignBoardDocumentSchema.parse(result);
}
