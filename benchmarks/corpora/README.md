# The benchmark corpus

Sixty samples across seven categories, plus one category that is deliberately
empty. Every sample declares where it came from and under what licence, because
those two fields are what make a false-positive rate measurable at all.

```text
category                 n   languages  provenance
chinese-prose            8   zh         human-written, model-generated, model-then-edited
english-prose            8   en         human-written, model-generated
chinese-chat            10   zh         model-generated
english-chat            10   en         model-generated
formal-writing           6   en, zh     human-written, model-generated
technical-writing        6   en, zh     human-written, model-generated
ai-pretending-casual    12   en, zh     model-generated
real-human-chat          0   —          none, and see below
```

Total 60: 48 `model-generated`, 11 `human-written`, 1 `model-then-edited`.
Languages are balanced, 30 each.

## Read this before trusting any number this corpus produces

Four limitations, in descending order of how badly they can mislead.

### 1. Every category is below the sample count the design calls for

`benchmarks/README.md` sets targets of 30 samples per prose category, 100 per
chat category, 20 each for formal and technical, and 50 for the hard case. The
actual counts are 8, 10, 6, 6 and 12. **Every populated category sits below the
20-sample noise floor** that the same document names.

The consequence is specific and worth stating plainly: differences between
configurations smaller than roughly ten points on a per-category score are inside
the noise, and the ablation table will not be readable at the category level. It
may still be readable over the corpus as a whole, where n is 60. A per-category
claim from this corpus is not a result.

The harness knows this and says so on every run rather than leaving it for a
reader to notice: `benchmarks/corpus-check.ts` marks each thin category and names
the shortfall.

### 2. The generated samples were written by a model that knew what is being tested

48 of the 60 samples are `model-generated`, written to order for this corpus by a
DeepSeek model through the DSH agent. That model had the rule registry, the
signature vocabulary and the detector catalogue in front of it, and was told
which tells each category was supposed to expose.

This is a real conflict of interest and it cuts in one direction: **the generated
samples are probably easier to detect than text a model produced without that
briefing.** They are not a random sample of model output. They are a sample of
model output deliberately shaped to contain the tells, and a strong score on them
means the detectors fire on text built to trip them.

What that does *not* invalidate is the false-positive side. The 11
`human-written` samples were written by people with no knowledge of this project,
so a detector that flags them is wrong for an honest reason. Those 11 are the
part of this corpus that can support a claim without a caveat.

Each generated sample's `notes` field says it was generated to order for this
benchmark. That was a deliberate requirement rather than a courtesy: a reader
should never have to guess whether a sample was written to be caught.

### 3. `real-human-chat` is empty, so `behaviorScore` has no false-positive denominator

There is no licence-clear offline source of genuine human chat logs, so the
category contains only `NOT_POPULATED.md`, which explains why in full. Nothing
was fabricated to fill it.

The consequence for the report: a `behaviorScore` from this corpus measures how
well the behaviour checks recognise assistant-shaped replies. It does **not**
measure how often they fire on people talking to each other, because there are no
people talking to each other in the corpus. A run that reports a good
`behaviorScore` and says nothing else is quoting half a measurement.

### 4. The vendor excerpts are documentation, not the registers they stand in for

The 11 `human-written` samples come from the upstream projects' own docs, which
means the "human prose" control is documentation prose. It is real human writing
and it is unhelpfully uniform: READMEs and skill files are written in a narrow,
instructional register. It is not a blog post, not an essay, not a memo.

That makes the vendored set a *conservative* false-positive control. Documentation
is unusually plain, so a detector that leaves it alone is not yet shown to leave
prose alone. It is also, in two cases, an unusually hard control — see the
meta-discussion traps below.

## What the corpus does contain

**AI tells, deliberately.** Four Chinese and four English prose samples carry the
tells their rules name: staged openers, contrast frames, inflated significance,
three-part enumeration, stock outlook sections, slogan closes, borrowed authority,
knowledge-limit guesses. They should score badly, and a run where they do not is
a bug in the detectors rather than a finding about the text.

**Assistant behaviour in casual clothes.** Twelve samples in
`ai-pretending-casual` where every word is ordinary, there is no AI vocabulary,
no em dash, no bold and no bullet list, and the reply is nonetheless unmistakably
an assistant. The tells are spread across the set so that different samples trip
different smells: mirroring, over-agreement, staged pivots, inflated
significance, over-completeness, mechanical empathy, forced positivity,
unsolicited advice and unrequested background.

These are the samples worth checking by hand. If a detector scores them clean, the
detector is matching words and the category is doing its job by showing that.

**A control group in both chat categories.** Three of the ten replies in
`chinese-chat` and three of the ten in `english-chat` were written to behave like
a person: one answers two of three questions and silently drops the third, one
disagrees flatly and stops, one is three short messages with no closing formula.
They are not assistant-shaped with the edges filed off. If a behaviour check
flags these, that is a false positive, and it is the failure the category exists
to expose.

**A register pair in `formal-writing`.** Each language has one sample where the
formality is correct — passive voice, hedges, long sentences, all appropriate to
a memorandum — and one where the same formality is being used to hide the usual
tells. A suppression policy generous enough to protect the first must not be
generous enough to protect the second.

**Precision traps in `technical-writing`.** Each language has one precise sample
and one where the same protected content sits inside AI-flavoured prose. A commit
hash, a URL, a version constraint and a file path appear in all four. The question
they answer is whether the rules fire on the writing while the protected content
survives a rewrite untouched.

## The meta-discussion traps

Three samples are written *about* the tells. They name them, quote them and
forbid them, which means the rule vocabulary appears as text.

- `zh-formal-0001` names 赋能, 值得注意的是, 首先, 其次, 最后 and 破折号 inside
  quotation marks as things to avoid.
- `en-formal-0001` lists "a not-X-but-Y contrast, a one-line closer, a dash, a
  triad, a bold label" as the tells that survive a rewrite.
- `en-prose-0006` uses bold lead-ins on a bullet list while explaining why bold
  lead-ins are a tell.

A detector that matches strings rather than usage will score the rulebook as a
violation of itself. That is the purest false positive available here, and it is
also the one with the clearest fix: the suppression layer's exemption for a
passage that discusses a phrase rather than uses it. `zh-prose-0006` is a fourth
case, milder but in the same family.

## Vendored files

Eleven samples are excerpts copied verbatim out of the read-only upstream clones
in `.upstream-cache/`. Each `source` field records the file, the line range and
the full commit. The licence texts are preserved byte-for-byte in `licenses/`.

| Sample | File | Lines | Commit | Licence |
| --- | --- | --- | --- | --- |
| `zh-prose-0005` | `humanizer-zh/SKILL.md` | 8–26 | `f75f1ac9735c4f10da1bba0148e0ea7228c5c3b3` | MIT, (c) 2026 aizixun |
| `zh-prose-0006` | `humanizer-zh/SKILL.md` | 28–56 | `f75f1ac9735c4f10da1bba0148e0ea7228c5c3b3` | MIT, (c) 2026 aizixun |
| `zh-formal-0001` | `humanizer-zh/SKILL.md` | 57–90 | `f75f1ac9735c4f10da1bba0148e0ea7228c5c3b3` | MIT, (c) 2026 aizixun |
| `zh-prose-0007` | `humanizer-zh/README.md` | 137–152 | `f75f1ac9735c4f10da1bba0148e0ea7228c5c3b3` | MIT, (c) 2026 aizixun |
| `zh-tech-0001` | `humanizer-zh/README.md` | 78–107 | `f75f1ac9735c4f10da1bba0148e0ea7228c5c3b3` | MIT, (c) 2026 aizixun |
| `en-prose-0005` | `blader-humanizer/README.md` | 73, 75 | `9862685f575c65a8247f90369951df1b3416e3d6` | MIT, (c) 2025 Siqi Chen |
| `en-tech-0001` | `blader-humanizer/README.md` | 7–26 | `9862685f575c65a8247f90369951df1b3416e3d6` | MIT, (c) 2025 Siqi Chen |
| `en-prose-0006` | `blader-humanizer/SKILL.md` | 17–29 | `9862685f575c65a8247f90369951df1b3416e3d6` | MIT, (c) 2025 Siqi Chen |
| `en-formal-0001` | `blader-humanizer/SKILL.md` | 31–38 | `9862685f575c65a8247f90369951df1b3416e3d6` | MIT, (c) 2025 Siqi Chen |
| `en-prose-0007` | `blader-humanizer/SKILL.md` | 360–370 | `9862685f575c65a8247f90369951df1b3416e3d6` | MIT, (c) 2025 Siqi Chen |
| `en-prose-0008` | `stop-slop/README.md` | 34–40 | `8da1f030185bdfe8471220585162991eaeb970e9` | MIT, (c) 2025 Hardik Pandya |

Paths are relative to `.upstream-cache/`. Excerpt lengths run from 436 to 1620
characters; ten of the eleven sit inside the 400–1200 range the task specified,
and `en-formal-0001` is 1620, over the guidance for a non-prose category.

### Two sources the task suggested that were not used

- `humanizer-zh/CLAUDE.md` is ten lines and about three hundred characters. It
  cannot reach the excerpt floor on its own, and padding it would mean vendoring
  something other than what the file says.
- `humanizer-zh/references/patterns.md` is a pattern catalogue. Its prose runs are
  one or two sentences each and the bulk of it is bullet lists of example
  phrases. Those bullets are the tells themselves, so excerpting them as
  `human-written` prose would have put AI-slop samples into the control group and
  silently destroyed the false-positive measurement.

Both files were read; neither was vendored, and this is why.

### What was not vendored from those files

The `Before:` halves of the blader and stop-slop examples are deliberate
AI-slop, written by the upstream author to be caught. They sit in the same files
as the prose that *was* vendored, and they are excluded on purpose. Vendoring
them as `human-written` would have been a provenance error of exactly the kind
the `provenance` field exists to prevent.

## Sample format

One Markdown file per sample. Front matter is a deliberately small YAML subset;
`benchmarks/lib/frontmatter.ts` is the parser and it is strict. Plain scalars,
plus `>` for a folded block and `|` for a literal one. No nested maps, no inline
lists, no other YAML.

Required on every sample: `id`, `category`, `language`, `mode`, `provenance`,
`source`, `licence`, `notes`. `model` is additionally required whenever
`provenance` is not `human-written`. `expected` is optional and free-form, for a
human reader.

`id` is unique across the whole corpus and is what run output and reports address
samples by. The id segment does not have to match the category: the brief's seed
sample is `zh-chat-0001` and sits in `ai-pretending-casual`, so the two chat
categories use `zh-talk-*` and `en-talk-*` to leave the `*-chat-*` segment to
that category.

For a chat sample the body is the reply only, and the turn it answers goes in
`user_turn`. A reply that is several consecutive messages separates them with a
line containing exactly `<!-- msg -->`.

### Two things worth knowing before writing more samples

**A key with no value opens a literal block.** `expected:` followed by indented
lines is supported on purpose: `frontmatter.ts` captures it verbatim for a human
reader rather than parsing it, so a sample can state what it is meant to expose
without the harness having to understand the statement. The seed sample uses
this. It is the one documented exception to "plain scalars only", and a genuinely
empty required field is still caught by the loader's missing-field check.

**Block scalars are dedented.** `user_turn: |` requires the following lines to be
indented, and the parser strips the block's common indentation, so a
two-space-indented turn loads as `"今天开会开了三个小时，累死了。"` with no leading
spaces. Writing a sample with deeper or inconsistent indentation still works — the
minimum indent is what gets removed — but mixing tabs and spaces within one block
will not do what you expect.

One remaining quirk of the seed, recorded rather than fixed. Its **body** contains
a long dash (`——`), which is the one thing this category is supposed to test the
absence of, and its `model` value contains an em dash as well. Both are in the
brief's canonical example and neither was removed, because the seed was left
exactly as it was found on instruction. The other eleven samples in the category
were checked mechanically and contain no long dash, no em dash, no bold, no bullet
list and none of the vocabulary the rules watch for.

## Chat samples without a user turn

Thirty samples are `mode: chat`. One of them has no `user_turn`: the seed
`zh-chat-0001`, because the brief does not record the turn it answers and
inventing one would be fabricating provenance.

Two of the ten behaviours — mirroring and over-completeness — cannot be judged
for a sample in that state, so its `behaviorScore` is a weaker measurement than
its neighbours'. The loader computes this list as `partialBehavior` and correctly
contains exactly one id.

`benchmarks/corpus-check.ts` does not print it. Both the text and the `--json`
output report the hash, the counts, the thin categories and the unpopulated ones,
and stop there. So the disclosure the loader was built to make currently reaches
nobody. That is a gap in the harness rather than in the corpus, and it is named
here so it does not stay invisible.

## Adding samples

1. Pick the category directory. The `category` field must equal the directory
   name; the loader refuses the sample otherwise, because the directory decides
   which comparisons it takes part in.
2. Give it an id that is unique across the whole corpus.
3. Record `provenance` honestly, and `licence` always. A sample without a licence
   does not load, and that is deliberate: a corpus that mixes licensed and
   unlicensed text cannot be published.
4. For `model-generated`, name the `model` and say in `notes` that it was
   generated to order for this benchmark. Do not leave a reader to guess.
5. Prefer a false-positive control over another tell-heavy sample. The corpus has
   far more of the latter than it needs and nowhere near enough of the former.
6. Run `npm run bench:check`. It exits non-zero rather than loading a corpus with
   a missing field, a duplicate id, or a category that disagrees with its
   directory.
