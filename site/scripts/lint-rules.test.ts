import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// The lint rules this project's own rules lean on must keep biting: a literal in JSX breaks the
// i18n seam (NFR-I1), a control with no name breaks accessibility (NFR-A3). This is also the
// regression scenario of debt is-0hg: both must still fail after the move to ESLint 10.
const eslint = new ESLint({ cwd: process.cwd() });
const rulesHit = async (code: string) => {
  const [result] = await eslint.lintText(code, { filePath: 'src/Probe.tsx' });
  return (result?.messages ?? []).map((m) => m.ruleId);
};

describe('lint', () => {
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

  it('passes text that comes from the catalogue', async () => {
    const code =
      "import { FormattedMessage } from 'react-intl';\n" +
      'export const P = () => (\n  <p>\n    <FormattedMessage id="site.name" />\n  </p>\n);\n';
    expect(await rulesHit(code)).toEqual([]);
  });
});
