---
id: en-tech-0003
category: technical-writing
language: en
mode: technical
provenance: model-generated
model: DeepSeek (deepseek-flash) via DSH agent
source: original, generated for this benchmark
licence: original to this project, MIT
notes: >
  Generated to order for this benchmark as the counter-case to en-tech-0002. Same
  class of protected content, this time inside prose carrying the usual tells:
  a staged opener, a three-part parallel structure, an inflated close. The
  question it is here to answer is whether the rules fire on the writing while a
  URL, a commit hash and a path come out the other side unchanged.
---

## Architecture Overview

In today's fast-moving landscape, our architecture continues to evolve. It is worth noting that this refactor is not just a performance improvement; it is a foundation for everything that comes next.

The core modules live under `src/detector/`: `scan.ts` performs the unified scan, and `suppression.ts` implements the weak-alone policy. Adapters live under `src/upstream/adapters/`.

From a performance perspective, scanning 1,000 characters dropped from 12ms to 4ms. From a maintainability perspective, duplication fell by roughly 30%. From an extensibility perspective, adding an upstream now means adding one directory.

See https://github.com/lynote-ai/dsh-humanizer for the original, pinned at 9314b95d0b1ba663331f47f0a8ea006b6dc5f509, under `licenses/BSD-3-Clause-dsh-humanizer`.

In short, this is a meaningful upgrade. We look forward to v0.2.0.
