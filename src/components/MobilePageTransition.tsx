'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Route-change entrance for phones.
 *
 * On a phone, a hard cut between routes is the clearest "this is a website"
 * tell — native apps always move content in. This replays a short rise-and-fade
 * on `<main>` each time the path changes.
 *
 * Implemented by toggling a data attribute on an element that already exists
 * rather than by wrapping children in a motion component, for two reasons:
 *
 *  1. A wrapper that animates `transform` becomes the containing block for
 *     every `position: fixed` descendant inside it, which would pin the chat
 *     widget and any modal to the wrapper instead of the viewport. The existing
 *     ModelFullscreenViewer portals to document.body specifically to dodge that
 *     trap (see its comment); introducing a site-wide transformed ancestor
 *     would re-create it everywhere.
 *  2. The animation itself lives in mobile.css, so desktop has no transition to
 *     inherit — the attribute is simply inert above 768px.
 *
 * Renders nothing.
 */
export function MobilePageTransition() {
  const pathname = usePathname();
  const isFirst = useRef(true);

  useEffect(() => {
    const main = document.getElementById('main');
    if (!main) return;

    // Skip the very first mount: the page is already painting its own entrance
    // (hero reveal, intro overlay), and animating over that reads as a stutter.
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }

    // Restart the animation by removing and re-adding the attribute across a
    // frame — re-setting it alone would not retrigger a running animation.
    main.removeAttribute('data-route-enter');
    // Reading offsetWidth forces the style flush that makes the removal count.
    void main.offsetWidth;
    main.setAttribute('data-route-enter', '');

    const done = () => main.removeAttribute('data-route-enter');
    main.addEventListener('animationend', done, { once: true });
    // Belt and braces: if the animation never fires (reduced motion, desktop),
    // clear the attribute so it cannot accumulate.
    const t = window.setTimeout(done, 600);

    return () => {
      window.clearTimeout(t);
      main.removeEventListener('animationend', done);
    };
  }, [pathname]);

  return null;
}
