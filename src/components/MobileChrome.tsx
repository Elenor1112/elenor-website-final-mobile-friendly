'use client';

import { MobileRouteProgress } from '@/components/MobileRouteProgress';
import { useMobileRuntime } from '@/hooks/useMobileRuntime';

/**
 * Mounts the phone-only chrome, and nothing at all on desktop.
 *
 * A mount gate rather than a CSS `hidden`: these components attach document
 * listeners, and a hidden copy would still run them on desktop. Returning null
 * until the media query is known also keeps the server and first client render
 * identical.
 */
export function MobileChrome() {
  const isMobile = useMobileRuntime();
  if (!isMobile) return null;
  return <MobileRouteProgress />;
}
