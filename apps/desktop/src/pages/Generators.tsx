import { useCallback, useState } from "react";
import {
  ChevronDown,
  EllipsisVertical,
  FileCode2,
  Layers,
  NotebookTabs,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CapLabel } from "@/components/ui/cap-label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface WorkspaceItem {
  id: string;
  name: string;
  summary: string;
}

const INITIAL_CAPABILITIES: WorkspaceItem[] = [
  {
    id: "power",
    name: "Streamer power control",
    summary: "Verified active and standby transitions for the real device.",
  },
  {
    id: "session",
    name: "Playback session readback",
    summary: "Normalized session output built from the streamer HTTP API.",
  },
];

const INITIAL_BACKENDS: WorkspaceItem[] = [
  {
    id: "streamer",
    name: "streamer",
    summary: "Explicit localhost HTTP backend mapping to the target product.",
  },
];

const INITIAL_PRIMERS: WorkspaceItem[] = [
  {
    id: "cpp",
    name: "C++ core primer",
    summary: "Deterministic execution, narrow APIs, and DTS-first integration.",
  },
  {
    id: "rust",
    name: "Rust desktop primer",
    summary: "Thin Tauri commands and no business logic in the shell.",
  },
];

const actionButtonClass =
  "flex size-5 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground";

interface SectionHeadingProps {
  title: string;
  onAdd?: () => void;
}

function SectionHeading({ title, onAdd }: SectionHeadingProps) {
  return (
    <div className="group/heading flex h-8 items-center gap-1 rounded-md px-2 transition-colors hover:bg-secondary/50">
      <CollapsibleTrigger className="flex flex-1 items-center gap-1.5 text-sm">
        <ChevronDown className="size-3 transition-transform group-data-[state=closed]/collapsible:-rotate-90" />
        <CapLabel className="font-medium">{title}</CapLabel>
      </CollapsibleTrigger>
      {onAdd ? (
        <button
          type="button"
          title={`Add ${title.toLowerCase()}`}
          onClick={onAdd}
          className={cn(actionButtonClass, "opacity-0 group-hover/heading:opacity-100")}
        >
          <Plus className="size-4" />
        </button>
      ) : null}
      <button
        type="button"
        title="More options"
        className={cn(actionButtonClass, "opacity-0 group-hover/heading:opacity-100")}
      >
        <EllipsisVertical className="size-4" />
      </button>
    </div>
  );
}

interface MenuItemProps {
  label: string;
  summary: string;
  isActive?: boolean;
  onClick?: () => void;
}

function MenuItem({ label, summary, isActive, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full flex-col items-start rounded-md px-2 py-2 text-left transition-colors hover:bg-secondary/50",
        isActive
          ? "bg-accent/15 text-accent"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <CapLabel>{label}</CapLabel>
      <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">
        {summary}
      </span>
    </button>
  );
}

const SIDEBAR_STORAGE_KEY = "terva-workbench-sidebar-v1";
const DEFAULT_SIDEBAR_PCT = "18%";

function getSavedSidebarSize(): string {
  const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
  if (stored) {
    const parsed = parseFloat(stored);
    if (!Number.isNaN(parsed) && parsed >= 10 && parsed <= 30) {
      return `${parsed}%`;
    }
  }
  return DEFAULT_SIDEBAR_PCT;
}

function SummaryCard({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof Layers;
}) {
  return (
    <Card className="border-border/70">
      <CardHeader className="space-y-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-secondary text-foreground">
          <Icon size={18} />
        </div>
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
    </Card>
  );
}

export function Generators() {
  const [capabilities, setCapabilities] = useState(INITIAL_CAPABILITIES);
  const [selectedId, setSelectedId] = useState(
    INITIAL_CAPABILITIES[0]?.id ?? "",
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarSize] = useState(getSavedSidebarSize);

  const handleLayoutChanged = useCallback((layout: Record<string, number>) => {
    const size = layout["sidebar"];
    if (size != null) {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(size));
    }
  }, []);

  function handleAddCapability() {
    const id = crypto.randomUUID();
    const draft: WorkspaceItem = {
      id,
      name: `Draft capability ${capabilities.length + 1}`,
      summary: "Placeholder for the next explicit Terva capability.",
    };
    setCapabilities((previous) => [...previous, draft]);
    setSelectedId(id);
  }

  const selectedCapability =
    capabilities.find((item) => item.id === selectedId) ?? capabilities[0];

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      onLayoutChanged={handleLayoutChanged}
      className="h-full"
    >
      <ResizablePanel
        id="sidebar"
        defaultSize={sidebarSize}
        minSize="10%"
        maxSize="30%"
        className={cn(
          "transition-[flex] duration-200 ease-linear",
          !sidebarOpen && "!flex-[0]",
        )}
      >
        <nav className="flex h-full flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
          <div className="flex flex-col gap-0 p-3">
            <span className="text-sm font-medium">Project Workbench</span>
            <span className="text-xs text-muted-foreground">
              Reusable sidebar and panel layout for a single `.terva` document
            </span>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-1 px-1">
              <Collapsible defaultOpen className="group/collapsible">
                <SectionHeading title="Capabilities" onAdd={handleAddCapability} />
                <CollapsibleContent>
                  <div className="ml-3 space-y-0.5 border-l pl-2">
                    {capabilities.map((capability) => (
                      <MenuItem
                        key={capability.id}
                        label={capability.name}
                        summary={capability.summary}
                        isActive={selectedId === capability.id}
                        onClick={() => setSelectedId(capability.id)}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Collapsible defaultOpen className="group/collapsible">
                <SectionHeading title="Backends" />
                <CollapsibleContent>
                  <div className="ml-3 space-y-0.5 border-l pl-2">
                    {INITIAL_BACKENDS.map((backend) => (
                      <MenuItem
                        key={backend.id}
                        label={backend.name}
                        summary={backend.summary}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Collapsible defaultOpen className="group/collapsible">
                <SectionHeading title="Primers" />
                <CollapsibleContent>
                  <div className="ml-3 space-y-0.5 border-l pl-2">
                    {INITIAL_PRIMERS.map((primer) => (
                      <MenuItem
                        key={primer.id}
                        label={primer.name}
                        summary={primer.summary}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </ScrollArea>
        </nav>
      </ResizablePanel>

      <ResizableHandle />

      <ResizablePanel id="content">
        <Tabs defaultValue="overview" className="flex h-full flex-col overflow-hidden">
          <div className="flex shrink-0 items-center gap-1 px-2 pt-1">
            <button
              type="button"
              onClick={() => setSidebarOpen((previous) => !previous)}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="size-4" />
              ) : (
                <PanelLeftOpen className="size-4" />
              )}
            </button>
            <TabsList variant="line" className="ml-1">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="model">Model</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="h-full p-4">
              <TabsContent value="overview" className="mt-0 space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <SummaryCard
                    title="Project-first"
                    description="Keep the active `.terva` document as the source of truth for structure and runtime behavior."
                    icon={FileCode2}
                  />
                  <SummaryCard
                    title="Explicit capabilities"
                    description="Shape only narrow, inspectable capabilities with deterministic actions and verification."
                    icon={Wrench}
                  />
                  <SummaryCard
                    title="Local primers"
                    description="Keep subsystem notes and AI guidance close to the project without burying logic in the UI."
                    icon={NotebookTabs}
                  />
                </div>

                <Card className="border-border/70">
                  <CardHeader>
                    <CardTitle>{selectedCapability?.name ?? "No capability selected"}</CardTitle>
                    <CardDescription>
                      {selectedCapability?.summary ??
                        "Select a capability from the sidebar to shape the workbench."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-muted-foreground">
                    <p>
                      This page now keeps only the reusable sidebar and panel layout.
                      The old Bluetooth-specific generator flow has been removed.
                    </p>
                    <div className="rounded-lg border border-dashed border-border/70 bg-background/70 p-4">
                      No device scanning or hardware transport is attached to this
                      view. It is now a shell for project editing and inspection.
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="model" className="mt-0">
                <Card className="border-border/70">
                  <CardHeader>
                    <CardTitle>Workbench model outline</CardTitle>
                    <CardDescription>
                      A UI skeleton for project-centric editing, not runtime execution.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <div className="rounded-lg border bg-background/60 p-3 font-mono text-xs">
                      project
                      <br />
                      ├─ backends
                      <br />
                      ├─ capabilities
                      <br />
                      ├─ primers
                      <br />
                      └─ notes
                    </div>
                    <p>
                      The next step is to bind this layout to real `.terva` document
                      structure, not to reintroduce hardware logic into the shell.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notes" className="mt-0">
                <Card className="border-border/70">
                  <CardHeader>
                    <CardTitle>Notes</CardTitle>
                    <CardDescription>
                      Reserved space for project-local annotations and future editor state.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      Keep parsing, validation, execution, and MCP behavior in the shared
                      Terva runtime. The desktop shell stays a thin document interface.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
