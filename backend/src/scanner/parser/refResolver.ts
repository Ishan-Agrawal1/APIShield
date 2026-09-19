import { LIMITS } from '@apishield/contracts';
import { AppError } from '../../utils/errors.js';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export function resolveInternalRefs(document: Record<string, unknown>): {
  resolved: Record<string, unknown>;
  warnings: string[];
} {
  const warnings: string[] = [];
  const expansions = { count: 0 };
  const resolved = walk(document, document, new Set(), 0, expansions, warnings) as Record<string, unknown>;
  return { resolved, warnings };
}

function walk(
  node: unknown,
  root: Record<string, unknown>,
  stack: Set<string>,
  depth: number,
  expansions: { count: number },
  warnings: string[],
): unknown {
  if (depth > LIMITS.documentNestingDepth) {
    throw new AppError(400, 'REF_DEPTH', 'Document nesting or $ref traversal exceeded the supported bound.');
  }
  if (node === null || typeof node !== 'object') {
    return node;
  }
  if (Array.isArray(node)) {
    return node.map((item) => walk(item, root, stack, depth + 1, expansions, warnings));
  }

  const record = node as Record<string, unknown>;
  if (typeof record.$ref === 'string') {
    const ref = record.$ref;
    if (ref.startsWith('http://') || ref.startsWith('https://') || ref.startsWith('file:')) {
      throw new AppError(400, 'FORBIDDEN_REF', `External $ref is not allowed: ${ref}`);
    }
    if (!ref.startsWith('#/')) {
      throw new AppError(400, 'FORBIDDEN_REF', `Unsupported $ref target: ${ref}`);
    }
    if (stack.has(ref)) {
      warnings.push(`Recursive $ref skipped: ${ref}`);
      return { recursiveRef: ref };
    }
    expansions.count += 1;
    if (expansions.count > LIMITS.refResolutionExpansions) {
      throw new AppError(400, 'REF_LIMIT', 'Too many $ref expansions.');
    }
    const target = pointer(root, ref);
    stack.add(ref);
    const value = walk(target, root, stack, depth + 1, expansions, warnings);
    stack.delete(ref);
    const rest = { ...record };
    delete rest.$ref;
    if (typeof value === 'object' && value && !Array.isArray(value) && Object.keys(rest).length > 0) {
      return { ...(value as Record<string, unknown>), ...rest };
    }
    return value;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    output[key] = walk(value, root, stack, depth + 1, expansions, warnings);
  }
  return output;
}

function pointer(root: Record<string, unknown>, ref: string): unknown {
  const parts = ref
    .slice(2)
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'));
  let current: unknown = root;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || Array.isArray(current) || !(part in current)) {
      throw new AppError(400, 'UNRESOLVED_REF', `Unresolved internal $ref: ${ref}`);
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export type { Json };
