# Upstream registry

This directory is the answer to "where did this capability come from".

| Path | Contents |
| --- | --- |
| `manifest.json` | One record per upstream: repository, licence, version, pinned commit, role, lineage, integration kind, and any import restrictions |
| `reports/` | The Phase 1 reconnaissance, one file per upstream, with `file:line` citations for every claim |

## manifest.json

Every entry carries eight required fields — `name`, `repository`, `license`,
`version`, `commit`, `role`, `derived_from`, `last_sync` — plus optional suite
bookkeeping such as `integration`, `target_phase`, `copyright_holder`,
`license_file`, `external_ancestors` and `import_exclusions`.

`validateManifest` runs on every load and rejects a missing field, a short commit
SHA, a duplicate name or repository, an unknown integration kind, and a
`derived_from` that points at a sibling which does not exist. A manifest that
fails validation throws rather than degrading quietly, because a wrong manifest
makes every provenance claim in the project wrong.

### `derived_from` versus `external_ancestors`

`derived_from` records **content derivation** — where an upstream's actual text
came from. It is what prevents same-lineage repositories being counted as
independent discoveries. It must name another tracked upstream, and validation
enforces that.

`external_ancestors` records ancestry outside this registry, which cannot be
referenced by `derived_from` without breaking the sibling check.

The distinction is deliberate. `lynote-ai/dsh-humanizer` says its rules are
"modelled on" three of the others, but shares zero rule identifiers with any of
them, so that is recorded as a note rather than as derivation. Conceptual
inspiration does not create a notice obligation or a double-counting risk;
copied text does.

### `import_exclusions`

Used where an upstream's own licence is clean but content it took from elsewhere
did not carry the required notices. Each entry states what is barred and why. This
is machine-readable rather than a comment, because it constrains what an adapter
is allowed to emit.

The one current case is `judetelan/ai-humanizer`, which absorbed 11 of its 46
rules from `hardikpandya/stop-slop` without the notice. Only its 35 original rules
may be imported; the equivalent capability is taken from `stop-slop`, which holds
clean title, and attributed to both.

## reports/

Read-only reconnaissance produced during Phase 1. The repositories were cloned
into `.upstream-cache/` (gitignored) and analysed without being modified —
verified by `git status --porcelain` returning empty for all eight.

Where a report and `UPSTREAM_INVENTORY.md` disagree, the report wins: it carries
the primary evidence.

## Keeping this current

```bash
npm run upstream:check          # online: checks every remote ref
npm run upstream:check:offline  # local state only
npm run licenses:verify         # preserved licences vs the pinned commits
```

`upstream:check` writes `UPSTREAM_UPDATE_REPORT.md` at the project root and
**modifies nothing else**. Absorbing an upstream change is a deliberate decision,
recorded by updating `commit` and `last_sync` here.

See [`../docs/provenance-policy.md`](../docs/provenance-policy.md) for the
checklist to follow when adding an upstream.
