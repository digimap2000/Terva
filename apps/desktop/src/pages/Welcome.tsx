import {
  ArrowRight,
  Clock3,
  FileCode2,
  FolderOpen,
  FolderPlus,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
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

function formatProjectFacts(project: RecentProject) {
  return `${project.capability_count} capability${
    project.capability_count === 1 ? "" : "ies"
  } · ${project.backend_count} backend${project.backend_count === 1 ? "" : "s"}`;
}

export function Welcome({
  error,
  loading,
  recentProjects,
  recentProjectsLoading,
  onCreateProject,
  onOpenProject,
  onOpenRecentProject,
}: WelcomeProps) {
  const featuredProjects = recentProjects.slice(0, 2);
  const historyProjects = recentProjects.slice(2);

  return (
    <main className="relative flex flex-1 overflow-auto rounded-tl-xl bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8rem] top-[-8rem] size-[22rem] rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute bottom-[-10rem] right-[-6rem] size-[24rem] rounded-full bg-accent/14 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-56 bg-linear-to-b from-secondary/70 to-transparent" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-8 py-10">
        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <Card className="overflow-hidden border-border/70 bg-card/80 shadow-[0_20px_80px_-40px_rgba(0,112,243,0.45)] backdrop-blur">
            <CardHeader className="space-y-6 p-8">
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.28em] text-muted-foreground">
                <Sparkles className="size-4 text-accent" />
                Terva Workspace
              </div>
              <div className="space-y-4">
                <CardTitle className="max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.03em] text-balance sm:text-5xl">
                  Open a project with confidence, or start a new one on solid ground.
                </CardTitle>
                <CardDescription className="max-w-3xl text-base leading-7 text-muted-foreground">
                  Terva keeps the workflow explicit: one active `.terva` document,
                  deterministic tooling, and your recent project history ready when you
                  come back.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-3">
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
                  Open Existing Project
                </Button>
              </div>
            </CardHeader>
          </Card>

          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
            <Card className="border-border/70 bg-card/75 backdrop-blur">
              <CardHeader className="space-y-2">
                <ShieldCheck className="size-5 text-accent" />
                <CardTitle>Project-first</CardTitle>
                <CardDescription>
                  One active document, clear boundaries, no hidden workspace state.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-border/70 bg-card/75 backdrop-blur">
              <CardHeader className="space-y-2">
                <Wrench className="size-5 text-primary" />
                <CardTitle>Deterministic</CardTitle>
                <CardDescription>
                  The desktop shell stays thin while the shared runtime owns behavior.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-border/70 bg-card/75 backdrop-blur">
              <CardHeader className="space-y-2">
                <Clock3 className="size-5 text-foreground" />
                <CardTitle>Recent and reliable</CardTitle>
                <CardDescription>
                  Missing files are pruned automatically so the list stays trustworthy.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-destructive/25 bg-destructive/6 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <section className="grid gap-8 xl:grid-cols-[1.25fr_0.9fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-[-0.02em]">Recent Projects</h2>
                <p className="text-sm text-muted-foreground">
                  Most recently used first, with stale entries removed automatically.
                </p>
              </div>
            </div>

            {recentProjectsLoading ? (
              <div className="rounded-2xl border border-border/70 bg-card/60 p-6 text-sm text-muted-foreground">
                Loading recent projects…
              </div>
            ) : featuredProjects.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {featuredProjects.map((project) => (
                  <button
                    key={project.path}
                    type="button"
                    onClick={() => onOpenRecentProject(project.path)}
                    disabled={loading}
                    className="group text-left"
                  >
                    <Card className="h-full overflow-hidden border-border/70 bg-card/80 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-[0_18px_50px_-35px_rgba(120,190,32,0.4)]">
                      <CardHeader className="space-y-5 p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                              <FileCode2 className="size-4" />
                              Recent Project
                            </div>
                            <CardTitle className="text-2xl tracking-[-0.025em]">
                              {project.display_name}
                            </CardTitle>
                            <CardDescription className="line-clamp-3 min-h-[3.75rem] text-sm leading-6">
                              {project.description ?? "No project description is set yet."}
                            </CardDescription>
                          </div>
                          <ArrowRight className="mt-1 size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                        </div>
                        <div className="grid gap-3 text-sm text-muted-foreground">
                          <div className="rounded-xl border border-border/70 bg-background/70 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                              Structure
                            </div>
                            <div className="mt-2 font-medium text-foreground">
                              {formatProjectFacts(project)}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                            <span>{formatRelativeTime(project.last_opened_at_ms)}</span>
                            <span className="truncate">{project.path}</span>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </button>
                ))}
              </div>
            ) : (
              <Card className="border-border/70 bg-card/70">
                <CardHeader className="space-y-2 p-6">
                  <CardTitle>No recent projects yet</CardTitle>
                  <CardDescription className="text-sm leading-6">
                    Start a new `.terva` project or open an existing one to begin building
                    your recent workspace history.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.02em]">History</h2>
              <p className="text-sm text-muted-foreground">
                Older projects stay available as a compact list.
              </p>
            </div>

            <Card className="border-border/70 bg-card/75">
              <CardContent className="p-3">
                {historyProjects.length > 0 ? (
                  <div className="divide-y divide-border/70">
                    {historyProjects.map((project) => (
                      <button
                        key={project.path}
                        type="button"
                        onClick={() => onOpenRecentProject(project.path)}
                        disabled={loading}
                        className="flex w-full items-center justify-between gap-4 rounded-lg px-3 py-3 text-left transition-colors hover:bg-secondary/70"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-foreground">
                            {project.display_name}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {project.path}
                          </div>
                        </div>
                        <div className="shrink-0 text-xs text-muted-foreground">
                          {formatRelativeTime(project.last_opened_at_ms)}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl px-3 py-8 text-center text-sm text-muted-foreground">
                    Recent history will appear here once you have worked on more projects.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
