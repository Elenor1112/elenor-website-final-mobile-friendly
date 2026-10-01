'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export type ShowcaseFilter = {
  name: string; // must match a case study `categories` value exactly
  slug: string; // links to /services/[slug]
  tagline: string;
};

export type ShowcaseCard = {
  slug: string;
  client: string;
  categories: string[];
  result: string;
  coverImageUrl: string | null;
};

// Kijamii-style filterable services showcase.
//  - Left 30%: sticky vertical list of services. Hover previews a filter;
//    click locks it so it persists after mouseleave (click again to unlock,
//    click another service to move the lock).
//  - Right 70%: two counter-drifting marquee columns of case-study cards —
//    the left column travels up, the right travels down, on a slow (~60s) loop.
//    Hovering/locking a service filters the columns down to the matching cards;
//    the belts keep moving throughout, they just carry fewer cards.
//
// Perf: the loop is pure CSS (reusing the scroll-reel-up/down keyframes from
// globals.css — content doubled, track translated -50%), so scrolling costs no
// JS per frame and no Framer layout FLIP. Only transform + opacity animate.
// Card contents render in DOM order inside each column, so the section stays
// crawlable; the duplicated half is aria-hidden.

// A gradient "cover" per card, keyed by its first category, so cards read as
// distinct image tiles without needing real assets yet.
const COVERS: Record<string, string> = {
  'Brand Identity': 'from-[#68cad6] via-[#8bdae3] to-[#1aebe4]',
  'Social Media': 'from-[#36e0d0] via-[#80ffdb] to-[#1aebe4]',
  'Web & App Development': 'from-[#1aebe4] via-[#36e0d0] to-[#68cad6]',
  'Video Production': 'from-[#ffb547] via-[#ff7ea8] to-[#68cad6]',
  'AI & Motion Graphics': 'from-[#80ffdb] via-[#8bdae3] to-[#68cad6]',
  'Event Planning': 'from-[#ff7ea8] via-[#ffb547] to-[#8bdae3]',
  'Printing & Production': 'from-[#8bdae3] via-[#ffb547] to-[#ff7ea8]',
  'Giveaways': 'from-[#ffb547] via-[#80ffdb] to-[#36e0d0]',
  'Interior Design': 'from-[#8bdae3] via-[#36e0d0] to-[#80ffdb]',
};
const COVER_FALLBACK = 'from-[#68cad6] via-[#36e0d0] to-[#8bdae3]';

// Style maps are code-owned (Tailwind classes can't live in the DB — the
// compiler must see them). Keyed by service NAME; unknown names get fallbacks.
const LIST_GRADIENTS: Record<string, string> = {
  'Brand Identity': 'from-[#68cad6] to-[#8bdae3]',
  'Social Media': 'from-[#36e0d0] to-[#80ffdb]',
  'Web & App Development': 'from-[#1aebe4] to-[#68cad6]',
  'Video Production': 'from-[#ffb547] to-[#ff7ea8]',
  'AI & Motion Graphics': 'from-[#80ffdb] to-[#8bdae3]',
  'Event Planning': 'from-[#ff7ea8] to-[#ffb547]',
  'Printing & Production': 'from-[#8bdae3] to-[#ffb547]',
  Giveaways: 'from-[#ffb547] to-[#80ffdb]',
  'Interior Design': 'from-[#8bdae3] to-[#36e0d0]',
};
const LIST_GRADIENT_FALLBACK = 'from-[#68cad6] to-[#8bdae3]';

const PILL: Record<string, string> = {
  'Brand Identity': 'border-brand-glow/50 text-brand-glow',
  'Social Media': 'border-brand-cyan/50 text-brand-cyan',
  'Web & App Development': 'border-[#1aebe4]/50 text-[#1aebe4]',
  'Video Production': 'border-brand-amber/50 text-brand-amber',
  'AI & Motion Graphics': 'border-[#80ffdb]/50 text-[#80ffdb]',
  'Event Planning': 'border-[#ff7ea8]/50 text-[#ff7ea8]',
  'Printing & Production': 'border-[#8bdae3]/50 text-[#8bdae3]',
  Giveaways: 'border-[#ffb547]/50 text-[#ffb547]',
  'Interior Design': 'border-brand/50 text-brand-glow',
};
const PILL_FALLBACK = 'border-white/25 text-white/70';

// Reveal cards once, when the grid first scrolls into view. One shared
// IntersectionObserver on the grid container (not one per card) keeps the
// mount reveal cheap; it disconnects after firing.
function useInView<T extends Element>(margin = '0px 0px -10% 0px') {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return { ref, inView };
}

export function ServicesShowcase({
  eyebrow,
  heading,
  filters,
  cards,
}: {
  eyebrow: string;
  heading: string;
  filters: ShowcaseFilter[];
  cards: ShowcaseCard[];
}) {
  // `locked` persists after mouseleave (set by click); `hovered` is transient.
  // The grid filters by `hovered ?? locked`, so hovering while locked previews
  // another service, and mouseleave falls back to the locked one — not to all.
  const [locked, setLocked] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  // Phone-only: the service rail scrolls horizontally, and arrows make that
  // discoverable. The buttons are rendered `md:hidden` (static markup, no
  // effects) and the rail is the same element on both, so desktop is unaffected.
  const railRef = useRef<HTMLUListElement | null>(null);
  const scrollRail = (dir: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    // About one chip-and-a-half per press, so a tap always reveals something new
    // without skipping past an entry.
    rail.scrollBy({ left: dir * Math.round(rail.clientWidth * 0.6), behavior: 'smooth' });
  };
  const reduce = useReducedMotion();

  const active = hovered ?? locked;
  const { ref: gridRef, inView } = useInView<HTMLDivElement>();

  const toggle = (name: string) =>
    setLocked((cur) => (cur === name ? null : name));

  // When a service is active, show only its matching cards. No active filter →
  // every card, in its original order.
  const visible = useMemo(
    () => (active ? cards.filter((c) => c.categories.includes(active)) : cards),
    [active, cards],
  );

  // Split into the two counter-drifting columns. Alternating (even/odd) keeps
  // both columns near-equal in length whatever the filter leaves behind.
  // A single match would otherwise leave the right column empty and the row
  // lopsided, so both belts carry it (staggered, so they're never in step).
  const mirrored = visible.length === 1;
  const columns = useMemo(() => {
    if (visible.length === 1) return [visible, visible];
    return [
      visible.filter((_, i) => i % 2 === 0),
      visible.filter((_, i) => i % 2 === 1),
    ];
  }, [visible]);

  return (
    <section
      className="relative z-10 overflow-hidden pb-24 pt-8 md:pb-32 md:pt-12"
      aria-label="Our work by service"
    >
      <CurvedLines />

      <div className="container-x relative">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-4 max-w-2xl font-display text-3xl font-semibold leading-tight md:text-5xl">
          {heading}
        </h2>

        <div className="mt-14 flex flex-col gap-12 lg:flex-row lg:gap-10">
          {/* LEFT — service list. Sticky on desktop; horizontal scroll on mobile. */}
          <div className="lg:w-[30%]">
            <div className="relative lg:sticky lg:top-28">
              {/* Phone-only rail arrows, placed in their own row above the
                  chips. Floating them over the rail's ends covered the first
                  and last label — the exact items they exist to reach — and a
                  390px screen has no gutter to move them into. `md:hidden` is
                  safe here: these are static buttons with no effects, so
                  nothing mounts or runs on desktop. */}
              <div className="mb-3 flex items-center justify-end gap-2 md:hidden">
                <button
                  type="button"
                  aria-label="Previous services"
                  onClick={() => scrollRail(-1)}
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/12 bg-white/[0.04] text-white/75"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="More services"
                  onClick={() => scrollRail(1)}
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/12 bg-white/[0.04] text-white/75"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              <ul
                ref={railRef}
                className="-mx-6 flex snap-x gap-3 overflow-x-auto px-6 pb-2 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0"
                role="tablist"
                aria-label="Filter work by service"
              >
                {filters.map((s) => {
                  const isActive = active === s.name;
                  const isLocked = locked === s.name;
                  const gradient = LIST_GRADIENTS[s.name] ?? LIST_GRADIENT_FALLBACK;
                  return (
                    <li key={s.slug} className="snap-start shrink-0 lg:shrink">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={isLocked}
                        onClick={() => toggle(s.name)}
                        onMouseEnter={() => !reduce && setHovered(s.name)}
                        onMouseLeave={() => !reduce && setHovered(null)}
                        className={[
                          'group block w-full whitespace-nowrap rounded-xl px-4 py-3 text-left transition-colors lg:whitespace-normal lg:px-3 lg:py-4',
                          isLocked
                            ? 'active bg-white/[0.06] ring-1 ring-white/15'
                            : '',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'font-display text-xl font-semibold transition-all duration-300 md:text-3xl',
                            isActive
                              ? `bg-gradient-to-r ${gradient} bg-clip-text italic text-transparent`
                              : 'text-white/45 group-hover:text-white/80',
                          ].join(' ')}
                        >
                          {s.name}
                        </span>

                        {/* Tagline fades in below the active name */}
                        <AnimatePresence initial={false}>
                          {isActive && (
                            <motion.span
                              key="tagline"
                              initial={{ opacity: 0, height: 0, y: -4 }}
                              animate={{ opacity: 1, height: 'auto', y: 0 }}
                              exit={{ opacity: 0, height: 0, y: -4 }}
                              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                              className="mt-1 block overflow-hidden text-sm leading-snug text-white/55"
                            >
                              {s.tagline}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <p className="mt-6 hidden text-xs text-white/35 lg:block">
                <span className="max-md:hidden">
                  {locked
                    ? 'Click the selected service again to show all work.'
                    : 'Hover to preview a service — click to keep it selected.'}
                </span>
                <span className="hidden max-md:inline">
                  {locked
                    ? 'Tap the selected service again to show all work.'
                    : 'Tap a service to filter the work.'}
                </span>
              </p>
            </div>
          </div>

          {/* RIGHT — two counter-drifting marquee columns. Column A travels up,
              column B travels down, both on the same slow loop so the pair reads
              as one mechanism. Masked top and bottom so cards dissolve at the
              edges instead of popping. Two columns on mobile too, with smaller
              cards (sized in mobile.css). */}
          <div ref={gridRef} className="lg:w-[70%]">
            <div
              className={[
                'grid grid-cols-2 gap-5 max-md:gap-3',
                'transition-opacity duration-700',
                inView ? 'opacity-100' : 'opacity-0',
              ].join(' ')}
              style={{
                // Fade the belts out at the top/bottom edges of the viewport
                // window rather than hard-cutting the cards.
                maskImage:
                  'linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)',
                WebkitMaskImage:
                  'linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)',
              }}
            >
              {columns.map((col, colIndex) => (
                <MarqueeColumn
                  key={colIndex}
                  cards={col}
                  // Left drifts up, right drifts down.
                  direction={colIndex === 0 ? 'up' : 'down'}
                  reduce={!!reduce}
                  // Offset the second belt so the two columns never sit in
                  // lockstep rows.
                  offset={colIndex === 0 ? 0 : -0.5}
                  // With a single match both columns carry the same card; the
                  // mirrored one is purely visual, so it must not be reachable
                  // or announced twice.
                  decorative={mirrored && colIndex === 1}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// One vertical belt of cards. The list is rendered twice inside a track that
// animates by -50% (or from -50% to 0 going down), so the seam is invisible and
// the loop is perfectly continuous. Reuses the scroll-reel-* keyframes already
// in globals.css, which the global prefers-reduced-motion rule flattens for
// free — `reduce` additionally drops the duplicate half so screen-reader and
// reduced-motion users get one plain, static list.

// Seconds per card, so the belt travels at a constant *speed* no matter how
// many cards a filter leaves behind — otherwise a 2-card column would race
// through its loop while a 20-card one crawled.
const SECONDS_PER_CARD = 7.5;
// A narrow filter can leave one card per column, and a sparse track leaves long
// empty stretches drifting through the window. Repeat the list until it's at
// least this long — a card is ~440px against a ~736px window, so four per half
// keeps the belt continuously full with margin either side of the seam.
const MIN_BELT_CARDS = 4;

function MarqueeColumn({
  cards,
  direction,
  reduce,
  offset,
  decorative = false,
}: {
  cards: ShowcaseCard[];
  direction: 'up' | 'down';
  reduce: boolean;
  /** Fraction of the loop to start at, e.g. -0.5 for half a cycle in. */
  offset: number;
  /** This whole belt mirrors another one — hide it from AT and the tab order. */
  decorative?: boolean;
}) {
  if (cards.length === 0) return <div />;

  // Under reduced motion nothing scrolls, so the real list is shown as-is.
  const belt = reduce
    ? cards
    : Array.from(
        { length: Math.max(1, Math.ceil(MIN_BELT_CARDS / cards.length)) },
        () => cards,
      ).flat();
  const duration = belt.length * SECONDS_PER_CARD;

  return (
    // The belt is taller than its window; the window clips it. `h-[42rem]` on
    // mobile / `h-[46rem]` on desktop keeps roughly two cards visible at once.
    // Below md the belts sit side by side with compact cards (see mobile.css),
    // so a 28rem window shows about two of them per column.
    <div className="group relative h-[42rem] overflow-hidden max-md:h-[28rem] lg:h-[46rem]">
      <div
        // `showcase-belt` lets globals.css pause this track (and only this one)
        // while the pointer is over one of its cards.
        className="showcase-belt flex flex-col gap-5 max-md:gap-3"
        style={
          reduce
            ? undefined
            : {
                animationName: `scroll-reel-${direction}`,
                animationDuration: `${duration}s`,
                animationTimingFunction: 'linear',
                animationIterationCount: 'infinite',
                animationDelay: `${offset * duration}s`,
                willChange: 'transform',
              }
        }
      >
        {/* Only the first pass through the real `cards` is exposed to assistive
            tech and the tab order; every repeat is decorative. */}
        {belt.map((card, i) => (
          <ShowcaseCardTile
            key={`a-${i}-${card.slug}`}
            card={card}
            duplicate={decorative || i >= cards.length}
          />
        ))}
        {/* Duplicate half — makes the -50% translate seamless. Hidden from
            assistive tech and skipped entirely under reduced motion. */}
        {!reduce &&
          belt.map((card, i) => (
            <ShowcaseCardTile key={`b-${i}-${card.slug}`} card={card} duplicate />
          ))}
      </div>
    </div>
  );
}

function ShowcaseCardTile({
  card,
  duplicate = false,
}: {
  card: ShowcaseCard;
  duplicate?: boolean;
}) {
  const primary = card.categories[0];
  const cover = COVERS[primary] ?? COVER_FALLBACK;
  const coverImage = card.coverImageUrl;

  return (
    <article className="shrink-0" aria-hidden={duplicate || undefined}>
      <Link
        href={`/work/${card.slug}`}
        // The duplicate is decorative; keep it out of the tab order so the
        // same case study isn't reachable twice.
        tabIndex={duplicate ? -1 : undefined}
        // `showcase-card` is the pause trigger — the hover region is this
        // element's rounded box, so the belt only stops within the card radius.
        className="showcase-card showcase-tile group/card block overflow-hidden rounded-3xl glass transition-transform duration-500 hover:-translate-y-1"
      >
        {/* Cover with a diagonal cutout corner (top-right) */}
        <div
          className={`relative aspect-[4/3] bg-gradient-to-br ${cover}`}
          style={{
            clipPath:
              'polygon(0 0, calc(100% - 2.5rem) 0, 100% 2.5rem, 100% 100%, 0 100%)',
          }}
        >
          {coverImage && (
            <img
              src={coverImage}
              alt={duplicate ? '' : `${card.client} — ${primary}`}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-[1.03]"
            />
          )}
          <div className="absolute inset-0 bg-ink/25 mix-blend-multiply" />
          <span className="absolute bottom-4 left-5 font-display text-lg font-semibold text-white/90 drop-shadow">
            {card.client}
          </span>
        </div>

        <div className="p-5">
          <h3 className="font-display text-base font-semibold leading-snug text-white/90">
            {card.result}
          </h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {card.categories.slice(0, 2).map((c) => (
              <span
                key={c}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  PILL[c] ?? PILL_FALLBACK
                }`}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </article>
  );
}

// Subtle animated curved horizontal lines behind the section (CSS/SVG only).
// Very low opacity; each path drifts slowly on a long loop.
function CurvedLines() {
  const lines = [0, 1, 2, 3, 4];
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.12]"
      aria-hidden
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        fill="none"
      >
        <defs>
          <linearGradient id="showcase-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1aebe4" stopOpacity="0" />
            <stop offset="50%" stopColor="#80ffdb" stopOpacity="1" />
            <stop offset="100%" stopColor="#8bdae3" stopOpacity="0" />
          </linearGradient>
        </defs>
        {lines.map((i) => {
          const y = 130 + i * 160;
          return (
            <path
              key={i}
              d={`M-100 ${y} C 360 ${y - 90}, 1080 ${y + 90}, 1540 ${y}`}
              stroke="url(#showcase-line)"
              strokeWidth="1.5"
              className="showcase-curve"
              style={{ animationDelay: `${i * -3}s` }}
            />
          );
        })}
      </svg>
    </div>
  );
}
