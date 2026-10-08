import path from 'node:path';
import { createApi } from './app';
import { contentRoot, dataRoot, repoRoot } from './paths';

try {
  process.loadEnvFile(path.join(repoRoot, '.env.local'));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

const port = Number(process.env.CV_STUDIO_API_PORT ?? 5174);
const webOrigin = process.env.CV_STUDIO_WEB_ORIGIN ?? 'http://127.0.0.1:5173';
const api = createApi({ contentRoot, dataRoot, webOrigin });

// Bound to loopback only: the API writes files and sends email on the user's behalf.
const server = api.app.listen(port, '127.0.0.1', () => {
  console.log(`CV Studio API em http://127.0.0.1:${port} (interface: ${webOrigin})`);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    server.close();
    void api.close().finally(() => process.exit(0));
  });
