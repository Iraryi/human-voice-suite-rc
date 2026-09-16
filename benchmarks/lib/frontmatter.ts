/**
 * A deliberately small YAML subset, for corpus front matter.
 *
 * The project has no runtime dependencies, and a benchmark corpus is not a
 * reason to acquire one. Three shapes are supported because three are enough:
 *
 * ```yaml
 * key: plain scalar
 * key: >
 *   folded text, joined with spaces
 * key: |
 *   literal text, newlines kept
 * ```
 *
 * Anything else — nested maps, inline lists, anchors, quoted keys — is rejected
 * with the line number rather than silently misread, because a corpus whose
 * `licence` field was parsed as part of the `notes` block is worse than a corpus
 * that refuses to load.
 */

export class FrontMatterError extends Error {
  constructor(origin: string, line: number, problem: string) {
    super(`${origin}:${line}: ${problem}`);
    this.name = 'FrontMatterError';
  }
}

export interface FrontMatter {
  readonly fields: Readonly<Record<string, string>>;
  /** Line count of the front matter block, so the body can be located. */
  readonly endLine: number;
}

const DELIMITER = '---';

export function parseFrontMatter(text: string, origin = '<input>'): FrontMatter {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if ((lines[0] ?? '').trim() !== DELIMITER) {
    throw new FrontMatterError(origin, 1, 'the file must start with a --- line');
  }

  const fields: Record<string, string> = {};
  let index = 1;
  let blockKey: string | null = null;
  let blockLines: string[] = [];
  let blockMode: 'folded' | 'literal' | null = null;

  const flush = (): void => {
    if (blockKey === null || blockMode === null) return;
    fields[blockKey] =
      blockMode === 'folded'
        ? blockLines.map((line) => line.trim()).join(' ').replace(/\s+/g, ' ').trim()
        : dedent(blockLines).join('\n').replace(/\s+$/, '');
    blockKey = null;
    blockLines = [];
    blockMode = null;
  };

  for (; index < lines.length; index += 1) {
    const raw = lines[index] ?? '';
    const lineNumber = index + 1;

    if (raw.trim() === DELIMITER) {
      flush();
      return { fields, endLine: lineNumber };
    }

    if (blockMode !== null) {
      if (raw.trim().length === 0) {
        blockLines.push('');
        continue;
      }
      if (/^[ \t]/.test(raw)) {
        blockLines.push(raw);
        continue;
      }
      // A dedented line ends the block; fall through and parse it as a field.
      flush();
    }

    if (raw.trim().length === 0) continue;
    if (/^\s/.test(raw)) {
      throw new FrontMatterError(origin, lineNumber, 'unexpected indentation outside a block scalar');
    }

    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(raw);
    if (!match) {
      throw new FrontMatterError(origin, lineNumber, `not a key: value pair: ${JSON.stringify(raw)}`);
    }
    const key = match[1] ?? '';
    const value = (match[2] ?? '').trim();

    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      throw new FrontMatterError(origin, lineNumber, `duplicate key ${key}`);
    }

    if (value === '>' || value === '|' || value === '>-' || value === '|-') {
      blockKey = key;
      blockMode = value.startsWith('>') ? 'folded' : 'literal';
      continue;
    }
    if (value.startsWith('[') || value.startsWith('{') || value.startsWith('&') || value.startsWith('*')) {
      throw new FrontMatterError(
        origin,
        lineNumber,
        `unsupported YAML feature for ${key}: this parser accepts plain scalars and > or | blocks only`,
      );
    }
    if (value.length === 0) {
      // A key with no value opens an indented block. The seed sample uses this
      // for `expected:`, which lists what the sample is meant to expose — for a
      // human reader, not for the harness. It is captured verbatim rather than
      // parsed, and a genuinely empty required field is still caught by the
      // loader's missing-field check.
      blockKey = key;
      blockMode = 'literal';
      continue;
    }
    fields[key] = unquote(value);
  }

  throw new FrontMatterError(origin, lines.length, 'the front matter is never closed with ---');
}

function unquote(value: string): string {
  const match = /^(['"])(.*)\1$/.exec(value);
  return match ? (match[2] ?? '') : value;
}

/**
 * Remove the block's common indentation.
 *
 * Without this a literal block keeps the two spaces that mark it as a block, and
 * a `user_turn` arrives with a leading indent on every line — which would then be
 * compared against a reply with the indentation still attached.
 */
function dedent(lines: readonly string[]): string[] {
  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => (/^[ \t]*/.exec(line)?.[0] ?? '').length);
  const common = indents.length === 0 ? 0 : Math.min(...indents);
  return lines.map((line) => line.slice(common));
}

/** The body after the closing delimiter, with the single separating blank line removed. */
export function splitBody(text: string): { frontMatter: FrontMatter; body: string } {
  const frontMatter = parseFrontMatter(text);
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const body = lines
    .slice(frontMatter.endLine)
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\s+$/, '');
  return { frontMatter, body };
}
