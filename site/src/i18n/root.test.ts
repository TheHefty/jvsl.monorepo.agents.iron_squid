import { describe, expect, it } from 'vitest';
import { rootAddress } from './root';

describe('rootAddress', () => {
  it('sends the visitor to the locale chosen, under the base path', () => {
    expect(rootAddress('/repo/', () => null, ['ja-JP'])).toBe('/repo/ja-JP/');
  });

  it('uses the remembered choice', () => {
    expect(rootAddress('/', () => 'fr-CA', ['ja-JP'])).toBe('/fr-CA/');
  });

  it('follows the browser when storage cannot be read (failure 1)', () => {
    const refused = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    };
    expect(rootAddress('/', refused, ['ko-KR'])).toBe('/ko-KR/');
  });
});
