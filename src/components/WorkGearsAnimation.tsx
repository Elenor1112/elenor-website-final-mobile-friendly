'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { pauseContextOffscreen } from '@/lib/pauseContextOffscreen';

import { WORK_GEARS, WORK_GEAR_LABELS, HUB_RATIO, type WorkGearKey } from '@/lib/workGears';

// Work hero, rebuilt from the reference clip (1920x500 landscape strip, 31.21s).
//
// Measured from 210 frames pulled off the decoder. Two things had to be worked
// around to get real frames at all, and both silently produce *plausible but
// wrong* data if missed:
//
//   1. Python's SimpleHTTPRequestHandler ignores Range requests, so the browser
//      could not seek: currentTime stayed pinned at 0 for every assignment and
//      all 60 "frames" came back byte-identical (max pixel diff 0). Serving the
//      file with a 206-capable handler fixed it.
//   2. Frames must be read via canvas drawImage, not element screenshots.
//
// GEOMETRY — five cog badges, cluster measured after it settles:
//   cluster bbox  x 1078..1631, y 30..464  =>  553 x 434  (aspect 1.274)
//   Each gear's hub is a clean white disc, so centres/radii come from the hub
//   rather than the toothed outline. Outer radius is 1.84x the hub radius
//   (measured 1.822 / 1.859 / 1.825 / 1.858 on the four satellites while each
//   was still isolated during the fly-in). Rebuilding the bbox from those radii
//   predicts x 1076..1632, y 29..465 — within 2px of measured, so the model is
//   confirmed rather than assumed.
//
//     gear          centre(px)        hub r    outer r    % of cluster width
//     elenor "e."   1365.5, 178.6     64.1     117.9      21.3
//     Coca-Cola     1180.8, 289.8     56.7     104.3      18.9
//     Duravit       1424.8, 371.1     51.1      94.0      17.0
//     Saint-Gobain  1552.0, 219.8     43.6      80.2       14.5
//     GSK           1217.7,  88.9     32.3      59.4       10.7
//
// ROTATION — every gear has exactly 12 teeth (dominant FFT harmonic of the
// teal coverage sampled on a ring at 1.62x the hub radius; same answer for all
// five). Unwrapping that harmonic's phase across 70 densely-sampled frames and
// least-squares fitting gives:
//
//     elenor       -35.064 deg/s     residual RMS 0.385 deg
//     Coca-Cola    +35.072 deg/s     residual RMS 0.380 deg
//     Duravit      +35.062 deg/s     residual RMS 0.377 deg
//     Saint-Gobain +35.072 deg/s     residual RMS 0.370 deg
//     GSK          +35.065 deg/s     residual RMS 0.383 deg
//
// So: one speed, 35.07 deg/s = 10.27s per revolution, centre gear one way and
// all four satellites the other. The residuals are the headline number — 0.38
// deg of scatter over 2.5s says the motion is EXACTLY linear, with no easing,
// no wobble, and no speed ramp anywhere in the loop.
//
// The speed ratio is +-1.000 despite radii spanning 59..118px, which is NOT
// what real meshed gears do (a true gear train scales angular speed by the
// inverse radius ratio, so the small GSK cog would spin ~2x the "e"). The
// source was authored as one flat counter-rotation, and the four satellites
// share a single tooth phase (4.83/4.84/4.83/4.90 deg at t=3.0s) confirming
// they are one rigid group. Reproducing the "physical" version instead would
// visibly disagree with the clip, so this matches the clip.
//
// WHAT ACTUALLY SPINS — the rings, not the logos. Every client mark stays
// upright through the whole loop: the principal axis of the dark logo ink
// inside each hub holds constant (Coca-Cola 178.95 -> 178.86 deg, Duravit
// 179.09 flat, Saint-Gobain 175.59 -> 175.55, the "e" 143.32 -> 143.34) across
// 2.5s in which the teeth advance 87 deg. Since the artwork bakes ring and logo
// into a single bitmap, each gear renders twice with complementary radial
// masks — see the clip construction in the JSX below.
//
// INTRO — the "e" is present from frame 0 and never moves. Each satellite
// slides in from its own direction and decelerates into place; radius is
// constant throughout, so it is a translate, not a scale-up:
//
//     gear          enters at   settles   duration   travel(px)   distance
//     Coca-Cola       0.353s     0.969s    0.616s    +53, -102     115.3
//     GSK             0.793s     1.498s    0.705s    +66,  +63      90.5
//     Duravit         0.661s     1.322s    0.661s     +0,  -92      91.9
//     Saint-Gobain    0.925s     1.234s    0.309s    -84,  +83     117.9
//
// Fitting normalised progress against 1-(1-u)^k over the sampled points picks
// k=2.5 for Coca-Cola (rms 0.035) and Duravit (0.028), k=3 for GSK (0.046),
// k=2 for Saint-Gobain (0.092 — that one only had 7 samples in its short
// 0.309s window, so it is the weakest fit of the four). power2.5 is the
// consensus, which is what the entrance uses.
//
// After 1.5s nothing translates again: the cluster bbox is pixel-identical for
// the remaining 29.7s. The clip is an intro followed by an endless spin.

/** Seconds for one full 360 turn. Measured 35.065 deg/s => 360/35.065. */
const SPIN_S = 10.267;

/**
 * The fitted entrance ease, 1-(1-u)^2.5.
 *
 * GSAP has no `power2.5` — the power eases are integer-indexed, and asking for
 * one that does not exist silently falls back to the default rather than
 * erroring, which would have quietly shipped the wrong curve. 2.5 sits between
 * power2 (rms 0.043/0.049 on the two best-sampled gears) and power3
 * (0.070/0.061), and is the best fit for both, so it is worth expressing
 * exactly instead of rounding to whichever integer is nearest.
 */
const EASE_OUT_2_5 = (u: number) => 1 - Math.pow(1 - u, 2.5);

/**
 * Cluster aspect, measured 553x434. The stage is sized by WIDTH and takes its
 * height from this, so every gear's percentage position stays correct at any
 * viewport width — the same reason ServicesAnimation makes its carrier an
 * explicit square rather than stretching to its parent.
 */
const STAGE_ASPECT = 553 / 434;

/**
 * Room reserved around the stage as a share of its width, so the drop shadows
 * and the fly-in start positions are not clipped by the section's
 * overflow-hidden. The furthest any gear travels outside its settled bbox is
 * Saint-Gobain's entry at +84px on a 553px cluster (15%); this rounds up.
 */
const STAGE_MARGIN = 17;

type Slot = {
  key: WorkGearKey;
  /** Hub centre, % of cluster bbox. */
  cx: number;
  cy: number;
  /** Outer radius (1.84x hub), % of cluster WIDTH — the axis the stage is sized by. */
  r: number;
  /** Fly-in offset from the settled position, % of cluster width/height. */
  fromX: number;
  fromY: number;
  /** Entrance start, seconds. */
  at: number;
  /** Entrance travel time, seconds. */
  dur: number;
  /** +1 clockwise, -1 counter-clockwise. */
  dir: 1 | -1;
};

// Order is paint order: the "e" is the hub of the cluster and the clip draws it
// on top of every satellite, so it comes last. It is also the order
// WORK_GEAR_LABELS is written in — see the length assertion below.
const SLOTS = [
  {
    key: 'coca-cola',
    cx: 18.59,
    cy: 59.86,
    r: 18.86,
    fromX: -9.6,
    fromY: 23.57,
    at: 0.353,
    dur: 0.616,
    dir: 1,
  },
  {
    key: 'duravit',
    cx: 62.71,
    cy: 78.59,
    r: 17.0,
    fromX: -0.07,
    fromY: 21.18,
    at: 0.661,
    dur: 0.661,
    dir: 1,
  },
  {
    key: 'saint-gobain',
    cx: 85.71,
    cy: 43.73,
    r: 14.5,
    fromX: 15.21,
    fromY: -19.03,
    at: 0.925,
    dur: 0.309,
    dir: 1,
  },
  {
    // The clip shows GSK here; the supplied artwork set has mednet in this slot
    // and no GSK cog badge. See the note in workGears.ts.
    key: 'mednet',
    cx: 25.26,
    cy: 13.57,
    r: 10.74,
    fromX: -11.84,
    fromY: -14.4,
    at: 0.793,
    dur: 0.705,
    dir: 1,
  },
  {
    key: 'elenor',
    cx: 51.99,
    cy: 34.24,
    r: 21.32,
    // Present from frame 0 and never translates — no entrance to run.
    fromX: 0,
    fromY: 0,
    at: 0,
    dur: 0,
    dir: -1,
  },
] as const satisfies readonly Slot[];

// WORK_GEAR_LABELS is the server-readable copy of these names (see workGears.ts
// for why it cannot be exported from this client module). It is indexed by slot,
// so a length mismatch would silently mislabel a gear — this fails typecheck
// instead. Both are `as const`, so these are literal lengths, not `number`.
//
// The assertion has to be a VALUE, not a bare `type` alias: an unused alias that
// resolves to an error tuple is still a well-formed type, so tsc accepts it and
// the guard never fires. Assigning to a typed const is what makes a mismatch an
// actual compile error.
const _labelsMatchSlots: typeof WORK_GEAR_LABELS.length = SLOTS.length;
void _labelsMatchSlots;

/**
 * Box for one gear, as percentages of the stage.
 *
 * The box is the gear's full outer circle (teeth included), and it is square:
 * all five alpha bboxes measured aspect 1.000 +/- 0.002. Because the stage is
 * not square (553x434), a percentage height does not equal the same percentage
 * width — so the height is scaled by STAGE_ASPECT to keep the box square, which
 * is what stops the gears rendering as ellipses.
 */
function slotBox(slot: Slot) {
  const w = slot.r * 2;
  const h = w * STAGE_ASPECT;
  return {
    left: `${slot.cx - w / 2}%`,
    top: `${slot.cy - h / 2}%`,
    width: `${w}%`,
    height: `${h}%`,
  };
}

export function WorkGearsAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gearRefs = useRef<(HTMLDivElement | null)[]>([]);
  const spinRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const gears = gearRefs.current.filter((el): el is HTMLDivElement => el !== null);
    const spins = spinRefs.current.filter((el): el is HTMLDivElement => el !== null);
    if (gears.length !== SLOTS.length || spins.length !== SLOTS.length) return;

    // Reduced motion: the settled cluster, no entrance and no spin. The markup
    // ships at opacity 0 so the entrance never flashes before GSAP takes over,
    // which means the resting state has to be written out explicitly here.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(gears, { opacity: 1, x: 0, y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      // ── Spin ───────────────────────────────────────────────────────────
      // Driven off a single proxy angle rather than five `rotate: 360` tweens
      // with `repeat: -1`, for the reason documented in ServicesAnimation: a
      // repeating tween is a 0->360 ramp torn down and re-seeded at every lap,
      // and that boundary is visible as a hitch. One un-repeating tween runs
      // the angle out over a span no session will reach, and the applied value
      // is wrapped into 0..360 so the number handed to the transform stays
      // small enough to keep float precision.
      //
      // All five read from this one source, so the centre gear and its
      // satellites can never drift out of phase with each other.
      const spin = { angle: 0 };
      const SPIN_LAPS = 1e7;
      gsap.to(spin, {
        angle: 360 * SPIN_LAPS,
        duration: SPIN_S * SPIN_LAPS,
        ease: 'none',
        onUpdate: () => {
          const a = gsap.utils.wrap(0, 360, spin.angle);
          for (let i = 0; i < spins.length; i++) {
            gsap.set(spins[i], { rotate: a * SLOTS[i].dir });
          }
        },
      });

      // ── Entrance ───────────────────────────────────────────────────────
      // Each satellite slides in from its measured direction on its own
      // measured schedule. This is a one-shot timeline, not a loop: the clip
      // plays the fly-in once and then spins forever.
      //
      // The "e" has dur 0, so its tween is a plain fade with no translate —
      // matching frame 0, where it is already in place at full size.
      const tl = gsap.timeline();
      SLOTS.forEach((slot, i) => {
        const el = gears[i];
        if (slot.dur === 0) {
          tl.set(el, { opacity: 1, x: 0, y: 0 }, 0);
          return;
        }
        // fromX/fromY are shares of the CLUSTER, but xPercent is a share of the
        // ELEMENT, so each is rescaled by the gear's own box size. Doing this
        // in percentages rather than pixels is what keeps the entrance correct
        // at every viewport width without measuring the stage at runtime.
        const boxW = slot.r * 2; // % of cluster width
        const boxH = boxW * STAGE_ASPECT; // % of cluster height (box is square)
        tl.fromTo(
          el,
          {
            opacity: 0,
            xPercent: (slot.fromX / boxW) * 100,
            yPercent: (slot.fromY / boxH) * 100,
          },
          {
            opacity: 1,
            xPercent: 0,
            yPercent: 0,
            duration: slot.dur,
            // Fitted exponent across the four satellites: 2.5, 2.5, 3, 2.
            ease: EASE_OUT_2_5,
          },
          slot.at,
        );
      });
    }, container);

    // The ring/gear spins run on repeat:-1 and would otherwise keep
    // writing transforms while the section is scrolled past.
    const unobserve = pauseContextOffscreen(container, ctx);

    return () => {
      unobserve();
      ctx.revert();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ aspectRatio: `${STAGE_ASPECT} / ${1 + (STAGE_MARGIN * 2) / 100 / STAGE_ASPECT}` }}
      aria-hidden
    >
      {/* The gears sit in an inner box the size of the measured cluster; the
          outer box is taller/wider to reserve the fly-in and shadow overhang.
          An aspect-ratio is defined by this element's own width, so the
          reserved space scales with the cluster at every breakpoint —
          percentage padding would resolve against the PARENT and stop tracking
          as soon as a max-width ceiling took over. */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: `${100 / (1 + (STAGE_MARGIN * 2) / 100)}%`, aspectRatio: `${STAGE_ASPECT}` }}
      >
        {SLOTS.map((slot, i) => {
          const gear = WORK_GEARS[slot.key];

          // The artwork bakes ring and logo into one bitmap, but only the ring
          // turns (see HUB_RATIO). So the same image is drawn twice at the same
          // size and position, and each copy is clipped to its own annulus:
          // the spinning copy keeps everything OUTSIDE the hub, the static copy
          // keeps everything INSIDE it. Together they reassemble the original
          // pixel-for-pixel, with a rotation applied to only one of them.
          //
          // The seam sits on the black hub outline, which is rotationally
          // symmetric, so the two layers stay flush as the ring turns.
          //
          // The two masks OVERLAP by SEAM rather than meeting at one radius. A
          // hard shared edge leaves a visible dashed ring: each mask antialiases
          // its own boundary to ~50% alpha, and two 50% edges over the same
          // pixels composite to less than the opaque original, so the seam reads
          // as a lighter circle cut through the black hub outline. Letting the
          // hub run slightly past the cut and fading the ring in over the same
          // band means every pixel is covered at full strength by at least one
          // layer. The band sits inside the flat black outline, so the overlap
          // is invisible even though the layers underneath disagree by a
          // rotation.
          const SEAM = 1.5; // percentage points of the gear's own box
          const inner = HUB_RATIO * 100;
          const ringClip = `radial-gradient(circle at 50% 50%, transparent 0 ${inner - SEAM}%, #000 ${inner + SEAM}%)`;
          const hubClip = `radial-gradient(circle at 50% 50%, #000 0 ${inner + SEAM}%, transparent ${inner + SEAM}%)`;

          // Shared by both copies: cancel this file's transparent padding so the
          // GEAR lands at the measured radius, then correct the measured ink
          // offset. The offset matters because the ring SPINS — Saint-Gobain's
          // ink sits 4.4% right of its canvas centre and Duravit's 3.3% left, so
          // uncorrected those two would trace a small circle instead of turning
          // in place. Both layers take the identical transform so they stay
          // registered to each other.
          const artStyle = {
            width: `${100 / gear.fillX}%`,
            height: `${100 / gear.fillY}%`,
            transform: `translate(-50%, -50%) translate(${(-gear.offsetX / gear.fillX) * 100}%, ${(-gear.offsetY / gear.fillY) * 100}%)`,
          };

          return (
            <div
              key={slot.key}
              ref={(el) => {
                gearRefs.current[i] = el;
              }}
              className="absolute opacity-0 will-change-transform"
              style={slotBox(slot)}
            >
              {/* Rotation lives on its own wrapper because the outer element is
                  already carrying the entrance translate — GSAP would overwrite
                  one transform with the other if both targeted the same node. */}
              <div
                ref={(el) => {
                  spinRefs.current[i] = el;
                }}
                className="absolute inset-0 will-change-transform"
                style={{ WebkitMaskImage: ringClip, maskImage: ringClip }}
              >
                {/* Decorative: the whole stage is aria-hidden and WorkHero
                    states the client names in prose beside it, so repeating
                    them here would only make a screen reader read the list
                    twice. */}
                <Image
                  src={gear.src}
                  alt=""
                  className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                  style={artStyle}
                  sizes="(max-width: 768px) 60vw, 40vw"
                  priority={i === SLOTS.length - 1}
                />
              </div>

              {/* Static hub + logo. No ref and no transform — this is the layer
                  the measurements say never moves. It is painted AFTER the ring
                  so that within the SEAM overlap the hub wins: the hub side of
                  the boundary is flat black outline, so covering the ring's
                  faded edge there hides the join, whereas the reverse order
                  would let the ring's partial alpha sit on top of it. */}
              <div
                className="absolute inset-0"
                style={{ WebkitMaskImage: hubClip, maskImage: hubClip }}
              >
                <Image
                  src={gear.src}
                  alt=""
                  className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                  style={artStyle}
                  sizes="(max-width: 768px) 60vw, 40vw"
                  priority={i === SLOTS.length - 1}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
