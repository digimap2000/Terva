import {
  FlaskConical,
  Radar,
  DatabaseZap,
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
  { to: "/auth", icon: LockKeyhole, label: "Auth" },
  { to: "/behaviour", icon: Layers, label: "Behaviour" },
  { to: "/experimental", icon: FlaskConical, label: "Experimental" },
  { to: "/backends", icon: DatabaseZap, label: "Backends" },
  { to: "/server", icon: FileText, label: "Server" },
];

export const bottomActivities: ActivityItem[] = [
  { to: "/inspector", icon: Radar, label: "Inspector" },
  { to: "/theme", icon: Palette, label: "Theme" },
];

export const activities: ActivityItem[] = [...topActivities, ...bottomActivities];

export const projectActivity = activities.find((item) => item.to === "/project")!;
export const authActivity = activities.find((item) => item.to === "/auth")!;
export const behaviourActivity = activities.find((item) => item.to === "/behaviour")!;
export const backendsActivity = activities.find((item) => item.to === "/backends")!;
export const experimentalActivity = activities.find((item) => item.to === "/experimental")!;
export const serverActivity = activities.find((item) => item.to === "/server")!;
export const inspectorActivity = activities.find((item) => item.to === "/inspector")!;
