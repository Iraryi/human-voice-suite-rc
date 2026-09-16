/**
 * The voice profile the benchmark measures against.
 *
 * This is Phase 6's learning path used for real: the profile is learned from the
 * corpus' own `human-written` samples, by the same extractor that measures a
 * candidate, with two methodological safeguards.
 *
 * **Leave one out.** A sample is never measured against a profile learned from
 * itself. Without that, every human-authored sample would score near-perfectly
 * against its own habits and the false-positive rate would be a fiction.
 *
 * **Same language only.** A Chinese profile cannot say anything about English
 * prose, and blending the two would produce a target that describes nobody —
 * exactly what the scoped-profile design exists to prevent.
 *
 * The learned profile is not committed: it is derived from the corpus, so a
 * corpus hash pins it. The samples it used are recorded in its `sources`.
 */

import { buildProfile } from '../../src/voice/profile/index.js';
import { learnFingerprint } from '../../src/voice/fingerprint/index.js';
import type { VoiceProfile } from '../../src/voice/types.js';
import { sourceRef } from '../../src/rules/provenance/types.js';
import type { Corpus, Sample } from './corpus.js';

export const BENCH_OWNER = 'human-voice-suite/benchmark-corpus';

export function profileId(language: string): string {
  return `bench/${language}`;
}

/**
 * Learn a profile for `sample`'s language from the corpus' human-written samples,
 * excluding the sample itself.
 */
export function learnProfileFor(corpus: Corpus, sample: Sample): VoiceProfile | undefined {
  return learnProfileExcluding(corpus, sample.language, sample.id);
}

const cache = new Map<string, VoiceProfile | undefined>();

export function learnProfileExcluding(
  corpus: Corpus,
  language: string,
  excludeId?: string,
): VoiceProfile | undefined {
  const key = `${language}\u001f${excludeId ?? ''}`;
  if (cache.has(key)) return cache.get(key);

  const training = corpus.samples.filter(
    (candidate) =>
      candidate.provenance === 'human-written' &&
      candidate.language === language &&
      candidate.id !== excludeId,
  );

  const learned = training.length === 0 ? undefined : learnFingerprint(
    training.map((entry) => ({
      text: entry.body,
      // A chat turn and an essay are measured differently, so the mode travels
      // with the sample into the fingerprint.
      mode: entry.mode,
    })),
    { language: language === 'en' ? 'en' : 'zh' },
  );

  if (!learned) {
    cache.set(key, undefined);
    return undefined;
  }

  const profile = buildProfile({
    id: profileId(language),
    owner: BENCH_OWNER,
    kind: 'writing',
    languages: [language === 'en' ? 'en' : 'zh'],
    sources: training.map((entry) =>
      sourceRef(BENCH_OWNER, {
        ruleId: entry.id,
        locator: entry.path,
        quote: entry.source,
        note: `Human-written sample used to learn this profile. Licence: ${entry.licence}.`,
      }),
    ),
    writing: learned.writing,
    notes:
      `Learned at benchmark time from ${training.length} human-written ${language} sample(s) of the ` +
      'benchmark corpus, excluding the sample being measured (leave-one-out). Not committed: a corpus ' +
      'hash pins it, and any run that quotes a voiceScore must quote the corpus hash alongside it.',
  });

  cache.set(key, profile);
  return profile;
}

/** Which samples a profile was learned from, for reporting. */
export function trainingIds(
  corpus: Corpus,
  language: string,
  excludeId?: string,
): string[] {
  return corpus.samples
    .filter(
      (candidate) =>
        candidate.provenance === 'human-written' &&
        candidate.language === language &&
        candidate.id !== excludeId,
    )
    .map((candidate) => candidate.id);
}

export function clearProfileCache(): void {
  cache.clear();
}
