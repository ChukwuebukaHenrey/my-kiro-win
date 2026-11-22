// Browser entry of the Shop Challenge app (design C12, Requirements 13.1, 13.12).
// Loads the shared @dreame/ui theme stylesheets and the app layout rules, then
// mounts the routes in declarative mode with BrowserRouter (D40).
import '@dreame/ui/tokens.css';
import '@dreame/ui/components.css';
import './shop.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App.tsx';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Shop Challenge: the #root element is missing from index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
