import { useEffect, useState } from "react";

function getViewport() {
  if (typeof window === "undefined") {
    return { width: 1440, height: 900 };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

export default function useViewport() {
  const [viewport, setViewport] = useState(getViewport);

  useEffect(() => {
    function onResize() {
      setViewport(getViewport());
    }

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const { width, height } = viewport;

  return {
    width,
    height,
    isMobile: width < 820,
    isTablet: width < 1120,
  };
}
