'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

import laptopSrc from '@/assets/Blogs/Insights icon-07.png';
import sheetSrc from '@/assets/Blogs/Insights icon-06.png';
import photoSrc from '@/assets/Blogs/Insights icon-03.png';
import videoSrc from '@/assets/Blogs/Insights icon-05.png';
import bubbleSrc from '@/assets/Blogs/Insights icon-02.png';
import bellSrc from '@/assets/Blogs/Insights icon-04.png';

// Blog hero, matched to the reference clip (1920x500, 4.07s).
//
// The article "prints" out of the laptop: the sheet is a vertical WIPE, not a
// slide. Measured frame by frame, the sheet's bottom edge is pinned at y=382
// for every frame — which is exactly the laptop screen's bottom lip (y=381) —
// while its top edge climbs 382 -> 52. Its width stays 253px throughout
// (sampled at the row midpoint each frame, so it is not a scale either).
// That is a clip-path opening upward, so the page appears to emerge from
// inside the screen rather than fly in over it.
//
// The media cards ride up with the sheet, then the two side icons pop on the
// ends of connector lines that draw OUTWARD from the sheet's edges: the left
// line grows from x=[1234,1239] to [1130,1239] anchored at the sheet, the
// right mirrors it from [1600,1609] to [1544,1609]. Each icon appears at the
// far end of its own line.
//
// Measured layer timing (background-subtracted area + bbox per frame):
//   sheet   start 0.16s  settle 1.07s   pure wipe, ease-out
//   video   start 0.29s  settle 1.11s   +8.7% area overshoot
//   photo   start 0.62s  settle 0.99s   +4.9% area overshoot
//   bubble  start 1.07s  settle 1.44s   +34.7% area  => ~1.16x linear
//   bell    start 1.36s  settle 1.73s   +28.2% area  => ~1.13x linear
// All motion ends at ~1.75s; frames 60-99 are pixel-identical, so the clip
// holds still for its last 2.3s. Nothing loops.
//
// The heading is real, server-rendered text that GSAP never touches, so
// crawlers and no-JS visitors always get the H1.

/** Reference canvas the geometry below was measured on. */
const REF_W = 1920;
const REF_H = 500;

/** Art x-origin in the reference — the stage crops to just the illustration. */
const ART_X = 1040;
const ART_W = 660;

/**
 * Final-frame boxes, in reference pixels, rebased onto the cropped stage.
 * Percentages keep the whole scene fluid at any width.
 */
const box = (x: number, y: number, w: number, h: number) => ({
  left: `${((x - ART_X) / ART_W) * 100}%`,
  top: `${(y / REF_H) * 100}%`,
  width: `${(w / ART_W) * 100}%`,
  height: `${(h / REF_H) * 100}%`,
});

// Each source PNG carries a lot of transparent padding (the bell is ~19-25%
// on a side), so a box sized to the artwork would shrink the art by that
// padding once the image fills it. These boxes are the FULL padded canvas,
// back-computed from each file's opaque bounds so the artwork itself lands
// exactly on the position measured from the clip (noted on each line).
const LAPTOP = box(1001.3, 70.5, 709.9, 429.3); // art 620x345 @ 1050,107
const SHEET = box(1207.1, 25.1, 336.7, 385.8); //  art 282x329 @ 1234,52
const PHOTO = box(1213.6, 41.8, 182.8, 201.3); //  art 153x130 @ 1232,80
const VIDEO = box(1368.5, 178.1, 249.1, 209.1); // art 152x145 @ 1408,200
const BUBBLE = box(1057.1, 42.9, 149.1, 162.3); // art 105x96  @ 1077,76
const BELL = box(1522.5, 39.9, 167.5, 194.9); //   art 115x116 @ 1554,89

// Connector rails: two thin horizontal lines per side, at the y values they
// hold in the reference (y=118 and y=168). The left pair spans the gap from
// the bubble to the sheet, the right pair from the sheet to the bell.
const LINE_L = box(1130, 117, 110, 52);
const LINE_R = box(1544, 117, 66, 52);

export function BlogAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const lineLRef = useRef<HTMLDivElement>(null);
  const lineRRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const targets = [
      sheetRef.current,
      photoRef.current,
      videoRef.current,
      bubbleRef.current,
      bellRef.current,
      lineLRef.current,
      lineRRef.current,
    ].filter((el): el is HTMLDivElement => el !== null);
    if (targets.length === 0) return;

    // Reduced motion: render the settled scene and skip every timeline. The
    // markup starts hidden (so the entrance never flashes), so the rest state
    // has to be written explicitly here.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(targets, { opacity: 1, scale: 1, y: 0, clipPath: 'inset(0% 0% 0% 0%)' });
      return;
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      // ── Sheet: the wipe ────────────────────────────────────────────────
      // inset() from the top: 100% hides it entirely, 0% reveals the whole
      // sheet. The bottom stays at 0 so the lower edge never moves, which is
      // what pins it to the screen lip. Height progression in the reference
      // (0 -> 9 -> 57 -> 132 -> 214 -> 298 -> 329 over 0.9s) puts ~62% of the
      // travel in the first half, i.e. a power2 ease-out.
      tl.fromTo(
        sheetRef.current,
        { clipPath: 'inset(100% 0% 0% 0%)', opacity: 1 },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'power2.out' },
        0.16,
      );

      // ── Media cards: ride up out of the screen with the sheet ──────────
      // Both are clipped by the sheet's own wipe in the reference (they never
      // appear below the screen lip), so they travel up into place with a
      // small overshoot of their own.
      tl.fromTo(
        videoRef.current,
        { opacity: 0, y: 60, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.82, ease: 'back.out(1.4)' },
        0.29,
      );
      tl.fromTo(
        photoRef.current,
        { opacity: 0, y: 48, scale: 0.92 },
        { opacity: 1, y: 0, scale: 1, duration: 0.62, ease: 'back.out(1.2)' },
        0.62,
      );

      // ── Connector lines: draw outward from the sheet ───────────────────
      // scaleX from the edge that touches the sheet, so each line grows away
      // from the page rather than sliding in as a whole.
      tl.fromTo(
        lineLRef.current,
        { opacity: 1, scaleX: 0 },
        { scaleX: 1, duration: 0.2, ease: 'power2.out' },
        0.99,
      );
      tl.fromTo(
        lineRRef.current,
        { opacity: 1, scaleX: 0 },
        { scaleX: 1, duration: 0.2, ease: 'power2.out' },
        1.3,
      );

      // ── Side icons: spring pops at the far end of each line ────────────
      // The reference overshoots hard and settles back: bubble peaks 34.7%
      // over its final area (~1.16x linear), bell 28.2% (~1.13x). back.out
      // with these overshoot values reproduces that peak-then-relax.
      tl.fromTo(
        bubbleRef.current,
        { opacity: 0, scale: 0 },
        { opacity: 1, scale: 1, duration: 0.37, ease: 'back.out(2.6)' },
        1.07,
      );
      tl.fromTo(
        bellRef.current,
        { opacity: 0, scale: 0 },
        { opacity: 1, scale: 1, duration: 0.37, ease: 'back.out(2.2)' },
        1.36,
      );
    }, container);

    return () => {
      ctx.revert();
    };
  }, []);

  return (
    <section ref={containerRef} className="relative overflow-hidden pb-4 pt-8">
      {/* Background glow — matches the PageShell hero treatment.
          It must stay fully inside the section: at a negative top offset the
          parent's overflow-hidden slices the 120px blur off flat against the
          section's top edge, and that straight cut reads as a hard seam
          between the dark header and the cyan wash. Starting at top-0 keeps
          the falloff continuous, so the two surfaces blend as one. */}
      <div
        className="pointer-events-none absolute right-0 top-0 h-[30rem] w-[30rem] rounded-full opacity-20 blur-[120px]"
        style={{ background: 'radial-gradient(circle, #68cad6 0%, transparent 70%)' }}
        aria-hidden
      />

      <div className="container-x relative">
        <div className="flex flex-col gap-12 md:flex-row md:items-center md:justify-between">
          {/* ── TitleText — static, server-rendered, never animated ── */}
          <div className="relative z-10 -translate-y-[25%] max-md:translate-y-0">
            <h1 className="text-balance font-display text-4xl font-bold leading-[1.02] tracking-tight text-white md:text-6xl">
              Insights. Not filler.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/70">
              Practical marketing, branding, and digital strategy from the Elenor team —
              social media, SEO, AEO, branding, and the trends actually shaping how Egyptian
              brands grow.
            </p>
          </div>

          {/* ── Animated scene ──
              A fixed-aspect stage so every sprite keeps its measured position
              relative to the laptop at any width. */}
          <div
            className="relative w-full shrink-0 md:w-[34rem]"
            style={{ aspectRatio: `${ART_W} / ${REF_H}` }}
            aria-hidden
          >
            {/* Laptop — static plate. Present from frame 0, never animates. */}
            <div className="absolute" style={LAPTOP}>
              <Image
                src={laptopSrc}
                alt=""
                className="h-full w-full select-none object-fill"
                priority
              />
            </div>

            {/* Connector lines. Each is anchored at the edge nearest the sheet
                so scaleX grows it outward toward its icon. */}
            <div
              ref={lineLRef}
              className="absolute opacity-0 will-change-transform"
              style={{ ...LINE_L, transformOrigin: 'right center' }}
            >
              <span className="absolute inset-x-0 top-0 block h-px bg-[#68cad6]/60" />
              <span className="absolute inset-x-0 bottom-0 block h-px bg-[#68cad6]/60" />
            </div>
            <div
              ref={lineRRef}
              className="absolute opacity-0 will-change-transform"
              style={{ ...LINE_R, transformOrigin: 'left center' }}
            >
              <span className="absolute inset-x-0 top-0 block h-px bg-[#68cad6]/60" />
              <span className="absolute inset-x-0 bottom-0 block h-px bg-[#68cad6]/60" />
            </div>

            {/* Article sheet — the wipe. Sits above the laptop, below the
                media cards that overlap it. */}
            <div
              ref={sheetRef}
              className="absolute z-10 opacity-0 will-change-[clip-path]"
              style={SHEET}
            >
              <Image
                src={sheetSrc}
                alt=""
                className="h-full w-full select-none object-fill"
                priority
              />
            </div>

            {/* Media cards — overlap the sheet's left and right edges. */}
            <div
              ref={photoRef}
              className="absolute z-20 opacity-0 will-change-transform"
              style={{ ...PHOTO, transformOrigin: 'center center' }}
            >
              <Image
                src={photoSrc}
                alt=""
                className="h-full w-full select-none object-fill"
                priority
              />
            </div>
            <div
              ref={videoRef}
              className="absolute z-20 opacity-0 will-change-transform"
              style={{ ...VIDEO, transformOrigin: 'center center' }}
            >
              <Image
                src={videoSrc}
                alt=""
                className="h-full w-full select-none object-fill"
                priority
              />
            </div>

            {/* Side icons — pop on the far ends of the connector lines. */}
            <div
              ref={bubbleRef}
              className="absolute z-30 opacity-0 will-change-transform"
              style={{ ...BUBBLE, transformOrigin: 'center center' }}
            >
              <Image
                src={bubbleSrc}
                alt=""
                className="h-full w-full select-none object-fill"
                priority
              />
            </div>
            <div
              ref={bellRef}
              className="absolute z-30 opacity-0 will-change-transform"
              style={{ ...BELL, transformOrigin: 'center center' }}
            >
              <Image
                src={bellSrc}
                alt=""
                className="h-full w-full select-none object-fill"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
