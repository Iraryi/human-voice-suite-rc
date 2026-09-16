/**
 * Phase 1 seed rules.
 *
 * These are NOT the finished canonical registry. They are a small, deliberately
 * chosen set that exercises the thing the whole project hinges on: several
 * upstreams detecting the same tell must collapse to ONE canonical rule with
 * several `sources`.
 *
 * Every entry here uses real cross-repository correspondences established by
 * the Phase 1 inventory. The pattern numbers and Chinese names are verbatim
 * from the upstreams. Phase 2 replaces this seed with adapter extraction over
 * the full corpus; until then these entries stay `status: 'seed'` so nothing
 * downstream can mistake them for a reviewed rule set.
 *
 * The lineage is the point. `blader/humanizer` has 25 numbered patterns at
 * v3.0.0. `holygeek00/humanizer-zh-cn` is a fork of it at the v2.9.1 baseline
 * with 33 patterns. `op7418/Humanizer-zh` is a translation of v2.1.0 with 24.
 * `ai-zixun/humanizer-zh` is separately inspired by it and has its own 13.
 * Counting those as four independent discoveries of "avoid inflated
 * significance" would be exactly the error the project brief forbids.
 */

import type { RuleCandidate } from '../types.js';
import { CanonicalRuleRegistry } from './registry.js';
import { crossUpstreamMerges, dedupeRuleCandidates } from '../dedupe/dedupe.js';
import type { DedupeResult } from '../dedupe/dedupe.js';
import { LOCAL_UPSTREAM } from '../provenance/types.js';
import { ASSISTANT_SMELLS } from '../../behavior/types.js';

interface SeedClaim {
  readonly signature: string;
  readonly category: string;
  readonly languages: readonly string[];
  readonly description: string;
  readonly rewriteGuidance: string;
  readonly severity: number;
  readonly tags?: readonly string[];
  readonly detection?: string;
  readonly claims: ReadonlyArray<{
    readonly upstream: string;
    readonly upstreamRuleId: string;
    readonly locator: string;
    readonly quote?: string;
    readonly modified?: boolean;
    readonly note?: string;
  }>;
}

/**
 * The seed claim set. Each entry lists every upstream that states the same
 * tell, with the verbatim identifier that upstream uses.
 */
const SEED_CLAIMS: readonly SeedClaim[] = [
  {
    signature: 'structural.inflated_significance',
    category: 'structural',
    languages: ['en', 'zh'],
    description: 'Claims that an ordinary event carries larger meaning, legacy or historical weight.',
    rewriteGuidance:
      'State what happened and stop. Remove the significance clause unless the source text supplied real evidence for it.',
    severity: 4,
    tags: ['structural', 'inflation'],
    claims: [
      {
        upstream: 'blader/humanizer',
        upstreamRuleId: '13',
        locator: 'SKILL.md (v3.0.0) pattern 13 "Inflated significance"',
        quote: 'Inflated significance',
      },
      {
        upstream: 'humanizer-zh-cn',
        upstreamRuleId: '1',
        locator: 'SKILL.md pattern 1',
        quote: '空泛拔高意义',
      },
      {
        upstream: 'ai-zixun/humanizer-zh',
        upstreamRuleId: '3',
        locator: 'references/patterns.md pattern 3',
        quote: '空泛大词',
        modified: true,
        note: 'The Chinese rule is broader than the English one; it also covers abstract nouns used as filler.',
      },
      {
        upstream: 'op7418/Humanizer-zh',
        upstreamRuleId: '1',
        locator: 'SKILL.md pattern 1 (research only, excluded from import)',
        quote: '过度强调意义、遗产和更广泛的趋势',
        note: 'Corroborates the lineage. Not importable: the repository does not retain the upstream copyright notice.',
      },
    ],
  },
  {
    signature: 'structural.negation_contrast',
    category: 'structural',
    languages: ['en', 'zh'],
    description:
      'The "not X but Y" construction used as a default rhetorical frame rather than for a real contrast.',
    rewriteGuidance:
      'Say the affirmative directly. Keep at most one such contrast in a long piece, and only where the contrast is genuinely contested.',
    severity: 3,
    tags: ['structural', 'rhetoric'],
    claims: [
      {
        upstream: 'blader/humanizer',
        upstreamRuleId: '1',
        locator: 'SKILL.md (v3.0.0) pattern 1 "Not X but Y"',
        quote: 'Not X but Y',
      },
      {
        upstream: 'humanizer-zh-cn',
        upstreamRuleId: '9',
        locator: 'SKILL.md pattern 9',
        quote: '“不仅……更……”和先否后肯滥用',
      },
      {
        upstream: 'ai-zixun/humanizer-zh',
        upstreamRuleId: '1',
        locator: 'references/patterns.md pattern 1',
        quote: '机械对照句',
      },
      {
        upstream: 'op7418/Humanizer-zh',
        upstreamRuleId: '9',
        locator: 'SKILL.md pattern 9 (research only)',
        quote: '否定式排比',
      },
    ],
  },
  {
    signature: 'rhythm.forced_triad',
    category: 'rhythm',
    languages: ['en', 'zh'],
    description: 'Groups of three produced by rule rather than by content, including parallel triads.',
    rewriteGuidance:
      'Break the group. Keep the one item that carries information and drop the padding, or vary the count.',
    severity: 3,
    tags: ['rhythm', 'structural'],
    detection: 'Count parallel items in a sentence or list. Flag groups of exactly three that share a frame.',
    claims: [
      {
        upstream: 'blader/humanizer',
        upstreamRuleId: '6',
        locator: 'SKILL.md (v3.0.0) pattern 6 "Forced triads"',
        quote: 'Forced triads',
      },
      {
        upstream: 'humanizer-zh-cn',
        upstreamRuleId: '10',
        locator: 'SKILL.md pattern 10',
        quote: '强凑三点和排比',
      },
      {
        upstream: 'ai-zixun/humanizer-zh',
        upstreamRuleId: '5',
        locator: 'references/patterns.md pattern 5',
        quote: '列表和排比成瘾',
      },
      {
        upstream: 'op7418/Humanizer-zh',
        upstreamRuleId: '10',
        locator: 'SKILL.md pattern 10 (research only)',
        quote: '三段式法则过度使用',
      },
    ],
  },
  {
    signature: 'rhythm.dash_overuse',
    category: 'rhythm',
    languages: ['en', 'zh'],
    description: 'Dashes used as the universal connector, including stacked parentheses and asides.',
    rewriteGuidance:
      'Replace most dashes with a full stop, a comma or a colon. Keep one only where nothing else works.',
    severity: 2,
    tags: ['rhythm', 'punctuation', 'weak-alone'],
    detection:
      'Dash density per 1000 characters. This rule is weak on its own; blader marks it "weak alone" and it must not fire without corroboration.',
    claims: [
      {
        upstream: 'blader/humanizer',
        upstreamRuleId: '8',
        locator: 'SKILL.md (v3.0.0) pattern 8 "Dashes as the universal connector" (marked weak alone)',
        quote: 'Dashes as the universal connector',
        modified: true,
        note: 'Imported together with blader\'s "weak alone" suppression policy, so it cannot fire in isolation.',
      },
      {
        upstream: 'humanizer-zh-cn',
        upstreamRuleId: '14',
        locator: 'SKILL.md pattern 14',
        quote: '破折号、括号和补充说明过密',
      },
      {
        upstream: 'ai-zixun/humanizer-zh',
        upstreamRuleId: '6',
        locator: 'references/patterns.md pattern 6',
        quote: '冒号、破折号和引号',
      },
      {
        upstream: 'op7418/Humanizer-zh',
        upstreamRuleId: '13',
        locator: 'SKILL.md pattern 13 (research only)',
        quote: '破折号过度使用',
      },
    ],
  },
  {
    signature: 'formatting.curly_quotes',
    category: 'formatting',
    languages: ['en', 'zh'],
    description: 'Curly quotation marks and apostrophes surviving from a chat interface into the text.',
    rewriteGuidance: 'Normalise quotation marks to the convention the document already uses.',
    severity: 2,
    tags: ['formatting', 'punctuation', 'weak-alone'],
    detection: 'Presence of U+2018/U+2019/U+201C/U+201D. Weak alone; corroborate before acting.',
    claims: [
      {
        upstream: 'blader/humanizer',
        upstreamRuleId: '21',
        locator: 'SKILL.md (v3.0.0) pattern 21 "Curly quotation marks" (marked weak alone)',
        quote: 'Curly quotation marks',
      },
      {
        upstream: 'op7418/Humanizer-zh',
        upstreamRuleId: '18',
        locator: 'SKILL.md pattern 18 (research only)',
        quote: '弯引号',
      },
    ],
  },
  {
    signature: 'assistant.chatbot_residue',
    category: 'assistant',
    languages: ['en', 'zh'],
    description:
      'Chat residue that survived into the output: collaborative asides, knowledge-cutoff disclaimers and guesses.',
    rewriteGuidance:
      'Delete the residue. No disclaimers about knowledge limits, no offers to help, no talk about the draft.',
    severity: 4,
    tags: ['chat', 'assistant'],
    claims: [
      {
        upstream: 'blader/humanizer',
        upstreamRuleId: '22',
        locator: 'SKILL.md (v3.0.0) pattern 22 "Chatbot residue"',
        quote: 'Chatbot residue',
      },
      {
        upstream: 'humanizer-zh-cn',
        upstreamRuleId: '20',
        locator: 'SKILL.md pattern 20',
        quote: '聊天机器人残留',
      },
      {
        upstream: 'op7418/Humanizer-zh',
        upstreamRuleId: '19',
        locator: 'SKILL.md pattern 19 (research only)',
        quote: '协作交流痕迹',
      },
    ],
  },
  {
    signature: 'lexical.vague_attribution',
    category: 'lexical',
    languages: ['en', 'zh'],
    description: 'Attribution to unnamed authorities: "experts say", "据悉", "studies show".',
    rewriteGuidance: 'Name the source or drop the claim. Never keep an attribution to nobody.',
    severity: 3,
    tags: ['lexical', 'evidence'],
    claims: [
      {
        upstream: 'blader/humanizer',
        upstreamRuleId: '14',
        locator: 'SKILL.md (v3.0.0) pattern 14 "Vague connection or association"',
        quote: 'Vague connection or association',
        modified: true,
        note: 'Scope narrowed to attribution specifically; blader also covers vague associative links.',
      },
      {
        upstream: 'humanizer-zh-cn',
        upstreamRuleId: '5',
        locator: 'SKILL.md pattern 5',
        quote: '模糊归因和“据悉”',
      },
      {
        upstream: 'op7418/Humanizer-zh',
        upstreamRuleId: '5',
        locator: 'SKILL.md pattern 5 (research only)',
        quote: '模糊归因和含糊措辞',
      },
    ],
  },
  {
    signature: 'lexical.noteworthy_filler',
    category: 'lexical',
    languages: ['zh'],
    description: 'Chinese filler openers that announce significance instead of stating it, led by 值得注意的是.',
    rewriteGuidance:
      'Delete the opener and start with the fact. 值得注意的是数据显示 becomes 数据显示.',
    severity: 2,
    tags: ['lexical', 'chinese'],
    claims: [
      {
        upstream: 'ai-zixun/humanizer-zh',
        upstreamRuleId: 'noteworthy-filler',
        locator: 'references/patterns.md:46 and SKILL.md:74',
        quote: '值得注意的是',
      },
      {
        upstream: 'humanizer-zh-cn',
        upstreamRuleId: 'noteworthy-filler',
        locator: 'SKILL.md:267',
        quote: '值得注意的是',
      },
      {
        upstream: 'op7418/Humanizer-zh',
        upstreamRuleId: 'noteworthy-filler',
        locator: 'SKILL.md:378 (research only)',
        quote: '值得注意的是',
        note: 'Third independent occurrence of the same phrase. Corroborates the shared lineage; not importable.',
      },
    ],
  },
  {
    signature: 'lexical.throat_clearing',
    category: 'lexical',
    languages: ['en'],
    description: 'Throat-clearing openers and filler phrases that delay the point.',
    rewriteGuidance: 'Cut the opener and begin at the point.',
    severity: 3,
    tags: ['lexical', 'english'],
    claims: [
      {
        upstream: 'judetelan/ai-humanizer',
        upstreamRuleId: 'throat-clearing',
        locator: 'scripts/registry/rules.mjs (throat-clearing family)',
        quote: 'throat-clearing',
      },
      {
        upstream: 'hardikpandya/stop-slop',
        upstreamRuleId: 'throat-clearing',
        locator: 'references/phrases.md category "Throat-Clearing" (15 entries)',
        quote: 'Throat-Clearing',
        note: 'Origin of the category. ai-humanizer absorbed this list verbatim and credits stop-slop. It is recorded here so the pair is never counted as two discoveries.',
      },
    ],
  },
];

/** Convert the seed claims into dedupe input. */
export function seedRuleCandidates(): RuleCandidate[] {
  const candidates: RuleCandidate[] = [];

  for (const seed of SEED_CLAIMS) {
    for (const claim of seed.claims) {
      const isResearchOnly = claim.note?.includes('Not importable') === true;
      // Research-only sources are recorded for provenance but must not supply
      // the rule's wording or guidance.
      const contributesContent = !isResearchOnly;
      candidates.push({
        upstreamRuleId: claim.upstreamRuleId,
        upstream: claim.upstream,
        category: seed.category,
        languages: [...seed.languages],
        description: seed.description,
        ...(seed.detection && contributesContent ? { detection: seed.detection } : {}),
        ...(contributesContent ? { rewriteGuidance: seed.rewriteGuidance } : {}),
        severity: contributesContent ? seed.severity : 1,
        signature: seed.signature,
        locator: claim.locator,
        ...(claim.quote ? { quote: claim.quote } : {}),
        ...(seed.tags ? { tags: [...seed.tags] } : {}),
      });
    }
  }

  // Local-only capability: the assistant smell taxonomy is ours, not inherited.
  for (const smell of ASSISTANT_SMELLS) {
    candidates.push({
      upstreamRuleId: smell.id,
      upstream: LOCAL_UPSTREAM,
      category: 'chat',
      languages: [...smell.languages],
      description: smell.description,
      detection: smell.detectionHint,
      rewriteGuidance: smell.rewriteGuidance,
      severity: smell.severity,
      signature: smell.id,
      locator: 'src/behavior/assistant-smell/taxonomy.ts',
      tags: ['chat', 'local'],
    });
  }

  return candidates;
}

export interface SeedRegistry {
  readonly registry: CanonicalRuleRegistry;
  readonly dedupe: DedupeResult;
}

/**
 * Build the Phase 1 registry from the seed claims.
 *
 * `severityPolicy: 'median'` is used here on purpose: with a lineage this
 * tangled, one upstream's stricter severity should not set the tone for all of
 * them.
 */
export function buildSeedRegistry(): SeedRegistry {
  const dedupe = dedupeRuleCandidates(seedRuleCandidates(), {
    severityPolicy: 'median',
    status: 'seed',
  });
  const registry = new CanonicalRuleRegistry(dedupe.rules);
  return { registry, dedupe };
}

/** Seed rules that collapsed a multi-repository lineage. */
export function seedLineageCollapses(): ReturnType<typeof crossUpstreamMerges> {
  return crossUpstreamMerges(buildSeedRegistry().dedupe);
}
