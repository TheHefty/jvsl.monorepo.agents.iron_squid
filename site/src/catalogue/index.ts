import { latestVersion, versionOf } from './latest';

// The catalogue versions the site was built with, read from the folders under src/catalogue
// without loading their contents: the version alone is what the footer needs.
const versions = Object.keys(import.meta.glob('@catalogues/*/catalogue.json')).map(versionOf);

export const currentVersion = latestVersion(versions);
