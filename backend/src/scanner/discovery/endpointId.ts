import { stableId } from '../../utils/ids.js';

export function endpointIdentity(sourceHash: string, method: string, pathTemplate: string): string {
  return stableId(sourceHash, method.toLowerCase(), pathTemplate);
}
