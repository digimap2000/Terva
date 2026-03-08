import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FolderOpen, Play, Plus, Square } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkbenchShell } from "@/components/layout/WorkbenchShell";
import { useWorkspaceMenu } from "@/components/layout/WorkspaceMenuContext";
import {
  ServerVisualFrame,
  SystemBridgeVisual,
} from "@/components/project-visuals/server-visuals";
import { projectActivity } from "@/lib/activity";
import type { NamedValue, ProjectDocument, ProjectMetadataUpdate } from "@/lib/tauri";
import type { RuntimeState } from "@/hooks/useActiveProject";

interface ProjectProps {
  project: ProjectDocument;
  loading: boolean;
  runtimeState: RuntimeState;
  onSaveProjectMetadata: (update: ProjectMetadataUpdate) => Promise<ProjectDocument | null>;
  onStartServer: () => Promise<boolean>;
  onStopServer: () => Promise<boolean>;
}

interface ProjectFormState {
  project_name: string;
  project_description: string;
  mcp_transports: string[];
  product_connector: string;
  product_http_version: string;
  product_http_tls_enabled: boolean;
  product_http_mandatory_headers_text: string;
  product_uart_baud_rate: string;
  product_uart_port: string;
  product_uart_framing: string;
  mcp_name: string;
  mcp_version: string;
  mcp_title: string;
  mcp_description: string;
  mcp_website_url: string;
  mcp_instructions: string;
}

type ProjectFieldKey = keyof ProjectFormState;

interface FieldHelp {
  label: string;
  summary: string;
  explanation: string;
  example: string;
}

const fieldHelp: Record<ProjectFieldKey, FieldHelp> = {
  project_name: {
    label: "Project Name",
    summary: "Friendly document identity used throughout the Terva workspace.",
    explanation:
      "Use the name you want the user to recognize in the app. This is the human-facing identity of the project itself, not necessarily the exact MCP server identifier.",
    example: 'Streamer Power Control',
  },
  project_description: {
    label: "Project Description",
    summary: "Short explanation of what the project is for.",
    explanation:
      "Describe the device, integration, or operational scope of the project. This is the quickest way for someone returning later to understand what this document owns.",
    example:
      "Known real-device control and playback session reads for the streamer at 192.168.1.111:15081.",
  },
  mcp_transports: {
    label: "MCP Transports",
    summary: "The transport modes this server intends to offer under the MCP surface.",
    explanation:
      "MCP is the front end of a Terva bridge. Use this to declare which transport modes clients should be able to use to reach the server, such as Streamable HTTP or stdio.",
    example: '["streamable_http"]',
  },
  product_connector: {
    label: "Product Connector",
    summary: "The technology families Terva will use to reach the user's downstream product.",
    explanation:
      "Use this to declare how the bridged product is reached. This is separate from MCP itself and captures the global connection shape of the product side of the bridge.",
    example: "http",
  },
  product_http_version: {
    label: "HTTP Version",
    summary: "The HTTP dialect expected by the downstream product API.",
    explanation:
      "Use this to record the protocol version the bridged product expects globally, such as HTTP/1.1 or HTTP/2.",
    example: "1.1",
  },
  product_http_tls_enabled: {
    label: "TLS Support",
    summary: "Whether the product API is expected to use HTTPS/TLS.",
    explanation:
      "Enable this when the product API is intended to be reached over HTTPS rather than plain HTTP.",
    example: "true",
  },
  product_http_mandatory_headers_text: {
    label: "Mandatory Headers",
    summary: "Global headers every request to the product API should be prepared to send.",
    explanation:
      "Enter one header per line in the form `Header-Name: value`. Use this for product-wide headers rather than capability-specific request details.",
    example: "X-Api-Version: 1\nAccept: application/json",
  },
  product_uart_baud_rate: {
    label: "Baud Rate",
    summary: "The serial baud rate expected by the downstream UART product.",
    explanation:
      "Set the fixed baud rate the product expects. Leave it empty until the serial requirements are known.",
    example: "115200",
  },
  product_uart_port: {
    label: "Port Hint",
    summary: "A known port, device path, or other connection hint for the UART product.",
    explanation:
      "Use this to capture the best known connection hint, such as `/dev/tty.usbserial-01` or `COM3`.",
    example: "/dev/tty.usbserial-01",
  },
  product_uart_framing: {
    label: "Framing",
    summary: "The expected UART framing or line configuration.",
    explanation:
      "Capture the serial framing in a compact form such as `8N1` if the product depends on it.",
    example: "8N1",
  },
  mcp_name: {
    label: "Server Name",
    summary: "Mandatory MCP server identifier surfaced in serverInfo.name.",
    explanation:
      "This should be stable and programmatic. Treat it as the canonical MCP-facing server name rather than a marketing title.",
    example: "streamer-power-control",
  },
  mcp_version: {
    label: "Server Version",
    summary: "Mandatory MCP server version surfaced in serverInfo.version.",
    explanation:
      "Version the server surface deliberately. This is what clients will see during initialize and should track the server behavior they are connecting to.",
    example: "1.0.1",
  },
  mcp_title: {
    label: "Server Title",
    summary: "Optional display title for clients and user-facing tools.",
    explanation:
      "Use this when you want a more readable name than the programmatic server name. Clients can display it in preference to the raw identifier.",
    example: "Streamer Power Control",
  },
  mcp_description: {
    label: "Server Description",
    summary: "Optional MCP-facing description of the server.",
    explanation:
      "Summarize what this server offers to clients. Keep it concise and capability-oriented rather than implementation-oriented.",
    example:
      "MCP server for power and playback control of the real audio streamer.",
  },
  mcp_website_url: {
    label: "Website URL",
    summary: "Optional HTTP or HTTPS URL associated with the server.",
    explanation:
      "Use this for documentation or product home pages. Leave it empty if the project does not have a stable public reference.",
    example: "https://terva.dev/streamer-power-control",
  },
  mcp_instructions: {
    label: "Server Instructions",
    summary: "Optional initialize-time guidance for MCP clients.",
    explanation:
      "This is where you explain how a client should use the server. Keep it specific to the tools and behaviors exposed by this project.",
    example:
      "Use the explicit power and playback session tools exposed by this Terva project.",
  },
};

const textareaClassName =
  "flex min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function toFormState(project: ProjectDocument): ProjectFormState {
  return {
    project_name: project.display_name,
    project_description: project.description ?? "",
    mcp_transports: project.mcp_transports?.length
      ? project.mcp_transports
      : ["streamable_http"],
    product_connector: project.product_connector || "http",
    product_http_version: project.product_http?.version ?? "1.1",
    product_http_tls_enabled: project.product_http?.tls_enabled ?? false,
    product_http_mandatory_headers_text: headersToText(
      project.product_http?.mandatory_headers ?? [],
    ),
    product_uart_baud_rate:
      project.product_uart?.baud_rate != null ? String(project.product_uart.baud_rate) : "",
    product_uart_port: project.product_uart?.port ?? "",
    product_uart_framing: project.product_uart?.framing ?? "",
    mcp_name: project.mcp_server.name || project.display_name,
    mcp_version: project.mcp_server.version || "1.0.1",
    mcp_title: project.mcp_server.title || "",
    mcp_description: project.mcp_server.description || "",
    mcp_website_url: project.mcp_server.website_url || "",
    mcp_instructions: project.mcp_server.instructions || "",
  };
}

function headersToText(headers: NamedValue[]): string {
  return headers.map((header) => `${header.name}: ${header.value}`).join("\n");
}

function headersFromText(value: string): NamedValue[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(":");
      if (separator === -1) {
        return {
          name: line,
          value: "",
        };
      }
      return {
        name: line.slice(0, separator).trim(),
        value: line.slice(separator + 1).trim(),
      };
    });
}

function toMetadataUpdate(form: ProjectFormState): ProjectMetadataUpdate {
  const parsedBaudRate = Number.parseInt(form.product_uart_baud_rate.trim(), 10);

  return {
    project_name: form.project_name,
    project_description: form.project_description,
    mcp_transports: form.mcp_transports,
    product_connector: form.product_connector,
    product_http_version: form.product_http_version,
    product_http_tls_enabled: form.product_http_tls_enabled,
    product_http_mandatory_headers: headersFromText(form.product_http_mandatory_headers_text),
    product_uart_baud_rate: Number.isNaN(parsedBaudRate) ? null : parsedBaudRate,
    product_uart_port: form.product_uart_port,
    product_uart_framing: form.product_uart_framing,
    mcp_name: form.mcp_name,
    mcp_version: form.mcp_version,
    mcp_title: form.mcp_title,
    mcp_description: form.mcp_description,
    mcp_website_url: form.mcp_website_url,
    mcp_instructions: form.mcp_instructions,
  };
}

function Field({
  fieldId,
  label,
  description,
  onInspect,
  children,
}: {
  fieldId: keyof ProjectFormState;
  label: string;
  description: string;
  onInspect: (fieldId: keyof ProjectFormState) => void;
  children: ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-3 py-5 first:pt-0 last:pb-0 md:flex-row md:gap-6"
      onMouseEnter={() => onInspect(fieldId)}
    >
      <div className="space-y-1 md:w-1/3 md:shrink-0">
        <label className="text-sm font-medium">{label}</label>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <div className="md:w-2/3">{children}</div>
    </div>
  );
}

const mcpTransportOptions = [
  {
    id: "streamable_http",
    label: "MCP-HTTP",
    description: "Expose the server as MCP over Streamable HTTP.",
  },
  {
    id: "stdio",
    label: "MCP-STDIO",
    description: "Expose the server as MCP over standard input/output.",
  },
] as const;

const productConnectorOptions = [
  {
    id: "http",
    label: "HTTP",
    description: "Connect to a downstream product API over HTTP or HTTPS.",
  },
  {
    id: "uart",
    label: "UART",
    description: "Connect to a downstream product over a serial UART link.",
  },
] as const;

function SingleSelectButtons({
  value,
  options,
  disabled,
  onChange,
  onInspect,
}: {
  value: string;
  options: ReadonlyArray<{ id: string; label: string; description: string }>;
  disabled: boolean;
  onChange: (next: string) => void;
  onInspect: () => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onMouseEnter={onInspect}
            onFocus={onInspect}
            onClick={() => onChange(option.id)}
            className={[
              "rounded-xl border px-4 py-4 text-left transition-colors",
              selected
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border/70 bg-background/70 text-muted-foreground hover:bg-secondary/60",
            ].join(" ")}
          >
            <div className="text-sm font-medium">{option.label}</div>
            <div className="mt-1 text-xs leading-6">{option.description}</div>
          </button>
        );
      })}
    </div>
  );
}

function MultiSelectButtons({
  value,
  options,
  disabled,
  onChange,
  onInspect,
}: {
  value: string[];
  options: ReadonlyArray<{ id: string; label: string; description: string }>;
  disabled: boolean;
  onChange: (next: string[]) => void;
  onInspect: () => void;
}) {
  function toggle(optionId: string) {
    if (value.includes(optionId)) {
      onChange(value.filter((item) => item !== optionId));
      return;
    }
    onChange([...value, optionId]);
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {options.map((option) => {
        const selected = value.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onMouseEnter={onInspect}
            onFocus={onInspect}
            onClick={() => toggle(option.id)}
            className={[
              "rounded-xl border px-4 py-4 text-left transition-colors",
              selected
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border/70 bg-background/70 text-muted-foreground hover:bg-secondary/60",
            ].join(" ")}
          >
            <div className="text-sm font-medium">{option.label}</div>
            <div className="mt-1 text-xs leading-6">{option.description}</div>
          </button>
        );
      })}
    </div>
  );
}

function ProjectInfographic({
  form,
  serverRunnable,
  runtimeState,
  onStartServer,
  onStopServer,
  busy,
}: {
  form: ProjectFormState;
  serverRunnable: boolean;
  runtimeState: RuntimeState;
  onStartServer: () => Promise<boolean>;
  onStopServer: () => Promise<boolean>;
  busy: boolean;
}) {
  const visibleName = form.mcp_title.trim() || form.mcp_name.trim() || "Unnamed MCP Server";
  const running = runtimeState === "running";
  const transitional = runtimeState === "starting" || runtimeState === "stopping";
  const disabled = (!serverRunnable && !running) || busy || transitional;
  const productBadge =
    form.product_connector === "http"
      ? "HTTP"
      : form.product_connector === "uart"
        ? "UART"
        : "Product";

  return (
    <div className="flex h-full flex-col items-center justify-start px-8 pt-10">
      <div className="relative flex w-full max-w-sm flex-col items-center">
        <div className="absolute inset-x-10 top-14 h-40 rounded-full bg-linear-to-br from-primary/18 via-accent/12 to-primary/6 blur-3xl" />
        <div className="relative size-52">
          <div className="absolute left-0 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
            <div className="rounded-full border border-border/70 bg-background/65 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground shadow-sm backdrop-blur">
              MCP
            </div>
          </div>

          <ServerVisualFrame active={running}>
            <SystemBridgeVisual />
          </ServerVisualFrame>

          <div className="absolute right-0 top-1/2 z-10 translate-x-1/2 -translate-y-1/2">
            <div className="rounded-full border border-border/70 bg-background/65 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground shadow-sm backdrop-blur">
              {productBadge}
            </div>
          </div>
          <div className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 translate-y-1/2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (disabled) {
                  return;
                }
                void (running ? onStopServer() : onStartServer());
              }}
              className={[
                "flex size-11 items-center justify-center rounded-full border bg-background/95 shadow-sm backdrop-blur transition-colors",
                running
                  ? "border-emerald-400/40 text-emerald-600 hover:bg-emerald-500/10"
                  : "border-border/70 text-foreground hover:bg-secondary/60",
                disabled ? "cursor-default opacity-45" : "",
              ].join(" ")}
              aria-label={running ? "Stop server" : "Start server"}
            >
              {running ? (
                <Square size={15} fill="currentColor" />
              ) : (
                <Play size={15} fill="currentColor" />
              )}
            </button>
          </div>
        </div>

        <div
          className={[
            "mt-10 rounded-full border bg-background/90 px-5 py-2.5 text-sm font-medium shadow-sm backdrop-blur",
            running
              ? "border-emerald-400/35 text-emerald-700 dark:text-emerald-300"
              : "border-border/70 text-foreground",
          ].join(" ")}
        >
          {visibleName}
        </div>
      </div>
    </div>
  );
}

export function Project({
  project,
  loading,
  runtimeState,
  onSaveProjectMetadata,
  onStartServer,
  onStopServer,
}: ProjectProps) {
  const workspaceMenu = useWorkspaceMenu();
  const ProjectHeaderIcon = projectActivity.icon;
  const [activeTab, setActiveTab] = useState("identity");
  const [form, setForm] = useState<ProjectFormState>(() => toFormState(project));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastFailedSaveSignature, setLastFailedSaveSignature] = useState<string | null>(null);
  const [serverBusy, setServerBusy] = useState(false);
  const [inspectedField, setInspectedField] =
    useState<ProjectFieldKey>("project_name");

  useEffect(() => {
    setForm(toFormState(project));
    setSaveError(null);
    setLastFailedSaveSignature(null);
  }, [project]);

  useEffect(() => {
    if (runtimeState === "running" || runtimeState === "stopped" || runtimeState === "error") {
      setServerBusy(false);
    }
  }, [runtimeState]);

  const isDirty = useMemo(() => {
    const baseline = toFormState(project);
    return JSON.stringify(form) !== JSON.stringify(baseline);
  }, [form, project]);

  const help = fieldHelp[inspectedField];

  useEffect(() => {
    if (loading || !isDirty) {
      return;
    }
    if (
      !form.project_name.trim() ||
      form.mcp_transports.length === 0 ||
      !form.product_connector ||
      !form.mcp_name.trim() ||
      !form.mcp_version.trim()
    ) {
      return;
    }

    const update = toMetadataUpdate(form);
    const signature = JSON.stringify(update);
    if (lastFailedSaveSignature === signature) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void (async () => {
        setSaveError(null);
        const updated = await onSaveProjectMetadata(update);
        if (!updated) {
          setSaveError("Unable to apply project metadata changes.");
          setLastFailedSaveSignature(signature);
        } else {
          setLastFailedSaveSignature(null);
        }
      })();
    }, 400);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [form, isDirty, lastFailedSaveSignature, loading, onSaveProjectMetadata]);

  function updateField<Key extends keyof ProjectFormState>(
    key: Key,
    value: ProjectFormState[Key],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <WorkbenchShell
      sidebarStorageKey="terva-project-sidebar-v1"
      sidebarTitle={projectActivity.label}
      sidebarDescription="Top-level MCP identity and document metadata for the active project."
      sidebarIcon={projectActivity.icon}
      sidebarContent={
        <ProjectInfographic
          form={form}
          serverRunnable={project.server_runnable}
          runtimeState={runtimeState}
          busy={serverBusy}
          onStartServer={async () => {
            setServerBusy(true);
            try {
              return await onStartServer();
            } finally {
              setServerBusy(false);
            }
          }}
          onStopServer={async () => {
            setServerBusy(true);
            try {
              return await onStopServer();
            } finally {
              setServerBusy(false);
            }
          }}
        />
      }
      sidebarHeaderMenu={
        workspaceMenu ? (
          <>
            <DropdownMenuLabel className="px-3 py-2 text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Projects
            </DropdownMenuLabel>

            {workspaceMenu.recentProjects.length > 0 ? (
              workspaceMenu.recentProjects.map((recentProject) => (
                <DropdownMenuItem
                  key={recentProject.path}
                  onSelect={() => workspaceMenu.onOpenRecentProject(recentProject.path)}
                  className={[
                    "gap-3 rounded-2xl px-3 py-3 focus:bg-secondary/55",
                    workspaceMenu.activeProjectPath === recentProject.path
                      ? "bg-secondary/75"
                      : "",
                  ].join(" ")}
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background/70 text-muted-foreground">
                    <ProjectHeaderIcon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {recentProject.display_name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {recentProject.path}
                    </div>
                  </div>
                </DropdownMenuItem>
              ))
            ) : (
              <div className="px-3 py-2.5 text-sm text-muted-foreground">
                No recent projects yet.
              </div>
            )}

            <DropdownMenuSeparator className="my-2 bg-border/60" />

            <DropdownMenuItem
              onSelect={() => workspaceMenu.onCreateProject()}
              className="gap-3 rounded-2xl px-3 py-3 text-sm text-muted-foreground focus:bg-secondary/55 focus:text-foreground"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background/70 text-muted-foreground">
                <Plus size={16} />
              </div>
              <span>Create New Project</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={() => workspaceMenu.onOpenProject()}
              className="gap-3 rounded-2xl px-3 py-3 text-sm text-muted-foreground focus:bg-secondary/55 focus:text-foreground"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background/70 text-muted-foreground">
                <FolderOpen size={16} />
              </div>
              <span>Open Existing Project</span>
            </DropdownMenuItem>
          </>
        ) : null
      }
      bottomContent={
        <div className="flex h-full flex-col border-t bg-secondary/10">
          <div className="border-b px-4 py-3">
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Field Reference
            </div>
            <div className="mt-2 text-sm font-medium text-foreground">{help.label}</div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                    What This Field Is For
                  </div>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    {help.summary}
                  </p>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                    Guidance
                  </div>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    {help.explanation}
                  </p>
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Example
                </div>
                <div className="mt-2 rounded-xl border bg-background/70 p-4">
                  <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6 text-muted-foreground">
                    {help.example}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
      sidebarDefaultSize="28%"
      sidebarMinSize="18%"
      sidebarMaxSize="40%"
      contentClassName="p-6"
      mainContent={(sidebarToggle) =>
        <div className="flex h-full flex-col overflow-hidden">
          {saveError ? (
            <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
              {saveError}
            </div>
          ) : null}

          <div className="min-h-0 flex-1">
                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="flex h-full min-h-0 flex-col"
                >
                  <div className="flex items-center gap-3">
                    {sidebarToggle}
                    <TabsList variant="line" className="border-0 pb-0">
                      <TabsTrigger value="identity">Identity</TabsTrigger>
                      <TabsTrigger value="mcp">MCP</TabsTrigger>
                      <TabsTrigger value="product">Product</TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="identity" className="min-h-0 flex-1 overflow-auto pt-6">
                    <div className="space-y-6">
                      <div>
                        <p className="text-sm leading-6 text-muted-foreground">
                          Define the document identity for the active Terva project.
                        </p>
                      </div>

                      <div className="space-y-0">
                        <Field
                          fieldId="project_name"
                          label="Project Name"
                          description="Friendly name for the active Terva project."
                          onInspect={setInspectedField}
                        >
                          <Input
                            value={form.project_name}
                            disabled={loading}
                            onFocus={() => setInspectedField("project_name")}
                            onChange={(event) =>
                              updateField("project_name", event.target.value)
                            }
                            placeholder="Streamer Power Control"
                          />
                        </Field>

                        <Field
                          fieldId="project_description"
                          label="Project Description"
                          description="Human-readable description of the project and its purpose."
                          onInspect={setInspectedField}
                        >
                          <textarea
                            className={textareaClassName}
                            value={form.project_description}
                            disabled={loading}
                            onFocus={() => setInspectedField("project_description")}
                            onChange={(event) =>
                              updateField("project_description", event.target.value)
                            }
                            placeholder="Describe the device bridge or MCP server this project defines."
                          />
                        </Field>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="mcp" className="min-h-0 flex-1 overflow-auto pt-6">
                    <div className="space-y-6">
                      <div>
                        <p className="text-sm leading-6 text-muted-foreground">
                          MCP is the front end of this bridge. Define the server identity
                          clients will see and the transport modes they can use to reach it.
                        </p>
                      </div>

                      <div className="space-y-0">
                        <Field
                          fieldId="mcp_name"
                          label="Server Name"
                          description="Programmatic MCP server identifier exposed in serverInfo.name."
                          onInspect={setInspectedField}
                        >
                          <Input
                            value={form.mcp_name}
                            disabled={loading}
                            onFocus={() => setInspectedField("mcp_name")}
                            onChange={(event) => updateField("mcp_name", event.target.value)}
                            placeholder="streamer-power"
                          />
                        </Field>

                        <Field
                          fieldId="mcp_version"
                          label="Server Version"
                          description="Version exposed in serverInfo.version."
                          onInspect={setInspectedField}
                        >
                          <Input
                            value={form.mcp_version}
                            disabled={loading}
                            onFocus={() => setInspectedField("mcp_version")}
                            onChange={(event) =>
                              updateField("mcp_version", event.target.value)
                            }
                            placeholder="1.0.1"
                          />
                        </Field>

                        <Field
                          fieldId="mcp_title"
                          label="Server Title"
                          description="Optional display title for end-user MCP clients."
                          onInspect={setInspectedField}
                        >
                          <Input
                            value={form.mcp_title}
                            disabled={loading}
                            onFocus={() => setInspectedField("mcp_title")}
                            onChange={(event) =>
                              updateField("mcp_title", event.target.value)
                            }
                            placeholder="Streamer Power Control"
                          />
                        </Field>

                        <Field
                          fieldId="mcp_website_url"
                          label="Website URL"
                          description="Optional website URL surfaced by the server."
                          onInspect={setInspectedField}
                        >
                          <Input
                            value={form.mcp_website_url}
                            disabled={loading}
                            onFocus={() => setInspectedField("mcp_website_url")}
                            onChange={(event) =>
                              updateField("mcp_website_url", event.target.value)
                            }
                            placeholder="https://example.com"
                          />
                        </Field>

                        <Field
                          fieldId="mcp_description"
                          label="Server Description"
                          description="Optional MCP-facing description of the server."
                          onInspect={setInspectedField}
                        >
                          <textarea
                            className={textareaClassName}
                            value={form.mcp_description}
                            disabled={loading}
                            onFocus={() => setInspectedField("mcp_description")}
                            onChange={(event) =>
                              updateField("mcp_description", event.target.value)
                            }
                            placeholder="Describe what this MCP server provides."
                          />
                        </Field>

                        <Field
                          fieldId="mcp_instructions"
                          label="Server Instructions"
                          description="Optional instructions returned at initialize time to help clients use the server correctly."
                          onInspect={setInspectedField}
                        >
                          <textarea
                            className={textareaClassName}
                            value={form.mcp_instructions}
                            disabled={loading}
                            onFocus={() => setInspectedField("mcp_instructions")}
                            onChange={(event) =>
                              updateField("mcp_instructions", event.target.value)
                            }
                            placeholder="Explain how a client should approach this server."
                          />
                        </Field>

                        <Field
                          fieldId="mcp_transports"
                          label="Supported Transports"
                          description="Choose the transport modes this MCP server intends to support."
                          onInspect={setInspectedField}
                        >
                          <MultiSelectButtons
                            value={form.mcp_transports}
                            options={mcpTransportOptions}
                            disabled={loading}
                            onInspect={() => setInspectedField("mcp_transports")}
                            onChange={(next) => updateField("mcp_transports", next)}
                          />
                        </Field>

                        <Field
                          fieldId="mcp_name"
                          label="Effective MCP Surface"
                          description="A quick read of the current server identity and selected transports."
                          onInspect={setInspectedField}
                        >
                          <div className="rounded-2xl border border-border/70 bg-secondary/20 px-4 py-4 text-sm text-muted-foreground">
                            <div className="font-medium text-foreground">
                              {form.mcp_title.trim() || form.mcp_name.trim() || "Unnamed MCP server"}
                            </div>
                            <div className="mt-2">
                              {form.mcp_transports.length > 0
                                ? form.mcp_transports.join(", ")
                                : "No transports selected"}
                            </div>
                            <div className="mt-1">Version {form.mcp_version}</div>
                          </div>
                        </Field>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="product" className="min-h-0 flex-1 overflow-auto pt-6">
                    <div className="space-y-6">
                      <div>
                        <p className="text-sm leading-6 text-muted-foreground">
                          Product captures the connection shape of the thing this
                          bridge controls. Choose the product technology, then define
                          the global settings that apply across the whole product API.
                        </p>
                      </div>

                      <div className="space-y-0">
                        <Field
                          fieldId="product_connector"
                          label="Connection Technology"
                          description="Select the technology families this project uses to talk to the product."
                          onInspect={setInspectedField}
                        >
                          <SingleSelectButtons
                            value={form.product_connector}
                            options={productConnectorOptions}
                            disabled={loading}
                            onInspect={() => setInspectedField("product_connector")}
                            onChange={(next) => updateField("product_connector", next)}
                          />
                        </Field>

                        {form.product_connector === "http" ? (
                          <>
                            <Field
                              fieldId="product_http_version"
                              label="HTTP Version"
                              description="Protocol version expected by the downstream product API."
                              onInspect={setInspectedField}
                            >
                              <Input
                                value={form.product_http_version}
                                disabled={loading}
                                onFocus={() => setInspectedField("product_http_version")}
                                onChange={(event) =>
                                  updateField("product_http_version", event.target.value)
                                }
                                placeholder="1.1"
                              />
                            </Field>

                            <Field
                              fieldId="product_http_tls_enabled"
                              label="HTTPS / TLS"
                              description="Whether the product API should be treated as HTTPS/TLS-protected."
                              onInspect={setInspectedField}
                            >
                              <label className="flex items-center gap-3 rounded-2xl border border-border/70 bg-secondary/20 px-4 py-3 text-sm text-foreground">
                                <input
                                  type="checkbox"
                                  checked={form.product_http_tls_enabled}
                                  disabled={loading}
                                  onFocus={() => setInspectedField("product_http_tls_enabled")}
                                  onChange={(event) =>
                                    updateField(
                                      "product_http_tls_enabled",
                                      event.target.checked,
                                    )
                                  }
                                />
                                <span>Require TLS when reaching the product API</span>
                              </label>
                            </Field>

                            <Field
                              fieldId="product_http_mandatory_headers_text"
                              label="Mandatory Headers"
                              description="One `Header: value` pair per line for global product API headers."
                              onInspect={setInspectedField}
                            >
                              <textarea
                                className={textareaClassName}
                                value={form.product_http_mandatory_headers_text}
                                disabled={loading}
                                onFocus={() =>
                                  setInspectedField("product_http_mandatory_headers_text")
                                }
                                onChange={(event) =>
                                  updateField(
                                    "product_http_mandatory_headers_text",
                                    event.target.value,
                                  )
                                }
                                placeholder={"Accept: application/json\nX-Api-Version: 1"}
                              />
                            </Field>
                          </>
                        ) : null}

                        {form.product_connector === "uart" ? (
                          <>
                            <Field
                              fieldId="product_uart_baud_rate"
                              label="Baud Rate"
                              description="Serial baud rate expected by the downstream product."
                              onInspect={setInspectedField}
                            >
                              <Input
                                value={form.product_uart_baud_rate}
                                disabled={loading}
                                onFocus={() => setInspectedField("product_uart_baud_rate")}
                                onChange={(event) =>
                                  updateField("product_uart_baud_rate", event.target.value)
                                }
                                placeholder="115200"
                              />
                            </Field>

                            <Field
                              fieldId="product_uart_port"
                              label="Port Hint"
                              description="Known device path, port name, or other connection hint."
                              onInspect={setInspectedField}
                            >
                              <Input
                                value={form.product_uart_port}
                                disabled={loading}
                                onFocus={() => setInspectedField("product_uart_port")}
                                onChange={(event) =>
                                  updateField("product_uart_port", event.target.value)
                                }
                                placeholder="/dev/tty.usbserial-01"
                              />
                            </Field>

                            <Field
                              fieldId="product_uart_framing"
                              label="Framing"
                              description="Serial framing or line convention such as 8N1."
                              onInspect={setInspectedField}
                            >
                              <Input
                                value={form.product_uart_framing}
                                disabled={loading}
                                onFocus={() => setInspectedField("product_uart_framing")}
                                onChange={(event) =>
                                  updateField("product_uart_framing", event.target.value)
                                }
                                placeholder="8N1"
                              />
                            </Field>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
          </div>
        </div>
      }
    />
  );
}
