import type { MetadataRoute } from "next";

/** A private tool: keep search engines out. Social scrapers still read the Open Graph tags. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
