import type { ApiEndpoint } from '@apishield/contracts';
import { securityRequiresAuth } from '../parser/versionRules.js';

export function countOperations(endpoints: ApiEndpoint[]): number {
  return endpoints.length;
}

export function listDiscoveryView(endpoints: ApiEndpoint[]) {
  return endpoints.map((endpoint) => ({
    id: endpoint.id,
    method: endpoint.method.toUpperCase(),
    path: endpoint.pathTemplate,
    operationId: endpoint.operationId ?? null,
    authenticationRequired: securityRequiresAuth(endpoint.effectiveSecurity),
    supportStatus: endpoint.supportStatus,
    warnings: endpoint.warnings,
  }));
}
