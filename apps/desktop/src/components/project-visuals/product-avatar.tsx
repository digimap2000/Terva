import { convertFileSrc } from "@tauri-apps/api/core";
import {
  Bot,
  Cpu,
  HardDrive,
  MonitorSmartphone,
  Network,
  Radio,
  Speaker,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const productIconMap: Record<string, LucideIcon> = {
  device: Cpu,
  speaker: Speaker,
  display: MonitorSmartphone,
  robot: Bot,
  network: Network,
  radio: Radio,
  storage: HardDrive,
};

function initialsFor(value: string) {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) {
    return "TV";
  }

  return words
    .map((word) => word.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
}

export function ProductAvatar({
  productName,
  imagePath,
  categoryIcon,
  className,
}: {
  productName: string;
  imagePath?: string | null;
  categoryIcon?: string | null;
  className?: string;
}) {
  const fileSrc = imagePath?.trim() ? convertFileSrc(imagePath.trim()) : null;
  const Icon = productIconMap[categoryIcon?.trim().toLowerCase() ?? ""] ?? null;
  const initials = initialsFor(productName);

  return (
    <Avatar
      className={cn(
        "rounded-2xl border border-border/70 bg-background/80 shadow-sm backdrop-blur",
        className,
      )}
    >
      {fileSrc ? <AvatarImage src={fileSrc} alt={productName || "Product image"} /> : null}
      <AvatarFallback className="rounded-2xl bg-background/80 text-muted-foreground">
        {Icon ? <Icon className="size-[48%]" strokeWidth={1.8} /> : <span className="text-xs font-medium">{initials}</span>}
      </AvatarFallback>
    </Avatar>
  );
}

export const productCategoryIconOptions = [
  { id: "device", label: "Device", icon: Cpu },
  { id: "speaker", label: "Speaker", icon: Speaker },
  { id: "display", label: "Display", icon: MonitorSmartphone },
  { id: "robot", label: "Robot", icon: Bot },
  { id: "network", label: "Network", icon: Network },
  { id: "radio", label: "Radio", icon: Radio },
  { id: "storage", label: "Storage", icon: HardDrive },
] as const;
