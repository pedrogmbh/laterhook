import { AppShell } from "@/components/app-shell";
import { getBaseUrl } from "@/lib/base-url";
import { listEndpoints } from "@/lib/repo";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [endpoints, baseUrl] = await Promise.all([listEndpoints(), getBaseUrl()]);
  return (
    <AppShell endpoints={endpoints} baseUrl={baseUrl}>
      {children}
    </AppShell>
  );
}
