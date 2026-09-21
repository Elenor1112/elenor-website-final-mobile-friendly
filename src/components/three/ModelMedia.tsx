'use client';

// Gallery-facing wrapper around ModelViewer.
//
// Three things happen here, none of which belong in the viewer itself:
//   1. ModelViewer is imported through next/dynamic with ssr:false, so the
//      three.js chunk is only requested by pages that render this component.
//   2. The viewer doesn't mount until the item scrolls near the viewport —
//      a gallery of models downloads nothing until it is actually reached.
//   3. The poster image renders immediately (and is server-rendered as a
//      plain <img>), then crossfades to the model once it reports ready.

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import type { EnvironmentPreset, ModelInfo } from './ModelViewer';

const ModelViewer = dynamic(() => import('./ModelViewer'), {
  ssr: false,
  loading: () => null,
});

export type ModelMediaProps = {
  url: string;
  alt: string;
  posterUrl?: string | null;
  environmentPreset?: EnvironmentPreset;
  autoRotate?: boolean;
  enableHoverRotation?: boolean;
  enableMouseParallax?: boolean;
  modelXOffset?: number;
  modelYOffset?: number;
  className?: string;
  /** Responsive height classes; override to reframe (e.g. in the hero). */
  heightClassName?: string;
  /**
   * Let a click expand the model into the immersive fullscreen viewer.
   * On by default — gallery and hero models are all meant to be explorable.
   */
  enableFullscreen?: boolean;
  /** Metadata shown in the fullscreen info panel. */
  info?: ModelInfo;
};

// Start fetching slightly before the item is on screen so the model is usually
// ready by the time the user gets there.
const ROOT_MARGIN = '300px';

export function ModelMedia({
  url,
  alt,
  posterUrl,
  environmentPreset = 'forest',
  autoRotate = false,
  enableHoverRotation = true,
  enableMouseParallax = true,
  modelXOffset = 0,
  modelYOffset = 0,
  className,
  heightClassName = 'h-[300px] md:h-[450px] lg:h-[500px]',
  enableFullscreen = true,
  info,
}: ModelMediaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Phones and data-saver sessions never auto-load the model. A GLB in this
    // CMS is routinely tens of megabytes — the one this gallery shipped with
    // was 102MB — and nothing about scrolling past a tile is consent to spend
    // that. The poster image is already server-rendered underneath, so the
    // tile still shows the work; ModelViewer is simply never mounted.
    const conn = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
    const phone =
      window.matchMedia('(max-width: 767.98px)').matches ||
      window.matchMedia('(pointer: coarse)').matches;
    if (phone || conn?.saveData) return;

    // Without IntersectionObserver (very old browsers) just load immediately.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect(); // one-shot: never unload a mounted viewer
        }
      },
      { rootMargin: ROOT_MARGIN },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      // Fixed responsive heights, matching the image tiles' aspect box, so the
      // model swapping in never shifts layout.
      className={`relative w-full overflow-hidden rounded-lg bg-white/[0.04] ${heightClassName} ${className ?? ''}`}
    >
      {posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={posterUrl}
          alt={alt}
          loading="lazy"
          decoding="async"
          aria-hidden={loaded}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
          style={{ opacity: loaded ? 0 : 1 }}
        />
      ) : null}

      {visible ? (
        <ModelViewer
          url={url}
          width="100%"
          height="100%"
          modelXOffset={modelXOffset}
          modelYOffset={modelYOffset}
          environmentPreset={environmentPreset}
          enableHoverRotation={enableHoverRotation}
          enableMouseParallax={enableMouseParallax}
          autoRotate={autoRotate}
          autoRotateSpeed={0.35}
          showScreenshotButton={false}
          // The poster handles the fade; a second one would double-dip.
          fadeIn={!posterUrl}
          ariaLabel={alt}
          title={alt}
          onLoaded={() => setLoaded(true)}
          enableFullscreen={enableFullscreen}
          info={info}
        />
      ) : null}
    </div>
  );
}
