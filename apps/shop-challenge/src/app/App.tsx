// App routes and the footer shown on every route (design C12, Requirements 13.3, 13.9).
import type { ReactNode } from 'react';
import { Link, Route, Routes } from 'react-router';
import { Footer } from './Footer.tsx';
import { LandingView } from './LandingView.tsx';
import { NotFoundView } from './NotFoundView.tsx';
import { PlayDemoRoute } from './PlayDemoRoute.tsx';

export function App(): ReactNode {
  return (
    <div className="shop-app">
      <header className="shop-header">
        <Link to="/" className="shop-brand">
          <span className="shop-brand-mark" aria-hidden="true">
            🛍️
          </span>
          Shop Challenge
        </Link>
      </header>
      <main className="shop-main">
        <Routes>
          <Route path="/" element={<LandingView />} />
          <Route path="/play/demo/:id" element={<PlayDemoRoute />} />
          <Route path="*" element={<NotFoundView />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
