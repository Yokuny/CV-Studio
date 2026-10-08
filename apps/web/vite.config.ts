import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const contentRoot = path.join(repoRoot, 'content/cv');
const apiOrigin = `http://127.0.0.1:${process.env.CV_STUDIO_API_PORT ?? 5174}`;

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

export default defineConfig({
  plugins: [react(), tailwindcss(), contentWithoutReload()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    host: '127.0.0.1',
    port: Number(process.env.CV_STUDIO_WEB_PORT ?? 5173),
    strictPort: true,
    fs: { allow: [repoRoot] },
    // The Express API keeps the Host of the page, so its local-origin check still applies.
    proxy: { '/api': { target: apiOrigin, changeOrigin: false } },
  },
  // The preview serves the static build, which reads the bundled files and has no API.
  preview: { proxy: {} },
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
