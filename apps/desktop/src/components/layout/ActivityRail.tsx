import { NavLink } from "react-router-dom";
import {
  FileText,
  Layers,
  Moon,
  Palette,
  Play,
  Square,
  Sun,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import type { RuntimeState } from "@/hooks/useActiveProject";

interface ActivityItem {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
}

const activities: ActivityItem[] = [
  { to: "/", icon: Layers, label: "Project", end: true },
  { to: "/logs", icon: FileText, label: "Log" },
  { to: "/theme", icon: Palette, label: "Theme" },
];

interface ActivityRailProps {
  documentOpen: boolean;
  runtimeState: RuntimeState;
  onToggleRuntime: () => void;
}

function runtimeLabel(runtimeState: RuntimeState) {
  switch (runtimeState) {
    case "running":
      return "Stop";
    case "starting":
      return "Start";
    case "stopping":
      return "Stop";
    case "error":
      return "Retry";
    case "stopped":
      return "Start";
  }
}

export function ActivityRail({
  documentOpen,
  runtimeState,
  onToggleRuntime,
}: ActivityRailProps) {
  const { theme, toggle } = useTheme();
  const runtimeBusy = runtimeState === "starting" || runtimeState === "stopping";
  const runtimeRunning = runtimeState === "running";
  const RuntimeIcon = runtimeRunning ? Square : Play;

  return (
    <nav className="flex h-full w-20 flex-col bg-background">
      <div className="flex flex-1 flex-col items-center gap-1 p-2">
        {activities.map(({ to, icon: Icon, label, end }) =>
          documentOpen ? (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  "flex w-full flex-col items-center gap-1 rounded-md px-2 py-3 transition-colors",
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50",
                ].join(" ")
              }
            >
              <Icon size={16} />
              <span className="text-xs font-medium">{label}</span>
            </NavLink>
          ) : (
            <button
              key={to}
              type="button"
              disabled
              className="flex w-full flex-col items-center gap-1 rounded-md px-2 py-3 text-muted-foreground/35"
              title="Open a Terva project to enable workspace tools"
            >
              <Icon size={16} />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ),
        )}
      </div>
      <div className="flex flex-col items-center gap-1 p-2">
        <button
          type="button"
          onClick={onToggleRuntime}
          disabled={!documentOpen || runtimeBusy}
          className={[
            "relative flex w-full flex-col items-center gap-1 rounded-md px-2 py-3 transition-colors",
            documentOpen
              ? "text-foreground hover:bg-secondary/50"
              : "text-muted-foreground/35",
          ].join(" ")}
          title={
            documentOpen
              ? runtimeRunning
                ? "Stop the linked Terva runtime"
                : "Start the linked Terva runtime"
              : "Open a Terva project to enable runtime controls"
          }
        >
          <span
            className={[
              "absolute right-2 top-2 size-2 rounded-full",
              runtimeRunning ? "bg-emerald-500" : "bg-muted-foreground/40",
            ].join(" ")}
          />
          <RuntimeIcon size={16} />
          <span className="text-xs font-medium">{runtimeLabel(runtimeState)}</span>
        </button>
        <button
          type="button"
          onClick={toggle}
          className="flex w-full flex-col items-center gap-1 rounded-md px-2 py-3 text-muted-foreground transition-colors hover:bg-secondary/50"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          <span className="text-xs font-medium">Theme</span>
        </button>
      </div>
    </nav>
  );
}
