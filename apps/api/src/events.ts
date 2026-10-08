import { watch } from 'node:fs';
import type { Response } from 'express';
import { companions, pitchExt } from './repository';

/**
 * Watches content/cv and tells open pages, over server-sent events, that files changed — by the
 * UI, the `pnpm cv` CLI or an agent. A save touches several files; one event lets the UI reload them together.
 */
export function contentEvents(root: string) {
  const clients = new Set<Response>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const watcher = watch(root, (_type, name) => {
    if (!name || ![...companions, pitchExt].some((ext) => name.endsWith(`.${ext}`))) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      for (const res of clients) res.write('event: changed\ndata: {}\n\n');
    }, 150);
  });
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
      clearTimeout(timer);
      watcher.close();
      for (const res of clients) res.end();
    },
  };
}
