/**
 * The rewrite contract.
 *
 * `human_voice_prepare` does NOT call another language model. It produces this
 * contract and hands it to the DSH agent that is already running, which then
 * performs the rewrite. That constraint is deliberate: the suite never becomes
 * a model proxy, and the human keeps one model in the loop.
 */

import type { Language, TextMode } from '../shared/types.js';

export const REWRITE_CONTRACT_SCHEMA_VERSION = '1.0.0';

export interface ContractRuleDirective {
  /** Canonical rule id the rewrite must satisfy. */
  readonly ruleId: string;
  readonly category: string;
  readonly severity: number;
  /** What must change. */
  readonly guidance: string;
  /** Findings that triggered this directive, with source attribution. */
  readonly triggeredBy: readonly ContractFindingRef[];
}

export interface ContractFindingRef {
  readonly detectorId: string;
  readonly upstream: string;
  readonly canonicalRuleId?: string;
  readonly message: string;
  readonly severity: number;
}

/**
 * Content that must survive the rewrite byte-for-byte or fact-for-fact.
 * Section 14 of the brief calls this Protected Content Validation.
 */
export interface PreserveDirective {
  readonly kind:
    | 'code-block'
    | 'inline-code'
    | 'url'
    | 'path'
    | 'identifier'
    | 'number'
    | 'date'
    | 'quotation'
    | 'proper-noun'
    | 'citation'
    | 'legal-phrase';
  readonly value: string;
  readonly occurrences: number;
  /** True when the rewrite must reproduce it exactly, not merely preserve the meaning. */
  readonly exact: boolean;
}

export interface ValidationRequirement {
  readonly id: string;
  readonly description: string;
  /** Which of the four scores this requirement feeds. */
  readonly score:
    | 'antiAIScore'
    | 'voiceScore'
    | 'behaviorScore'
    | 'preservationScore';
  /** Minimum acceptable value, when the requirement is numeric. */
  readonly minimum?: number;
}

/**
 * The full payload handed to the executing agent.
 *
 * Note there is deliberately no blended "human percentage" anywhere in this
 * structure. Section 19 of the brief forbids it.
 */
export interface HumanVoiceContract {
  readonly schemaVersion: string;
  readonly contractId: string;
  readonly createdAt: string;

  readonly language: Language;
  readonly mode: TextMode;
  /** Which strategy produced this contract. */
  readonly strategyId: string;
  /** One-line statement of what a good result looks like. */
  readonly objective: string;

  readonly voiceProfileId?: string;
  readonly behaviorBaselineId?: string;

  readonly rules: readonly ContractRuleDirective[];
  readonly preserve: readonly PreserveDirective[];
  /** Hard prohibitions, stated as imperative text for the executing agent. */
  readonly forbidden: readonly string[];
  /** Positive instructions, e.g. behaviour the reply should exhibit. */
  readonly required: readonly string[];

  readonly budget: {
    /** Section 18 allows at most one retry. */
    readonly maxRewritePasses: number;
    readonly maxValidationRetries: number;
  };

  readonly validation: readonly ValidationRequirement[];
}

export interface ContractBuildInput {
  readonly language: Language;
  readonly mode: TextMode;
  readonly strategyId: string;
  readonly objective: string;
  readonly voiceProfileId?: string;
  readonly behaviorBaselineId?: string;
  readonly rules?: readonly ContractRuleDirective[];
  readonly preserve?: readonly PreserveDirective[];
  readonly forbidden?: readonly string[];
  readonly required?: readonly string[];
  readonly validation?: readonly ValidationRequirement[];
}
