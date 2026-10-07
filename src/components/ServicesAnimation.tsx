'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, type CSSProperties } from 'react';
import { gsap } from 'gsap';
import { pauseContextOffscreen } from '@/lib/pauseContextOffscreen';

import { SERVICE_ICONS } from '@/lib/serviceIcons';

// Services hero, rebuilt from the reference clip (1080x1920 portrait, 7.41s).
//
// Measured from 160 frames captured off the decoder. (Seeking by currentTime
// returns frame 0 forever on this file, so the frames had to be pulled during
// real playback via requestVideoFrameCallback.)
//
// GEOMETRY — nine icons on a ring around a centred label:
//   content box  x 116..973, y 761..1609  =>  858 x 848, centre (544, 1185)
//   ring radius  mean 385px across all nine  =  45% of the box
//   angular gaps 38.6 36.2 39.3 40.1 41.7 41.5 42.1 40.9  =>  mean 40.0deg,
//                which is exactly 360/9, so the ring is evenly divided.
//
// MOTION — the ring does NOT spin. That was the first hypothesis and the
// numbers killed it: each icon's radius holds to a std of ~15px, and the
// unwrapped angle oscillates +/-15deg with *zero net drift* over the full
// 7.4s. What actually moves is a spotlight: exactly one icon is enlarged at
// any moment, advancing clockwise from the top, ~0.95s per step.
//
// Highlight magnitude, read off slot 2 (top fingerprint — the only icon with
// no neighbour bleed in its sample window):
//   at rest      bbox 105 x 105   mean luma 170   area ~3775
//   highlighted  bbox 135 x 117   mean luma 223   area ~8434
//   => scale 135/105 = 1.29x, and the area ratio 2.23 ~= 1.29^2 confirms it
//      is a real scale rather than a brightness-only pulse.
//   => opacity tracks luma 170 -> 223, i.e. ~0.62 -> 1.0
//   => envelope: rise ~0.18s, hold ~0.45s, decay ~0.35s
//
// The centre label swaps in step with the spotlight. Its transition is a
// vertical slide + crossfade, not a plain fade: the text band grows from 43px
// (one settled line) to as much as 105px mid-transition, because the outgoing
// line is still leaving upward while the incoming one is still arriving from
// below. Both are on screen at once.
//
// The service links are real server-rendered markup that GSAP only ever
// transforms, so crawlers and no-JS visitors still get a crawlable link to all
// nine services.
//
// DEVIATION FROM THE CLIP (requested): the reference ring is static and only
// the spotlight travels. Here the whole ring also turns continuously — one
// unbroken rotation with no lap boundary to restart on. Each icon is
// counter-rotated by the same angle so the artwork stays upright instead of
// tumbling with the carrier.

/**
 * Ring radius as a share of the stage. Measured 385/858 = 45% in the clip, but
 * the icons here are ART_SCALE larger while the circle is not, so at 45% the
 * inner icons chew into the centre label (the play triangle overlapped it by
 * 217x30px). Pushing the ring out restores the clip's clearance between the
 * artwork and the text.
 */
const RADIUS_PCT = 52;

/**
 * Seconds between spotlight steps. Measured 0.95 in the clip, then slowed 25%
 * on request: 0.95 / 0.75 = 1.267.
 *
 * The slowdown is applied here rather than via timeScale so it flows through to
 * SPIN as well — the ring turn is derived from STEP, so both the spotlight and
 * the rotation slow by the same 25% and stay phase-locked (see SPIN). The
 * per-step tween durations (rise/hold/decay) are deliberately NOT scaled: those
 * are the measured pop envelope, and stretching them too would soften the
 * highlight rather than just spacing the steps further apart.
 */
const STEP = 1.267;

/**
 * Seconds for the ring to complete one full turn. Nine steps at STEP each is
 * one spotlight lap, so matching the two keeps the rotation phase-locked to
 * the highlight: every icon sits at the same point on the circle each time its
 * turn comes round.
 *
 * This sets the rotation's *rate* only — the rotation itself is continuous and
 * has no per-lap boundary (see the spin tween), so an imperfect match here
 * would read as slow drift rather than as a jump.
 */
const SPIN = STEP * 9;

/** Icon pop envelope: seconds to rise to PEAK_SCALE, and to fall back to rest. */
const RISE = 0.18;
const DECAY = 0.35;

/**
 * When an icon starts falling back, measured from its own pop. The envelope
 * ends RISE + hold + DECAY, and this is sized so the decay finishes exactly as
 * the next icon's rise completes — the spotlight is always on something, with
 * the brief two-lit overlap the reference clip shows at each handover.
 */
const DECAY_AT = STEP + RISE - DECAY;

/**
 * How far the label slide runs ahead of the icon pop it belongs to. The label
 * takes LABEL_SLIDE seconds to travel but the icon only 0.18s to rise, so
 * without a lead the text arrives well after the spotlight and each step
 * briefly shows the new icon beside the previous service's name.
 */
const LABEL_LEAD = 0.3;

/** Seconds each label's position slide (in or out) takes. */
const LABEL_SLIDE = 0.45;

/**
 * Seconds each label's opacity ramp takes — deliberately shorter than
 * LABEL_SLIDE. Position and opacity used to share one duration/ease pair, so
 * "sequential" was only ever true of the tweens' *start times*; power3 eases
 * spend a large share of LABEL_SLIDE near full opacity, so the outgoing label
 * stayed clearly readable well past the incoming label's scheduled start —
 * two lines legible at once despite the schedule never overlapping on paper.
 * Decoupling a short, steep fade from the slower slide means the readable
 * window (opacity) closes fast while the slide stays smooth, so "sequential"
 * can be enforced on the thing that's actually visible: opacity crossing to 0
 * before the next label's opacity leaves 0.
 */
const LABEL_FADE = 0.2;

/**
 * Seconds of dead air between one label's opacity reaching 0 and the next
 * label's opacity leaving 0. This is what actually keeps only one line
 * legible at a time now — LABEL_SLIDE's position tween is allowed to overlap
 * around this gap since an invisible label sliding is not visible.
 */
const LABEL_GAP = 0.08;

/** Resting / highlighted icon scale. Measured 105px -> 135px. */
const REST_SCALE = 1;
const PEAK_SCALE = 1.29;

/** Resting / highlighted opacity. Measured luma 170 -> 223. */
const REST_OPACITY = 0.62;

/**
 * A ring position. The artwork itself (src/aspect/fill) is NOT restated here —
 * it is looked up from SERVICE_ICONS by slug, which is what guarantees the icon
 * orbiting for a service is the same one on that service's card.
 *
 * `aspect` from that map is why the hit box is not a square: it used to be, for
 * every slot, which made the AI cluster (1.76:1) nearly unhoverable — its art
 * covered only the middle 60% of its own box height, leaving 20% dead strips
 * top and bottom that looked like empty space but were the only place a lot of
 * the pointer travel actually landed.
 */
type Slot = {
  /** Degrees clockwise from the +x axis, screen coords (y down), as measured. */
  angle: number;
  label: string;
  slug: keyof typeof SERVICE_ICONS;
  /** Artwork's longest side as a share of the stage, measured at rest. */
  art: number;
};

/**
 * Requested uplift on every icon over the size measured from the clip. The
 * `art` values below are the measured shares; this multiplies through in
 * slotBox so the measurements stay readable as measurements.
 *
 * 1.5 uplift, then trimmed 15%: 1.5 * 0.85 = 1.275.
 */
const ART_SCALE = 1.275;

/**
 * Breathing room reserved around the stage, as a share of its width. Icons
 * orbit at RADIUS_PCT and each carries half its own box beyond that, so artwork
 * overhangs the square stage on every side — measured at 205px on a 704px stage
 * (29%). A little over the measured worst case, to cover the spotlight's
 * PEAK_SCALE.
 *
 * This is reserved on BOTH axes now that the ring shares the hero with a copy
 * column. It used to only be reserved vertically, which was fine while the ring
 * was centred and alone: the horizontal overhang had the whole container to
 * spill into and nothing to collide with. In the two-column layout that spill
 * lands on the copy — at a full-column stage the AI cluster and the calendar
 * icon were drawn on top of the paragraph, and the ring's bottom overhang was
 * clipped by the section. See STAGE_PCT.
 */
const ORBIT_MARGIN = 16;

/**
 * The stage's width as a share of the column, sized so the stage PLUS its
 * overhang on both sides fits: the drawn extent is 1 + 2*(ORBIT_MARGIN/100)
 * stage widths, so the stage itself can be at most the reciprocal of that.
 * Derived rather than hardcoded so it tracks ORBIT_MARGIN if the artwork sizing
 * is ever retuned.
 */
const STAGE_PCT = 100 / (1 + (ORBIT_MARGIN * 2) / 100);

// Order is the spotlight order: clockwise starting at the top, which is where
// the clip begins ("Brand Identity" is the label on frame 0).
const SLOTS: Slot[] = [
  { angle: 270, label: 'Brand Identity', slug: 'brand-identity', art: 13 },
  { angle: 310, label: 'Interior Design', slug: 'interior-design', art: 13 },
  { angle: 350, label: 'Giveaways', slug: 'giveaways', art: 12 },
  { angle: 30, label: 'Printing & Production', slug: 'printing-production', art: 13 },
  { angle: 70, label: 'Event Planning', slug: 'event-planning', art: 13 },
  { angle: 110, label: 'AI & Motion Graphics', slug: 'ai-motion-graphics', art: 14 },
  { angle: 150, label: 'Video Production', slug: 'video-production', art: 11 },
  { angle: 190, label: 'Web & App Development', slug: 'web-app-development', art: 12 },
  { angle: 230, label: 'Social Media', slug: 'social-media', art: 14 },
];

/**
 * Extra hit area around the artwork, as a share of the artwork's own size.
 * Fitts's-law padding: the icons are small, moving, and the pointer is chasing
 * them, so landing exactly on the ink is harder here than on a static target.
 * 12% each side is enough to forgive a near miss without letting neighbouring
 * slots meet — the tightest gap on the ring is Brand Identity to Interior
 * Design, which still clears by a comfortable margin at this padding.
 */
const HIT_PAD = 0.12;

/**
 * Polar -> percentage box for one slot.
 *
 * The box takes the artwork's measured ASPECT, not a square. A square box is
 * only honest for an icon whose alpha bbox is square, and most of these are not
 * — the AI cluster is 1.76:1, so a square box put 20% of its height above the
 * art and 20% below, both dead. Sizing to the aspect means the box tracks the
 * ink on both axes and the padding below is the only slack.
 *
 * `art` is the artwork's LONGEST side, so it maps to width on a wide icon and
 * to height on a tall one; the other side is derived from the aspect. The
 * <Image> inside is scaled up by 1/fill to undo that file's transparent
 * padding, against whichever axis is the long one.
 */
function slotBox(slot: Slot) {
  const rad = (slot.angle * Math.PI) / 180;
  const cx = 50 + RADIUS_PCT * Math.cos(rad);
  const cy = 50 + RADIUS_PCT * Math.sin(rad);

  const { aspect } = SERVICE_ICONS[slot.slug];
  const long = slot.art * ART_SCALE * (1 + HIT_PAD * 2);
  const w = aspect >= 1 ? long : long * aspect;
  const h = aspect >= 1 ? long / aspect : long;

  return {
    left: `${cx - w / 2}%`,
    top: `${cy - h / 2}%`,
    width: `${w}%`,
    height: `${h}%`,
  };
}

export function ServicesAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const iconRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const uprightRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    const ring = ringRef.current;
    if (!container || !ring) return;

    const icons = iconRefs.current.filter((el): el is HTMLAnchorElement => el !== null);
    const uprights = uprightRefs.current.filter((el): el is HTMLDivElement => el !== null);
    const labels = labelRefs.current.filter((el): el is HTMLSpanElement => el !== null);
    if (icons.length !== SLOTS.length || labels.length !== SLOTS.length) return;

    // Reduced motion: settle on the first service and run no timeline at all —
    // including no ring spin, which is the one piece of motion here that never
    // stops on its own. The markup ships hidden so the entrance never flashes,
    // so the resting state has to be written out explicitly here.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(icons, { opacity: REST_OPACITY, scale: REST_SCALE });
      gsap.set(icons[0], { opacity: 1, scale: PEAK_SCALE });
      gsap.set(labels, { opacity: 0, yPercent: 0 });
      gsap.set(labels[0], { opacity: 1 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.set(icons, { opacity: REST_OPACITY, scale: REST_SCALE });
      gsap.set(labels, { opacity: 0, yPercent: 100 });

      // ── Ring spin ──────────────────────────────────────────────────────
      // The carrier turns forever; each icon's inner wrapper turns the other
      // way by the same amount, so the icons travel a circular path while the
      // artwork itself never tilts.
      //
      // This is driven off a single proxy angle rather than a `rotate: 360`
      // tween with `repeat: -1`. A repeating tween is not a continuous
      // rotation: it is a 0->360 ramp that is torn down and re-seeded at every
      // lap boundary, which is where the visible cut-and-restart came from.
      // Two separate repeating tweens (carrier and counter-rotation) also have
      // independent boundaries, so any frame lost at a wrap desynchronised them
      // and the artwork tilted.
      //
      // Instead one un-repeating tween runs the angle out over a long span and
      // a modifier wraps the *applied* value into 0..360. The tween's own
      // progress never resets, so there is no boundary to hitch on, and both
      // targets read from the same accumulating source and cannot drift apart.
      const spin = { angle: 0 };
      // Laps to schedule in one tween. Large enough that the tween's own end is
      // never reached in a session (at SPIN ~11.4s this is over 3 years), so
      // the only thing that ever runs is its uniform linear middle.
      const SPIN_LAPS = 1e7;
      const spinRing = gsap.to(spin, {
        angle: 360 * SPIN_LAPS,
        duration: SPIN * SPIN_LAPS,
        ease: 'none',
        onUpdate: () => {
          // gsap.utils.wrap keeps the number handed to the transform small and
          // bounded, so it never loses float precision the way a monotonically
          // growing angle eventually would.
          const a = gsap.utils.wrap(0, 360, spin.angle);
          gsap.set(ring, { rotate: a });
          gsap.set(uprights, { rotate: -a });
        },
      });

      const tl = gsap.timeline({ repeat: -1 });

      SLOTS.forEach((_, i) => {
        // Every step is shifted right by LABEL_LEAD so that pulling the label
        // cues back by that amount never lands on a negative time, which
        // GSAP would clamp to 0 and collapse the first handover.
        const at = i * STEP + LABEL_LEAD;
        const icon = icons[i];
        const label = labels[i];

        // ── Icon: rise, hold, decay ──────────────────────────────────────
        // Measured envelope was rise ~0.18s / hold ~0.45s / decay ~0.35s.
        // back.out gives the small overshoot visible as the area briefly
        // exceeding its plateau before settling.
        //
        // The rise and decay keep their measured durations at any STEP — they
        // are the pop itself, and stretching them would blunt it. Only the HOLD
        // scales with the step, via DECAY_AT: the decay used to start at a hard
        // 0.63, which was 0.18 rise + 0.45 hold against the original 0.95 step.
        // Left absolute, slowing the step to 1.267 would have parked every icon
        // at rest for 0.287s before the next one lit — a dead beat the faster
        // timing never had (at 0.95 the 0.98s envelope actually overlapped the
        // next step slightly). Holding the peak for the extra time instead
        // keeps the spotlight continuous, which is what the clip shows.
        tl.fromTo(
          icon,
          { scale: REST_SCALE, opacity: REST_OPACITY },
          { scale: PEAK_SCALE, opacity: 1, duration: RISE, ease: 'back.out(1.7)' },
          at,
        );
        tl.to(
          icon,
          { scale: REST_SCALE, opacity: REST_OPACITY, duration: DECAY, ease: 'power2.inOut' },
          at + DECAY_AT,
        );

        // ── Label: slide up through a fixed window ───────────────────────
        // Each label owns both halves of its own move — in from below, then
        // out through the top. Giving every line an explicit exit (rather
        // than having the next line reach back and clear the previous one) is
        // what keeps the loop seamless: on the timeline's wrap there is no
        // line left behind holding a stale opacity.
        //
        // Position and opacity are scheduled independently rather than as one
        // fromTo/to pair. The slide (yPercent) keeps its old, slower
        // LABEL_SLIDE timing so the motion still reads as a smooth rise/exit.
        // Opacity gets its own short LABEL_FADE ramp, and *that* is what's
        // actually kept sequential: this label's fade-out finishes LABEL_GAP
        // before the next label's fade-in starts, so there's a real window
        // where every label but one is fully transparent — not just a window
        // where their tweens don't share a start time. A translucent label
        // mid-slide is invisible, so letting position tweens run long or
        // overlap around the opacity boundary costs nothing visually.
        const entranceStart = at - LABEL_LEAD;
        const exitStart = at + STEP - LABEL_LEAD - LABEL_SLIDE - LABEL_GAP;
        const nextEntranceStart = entranceStart + STEP;

        tl.fromTo(
          label,
          { yPercent: 100 },
          { yPercent: 0, duration: LABEL_SLIDE, ease: 'power3.out' },
          entranceStart,
        );
        tl.to(
          label,
          { yPercent: -100, duration: LABEL_SLIDE, ease: 'power3.in' },
          exitStart,
        );
        tl.fromTo(
          label,
          { opacity: 0 },
          { opacity: 1, duration: LABEL_FADE, ease: 'power2.out' },
          entranceStart,
        );
        tl.to(
          label,
          { opacity: 0, duration: LABEL_FADE, ease: 'power2.in' },
          nextEntranceStart - LABEL_GAP - LABEL_FADE,
        );
      });

      // Pin the cycle length to exactly nine steps. The last label finishes
      // its exit LABEL_GAP before this instant — the same gap every handover
      // gets — and the repeat then restarts the first label's identical
      // entrance right on schedule, so the wrap is seamless and the loop
      // stays phase-locked to the icon ring.
      tl.set({}, {}, SLOTS.length * STEP);

      // ── Hover: freeze the ring and hold that icon's name ────────────────
      // Everything is paused rather than reset, so releasing the pointer
      // resumes from the exact angle and timeline position it stopped at
      // instead of snapping back to the top of the loop.
      const animations = [tl, spinRing];

      // Hover tweens are tracked so leave() can stop them: one still running
      // when the pointer leaves would keep pushing the hovered label/icon back
      // to its hover state after the timeline has taken over again.
      let hoverTweens: gsap.core.Tween[] = [];
      const killHover = () => {
        hoverTweens.forEach((t) => t.kill());
        hoverTweens = [];
      };

      // Which label / icon the timeline is showing at time t. These mirror the
      // schedule built above: label k is on screen from its entrance until its
      // exit slide starts, and icon k is lit from its pop until its decay.
      const labelShownAt = (k: number, t: number) =>
        t >= k * STEP && t < (k + 1) * STEP - LABEL_SLIDE - LABEL_GAP;
      const iconLitAt = (k: number, t: number) =>
        t >= k * STEP + LABEL_LEAD && t < k * STEP + LABEL_LEAD + DECAY_AT;

      const enter = (i: number) => {
        killHover();
        animations.forEach((a) => a.pause());
        // The paused timeline is still holding whatever the spotlight was
        // mid-way through, so the hovered icon is promoted and every other one
        // is pushed back to rest explicitly — otherwise a half-lit neighbour
        // stays lit underneath the hover.
        hoverTweens = [
          gsap.to(icons[i], { scale: PEAK_SCALE, opacity: 1, duration: 0.22, ease: 'power2.out' }),
          gsap.to(
            icons.filter((_, k) => k !== i),
            { scale: REST_SCALE, opacity: REST_OPACITY, duration: 0.22, ease: 'power2.out' },
          ),
          gsap.to(labels[i], { opacity: 1, yPercent: 0, duration: 0.22, ease: 'power2.out' }),
          gsap.to(
            labels.filter((_, k) => k !== i),
            { opacity: 0, duration: 0.22, ease: 'power2.out' },
          ),
        ];
      };

      const leave = () => {
        killHover();
        // Put every label and icon back to what the timeline shows at its
        // paused time. The hover left the hovered label centred and visible
        // (and its icon lit), and the timeline won't touch either again until
        // that service's own turn comes round — up to a full lap later — so
        // without this the hovered name sat in the middle while the next
        // labels slid in on top of it.
        const t = tl.time();
        labels.forEach((label, k) => {
          gsap.set(label, labelShownAt(k, t) ? { opacity: 1, yPercent: 0 } : { opacity: 0, yPercent: 100 });
        });
        icons.forEach((icon, k) => {
          gsap.set(
            icon,
            iconLitAt(k, t)
              ? { scale: PEAK_SCALE, opacity: 1 }
              : { scale: REST_SCALE, opacity: REST_OPACITY },
          );
        });
        // Hand control back to the timeline. invalidate() drops the tween
        // start values GSAP recorded before the hover overrode them, so the
        // remaining tweens animate from the state restored above rather than
        // jumping to a stale remembered one.
        tl.invalidate();
        animations.forEach((a) => a.resume());
      };

      icons.forEach((icon, i) => {
        icon.addEventListener('pointerenter', () => enter(i));
        icon.addEventListener('pointerleave', leave);
        // Keyboard parity: tabbing to an icon does the same thing as hovering,
        // so the name is reachable without a pointer.
        icon.addEventListener('focus', () => enter(i));
        icon.addEventListener('blur', leave);
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

  // The section keeps overflow-hidden: it is what stops the 120px-blurred glow
  // from bleeding over the header and the next section. The clipping that used
  // to cut the orbiting icons is fixed by giving the ring room instead — see
  // ORBIT_MARGIN on the stage below, which reserves that room in the layout so
  // no fixed padding here has to guess at it.
  return (
    // max-md:pb-8: the ring's aspect box already reserves ORBIT_MARGIN of empty
    // space below the artwork for the orbit overhang, so the section's own
    // pb-24 stacks on top of it and opens a ~145px void above the service
    // cards on a phone. Desktop keeps pb-24, where that breathing room reads
    // as deliberate rather than as a gap.
    <section ref={containerRef} className="relative overflow-hidden border-b border-white/10 pb-24 pt-36 max-md:pb-8 max-md:pt-24 md:pt-44">
      {/* Background glow — same treatment as PageShell so the services hero
          sits flush with every other inner page header. */}
      <div
        className="pointer-events-none absolute right-0 top-0 h-[30rem] w-[30rem] rounded-full opacity-30 blur-[120px]"
        style={{ background: 'radial-gradient(circle, #68cad6 0%, transparent 70%)' }}
        aria-hidden
      />

      <div className="container-x relative">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-white/40">
          <Link href="/" className="hover:text-white">Home</Link>
          <span className="flex items-center gap-2">
            <span aria-hidden>/</span>
            <Link href="/services" className="hover:text-white">Services</Link>
          </span>
        </nav>

        {/* Two-column hero, matching the Work hub: copy on the left, artwork on
            the right, stacking on small screens where neither half survives at
            half width. Same column ratio as WorkHero so the two hubs line up
            when you move between them. */}
        <div className="mt-8 grid items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-8">
          <div>
            {/* The H1 is visible again now that the ring shares the hero with a
                copy column rather than carrying it alone. */}
            <h1 className="mt-5 text-balance font-display text-4xl font-bold leading-[1.02] tracking-tight md:text-6xl">
              Our Services.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/70">
              More than a service provider — a universe built around your brand.
              We align creativity, innovation, and execution to keep your brand in motion,
              evolving, and ahead of the curve.
            </p>
          </div>

          {/* ── Animated ring ──
              A square stage so every slot keeps the polar position measured
              off the clip at any width. It runs wider than the 34rem the ring
              used to sit in because the icons are ART_SCALE bigger and the
              radius is pushed out to clear the label — at the old width the
              outermost artwork would sit on the stage edge.

              The slot boxes are percentages of this stage, and at RADIUS_PCT
              52 the outermost artwork reaches ~29% of the stage width past its
              own box on every side, so the stage can never be full-bleed or the
              orbit is cut off by the section.

              Sizing is now column-relative rather than the old `68vw`: in the
              two-column layout this box only owns the right column, so a
              viewport-width cap would overflow it — at md the column is already
              narrower than 68vw. It takes STAGE_PCT of the column so that the
              stage plus its overhang exactly fills the column and no artwork is
              drawn over the copy beside it.

              The overhang is reserved by making this box taller than it is
              wide (aspect-ratio below) and letting the square ring sit inside
              it. Padding/margin percentages would not work: they resolve
              against the PARENT's width, which stops tracking the stage as
              soon as the max-w ceiling takes over. An aspect-ratio is defined
              by this element's own width, so the reserved space scales with the
              ring at every breakpoint. */}
          {/* Below md the grid is stacked, so this column is the full container
              and there is no copy beside the ring for the overhang to land on —
              it can spill into the page gutters as it always did, and holding it
              to STAGE_PCT there would only shrink the artwork for no reason. The
              STAGE_PCT reserve is therefore applied from md up, where the ring
              actually has a neighbour. */}
          <div className="flex justify-center md:justify-end md:pr-4 lg:pr-8">
            <div
              // max-md:w-[86%]: below md the ring is allowed to overhang into
              // the page gutters (see the note above), but at 320-430px those
              // gutters are the whole margin — the outermost icons ended up
              // touching both screen edges. Insetting the stage keeps the same
              // composition with room around it.
              className="relative w-full max-w-[34rem] max-md:w-[86%] md:w-[var(--stage-w)]"
              style={
                {
                  '--stage-w': `${STAGE_PCT}%`,
                  aspectRatio: `100 / ${100 + ORBIT_MARGIN * 2}`,
                } as CSSProperties
              }
            >
            {/* Rotating carrier. Holds every slot at its measured polar
                position and turns as one, which is what sweeps the icons
                around the circular path.

                It has to be an explicit centred SQUARE, not inset-0: the outer
                box is deliberately taller than it is wide to reserve the
                overhang, and every slot position is a percentage of a square.
                Stretching the carrier to a non-square parent would turn the
                circle into an ellipse. */}
            <div
              ref={ringRef}
              className="absolute left-1/2 top-1/2 aspect-square w-full -translate-x-1/2 -translate-y-1/2 will-change-transform"
            >
              {/* No CSS hover/transition on the links' opacity: GSAP owns each
                  icon's opacity and scale, and a competing CSS transition
                  would fight the tween and leave icons stuck part-lit. The
                  hover state is driven from the timeline instead. */}
              {SLOTS.map((slot, i) => (
                <Link
                  key={slot.slug}
                  href={`/services/${slot.slug}`}
                  ref={(el) => {
                    iconRefs.current[i] = el;
                  }}
                  className="absolute cursor-pointer rounded-xl opacity-0 will-change-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-glow"
                  style={{ ...slotBox(slot), transformOrigin: 'center center' }}
                >
                  {/* Counter-rotation lives on its own wrapper because the
                      link element is already carrying the spotlight's scale —
                      GSAP would overwrite one with the other if both tweens
                      targeted the same node. */}
                  <div
                    ref={(el) => {
                      uprightRefs.current[i] = el;
                    }}
                    className="h-full w-full will-change-transform"
                  >
                    {/* The link is sized to the artwork plus HIT_PAD; the image
                        is grown back out around it to cancel this file's
                        transparent padding, then divided by the same pad so the
                        artwork still renders at `art` and only the hit area
                        grew. Sizing the link to the padded canvas instead would
                        leave the widest icons (the play triangle carries 4.7x
                        its own art in padding) with hit targets that overlap
                        their neighbours' and swallow their clicks.

                        The scale is applied to the axis the canvas is square
                        against — the box is now the artwork's aspect, so
                        letting object-contain fit a square canvas into it would
                        letterbox the art and shrink it on the short axis.

                        pointer-events-none is load-bearing, not tidiness. The
                        image is deliberately grown past its own link to cancel
                        the file's transparent padding, so it overflows onto the
                        neighbouring slots — the play triangle renders 491x464
                        around 106x122 of link. Left hittable, that transparent
                        rectangle sat on top of its neighbours and ate their
                        pointer events: it was covering 98% of the AI cluster,
                        which is what made that icon feel like it was all dead
                        spots. The <a> is sized to the artwork and is the honest
                        target, so the art itself never needs to be hittable. */}
                    <Image
                      src={SERVICE_ICONS[slot.slug].src}
                      alt={slot.label}
                      className="pointer-events-none absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 select-none"
                      style={
                        SERVICE_ICONS[slot.slug].aspect >= 1
                          ? { width: `${100 / SERVICE_ICONS[slot.slug].fillX / (1 + HIT_PAD * 2)}%`, height: 'auto' }
                          : { height: `${100 / SERVICE_ICONS[slot.slug].fillY / (1 + HIT_PAD * 2)}%`, width: 'auto' }
                      }
                      priority={i < 3}
                    />
                  </div>
                </Link>
              ))}
            </div>

            {/* Centre label — one absolutely-stacked line per service, clipped
                so the slide reads as text moving through a window rather than
                drifting over the ring. */}
            {/* 56% is the label's share of the box in the reference (its
                longest line measured 478px across an 858px stage), which also
                keeps the text clear of the side icons. */}
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 z-10 w-[56%] -translate-x-1/2 -translate-y-1/2 overflow-hidden text-center"
              aria-hidden
            >
              {/* A spacer copy of the longest label reserves the line box so
                  the absolutely-positioned lines have something to sit in and
                  the height never jumps between services. */}
              <span className="invisible block font-display text-lg font-semibold md:text-2xl">
                Web &amp; App Development
              </span>
              {SLOTS.map((slot, i) => (
                <span
                  key={slot.slug}
                  ref={(el) => {
                    labelRefs.current[i] = el;
                  }}
                  className="absolute inset-0 flex items-center justify-center text-balance font-display text-lg font-semibold text-white opacity-0 will-change-transform md:text-2xl"
                >
                  {slot.label}
                </span>
              ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
