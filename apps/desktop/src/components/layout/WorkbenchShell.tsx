import { useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronsUpDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useWorkspaceMenu } from "@/components/layout/WorkspaceMenuContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type MainContentRenderer = (sidebarToggle: ReactNode) => ReactNode;

interface WorkbenchShellProps {
  sidebarStorageKey: string;
  sidebarTitle: string;
  sidebarDescription?: string;
  sidebarIcon: LucideIcon;
  sidebarContent: ReactNode;
  sidebarFooter?: ReactNode;
  sidebarHeaderMenu?: ReactNode;
  mainContent: ReactNode | MainContentRenderer;
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
  sidebarDescription: _sidebarDescription,
  sidebarIcon: SidebarIcon,
  sidebarContent,
  sidebarFooter,
  sidebarHeaderMenu,
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
  const workspaceMenu = useWorkspaceMenu();
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

  const sidebarToggle = (
    <button
      type="button"
      onClick={toggleSidebar}
      className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
    >
      {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
    </button>
  );

  const renderedMainContent =
    typeof mainContent === "function"
      ? (mainContent as MainContentRenderer)(sidebarToggle)
      : mainContent;

  const rightSide = bottomContent ? (
    <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
      <ResizablePanel id="workbench-main" defaultSize={100 - bottomDefaultSize} minSize={42}>
        <div className={cn("min-h-0 h-full", mainClassName)}>{renderedMainContent}</div>
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
    <div className={cn("min-h-0 flex-1", mainClassName)}>{renderedMainContent}</div>
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
        <aside className="flex h-full min-h-0 flex-col border-r border-border/70 bg-sidebar/35">
          <div className="px-4 py-4">
            {sidebarHeaderMenu ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 rounded-2xl bg-secondary/35 px-4 py-4 text-left transition-colors hover:bg-secondary/55"
                  >
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-foreground shadow-sm">
                      <SidebarIcon size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                        {sidebarTitle}
                      </div>
                      <div className="mt-1 truncate text-sm font-medium text-foreground">
                        {workspaceMenu?.activeProjectName ?? "No project open"}
                      </div>
                    </div>
                    <ChevronsUpDown size={16} className="mt-1 shrink-0 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="right"
                  align="start"
                  sideOffset={12}
                  className="w-[22rem] rounded-3xl border-border/70 bg-background/98 p-3 shadow-[0_24px_80px_-30px_rgba(0,0,0,0.5)] backdrop-blur"
                >
                  {sidebarHeaderMenu}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex w-full items-start gap-3 rounded-2xl bg-secondary/35 px-4 py-4 text-left">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-foreground shadow-sm">
                  <SidebarIcon size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    {sidebarTitle}
                  </div>
                  <div className="mt-1 truncate text-sm font-medium text-foreground">
                    {workspaceMenu?.activeProjectName ?? sidebarTitle}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">{sidebarContent}</div>

          {sidebarFooter ? (
            <div className="border-t border-border/60 px-4 py-3">{sidebarFooter}</div>
          ) : null}
        </aside>
      </ResizablePanel>

      <ResizableHandle />

      <ResizablePanel id="workbench-content" defaultSize="76%" className="relative z-0">
        <div
          className={cn(
            "flex h-full min-h-0 flex-col overflow-hidden p-6",
            contentClassName,
          )}
        >
          {rightSide}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
