import { useCallback, useMemo, useState } from "react";
import {
  ChevronDown,
  EllipsisVertical,
  FileCode2,
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

interface CapabilityCategory {
  id: string;
  label: string;
  capabilities: InspectionCapability[];
}

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

function capabilitySummary(capability: InspectionCapability) {
  return `${capability.actions.length} action${
    capability.actions.length === 1 ? "" : "s"
  } · main ${capability.main_action_id}`;
}

function capabilityCategoryFor(capability: InspectionCapability) {
  const key = `${capability.id} ${capability.tool_name}`.toLowerCase();
  if (key.includes("power") || key.includes("active") || key.includes("standby")) {
    return {
      id: "power-management",
      label: "Power Management",
    };
  }
  if (key.includes("playback")) {
    return {
      id: "playback",
      label: "Playback",
    };
  }
  return {
    id: "uncategorised",
    label: "Uncategorised",
  };
}

interface GeneratorsProps {
  project: ProjectDocument;
}

function categoryLabelFor(capability: InspectionCapability) {
  return capabilityCategoryFor(capability).label;
}

export function Generators({ project }: GeneratorsProps) {
  const capabilities = project.inspection?.capabilities ?? [];
  const [selectedId, setSelectedId] = useState(capabilities[0]?.id ?? "");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarSize] = useState(getSavedSidebarSize);
  const [activeTab, setActiveTab] = useState("summary");
  const [diagnosticTab, setDiagnosticTab] = useState("info");

  const categories = useMemo<CapabilityCategory[]>(() => {
    const grouped = new Map<string, CapabilityCategory>();
    for (const capability of capabilities) {
      const category = capabilityCategoryFor(capability);
      const existing = grouped.get(category.id);
      if (existing) {
        existing.capabilities.push(capability);
        continue;
      }
      grouped.set(category.id, {
        id: category.id,
        label: category.label,
        capabilities: [capability],
      });
    }
    return Array.from(grouped.values());
  }, [capabilities]);

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
            <span className="text-sm font-medium">Behaviour Workbench</span>
            <span className="text-xs text-muted-foreground">
              Capability categories are derived from the active project for now and
              will become user-configurable.
            </span>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-1 px-1">
              {categories.map((category) => (
                <Collapsible key={category.id} defaultOpen className="group/collapsible">
                  <SectionHeading title={category.label} />
                  <CollapsibleContent>
                    <div className="ml-3 space-y-0.5 border-l pl-2">
                      {category.capabilities.map((capability) => (
                        <MenuItem
                          key={capability.id}
                          label={capability.tool_name}
                          summary={capabilitySummary(capability)}
                          isActive={selectedCapability?.id === capability.id}
                          onClick={() => {
                            setSelectedId(capability.id);
                            setActiveTab("summary");
                          }}
                        />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}

              <Collapsible defaultOpen className="group/collapsible">
                <SectionHeading title="Document" />
                <CollapsibleContent>
                  <div className="ml-3 space-y-0.5 border-l pl-2">
                    <MenuItem
                      label={project.display_name}
                      summary={`${project.capability_count} capabilities · ${project.backend_count} backends`}
                    />
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

          <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
            <ResizablePanel id="behaviour-main" defaultSize={72} minSize={40}>
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="flex h-full min-h-0 flex-1 flex-col"
              >
                <div className="border-b px-4 py-2">
                  <TabsList>
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="inputs">Inputs</TabsTrigger>
                    <TabsTrigger value="output">Output</TabsTrigger>
                    <TabsTrigger value="steps">Steps</TabsTrigger>
                    <TabsTrigger value="verification">Verification</TabsTrigger>
                  </TabsList>
                </div>

                {selectedCapability ? (
                  <>
                    <TabsContent value="summary" className="min-h-0 flex-1 overflow-auto p-6">
                      <div className="space-y-4">
                        <Card className="border-border/70">
                          <CardHeader>
                            <CardTitle>{selectedCapability.tool_name}</CardTitle>
                            <CardDescription>{selectedCapability.description}</CardDescription>
                          </CardHeader>
                          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-lg border px-4 py-3">
                              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                                Category
                              </div>
                              <div className="mt-2 text-sm font-medium">
                                {categoryLabelFor(selectedCapability)}
                              </div>
                            </div>
                            <div className="rounded-lg border px-4 py-3">
                              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                                Main Action
                              </div>
                              <div className="mt-2 text-sm font-medium">
                                {selectedCapability.main_action_id}
                              </div>
                            </div>
                            <div className="rounded-lg border px-4 py-3">
                              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                                Input Fields
                              </div>
                              <div className="mt-2 text-sm font-medium">
                                {selectedCapability.input_schema_keys.length}
                              </div>
                            </div>
                            <div className="rounded-lg border px-4 py-3">
                              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                                Steps
                              </div>
                              <div className="mt-2 text-sm font-medium">
                                {selectedCapability.actions.length}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="border-border/70">
                          <CardHeader>
                            <CardTitle>Command Overview</CardTitle>
                            <CardDescription>
                              High-level summary of the selected behaviour and its runtime
                              shape.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm text-muted-foreground">
                            <p>
                              This behaviour exposes the MCP tool{" "}
                              <span className="font-medium text-foreground">
                                {selectedCapability.tool_name}
                              </span>{" "}
                              and currently resolves through{" "}
                              <span className="font-medium text-foreground">
                                {selectedCapability.actions.length}
                              </span>{" "}
                              configured step{selectedCapability.actions.length === 1 ? "" : "s"}.
                            </p>
                            <p>
                              Capability-level editing will land here as the desktop model
                              grows, but this tab is already the stable place to understand the
                              selected command at a glance.
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="inputs" className="min-h-0 flex-1 overflow-auto p-6">
                      <Card className="border-border/70">
                        <CardHeader>
                          <CardTitle>Input Fields</CardTitle>
                          <CardDescription>
                            Configure the fields this behaviour accepts from MCP callers.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {selectedCapability.input_schema_keys.length > 0 ? (
                            selectedCapability.input_schema_keys.map((field) => (
                              <div key={field} className="rounded-lg border px-4 py-3 text-sm">
                                <div className="font-medium">{field}</div>
                                <div className="mt-1 text-muted-foreground">
                                  Field-level editing is not wired yet.
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                              This behaviour currently accepts no explicit input fields.
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="output" className="min-h-0 flex-1 overflow-auto p-6">
                      <Card className="border-border/70">
                        <CardHeader>
                          <CardTitle>Output Parsing</CardTitle>
                          <CardDescription>
                            Define how backend results are interpreted and mapped into the
                            behaviour output.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-muted-foreground">
                          <div className="rounded-lg border border-dashed px-4 py-4">
                            Output mapping details are not exposed through the desktop
                            inspection model yet.
                          </div>
                          <p>
                            This tab is reserved for output-field mapping, normalization, and
                            response shaping once those details are surfaced from the core.
                          </p>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="steps" className="min-h-0 flex-1 overflow-auto p-6">
                      <div className="space-y-4">
                        <Card className="border-border/70">
                          <CardHeader>
                            <CardTitle>Execution Steps</CardTitle>
                            <CardDescription>
                              Configure the ordered backend calls that implement this
                              behaviour.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {selectedCapability.actions.map((action, index) => (
                              <div key={action.id} className="rounded-lg border px-4 py-3 text-sm">
                                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                                  Step {index + 1}
                                </div>
                                <div className="mt-2 font-medium">
                                  {action.method} {action.path}
                                </div>
                                <div className="mt-1 text-muted-foreground">
                                  Backend {action.backend_id} · success{" "}
                                  {action.success_statuses.join(", ")}
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                        <Card className="border-border/70">
                          <CardHeader>
                            <CardTitle>Prerequisites</CardTitle>
                            <CardDescription>
                              Guards, setup steps, and multi-step orchestration will be edited
                              here.
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="rounded-lg border border-dashed px-4 py-4 text-sm text-muted-foreground">
                              No explicit prerequisite or setup configuration is surfaced yet.
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent
                      value="verification"
                      className="min-h-0 flex-1 overflow-auto p-6"
                    >
                      <Card className="border-border/70">
                        <CardHeader>
                          <CardTitle>Verification</CardTitle>
                          <CardDescription>
                            Readback and post-action checks for the selected behaviour.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {selectedCapability.verification ? (
                            <div className="rounded-lg border px-4 py-4 text-sm text-muted-foreground">
                              <div className="font-medium text-foreground">
                                {selectedCapability.verification.action_id}
                              </div>
                              <div className="mt-2">
                                Attempts {selectedCapability.verification.attempts} · delay{" "}
                                {selectedCapability.verification.delay_ms}ms · success delay{" "}
                                {selectedCapability.verification.success_delay_ms}ms
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed px-4 py-4 text-sm text-muted-foreground">
                              This behaviour does not currently define verification.
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center p-6">
                    <Card className="w-full max-w-2xl border-border/70">
                      <CardHeader>
                        <CardTitle>No behaviour selected</CardTitle>
                        <CardDescription>
                          Choose a capability from the sidebar to configure its inputs,
                          output parsing, execution steps, and verification.
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </div>
                )}
              </Tabs>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel id="behaviour-diagnostics" defaultSize={28} minSize={18}>
              <Tabs
                value={diagnosticTab}
                onValueChange={setDiagnosticTab}
                className="flex h-full min-h-0 flex-col"
              >
                <div className="border-y px-4 py-2">
                  <TabsList>
                    <TabsTrigger value="info">Info</TabsTrigger>
                    <TabsTrigger value="warnings">Warnings</TabsTrigger>
                    <TabsTrigger value="errors">Errors</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="info" className="min-h-0 flex-1 overflow-auto p-4">
                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle>Selected Behaviour Info</CardTitle>
                      <CardDescription>
                        Context and metadata for the current capability will appear here.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      {selectedCapability ? (
                        <div className="space-y-2">
                          <div>
                            Behaviour <span className="font-medium text-foreground">{selectedCapability.tool_name}</span>
                          </div>
                          <div>
                            Category <span className="font-medium text-foreground">{categoryLabelFor(selectedCapability)}</span>
                          </div>
                          <div>Capability-specific validation and guidance is not wired yet.</div>
                        </div>
                      ) : (
                        <div>Select a behaviour to inspect its information panel.</div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="warnings" className="min-h-0 flex-1 overflow-auto p-4">
                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle>Warnings</CardTitle>
                      <CardDescription>
                        Non-blocking validation findings for the active capability will be listed here.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      Placeholder: no capability-scoped warnings are surfaced yet.
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="errors" className="min-h-0 flex-1 overflow-auto p-4">
                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle>Errors</CardTitle>
                      <CardDescription>
                        Blocking validation issues for the active capability will appear here.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      Placeholder: capability-scoped error reporting is not implemented yet.
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
