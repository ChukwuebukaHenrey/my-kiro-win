// App routes and the footer shown on every route (design C15, Requirements 18.3, 18.16).
import type { ReactNode } from 'react';
import { Route, Routes } from 'react-router';
import { Footer } from './Footer.tsx';
import { LandingView } from './LandingView.tsx';
import { NotFoundView } from './NotFoundView.tsx';
import { PlayDemoRoute } from './PlayDemoRoute.tsx';

export function App(): ReactNode {
  return (
    <div className="pp-app">
      <main className="pp-main">
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
