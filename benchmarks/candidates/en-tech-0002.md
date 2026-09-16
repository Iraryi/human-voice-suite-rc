## Configuration

The loader reads `benchmarks/corpora/` and skips `README.md` and `NOT_POPULATED.md`. Each sample declares a unique `id` matching `^[a-z]{2}-[a-z-]+-\d{4}$`, which `parseSample` in `benchmarks/lib/corpus.ts` enforces.

`HVS_PROJECT_ROOT` overrides the resolved root. The default comes from `import.meta.url`, so it resolves correctly from both `src/` and `dist/`.

Pinned versions:

    node >= 22.0.0
    typescript 5.7.2
    vitest 2.1.8

The upstream `blader/humanizer` is pinned at commit 9862685f575c65a8247f90369951df1b3416e3d6. The source is at https://github.com/blader/humanizer and the licence text is in `licenses/MIT-blader`.

Run `npm run bench:check` before committing a corpus change: it exits non-zero rather than loading a corpus with a missing licence.
