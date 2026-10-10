import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeRoute } from '../../src/scanner/adhoc/routeAnalyzer.js';
import { generateAdhocProbes } from '../../src/scanner/adhoc/adhocGenerator.js';
import { AppError } from '../../src/utils/errors.js';

describe('route analyzer', () => {
  it('normalizes a templated loopback route and detects the object id parameter', () => {
    const route = analyzeRoute({
      url: 'http://127.0.0.1:5001/api/notes/{id}',
      method: 'get',
      pathParams: { id: '1' },
      authorization: 'test-token',
    });
    assert.equal(route.origin, 'http://127.0.0.1:5001');
    assert.equal(route.method, 'GET');
    assert.equal(route.endpoint.pathTemplate, '/api/notes/{id}');
    assert.deepEqual(route.pathValues, { id: '1' });
    assert.deepEqual(route.objectIdParameter, { name: 'id', value: '1' });
    assert.equal(route.authorizationHeader, 'Bearer test-token');
    assert.equal(route.endpoint.effectiveSecurity.length, 1);
  });

  it('infers a template from a concrete path with a trailing numeric segment', () => {
    const route = analyzeRoute({ url: 'http://localhost:5001/api/notes/2', method: 'GET' });
    assert.equal(route.endpoint.pathTemplate, '/api/notes/{id}');
    assert.deepEqual(route.pathValues, { id: '2' });
    assert.equal(route.authorizationHeader, null);
  });

  it('merges query parameters from the URL and the explicit field', () => {
    const route = analyzeRoute({
      url: 'http://127.0.0.1:5001/api/notes?limit=10',
      method: 'GET',
      queryParams: { sort: 'asc' },
    });
    assert.equal(route.query.limit, '10');
    assert.equal(route.query.sort, 'asc');
  });

  it('keeps an explicit Authorization scheme and drops header-based credentials', () => {
    const route = analyzeRoute({
      url: 'http://127.0.0.1:5001/api/notes/1',
      method: 'GET',
      headers: { Authorization: 'Bearer leaked', 'X-Trace': 'abc' },
      authorization: 'ApiKey xyz',
    });
    assert.equal(route.authorizationHeader, 'ApiKey xyz');
    assert.equal(route.headers.authorization, undefined);
    assert.equal(route.headers['x-trace'], 'abc');
  });

  it('rejects non-loopback origins that no profile approves', () => {
    assert.throws(
      () => analyzeRoute({ url: 'http://example.com/api/users/1', method: 'GET' }),
      (error: unknown) => error instanceof AppError && error.code === 'ORIGIN_NOT_AUTHORIZED',
    );
  });

  it('rejects unsupported methods and embedded credentials', () => {
    assert.throws(
      () => analyzeRoute({ url: 'http://127.0.0.1:5001/api/notes/1', method: 'CONNECT' }),
      (error: unknown) => error instanceof AppError && error.code === 'INVALID_METHOD',
    );
    assert.throws(
      () => analyzeRoute({ url: 'http://user:pass@127.0.0.1:5001/api/notes/1', method: 'GET' }),
      (error: unknown) => error instanceof AppError && error.code === 'EMBEDDED_CREDENTIALS',
    );
  });
});

describe('ad-hoc generator', () => {
  const route = analyzeRoute({
    url: 'http://127.0.0.1:5001/api/notes/{id}',
    method: 'GET',
    pathParams: { id: '1' },
    authorization: 'token',
  });

  it('is deterministic across runs', () => {
    const first = generateAdhocProbes(route, 'endpoint-1').map((probe) => probe.testCase.id);
    const second = generateAdhocProbes(route, 'endpoint-1').map((probe) => probe.testCase.id);
    assert.deepEqual(first, second);
  });

  it('generates a baseline, neighbour, boundary, auth, and misconfiguration probes', () => {
    const probes = generateAdhocProbes(route, 'endpoint-1');
    const roles = new Set(probes.map((probe) => probe.role));
    assert.ok(roles.has('baseline'));
    assert.ok(roles.has('bola_neighbor'));
    assert.ok(roles.has('bola_boundary'));
    assert.ok(roles.has('auth_none'));
    assert.ok(roles.has('cors'));
    assert.ok(roles.has('options'));
    assert.ok(probes.length >= 10 && probes.length <= 20, `expected 10-20 probes, got ${probes.length}`);
  });

  it('omits authentication probes when no credential is supplied', () => {
    const anon = analyzeRoute({ url: 'http://127.0.0.1:5001/api/notes/1', method: 'GET' });
    const roles = new Set(generateAdhocProbes(anon, 'e').map((probe) => probe.role));
    assert.equal(roles.has('auth_none'), false);
    assert.ok(roles.has('baseline'));
  });

  it('does not execute object-level mutation probes for unsafe methods', () => {
    const mutating = analyzeRoute({
      url: 'http://127.0.0.1:5001/api/notes/{id}',
      method: 'DELETE',
      pathParams: { id: '1' },
      authorization: 'token',
    });
    const probes = generateAdhocProbes(mutating, 'e');
    const neighbours = probes.filter((probe) => probe.role === 'bola_neighbor');
    assert.ok(neighbours.every((probe) => !probe.testCase.executionEligibility.eligible));
  });
});
