import { buildError as registryBuildError } from '../registry/rw';

/**
 * Legacy adapter - delegates to registry
 * Mantiene compatibilità API per test esistenti
 */
export function buildError(code: string, message: string, correlationId?: string) {
  const { body } = registryBuildError(code, { message, correlationId });
  return body;
}