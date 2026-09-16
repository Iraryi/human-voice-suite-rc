/**
 * Markdown parsing helpers for upstream rule extraction.
 *
 * Every Markdown humanizer in the corpus uses the same broad shape — numbered
 * headings with bold-labelled fields beneath them — but no two agree on the
 * details. These helpers handle the shared parts so each adapter only has to
 * describe its own quirks.
 */

export interface Section {
  /** Heading text with markup and numbering stripped. */
  readonly title: string;
  /** Raw heading line, for locators. */
  readonly heading: string;
  /** 1-based line number of the heading. */
  readonly line: number;
  /** Heading level, 2 for `##`, 3 for `###`. */
  readonly level: number;
  /** Number when the heading is numbered, else undefined. */
  readonly number?: number;
  /** Body text between this heading and the next of the same or higher level. */
  readonly body: string;
}

export interface FrontMatter {
  readonly data: Record<string, string>;
  readonly body: string;
  /** Line offset between the body and the original document. */
  readonly bodyLineOffset: number;
}

/**
 * Split off a YAML front matter block.
 *
 * Only flat `key: value` pairs and literal blocks are read. This is not a YAML
 * parser and must not become one; the fields needed here are `version` and
 * `license`.
 */
export function extractFrontMatter(markdown: string): FrontMatter {
  const lines = markdown.split(/\r?\n/);
  if ((lines[0] ?? '').trim() !== '---') {
    return { data: {}, body: markdown, bodyLineOffset: 0 };
  }

  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if ((lines[i] ?? '').trim() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) return { data: {}, body: markdown, bodyLineOffset: 0 };

  const data: Record<string, string> = {};
  let currentKey: string | undefined;
  let literalIndent = 0;

  for (let i = 1; i < end; i += 1) {
    const line = lines[i] ?? '';
    const flat = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (flat) {
      currentKey = flat[1]!;
      const value = (flat[2] ?? '').trim();
      data[currentKey] = value === '|' || value === '>' ? '' : stripQuotes(value);
      literalIndent = 0;
      continue;
    }
    if (currentKey && /^\s+\S/.test(line)) {
      const text = line.trim();
      literalIndent += 1;
      data[currentKey] = data[currentKey] ? `${data[currentKey]} ${text}` : text;
      continue;
    }
    if (line.trim() === '') continue;
  }

  // A literal block indents its content; the first line after `|` is the value.
  void literalIndent;

  return {
    data,
    body: lines.slice(end + 1).join('\n'),
    bodyLineOffset: end + 1,
  };
}

function stripQuotes(value: string): string {
  if (value.length >= 2 && (value.startsWith('"') || value.startsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Split a document into sections at a given heading level.
 *
 * Line numbers are preserved so every extracted rule can carry a real locator.
 */
export function splitSections(
  markdown: string,
  level: 2 | 3,
  lineOffset = 0,
): Section[] {
  const lines = markdown.split(/\r?\n/);
  const headingPattern = new RegExp(`^#{${level}}\\s+(.*)$`);
  const starts: Array<{ index: number; heading: string }> = [];

  for (let i = 0; i < lines.length; i += 1) {
    const match = headingPattern.exec(lines[i] ?? '');
    if (match) starts.push({ index: i, heading: match[1]!.trim() });
  }

  return starts.map((start, index) => {
    const next = starts[index + 1]?.index ?? lines.length;
    const body = lines.slice(start.index + 1, next).join('\n');
    const { number, title } = parseHeadingNumber(start.heading);
    return {
      title,
      heading: start.heading,
      line: start.index + 1 + lineOffset,
      level,
      ...(number === undefined ? {} : { number }),
      body,
    };
  });
}

/**
 * Strip a leading number from a heading.
 *
 * Handles `12. Title`, `12、标题`, `12 Title` and `12：标题`. The separator is
 * optional because the corpus is inconsistent about it.
 */
export function parseHeadingNumber(heading: string): { number?: number; title: string } {
  const match = /^(\d{1,3})\s*[.\u3001:\uff1a)\uff09]?\s*(.+)$/.exec(heading.trim());
  if (!match) return { title: heading.trim() };
  const title = (match[2] ?? '').trim();
  if (title.length === 0) return { title: heading.trim() };
  return { number: Number.parseInt(match[1]!, 10), title };
}

export interface LabeledBlock {
  /** Label text without the surrounding asterisks or the trailing colon. */
  readonly label: string;
  /** Anything on the label line after the colon, plus following lines. */
  readonly content: string;
  /** 1-based line number of the label. */
  readonly line: number;
}

/**
 * Read `**Label:** content` fields out of a section body.
 *
 * Both the English `**Watch for:**` and the Chinese `**留意：**` forms are
 * handled, including labels with a parenthetical variant such as
 * `**Before (split across sentences):**`.
 */
export function parseLabeledBlocks(body: string, lineOffset = 0): LabeledBlock[] {
  const lines = body.split(/\r?\n/);
  const blocks: LabeledBlock[] = [];
  const pattern = /^\s*\*\*(.+?)[:\uff1a]\*\*\s*(.*)$/;

  let current: { label: string; line: number; parts: string[] } | undefined;

  const flush = (): void => {
    if (!current) return;
    blocks.push({
      label: current.label,
      content: current.parts.join('\n').trim(),
      line: current.line,
    });
    current = undefined;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const match = pattern.exec(line);
    if (match) {
      flush();
      current = {
        label: match[1]!.trim(),
        line: i + 1 + lineOffset,
        parts: [(match[2] ?? '').trim()].filter((part) => part.length > 0),
      };
      continue;
    }
    if (current) current.parts.push(line);
  }
  flush();

  return blocks;
}

/** Strip blockquote markers and collapse the result to plain text. */
export function unquote(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*>\s?/, ''))
    .join('\n')
    .trim();
}

/** Split a blockquote block into separate quoted passages. */
export function extractBlockquotes(text: string, lineOffset = 0): Array<{ text: string; line: number }> {
  const lines = text.split(/\r?\n/);
  const out: Array<{ text: string; line: number }> = [];
  let current: { lines: string[]; line: number } | undefined;

  const flush = (): void => {
    if (!current) return;
    const joined = current.lines.join('\n').trim();
    if (joined.length > 0) out.push({ text: joined, line: current.line });
    current = undefined;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (/^\s*>/.test(line)) {
      if (!current) current = { lines: [], line: i + 1 + lineOffset };
      current.lines.push(line.replace(/^\s*>\s?/, ''));
      continue;
    }
    if (current && line.trim() === '') {
      // A blank line ends the quote only if no further quote lines follow.
      const next = lines[i + 1] ?? '';
      if (/^\s*>/.test(next)) {
        current.lines.push('');
        continue;
      }
      flush();
      continue;
    }
    if (current && line.trim() !== '') flush();
  }
  flush();

  return out;
}

/** Find a label whose name starts with one of the given prefixes. */
export function findBlock(
  blocks: readonly LabeledBlock[],
  ...prefixes: readonly string[]
): LabeledBlock | undefined {
  for (const block of blocks) {
    const lower = block.label.toLowerCase();
    for (const prefix of prefixes) {
      if (lower.startsWith(prefix.toLowerCase())) return block;
    }
  }
  return undefined;
}

/** Find every label whose name starts with one of the given prefixes, in order. */
export function findBlocks(
  blocks: readonly LabeledBlock[],
  ...prefixes: readonly string[]
): LabeledBlock[] {
  return blocks.filter((block) => {
    const lower = block.label.toLowerCase();
    return prefixes.some((prefix) => lower.startsWith(prefix.toLowerCase()));
  });
}
