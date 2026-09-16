/**
 * A faithful TypeScript port of `src/methodologies/detectors/statistical.py`
 * (39 lines) from `lynote-ai/humanize-text`, pinned commit
 * 48f3c0ac0f51cb7c2af23cbf45ea865e1d71e04e.
 *
 * This is the only part of that upstream which runs offline with zero
 * dependencies — no API key, no network, no model weights — which is why it is
 * the one detector worth taking from a project whose default path is a remote
 * translation chain.
 *
 * ## What was ported, and what was deliberately added
 *
 * The formula below is the upstream's, unchanged. `statisticalScore` returns
 * exactly what `StatisticalDetector.score` returns for the same input, including
 * the two early exits that yield `0.5` and the order of the guards. Nothing was
 * "fixed" on the way across; where a change looks warranted it is written down
 * as a comment instead, so a caller can see the original behaviour and the
 * argument against it separately.
 *
 * What *was* added is `statisticalFeatures`, which exposes the three raw
 * sub-features the combined score is built from. The upstream hard-codes the
 * anchors 0.7, 0.5 and 0.6 as magic numbers with nothing in the repository
 * justifying them — no derivation, no corpus, no calibration note. Because they
 * are unanchored, a phrase-length or language change silently re-scales the
 * score, and a caller has no way to detect that from a single number. Returning
 * ttr, cv and hapaxRatio alongside the score is what makes recalibration
 * possible without patching this file. It also makes the port testable against
 * the Python source by hand, which the combined float alone would not.
 *
 * ## Known limitations, inherited and reported rather than hidden
 *
 * - **English-only sentence segmentation.** The upstream splits on
 *   `re.split(r'(?<=[.!?])\s+', text)`. That is ASCII sentence punctuation and
 *   ASCII whitespace, so a Chinese paragraph with no space after 。is a *single*
 *   sentence: `len(sentences) < 2` then returns the neutral 0.5 for text that
 *   may be strongly AI-like, and the CV term is computed over one length. This
 *   port reproduces that exactly. Upstream is inconsistent about it —
 *   `src/standard/translators.py:64` uses `r'(?<=[.!?。！？])\s+'` for chunking —
 *   so the reference detector is the weaker of the two in the same repository.
 * - **Whitespace-only tokenisation.** `text.split()` is used for words, and the
 *   upstream never strips punctuation, so `"sentence."` and `"sentence"` are two
 *   types and `"the,"` hides `"the"`. TTR and the hapax ratio therefore move
 *   with punctuation style, not only with vocabulary.
 * - **No lower bound on input length.** Two short sentences score as
 *   confidently as two hundred; there is no confidence weighting.
 * - **CV is zero when the mean length is zero**, per the upstream's
 *   `if mean_len > 0 else 0`, which cannot happen for non-empty whitespace
 *   splits but is preserved for fidelity.
 *
 * ## Suggested improvements (NOT applied)
 *
 * Held here as comments because changing the formula would silently break
 * comparability with the upstream and with any caller that has already
 * calibrated against it:
 *
 * 1. Segment on Unicode sentence terminators (`[.!?。！？…]` plus `\s*`) so the
 *    detector works on the Chinese half of this suite's corpus at all.
 * 2. Normalise tokens (lowercase, strip edge punctuation) before computing TTR
 *    and hapax, so punctuation style does not leak into a lexical measure.
 * 3. Replace the three fixed anchors with a calibration table keyed on
 *    language and genre, or expose them as parameters defaulting to the
 *    upstream's values.
 * 4. Guard the sample: require a minimum token count before reporting a score,
 *    and return a neutral value with a reason instead of a confident one.
 */

/** The three raw sub-features, before the upstream's anchor subtraction. */
export interface StatisticalFeatures {
  /** Type-token ratio over whitespace tokens, lowercased. 1 = all distinct. */
  readonly ttr: number;
  /** Coefficient of variation (stddev / mean) of sentence lengths in words. */
  readonly cv: number;
  /** Hapax legomena ratio: distinct words seen exactly once / distinct words. */
  readonly hapaxRatio: number;
  /** Sentence and word counts, so a caller can judge whether the score is credible. */
  readonly sentences: number;
  readonly words: number;
  /** Distinct lowercase word types; the denominator of `ttr`. */
  readonly types: number;
}

/**
 * The upstream's threshold constants, named so the recalibration argument above
 * has something concrete to point at.
 *
 * `score = mean(clamp((anchor - feature) / width))` for the three features, with
 * a different anchor for each. A lower feature value scores as more AI-like,
 * which is the upstream's stated direction: low TTR, low CV and low hapax are
 * "more AI".
 */
export const STATISTICAL_ANCHORS = {
  ttr: 0.7,
  cv: 0.5,
  hapax: 0.6,
  width: 0.3,
  /** The value returned when the input is too short to judge. */
  neutral: 0.5,
} as const;

/**
 * Split text into trimmed non-empty sentences.
 *
 * Port of `statistical.py:9`: `re.split(r'(?<=[.!?])\s+', text)` filtered by
 * `if s.strip()`. JavaScript and Python agree on this pattern for the inputs the
 * parser can produce; the lookbehind is supported in both.
 *
 * The English-only limitation documented at the top of this file lives here.
 */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * The three raw sub-features.
 *
 * Returns `null` in exactly the two cases where the upstream returns the neutral
 * 0.5, so the caller cannot accidentally compute a sub-feature the upstream
 * would not have computed.
 */
export function statisticalFeatures(text: string): StatisticalFeatures | null {
  const sentences = splitSentences(text);
  if (sentences.length < 2) return null;

  const words = text.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return null;

  // Type-Token Ratio (lower = more repetitive = more AI-like)
  const lower = words.map((word) => word.toLowerCase());
  const typeSet = new Set(lower);
  const ttr = typeSet.size / words.length;

  // Sentence length variance (lower = more uniform = more AI-like)
  const lengths = sentences.map((sentence) => sentence.split(/\s+/).filter((w) => w.length > 0).length);
  const meanLength = lengths.reduce((sum, length) => sum + length, 0) / lengths.length;
  const variance =
    lengths.reduce((sum, length) => sum + (length - meanLength) ** 2, 0) / lengths.length;
  const stdDev = Math.sqrt(variance);
  const cv = meanLength > 0 ? stdDev / meanLength : 0;

  // Hapax legomena ratio (words appearing only once)
  const counts = new Map<string, number>();
  for (const word of lower) counts.set(word, (counts.get(word) ?? 0) + 1);
  let hapax = 0;
  for (const count of counts.values()) if (count === 1) hapax += 1;
  const hapaxRatio = counts.size > 0 ? hapax / counts.size : 0;

  return {
    ttr,
    cv,
    hapaxRatio,
    sentences: sentences.length,
    words: words.length,
    types: typeSet.size,
  };
}

/**
 * The combined 0..1 score, identical to `StatisticalDetector.score`
 * (`statistical.py:8-39`).
 *
 * Returns `STATISTICAL_ANCHORS.neutral` (0.5) when there are fewer than two
 * sentences, or when there are no words — the two early exits at
 * `statistical.py:10-15`. Otherwise it is the mean of the three clamped terms.
 *
 * Note the asymmetry against `postprocess._disrupt_sentence_rhythm`
 * (`postprocess.py:57`), which uses a threshold of *three* sentences for the
 * same question. Two different minimums in one codebase is recorded, not
 * reconciled.
 */
export function statisticalScore(text: string): number {
  const features = statisticalFeatures(text);
  if (features === null) return STATISTICAL_ANCHORS.neutral;

  const { ttr, cv, hapaxRatio } = features;
  const { ttr: ttrAnchor, cv: cvAnchor, hapax: hapaxAnchor, width } = STATISTICAL_ANCHORS;

  // Combine signals: low TTR + low CV + low hapax = likely AI
  const ttrScore = clamp01((ttrAnchor - ttr) / width);
  const cvScore = clamp01((cvAnchor - cv) / width);
  const hapaxScore = clamp01((hapaxAnchor - hapaxRatio) / width);

  return (ttrScore + cvScore + hapaxScore) / 3;
}
