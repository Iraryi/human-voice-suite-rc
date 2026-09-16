---
id: en-tech-0001
category: technical-writing
language: en
mode: technical
provenance: human-written
source: .upstream-cache/blader-humanizer/README.md lines 7-26, commit 9862685f575c65a8247f90369951df1b3416e3d6
licence: MIT, Copyright (c) 2025 Siqi Chen, preserved at licenses/MIT-blader
notes: >
  Vendored verbatim from the blader/humanizer README. Installation instructions,
  so it is mostly commands, flags and slash-command invocations with a little
  connective prose. The English counterpart to the Chinese technical control:
  the prose may be smoothed, the commands may not be touched at all.
---

## Installation

Install Humanizer with the Skills CLI:

```bash
npx skills add blader/humanizer --global
```

Leave off `--global` to install Humanizer only in the current project. Add `--agent <name>` or `--agent '*'` to choose which agents receive it, then reload their skills. The skill answers to `/humanizer`.

Claude Code 2.1.142 or newer can install the plugin instead:

```text
/plugin marketplace add blader/humanizer
/plugin install humanizer@humanizer
```

The plugin answers to `/humanizer:humanizer`.

In Claude Desktop, download this repository as a ZIP and upload it as a skill. For a manual install, copy `SKILL.md` into the agent's skill folder.
