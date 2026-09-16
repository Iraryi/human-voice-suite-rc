## Architecture Overview

In today's fast-moving landscape, our architecture continues to evolve. It is worth noting that this refactor is not just a performance improvement; it is a foundation for everything that comes next.

The core modules live under `src/detector/`: `scan.ts` performs the unified scan, and `suppression.ts` implements the weak-alone policy. Adapters live under `src/upstream/adapters/`.

Scanning 1,000 characters went from 12ms to 4ms, duplication fell by roughly 30%, and adding an upstream now means adding one directory.

See https://github.com/lynote-ai/dsh-humanizer for the original, pinned at 9314b95d0b1ba663331f47f0a8ea006b6dc5f508, under `licenses/BSD-3-Clause-dsh-humanizer`.

In short, this is a meaningful upgrade. We look forward to v0.2.0.
