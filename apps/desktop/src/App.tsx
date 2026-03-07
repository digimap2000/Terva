import { Route, Routes, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { ActivityRail } from "@/components/layout/ActivityRail";
import { StatusBar } from "@/components/layout/StatusBar";
import { ZoomIndicator } from "@/components/layout/ZoomIndicator";
import { Button } from "@/components/ui/button";
import { Generators } from "@/pages/Generators";
import { ThemeReference } from "@/pages/ThemeReference";
import { Welcome } from "@/pages/Welcome";
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
  const {
    project,
    loading,
    recentProjects,
    recentProjectsLoading,
    error,
    openProject,
    createProject,
    openRecentProject,
    closeProject,
  } = useActiveProject();
  const { zoom } = useZoom();
  const navigate = useNavigate();

  async function handleOpenProject() {
    const opened = await openProject();
    if (opened) {
      navigate("/");
    }
  }

  async function handleCreateProject() {
    const created = await createProject();
    if (created) {
      navigate("/");
    }
  }

  async function handleOpenRecentProject(path: string) {
    const opened = await openRecentProject(path);
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
            <Welcome
              error={error}
              loading={loading}
              recentProjects={recentProjects}
              recentProjectsLoading={recentProjectsLoading}
              onCreateProject={handleCreateProject}
              onOpenProject={handleOpenProject}
              onOpenRecentProject={handleOpenRecentProject}
            />
          </>
        )}
      </div>
      {!project ? <StatusBar activeProject={null} /> : null}
    </div>
  );
}
