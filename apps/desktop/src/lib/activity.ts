import {
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

export const activities: ActivityItem[] = [
  { to: "/workspace", icon: House, label: "Workspace" },
  { to: "/project", icon: Settings2, label: "Project" },
  { to: "/behaviour", icon: Layers, label: "Behaviour" },
  { to: "/backends", icon: DatabaseZap, label: "Backends" },
  { to: "/auth", icon: LockKeyhole, label: "Auth" },
  { to: "/server", icon: FileText, label: "Server" },
  { to: "/theme", icon: Palette, label: "Theme" },
];

export const projectActivity = activities.find((item) => item.to === "/project")!;
export const behaviourActivity = activities.find((item) => item.to === "/behaviour")!;
