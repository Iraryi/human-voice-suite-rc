/**
 * The capability runtime.
 *
 * One object that composes the layers into the six capabilities the DSH tool
 * surface exposes: scan, prepare, validate, chat, voice, profile.
 *
 * Loading the registry is the expensive part — it reads seven committed
 * extraction files and runs deduplication — so a toolkit is built once and
 * reused. `createToolkit()` is async for that reason and everything it returns
 * is synchronous afterwards.
 */

import { buildRegistryFromExtractions } from '../../rules/canonical/load.js';
import type { RegistryBuild } from '../../rules/canonical/load.js';
import { CanonicalRuleRegistry } from '../../rules/canonical/registry.js';
import { createDefaultDetectors } from '../../detector/registry.js';
import { scan } from '../../detector/scan.js';
import type { ScanOptions, ScanResult } from '../../detector/scan.js';
import type { DetectorFamily } from '../../detector/types.js';
import { inferMode, selectStrategy } from '../../rewrite/strategies/strategy.js';
import type { Strategy } from '../../rewrite/strategies/strategy.js';
import { buildContract } from '../../rewrite/contract.js';
import { buildPromptPayload } from '../prompt/index.js';
import type { HumanVoiceContract } from '../../rewrite/types.js';
import {
  checkPreservation,
  extractProtectedContent,
} from '../../validation/protected-content/extract.js';
import type { PreservationCheck } from '../../validation/protected-content/extract.js';
import { assertNoBlendedScore } from '../../validation/types.js';
import type { ScoreName, ValidationIssue, VoiceScoreSet } from '../../validation/types.js';
import { assessBehavior, behaviorFindings } from '../../validation/behavior/index.js';
import { validateVoice } from '../../validation/voice/index.js';
import { detectLanguage, computeTextStats } from '../../shared/text.js';
import type { Language, TextMode } from '../../shared/types.js';
import type { VoiceProfile } from '../../voice/types.js';
import type { ConversationContext } from '../../behavior/types.js';
import { resolveProjectRoot } from '../../upstream/manifest.js';

export interface ScanRequest {
  readonly text: string;
  readonly language?: Language;
  readonly mode?: TextMode;
  readonly maxFindings?: number;
  readonly voiceProfile?: VoiceProfile;
  readonly disableSuppression?: boolean;
  /** The conversation the text sits in, so behaviour can be judged. */
  readonly conversation?: ConversationContext;
  /** Run only these detector families. How ablation switches a layer off. */
  readonly families?: readonly DetectorFamily[];
}

export interface PrepareRequest extends ScanRequest {
  readonly objective?: string;
  readonly profileId?: string;
}

export interface ValidateRequest {
  readonly original: string;
  readonly rewritten: string;
  readonly language?: Language;
  readonly mode?: TextMode;
  readonly voiceProfile?: VoiceProfile;
  /** The conversation the rewritten turn belongs to, for behaviour judgement. */
  readonly conversation?: ConversationContext;
}

export interface PrepareResult {
  readonly contract: HumanVoiceContract;
  /** The instruction block handed to the executing agent. */
  readonly rendered: string;
  /** The preamble for this mode and strategy, without the contract body. */
  readonly preamble: string;
  readonly strategy: Strategy;
  readonly scan: ScanResult;
}

export interface ValidateResult {
  readonly scores: VoiceScoreSet;
  readonly issues: readonly ValidationIssue[];
  readonly preservation: PreservationCheck;
  readonly rescanned: ScanResult;
  /** Section 18 permits one retry. This is whether it is worth spending. */
  readonly retryRecommended: boolean;
  readonly summary: string;
  /** How the rewrite changed the behaviour, when behaviour could be judged. */
  readonly behaviorDelta?: number;
  /** How the rewrite changed the distance to the voice, when a profile was given. */
  readonly voiceDelta?: number;
}

export interface ToolkitOptions {
  readonly projectRoot?: string;
}

export interface Toolkit {
  readonly registry: CanonicalRuleRegistry;
  readonly build: RegistryBuild;
  scan(request: ScanRequest): Promise<ScanResult>;
  prepare(request: PrepareRequest): Promise<PrepareResult>;
  validate(request: ValidateRequest): Promise<ValidateResult>;
  /** The strategy the engine would pick, without running a scan. */
  strategyFor(input: { language: Language; mode: TextMode; text: string; hasVoiceProfile?: boolean }): Strategy;
}

/**
 * How many full-strength findings it takes to drive `antiAIScore` to zero. The
 * same budget the scan uses, restated here so validation cannot drift from it.
 */
const RETRY_ANTI_AI_FLOOR = 0.7;
const RETRY_PRESERVATION_FLOOR = 0.9;
/**
 * Behaviour is scored on a smaller budget than prose tells (3 rather than 8), so
 * a lower floor would let a reply that still mirrors and agrees slip through. The
 * floor is where "still visibly assistant-shaped" begins.
 */
const RETRY_BEHAVIOR_FLOOR = 0.75;

export async function createToolkit(options: ToolkitOptions = {}): Promise<Toolkit> {
  const projectRoot = options.projectRoot ?? resolveProjectRoot();
  const build = await buildRegistryFromExtractions({ projectRoot });
  const registry = build.registry;
  const detectors = createDefaultDetectors();

  const runScan = async (request: ScanRequest): Promise<ScanResult> => {
    const language = request.language ?? detectLanguage(request.text);
    const mode = request.mode ?? inferMode(request.text);
    const scanOptions: ScanOptions = {
      registry,
      detectors,
      language,
      mode,
      ...(request.maxFindings !== undefined ? { maxFindings: request.maxFindings } : {}),
      ...(request.voiceProfile ? { voiceProfile: request.voiceProfile } : {}),
      ...(request.disableSuppression ? { disableSuppression: true } : {}),
      ...(request.conversation ? { conversation: request.conversation } : {}),
      ...(request.families ? { families: request.families } : {}),
    };
    return scan(request.text, scanOptions);
  };

  return {
    registry,
    build,

    scan: runScan,

    strategyFor(input) {
      const stats = computeTextStats(input.text);
      return selectStrategy({
        language: input.language,
        mode: input.mode,
        textStats: stats,
        ...(input.hasVoiceProfile !== undefined ? { hasVoiceProfile: input.hasVoiceProfile } : {}),
      });
    },

    async prepare(request) {
      const result = await runScan(request);
      const language = result.language;
      const mode = result.mode;

      const strategy = selectStrategy({
        language,
        mode,
        textStats: result.stats,
        hasVoiceProfile: request.voiceProfile !== undefined,
        ...(request.profileId ? { voiceProfileId: request.profileId } : {}),
      });

      // The rules the rewrite must satisfy, one directive per canonical rule, so
      // a tell three upstreams found is one instruction rather than three.
      const rules = result.canonicalFindings.map((finding) => {
        const ruleId = finding.canonicalRuleId ?? finding.ruleId;
        const rule = registry.get(ruleId);
        return {
          ruleId,
          category: finding.category,
          severity: finding.severity,
          guidance:
            rule?.rewriteGuidance ??
            `Rewrite so this tell is absent without losing information: ${finding.message}`,
          triggeredBy: [
            {
              detectorId: finding.detectorId,
              upstream: finding.upstream,
              ...(finding.canonicalRuleId ? { canonicalRuleId: finding.canonicalRuleId } : {}),
              message: finding.message,
              severity: finding.severity,
            },
          ],
        };
      });

      const contract = buildContract({
        language,
        mode,
        strategyId: strategy.id,
        objective:
          request.objective ??
          `Rewrite so the text reads as this writer's own, carrying every claim the source makes and no claim it does not.`,
        ...(request.profileId ? { voiceProfileId: request.profileId } : {}),
        rules,
        // Protected content is what the rewrite must reproduce exactly. It is
        // extracted here rather than left to the agent to notice.
        preserve: extractProtectedContent(request.text),
        required: [],
      });

      const payload = buildPromptPayload(contract, strategy);

      return {
        contract,
        rendered: payload.full,
        preamble: payload.preamble,
        strategy,
        scan: result,
      };
    },

    async validate(request) {
      const language = request.language ?? detectLanguage(request.rewritten);
      const mode = request.mode ?? inferMode(request.rewritten);

      // ---- preservation ----------------------------------------------------
      const original = extractProtectedContent(request.original);
      const preservation = checkPreservation(original, request.rewritten);

      // ---- anti-AI, behaviour and voice ------------------------------------
      // The rewrite is rescanned, and the score is the machine's second look at
      // its own output rather than a claim about the input. Behaviour is judged
      // from the conversation, and voice from the profile: neither is invented
      // when its input is missing, and both say so through `unmeasured`.
      const conversation = request.conversation;
      const rescanned = await runScan({
        text: request.rewritten,
        language,
        mode,
        ...(request.voiceProfile ? { voiceProfile: request.voiceProfile } : {}),
        ...(conversation ? { conversation } : {}),
      });

      const issues: ValidationIssue[] = [...preservation.issues];

      // ---- did the rewrite improve the behaviour, or leave it alone? --------
      const behaviourBefore = assessBehavior(
        (
          await runScan({
            text: request.original,
            language,
            mode,
            ...(conversation ? { conversation } : {}),
          })
        ).canonicalFindings,
        conversation ?? {},
      );
      const behaviourAfter = assessBehavior(
        rescanned.canonicalFindings,
        conversation ?? {},
        rescanned.scores.unmeasured?.includes('behaviorScore') !== true,
      );
      const behaviorDelta = behaviourAfter.behaviorScore - behaviourBefore.behaviorScore;

      // Behaviour that survived the rewrite is an issue; behaviour that was
      // merely present before it is not.
      for (const finding of behaviorFindings(rescanned.canonicalFindings)) {
        issues.push({
          kind: 'behavior-violation',
          severity: finding.severity,
          message: `Assistant behaviour survived the rewrite: ${finding.message}`,
          ...(finding.evidence[0]?.text ? { evidence: finding.evidence[0].text } : {}),
          score: 'behaviorScore',
        });
      }

      // ---- voice, when there is a target ------------------------------------
      const voiceValidation = request.voiceProfile
        ? validateVoice({
            original: request.original,
            rewritten: request.rewritten,
            profile: request.voiceProfile,
            language,
            mode,
          })
        : undefined;
      if (voiceValidation) issues.push(...voiceValidation.issues);

      const unmeasured: ScoreName[] = [];
      if (rescanned.scores.unmeasured?.includes('voiceScore')) unmeasured.push('voiceScore');
      if (rescanned.scores.unmeasured?.includes('behaviorScore')) unmeasured.push('behaviorScore');
      // A text with no URLs, code, numbers or names has nothing to preserve, so a
      // preservation score of 1 would be a check that never ran.
      if (preservation.itemCount === 0) unmeasured.push('preservationScore');

      const scores: VoiceScoreSet = {
        antiAIScore: rescanned.scores.antiAIScore,
        // Without a profile there is nothing to be close to, so the score is
        // reported as unmeasured rather than as a pass. `unmeasured` carries
        // that, because a bare 1 reads as a perfect match.
        voiceScore: voiceValidation?.voiceScore ?? 1,
        behaviorScore: behaviourAfter.behaviorScore,
        preservationScore: preservation.preservationScore,
        ...(unmeasured.length > 0 ? { unmeasured: [...new Set(unmeasured)] } : {}),
        rationales: [
          ...rescanned.scores.rationales,
          {
            score: 'preservationScore' as const,
            summary:
              preservation.itemCount === 0
                ? 'Not measured: the original contains no protected content to preserve.'
                : `${preservation.kept.length} of ${original.length} protected item(s) survived intact.`,
            contributions: original.slice(0, 30).map((directive) => ({
              label: `${directive.kind}: ${directive.value.slice(0, 40)}`,
              value: preservation.kept.some((k) => k.value === directive.value) ? 1 : 0,
              weight: directive.exact ? 1 : 0.5,
            })),
          },
        ],
      };

      assertNoBlendedScore(scores);

      const retryRecommended =
        scores.preservationScore < RETRY_PRESERVATION_FLOOR ||
        scores.antiAIScore < RETRY_ANTI_AI_FLOOR ||
        scores.behaviorScore < RETRY_BEHAVIOR_FLOOR ||
        (voiceValidation?.regression ?? false);

      return {
        scores,
        issues,
        preservation,
        rescanned,
        retryRecommended,
        summary: summariseValidation(scores, preservation, rescanned),
        behaviorDelta,
        ...(voiceValidation ? { voiceDelta: voiceValidation.delta } : {}),
      };
    },
  };
}

function summariseValidation(
  scores: VoiceScoreSet,
  preservation: PreservationCheck,
  rescanned: ScanResult,
): string {
  const parts: string[] = [];
  parts.push(
    `antiAIScore ${scores.antiAIScore.toFixed(2)} (${rescanned.canonicalFindings.length} canonical rule(s) still firing)`,
  );
  parts.push(`preservationScore ${scores.preservationScore.toFixed(2)}`);
  if (preservation.lost.length > 0) {
    parts.push(`${preservation.lost.length} protected item(s) lost`);
  }
  if (preservation.altered.length > 0) {
    parts.push(`${preservation.altered.length} altered`);
  }

  // A score that nothing was measured against is named as unmeasured rather than
  // reported as a pass. `1` on its own is indistinguishable from perfect.
  const unmeasured = new Set(scores.unmeasured ?? []);
  const behavior =
    unmeasured.has('behaviorScore')
      ? 'behaviorScore not measured'
      : `behaviorScore ${scores.behaviorScore.toFixed(2)}`;
  const voice = unmeasured.has('voiceScore')
    ? 'voiceScore not measured: no profile was supplied'
    : `voiceScore ${scores.voiceScore.toFixed(2)}`;
  parts.push(behavior);
  parts.push(voice);
  return parts.join('; ');
}
