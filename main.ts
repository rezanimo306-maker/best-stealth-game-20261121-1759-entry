// Shadow Vault — entry builder (main.ts, Node 22 stdlib only, erasable TS).
//
// Copies game/ and screenshots/ into the output directory, then writes
// /output/dossier.json with buildDossier from vendor/makefun-game.ts.
// Run:  node main.ts            (writes ./out)
//       MAKEFUN_OUTPUT_DIR=out node main.ts
// The output is deterministic: files are copied in sorted order and the
// dossier is canonical JSON, so two runs produce byte-identical trees.

import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || join(here, 'out'));

  // Start from a clean output directory so stale files never leak in.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const gameDir = join(here, 'game');
  const shotsDir = join(here, 'screenshots');
  if (!existsSync(gameDir)) throw new Error(`game/ not found at ${gameDir}`);
  if (!existsSync(shotsDir)) throw new Error(`screenshots/ not found at ${shotsDir}`);

  cpSync(gameDir, join(outDir, 'game'), { recursive: true });
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

  const dossier = buildDossier(outDir, CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`wrote ${join(outDir, 'dossier.json')} (${dossier.length} bytes)`);
}

main();
