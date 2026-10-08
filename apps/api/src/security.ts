import type { RequestHandler } from 'express';

const localHost = /^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/;

/** The API writes files and sends email: only the local UI (same host, through the Vite proxy) may call it. */
export const localOnly: RequestHandler = (req, res, next) => {
  const host = req.headers.host ?? '';
  const origin = req.headers.origin;
  if (!localHost.test(host) || (origin && ![`http://${host}`, `https://${host}`].includes(origin))) {
    res.status(403).json({ error: 'A gravação só é permitida pela interface local.' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  next();
};

/** Mutations must send JSON, which a cross-site form cannot do without a preflight. */
export const jsonOnly: RequestHandler = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.is('application/json')) {
    res.status(415).json({ error: 'Envie JSON.' });
    return;
  }
  next();
};
