'use client';

import Image, { type StaticImageData } from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import visionIcon from '@/assets/About Us Insidous/Vision.png';
import missionIcon from '@/assets/About Us Insidous/Mission.png';
import valuesIcon from '@/assets/About Us Insidous/Values.png';
import goalsIcon from '@/assets/About Us Insidous/Goals.png';
import ceoPortraitFallback from '@/assets/CEO/emad-samir-cutout.png';

// ─────────────────────────────────────────────────────────────────────────────
// Elenor — About page body
//
//   1. CEO's Word — small eyebrow title above a rounded, bordered quote
//      box; staggered fade-up reveal.
//   2. What Tailored Actually Means — kinetic parallax heading (drifts in,
//      holds, drifts apart on exit) + staggered fade-up copy.
//   3. Brand Philosophy — heading fades/rises in once on scroll; four icons
//      fade in as a group below it. Hovering (or focusing, for keyboard
//      users) a pillar reveals its copy.
//
// Motion budget: the parallax heading scrubs on `x` (a transform) inside one
// GSAP timeline (enter → hold → exit) driven by a single ScrollTrigger's
// `scrub`, so it stays pinned to scroll position with no independent easing
// loop to fight Lenis. Fade-in reveals are a single GSAP timeline per block,
// triggered once on enter.
// ─────────────────────────────────────────────────────────────────────────────

type Pillar = {
  key: string;
  label: string;
  icon: StaticImageData;
  body: string;
};

/**
 * Splits a heading into the two stacked lines `ParallaxHeading` renders.
 * Words break roughly in half, biased to keep the first line the shorter of
 * the two — matching the spec's layout ("CEO's" / "Word", "What Tailored" /
 * "Actually Means", "Brand" / "Philosophy") for any CMS-edited heading, not
 * just the current copy.
 */
function splitHeading(text: string): [string, string] {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return [text, ''];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return reduced;
}

/**
 * One "display text" block: two stacked lines of massive transparent-fill
 * type. Each line drifts in from its outer offset and *settles at x: 0* as
 * the block enters the viewport, then holds there — motionless, readable —
 * while it's the focal element on screen. Only once the reader keeps
 * scrolling past it does it resume: the left line drifting further left,
 * the right line further right, diverging apart as the block exits upward.
 *
 * `centered` stacks both lines directly on top of each other (used only for
 * "CEO's Word"); otherwise the second line sits indented to the right, per
 * the spec's diagonal "What Tailored / Actually Means" and "Brand /
 * Philosophy" layout. Either way the lines still scrub apart identically —
 * `centered` only changes the resting alignment, not the motion.
 */
function ParallaxHeading({
  lineLeft,
  lineRight,
  reduced,
  centered = false,
}: {
  lineLeft: string;
  lineRight: string;
  reduced: boolean;
  centered?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    if (!wrap || !left || reduced) return;

    gsap.registerPlugin(ScrollTrigger);

    // Travel is a fraction of the wrapper's own width — enough to read as a
    // real drift at any viewport size without either line ever fully
    // leaving the section.
    const ctx = gsap.context(() => {
      const distance = () => wrap.clientWidth * 0.35;

      // One timeline, scrubbed 0→1 across the heading's transit through the
      // viewport. Positions 0 and 0.65 are explicit timeline labels (not
      // durations), so both lines enter/settle together and exit together
      // regardless of their own tween length — and the 0.35→0.65 gap between
      // them is left with no tween at all, which is what makes GSAP hold the
      // value steady instead of interpolating through it.
      //
      // The trigger range spans ~2.7 viewport-heights (`top 95%` → `top
      // -140%`), not just the one the heading visually occupies — the hold
      // phase (0.35–0.65 of this timeline) needs real scroll distance behind
      // it or a normal scroll flick blows straight through it. At this
      // range each phase gets roughly a full viewport-height of scroll, so
      // the settled heading actually sits still and readable for a beat
      // before the reader scrolls it apart again.
      const tl = gsap.timeline({
        scrollTrigger: { trigger: wrap, start: 'top 95%', end: 'top -140%', scrub: 0.6 },
      });
      tl.fromTo(left, { x: () => distance() * 0.5 }, { x: 0, ease: 'none', duration: 0.35 }, 0);
      tl.to(left, { x: () => -distance(), ease: 'none', duration: 0.35 }, 0.65);
      if (right) {
        tl.fromTo(right, { x: () => -distance() * 0.5 }, { x: 0, ease: 'none', duration: 0.35 }, 0);
        tl.to(right, { x: () => distance(), ease: 'none', duration: 0.35 }, 0.65);
      }
    }, wrap);

    return () => ctx.revert();
  }, [reduced]);

  const align = centered ? 'text-center' : 'text-left';
  const rightAlign = centered ? 'text-center' : 'text-right';

  return (
    <div ref={wrapRef} className="flex flex-col overflow-hidden py-4 md:py-8" aria-hidden>
      <div
        ref={leftRef}
        className={`about-parallax-text whitespace-nowrap font-display font-bold leading-[0.95] ${align}`}
        style={reduced ? { transform: 'translateX(0)' } : undefined}
      >
        {lineLeft}
      </div>
      {lineRight ? (
        <div
          ref={rightRef}
          className={`about-parallax-text whitespace-nowrap font-display font-bold leading-[0.95] ${rightAlign}`}
          style={
            reduced
              ? { transform: 'translateX(0)' }
              : centered
                ? undefined
                : { marginLeft: '18%' }
          }
        >
          {lineRight}
        </div>
      ) : null}
    </div>
  );
}

/** Heading that fades + rises in once as it scrolls into view (no parallax drift). */
function FadeInHeading({
  lineLeft,
  lineRight,
  reduced,
  centered = false,
}: {
  lineLeft: string;
  lineRight: string;
  reduced: boolean;
  centered?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || reduced) return;

    gsap.registerPlugin(ScrollTrigger);
    const lines = wrap.querySelectorAll('[data-fade-line]');
    if (lines.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.set(lines, { opacity: 0, y: 24 });
      gsap.to(lines, {
        opacity: 1,
        y: 0,
        duration: 1.6,
        ease: 'power2.out',
        stagger: 0.3,
        scrollTrigger: { trigger: wrap, start: 'top 80%', once: true },
      });
    }, wrap);

    return () => ctx.revert();
  }, [reduced]);

  const align = centered ? 'text-center' : 'text-left';
  const rightAlign = centered ? 'text-center' : 'text-right';

  return (
    <div ref={wrapRef} className="flex flex-col overflow-hidden py-4 md:py-8">
      <div
        data-fade-line
        className={`about-parallax-text whitespace-nowrap font-display font-bold leading-[0.95] ${align}`}
        style={reduced ? undefined : { opacity: 0 }}
      >
        {lineLeft}
      </div>
      {lineRight ? (
        <div
          data-fade-line
          className={`about-parallax-text whitespace-nowrap font-display font-bold leading-[0.95] ${rightAlign}`}
          style={
            reduced
              ? centered
                ? undefined
                : { marginLeft: '18%' }
              : centered
                ? { opacity: 0 }
                : { marginLeft: '18%', opacity: 0 }
          }
        >
          {lineRight}
        </div>
      ) : null}
    </div>
  );
}

/** Fade-up + stagger reveal, triggered once when the block enters the viewport. */
function useFadeUpReveal<T extends HTMLElement>(reduced: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;

    gsap.registerPlugin(ScrollTrigger);
    const targets = el.querySelectorAll('[data-reveal]');
    if (targets.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.set(targets, { opacity: 0, y: 30 });
      gsap.to(targets, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: { trigger: el, start: 'top 80%', once: true },
      });
    }, el);

    return () => ctx.revert();
  }, [reduced]);
  return ref;
}

/**
 * Splits the CEO quote right after "growth" (the point the client
 * wants the fold), falling back to showing the whole quote with no toggle
 * if a CMS edit ever removes that phrase.
 */
function splitAtClearVision(quote: string): [string, string] {
  const marker = 'sustainable growth.';
  const idx = quote.indexOf(marker);
  if (idx === -1) return [quote, ''];
  const cut = idx + marker.length;
  return [quote.slice(0, cut), quote.slice(cut).trim()];
}

/**
 * Splits the attribution into name and role on the first comma, so
 * "Eng. Emad Samir, CEO & Founder" can set the name large and the role beneath
 * it. Same contract as `splitAtClearVision`: text that doesn't match the
 * expected shape (no comma) comes back whole, and the caller renders one line.
 */
function splitCite(cite: string): [string, string] {
  const at = cite.indexOf(',');
  if (at === -1) return [cite.trim(), ''];
  return [cite.slice(0, at).trim(), cite.slice(at + 1).trim()];
}

type StoryFold = {
  /** Paragraphs shown whole while collapsed. */
  lead: string[];
  /** Head of the paragraph the fold cuts through, shown while collapsed. */
  head: string;
  /** Its tail, revealed on expand and rejoined to `head` in the same <p>. */
  tail: string;
  /** Paragraphs that appear only once expanded. */
  rest: string[];
};

/**
 * Same fold treatment as the CEO quote, applied to the story copy: everything
 * up to "…actual market" stays visible and the remainder collapses behind
 * "Read more". The marker falls mid-sentence, so that paragraph is cut in
 * place — `head` and `tail` render as one continuous <p> when expanded rather
 * than breaking the sentence across two. If a CMS edit ever removes the marker
 * phrase, the whole text shows with no toggle.
 */
function splitStory(paragraphs: string[]): StoryFold {
  const marker = 'grounded in actual market';
  const at = paragraphs.findIndex((p) => p.includes(marker));
  if (at === -1) return { lead: paragraphs, head: '', tail: '', rest: [] };

  const para = paragraphs[at]!;
  const cut = para.indexOf(marker) + marker.length;

  return {
    lead: paragraphs.slice(0, at),
    head: para.slice(0, cut),
    tail: para.slice(cut),
    rest: paragraphs.slice(at + 1),
  };
}

/** Where the collapsed portrait crops, as a fraction of the figure's full height.
    The crossed forearms are the widest part of the silhouette; the taper below
    them ends at 0.743 of the cutout (scripts/build-ceo-portrait.mjs reports this
    — re-read it if the portrait is re-cut), so cropping just past that lands on
    the jacket, below the elbows, leaving a band for the fade mask to dissolve
    through instead of cutting the arms off mid-forearm. One fraction rather than
    a rem ladder per breakpoint, so a re-cut only moves this number. */
const ELBOW_CROP = 0.8;

function CeoWord({
  eyebrow,
  quote,
  cite,
  portrait,
  reduced,
}: {
  eyebrow: string;
  quote: string;
  cite: string;
  portrait: { id: string; url: string; alt: string } | null;
  reduced: boolean;
}) {
  const ref = useFadeUpReveal<HTMLDivElement>(reduced);
  const [expanded, setExpanded] = useState(false);
  const [lead, rest] = splitAtClearVision(quote);
  const [name, role] = splitCite(cite);

  // The CMS field is an override, not a requirement: rows seeded before it
  // existed hold null, and the section still has a portrait to show.
  const src = portrait?.url ? portrait.url : ceoPortraitFallback;
  const alt = portrait?.alt || `Portrait of ${name}`;

  // The portrait folds with the quote, so it is cropped on exactly the same
  // condition the Read more button is rendered on: `rest` is empty when a CMS
  // edit drops the fold marker, and with no button there would be no way to
  // reveal a cropped figure.
  const cropped = Boolean(rest) && !expanded;

  return (
    // Full content width rather than the old max-w-3xl: the portrait needs room
    // to sit beside the quote. The block still starts at the .container-x edge,
    // which is where the hero stage puts the "A" of "About us" (see
    // .about-hero__stage in globals.css), so it stays aligned to the wordmark.
    <div ref={ref} className="relative">
      <p
        data-reveal
        className="font-display text-[1.75rem] font-extrabold uppercase tracking-[0.15em] text-brand-glow"
      >
        {eyebrow}
      </p>

      {/* min-h is sized to the *expanded* figure so the card's own height never
          changes: only the figure animates inside it. Without that, folding
          would resize the card under a transition that isn't on the card, and
          the whole block would jump. `isolate` keeps the portrait's z-index
          from reaching past the card (the global .noise-overlay sits at z-60). */}
      <div
        data-reveal
        className="relative isolate mt-4 rounded-3xl border border-white/10 bg-white/[0.03] bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-transparent p-8 md:p-12 lg:min-h-[34.5rem] lg:p-14 xl:min-h-[37.5rem]"
      >
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-6">
          {/* Portrait first in source order so it stacks above the quote on
              mobile; lg:order-2 puts it back on the right at desktop. */}
          {/* self-start, not self-center: the grid row grows when the quote
              expands, and centring would re-centre the figure inside that taller
              row — sliding the head down by the height the text just added. The
              head staying put is the whole point of the fold. */}
          <div className="lg:order-2 lg:col-span-5 lg:self-start">
            {/* The figure is waist-up, so it sits contained inside the card
                rather than breaking its edges the way the old full-body cutout
                did. --ceo-h is the figure's full height; the collapsed state is
                a fraction of that same value, so both ends of the transition
                resolve from one source and a breakpoint change can't desync
                them. max-w only guards the small screens, where the column is
                wider than the height-constrained figure needs. */}
            <div
              className={`relative mx-auto w-full max-w-[21.5rem] [--ceo-h:27rem] sm:max-w-[24.5rem] sm:[--ceo-h:30.5rem] lg:mx-0 lg:max-w-none lg:[--ceo-h:34.5rem] xl:[--ceo-h:37.5rem] ${
                reduced ? '' : 'transition-[height] duration-500 ease-out'
              }`}
              style={{
                height: cropped ? `calc(var(--ceo-h) * ${ELBOW_CROP})` : 'var(--ceo-h)',
              }}
            >
              {/* Brand bloom behind the figure. Two offset, differently tinted
                  layers read as rim lighting rather than as a flat halo — and
                  they soften the cutout's edge where it meets the ground. */}
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[42%] h-[70%] w-[95%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-glow/20 blur-3xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute left-[60%] top-[30%] h-[50%] w-[50%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-cyan/10 blur-3xl"
              />
              {/* The portrait folds with the quote: collapsed cuts just below
                  the crossed elbows, expanding uncovers the rest of him.
                  The *box* above animates its height (so the collapsed state
                  reserves no empty space below him), while the image inside
                  keeps the full height pinned to the top — cropping rather than
                  rescaling. Sizing the image off the box instead would make
                  object-contain shrink the whole figure, walking the head down
                  toward the elbows; this way the head never moves.
                  cropped=false (no fold in the CMS copy, so no Read more to
                  press) must render him whole, or he'd be cut off with no way
                  to reveal the rest. */}
              <div
                className="absolute inset-x-0 top-0 h-full overflow-hidden"
                style={
                  // Softens the cut so the figure dissolves into the card
                  // rather than ending on a hard horizontal edge. The stop sits
                  // late (88%) because this figure is waist-up: the old
                  // full-body cutout could spare a 22% fade band, but here the
                  // same band would reach up into the forearms. Dropped once
                  // expanded — otherwise his hem would stay faded — rather than
                  // interpolated, since gradient stops don't animate reliably
                  // across browsers.
                  cropped
                    ? {
                        WebkitMaskImage:
                          'linear-gradient(to bottom, #000 88%, transparent 100%)',
                        maskImage: 'linear-gradient(to bottom, #000 88%, transparent 100%)',
                      }
                    : undefined
                }
              >
                {/* object-top pins the head to the box's fixed top edge. That
                    is what makes ELBOW_CROP trustworthy: object-contain
                    letterboxes on the free axis, so where the box is narrower
                    than the figure's 0.66 aspect (small screens) there is
                    vertical slack, and bottom-anchoring would push him down
                    until the crop cut his chest instead of his elbows. It also
                    means the head can't move when the box height animates,
                    since only the bottom edge is moving. fill + a sized parent
                    serves the static import and a remote CMS URL through one
                    code path. The height here is the figure's full height, not
                    the clip layer's, which is what keeps it a constant size. */}
                <div className="absolute inset-x-0 top-0 h-[var(--ceo-h)]">
                  <Image
                    src={src}
                    alt={alt}
                    fill
                    sizes="(max-width: 640px) 60vw, (max-width: 1024px) 45vw, 300px"
                    className="relative object-contain object-top"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:order-1 lg:col-span-7">
            <blockquote className="text-justify [word-spacing:-0.05em] font-display text-xl font-medium leading-relaxed text-white/85 md:text-2xl">
              “{lead}
              {rest ? (
                <>
                  {expanded ? ` ${rest}` : null}
                  {'”'}
                </>
              ) : (
                '”'
              )}
            </blockquote>
            {rest ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className="mt-3 self-start text-sm font-semibold text-brand-glow underline underline-offset-4 transition-opacity hover:opacity-80"
              >
                {expanded ? 'Read less' : 'Read more'}
              </button>
            ) : null}
            {/* mt-auto drops the attribution to the bottom of the text column,
                so it lines up with the bottom of the card. */}
            {/* Left-aligned on a phone: right-aligning pushes the name into the
                gutter where the floating chat launcher sits, and at this
                measure the attribution reads better on the same axis as the
                quote it belongs to. */}
            <div className="mt-auto pt-10 text-right max-md:pt-6 max-md:text-left">
              <p className="font-display text-lg font-semibold text-white md:text-xl">{name}</p>
              {role ? (
                <p className="mt-1 text-sm font-semibold uppercase tracking-[0.15em] text-brand-glow">
                  {role}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TailoredStory({
  heading,
  paragraphs,
  reduced,
}: {
  heading: string;
  paragraphs: string[];
  reduced: boolean;
}) {
  const ref = useFadeUpReveal<HTMLDivElement>(reduced);
  const [expanded, setExpanded] = useState(false);
  const { lead, head, tail, rest } = splitStory(paragraphs);
  const foldable = Boolean(head);
  const copy = 'text-justify font-display text-xl font-medium leading-relaxed text-white/85 md:text-2xl';

  return (
    <div ref={ref} className="mx-auto max-w-3xl">
      {/* The section heading lives in the parallax artwork above, so the real
          h2 stays sr-only — and outside the card, which holds only the copy. */}
      <h2 data-reveal className="sr-only max-md:not-sr-only max-md:mb-4 max-md:block max-md:font-display max-md:text-[1.6875rem] max-md:font-semibold max-md:leading-[1.15] max-md:tracking-tight">
        {heading}
      </h2>
      {/* Unlike the CEO quote above, this copy sits directly on the page with
          no card around it. The wrapper stays as a plain grouping element:
          `data-reveal` lives on each paragraph rather than here, and
          useFadeUpReveal queries descendants, so this nesting level is fine
          and the per-paragraph stagger is kept. */}
      <div>
        {/* `data-reveal` marks only what is on screen at mount: the effect runs
            once, so anything revealed later by "Read more" renders as-is
            rather than staying stuck at opacity 0. */}
        {lead.map((p, i) => (
          <p key={i} data-reveal className={`mt-6 first:mt-0 ${copy}`}>
            {p}
          </p>
        ))}
        {foldable ? (
          <p data-reveal className={`mt-6 first:mt-0 ${copy}`}>
            {head}
            {expanded ? tail : '…'}
          </p>
        ) : null}
        {expanded
          ? rest.map((p, i) => (
              <p key={i} className={`mt-6 ${copy}`}>
                {p}
              </p>
            ))
          : null}
        {foldable ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-4 text-sm font-semibold text-brand-glow underline underline-offset-4 transition-opacity hover:opacity-80"
          >
            {expanded ? 'Read less' : 'Read more'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function BrandPhilosophy({
  heading,
  pillars,
  reduced,
}: {
  heading: string;
  pillars: Pillar[];
  reduced: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);
  // On a touch screen a tap emits mouseenter and then click, so the pair of
  // handlers below would open the panel and the click would immediately close
  // it again — the pillar looked unresponsive on a phone. Hover intent only
  // exists on a device that can hover, so the mouse handlers are bound only
  // there and touch is left to the click handler alone.
  const [canHover, setCanHover] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const sync = () => setCanHover(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || reduced) return;

    gsap.registerPlugin(ScrollTrigger);
    const icons = el.querySelectorAll('[data-icon]');
    if (icons.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.set(icons, { opacity: 0, y: 24 });
      gsap.to(icons, {
        opacity: 1,
        y: 0,
        duration: 1.6,
        ease: 'power2.out',
        // All four fade in simultaneously, per spec — no stagger.
        scrollTrigger: { trigger: el, start: 'top 78%', once: true },
      });
    }, el);

    return () => ctx.revert();
  }, [reduced]);

  const activePillar = pillars.find((p) => p.key === active) ?? null;

  return (
    <div ref={rootRef}>
      <h2 className="sr-only max-md:not-sr-only max-md:mb-4 max-md:block max-md:font-display max-md:text-[1.6875rem] max-md:font-semibold max-md:leading-[1.15] max-md:tracking-tight">{heading}</h2>
      <div className="grid grid-cols-2 gap-6 sm:gap-8 md:grid-cols-4">
        {pillars.map((pillar) => {
          const isActive = active === pillar.key;
          return (
            <button
              key={pillar.key}
              type="button"
              data-icon
              onMouseEnter={canHover && !reduced ? () => setActive(pillar.key) : undefined}
              onMouseLeave={
                canHover && !reduced
                  ? () => setActive((cur) => (cur === pillar.key ? null : cur))
                  : undefined
              }
              onFocus={() => setActive(pillar.key)}
              onBlur={() => setActive((cur) => (cur === pillar.key ? null : cur))}
              onClick={() => setActive((cur) => (cur === pillar.key ? null : pillar.key))}
              aria-expanded={isActive}
              aria-describedby={`brand-philosophy-${pillar.key}`}
              className={`group flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center outline-none transition-colors duration-300 hover:border-brand-glow/40 hover:bg-white/[0.05] focus-visible:border-brand-glow/60 md:p-8 ${
                isActive ? 'border-brand-glow/50 bg-white/[0.06]' : ''
              }`}
            >
              <span
                className={`relative h-[6.25rem] w-[6.25rem] shrink-0 transition-transform duration-300 max-md:h-[4.5rem] max-md:w-[4.5rem] md:h-[7.8125rem] md:w-[7.8125rem] ${
                  isActive ? 'scale-110' : 'group-hover:scale-105'
                }`}
              >
                <Image src={pillar.icon} alt="" aria-hidden fill className="object-contain" sizes="125px" />
              </span>
              <span className="font-display text-xl font-semibold text-white/90 md:text-[1.4rem]">
                {pillar.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Revealed copy — one shared panel below the grid so the reveal never
          reflows the icons themselves. Height animates open/closed; content
          fades a beat after. */}
      <div
        className="grid overflow-hidden transition-[grid-template-rows] duration-400 ease-out"
        style={{ gridTemplateRows: activePillar ? '1fr' : '0fr' }}
      >
        <div className="min-h-0">
          {pillars.map((pillar) => (
            <p
              key={pillar.key}
              id={`brand-philosophy-${pillar.key}`}
              role="status"
              className="mx-auto max-w-2xl px-2 pt-8 text-center text-base leading-relaxed text-white/70"
              hidden={activePillar?.key !== pillar.key}
            >
              {pillar.body}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AboutContent({
  ceoEyebrow,
  ceoQuote,
  ceoCite,
  ceoPortrait,
  storyHeading,
  storyParagraphs,
  philosophyHeading,
  vision,
  mission,
  values,
  goals,
}: {
  ceoEyebrow: string;
  ceoQuote: string;
  ceoCite: string;
  ceoPortrait: { id: string; url: string; alt: string } | null;
  storyHeading: string;
  storyParagraphs: string[];
  philosophyHeading: string;
  vision: string;
  mission: string;
  values: string;
  goals: string;
}) {
  const reduced = useReducedMotion();

  const pillars: Pillar[] = [
    { key: 'vision', label: 'Our Vision', icon: visionIcon, body: vision },
    { key: 'mission', label: 'Our Mission', icon: missionIcon, body: mission },
    { key: 'values', label: 'Our Values', icon: valuesIcon, body: values },
    { key: 'goals', label: 'Our Goals', icon: goalsIcon, body: goals },
  ];

  const [storyLeft, storyRight] = splitHeading(storyHeading);
  const [philosophyLeft, philosophyRight] = splitHeading(philosophyHeading);

  return (
    <div className="font-glory">
      <section className="py-8 md:py-12">
        <div className="container-x">
          <CeoWord
            eyebrow={ceoEyebrow}
            quote={ceoQuote}
            cite={ceoCite}
            portrait={ceoPortrait}
            reduced={reduced}
          />
        </div>
      </section>

      {/* The story card now folds behind "Read more", so it sits far shorter
          than the spacing here was tuned for. Tightening the seam between this
          section and the next closes the gap that would otherwise open up. */}
      <section className="pb-10 pt-20 md:pb-12 md:pt-28">
        <ParallaxHeading lineLeft={storyLeft} lineRight={storyRight} reduced={reduced} />
        <div className="container-x mt-10 md:mt-16">
          <TailoredStory heading={storyHeading} paragraphs={storyParagraphs} reduced={reduced} />
        </div>
      </section>

      <section className="pb-20 pt-10 md:pb-28 md:pt-12">
        <FadeInHeading
          lineLeft={philosophyLeft}
          lineRight={philosophyRight}
          reduced={reduced}
          centered
        />
        <div className="container-x mt-10 md:mt-16">
          <BrandPhilosophy heading={philosophyHeading} pillars={pillars} reduced={reduced} />
        </div>
      </section>
    </div>
  );
}
