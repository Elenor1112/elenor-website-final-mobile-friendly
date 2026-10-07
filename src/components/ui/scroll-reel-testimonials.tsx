'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { getClientLogo } from '@/lib/data/client-logos';

// Testimonials with a two-column "reel" of client logos beside the featured
// quote. The reel is driven by the same cursor as the quote: the active
// client's logo is centred and enlarged while the columns slide in opposite
// directions. Quotes auto-cycle every 4s; hovering pauses, leaving resumes
// after 1s. Arrow buttons / arrow keys page manually. Char-rise/exit
// keyframes live in globals.css (scroll-reel-*).

export type Testimonial = {
  quote: string;
  author: string;
  role: string;
  company: string;
};

// Styling tokens — aligned with the site's design language (ink background,
// glass panels, white-opacity text, brand gradient accents).
const QUOTE_CLASSES =
  'font-display text-xl font-semibold leading-snug text-white/90 md:text-2xl lg:text-3xl';
const AUTHOR_CLASSES = 'text-sm text-white/55';
const FEATURED_SHADOW =
  'shadow-[0_0_45px_-10px_theme(colors.brand.glow)] ring-1 ring-brand-glow/40';

const AUTO_ADVANCE_MS = 4000;
const RESUME_DELAY_MS = 1000;

// Per-character text rise. Screen readers get the plain string; the animated
// characters are decorative. Words stay in inline-blocks so they wrap whole.
function RisingChars({ text, animate }: { text: string; animate: boolean }) {
  if (!animate) return <>{text}</>;
  const words = text.split(' ');
  let charIndex = 0;
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((word, w) => (
          <span key={w} className="inline-block whitespace-pre">
            {(w < words.length - 1 ? word + ' ' : word)
              .split('')
              .map((ch, c) => {
                const delay = Math.min(charIndex++ * 12, 800);
                return (
                  <span
                    key={c}
                    className="inline-block"
                    style={{
                      animation:
                        'scroll-reel-char-rise 0.6s cubic-bezier(0.16,1,0.3,1) both',
                      animationDelay: `${delay}ms`,
                    }}
                  >
                    {ch}
                  </span>
                );
              })}
          </span>
        ))}
      </span>
    </>
  );
}

// Tile height (h-24 = 96px) + pb-3 (12px). The track offset is computed from
// this, so it must match the tile markup below.
const TILE_PITCH = 108;
const EASE = 'ease-[cubic-bezier(0.16,1,0.3,1)]';

// One vertical column of client tiles, driven by the active step instead of a
// free-running animation. `center` is the (fractional) tile index, within the
// base copy, that sits at the panel's vertical centre; the track is repeated
// so the list can loop, and each tile scales by its distance from the centre —
// only a tile exactly on the centre is "active" (enlarged + glow). Because the
// two columns are half a tile apart, the other column's tiles stay small.
function ReelColumn({
  items,
  center,
  instant,
}: {
  items: string[];
  center: number;
  instant: boolean;
}) {
  const m = items.length;
  const pad = Math.ceil(4 / m);
  const base = pad * m;
  const copies = 2 * pad + 2;
  const centerIdx = base + center;
  return (
    <div className="relative h-full flex-1">
      <div
        className={[
          'absolute inset-x-0 top-1/2 flex flex-col transition-transform duration-700 motion-reduce:transition-none',
          EASE,
          instant ? '!transition-none' : '',
        ].join(' ')}
        style={{ transform: `translateY(${-(centerIdx + 0.5) * TILE_PITCH}px)` }}
      >
        {Array.from({ length: copies * m }, (_, p) => {
          const name = items[p % m];
          const logo = getClientLogo(name);
          const active = Math.abs(p - centerIdx) < 0.01;
          const isBase = p >= base && p < base + m;
          return (
            <div key={p} className="pb-3" aria-hidden={isBase ? undefined : true}>
              <div
                className={[
                  'relative flex h-24 items-center justify-center rounded-2xl px-3 transition-[transform,opacity,box-shadow] duration-700 motion-reduce:transition-none',
                  EASE,
                  instant ? '!transition-none' : '',
                  active ? `scale-125 opacity-100 ${FEATURED_SHADOW}` : 'scale-[0.85] opacity-50',
                ].join(' ')}
              >
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logo.url}
                    alt={isBase ? name : ''}
                    loading="lazy"
                    decoding="async"
                    className="relative max-h-14 w-auto max-w-[80%] object-contain"
                  />
                ) : (
                  // Clients without a logo asset keep their name as text.
                  <span className="relative text-center font-display text-base font-semibold tracking-tight text-white/80">
                    {name}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ArrowIcon({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={dir === 'left' ? 'rotate-180' : ''}
    >
      <path
        d="M3 8h10m0 0-4-4m4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const mod = (a: number, b: number) => ((a % b) + b) % b;

export function ScrollReelTestimonials({
  testimonials,
}: {
  testimonials: Testimonial[];
}) {
  const reduce = useReducedMotion();
  // `step` is a cumulative cursor (never wrapped while animating) so the reel
  // always travels one tile in the direction of travel; the active testimonial
  // is `step mod count`. `prev` keeps the outgoing quote mounted for its exit.
  const [state, setState] = useState<{ step: number; prev: number | null }>({
    step: 0,
    prev: null,
  });
  const [instant, setInstant] = useState(false);
  const [paused, setPaused] = useState(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const count = testimonials.length;
  // Virtual loop length: even, so the two columns (even / odd virtual
  // indices) hold the same number of tiles and a full lap is a whole number
  // of tiles in each. Odd counts are doubled.
  const loop = count % 2 === 0 ? count : count * 2;
  const index = mod(state.step, count);
  const paginate = useCallback(
    (dir: number) =>
      setState((s) => ({ step: s.step + dir, prev: mod(s.step, count) })),
    [count]
  );

  // Once the cursor leaves [0, loop), snap it back by whole laps after the
  // slide finishes. The repeated tiles are identical, so the jump (with
  // transitions off for a frame) is invisible.
  useEffect(() => {
    if (state.step >= 0 && state.step < loop) return;
    const t = setTimeout(() => {
      setInstant(true);
      setState((s) => ({ ...s, step: mod(s.step, loop) }));
      requestAnimationFrame(() => requestAnimationFrame(() => setInstant(false)));
    }, 800);
    return () => clearTimeout(t);
  }, [state.step, loop]);

  // Auto-advance; the interval is torn down whenever hover pauses it (or
  // reduced motion disables it) and recreated on resume.
  useEffect(() => {
    if (paused || reduce || count < 2) return;
    const id = setInterval(() => paginate(1), AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [paused, reduce, count, paginate]);

  useEffect(
    () => () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    },
    []
  );

  const handleMouseEnter = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    setPaused(true);
  };
  const handleMouseLeave = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), RESUME_DELAY_MS);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      paginate(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      paginate(1);
    }
  };

  const current = testimonials[index];
  // Column A holds even virtual indices top→bottom; column B holds odd ones
  // reversed, so as the cursor advances A slides up and B slides down.
  const half = loop / 2;
  const companyAt = (i: number) => testimonials[i % count].company;
  const colA = Array.from({ length: half }, (_, k) => companyAt(2 * k));
  const colB = Array.from({ length: half }, (_, k) => companyAt(2 * (half - 1 - k) + 1));
  const centerA = state.step / 2;
  const centerB = half - 1 - (state.step - 1) / 2;

  return (
    <div
      role="region"
      aria-label="Client testimonials"
      tabIndex={0}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      className="group glass relative overflow-hidden rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-brand-glow/60"
    >
      <div className="flex flex-col lg:flex-row">
        {/* Reel — two counter-rotating columns of client tiles */}
        <div className="relative flex h-56 gap-3 overflow-hidden border-b border-white/10 p-4 lg:h-[26rem] lg:w-[38%] lg:border-b-0 lg:border-r">
          <ReelColumn items={colA} center={centerA} instant={instant} />
          <ReelColumn items={colB} center={centerB} instant={instant} />
          {/* Edge fades so tiles dissolve instead of clipping */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-ink to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-ink to-transparent" />
        </div>

        {/* Featured quote + controls */}
        <div className="flex flex-1 flex-col justify-between gap-10 p-7 md:p-10 lg:p-12">
          <div aria-live="polite" className="relative min-h-[8rem] md:min-h-[10rem]">
            <blockquote key={state.step} className={QUOTE_CLASSES}>
              &ldquo;
              <RisingChars text={current.quote} animate={!reduce} />
              &rdquo;
            </blockquote>
            {state.prev !== null && (
              <blockquote
                aria-hidden
                className={`${QUOTE_CLASSES} pointer-events-none absolute inset-0`}
                style={{ animation: 'scroll-reel-exit 0.35s ease both' }}
                onAnimationEnd={() =>
                  setState((s) => ({ ...s, prev: null }))
                }
              >
                &ldquo;{testimonials[state.prev].quote}&rdquo;
              </blockquote>
            )}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="font-display text-base font-semibold text-white/90">
                {current.author}
              </p>
              <p className={`mt-1 ${AUTHOR_CLASSES}`}>
                {current.role}, {current.company}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="mr-1 text-xs tabular-nums tracking-[0.22em] text-white/35">
                {String(index + 1).padStart(2, '0')} /{' '}
                {String(count).padStart(2, '0')}
              </span>
              <button
                type="button"
                aria-label="Previous testimonial"
                onClick={() => paginate(-1)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-white/80 transition-all duration-300 hover:scale-105 hover:border-white/40 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow"
              >
                <ArrowIcon dir="left" />
              </button>
              <button
                type="button"
                aria-label="Next testimonial"
                onClick={() => paginate(1)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-white/80 transition-all duration-300 hover:scale-105 hover:border-white/40 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow"
              >
                <ArrowIcon dir="right" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
