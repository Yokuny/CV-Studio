import { mkdirSync, watch } from 'node:fs';
import type { Response } from 'express';
import { companions, pitchExt } from './repository';

/**
 * Watches content/cv and data/ and tells open pages, over server-sent events, that files changed —
 * by the UI, the `pnpm cv` CLI or an agent. A save touches several files; one event lets the UI
 * reload them together. `changed` is for resumes and pitches, `jobs` for the jobs database.
 */
export function contentEvents(root: string, dataRoot: string) {
  const clients = new Set<Response>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const emit = (event: string) => {
    clearTimeout(timers.get(event));
    timers.set(
      event,
      setTimeout(() => {
        for (const res of clients) res.write(`event: ${event}\ndata: {}\n\n`);
      }, 150),
    );
  };
  const watchers = [
    watch(root, (_type, name) => {
      if (name && [...companions, pitchExt].some((ext) => name.endsWith(`.${ext}`))) emit('changed');
    }),
  ];
  mkdirSync(dataRoot, { recursive: true });
  watchers.push(
    watch(dataRoot, (_type, name) => {
      if (name === 'cv-studio.db') emit('jobs');
    }),
  );
  return {
    subscribe(res: Response) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
      });
      res.write('retry: 2000\n\n');
      clients.add(res);
      res.on('close', () => clients.delete(res));
    },
    close() {
      for (const timer of timers.values()) clearTimeout(timer);
      for (const watcher of watchers) watcher.close();
      for (const res of clients) res.end();
    },
  };
}
