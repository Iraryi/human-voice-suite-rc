# Installing Human Voice Suite as a DSH plugin

The suite ships six DSH tools. This is the operator's guide: what each tool does,
how to install it, and what it deliberately does not do.

## Install

```bash
# from the DSH runtime
dsh plugin --profile <profile> add link:<absolute path to this repository>
```

That runs pnpm inside the profile and then reconciles `dsh.profile.bundles`. The
package declares `dsh.bundle.patch`, so it is appended to the profile's layer
stack automatically — there is no second step and nothing to hand-edit.

`link:` rather than `file:` on purpose: the plugin reads its committed rule
extractions from the checkout, so a link keeps the installed plugin and the source
tree the same thing. Rebuild after changing TypeScript:

```bash
npm run build          # tsc, then copy the runtime data files into dist/
dsh plugin --profile <profile> list
```

To remove it:

```bash
dsh plugin --profile <profile> remove human-voice-suite
```

The plugin is loaded when the harness boots a session, so a running session keeps
the tools it started with.

## The six tools

| Tool | What it does |
| --- | --- |
| `human_voice_scan` | Every AI tell in a text, as canonical rules with severity, evidence and provenance, plus the four scores. |
| `human_voice_prepare` | The rewrite contract for a draft: rules to satisfy, content to preserve verbatim, prohibitions, retry budget. **Calls no model.** |
| `human_voice_validate` | A rewrite against its original: four separate scores, the issues behind them, and whether the one permitted retry is worth spending. |
| `human_voice_chat` | The ten assistant behaviours in a chat reply, with the user turn. Says which behaviours a missing turn made unjudgeable. |
| `human_voice_voice` | `list`, `get`, `import` (the shipped demonstration profile, plus any author voices generated locally) and `score` against a profile. |
| `human_voice_profile` | Learn a scoped profile from samples, and save, list or delete profiles. |

There is no `run_blader`, no `run_humanizer_zh`, and no per-upstream tool of any
kind. Which upstream contributes to a call is reported *inside* a result, as
provenance, which is where a reader can check it and a model cannot route on it.

## The four scores, and why there is no fifth

Every tool that reports quality reports `antiAIScore`, `voiceScore`,
`behaviorScore` and `preservationScore` separately, and lists anything it could
not measure in `unmeasured`. There is no blended "percent human" number, at the
tool surface or anywhere else, and a score in `unmeasured` must never be quoted as
a pass.

Each finding is charged to **at most** one score, which the ablation data confirms:
adding the voice or behaviour layer moves `antiAIScore` by at most 0.01 on the same
samples. That is what stops one tell being deducted three times because three
upstreams named it.

**And some findings charge nothing at all.** A rule whose construct has not been
reviewed, or whose specificity is too low to charge for, is reported and excluded from
every score; each score's rationale names the rules it is the sum over, and the
`unscored` list names the findings it is not. So a finding list is not a score, its
length is not a severity, and the count of rules that fired is not a measurement of
anything except how many rules fired. See `docs/behavior-engine.md` for the five classes
and `benchmarks/external/RULE_STATUS_DECISION.md` for the decision behind each one.

## What the tools deliberately do not do

- **No model is called.** `human_voice_prepare` returns instructions, and the
  calling agent executes them. A tool that rewrote text itself would make the
  validation meaningless: the suite would be grading its own output.
- **No network.** Nothing here fetches anything. Upstream repositories are read
  from a local cache during development and never at tool-call time; the rules
  they produced are committed.
- **No upstream is modified.** The clones are read-only inputs.
- **No claim about authorship.** The tools report catalogued tells and distance
  from a target voice. Whether a machine wrote a text is not a question this suite
  answers, and `benchmarks/README.md` §6 says so at length.

## Configuration

The patch row accepts three optional fields:

```yaml
- insert:
    - id: human-voice-suite
      name: human-voice-suite/plugin
      config:
        enabled: true          # false registers nothing
        projectRoot: <path>    # default: the package root, or $HVS_PROJECT_ROOT
        profileDir: <path>     # default: <projectRoot>/profiles
```

`profileDir` is where `human_voice_profile` saves and `human_voice_voice` reads.
It is gitignored: a learned profile is the user's writing, not the project's.

## Where the rules come from at run time

The registry is built from seven committed `rules.generated.json` files under
`src/upstream/adapters/`. `npm run build` copies them into `dist/` as well, so the
same code works from a checkout and from an installed package — a plugin that
found no rules would report a clean scan of everything, which is the one failure
mode worse than an error. `resolveDataFile` in `src/upstream/manifest.ts` picks
whichever layout is present.

## Verifying an install

```bash
npm test -- dsh-plugin          # drives apply() with a fake registry, then real calls
npm run build
dsh plugin --profile <profile> list
```

The plugin test does not mock the toolkit: every tool runs against the real
registry, the real detectors and the real corpus, so a registration that resolves
is a registration that works. It also validates each tool's actual output against
the JSON Schema the tool declares, which is the failure a live harness would
otherwise be the first to find.
