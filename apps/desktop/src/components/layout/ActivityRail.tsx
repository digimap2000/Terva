import { NavLink } from "react-router-dom";
import {
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import type { RuntimeState } from "@/hooks/useActiveProject";
import { bottomActivities, topActivities } from "@/lib/activity";

interface ActivityRailProps {
  documentOpen: boolean;
  runtimeState: RuntimeState;
}

export function ActivityRail({
  documentOpen,
  runtimeState: _runtimeState,
}: ActivityRailProps) {
  const { theme, toggle } = useTheme();
  const availableWithoutProject = new Set(["/workspace", "/inspector"]);
  const renderItem = ({ to, icon: Icon, label, end }: (typeof topActivities)[number]) =>
    documentOpen || availableWithoutProject.has(to) ? (
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
    );

  return (
    <nav className="flex h-full w-20 flex-col bg-background">
      <div className="flex flex-1 flex-col items-center gap-1 p-2">
        {topActivities.map(renderItem)}
      </div>
      <div className="flex flex-col items-center gap-1 p-2">
        {bottomActivities.map(renderItem)}
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
