import { useEffect, useState } from "react";

function getWidth() {
  if (typeof window === "undefined") return 1440;
  return window.innerWidth;
}

export default function useViewport() {
  const [width, setWidth] = useState(getWidth);

  useEffect(() => {
    function onResize() {
      setWidth(window.innerWidth);
    }

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return {
    width,
    isMobile: width < 820,
    isTablet: width < 1120,
  };
}
