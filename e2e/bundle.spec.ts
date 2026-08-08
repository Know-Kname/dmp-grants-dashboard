import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Is the production bundle still split the way the config says it is?
 *
 * `vite.config.ts` carves four vendor chunks out of the bundle on purpose, and
 * the reasoning for each is written down beside it. Nothing enforced any of it:
 * chunking is configuration whose only output is file layout, so if a group
 * stops matching, every other check in the repository stays green and the only
 * symptom is a slower first paint that nobody attributes to a config edit.
 *
 * That is not hypothetical here. Rolldown removed the object form of
 * `manualChunks` that this project used, and the replacement matches modules by
 * regular expression against resolved paths — a form that fails *silently* when
 * the pattern is wrong, unlike the old one, which named packages and errored on
 * a typo. These tests are what makes a wrong pattern loud.
 *
 * They live in the Playwright suite rather than the unit suite because they
 * assert on build output. `playwright.config.ts` runs `npm run build` before
 * anything else, so `dist/` is guaranteed to exist and to be current; a Vitest
 * run has no such guarantee and would assert against whatever happened to be on
 * disk, which is worse than not testing it.
 */

const ASSETS = join(process.cwd(), 'dist', 'assets');

function assetsMatching(pattern: RegExp): string[] {
  return readdirSync(ASSETS).filter((f) => pattern.test(f));
}

/**
 * The four vendor chunks named in `build.rolldownOptions.output.codeSplitting`.
 * A missing one means its `test` regex stopped matching and the package has
 * been folded back into whatever imported it.
 */
const NAMED_CHUNKS = ['react', 'recharts', 'supabase', 'zod'] as const;

for (const name of NAMED_CHUNKS) {
  test(`the ${name} vendor chunk is still split out`, async () => {
    const matches = assetsMatching(new RegExp(`^${name}-[\\w-]+\\.js$`));

    expect(
      matches,
      `expected exactly one ${name}-*.js chunk in dist/assets — check the ` +
        `matching group in vite.config.ts`,
    ).toHaveLength(1);

    // A chunk that exists but is nearly empty means the group matched a barrel
    // or a stub rather than the package, which the presence check alone misses.
    expect(statSync(join(ASSETS, matches[0]!)).size).toBeGreaterThan(10_000);
  });
}

/**
 * The specific regression the zod group exists to prevent.
 *
 * Zod used to stay out of the entry chunk on its own, because only lazily
 * routed pages imported `lib/schemas`. Then the dashboard started validating
 * its RPC payloads, and the dashboard is eagerly imported by `App.tsx` — which
 * silently pulled the whole parser into the entry chunk, ahead of first paint.
 * Naming the chunk fixed it. Nothing noticed the regression the first time, and
 * nothing would notice it the second time either.
 *
 * `ZodError` is the probe because it survives minification: it is a class name
 * that appears in emitted error messages, so it cannot be mangled away.
 */
test('zod is not in the entry chunk', async () => {
  const entryChunks = assetsMatching(/^index-[\w-]+\.js$/);
  expect(entryChunks.length).toBeGreaterThan(0);

  for (const chunk of entryChunks) {
    const source = readFileSync(join(ASSETS, chunk), 'utf8');
    expect(
      source.includes('ZodError'),
      `${chunk} contains zod — it should be in the zod chunk, not the entry ` +
        `chunk. Something now imports a schema from an eagerly-loaded module.`,
    ).toBe(false);
  }
});
