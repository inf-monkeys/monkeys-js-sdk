import { ManagedFileUriSchema, type FileResourceManifest } from '../contracts/file';

export function parseManagedFileReference(value: unknown): { fileId: string; variant?: string } | undefined {
  const parsed = ManagedFileUriSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const [fileId, variant] = parsed.data.slice('file://'.length).split('#');
  return { fileId, ...(variant ? { variant } : {}) };
}

/** Extracts durable references from persisted content, not temporary access URLs. */
export function collectManagedFileReferences(value: unknown): string[] {
  const found = new Set<string>();
  const seen = new WeakSet<object>();
  const visit = (item: unknown, depth: number) => {
    if (depth > 64) throw new Error('File reference nesting exceeds the limit');
    if (typeof item === 'string') {
      for (const match of item.matchAll(/file:\/\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}(?:#[A-Za-z0-9_-]+)?(?=$|[\s"'`)\]}> ,])/g)) {
        if (parseManagedFileReference(match[0])) found.add(match[0]);
      }
    } else if (item && typeof item === 'object' && !seen.has(item)) {
      seen.add(item);
      for (const child of Object.values(item)) visit(child, depth + 1);
    }
  };
  visit(value, 0);
  return [...found].sort();
}

/** Resolve only declared resources. No storage paths are inferred from a file ID. */
export function resolveFileResourceReference(reference: string, manifest?: FileResourceManifest, documentPath = manifest?.entryPath): string | undefined {
  if (parseManagedFileReference(reference)) return reference;
  if (!manifest || /^[a-z][a-z0-9+.-]*:|^[\/\\]/i.test(reference)) return undefined;
  let path: string;
  try { path = decodeURIComponent(reference.split(/[?#]/, 1)[0]); } catch { return undefined; }
  if (/^[\/\\]|[\\\u0000-\u001f]/.test(path)) return undefined;
  const parts = (documentPath?.split('/').slice(0, -1) || []);
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { if (!parts.length) return undefined; parts.pop(); }
    else parts.push(part);
  }
  return manifest.resources.find((resource) => resource.path === parts.join('/'))?.uri;
}
