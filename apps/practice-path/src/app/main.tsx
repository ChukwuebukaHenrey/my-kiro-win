// Browser entry of the Practice Path app (design C15, Requirements 18.1, 18.19).
// Loads the shared @dreame/ui theme stylesheets and the app layout rules, then
// mounts the routes in declarative mode with BrowserRouter inside the ProgressProvider.
import '@dreame/ui/tokens.css';
import '@dreame/ui/components.css';
import './practice.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App.tsx';
import { ProgressProvider } from './ProgressProvider.tsx';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Practice Path: the #root element is missing from index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <ProgressProvider>
        <App />
      </ProgressProvider>
    </BrowserRouter>
  </StrictMode>,
);
