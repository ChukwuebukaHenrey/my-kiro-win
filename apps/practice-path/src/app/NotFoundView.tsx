// Shown for every path that matches no route and for an unknown demo ID (design C15, Requirement 18.6).
import type { ReactNode } from 'react';
import { Link } from 'react-router';

export function NotFoundView(): ReactNode {
  return (
    <section className="dr-node">
      <h1 className="dr-heading">Page not found</h1>
      <p className="dr-body">No page or lesson matches this address.</p>
      <Link to="/">Back to home</Link>
    </section>
  );
}
