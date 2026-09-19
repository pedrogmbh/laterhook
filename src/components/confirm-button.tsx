"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ConfirmButton({
  label,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "destructive",
  size = "sm",
  disabled,
  onConfirm,
  children,
}: {
  label: React.ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: "destructive" | "outline" | "ghost" | "secondary" | "default";
  size?: "xs" | "sm" | "default" | "icon-xs" | "icon-sm";
  disabled?: boolean;
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant={variant} size={size} disabled={disabled} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={variant === "outline" || variant === "ghost" || variant === "secondary" ? "default" : variant}
              onClick={async () => {
                setOpen(false);
                await onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
