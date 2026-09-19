import type { Metadata } from "next";
import { LogoMark } from "@/components/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  return (
    <div className="grid-paper flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm border bg-background p-8 shadow-[8px_8px_0_0_var(--primary)]">
        <div className="mb-8 flex items-center gap-2">
          <LogoMark className="size-7" />
          <span className="font-heading text-base font-bold tracking-[0.2em] uppercase">laterhook</span>
        </div>
        <h1 className="text-xl font-semibold">Welcome back</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">Catch every webhook now. Sort it out later.</p>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
