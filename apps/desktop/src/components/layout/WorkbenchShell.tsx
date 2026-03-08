import { useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

interface WorkbenchShellProps {
  sidebarStorageKey: string;
  sidebarTitle: string;
  sidebarDescription?: string;
  sidebarIcon: LucideIcon;
  sidebarContent: ReactNode;
  sidebarFooter?: ReactNode;
  mainContent: ReactNode;
  bottomContent?: ReactNode;
  sidebarDefaultSize?: string;
  sidebarMinSize?: string;
  sidebarMaxSize?: string;
  bottomDefaultSize?: number;
  bottomMinSize?: number;
  contentClassName?: string;
  mainClassName?: string;
}

function readSavedSidebarSize(
  storageKey: string,
  fallback: string,
  minSize: string,
  maxSize: string,
) {
  const stored = localStorage.getItem(storageKey);
  if (!stored) {
    return fallback;
  }

  const parsed = parseFloat(stored);
  const min = parseFloat(minSize);
  const max = parseFloat(maxSize);

  if (!Number.isNaN(parsed) && parsed >= min && parsed <= max) {
    return `${parsed}%`;
  }

  return fallback;
}

export function WorkbenchShell({
  sidebarStorageKey,
  sidebarTitle,
  sidebarDescription,
  sidebarIcon: SidebarIcon,
  sidebarContent,
  sidebarFooter,
  mainContent,
  bottomContent,
  sidebarDefaultSize = "24%",
  sidebarMinSize = "18%",
  sidebarMaxSize = "36%",
  bottomDefaultSize = 28,
  bottomMinSize = 18,
  contentClassName,
  mainClassName,
}: WorkbenchShellProps) {
  const panelRef = useRef<PanelImperativeHandle | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarSize] = useState(() =>
    readSavedSidebarSize(
      sidebarStorageKey,
      sidebarDefaultSize,
      sidebarMinSize,
      sidebarMaxSize,
    ),
  );

  function toggleSidebar() {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    if (panel.isCollapsed()) {
      panel.expand();
      setSidebarOpen(true);
    } else {
      panel.collapse();
      setSidebarOpen(false);
    }
  }

  function handleLayoutChanged(layout: Record<string, number>) {
    const size = layout["workbench-sidebar"];
    if (size != null && size > 0) {
      localStorage.setItem(sidebarStorageKey, String(size));
    }
  }

  const rightSide = bottomContent ? (
    <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
      <ResizablePanel id="workbench-main" defaultSize={100 - bottomDefaultSize} minSize={42}>
        <div className={cn("min-h-0 h-full", mainClassName)}>{mainContent}</div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel
        id="workbench-bottom"
        defaultSize={bottomDefaultSize}
        minSize={bottomMinSize}
      >
        {bottomContent}
      </ResizablePanel>
    </ResizablePanelGroup>
  ) : (
    <div className={cn("min-h-0 flex-1", mainClassName)}>{mainContent}</div>
  );

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      onLayoutChanged={handleLayoutChanged}
      className="min-h-0 flex-1"
    >
      <ResizablePanel
        id="workbench-sidebar"
        panelRef={panelRef}
        defaultSize={sidebarSize}
        minSize={sidebarMinSize}
        maxSize={sidebarMaxSize}
        collapsible
        collapsedSize={0}
        onResize={(size) => {
          setSidebarOpen(size.asPercentage > 0.5);
        }}
      >
        <aside className="flex h-full min-h-0 flex-col overflow-hidden border-r border-border/70 bg-sidebar/35">
          <div className="border-b border-border/60 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-md text-muted-foreground">
                <SidebarIcon size={17} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">{sidebarTitle}</div>
                {sidebarDescription ? (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {sidebarDescription}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">{sidebarContent}</div>

          {sidebarFooter ? (
            <div className="border-t border-border/60 px-4 py-3">{sidebarFooter}</div>
          ) : null}
        </aside>
      </ResizablePanel>

      <ResizableHandle />

      <ResizablePanel id="workbench-content" defaultSize="76%">
        <div
          className={cn(
            "flex h-full min-h-0 flex-col gap-6 overflow-hidden p-6",
            contentClassName,
          )}
        >
          <div className="flex h-10 items-center">
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
            </button>
          </div>

          {rightSide}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
