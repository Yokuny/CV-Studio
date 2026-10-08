import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { usePitches } from './store/pitches';
import { useResumes } from './store/resumes';
import './index.css';

// The local API reports changes in content/cv, including edits made by the CLI or an agent.
void useResumes
  .getState()
  .load()
  .then(() => {
    if (!useResumes.getState().writable) return;
    new EventSource('/api/events').addEventListener('changed', () => {
      void useResumes.getState().refresh();
      void usePitches.getState().refresh();
    });
  });

const root = document.getElementById('root');
if (!root) throw new Error('Elemento raiz da aplicação não encontrado.');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
