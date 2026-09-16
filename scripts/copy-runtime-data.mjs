#!/usr/bin/env node
/**
 * Copy the committed data files into `dist/` after `tsc`.
 *
 * `tsc` compiles TypeScript; it does not know that the build also needs seven
 * `rules.generated.json` files, the upstream manifest and the imported author
 * voices. Without this step an installed package would load an **empty registry
 * and report a clean scan of everything** — the worst possible failure, because
 * it looks like a pass.
 *
 * The readers accept either layout (`resolveDataFile` in `src/upstream/manifest.ts`),
 * so a checkout keeps reading `src/` and an installed package reads `dist/`.
 */

import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

/** Every file the runtime reads at call time, as `<from>` → `<to>`. */
function copies() {
  const out = [
    { from: path.join(root, 'upstreams', 'manifest.json'), to: path.join(dist, 'upstreams', 'manifest.json') },
    {
      from: path.join(root, 'src', 'voice', 'import', 'demo-voice.json'),
      to: path.join(dist, 'voice', 'import', 'demo-voice.json'),
    },
    { from: path.join(root, 'cordis.patch.yml'), to: path.join(dist, 'cordis.patch.yml') },
  ];

  const adapters = path.join(root, 'src', 'upstream', 'adapters');
  for (const directory of readdirSync(adapters)) {
    const from = path.join(adapters, directory, 'rules.generated.json');
    if (!existsSync(from)) continue;
    out.push({ from, to: path.join(dist, 'upstream', 'adapters', directory, 'rules.generated.json') });
  }
  return out;
}

let copied = 0;
const missing = [];
for (const { from, to } of copies()) {
  if (!existsSync(from)) {
    missing.push(path.relative(root, from));
    continue;
  }
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to);
  copied += 1;
}

process.stdout.write(`copy-runtime-data: ${copied} file(s) into dist/\n`);
if (missing.length > 0) {
  // Not fatal by itself — a fresh clone has no extractions until
  // `upstream:extract` runs — but it must be said out loud, because the packaged
  // build is then incomplete and the suite will report nothing rather than fail.
  process.stdout.write(
    `copy-runtime-data: ${missing.length} source file(s) not present, so the packaged build is incomplete:\n` +
      missing.map((file) => `  - ${file}\n`).join('') +
      '  Run `npm run upstream:extract` and `npm run voice:import` before building a distributable.\n',
  );
}
