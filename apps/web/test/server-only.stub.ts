/**
 * Stands in for the `server-only` package under vitest.
 *
 * That package is a build-time marker: it throws unless the bundler resolves it
 * with React's `react-server` condition, which is how Next turns "this module
 * was imported from a Client Component" into a build error. Tests are not
 * building a client bundle, so the guard has nothing to guard and only needs to
 * be inert.
 *
 * It is aliased rather than resolved by adding `react-server` to vitest's
 * conditions, because that condition also changes how React itself resolves and
 * would take the component tests with it.
 */

export {};
