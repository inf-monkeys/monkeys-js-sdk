import { NavigationRuntimeBundleSchema, type NavigationRuntimeBundle } from '../contracts/declarative-control';
import { canonicalContentHash } from './declarative-control-compiler';

export const NAVIGATION_UNAVAILABLE_CAPABILITY_HEADER = 'x-monkeys-navigation-capabilities';
export const NAVIGATION_UNAVAILABLE_CAPABILITY = 'unavailable-pages-v1';

/** Old strict readers receive only representable nodes, never a fabricated route. */
export function projectNavigationCompatibility(bundle: NavigationRuntimeBundle, supportsUnavailable: boolean): NavigationRuntimeBundle {
  if (supportsUnavailable || !bundle.nodes.some((node) => node.kind === 'target' && node.resolvedTarget.kind === 'unavailable')) return bundle;
  const { contentHash: _hash, ...unsigned } = bundle;
  const nodes = bundle.nodes.filter((node) => node.kind !== 'target' || node.resolvedTarget.kind !== 'unavailable');
  return NavigationRuntimeBundleSchema.parse({ ...unsigned, nodes, contentHash: canonicalContentHash({ ...unsigned, nodes }) });
}
