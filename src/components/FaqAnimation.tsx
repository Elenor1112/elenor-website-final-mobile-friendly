'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { pauseContextOffscreen } from '@/lib/pauseContextOffscreen';

import questionMarkSrc from '@/assets/FAQ/Asked icon-066.png';
import dotCyanSrc from '@/assets/FAQ/Asked icon-05.png';
import dotWhiteSrc from '@/assets/FAQ/Asked icon-02.png';

// FAQ hero, matched to the reference clip.
//
// The motion is a horizontal CONVEYOR, not a vertical wave: the dots sit on a
// flat baseline and step sideways one slot at a time, pausing between steps.
// A single white dot stays pinned at the centre slot while the cyan dots slide
// past it — where a cyan dot half-covers the white one you get the crescent
// that reads as a "highlight handing off" between neighbours.
//
// Measured from the reference (1920x500): baseline y is constant to within a
// pixel across the whole clip, dot pitch ~30px, sprite widths ~11/20/26/17/9
// (small -> large -> small, centred), one step + hold ~= 1.5s with the step
// itself taking ~0.55s.
//
// The heading is real, server-rendered text that GSAP never touches, so
// crawlers and no-JS visitors always get the H1.

/** Slot pitch as a fraction of the wave's width. */
const SLOT_PITCH = 1 / 6;

/** Number of cyan dots on the conveyor, including the off-stage ones. */
const CYAN_COUNT = 9;

/** Slot index the row is centred on — where the white dot is pinned. */
const CENTRE_SLOT = 4;

/**
 * Sprite scale as a function of distance (in slots) from the row's centre.
 * This is keyed off a dot's CURRENT position rather than its index, so the
 * small -> large -> small hump stays anchored to the centre while dots travel
 * through it — matching the reference, where the row's silhouette never
 * changes even though the dots inside it keep moving.
 */
function scaleForOffset(slotsFromCentre: number): number {
  const d = Math.abs(slotsFromCentre);
  if (d >= 3) return 0;
  // Cosine falloff: 1 at the centre, 0 at three slots out.
  return Math.cos((d / 3) * (Math.PI / 2)) ** 1.1;
}

/** Seconds for one step of the conveyor, including the hold that follows. */
const STEP_PERIOD = 1.5;
/** Seconds the sideways travel itself takes; the remainder is the hold. */
const STEP_TRAVEL = 0.55;

/** Entrance stagger between dots (s). Dots enter right-to-left. */
const ENTRANCE_STAGGER = 0.12;

/** Largest dot diameter, in px, at each breakpoint. */
const DOT_MAX_PX = 34;

export function FaqAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const whiteRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const rail = railRef.current;
    const question = questionRef.current;
    if (!container || !rail) return;

    const white = whiteRef.current;
    const dots = dotRefs.current.filter((d): d is HTMLDivElement => d !== null);
    const targets = [rail, ...dots, ...(white ? [white] : []), ...(question ? [question] : [])];
    if (dots.length === 0) return;

    // Reduced motion: the markup already renders the row at rest, so there is
    // nothing to undo — just skip every timeline.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // One slot of travel in px. Re-read on resize so the step still lands
    // exactly on the next slot at any width.
    let stepPx = 0;
    const readStep = () => {
      stepPx = rail.getBoundingClientRect().width * SLOT_PITCH;
    };
    readStep();

    const ctx = gsap.context(() => {
      // ── Scene 2: the conveyor ───────────────────────────────────────────
      // Each cycle slides the whole rail left by exactly one slot, then snaps
      // back to 0 with the dot sizes rotated one place along. Because every
      // dot has taken its neighbour's size, the snap is invisible and the row
      // appears to walk continuously in one direction.
      const buildScene2 = () => {
        const tl = gsap.timeline({ repeat: -1, paused: true });

        // quickSetters write style directly. A gsap.set() per frame would mint
        // tweens that gsap.context() cannot collect (it only records what
        // exists while the context function runs), and those escapees survive
        // ctx.revert() — under StrictMode that leaves stale transforms frozen.
        const setDot = dots.map((d) => gsap.quickSetter(d, 'css') as (v: object) => void);

        // `travel` is how far the row has walked, in slots. Each cyan dot's
        // own position is its index minus that, wrapped back around so the
        // strip is endless; its scale then comes from where it has landed.
        const place = (travel: number) => {
          for (let i = 0; i < dots.length; i += 1) {
            let pos = i - travel;
            // Wrap into [-CENTRE_SLOT, CYAN_COUNT - CENTRE_SLOT) so a dot that
            // walks off the left edge reappears off the right.
            pos = ((pos + CENTRE_SLOT) % CYAN_COUNT + CYAN_COUNT) % CYAN_COUNT - CENTRE_SLOT;
            const scale = scaleForOffset(pos);
            setDot[i]({
              x: pos * stepPx,
              scale,
              opacity: scale > 0.02 ? 1 : 0,
            });
          }
        };
        place(0);

        // One step of travel, then a hold — the reference moves in discrete
        // hops rather than gliding continuously. `base` accumulates completed
        // steps so the wrap in place() keeps the strip endless without the
        // tween value ever growing unbounded.
        let base = 0;
        const state = { travel: 0 };
        tl.to(state, {
          travel: 1,
          duration: STEP_TRAVEL,
          ease: 'power2.inOut',
          onUpdate: () => place(base + state.travel),
          onComplete: () => {
            base = (base + 1) % CYAN_COUNT;
            state.travel = 0;
            place(base);
          },
        });
        tl.to({}, { duration: STEP_PERIOD - STEP_TRAVEL });

        return tl;
      };

      // ── Scene 1: entrance ───────────────────────────────────────────────
      // Dots pop in right-to-left, then the question mark drops in from above.
      const buildScene1 = () => {
        const tl = gsap.timeline();

        dots.forEach((dot, i) => {
          const pos = i - CENTRE_SLOT;
          const size = scaleForOffset(pos);
          if (size <= 0.02) return;
          // Right-to-left stagger: the rightmost dot pops first.
          const delay = (dots.length - 1 - i) * ENTRANCE_STAGGER;
          tl.fromTo(
            dot,
            { x: pos * stepPx, scale: 0, opacity: 0 },
            { x: pos * stepPx, scale: size, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' },
            delay,
          );
        });

        if (white) {
          tl.fromTo(
            white,
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' },
            CENTRE_SLOT * ENTRANCE_STAGGER,
          );
        }

        if (question) {
          tl.fromTo(
            question,
            { scale: 0, opacity: 0, y: -30 },
            { scale: 1, opacity: 1, y: 0, duration: 0.7, ease: 'back.out(1.5)' },
            0.8,
          );
        }

        return tl;
      };

      // Scene 2 is built eagerly (paused) rather than inside onComplete so
      // gsap.context() records it while still collecting — a timeline created
      // later from a callback escapes the context and survives ctx.revert().
      // It is also kept OUT of the master: an infinite child would stop the
      // master ever completing, and overlapping them would have both writing
      // transforms to the same nodes.
      const idle = buildScene2();
      const master = gsap.timeline({ onComplete: () => idle.play() });
      master.add(buildScene1());
    }, container);

    window.addEventListener('resize', readStep);
    // The dot conveyor runs on repeat:-1; stop it while the section is off
    // screen rather than writing nine transforms a frame into an empty view.
    const unobserve = pauseContextOffscreen(container, ctx);

    return () => {
      unobserve();
      window.removeEventListener('resize', readStep);
      ctx.revert();
      // quickSetter writes bypass the context's style bookkeeping, so clear
      // them explicitly or a StrictMode remount inherits the last frame.
      gsap.set(targets, { clearProps: 'transform,opacity' });
    };
  }, []);

  return (
    <section ref={containerRef} className="relative overflow-hidden pb-4 pt-8">
      {/* Background glow — matches the PageShell hero treatment. */}
      <div
        className="pointer-events-none absolute -top-40 right-0 h-[30rem] w-[30rem] rounded-full opacity-30 blur-[120px]"
        style={{ background: 'radial-gradient(circle, #68cad6 0%, transparent 70%)' }}
        aria-hidden
      />

      <div className="container-x relative">
        <div className="flex flex-col gap-12 md:flex-row md:items-center md:justify-between">
          {/* ── TitleText — static, server-rendered, never animated ── */}
          <div className="relative z-10">
            <p className="eyebrow">FAQ</p>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.02] tracking-tight md:text-6xl">
              <span className="block text-white">Frequently</span>
              <span className="block text-[#68cad6]">Asked</span>
              <span className="block text-white">Questions</span>
            </h1>
          </div>

          {/* ── Animated sprites ── */}
          <div className="relative h-44 w-full shrink-0 md:h-56 md:w-[26rem]" aria-hidden>
            {/* The row is centred on the rail. Every dot starts stacked at the
                centre and is placed by GSAP via `x`, so a single transform per
                dot drives both its travel and its size. */}
            <div
              ref={railRef}
              className="absolute inset-x-0 top-[64%]"
              style={{ height: DOT_MAX_PX }}
            >
              {/* Cyan dots — these are the ones that travel. */}
              {Array.from({ length: CYAN_COUNT }, (_, i) => (
                <span
                  key={i}
                  className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2"
                  style={{ width: DOT_MAX_PX, height: DOT_MAX_PX, zIndex: 1 }}
                >
                  <div
                    ref={(el) => {
                      dotRefs.current[i] = el;
                    }}
                    className="h-full w-full will-change-transform"
                    style={{ transformOrigin: 'center center' }}
                  >
                    {/* unoptimized: ~34px flat-colour sprites, so the
                        optimizer round trip costs more than it saves. */}
                    <Image
                      src={dotCyanSrc}
                      alt=""
                      width={DOT_MAX_PX}
                      height={DOT_MAX_PX}
                      className="h-full w-full select-none object-contain"
                      unoptimized
                      priority
                    />
                  </div>
                </span>
              ))}

              {/* The white dot is pinned at the centre and never travels — the
                  cyan dots slide over it, which is what produces the crescent
                  in the reference. It sits above them in the stack. */}
              <span
                className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2"
                style={{ width: DOT_MAX_PX, height: DOT_MAX_PX, zIndex: 2 }}
              >
                <div
                  ref={whiteRef}
                  className="h-full w-full will-change-transform"
                  style={{ transformOrigin: 'center center' }}
                >
                  <Image
                    src={dotWhiteSrc}
                    alt=""
                    width={DOT_MAX_PX}
                    height={DOT_MAX_PX}
                    className="h-full w-full select-none object-contain"
                    unoptimized
                    priority
                  />
                </div>
              </span>
            </div>

            {/* QuestionMark — bottom-centre origin so the entrance overshoot
                reads as settling onto the row rather than drifting. */}
            <div
              ref={questionRef}
              className="absolute bottom-[38%] left-1/2 h-28 w-auto -translate-x-1/2 will-change-transform md:h-36"
              style={{ transformOrigin: 'bottom center', zIndex: 3 }}
            >
              <Image
                src={questionMarkSrc}
                alt=""
                className="h-full w-auto select-none object-contain"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
