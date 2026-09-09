import { IsoDateTimeSchema, JsonValueSchema, type JsonValue } from '../contracts/common';
import {
  WorkflowColumnBindingSchema,
  type WorkflowColumnBinding,
} from '../contracts/workflow-column';

export function parseWorkflowColumnBinding(value: unknown): WorkflowColumnBinding {
  const binding = WorkflowColumnBindingSchema.parse(value);
  if (Object.keys(binding.inputs).length > 100)
    throw new Error('Workflow column supports at most 100 input bindings.');
  if (binding.policy.maxDelayMs < binding.policy.debounceMs)
    throw new Error('Workflow column maxDelayMs must be at least debounceMs.');
  for (const name of Object.keys(binding.inputs)) {
    if (
      name !== name.trim() ||
      name.startsWith('__') ||
      name === 'constructor' ||
      name === 'prototype'
    ) {
      throw new Error(`Invalid Workflow input name: ${name}`);
    }
  }
  return binding;
}

function selectOwnValue(payload: unknown, path: string[]): unknown {
  let value = payload;
  for (const key of path) {
    if (
      value === null ||
      typeof value !== 'object' ||
      !Object.prototype.hasOwnProperty.call(value, key)
    ) {
      throw new Error(`Workflow output is missing the configured path: ${JSON.stringify(path)}`);
    }
    value = (value as Record<string, unknown>)[key];
  }
  if (value === undefined) throw new Error('Workflow output is absent.');
  return value;
}

export function resolveWorkflowColumnResult(
  binding: WorkflowColumnBinding,
  payload: unknown,
  nowMs = Date.now(),
): { value: JsonValue; expiresAt?: string } {
  const selected = selectOwnValue(payload, binding.output.path);
  if (selected === null && !binding.output.nullable)
    throw new Error('Workflow output is null but this column does not allow null results.');
  if (selected !== null) {
    if (
      binding.output.type === 'number' &&
      (typeof selected !== 'number' || !Number.isFinite(selected))
    )
      throw new Error('Workflow output must be a finite number.');
    if (binding.output.type === 'text' && typeof selected !== 'string')
      throw new Error('Workflow output must be text.');
  }
  const value = JsonValueSchema.parse(selected);
  if (!binding.expiry) return { value };
  const expiresAt = IsoDateTimeSchema.parse(selectOwnValue(payload, binding.expiry.path));
  if (!Number.isFinite(nowMs) || Date.parse(expiresAt) <= nowMs)
    throw new Error('Workflow expiry must be a future datetime.');
  return { value, expiresAt };
}
