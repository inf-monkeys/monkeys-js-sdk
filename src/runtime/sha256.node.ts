import { createHash } from 'node:crypto';

/** Keep the UTF-8 digest identical to the portable runtime implementation. */
export const sha256Hex = (value: string): string =>
  createHash('sha256').update(value, 'utf8').digest('hex');
