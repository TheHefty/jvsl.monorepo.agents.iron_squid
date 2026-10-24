// The newest catalogue version, compared as numbers: as text, "9.3.0" sorts after "11.3.0".
export function latestVersion(versions: readonly string[]): string {
  const parts = (v: string) => v.split('.').map(Number);
  const newest = [...versions]
    .sort((a, b) => {
      const [x, y] = [parts(a), parts(b)];
      for (let i = 0; i < Math.max(x.length, y.length); i++) {
        const d = (x[i] ?? 0) - (y[i] ?? 0);
        if (d) return d;
      }
      return 0;
    })
    .pop();
  if (!newest) throw new Error('catalogue: no catalogue version');
  return newest;
}
