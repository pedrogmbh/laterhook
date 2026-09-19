/**
 * Endpoint colours. Each entry maps a name to CSS custom property values used
 * via `style={{ "--ep": ... }}` so the same colour works in light and dark.
 */
export const ENDPOINT_COLORS = [
  "lime",
  "cyan",
  "violet",
  "amber",
  "rose",
  "sky",
  "emerald",
  "orange",
  "fuchsia",
  "yellow",
] as const;

export type EndpointColor = (typeof ENDPOINT_COLORS)[number];

// oklch(L C H) tuned so text on `bg` stays readable and dots pop on both themes.
export const COLOR_OKLCH: Record<EndpointColor, { light: string; dark: string; hue: number }> = {
  lime: { light: "oklch(0.72 0.21 130)", dark: "oklch(0.82 0.23 130)", hue: 130 },
  cyan: { light: "oklch(0.68 0.13 215)", dark: "oklch(0.8 0.13 215)", hue: 215 },
  violet: { light: "oklch(0.6 0.2 295)", dark: "oklch(0.76 0.16 295)", hue: 295 },
  amber: { light: "oklch(0.72 0.17 70)", dark: "oklch(0.83 0.16 80)", hue: 75 },
  rose: { light: "oklch(0.62 0.22 15)", dark: "oklch(0.75 0.18 15)", hue: 15 },
  sky: { light: "oklch(0.62 0.16 245)", dark: "oklch(0.76 0.13 240)", hue: 242 },
  emerald: { light: "oklch(0.62 0.15 160)", dark: "oklch(0.78 0.15 160)", hue: 160 },
  orange: { light: "oklch(0.68 0.19 45)", dark: "oklch(0.78 0.17 50)", hue: 47 },
  fuchsia: { light: "oklch(0.62 0.24 330)", dark: "oklch(0.76 0.2 330)", hue: 330 },
  yellow: { light: "oklch(0.8 0.17 95)", dark: "oklch(0.88 0.17 98)", hue: 96 },
};

export function isEndpointColor(v: unknown): v is EndpointColor {
  return typeof v === "string" && (ENDPOINT_COLORS as readonly string[]).includes(v);
}

/** Deterministic colour for a brand-new endpoint, so it looks intentional from the first request. */
export function pickColorFor(slug: string): EndpointColor {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return ENDPOINT_COLORS[h % ENDPOINT_COLORS.length];
}

export const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
export type Method = (typeof METHODS)[number] | (string & {});

export const METHOD_HUE: Record<string, number> = {
  GET: 242,
  POST: 145,
  PUT: 75,
  PATCH: 295,
  DELETE: 15,
  HEAD: 215,
  OPTIONS: 330,
};
