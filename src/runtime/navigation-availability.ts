import { NavigationRuntimeBundleSchema, type NavigationRuntimeBundle } from '../contracts/declarative-control';
import { canonicalContentHash, sameStableRef } from './declarative-control-compiler';

export const NAVIGATION_UNAVAILABLE_CAPABILITY_HEADER = 'x-monkeys-navigation-capabilities';
export const NAVIGATION_UNAVAILABLE_CAPABILITY = 'unavailable-pages-v1';

/** Old strict readers receive only representable nodes, never a fabricated route. */
export function projectNavigationCompatibility(bundle: NavigationRuntimeBundle, supportsUnavailable: boolean): NavigationRuntimeBundle {
  if (supportsUnavailable || !bundle.nodes.some((node) => node.kind === 'target' && node.resolvedTarget.kind === 'unavailable')) return bundle;
  const { contentHash: _hash, ...unsigned } = bundle;
  const nodes = bundle.nodes.filter((node) => node.kind !== 'target' || node.resolvedTarget.kind !== 'unavailable');
  return NavigationRuntimeBundleSchema.parse({ ...unsigned, nodes, contentHash: canonicalContentHash({ ...unsigned, nodes }) });
}

/** Project Page links against a complete, tenant-authorized current target catalog. */
export function projectCurrentNavigationPages(
  source: NavigationRuntimeBundle,
  navigation: import('../contracts/declarative-control').Navigation,
  targets: readonly import('./declarative-control-compiler').NavigationTargetRegistration[],
): NavigationRuntimeBundle {
  const currentTargets = new Map(targets.map(target => [canonicalContentHash(target.stableTargetRef), target]));
  if (currentTargets.size !== targets.length) throw new TypeError('DECLARATIVE_TARGET_CATALOG_INVALID');
  const authored = new Map(navigation.nodes.map(node => [node.nodeId, node]));
  const nodes = source.nodes.map(node => {
    if (node.kind !== 'target' || node.targetRef.kind !== 'page') return node;
    const original = authored.get(node.nodeId);
    if (original?.kind !== 'target' || canonicalContentHash(original.targetRef) !== canonicalContentHash(node.targetRef)) {
      throw new TypeError('DECLARATIVE_TARGET_IDENTITY_MISMATCH');
    }
    const current = currentTargets.get(canonicalContentHash(node.targetRef));
    if (current && (!sameStableRef(current.stableTargetRef, current.targetRevisionRef) || current.kind !== 'route' || current.surface !== source.surface || current.routeClaim.surface !== source.surface)) {
      throw new TypeError('DECLARATIVE_TARGET_CATALOG_INVALID');
    }
    if (!current || current.kind !== 'route' || !current.routeClaim.matcher.parameters.filter(parameter => current.routeClaim.normalizedPath.split('/').includes(`:${parameter.name}`)).every(parameter => {
      if (!parameter.required) return true;
      const binding = original.parameterMapping[parameter.name];
      return binding?.kind === 'constant' && (typeof binding.value === 'string' || typeof binding.value === 'number') && String(binding.value).length > 0;
    })) {
      return { ...node, disabled: true, parameterMapping: {}, resolvedTarget: {
        kind: 'unavailable' as const, nodeId: node.nodeId, stableTargetRef: node.targetRef, accessPolicy: null,
      } };
    }
    return { ...node, disabled: original.disabled, parameterMapping: original.parameterMapping, resolvedTarget: {
      kind: 'route' as const, nodeId: node.nodeId, stableTargetRef: current.stableTargetRef,
      targetRevisionRef: current.targetRevisionRef,
      ...(current.releaseRevisionRef ? { releaseRevisionRef: current.releaseRevisionRef } : {}),
      accessPolicy: current.accessPolicy, routeClaim: current.routeClaim,
    } };
  });
  const { contentHash: _hash, ...unsigned } = source;
  return NavigationRuntimeBundleSchema.parse({ ...unsigned, nodes, contentHash: canonicalContentHash({ ...unsigned, nodes }) });
}
