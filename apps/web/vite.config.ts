import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const contentRoot = path.join(repoRoot, 'content/cv');
const apiRoot = path.join(repoRoot, 'apps/api/src');
const coreRoot = path.join(repoRoot, 'packages/core/src');

type Api = ReturnType<typeof import('../api/src/app').createApi>;

/**
 * Files in content/cv are part of the module graph through the bundled-resumes glob. Instead of
 * letting Vite reload the page, which would drop the open tab, the UI merges them when the local
 * API reports the change over /api/events.
 */
function contentWithoutReload(): Plugin {
  return {
    name: 'content-without-reload',
    hotUpdate({ file }) {
      if (path.dirname(file) === contentRoot) return [];
    },
  };
}

/**
 * Runs the Express API inside the Vite dev server, on the same origin as the UI: no second
 * process, port or proxy. The API is loaded through Vite's SSR loader and rebuilt when a file
 * in apps/api/src or packages/core/src changes, so its code reloads like the UI does.
 */
function localApi(): Plugin {
  return {
    name: 'cv-studio-api',
    apply: 'serve',
    // The API is rebuilt below; without this, Vite would reload the page for server-only changes.
    hotUpdate({ file }) {
      if (this.environment.name === 'ssr' && (file.startsWith(apiRoot) || file.startsWith(coreRoot))) return [];
    },
    configureServer(server) {
      try {
        process.loadEnvFile(path.join(repoRoot, '.env.local'));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      let api: Promise<Api> | undefined;
      const start = () => (api ??= loadApi(server));
      const stop = async () => {
        const current = api;
        api = undefined;
        await current?.then((it) => it.close()).catch(() => {});
      };

      server.watcher.add([apiRoot, coreRoot]);
      server.watcher.on('change', (file) => {
        if (!file.startsWith(apiRoot) && !file.startsWith(coreRoot)) return;
        server.environments.ssr.moduleGraph.invalidateAll();
        void stop().then(() => server.config.logger.info('API recarregada', { timestamp: true }));
      });
      server.httpServer?.once('close', () => void stop());

      server.middlewares.use((req, res, next) => {
        if (req.url !== '/api' && !req.url?.startsWith('/api/') && !req.url?.startsWith('/api?')) return next();
        start().then(
          ({ app }) => app(req as never, res as never, next),
          (error) => next(error),
        );
      });
    },
  };
}

async function loadApi(server: ViteDevServer): Promise<Api> {
  const { createApi } = (await server.ssrLoadModule(path.join(apiRoot, 'app.ts'))) as typeof import('../api/src/app');
  const { dataRoot } = (await server.ssrLoadModule(
    path.join(apiRoot, 'paths.ts'),
  )) as typeof import('../api/src/paths');
  return createApi({ contentRoot, dataRoot });
}

export default defineConfig({
  plugins: [react(), tailwindcss(), contentWithoutReload(), localApi()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    host: 'localhost',
    port: Number(process.env.CV_STUDIO_WEB_PORT ?? 5173),
    strictPort: true,
    fs: { allow: [repoRoot] },
  },
  // The preview serves the static build, which reads the bundled files and has no API.
  preview: { host: 'localhost' },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          markdown: ['react-markdown', 'remark-gfm'],
          ui: ['radix-ui'],
          'editor-engine': ['@tiptap/pm/view', '@tiptap/pm/state'],
        },
      },
    },
  },
});
