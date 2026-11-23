'use client';

/**
 * What every Writer's Studio room shows when the server says no one is signed in (401).
 *
 * Witnessed 2026-11-16: a session ended while the Studio was open, and the room showed black-on-near-black
 * "Sign in to open your Writer's Studio." with no way forward until a manual reload. A reload worked only because
 * the page-level redirect sends a signed-out visitor to /signin?next=… — so the room now does the same at once,
 * returning the writer to exactly where they were. The text stays readable on the Evening (navy) field and carries
 * a Sign in link, so the moment before the redirect (or a blocked redirect) is never a dead end.
 */
import { useEffect } from 'react';

export function studioSignInHref(loc: { pathname: string; search: string }): string {
  return `/signin?next=${encodeURIComponent(`${loc.pathname}${loc.search}`)}`;
}

export default function StudioSignedOut({ what = 'your Writer’s Studio' }: { what?: string }) {
  const href = typeof window === 'undefined'
    ? '/signin'
    : studioSignInHref({ pathname: window.location.pathname, search: window.location.search });

  useEffect(() => {
    try { window.location.replace(href); } catch { /* the link below remains */ }
  }, [href]);

  return (
    <main
      data-studio-signed-out
      style={{
        minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 32,
        background: '#121726', color: '#E6E9F2', fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 420, textAlign: 'center', lineHeight: 1.6 }}>
        <p style={{ margin: '0 0 20px', fontSize: 17 }}>You’re signed out. Sign in to open {what}.</p>
        <a
          href={href}
          style={{
            display: 'inline-block', padding: '12px 28px', borderRadius: 10,
            background: '#7FA2E8', color: '#0E1220', fontWeight: 600, textDecoration: 'none',
          }}
        >
          Sign in
        </a>
        <p style={{ margin: '16px 0 0', fontSize: 13, color: '#A9B0C4' }}>You’ll come straight back here.</p>
      </div>
    </main>
  );
}
