import { useCallback, useMemo, useState } from "react";
import {
  ChevronDown,
  DatabaseZap,
  EllipsisVertical,
  FileCode2,
  Layers,
  NotebookTabs,
  PanelLeftClose,
  PanelLeftOpen,
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
import type { InspectionCapability, ProjectDocument } from "@/lib/tauri";

const actionButtonClass =
  "flex size-5 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground";

interface SectionHeadingProps {
  title: string;
}

function SectionHeading({ title }: SectionHeadingProps) {
  return (
    <div className="group/heading flex h-8 items-center gap-1 rounded-md px-2 transition-colors hover:bg-secondary/50">
      <CollapsibleTrigger className="flex flex-1 items-center gap-1.5 text-sm">
        <ChevronDown className="size-3 transition-transform group-data-[state=closed]/collapsible:-rotate-90" />
        <CapLabel className="font-medium">{title}</CapLabel>
      </CollapsibleTrigger>
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

function capabilitySummary(capability: InspectionCapability) {
  return `${capability.actions.length} action${
    capability.actions.length === 1 ? "" : "s"
  } · main ${capability.main_action_id}`;
}

interface GeneratorsProps {
  project: ProjectDocument;
}

export function Generators({ project }: GeneratorsProps) {
  const capabilities = project.inspection?.capabilities ?? [];
  const backends = project.inspection?.backends ?? [];
  const [selectedId, setSelectedId] = useState(capabilities[0]?.id ?? "");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarSize] = useState(getSavedSidebarSize);

  const selectedCapability = useMemo(() => {
    return capabilities.find((item) => item.id === selectedId) ?? capabilities[0] ?? null;
  }, [capabilities, selectedId]);

  const handleLayoutChanged = useCallback((layout: Record<string, number>) => {
    const size = layout["sidebar"];
    if (size != null) {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(size));
    }
  }, []);

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
              Live document structure from the shared C++ core
            </span>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-1 px-1">
              <Collapsible defaultOpen className="group/collapsible">
                <SectionHeading title="Capabilities" />
                <CollapsibleContent>
                  <div className="ml-3 space-y-0.5 border-l pl-2">
                    {capabilities.map((capability) => (
                      <MenuItem
                        key={capability.id}
                        label={capability.tool_name}
                        summary={capabilitySummary(capability)}
                        isActive={selectedCapability?.id === capability.id}
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
                    {backends.map((backend) => (
                      <MenuItem
                        key={backend.id}
                        label={backend.id}
                        summary={`${backend.backend_type} · ${backend.base_url}`}
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

      <ResizablePanel id="content" defaultSize="82%">
        <div className="flex h-full min-w-0 flex-col bg-background">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen((value) => !value)}
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              >
                {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
              </button>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-medium">{project.display_name}</h2>
                <p className="truncate text-xs text-muted-foreground">{project.path}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileCode2 size={14} />
              {project.capability_count} capabilities
            </div>
          </div>

          <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
            <div className="border-b px-4 py-2">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="capability">Capability</TabsTrigger>
                <TabsTrigger value="document">Document</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="min-h-0 flex-1 overflow-auto p-6">
              <div className="grid gap-4 xl:grid-cols-3">
                <SummaryCard
                  title="Capabilities"
                  description={`${project.capability_count} explicit capabilities exposed by the project model.`}
                  icon={Layers}
                />
                <SummaryCard
                  title="Backends"
                  description={`${project.backend_count} backend mapping${project.backend_count === 1 ? "" : "s"} declared in the active document.`}
                  icon={DatabaseZap}
                />
                <SummaryCard
                  title="Validation"
                  description={
                    project.validation.ok
                      ? "The loaded document validates cleanly."
                      : `${project.validation.issues.length} validation issue${
                          project.validation.issues.length === 1 ? "" : "s"
                        } need attention.`
                  }
                  icon={NotebookTabs}
                />
              </div>

              {project.validation.ok ? null : (
                <Card className="mt-4 border-amber-500/30 bg-amber-500/5">
                  <CardHeader>
                    <CardTitle>Validation Issues</CardTitle>
                    <CardDescription>
                      The core loaded the document, but runtime operations stay blocked until
                      these issues are fixed.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {project.validation.issues.map((issue) => (
                      <div key={`${issue.path}-${issue.message}`} className="rounded-lg border px-3 py-2">
                        <div className="text-sm font-medium">{issue.path}</div>
                        <div className="text-sm text-muted-foreground">{issue.message}</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="capability" className="min-h-0 flex-1 overflow-auto p-6">
              {selectedCapability ? (
                <div className="space-y-4">
                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle>{selectedCapability.tool_name}</CardTitle>
                      <CardDescription>{selectedCapability.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      <div>
                        <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                          Inputs
                        </div>
                        <div className="mt-2">
                          {selectedCapability.input_schema_keys.length > 0
                            ? selectedCapability.input_schema_keys.join(", ")
                            : "No input fields"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                          Actions
                        </div>
                        <div className="mt-2 space-y-2">
                          {selectedCapability.actions.map((action) => (
                            <div key={action.id} className="rounded-lg border px-3 py-2">
                              <div className="font-medium">
                                {action.method} {action.path}
                              </div>
                              <div className="text-muted-foreground">
                                {action.backend_id} · success {action.success_statuses.join(", ")}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {selectedCapability.verification ? (
                        <div>
                          <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                            Verification
                          </div>
                          <div className="mt-2 text-muted-foreground">
                            {selectedCapability.verification.action_id} · attempts{" "}
                            {selectedCapability.verification.attempts}
                          </div>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card className="border-border/70">
                  <CardHeader>
                    <CardTitle>No capability selected</CardTitle>
                    <CardDescription>
                      The loaded project does not currently expose any parsed capabilities.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="document" className="min-h-0 flex-1 overflow-auto p-6">
              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle>Document Source</CardTitle>
                  <CardDescription>
                    The desktop shell is currently holding the raw `.terva` contents plus the
                    parsed inspection model from the shared core.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="overflow-auto rounded-xl border bg-secondary/20 p-4 text-xs leading-6 text-muted-foreground">
                    {project.contents}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
