import { SUBTLE_TEXT } from "@/src/constants/design";

/**
 * Stint Kicker — the canonical small-uppercase tag used above titles, on
 * race chrome, in section eyebrows. Sized for race-week density (10px,
 * 800 weight, ~0.1em tracking). `tabular` opts into tabular-nums when the
 * kicker carries numeric content (round numbers, lap counts).
 *
 * Replaces 4 local copies that drifted between `0.1em` and `0.14em`
 * letter-spacing — the canonical 0.1em wins. Pass an explicit `style`
 * to override.
 *
 * @param {{ color?: string, tabular?: boolean, children: any, style?: object }} props
 */
export default function Kicker({ color = SUBTLE_TEXT, tabular = false, children, style }) {
  return (
    <span style={{
      fontSize:      10,
      fontWeight:    800,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color,
      ...(tabular ? { fontVariantNumeric: "tabular-nums" } : null),
      ...style,
    }}>{children}</span>
  );
}
