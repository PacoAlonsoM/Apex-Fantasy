/**
 * Thin wrapper around the native View Transitions API.
 *
 *   withViewTransition(() => setTab("history"), { direction: "forward", name: "profile-tabs" })
 *
 * Pairs with CSS that reads `data-vt-name` and `data-vt-direction` off <html>
 * so a single transition definition can branch by name + direction.
 *
 * No-ops in SSR or in browsers without the API — the mutation still runs.
 * Honours prefers-reduced-motion (skips the transition, just mutates).
 */
export function withViewTransition(mutate, { direction = null, name = null } = {}) {
  if (typeof mutate !== "function") return;
  if (typeof document === "undefined" || typeof document.startViewTransition !== "function") {
    mutate();
    return;
  }
  const mq = typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
  if (mq && mq.matches) {
    mutate();
    return;
  }

  const root = document.documentElement;
  const prevName = root.dataset.vtName;
  const prevDir  = root.dataset.vtDirection;

  if (name)      root.dataset.vtName = name;
  if (direction) root.dataset.vtDirection = direction;

  const transition = document.startViewTransition(() => {
    mutate();
  });

  // Restore dataset once the transition finishes (or fails), so a later transition
  // doesn't inherit the stale direction/name.
  transition.finished.finally(() => {
    if (name) {
      if (prevName === undefined) delete root.dataset.vtName;
      else root.dataset.vtName = prevName;
    }
    if (direction) {
      if (prevDir === undefined) delete root.dataset.vtDirection;
      else root.dataset.vtDirection = prevDir;
    }
  }).catch(() => {});
}

/**
 * Animate a numeric value from `from` → `to` with a strong ease-out.
 * Returns a cleanup function. Respects prefers-reduced-motion (jumps to `to`).
 */
export function animateNumber({ from, to, duration = 900, onUpdate }) {
  if (typeof onUpdate !== "function") return () => {};
  const prefersReduced = typeof window !== "undefined" && window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced || typeof window === "undefined") {
    onUpdate(to);
    return () => {};
  }

  let rafId = 0;
  let cancelled = false;
  const start = performance.now();
  const delta = to - from;
  // cubic-bezier(0.23, 1, 0.32, 1) — strong ease-out used across STINT.
  const ease = (t) => 1 - Math.pow(1 - t, 3);

  function tick(now) {
    if (cancelled) return;
    const elapsed = now - start;
    const t = Math.min(1, elapsed / duration);
    const value = from + delta * ease(t);
    onUpdate(t >= 1 ? to : value);
    if (t < 1) rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);
  return () => { cancelled = true; cancelAnimationFrame(rafId); };
}
