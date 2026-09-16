# Inventory: lynote-ai/humanize-text

> READ-ONLY inventory. No file inside the repository directory was created, modified, or deleted. No `pip install`, no tests, no Python interpreter from this repo was executed. PNG assets under `presentation/` were not opened.

## 1. Identity

| Field | Value | Evidence |
|---|---|---|
| Repository | `lynote-ai/humanize-text` | `setup.py:11` (`url = "https://github.com/lynote-ai/humanize-text"`) |
| Local path | `\.upstream-cache\humanize-text` | — |
| Commit | `48f3c0ac0f51cb7c2af23cbf45ea865e1d71e04e` — subject `Merge pull request #46 from G2P2/fix/contributing-stale-urls`, author date `2026-09-15 10:23:59 +0800` | `git -C <root> rev-parse HEAD` |
| License | MIT License, Copyright holder verbatim: `Copyright (c) 2026 Lynote.ai` | `LICENSE:1`, `LICENSE:3` |
| Declared version | `1.5.2` | `setup.py:5` (`version="1.5.2"`); also `src/__init__.py:12` (`__version__ = "1.5.2"`) |
| Python support | `python_requires=">=3.10"`; classifiers list 3.10, 3.11, 3.12 | `setup.py:19`, `setup.py:49-51` |
| Author metadata | `author="Lynote.ai"`, `author_email="contact@lynote.ai"` | `setup.py:9-10` |
| File count | 67 files excluding `presentation/` and `.git/`; 75 files excluding only `.git/` (of which 8 are PNGs + `presentation/logo`) | filesystem enumeration |
| Total text size (excl. `presentation/`) | 174,690 bytes across 67 files | filesystem enumeration |
| `presentation/` size | 5,690,565 bytes (not read) | filesystem enumeration |
| Language mix | 26 `.py`, 25 `.md`, 7 `.txt`, 2 `.yml`, 1 `.toml`, 1 `.json`, 1 `.sh`, 1 `.bat`, 2 extensionless | filesystem enumeration |
| Python LOC | 1,553 lines across 26 `.py` files | filesystem enumeration |

**Runtime dependency surface**

- `install_requires` (`setup.py:20-26`): `httpx>=0.25.0`, `toml>=0.10.2`, `click>=8.1.0`, `rich>=13.7.0`, `deep-translator>=1.11.0`. `requirements.txt:1-5` lists exactly the same five.
- `extras_require["litellm"]` (`setup.py:28-30`): `litellm>=1.80.0,<1.87.0`.
- `extras_require["legacy"]` (`setup.py:31-37`): `transformers>=4.36.0`, `torch>=2.1.0`, `nltk>=3.8.0`, `langdetect>=1.0.9`. Note: `nltk` and `langdetect` are declared but **never imported anywhere in the tree** (grep for `nltk|langdetect` matches only `setup.py:35-36` and `examples/legacy/README.md:23`) — dead declared extras.
- Console entry point: `humanize-text=src.standard.pipeline:main` (`setup.py:41`).

**Version-string inconsistency worth noting:** `setup.py:5` and `src/__init__.py:12` say `1.5.2`, while ~15 docstrings/markdown files still say `v1.5.1` (e.g. `src/standard/__init__.py:1`, `src/standard/pipeline.py:2`, `docs/pipeline.md:1`, `config/config.example.toml:1`). The 1.5.2 release was a pure restructure (`CHANGELOG.md:5-20`), so the docs were not re-stamped.

## 2. Purpose and functionality

The project rewrites AI-generated English prose so that AI-text detectors classify it as human-written. The commercial pitch is explicit in `README.md:30-32` ("Most humanizers are a black box... The interesting part isn't the LLM rewriting — everyone does that. It's the **translation chain**.").

Concretely the shipped product is a **4-step remote-API chain** (`src/standard/pipeline.py`): two LLM "humanization rewrite + language shift" calls (English→Chinese, Chinese→Japanese), then two machine-translation hops (Japanese→Finnish via Google, Finnish→English via Niutrans). Nothing is computed locally; every step is a network call to a third-party service.

Secondary functionality:

- A v1.0 **research reference set** of four humanization methodologies (`src/methodologies/`) plus a dispatcher and an optional FastAPI app (`src/methodologies/humanizer.py:55-99`).
- Three **detector reference implementations** (`src/methodologies/detectors/`) used only by the v1.0 "Method 3" loop.
- A rule-based **post-processor** (`src/methodologies/postprocess.py`) containing an AI-vocabulary dictionary and a sentence-rhythm merger.
- Integrations: CLI (`src/standard/pipeline.py:123-151`), an n8n workflow JSON (`n8n/humanize_standard.json`), Docker (`docker/Dockerfile`, `docker-compose.yml`).

Explicit scope disclaimers exist: `README.md:70-77` ("for improving the readability and natural cadence of AI-assisted drafts", "does not guarantee that rewritten text will be classified as human"), and `SECURITY.md:20-24` ("Detector output is probabilistic and must not be treated as proof of authorship").

## 3. Code and file structure

The tree splits into four zones:

```
src/standard/          # v1.5 production path (4 files, 536 LOC)
src/methodologies/     # v1.0 reference implementations (10 files, 526 LOC incl. detectors)
docs/                  # 9 markdown docs
examples/              # showcase/ (5 traces), legacy/ (v1.0 examples + comparison outputs)
n8n/, docker/, scripts/, tests/, config/
```

**`src/standard/` is the current supported path.** Evidence:

- `src/standard/__init__.py:1-5`: `"""Standard Pipeline (v1.5.1) — production path. ... This is the recommended path for actual use."`
- `setup.py:41` wires the only console script to `src.standard.pipeline:main`.
- `CHANGELOG.md:6-10`: `**[1.5.2]** ... **`src/` split into `src/standard/` + `src/methodologies/`** — visual separation of v1.5 production code vs v1.0 reference implementations`; `src/standard/: pipeline.py, llm_rewriter.py, translators.py (production)`.
- `CHANGELOG.md:50-51` (`[1.5.0]`): `v1.5 Standard Pipeline is now the **recommended production path**` / `v1.0 four methodologies remain in `src/` as **reference implementations** for research and customization`.
- `docs/README.md:7` routes developers to `pipeline.md` as "Standard Pipeline (v1.5.1) — 4-step architecture".

**`src/methodologies/` is legacy/experimental reference code.** Evidence:

- `examples/legacy/README.md:1-6`: `# Legacy Examples (v1.0)` / `These examples target the **v1.0 four-methodology reference implementations** ... They are kept for users studying the original methodologies.`
- `examples/legacy/README.md:8`: `For the **v1.5.1 production Standard Pipeline**, see: ...`
- `src/methodologies/__init__.py:1-7`: `"""v1.0 Humanization Methodologies (reference implementations). ... They are kept here as **reference implementations** for research, education, and customization. For production use, see `src.standard` (the v1.5.1 Standard Pipeline)."""`
- `docs/techniques.md:3-5`: `These documents cover the **4 humanization methodologies** we originally explored in v1.0. They remain in `src/` as **reference implementations** for research, education, and customization.` / `For the **production path**, see the [Standard Pipeline](pipeline.md) added in v1.5`.
- `CHANGELOG.md:53-61` shows the v1.0.0 tree (`src/translation_chain.py`, `src/detection_pipeline.py`, ...) that v1.5.x superseded.
- `tests/test_smoke.py:48-52` explicitly excludes Method 3 from the import smoke test because it needs `transformers`/`torch`.
- No CI job, no Docker entrypoint, and no example runs `src/methodologies/*` as a supported path; the Docker CMD deliberately serves the *v1.0 dispatcher* (`docker/Dockerfile:12`), which `docs/installation.md:22` calls "exposes the v1.0 methodology dispatcher".

The two zones are not fully independent: `src/methodologies/llm_rewriter.py:9` and `src/methodologies/utils/config.py:5` import **from** `src.standard` (`from src.standard.llm_client import chat_completions, resolve_llm_config`). Legacy depends on production, never the reverse.

## 4. The four methodologies — DETAILED

All four live in `src/methodologies/` and are dispatched through `Humanizer.METHODS` (`src/methodologies/humanizer.py:23-28`).

```python
# src/methodologies/humanizer.py:23-28
METHODS = {
    "translation_chain": ("src.methodologies.translation_chain", "TranslationChainProcessor"),
    "llm_rewrite": ("src.methodologies.llm_rewriter", "LLMRewriteProcessor"),
    "detection_guided": ("src/methodologies.detection_pipeline", "DetectionGuidedProcessor"),
    "mixed_engine": ("src.methodologies.mixed_engine", "MixedEngineProcessor"),
}
```

### 4.1 `translation_chain` — Method 1, Multi-Language Translation Chain

**External?** Yes — network. Uses `deep_translator`'s `GoogleTranslator` / `MyMemoryTranslator` scrapers (`src/methodologies/translation_chain.py:8`). No LLM.

**Inputs:** `text: str`, `tier: str` defaulting to `"standard"`. Config read from `config["translation_chain"]`.
**Output:** `str` (English, after final hop back to `"en"`).

**Algorithm step by step** (`translation_chain.py:30-45`):

1. `max_hops = self.TIERS.get(tier, 3)` where `TIERS = {"standard": 3, "advanced": 4, "focus": 5}` (`translation_chain.py:12-16`).
2. `languages = self.chain[:max_hops - 1]` — default `self.chain = ["zh-CN", "ja", "fi"]` (`translation_chain.py:20`). So for `standard` the hop languages are `["zh-CN", "ja"]` only; `fi` is unused at the default tier.
3. Loop over those languages, picking `engine = self.engines[i % len(self.engines)]` from `["google", "mymemory"]` (`translation_chain.py:21`, `:36-40`), translating `prev_lang → lang` and advancing `prev_lang`.
4. Final hop back to English using **always `self.engines[0]`** (i.e. Google): `final_translator = self._get_translator(self.engines[0], prev_lang, "en")` (`translation_chain.py:42-43`).

```python
# src/methodologies/translation_chain.py:36-43
for i, lang in enumerate(languages):
    engine = self.engines[i % len(self.engines)]
    translator = self._get_translator(engine, prev_lang, lang)
    current_text = translator.translate(current_text)
    prev_lang = lang

final_translator = self._get_translator(self.engines[0], prev_lang, "en")
current_text = final_translator.translate(current_text)
```

**Skeptical notes:** the docstring claims "production use ... integrates this method with Method 2 into a fixed, validated 4-step chain" (`translation_chain.py:3-5`), but the production `pipeline.py` does **not** call this class; it calls its own translators directly. `TranslationChainProcessor` has no error handling, no chunking (so long inputs will hit provider length limits), and no detection feedback.

### 4.2 `llm_rewrite` — Method 2, Multi-Turn LLM Rewriting

**External?** Yes — network LLM call through the shared OpenAI-compatible client.

**Inputs:** `text: str`, optional `rounds` kwarg override. Config from `config["llm_rewrite"]`: `top_p` default `0.9`, `rounds` default `2` (`src/methodologies/llm_rewriter.py:38-39`).
**Output:** `str`.

**Algorithm step by step** (`llm_rewriter.py:57-63`):

1. `__init__` resolves provider settings via `resolve_llm_config(config)` (`llm_rewriter.py:31`) — so this legacy method inherits the whole `[llm]`/`[api_keys]` surface including the API-key requirement.
2. `rounds = kwargs.get("rounds", self.rounds)`; iterate `range(min(rounds, len(self.REWRITE_PROMPTS)))` — capped at 3 because there are exactly three prompts.
3. Each round is a single stateless `chat_completions` call with the round's prompt as the **system** message and the previous round's output as the **user** message (`llm_rewriter.py:41-55`). No history accumulation; each round is independent.
4. The three prompts are fixed English instruction strings (`llm_rewriter.py:15-27`): (a) vary sentence lengths between 3–8 and 25–40 words; (b) strip formal/academic vocabulary and add rhetorical questions or asides; (c) final polish, no three consecutive sentences of similar length.

```python
# src/methodologies/llm_rewriter.py:57-63
def process(self, text: str, **kwargs) -> str:
    rounds = kwargs.get("rounds", self.rounds)
    current_text = text

    for i in range(min(rounds, len(self.REWRITE_PROMPTS))):
        current_text = self._call_llm(self.REWRITE_PROMPTS[i], current_text)

    return current_text
```

This is the closest thing in the repo to a **rule-bearing artifact**: the three prompts are literal, readable stylistic instructions. Temperature comes from `resolve_llm_config`, i.e. 1.3 by default (`src/standard/llm_client.py:80`).

### 4.3 `detection_guided` — Method 3, Detection-Guided Feedback Loop

**External?** No network in the loop itself — but it needs `transformers`+`torch` (`setup.py:31-37`) and downloads GPT-2 / RoBERTa weights from Hugging Face on first use.

**Inputs:** `text: str`. Config from `config["detection_guided"]`: `max_feedback_rounds` default `2`, `threshold` default `0.5`, `enable_gpu` default `True` (`src/methodologies/detection_pipeline.py:19-21`).
**Output:** `str`.

**Algorithm step by step** (`detection_pipeline.py:42-62`):

1. Constructs all three detectors plus a `PostProcessor` in `__init__` (`detection_pipeline.py:23-26`).
2. `process` first applies `self.postprocessor.process(text)` unconditionally (`detection_pipeline.py:43`) — pure rule-based vocabulary replacement + rhythm merge.
3. Loop up to `max_rounds` (=2):
   - segment into sentences with `re.split(r'(?<=[.!?])\s+', text)` (`detection_pipeline.py:28-29`);
   - for each sentence compute `score = self._detect(sentence)`, which is the **arithmetic mean of the three detector scores** (`detection_pipeline.py:31-37`);
   - collect indices where `score > self.threshold` (i.e. `> 0.5`);
   - if nothing is flagged, `break`;
   - otherwise replace each flagged sentence with `self.postprocessor.process(sentence)` (`detection_pipeline.py:39-40`) and rejoin with `" "`.
4. Return the text.

```python
# src/methodologies/detection_pipeline.py:31-37
def _detect(self, text: str) -> float:
    scores = [
        self.binoculars.score(text),
        self.roberta.score(text),
        self.statistical.score(text),
    ]
    return sum(scores) / len(scores)
```

**Skeptical notes (important):**

- Despite the module docstring `"""Method 3: Detection-Guided Feedback Loop"""` and the architecture diagram in `docs/techniques.md:110-132` showing "Document-Level Rewrite (LLM) → Sentence-Level Deep Rewrite (LLM)", **there is no LLM call anywhere in this file**. The "rewrite" is `PostProcessor.process`, i.e. word substitution plus merging adjacent short sentences. Let me verify: `detection_pipeline.py` imports only `re`, the three detectors, and `PostProcessor` (`detection_pipeline.py:9-13`). Confirmed — no LLM.
- The loop is therefore monotonically weakly-converging on the *rule* output only; running `PostProcessor` twice can only re-substitute words and merge sentences. There is no re-detection branch apart from the `max_rounds` counter, despite `docs/techniques.md:129` drawing a "Re-Detection ──── Still flagged? ──┘" loop.
- `docs/techniques.md:154` claims "Requires local deployment of Binoculars + RoBERTa models (GPU recommended)"; `docs/installation.md:110-112` says models download automatically and ~4GB VRAM is needed.

### 4.4 `mixed_engine` — Method 4, Mixed-Engine Translation

**External?** Yes — network, via `deep_translator` engines.

**Inputs:** `text: str`. Config from `config["mixed_engine"]`: `engines` default `["google", "mymemory"]`, `strategy` default `"best_score"` (`src/methodologies/mixed_engine.py:14-16`).
**Output:** `str` — but note the output is a **round-trip back-translation into English**, not a translation into Chinese.

**Algorithm step by step** (`mixed_engine.py:37-61`):

1. `target_lang = "zh-CN"` is **hard-coded** (`mixed_engine.py:38`) and ignores the config/CLI language argument.
2. Segment input into sentences (`mixed_engine.py:25-26`, same regex as elsewhere).
3. For each segment: for each configured engine, translate `en → zh-CN`, then translate the result back `zh-CN → en`, score the back-translation with `_score_naturalness`, and keep the highest-scoring engine's output. Exceptions are silently swallowed (`except Exception: continue`) so a failing engine just yields no candidate.
4. `best_result` defaults to the **untranslated original segment** with `best_score = -1`, so if every engine throws, the original text passes through unchanged.
5. Join segments with `" "` and return.

```python
# src/methodologies/mixed_engine.py:46-59
for engine_name in self.engines:
    try:
        fwd = self._get_translator(engine_name, "en", target_lang)
        translated = fwd.translate(segment)
        bwd = self._get_translator(engine_name, target_lang, "en")
        back_translated = bwd.translate(translated)
        score = self._score_naturalness(back_translated)
        if score > best_score:
            best_score = score
            best_result = back_translated
    except Exception:
        continue
```

**The scoring function** (`mixed_engine.py:28-35`) is a heuristic, not a model:

```python
# src/methodologies/mixed_engine.py:28-35
def _score_naturalness(self, text: str) -> float:
    words = text.split()
    if not words:
        return 0.0
    unique_ratio = len(set(words)) / len(words)
    lengths = [len(w) for w in words]
    length_variance = sum((l - sum(lengths)/len(lengths))**2 for l in lengths) / len(lengths) if lengths else 0
    return unique_ratio * 0.6 + min(length_variance / 10, 0.4)
```

`docs/techniques.md:169-175` claims segmentation "at sentence or clause level" and selection by "Naturalness scoring / Vocabulary diversity / Structural difference from the original" — only the first two of those three exist, and "structural difference from the original" is **not implemented**.

### 4.5 Cross-methodology summary

| Methodology | External network | LLM/API dependency | Offline? | Genuinely implements its doc claim? |
|---|---|---|---|---|
| `translation_chain` | Yes (Google/MyMemory) | none | No | Partially — TIERS/engines exist; no chunking, no error handling |
| `llm_rewrite` | Yes (LLM) | API key required | No | Yes, within its 3 fixed prompts |
| `detection_guided` | No in-loop | `transformers`/`torch` weights download on first use | Only after weights are cached | **No** — no LLM rewrite stage exists despite docs |
| `mixed_engine` | Yes (Google/MyMemory) | none | No | No — DeepL/Apertium/3-way merge claimed in docs, only Google+MyMemory implemented |

## 5. Detectors

All three live in `src/methodologies/detectors/`. `detectors/__init__.py` is **empty (0 bytes)**, so nothing is exported implicitly. They are used **only** by `DetectionGuidedProcessor`.

### 5.1 `binoculars.py` — `BinocularsDetector`

| Aspect | Finding | Evidence |
|---|---|---|
| Model / library | `transformers.GPT2LMHeadModel` + `GPT2Tokenizer`, model id `"gpt2"` (i.e. `gpt2`, the 124M base model) | `binoculars.py:13`, `binoculars.py:17-18` |
| Weights bundled? | No — `from_pretrained("gpt2")` downloads from Hugging Face on first use | `binoculars.py:17-18` |
| Device | `"cuda" if self.use_gpu and torch.cuda.is_available() else "cpu"` | `binoculars.py:16` |
| Lazy load | `_load_model()` early-returns if `self.model is not None` | `binoculars.py:9-11` |
| Feature | Token cross-entropy loss from a **single** GPT-2 model, exponentiated to perplexity | `binoculars.py:28-30` |
| Threshold / normalization | `normalized = max(0.0, min(1.0, 1.0 - (perplexity - 10) / 100))` — i.e. PPL ≤ 10 → 1.0, PPL ≥ 110 → 0.0, linear between | `binoculars.py:34` |
| Output shape | single `float` in `[0, 1]`, higher = more likely AI | `binoculars.py:32-35` |
| Truncation | `truncation=True, max_length=512` | `binoculars.py:25` |
| Offline? | Only if the `gpt2` weights are already in the HF cache; otherwise the first `score()` reaches the network | inferred from `from_pretrained` |

**Skeptical finding — this is not Binoculars.** The docstring says `"""Binoculars detector: GPT-2 dual-model perplexity ratio."""` (`binoculars.py:1`) and `docs/techniques.md:136` says "Uses GPT-2 with two different decoding heads to measure perplexity ratio." The published Binoculars method computes a ratio of perplexities between an **observer** and a **performer** model. The actual code loads **one** model (`gpt2` only) and uses plain perplexity with a hand-rolled linear squash. There is no ratio, no second model, no "two decoding heads". It is a single-model perplexity heuristic wearing the Binoculars name. `CHANGELOG.md:58` is more honest: "**Binoculars-inspired** + RoBERTa scoring loop".

### 5.2 `roberta.py` — `RoBERTaDetector`

| Aspect | Finding | Evidence |
|---|---|---|
| Model / library | `transformers.pipeline("text-classification", model="roberta-base-openai-detector")` | `roberta.py:16-20` |
| Weights bundled? | No — resolved by name from the HF Hub | `roberta.py:18` |
| Device | `device = 0 if self.use_gpu and torch.cuda.is_available() else -1` | `roberta.py:15` |
| Output mapping | If label is `"LABEL_1"` or `"Fake"` return `result["score"]`, else return `1.0 - result["score"]` | `roberta.py:26-27` |
| Output shape | single `float` in `[0, 1]`, higher = more likely AI | `roberta.py:26-27` |
| Truncation | `truncation=True, max_length=512` | `roberta.py:24` |
| Offline? | Only if weights are cached; otherwise downloads from HF Hub | inferred from `pipeline(...)` |

**Skeptical findings:**

- `"roberta-base-openai-detector"` is a bare repo id with no namespace. On the HF Hub the canonical id is `openai-community/roberta-base-openai-detector`; a bare `roberta-base-openai-detector` will not resolve — the load will raise. This is a likely-broken reference (mentioned in the source of the reliability risk in §16).
- The 2019 OpenAI RoBERTa detector predicts `Fake`/`Real` labels, not `LABEL_0`/`LABEL_1`; the code tries to handle both (`roberta.py:26`) but the inverted-index fallback (`1.0 - score`) silently produces a wrong-polarity score if the label convention differs from either branch assumption.
- `docs/techniques.md:137` claims "Fine-tuned binary classifier on AI vs. human text datasets" — true only in the sense that someone else's 2019 model is being pointed at; **no fine-tuning happens in this repo** and no training data ships.

### 5.3 `statistical.py` — `StatisticalDetector`

| Aspect | Finding | Evidence |
|---|---|---|
| Model / library | none — pure Python (`re`, `math`) | `statistical.py:3-4` |
| Weights bundled? | n/a, no weights at all | — |
| Features | (1) type-token ratio `ttr = len(set(w.lower() ...)) / len(words)`; (2) sentence-length coefficient of variation `cv = std_dev / mean_len`; (3) hapax-legomena ratio `hapax_ratio = words appearing once / distinct words` | `statistical.py:18`, `statistical.py:22-25`, `statistical.py:28-32` |
| Sub-score normalizations | `ttr_score = clamp((0.7 - ttr)/0.3)`, `cv_score = clamp((0.5 - cv)/0.3)`, `hapax_score = clamp((0.6 - hapax_ratio)/0.3)` | `statistical.py:35-37` |
| Combination | unweighted arithmetic mean of the three sub-scores | `statistical.py:39` |
| Output shape | single `float` in `[0, 1]`, higher = more likely AI | `statistical.py:39` |
| Degenerate input | returns the neutral `0.5` if fewer than 2 sentences or no words | `statistical.py:10-15` |
| Offline? | **Yes — fully offline, zero dependencies, no network, no downloads** | `statistical.py:1-39` |

```python
# src/methodologies/detectors/statistical.py:35-39
ttr_score = max(0, min(1, (0.7 - ttr) / 0.3))
cv_score = max(0, min(1, (0.5 - cv) / 0.3))
hapax_score = max(0, min(1, (0.6 - hapax_ratio) / 0.3))

return (ttr_score + cv_score + hapax_score) / 3
```

**Skeptical finding:** `docs/techniques.md:138-139` advertises four signal families — "Sentence length variance, vocabulary richness (TTR), n-gram diversity" and "Unique token ratio, hapax legomena count, Yule's K measure". The code implements exactly three (TTR, CV of sentence length, hapax ratio). **n-gram diversity and Yule's K are documented but absent** (grep for `Yule` matches only `docs/techniques.md:139`). Also note the thresholds are arbitrary constants with no calibration data or citation in the repo.

### 5.4 Which detectors are genuinely runnable vs stubs

**None of the three is a stub that "references an external service."** All three contain real, complete, callable implementations. The accurate split is about *dependencies and correctness*, not about stubbing:

- **`statistical.py` — genuinely runnable offline, right now, unconditionally.** Pure stdlib; imports cleanly with only `requirements.txt` installed. It is a hand-tuned heuristic, **not** a trained classifier, and its `[0,1]` output is not a calibrated probability.
- **`binoculars.py` — runnable only with the optional `[legacy]` extra installed, and only offline after the `gpt2` weights are cached; otherwise it performs a network download on first `score()`.** It is *not* the published Binoculars algorithm (single model, no perplexity ratio).
- **`roberta.py` — runnable only with the optional `[legacy]` extra; requires an HF Hub download; the hard-coded model id `roberta-base-openai-detector` (no org namespace) is likely unresolvable, so expect a load-time failure.**

There is **no stub** module, no `NotImplementedError`, no `pass`-body function, and no "TODO" detector anywhere in `src/`. What the docs overstate is *capability and fidelity*, not existence.

**The detectors are not on the production path.** `src/standard/pipeline.py` imports none of them (imports at `pipeline.py:15-21`). The showcase detection numbers are therefore **not** produced by this repo — see §9.

## 6. The `standard` pipeline

`src/standard/pipeline.py` is the whole production surface: 155 lines, one public function plus a Click CLI.

**The quoted pipeline step list** (`src/standard/pipeline.py:2-13`):

```
"""
Standard Pipeline v1.5.1 — Multi-language translation chain with LLM humanization.

Pipeline (4 steps):
  Step 1: Input (EN) → Chinese — DeepSeek humanization rewrite
  Step 2: Chinese → Japanese — DeepSeek humanization rewrite (with history)
  Step 3: Japanese → Finnish — Google Translate (first translation hop)
  Step 4: Finnish → Target (EN) — Niutrans (second translation hop)

This chain was selected after empirical testing against AI detectors on
50+ sample texts. See `examples/showcase/` for input/output traces of all
4 intermediate steps on 5 real samples.
"""
```

**Exact ordered steps as implemented** in `run_standard_pipeline(text, config, target_lang="en")` (`pipeline.py:24-109`):

1. **Resolve config** — `llm = resolve_llm_config(config)` (`pipeline.py:38`); `niutrans_key = config["api_keys"]["niutrans_api_key"]` (`pipeline.py:39`, a hard `KeyError` if the section/key is absent); `intermediate_lang = config.get("pipeline", {}).get("intermediate_lang", "fi")` (`pipeline.py:40`).
2. **Step 1 — LLM rewrite to Chinese:** `llm_rewrite(text=text, target_language="中文", ..., history=None, temperature=llm["temperature"], provider=llm["provider"])` (`pipeline.py:47-57`). Records `{"step": 1, "engine": engine_name, "direction": "Input → Chinese (中文改写)", "output": step1, "length": len(step1)}`.
3. **Step 2 — LLM rewrite to Japanese with history:** `llm_rewrite(text=step1, target_language="日语", history={"input": text, "output": step1}, ...)` (`pipeline.py:65-75`). Direction label `"Chinese → Japanese (日语改写)"`.
4. **Step 3 — Google Translate, Japanese → intermediate language:** `google_translate(step2, source="ja", target=intermediate_lang)` (`pipeline.py:83`), label `f"Japanese → {intermediate_lang.upper()} (一轮翻译)"`.
5. **Step 4 — Niutrans, intermediate language → target:** `niutrans_translate(step3, source=intermediate_lang, target=_lang_code_to_niutrans(target_lang), api_key=niutrans_key)` (`pipeline.py:91-96`), label `f"{intermediate_lang.upper()} → {target_lang.upper()} (二轮翻译)"`.
6. **Assemble result:** `{"result": step4, "steps": steps, "processing_time_ms": int((time.time() - start) * 1000)}` (`pipeline.py:103-109`).

**Inputs:** `text: str`, `config: dict` (a parsed TOML dict), `target_lang: str = "en"`.
**Output:** the dict above; `steps` is a list of 4 dicts each with keys `step, engine, direction, output, length`.

**The last-step language mapping** is a small lookup with passthrough for unknown codes (`pipeline.py:112-120`): `en, zh, ja, ko, fr, de, es, pt, ru, ar, it, nl, fi`.

**CLI** (`pipeline.py:123-151`): `--input` (required; if it names an existing file, the file is read `pipeline.py:133-135`), `--target` (default `en`), `--config` (default `config/config.toml`), `--output` (default stdout), `--verbose` (prints the per-step table `pipeline.py:140-144`).

**Where postprocessing / humanizing happens:**

- **There is no postprocessing step in the standard pipeline.** `src/standard/pipeline.py` never imports `PostProcessor`; grep for `postprocess` in `src/standard/` returns nothing. The only "humanizing" is the prompt inside `llm_rewrite` — `f"翻译为{target_language}，去掉 AI 味道，拟人化改写，只输出结果：\n{text}"` (`src/standard/llm_rewriter.py:38`) with system prompt `"你是一个专业的文案改写专家,精通多语言本地化。"` (`src/standard/llm_rewriter.py:9`).
- The AI-vocabulary/rhythm post-processing lives **only** in the legacy path: `src/methodologies/postprocess.py`, invoked by `DetectionGuidedProcessor.process` (`detection_pipeline.py:43`, `:58`, `:40`). It is never reachable from `src/standard/`.

**Doc/code mismatches found in this pipeline:**

- `README.md:65` and `README.md:97-101` advertise `standard`, `advanced`, `focus` tiers. **The tier concept exists only in the legacy `TranslationChainProcessor.TIERS`; `src/standard/pipeline.py` has no tier parameter at all** and the `--tier` CLI flag exists only on the legacy dispatcher (`src/methodologies/humanizer.py:107`).
- The "5-step" chain appears in `CHANGELOG.md:41` (v1.5.0) and is still what `n8n/humanize_standard.json` implements (steps Japanese→German→Spanish→English, i.e. 5 nodes, `n8n/humanize_standard.json:97-143`), while code and `docs/pipeline.md:9-25` are the 4-step FI chain. `CHANGELOG.md:31-36` admits the discrepancy was fixed in v1.5.1 for code and docs; the n8n asset was **not** updated. `docs/n8n-guide.md:35-38` still instructs users to configure "Step 4: German → Spanish" and "Step 5: Spanish → English".
- `docs/configuration.md:88` says "Niutrans API Key — Used for Steps 4-5 (translation)" — stale 5-step numbering.

## 7. Config surface

`config/config.example.toml` is 42 lines and is the complete shipped surface. Every key:

| Section | Key | Default | Meaning | Consumed at |
|---|---|---|---|---|
| `[general]` | `target_language` | `"en"` | Target language for final output (doc comment `config.example.toml:4-5`) | **Not read anywhere** — the pipeline takes `target_lang` as a function arg / `--target` CLI flag (`pipeline.py:24`, `pipeline.py:125`). Dead config. |
| `[general]` | `log_level` | `"info"` | `debug, info, warning, error` (`config.example.toml:6-7`) | **Not read anywhere** — no logging is configured in the codebase. Dead config. |
| `[api_keys]` | `deepseek_api_key` | `""` | Required when `llm.provider = "deepseek"` | `llm_client.py:14` → `llm_client.py:83` |
| `[api_keys]` | `openrouter_api_key` | `""` | Required when `llm.provider = "openrouter"` | `llm_client.py:20` → `llm_client.py:83` |
| `[api_keys]` | `atlascloud_api_key` | `""` | Required when `llm.provider = "atlascloud"` | `llm_client.py:26` |
| `[api_keys]` | `orcarouter_api_key` | `""` | Required when `llm.provider = "orcarouter"` | `llm_client.py:32` |
| `[api_keys]` | `niutrans_api_key` | `""` | Required for Step 4 (`二轮翻译`) | `pipeline.py:39` |
| `[llm]` | `provider` | `"deepseek"` | `"deepseek" \| "openrouter" \| "atlascloud" \| "orcarouter"` (`config.example.toml:22-23`); the code additionally accepts `"litellm"` (`llm_client.py:35-40`) though the comment and `docs/configuration.md:109` omit it | `llm_client.py:60` |
| `[llm]` | `base_url` | `""` | Empty = provider default; override for a custom OpenAI-compatible endpoint | `llm_client.py:72` |
| `[llm]` | `model` | `""` | Empty = provider default model slug | `llm_client.py:76` |
| `[llm]` | `temperature` | `1.3` | LLM sampling temperature for both rewrite steps | `llm_client.py:80` |
| `[llm]` | `http_referer` | `""` | OpenRouter attribution → header `HTTP-Referer` | `llm_client.py:106-107` |
| `[llm]` | `app_title` | `""` | OpenRouter attribution → header `X-Title` | `llm_client.py:108-109` |
| `[pipeline]` | `model` | `"deepseek-chat"` | Fallback if `[llm].model` empty; `[llm]` takes precedence (`config.example.toml:34-36`) | `llm_client.py:76` |
| `[pipeline]` | `temperature` | `1.3` | Fallback if `[llm].temperature` absent | `llm_client.py:80` |
| `[pipeline]` | `intermediate_lang` | `"fi"` | Intermediate language for the cross-engine hop Step 3→4; comment says tested alternatives are `"de"` (German), `"ko"` (Korean) (`config.example.toml:38-42`) | `pipeline.py:40` |

**Providers, base URLs and default models** (`src/standard/llm_client.py:10-41`):

| Provider | `base_url` default | `model` default | `display_name` |
|---|---|---|---|
| `deepseek` | `https://api.deepseek.com` | `deepseek-chat` | `DeepSeek` |
| `openrouter` | `https://openrouter.ai/api/v1` | `deepseek/deepseek-chat` | `OpenRouter` |
| `atlascloud` | `https://api.atlascloud.ai/v1` | `qwen/qwen3.5-flash` | `Atlas Cloud` |
| `orcarouter` | `https://api.orcarouter.ai/v1` | `deepseek/deepseek-chat` | `OrcaRouter` |
| `litellm` | `""` (SDK-routed) | `deepseek/deepseek-chat` | `LiteLLM` |

`DEFAULT_PROVIDER = "deepseek"` (`llm_client.py:43`). An unknown provider raises `ValueError(f"Unsupported LLM provider: {provider!r}...")` (`llm_client.py:64-68`). A missing API key raises `ValueError` unless the provider is `litellm` (`llm_client.py:99-103`). The base URL is normalized to end in `/chat/completions` (`llm_client.py:46-51`). Request timeout is **120s** with no retry logic (`llm_client.py:130`, `llm_client.py:161`).

**Environment overrides** (take precedence over TOML), in resolution order (`llm_client.py:61-97`):

| Variable | Effect | Line |
|---|---|---|
| `LLM_PROVIDER` | Overrides `[llm].provider` | `llm_client.py:61-62` |
| `LLM_BASE_URL` | Overrides base URL | `llm_client.py:73-74` |
| `LLM_MODEL` | Overrides model slug | `llm_client.py:77-78` |
| `LLM_API_KEY` | Generic key override (checked first) | `llm_client.py:85-86` |
| `OPENROUTER_API_KEY` | Key when provider is `openrouter` | `llm_client.py:87-88` |
| `DEEPSEEK_API_KEY` | Key when provider is `deepseek` | `llm_client.py:89-90` |
| `ATLASCLOUD_API_KEY` / `ATLAS_CLOUD_API_KEY` | Key when provider is `atlascloud` | `llm_client.py:91-95` |
| `ORCAROUTER_API_KEY` | Key when provider is `orcarouter` | `llm_client.py:96-97` |
| `CONFIG_PATH` | Docker-only config path | `docker-compose.yml:13` → `src/methodologies/humanizer.py:81` |

**Config sections read only by legacy code, absent from `config.example.toml`:** `[translation_chain]` (`chain` default `["zh-CN","ja","fi"]`, `engines` default `["google","mymemory"]` — `translation_chain.py:19-21`), `[llm_rewrite]` (`top_p` 0.9, `rounds` 2 — `llm_rewriter.py:38-39`), `[detection_guided]` (`max_feedback_rounds` 2, `threshold` 0.5, `enable_gpu` True — `detection_pipeline.py:19-21`), `[mixed_engine]` (`engines` default `["google","mymemory"]`, `strategy` default `"best_score"` — `mixed_engine.py:15-16`), `[postprocess]` (`replace_ai_vocab` True, `disrupt_rhythm` True, `short_sentence_threshold` 8 — `postprocess.py:42-45`), and `[general].default_method` read by the dispatcher (`humanizer.py:41`). Copying `config.example.toml` and running the legacy dispatcher therefore yields `KeyError: 'general'`/`KeyError: 'default_method'` unless those keys are added.

**Thresholds that exist at all:** LLM `temperature` 1.3 (config), `detection_guided.threshold` 0.5 (code default), `postprocess.short_sentence_threshold` 8 (code default), `llm_rewrite.top_p` 0.9 (code default), plus the hard-coded detector squashing constants in §5. No threshold is exposed for the standard pipeline.

## 8. Techniques and rules

Extracted from `docs/techniques.md` and `docs/research-notes.md`. Each item is tagged with whether it is **implemented in code** (I), **documented only** (D), or **implemented in a simplified/different form** (S). Names are kept exactly as written in the docs where they are named; where the doc gives only a description I state that explicitly rather than inventing a name.

### From `docs/techniques.md` — Method 1 (Multi-Language Translation Chain)

1. **Multi-Language Translation Chain** — the core named technique (`techniques.md:13`). **I** (standard 4-step chain), **I** (legacy `TranslationChainProcessor`).
2. **Distant language pairs** — "chaining translations through **distant language pairs**" (`techniques.md:19`). **I** as a mechanism (fixed `zh-CN, ja, fi`), no distance metric computed.
3. **Structural transformation per language** — Chinese "Subject-verb-object reordering, removal of articles"; Japanese "SOV word order, particle-based grammar"; Finnish "Agglutinative morphology, 15 grammatical cases" (`techniques.md:28-30`). **D** as a rule set (this is a rationale, not code).
4. **Processing tiers** — **Standard** "3-language chain (EN → ZH → JA → EN)", **Advanced** "4-language chain with mixed engines", **Focus** "5-language chain with post-processing refinement" (`techniques.md:45-47`). **S** — `TIERS = {"standard": 3, "advanced": 4, "focus": 5}` exists (`translation_chain.py:12-16`) but the tier list in the doc does not match the implementation (see §4.1), and the production pipeline has no tiers.
5. **Engine selection by strength** — Google Translate "Highest fluency"; Niutrans "Academic terminology"; MyMemory "Translation memory integration"; Apertium "Rule-based, predictable transforms" (`techniques.md:36-41`). **D** — `Apertium` appears nowhere in code; Niutrans is used only in the production pipeline, not in the legacy chain processor.

### From `docs/techniques.md` — Method 2 (Multi-Turn LLM Rewriting)

6. **Multi-Turn LLM Rewriting** (`techniques.md:57`). **I** (`LLMRewriteProcessor`, max 3 rounds).
7. **Round 1 — Structural Variation** (`techniques.md:65`). **I** as `REWRITE_PROMPTS[0]` (`llm_rewriter.py:15-18`).
8. **Burstiness / sentence length diversity** — "Rewrite with focus on sentence length diversity (burstiness)" and "Alternate between short (3–8 words) and long (25–40 words) sentences" (`techniques.md:66-67`). **I** as prompt text only; **no burstiness is measured anywhere in the repo** (grep: "burstiness" appears in prose only — `techniques.md:66`, `techniques.md:90`, `lynote-comparison.md:14`, `lynote-comparison.md:22`, `pipeline.md:37`).
9. **Paragraph-level structural changes** (`techniques.md:68`). **D** — not in any prompt.
10. **Round 2 — Vocabulary & Style** (`techniques.md:70`). **I** as `REWRITE_PROMPTS[1]` (`llm_rewriter.py:20-22`).
11. **Colloquial expression insertion** — "Add colloquial expressions where appropriate" (`techniques.md:72`). **I** (prompt text: "replace any formal or academic vocabulary with everyday equivalents").
12. **Rhetorical devices** — "Introduce rhetorical devices (questions, asides, qualifiers)" (`techniques.md:73`). **I** as prompt text ("Add rhetorical questions or brief asides where they feel natural").
13. **Round 3 (Optional) — Context Refinement** — "Cross-reference with original for semantic accuracy", "Fine-tune transitions and logical flow", "Final naturalness pass" (`techniques.md:75-78`). **S** — `REWRITE_PROMPTS[2]` only does the "final polish / transitions / no three consecutive similar-length sentences" part (`llm_rewriter.py:24-26`); it never sees the original, so cross-referencing is not implemented.
14. **Temperature 1.1–1.3** (`techniques.md:84`) / **Top-p 0.9** (`techniques.md:85`) / **Rounds 2–3** (`techniques.md:86`). **I** (`temperature` via config, `top_p` default 0.9, `rounds` default 2).
15. **Concrete examples instead of abstract statements** (`techniques.md:92`). **D** — not in any prompt.
16. **Break uniform rhythm patterns that AI detectors flag** (`techniques.md:93`). **I** as prompt intent; the only *measured* rhythm rule is the "no three consecutive sentences have similar length" instruction (`llm_rewriter.py:25-26`).

### From `docs/techniques.md` — Method 3 (Detection-Guided Feedback Loop)

17. **Detection-Guided Feedback Loop** (`techniques.md:104`). **S** — the loop exists but with no LLM rewrite and no real re-detection gate (§4.3).
18. **Rewrite → detect → identify weak spots → re-rewrite closed loop** (`techniques.md:108`). **S** — the "re-rewrite" is `PostProcessor` only.
19. **Binoculars** as a detection signal — "Uses GPT-2 with two different decoding heads to measure perplexity ratio. Low ratio = likely AI-generated." (`techniques.md:136`). **S/misnamed** — single GPT-2 perplexity, no ratio (§5.1).
20. **RoBERTa Classifier** — "Fine-tuned binary classifier on AI vs. human text datasets." (`techniques.md:137`). **S** — points at a third-party 2019 HF model, no local fine-tuning (§5.2).
21. **Statistical Features** — "Sentence length variance, vocabulary richness (TTR), n-gram diversity." (`techniques.md:138`). **S** — variance and TTR implemented; **n-gram diversity absent**.
22. **Diversity Metrics** — "Unique token ratio, hapax legomena count, Yule's K measure." (`techniques.md:139`). **S** — unique token ratio and hapax count implemented; **Yule's K absent**.
23. **AI Vocabulary Replacement** — "30+ English signal words (e.g., 'utilize' → 'use', 'facilitate' → 'help', 'comprehensive' → 'full')" (`techniques.md:144`). **I** — `AI_VOCAB_REPLACEMENTS` has exactly **30 entries** (`postprocess.py:6-37`); count is accurate.
24. **Chinese boilerplate phrase replacement** — "11+ Chinese boilerplate phrases with natural alternatives" (`techniques.md:145`). **D — absent.** There is no Chinese vocabulary dictionary anywhere in the repo; `AI_VOCAB_REPLACEMENTS` is English-only.
25. **Sentence Rhythm Disruption** (`techniques.md:147`). **I** as `_disrupt_sentence_rhythm`.
26. **Merge consecutive short sentences** — "Merge consecutive short sentences (< 8 words each) into compound sentences" (`techniques.md:148`). **I** exactly, using `short_sentence_threshold` = 8, joined with an em dash (`postprocess.py:64-69`).
27. **Detect and break 3+ sentence uniform-length patterns** (`techniques.md:149`). **D — absent** from `_disrupt_sentence_rhythm` (it only merges pairs of short sentences; it never lengthens/splits a uniform run).
28. **Insert transitional variety** — "short interjection, question, aside" (`techniques.md:150`). **D — absent** from the post-processor (it appears only as an LLM prompt instruction).
29. **Maximum 2 feedback rounds** (`techniques.md:156`). **I** (`max_feedback_rounds` default 2).

### From `docs/techniques.md` — Method 4 (Mixed-Engine Translation)

30. **Mixed-Engine Translation** (`techniques.md:161`). **I** (`MixedEngineProcessor`).
31. **Distribution shift** — "the result doesn't match the fingerprint of any single model" (`techniques.md:165`). **D** — explanatory framing only.
32. **Segment-level best-of-N engine selection** (`techniques.md:172`). **I** — per-sentence, best `_score_naturalness`.
33. **Naturalness scoring** (`techniques.md:172`). **I** — a 2-term heuristic (`mixed_engine.py:28-35`).
34. **Vocabulary diversity as a selection criterion** (`techniques.md:173`). **I** — `unique_ratio` term.
35. **Structural difference from the original as a selection criterion** (`techniques.md:174`). **D — absent.**
36. **Engine combinations** — "Google + DeepL", "Niutrans + Apertium", "Google + MyMemory + Apertium" (`techniques.md:181-183`). **D — absent**; DeepL and Apertium are never referenced in code.

### From `docs/research-notes.md`

37. **The style-vs-structure distinction** — "Most detectors key on **surface style** ... Style is highly discriminative but **brittle** ... StoryScope isolates a second, **structural** signal that survives style edits — *discourse-level narrative features* (plot shape, character agency, temporal structure)" (`research-notes.md:18-23`). **D** — this is the document's central claim and it is explicitly *not* implemented; `research-notes.md:44-50` says the repo's own Standard Pipeline "is fundamentally a **style / lexical transform**" that "does **not** restructure the narrative".
38. **Discourse-level narrative features** (plot shape, character agency, temporal structure) (`research-notes.md:21-23`). **D / E (research-only).**
39. **Style laundering** — "Fine-tuning a model to mimic human **style** drops creative-writing AI detection from **97% → 3%** (Chakrabarty et al., 2026)" (`research-notes.md:36`). **D / E.**
40. **Narrative-feature classification** — "A **narrative-feature** classifier still catches those same style-laundered stories at **93.9%**" (`research-notes.md:39`). **D / E.**
41. **Narrative-feature core sets** — "Narrative features only (no style) 93.2%", "Narrative, compact 30-feature core 84.8%" (`research-notes.md:29-31`). **D / E.**
42. **Human-vs-AI narrative differentiators** — "integrate subplots into the central theme more often (42% vs 21%)"; "give protagonists morally ambiguous choices more often (59% vs 38%)"; "use more locations, more dialogue relative to narration, and nonlinear time (flashbacks, discontinuity)" (`research-notes.md:59-62`). **D / E.**
43. **Model fingerprints for attribution** — "Claude → flat event escalation, GPT → gossip as a plot device, Gemini → external character description" (`research-notes.md:65-67`). **D / E.**
44. **Model rarity percentile** — "mean rarity percentile 0.71 human vs 0.49 AI" (`research-notes.md:56`). **D / E.**

### Summary of the rule inventory

- Named, implemented, and reachable in the **legacy** path: items 1, 2, 6, 7, 10, 11, 12, 14, 23, 25, 26, 29, 30, 32, 33, 34.
- Named and implemented but on the **production** path: item 8/16 (as prompt instructions inside `src/standard/llm_rewriter.py:38`).
- Documented but **absent from code**: items 4 (partially), 5, 9, 15, 21 (n-gram diversity), 22 (Yule's K), 24, 27, 28, 35, 36.
- Research-only, explicitly not implemented: items 37–44.

## 9. Scoring / evaluation

**In-repo runtime scoring: essentially none for the production path.**

- `src/standard/`: the only numeric output is `processing_time_ms` (`pipeline.py:103`, `pipeline.py:108`). No quality score, no detection score, no feedback loop.
- The one genuine scoring function in the codebase is `MixedEngineProcessor._score_naturalness` (`src/methodologies/mixed_engine.py:28-35`), quoted in full in §4.4. It is used only to pick between two translation engines inside the legacy Method 4 and is never surfaced to the caller.
- The three detectors produce scores (`binoculars.py:34`, `roberta.py:26-27`, `statistical.py:39`) that are averaged in `DetectionGuidedProcessor._detect` (`detection_pipeline.py:31-37`) and thresholded at `0.5` (`detection_pipeline.py:51`). This is the only detection-feedback loop in the repo, and it exists **only in the legacy Method 3**, never in `src/standard/`.

**The headline numbers in the docs are not produced by this codebase.** `docs/pipeline.md:74-80` states:

```
We ran the pipeline end-to-end on 5 input texts across diverse topics ... and saved every intermediate step output.

**Results:** All 5 final outputs were classified as `human` by the AI detector. Confidence scores ranged from 0.7218 to 0.9997.
```

The detector responsible is never named in-repo and is not one of the three bundled detectors (none of them is invoked by the standard pipeline). `README.md:15` links "Try the detector" to `https://github.com/lynote-ai/ai-text-detector`, and `README.md:285-287` lists it as "Lynote AI Detector — sentence-level scoring, free". So the showcase confidences are **external, unverifiable-in-repo, vendor-produced** measurements. `README.md:194` and `README.md:281` acknowledge this is "not a guarantee — detection is probabilistic and varies by detector and version". The per-example values are in `examples/showcase/example_0{1..5}.md:3` (0.9997, 0.9982, 0.7810, 0.9924, 0.7218).

**Static quality metrics** are claimed once, with no methodology and no data file: `README.md:208-224` reports an expert evaluation on 50 text pairs — Information Completeness 10.0, Language Fluency 9.0, Style Adaptability 8.8, Readability 9.2, Creativity & Impact 8.5, **Overall 9.1**, "Key Information Retention: 100% (50/50 pairs)". `CHANGELOG.md:47` repeats "Quality metrics from expert evaluation on 50 text pairs (9.1/10 overall)". No annotation guide, rater count, inter-rater agreement, or raw scores ship in the repo (no such files exist — the 7 `.txt` files are all single-paragraph text samples).

**Baseline detection feedback worth noting from research-notes** (`research-notes.md:25-31`) is a table of *cited third-party* macro-F1 numbers (ModernBERT full-text 99.9%, style features 85.8%, narrative features 93.2%, narrative on LAMP 93.9%, compact 30-feature core 84.8%) — these are StoryScope paper results, not measurements of this repo.

## 10. Voice / stylometry / personal-style capability

**Personal-style / voice-matching capability: none found.**

- No voice profile, persona, author-idiolect, style-transfer, or speaker-similarity code exists. Grepping the tree for `voice|persona|idiolect|style transfer` yields only prose uses of the word "voice" in `README.md:279` ("the deeper tiers trade more of your original voice for more restructuring") and `docs/techniques.md:199` / `lynote-comparison.md:44` ("Preserves voice and style best" / "preserving voice matters"). There is no data structure, config key, or parameter carrying a voice.
- The only *stylometric* computation in the repo is `StatisticalDetector` — TTR, sentence-length CV, hapax ratio (`statistical.py:18`, `:22-25`, `:32`). These are **detection** features (aggregate uniformity signals), not a voice fingerprint, and they are not persisted or compared against a reference author.
- The only per-user style *input* surface is a free-text LLM instruction: the `REWRITE_PROMPTS` list (`llm_rewriter.py:15-27`) and the fixed Chinese prompt in `src/standard/llm_rewriter.py:38`. A caller cannot inject a voice description through config or API; doing so would require editing source.
- `docs/research-notes.md:71-74` explicitly frames the future direction as "edits have to reach the **structural** layer — reorder chronology, build real subplot / theme interplay, introduce moral ambiguity" and says this is "why serious work here is model-based, not rule- or translation-based". That is stated as **not** what the released code does.

**Implication for `human-voice-suite`:** this repo contributes nothing to a voice/profile axis. Any "voice" abstraction must come from elsewhere in the upstream set; this repo can only supply detector features and methodology strategy.

## 11. Reusable modules

| module (file) | what it does | reuse recommendation | integration kind |
|---|---|---|---|
| `src/methodologies/detectors/statistical.py` | Offline, dependency-free heuristic detector: TTR + sentence-length CV + hapax ratio → `[0,1]` AI-likelihood (`statistical.py:8-39`) | **Best value in the repo.** Copy/port verbatim as a zero-cost, always-available signal. Do **not** present its output as a calibrated probability, and recalibrate the hard-coded thresholds (0.7/0.3, 0.5/0.3, 0.6/0.3) rather than trusting them. | **A** = executable detector (adapter) |
| `src/methodologies/detectors/binoculars.py` | Single-GPT-2 perplexity heuristic mislabelled as Binoculars (`binoculars.py:21-35`) | Port only as an *optional* perplexity feature behind a capability flag. Rename it honestly (it is not Binoculars) and fix the missing `self.tokenizer` initialization path. Prefer implementing real Binoculars (observer/performer ratio) over reusing this. | **A** (adapter), with a correctness caveat |
| `src/methodologies/detectors/roberta.py` | `transformers` text-classification pipeline on an external 2019 OpenAI detector (`roberta.py:16-27`) | Low priority. Requires torch + an HF download, has a likely-broken bare model id, and is a 2019 model with known noise. If adopted, pin a resolvable model id and validate label polarity before trusting scores. | **A** (adapter), low priority |
| `src/methodologies/postprocess.py` | `AI_VOCAB_REPLACEMENTS` (30 exact entries, `postprocess.py:6-37`) + `_disrupt_sentence_rhythm` short-sentence merger (`postprocess.py:55-74`) | **High value as rule candidates.** The dictionary is a concrete, auditable list to normalize into the canonical registry. Note: replacement is `count=1` per word with a random pick (`postprocess.py:48-52`) — make it deterministic and exhaustive on import. The rhythm rule merges with an em dash (`postprocess.py:67`), which is itself an AI-text tell — reconsider that joining character. | **B** = rules originally shipped as code (parse/normalize into rules); this file is code, not markdown, but treat its content as a rule set |
| `src/methodologies/llm_rewriter.py` | Three fixed English rewriting prompts (`llm_rewriter.py:15-27`) + round loop | **High value.** The prompt texts are directly extractable as discrete rule statements (vary sentence length 3–8 / 25–40 words; replace formal vocabulary; add rhetorical questions and asides; no three consecutive similar-length sentences; smooth transitions). Rewrite as declarative rules rather than opaque prompts. | **B** = rule text to parse into rules |
| `src/standard/llm_rewriter.py` | The single production prompt (`llm_rewriter.py:38`) and system prompt (`:9`) plus history-carrying message construction (`:42-52`) | Reuse the *technique* of carrying the prior round as conversation history to prevent reversion — that is a genuinely useful orchestration pattern. The Chinese prompt string itself is a candidate rule but is language-specific and very terse. | **B** (prompt → rules) and pattern reference for history threading |
| `src/standard/pipeline.py` | The 4-step production orchestration + CLI + step-trace result dict (`pipeline.py:24-151`) | Do **not** place in the default execution path: it requires a paid LLM key *and* a Niutrans key *and* Google's free endpoint, is nondeterministic at temperature 1.3, and per its own docs degrades terminology (`README.md:279`). Keep as an opt-in "restructure" strategy with explicit cost/latency disclosure. | **D** = methodology (pipeline strategy; not in default execution path) |
| `src/standard/llm_client.py` | Multi-provider OpenAI-compatible client, config+env resolution, URL normalization, optional LiteLLM routing (`llm_client.py:10-191`) | Reuse the **config-resolution and env-precedence design** (provider presets table, `LLM_*` overrides, URL normalization) as a pattern. Do not reuse the module wholesale: it has no retries, one 120s timeout, no streaming, no token accounting, and no rate-limit handling. | **D** (supporting infrastructure for a non-default strategy) or re-implement; not a detector, skill, or voice profile |
| `src/standard/translators.py` | Google Translate via `deep_translator` with 4500-char sentence-boundary chunking (`translators.py:7-25`, `_split_text` `:61-79`); Niutrans POST client (`:28-58`) | The `_split_text` chunker is small, clean, and independently reusable for any MT hop. The rest is thin API glue. Note `_split_text` can emit an over-length chunk when a single sentence exceeds `max_len` (the `if current:` branch drops nothing, but a lone long sentence becomes its own chunk unchecked). | **D** (only if a translation strategy is adopted) |
| `src/methodologies/detection_pipeline.py` | Detection-in-the-loop orchestration (`detection_pipeline.py:42-62`) | Reuse the *shape* (segment → score → threshold → target → re-score) as a design for a real feedback loop, but implement the rewrite stage properly — here it is only the post-processor. | **D** |
| `src/methodologies/mixed_engine.py` | Per-sentence best-of-N round-trip engine selection with a 2-term heuristic scorer (`mixed_engine.py:28-61`) | Reuse `_score_naturalness` as a cheap candidate-ranking heuristic if multiple rewriters are ever compared. The rest is hard-coded to `zh-CN` (`mixed_engine.py:38`) and swallows all exceptions (`:56-57`). | **D** |
| `src/methodologies/translation_chain.py` | Tiered multi-hop translation loop with round-robin engine selection (`translation_chain.py:30-45`) | Low value; superseded by the standard pipeline's fixed chain. Slight reuse value as a pattern for engine round-robin. | **D** |
| `src/methodologies/humanizer.py` | Method dispatcher via `importlib`, dataclass result, optional FastAPI app (`humanizer.py:22-99`) | Reuse the registry-dispatch pattern only. The FastAPI app is a reference demo, not a production surface (no auth, no input limits, binds `0.0.0.0`, `humanizer.py:118`). | **D** |
| `docs/techniques.md` | Method-level technique descriptions incl. 30+ signal-word examples and the 3 rhythm rules (`techniques.md:141-150`) | Mine for rule names and the vocabulary examples. Treat every quantitative claim as unverified. | **B** = markdown technique source to parse into rules |
| `docs/research-notes.md` | StoryScope reading notes: style-vs-structure, narrative feature families, model fingerprints (`research-notes.md:16-82`) | Do **not** copy as rules; the features target ~5,000-word fiction and the doc itself warns the list does not transfer 1:1 (`research-notes.md:79-82`). Keep as design rationale/roadmap evidence only. | **E** = research-only (do not copy) |
| `n8n/humanize_standard.json` | Importable no-code workflow | **Do not reuse as-is** — it implements the stale 5-step DE→ES chain (`humanize_standard.json:97-143`) that `CHANGELOG.md:31-36` says was replaced, and it embeds the prompt strings and a placeholder `YOUR_NIUTRANS_KEY`. Only useful as a reference for how the chain is expressed outside Python. | **D** / stale artifact |
| `examples/showcase/*.md`, `examples/legacy/comparison/*.txt` | Sample inputs and intermediate outputs | Useful purely as **test fixtures / golden inputs** (e.g. `original.txt` is a compact AI-sounding paragraph). No rules to extract. | **E** as rules; usable as fixtures |
| `tests/test_smoke.py`, `tests/test_llm_client.py` | Import-surface and config-resolution tests | Reuse the *test strategy* (no-network tests for config precedence) as a pattern for the suite's own config resolver. Not portable code. | **E** (pattern reference) |

## 12. Tests and CI

**`tests/test_smoke.py` (116 lines, 12-ish tests).** Header is explicit: `"""Smoke tests — no API keys required. ... They do NOT make any network calls."""` (`test_smoke.py:1-9`). Actual coverage:

1. `test_version_string_is_set` — `src.__version__` exists, is a `str`, and has exactly two dots (`test_smoke.py:20-24`).
2. `test_standard_package_public_surface` — the four `src.standard` exports are callable (`test_smoke.py:27-38`).
3. `test_methodologies_modules_import` — parametrized over `humanizer`, `translation_chain`, `llm_rewriter`, `mixed_engine`; **`detection_pipeline` is deliberately excluded** because it needs `transformers`/`torch` (`test_smoke.py:41-53`).
4. `test_humanizer_dispatcher_has_four_methods` — the `Humanizer.METHODS` key set equals the expected four (`test_smoke.py:56-63`).
5. `test_lang_code_mapping_known_codes` / `..._passthrough_for_unknown` — `_lang_code_to_niutrans` for `en/zh/fi` and the `xx` passthrough (`test_smoke.py:70-79`).
6. `test_split_text_respects_max_length` / `..._short_input_single_chunk` — the chunker under a 1000-char cap and the single-chunk short case (`test_smoke.py:82-94`).
7. `test_showcase_examples_exist` — asserts exactly 5 `example_*.md` files, each containing "Step 1".."Step 4" and the lowercase string `human` (`test_smoke.py:101-116`).

**Network/API-key requirement:** none. Everything is import-surface or pure-function. **Caveat:** test 3 imports the methodology modules, and `src/methodologies/llm_rewriter.py:9` imports `src.standard.llm_client`; that module imports only `os`, `typing` and `httpx` (`llm_client.py:5-8`) — no network at import time. So the suite is genuinely offline. **Second caveat:** `test_showcase_examples_exist` passes by string-matching the literal word "human" in the example markdowns (`test_smoke.py:115-116`); it asserts nothing about the *pipeline*, only that the doc says what the doc says. It is a docs-integrity test, not a quality test.

**`tests/test_llm_client.py` (179 lines).** Header: `"""Unit tests for LLM client config resolution (no network)."""` (`test_llm_client.py:1`). It loads `src/standard/llm_client.py` by file path via `importlib.util.spec_from_file_location` (`test_llm_client.py:8-11`) rather than importing the package — a deliberate bypass so the package does not need installing. Coverage is entirely `resolve_llm_config` + `normalize_chat_completions_url`:

- DeepSeek defaults and backward-compat with `[pipeline].model`/`temperature` (`:17-28`);
- OpenRouter, Atlas Cloud, OrcaRouter provider presets incl. base URL, model and `display_name` (`:31-67`);
- `[llm].base_url` override (`:70-79`);
- `[llm]` precedence over `[pipeline]` (`:82-90`);
- env overrides `LLM_PROVIDER`/`LLM_BASE_URL`/`OPENROUTER_API_KEY`/`LLM_MODEL` (`:93-106`);
- `LLM_API_KEY` beating the provider-specific key (`:109-115`);
- `ATLASCLOUD_API_KEY` and `ORCAROUTER_API_KEY` (`:118-135`);
- missing key raises `ValueError("Missing API key")` (`:138-140`);
- unsupported provider raises `ValueError("Unsupported LLM provider")` (`:143-148`);
- URL normalization incl. the already-suffixed passthrough (`:151-163`);
- OpenRouter attribution headers (`:166-179`).

**Network/API-key requirement:** none — keys are dummy literals, and no HTTP call is made.

**`.github/workflows/ci.yml` (28 lines).** Triggers: push to `main`, all `pull_request`, `workflow_dispatch` (`ci.yml:3-7`). Permissions: `contents: read` (`ci.yml:9-10`). One job `test` on `ubuntu-latest`, matrix `python-version: ["3.10", "3.12"]` with `fail-fast: false` (`ci.yml:13-18`). Steps: `actions/checkout@v4`; `actions/setup-python@v5` with `cache: pip`; install `python -m pip install --upgrade pip pytest && python -m pip install -e .`; run `python -m pytest -q` (`ci.yml:19-28`).

**CI gaps worth recording:** it installs **only** the base deps (`-e .`) — never `.[legacy]` or `.[litellm]` — so the three detectors and `detection_pipeline` are **never imported or exercised by CI**. There is no lint step, no type check, no coverage gate, no build/publish step, and no Python 3.11 in the matrix despite it being a declared classifier (`setup.py:50`). Nothing in CI touches the network, so the API-dependent production path has zero automated verification.

## 13. License and provenance

**Declared license:** MIT. `LICENSE:1` = `MIT License`; `LICENSE:3` = `Copyright (c) 2026 Lynote.ai`. `setup.py:48` declares `"License :: OSI Approved :: MIT License"` and `setup.py:55` `license="MIT"`. `README.md:290-292` states "MIT License. See [LICENSE](LICENSE) for details."

**Declared derivation / third-party provenance:**

- **No statement anywhere claims this project is derived from, forked from, or vendored from another codebase.** `grep` for `derived|derivative|fork|inspired` across the tree returns exactly two hits, neither a provenance claim: `CONTRIBUTING.md:7` ("**Fork** the repository" — contributor instructions) and `CHANGELOG.md:58` ("Binoculars-inspired", see below).
- The only explicit "inspired by" statement is about an **academic method, not a codebase**: `CHANGELOG.md:58` — `**Method 3: Detection-Guided Feedback Loop** (`src/detection_pipeline.py`, `src/detectors/`) — Binoculars-inspired + RoBERTa scoring loop`. There is no attribution text, citation, or license notice for the Binoculars authors or for OpenAI's RoBERTa detector anywhere in the repo, even though `src/methodologies/detectors/binoculars.py:1` and `roberta.py`-based code invoke those names. The referenced models are pulled from the HF Hub at runtime (`binoculars.py:17-18`, `roberta.py:18`), so their own licenses are not vendored or re-licensed here — but no NOTICE file exists.
- **Research provenance is documented but explicitly framed as reading notes, not as an implementation basis:** `docs/research-notes.md:1-6` — "Short field notes on the detection research that shapes how we think about humanization ... These are our reading notes, not the authors' claims; see the primary source for the authoritative version." Primary source named at `research-notes.md:8-12`: *StoryScope: Investigating idiosyncrasies in AI fiction* — Russell, Rajendhran, Pham, Iyyer (UMD) & Wieting (Google DeepMind), COLM 2026, with links to arXiv `2604.03136` and `github.com/jenna-russell/storyscope`. Note `research-notes.md:9` dates the paper to COLM 2026 and the arXiv id `2604.03136` is consistent with an April 2026 submission.
- A separate open-source project is referenced as a *predecessor / contrast*, not an ancestor: `docs/faq.md:3-5` — "### What's the difference between this repo and ai-humanize? / [ai-humanize](https://github.com/molly554/ai-humanize) documents 4 theoretical approaches. This repo (`humanize-text`) provides the **actual working Standard pipeline** with real code you can run." `CHANGELOG.md:19` records that `docs/installation.md` used to point at `molly554/ai-humanize` and was corrected to `lynote-ai/humanize-text` in v1.5.2 — indicating a copy-paste lineage from that earlier repo, at minimum of documentation text.
- **`docs/lynote-comparison.md` claims nothing about code lineage.** Its full content (`lynote-comparison.md:1-93`) is a product-positioning comparison between "the open-source toolkit" and the hosted Lynote.ai service. What it claims, precisely:
  - It frames the repo as **4 methods that are used one at a time**, each disrupting one detection dimension (`lynote-comparison.md:5-14`), and that single methods hit a ceiling (`:16-26`).
  - It claims Lynote.ai is different via "**intelligent orchestration**": "Automatic Text Analysis" (content type, length/structure, language pair, likely detection signals — `:32-38`), "Dynamic Method Selection" per passage (`:40-45`), "Cross-Method Optimization" (`:47-52`), and "Proprietary Enhancements" — "Extended signal word databases (updated continuously)", "Language-specific rhythm models", "Content-type-aware processing profiles", "Continuous calibration against evolving commercial detectors" (`:54-60`).
  - Its feature table (`:62-75`) asserts, for the open-source column: "Methods available 4 (one at a time)", "Method selection Manual — you choose", "Detection models Local (Binoculars + RoBERTa)", "Signal word database Static (included in repo)", "Suitable for Research, learning, experimentation"; and for Lynote.ai: "All 4 + proprietary optimizations", "Continuously updated detection layer", "None — browser or API", "10+ out of the box", "Production use, real-world content".
  - **None of this names, alludes to, or compares against `lynote-ai/dsh-humanizer` or any other repository.** The only comparison axis is "open-source toolkit" vs "Lynote.ai (the hosted product)".
  - It closes with two calls to action (`:85-93`).
  - Note this document is the **most stale** in the repo relative to code: it describes "4 methods (one at a time)" as the open-source surface, but the repo's own recommended path is the single 4-step Standard Pipeline (`docs/pipeline.md:3`), which is itself a combination of Method 1 + Method 2. So the "Manual — you choose" framing no longer matches `src/standard/`.
- **Relationship to `lynote-ai/dsh-humanizer`: none found.** A case-insensitive grep for `dsh`, `dsh-humanizer`, and `plugin` across every text file in the repository returns matches only for unrelated substrings (`CHANGELOG.md:58` "Binoculars-inspired"; `CONTRIBUTING.md:7` "**Fork** the repository"). There is no mention of DSH, no TypeScript/JavaScript file, no npm/`package.json`, no BSD-3-Clause notice, and no `lynote-ai` GitHub organization cross-reference beyond this repo's own URLs (`setup.py:11-16`). The only shared `lynote-ai` product references are `lynote-ai/ai-text-detector` (`README.md:15`, `README.md:285`) and the `Lynote/free-ai-detector` HF Space (`README.md:13`, `:287`) — **not** `dsh-humanizer`.

**Provenance-related red flags to carry forward:** (a) the borrowed vocabulary and structure of `docs/techniques.md` / `docs/lynote-comparison.md` originates from the earlier `molly554/ai-humanize` project (`faq.md:5`, `CHANGELOG.md:19`), which is a separate upstream not in our inventory list; (b) the `presentation/ai-humanizer-banner.png` filename (5.7MB asset directory) also echoes the `ai-humanizer` name, hinting at a rebranded lineage; (c) `n8n/humanize_standard.json:2` names the workflow `"AI Humanize - Standard Pipeline v1.5"` and the `docker-compose.yml:4` service is named `ai-humanizer`.

## 14. Overlap and duplication signals

Comparison target: **`lynote-ai/dsh-humanizer`** (same owner `lynote-ai`, TypeScript DSH plugin, BSD-3-Clause, Copyright 2026 lynote-ai).

**Verdict: no verifiable shared lineage from this repo's side. Zero direct evidence of shared rule definitions, rule ids, terminology artifacts, or a shared config schema.**

Evidence, item by item:

1. **No mention of DSH anywhere.** Case-insensitive search for `dsh` / `dsh-humanizer` / `plugin` over all 67 text files: no hit referring to the DSH plugin. `docs/lynote-comparison.md` — the document whose title most invites such a comparison — compares only against the hosted Lynote.ai service and never mentions another repository (`lynote-comparison.md:1-93`).
2. **No shared rule identifiers.** This repo defines **no rule ids at all.** The vocabulary rules are a bare Python dict with plain English keys (`postprocess.py:6-37`, e.g. `"utilize"`, `"facilitate"`, `"comprehensive"`), and the technique names are prose headings (`techniques.md:13`, `:57`, `:104`, `:161`). There is no id namespace, no numbering scheme, and no machine-readable rule file (no YAML/JSON/TOML rule registry exists in the tree). Consequently there is nothing that *could* collide with dsh-humanizer's rule ids — and equally, nothing here that can be de-duplicated by id. **The only concrete duplication check possible is term-level.**
3. **No shared config schema.** This repo's config is a 42-line TOML with sections `[general] [api_keys] [llm] [pipeline]` (`config/config.example.toml:3-42`) plus legacy-only `[translation_chain] [llm_rewrite] [detection_guided] [mixed_engine] [postprocess]` read in code. It is a Python/`toml`-library schema. There is no JSON Schema, no TypeScript types, and no `package.json`. A TypeScript DSH plugin cannot consume it without an adapter.
4. **Terminology overlap is real but is attributable to the shared domain, not to a shared codebase.** Overlapping vocabulary between the two repos exists in the general sense of the AI-detection domain: `humanize`, `detector`, `burstiness`, `perplexity`, `AI vocabulary`, `sentence rhythm`. Crucially, **the terms this repo emits most distinctively are its own Chinese-internal labels and its translation-chain framing** — `中文改写` / `日语改写` / `一轮翻译` / `二轮翻译` (`pipeline.py:60`, `:78`, `:86`, `:99`) and "Standard / Advanced / Focus" tiers (`README.md:63-67`, `docs/techniques.md:43-47`). A shared lineage would most plausibly show up as shared tier names or shared rule numbering; neither is present here.
5. **What *is* demonstrably shared is the vendor's own branding and the "Lynote.ai vs open source" narrative**, which is owner-level, not code-level: `README.md:79-83` and `README.md:95-108` position this repo as "Standard tier only" and Lynote.ai as the superset; `docs/lynote-comparison.md:62-75` presents the same dichotomy; `SECURITY.md:9-10` shares the `contact@lynote.ai` address (`setup.py:10` too). **This is a same-owner product-family relationship, evidenced by shared marketing text and a shared contact address — not by shared source.**
6. **One indirect signal pointing away from dsh-humanizer as the sibling:** the repo's actual documented ancestor-by-documentation is `molly554/ai-humanize` — `docs/faq.md:5` contrasts `ai-humanize`'s "4 theoretical approaches" with this repo's "actual working Standard pipeline", and `CHANGELOG.md:19` records that `docs/installation.md` had pointed at `molly554/ai-humanize` before v1.5.2 corrected it. The Docker service name `ai-humanizer` (`docker-compose.yml:4`) and the n8n workflow name `"AI Humanize - Standard Pipeline v1.5"` (`n8n/humanize_standard.json:2`) reinforce that the older naming came from that lineage. **If cross-repo duplicate detection matters for our registry, `molly554/ai-humanize` — which is not in our 8-repo upstream set — is the more probable source of shared text than `dsh-humanizer`.**

**Concrete de-duplication guidance for the registry:** because this repo ships no rule ids and its rule content is (a) a 30-entry English vocabulary map (`postprocess.py:6-37`) and (b) four prose technique headings plus three prose rhythm rules (`techniques.md:144-150`), duplication against dsh-humanizer should be detected by **normalized term matching on the vocabulary map entries** (e.g. `utilize`, `facilitate`, `leverage`, `delve`, `meticulous`, `underscore`, `paradigm`, `synergy`) and by **concept-name matching** on technique names (translation chain, multi-turn LLM rewriting, detection-guided feedback loop, mixed-engine translation). Both of those are exactly the same candidate lists that `blader/humanizer`-style "AI vocabulary" skills cover, so the realistic duplicate risk is against the **markdown-skill upstreams (items 2, 4, 6, 7, 8 in the upstream set), not against dsh-humanizer.**

## 15. Integration recommendation

**Recommendation: adopt this repo as a source of (a) rule content and (b) one offline detector. Do not adopt it as an execution path.**

Priority order:

1. **Port `statistical.py` verbatim as an always-on offline detector (kind A).** It is the only artifact in this repo that runs with zero extra dependencies, zero network, and zero API keys (`statistical.py:1-39`). Wrap it behind a detector adapter interface, expose its three raw sub-features separately (TTR, sentence-length CV, hapax ratio) in addition to the averaged score, and treat the output as a *heuristic index*, not a probability. Recalibrate the three thresholds against our own data rather than inheriting the arbitrary constants.
2. **Normalize the two rule sets into the canonical registry (kind B).** (i) The 30-entry `AI_VOCAB_REPLACEMENTS` map (`postprocess.py:6-37`) as vocabulary rules — make replacement deterministic and exhaustive, and reconsider the em-dash join in the rhythm rule. (ii) The technique descriptions and the three rhythm rules from `docs/techniques.md:141-150` plus the six LLM prompt instructions from `src/methodologies/llm_rewriter.py:15-27` as declarative style rules. During normalization, explicitly drop the doc-claimed-but-absent items (§8 items 24, 27, 28, 35, 36, plus n-gram diversity and Yule's K) rather than transcribing claims into rules that nothing implements.
3. **Take the history-threading orchestration pattern from `src/standard/llm_rewriter.py:42-52` (kind B/D support).** The idea of passing the previous round's input+output as conversation history so the model does not revert earlier edits (`docs/pipeline.md:39`) is a genuinely reusable orchestration insight and is cheaper to adopt than the 4-step chain it sits in.

**Explicitly do not:**

- **Do not put the translation chain in the default execution path (kind D).** It requires a paid LLM key *and* a Niutrans key *and* a working Google endpoint, is nondeterministic at temperature 1.3 (`examples/showcase/README.md:67`), costs 10–30s per text by the project's own estimate (`docs/faq.md:35`), and per the project's own admission trades away terminology accuracy and the user's voice (`README.md:279`). If offered at all, gate it behind explicit user opt-in with cost/latency disclosure.
- **Do not adopt `binoculars.py` under that name (kind A, optional).** It is not the Binoculars algorithm (§5.1). If we want a perplexity signal, implement observer/performer Binoculars properly; if we want this cheap version, rename it and note it is single-model perplexity.
- **Do not prioritize `roberta.py`.** Unresolvable model id, 2019 model, torch dependency, and known unreliability of that detector family.
- **Do not copy `docs/research-notes.md` content as rules (kind E).** It is explicitly reading notes about long-form fiction (`research-notes.md:79-82`) and its features are not implemented anywhere.
- **Do not reuse `n8n/humanize_standard.json`.** It encodes the superseded 5-step chain.

**Caveat that affects the whole integration:** the project is openly positioned as a superseded reference. `README.md:79` — "The pipeline here is our team's open exploration from early 2026 — the most effective approach we'd found *at the time* ... We've since moved well beyond it". Treat every quantitative claim (the 9.1/10 expert scores, the 0.72–0.9997 detection confidences) as marketing-adjacent and unverifiable in-repo.

## 16. Gaps, risks, and limitations

### Network dependencies and API keys

- **The production pipeline is 100% network-dependent and cannot run without two separate third-party credentials.** `run_standard_pipeline` requires an LLM API key (enforced by `ValueError` at `llm_client.py:99-103`) and a Niutrans key (`pipeline.py:39` does an unguarded `config["api_keys"]["niutrans_api_key"]`, which raises a bare `KeyError` — not a helpful error — if the section is missing). Step 3 additionally depends on Google Translate's undocumented free endpoint via `deep_translator` (`translators.py:18`), which has no SLA, no quota guarantee, and is a scraping-style integration (`n8n/humanize_standard.json:84` hits `translate.googleapis.com/translate_a/single?client=gtx`).
- **Three external services, three failure modes, no retries anywhere.** `llm_client.py:161` and `translators.py:40-49` both do a single `httpx.post` with `raise_for_status()` and no retry/backoff. A single transient 429 or 5xx aborts the whole pipeline after the caller has already paid for earlier steps.
- **No rate limiting, no concurrency control, no token accounting, and no cost estimation.** 120s LLM timeout, 60s Niutrans timeout.

### Stubs, misrepresentation, and correctness

- **No literal stubs** — no `NotImplementedError`, no `pass`-bodied detector. The risk is **overstatement**, and it is substantial:
  - `binoculars.py:1` claims a "dual-model perplexity ratio"; the code loads one `gpt2` model and computes plain perplexity (`binoculars.py:13-34`). This is the most serious correctness/naming issue in the repo.
  - `docs/techniques.md:110-132` documents a Method 3 architecture with "Document-Level Rewrite (LLM)" and "Sentence-Level Deep Rewrite (LLM)"; `detection_pipeline.py` contains **no LLM call whatsoever**.
  - `docs/techniques.md:145` claims "11+ Chinese boilerplate phrases"; no Chinese dictionary exists in code.
  - `docs/techniques.md:149-150` claims uniform-length breaking and transitional-variety insertion; neither is implemented.
  - `docs/techniques.md:139` claims Yule's K and n-gram diversity; neither is implemented.
  - `docs/techniques.md:181-183` names DeepL and Apertium engine combinations; neither appears in code.
  - `roberta.py:18` uses a bare un-namespaced HF model id `"roberta-base-openai-detector"` which will not resolve — this detector likely cannot load at all as written, and CI never tests it (`ci.yml:26` installs base deps only).
- **`binoculars.py` latent bug:** `_load_model` sets `self.tokenizer` (`binoculars.py:17`) but `__init__` only initializes `self.model = None` (`binoculars.py:7`) — harmless because `score()` always calls `_load_model()` first (`binoculars.py:22`), but there is no `self.tokenizer = None` and no guard, so any future code path that touches `self.tokenizer` without loading would `AttributeError`.
- **`roberta.py` polarity risk:** the `LABEL_1`/`Fake` mapping plus a `1.0 - score` fallback (`roberta.py:26-27`) silently inverts the score if the model's label convention is neither of those two.
- **Detector scores are incompatible with each other and with any threshold.** `binoculars` maps PPL into `[0,1]`, `roberta` returns a softmax probability, `statistical` returns an un-weighted mean of three clamped ratios. `DetectionGuidedProcessor._detect` averages them as if they were the same scale (`detection_pipeline.py:31-37`), then compares against a single `0.5` threshold (`detection_pipeline.py:51`). There is no calibration evidence for any of it.
- **`statistical.py`'s thresholds are unexplained magic numbers** (0.7/0.5/0.6 with 0.3 divisors). No calibration data, no citation, no test.

### Documentation and artifact drift (all verifiable)

- **Version drift:** `1.5.2` in `setup.py:5` and `src/__init__.py:12`, but "v1.5.1" in ~15 docstrings and docs (e.g. `src/standard/pipeline.py:2`, `src/standard/__init__.py:1`, `docs/pipeline.md:1`, `config/config.example.toml:1`, `examples/README.md:5-6`).
- **Step-count drift:** code and `docs/pipeline.md` describe 4 steps; `n8n/humanize_standard.json:97-143` and `docs/n8n-guide.md:35-38` still implement/document the old **5-step** DE→ES chain; `docs/configuration.md:88` still says "Steps 4-5".
- **Tier drift:** `README.md:63-67` and `README.md:97-101` advertise Standard/Advanced/Focus tiers; `src/standard/pipeline.py` has **no tier parameter**. Tiers exist only as `TIERS` in the legacy `translation_chain.py:12-16`, and even there `standard=3` yields only 2 hop languages because of the `max_hops - 1` slice (`translation_chain.py:32`) — the documented "3-language chain (EN → ZH → JA → EN)" (`techniques.md:45`) is arithmetically the `advanced` count.
- **Dead config:** `[general].target_language` and `[general].log_level` are documented in `config.example.toml:5-7` and `docs/configuration.md:98-99` but read by nothing. Conversely, the legacy methods read five config sections that the example file omits entirely (§7), so the shipped example config cannot drive the legacy dispatcher.
- **Dead declared extras:** `nltk` and `langdetect` are declared in `setup.py:35-36` and promised by `examples/legacy/README.md:23` but never imported.
- **Docstring/CLI argument mismatch:** `src/standard/llm_rewriter.py:23-37` documents `target_language` as "Target language name (e.g., "中文", "日语")" and there is no validation that the LLM actually honored it — the pipeline trusts the model's output language completely.
- **README claim vs code:** `README.md:47` says "Configurable LLM provider (DeepSeek default, OpenRouter optional)". The real provider list is five entries including `litellm` (`llm_client.py:10-41`), and `config.example.toml:22` lists only four, omitting `litellm` while the code accepts it.

### Unverifiable claims

- **The 0.7218–0.9997 detection confidences** (`docs/pipeline.md:78`, `examples/showcase/README.md:9-15`) come from an unnamed detector, linked out to `github.com/lynote-ai/ai-text-detector` (`README.md:15`, `:285`), and are **not reproducible with this repo's own code** — no bundled detector is wired into the standard pipeline. They are vendor-reported and cannot be independently checked without the external detector.
- **The 9.1/10 expert evaluation and "100% key information retention"** (`README.md:208-224`) ship with no methodology, no rater information, and no data.
- **`docs/pipeline.md:76` "5 input texts"** and `README.md:210` "50 text pairs" are different sample sets, neither included as data.
- `README.md:81`/`README-zh.md:76` claim Lynote.ai "raises the detector-bypass rate by ~30% and rates ~50% higher on output quality" relative to this chain — untestable in-repo and unfalsifiable by us.

### Licensing and provenance risks

- **MIT is clean and permissive**, `Copyright (c) 2026 Lynote.ai` (`LICENSE:3`) — no copyleft, no attribution burden beyond retaining the notice, no conflict with BSD-3-Clause `dsh-humanizer` despite the shared owner. **No license blocker for reuse.**
- **Residual provenance ambiguity (low severity, worth recording):** the documentation lineage points at the earlier `molly554/ai-humanize` project (`docs/faq.md:5`, `CHANGELOG.md:19`), which is a *different* upstream not in our 8-repo inventory. If any of the technique prose or the 30-word vocabulary map was copied from a source whose license differs from MIT, that would not be visible from this repo alone — there is no NOTICE file, no third-party attribution section, and `LICENSE` covers only Lynote.ai's own contribution. The 30-entry vocabulary list (`postprocess.py:6-37`) is exactly the kind of artifact that commonly appears in multiple "AI word" lists with different licenses.
- **Third-party model licenses are not addressed.** `binoculars.py:17-18` and `roberta.py:18` pull `gpt2` and `roberta-base-openai-detector` from the HF Hub at runtime. Those models carry their own terms (the OpenAI RoBERTa detector in particular); the repo neither pins revisions nor declares their licenses. If we bundle or cache those weights, we inherit that obligation.
- **`docs/research-notes.md` cites an arXiv paper** (`research-notes.md:11`, id `2604.03136`) with a COLM 2026 attribution (`:9`). The repo is careful to say these are "our reading notes, not the authors' claims" (`:5-6`) — good practice, but any reuse of those numbers should go to the primary source, not to this file.

### Functional limitations stated by the project itself

- `README.md:279`: "Round-trip translation costs precision. Technical terminology and citations can drift, and the deeper tiers trade more of your original voice for more restructuring."
- `README.md:281`: "No rewriting method makes text reliably undetectable. Detectors update faster than pipelines do, and results vary by input length, subject matter, and which detector you're facing."
- `docs/research-notes.md:44-50`: the Standard Pipeline "is fundamentally a **style / lexical transform** ... It does **not** restructure the narrative ... That is the concrete reason a pure translate-and-reword chain plateaus."
- `docs/techniques.md:51-53`: terminology accuracy degrades per hop; idioms are lost; long texts show inconsistent quality.
- `docs/techniques.md:154-157`: Method 3 needs GPU, its detectors may not correlate with commercial detectors, and complexity hurts debuggability.
- `README.md:79-83`: the maintainers state they have "moved well beyond" this pipeline and now run proprietary models — i.e. the open repo is intentionally a superseded artifact.
