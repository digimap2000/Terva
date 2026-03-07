import { Route, Routes, useNavigate } from "react-router-dom";
import { FileInput, FolderOpen, X } from "lucide-react";
import { ActivityRail } from "@/components/layout/ActivityRail";
import { StatusBar } from "@/components/layout/StatusBar";
import { ZoomIndicator } from "@/components/layout/ZoomIndicator";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Generators } from "@/pages/Generators";
import { ThemeReference } from "@/pages/ThemeReference";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useZoom } from "@/hooks/use-zoom";
import type { ProjectDocument } from "@/lib/tauri";

interface WorkspaceProps {
  project: ProjectDocument;
  onCloseProject: () => void;
}

function Workspace({ project, onCloseProject }: WorkspaceProps) {
  return (
    <>
      <ActivityRail documentOpen />
      <main className="flex flex-1 flex-col overflow-hidden rounded-tl-xl bg-background">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Active Project
            </p>
            <h1 className="truncate text-lg font-semibold">{project.display_name}</h1>
            <p className="truncate text-sm text-muted-foreground">{project.path}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onCloseProject}>
            <X />
            Close Project
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          <Routes>
            <Route path="/" element={<Generators />} />
            <Route path="/theme" element={<ThemeReference />} />
          </Routes>
        </div>
      </main>
      <StatusBar activeProject={project} />
    </>
  );
}

export default function App() {
  const { project, loading, error, openProject, closeProject } = useActiveProject();
  const { zoom } = useZoom();
  const navigate = useNavigate();

  async function handleOpenProject() {
    const opened = await openProject();
    if (opened) {
      navigate("/");
    }
  }

  function handleCloseProject() {
    closeProject();
    navigate("/");
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <ZoomIndicator zoom={zoom} />
      <div className="flex min-h-0 flex-1">
        {project ? (
          <Workspace project={project} onCloseProject={handleCloseProject} />
        ) : (
          <>
            <ActivityRail documentOpen={false} />
            <main className="flex flex-1 items-center justify-center rounded-tl-xl bg-background p-8">
              <Card className="w-full max-w-2xl border-border/70 bg-card/60 backdrop-blur">
                <CardHeader className="space-y-3">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-secondary text-foreground">
                    <FileInput size={20} />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-xl">Open a Terva project</CardTitle>
                    <CardDescription className="max-w-xl text-sm leading-6">
                      Terva is now a single-document app. Open one `.terva` project,
                      work within that project, then close it before loading another.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-dashed border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
                    No active project is loaded.
                  </div>
                  {error ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                      {error}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-3">
                    <Button type="button" onClick={handleOpenProject} disabled={loading}>
                      <FolderOpen />
                      {loading ? "Opening..." : "Open Project"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </main>
          </>
        )}
      </div>
      {!project ? <StatusBar activeProject={null} /> : null}
    </div>
  );
}
