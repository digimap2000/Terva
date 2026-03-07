import type { ProjectDocument } from "@/lib/tauri";
import type { RuntimeState } from "@/hooks/useActiveProject";

interface StatusBarProps {
  activeProject: ProjectDocument | null;
  runtimeState: RuntimeState;
  serverUrl?: string | null;
}

function runtimePresentation(runtimeState: RuntimeState) {
  switch (runtimeState) {
    case "running":
      return {
        label: "Running",
        tone: "bg-emerald-500",
      };
    case "starting":
      return {
        label: "Starting",
        tone: "bg-amber-500",
      };
    case "stopping":
      return {
        label: "Stopping",
        tone: "bg-amber-500",
      };
    case "error":
      return {
        label: "Error",
        tone: "bg-destructive",
      };
    case "stopped":
      return {
        label: "Stopped",
        tone: "bg-muted-foreground/45",
      };
  }
}

export function StatusBar({
  activeProject,
  runtimeState,
  serverUrl,
}: StatusBarProps) {
  const runtime = runtimePresentation(runtimeState);

  return (
    <div className="flex h-8 shrink-0 items-center justify-between border-t bg-background px-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        <span>Single document workspace</span>
        <span className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${runtime.tone}`} />
          <span>Server {runtime.label}</span>
        </span>
        {serverUrl ? <span className="font-mono text-[11px]">{serverUrl}</span> : null}
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
