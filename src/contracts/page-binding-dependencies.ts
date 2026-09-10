/** Dependency analysis is shared by Page validation and the query runtime. */
export interface PageDependencyBinding {
  bindingId: string;
  parameters: Readonly<Record<string, { kind: string; bindingId?: string; stateId?: string }>>;
  stateEffects?: readonly { targetStateId: string }[];
  resultStateBindings?: readonly { targetStateId: string }[];
}
export const analyzePageBindingDependencies = (bindings: readonly PageDependencyBinding[]): {
  order: string[];
  dependencies: Record<string, string[]>;
  errors: { bindingId: string; code: 'DUPLICATE' | 'MISSING' | 'CYCLE' | 'STATE_OWNER'; dependencyId?: string }[];
} => {
  const errors: { bindingId: string; code: 'DUPLICATE' | 'MISSING' | 'CYCLE' | 'STATE_OWNER'; dependencyId?: string }[] = [];
  const ids = new Set<string>();
  const stateOwners = new Map<string, string>();
  for (const binding of bindings) {
    if (ids.has(binding.bindingId)) errors.push({ bindingId: binding.bindingId, code: 'DUPLICATE' });
    ids.add(binding.bindingId);
    for (const result of [...(binding.resultStateBindings ?? []), ...(binding.stateEffects ?? [])]) {
      if (stateOwners.has(result.targetStateId)) errors.push({ bindingId: binding.bindingId, code: 'STATE_OWNER', dependencyId: result.targetStateId });
      stateOwners.set(result.targetStateId, binding.bindingId);
    }
  }
  const dependencies: Record<string, string[]> = Object.create(null);
  const dependents = new Map<string, string[]>();
  const remaining = new Map<string, number>();
  for (const binding of bindings) {
    const sources = [...new Set(Object.values(binding.parameters).flatMap((source) => {
      const id = source.kind === 'binding-field' ? source.bindingId : source.kind === 'page-state' && source.stateId ? stateOwners.get(source.stateId) : undefined;
      return id ? [id] : [];
    }))];
    dependencies[binding.bindingId] = sources;
    remaining.set(binding.bindingId, sources.length);
    for (const dependencyId of sources) {
      if (!ids.has(dependencyId)) errors.push({ bindingId: binding.bindingId, code: 'MISSING', dependencyId });
      dependents.set(dependencyId, [...(dependents.get(dependencyId) ?? []), binding.bindingId]);
    }
  }
  const queue = [...ids].filter((id) => remaining.get(id) === 0);
  const order: string[] = [];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]!;
    order.push(id);
    for (const dependent of dependents.get(id) ?? []) {
      const count = remaining.get(dependent)! - 1;
      remaining.set(dependent, count);
      if (count === 0) queue.push(dependent);
    }
  }
  if (order.length !== ids.size && !errors.some((error) => error.code === 'MISSING')) {
    for (const id of ids) if ((remaining.get(id) ?? 0) > 0) errors.push({ bindingId: id, code: 'CYCLE' });
  }
  return { order, dependencies, errors };
};
