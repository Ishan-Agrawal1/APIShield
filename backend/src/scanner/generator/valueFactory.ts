import type { JsonSchemaLike } from '@apishield/contracts';

export function schemaValue(schema: JsonSchemaLike | undefined, intent: 'valid' | 'invalid' | 'boundary'): unknown {
  const type = String(schema?.type ?? inferType(schema));
  if (intent === 'invalid') {
    if (type === 'integer' || type === 'number') {
      return 'not-a-number';
    }
    if (type === 'boolean') {
      return 'not-a-boolean';
    }
    if (type === 'object') {
      return [];
    }
    if (type === 'array') {
      return {};
    }
    return 1;
  }

  if (schema?.example !== undefined && intent === 'valid' && valueMatches(schema.example, schema)) {
    return schema.example;
  }
  if (schema?.default !== undefined && intent === 'valid' && valueMatches(schema.default, schema)) {
    return schema.default;
  }
  if (Array.isArray(schema?.enum) && schema.enum.length > 0) {
    return intent === 'boundary' ? schema.enum[schema.enum.length - 1] : schema.enum[0];
  }

  if (type === 'integer' || type === 'number') {
    if (intent === 'boundary') {
      if (typeof schema?.minimum === 'number') {
        return schema.minimum;
      }
      if (typeof schema?.maximum === 'number') {
        return schema.maximum;
      }
    }
    return type === 'integer' ? 1 : 1.0;
  }
  if (type === 'boolean') {
    return true;
  }
  if (type === 'array') {
    const item = schemaValue((schema?.items as JsonSchemaLike | undefined) ?? { type: 'string' }, 'valid');
    return [item];
  }
  if (type === 'object') {
    return objectFromSchema(schema ?? { type: 'object' }, 'valid');
  }
  if (schema?.format === 'email') {
    return 'user@example.com';
  }
  if (intent === 'boundary' && typeof schema?.minLength === 'number') {
    return 'a'.repeat(schema.minLength);
  }
  return 'example';
}

export function objectFromSchema(schema: JsonSchemaLike, intent: 'valid' | 'invalid' | 'boundary'): Record<string, unknown> {
  const properties = (schema.properties as Record<string, JsonSchemaLike> | undefined) ?? {};
  const required = Array.isArray(schema.required) ? schema.required.map(String) : Object.keys(properties);
  const output: Record<string, unknown> = {};
  for (const key of required) {
    output[key] = schemaValue(properties[key], intent === 'invalid' ? 'invalid' : 'valid');
  }
  return output;
}

export function valueMatches(value: unknown, schema: JsonSchemaLike): boolean {
  const type = String(schema.type ?? inferType(schema));
  if (type === 'integer') {
    return typeof value === 'number' && Number.isInteger(value);
  }
  if (type === 'number') {
    return typeof value === 'number';
  }
  if (type === 'boolean') {
    return typeof value === 'boolean';
  }
  if (type === 'array') {
    return Array.isArray(value);
  }
  if (type === 'object') {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
  return typeof value === 'string';
}

function inferType(schema: JsonSchemaLike | undefined): string {
  if (!schema) {
    return 'string';
  }
  if (schema.properties) {
    return 'object';
  }
  if (schema.items) {
    return 'array';
  }
  return 'string';
}
