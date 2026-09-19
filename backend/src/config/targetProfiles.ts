import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TargetProfile } from '@apishield/contracts';
import { defaultExecutionLimits } from './limits.js';

const here = dirname(fileURLToPath(import.meta.url));

function loadJson<T>(relativeFromRepo: string): T {
  const candidates = [
    join(here, '..', '..', '..', relativeFromRepo),
    join(here, '..', '..', relativeFromRepo),
    join(process.cwd(), relativeFromRepo),
    join(process.cwd(), '..', relativeFromRepo),
  ];
  for (const candidate of candidates) {
    try {
      return JSON.parse(readFileSync(candidate, 'utf8')) as T;
    } catch {
      continue;
    }
  }
  throw new Error(`Unable to load fixture ${relativeFromRepo}`);
}

export function loadTargetProfiles(): TargetProfile[] {
  const raw = loadJson<TargetProfile[]>('vulnerable-api/fixtures/target-profiles.json');
  return raw.map((profile) => {
    const originOverride =
      profile.id === 'demo-vulnerable'
        ? process.env.DEMO_VULNERABLE_ORIGIN
        : profile.id === 'demo-fixed'
          ? process.env.DEMO_FIXED_ORIGIN
          : undefined;
    return {
      ...profile,
      approvedOrigin: originOverride || profile.approvedOrigin,
      executionLimits: { ...defaultExecutionLimits(), ...profile.executionLimits },
    };
  });
}

export function getTargetProfile(id: string): TargetProfile | undefined {
  return loadTargetProfiles().find((profile) => profile.id === id);
}

export function publicTargetProfiles() {
  return loadTargetProfiles().map((profile) => ({
    id: profile.id,
    label: profile.label,
    approvedOrigin: profile.approvedOrigin,
    approvedMethods: profile.approvedMethods,
    pathScopePrefixes: profile.pathScopePrefixes,
    credentialReferences: profile.credentialReferences,
    supportedAuthentication: profile.supportedAuthentication,
    optionalCheckSettings: profile.optionalCheckSettings,
    principals: profile.accessPolicy.principals.map((principal) => ({
      id: principal.id,
      label: principal.label,
      credentialReference: principal.credentialReference,
    })),
    objects: profile.accessPolicy.objects.map((object) => ({
      objectId: object.objectId,
      ownerPrincipalId: object.ownerPrincipalId,
      visibility: object.visibility,
    })),
  }));
}
