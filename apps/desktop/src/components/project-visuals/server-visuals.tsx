import { Server } from "lucide-react";
import { cn } from "@/lib/utils";

export function ServerVisualFrame({
  children,
  active = false,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <div className="relative flex size-52 items-center justify-center">
      <div
        className={cn(
          "absolute inset-0 rounded-full border bg-linear-to-br shadow-[0_30px_80px_-35px_rgba(18,112,255,0.45)] transition-colors",
          active
            ? "border-emerald-400/35 from-emerald-500/12 via-background to-emerald-300/10 shadow-[0_30px_80px_-35px_rgba(16,185,129,0.55)]"
            : "border-primary/20 from-primary/10 via-background to-accent/10",
        )}
      />
      <div
        className={cn(
          "absolute inset-[18px] rounded-full border transition-colors",
          active ? "border-emerald-400/35" : "border-border/60",
        )}
      />
      {children}
    </div>
  );
}

export function SystemBridgeVisual({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 160 160"
      className={cn("relative size-30 text-foreground", className)}
      fill="none"
    >
      <rect x="16" y="52" width="34" height="56" rx="10" stroke="currentColor" strokeWidth="5" />
      <rect x="110" y="52" width="34" height="56" rx="10" stroke="currentColor" strokeWidth="5" />
      <path d="M50 80h18c9 0 15-8 15-18s6-18 15-18h12" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M50 80h18c9 0 15 8 15 18s6 18 15 18h12" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <circle cx="80" cy="80" r="12" fill="currentColor" />
      <path d="M80 68v24M68 80h24" stroke="hsl(var(--background))" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function BaselineServerVisual() {
  return (
    <div className="relative flex size-28 items-center justify-center rounded-[2rem] border border-border/70 bg-background/95 shadow-[0_12px_40px_-18px_rgba(0,0,0,0.45)]">
      <Server size={52} className="text-foreground" strokeWidth={1.6} />
    </div>
  );
}
