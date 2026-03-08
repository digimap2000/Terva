import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ChevronDown,
  EllipsisVertical,
  FileCode2,
} from "lucide-react";
import { behaviourActivity } from "@/lib/activity";
import { WorkbenchShell } from "@/components/layout/WorkbenchShell";
import type { InspectionCapability, ProjectDocument } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CapLabel } from "@/components/ui/cap-label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CapabilityCategory {
  id: string;
  label: string;
  capabilities: InspectionCapability[];
}

type BehaviourTab = "summary" | "inputs" | "output" | "steps" | "verification";
type DiagnosticTab = "info" | "warnings" | "errors";

interface FieldHelp {
  label: string;
  summary: string;
  explanation: string;
  example: string;
}

const actionButtonClass =
  "flex size-5 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground";

const tabHelp: Record<BehaviourTab, FieldHelp> = {
  summary: {
    label: "Summary",
    summary: "High-level identity and shape of the selected behaviour.",
    explanation:
      "Use this surface to understand the behaviour at a glance: its MCP tool name, category, main action, and overall execution shape. This is the stable top-level overview before the user edits deeper details.",
    example: "Tool enter_active writes power state and verifies the final system value.",
  },
  inputs: {
    label: "Inputs",
    summary: "Fields the behaviour accepts from MCP callers.",
    explanation:
      "This tab is where the input contract of the selected capability will be defined. For now it shows the fields surfaced from inspection so the shape of the command is visible and ready for editing later.",
    example: "set_volume exposes a single level field; enter_active exposes no explicit inputs.",
  },
  output: {
    label: "Output",
    summary: "How backend responses are parsed into the behaviour result.",
    explanation:
      "Keep the output surface deterministic and explicit. This is where field extraction, normalization, and user-facing result shaping will be configured as the desktop editor grows.",
    example: "Map backend system=lona to normalized_state=standby.",
  },
  steps: {
    label: "Steps",
    summary: "Ordered backend actions and prerequisite flow for the behaviour.",
    explanation:
      "This is the place for the write action, any prerequisite/setup stages, and multi-step backend orchestration. Even before editing is wired, the user should be able to read the current structure cleanly here.",
    example: "PUT /power?system=on followed by a GET readback.",
  },
  verification: {
    label: "Verification",
    summary: "Readback and post-action checks that determine success.",
    explanation:
      "Verification defines what must be observed after the action completes. This is where expected raw values, normalized interpretations, and retry timing belong.",
    example: "GET /power until system == on or verification fails.",
  },
};

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

function categoryLabelFor(capability: InspectionCapability) {
  return capabilityCategoryFor(capability).label;
}

function SectionHeading({ title }: { title: string }) {
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

function MenuItem({
  label,
  summary,
  isActive,
  onClick,
}: {
  label: string;
  summary: string;
  isActive?: boolean;
  onClick?: () => void;
}) {
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
      <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">{summary}</span>
    </button>
  );
}

function CapabilityField({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/60 py-5 first:pt-0 last:border-b-0 last:pb-0 md:flex-row md:gap-6">
      <div className="space-y-1 md:w-1/3 md:shrink-0">
        <div className="text-sm font-medium">{label}</div>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <div className="md:w-2/3">{children}</div>
    </div>
  );
}

function TabIntro({ text }: { text: string }) {
  return <p className="text-sm leading-6 text-muted-foreground">{text}</p>;
}

export function Generators({ project }: { project: ProjectDocument }) {
  const capabilities = project.inspection?.capabilities ?? [];
  const [selectedId, setSelectedId] = useState(capabilities[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<BehaviourTab>("summary");
  const [diagnosticTab, setDiagnosticTab] = useState<DiagnosticTab>("info");
  const [inspectedTab, setInspectedTab] = useState<BehaviourTab>("summary");

  useEffect(() => {
    const firstCapability = capabilities[0];
    if (!firstCapability) {
      setSelectedId("");
      return;
    }

    const stillExists = capabilities.some((capability) => capability.id === selectedId);
    if (!selectedId || !stillExists) {
      setSelectedId(firstCapability.id);
    }
  }, [capabilities, selectedId]);

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

  return (
    <WorkbenchShell
      sidebarStorageKey="terva-behaviour-sidebar-v1"
      sidebarTitle={behaviourActivity.label}
      sidebarDescription="Capabilities grouped into the categories currently defined by this project."
      sidebarIcon={behaviourActivity.icon}
      sidebarFooter={
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileCode2 size={14} />
          {project.capability_count} capabilities across {categories.length} categories
        </div>
      }
      sidebarContent={
        <ScrollArea className="flex-1">
          <div className="space-y-1 px-1 py-2">
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
                          setInspectedTab("summary");
                        }}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </ScrollArea>
      }
      bottomContent={
        <Tabs
          value={diagnosticTab}
          onValueChange={(value) => setDiagnosticTab(value as DiagnosticTab)}
          className="flex h-full min-h-0 flex-col"
        >
          <TabsList variant="line" className="border-b pb-0">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="warnings">Warnings</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="min-h-0 flex-1 overflow-auto pt-6">
            <div className="space-y-6">
              <p className="text-sm leading-6 text-muted-foreground">
                {tabHelp[inspectedTab].summary} {tabHelp[inspectedTab].explanation}
              </p>

              <div className="space-y-0">
                <CapabilityField
                  label={tabHelp[inspectedTab].label}
                  description="Current editor focus within the selected behaviour."
                >
                  <div className="space-y-2">
                    <div className="text-sm font-medium">{tabHelp[inspectedTab].summary}</div>
                    <div className="text-sm leading-6 text-muted-foreground">
                      {tabHelp[inspectedTab].explanation}
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                      Example: {tabHelp[inspectedTab].example}
                    </div>
                  </div>
                </CapabilityField>

                <CapabilityField
                  label="Selected Behaviour"
                  description="Stable reference for the capability currently being configured."
                >
                  {selectedCapability ? (
                    <div className="space-y-1 text-sm">
                      <div className="font-medium">{selectedCapability.tool_name}</div>
                      <div className="text-muted-foreground">
                        {selectedCapability.description || "No description defined."}
                      </div>
                      <div className="text-muted-foreground">
                        {selectedCapability.actions.length} backend action
                        {selectedCapability.actions.length === 1 ? "" : "s"} surfaced.
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Select a behaviour to inspect it here.
                    </div>
                  )}
                </CapabilityField>

                <CapabilityField
                  label="Document Context"
                  description="Project-level context for the active capability."
                >
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileCode2 size={14} />
                    {project.capability_count} capabilities across {project.backend_count} backends
                  </div>
                </CapabilityField>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="warnings" className="min-h-0 flex-1 overflow-auto pt-6">
            <div className="space-y-0">
              <CapabilityField
                label="Warnings"
                description="Non-blocking findings derived from validation of the active capability."
              >
                <div className="text-sm leading-6 text-muted-foreground">
                  Capability-scoped warnings are not surfaced yet. This panel is reserved
                  for advisory findings, suspicious configuration, and incomplete modelling
                  details.
                </div>
              </CapabilityField>
            </div>
          </TabsContent>

          <TabsContent value="errors" className="min-h-0 flex-1 overflow-auto pt-6">
            <div className="space-y-0">
              <CapabilityField
                label="Errors"
                description="Blocking issues derived from validation of the active capability."
              >
                <div className="text-sm leading-6 text-muted-foreground">
                  Capability-scoped errors are not surfaced yet. This panel will become
                  the place for broken references, invalid action definitions, and other
                  issues that prevent the behaviour from running safely.
                </div>
              </CapabilityField>
            </div>
          </TabsContent>
        </Tabs>
      }
      sidebarDefaultSize="18%"
      sidebarMinSize="10%"
      sidebarMaxSize="30%"
      contentClassName="p-6"
      mainContent={
        <div className="flex h-full flex-col overflow-hidden">
          <div className="min-h-0 flex-1">
                {selectedCapability ? (
                  <Tabs
                    value={activeTab}
                    onValueChange={(value) => {
                      const next = value as BehaviourTab;
                      setActiveTab(next);
                      setInspectedTab(next);
                    }}
                    className="flex h-full min-h-0 flex-col"
                  >
                    <TabsList variant="line" className="border-b pb-0">
                      <TabsTrigger value="summary">Summary</TabsTrigger>
                      <TabsTrigger value="inputs">Inputs</TabsTrigger>
                      <TabsTrigger value="output">Output</TabsTrigger>
                      <TabsTrigger value="steps">Steps</TabsTrigger>
                      <TabsTrigger value="verification">Verification</TabsTrigger>
                    </TabsList>

                    <TabsContent value="summary" className="min-h-0 flex-1 overflow-auto pt-6">
                      <div
                        className="space-y-6"
                        onMouseEnter={() => setInspectedTab("summary")}
                      >
                        <TabIntro text="Define the selected behaviour as a clear MCP command: what it is called, how it is grouped, and how the runtime resolves it." />

                        <div className="space-y-0">
                          <CapabilityField
                            label="Tool Name"
                            description="Public MCP-facing name used to invoke this behaviour."
                          >
                            <div className="text-sm font-medium">{selectedCapability.tool_name}</div>
                          </CapabilityField>
                          <CapabilityField
                            label="Description"
                            description="Human-readable explanation of what the behaviour does."
                          >
                            <div className="text-sm leading-6 text-muted-foreground">
                              {selectedCapability.description || "No description defined."}
                            </div>
                          </CapabilityField>
                          <CapabilityField
                            label="Category"
                            description="Current workspace grouping for this capability."
                          >
                            <div className="text-sm font-medium">
                              {categoryLabelFor(selectedCapability)}
                            </div>
                          </CapabilityField>
                          <CapabilityField
                            label="Main Action"
                            description="Primary action id that represents the behaviour execution."
                          >
                            <div className="text-sm font-medium">
                              {selectedCapability.main_action_id}
                            </div>
                          </CapabilityField>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="inputs" className="min-h-0 flex-1 overflow-auto pt-6">
                      <div
                        className="space-y-6"
                        onMouseEnter={() => setInspectedTab("inputs")}
                      >
                        <TabIntro text="Define the explicit input contract for this behaviour. Keep it narrow, typed, and obvious to both users and MCP clients." />

                        <div className="space-y-0">
                          <CapabilityField
                            label="Input Shape"
                            description="Fields surfaced from the current inspected input schema."
                          >
                            {selectedCapability.input_schema_keys.length > 0 ? (
                              <div className="space-y-2">
                                {selectedCapability.input_schema_keys.map((field) => (
                                  <div
                                    key={field}
                                    className="rounded-lg border border-border/60 px-4 py-3 text-sm"
                                  >
                                    <div className="font-medium">{field}</div>
                                    <div className="mt-1 text-muted-foreground">
                                      Field-level editing is not wired yet.
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">
                                This behaviour currently accepts no explicit input fields.
                              </div>
                            )}
                          </CapabilityField>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="output" className="min-h-0 flex-1 overflow-auto pt-6">
                      <div
                        className="space-y-6"
                        onMouseEnter={() => setInspectedTab("output")}
                      >
                        <TabIntro text="Control how backend responses are parsed and normalized into the final capability result. Raw backend visibility should remain available underneath this layer." />

                        <div className="space-y-0">
                          <CapabilityField
                            label="Current Output Model"
                            description="What the desktop can currently infer about this behaviour's output shaping."
                          >
                            <div className="text-sm leading-6 text-muted-foreground">
                              Output mapping details are not surfaced through the current desktop
                              inspection model yet. This tab is reserved for field extraction,
                              normalization, and final result shaping.
                            </div>
                          </CapabilityField>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="steps" className="min-h-0 flex-1 overflow-auto pt-6">
                      <div
                        className="space-y-6"
                        onMouseEnter={() => setInspectedTab("steps")}
                      >
                        <TabIntro text="Describe the ordered backend actions that implement this behaviour, including any prerequisite or setup work required to make it succeed." />

                        <div className="space-y-0">
                          <CapabilityField
                            label="Execution Steps"
                            description="Ordered backend actions currently defined for this behaviour."
                          >
                            <div className="space-y-2">
                              {selectedCapability.actions.map((action, index) => (
                                <div
                                  key={action.id}
                                  className="rounded-lg border border-border/60 px-4 py-3 text-sm"
                                >
                                  <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                                    Step {index + 1}
                                  </div>
                                  <div className="mt-2 font-medium">
                                    {action.method} {action.path}
                                  </div>
                                  <div className="mt-1 text-muted-foreground">
                                    Action {action.id} on backend {action.backend_id}
                                  </div>
                                  <div className="mt-1 text-muted-foreground">
                                    Success statuses {action.success_statuses.join(", ")}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CapabilityField>

                          <CapabilityField
                            label="Prerequisites"
                            description="Guards and setup logic that must be satisfied before the main action runs."
                          >
                            <div className="text-sm leading-6 text-muted-foreground">
                              No explicit prerequisite or setup configuration is surfaced yet.
                            </div>
                          </CapabilityField>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent
                      value="verification"
                      className="min-h-0 flex-1 overflow-auto pt-6"
                    >
                      <div
                        className="space-y-6"
                        onMouseEnter={() => setInspectedTab("verification")}
                      >
                        <TabIntro text="Define the readback or post-action checks that determine whether this behaviour genuinely reached the intended final state." />

                        <div className="space-y-0">
                          <CapabilityField
                            label="Verification Rule"
                            description="Readback structure currently defined for this behaviour."
                          >
                            {selectedCapability.verification ? (
                              <div className="space-y-2 text-sm">
                                <div className="font-medium">
                                  {selectedCapability.verification.action_id}
                                </div>
                                <div className="text-muted-foreground">
                                  Attempts {selectedCapability.verification.attempts} with{" "}
                                  {selectedCapability.verification.delay_ms}ms delay between
                                  checks.
                                </div>
                                <div className="text-muted-foreground">
                                  Success settle delay{" "}
                                  {selectedCapability.verification.success_delay_ms}ms.
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">
                                This behaviour does not currently define verification.
                              </div>
                            )}
                          </CapabilityField>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <div className="max-w-xl text-center">
                      <div className="text-sm font-medium">No behaviour selected</div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Choose a capability from the sidebar to inspect its summary, inputs,
                        output handling, execution steps, and verification.
                      </p>
                    </div>
                  </div>
                )}
          </div>
        </div>
      }
    />
  );
}
