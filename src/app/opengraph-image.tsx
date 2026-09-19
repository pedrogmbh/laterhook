import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BRAND } from "@/lib/brand";

export const alt = `${BRAND.name}: ${BRAND.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const fontDir = join(process.cwd(), "src/assets/fonts");
const [heading, headingMedium, mono] = await Promise.all([
  readFile(join(fontDir, "SpaceGrotesk-700.ttf")),
  readFile(join(fontDir, "SpaceGrotesk-500.ttf")),
  readFile(join(fontDir, "IBMPlexMono-500.ttf")),
]);

const METHOD_COLORS: Record<string, { bg: string; fg: string }> = {
  POST: { bg: "#1f3a1a", fg: "#b4f22a" },
  GET: { bg: "#172a3d", fg: "#7cc4ff" },
  PUT: { bg: "#3a2e12", fg: "#f2c25a" },
  DELETE: { bg: "#3d1a1f", fg: "#ff7d8a" },
};

const ROWS = [
  { method: "POST", path: "/webhooks/shop/stripe/live", body: '{"type":"payment_intent.succeeded"}', when: "just now" },
  { method: "PUT", path: "/webhooks/shop/orders/42", body: "status=shipped&carrier=dhl", when: "12s ago" },
  { method: "GET", path: "/webhooks/pinger?ping=1", body: "no body", when: "1m ago" },
  { method: "DELETE", path: "/webhooks/shop/orders/41", body: "no body", when: "3m ago" },
];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BRAND.paper,
          color: "#f4f6f4",
          fontFamily: "Space Grotesk",
          padding: "56px 64px",
          position: "relative",
        }}
      >
        {/* grid paper */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "linear-gradient(to right, #1c2124 1px, transparent 1px), linear-gradient(to bottom, #1c2124 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, background: BRAND.lime, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="44" height="44" viewBox="0 0 64 64">
              <path d="M18 12h10v30h18v10H18z" fill={BRAND.ink} />
              <circle cx="49" cy="17" r="5" fill={BRAND.ink} />
            </svg>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 8, textTransform: "uppercase" }}>{BRAND.name}</div>
        </div>

        {/* headline */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 44, gap: 6 }}>
          <div style={{ fontSize: 66, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2 }}>Catch every webhook now.</div>
          <div style={{ fontSize: 66, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2, color: BRAND.lime }}>Sort it out later.</div>
        </div>

        {/* inbox mock */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 40, border: "1px solid #2a3034", background: "#12171a" }}>
          {ROWS.map((r, i) => {
            const c = METHOD_COLORS[r.method];
            return (
              <div
                key={r.method + i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  padding: "13px 20px",
                  borderTop: i === 0 ? "none" : "1px solid #22282c",
                  borderLeft: i < 2 ? `3px solid ${BRAND.lime}` : "3px solid transparent",
                  fontFamily: "IBM Plex Mono",
                  fontSize: 19,
                }}
              >
                <div style={{ display: "flex", width: 92, justifyContent: "center", padding: "4px 0", background: c.bg, color: c.fg, fontSize: 15, letterSpacing: 2, fontWeight: 500 }}>{r.method}</div>
                <div style={{ display: "flex", color: "#e6eae7" }}>{r.path}</div>
                <div style={{ display: "block", color: BRAND.muted, flex: 1, minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{r.body}</div>
                <div style={{ display: "flex", color: BRAND.muted, fontSize: 16 }}>{r.when}</div>
              </div>
            );
          })}
        </div>

        {/* footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto", fontFamily: "Space Grotesk", fontWeight: 500, fontSize: 20, color: BRAND.muted }}>
          <div style={{ display: "flex" }}>Zero-setup ingest · search · tags · routes · forward · replay</div>
          <div style={{ display: "flex", fontFamily: "IBM Plex Mono", color: "#e6eae7" }}>/webhooks/&lt;anything&gt;</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Space Grotesk", data: heading, weight: 700, style: "normal" },
        { name: "Space Grotesk", data: headingMedium, weight: 500, style: "normal" },
        { name: "IBM Plex Mono", data: mono, weight: 500, style: "normal" },
      ],
    },
  );
}
