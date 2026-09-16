/**
 * Shared primitives used by every layer of Human Voice Suite.
 *
 * These are deliberately small and dependency-free so that any layer —
 * upstream adapters, detectors, the voice engine, the behaviour engine —
 * can speak the same vocabulary without importing anything heavy.
 */

/** Languages the suite currently routes on. */
export const LANGUAGES = ['zh', 'en', 'unknown'] as const;
export type Language = (typeof LANGUAGES)[number];

/**
 * Text modes decide which strategy the Strategy Engine picks.
 *
 * `chat` is a fast path: short conversational turns must never pay for the
 * full prose pipeline.
 */
export const TEXT_MODES = ['chat', 'prose', 'formal', 'technical', 'public', 'unknown'] as const;
export type TextMode = (typeof TEXT_MODES)[number];

/** Severity is bounded so cross-upstream rules stay comparable. */
export const SEVERITY_LEVELS = [1, 2, 3, 4, 5] as const;
export type Severity = (typeof SEVERITY_LEVELS)[number];

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

export function isTextMode(value: unknown): value is TextMode {
  return typeof value === 'string' && (TEXT_MODES as readonly string[]).includes(value);
}

/** Clamp an arbitrary upstream weight into the suite's 1..5 severity band. */
export function clampSeverity(value: number): Severity {
  if (!Number.isFinite(value)) return 3;
  const rounded = Math.round(value);
  if (rounded < 1) return 1;
  if (rounded > 5) return 5;
  return rounded as Severity;
}

/**
 * Every rule, finding and contract directive carries a stable dotted id.
 * Ids are lowercase snake_case segments joined by dots, e.g.
 * `chat.mirrors_user_opening`.
 */
export const ID_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$/;

export function isValidId(id: string): boolean {
  return ID_PATTERN.test(id);
}
