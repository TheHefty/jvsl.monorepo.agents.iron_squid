// Fails when a file tracked by git has the bytes of a game image: Nintendo's assets are never
// committed, under any name (docs/RULES.md). Compares content, not names, so a renamed copy of
// dist/ or public/game/ is caught as surely as the original.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './fetch';

export function trackedGameImages(repoRoot: string, catalogueRoot = 'site/src/catalogue') {
  const locked = new Map<string, string>();
  const root = join(repoRoot, catalogueRoot);
  for (const v of readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const lock = JSON.parse(readFileSync(join(root, v.name, 'images.lock.json'), 'utf8')) as Record<
      string,
      string
    >;
    for (const [path, digest] of Object.entries(lock)) locked.set(digest, `${v.name}/${path}`);
  }
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
  return files.flatMap((file) => {
    const full = join(repoRoot, file);
    if (!statSync(full, { throwIfNoEntry: false })?.isFile()) return [];
    const image = locked.get(sha256(readFileSync(full)));
    return image ? [{ file, image }] : [];
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim();
  const found = trackedGameImages(repoRoot);
  for (const f of found)
    console.error(
      `no-game-images: ${f.file} is the game image ${f.image}; it must not be committed`,
    );
  if (found.length) process.exit(1);
  console.log('no-game-images: no tracked file is a game image');
}
