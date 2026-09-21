'use client';

import { useEffect, useState } from 'react';

/** Matches the mobile layer in mobile.css and Tailwind's `max-md:` boundary. */
const MOBILE_QUERY = '(max-width: 767.98px)';

/**
 * Whether this session should run the phone-weight experience.
 *
 * Use it to gate *effects*, never markup. Layout belongs in CSS (`max-md:`
 * utilities and `src/app/mobile.css`), which resolves before first paint;
 * branching the render tree on this hook would ship desktop HTML and swap it
 * after hydration, producing a flash and a layout shift on exactly the devices
 * least able to absorb one.
 *
 * Returns `null` until mounted, which callers must treat as "not yet known" —
 * i.e. do not start the expensive thing — rather than as `false`. Server render
 * and first client render therefore agree, so there is no hydration mismatch.
 *
 * Deliberately `matchMedia` and not `window.innerWidth`: under mobile emulation
 * `innerWidth` reports the layout width multiplied by the device pixel ratio
 * (1560 on a 390px viewport), which silently selects the desktop branch.
 */
export function useMobileRuntime(): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    // Coarse pointer OR narrow viewport: a narrow desktop window should get the
    // lighter treatment too, and a large tablet should not miss it.
    const coarse = window.matchMedia('(pointer: coarse)');

    const sync = () => setIsMobile(mql.matches || coarse.matches);
    sync();

    mql.addEventListener('change', sync);
    coarse.addEventListener('change', sync);
    return () => {
      mql.removeEventListener('change', sync);
      coarse.removeEventListener('change', sync);
    };
  }, []);

  return isMobile;
}
