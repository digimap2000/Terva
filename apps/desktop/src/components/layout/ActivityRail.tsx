import { NavLink } from "react-router-dom";
import { Layers, Sun, Moon, Palette } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

interface ActivityItem {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
}

const activities: ActivityItem[] = [
  { to: "/", icon: Layers, label: "Project", end: true },
  { to: "/theme", icon: Palette, label: "Theme" },
];

interface ActivityRailProps {
  documentOpen: boolean;
}

export function ActivityRail({ documentOpen }: ActivityRailProps) {
  const { theme, toggle } = useTheme();

  return (
    <nav className="flex h-full w-20 flex-col bg-background">
      <div className="flex flex-1 flex-col items-center gap-1 p-2">
        {activities.map(({ to, icon: Icon, label, end }) => (
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
          )
        ))}
      </div>
      <div className="flex flex-col items-center p-2">
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
