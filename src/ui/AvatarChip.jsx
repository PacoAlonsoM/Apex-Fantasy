import IdentityAvatar from "@/src/ui/IdentityAvatar";
import ProPip from "@/src/ui/ProPip";
import { MUTED_TEXT, SUBTLE_TEXT, TEXT_PRIMARY } from "@/src/constants/design";

/**
 * Stint canonical avatar + name chip. Replaces the inline `AvatarChip`
 * functions that were duplicated across Community / Grid / Standings.
 *
 * Composition:
 *   [IdentityAvatar]  [Username] [• meta?]   [ProPip?]
 *
 * Props:
 *   user        — { username, name, avatar_color, subscription_status?, pro? }
 *   size        — "sm" (28px) | "md" (34px) | "lg" (44px) | "xl" (56px)
 *   showName    — render the username next to the avatar (default true)
 *   meta        — optional small secondary text (e.g. "League owner")
 *   accent      — optional override for username color
 *   showPro     — opt-out the Pro indicator (default true)
 *   onClick     — make the chip interactive (button-like)
 *   className   — passthrough
 */

const SIZE_MAP = {
  sm: { avatar: 28, font: 12, gap: 8,  metaSize: 10 },
  md: { avatar: 34, font: 13, gap: 10, metaSize: 11 },
  lg: { avatar: 44, font: 14, gap: 12, metaSize: 11 },
  xl: { avatar: 56, font: 16, gap: 14, metaSize: 12 },
};

function isProUser(user) {
  if (!user) return false;
  if (user.pro === true) return true;
  const status = String(user.subscription_status || "").toLowerCase();
  return status === "active" || status === "trialing" || status === "cancel_scheduled";
}

export default function AvatarChip({
  user,
  size = "md",
  showName = true,
  meta = null,
  accent,
  showPro = true,
  onClick,
  className,
  style,
}) {
  const { avatar, font, gap, metaSize } = SIZE_MAP[size] || SIZE_MAP.md;
  const display = (user?.username || user?.name || "").trim() || "Member";
  const pro = isProUser(user);

  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap,
    minWidth: 0,
    color: accent || TEXT_PRIMARY,
    fontFamily: "var(--font-body)",
    ...(onClick ? { cursor: "pointer", padding: 0, background: "transparent", border: "none" } : null),
    ...style,
  };

  const inner = (
    <>
      <IdentityAvatar
        username={user?.username}
        name={user?.name}
        colorKey={user?.avatar_color}
        size={avatar}
        pro={pro && showPro}
      />
      {showName && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: 6,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <span
            style={{
              fontWeight: 700,
              fontSize: font,
              letterSpacing: "-0.01em",
              color: accent || TEXT_PRIMARY,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {display}
          </span>
          {pro && showPro && <ProPip size={Math.max(10, Math.round(avatar * 0.35))} title="Pro member" />}
          {meta && (
            <span
              style={{
                color: SUBTLE_TEXT,
                fontSize: metaSize,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              · {meta}
            </span>
          )}
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={className}
        aria-label={pro ? `${display} · Pro member` : display}
        style={baseStyle}
      >
        {inner}
      </button>
    );
  }

  return (
    <span
      className={className}
      style={baseStyle}
      title={pro ? `${display} · Pro` : display}
    >
      {inner}
    </span>
  );
}

// Re-export the helper so consumers can ask "is this user Pro?" against
// the same rule the chip uses. Used in CommunityPage's Pro-only blur gates.
export { isProUser };
