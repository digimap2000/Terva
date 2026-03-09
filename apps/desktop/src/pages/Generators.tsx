import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, EllipsisVertical, FileCode2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { behaviourActivity } from "@/lib/activity";
import { WorkbenchShell } from "@/components/layout/WorkbenchShell";
import type {
  EndpointCommandUpdate,
  InspectionAction,
  InspectionCapability,
  ProjectDocument,
} from "@/lib/tauri";
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

type EndpointTab = "command" | "inputs" | "execution" | "testing";
type DiagnosticTab = "info" | "warnings" | "errors";
type ResponseMode = "raw_response" | "mapped_field";

interface FieldHelp {
  label: string;
  summary: string;
  explanation: string;
  example: string;
}

interface EndpointCommandFormState {
  method: string;
  path: string;
  response_mode: ResponseMode;
  response_field_name: string;
  response_json_pointer: string;
}

const actionButtonClass =
  "flex size-5 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground";

const tabHelp: Record<EndpointTab, FieldHelp> = {
  command: {
    label: "Command",
    summary: "The minimum HTTP command definition needed to make the endpoint run.",
    explanation:
      "This tab defines the backend request the endpoint performs and how the MCP result is shaped from the returned API payload. It is the shortest path from endpoint idea to working command.",
    example: "POST /power/on and return the value at /state as result.",
  },
  inputs: {
    label: "Inputs",
    summary: "The MCP-facing arguments callers can pass into the endpoint.",
    explanation:
      "Use this area for the caller contract rather than the downstream API call itself. Keep inputs narrow and explicit so the command stays understandable to users and clients.",
    example: "set_volume accepts a level input and feeds it into the request path or body.",
  },
  execution: {
    label: "Execution",
    summary: "The deeper orchestration behind the command once the basics are in place.",
    explanation:
      "This tab is for multi-step work, prerequisite checks, secondary calls, and backend nuance that sits behind the single command the user sees.",
    example: "Write state first, then perform a follow-up readback action on the same backend.",
  },
  testing: {
    label: "Testing",
    summary: "Verification and readback rules that prove the command really succeeded.",
    explanation:
      "Use this area to define the post-action checks and testing shape for the endpoint. It is where success stops being assumed and becomes observable.",
    example: "GET /power until /state == on with retries and a short settle delay.",
  },
};

const httpMethodOptions = [
  {
    id: "GET",
    label: "GET",
    description: "Read or fetch state from the product API.",
  },
  {
    id: "POST",
    label: "POST",
    description: "Trigger an action or create a downstream resource.",
  },
  {
    id: "PUT",
    label: "PUT",
    description: "Replace or set a known downstream resource state.",
  },
] as const;

const responseModeOptions = [
  {
    id: "raw_response",
    label: "Raw Response",
    description: "Return the backend JSON payload as-is.",
  },
  {
    id: "mapped_field",
    label: "Mapped Field",
    description: "Extract one value from the backend JSON and expose it explicitly.",
  },
] as const;

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

function mainActionFor(capability: InspectionCapability | null) {
  if (!capability) {
    return null;
  }

  return (
    capability.actions.find((action) => action.id === capability.main_action_id) ??
    capability.actions[0] ??
    null
  );
}

function toCommandFormState(capability: InspectionCapability): EndpointCommandFormState {
  const mainAction = mainActionFor(capability);
  const mappedField = capability.output_fields.find(
    (output) => output.source === "action" && typeof output.json_pointer === "string",
  );

  return {
    method: mainAction?.method ?? "GET",
    path: mainAction?.path ?? "/",
    response_mode: mappedField ? "mapped_field" : "raw_response",
    response_field_name: mappedField?.name ?? "result",
    response_json_pointer: mappedField?.json_pointer ?? "/",
  };
}

function toEndpointUpdate(
  capabilityId: string,
  form: EndpointCommandFormState,
): EndpointCommandUpdate {
  return {
    capability_id: capabilityId,
    method: form.method,
    path: form.path,
    response_mode: form.response_mode,
    response_field_name: form.response_mode === "mapped_field" ? form.response_field_name : "",
    response_json_pointer:
      form.response_mode === "mapped_field" ? form.response_json_pointer : "",
  };
}

function joinUrl(baseUrl: string, path: string) {
  if (!baseUrl) {
    return path;
  }
  if (!path) {
    return baseUrl;
  }
  if (baseUrl.endsWith("/") && path.startsWith("/")) {
    return `${baseUrl.slice(0, -1)}${path}`;
  }
  if (!baseUrl.endsWith("/") && !path.startsWith("/")) {
    return `${baseUrl}/${path}`;
  }
  return `${baseUrl}${path}`;
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

function OptionCards({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string;
  options: ReadonlyArray<{ id: string; label: string; description: string }>;
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-xl border px-4 py-4 text-left transition-colors",
              selected
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border/70 bg-background/70 text-muted-foreground hover:bg-secondary/60",
              disabled && "cursor-default opacity-60",
            )}
          >
            <div className="text-sm font-medium">{option.label}</div>
            <div className="mt-1 text-xs leading-6">{option.description}</div>
          </button>
        );
      })}
    </div>
  );
}

export function Generators({
  project,
  loading,
  onSaveEndpointCommand,
}: {
  project: ProjectDocument;
  loading: boolean;
  onSaveEndpointCommand: (update: EndpointCommandUpdate) => Promise<ProjectDocument | null>;
}) {
  const capabilities = project.inspection?.capabilities ?? [];
  const backends = project.inspection?.backends ?? [];
  const [selectedId, setSelectedId] = useState(capabilities[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<EndpointTab>("command");
  const [diagnosticTab, setDiagnosticTab] = useState<DiagnosticTab>("info");
  const [inspectedTab, setInspectedTab] = useState<EndpointTab>("command");
  const [commandForm, setCommandForm] = useState<EndpointCommandFormState | null>(
    capabilities[0] ? toCommandFormState(capabilities[0]) : null,
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastFailedSaveSignature, setLastFailedSaveSignature] = useState<string | null>(null);

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

  const selectedMainAction = useMemo(() => {
    return mainActionFor(selectedCapability);
  }, [selectedCapability]);

  const selectedBackend = useMemo(() => {
    if (!selectedMainAction) {
      return null;
    }
    return backends.find((backend) => backend.id === selectedMainAction.backend_id) ?? null;
  }, [backends, selectedMainAction]);

  useEffect(() => {
    if (!selectedCapability) {
      setCommandForm(null);
      setSaveError(null);
      setLastFailedSaveSignature(null);
      return;
    }

    setCommandForm(toCommandFormState(selectedCapability));
    setSaveError(null);
    setLastFailedSaveSignature(null);
  }, [selectedCapability]);

  const isCommandDirty = useMemo(() => {
    if (!selectedCapability || !commandForm) {
      return false;
    }
    return JSON.stringify(commandForm) !== JSON.stringify(toCommandFormState(selectedCapability));
  }, [commandForm, selectedCapability]);

  useEffect(() => {
    if (loading || !selectedCapability || !commandForm || !isCommandDirty) {
      return;
    }
    if (!commandForm.method.trim() || !commandForm.path.trim()) {
      return;
    }
    if (
      commandForm.response_mode === "mapped_field" &&
      (!commandForm.response_field_name.trim() || !commandForm.response_json_pointer.trim())
    ) {
      return;
    }

    const update = toEndpointUpdate(selectedCapability.id, commandForm);
    const signature = JSON.stringify(update);
    if (lastFailedSaveSignature === signature) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void (async () => {
        setSaveError(null);
        const updated = await onSaveEndpointCommand(update);
        if (!updated) {
          setSaveError("Unable to apply endpoint command changes.");
          setLastFailedSaveSignature(signature);
        } else {
          setLastFailedSaveSignature(null);
        }
      })();
    }, 400);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    commandForm,
    isCommandDirty,
    lastFailedSaveSignature,
    loading,
    onSaveEndpointCommand,
    selectedCapability,
  ]);

  function updateCommandField<Key extends keyof EndpointCommandFormState>(
    key: Key,
    value: EndpointCommandFormState[Key],
  ) {
    setCommandForm((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        [key]: value,
      };
    });
  }

  const fullUrlPreview = commandForm
    ? joinUrl(selectedBackend?.base_url ?? "", commandForm.path.trim())
    : "";

  const responsePreview =
    commandForm?.response_mode === "mapped_field"
      ? `{ ${commandForm.response_field_name || "result"}: response${
          commandForm.response_json_pointer || "/"
        } }`
      : "Return the backend response body directly.";

  return (
    <WorkbenchShell
      sidebarStorageKey="terva-endpoints-sidebar-v1"
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
                          setActiveTab("command");
                          setInspectedTab("command");
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
                  description="Current editor focus within the selected endpoint."
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
                  label="Selected Endpoint"
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
                      Select an endpoint to inspect it here.
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
                  Command-specific warnings are not surfaced yet. This panel is reserved for
                  advisory findings such as brittle mappings, suspicious request definitions, and
                  incomplete modelling.
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
                  Command-specific errors are not surfaced yet. This panel will become the place
                  for broken action references, invalid response mappings, and other issues that
                  prevent the endpoint from running safely.
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
      mainContent={(sidebarToggle) => (
        <div className="flex h-full flex-col overflow-hidden">
          {saveError ? (
            <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
              {saveError}
            </div>
          ) : null}

          <div className="min-h-0 flex-1">
            {selectedCapability && commandForm ? (
              <Tabs
                value={activeTab}
                onValueChange={(value) => {
                  const next = value as EndpointTab;
                  setActiveTab(next);
                  setInspectedTab(next);
                }}
                className="flex h-full min-h-0 flex-col"
              >
                <div className="flex items-center gap-3">
                  {sidebarToggle}
                  <TabsList variant="line" className="border-0 pb-0">
                    <TabsTrigger value="command">Command</TabsTrigger>
                    <TabsTrigger value="inputs">Inputs</TabsTrigger>
                    <TabsTrigger value="execution">Execution</TabsTrigger>
                    <TabsTrigger value="testing">Testing</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="command" className="min-h-0 flex-1 overflow-auto pt-6">
                  <div className="space-y-6" onMouseEnter={() => setInspectedTab("command")}>
                    <TabIntro text="Set up the selected endpoint as a working HTTP command: choose the verb, define the API request path, and decide how the MCP result is built from the backend response." />

                    <div className="space-y-0">
                      <CapabilityField
                        label="HTTP Verb"
                        description="The request method sent for the endpoint's main backend action."
                      >
                        <OptionCards
                          value={commandForm.method}
                          options={httpMethodOptions}
                          disabled={loading}
                          onChange={(next) => updateCommandField("method", next)}
                        />
                      </CapabilityField>

                      <CapabilityField
                        label="URL Command"
                        description="The backend request path for the main action. This is combined with the selected backend base URL."
                      >
                        <div className="space-y-3">
                          <Input
                            value={commandForm.path}
                            disabled={loading}
                            onChange={(event) => updateCommandField("path", event.target.value)}
                            placeholder="/power/on"
                          />
                          <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                              Request Preview
                            </div>
                            <div className="mt-2 font-mono text-xs leading-6">
                              {commandForm.method} {fullUrlPreview || "No backend URL available"}
                            </div>
                            <div className="mt-2 text-xs leading-6">
                              Backend: {selectedBackend?.id ?? selectedMainAction?.backend_id ?? "Unknown"}
                              {selectedBackend?.base_url
                                ? ` · Base URL ${selectedBackend.base_url}`
                                : ""}
                            </div>
                          </div>
                        </div>
                      </CapabilityField>

                      <CapabilityField
                        label="Response Construction"
                        description="How the MCP endpoint result is built from the returned backend payload."
                      >
                        <div className="space-y-4">
                          <OptionCards
                            value={commandForm.response_mode}
                            options={responseModeOptions}
                            disabled={loading}
                            onChange={(next) =>
                              updateCommandField("response_mode", next as ResponseMode)
                            }
                          />

                          {commandForm.response_mode === "mapped_field" ? (
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Result Field Name</label>
                                <Input
                                  value={commandForm.response_field_name}
                                  disabled={loading}
                                  onChange={(event) =>
                                    updateCommandField(
                                      "response_field_name",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="result"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Response JSON Pointer</label>
                                <Input
                                  value={commandForm.response_json_pointer}
                                  disabled={loading}
                                  onChange={(event) =>
                                    updateCommandField(
                                      "response_json_pointer",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="/state"
                                />
                              </div>
                            </div>
                          ) : null}

                          <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                              Result Preview
                            </div>
                            <div className="mt-2 text-sm leading-6 text-muted-foreground">
                              {responsePreview}
                            </div>
                            <div className="mt-2 text-xs leading-6 text-muted-foreground">
                              This editor currently models either the raw response body or one
                              explicit extracted field.
                            </div>
                          </div>
                        </div>
                      </CapabilityField>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="inputs" className="min-h-0 flex-1 overflow-auto pt-6">
                  <div className="space-y-6" onMouseEnter={() => setInspectedTab("inputs")}>
                    <TabIntro text="Define the caller-facing input contract separately from the backend request. This tab stays focused on MCP inputs and leaves HTTP execution details to the command tab." />

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
                            This endpoint currently accepts no explicit input fields.
                          </div>
                        )}
                      </CapabilityField>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="execution" className="min-h-0 flex-1 overflow-auto pt-6">
                  <div className="space-y-6" onMouseEnter={() => setInspectedTab("execution")}>
                    <TabIntro text="Use this tab for backend nuance beyond the main command: secondary actions, prerequisites, and the execution shape behind the endpoint." />

                    <div className="space-y-0">
                      <CapabilityField
                        label="Execution Steps"
                        description="Ordered backend actions currently defined for this endpoint."
                      >
                        <div className="space-y-2">
                          {selectedCapability.actions.map((action, index) => (
                            <ExecutionStepCard
                              key={action.id}
                              action={action}
                              index={index}
                              backendBaseUrl={
                                backends.find((backend) => backend.id === action.backend_id)
                                  ?.base_url ?? ""
                              }
                            />
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

                <TabsContent value="testing" className="min-h-0 flex-1 overflow-auto pt-6">
                  <div className="space-y-6" onMouseEnter={() => setInspectedTab("testing")}>
                    <TabIntro text="Define readback and post-action checks here so the endpoint can be exercised and verified rather than assumed to have worked." />

                    <div className="space-y-0">
                      <CapabilityField
                        label="Verification Rule"
                        description="Readback structure currently defined for this endpoint."
                      >
                        {selectedCapability.verification ? (
                          <div className="space-y-2 text-sm">
                            <div className="font-medium">
                              {selectedCapability.verification.action_id}
                            </div>
                            <div className="text-muted-foreground">
                              Attempts {selectedCapability.verification.attempts} with{" "}
                              {selectedCapability.verification.delay_ms}ms delay between checks.
                            </div>
                            <div className="text-muted-foreground">
                              Success settle delay{" "}
                              {selectedCapability.verification.success_delay_ms}ms.
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            This endpoint does not currently define verification.
                          </div>
                        )}
                      </CapabilityField>

                      <CapabilityField
                        label="Response Assertions"
                        description="How the endpoint result is currently exposed for downstream testing and inspection."
                      >
                        {selectedCapability.output_fields.length > 0 ? (
                          <div className="space-y-2">
                            {selectedCapability.output_fields.map((output) => (
                              <div
                                key={`${output.name}:${output.json_pointer ?? output.source}`}
                                className="rounded-lg border border-border/60 px-4 py-3 text-sm"
                              >
                                <div className="font-medium">{output.name}</div>
                                <div className="mt-1 text-muted-foreground">
                                  {output.source}
                                  {output.json_pointer ? ` · ${output.json_pointer}` : ""}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            This endpoint currently returns the raw main action response body.
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
                  <div className="text-sm font-medium">No endpoint selected</div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Choose a capability from the sidebar to define its HTTP command, inputs,
                    execution detail, and testing behavior.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    />
  );
}

function ExecutionStepCard({
  action,
  index,
  backendBaseUrl,
}: {
  action: InspectionAction;
  index: number;
  backendBaseUrl: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 px-4 py-3 text-sm">
      <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
        Step {index + 1}
      </div>
      <div className="mt-2 font-medium">
        {action.method} {action.path}
      </div>
      <div className="mt-1 text-muted-foreground">
        Action {action.id} on backend {action.backend_id}
      </div>
      {backendBaseUrl ? (
        <div className="mt-1 font-mono text-xs text-muted-foreground">
          {joinUrl(backendBaseUrl, action.path)}
        </div>
      ) : null}
      <div className="mt-1 text-muted-foreground">
        Success statuses {action.success_statuses.join(", ")}
      </div>
    </div>
  );
}
