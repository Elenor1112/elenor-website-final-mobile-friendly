'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Image, { type StaticImageData } from 'next/image';
import './BrandOrbit.css';

import elenorLogo from '@/assets/elenor logo For Web-02.png';
import abcLogo from '@/assets/Orbs Colors/ABC-Logo.png';
import alNesrAlJawhariLogo from '@/assets/Orbs Colors/image_2025-01-22_115953.png';
import cocaColaLogo from '@/assets/Orbs Colors/image_2025-01-22_120110.png';
import commvaultLogo from '@/assets/Orbs Colors/CVLT US Size Business Cards Landscape CS4 (op)-03.png';
import duravitLogo from '@/assets/Orbs Colors/Duravit-Logo.png';
import globalGroupLogo from '@/assets/Orbs Colors/GLOBAL GROUP Logo.png';
import goBusLogo from '@/assets/Orbs Colors/Go_bus_logo.png';
import gskLogo from '@/assets/Orbs Colors/gsk-company.png';
import saintGobainLogo from '@/assets/Orbs Colors/Saint-Gobain.png';
import dotsLogo from '@/assets/Orbs Colors/Vector Smart Object.png';
import zoetisLogo from '@/assets/Orbs Colors/Zoetis.png';

export interface Brand {
  name: string;
  /** Short label shown in the orb, e.g. "Z", "ae". Defaults to initials. */
  label?: string;
  /** Logo rendered inside the orb; takes precedence over label/initials. */
  logo?: StaticImageData | string;
  /** Colour for the circular orb background (the puck behind the logo). */
  color?: string;
  /**
   * Multiplies this orb's size (logo included). Used to visually balance
   * brands whose wide wordmark logos read smaller than rounder marks, or that
   * drew a small pseudo-random scale.
   */
  sizeBoost?: number;
}

export interface BrandOrbitProps {
  /** Client brands to orbit. Falls back to placeholders when omitted. */
  brands?: Brand[];
  /** Center text. Defaults to "elenor." */
  centerText?: string;
  className?: string;
}

// Default orbiters — white client logos floating transparent.
// Solid white puck for logos that need contrast against dark or colorful
// artwork; the rest render on a fully transparent puck.
const ORB_WHITE = '#ffffff';
const ORB_NONE = 'transparent';

const FALLBACK_BRANDS: Brand[] = [
  { name: 'Zoetis', logo: zoetisLogo, color: ORB_NONE },
  { name: 'Duravit', logo: duravitLogo, color: ORB_WHITE },
  { name: 'DOTS', logo: dotsLogo, color: ORB_NONE },
  { name: 'Saint-Gobain', logo: saintGobainLogo, color: ORB_WHITE },
  { name: 'GSK', logo: gskLogo, color: ORB_NONE },
  { name: 'Commvault', logo: commvaultLogo, color: ORB_WHITE },
  { name: 'Coca-Cola', logo: cocaColaLogo, color: ORB_NONE },
  { name: 'Global Group', logo: globalGroupLogo, color: ORB_WHITE },
  { name: 'ABC Hospital', logo: abcLogo, color: ORB_NONE },
  { name: 'Go-Bus', logo: goBusLogo, color: ORB_NONE },
  { name: 'Al-Nesr Al-Jawhari', logo: alNesrAlJawhariLogo, color: ORB_WHITE },
];

// Initials fallback when a brand has no explicit label, e.g. "Saint-Gobain" → "SG".
function initials(name: string): string {
  return name
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// One full revolution around "elenor." takes this long (shared by all orbs).
const ORBIT_DURATION_S = 40;
// Ring radii as fractions of the base radius. All orbs share this single
// elliptical path — evenly spaced, turning together — wide across the section
// and flatter vertically, like a planetary orbit seen at a tilt. The vertical
// radius is capped by the section's room (min-h-[80vh] in the hero).
const SPREAD_X = 1.9;
const SPREAD_Y = 0.85;
// Every orb renders at this same base size (matches GSK's former effective
// size — its 0.847 pseudo-random draw × its 1.4 sizeBoost). Per-brand
// `sizeBoost` still multiplies on top of this for logos that need it.
const SCALE_UNIFORM = 1.186;

// Orbit parameters for orb i of `count`: every orb shares the same ring, with
// start angles spread evenly around the circle (like clock marks) so spacing
// stays uniform as the ring turns.
function orbHome(i: number, count: number) {
  return {
    angle: (i / count) * Math.PI * 2,
    sizeScale: SCALE_UNIFORM,
  };
}

// Position/scale/opacity for orb i at time t (seconds): steady motion around
// the center wordmark on the one shared elliptical ring. All orbs share one
// angular speed, so the formation turns together as a plain rotation.
function orbPose(t: number, i: number, count: number) {
  const h = orbHome(i, count);
  const a = h.angle + (t * Math.PI * 2) / ORBIT_DURATION_S;
  return {
    x: Math.cos(a) * SPREAD_X,
    y: Math.sin(a) * SPREAD_Y,
    scale: h.sizeScale,
    opacity: 1,
    zIndex: Math.round(h.sizeScale * 50),
  };
}

// Naked center logo — no circle, border, glow, or backdrop. Just the mark.
function CenterMark({ text }: { text: string }) {
  return (
    <Image
      src={elenorLogo}
      alt={text}
      className="brand-orbit__center"
      // The style below sizes the mark at 100vw between its two bounds, so
      // `sizes` tracks the viewport rather than naming one fixed width: a
      // literal 1900px made every phone download the 1900px variant for a
      // 390px-wide slot. Capped at the 113.4rem (1814px) upper bound so wide
      // screens still stop short of the 3508px source.
      sizes="(max-width: 1814px) 100vw, 1814px"
      priority
      // 2× the previous size (24.3rem / 59.4vw / 56.7rem). The fluid term is
      // held at 100vw rather than a literal 118.8vw: doubling it would make the
      // mark wider than the screen at any width below ~1500px. min() keeps the
      // lower bound from overflowing narrow viewports for the same reason.
      style={{ width: 'clamp(min(48.6rem, 100vw), 100vw, 113.4rem)', height: 'auto' }}
      draggable={false}
    />
  );
}

function BrandOrb({
  brand,
  style,
  onMouseEnter,
  onMouseLeave,
}: {
  brand: Brand;
  style?: CSSProperties;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  return (
    <span
      className={`brand-orbit__orb${brand.logo ? ' brand-orbit__orb--logo' : ''}`}
      style={
        brand.color || style
          ? { ...(brand.color ? { backgroundColor: brand.color } : undefined), ...style }
          : undefined
      }
      role="img"
      aria-label={brand.name}
      tabIndex={0}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {brand.logo ? (
        // Decorative inside a role="img" span that already carries the label.
        <Image
          src={brand.logo}
          alt=""
          className="brand-orbit__logo"
          sizes="150px"
          draggable={false}
        />
      ) : (
        brand.label ?? initials(brand.name)
      )}
      <span className="brand-orbit__tooltip" role="tooltip">
        {brand.name}
      </span>
    </span>
  );
}

export function BrandOrbit({
  brands,
  centerText = 'elenor',
  className = '',
}: BrandOrbitProps) {
  const list = brands && brands.length > 0 ? brands : FALLBACK_BRANDS;

  // Detect prefers-reduced-motion on the client so we can render a static grid.
  // Starts false (SSR default = animated) and syncs after mount.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const orbiterRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Pause flag lives in a ref: the rAF loop reads it every frame, and flipping
  // it must not re-render (a re-render would reset inline transforms).
  const pausedRef = useRef(false);

  // Single rAF loop drives the whole system. The orbs ride one shared ellipse
  // around the center wordmark, evenly spaced. The loop advances an
  // elapsed-time clock, eased toward a stop on hover so the orbits decelerate
  // smoothly instead of hard-freezing.
  useEffect(() => {
    if (reduceMotion) return;
    const stage = stageRef.current;
    if (!stage) return;

    // Stage is an --orbit-radius square, so its width *is* the radius.
    let radius = stage.offsetWidth;
    const ro = new ResizeObserver(() => {
      radius = stage.offsetWidth;
    });
    ro.observe(stage);

    let clock = 0; // eased elapsed seconds driving the float
    let speed = 1; // time multiplier, eased to 0 on hover
    let last = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      // Clamp dt so a background-tab gap doesn't teleport the orbs.
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // Ease the time multiplier toward the target: hovering eases the drift to
      // a stop, and leaving spins it back up gently.
      const target = pausedRef.current ? 0 : 1;
      speed += (target - speed) * Math.min(1, dt * 5);
      clock += speed * dt;

      for (let i = 0; i < list.length; i++) {
        const el = orbiterRefs.current[i];
        if (!el) continue;
        const p = orbPose(clock, i, list.length);
        const scale = p.scale * (list[i].sizeBoost ?? 1);
        el.style.transform = `translate3d(${(p.x * radius).toFixed(2)}px, ${(p.y * radius).toFixed(2)}px, 0) scale(${scale.toFixed(3)})`;
        el.style.opacity = p.opacity.toFixed(3);
        el.style.zIndex = String(p.zIndex);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // Eleven orbs, each written every frame, for as long as the page is open —
    // including the whole time the orbit is scrolled past. Stop the loop
    // outright when it leaves the viewport rather than easing it to zero, so
    // an off-screen decoration costs nothing. `last` is reset on resume
    // because the dt clamp alone would still take a visible moment to unwind a
    // long gap.
    let onScreen = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting === onScreen) return;
        onScreen = entry.isIntersecting;
        if (onScreen) {
          last = performance.now();
          raf = requestAnimationFrame(frame);
        } else {
          cancelAnimationFrame(raf);
        }
      },
      { rootMargin: '100px' },
    );
    io.observe(stage);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  }, [reduceMotion, list.length]);

  // Static fallback: center text + orbs in a plain row, no motion.
  if (reduceMotion) {
    return (
      <div className={`brand-orbit ${className}`} aria-label="Elenor and client brands">
        <div className="brand-orbit__grid">
          <CenterMark text={centerText} />
          {list.map((brand) => (
            <BrandOrb
              key={brand.name}
              brand={brand}
              style={
                brand.sizeBoost
                  ? {
                      width: `calc(var(--orbiter-size) * ${brand.sizeBoost})`,
                      height: `calc(var(--orbiter-size) * ${brand.sizeBoost})`,
                    }
                  : undefined
              }
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`brand-orbit ${className}`} aria-label="Elenor and client brands">
      <div
        ref={stageRef}
        className="brand-orbit__stage"
        // Pause while any orb holds keyboard focus so the focused orb (and its
        // tooltip) stays put.
        onFocusCapture={() => (pausedRef.current = true)}
        onBlurCapture={() => (pausedRef.current = false)}
      >
        {/* Hover hit-zone covering the whole scatter field, so drifting near
            any orb eases the drift to a stop. By the time the cursor reaches an
            orb it's stationary — a reliable hover target with no dead points.
            Sits behind the orbs and only listens for enter/leave. */}
        <div
          className="brand-orbit__hitzone"
          onMouseEnter={() => (pausedRef.current = true)}
          onMouseLeave={() => (pausedRef.current = false)}
          aria-hidden
        />
        {list.map((brand, i) => {
          // First-paint pose (before the rAF loop takes over, clock = 0),
          // expressed via the CSS radius var so it's correct during
          // SSR/hydration too.
          const p = orbPose(0, i, list.length);
          const scale = p.scale * (brand.sizeBoost ?? 1);
          return (
            <div
              key={brand.name}
              ref={(el) => {
                orbiterRefs.current[i] = el;
              }}
              className="brand-orbit__orbiter"
              style={{
                transform: `translate(calc(${p.x.toFixed(4)} * var(--orbit-radius)), calc(${p.y.toFixed(4)} * var(--orbit-radius))) scale(${scale.toFixed(3)})`,
                opacity: p.opacity,
                zIndex: p.zIndex,
              }}
            >
              {/* The orb sits on top of the hit-zone as a sibling, so landing
                  on it fires the hit-zone's mouseleave — these handlers keep
                  the orbit paused while the cursor is on a logo. */}
              <BrandOrb
                brand={brand}
                onMouseEnter={() => (pausedRef.current = true)}
                onMouseLeave={() => (pausedRef.current = false)}
              />
            </div>
          );
        })}
        <CenterMark text={centerText} />
      </div>
    </div>
  );
}
