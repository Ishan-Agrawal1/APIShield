import { FindingModel, toFinding } from '../models/Finding.js';
import { ExecutionRecordModel, toExecutionResult } from '../models/ExecutionRecord.js';
import { getScan } from './scanService.js';
import { getSpecification } from './specificationService.js';
import { getTargetProfile } from '../config/targetProfiles.js';
import { isAiConfigured } from '../config/env.js';
import { AppError } from '../utils/errors.js';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export async function buildReport(scanId: string) {
  const scan = await getScan(scanId);
  const spec = await getSpecification(scan.specificationId).catch(() => null);
  const profile = getTargetProfile(scan.targetProfileId);
  const findings = (await FindingModel.find({ scanId }).sort({ severity: 1, createdAt: 1 })).map((item) => toFinding(item));
  const executions = (await ExecutionRecordModel.find({ scanId })).map((item) => toExecutionResult(item));
  const aiStatus = findings.some((item) => item.analysisMode === 'ai_assisted')
    ? 'ai_assisted'
    : isAiConfigured()
      ? 'configured_unused'
      : 'rule_based';

  return {
    scan,
    target: {
      profileId: scan.targetProfileId,
      label: profile?.label ?? scan.targetProfileId,
      origin: scan.configurationSnapshot.approvedOrigin,
    },
    specification: spec
      ? { id: spec.id, title: spec.title, openapiVersion: spec.openapiVersion, endpointCount: spec.normalizedEndpoints.length }
      : null,
    counters: {
      findings: findings.length,
      executions: executions.length,
      findingsBySeverity: scan.summary.findingsBySeverity,
    },
    findings,
    coverage: scan.coverage,
    transportErrors: executions.filter((item) => item.outcome === 'timeout' || item.outcome === 'transport_error'),
    aiStatus,
    disclaimer:
      findings.length === 0
        ? 'No findings in tested scope. This is not a certificate that the API is secure.'
        : 'Findings are scoped to the executed checks and fixtures.',
  };
}

export async function buildHtmlReport(scanId: string): Promise<string> {
  const report = await buildReport(scanId);
  const findingRows = report.findings
    .map(
      (finding) => `<tr>
        <td>${escapeHtml(finding.severity)}</td>
        <td>${escapeHtml(finding.confidence)}</td>
        <td>${escapeHtml(finding.ruleId)}</td>
        <td>${escapeHtml(finding.method)} ${escapeHtml(finding.endpoint)}</td>
        <td>${escapeHtml(finding.description)}</td>
        <td>${escapeHtml(finding.remediation)}</td>
        <td>${escapeHtml(finding.analysisMode)}</td>
      </tr>`,
    )
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>APIShield report ${escapeHtml(scanId)}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 2rem; color: #111; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; vertical-align: top; }
    .notice { background: #fff6d8; padding: 0.75rem 1rem; border: 1px solid #e0c35a; }
  </style>
</head>
<body>
  <h1>APIShield security report</h1>
  <p class="notice">${escapeHtml(report.disclaimer)}</p>
  <p>Target: ${escapeHtml(report.target.label)} (${escapeHtml(report.target.origin)})</p>
  <p>Scan ${escapeHtml(report.scan.id)} — ${escapeHtml(report.scan.status)} — started ${escapeHtml(report.scan.startedAt)}</p>
  <p>Findings: ${report.counters.findings} · Executions: ${report.counters.executions} · AI: ${escapeHtml(report.aiStatus)}</p>
  <h2>Findings</h2>
  <table>
    <thead><tr><th>Severity</th><th>Confidence</th><th>Rule</th><th>Endpoint</th><th>Description</th><th>Remediation</th><th>Analysis</th></tr></thead>
    <tbody>${findingRows || '<tr><td colspan="7">No findings in tested scope.</td></tr>'}</tbody>
  </table>
</body>
</html>`;
}

export function assertReportFormat(format: string): 'json' | 'html' {
  if (format !== 'json' && format !== 'html') {
    throw new AppError(400, 'INVALID_FORMAT', 'format must be json or html.');
  }
  return format;
}
