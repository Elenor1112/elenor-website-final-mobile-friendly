'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

const STORAGE_KEY = 'elenor_intro_seen';
const PHRASE = 'Where Innovation Meets Quality.';
const BRAND = 'elenor';

// Parser-blocking skip check, inlined right after the overlay markup: returning
// visitors and reduced-motion users get `display:none` injected into <head>
// before first paint — no flash, no delay. It only appends a <style> tag and
// never touches React-managed nodes, so hydration stays clean. The tag also
// persists across client-side navigations, covering remounts before hydration.
// The `#site-nav` restore pairs with the `body:has(#elenor-intro)` rule in
// globals.css that keeps the nav hidden while the overlay is in the DOM —
// every path that hides the intro must also bring the nav back.
const HIDE_CSS = '#elenor-intro{display:none}#site-nav{visibility:visible!important}';

// The overlay is server-rendered, so it covers the page from first paint until
// React hydrates and the animation takes over. On a fast connection that gap is
// imperceptible. On a throttled handset it is not: hydration was still pending
// ten seconds in, and because the overlay's words are set in a webfont that had
// not arrived either, the visitor spent that whole time looking at an
// unbroken black screen — indistinguishable from a site that failed to load.
//
// The watchdog below therefore lives in this pre-paint script rather than in
// the effect, because the effect is exactly the thing that has not run yet.
// If the animation has not claimed the overlay within 2.5s, the page is
// revealed and the intro is retired for good. A visitor on a slow connection
// simply never sees it, which is the correct trade: it is decorative, it plays
// once, and the real content is already sitting underneath.
//
// `data-intro-armed` is set by the animation as soon as it starts, and is what
// tells the watchdog to stand down.
const SKIP_SCRIPT = `(function(){try{var H='${HIDE_CSS}';var K='${STORAGE_KEY}';
function hide(){var s=document.createElement('style');s.textContent=H;document.head.appendChild(s);}
if(localStorage.getItem(K)||window.matchMedia('(prefers-reduced-motion: reduce)').matches){hide();return;}
setTimeout(function(){var el=document.getElementById('elenor-intro');
if(el&&!el.hasAttribute('data-intro-armed')){try{localStorage.setItem(K,'1');}catch(e){}hide();}},2500);
}catch(e){}})();`;

function hideIntroPermanently() {
  const style = document.createElement('style');
  style.textContent = HIDE_CSS;
  document.head.appendChild(style);
}

// One-time first-visit intro, three acts:
//   1. The tagline "Where Innovation Meets Quality." falls in word by word
//      from above the viewport and bounces to a settle (FallingText-style,
//      but deterministic — GSAP only, no physics engine).
//   2. The six letters spelling E-l-e-n-o-r are plucked out of the fallen
//      phrase and fly to center, assembling the brand word while the leftover
//      letters tumble away — the tagline conveniently contains all of them.
//   3. The assembled word glows once (in → hold → out, then fully static),
//      the overlay fades, and a localStorage flag makes sure it never replays.
// Purely presentational: the real page is fully server-rendered underneath,
// and the overlay is position:fixed, so removing it causes zero layout shift.
export function IntroAnimation() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const phraseRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      // Storage unavailable (private mode / blocked): play nothing rather
      // than replaying forever.
      seen = true;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (seen || reduced) {
      setDone(true);
      return;
    }

    const coarse = window.matchMedia('(pointer: coarse)').matches;

    const overlay = overlayRef.current;
    const phrase = phraseRef.current;
    const word = wordRef.current;
    if (!overlay || !phrase || !word) return;

    // Tell the pre-paint watchdog to stand down: the animation is running.
    overlay.setAttribute('data-intro-armed', '');

    const words = Array.from(phrase.querySelectorAll<HTMLElement>('[data-word]'));
    const letters = Array.from(phrase.querySelectorAll<HTMLElement>('[data-letter]'));
    const targets = Array.from(word.children) as HTMLElement[];

    // Freeze scroll while the overlay owns the screen (Lenis is exposed on
    // window by SmoothScroll; .lenis-stopped also sets overflow:hidden).
    const lenis = (window as unknown as { lenis?: { stop: () => void; start: () => void } }).lenis;
    lenis?.stop();

    // Same shadow structure at zero-alpha so GSAP can interpolate the glow.
    const shadowOff =
      '0 0 0px rgba(104,202,214,0), 0 0 0px rgba(54,224,208,0), 0 0 0px rgba(54,224,208,0)';
    const shadowGlow =
      '0 0 18px rgba(104,202,214,0.95), 0 0 55px rgba(54,224,208,0.6), 0 0 110px rgba(54,224,208,0.4)';

    gsap.set(word, { textShadow: shadowOff });
    gsap.set(words, {
      opacity: 1,
      y: () => -(window.innerHeight / 2 + 220),
      rotation: () => gsap.utils.random(-25, 25),
    });

    let assembleTl: gsap.core.Timeline | undefined;

    // The ONLY exit from the overlay. Every escape route below routes through
    // it, because it is what restarts Lenis and restores the nav — leaving the
    // overlay by any other path strands the page with overflow:hidden and a
    // hidden header (see the body:has(#elenor-intro) rule in globals.css).
    let finished = false;
    let watchdog: number | undefined;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(watchdog);
      try {
        localStorage.setItem(STORAGE_KEY, '1');
      } catch {}
      hideIntroPermanently();
      lenis?.start();
      setDone(true);
    };

    // Act 2 measures each letter's flight path from live layout and skips any
    // letter it cannot find. On a slow or throttled device that chain can
    // stall, and because scroll is frozen until finish() runs, a stall leaves
    // the page permanently unscrollable with no navigation. The watchdog is
    // the guarantee that cannot happen: worst case the intro is cut short.
    watchdog = window.setTimeout(finish, 6000);

    // Nobody should be held hostage by an intro. A tap or click anywhere
    // exits immediately.
    overlay.addEventListener('pointerdown', finish);

    // Act 2+3 are built only after the phrase has settled, because the letter
    // flight paths are measured from live layout (works at any viewport size
    // and line-wrapping of the phrase).
    const assemble = () => {
      // Pluck one source letter per brand letter, case-insensitively —
      // 'e' from "Where" becomes the capital E via the arrival crossfade.
      const used = new Set<HTMLElement>();
      const flights: { el: HTMLElement; dx: number; dy: number; scale: number }[] = [];
      for (let i = 0; i < BRAND.length; i++) {
        const target = targets[i];
        const src = letters.find(
          (l) => !used.has(l) && l.dataset.letter === BRAND[i].toLowerCase()
        );
        if (!src) continue;
        used.add(src);
        const sr = src.getBoundingClientRect();
        const tr = target.getBoundingClientRect();
        flights.push({
          el: src,
          dx: tr.left + tr.width / 2 - (sr.left + sr.width / 2),
          dy: tr.top + tr.height / 2 - (sr.top + sr.height / 2),
          scale: tr.height / sr.height,
        });
      }
      const leftovers = letters.filter((l) => !used.has(l));
      const flyers = flights.map((f) => f.el);

      assembleTl = gsap.timeline({ onComplete: finish });
      if (coarse) assembleTl.timeScale(1.6);

      // Leftover letters tumble off the bottom while the chosen six fly.
      assembleTl.to(
        leftovers,
        {
          y: () => window.innerHeight * 0.65,
          rotation: () => gsap.utils.random(-50, 50),
          opacity: 0,
          duration: 0.7,
          ease: 'power2.in',
          stagger: { each: 0.012, from: 'random' },
        },
        0
      );
      flights.forEach((f, i) => {
        assembleTl!.to(
          f.el,
          {
            x: f.dx,
            y: f.dy,
            scale: f.scale,
            transformOrigin: '50% 50%',
            duration: 0.85,
            ease: 'power3.inOut',
          },
          0.15 + i * 0.04
        );
      });

      assembleTl
        // Arrival crossfade: swap the flown letters for the real wordmark
        // (fixes case — the flown lowercase 'e' becomes the capital E).
        .to(word, { opacity: 1, duration: 0.2 }, '-=0.2')
        .to(flyers, { opacity: 0, duration: 0.2 }, '<')
        // Glow once: in, brief hold, out — ends fully static and non-glowing.
        .to(word, { textShadow: shadowGlow, duration: 0.35, ease: 'power2.in' }, '+=0.1')
        .to(word, { textShadow: shadowOff, duration: 0.5, ease: 'power2.out' }, '+=0.3')
        // Reveal the page beneath.
        .to(word, { scale: 1.06, autoAlpha: 0, duration: 0.45, ease: 'power2.inOut' }, '+=0.1')
        .to(overlay, { autoAlpha: 0, duration: 0.45, ease: 'power2.inOut' }, '<0.1');
    };

    // Act 1 — the tagline falls in and settles.
    // Phones run the same choreography at 1.6x, because the full ~3.5s holds
    // scroll frozen behind a splash screen — patience a desktop visitor
    // extends and a phone visitor answers by leaving. Scaling the timeline
    // rather than branching keeps one set of choreography to maintain.
    const fallTl = gsap.timeline({ delay: 0.15 });
    if (coarse) fallTl.timeScale(1.6);
    fallTl
      .to(words, {
        y: 0,
        duration: 0.9,
        ease: 'bounce.out',
        stagger: 0.11,
      })
      .to(words, { rotation: 0, duration: 0.4, ease: 'back.out(1.8)', stagger: 0.06 }, '-=0.5')
      .add(assemble, '+=0.3');

    return () => {
      window.clearTimeout(watchdog);
      overlay.removeEventListener('pointerdown', finish);
      fallTl.kill();
      assembleTl?.kill();
      lenis?.start();
    };
  }, []);

  if (done) return null;

  return (
    <>
      <div
        id="elenor-intro"
        ref={overlayRef}
        aria-hidden
        className="fixed inset-0 z-[100] flex items-center justify-center bg-ink"
      >
        {/* Act 1: the falling tagline. Words are opacity-0 until GSAP takes
            over so nothing shows pre-hydration. */}
        <div
          ref={phraseRef}
          className="flex max-w-4xl flex-wrap justify-center gap-x-[0.35em] px-6 text-center font-display text-4xl font-semibold tracking-tight text-paper md:text-6xl"
        >
          {PHRASE.split(' ').map((w, wi) => (
            <span key={wi} data-word className="inline-block whitespace-nowrap opacity-0 will-change-transform">
              {w.split('').map((ch, ci) => (
                <span key={ci} data-letter={ch.toLowerCase()} className="inline-block will-change-transform">
                  {ch}
                </span>
              ))}
            </span>
          ))}
        </div>

        {/* Act 2 target: the brand word, centered. Invisible until the flown
            letters arrive, then crossfaded in; also the glow surface. */}
        <div
          ref={wordRef}
          className="absolute flex font-display text-7xl font-bold tracking-tight text-paper opacity-0 md:text-9xl"
        >
          {BRAND.split('').map((ch, i) => (
            <span key={i} className="inline-block">
              {ch}
            </span>
          ))}
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SKIP_SCRIPT }} />
      <noscript>
        <style>{HIDE_CSS}</style>
      </noscript>
    </>
  );
}
