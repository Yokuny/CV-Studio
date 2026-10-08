import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { useJobs } from './store/jobs';
import { usePitches } from './store/pitches';
import { useResumes } from './store/resumes';
import './index.css';

// The local API reports changes in content/cv and in the jobs database, including those made by
// the `pnpm cv` CLI or an agent.
void useResumes
  .getState()
  .load()
  .then(() => {
    if (!useResumes.getState().writable) return;
    const events = new EventSource('/api/events');
    events.addEventListener('changed', () => {
      void useResumes.getState().refresh();
      void usePitches.getState().refresh();
    });
    events.addEventListener('jobs', () => {
      if (useJobs.getState().ready) void useJobs.getState().load();
    });
  });

const root = document.getElementById('root');
if (!root) throw new Error('Elemento raiz da aplicação não encontrado.');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
