'use client';

import { useEffect, useState } from 'react';

type LenisHandle = { scrollTo: (target: number, opts?: { immediate?: boolean }) => void };

// Floating "back to top" arrow, stacked above the chat launcher. Appears once
// the visitor is a screen or so down the page. Scrolls through Lenis (exposed
// on window by SmoothScroll) so the motion matches the rest of the site.
const SHOW_AFTER = 600;

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setVisible(window.scrollY > SHOW_AFTER));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const toTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lenis = (window as unknown as { lenis?: LenisHandle }).lenis;
    if (lenis) lenis.scrollTo(0, { immediate: reduce });
    else window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Back to top"
      tabIndex={visible ? undefined : -1}
      aria-hidden={!visible || undefined}
      data-back-to-top
      data-visible={visible || undefined}
      className={[
        'fixed bottom-24 right-6 z-[58] grid h-11 w-11 place-items-center rounded-full',
        'border border-white/12 bg-ink/70 text-white/85 backdrop-blur-xl',
        'shadow-[0_8px_30px_-8px_rgba(0,0,0,0.6)] transition-all duration-300 motion-reduce:transition-none',
        'hover:border-brand-glow/50 hover:text-white',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow focus-visible:ring-offset-2 focus-visible:ring-offset-ink',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
      ].join(' ')}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
