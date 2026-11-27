// App footer shown on every route (design C12, Requirements 13.9, 14.4). Both links are
// fixed https URLs that open in a new tab.
import type { ReactNode } from 'react';

const LICENSE_URL = 'https://github.com/ChukwuebukaHenrey/my-kiro-win/blob/main/LICENSE';
const REPO_URL = 'https://github.com/ChukwuebukaHenrey/my-kiro-win';
const PRACTICE_PATH_URL = 'https://my-kiro-win-practice-path.vercel.app/';

export function Footer(): ReactNode {
  return (
    <footer className="shop-footer">
      <p>Built with Kiro</p>
      <ul>
        <li>
          <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer">
            MIT License <span className="dr-note">(opens in a new tab)</span>
          </a>
        </li>
        <li>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            Source on GitHub <span className="dr-note">(opens in a new tab)</span>
          </a>
        </li>
        <li>
          <a href={PRACTICE_PATH_URL} target="_blank" rel="noopener noreferrer">
            Practice Path, the sister app <span className="dr-note">(opens in a new tab)</span>
          </a>
        </li>
      </ul>
      <p>Activities are made by their authors and are not verified by Shop Challenge.</p>
    </footer>
  );
}
