'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Elenor — About hero
//
// A magnifying glass sweeps once across the "About us" wordmark while a set of
// isometric desk props flies in from the right and settles.
//
// Every constant below was measured off the reference clip rather than guessed.
// Method: 126 frames pulled through Edge (Playwright's Chromium has no H.264
// decoder and its bundled ffmpeg only demuxes matroska/webm), then read
// numerically — connected-component labelling for the lens ring and each prop,
// per-row run-length scans for the glyph strokes.
//
// Source clip: 1920×500, 11.05s, background #26343C.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The clip composes every asset at one uniform scale. Six props, measured
 * independently, all landed on the same number:
 *
 *   scroll   194.6×108.2 predicted vs 194×109 measured
 *   phone    141.8× 86.6 predicted vs 142× 86 measured
 *   notebook  98.9× 68.6 predicted vs  99× 69 measured
 *   card      80.4× 48.2 predicted vs  79× 49 measured
 *   pen       57.4× 36.0 predicted vs  58× 36 measured
 *   mouse     31.9× 23.0 predicted vs  32× 22 measured
 *
 * The loupe (0.2374) and the wordmark (522×98 measured vs 522.7×98.9 predicted)
 * agree, so the whole banner is one 0.24 composition.
 */

/** Reference frame the measurements live in. Everything is expressed as a % of this. */
const STAGE_W = 1920;
const STAGE_H = 500;

/**
 * Lens sweep. Fitted jointly over the full clip (period, phase, both endpoints)
 * against a sine ease-in-out: mean absolute error 6.06px.
 *
 * A linear ramp gives 33.3px and a plain cosine 23.0px over the same points, so
 * the endpoint easing is real and worth keeping.
 *
 * The clip oscillates; this hero crosses the word once, so SWEEP_PERIOD is the
 * duration of that single pass — half the fitted round-trip period, which keeps
 * the stroke at the clip's speed rather than dragging one pass out over the
 * time two used to take.
 */
/* How far past each end of the word the lens turns, so the whole string gets
   crossed rather than the sweep stopping on the final glyph. The reference clip
   overshoots ~25 stage px against an 87px glass radius; holding it as that
   ratio keeps the margin proportional as the lens scales. The endpoints
   themselves are measured off the rendered ink each layout — see the measure
   effect below — since the type is a fixed px size and the stage is not. */
const SWEEP_OVERSHOOT = 25 / 87;
const SWEEP_PERIOD = 1.99;

/* Fallbacks for the first frames, before the measure effect has run. These are
   the values measured at the 1920 reference width; they are replaced as soon as
   the wordmark has been laid out. */
const SWEEP_LEFT_FALLBACK = 490;
const SWEEP_RIGHT_FALLBACK = 810;

/**
 * The lens's baseline while it works the wordmark — cy measured 219.0 in every
 * single frame of the clip with zero drift, and the ring radius held 100.0–100.5
 * throughout: pure horizontal motion at constant size.
 *
 * Offset from that measured baseline in stage-height steps: lifted 20% (100 of
 * 500 stage px) to 119, then lowered 10% (50 px) to 169.
 *
 * This is the *starting* height only. After the rest-ease the lens leaves the
 * word and flies to (LENS_PARK_X, LENS_PARK_Y), so its y and scale are both
 * animated from there — see the join phase in the rAF loop. globals.css no
 * longer inlines this number: the plane offset and the wordmark's mask hole
 * both read --lens-y, which the loop writes per frame.
 *
 * Now only a SEED. The baseline is measured off the rendered letters in the
 * measure effect (lensCyRef) because the fitted value assumed type that scaled
 * with the stage, which .about-hero__wordtext no longer does — so a fixed
 * stage-px height drifts off the letters as the viewport changes. This value
 * still covers the frames before the first measurement lands.
 */
const LENS_CY = 169;

/**
 * How far the whole loupe is scaled down from the clip's composition. At 1 the
 * ring is 200 stage px across — noticeably bigger than every prop on the right,
 * where the largest (icon-04) is 224 wide overall and most sit at 130–195. 0.72
 * lands the ring at 144, so the lens reads as one more object at that scale
 * rather than the one oversized element on the stage.
 *
 * Everything downstream — the loupe image box, the glass radius, the mask hole
 * cut in the base wordmark, the magnifier's inner plane — derives from this, so
 * the lens stays self-consistent at any value.
 */
const LENS_SCALE = 0.72;

/** The loupe's geometry at scale 1, so the join phase can rebuild every derived
 *  number at whatever scale a given frame is at. The constants below are these
 *  times LENS_SCALE — the values the lens holds until it leaves the word. */
const LOUPE_W_UNIT = 252;
const LOUPE_H_UNIT = 396.72;
const GLASS_R_UNIT = 87;

const LENS_R = 100 * LENS_SCALE;

/** Glass radius. The white ring runs r=87→100 at full size, feathering out by
 *  r=104; scaled with the rest of the loupe. */
const GLASS_R = GLASS_R_UNIT * LENS_SCALE;

/**
 * Entry: the lens enters from off-stage right (x≈1900 at t≈0.19), decelerates
 * leftward and reaches the left extreme x=488 at t≈1.08, where the steady
 * oscillation takes over.
 */
const LENS_ENTER_FROM = 1990;
const LENS_ENTER_DUR = 1.08;

/** The loupe's full image box at 0.24 (opaque ring measured 226×357). The ring
 *  centre sits LOUPE_RING_CY down from the image's top edge. */
const LOUPE_W = LOUPE_W_UNIT * LENS_SCALE;
const LOUPE_H = LOUPE_H_UNIT * LENS_SCALE;
const LOUPE_RING_CX = 106.32 * LENS_SCALE;
const LOUPE_RING_CY = 119.88 * LENS_SCALE;

/** The loupe PNG's intrinsic box, for next/image's aspect hint only — the
 *  rendered size comes from --lens-w, so this is independent of LENS_SCALE. */
const LOUPE_INTRINSIC_W = 252;
const LOUPE_INTRINSIC_H = 397;

/**
 * Props, as full-image boxes in stage coordinates.
 *
 * The measurements were taken off each asset's *opaque* bounding box, but the
 * PNGs carry transparent padding, so positioning by those numbers would shift
 * every prop. `x`/`y`/`w`/`h` below are the whole image placed so its opaque
 * region lands on the measured slot — i.e. slot minus the asset's own opaque
 * offset, all at the 0.24 composition scale.
 *
 * Each enters from off-stage right at a fixed y — there is no vertical motion
 * anywhere — overshoots its slot by a few px and settles back, so the entry
 * carries a small back-ease. `delay` is when the prop first appears, `settle`
 * when it stops moving.
 */
const PROPS = [
  { src: '/assets/about-hero/icon-04.png', x: 1082.88, y: 68.92, w: 224.16, h: 218.88, delay: 0.56, settle: 1.1 },
  { src: '/assets/about-hero/icon-07.png', x: 1220.0, y: 128.96, w: 195.6, h: 206.88, delay: 0.72, settle: 1.4 },
  { src: '/assets/about-hero/icon-02.png', x: 1140.72, y: 214.8, w: 135.12, h: 159.84, delay: 0.8, settle: 1.52 },
  { src: '/assets/about-hero/icon-05.png', x: 1249.8, y: 79.12, w: 133.44, h: 138.24, delay: 0.96, settle: 1.64 },
  { src: '/assets/about-hero/icon-06.png', x: 1286.16, y: 155.72, w: 157.44, h: 93.12, delay: 1.14, settle: 1.8 },
  { src: '/assets/about-hero/icon-08.png', x: 1252.04, y: 258.36, w: 68.16, h: 72.0, delay: 1.2, settle: 1.92 },
] as const;

/** Wordmark. Opaque art measured at x 437→1005, y 166→263; this is its full
 *  image box, padding included, so the art lands exactly there.
 *
 *  The source art set "Aboutus" solid, with only the normal 56px letter gap
 *  between the "t" and the "u". A word space was cut in at that gap (+190px in
 *  image space, giving 246px), widening the art 2294→2484px. The composition
 *  scale is unchanged, so only the width grows: 550.56 * 2484/2294 = 596.16.
 *  Still clears the props, which start at x=1082.
 *
 *  Changing the space means rebuilding both PNGs and updating, together: this
 *  w, the --hole-* divisors in .about-hero__word--thin, and the wordmark
 *  aspect-ratio — all three carry the image width. */
const WORD = { x: 428.84, y: 139.6, w: 596.16, h: 159.84 };

/** Seeds for the parked positions, used until the measure effect replaces them
 *  with values read off the rendered text: mid-word when motion is reduced,
 *  centred on "us" otherwise. Both were measured at the 1920 reference width. */
const REDUCED_X = 637;
const LENS_REST_X = 739.28;

/** How long the ease from the sweep's right endpoint to LENS_REST_X takes. */
const LENS_REST_DUR = 0.6;

/** One left-to-right sweep after the entrance, then the rest-ease. */
const SWEEP_END = LENS_ENTER_DUR + SWEEP_PERIOD;
const REST_END = SWEEP_END + LENS_REST_DUR;

/**
 * The join: rather than stopping on "us", the lens carries on to the right and
 * settles into the prop cluster at their scale, so it resolves as one more
 * object in that group instead of a control left sitting on the word.
 *
 * The end scale is derived, not eyeballed. The loupe's opaque ink is 954 of its
 * 1050px canvas, so the ring measures LOUPE_W * 954/1050 = 164.85 stage px
 * across at LENS_SCALE. 95 lands it between icon-02 (ink 98.9 wide) and icon-05
 * (80.4) — a peer of the mid-size props. Expressed as a ratio so it survives a
 * change to LENS_SCALE.
 */
const LENS_SCALE_END = LENS_SCALE * (95 / 164.85);

/** Where it parks: against the cluster's right edge, at its vertical centre.
 *
 *  Measured on the props' *ink*, not their image boxes — the PNGs carry a lot
 *  of transparent padding, so the boxes run to x=1444 while the visible art
 *  stops at 1380 (y 124→315, centre 220). Parking against the box edge left the
 *  lens floating in its own pocket of empty space, clearly beside the group
 *  rather than in it.
 *
 *  The ring's own ink is 95 wide, so 1444 puts a 16px gap between it and
 *  icon-07 — the same spacing the cluster already uses internally (icon-02 to
 *  icon-08 is 14px; several others overlap), so the lens reads as one more
 *  member rather than a straggler. */
const LENS_PARK_X = 1444;
const LENS_PARK_Y = 220;

/** ~660 stage px/s over the 797px flight — the speed of the sweep's mid-stroke,
 *  so the departure reads as continuous with the motion before it. */
const LENS_JOIN_DUR = 1.2;
const JOIN_END = REST_END + LENS_JOIN_DUR;

/** How far off its slot each prop starts, in stage px. */
const PROP_TRAVEL = 760;

const pctW = (v: number) => `${(v / STAGE_W) * 100}%`;
const pctH = (v: number) => `${(v / STAGE_H) * 100}%`;

/** The wordmark's visible copy. Fixed rather than driven by the CMS title:
 *  every measurement above (WORD box, lens sweep endpoints, the word-space
 *  cut) was fitted to this exact string. `title` is real page content and
 *  still carries the accessible name via `alt` below. */
const WORDMARK_TEXT = 'About us';

/** font-size, as a fraction of stage width, that makes "About us" in
 *  font-display (Sora) Bold fill the WORD box (596.16 / 1920 = 31.05% of the
 *  stage) — measured against the rendered glyph width, not guessed.
 *
 *  Desktop does not use this: .about-hero__wordtext is a fixed px step there
 *  (45 -> 75 at md) so the two hero headings match in size, which means the
 *  word shrinks relative to the stage as the viewport widens — hence the
 *  runtime ink measurement below. mobile.css DOES use it, as
 *  `calc(6.92 * 1.6vw)`, because a phone needs the word in proportion to the
 *  composition more than it needs it matching a heading it cannot see. Keep
 *  the two in step if this number ever changes. */
const WORDTEXT_VW = 6.92;

/** Peak scale a glyph reaches when the lens is centred exactly on it — "100%
 *  bigger" i.e. double size. Falls off to 1 at the glass rim (see below),
 *  so only the letter under the glass swells rather than the whole word. */
const GLYPH_MAG_PEAK = 2;

/** Distance over which a glyph's magnification falls from GLYPH_MAG_PEAK back
 *  to 1, as a fraction of the glass radius. Tied to that radius so the falloff
 *  finishes at the rim: a glyph is at full size by the time it leaves the disc,
 *  and no letter is caught mid-swell outside the glass. At the original
 *  full-size loupe this was 70, i.e. ~0.8 of the 87px glass radius.
 *
 *  A ratio rather than a fixed distance because the glass shrinks during the
 *  join — frozen at the full-size 50.1px it would still be swelling letters
 *  50px out while the rim had closed to 29px, which is exactly the mid-swell
 *  glyph outside the disc this is meant to prevent. The loop multiplies it by
 *  whatever radius the current frame is at. */
const GLYPH_MAG_RANGE_OF_R = 0.8;

/**
 * Writes the lens's whole geometry from one position and scale.
 *
 * Everything the CSS needs falls out of (x, y, s), but it has to fall out
 * *together*: the loupe box, the glass circle, the stage-sized plane inside it
 * and the hole cut in the base wordmark are one system, and if any frame writes
 * a radius that disagrees with its plane offset the magnified copy visibly
 * detaches from the letters underneath. Both callers — the rAF tick and the
 * reduced-motion branch — go through here so they cannot drift apart.
 *
 * Not written here, because they are pure ratios and identical at every scale:
 * --ring-cx (106.32/252), --ring-cy (119.88/396.72) and --glass-of-loupe
 * (174/252). They stay on the element's inline style.
 *
 * Returns the frame's glass radius, which the caller needs for the glyph
 * falloff above.
 */
const writeLens = (el: HTMLElement, x: number, y: number, s: number) => {
  const loupeW = LOUPE_W_UNIT * s;
  const glassR = GLASS_R_UNIT * s;
  el.style.setProperty('--lens-x', String(x));
  // Unitless stage px, not a percentage: globals.css does arithmetic with this
  // (the plane offset and the mask hole both subtract it from a stage-space
  // constant), which a percentage cannot participate in.
  el.style.setProperty('--lens-y', String(y));
  el.style.setProperty('--lens-w', pctW(loupeW));
  el.style.setProperty('--loupe-w', String(loupeW));
  el.style.setProperty('--glass-r', String(glassR));
  // The plane is this wide as a % of the glass, and the glass is 2R stage px —
  // so the plane always renders exactly one stage across, whatever R is. That
  // identity is what keeps the magnified copy pixel-on-pixel over the base one,
  // so it has to be recomputed as R shrinks rather than held.
  el.style.setProperty('--stage-of-glass', `${(STAGE_W / (glassR * 2)) * 100}%`);
  return glassR;
};

export function AboutHero({ title }: { title: string }) {
  const [reduced, setReduced] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const glyphRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const glyphCentersRef = useRef<number[]>([]);
  // Sweep endpoints and park positions, in stage px, measured off the rendered
  // wordmark. Refs rather than state: the rAF loop reads them per frame and a
  // re-render would restart the animation.
  const sweepRef = useRef({ left: SWEEP_LEFT_FALLBACK, right: SWEEP_RIGHT_FALLBACK });
  const restRef = useRef(LENS_REST_X);
  const reducedRef = useRef(REDUCED_X);
  // The lens's baseline over the word, measured off the rendered letters. Seeded
  // with the reference-frame constant for the frames before the first measure.
  const lensCyRef = useRef(LENS_CY);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Each glyph's centre, in stage px, so the rAF tick can tell which letter
  // the lens is over. The plane is exactly one stage-width wide (see
  // .about-hero__plane), so a glyph's offset within it converts to stage px
  // by the same ratio as its own rendered width does.
  //
  // This also derives where the lens turns and parks. Those used to be
  // constants fitted against the 1920-wide reference frame, which only held
  // while the type scaled with the viewport. The wordmark now steps 36 -> 60px
  // at the md breakpoint to match the "Our Services." h1 exactly (see
  // .about-hero__wordtext), so above that breakpoint the text is a fixed pixel
  // size while the stage keeps growing with vw — the word occupies fewer and
  // fewer stage px as the viewport widens. Measuring the rendered ink each time
  // keeps the sweep and the park locked to the letters at every width.
  useEffect(() => {
    const measure = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const sb = stage.getBoundingClientRect();
      if (!sb.width) return;

      // Measure in viewport space against the stage box. offsetLeft is not
      // usable here: the glyph spans' offsetParent is the wordmark span (it is
      // positioned), not the plane, so their offsets are relative to the word's
      // own box rather than to stage coordinates — and the plane additionally
      // carries a --lens-x translate. getBoundingClientRect is unambiguous, and
      // the glyphs' own scale transforms do not disturb the centres they are
      // applied around.
      const toStage = (clientX: number) => ((clientX - sb.left) / sb.width) * STAGE_W;
      // Vertical counterpart. The stage box is 500 stage px tall by its
      // aspect-ratio, so screen y maps back through its own height.
      const toStageY = (clientY: number) => ((clientY - sb.top) / sb.height) * STAGE_H;

      const boxes = glyphRefs.current.map((g) => g?.getBoundingClientRect() ?? null);
      glyphCentersRef.current = boxes.map((r) => (r ? toStage(r.left + r.width / 2) : 0));

      // The lens's vertical centre, measured off the letters rather than held as
      // a constant.
      //
      // LENS_CY = 169 was fitted against the reference frame, where the type
      // scaled with the stage. It no longer does — .about-hero__wordtext is a
      // fixed px size — so the letters' position *within* the stage drifts with
      // the viewport and a fixed stage-px baseline slowly leaves them. Measured:
      // the glass centre sat 15.4px above the letters' middle at 1440 and 12.0px
      // above at 390, where the glass (40.8px) is barely wider than the ink is
      // tall (43.1px) and the miss is obvious.
      //
      // Deriving it from the rendered ink centres the glass on the letters at
      // every width, on the same measurement pass that already places the sweep.
      // Only glyphs that actually carry ink count: the space is a zero-height box
      // whose top/bottom would drag the midpoint toward the text baseline.
      const inked = boxes.filter((r): r is DOMRect => !!r && r.height > 0);
      if (inked.length) {
        const inkTop = Math.min(...inked.map((r) => r.top));
        const inkBottom = Math.max(...inked.map((r) => r.bottom));
        lensCyRef.current = toStageY((inkTop + inkBottom) / 2);
      }

      // Ink extent of the whole word, from the first glyph's left edge to the
      // last one's right edge.
      const first = boxes[0];
      const last = boxes[boxes.length - 1];
      if (!first || !last) return;
      const inkL = toStage(first.left);
      const inkR = toStage(last.right);

      // The sweep starts a little before the first glyph and turns the same
      // margin past the last, so the whole word gets crossed — the reference
      // clip's ~25px overshoot, held as a fraction of the glass so it stays
      // proportional as the lens scales.
      const overshoot = GLASS_R * SWEEP_OVERSHOOT;
      sweepRef.current = { left: inkL - overshoot, right: inkR + overshoot };

      // Park centred on the trailing word ("us"): from the glyph after the
      // last space through the end.
      const spaceAt = WORDMARK_TEXT.lastIndexOf(' ');
      const tailFirst = boxes[spaceAt + 1];
      restRef.current = tailFirst ? (toStage(tailFirst.left) + inkR) / 2 : (inkL + inkR) / 2;

      // Reduced motion parks mid-word rather than on the tail, so the lens
      // reads as caught mid-sweep instead of finished.
      reducedRef.current = (inkL + inkR) / 2;
    };

    // Web fonts land after first paint and change every number above, so
    // re-measure once they settle. Sora is what the wordmark is set in; until
    // it resolves the fallback metrics would park the lens off the letters.
    measure();
    document.fonts?.ready.then(measure).catch(() => {});
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // The lens runs on rAF rather than a CSS keyframe loop: the sweep is a sine
  // ease-in-out between two fixed endpoints, which no single cubic-bezier can
  // express.
  //
  // It flies in, crosses the word exactly once left-to-right, eases back to
  // rest on "us", then leaves the word and settles into the prop cluster at
  // their scale, where the loop ends — no more per-frame work.
  //
  // Through the first three phases only custom properties feeding transforms
  // change, so those stay on the compositor. The join phase also animates
  // --lens-w, which is a real width on .about-hero__lens and so costs a layout
  // per frame. That is unavoidable rather than careless: the glass's mask
  // radius and the inner plane's width are layout-level whatever we do, so the
  // shrink cannot be expressed as a pure transform without splitting the
  // geometry across two mechanisms that would then have to be kept in sync. It
  // is one absolutely-positioned image on an isolated subtree for 1.2s.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    if (reduced) {
      // `reduced` starts false, so this effect has already run once and written
      // an entry-phase geometry straight onto the element. An inline style prop
      // cannot take that back — same element, same property — so the park
      // position has to be written here explicitly. Without it the lens keeps
      // whichever x the one frame that ran left behind (~1926, off-stage right
      // from LENS_ENTER_FROM) and is simply not visible.
      //
      // The whole set, not just x: that first frame may have written a y and a
      // scale too, and a stale one of those would park the lens off its
      // baseline or at the wrong size.
      writeLens(el, reducedRef.current, lensCyRef.current, LENS_SCALE);
      return;
    }

    const start = performance.now();
    // Where the join phase departs from. Snapshotted on the frame it begins
    // rather than read live: the measure effect rewrites restRef when fonts
    // land or the window resizes, and a resize mid-flight would otherwise move
    // the departure point under the interpolation and teleport the lens.
    let joinFrom: number | null = null;

    const tick = (now: number) => {
      const t = (now - start) / 1000;
      // Measured off the rendered letters, so read per frame alongside the
      // sweep endpoints — fonts landing or a resize moves it.
      const lensCy = lensCyRef.current;
      let x: number;
      // y and scale only change in the join phase; every earlier phase holds
      // the baseline, so the lens behaves exactly as it did before.
      let y = lensCy;
      let s = LENS_SCALE;
      let done = false;

      // Read per frame rather than captured: the measure effect rewrites these
      // when fonts land or the window resizes, and the sweep should follow.
      const { left: sweepLeft, right: sweepRight } = sweepRef.current;
      const restX = restRef.current;

      if (t < LENS_ENTER_DUR) {
        const p = t / LENS_ENTER_DUR;
        x = LENS_ENTER_FROM + (sweepLeft - LENS_ENTER_FROM) * (1 - Math.pow(1 - p, 3));
      } else if (t < SWEEP_END) {
        // Phase anchored so the sweep departs the left endpoint exactly where
        // the run-in dropped it, and crosses to the right endpoint once.
        const u = (t - LENS_ENTER_DUR) / SWEEP_PERIOD;
        const e = 0.5 - 0.5 * Math.cos(Math.PI * u);
        x = sweepLeft + (sweepRight - sweepLeft) * e;
      } else if (t < REST_END) {
        // Departs the right endpoint, where the single pass ended, so the lens
        // eases back onto "us" rather than jumping across the word.
        const p = (t - SWEEP_END) / LENS_REST_DUR;
        const e = 0.5 - 0.5 * Math.cos(Math.PI * p);
        x = sweepRight + (restX - sweepRight) * e;
      } else if (t < JOIN_END) {
        if (joinFrom === null) joinFrom = restX;
        const p = (t - REST_END) / LENS_JOIN_DUR;
        // easeOutCubic, not the sine ease-in-out the phases above use. The
        // rest-ease has already brought the lens to a full stop, so a curve
        // that also starts at zero velocity would read as two separate motions
        // with a dead beat between them; cubic-out departs briskly and settles
        // soft. Position and scale share the one curve — driving them on
        // different easings makes an object look puppeteered rather than
        // travelling.
        const e = 1 - Math.pow(1 - p, 3);
        x = joinFrom + (LENS_PARK_X - joinFrom) * e;
        y = lensCy + (LENS_PARK_Y - lensCy) * e;
        s = LENS_SCALE + (LENS_SCALE_END - LENS_SCALE) * e;
      } else {
        x = LENS_PARK_X;
        y = LENS_PARK_Y;
        s = LENS_SCALE_END;
        done = true;
      }

      const glassR = writeLens(el, x, y, s);

      // Magnify whichever glyph the lens centre currently sits over. A cosine
      // falloff keeps exactly one letter (two, briefly, at a handover) swelling
      // at a time, cheaply — direct style writes rather than React state,
      // matching the lens position above. The range is derived from this
      // frame's glass radius, so the falloff keeps finishing at the rim as the
      // glass shrinks through the join.
      const range = glassR * GLYPH_MAG_RANGE_OF_R;
      const centers = glyphCentersRef.current;
      for (let i = 0; i < centers.length; i += 1) {
        const glyph = glyphRefs.current[i];
        if (!glyph) continue;
        const d = Math.min(Math.abs(x - centers[i]), range);
        const e = 0.5 + 0.5 * Math.cos((d / range) * Math.PI);
        const scale = 1 + (GLYPH_MAG_PEAK - 1) * e;
        glyph.style.transform = `scale(${scale})`;
      }

      if (!done) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [reduced]);

  return (
    <div className="about-hero" data-reduced={reduced ? '' : undefined}>
      {/* Recolours the loupe PNG (a white outline on transparent) to the site's
          cyan — see .about-hero__loupe in globals.css, which references this
          filter by id. The constants are --color-brand-glow (#68cad6 = rgb
          104/202/214) as 0..1 channels; that is the cyan the rest of the site
          runs on (text-brand-glow, focus rings, the services hero glow), so the
          lens matches it rather than the accent-only --color-brand-cyan.
          A 0x0 SVG so it contributes nothing to layout; only its <filter> is
          used. */}
      <svg width="0" height="0" aria-hidden style={{ position: 'absolute' }}>
        <filter id="about-loupe-tint" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.4078
                    0 0 0 0 0.7922
                    0 0 0 0 0.8392
                    0 0 0 1 0"
          />
        </filter>
      </svg>
      <div
        ref={stageRef}
        className="about-hero__stage"
        style={{
          ['--wordtext-vw' as string]: `${WORDTEXT_VW}vw`,
          ['--ring-cx' as string]: `${(LOUPE_RING_CX / LOUPE_W) * 100}%`,
          ['--ring-cy' as string]: `${(LOUPE_RING_CY / LOUPE_H) * 100}%`,
          ['--glass-d' as string]: pctW(GLASS_R * 2),
          // The glass disc as a fraction of the loupe box: a ratio of two
          // numbers that both carry LENS_SCALE, so it is the same at every
          // scale and is the one geometry property the join phase never
          // rewrites — same reason --ring-cx/--ring-cy stay here too.
          ['--glass-of-loupe' as string]: `${((GLASS_R * 2) / LOUPE_W) * 100}%`,
          // Seeds only — writeLens overwrites all of these on the first frame
          // after layout, from the rAF loop or the reduced-motion branch. They
          // matter for the frame before that one lands.
          ['--lens-w' as string]: pctW(LOUPE_W),
          ['--stage-of-glass' as string]: `${(STAGE_W / (GLASS_R * 2)) * 100}%`,
          ['--glass-r' as string]: String(GLASS_R),
          ['--loupe-w' as string]: String(LOUPE_W),
          ['--lens-y' as string]: String(LENS_CY),
          ['--lens-x' as string]: reduced ? REDUCED_X : SWEEP_LEFT_FALLBACK,
        }}
      >
        {/* The base cut. A circular hole tracks the glass so this copy is never
            drawn under it — without the hole the glass copy sits on top of this
            one and the two outlines read as a doubled letter. Only one copy is
            ever visible at a given pixel.
            Real text in font-display (Sora) Bold, matched to the "Our Services."
            h1 on the services hub (see .about-hero__wordtext), and sized to the
            same WORD box the old artwork occupied so the sweep math below is
            untouched. */}
        <span
          aria-hidden
          className="about-hero__word about-hero__word--thin about-hero__wordtext font-display font-bold"
          style={{ left: pctW(WORD.x), top: pctH(WORD.y), width: pctW(WORD.w) }}
        >
          {WORDMARK_TEXT}
        </span>
        <span className="sr-only">{title}</span>

        {PROPS.map((p) => (
          <Image
            key={p.src}
            src={p.src}
            alt=""
            aria-hidden
            width={p.w}
            height={p.h}
            className="about-hero__prop"
            style={{
              left: pctW(p.x),
              top: pctH(p.y),
              width: pctW(p.w),
              ['--ar' as string]: `${p.w} / ${p.h}`,
              ['--from' as string]: `${(PROP_TRAVEL / p.w) * 100}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${(p.settle - p.delay).toFixed(2)}s`,
            }}
          />
        ))}

        {/* The lens. Its glass holds a second copy of the wordmark in a heavier
            weight, clipped to the glass circle and pinned to the same stage
            coordinates as the base one — so the bold copy sits exactly on top of
            the thin one and only shows through the glass. */}
        <div className="about-hero__lens" aria-hidden>
          <div className="about-hero__glass">
            <div className="about-hero__plane">
              {/* The copy shown through the lens: same text, same box, same
                  weight as the base cut — the lens reads as a magnifier, not a
                  weight swap. Split into one span per glyph so the rAF loop
                  above can scale up whichever letter the lens centre currently
                  sits over, which (with the cyan tint) is the whole effect. */}
              <span
                aria-hidden
                className="about-hero__word about-hero__wordtext about-hero__wordtext--magnified font-display font-bold"
                style={{ left: pctW(WORD.x), top: pctH(WORD.y), width: pctW(WORD.w) }}
              >
                {WORDMARK_TEXT.split('').map((ch, i) => (
                  <span
                    key={i}
                    ref={(el) => {
                      glyphRefs.current[i] = el;
                    }}
                    className="about-hero__glyph"
                  >
                    {ch === ' ' ? ' ' : ch}
                  </span>
                ))}
              </span>
            </div>
          </div>
          <Image
            src="/assets/about-hero/icon-03.png"
            alt=""
            aria-hidden
            width={LOUPE_INTRINSIC_W}
            height={LOUPE_INTRINSIC_H}
            priority
            className="about-hero__loupe"
          />
        </div>
      </div>
    </div>
  );
}
