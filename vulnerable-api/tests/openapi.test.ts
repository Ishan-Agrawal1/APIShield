import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { parse } from 'yaml';

const openApiPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'openapi.yaml');

describe('OpenAPI specification', () => {
  it('is valid YAML and documents the intended inventory', () => {
    const raw = readFileSync(openApiPath, 'utf8');
    const spec = parse(raw) as {
      openapi: string;
      info: { title: string };
      servers: Array<{ url: string }>;
      paths: Record<string, Record<string, unknown>>;
      components: { securitySchemes: Record<string, unknown> };
    };

    assert.match(spec.openapi, /^3\./);
    assert.ok(spec.info.title);
    assert.ok(spec.servers[0]?.url);

    const requiredPaths = [
      '/auth/register',
      '/auth/login',
      '/auth/me',
      '/api/users',
      '/api/users/{id}',
      '/api/notes',
      '/api/notes/{id}',
    ];

    for (const path of requiredPaths) {
      assert.ok(spec.paths[path], `missing OpenAPI path ${path}`);
    }

    assert.ok(spec.paths['/auth/register']?.post);
    assert.ok(spec.paths['/auth/login']?.post);
    assert.ok(spec.paths['/auth/me']?.get);
    assert.ok(spec.paths['/api/users']?.get);
    assert.ok(spec.paths['/api/users/{id}']?.get);
    assert.ok(spec.paths['/api/notes']?.get);
    assert.ok(spec.paths['/api/notes']?.post);
    assert.ok(spec.paths['/api/notes/{id}']?.get);
    assert.ok(spec.paths['/api/notes/{id}']?.patch);
    assert.ok(spec.paths['/api/notes/{id}']?.delete);
    assert.ok(spec.paths['/api/notes']?.get && 'parameters' in (spec.paths['/api/notes'].get as object));
    assert.ok(spec.components.securitySchemes.bearerAuth);

    assert.equal(spec.paths['/api/v1/notes'], undefined);
    assert.equal(spec.paths['/api/v2/notes'], undefined);
    assert.equal(spec.paths['/api/debug'], undefined);
    assert.equal(spec.paths['/api/profile'], undefined);
  });
});
