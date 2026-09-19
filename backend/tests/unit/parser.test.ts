import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseOpenApiDocument } from '../../src/scanner/parser/openApiParser.js';
import { AppError } from '../../src/utils/errors.js';

const yaml30 = `
openapi: 3.0.3
info:
  title: Notes
paths:
  /users/me:
    get:
      security:
        - bearerAuth: []
      responses:
        '200':
          description: me
  /users/{id}:
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: integer
          example: 1
    get:
      security:
        - bearerAuth: []
      responses:
        '200':
          description: user
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
`;

const json30 = JSON.stringify({
  openapi: '3.0.3',
  info: { title: 'Notes' },
  paths: {
    '/users/me': { get: { security: [{ bearerAuth: [] }], responses: { '200': { description: 'me' } } } },
    '/users/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 1 } }],
      get: { security: [{ bearerAuth: [] }], responses: { '200': { description: 'user' } } },
    },
  },
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
});

describe('OpenAPI parser', () => {
  it('normalizes YAML and JSON equivalently and preserves static route precedence', () => {
    const fromYaml = parseOpenApiDocument(yaml30);
    const fromJson = parseOpenApiDocument(json30);
    assert.equal(fromYaml.endpoints.length, fromJson.endpoints.length);
    assert.equal(fromYaml.endpoints[0]?.pathTemplate, '/users/me');
    assert.equal(fromYaml.openapiVersion, '3.0.3');
  });

  it('applies operation security override and empty anonymous alternatives', () => {
    const parsed = parseOpenApiDocument(`
openapi: 3.1.0
info: { title: t }
security:
  - bearerAuth: []
paths:
  /public:
    get:
      security: []
      responses: { '200': { description: ok } }
  /optional:
    get:
      security:
        - {}
        - bearerAuth: []
      responses: { '200': { description: ok } }
components:
  securitySchemes:
    bearerAuth: { type: http, scheme: bearer }
`);
    const pub = parsed.endpoints.find((item) => item.pathTemplate === '/public');
    const optional = parsed.endpoints.find((item) => item.pathTemplate === '/optional');
    assert.deepEqual(pub?.effectiveSecurity, []);
    assert.equal(optional?.effectiveSecurity.some((item) => Object.keys(item).length === 0), true);
  });

  it('rejects external refs, oversized documents, and malformed input', () => {
    assert.throws(
      () => parseOpenApiDocument('openapi: 3.0.3\npaths:\n  /x:\n    get:\n      $ref: https://evil.test/op.yaml\n'),
      (error: unknown) => error instanceof AppError && error.code === 'FORBIDDEN_REF',
    );
    assert.throws(() => parseOpenApiDocument('{'), (error: unknown) => error instanceof AppError);
    const huge = `openapi: 3.0.3\ninfo: { title: t }\npaths: {}\n${'x: 1\n'.repeat(30_000)}`;
    assert.throws(() => parseOpenApiDocument(huge), (error: unknown) => error instanceof AppError);
  });

  it('discovers OpenAPI 3.2 query operations as non-executable', () => {
    const parsed = parseOpenApiDocument(`
openapi: 3.2.0
info: { title: t }
paths:
  /search:
    query:
      responses:
        '200': { description: ok }
`);
    assert.equal(parsed.endpoints[0]?.method, 'query');
    assert.equal(parsed.endpoints[0]?.supportStatus, 'unsupported');
    assert.equal(parsed.supportSummary.execution, 'partial');
  });

  it('distinguishes a valid document with zero operations', () => {
    const parsed = parseOpenApiDocument('openapi: 3.0.3\ninfo: { title: empty }\npaths: {}\n');
    assert.equal(parsed.endpoints.length, 0);
    assert.ok(parsed.warnings.some((warning) => warning.code === 'NO_OPERATIONS'));
  });
});
