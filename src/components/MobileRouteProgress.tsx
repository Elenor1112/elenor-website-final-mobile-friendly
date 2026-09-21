'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * A loading bar for route changes on phones.
 *
 * Measured on a throttled handset, tapping a link in the nav sheet and landing
 * on the new page takes several seconds — the server has to render it. In that
 * window the sheet has already closed and the old page is still on screen
 * completely unchanged, so the tap reads as having done nothing. People tap
 * again, or leave.
 *
 * This is the standard answer: acknowledge the tap immediately, then get out of
 * the way. The bar appears on the first click of an internal link and clears
 * when the pathname actually changes.
 *
 * Listening for clicks on the document rather than wiring every <Link>: the
 * links are spread across the nav sheet, cards, the footer and CMS content, and
 * a global listener keeps this in one place. Capture phase so it still runs if
 * something downstream stops propagation.
 *
 * Mobile-only by mount (see the gate in (site)/layout.tsx) — desktop navigation
 * is fast enough not to need it, and adding a bar there would change what the
 * desktop looks like.
 */
export function MobileRouteProgress() {
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const timer = useRef<number | undefined>(undefined);

  // The new route has rendered: clear.
  useEffect(() => {
    setLoading(false);
    window.clearTimeout(timer.current);
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a) return;

      const href = a.getAttribute('href');
      if (!href || !href.startsWith('/')) return; // external, hash, mailto, tel
      if (a.getAttribute('target') === '_blank') return;
      if (href === window.location.pathname) return; // same page, nothing to wait for

      setLoading(true);
      // A navigation that never completes (offline, a route that throws) must
      // not leave the bar running forever.
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setLoading(false), 10000);
    };

    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.clearTimeout(timer.current);
    };
  }, []);

  if (!loading) return null;

  return (
    <div
      // aria-hidden: the route change itself is what a screen reader should
      // announce, and it does. This is a visual reassurance only.
      aria-hidden
      data-route-progress
      className="pointer-events-none fixed inset-x-0 top-0 z-[85] h-[2px] overflow-hidden"
    >
      <div className="h-full w-full origin-left bg-gradient-to-r from-brand to-brand-cyan" />
    </div>
  );
}
