'use client';

import { useEffect, useState } from 'react';

// Returns true only when we should render the full WebGL layer:
// WebGL is supported, the user has not requested reduced motion, and the
// device is not a phone. Anything else falls back to the static/CSS layer
// (progressive enhancement).
//
// Phones are excluded because the cost is real and the benefit is not: a
// WebGL canvas here carries a continuous render loop, an HDRI environment map
// and PBR materials, all to decorate a ~256px box on the device most likely to
// be on a metered connection and a battery. Every consumer already paints a
// CSS fallback underneath, so excluding them costs no markup.
export function useEnhanced3D() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    // matchMedia, not innerWidth: under mobile emulation innerWidth reports the
    // layout width times the device pixel ratio and would read as desktop.
    const phone =
      window.matchMedia('(max-width: 767.98px)').matches ||
      window.matchMedia('(pointer: coarse)').matches;
    if (phone) return;

    let ok = false;
    try {
      const canvas = document.createElement('canvas');
      ok = !!(
        window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );
    } catch {
      ok = false;
    }
    setEnabled(ok);
  }, []);

  return enabled;
}
