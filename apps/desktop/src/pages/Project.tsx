import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  FileSymlink,
  FolderOpen,
  Plus,
  Server,
  Settings2,
  ShieldCheck,
  Waypoints,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkbenchShell } from "@/components/layout/WorkbenchShell";
import { useWorkspaceMenu } from "@/components/layout/WorkspaceMenuContext";
import { projectActivity } from "@/lib/activity";
import type { ProjectDocument, ProjectMetadataUpdate } from "@/lib/tauri";

interface ProjectProps {
  project: ProjectDocument;
  loading: boolean;
  onSaveProjectMetadata: (update: ProjectMetadataUpdate) => Promise<ProjectDocument | null>;
}

interface ProjectFormState {
  project_name: string;
  project_description: string;
  project_type: string;
  mcp_name: string;
  mcp_version: string;
  mcp_title: string;
  mcp_description: string;
  mcp_website_url: string;
  mcp_instructions: string;
}

interface FieldHelp {
  label: string;
  summary: string;
  explanation: string;
  example: string;
}

const fieldHelp: Record<keyof ProjectFormState, FieldHelp> = {
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
  project_type: {
    label: "Project Type",
    summary: "Top-level classification for the project.",
    explanation:
      "Keep this narrow and machine-readable. It should describe the broad shape of the MCP project so the rest of the product can reason about it consistently.",
    example: "device_bridge",
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
    project_type: project.project_type || "device_bridge",
    mcp_name: project.mcp_server.name || project.display_name,
    mcp_version: project.mcp_server.version || "1.0.1",
    mcp_title: project.mcp_server.title || "",
    mcp_description: project.mcp_server.description || "",
    mcp_website_url: project.mcp_server.website_url || "",
    mcp_instructions: project.mcp_server.instructions || "",
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
      className="flex flex-col gap-3 border-b border-border/60 py-5 first:pt-0 last:border-b-0 last:pb-0 md:flex-row md:gap-6"
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

function ProjectInfographic({
  form,
}: {
  form: ProjectFormState;
}) {
  const visibleName = form.mcp_title.trim() || form.mcp_name.trim() || "Unnamed MCP Server";

  return (
    <div className="flex h-full flex-col items-center justify-start px-8 pt-10">
      <div className="relative flex w-full max-w-sm flex-col items-center">
        <div className="absolute inset-x-10 top-14 h-40 rounded-full bg-linear-to-br from-primary/18 via-accent/12 to-primary/6 blur-3xl" />
        <div className="relative flex size-52 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-primary/20 bg-linear-to-br from-primary/10 via-background to-accent/10 shadow-[0_30px_80px_-35px_rgba(18,112,255,0.45)]" />
          <div className="absolute inset-[18px] rounded-full border border-border/60" />
          <div className="absolute -right-1 top-8 rounded-full border border-accent/35 bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
              <Waypoints size={14} className="text-accent" />
              HTTP
            </div>
          </div>
          <div className="absolute -left-2 bottom-10 rounded-full border border-primary/30 bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
            <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
              Streamable
            </div>
          </div>
          <div className="relative flex size-28 items-center justify-center rounded-[2rem] border border-border/70 bg-background/95 shadow-[0_12px_40px_-18px_rgba(0,0,0,0.45)]">
            <Server size={52} className="text-foreground" strokeWidth={1.6} />
          </div>
        </div>

        <div className="mt-8 rounded-full border border-border/70 bg-background/90 px-5 py-2.5 text-sm font-medium text-foreground shadow-sm backdrop-blur">
          {visibleName}
        </div>
      </div>
    </div>
  );
}

export function Project({ project, loading, onSaveProjectMetadata }: ProjectProps) {
  const workspaceMenu = useWorkspaceMenu();
  const ProjectHeaderIcon = projectActivity.icon;
  const [activeTab, setActiveTab] = useState("identity");
  const [form, setForm] = useState<ProjectFormState>(() => toFormState(project));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [inspectedField, setInspectedField] =
    useState<keyof ProjectFormState>("project_name");

  useEffect(() => {
    setForm(toFormState(project));
    setSaveError(null);
  }, [project]);

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
      !form.project_type.trim() ||
      !form.mcp_name.trim() ||
      !form.mcp_version.trim()
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void (async () => {
        setSaveError(null);
        const updated = await onSaveProjectMetadata(form);
        if (!updated) {
          setSaveError("Unable to apply project metadata changes.");
        }
      })();
    }, 400);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [form, isDirty, loading, onSaveProjectMetadata]);

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
      sidebarContent={<ProjectInfographic form={form} />}
      sidebarFooter={
        <div className="space-y-1 text-xs text-muted-foreground">
          <div>{form.project_type || "No project type set"}</div>
          <div>{form.mcp_version ? `Server ${form.mcp_version}` : "No server version set"}</div>
        </div>
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
                      <TabsTrigger value="server">MCP Server</TabsTrigger>
                      <TabsTrigger value="runtime">Runtime</TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="identity" className="min-h-0 flex-1 overflow-auto pt-6">
                    <div className="space-y-6">
                      <div>
                        <p className="text-sm leading-6 text-muted-foreground">
                          Define the document identity and the broad type of MCP product this
                          project represents.
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
                          fieldId="project_type"
                          label="Project Type"
                          description="Top-level classification for this project."
                          onInspect={setInspectedField}
                        >
                          <Input
                            value={form.project_type}
                            disabled={loading}
                            onFocus={() => setInspectedField("project_type")}
                            onChange={(event) =>
                              updateField("project_type", event.target.value)
                            }
                            placeholder="device_bridge"
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

                  <TabsContent value="server" className="min-h-0 flex-1 overflow-auto pt-6">
                    <div className="space-y-6">
                      <div>
                        <p className="text-sm leading-6 text-muted-foreground">
                          These fields map to the top-level MCP initialize surface, including
                          the mandatory server name and version.
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
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="runtime" className="min-h-0 flex-1 overflow-auto pt-6">
                    <div className="space-y-4">
                      <div className="grid gap-4 xl:grid-cols-3">
                        <Card className="border-border/70">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <BadgeCheck size={16} />
                              Validation
                            </CardTitle>
                            <CardDescription>
                              Current top-level validation state for the active project.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm text-muted-foreground">
                            <div className="font-medium text-foreground">
                              {project.validation.ok ? "Valid" : "Needs attention"}
                            </div>
                            <div>
                              {project.validation.issues.length} issue
                              {project.validation.issues.length === 1 ? "" : "s"} reported.
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-border/70">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Settings2 size={16} />
                              Runtime Summary
                            </CardTitle>
                            <CardDescription>
                              Parsed structure available to the linked core runtime.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm text-muted-foreground">
                            <div>{project.backend_count} backend definitions</div>
                            <div>{project.capability_count} behaviour definitions</div>
                            <div>
                              {project.inspection ? "Inspection loaded from core" : "Inspection unavailable"}
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-border/70">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <ShieldCheck size={16} />
                              MCP Surface
                            </CardTitle>
                            <CardDescription>
                              Current server identity the core will expose.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm text-muted-foreground">
                            <div className="font-medium text-foreground">{form.mcp_name}</div>
                            <div>Version {form.mcp_version}</div>
                            <div>{form.mcp_title || "No display title configured"}</div>
                          </CardContent>
                        </Card>
                      </div>

                      <Card className="border-border/70">
                        <CardHeader>
                          <CardTitle>Document Path</CardTitle>
                          <CardDescription>
                            Active `.terva` source file for this project.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="rounded-xl border p-4">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                              <FileSymlink size={14} />
                              Source File
                            </div>
                            <div className="mt-2 break-all font-mono text-xs text-muted-foreground">
                              {project.path}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                </Tabs>
          </div>
        </div>
      }
    />
  );
}
