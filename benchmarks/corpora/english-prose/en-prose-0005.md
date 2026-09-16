---
id: en-prose-0005
category: english-prose
language: en
mode: prose
provenance: human-written
source: .upstream-cache/blader-humanizer/README.md lines 73 and 75, commit 9862685f575c65a8247f90369951df1b3416e3d6
licence: MIT, Copyright (c) 2025 Siqi Chen, preserved at licenses/MIT-blader
notes: >
  Vendored verbatim from the blader/humanizer README. Two adjacent paragraphs of
  ordinary English technical prose with a genuinely mixed sentence length and no
  decoration. The control for the English set: a detector that scores this as
  machine-written has a false-positive problem, and the fix is the suppression
  layer or a threshold, not another rule.
---

Humanizer marks every tell it finds, strongest first. It drafts a rewrite without treating the original structure as fixed, checks the draft against the patterns and the original claims, and then writes the final version. It does not make things up. A name, number, date, quote, citation, or other factual detail must come from the source or the writer, and if a sentence needs a detail that is missing, Humanizer asks instead of inventing one.

When you paste text, Humanizer shows its work: the first rewrite, a short critique of anything that still sounds artificial, and the final version. Point it at a file and it changes only the prose, leaving code, data, frontmatter, and link targets alone. Personal writing keeps the writer's opinions and quirks. Technical and reference prose stays neutral and plain.
