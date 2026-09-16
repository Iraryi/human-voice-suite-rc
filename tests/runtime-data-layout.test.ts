/**
 * The two data layouts.
 *
 * A checkout keeps its generated JSON under `src/`; an installed package has no
 * `src/` at all and carries the same files under `dist/`, copied there by
 * `scripts/copy-runtime-data.mjs`. Both have to work, and the failure when they
 * do not is the worst kind this project can have: the registry loads only the
 * rules written here, every upstream rule disappears, and **every scan comes back
 * clean**.
 *
 * That is not hypothetical. The first version of `resolveDataFile` looked for
 * `dist/src/upstream/...` — `dist/` sitting beside `src/` instead of replacing it
 * — and a packaged install reported `antiAIScore 1.00` on a paragraph of textbook
 * Chinese AI tells. These tests build a `dist`-only root so the same mistake fails
 * here instead.
 */

import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path, { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  dataFileCandidates,
  loadManifest,
  manifestPath,
  resolveDataFile,
  resolveProjectRoot,
} from '../src/upstream/manifest.js';
import { buildRegistryFromExtractions } from '../src/rules/canonical/load.js';
import { loadImportedAuthorVoices } from '../src/dsh/plugin/server.js';

const ROOT = join(__dirname, '..');
const temporary: string[] = [];
afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

/**
 * A package-shaped root: no `src/`, only the `dist/` a build produces.
 *
 * Built by copying the real `dist/`, so it contains whatever the build actually
 * emitted — an empty fixture would pass while the real package failed.
 */
function distOnlyRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'hvs-dist-only-'));
  temporary.push(root);
  cpSync(join(ROOT, 'dist'), join(root, 'dist'), { recursive: true });
  // Nothing else: no src/, no upstreams/, no cordis.patch.yml at the top level.
  return root;
}

describe('resolveDataFile', () => {
  it('treats dist/ as replacing src/, not as sitting beside it', () => {
    const candidates = dataFileCandidates(
      join('upstream', 'adapters', 'blader', 'rules.generated.json'),
      'C:\\pkg',
    );
    expect(candidates[0]).toBe(join('C:\\pkg', 'src', 'upstream', 'adapters', 'blader', 'rules.generated.json'));
    expect(candidates[1]).toBe(join('C:\\pkg', 'dist', 'upstream', 'adapters', 'blader', 'rules.generated.json'));
    // The bug that got through: dist/src/... is not a layout any build produces.
    for (const candidate of candidates) {
      expect(candidate).not.toContain(join('dist', 'src'));
    }
  });

  it('finds the checkout copy when both exist', () => {
    expect(resolveDataFile(join('upstream', 'adapters', 'blader', 'rules.generated.json'), ROOT)).toBe(
      join(ROOT, 'src', 'upstream', 'adapters', 'blader', 'rules.generated.json'),
    );
  });

  it('finds the packaged copy when the checkout one is absent', () => {
    const root = distOnlyRoot();
    expect(
      resolveDataFile(join('upstream', 'adapters', 'blader', 'rules.generated.json'), root),
    ).toBe(join(root, 'dist', 'upstream', 'adapters', 'blader', 'rules.generated.json'));
  });

  it('names a path a developer recognises when neither exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'hvs-empty-'));
    temporary.push(root);
    expect(resolveDataFile(join('upstream', 'x.json'), root)).toBe(
      join(root, 'src', 'upstream', 'x.json'),
    );
  });
});

describe('a dist-only root behaves like a checkout', () => {
  it('builds the registry from the packaged extractions', async () => {
    const root = distOnlyRoot();
    const { registry, problems, extractions } = await buildRegistryFromExtractions({
      projectRoot: root,
    });

    // The number that matters: a registry holding only the local rules would have
    // about eleven, and every upstream rule would be silently missing.
    expect(extractions.size, 'adapters found').toBeGreaterThanOrEqual(6);
    expect(registry.list().length).toBeGreaterThan(70);
    expect(problems).toEqual([]);
    expect(registry.get('lexical.ai_vocabulary')).toBeDefined();
    expect(registry.get('structural.inflated_significance')).toBeDefined();
  }, 60000);

  it('loads the upstream manifest from the packaged copy', async () => {
    const root = distOnlyRoot();
    const manifest = await loadManifest(root);
    expect(manifest.upstreams).toHaveLength(8);
  }, 60000);

  it('loads the demonstration profile from the packaged copy', () => {
    // The imported author voices are not distributed, so a packaged install has the demo
    // profile and nothing else until its owner generates the rest locally. What this test
    // guards is that the packaged copy resolves at all: a missing data file is the failure
    // that once made an installed copy report a clean scan of everything.
    const root = distOnlyRoot();
    const voices = loadImportedAuthorVoices(root);
    expect(voices.map((profile) => profile.id)).toContain('author/plainspoken-demo');
    expect(voices.every((profile) => profile.id.startsWith('author/'))).toBe(true);
  }, 60000);

  it('reports a clean scan only when the text is actually clean', async () => {
    // The regression test for the real failure: this paragraph is textbook
    // Chinese AI prose, and a dist-only install must find it.
    const root = distOnlyRoot();
    const { createToolkit } = await import('../src/dsh/tools/runtime.js');
    const toolkit = await createToolkit({ projectRoot: root });
    const scanned = await toolkit.scan({
      text:
        '值得注意的是，这标志着行业进入了一个全新的阶段。首先，我们需要赋能业务；' +
        '其次，我们要打造闭环；最后，让我们共同期待更智能的未来。',
      language: 'zh',
      mode: 'prose',
    });
    expect(scanned.canonicalFindings.length).toBeGreaterThan(1);
    expect(scanned.scores.antiAIScore).toBeLessThan(1);
  }, 60000);
});

describe('the build that produces the packaged layout', () => {
  it('copies every file the runtime reads into dist/', () => {
    const root = distOnlyRoot();
    // If the copy step misses one of these, the corresponding capability fails
    // only in an installed package — which is why the list is explicit.
    for (const relative of [
      join('voice', 'import', 'demo-voice.json'),
      join('upstream', 'adapters', 'blader', 'rules.generated.json'),
    ]) {
      expect(resolveDataFile(relative, root), relative).toContain(join(root, 'dist'));
    }
  });

  it('lets HVS_PROJECT_ROOT pin the root, which is how a profile points at a checkout', () => {
    // Under a test runner `import.meta.url` is not the on-disk module path, so
    // asserting what the default resolves to would pin the runner's layout rather
    // than this code. The contract that matters is the override, which is also the
    // documented escape hatch for a plugin installed from a package.
    const previous = process.env['HVS_PROJECT_ROOT'];
    try {
      process.env['HVS_PROJECT_ROOT'] = ROOT;
      expect(resolveProjectRoot()).toBe(ROOT);
      expect(manifestPath()).toBe(join(ROOT, 'upstreams', 'manifest.json'));
    } finally {
      if (previous === undefined) delete process.env['HVS_PROJECT_ROOT'];
      else process.env['HVS_PROJECT_ROOT'] = previous;
    }
  });

  it('resolves an absolute path when nothing overrides it', () => {
    const previous = process.env['HVS_PROJECT_ROOT'];
    try {
      delete process.env['HVS_PROJECT_ROOT'];
      const resolved = resolveProjectRoot();
      expect(path.isAbsolute(resolved)).toBe(true);
      expect(resolved).not.toContain('..');
    } finally {
      if (previous !== undefined) process.env['HVS_PROJECT_ROOT'] = previous;
    }
  });

  it('builds a dist/ that is complete enough to be installed', () => {
    // A guard against someone adding a data file the copy script does not know
    // about: the checkout copy exists and no packaged copy does.
    const missing = dataFileCandidates(
      join('voice', 'import', 'demo-voice.json'),
      ROOT,
    ).filter((candidate) => candidate.includes(join('dist')) && !existsQuietly(candidate));
    expect(missing, 'run npm run build to refresh dist/').toEqual([]);
  });
});

function existsQuietly(file: string): boolean {
  return existsSync(file);
}

describe('the copy script', () => {
  it('is wired into the build, so dist/ cannot silently go stale', async () => {
    const { readFileSync } = await import('node:fs');
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['build']).toContain('copy-runtime-data.mjs');
  });

  it('copies from the same paths the resolver expects', async () => {
    const { readFileSync } = await import('node:fs');
    const script = readFileSync(join(ROOT, 'scripts', 'copy-runtime-data.mjs'), 'utf8');
    expect(script).toContain("'upstreams', 'manifest.json'");
    expect(script).toContain("'voice', 'import', 'demo-voice.json'");
    expect(script).toContain("'rules.generated.json'");
  });
});



