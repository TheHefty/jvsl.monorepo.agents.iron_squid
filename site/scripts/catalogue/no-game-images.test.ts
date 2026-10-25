import { execFileSync } from 'node:child_process';
import { tempDir } from '../../e2e/support/temp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sha256 } from './fetch';
import { trackedGameImages } from './no-game-images';

// A repository where one tracked file has the bytes of a locked image, as if dist/ or public/game/
// had been committed by mistake (task game-images, failure 3).
function repo(withImage: boolean) {
  const dir = tempDir('repo-');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir });
  git('init', '-q');
  const image = Buffer.from('bytes of a locked image');
  mkdirSync(join(dir, 'site/src/catalogue/1.0.0'), { recursive: true });
  writeFileSync(
    join(dir, 'site/src/catalogue/1.0.0/images.lock.json'),
    JSON.stringify({ 'gear/x.png': sha256(image) }),
  );
  writeFileSync(join(dir, 'README.md'), 'hello');
  if (withImage) writeFileSync(join(dir, 'copied.png'), image);
  git('add', '-A');
  return dir;
}

describe('trackedGameImages', () => {
  it('finds a tracked file whose bytes are a locked game image, whatever it is named', () => {
    expect(trackedGameImages(repo(true))).toEqual([
      { file: 'copied.png', image: '1.0.0/gear/x.png' },
    ]);
  });

  it('finds nothing in a repository without game images', () => {
    expect(trackedGameImages(repo(false))).toEqual([]);
  });
});
