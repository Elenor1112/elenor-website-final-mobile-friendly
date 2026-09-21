'use client';

/**
 * Pauses everything a `gsap.context()` owns while its section is off-screen,
 * and resumes it when the section comes back.
 *
 * Several decorative scenes here run on `repeat: -1` timelines that, once
 * started, keep writing transforms for as long as the page is open — including
 * the whole time the section is scrolled past. That is invisible work on any
 * device and a measurable battery and thermal cost on a phone.
 *
 * Called from inside each scene's existing effect rather than as a hook of its
 * own, because the context is created there and the observer has to be torn
 * down by the same cleanup. Returns a disposer to add to that cleanup.
 *
 * `ctx.data` holds what the context created, which includes tweens and
 * timelines but also plain objects returned from the context callback — hence
 * the duck-typing. Children are walked as well: these scenes nest their
 * looping work inside a parent timeline, and pausing the parent alone leaves an
 * inner `repeat: -1` tween running.
 *
 * Resumed with `resume()` rather than `play()` so each animation keeps its own
 * playhead and picks up where it left off instead of restarting.
 */
type Pausable = {
  pause?: () => void;
  resume?: () => void;
  getChildren?: (nested?: boolean, tweens?: boolean, timelines?: boolean) => unknown[];
};

function collect(entries: unknown[], out: Pausable[], depth = 0) {
  if (depth > 3) return;
  for (const entry of entries) {
    const a = entry as Pausable;
    if (typeof a?.pause !== 'function' || typeof a?.resume !== 'function') continue;
    out.push(a);
    if (typeof a.getChildren === 'function') {
      try {
        collect(a.getChildren(true, true, true), out, depth + 1);
      } catch {
        // A tween has no children; ignore.
      }
    }
  }
}

export function pauseContextOffscreen(el: HTMLElement | null, ctx: gsap.Context): () => void {
  if (!el || typeof IntersectionObserver === 'undefined') return () => {};

  let onScreen = true;
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting === onScreen) return;
      onScreen = entry.isIntersecting;
      const animations: Pausable[] = [];
      collect((ctx.data ?? []) as unknown[], animations);
      for (const a of animations) {
        if (onScreen) a.resume!();
        else a.pause!();
      }
    },
    // A margin so the scene is already running by the time it scrolls into view.
    { rootMargin: '150px' },
  );
  observer.observe(el);
  return () => observer.disconnect();
}
