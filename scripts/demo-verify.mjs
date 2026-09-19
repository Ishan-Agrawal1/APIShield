import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { root, waitForHttp } from './lib.mjs';

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) {
    return;
  }
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) {
      continue;
    }
    const index = line.indexOf('=');
    const key = line.slice(0, index);
    const value = line.slice(index + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadDotEnv(join(root, 'backend', '.env'));

const operator = process.env.APISHIELD_OPERATOR_TOKEN;
if (!operator) {
  console.error('BLOCKED: APISHIELD_OPERATOR_TOKEN is required for demo:verify.');
  process.exit(1);
}

const backend = process.env.APISHIELD_BACKEND_URL || 'http://127.0.0.1:5000';
const headers = { authorization: `Bearer ${operator}`, 'content-type': 'application/json' };
const openapi = readFileSync(join(root, 'vulnerable-api', 'openapi.yaml'), 'utf8');
const seededMisconfig = ['DEBUG_INFORMATION', 'SERVER_VERSION_DISCLOSURE', 'CORS_UNTRUSTED_ORIGIN'];

function classify(items) {
  return items
    .map((item) => `${item.ruleId}|${item.severity}|${item.confidence}|${item.endpoint}|${item.method}`)
    .sort();
}

function rule(items, id) {
  return items.filter((item) => item.ruleId === id);
}

async function drive(targetProfileId) {
  await waitForHttp(`${backend}/ready`, 20_000);
  const specRes = await fetch(`${backend}/api/specifications`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content: openapi }),
  });
  if (!specRes.ok) {
    throw new Error(`specification upload failed: ${specRes.status} ${await specRes.text()}`);
  }
  const spec = await specRes.json();
  if (!Array.isArray(spec.normalizedEndpoints) || spec.normalizedEndpoints.length < 10) {
    throw new Error(`expected at least 10 operations, got ${spec.normalizedEndpoints?.length}`);
  }
  const previewRes = await fetch(`${backend}/api/scans/preview`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ specificationId: spec.id, targetProfileId }),
  });
  if (!previewRes.ok) {
    throw new Error(`preview failed: ${previewRes.status} ${await previewRes.text()}`);
  }
  const preview = await previewRes.json();
  const scanRes = await fetch(`${backend}/api/scans`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      specificationId: spec.id,
      targetProfileId,
      enabledScanners: ['bola', 'authentication', 'misconfiguration', 'resource'],
      resourceObservations: targetProfileId === 'demo-vulnerable',
    }),
  });
  if (scanRes.status !== 202) {
    throw new Error(`scan start failed: ${scanRes.status} ${await scanRes.text()}`);
  }
  const started = await scanRes.json();
  const deadline = Date.now() + 90_000;
  let scan = started;
  while (Date.now() < deadline && ['queued', 'running'].includes(scan.status)) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    scan = await (await fetch(`${backend}/api/scans/${started.id}`, { headers })).json();
  }
  if (!['completed', 'partial'].includes(scan.status)) {
    throw new Error(`scan did not finish in tested scope: ${scan.status}`);
  }
  const findings = await (await fetch(`${backend}/api/scans/${started.id}/findings?limit=100`, { headers })).json();
  const report = await (await fetch(`${backend}/api/scans/${started.id}/report?format=json`, { headers })).json();
  return { spec, preview, scan, findings: findings.items ?? [], report };
}

let first;
let second;
let fixed;
try {
  first = await drive('demo-vulnerable');
  second = await drive('demo-vulnerable');
  fixed = await drive('demo-fixed');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/fetch failed|ECONNREFUSED|NOT_READY|Timed out waiting/i.test(message)) {
    console.error(`BLOCKED: live demo gate could not reach the control API at ${backend}.`);
    console.error(message);
    process.exit(1);
  }
  throw error;
}

const firstClass = classify(first.findings);
const secondClass = classify(second.findings);
if (JSON.stringify(firstClass) !== JSON.stringify(secondClass)) {
  throw new Error(`repeatable demo findings diverged:\n${JSON.stringify({ first: firstClass, second: secondClass }, null, 2)}`);
}

const report = {
  date: new Date().toISOString(),
  vulnerable: {
    endpoints: first.spec.normalizedEndpoints.length,
    generated: first.preview.generated,
    eligible: first.preview.eligible,
    skipped: first.preview.skipped,
    scanStatus: first.scan.status,
    findings: first.findings.map((item) => item.ruleId).sort(),
    bola: rule(first.findings, 'BOLA_READ_CROSS_USER').length,
    auth: rule(first.findings, 'AUTH_BYPASS').length,
    misconfig: seededMisconfig.filter((id) => rule(first.findings, id).length > 0),
    reportFindings: first.report.counters?.findings,
  },
  repeat: {
    findings: second.findings.map((item) => item.ruleId).sort(),
  },
  fixed: {
    scanStatus: fixed.scan.status,
    findings: fixed.findings.map((item) => item.ruleId).sort(),
    bola: rule(fixed.findings, 'BOLA_READ_CROSS_USER').length,
    auth: rule(fixed.findings, 'AUTH_BYPASS').length,
    misconfig: seededMisconfig.filter((id) => rule(fixed.findings, id).length > 0),
  },
};

if (report.vulnerable.bola < 1 || report.vulnerable.auth < 1 || report.vulnerable.misconfig.length < 1) {
  throw new Error(`vulnerable demo did not produce seeded findings: ${JSON.stringify(report.vulnerable)}`);
}
if (report.vulnerable.reportFindings !== first.findings.length) {
  throw new Error(`report counters disagree with persisted findings: ${report.vulnerable.reportFindings} vs ${first.findings.length}`);
}
if (report.fixed.bola !== 0 || report.fixed.auth !== 0 || report.fixed.misconfig.length !== 0) {
  throw new Error(`fixed control produced seeded findings: ${JSON.stringify(report.fixed)}`);
}

const outDir = join(root, 'docs', 'reports');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `verification-${Date.now()}.md`);
writeFileSync(
  out,
  `# Verification report\n\nGenerated ${report.date}\n\nSeeded secrets are not included. Durations and timestamps are omitted from the comparison.\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n`,
);
console.log('Wrote', out);
console.log(JSON.stringify(report, null, 2));
