/**
 * Heuristic extraction of numbered rules from an upstream Markdown skill.
 *
 * This exists so that `upstream:check` can answer "what rules were added or
 * removed upstream" WITHOUT needing the full adapter for that upstream to be
 * finished. It is explicitly a heuristic: it reads numbered headings and bold
 * numbered leads, which is how every Markdown humanizer in the current corpus
 * numbers its patterns. Full-fidelity extraction is the adapter's job.
 */

export interface ExtractedRuleHeading {
  readonly number: number;
  readonly title: string;
  /** 1-based line number the heading was found on. */
  readonly line: number;
}

const HEADING_PATTERN = /^\s{0,3}(#{1,6})\s*(\d{1,3})\s*[.、:：)）]?\s+(.+?)\s*#*\s*$/;
const BOLD_LEAD_PATTERN = /^\s*\*\*\s*(\d{1,3})\s*[.、:：)）]\s*(.+?)\s*\*\*/;
const NUMERIC_HEADING_PATTERN = /^\s{0,3}(#{1,6})\s*(\d{1,3})\s*$/;

export function extractNumberedHeadings(markdown: string): ExtractedRuleHeading[] {
  const out: ExtractedRuleHeading[] = [];
  const seen = new Set<number>();
  const lines = markdown.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';

    let number: number | undefined;
    let title: string | undefined;

    const heading = HEADING_PATTERN.exec(line);
    if (heading) {
      number = Number.parseInt(heading[2] ?? '', 10);
      title = heading[3];
    } else {
      const bold = BOLD_LEAD_PATTERN.exec(line);
      if (bold) {
        number = Number.parseInt(bold[1] ?? '', 10);
        title = bold[2];
      } else {
        const bare = NUMERIC_HEADING_PATTERN.exec(line);
        if (bare) {
          number = Number.parseInt(bare[2] ?? '', 10);
          // Title, when present, is the first non-empty following line.
          title = firstNonEmpty(lines, index + 1);
        }
      }
    }

    if (number === undefined || Number.isNaN(number)) continue;
    if (title === undefined || title.trim().length === 0) continue;
    if (seen.has(number)) continue;
    seen.add(number);
    out.push({ number, title: title.trim(), line: index + 1 });
  }

  return out.sort((a, b) => a.number - b.number);
}

function firstNonEmpty(lines: readonly string[], from: number): string | undefined {
  for (let index = from; index < Math.min(from + 3, lines.length); index += 1) {
    const line = (lines[index] ?? '').trim();
    if (line.length > 0) return line.replace(/^[*_`]+|[*_`]+$/g, '');
  }
  return undefined;
}

const RULE_BEARING_BASENAMES = /^(skill|readme|agents)\.md$/i;
const RULE_BEARING_KEYWORDS = /(pattern|rule|phrase|structure|banned|lexicon|corpus|voice)/i;

/**
 * Files worth diffing for rule changes.
 *
 * Deliberately narrow: SKILL.md and any Markdown file whose name or directory
 * mentions patterns, rules, phrases, structures, banned words, lexicons,
 * corpora or voices.
 */
export function isRuleBearingFile(relativePath: string): boolean {
  if (!relativePath.toLowerCase().endsWith('.md')) return false;
  // Provenance and packaging docs are not rule sources.
  if (/(^|\/)(license|changelog|contributing|security|third_party|notice)/i.test(relativePath)) {
    return false;
  }
  const basename = relativePath.split('/').pop() ?? relativePath;
  if (basename.toLowerCase() === 'skill.md') return true;
  // The directory matters: `references/voices/fengtang.md` carries voice rules
  // even though its own filename says nothing about rules.
  return RULE_BEARING_KEYWORDS.test(basename) || RULE_BEARING_KEYWORDS.test(relativePath);
}

export interface RenamedHeading {
  readonly number: number;
  readonly from: string;
  readonly to: string;
}

export interface HeadingDelta {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  /** Same number, different title: the rule was reworded or retargeted. */
  readonly renamed: readonly RenamedHeading[];
  readonly unchanged: number;
}

/**
 * Compare two revisions of a rule file by rule number.
 *
 * Number is the identity, because every Markdown humanizer in the corpus
 * numbers its patterns and the numbering is what localisations preserve. A
 * changed title at the same number is reported as a rename rather than as a
 * removal plus an addition, which would obscure what actually happened.
 */
export function compareHeadingSets(
  before: readonly ExtractedRuleHeading[],
  after: readonly ExtractedRuleHeading[],
): HeadingDelta {
  const beforeByNumber = new Map(before.map((h) => [h.number, h]));
  const afterByNumber = new Map(after.map((h) => [h.number, h]));

  const added: string[] = [];
  const removed: string[] = [];
  const renamed: RenamedHeading[] = [];
  let unchanged = 0;

  for (const heading of after) {
    const previous = beforeByNumber.get(heading.number);
    if (!previous) {
      added.push(`${heading.number}. ${heading.title}`);
      continue;
    }
    if (normaliseTitle(previous.title) === normaliseTitle(heading.title)) unchanged += 1;
    else renamed.push({ number: heading.number, from: previous.title, to: heading.title });
  }

  for (const heading of before) {
    if (!afterByNumber.has(heading.number)) removed.push(`${heading.number}. ${heading.title}`);
  }

  return { added, removed, renamed, unchanged };
}

function normaliseTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim().toLowerCase();
}

export interface CopyrightLine {
  readonly holder: string;
}

/** Pull `Copyright ...` lines out of a licence file for change detection. */
export function extractCopyrightLines(licenseText: string): CopyrightLine[] {
  return licenseText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^copyright\b/i.test(line))
    .map((line) => ({ holder: line.replace(/\s+/g, ' ') }));
}

/** Rough SPDX-ish label from licence text, used to spot licence swaps. */
export function detectLicenseFamily(licenseText: string): string {
  const text = licenseText.toLowerCase();
  if (text.includes('gnu affero general public license')) return 'AGPL';
  if (text.includes('gnu lesser general public license')) return 'LGPL';
  if (text.includes('gnu general public license')) return 'GPL';
  if (text.includes('apache license') && text.includes('version 2.0')) return 'Apache-2.0';
  if (text.includes('bsd 3-clause') || text.includes('redistribution and use in source and binary forms')) {
    if (text.includes('neither the name of the copyright holder')) return 'BSD-3-Clause';
    return 'BSD-2-Clause';
  }
  if (text.includes('mit license') || text.includes('permission is hereby granted, free of charge')) {
    return 'MIT';
  }
  if (text.includes('mozilla public license')) return 'MPL-2.0';
  if (text.includes('isc license')) return 'ISC';
  return 'unknown';
}
