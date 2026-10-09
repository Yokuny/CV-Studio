import path from 'node:path';

/** Root of the monorepo; content/cv and data/ live there, shared by the API, the CLI and the skill. */
export const repoRoot = path.resolve(import.meta.dirname, '../../..');
// Both folders are personal and ignored by Git. Tests point them elsewhere so they never touch the user's files.
export const contentRoot = path.resolve(repoRoot, process.env.CV_STUDIO_CONTENT_DIR ?? 'content/cv');
export const dataRoot = path.resolve(repoRoot, process.env.CV_STUDIO_DATA_DIR ?? 'data');
