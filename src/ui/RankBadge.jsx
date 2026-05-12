import { MUTED_TEXT } from "@/src/constants/design";

/**
 * RankBadge — gold / silver / bronze medallion for leaderboard positions.
 *
 * Used by /pro (free + member dashboards), /pro/success, and any future
 * leaderboard surface that needs to signal podium vs. rest. Ranks 1-3 render
 * as gradient medals with a ring + soft drop; rank 4+ renders as a neutral
 * slate disc. Every surface in STINT that shows a ranked list should pull
 * from this component so the podium language stays consistent.
 *
 * @param {object} props
 * @param {number} props.rank     — 1-based rank.
 * @param {number} [props.size=22] — outer diameter in px.
 */
const RANK_MEDALS = [
  // Gold — warm-to-deep amber gradient, amber rim.
  { bg: "linear-gradient(135deg,#fde68a 0%,#d97706 100%)", ring: "rgba(251,191,36,0.40)", num: "#fff7ed" },
  // Silver — cool neutral gradient, slate rim.
  { bg: "linear-gradient(135deg,#e5e7eb 0%,#94a3b8 100%)", ring: "rgba(148,163,184,0.40)", num: "#fff"    },
  // Bronze — peach-to-rust gradient, copper rim.
  { bg: "linear-gradient(135deg,#fdba74 0%,#9a3412 100%)", ring: "rgba(234,88,12,0.40)",   num: "#fff"    },
];

export default function RankBadge({ rank, size = 22 }) {
  const medal = RANK_MEDALS[rank - 1];

  if (medal) {
    return (
      <span style={{
        width:              size,
        height:             size,
        borderRadius:       "50%",
        background:         medal.bg,
        boxShadow:          `0 0 0 1px ${medal.ring}, 0 6px 14px rgba(0,0,0,0.35)`,
        display:            "inline-flex",
        alignItems:         "center",
        justifyContent:     "center",
        fontSize:           Math.round(size * 0.46),
        fontWeight:         900,
        color:              medal.num,
        flexShrink:         0,
        fontVariantNumeric: "tabular-nums",
      }}>
        {rank}
      </span>
    );
  }

  return (
    <span style={{
      width:              size,
      height:             size,
      borderRadius:       "50%",
      background:         "rgba(148,163,184,0.10)",
      display:            "inline-flex",
      alignItems:         "center",
      justifyContent:     "center",
      fontSize:           Math.round(size * 0.46),
      fontWeight:         900,
      color:              MUTED_TEXT,
      flexShrink:         0,
      fontVariantNumeric: "tabular-nums",
    }}>
      {rank}
    </span>
  );
}
