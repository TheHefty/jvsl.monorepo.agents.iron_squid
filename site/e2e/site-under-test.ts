// The base path the site was built with; the server and the tests must agree with the build.
export const basePath = process.env.BASE_PATH ?? '/';
export const previewPort = Number(process.env.PREVIEW_PORT ?? 4173);
