"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  label = "Copy",
  size = "xs",
  variant = "ghost",
  className,
  iconOnly = false,
}: {
  value: string;
  label?: string;
  size?: "xs" | "sm" | "icon-xs" | "icon-sm";
  variant?: "ghost" | "outline" | "secondary";
  className?: string;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size={iconOnly ? (size === "xs" ? "icon-xs" : size) : size}
      variant={variant}
      className={cn("shrink-0", className)}
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} strokeWidth={2} data-icon={iconOnly ? undefined : "inline-start"} />
      {!iconOnly && (copied ? "Copied" : label)}
    </Button>
  );
}
