import type { ProjectDocument } from "@/lib/tauri";

interface StatusBarProps {
  activeProject: ProjectDocument | null;
}

export function StatusBar({ activeProject }: StatusBarProps) {
  return (
    <div className="flex h-8 shrink-0 items-center justify-between border-t bg-background px-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        <span>Single document workspace</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="max-w-[28rem] truncate">
          {activeProject ? activeProject.path : "No project open"}
        </span>
        <span className="font-mono text-xs">v0.1.0</span>
      </div>
    </div>
  );
}
