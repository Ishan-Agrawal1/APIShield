import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, describe, it } from 'node:test';
import request from 'supertest';
import { OPERATOR, clearCollections, registerBackendSuite, startFixedApi, startTargetApi, stopTargetApi } from '../helpers.js';
import app from '../../src/app.js';
import { FindingModel } from '../../src/models/Finding.js';

registerBackendSuite();

async function uploadAndScan(targetProfileId: string) {
  const raw = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'vulnerable-api', 'openapi.yaml'), 'utf8');
  const spec = await request(app)
    .post('/api/specifications')
    .set('Host', '127.0.0.1')
    .set('Authorization', `Bearer ${OPERATOR}`)
    .send({ content: raw });
  assert.equal(spec.status, 201, JSON.stringify(spec.body));
  const scan = await request(app)
    .post('/api/scans')
    .set('Host', '127.0.0.1')
    .set('Authorization', `Bearer ${OPERATOR}`)
    .send({
      specificationId: spec.body.id,
      targetProfileId,
      enabledScanners: ['bola', 'authentication', 'misconfiguration'],
      resourceObservations: false,
    });
  assert.equal(scan.status, 202, JSON.stringify(scan.body));
  const deadline = Date.now() + 60_000;
  let current = scan.body;
  while (Date.now() < deadline && ['queued', 'running'].includes(current.status)) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const polled = await request(app)
      .get(`/api/scans/${scan.body.id}`)
      .set('Host', '127.0.0.1')
      .set('Authorization', `Bearer ${OPERATOR}`);
    current = polled.body;
  }
  const findings = await request(app)
    .get(`/api/scans/${scan.body.id}/findings`)
    .set('Host', '127.0.0.1')
    .set('Authorization', `Bearer ${OPERATOR}`);
  return { scan: current, findings: findings.body.items as Array<{ ruleId: string; confidence: string }> };
}

describe('connected scanners', () => {
  it('detects seeded BOLA, auth, and misconfiguration on the vulnerable target', async () => {
    await startTargetApi(15071);
    await clearCollections();
    const result = await uploadAndScan('demo-vulnerable');
    assert.ok(['completed', 'partial'].includes(result.scan.status), result.scan.status);
    assert.ok(result.findings.some((item) => item.ruleId === 'BOLA_READ_CROSS_USER' && item.confidence === 'confirmed'));
    assert.ok(result.findings.some((item) => item.ruleId === 'AUTH_BYPASS'));
    assert.ok(result.findings.some((item) => item.ruleId === 'DEBUG_INFORMATION' || item.ruleId === 'SERVER_VERSION_DISCLOSURE' || item.ruleId === 'CORS_UNTRUSTED_ORIGIN'));
    const persisted = await FindingModel.countDocuments();
    assert.equal(persisted, result.findings.length);
  });

  it('does not emit the seeded BOLA or auth findings against the fixed target', async () => {
    await stopTargetApi();
    await startFixedApi(15072);
    await clearCollections();
    const result = await uploadAndScan('demo-fixed');
    assert.ok(['completed', 'partial'].includes(result.scan.status), result.scan.status);
    assert.equal(result.findings.some((item) => item.ruleId === 'BOLA_READ_CROSS_USER' && item.confidence === 'confirmed'), false);
    assert.equal(result.findings.some((item) => item.ruleId === 'AUTH_BYPASS' && item.confidence === 'confirmed'), false);
  });

  after(async () => {
    await stopTargetApi();
  });
});
