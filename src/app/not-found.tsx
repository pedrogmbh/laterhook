import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid-paper flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">404</p>
      <h1 className="text-2xl font-semibold">Nothing captured at this address.</h1>
      <Button nativeButton={false} render={<Link href="/" />} variant="outline" size="sm">
        Back to overview
      </Button>
    </div>
  );
}
