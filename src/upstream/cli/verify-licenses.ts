#!/usr/bin/env node
/**
 * `npm run licenses:verify`
 *
 * Confirms that every preserved licence copy in `licenses/` still matches the
 * licence the upstream actually ships at the pinned commit. If an upstream
 * relicenses, the suite must find out here rather than in a legal review.
 */

import { resolveProjectRoot } from '../manifest.js';
import { verifyPreservedLicenses } from '../sync.js';

async function main(): Promise<number> {
  const projectRoot = resolveProjectRoot();
  const results = await verifyPreservedLicenses(projectRoot);

  let failures = 0;
  for (const result of results) {
    const mark = result.ok ? 'ok  ' : 'FAIL';
    if (!result.ok) failures += 1;
    process.stdout.write(`${mark} ${result.name.padEnd(24)} ${result.detail}\n`);
  }

  process.stdout.write('\n');
  if (failures === 0) {
    process.stdout.write(`All ${results.length} preserved licences match upstream.\n`);
    return 0;
  }
  process.stdout.write(
    `${failures} of ${results.length} preserved licences need attention.\n` +
      'Update licenses/ and THIRD_PARTY_NOTICES.md, then re-run.\n',
  );
  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`licenses:verify failed: ${String(error)}\n`);
    process.exit(1);
  });
