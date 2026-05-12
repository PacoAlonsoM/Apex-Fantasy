import { SUBTLE_TEXT } from "@/src/constants/design";

/**
 * Stint SectionLabel — bolder cousin of Kicker (font-weight 900, slightly
 * wider tracking). Used to introduce significant page sections. With
 * `rule`, prefixes a 22×1px hairline tinted with the same color so the
 * label reads like a chapter mark.
 *
 * Replaces identical local copies in NewsPage and GridPage.
 *
 * @param {{ color?: string, rule?: boolean, children: any, style?: object }} props
 */
export default function SectionLabel({ children, color = SUBTLE_TEXT, rule = false, style }) {
  if (rule) {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 10, ...style }}>
        <span aria-hidden="true" style={{
          display:    "inline-block",
          width:      22,
          height:     1,
          background: color,
          opacity:    0.5,
        }} />
        <span style={{
          fontSize:      10,
          fontWeight:    900,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color,
        }}>{children}</span>
      </div>
    );
  }
  return (
    <div style={{
      fontSize:      10,
      fontWeight:    900,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color,
      ...style,
    }}>{children}</div>
  );
}
