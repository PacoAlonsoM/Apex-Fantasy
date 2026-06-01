"use client";

import AvatarLivery from "@/src/ui/avatars/AvatarLivery";
import AvatarTacho  from "@/src/ui/avatars/AvatarTacho";
import AvatarVisor  from "@/src/ui/avatars/AvatarVisor";
import AvatarNotch  from "@/src/ui/avatars/AvatarNotch";
import AvatarPlate  from "@/src/ui/avatars/AvatarPlate";
import AvatarRotor  from "@/src/ui/avatars/AvatarRotor";
import IdentityAvatar from "@/src/ui/IdentityAvatar";

// Internal preview — render all avatar concepts at every realistic surface
// size, Free + Pro side-by-side, against both the dark Stint background
// and a light surface so we can compare context.
export default function AvatarsPreviewPage() {
  const SIZES = [20, 28, 40, 56, 80, 104];
  const COLOUR_KEYS = ["support-mclaren", "support-ferrari", "support-mercedes", "support-red-bull"];

  const concepts = [
    { name: "E · NOTCH (silhouette break)", Comp: AvatarNotch, propName: "pro" },
    { name: "F · PLATE (number plate)",     Comp: AvatarPlate, propName: "pro" },
    { name: "G · ROTOR (brake disc)",       Comp: AvatarRotor, propName: "pro" },
    { name: "A · Watch dial",               Comp: IdentityAvatar, propName: "pro" },
    { name: "B · Livery panel",             Comp: AvatarLivery,   propName: "pro" },
    { name: "C · Tachometer",               Comp: AvatarTacho,    propName: "pro" },
    { name: "D · Visor",                    Comp: AvatarVisor,    propName: "pro" },
  ];

  return (
    <div style={{
      background: "#06101B",
      color: "#fff",
      minHeight: "100vh",
      padding: "48px 32px",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <header style={{ marginBottom: 48 }}>
          <h1 style={{
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            margin: 0,
            marginBottom: 8,
          }}>Avatar concepts</h1>
          <p style={{
            color: "rgba(255,255,255,0.55)",
            margin: 0,
            fontSize: 14,
            lineHeight: 1.6,
            maxWidth: 640,
          }}>
            Four directions. Each row is one concept; columns scale from
            20px (community row) to 104px (profile hero). Each cell shows
            both Free (top) and Pro (bottom). Same initials, varying team
            colours so the team-theming pattern is visible.
          </p>
        </header>

        {concepts.map(({ name, Comp, propName }) => (
          <section key={name} style={{
            marginBottom: 56,
            padding: "32px 28px",
            background: "#0d1929",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 16,
          }}>
            <h2 style={{
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              margin: 0,
              marginBottom: 24,
              color: "#fff",
            }}>{name}</h2>

            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${SIZES.length}, 1fr)`,
              gap: 24,
              alignItems: "end",
            }}>
              {SIZES.map((size) => (
                <div key={size} style={{ textAlign: "center" }}>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    color: "rgba(255,255,255,0.4)",
                    marginBottom: 14,
                    textTransform: "uppercase",
                  }}>{size}px</div>

                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
                    <Comp
                      username="FA"
                      colorKey={COLOUR_KEYS[0]}
                      size={size}
                      {...{ [propName]: false }}
                    />
                  </div>
                  <div style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.10em",
                    color: "rgba(255,255,255,0.3)",
                    marginBottom: 12,
                    textTransform: "uppercase",
                  }}>Free</div>

                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
                    <Comp
                      username="FA"
                      colorKey={COLOUR_KEYS[0]}
                      size={size}
                      {...{ [propName]: true }}
                    />
                  </div>
                  <div style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: "0.10em",
                    color: "#fbbf24",
                    textTransform: "uppercase",
                  }}>Pro</div>
                </div>
              ))}
            </div>

            {/* Team-colour variety row at one size */}
            <div style={{
              marginTop: 32,
              paddingTop: 24,
              borderTop: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              gap: 32,
              justifyContent: "center",
            }}>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
              }}>Team colours @ 56px (Pro)</span>
              {COLOUR_KEYS.map((key) => (
                <Comp
                  key={key}
                  username="FA"
                  colorKey={key}
                  size={56}
                  {...{ [propName]: true }}
                />
              ))}
            </div>
          </section>
        ))}

        {/* Light-theme comparison strip */}
        <section style={{
          padding: "32px 28px",
          background: "#f5efe6",
          border: "1px solid rgba(0,0,0,0.06)",
          borderRadius: 16,
        }}>
          <h2 style={{
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            margin: 0,
            marginBottom: 24,
            color: "#06101b",
          }}>Light-theme legibility — all 4 concepts @ 56px (Pro)</h2>
          <div style={{ display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
            {concepts.map(({ name, Comp, propName }) => (
              <div key={name} style={{ textAlign: "center" }}>
                <Comp username="FA" colorKey="support-mclaren" size={56} {...{ [propName]: true }} />
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "rgba(6,16,27,0.6)",
                  marginTop: 8,
                  textTransform: "uppercase",
                }}>{name.split(" · ")[0]}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
