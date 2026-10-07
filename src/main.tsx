import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { useResumes } from './store/resumes';
import './index.css';

// Sent by server/resumes.ts when content/cv changes, including edits made by the CLI or an agent.
import.meta.hot?.on('cv-studio:changed', () => void useResumes.getState().refresh());

const root = document.getElementById('root');
if (!root) throw new Error('Elemento raiz da aplicação não encontrado.');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
