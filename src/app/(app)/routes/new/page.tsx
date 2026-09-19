import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { RouteForm, type RouteDraft } from "@/components/route-form";
import { getEndpointBySlug, getRequest } from "@/lib/repo";
import { endpointPattern, escapeToPattern, fullPath } from "@/lib/routes";

export const metadata: Metadata = { title: "New route" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function NewRoutePage(props: PageProps<"/routes/new">) {
  const sp = await props.searchParams;
  let draft: RouteDraft = {};
  let origin: string | null = null;

  const fromId = first(sp.from);
  const endpointSlug = first(sp.endpoint);
  if (fromId) {
    const req = await getRequest(fromId);
    if (req) {
      const path = fullPath(req.endpoint_slug, req.path);
      const ep = await getEndpointBySlug(req.endpoint_slug);
      draft = {
        name: `${ep?.name ?? req.endpoint_slug}${req.path ? ` / ${req.path}` : ""}`,
        pattern: escapeToPattern(path),
        methods: [req.method],
        samplePath: path,
        forward_url: ep?.forward_url ?? "",
      };
      origin = `${req.method} /${path}`;
    }
  } else if (endpointSlug) {
    const ep = await getEndpointBySlug(endpointSlug);
    if (ep) {
      draft = {
        name: ep.name ?? ep.slug,
        pattern: endpointPattern(ep.slug),
        samplePath: `${ep.slug}/example`,
        forward_url: ep.forward_url ? `${ep.forward_url.replace(/\/$/, "")}/$1` : "",
        description: ep.description ?? "",
      };
      origin = `everything under /${ep.slug}`;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Routes" title="New route" description={origin ? <>Pre-filled from <span className="font-mono text-foreground">{origin}</span>. Loosen the pattern if it should match more.</> : "Describe which paths this route owns and what should happen to them."} />
      <RouteForm draft={draft} />
    </div>
  );
}
