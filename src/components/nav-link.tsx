"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  exact = false,
  icon,
  trailing,
  compact = false,
  children,
}: {
  href: string;
  exact?: boolean;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  compact?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const [hrefPath, hrefQuery] = href.split("?");
  let active = exact ? pathname === hrefPath : pathname === hrefPath || pathname.startsWith(hrefPath + "/");
  if (hrefQuery) {
    const wanted = new URLSearchParams(hrefQuery);
    for (const [k, v] of wanted) if (search.get(k) !== v) active = false;
  } else if (hrefPath === "/inbox" && search.get("starred")) {
    active = false;
  }
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 text-xs font-medium transition-colors",
        compact ? "shrink-0 border px-2.5 py-1 whitespace-nowrap" : "px-2 py-1.5",
        active
          ? compact
            ? "border-foreground bg-foreground text-background"
            : "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        "[&_svg]:size-4 [&_svg]:shrink-0",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </Link>
  );
}
