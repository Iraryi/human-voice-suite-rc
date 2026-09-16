/**
 * A validator for the JSON Schema subset DSH enforces on tool output.
 *
 * The plugin declares its own schemas, so nothing but a test can catch a tool
 * whose return value does not match what it promised. The real harness would
 * reject the call at run time; this makes it fail in CI instead.
 *
 * The subset, taken from `@deepseek-ai/dsh-tools`' `json-schema` module:
 * an object root, one scalar `type`, `properties`/`required`/boolean
 * `additionalProperties`, array `items`, type-correct scalar `enum`/`const`, and
 * exact-one `oneOf`.
 */

export interface JsonSchemaNode {
  readonly type?: string;
  readonly oneOf?: readonly JsonSchemaNode[];
  readonly properties?: Readonly<Record<string, JsonSchemaNode>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
  readonly items?: JsonSchemaNode;
  readonly enum?: readonly (string | number | boolean | null)[];
  readonly const?: string | number | boolean | null;
}

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

function typeMatches(expected: string, value: unknown): boolean {
  const actual = typeOf(value);
  if (expected === 'number') return actual === 'number' || actual === 'integer';
  return actual === expected;
}

/** Every problem found, as `path: message`. Empty means valid. */
export function validateAgainst(
  schema: JsonSchemaNode,
  value: unknown,
  path = '$',
): string[] {
  const problems: string[] = [];

  if (schema.oneOf) {
    const matching = schema.oneOf.filter((branch) => validateAgainst(branch, value, path).length === 0);
    if (matching.length !== 1) {
      problems.push(`${path}: expected exactly one oneOf branch to match, got ${matching.length}`);
    }
    return problems;
  }

  if (schema.type && !typeMatches(schema.type, value)) {
    return [`${path}: expected ${schema.type}, got ${typeOf(value)}`];
  }

  if (schema.const !== undefined && value !== schema.const) {
    problems.push(`${path}: expected const ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum && !schema.enum.some((allowed) => allowed === value)) {
    problems.push(`${path}: ${JSON.stringify(value)} is not one of ${schema.enum.join(', ')}`);
  }

  if (schema.type === 'object' && typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!Object.prototype.hasOwnProperty.call(record, key) || record[key] === undefined) {
        problems.push(`${path}.${key}: required but missing`);
      }
    }
    const properties = schema.properties ?? {};
    for (const [key, child] of Object.entries(properties)) {
      if (!Object.prototype.hasOwnProperty.call(record, key) || record[key] === undefined) continue;
      problems.push(...validateAgainst(child, record[key], `${path}.${key}`));
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(record)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) {
          problems.push(`${path}.${key}: undeclared and additionalProperties is false`);
        }
      }
    }
  }

  if (schema.type === 'array' && Array.isArray(value) && schema.items) {
    value.forEach((item, index) => {
      problems.push(...validateAgainst(schema.items!, item, `${path}[${index}]`));
    });
  }

  return problems;
}
