import { LIMITS, type ApiEndpoint, type ApiSpecification, type TargetProfile, type TestCase } from '@apishield/contracts';
import { stableId } from '../../utils/ids.js';
import { objectFromSchema, schemaValue } from './valueFactory.js';
import { applyParameter } from './serialization.js';
import { securityRequiresAuth } from '../parser/versionRules.js';

const READ_METHODS = new Set(['get', 'head', 'options']);

export function generateTestCases(spec: ApiSpecification, profile: TargetProfile): TestCase[] {
  const cases: TestCase[] = [];
  for (const endpoint of spec.normalizedEndpoints) {
    if (cases.length >= LIMITS.generatedCasesPerScan) {
      break;
    }
    const generated = generateForEndpoint(endpoint, profile);
    cases.push(...generated.slice(0, LIMITS.generatedCasesPerEndpoint));
  }
  return cases.sort((a, b) => a.id.localeCompare(b.id));
}

function generateForEndpoint(endpoint: ApiEndpoint, profile: TargetProfile): TestCase[] {
  const cases: TestCase[] = [];
  const method = endpoint.method.toLowerCase();
  const safetyClass = READ_METHODS.has(method)
    ? 'read_only'
    : method === 'delete'
      ? 'destructive'
      : 'mutating';
  const eligible = profile.approvedMethods.map((item) => item.toLowerCase()).includes(method);
  const authContext = securityRequiresAuth(endpoint.effectiveSecurity) ? 'demo.userA' : null;

  const valid = baseTemplate(endpoint);
  fillValid(endpoint, valid, profile);
  cases.push(
    makeCase(endpoint, 'valid', authContext, valid, safetyClass, eligible, 'Valid request using schema-derived or example values.'),
  );

  const pathParam = endpoint.parameters.find((parameter) => parameter.location === 'path');
  if (pathParam) {
    const invalid = baseTemplate(endpoint);
    fillValid(endpoint, invalid, profile);
    invalid.pathValues[pathParam.name] = String(schemaValue(pathParam.schema, 'invalid'));
    cases.push(
      makeCase(
        endpoint,
        'invalid',
        authContext,
        invalid,
        safetyClass,
        eligible,
        `Invalid ${pathParam.location} parameter ${pathParam.name}.`,
        { target: pathParam.name, kind: 'invalid_type', description: 'Mutate one parameter type.' },
      ),
    );

    const missing = baseTemplate(endpoint);
    fillValid(endpoint, missing, profile);
    missing.omitPathParameter = pathParam.name;
    delete missing.pathValues[pathParam.name];
    cases.push(
      makeCase(
        endpoint,
        'missing',
        authContext,
        missing,
        'unsupported',
        false,
        'Missing path parameter represented as a malformed-path mutation; not executed by default.',
        { target: pathParam.name, kind: 'missing', description: 'Omit a required path parameter.' },
        'Malformed path mutations are not executed unless explicitly permitted.',
      ),
    );

    const boundary = baseTemplate(endpoint);
    fillValid(endpoint, boundary, profile);
    boundary.pathValues[pathParam.name] = String(schemaValue(pathParam.schema, 'boundary'));
    cases.push(
      makeCase(
        endpoint,
        'boundary',
        authContext,
        boundary,
        safetyClass,
        eligible,
        `Boundary value for ${pathParam.name}.`,
        { target: pathParam.name, kind: 'boundary', description: 'Use a schema boundary value.' },
      ),
    );
  }

  if (endpoint.requestBody?.schema) {
    const schema = endpoint.requestBody.schema;
    const required = Array.isArray(schema.required) ? schema.required.map(String) : [];
    const missingRequired = baseTemplate(endpoint);
    fillValid(endpoint, missingRequired, profile);
    if (required[0] && missingRequired.body && typeof missingRequired.body === 'object') {
      const copy = { ...(missingRequired.body as Record<string, unknown>) };
      delete copy[required[0]];
      missingRequired.body = copy;
      cases.push(
        makeCase(
          endpoint,
          'missing',
          authContext,
          missingRequired,
          safetyClass,
          eligible,
          `Missing required field ${required[0]}.`,
          { target: required[0], kind: 'missing_required', description: 'Drop one required field.' },
        ),
      );
    }

    const empty = baseTemplate(endpoint);
    fillValid(endpoint, empty, profile);
    empty.body = {};
    cases.push(
      makeCase(
        endpoint,
        'empty_body',
        authContext,
        empty,
        safetyClass,
        eligible,
        'Empty JSON object body.',
        { target: 'body', kind: 'empty', description: 'Send an empty object.' },
      ),
    );

    const wrongType = baseTemplate(endpoint);
    fillValid(endpoint, wrongType, profile);
    wrongType.body = 'not-an-object';
    cases.push(
      makeCase(
        endpoint,
        'wrong_type',
        authContext,
        wrongType,
        safetyClass,
        eligible,
        'Request body has the wrong JSON type.',
        { target: 'body', kind: 'wrong_type', description: 'Replace the object body with a string.' },
      ),
    );

    const additionalAllowed = schema.additionalProperties !== false;
    if (!additionalAllowed) {
      const extra = baseTemplate(endpoint);
      fillValid(endpoint, extra, profile);
      extra.body = { ...(extra.body as Record<string, unknown>), unexpectedField: true };
      cases.push(
        makeCase(
          endpoint,
          'extra_field',
          authContext,
          extra,
          safetyClass,
          eligible,
          'Extra field where additionalProperties is false.',
          { target: 'body', kind: 'extra_field', description: 'Add one extra field.' },
        ),
      );
    }
  }

  const bola = profile.bolaCases.find(
    (item) =>
      item.pathTemplate === endpoint.pathTemplate && item.method.toLowerCase() === endpoint.method.toLowerCase(),
  );
  if (bola) {
    const own = profile.accessPolicy.objects.find((object) => object.objectId === bola.ownObjectId);
    if (!own) {
      cases.push(
        makeCase(
          endpoint,
          'other_user',
          bola.ownPrincipalId,
          baseTemplate(endpoint),
          safetyClass,
          false,
          'Ownership fixture is missing; other-user case skipped.',
          { target: bola.objectParameterName, kind: 'other_user', description: 'Cross-user object access.' },
          'Missing ownership fixture.',
        ),
      );
    } else {
      const cross = baseTemplate(endpoint);
      fillValid(endpoint, cross, profile);
      cross.pathValues[bola.objectParameterName] = bola.foreignObjectId;
      cases.push(
        makeCase(
          endpoint,
          'other_user',
          bola.ownPrincipalId,
          cross,
          safetyClass,
          eligible,
          'Configured other-user object from the ownership fixture.',
          { target: bola.objectParameterName, kind: 'other_user', description: 'Use the configured foreign object id.' },
        ),
      );
    }
  }

  return cases;
}

function baseTemplate(endpoint: ApiEndpoint): TestCase['requestTemplate'] {
  return {
    method: endpoint.method,
    pathTemplate: endpoint.pathTemplate,
    pathValues: {},
    query: {},
    headers: {},
  };
}

function fillValid(endpoint: ApiEndpoint, template: TestCase['requestTemplate'], profile: TargetProfile): void {
  for (const parameter of endpoint.parameters) {
    if (parameter.required || parameter.location === 'path') {
      const bola = profile.bolaCases.find(
        (item) => item.pathTemplate === endpoint.pathTemplate && item.objectParameterName === parameter.name,
      );
      const value = bola ? bola.ownObjectId : schemaValue(parameter.schema, 'valid');
      applyParameter(template, parameter, value);
    }
  }
  if (endpoint.requestBody?.schema) {
    const example = endpoint.requestBody.example;
    template.body =
      example && typeof example === 'object' ? example : objectFromSchema(endpoint.requestBody.schema, 'valid');
  }
}

function makeCase(
  endpoint: ApiEndpoint,
  variant: TestCase['variant'],
  authContextId: string | null,
  requestTemplate: TestCase['requestTemplate'],
  safetyClass: TestCase['safetyClass'],
  eligible: boolean,
  expectedBehavior: string,
  mutation: TestCase['mutation'] = null,
  ineligibleReason?: string,
): TestCase {
  return {
    id: stableId(endpoint.id, 'generator', variant, authContextId ?? 'anon', JSON.stringify(requestTemplate)),
    endpointId: endpoint.id,
    scanner: variant === 'other_user' ? 'bola' : 'authentication',
    variant,
    authContextId,
    requestTemplate,
    mutation,
    prerequisites: [],
    expectedBehavior,
    safetyClass,
    executionEligibility: eligible
      ? { eligible: true }
      : { eligible: false, reason: ineligibleReason ?? 'Method is not approved by the target profile.' },
  };
}
