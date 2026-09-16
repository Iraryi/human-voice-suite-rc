/**
 * Phrase-level ownership.
 *
 * Signature-level dedupe stops one *tell* being counted twice. It does not stop
 * one *phrase* being counted twice, and 72 phrases in this corpus are claimed by
 * more than one rule. These tests pin the mechanism that fixes that, and the
 * ways the first attempts at it were wrong.
 */

import { describe, expect, it } from 'vitest';

import {
  buildPhraseIndex,
  matchablePhraseCount,
  normalizePhraseKey,
  ownedPhrases,
  ownsPhrase,
  phraseIndexStats,
  validateOwnershipOverrides,
} from '../src/rules/dedupe/phrases.js';
import {
  PHRASE_OWNER_OVERRIDES,
  UNMATCHED_RULES,
  unmatchedRuleIds,
} from '../src/rules/aliases/phrase-ownership.js';
import { buildRegistryFromExtractions } from '../src/rules/canonical/load.js';
import { createDefaultDetectors } from '../src/detector/registry.js';
import { scan } from '../src/detector/scan.js';
import { buildPhrasePatterns } from '../src/detector/lexical/rule-driven.js';
import { renderOwnershipReport } from '../src/rules/dedupe/ownership-report.js';
import type { CanonicalRule, WatchPhrase } from '../src/rules/types.js';

// Built once at module scope: vitest allows top-level await, and the describe
// bodies below cannot each await.
const BUILD = await buildRegistryFromExtractions();
const INDEX = buildPhraseIndex(BUILD.registry.list());

function phrase(text: string, kind: WatchPhrase['kind'] = 'literal'): WatchPhrase {
  return { text, kind, match: text.toLowerCase() };
}

function rule(overrides: Partial<CanonicalRule> & { id: string }): CanonicalRule {
  return {
    category: overrides.id.split('.')[0] ?? 'lexical',
    languages: ['en'],
    description: 'a tell',
    rewriteGuidance: 'fix it',
    severity: 3,
    sources: [{ upstream: 'test/upstream', ruleId: overrides.id }],
    aliases: [],
    ...overrides,
  };
}

describe('normalizePhraseKey', () => {
  it('merges two spellings of one phrase', () => {
    // The corpus writes the same tell as `Great question!` in one upstream and
    // `great question` in another. Treating those as different phrases let the
    // wrong rule keep one of them.
    expect(normalizePhraseKey('Great question!')).toBe(normalizePhraseKey('great question'));
    expect(normalizePhraseKey('  I hope this helps.  ')).toBe('i hope this helps');
  });

  it('keeps interior punctuation, because it distinguishes constructions', () => {
    expect(normalizePhraseKey('not X but Y')).not.toBe(normalizePhraseKey('not X, but Y'));
  });

  it('handles Chinese sentence punctuation', () => {
    expect(normalizePhraseKey('\u503c\u5f97\u6ce8\u610f\u7684\u662f\u3002')).toBe(
      '\u503c\u5f97\u6ce8\u610f\u7684\u662f',
    );
  });
});

describe('the ownership default', () => {
  it('gives a contested phrase to the narrower rule', () => {
    const wide = rule({
      id: 'lexical.wide',
      watchPhrases: [
        phrase('alpha'),
        phrase('beta'),
        phrase('shared'),
        phrase('gamma'),
        phrase('delta'),
      ],
    });
    const narrow = rule({ id: 'lexical.narrow', watchPhrases: [phrase('shared')] });
    const index = buildPhraseIndex([wide, narrow]);
    expect(index.owners.get('shared')).toBe('lexical.narrow');
    expect(index.contested).toHaveLength(1);
    expect(index.contested[0]!.reason).toBe('fewest-phrases');
  });

  it('breaks a phrase-count tie on severity, then on the id', () => {
    const a = rule({ id: 'lexical.aaa', severity: 2, watchPhrases: [phrase('shared')] });
    const b = rule({ id: 'lexical.bbb', severity: 4, watchPhrases: [phrase('shared')] });
    expect(buildPhraseIndex([a, b]).contested[0]!.reason).toBe('severity');
    expect(buildPhraseIndex([a, b]).owners.get('shared')).toBe('lexical.bbb');

    const c = rule({ id: 'lexical.aaa', severity: 3, watchPhrases: [phrase('shared')] });
    const d = rule({ id: 'lexical.bbb', severity: 3, watchPhrases: [phrase('shared')] });
    expect(buildPhraseIndex([c, d]).contested[0]!.reason).toBe('alphabetical');
    expect(buildPhraseIndex([c, d]).owners.get('shared')).toBe('lexical.aaa');
  });

  it('does not depend on the order the rules arrive in', () => {
    const wide = rule({
      id: 'lexical.wide',
      watchPhrases: [phrase('a'), phrase('b'), phrase('shared')],
    });
    const narrow = rule({ id: 'lexical.narrow', watchPhrases: [phrase('shared')] });
    expect(buildPhraseIndex([wide, narrow]).owners.get('shared')).toBe('lexical.narrow');
    expect(buildPhraseIndex([narrow, wide]).owners.get('shared')).toBe('lexical.narrow');
  });

  it('leaves a sole claimant alone and does not report it', () => {
    const index = buildPhraseIndex([
      rule({ id: 'lexical.solo', watchPhrases: [phrase('only here')] }),
    ]);
    expect(index.owners.get('only here')).toBe('lexical.solo');
    expect(index.contested).toEqual([]);
  });

  it('drops a duplicate inside one rule and counts it', () => {
    const index = buildPhraseIndex([
      rule({
        id: 'lexical.dupe',
        watchPhrases: [phrase('delve'), phrase('Delve.'), phrase('deep dive')],
      }),
    ]);
    expect(index.selfDuplicates).toBe(1);
    expect(index.distinctCount).toBe(2);
  });

  it('ignores reference phrases, which nothing matches', () => {
    const index = buildPhraseIndex([
      rule({ id: 'lexical.a', watchPhrases: [phrase('key', 'reference')] }),
    ]);
    expect(index.owners.size).toBe(0);
  });

  it('records an override naming a rule that does not claim the phrase, rather than throwing', () => {
    // The index stays usable on any rule set, including the small synthetic ones
    // tests build, so staleness is recorded here and turned into a failure by
    // `validateOwnershipOverrides` against a real registry.
    const index = buildPhraseIndex(
      [rule({ id: 'lexical.a', watchPhrases: [phrase('shared')] })],
      { overrides: { shared: 'lexical.nobody' }, excludeRules: new Set<string>() },
    );
    expect(index.staleOverrides).toHaveLength(1);
    expect(index.staleOverrides[0]).toContain('lexical.nobody');
    // The stale entry does not take effect.
    expect(index.owners.get('shared')).toBe('lexical.a');
  });

  it('reports a stale or unnecessary override through the validator', () => {
    const rules = [
      rule({ id: 'lexical.a', watchPhrases: [phrase('shared')] }),
      rule({ id: 'lexical.b', watchPhrases: [phrase('shared')] }),
    ];
    // Equal phrase counts and equal severity, so the id breaks the tie and
    // `lexical.a` already wins. An override to it therefore does nothing.
    expect(validateOwnershipOverrides(rules, { shared: 'lexical.a' })).toEqual([
      expect.stringContaining('Unnecessary'),
    ]);
    // Overruling the default is what an override is for.
    expect(validateOwnershipOverrides(rules, { shared: 'lexical.b' })).toEqual([]);
    expect(validateOwnershipOverrides(rules, { shared: 'lexical.nobody' })).toEqual([
      expect.stringContaining('Stale'),
    ]);
  });

  it('removes an excluded rule from ownership entirely', () => {
    const kept = rule({ id: 'lexical.kept', watchPhrases: [phrase('shared')] });
    const dropped = rule({ id: 'lexical.dropped', watchPhrases: [phrase('shared')] });
    const index = buildPhraseIndex([kept, dropped], {
      overrides: {},
      excludeRules: new Set(['lexical.dropped']),
    });
    expect(index.owners.get('shared')).toBe('lexical.kept');
    // With the second rule gone the phrase is uncontested, so nothing to report.
    expect(index.contested).toEqual([]);
    expect(index.excludedRules).toEqual(['lexical.dropped']);
  });
});

describe('ownership applied to the real registry', () => {
  it('finds a substantial number of contested phrases', () => {
    // The problem is not hypothetical: this is the number that made phrase-level
    // dedupe worth building.
    expect(INDEX.contested.length).toBeGreaterThan(50);
  });

  it('avoids a large number of duplicate findings', () => {
    expect(phraseIndexStats(INDEX).findingsAvoided).toBeGreaterThan(60);
  });

  it('lets a rule match only the phrases it owns', () => {
    const contestedRule = BUILD.registry
      .list()
      .find((r) => (r.watchPhrases ?? []).some((p) => !ownsPhrase(INDEX, p, r.id)));
    expect(contestedRule).toBeDefined();
    const owned = ownedPhrases(INDEX, contestedRule!);
    expect(owned.length).toBeLessThan(contestedRule!.watchPhrases!.length);
    for (const p of owned) expect(ownsPhrase(INDEX, p, contestedRule!.id)).toBe(true);
  });

  it('never lets two rules both own one phrase', () => {
    const owners = new Map<string, string>();
    let clashes = 0;
    for (const r of BUILD.registry.list()) {
      for (const p of ownedPhrases(INDEX, r)) {
        const key = normalizePhraseKey(p.text);
        const previous = owners.get(key);
        if (previous !== undefined && previous !== r.id) clashes += 1;
        owners.set(key, r.id);
      }
    }
    expect(clashes).toBe(0);
  });

  it('excludes the rules whose upstream gates them off', () => {
    expect(INDEX.excludedRules).toEqual(unmatchedRuleIds());
    for (const ruleId of INDEX.excludedRules) {
      expect(BUILD.registry.get(ruleId), ruleId).toBeDefined();
      expect([...INDEX.owners.values()]).not.toContain(ruleId);
    }
  });

  it('records a reason for every excluded rule', () => {
    for (const ruleId of unmatchedRuleIds()) {
      expect(UNMATCHED_RULES[ruleId]!.length, ruleId).toBeGreaterThan(50);
    }
  });

  it('resolves every override to a phrase that is actually contested', () => {
    const contested = new Set(INDEX.contested.map((c) => normalizePhraseKey(c.phrase)));
    for (const key of Object.keys(PHRASE_OWNER_OVERRIDES)) {
      expect(contested, key).toContain(key);
    }
  });

  it('marks every override decision as an override', () => {
    const overridden = INDEX.contested.filter((c) => c.reason === 'override');
    expect(overridden.length).toBe(Object.keys(PHRASE_OWNER_OVERRIDES).length);
    for (const entry of overridden) {
      expect(PHRASE_OWNER_OVERRIDES[normalizePhraseKey(entry.phrase)]).toBe(entry.owner);
    }
  });

  it('does not let one text be charged twice for one phrase', async () => {
    const detectors = createDefaultDetectors();

    // "I hope this helps" is claimed by assistant.chatbot_residue and by
    // lexical.provider_tic. Before ownership it produced two findings.
    const help = await scan('I hope this helps.', {
      registry: BUILD.registry,
      detectors,
      disableSuppression: true,
    });
    const helpRules = help.canonicalFindings
      .map((f) => f.canonicalRuleId)
      .filter((id): id is string => id !== undefined);
    expect(helpRules).toContain('assistant.chatbot_residue');
    // The lexical layer reports the phrase once. Anything else on the same
    // evidence is a behaviour-layer rule naming a different diagnosis — the
    // service closing is both prose residue and an offer of help — which is not
    // the same failure as charging one phrase twice for one rule.
    expect(helpRules.filter((id) => id === 'assistant.chatbot_residue')).toHaveLength(1);
    for (const id of helpRules) {
      if (id === 'assistant.chatbot_residue') continue;
      expect(id.startsWith('chat.'), id).toBe(true);
    }

    // "great question" is claimed by the same pair plus structural.staged_runup.
    const question = await scan('Great question!', {
      registry: BUILD.registry,
      detectors,
      disableSuppression: true,
    });
    expect(question.canonicalFindings.map((f) => f.canonicalRuleId)).toContain(
      'assistant.chatbot_residue',
    );

    // 值得注意的是 is claimed by three rules, and owns exactly one of them.
    const chinese = await scan(
      '\u503c\u5f97\u6ce8\u610f\u7684\u662f\uff0c\u6570\u636e\u663e\u793a\u53d8\u5316\u4e86\u3002',
      { registry: BUILD.registry, detectors, disableSuppression: true },
    );
    const chineseRules = chinese.canonicalFindings.map((f) => f.canonicalRuleId);
    expect(chineseRules).toContain('lexical.translationese_connective');
    expect(chineseRules.filter((id) => id === 'lexical.translationese_connective')).toHaveLength(1);
    expect(chineseRules).not.toContain('structural.enumeration_padding');
  });
});

describe('the compiled pattern set', () => {
  it('compiles no pattern for an excluded rule', () => {
    const patterns = buildPhrasePatterns(BUILD.registry.list(), 'en', INDEX);
    for (const ruleId of unmatchedRuleIds()) {
      expect(patterns.some((p) => p.ruleId === ruleId), ruleId).toBe(false);
    }
  });

  it('makes every pattern match the phrase it was built from', () => {
    // A phrase ending in punctuation used to compile to `\b(?:Great question!)\b`,
    // which can never match, because there is no word boundary after `!`. Eleven
    // phrases were dead, including the most certain tells in the corpus.
    for (const language of ['en', 'zh']) {
      const patterns = buildPhrasePatterns(BUILD.registry.list(), language, INDEX);
      expect(patterns.length, language).toBeGreaterThan(100);
      for (const pattern of patterns) {
        const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
        expect(
          regex.test(pattern.phrase.text),
          `${language} ${pattern.ruleId} ${pattern.phrase.text}`,
        ).toBe(true);
      }
    }
  });

  it('compiles fewer patterns than the raw phrase count, because of ownership', () => {
    const rules = BUILD.registry.list();
    const raw = rules.reduce((sum, r) => sum + (r.watchPhrases?.length ?? 0), 0);
    expect(buildPhrasePatterns(rules, 'en', INDEX).length).toBeLessThan(raw);
  });
});

describe('matchablePhraseCount', () => {
  it('counts only what a detector could use', () => {
    expect(
      matchablePhraseCount(
        rule({
          id: 'lexical.a',
          watchPhrases: [phrase('one'), phrase('two', 'template'), phrase('three', 'reference')],
        }),
      ),
    ).toBe(2);
  });
});

describe('the ownership report', () => {
  it('renders a table of every contested phrase', () => {
    const markdown = renderOwnershipReport(INDEX);
    expect(markdown).toContain('# PHRASE_OWNERSHIP');
    expect(markdown).toContain('Every contested phrase');
    for (const entry of INDEX.contested.slice(0, 5)) {
      expect(markdown).toContain(entry.owner);
    }
  });

  it('states the counts a reader needs to judge it', () => {
    const markdown = renderOwnershipReport(INDEX);
    expect(markdown).toMatch(/Distinct matchable phrases: \*\*\d+\*\*/);
    expect(markdown).toMatch(/Findings avoided by ownership: \*\*\d+\*\*/);
  });
});
