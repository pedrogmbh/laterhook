import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND.lime,
        }}
      >
        <svg width="180" height="180" viewBox="0 0 64 64">
          <path d="M18 12h10v30h18v10H18z" fill={BRAND.ink} />
          <circle cx="49" cy="17" r="5" fill={BRAND.ink} />
        </svg>
      </div>
    ),
    size,
  );
}
