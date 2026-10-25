import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

// The lint rules this project's own rules lean on must keep biting: a literal in JSX breaks the
// i18n seam (NFR-I1), a control with no name breaks accessibility (NFR-A3). This is also the
// regression scenario of debt is-0hg: both must still fail after the move to ESLint 10.
const eslint = new ESLint({ cwd: process.cwd() });
const rulesHit = async (code: string) => {
  const [result] = await eslint.lintText(code, { filePath: 'src/Probe.tsx' });
  return (result?.messages ?? []).map((m) => m.ruleId);
};

describe('lint', () => {
  // The first lint loads ESLint's config and every plugin, about 3.5 s on its own: done once here,
  // with room to spare, so no test's 5 s budget is spent on loading and a busy machine cannot time
  // one out.
  beforeAll(() => eslint.lintText('', { filePath: 'src/Warmup.tsx' }), 60_000);

  it('fails text written directly in JSX', async () => {
    expect(await rulesHit('export const P = () => <p>Hello</p>;\n')).toContain(
      'react/jsx-no-literals',
    );
  });

  it('fails a string literal in a JSX expression', async () => {
    expect(await rulesHit("export const P = () => <p>{'Hello'}</p>;\n")).toContain(
      'react/jsx-no-literals',
    );
  });

  it('fails an image with no text alternative', async () => {
    expect(await rulesHit('export const P = () => <img src="a.png" />;\n')).toContain(
      'jsx-a11y/alt-text',
    );
  });

  it('forbids Math.random in the rules of a run, which must draw from crypto (FR-12)', async () => {
    const [result] = await eslint.lintText('export const roll = () => Math.random();\n', {
      filePath: 'src/run/Probe.ts',
    });
    expect((result?.messages ?? []).map((m) => m.ruleId)).toContain('no-restricted-properties');
  });

  it('passes text that comes from the catalogue', async () => {
    const code =
      "import { FormattedMessage } from 'react-intl';\n" +
      'export const P = () => (\n  <p>\n    <FormattedMessage id="site.name" />\n  </p>\n);\n';
    expect(await rulesHit(code)).toEqual([]);
  });
});
