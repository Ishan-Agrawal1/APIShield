import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import request from 'supertest';
import { OPERATOR, clearCollections, registerBackendSuite, startTargetApi, stopTargetApi } from '../helpers.js';
import app from '../../src/app.js';

registerBackendSuite();

async function login(origin: string, email: string): Promise<string> {
  const response = await fetch(`${origin}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' }),
  });
  const body = (await response.json()) as { token?: string };
  if (!body.token) {
    throw new Error(`login failed for ${email}`);
  }
  return body.token;
}

async function runRouteScan(payload: Record<string, unknown>) {
  const started = await request(app)
    .post('/api/scans/route')
    .set('Host', '127.0.0.1')
    .set('Authorization', `Bearer ${OPERATOR}`)
    .send(payload);
  assert.equal(started.status, 202, JSON.stringify(started.body));
  const deadline = Date.now() + 60_000;
  let current = started.body;
  while (Date.now() < deadline && ['queued', 'running'].includes(current.status)) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const polled = await request(app)
      .get(`/api/scans/${started.body.id}`)
      .set('Host', '127.0.0.1')
      .set('Authorization', `Bearer ${OPERATOR}`);
    current = polled.body;
  }
  const findings = await request(app)
    .get(`/api/scans/${started.body.id}/findings?limit=100`)
    .set('Host', '127.0.0.1')
    .set('Authorization', `Bearer ${OPERATOR}`);
  return { scan: current, findings: findings.body.items as Array<{ ruleId: string; confidence: string; severity: string }> };
}

describe('ad-hoc route scan', () => {
  it('previews controlled cases without executing them', async () => {
    const preview = await request(app)
      .post('/api/scans/route/preview')
      .set('Host', '127.0.0.1')
      .set('Authorization', `Bearer ${OPERATOR}`)
      .send({ url: 'http://127.0.0.1:5001/api/notes/{id}', method: 'GET', pathParams: { id: '1' }, authorization: 'placeholder' });
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.ok(preview.body.generated >= 10);
    assert.equal(preview.body.objectIdParameter.name, 'id');
    // The runtime token must never appear in a redacted preview.
    assert.equal(JSON.stringify(preview.body).includes('placeholder'), false);
  });

  it('detects cross-object access on the vulnerable notes route from a pasted route', async () => {
    const origin = await startTargetApi(15081);
    await clearCollections();
    const token = await login(origin, 'user1@test.com');
    const { scan, findings } = await runRouteScan({
      url: `${origin}/api/notes/{id}`,
      method: 'GET',
      pathParams: { id: '1' },
      authorization: token,
    });
    assert.ok(['completed', 'partial'].includes(scan.status), scan.status);
    const bola = findings.find((item) => item.ruleId === 'BOLA_READ_CROSS_OBJECT');
    assert.ok(bola, `expected a BOLA finding, got ${JSON.stringify(findings.map((f) => f.ruleId))}`);
    assert.equal(bola.confidence, 'confirmed');
    assert.equal(bola.severity, 'high');
  });

  it('flags the unauthenticated profile route and keeps the token out of persisted evidence', async () => {
    const origin = await startTargetApi(15082);
    await clearCollections();
    const token = await login(origin, 'user1@test.com');
    const { scan, findings } = await runRouteScan({
      url: `${origin}/api/profile`,
      method: 'GET',
      authorization: token,
    });
    assert.ok(['completed', 'partial'].includes(scan.status), scan.status);
    assert.ok(findings.some((item) => item.ruleId === 'AUTH_WEAK_ENFORCEMENT'));

    const report = await request(app)
      .get(`/api/scans/${scan.id}/report?format=json`)
      .set('Host', '127.0.0.1')
      .set('Authorization', `Bearer ${OPERATOR}`);
    assert.equal(JSON.stringify(report.body).includes(token), false);
  });

  after(async () => {
    await stopTargetApi();
  });
});
