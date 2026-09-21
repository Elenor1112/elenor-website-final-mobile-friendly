'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { NavLinkItem } from '@/components/Nav';

type LenisHandle = { stop: () => void; start: () => void };

/**
 * The phone navigation: a 44px trigger in the header and a full-screen sheet.
 *
 * Mounted only on phones (see MobileNavMount in Nav.tsx) rather than hidden
 * with `md:hidden`, because `display:none` does not stop a component from
 * mounting or running its effects — a hidden copy would still lock scroll and
 * trap focus on desktop.
 *
 * A sheet rather than a bottom tab bar: the links come from the CMS and vary in
 * number, so a fixed row of tabs cannot represent them, and the chat widget
 * already owns the bottom-right corner.
 */
export function MobileNav({ links, cta }: { links: NavLinkItem[]; cta?: NavLinkItem | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Close on navigation. The href may equal the current route (tapping "Work"
  // while on /work), which produces no pathname change and so no effect run —
  // hence the links also close on click.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Warm the routes behind the menu as soon as it opens. Next prefetches links
  // that are in the viewport, but these only enter it when the sheet opens, so
  // without this the first tap pays the full round trip: measured at ~5s on a
  // throttled handset, during which the sheet has already closed and the old
  // page is still on screen, so the tap reads as having done nothing.
  useEffect(() => {
    if (!open) return;
    const hrefs = [...links.map((l) => l.href), ...(cta ? [cta.href] : [])];
    // After paint, so prefetching never competes with the opening transition.
    const id = window.setTimeout(() => {
      for (const href of hrefs) {
        try {
          router.prefetch(href);
        } catch {
          // A malformed CMS href must not break the menu.
        }
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [open, links, cta, router]);

  useEffect(() => {
    if (!open) return;

    // Lock scroll through Lenis rather than by setting overflow directly: Lenis
    // owns the scroll position, and freezing the DOM behind its back makes the
    // page jump when the sheet closes. `.lenis-stopped` applies the overflow.
    const lenis = (window as unknown as { lenis?: LenisHandle }).lenis;
    lenis?.stop();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      // Focus trap: the sheet covers the page, so tabbing must not reach the
      // content behind it.
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])'
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    // Move focus into the sheet so a keyboard or screen-reader user lands
    // inside it rather than continuing through the page behind.
    //
    // Deferred a frame: the panel is `visibility:hidden` while closed (so its
    // parked position does not extend the page), and a hidden element cannot
    // take focus. By the next frame React has applied the open classes and the
    // link is focusable.
    // Poll briefly for the panel to become focusable rather than guessing a
    // frame count. The panel is `visibility:hidden` while closed so its parked
    // position does not extend the page, and a hidden element cannot take
    // focus — `.focus()` before React commits the open classes is a silent
    // no-op that leaves focus stranded on the trigger.
    let focusTimer = 0;
    let tries = 0;
    const grabFocus = () => {
      const panelEl = panelRef.current;
      const link = panelEl?.querySelector<HTMLElement>('a[href]');
      if (panelEl && link && getComputedStyle(panelEl).visibility !== 'hidden') {
        link.focus();
        if (panelEl.contains(document.activeElement)) return;
      }
      if (tries++ < 20) focusTimer = window.setTimeout(grabFocus, 25);
    };
    grabFocus();

    // Swipe right to dismiss — the gesture a drawer is expected to answer.
    // The panel tracks the finger so the sheet feels attached to it rather
    // than merely reacting after the fact.
    const panel = panelRef.current;
    let startX = 0;
    let startY = 0;
    let dragging = false;
    let dx = 0;

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      dragging = false;
      dx = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!panel) return;
      const t = e.touches[0];
      const mx = t.clientX - startX;
      const my = t.clientY - startY;
      // Claim the gesture only once it is clearly horizontal, so scrolling the
      // link list vertically still works.
      if (!dragging) {
        if (Math.abs(mx) < 10 || Math.abs(mx) < Math.abs(my)) return;
        dragging = true;
        panel.style.transition = 'none';
      }
      dx = Math.max(0, mx); // rightward only; the sheet is on the right edge
      panel.style.transform = `translate3d(${dx}px, 0, 0)`;
    };

    const onTouchEnd = () => {
      if (!panel) return;
      panel.style.transition = '';
      panel.style.transform = '';
      // A short flick or a drag past a third of the width dismisses it;
      // anything less springs back.
      if (dragging && dx > panel.offsetWidth * 0.33) close();
      dragging = false;
      dx = 0;
    };

    panel?.addEventListener('touchstart', onTouchStart, { passive: true });
    panel?.addEventListener('touchmove', onTouchMove, { passive: true });
    panel?.addEventListener('touchend', onTouchEnd);
    panel?.addEventListener('touchcancel', onTouchEnd);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      panel?.removeEventListener('touchstart', onTouchStart);
      panel?.removeEventListener('touchmove', onTouchMove);
      panel?.removeEventListener('touchend', onTouchEnd);
      panel?.removeEventListener('touchcancel', onTouchEnd);
      // Clear any in-flight drag so a remount starts from the resting state.
      if (panel) {
        panel.style.transition = '';
        panel.style.transform = '';
      }
      lenis?.start();
    };
  }, [open, close]);

  // Portal target is only available after mount (SSR has no document).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-label={open ? 'Close menu' : 'Open menu'}
      aria-expanded={open}
      aria-controls="mobile-nav-panel"
      className="relative z-[81] grid h-11 w-11 shrink-0 place-items-center rounded-full glass"
    >
      {/* Two bars that cross into an X. Drawn rather than typed so the icon has
          a real shape to animate — the glyphs it replaces could only swap
          abruptly. */}
      <span className="relative block h-4 w-5" aria-hidden>
        <span
          className={`absolute left-0 block h-[1.5px] w-full rounded-full bg-white transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            open ? 'top-1/2 -translate-y-1/2 rotate-45' : 'top-[3px]'
          }`}
        />
        <span
          className={`absolute left-0 block h-[1.5px] w-full rounded-full bg-white transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            open ? 'top-1/2 -translate-y-1/2 -rotate-45' : 'top-[11px]'
          }`}
        />
      </span>
    </button>
  );

  const overlay = (
    <>
      {/* Both stay mounted so the closing transition can play out; `hidden`
          would cut it short. */}
      <div
        aria-hidden={!open}
        onClick={close}
        className={`fixed inset-0 z-[78] bg-ink/80 backdrop-blur-xl transition-opacity duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <div
        id="mobile-nav-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        className={`fixed inset-y-0 right-0 z-[80] flex w-[min(22rem,86vw)] flex-col border-l border-white/10 bg-ink-soft/95 shadow-[-24px_0_60px_-24px_rgba(0,0,0,0.9)] transition-[transform,visibility] duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
          // `invisible` alongside the parked transform: a fixed element sitting
          // off-screen right still counts toward the document's scrollable
          // width, which reintroduced horizontal overflow once the root
          // `overflow-x: hidden` was removed (that rule was breaking scrolling
          // on Android Chrome). visibility:hidden takes it out of that
          // calculation while leaving the transform free to animate, and it is
          // delayed by the same duration as the slide so the closing
          // transition still plays.
          open
            ? 'visible translate-x-0'
            : 'pointer-events-none invisible translate-x-full delay-[280ms]'
        }`}
        style={{
          paddingTop: 'max(5.5rem, calc(env(safe-area-inset-top) + 4.5rem))',
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
        }}
      >
        {/* The trigger lives in the header, which the sheet now covers, so the
            sheet carries its own dismiss control. */}
        <button
          type="button"
          onClick={close}
          aria-label="Close menu"
          tabIndex={open ? 0 : -1}
          className={`absolute right-5 grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white transition-opacity duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ top: 'max(1.25rem, calc(env(safe-area-inset-top) + 0.75rem))' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none">
            <path
              d="M2 2l12 12M14 2L2 14"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-6">
          {links.map((l, i) => {
            const active = pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={close}
                aria-current={active ? 'page' : undefined}
                // Each link waits a little longer than the one above it, so the
                // list resolves downward instead of appearing all at once.
                style={{ transitionDelay: open ? `${120 + i * 30}ms` : '0ms' }}
                className={`flex min-h-[3.25rem] items-center rounded-xl px-3 font-display text-[1.75rem] font-semibold tracking-tight transition-[opacity,transform,color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                  open ? 'translate-x-0 opacity-100' : 'translate-x-3 opacity-0'
                } ${active ? 'text-brand-glow' : 'text-white/85'}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        {cta ? (
          <div className="mt-6 px-6">
            <Link
              href={cta.href}
              onClick={close}
              style={{ transitionDelay: open ? `${140 + links.length * 30}ms` : '0ms' }}
              className={`flex min-h-[3.25rem] items-center justify-center rounded-full bg-[#68cad6] px-6 text-base font-semibold text-ink transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                open ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
              }`}
            >
              {cta.label}
            </Link>
          </div>
        ) : null}
      </div>
    </>
  );

  return (
    <>
      {trigger}
      {/* The overlay is portalled to <body> rather than left inside the header.
          The header carries `will-change: transform` on mobile (it slides away
          on scroll), and a will-change/transform ancestor becomes the
          containing block for position:fixed — which sized this panel to the
          64px header instead of the viewport. The fullscreen model viewer
          documents and dodges the same trap the same way. */}
      {mounted ? createPortal(overlay, document.body) : null}
    </>
  );
}
