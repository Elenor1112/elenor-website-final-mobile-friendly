'use client';

import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';

const STORAGE_KEY = 'elenor_hero_headline_seen';
const PREP_ID = 'elenor-hero-prep';

// ─────────────────────────────────────────────────────────────────────────────
// HERO HEADLINE — recreated frame-for-frame from D:\Web\Comp-1.mp4
//
// Every number below was MEASURED off the reference, not designed. Frames were
// captured through Edge (98 presented frames over the 3.96 s clip) and the two
// text layers separated from the background by colour signature, then their
// bounding boxes tracked per frame. See REF/LAYOUT/TIMING for what came out.
//
// TWO DIFFERENT MECHANISMS, because the reference uses two:
//
//  1. SCRIPT WORDS ("Where", "Meets") are WRITTEN ON. Cropping the reveal shows
//     letters emerging as growing pen strokes, all letters advancing in
//     parallel. Crucially the ink is at FULL brightness in its first visible
//     frame (peak 255 from frame one) while only the lit AREA grows — so this
//     is a reveal, never a fade. Both words share one normalised progress curve
//     (.022 .073 .147 .240 .343 … at matching offsets); they are the same
//     animation, delayed.
//
//  2. ORBITRON WORDS are WIPED by a hard horizontal edge, fully lit behind it —
//     "INNOVATION" bottom→top, "QUALITY." top→bottom. Opposite directions, and
//     that opposition is the whole character of the lockup.
//
// No fades, no scaling, no rotation, no translation: every word's bounding box
// is static across the entire clip. No glow either — the measured edge ramp is
// 22→74→226 over ~2 px, i.e. plain antialiasing.
// ─────────────────────────────────────────────────────────────────────────────

/** Reference composition size. All geometry below is in these pixels. */
const REF = { w: 1276, h: 660 } as const;

/**
 * The window actually rendered, in reference pixels.
 *
 * The measured ink only spans x∈[389,821], y∈[250,534] — 432x284 of artwork
 * sitting inside a 1276x660 frame, i.e. a third of the width and under half the
 * height. That empty margin is an artefact of where the lockup happened to sit
 * in the source video, not part of the composition, and rendering the full
 * frame spends most of the hero's width on transparent padding.
 *
 * Cropping the viewBox to the ink (plus a small margin so the script swashes and
 * the cyan pulse never clip) makes the lockup fill its container. Every
 * coordinate above stays in REF space and is untouched — only the window onto
 * them moves — so the Meets/INNOVATION/QUALITY interlock is preserved exactly.
 *
 * The LEFT edge takes no pad: the headline is left-aligned against the eyebrow
 * and sub-copy, and any pad there becomes a transparent gap that pushes the ink
 * off that shared edge. `overflow-visible` on the <svg> means the W/M swashes
 * still paint if they reach past x0 rather than being clipped.
 */
const PAD = 26;
const VIEW = {
  x: 389,
  y: 250 - PAD,
  w: 821 - 389 + PAD,
  h: 534 - 250 + PAD * 2,
} as const;

/**
 * How wide the lockup is allowed to render, shared with the rest of the hero.
 *
 * `HEADLINE_BOX` is the <svg>'s own box: the full width of its column, capped
 * viewport-relatively (see the note on the element itself) so the lockup's
 * rendered size stays tied to viewport height rather than shrinking whenever
 * its column narrows (e.g. sharing the hero row with the copy block).
 * `HEADLINE_INK_SPAN` is the fraction of that box actually covered by ink,
 * measured left edge of "Where" (x=389, flush with VIEW.x) to right edge of
 * "QUALITY." (x=817) — QUALITY. being the widest word's right edge, and
 * therefore the lockup's.
 *
 * Multiplying the two gives the exact span from "Where" to "QUALITY.", which is
 * what the sub-copy below is sized to so its first and last characters land on
 * the same two vertical lines as the headline's. Exported rather than duplicated
 * because both numbers are derived from the measured boxes above — if the crop
 * or the cap moves, the paragraph follows.
 */
/**
 * The cap is indirected through `--headline-cap` so the mobile layer can
 * replace it inside a media query (see mobile.css). A viewport-height cap is
 * right on a landscape screen but wrong on a phone, where height is the
 * abundant axis and width is the scarce one — there the lockup must be capped
 * by the column instead, or it overflows the viewport. Folding that case into
 * this `min()` as an extra term is not an option: on a tall, narrow desktop
 * window (768x1080) a width term would win and change the desktop rendering.
 */
export const HEADLINE_BOX = `min(100%, var(--headline-cap, calc(51vh * ${VIEW.w} / ${VIEW.h})))`;
export const HEADLINE_INK_SPAN = (817 - VIEW.x) / VIEW.w;
export const HEADLINE_WIDTH = `calc(${HEADLINE_BOX} * ${HEADLINE_INK_SPAN})`;

type Word = {
  key: string;
  text: string;
  kind: 'script' | 'techno';
  /** Measured ink box in reference pixels. */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Wipe direction for `techno` words. */
  wipe?: 'up' | 'down';
  start: number;
  duration: number;
};

// ── LAYOUT + TIMING ──────────────────────────────────────────────────────────
//
// Boxes are the measured ink extents at the final frame. `start`/`duration`
// come from tracking each word's reveal edge frame by frame.
//
// The words INTERLOCK by design in the reference: "Meets" (a tall script M with
// a deep descender, 165 px of ink) crosses INNOVATION's baseline and tucks left
// of QUALITY. That overlap is why the lockup is laid out on absolute measured
// coordinates inside a fixed viewBox rather than by normal text flow — no
// stacking model reproduces it, and it is the composition's signature.
const WORDS: Word[] = [
  { key: 'where', text: 'Where', kind: 'script', x0: 389, x1: 536, y0: 250, y1: 345, start: 0.06, duration: 0.64 },
  { key: 'innovation', text: 'INNOVATION', kind: 'techno', wipe: 'up', x0: 440, x1: 821, y0: 342, y1: 388, start: 0.78, duration: 0.52 },
  { key: 'meets', text: 'Meets', kind: 'script', x0: 445, x1: 630, y0: 370, y1: 534, start: 1.28, duration: 0.76 },
  { key: 'quality', text: 'QUALITY.', kind: 'techno', wipe: 'down', x0: 545, x1: 817, y0: 416, y1: 463, start: 2.06, duration: 0.52 },
];

/**
 * Paint order, which is NOT the timing order above.
 *
 * "Meets" and "QUALITY." overlap by 85 px (Meets x1=630 against QUALITY x0=545)
 * and SVG paints in document order, so whichever is emitted last wins the
 * shared pixels. In `WORDS` order that is QUALITY, whose cyan Q lands on top of
 * Meets' white M and reads as "OUALITY".
 *
 * The reference puts the script in front: its own tracker measured QUALITY's
 * left ink edge at x=545, which is only observable if the Q is not buried under
 * the M. Script words are therefore painted last, over the Orbitron ones.
 *
 * Timing is unaffected — the animation reads `WORDS` directly, and each word's
 * reveal is driven through its own mask rather than its position in the tree.
 */
const PAINT_ORDER: Word[] = [
  ...WORDS.filter((w) => w.kind === 'techno'),
  ...WORDS.filter((w) => w.kind === 'script'),
];

/** Measured ink colours (99th percentile of each mask). */
const INK = { script: '#FFFFFF', techno: '#5EFBFB' } as const;

// Fitted numerically against the tracked reveal edges, best-of-five:
//  · wipes  — ease-out power 2.2 / 2.4, rms 0.79 / 0.92 px
//             (linear was 11.9 / 14.4 px, so this is not a close call)
//  · script — power1.5.out rms 0.049, beating power2.out .081 and linear .134
const EASE = { wipe: 'power2.out', script: 'power1.5.out' } as const;

/** Measured hand-off gaps: +0.08, −0.02 (a real overlap), +0.02. */
const SEQUENCE_END = 2.58;

/** Fade-up for the surrounding hero copy, once the lockup settles. */
const REST_FADE = { duration: 0.7, stagger: 0.1, ease: 'power2.inOut' } as const;

// Hides the lockup ink and the surrounding hero copy before first paint, so the
// reveal animation can play them in rather than having them pop.
//
// The watchdog matters as much as the hiding does. Everything this script hides
// is restored by the GSAP timeline, which cannot start until React hydrates —
// and on a throttled handset hydration was still pending ten seconds in. The
// result was a hero with an invisible headline AND invisible body copy: the
// visitor saw an empty page and had no way to know anything was coming.
//
// So if the reveal has not taken over within 2.5s, this removes its own style
// tag and the hero simply appears, unanimated. The animation is the treat; the
// content is the point.
const PREP_SCRIPT = `(function(){try{if(sessionStorage.getItem('${STORAGE_KEY}'))return;if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
var s=document.createElement('style');s.id='${PREP_ID}';s.textContent='[data-ink]{opacity:0}[data-hero-rest]{opacity:0}';document.head.appendChild(s);
setTimeout(function(){var t=document.getElementById('${PREP_ID}');
if(t&&!document.querySelector('[data-headline-armed]')){t.remove();}},2500);
}catch(e){}})();`;

/**
 * Per-word font sizing.
 *
 * Orbitron: measured cap heights are 47 px (INNOVATION) and 48 px (QUALITY.);
 * at Orbitron's ~0.70 cap ratio both land on ~67 px, i.e. the two words are the
 * SAME size and the 1 px difference is the period's antialiasing. Hard-coding
 * one size keeps them locked together.
 *
 * Script: the two script words are NOT the same size in the reference — "Where"
 * spans 96 px of ink against "Meets"' 165 px, because Meets' M and s swash far
 * past the x-height. Their sizes are therefore expressed per word and then
 * corrected at runtime (see fitToBox), since the actual face is supplied by the
 * consumer and we cannot know its metrics ahead of time.
 */
/**
 * `baseline` is where the word's baseline sits inside its measured ink box, as
 * a fraction of that box's height. Uppercase Orbitron has no descenders, so its
 * ink bottom IS the baseline (1.0). The script words hang below theirs — the
 * fractions are read off the reference: "Where"'s single `e`-tail descent is
 * shallow, "Meets"' swashed s drops much further, which is most of why its ink
 * box is 165 px tall against "Where"'s 96 px.
 */
const TYPE: Record<string, { size: number; anchorY: number; baseline: number }> = {
  where: { size: 116, anchorY: 345, baseline: 0.82 },
  innovation: { size: 67, anchorY: 388, baseline: 1 },
  meets: { size: 200, anchorY: 500, baseline: 0.72 },
  quality: { size: 67, anchorY: 463, baseline: 1 },
};

export function HeroHeadline({ line1, line2 }: { line1: string; line2: string }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // Tell the pre-paint watchdog in PREP_SCRIPT to stand down: the reveal has
    // hydrated and will restore what that script hid.
    root.setAttribute('data-headline-armed', '');

    const removePrep = () => document.getElementById(PREP_ID)?.remove();

    const svg = root.querySelector<SVGSVGElement>('svg');
    const inks = Array.from(root.querySelectorAll<SVGGElement>('[data-ink]'));
    const restEls = Array.from(
      (root.closest('section') ?? document).querySelectorAll<HTMLElement>('[data-hero-rest]')
    );

    let seen = false;
    try {
      seen = sessionStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      seen = true;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /**
     * Snaps each rendered word onto its measured ink box.
     *
     * The reference's own faces are not bundled — the consumer supplies them
     * through --font-hero-script / --font-hero-techno — so glyph metrics are
     * unknown until the browser has actually laid the text out. Rather than
     * trust a guessed font-size, measure what the browser produced and scale it
     * onto the box that was measured off the video. That keeps the lockup (and
     * especially the Meets/INNOVATION/QUALITY interlock) correct against
     * whatever face is dropped in, and makes the layout self-correcting if the
     * fonts are swapped later.
     */
    const fitToBox = () => {
      for (const w of WORDS) {
        const g = root.querySelector<SVGGElement>(`[data-fit="${w.key}"]`);
        const text = root.querySelector<SVGTextElement>(`[data-text="${w.key}"]`);
        if (!g || !text) continue;

        gsap.set(g, { x: 0, y: 0, scale: 1 });
        g.removeAttribute('transform');

        const b = text.getBBox();
        if (!b.width || !b.height) continue;

        const targetW = w.x1 - w.x0;
        const targetH = w.y1 - w.y0;

        // Scale on WIDTH, never on the tighter axis.
        //
        // getBBox() on a <text> reports the em box — ascender to descender,
        // including the leading no glyph actually occupies. The measured boxes
        // are INK extents: for the Orbitron words that is a cap height (46 px
        // against an 82.6 px em box). Fitting em-height onto cap-height shrinks
        // every word by ~30% and opens gaps the reference does not have, which
        // is exactly what collapsed the lockup the first time round.
        //
        // Width is the honest axis: it is ink-to-ink on both sides for these
        // words, so matching it reproduces the measured spans directly and lets
        // the height fall where the face's own proportions put it.
        const s = targetW / b.width;

        // Horizontal: pin to the measured left ink edge.
        const tx = w.x0 - b.x * s;

        // Vertical: align the BASELINE rather than the box, since that is the
        // one line the reference and the font agree on. Fitting box-top to
        // box-top would instead let each face's ascender height decide where
        // the word lands, so a taller face would drift the whole lockup.
        const t = TYPE[w.key];
        const baselineTarget = w.y0 + targetH * t.baseline;
        const ty = baselineTarget - t.anchorY * s;
        g.setAttribute('transform', `translate(${tx} ${ty}) scale(${s})`);
      }
    };

    /** Every word fully visible — the finished frame. */
    const showAll = () => {
      for (const w of WORDS) {
        const rect = root.querySelector<SVGRectElement>(`[data-reveal="${w.key}"]`);
        if (!rect) continue;
        gsap.set(rect, { attr: { x: 0, y: 0, width: REF.w, height: REF.h } });
      }
      gsap.set(inks, { opacity: 1 });
    };

    // Fonts may still be loading on first paint; a bad measurement would place
    // the whole lockup wrong, so re-fit once they land.
    let disposed = false;
    const refit = () => {
      if (disposed) return;
      fitToBox();
    };
    fitToBox();
    if (document.fonts?.ready) document.fonts.ready.then(refit).catch(() => {});

    // ── SKIP PATH ────────────────────────────────────────────────────────────
    // Reduced motion still gets a gentle opacity fade rather than a hard pop —
    // it's non-vestibular, which is the accessible substitute for a write-on.
    if (seen || reduced) {
      removePrep();
      showAll();
      if (restEls.length) gsap.set(restEls, { clearProps: 'opacity,transform' });
      root.dataset.written = 'true';
      if (reduced && !seen) {
        gsap.fromTo(inks, { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: 0.08, ease: 'power2.out' });
        try {
          sessionStorage.setItem(STORAGE_KEY, '1');
        } catch {}
      }
      return () => {
        disposed = true;
      };
    }

    // Closed pre-paint (this is a layout effect) so client-side navigations,
    // where the inline prep script does not re-run, never flash the finished
    // headline.
    const closeAll = () => {
      for (const w of WORDS) {
        const rect = root.querySelector<SVGRectElement>(`[data-reveal="${w.key}"]`);
        if (!rect) continue;
        if (w.kind === 'techno') {
          // Wipe: a full-width band with zero height, parked on the edge the
          // reference wipes FROM — bottom for the upward wipe, top for the
          // downward one.
          gsap.set(rect, {
            attr: { x: 0, width: REF.w, height: 0, y: w.wipe === 'up' ? w.y1 : w.y0 },
          });
        } else {
          // Script: revealed per letter, so the shared rect stays open and the
          // letter masks below do the work.
          gsap.set(rect, { attr: { x: 0, y: 0, width: REF.w, height: REF.h } });
        }
      }
      // Script letters start unwritten.
      gsap.set(root.querySelectorAll('[data-letter]'), { attr: { width: 0 } });
      gsap.set(inks, { opacity: 1 });
    };
    closeAll();
    if (restEls.length) gsap.set(restEls, { opacity: 0, y: 24 });

    let cancelled = false;
    let intervalId: number | undefined;
    let tl: gsap.core.Timeline | undefined;

    // On a true first visit the intro overlay owns the screen; writing beneath
    // it would be wasted.
    const waitForIntroGone = () =>
      new Promise<void>((resolve) => {
        const isGone = () => {
          const el = document.getElementById('elenor-intro');
          return !el || getComputedStyle(el).display === 'none';
        };
        if (isGone()) return resolve();
        const started = Date.now();
        intervalId = window.setInterval(() => {
          if (cancelled || isGone() || Date.now() - started > 15000) {
            window.clearInterval(intervalId);
            resolve();
          }
        }, 150);
      });

    (async () => {
      await waitForIntroGone();
      if (cancelled) return;

      removePrep();
      fitToBox();
      try {
        sessionStorage.setItem(STORAGE_KEY, '1');
      } catch {}

      const timeline = gsap.timeline();
      tl = timeline;

      for (const w of WORDS) {
        if (w.kind === 'techno') {
          // ── Hard-edged directional wipe ──────────────────────────────────
          // Only the LEADING edge may travel; the trailing edge stays pinned to
          // the side the wipe started from, which is what makes the cut read as
          // a straight edge sweeping across fixed letters.
          //
          // For the upward wipe that means y and height must move TOGETHER
          // (y rises from y1 to y0 while height grows, bottom pinned at y1).
          // Animating height alone from a y already at y0 would pin the top and
          // sweep the bottom edge downward — the opposite direction, and
          // visually indistinguishable from QUALITY's wipe.
          const rect = root.querySelector<SVGRectElement>(`[data-reveal="${w.key}"]`);
          if (!rect) continue;
          const h = w.y1 - w.y0;
          const driver = { p: 0 };
          timeline.to(
            driver,
            {
              p: 1,
              duration: w.duration,
              ease: EASE.wipe,
              onUpdate: () => {
                const grown = h * driver.p;
                gsap.set(rect, {
                  attr: {
                    y: w.wipe === 'up' ? w.y1 - grown : w.y0,
                    height: grown,
                  },
                });
              },
            },
            w.start
          );
        } else {
          // ── Parallel per-letter stroke draw ──────────────────────────────
          // Each letter has its own mask rect widening left-to-right, and they
          // all run TOGETHER rather than in sequence — that is what the frames
          // show (every letter thickening at once), and it is what separates
          // this from a word-level sweep. Letters are staggered only slightly,
          // proportional to their position, so the word still resolves left to
          // right without any one letter finishing early.
          const letters = Array.from(
            root.querySelectorAll<SVGRectElement>(`[data-letter="${w.key}"]`)
          );
          if (!letters.length) continue;
          letters.forEach((rect) => {
            const full = Number(rect.dataset.w);
            timeline.to(
              rect,
              { attr: { width: full }, duration: w.duration * 0.55, ease: EASE.script },
              w.start + w.duration * 0.45 * (Number(rect.dataset.i) / letters.length)
            );
          });
        }
      }

      // Hands off to the CSS pulse on the cyan words (globals.css / hh-ink-pulse).
      timeline.call(
        () => {
          root.dataset.written = 'true';
        },
        undefined,
        SEQUENCE_END
      );

      if (restEls.length) {
        timeline.to(
          restEls,
          { opacity: 1, y: 0, duration: REST_FADE.duration, stagger: REST_FADE.stagger, ease: REST_FADE.ease },
          SEQUENCE_END
        );
      }
    })();

    return () => {
      disposed = true;
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      // Torn down mid-write (StrictMode's double-invoke, or navigating away):
      // clear the flag so the next mount replays instead of skipping to a
      // half-written headline.
      if (tl && tl.progress() < 1) {
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {}
      }
      tl?.kill();
      removePrep();
      void svg;
    };
  }, [line1, line2]);

  return (
    <>
      {/* The lockup is a fixed viewBox that scales to its container, so its
          rendered size is set purely by the box we give it — every measured
          coordinate inside scales along and the Meets/INNOVATION/QUALITY
          interlock is preserved exactly.

          Sits in the normal `container-x` flow (no full-bleed break-out) so the
          lockup shares the exact left edge of the eyebrow above and the
          sub-copy below. The viewBox itself starts flush with the ink on that
          edge (see VIEW.x), so no margin correction is needed here. */}
      <div ref={rootRef} className="w-full shrink-0 sm:mt-4 md:mt-0 md:w-3/5 lg:w-1/2">
        <h1 id="hero-headline" className="sr-only">{`${line1} ${line2}`}</h1>

        {/* Fixed reference viewBox: the measured 1276x660 composition scales
            proportionally, which is the only way the interlocking overlap
            between Meets / INNOVATION / QUALITY survives at every width. */}
        <svg
          viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
          // Left-aligned so the lockup starts on the same edge as the eyebrow
          // above and the sub-copy below.
          className="block w-full overflow-visible"
          // Width drives the size — it is the axis with real room, and the
          // full-bleed wrapper hands over the whole viewport less gutters.
          // Height follows from the viewBox ratio via `aspect-ratio`.
          //
          // The cap is viewport-RELATIVE rather than a fixed rem, because a
          // fixed cap cannot serve both ends: large enough for 1920 and it
          // overflows a 1280x720 laptop; small enough for 720 and it pins every
          // wide screen to a single size (which is the original complaint).
          // Tying it to viewport height keeps the lockup proportional to the
          // screen it is on — measured at ~55% of viewport height across
          // 1280/1440/1920, with width governing instead on tablet and mobile.
          //
          // Expressed as a max-WIDTH (51vh scaled by the viewBox ratio) so the
          // cap pulls both axes down together instead of letterboxing.
          //
          // Both terms live in HEADLINE_BOX, which the hero's sub-copy also
          // reads so the paragraph can be sized to the same span.
          style={{
            aspectRatio: `${VIEW.w} / ${VIEW.h}`,
            width: HEADLINE_BOX,
          }}
          aria-hidden
        >
          <defs>
            {WORDS.map((w) => (
              <mask key={w.key} id={`hh-mask-${w.key}`} maskUnits="userSpaceOnUse" x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h}>
                {/* Word-level reveal — the wipe band for Orbitron words, held
                    fully open for script words (their letters mask
                    individually). */}
                <rect data-reveal={w.key} x={0} y={0} width={REF.w} height={REF.h} fill="#fff" />
              </mask>
            ))}

            {/* Per-letter masks for the script write-on. Each letter is masked
                by its own widening rect; the boxes are set from the measured
                ink box and refined at runtime once the face has laid out. */}
            {WORDS.filter((w) => w.kind === 'script').map((w) => {
              const n = w.text.length;
              const cell = (w.x1 - w.x0) / n;
              return (
                <mask
                  key={`l-${w.key}`}
                  id={`hh-letters-${w.key}`}
                  maskUnits="userSpaceOnUse"
                  x={VIEW.x}
                  y={VIEW.y}
                  width={VIEW.w}
                  height={VIEW.h}
                >
                  {Array.from({ length: n }).map((_, i) => (
                    <rect
                      key={i}
                      data-letter={w.key}
                      data-i={i}
                      // Overlap each cell slightly so a connected script's
                      // joins are never sliced by a mask seam.
                      data-w={cell * 1.35}
                      x={w.x0 + cell * i}
                      y={0}
                      width={cell * 1.35}
                      height={REF.h}
                      fill="#fff"
                    />
                  ))}
                </mask>
              );
            })}
          </defs>

          {PAINT_ORDER.map((w) => (
            <g
              key={w.key}
              data-ink
              mask={`url(#hh-mask-${w.key})`}
              className={w.kind === 'techno' ? 'hh-cyan' : undefined}
            >
              <g mask={w.kind === 'script' ? `url(#hh-letters-${w.key})` : undefined}>
                {/* data-fit carries the runtime transform that snaps the laid
                    out text onto its measured ink box. */}
                <g data-fit={w.key}>
                  <text
                    data-text={w.key}
                    x={0}
                    y={TYPE[w.key].anchorY}
                    fontSize={TYPE[w.key].size}
                    fill={w.kind === 'techno' ? INK.techno : INK.script}
                    style={{
                      // Fonts are supplied by the host app through these
                      // variables (see the note in globals.css): Early Bird for
                      // the script words, Gilroy Light for the technical ones.
                      // The fallbacks only keep the lockup measurable before
                      // they load.
                      fontFamily:
                        w.kind === 'script'
                          ? 'var(--font-hero-script), var(--font-glory), cursive'
                          : 'var(--font-hero-techno), var(--font-display), sans-serif',
                      // 300 to match Gilroy Light's actual weight — asking for
                      // 700 from a Light-only face makes the browser synthesize
                      // a fake bold, thickening strokes the face never had.
                      fontWeight: w.kind === 'techno' ? 300 : 400,
                      whiteSpace: 'pre',
                    }}
                  >
                    {w.text}
                  </text>
                </g>
              </g>
            </g>
          ))}
        </svg>
      </div>

      <script dangerouslySetInnerHTML={{ __html: PREP_SCRIPT }} />
    </>
  );
}
