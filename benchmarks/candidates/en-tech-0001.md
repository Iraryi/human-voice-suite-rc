## Installation

Install Humanizer with the Skills CLI:

```bash
npx skills add blader/humanizer --global
```

Leave off `--global` to install it only in the current project. Add `--agent <name>` or `--agent '*'` to choose which agents receive it, then reload their skills. The skill answers to `/humanizer`.

Claude Code 2.1.142 or newer can install the plugin instead:

```text
/plugin marketplace add blader/humanizer
/plugin install humanizer@humanizer
```

The plugin answers to `/humanizer:humanizer`.

In Claude Desktop, download this repository as a ZIP and upload it as a skill. To install manually, copy `SKILL.md` into the agent's skill folder.
