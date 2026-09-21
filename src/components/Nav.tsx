'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import elenorLogo from '@/assets/elenor logo For Web-03.png';
import { MobileNav } from '@/components/MobileNav';
import { useMobileRuntime } from '@/hooks/useMobileRuntime';

export type NavLinkItem = { href: string; label: string };

const FALLBACK_LINKS: NavLinkItem[] = [
  { href: '/about', label: 'About' },
  { href: '/services', label: 'Services' },
  { href: '/work', label: 'Work' },
  { href: '/blog', label: 'Blog' },
  { href: '/faq', label: 'FAQ' },
];
const FALLBACK_CTA: NavLinkItem = { href: '/contact', label: 'Start a project' };

export function Nav({
  links = FALLBACK_LINKS,
  cta = FALLBACK_CTA,
}: {
  links?: NavLinkItem[];
  cta?: NavLinkItem | null;
}) {
  const [scrolled, setScrolled] = useState(false);
  // Scroll direction, surfaced as a data attribute rather than a class so the
  // styling lives entirely in mobile.css: on a phone the header slides away
  // while reading down and returns on the first upward flick, the way app
  // chrome behaves. Desktop reads the attribute and does nothing with it, so
  // its rendering is untouched.
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    let idle: number | undefined;

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      setScrolled(y > 24);

      const delta = y - last;
      // Ignore sub-pixel jitter and the iOS rubber-band past the top.
      if (Math.abs(delta) < 6 || y < 0) return;
      // Never hide near the top: the header is part of the hero there.
      if (y < 120) setHidden(false);
      else setHidden(delta > 0);
      last = y;
    };

    // A separate "is the page moving right now" flag, published on <html> for
    // the mobile layer. The floating chat launcher recedes while scrolling and
    // comes back once the page settles — keyed off motion rather than off
    // scroll direction, so it clears content whichever way the reader is going.
    const markScrolling = () => {
      document.documentElement.setAttribute('data-scrolling', '');
      window.clearTimeout(idle);
      idle = window.setTimeout(
        () => document.documentElement.removeAttribute('data-scrolling'),
        220,
      );
    };

    const onScroll = () => {
      markScrolling();
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => {
      window.clearTimeout(idle);
      document.documentElement.removeAttribute('data-scrolling');
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <header
      id="site-nav"
      data-nav-hidden={hidden ? '' : undefined}
      className={`fixed inset-x-0 top-0 z-[65] transition-all duration-500 ${
        scrolled ? 'py-3' : 'py-5'
      }`}
    >
      <div
        className={`container-x flex items-center justify-between rounded-full transition-all duration-500 ${
          scrolled ? 'glass !px-5 py-2.5' : 'md:px-0'
        }`}
      >
        <Link href="/" className="group flex items-center gap-2.5" aria-label="Elenor — home">
          <Image
            src={elenorLogo}
            alt="Elenor"
            priority
            className={`w-auto transition-all duration-500 ${scrolled ? 'h-7' : 'h-9'}`}
          />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {cta ? (
          <div className="hidden md:block">
            <Link
              href={cta.href}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-brand-glow hover:text-white"
            >
              {cta.label}
            </Link>
          </div>
        ) : null}

        <MobileNavMount links={links} cta={cta} />
      </div>
    </header>
  );
}

/**
 * Mounts the phone navigation only on phones.
 *
 * Deliberately a mount gate and not `md:hidden`: `display:none` hides an
 * element but still mounts it and runs its effects, so a hidden MobileNav
 * would lock scroll and trap focus on desktop too. Rendering nothing until the
 * media query is known also keeps the server and first client render identical
 * — the sheet is closed at rest, so its arrival one frame later is invisible.
 */
function MobileNavMount({ links, cta }: { links: NavLinkItem[]; cta?: NavLinkItem | null }) {
  const isMobile = useMobileRuntime();
  if (!isMobile) return null;
  return <MobileNav links={links} cta={cta} />;
}
