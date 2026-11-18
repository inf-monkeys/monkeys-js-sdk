import type { RevisionRef, StableRef } from '../contracts/declarative-control';
import { ReferenceInputSchema } from '../contracts/declarative-control';

/**
 * Expands an authored reference (`{ id }` or `{ id, revision }`) into the full
 * RevisionRef the compiler consumes.
 *
 * Returning `undefined` means the Server could not resolve the identity; the
 * caller turns that into a blocking diagnostic instead of inventing a revision.
 */
export type ReferenceResolver = (input: {
  id: string;
  kind?: string;
  revision?: number;
}) => RevisionRef | StableRef | undefined;

export type NormalizeReferenceCounts = { expanded: number; unresolved: string[] };

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * Walks a declaration and replaces every authored reference with its resolved
 * RevisionRef.
 *
 * A value is treated as an authored reference only when it matches the input
 * shape exactly (no `ownerRepo`), so an already-expanded RevisionRef, a tenant
 * scope, or an arbitrary `{ id }` payload inside page body properties is left
 * untouched.
 */
export function normalizeDeclarativeReferences<T>(document: T, resolve: ReferenceResolver): { document: T; counts: NormalizeReferenceCounts } {
  const counts: NormalizeReferenceCounts = { expanded: 0, unresolved: [] };
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (!isObject(value)) return value;
    if ('ownerRepo' in value) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, visit(entry)]));
    const parsed = ReferenceInputSchema.safeParse(value);
    if (parsed.success && !('ownerRepo' in value)) {
      const resolved = resolve(parsed.data as { id: string; kind?: string; revision?: number });
      if (!resolved) {
        counts.unresolved.push(parsed.data.id);
        return value;
      }
      counts.expanded += 1;
      return structuredClone(resolved);
    }
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, visit(entry)]));
  };
  return { document: visit(document) as T, counts };
}
