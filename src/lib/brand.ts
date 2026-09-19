/** Shared copy and colours for metadata, icons and social images. */
export const BRAND = {
  name: "laterhook",
  tagline: "Catch every webhook now. Sort it out later.",
  description:
    "A self-hosted webhook inbox. Point any provider at /webhooks/<anything> with zero setup, then browse, search, tag, forward and replay every request from a fast, beautiful dashboard.",
  // Hex equivalents of the oklch tokens in globals.css, for renderers without oklch support (SVG icons, Satori).
  lime: "#b4f22a",
  ink: "#101410",
  paper: "#0f1214",
  muted: "#8a938f",
} as const;
