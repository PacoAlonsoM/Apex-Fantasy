import { useEffect, useState } from "react";

// Thin IntersectionObserver hook for the `.f1-reveal` pattern. Toggles a
// `is-visible` class (via state) on the first time an element enters the
// viewport, then disconnects. Safe to call with a falsy ref. Honors
// `prefers-reduced-motion` by short-circuiting to `true` immediately.
export default function useReveal(ref, { threshold = 0.18, rootMargin = "0px 0px -10% 0px" } = {}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return undefined;
    }
    const node = ref?.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      // Older browsers / no node — show immediately rather than hide forever.
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, threshold, rootMargin]);

  return visible;
}
