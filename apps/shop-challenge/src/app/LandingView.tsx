// The landing page at `/` (design C12, D41, Requirements 13.8, 13.10). The only toolkit
// statement is the Brief §0 sentence quoted in `.kiro/steering/product.md`.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { DEMOS } from '../demos.ts';

export function LandingView(): ReactNode {
  return (
    <section className="dr-node">
      <h1 className="dr-heading">Shop Challenge</h1>
      <p className="dr-body">
        A bundle-builder game for small online sellers, such as Instagram and WhatsApp shops: players pick products
        within a budget and end at the seller's link.
      </p>
      <p className="dr-body">
        The toolkit checks activity definitions against documented structural and supported semantic rules before
        playback.
      </p>
      <ul>
        {DEMOS.map((demo) => (
          <li key={demo.id}>
            <Link to={`/play/demo/${demo.id}`}>{demo.title}</Link>
          </li>
        ))}
      </ul>
      <p className="shop-trust">No sign-up · No tracking · Open source</p>
    </section>
  );
}
