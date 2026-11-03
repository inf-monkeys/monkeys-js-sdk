const assert = require('node:assert/strict');
const test = require('node:test');
const { DesignBoardDocumentSchema, DesignBoardCommitCommandSchema } = require('../lib/contracts');
const { diffDesignBoardDocuments, applyDesignBoardChanges } = require('../lib/runtime');

const board = () => ({ engine: 'excalidraw', schemaVersion: 1, document: { elements: [], files: {} }, domain: {
  schemaVersion: 1, boardId: 'board', projectId: 'project',
  pages: [{ id: 'p1', name: 'Page 1', order: 0 }, { id: 'p2', name: 'Page 2', order: 1 }],
  nodes: [], connections: [], files: [],
} });
test('board changes carry only edited pages and preserve the other page', () => {
  const before = board();
  before.document.elements = ['p1', 'p2'].map((pageId) => ({ id: pageId, type: 'rectangle', x: 0, y: 0, width: 100, height: 100, customData: { designBoard: { pageId } } }));
  const after = structuredClone(before);
  after.document.elements[0].x = 45;
  const changes = diffDesignBoardDocuments(before, after);
  assert.deepEqual(changes.scenes.map((scene) => scene.pageId), ['p1']);
  assert.deepEqual(applyDesignBoardChanges(before, changes), DesignBoardDocumentSchema.parse(after));
  assert.equal(DesignBoardCommitCommandSchema.safeParse({ contract: 'DesignBoardCommitCommand', schemaVersion: 1, boardId: 'board', expectedRevision: 1, requestId: 'request', changes }).success, true);
});
test('board contracts reject duplicate identities, missing endpoints and inline bytes', () => {
  const duplicate = board(); duplicate.domain.pages.push(duplicate.domain.pages[0]);
  assert.equal(DesignBoardDocumentSchema.safeParse(duplicate).success, false);
  const invalid = board(); invalid.domain.connections.push({ id: 'edge', pageId: 'p1', from: 'missing', to: 'other', kind: 'workflow', props: {} });
  assert.equal(DesignBoardDocumentSchema.safeParse(invalid).success, false);
  const inline = board(); inline.document.files = { image: { dataURL: 'data:image/png;base64,x' } };
  assert.equal(DesignBoardDocumentSchema.safeParse(inline).success, false);
  inline.document.files = {}; inline.domain.files = [{ canonicalUri: 'https://signed.example/file', mimeType: 'image/png', role: 'source' }];
  assert.equal(DesignBoardDocumentSchema.safeParse(inline).success, false);
});
test('board commands reject unknown scene pages and duplicate writes', () => {
  const before = board();
  const changes = diffDesignBoardDocuments(before, before);
  changes.scenes = [{ pageId: 'missing', elements: [] }];
  assert.throws(() => applyDesignBoardChanges(before, changes), /PAGE_MISSING/);
  changes.scenes = [{ pageId: 'p1', elements: [] }, { pageId: 'p1', elements: [] }];
  assert.throws(() => applyDesignBoardChanges(before, changes), /DUPLICATE/);
});
test('board changes preserve and update canvas preferences independently of scene edits', () => {
  const before = board(); before.document.appState = { viewBackgroundColor: '#ffffff', monkeysCanvasBackground: 'dots' };
  assert.deepEqual(applyDesignBoardChanges(before, diffDesignBoardDocuments(before, before)), before);
  const after = structuredClone(before); after.document.appState.monkeysCanvasBackground = 'plain';
  assert.deepEqual(applyDesignBoardChanges(before, diffDesignBoardDocuments(before, after)), after);
  delete after.document.appState;
  assert.deepEqual(applyDesignBoardChanges(before, diffDesignBoardDocuments(before, after)).document.appState, {});
});
