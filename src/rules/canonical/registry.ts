/**
 * The canonical rule registry.
 *
 * Guarantees the property the project brief calls out explicitly: an upstream
 * rule, a second upstream's rule and a third upstream's rule that all detect
 * the same tell must occupy exactly ONE slot here, with three `sources`.
 */

import { clampSeverity, isValidId } from '../../shared/types.js';
import type {
  CanonicalRule,
  CanonicalRuleRegistrySnapshot,
  RuleStatus,
  WatchPhrase,
} from '../types.js';
import { RULE_REGISTRY_SCHEMA_VERSION } from '../types.js';
import type { SourceReference } from '../provenance/types.js';

export interface RuleRegistryAddResult {
  readonly rule: CanonicalRule;
  /** True when the id already existed and sources/aliases were merged into it. */
  readonly merged: boolean;
}

export class CanonicalRuleRegistry {
  readonly #rules = new Map<string, CanonicalRule>();
  readonly #aliases = new Map<string, string>();
  readonly #upstreamIndex = new Map<string, string>();

  constructor(initial: readonly CanonicalRule[] = []) {
    for (const rule of initial) this.add(rule);
  }

  get size(): number {
    return this.#rules.size;
  }

  has(id: string): boolean {
    return this.#rules.has(id);
  }

  get(id: string): CanonicalRule | undefined {
    const direct = this.#rules.get(id);
    if (direct) return direct;
    const resolved = this.resolveAlias(id);
    return resolved ? this.#rules.get(resolved) : undefined;
  }

  /**
   * Register a rule.
   *
   * Adding an id that already exists is not an error: it is the merge path.
   * Sources and aliases are unioned so that provenance accumulates instead of
   * being overwritten.
   */
  add(rule: CanonicalRule): RuleRegistryAddResult {
    if (!isValidId(rule.id)) {
      throw new Error(
        `Canonical rule id must be dotted snake_case (got ${JSON.stringify(rule.id)})`,
      );
    }

    const existing = this.#rules.get(rule.id);
    if (existing) {
      const merged = this.#mergeInto(existing, rule);
      this.#indexRule(merged);
      return { rule: merged, merged: true };
    }

    const normalised: CanonicalRule = {
      ...rule,
      severity: clampSeverity(rule.severity),
      languages: dedupeStrings(rule.languages),
      aliases: dedupeStrings(rule.aliases),
      sources: [...rule.sources],
      status: rule.status ?? ('seed' satisfies RuleStatus),
    };

    this.#rules.set(normalised.id, normalised);
    this.#indexRule(normalised);
    return { rule: normalised, merged: false };
  }

  addAll(rules: readonly CanonicalRule[]): RuleRegistryAddResult[] {
    return rules.map((rule) => this.add(rule));
  }

  /**
   * Register an extra alias for an existing rule. Used by the alias layer when
   * an upstream spelling is discovered after import.
   */
  addAlias(alias: string, ruleId: string): void {
    if (!this.#rules.has(ruleId)) {
      throw new Error(`Cannot alias ${JSON.stringify(alias)} to unknown rule ${ruleId}`);
    }
    this.#aliases.set(alias, ruleId);
  }

  /** Resolve any alias to its canonical rule id, or `undefined`. */
  resolveAlias(alias: string): string | undefined {
    return this.#aliases.get(alias) ?? this.#rules.get(alias)?.id;
  }

  /** Look up the canonical rule that absorbed a given upstream's local rule id. */
  resolveUpstreamRule(upstream: string, upstreamRuleId: string): CanonicalRule | undefined {
    const id = this.#upstreamIndex.get(upstreamKey(upstream, upstreamRuleId));
    return id ? this.#rules.get(id) : undefined;
  }

  list(): CanonicalRule[] {
    return [...this.#rules.values()];
  }

  byCategory(): Map<string, CanonicalRule[]> {
    const out = new Map<string, CanonicalRule[]>();
    for (const rule of this.#rules.values()) {
      const bucket = out.get(rule.category);
      if (bucket) bucket.push(rule);
      else out.set(rule.category, [rule]);
    }
    return out;
  }

  byStatus(status: RuleStatus): CanonicalRule[] {
    return this.list().filter((rule) => (rule.status ?? 'seed') === status);
  }

  forLanguage(language: string): CanonicalRule[] {
    return this.list().filter(
      (rule) => rule.languages.includes(language) || rule.languages.includes('unknown'),
    );
  }

  /**
   * Every upstream key that contributed at least one rule, with rule counts.
   * This is the data behind "which upstream actually earns its place".
   */
  upstreamCoverage(): Map<string, number> {
    const out = new Map<string, number>();
    for (const rule of this.#rules.values()) {
      const seen = new Set<string>();
      for (const source of rule.sources) {
        if (seen.has(source.upstream)) continue;
        seen.add(source.upstream);
        out.set(source.upstream, (out.get(source.upstream) ?? 0) + 1);
      }
    }
    return out;
  }

  toSnapshot(generatedAt: string = new Date().toISOString()): CanonicalRuleRegistrySnapshot {
    return {
      schemaVersion: RULE_REGISTRY_SCHEMA_VERSION,
      generatedAt,
      rules: this.list(),
    };
  }

  static fromSnapshot(snapshot: CanonicalRuleRegistrySnapshot): CanonicalRuleRegistry {
    if (snapshot.schemaVersion !== RULE_REGISTRY_SCHEMA_VERSION) {
      throw new Error(
        `Unsupported rule registry schema ${snapshot.schemaVersion}; expected ${RULE_REGISTRY_SCHEMA_VERSION}`,
      );
    }
    return new CanonicalRuleRegistry(snapshot.rules);
  }

  #mergeInto(target: CanonicalRule, incoming: CanonicalRule): CanonicalRule {
    const sources = mergeSources(target.sources, incoming.sources);
    const watchPhrases = mergePhrases(
      target.watchPhrases ?? [],
      incoming.watchPhrases ?? [],
    );
    const originatedIn = dedupeStrings([
      ...(target.originatedIn ?? []),
      ...(incoming.originatedIn ?? []),
    ]);
    const merged: CanonicalRule = {
      ...target,
      languages: dedupeStrings([...target.languages, ...incoming.languages]),
      aliases: dedupeStrings([...target.aliases, ...incoming.aliases]),
      sources,
      severity: Math.max(target.severity, clampSeverity(incoming.severity)),
      // The strictest source wins: if either says the tell needs corroboration,
      // the merged rule needs it.
      ...(target.weakAlone || incoming.weakAlone ? { weakAlone: true } : {}),
      ...(watchPhrases.length > 0 ? { watchPhrases } : {}),
      ...(originatedIn.length > 0 ? { originatedIn } : {}),
      localChanges: [
        ...(target.localChanges ?? []),
        ...(incoming.localChanges ?? []).filter(
          (change) =>
            !(target.localChanges ?? []).some(
              (existing) =>
                existing.kind === change.kind && existing.description === change.description,
            ),
        ),
      ],
      tags: dedupeStrings([...(target.tags ?? []), ...(incoming.tags ?? [])]),
    };
    this.#rules.set(merged.id, merged);
    return merged;
  }

  #indexRule(rule: CanonicalRule): void {
    for (const alias of rule.aliases) {
      if (alias !== rule.id) this.#aliases.set(alias, rule.id);
    }
    for (const source of rule.sources) {
      if (!source.ruleId) continue;
      this.#upstreamIndex.set(upstreamKey(source.upstream, source.ruleId), rule.id);
    }
  }
}

export function upstreamKey(upstream: string, upstreamRuleId: string): string {
  return `${upstream}#${upstreamRuleId}`;
}

function dedupeStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((v) => v.length > 0))];
}

function mergePhrases(
  a: readonly WatchPhrase[],
  b: readonly WatchPhrase[],
): WatchPhrase[] {
  const seen = new Set(a.map((p) => `${p.kind}\u0000${p.text}`));
  const out: WatchPhrase[] = [...a];
  for (const phrase of b) {
    const key = `${phrase.kind}\u0000${phrase.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(phrase);
  }
  return out;
}

function mergeSources(
  a: readonly SourceReference[],
  b: readonly SourceReference[],
): SourceReference[] {
  const out: SourceReference[] = [...a];
  for (const source of b) {
    const duplicate = out.some(
      (existing) =>
        existing.upstream === source.upstream &&
        existing.ruleId === source.ruleId &&
        existing.locator === source.locator,
    );
    if (!duplicate) out.push(source);
  }
  return out;
}
