/**
 * Compiling construction templates into matchable patterns.
 *
 * Extraction classifies a watched entry into three kinds. `literal` entries are
 * matched by the lexical detector. `reference` entries are too vague to match.
 * The middle kind — `template` — is a construction such as `not X but Y` or
 * `不是……而是……`, and until there is a compiler for it, it is dead data.
 *
 * Blader alone contributes eighteen templates, and they are its strongest
 * structural rules, so leaving them unmatcheable would mean the suite detects
 * the vocabulary of AI prose and none of its shape.
 *
 * The hard part is that upstreams write templates in two registers:
 *
 *   - as a construction: `not X but Y`, `as of [date]`, `不是……而是……`
 *   - as a description of one: `the reversed form X rather than Y`,
 *     `a clipped negative tail ("..., no guessing")`
 *
 * Only the first is matchable. Compiling the second produces a pattern that will
 * never fire, or worse, one that fires on prose discussing the tell.
 */

import { CanonicalRuleRegistry } from '../../rules/canonical/registry.js';
import type { CanonicalRule, WatchPhrase } from '../../rules/types.js';
import { LOCAL_UPSTREAM } from '../../rules/provenance/types.js';

export interface CompiledTemplate {
  readonly ruleId: string;
  readonly upstream: string;
  readonly template: string;
  /** The phrase as the upstream stated it, so ownership can be decided on it. */
  readonly phrase: WatchPhrase;
  readonly regex: RegExp;
  readonly confidence: number;
}

/** Standalone single-letter placeholders, bracketed slots, and ellipses. */
const LITERAL_PLACEHOLDER = /\[[^\]]*\]/g;

/**
 * Longest a placeholder may span.
 *
 * Deliberately short. `X` stands for a noun phrase, not for half a paragraph,
 * and a greedy wildcard turns `not X but Y` into a matcher for any sentence
 * containing both words.
 *
 * Latin placeholders are bounded by WORDS rather than characters, because the
 * slot stands for a phrase. `不是` and `而是` around a slot carry as much
 * information as five Latin characters, so the minimum literal length is
 * script-dependent.
 */
const MAX_LATIN_WORDS = 5;
const MAX_CJK_CHARS = 15;
/**
 * How far a soft slot may reach.
 *
 * Short on purpose. It may cross a full stop, which is what `...` means in the
 * upstream's notation, but it must not run on into the next paragraph.
 */
const MAX_SOFT_LATIN_CHARS = 40;

/** How far the "this slot must contain a word" lookahead reaches. */
const MAX_SOFT_LOOKAHEAD = 30;

/**
 * A template whose opening literal reads as prose rather than as a construction.
 *
 * `the reversed form X rather than Y` starts with a determiner and two words;
 * it is the upstream describing a construction, not stating one. Compiling it
 * would produce a pattern that only fires on text about the tell.
 */
const DESCRIPTIVE_LEAD = /^(?:the|a|an|its|their|this|that)\s+\S+\s+\S+/i;

/** Minimum literal content, so a pattern has something to anchor on. */
const MIN_LATIN_LITERAL = 5;
const MIN_CJK_LITERAL = 2;

function isMostlyCjk(text: string): boolean {
  let cjk = 0;
  let total = 0;
  for (const ch of text) {
    if (/\s/.test(ch)) continue;
    total += 1;
    if (ch.codePointAt(0)! >= 0x3000) cjk += 1;
  }
  return total > 0 && cjk / total >= 0.3;
}

function escapeLiteral(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface Piece {
  readonly kind: 'literal' | 'placeholder' | 'alternation';
  readonly text: string;
  /**
   * True for a placeholder written as an ellipsis or a bracketed slot.
   *
   * `X` stands for a noun phrase and must not span a sentence break, or
   * `not X but Y` becomes a matcher for any two clauses in a paragraph. `...`
   * is the upstream's shorthand for "and the sentence continues", so it must.
   * `Not a X... Not a Y... A Z.` only matches `Not a tool. Not a mirror. A
   * frame.` if the ellipsis may cross the full stops.
   */
  readonly soft?: boolean;
}

/**
 * Split a template into literal runs and placeholders.
 *
 * Recognises a standalone `X`/`Y`/`Z`/`N`, a bracketed slot such as `[date]`,
 * a bracketed **list of alternatives** such as `[grew up, studied, began]`, and
 * the CJK ellipsis `……` or `...`.
 *
 * The two bracket forms are not the same thing, and treating them as one was a
 * Phase 8 defect. `as of [date]` is a slot: any date fits, so it compiles to a
 * bounded wildcard. `likely [grew up, studied, began]` is the upstream enumerating
 * the verbs it means — read in context, blader's list is *"likely grew up"*,
 * *"likely studied"*, *"likely began"*, the shape a model uses when it guesses at
 * a biography. Compiling that as a wildcard made `likely` plus anything a match,
 * including "most likely to come next", and it produced a severity-5 false
 * positive on a human-written sample in the benchmark. A comma inside the
 * brackets means alternatives; a single token means a slot.
 */
export function splitTemplate(template: string): Piece[] {
  const pieces: Piece[] = [];
  let literal = '';

  const flush = (): void => {
    if (literal.length > 0) pieces.push({ kind: 'literal', text: literal });
    literal = '';
  };

  for (let i = 0; i < template.length; i += 1) {
    const ch = template[i]!;
    const rest = template.slice(i);

    if (ch === '[') {
      const close = template.indexOf(']', i);
      if (close !== -1) {
        const inner = template.slice(i + 1, close);
        flush();
        pieces.push(
          inner.includes(',')
            ? { kind: 'alternation', text: inner }
            : { kind: 'placeholder', text: '[slot]', soft: true },
        );
        i = close;
        continue;
      }
    }
    // A standalone capital X, Y, Z or N used as a slot.
    if (/[XYZN]/.test(ch) && !/[A-Za-z]/.test(template[i - 1] ?? '') && !/[A-Za-z]/.test(template[i + 1] ?? '')) {
      flush();
      pieces.push({ kind: 'placeholder', text: ch });
      continue;
    }
    // `……` or `...` as a slot. Soft: the sentence continues through it.
    if (rest.startsWith('\u2026\u2026') || rest.startsWith('\u2026')) {
      flush();
      pieces.push({ kind: 'placeholder', text: '\u2026', soft: true });
      i += rest.startsWith('\u2026\u2026') ? 1 : 0;
      continue;
    }
    if (rest.startsWith('...')) {
      flush();
      pieces.push({ kind: 'placeholder', text: '...', soft: true });
      i += 2;
      continue;
    }
    literal += ch;
  }
  flush();

  return pieces;
}

/**
 * Compile one template. Returns null when the entry is not matchable.
 *
 * Returning null is the correct outcome for descriptive entries; the caller
 * reports how many compiled so the number is visible rather than assumed.
 *
 * Three shapes are handled beyond the obvious one:
 *
 * - **No placeholder at all.** Extraction classifies some plain literals as
 *   templates because they sat in a list that contained an ellipsis. `in
 *   conclusion` is a phrase to match, not a construction, so it compiles as a
 *   literal rather than being dropped.
 * - **A bundled pair.** `stop-slop` writes table rows such as
 *   `Not because X. Because Y." / "Not because X, but because Y.`, which is two
 *   alternatives in one cell. The stray quotes are stripped and the variants are
 *   compiled as an alternation.
 * - **Chinese spacing.** `让 X 成为可能` is written with spaces around the slot,
 *   but Chinese prose has none, so a strictly literal reading would never match.
 */
export function compileTemplate(template: string): RegExp | null {
  const variants = splitBundledVariants(template);
  const sources: string[] = [];
  let cjk = false;

  for (const variant of variants) {
    const built = compileVariant(variant);
    if (!built) continue;
    sources.push(built.source);
    cjk = cjk || built.cjk;
  }

  if (sources.length === 0) return null;
  const prefix = cjk && sources.every((s) => !/^\\b/.test(s)) ? '' : '';
  try {
    return new RegExp(`${prefix}(?:${sources.join('|')})`, 'giu');
  } catch {
    return null;
  }
}

/** Strip markup and split a `" / "`-bundled pair into separate alternatives. */
function splitBundledVariants(template: string): string[] {
  const cleaned = template.replace(/^["\u201c\u300c]+|["\u201d\u300d]+$/g, '').trim();
  if (!/["\u201d\u300d]\s*\/\s*["\u201c\u300c]/.test(cleaned)) return [cleaned];
  return cleaned
    .split(/["\u201d\u300d]\s*\/\s*["\u201c\u300c]/)
    .map((part) => part.replace(/^["\u201c\u300c]+|["\u201d\u300d]+$/g, '').trim())
    .filter((part) => part.length > 0);
}

function compileVariant(variant: string): { source: string; cjk: boolean } | null {
  const trimmed = variant.trim();
  if (trimmed.length === 0) return null;
  // A descriptive entry describes a construction rather than stating one.
  if (DESCRIPTIVE_LEAD.test(trimmed)) return null;

  const pieces = splitTemplate(trimmed);
  const hasPlaceholder = pieces.some(
    (piece) => piece.kind === 'placeholder' || piece.kind === 'alternation',
  );
  const cjk = isMostlyCjk(trimmed);

  const strictWildcard = cjk
    ? `[^\\n]{1,${MAX_CJK_CHARS}}?`
    : `[^\\s.;!?]+(?:\\s+[^\\s.;!?]+){0,${MAX_LATIN_WORDS - 1}}`;
  // A soft slot may cross a sentence break — that is what `...` means in the
  // upstream's notation — but it must still contain a word. Without the
  // lookahead, `likely [slot]` matched the bare full stop in "That is likely.",
  // which is a sentence ending rather than the verb phrase the slot stands for.
  const softWildcard = cjk
    ? `(?=[^\\n]{1,${MAX_CJK_CHARS}}?[\\w\\u4e00-\\u9fff])[^\\n]{1,${MAX_SOFT_LATIN_CHARS}}?`
    : `(?=[^\\n]{1,${MAX_SOFT_LOOKAHEAD}}?[A-Za-z0-9])[^\\n]{1,${MAX_SOFT_LATIN_CHARS}}?`;

  let source = '';
  let literalLength = 0;

  for (const piece of pieces) {
    if (piece.kind === 'alternation') {
      // Each alternative is literal text; whitespace inside one becomes `\s+`
      // so `grew up` matches regardless of how the source spaced it.
      const alternatives = piece.text
        .split(',')
        .map((alternative) => alternative.trim())
        .filter((alternative) => alternative.length > 0)
        .map((alternative) =>
          alternative
            .split(/\s+/)
            .map((word) => escapeLiteral(word))
            .join('\\s+'),
        );
      if (alternatives.length === 0) continue;
      literalLength += alternatives.join('').length;
      source += `(?:${alternatives.join('|')})`;
      source += '\\s*';
      continue;
    }
    if (piece.kind === 'literal') {
      // Trim and let the boundary handle spacing. An upstream writes
      // `Want me to...?` with no space before the slot and `as of [date]` with
      // one; both must match the same way, so the whitespace belongs to the
      // boundary rather than to the literal.
      const text = hasPlaceholder ? piece.text.trim() : piece.text;
      if (text.length === 0) continue;
      literalLength += text.length;
      source += escapeLiteral(text);
      if (hasPlaceholder) source += '\\s*';
    } else {
      // The trailing placeholder is KEPT. Dropping it left patterns such as
      // `as of `, which matches any sentence containing those two words.
      source += piece.soft ? softWildcard : strictWildcard;
      source += '\\s*';
    }
  }

  const minimum = cjk ? MIN_CJK_LITERAL : MIN_LATIN_LITERAL;
  if (literalLength < minimum) return null;
  if (source.length === 0) return null;

  const prefix = cjk ? '' : '\\b';
  const bounded = `${prefix}(?:${source})`;
  try {
    // Reject a pattern that matches the empty string.
    if (new RegExp(bounded, 'u').test('')) return null;
  } catch {
    return null;
  }
  return { source: bounded, cjk };
}

export interface TemplateCompilationReport {
  readonly compiled: readonly CompiledTemplate[];
  readonly skipped: ReadonlyArray<{ readonly ruleId: string; readonly template: string }>;
}

/** Compile every template phrase the registry carries for a language. */
export function buildTemplatePatterns(
  rules: readonly CanonicalRule[],
  language: string,
): TemplateCompilationReport {
  const compiled: CompiledTemplate[] = [];
  const skipped: Array<{ ruleId: string; template: string }> = [];

  for (const rule of rules) {
    if (!rule.languages.includes(language) && !rule.languages.includes('unknown')) continue;
    for (const phrase of rule.watchPhrases ?? []) {
      if (phrase.kind !== 'template') continue;
      const regex = compileTemplate(phrase.text);
      if (!regex) {
        skipped.push({ ruleId: rule.id, template: phrase.text });
        continue;
      }
      compiled.push({
        ruleId: rule.id,
        upstream: rule.sources[0]?.upstream ?? LOCAL_UPSTREAM,
        template: phrase.text,
        phrase,
        regex,
        // A construction is a stronger signal than a single watched word, but
        // its wildcards make it looser, so it sits below a literal phrase.
        confidence: phrase.note ? 0.5 : 0.7,
      });
    }
  }

  return { compiled, skipped };
}

const templateCache = new WeakMap<CanonicalRuleRegistry, Map<string, TemplateCompilationReport>>();

export function templatesFor(
  registry: CanonicalRuleRegistry,
  language: string,
): TemplateCompilationReport {
  let byLanguage = templateCache.get(registry);
  if (!byLanguage) {
    byLanguage = new Map();
    templateCache.set(registry, byLanguage);
  }
  const cached = byLanguage.get(language);
  if (cached) return cached;
  const built = buildTemplatePatterns(registry.list(), language);
  byLanguage.set(language, built);
  return built;
}

export type { WatchPhrase };
