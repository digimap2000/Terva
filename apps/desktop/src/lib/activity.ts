import {
  FlaskConical,
  Radar,
  FileText,
  House,
  Layers,
  LockKeyhole,
  Palette,
  Settings2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ActivityItem {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
}

export const topActivities: ActivityItem[] = [
  { to: "/workspace", icon: House, label: "Workspace" },
  { to: "/project", icon: Settings2, label: "Project" },
  { to: "/endpoints", icon: Layers, label: "Endpoints" },
  { to: "/auth", icon: LockKeyhole, label: "Auth" },
  { to: "/labs", icon: FlaskConical, label: "Labs" },
  { to: "/server", icon: FileText, label: "Server" },
];

export const bottomActivities: ActivityItem[] = [
  { to: "/inspector", icon: Radar, label: "Inspector" },
  { to: "/theme", icon: Palette, label: "Theme" },
];

export const activities: ActivityItem[] = [...topActivities, ...bottomActivities];

export const projectActivity = activities.find((item) => item.to === "/project")!;
export const authActivity = activities.find((item) => item.to === "/auth")!;
export const behaviourActivity = activities.find((item) => item.to === "/endpoints")!;
export const experimentalActivity = activities.find((item) => item.to === "/labs")!;
export const serverActivity = activities.find((item) => item.to === "/server")!;
export const inspectorActivity = activities.find((item) => item.to === "/inspector")!;
