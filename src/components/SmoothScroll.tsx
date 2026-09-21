'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Single source of truth for scroll: Lenis drives inertia, GSAP ScrollTrigger
// reads from the same RAF loop so DOM + 3D stay in lockstep. Respects
// prefers-reduced-motion by disabling smoothing (native scroll still works).
export function SmoothScroll() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Touch devices get their momentum from the OS, which is already tuned to
    // the hardware. Amplifying it (1.5) makes a flick overshoot and the page
    // feel detached from the finger, so touch scrolls 1:1 and only pointer
    // devices keep the boost.
    const coarse = window.matchMedia('(pointer: coarse)').matches;

    const lenis = new Lenis({
      duration: reduced ? 0 : 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: !reduced,
      wheelMultiplier: 1,
      touchMultiplier: coarse ? 1 : 1.5,
    });

    // Expose for other components (e.g. anchor scrolling) without prop drilling.
    (window as unknown as { lenis?: Lenis }).lenis = lenis;

    lenis.on('scroll', ScrollTrigger.update);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    ScrollTrigger.refresh();

    // ScrollTrigger caches every start/end offset at refresh time. Without a
    // re-refresh those stay pinned to the first measurement, which breaks two
    // real cases: a desktop window resize, and — far more visibly — a phone
    // collapsing its URL bar, which changes viewport height mid-scroll and
    // leaves every vh-based trigger firing at the wrong place. Debounced
    // because iOS emits resize continuously through that collapse.
    let resizeTimer: number | undefined;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => ScrollTrigger.refresh(), 150);
    };
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });

    return () => {
      window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      gsap.ticker.remove(raf);
      lenis.destroy();
      (window as unknown as { lenis?: Lenis }).lenis = undefined;
    };
  }, []);

  return null;
}
