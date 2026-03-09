import { useState } from "react";
import {
  FolderOpen,
  FolderPlus,
  MoreVertical,
  Trash2,
} from "lucide-react";
import {
  SystemBridgeVisual,
} from "@/components/project-visuals/server-visuals";
import { ProductAvatar } from "@/components/project-visuals/product-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecentProject } from "@/hooks/useActiveProject";

interface WelcomeProps {
  error: string | null;
  loading: boolean;
  recentProjects: RecentProject[];
  recentProjectsLoading: boolean;
  onCreateProject: () => void;
  onOpenProject: () => void;
  onOpenRecentProject: (path: string) => void;
  onRemoveRecentProject: (path: string) => Promise<boolean>;
}

function ProjectActionsMenu({
  project,
  loading,
  onRemoveRecentProject,
}: {
  project: RecentProject;
  loading: boolean;
  onRemoveRecentProject: (path: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleRemove() {
    setOpen(false);
    setConfirming(false);
    await onRemoveRecentProject(project.path);
  }

  return (
    <>
      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/55 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-6 shadow-[0_24px_80px_-30px_rgba(0,0,0,0.55)]">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground">Remove Project</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                Move <span className="font-medium text-foreground">“{project.display_name}”</span>{" "}
                to the Bin and remove it from recent projects?
              </p>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setConfirming(false);
                }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  void handleRemove();
                }}
                disabled={loading}
              >
                <Trash2 />
                Remove Project
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="flex items-center justify-end gap-2">
      {open ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          className="border-destructive/25 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => {
            setOpen(false);
            setConfirming(true);
          }}
        >
          <Trash2 />
          Remove Project
        </Button>
      ) : null}
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        disabled={loading}
        aria-label={`More options for ${project.display_name}`}
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <MoreVertical />
      </Button>
      </div>
    </>
  );
}

function formatRelativeTime(value: number) {
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const elapsed = value - Date.now();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (Math.abs(elapsed) < hour) {
    return formatter.format(Math.round(elapsed / minute), "minute");
  }
  if (Math.abs(elapsed) < day) {
    return formatter.format(Math.round(elapsed / hour), "hour");
  }
  return formatter.format(Math.round(elapsed / day), "day");
}

function formatEndpointCount(value: number) {
  return `${value} endpoint${value === 1 ? "" : "s"}`;
}

function formatConnectorLabel(value: string) {
  if (!value) {
    return "Unknown";
  }
  return value.toUpperCase();
}

function formatTransportLabel(value: string) {
  const normalized = value
    .replace(/^MCP_TRANSPORT_/i, "")
    .replace(/_/g, " ")
    .toLowerCase();

  switch (normalized) {
    case "streamable http":
      return "Streaming HTTP";
    case "stdio":
      return "STDIO";
    default:
      return normalized.replace(/\b\w/g, (match: string) => match.toUpperCase()) || "Unknown";
  }
}

function ProjectBridgeInfographic({ project }: { project: RecentProject }) {
  const connectorLabel = formatConnectorLabel(project.product_connector);
  const transportLabel = formatTransportLabel(project.mcp_transports[0] ?? "");
  const productLabel = (project.product_name || project.display_name).trim() || "Product";

  return (
    <div className="relative overflow-hidden pt-0 pb-0">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[4%] h-14 w-24 -translate-x-1/2 rounded-full bg-white/8 blur-3xl" />
        <div className="absolute left-[23%] top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="rounded-full border border-border/70 bg-background/72 px-3 py-1 text-[9px] font-medium uppercase tracking-[0.18em] text-foreground shadow-sm backdrop-blur">
            MCP
          </div>
          <div className="absolute left-1/2 top-[calc(100%+0.35rem)] w-24 -translate-x-1/2 text-center text-xs text-muted-foreground">
            {transportLabel}
          </div>
        </div>
        <div className="absolute right-[23%] top-1/2 z-10 translate-x-1/2 -translate-y-1/2">
          <div className="rounded-full border border-border/70 bg-background/72 px-3 py-1 text-[9px] font-medium uppercase tracking-[0.18em] text-foreground shadow-sm backdrop-blur">
            {productLabel}
          </div>
          <div className="absolute left-1/2 top-[calc(100%+0.35rem)] w-24 -translate-x-1/2 text-center text-xs text-muted-foreground">
            {connectorLabel}
          </div>
        </div>
      </div>

      <div className="relative flex h-22 items-center justify-center">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-linear-to-r from-transparent via-primary/45 to-transparent" />
        <div className="absolute inset-x-[16%] top-1/2 h-px -translate-y-1/2 bg-linear-to-r from-transparent via-primary/28 to-transparent blur-[1.5px]" />

        <div className="relative z-10 flex size-20 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-primary/18 bg-linear-to-br from-primary/10 via-background to-accent/8 shadow-[0_16px_40px_-24px_rgba(18,112,255,0.28)]" />
          <div className="absolute inset-[8px] rounded-full border border-border/55" />
          <SystemBridgeVisual className="relative z-10 size-8 text-foreground/88" />
        </div>
      </div>
    </div>
  );
}

function shouldShowProductAvatar(project: RecentProject) {
  return Boolean(project.product_image_path.trim() || project.product_category_icon.trim());
}

function compactProjectLabel(project: RecentProject) {
  const productName = project.product_name.trim();
  if (!productName) {
    return project.display_name;
  }
  return `${project.display_name} (${productName})`;
}

export function Welcome({
  error,
  loading,
  recentProjects,
  recentProjectsLoading,
  onCreateProject,
  onOpenProject,
  onOpenRecentProject,
  onRemoveRecentProject,
}: WelcomeProps) {
  const featuredProjects = recentProjects.slice(0, 2);
  const historyProjects = recentProjects.slice(2);

  function handleProjectOpen(path: string) {
    if (loading) {
      return;
    }
    onOpenRecentProject(path);
  }

  return (
    <main className="relative flex h-full min-h-0 flex-1 flex-col overflow-y-auto rounded-tl-xl bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8rem] top-[-8rem] size-[22rem] rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute bottom-[-10rem] right-[-6rem] size-[24rem] rounded-full bg-accent/14 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-56 bg-linear-to-b from-secondary/70 to-transparent" />
      </div>

      <div className="relative flex w-full shrink-0 flex-col gap-8 px-8 py-8">
        <section>
          <Card className="w-full overflow-hidden border-border/70 bg-card/80 shadow-[0_20px_80px_-40px_rgba(0,112,243,0.45)] backdrop-blur">
            <CardHeader className="space-y-5 p-7">
              <div className="flex items-center justify-center gap-3 text-sm uppercase tracking-[0.24em] text-muted-foreground">
                <SystemBridgeVisual className="size-6 text-current" />
                Terva
              </div>
              <div className="space-y-4 text-center">
                <CardTitle className="mx-auto max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.03em] text-balance sm:text-5xl">
                  Build MCP servers for real devices
                </CardTitle>
                <CardDescription className="mx-auto max-w-3xl text-base leading-7 text-muted-foreground">
                  Design tools and endpoints that connect AI to your device, API, or local system.
                </CardDescription>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <Button type="button" size="lg" onClick={onCreateProject} disabled={loading}>
                  <FolderPlus />
                  {loading ? "Working..." : "Create New Project"}
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={onOpenProject}
                  disabled={loading}
                >
                  <FolderOpen />
                  Open from Disk
                </Button>
              </div>
            </CardHeader>
          </Card>
        </section>

        {error ? (
          <div className="rounded-xl border border-destructive/25 bg-destructive/6 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <section className="space-y-4">
          {recentProjectsLoading ? (
            <div className="rounded-2xl border border-border/70 bg-card/60 p-6 text-sm text-muted-foreground">
              Loading recent projects…
            </div>
          ) : featuredProjects.length > 0 ? (
            <>
              <div className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Recent Projects
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {featuredProjects.map((project) => (
                  <Card
                    key={project.path}
                    className="relative h-full overflow-hidden border-border/70 bg-card/80 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-[0_18px_50px_-35px_rgba(120,190,32,0.4)]"
                  >
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute inset-x-0 bottom-0 h-36 bg-linear-to-t from-emerald-500/10 via-emerald-500/4 to-transparent" />
                      <div className="absolute inset-x-[12%] bottom-6 h-20 rounded-full bg-emerald-500/12 blur-3xl" />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleProjectOpen(project.path)}
                      disabled={loading}
                      className="group relative z-10 block w-full text-left outline-none"
                    >
                      <CardHeader className="space-y-3 p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                              Project
                            </div>
                            <CardTitle className="text-2xl tracking-[-0.025em]">
                              {project.display_name}
                            </CardTitle>
                            <CardDescription className="line-clamp-2 text-sm leading-6">
                              {project.description ?? "No project description is set yet."}
                            </CardDescription>
                          </div>
                          <div
                            className="flex shrink-0 items-center gap-2"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                          >
                            {shouldShowProductAvatar(project) ? (
                              <ProductAvatar
                                productName={project.product_name || project.display_name}
                                imagePath={project.product_image_path}
                                categoryIcon={project.product_category_icon}
                                className="size-8 rounded-xl"
                              />
                            ) : null}
                            <ProjectActionsMenu
                              project={project}
                              loading={loading}
                              onRemoveRecentProject={onRemoveRecentProject}
                            />
                          </div>
                        </div>
                        <div className="grid gap-6 text-sm text-muted-foreground">
                          <ProjectBridgeInfographic project={project} />
                          <div className="space-y-2">
                            <div className="text-xs text-muted-foreground">
                              {formatEndpointCount(project.capability_count)}
                            </div>
                            <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
                              <span className="min-w-0 truncate" title={project.path}>
                                {project.path}
                              </span>
                              <span className="shrink-0">
                                {formatRelativeTime(project.last_opened_at_ms)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                    </button>
                  </Card>
                ))}
              </div>

              {historyProjects.length > 0 ? (
                <div className="space-y-4">
                  <div className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                    More Projects
                  </div>
                  <Card className="border-border/70 bg-card/75">
                    <CardContent className="p-3">
                      <div className="divide-y divide-border/70">
                        {historyProjects.map((project) => (
                          <div
                            key={project.path}
                            className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-secondary/70"
                          >
                          <button
                            type="button"
                            onClick={() => handleProjectOpen(project.path)}
                            disabled={loading}
                            className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-foreground">
                                {compactProjectLabel(project)}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {project.path}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatRelativeTime(project.last_opened_at_ms)}
                            </div>
                            </button>
                            <div className="flex shrink-0 items-center gap-2">
                              <ProjectActionsMenu
                                project={project}
                                loading={loading}
                                onRemoveRecentProject={onRemoveRecentProject}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </>
          ) : (
            <Card className="border-border/70 bg-card/70">
              <CardHeader className="space-y-2 p-6">
                <CardTitle>No projects yet</CardTitle>
                <CardDescription className="text-sm leading-6">
                  Create a new `.terva` project or open an existing one to get started.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}
