import path from 'node:path';

/** Root of the monorepo; content/cv and data/ live there, shared by the API, the CLI and the skill. */
export const repoRoot = path.resolve(import.meta.dirname, '../../..');
export const contentRoot = path.join(repoRoot, 'content/cv');
// End-to-end tests point CV_STUDIO_DATA_DIR elsewhere so they never touch the versioned database.
export const dataRoot = path.resolve(repoRoot, process.env.CV_STUDIO_DATA_DIR ?? 'data');
