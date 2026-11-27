// The landing page at `/` (design C12, D41, Requirements 13.8, 13.10). The only toolkit
// statement is the Brief §0 sentence quoted in `.kiro/steering/product.md`.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { DEMOS } from '../demos.ts';

export function LandingView(): ReactNode {
  return (
    <section className="dr-node shop-landing">
      <p className="shop-eyebrow">A game for small online shops</p>
      <h1 className="dr-heading">Shop Challenge</h1>
      <p className="dr-body shop-lead">
        A bundle-builder game for small online sellers, such as Instagram and WhatsApp shops: players pick products
        within a budget and end at the seller's link.
      </p>
      <ul className="shop-demos">
        {DEMOS.map((demo) => (
          <li key={demo.id}>
            <Link className="shop-demo-card" to={`/play/demo/${demo.id}`}>
              {demo.title}
            </Link>
          </li>
        ))}
      </ul>
      <h2 className="shop-section-title">How it works</h2>
      <ol className="shop-steps">
        <li>
          <span className="shop-step-title">Choose an occasion</span>
          <span className="dr-note">Say who the gift is for.</span>
        </li>
        <li>
          <span className="shop-step-title">Build a bundle</span>
          <span className="dr-note">Pick items and keep the total within the budget.</span>
        </li>
        <li>
          <span className="shop-step-title">Order from the seller</span>
          <span className="dr-note">Get your bundle and a link to the seller.</span>
        </li>
      </ol>
      <p className="dr-body">
        The toolkit checks activity definitions against documented structural and supported semantic rules before
        playback.
      </p>
      <p className="shop-trust">No sign-up · No tracking · Open source</p>
    </section>
  );
}
