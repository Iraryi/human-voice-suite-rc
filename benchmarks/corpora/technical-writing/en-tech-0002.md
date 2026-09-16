---
id: en-tech-0002
category: technical-writing
language: en
mode: technical
provenance: model-generated
model: DeepSeek (deepseek-flash) via DSH agent
source: original, generated for this benchmark
licence: original to this project, MIT
notes: >
  Generated to order for this benchmark as precise technical writing. A regex, a
  URL, a commit hash, three paths, three pinned versions and a file name, with no
  tells. Pairs with en-tech-0003, which carries the same class of content inside
  AI-flavoured prose.
---

## Configuration

The loader reads `benchmarks/corpora/` and skips `README.md` and `NOT_POPULATED.md`. Each sample must declare a unique `id` matching `^[a-z]{2}-[a-z-]+-\d{4}$`; `parseSample` in `benchmarks/lib/corpus.ts` enforces it.

Set `HVS_PROJECT_ROOT` to override the resolved root. The default is derived from `import.meta.url`, so it resolves correctly from both `src/` and `dist/`.

Pinned versions:

    node >= 22.0.0
    typescript 5.7.2
    vitest 2.1.8

The upstream `blader/humanizer` is pinned at commit 9862685f575c65a8247f90369951df1b3416e3d6. See https://github.com/blader/humanizer for the source and `licenses/MIT-blader` for the licence text.

Run `npm run bench:check` before committing a corpus change. It exits non-zero rather than loading a corpus with a missing licence.
