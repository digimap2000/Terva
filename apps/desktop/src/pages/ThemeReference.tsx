import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Info,
  TriangleAlert,
  CircleX,
  Check,
  FileCode2,
  Layers,
} from "lucide-react";
import {
  BaselineServerVisual,
  ServerVisualFrame,
  SystemBridgeVisual,
} from "@/components/project-visuals/server-visuals";

// ── Colour swatch ───────────────────────────────────────────────────

interface SwatchProps {
  name: string;
  variable: string;
  className: string;
  foregroundClass?: string;
}

function Swatch({ name, variable, className, foregroundClass }: SwatchProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`size-10 shrink-0 rounded-lg border ${className}`}
      />
      <div className="min-w-0">
        <p className={`text-xs font-medium ${foregroundClass ?? "text-foreground"}`}>
          {name}
        </p>
        <p className="font-mono text-xs text-muted-foreground">{variable}</p>
      </div>
    </div>
  );
}

// ── Spacing scale ───────────────────────────────────────────────────

const SPACING = [0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16] as const;

function SpacingScale() {
  return (
    <div className="flex flex-col gap-1.5">
      {SPACING.map((s) => (
        <div key={s} className="flex items-center gap-3">
          <span className="w-8 text-right font-mono text-xs text-muted-foreground">
            {s}
          </span>
          <div
            className="h-3 rounded-sm bg-primary"
            style={{ width: `${s * 0.25}rem` }}
          />
          <span className="font-mono text-xs text-muted-foreground">
            {s * 0.25}rem
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Radius scale ────────────────────────────────────────────────────

function RadiusScale() {
  return (
    <div className="flex flex-wrap gap-3">
      {(
        [
          ["sm", "rounded-sm"],
          ["md", "rounded-md"],
          ["lg", "rounded-lg"],
          ["xl", "rounded-xl"],
          ["2xl", "rounded-2xl"],
          ["full", "rounded-full"],
        ] as const
      ).map(([label, cls]) => (
        <div key={label} className="flex flex-col items-center gap-1">
          <div
            className={`size-12 border-2 border-primary bg-secondary ${cls}`}
          />
          <span className="font-mono text-xs text-muted-foreground">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Typography samples ──────────────────────────────────────────────

function TypographySamples() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Root font size: 14px — all rem values resolve against this base.
      </p>
      {(
        [
          ["text-2xl font-bold", "2xl bold — Page heading", "1.5rem"],
          ["text-xl font-semibold", "xl semibold — Section heading", "1.25rem"],
          ["text-lg font-medium", "lg medium — Sub-heading", "1.125rem"],
          ["text-base", "base — Body text", "1rem"],
          ["text-sm", "sm — Secondary text", "0.875rem"],
          ["text-xs", "xs — Captions & labels", "0.75rem"],
        ] as const
      ).map(([cls, label, rem]) => (
        <div key={cls} className="flex items-baseline gap-3">
          <p className={`font-sans ${cls}`}>{label}</p>
          <span className="font-mono text-xs text-muted-foreground/50">{rem}</span>
        </div>
      ))}
      <Separator />
      <p className="text-xs text-muted-foreground">Monospace (Geist Mono)</p>
      {(
        [
          ["text-sm font-mono", "sm mono — Code / data", "0.875rem"],
          ["text-xs font-mono", "xs mono — IDs, hex, byte counts", "0.75rem"],
        ] as const
      ).map(([cls, label, rem]) => (
        <div key={cls} className="flex items-baseline gap-3">
          <p className={cls}>{label}</p>
          <span className="font-mono text-xs text-muted-foreground/50">{rem}</span>
        </div>
      ))}
    </div>
  );
}

function HexHubIcon() {
  return (
    <svg viewBox="0 0 160 160" className="relative size-30 text-foreground" fill="none">
      <path
        d="M80 20 126 46v52l-46 26-46-26V46l46-26Z"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <circle cx="80" cy="80" r="18" stroke="currentColor" strokeWidth="5" />
      <circle cx="80" cy="30" r="8" fill="currentColor" />
      <circle cx="122" cy="54" r="8" fill="currentColor" />
      <circle cx="122" cy="106" r="8" fill="currentColor" />
      <circle cx="80" cy="130" r="8" fill="currentColor" />
      <circle cx="38" cy="106" r="8" fill="currentColor" />
      <circle cx="38" cy="54" r="8" fill="currentColor" />
      <path d="M80 62V38M96 72l19-11M96 88l19 11M80 98v24M64 88 45 99M64 72 45 61" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function SparkCircuitIcon() {
  return (
    <svg viewBox="0 0 160 160" className="relative size-30 text-foreground" fill="none">
      <path d="M28 50h26l12 18h27l12-18h27" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 110h26l12-18h27l12 18h27" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="28" cy="50" r="8" fill="currentColor" />
      <circle cx="132" cy="50" r="8" fill="currentColor" />
      <circle cx="28" cy="110" r="8" fill="currentColor" />
      <circle cx="132" cy="110" r="8" fill="currentColor" />
      <path d="m78 28-16 30h18l-10 28 28-34H80l14-24Z" fill="currentColor" />
      <path d="M80 86v22" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function CompassNodeIcon() {
  return (
    <svg viewBox="0 0 160 160" className="relative size-30 text-foreground" fill="none">
      <circle cx="80" cy="80" r="50" stroke="currentColor" strokeWidth="5" />
      <circle cx="80" cy="80" r="10" fill="currentColor" />
      <path d="M80 26v18M80 116v18M26 80h18M116 80h18" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="m98 62-12 30-30 12 12-30 30-12Z" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
      <circle cx="120" cy="40" r="8" fill="currentColor" />
      <path d="M108 48 96 60" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function ToolboxGeometryIcon() {
  return (
    <svg viewBox="0 0 160 160" className="relative size-30 text-foreground" fill="none">
      <path d="M34 58h92c8 0 14 6 14 14v42c0 8-6 14-14 14H34c-8 0-14-6-14-14V72c0-8 6-14 14-14Z" stroke="currentColor" strokeWidth="5" />
      <path d="M58 58V46c0-8 6-14 14-14h16c8 0 14 6 14 14v12" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M20 86h120" stroke="currentColor" strokeWidth="5" />
      <circle cx="54" cy="104" r="10" stroke="currentColor" strokeWidth="5" />
      <path d="M80 94h20l-10 18H70l10-18Z" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
      <rect x="110" y="96" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="5" />
    </svg>
  );
}

function CandidateCard({
  name,
  summary,
  children,
}: {
  name: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 p-5">
      <div className="flex flex-col items-center">
        <ServerVisualFrame>{children}</ServerVisualFrame>
        <div className="mt-5 text-center">
          <div className="text-sm font-medium text-foreground">{name}</div>
          <div className="mt-1 max-w-xs text-xs leading-6 text-muted-foreground">
            {summary}
          </div>
        </div>
      </div>
    </div>
  );
}

function DeviceStage({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[2rem] border border-white/6 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.08),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01)),linear-gradient(180deg,#111214,#191a1d)] px-6 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_28px_70px_-40px_rgba(0,0,0,0.85)]">
      <div className="flex min-h-[18rem] items-center justify-center">{children}</div>
    </div>
  );
}

function DeviceCaption({
  name,
  note,
}: {
  name: string;
  note: string;
}) {
  return (
    <div className="mt-5 text-center">
      <div className="font-serif text-xl tracking-[0.02em] text-white/92">{name}</div>
      <div className="mt-1 text-sm text-white/55">{note}</div>
    </div>
  );
}

function DeviceRenderCard({
  name,
  note,
  children,
}: {
  name: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[2.25rem] border border-border/50 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.06),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0)),linear-gradient(180deg,#1a1b1f,#1e2024)] p-6 shadow-[0_36px_90px_-50px_rgba(0,0,0,0.95)]">
      <DeviceStage>{children}</DeviceStage>
      <DeviceCaption name={name} note={note} />
    </div>
  );
}

function RenderShelf() {
  return (
    <div className="relative h-6 w-[16rem] rounded-full bg-[radial-gradient(circle_at_50%_0%,rgba(34,197,94,0.45),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0))] opacity-70 blur-[1px]" />
  );
}

function RenderBox({
  className = "",
  glow = true,
  led = true,
}: {
  className?: string;
  glow?: boolean;
  led?: boolean;
}) {
  return (
    <div className="relative flex flex-col items-center">
      <div
        className={`absolute left-1/2 top-[72%] h-8 w-[72%] -translate-x-1/2 rounded-full bg-black/70 blur-xl ${glow ? "opacity-100" : "opacity-70"}`}
      />
      <div
        className={`relative overflow-hidden border border-white/6 bg-[radial-gradient(circle_at_50%_5%,rgba(255,255,255,0.14),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015)_30%,rgba(0,0,0,0.32)_100%),linear-gradient(135deg,#202124_0%,#08090b_55%,#050607_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.09),inset_24px_0_60px_rgba(255,255,255,0.015),inset_-18px_-30px_80px_rgba(0,0,0,0.65),0_18px_40px_-24px_rgba(0,0,0,0.9)] ${className}`}
      >
        <div className="pointer-events-none absolute inset-x-[8%] top-[8%] h-px bg-white/18" />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[12%] bg-linear-to-r from-white/8 to-transparent opacity-40" />
        {led ? (
          <div className="absolute bottom-[7%] left-1/2 h-[2px] w-[32%] -translate-x-1/2 rounded-full bg-emerald-400/90 shadow-[0_0_10px_rgba(74,222,128,0.65)]" />
        ) : null}
      </div>
    </div>
  );
}

function SlabRender() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <div className="absolute inset-x-[10%] top-[-10px] h-10 bg-white/8 blur-2xl" />
        <div className="h-0 w-[20rem] border-r-[18px] border-b-[26px] border-l-[18px] border-r-transparent border-b-[#0a0b0d] border-l-transparent drop-shadow-[0_8px_14px_rgba(0,0,0,0.7)]" />
        <RenderBox className="h-4 w-[20rem] rounded-b-[0.9rem]" />
      </div>
      <RenderShelf />
    </div>
  );
}

function ConceptCard({
  name,
  note,
  children,
}: {
  name: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[2.25rem] border border-border/50 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.06),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0)),linear-gradient(180deg,#1a1b1f,#1e2024)] p-6 shadow-[0_36px_90px_-50px_rgba(0,0,0,0.95)]">
      <DeviceStage>{children}</DeviceStage>
      <DeviceCaption name={name} note={note} />
    </div>
  );
}

function GhostBlueprintConcept() {
  return (
    <svg viewBox="0 0 320 190" className="h-[12rem] w-[20rem] text-white/70" fill="none">
      <rect x="50" y="64" width="220" height="62" rx="14" stroke="currentColor" strokeWidth="2" strokeOpacity="0.45" />
      <path d="M64 64h192l16-16H80l-16 16Z" stroke="currentColor" strokeWidth="2" strokeOpacity="0.34" />
      <path d="M82 93h156" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.22" strokeDasharray="6 6" />
      <path d="M95 126v20M225 126v20" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.18" />
      <path d="M54 146h212" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.15" />
      <circle cx="160" cy="95" r="44" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.14" strokeDasharray="4 8" />
      <path d="M96 24v24M96 36h104" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.35" />
      <path d="M224 24v24M120 36h104" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.22" />
      <path d="M160 126v18" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

function GhostOutlineConcept() {
  return (
    <svg viewBox="0 0 320 190" className="h-[12rem] w-[20rem] text-white/70" fill="none">
      <rect x="60" y="72" width="200" height="46" rx="14" stroke="currentColor" strokeWidth="2" strokeOpacity="0.42" />
      <path d="M78 72h164l14-14H92l-14 14Z" stroke="currentColor" strokeWidth="2" strokeOpacity="0.28" />
      <path d="M95 118v14M225 118v14" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.18" />
      <path d="M70 134h180" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.14" />
      <path d="M160 118v14" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

function GhostMeasuredConcept() {
  return (
    <svg viewBox="0 0 320 190" className="h-[12rem] w-[20rem] text-white/70" fill="none">
      <rect x="54" y="68" width="212" height="54" rx="13" stroke="currentColor" strokeWidth="2" strokeOpacity="0.42" />
      <path d="M68 68h184l14-14H82l-14 14Z" stroke="currentColor" strokeWidth="2" strokeOpacity="0.32" />
      <path d="M86 92h148" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.18" strokeDasharray="5 6" />
      <path d="M76 42v20M244 42v20" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.22" />
      <path d="M76 52h168" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.18" />
      <path d="M54 144h34M232 144h34" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.18" />
      <path d="M88 132v20M232 132v20" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.18" />
      <text x="58" y="39" fill="currentColor" fillOpacity="0.32" fontSize="10">W</text>
      <text x="247" y="39" fill="currentColor" fillOpacity="0.32" fontSize="10">D</text>
      <path d="M160 122v18" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

function GhostTopologyConcept() {
  return (
    <svg viewBox="0 0 320 190" className="h-[12rem] w-[20rem] text-white/70" fill="none">
      <rect x="74" y="76" width="172" height="42" rx="12" stroke="currentColor" strokeWidth="2" strokeOpacity="0.38" />
      <path d="M88 76h144l12-12H100l-12 12Z" stroke="currentColor" strokeWidth="2" strokeOpacity="0.28" />
      <circle cx="118" cy="97" r="7" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.22" />
      <circle cx="160" cy="97" r="7" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.22" />
      <circle cx="202" cy="97" r="7" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.22" />
      <path d="M125 97h28M167 97h28" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.18" />
      <path d="M160 48v18M96 140v14M224 140v14" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.18" />
      <path d="M160 54h46" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.18" />
      <path d="M160 118v18" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

function GhostSectionConcept() {
  return (
    <svg viewBox="0 0 320 190" className="h-[12rem] w-[20rem] text-white/70" fill="none">
      <rect x="60" y="70" width="200" height="52" rx="13" stroke="currentColor" strokeWidth="2" strokeOpacity="0.42" />
      <path d="M74 70h172l14-14H88l-14 14Z" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
      <path d="M132 70v52M188 70v52" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.16" strokeDasharray="4 6" />
      <path d="M72 96h176" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.12" />
      <path d="M88 134h144" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.18" />
      <path d="M104 40v18M216 40v18" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.18" />
      <path d="M104 46h112" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.14" />
      <path d="M160 122v18" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

function GhostAssemblyConcept() {
  return (
    <svg viewBox="0 0 320 190" className="h-[12rem] w-[20rem] text-white/70" fill="none">
      <rect x="66" y="80" width="188" height="38" rx="11" stroke="currentColor" strokeWidth="2" strokeOpacity="0.38" />
      <path d="M84 80h152l12-10H96L84 80Z" stroke="currentColor" strokeWidth="2" strokeOpacity="0.26" />
      <rect x="96" y="58" width="42" height="14" rx="5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.18" />
      <rect x="182" y="58" width="42" height="14" rx="5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.18" />
      <path d="M117 72v8M203 72v8" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.18" />
      <path d="M74 132h172" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.16" />
      <path d="M108 118v18M212 118v18" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.18" />
      <path d="M160 118v18" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

export function ThemeReference() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="px-6 pt-6 pb-2">
        <h1 className="text-xl font-semibold">Theme Reference</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Design tokens, colour palette, spacing, typography, and component
          variants for the current theme.
        </p>
      </div>

      <Tabs defaultValue="colours" className="flex min-h-0 flex-1 flex-col">
        <div className="px-6">
          <TabsList variant="line">
            <TabsTrigger value="colours">Colours</TabsTrigger>
            <TabsTrigger value="typography">Typography</TabsTrigger>
            <TabsTrigger value="spacing">Spacing</TabsTrigger>
            <TabsTrigger value="components">Components</TabsTrigger>
            <TabsTrigger value="icons">Icons</TabsTrigger>
            <TabsTrigger value="renders">Renders</TabsTrigger>
            <TabsTrigger value="semantic">Semantic</TabsTrigger>
            <TabsTrigger value="variables">Variables</TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="p-6">
            {/* ── Colours ──────────────────────────────────────── */}
            <TabsContent value="colours" className="mt-0 space-y-6">
              <div>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                  Core
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Swatch name="Background" variable="--background" className="bg-background" />
                  <Swatch name="Foreground" variable="--foreground" className="bg-foreground" foregroundClass="text-foreground" />
                  <Swatch name="Card" variable="--card" className="bg-card" />
                  <Swatch name="Surface" variable="--surface" className="bg-surface" />
                  <Swatch name="Border" variable="--border" className="bg-border" />
                  <Swatch name="Input" variable="--input" className="bg-input" />
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                  Semantic
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Swatch name="Primary" variable="--primary" className="bg-primary" />
                  <Swatch name="Primary FG" variable="--primary-foreground" className="bg-primary-foreground" />
                  <Swatch name="Secondary" variable="--secondary" className="bg-secondary" />
                  <Swatch name="Secondary FG" variable="--secondary-foreground" className="bg-secondary-foreground" />
                  <Swatch name="Muted" variable="--muted" className="bg-muted" />
                  <Swatch name="Muted FG" variable="--muted-foreground" className="bg-muted-foreground" />
                  <Swatch name="Accent" variable="--accent" className="bg-accent" />
                  <Swatch name="Destructive" variable="--destructive" className="bg-destructive" />
                  <Swatch name="Warning" variable="--warning" className="bg-warning" />
                  <Swatch name="Success" variable="--success" className="bg-success" />
                  <Swatch name="Ring" variable="--ring" className="bg-ring" />
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                  Sidebar
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Swatch name="Sidebar" variable="--sidebar" className="bg-sidebar" />
                  <Swatch name="Sidebar FG" variable="--sidebar-foreground" className="bg-sidebar-foreground" />
                  <Swatch name="Sidebar Primary" variable="--sidebar-primary" className="bg-sidebar-primary" />
                  <Swatch name="Sidebar Accent" variable="--sidebar-accent" className="bg-sidebar-accent" />
                  <Swatch name="Sidebar Border" variable="--sidebar-border" className="bg-sidebar-border" />
                </div>
              </div>
            </TabsContent>

            {/* ── Typography ────────────────────────────────────── */}
            <TabsContent value="typography" className="mt-0">
              <TypographySamples />
            </TabsContent>

            {/* ── Spacing & Radius ──────────────────────────────── */}
            <TabsContent value="spacing" className="mt-0 space-y-8">
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Spacing Scale
                </h3>
                <p className="text-xs text-muted-foreground">
                  Tailwind spacing units (1 unit = 0.25rem = 3.5px at 14px root)
                </p>
                <SpacingScale />
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Border Radius
                </h3>
                <RadiusScale />
              </div>
            </TabsContent>

            {/* ── Components ────────────────────────────────────── */}
            <TabsContent value="components" className="mt-0 space-y-8">
              {/* Buttons */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Buttons
                </h3>
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">Variants</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button>Default</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="destructive">Destructive</Button>
                    <Button variant="link">Link</Button>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">Sizes</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="lg">Large</Button>
                    <Button size="default">Default</Button>
                    <Button size="sm">Small</Button>
                    <Button size="xs">XS</Button>
                    <Button size="icon"><Layers size={16} /></Button>
                    <Button size="icon-xs"><FileCode2 size={14} /></Button>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">States</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button>Enabled</Button>
                    <Button disabled>Disabled</Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Badges */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Badges
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="outline">Outline</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                  <Badge className="bg-warning text-warning-foreground">Warning</Badge>
                </div>
              </div>

              <Separator />

              {/* Form Controls */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Form Controls
                </h3>
                <div className="grid max-w-md grid-cols-1 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Input
                    </label>
                    <Input placeholder="Placeholder text..." />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Input (disabled)
                    </label>
                    <Input placeholder="Disabled" disabled />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Select
                    </label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an option..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="a">Option A</SelectItem>
                        <SelectItem value="b">Option B</SelectItem>
                        <SelectItem value="c">Option C</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Tabs demo */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Tabs
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Default (pill)
                    </p>
                    <Tabs defaultValue="one">
                      <TabsList>
                        <TabsTrigger value="one">Tab One</TabsTrigger>
                        <TabsTrigger value="two">Tab Two</TabsTrigger>
                        <TabsTrigger value="three">Tab Three</TabsTrigger>
                      </TabsList>
                      <TabsContent value="one">
                        <p className="p-2 text-sm text-muted-foreground">
                          Default tab content
                        </p>
                      </TabsContent>
                    </Tabs>
                  </div>
                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Line variant
                    </p>
                    <Tabs defaultValue="one">
                      <TabsList variant="line">
                        <TabsTrigger value="one">Tab One</TabsTrigger>
                        <TabsTrigger value="two">Tab Two</TabsTrigger>
                        <TabsTrigger value="three">Tab Three</TabsTrigger>
                      </TabsList>
                      <TabsContent value="one">
                        <p className="p-2 text-sm text-muted-foreground">
                          Line variant tab content
                        </p>
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── Icons ─────────────────────────────────────────── */}
            <TabsContent value="icons" className="mt-0 space-y-8">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Project Visualization Concepts
                </h3>
                <p className="text-xs leading-6 text-muted-foreground">
                  Candidate hero marks for the Project view. Each one is shown inside
                  the current Streamable HTTP framing so you can judge the symbol,
                  not just the raw SVG.
                </p>
              </div>

              <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
                <CandidateCard
                  name="Hexagonal Hub"
                  summary="A central control hub with explicit endpoints. Feels infrastructural and network-native."
                >
                  <HexHubIcon />
                </CandidateCard>

                <CandidateCard
                  name="System Bridge"
                  summary="Two systems joined by a deliberate bridge. Clearest expression of device-to-MCP mediation."
                >
                  <SystemBridgeVisual />
                </CandidateCard>

                <CandidateCard
                  name="Spark Circuit"
                  summary="A pulse moving through a circuit path. More dynamic and operational than static."
                >
                  <SparkCircuitIcon />
                </CandidateCard>

                <CandidateCard
                  name="Compass Node"
                  summary="Directional and exploratory, with a node/discovery feel. Good if the product leans orchestration."
                >
                  <CompassNodeIcon />
                </CandidateCard>

                <CandidateCard
                  name="Toolbox Geometry"
                  summary="Constructive and configurable. Feels like an instrument for shaping behavior rather than a server appliance."
                >
                  <ToolboxGeometryIcon />
                </CandidateCard>

                <CandidateCard
                  name="Current Baseline"
                  summary="The existing generic server symbol for comparison against the new directions."
                >
                  <BaselineServerVisual />
                </CandidateCard>
              </div>

              <Separator />

              <div>
                <p className="mb-4 text-xs text-muted-foreground">
                  Lucide React baseline sizes
                </p>
                <div className="flex flex-wrap items-end gap-4">
                  {(
                    [
                      ["14px", 14],
                      ["16px", 16],
                      ["20px", 20],
                      ["24px", 24],
                    ] as const
                  ).map(([label, size]) => (
                    <div key={label} className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2 text-foreground">
                        <Info size={size} />
                        <TriangleAlert size={size} />
                        <CircleX size={size} />
                        <Check size={size} />
                        <Layers size={size} />
                        <FileCode2 size={size} />
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="renders" className="mt-0 space-y-8">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Product Representation Studies
                </h3>
                <p className="max-w-3xl text-xs leading-6 text-muted-foreground">
                  The strongest direction so far is a ghosted technical placeholder for
                  an unknown external product. This set explores that language from very
                  simple outlines through to richer assembly and topology hints.
                </p>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <DeviceRenderCard
                  name="Low Slab"
                  note="Broad, restrained, and shelf-like with a single operational hint."
                >
                  <SlabRender />
                </DeviceRenderCard>

                <ConceptCard
                  name="Ghost Outline"
                  note="The most reduced version: one quiet contour and a small operational cue."
                >
                  <GhostOutlineConcept />
                </ConceptCard>

                <ConceptCard
                  name="Ghost Blueprint"
                  note="A balanced middle ground with just enough construction detail to imply a real object."
                >
                  <GhostBlueprintConcept />
                </ConceptCard>

                <ConceptCard
                  name="Ghost Measured"
                  note="Adds a few dimension lines and callout hints without turning into a full engineering drawing."
                >
                  <GhostMeasuredConcept />
                </ConceptCard>

                <ConceptCard
                  name="Ghost Topology"
                  note="Suggests internal arrangement or logical zones, useful when the product matters more as a system than a chassis."
                >
                  <GhostTopologyConcept />
                </ConceptCard>

                <ConceptCard
                  name="Ghost Section"
                  note="Uses sectional lines and internal partitions to feel more technical while staying abstract."
                >
                  <GhostSectionConcept />
                </ConceptCard>

                <ConceptCard
                  name="Ghost Assembly"
                  note="The richest version here, with small sub-assemblies and alignment hints for a more instrument-like feel."
                >
                  <GhostAssemblyConcept />
                </ConceptCard>
              </div>
            </TabsContent>

            {/* ── Semantic ──────────────────────────────────────── */}
            <TabsContent value="semantic" className="mt-0 space-y-8">
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Colours in Context
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-md bg-secondary p-3">
                    <Info size={14} className="shrink-0 text-primary" />
                    <p className="text-xs">
                      <span className="font-medium text-foreground">Info</span>{" "}
                      <span className="text-muted-foreground">
                        — Primary accent on secondary background
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-md bg-warning/10 p-3">
                    <TriangleAlert
                      size={14}
                      className="shrink-0 text-warning"
                    />
                    <p className="text-xs">
                      <span className="font-medium text-warning">Warning</span>{" "}
                      <span className="text-muted-foreground">
                        — Warning on warning/10 background
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3">
                    <CircleX size={14} className="shrink-0 text-destructive" />
                    <p className="text-xs">
                      <span className="font-medium text-destructive">Error</span>{" "}
                      <span className="text-muted-foreground">
                        — Destructive on destructive/10 background
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-md bg-success/10 p-3">
                    <Check size={14} className="shrink-0 text-success" />
                    <p className="text-xs">
                      <span className="font-medium text-success">Success</span>{" "}
                      <span className="text-muted-foreground">
                        — Success on success/10 background
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Text Opacity Levels
                </h3>
                <div className="space-y-1">
                  <p className="text-sm text-foreground">
                    foreground — Primary text
                  </p>
                  <p className="text-sm text-foreground/80">
                    foreground/80 — Secondary emphasis
                  </p>
                  <p className="text-sm text-muted-foreground">
                    muted-foreground — De-emphasised labels
                  </p>
                  <p className="text-sm text-muted-foreground/70">
                    muted-foreground/70 — Hints and examples
                  </p>
                  <p className="text-sm text-muted-foreground/50">
                    muted-foreground/50 — Offsets, byte counts
                  </p>
                  <p className="text-sm text-muted-foreground/40">
                    muted-foreground/40 — Placeholder / empty state
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* ── Variables ─────────────────────────────────────── */}
            <TabsContent value="variables" className="mt-0 space-y-4">
              <p className="text-xs text-muted-foreground">
                Computed values from the current theme
              </p>
              <CssVariablesDump />
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

// ── Live CSS variable reader ────────────────────────────────────────

const CSS_VARS = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--destructive-foreground",
  "--warning",
  "--warning-foreground",
  "--success",
  "--success-foreground",
  "--border",
  "--input",
  "--ring",
  "--surface",
  "--radius",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
] as const;

function CssVariablesDump() {
  const style = getComputedStyle(document.documentElement);

  return (
    <div className="overflow-x-auto rounded-md bg-secondary/50 px-3 py-2">
      <pre className="font-mono text-xs leading-relaxed">
        {CSS_VARS.map((v) => {
          const val = style.getPropertyValue(v).trim() || "(not set)";
          return (
            <div key={v} className="flex">
              <span className="text-muted-foreground/70">{v}:</span>
              <span className="ml-2 text-foreground/80">{val}</span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}
