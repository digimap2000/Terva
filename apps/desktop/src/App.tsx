import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { ActivityRail } from "@/components/layout/ActivityRail";
import { StatusBar } from "@/components/layout/StatusBar";
import { ZoomIndicator } from "@/components/layout/ZoomIndicator";
import { Auth } from "@/pages/Auth";
import { Backends } from "@/pages/Backends";
import { Experimental } from "@/pages/Experimental";
import { Generators } from "@/pages/Generators";
import { Inspector } from "@/pages/Inspector";
import { Project } from "@/pages/Project";
import { Server } from "@/pages/Server";
import { ThemeReference } from "@/pages/ThemeReference";
import { Welcome } from "@/pages/Welcome";
import type { RuntimeLogEntry, RuntimeState } from "@/hooks/useActiveProject";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useZoom } from "@/hooks/use-zoom";
import type { ProjectDocument, ProjectMetadataUpdate } from "@/lib/tauri";

interface WorkspaceProps {
  project: ProjectDocument;
  error: string | null;
  loading: boolean;
  logs: RuntimeLogEntry[];
  recentProjects: Parameters<typeof Welcome>[0]["recentProjects"];
  recentProjectsLoading: boolean;
  runtimeError: string | null;
  runtimeState: RuntimeState;
  serverUrl: string | null;
  onCreateProject: () => void;
  onOpenProject: () => void;
  onOpenRecentProject: (path: string) => void;
  onSaveProjectMetadata: (update: ProjectMetadataUpdate) => Promise<ProjectDocument | null>;
  onStartServer: () => Promise<boolean>;
  onStopServer: () => Promise<boolean>;
}

function Workspace({
  project,
  error,
  loading,
  logs,
  recentProjects,
  recentProjectsLoading,
  runtimeError,
  runtimeState,
  serverUrl,
  onCreateProject,
  onOpenProject,
  onOpenRecentProject,
  onSaveProjectMetadata,
  onStartServer,
  onStopServer,
}: WorkspaceProps) {
  return (
    <>
      <ActivityRail documentOpen runtimeState={runtimeState} />
      <main className="flex flex-1 flex-col overflow-hidden rounded-tl-xl bg-background">
        <div className="min-h-0 flex-1">
          <Routes>
            <Route
              path="/"
              element={<Navigate to="/workspace" replace />}
            />
            <Route
              path="/workspace"
              element={
                <Welcome
                  error={error}
                  loading={loading}
                  recentProjects={recentProjects}
                  recentProjectsLoading={recentProjectsLoading}
                  onCreateProject={onCreateProject}
                  onOpenProject={onOpenProject}
                  onOpenRecentProject={onOpenRecentProject}
                />
              }
            />
            <Route
              path="/project"
              element={
                <Project
                  project={project}
                  loading={loading}
                  onSaveProjectMetadata={onSaveProjectMetadata}
                />
              }
            />
            <Route path="/behaviour" element={<Generators project={project} />} />
            <Route path="/backends" element={<Backends project={project} />} />
            <Route path="/experimental" element={<Experimental project={project} />} />
            <Route path="/inspector" element={<Inspector project={project} />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/server"
              element={
                <Server
                  logs={logs}
                  runtimeError={runtimeError}
                  runtimeState={runtimeState}
                  serverUrl={serverUrl}
                  onStartServer={onStartServer}
                  onStopServer={onStopServer}
                />
              }
            />
            <Route path="/theme" element={<ThemeReference />} />
          </Routes>
        </div>
      </main>
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
    runtimeState,
    runtimeError,
    serverUrl,
    logs,
    openProject,
    createProject,
    openRecentProject,
    startServer,
    stopServer,
    saveProjectMetadata,
  } = useActiveProject();
  const { zoom } = useZoom();
  const navigate = useNavigate();

  async function handleOpenProject() {
    const opened = await openProject();
    if (opened) {
      navigate("/behaviour");
    }
  }

  async function handleCreateProject() {
    const created = await createProject();
    if (created) {
      navigate("/behaviour");
    }
  }

  async function handleOpenRecentProject(path: string) {
    const opened = await openRecentProject(path);
    if (opened) {
      navigate("/behaviour");
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <ZoomIndicator zoom={zoom} />
      <div className="flex min-h-0 flex-1">
        {project ? (
          <Workspace
            project={project}
            error={error}
            loading={loading}
            logs={logs}
            recentProjects={recentProjects}
            recentProjectsLoading={recentProjectsLoading}
            runtimeError={runtimeError}
            runtimeState={runtimeState}
            serverUrl={serverUrl}
            onCreateProject={handleCreateProject}
            onOpenProject={handleOpenProject}
            onOpenRecentProject={handleOpenRecentProject}
            onSaveProjectMetadata={saveProjectMetadata}
            onStartServer={startServer}
            onStopServer={stopServer}
          />
        ) : (
          <>
            <ActivityRail documentOpen={false} runtimeState="stopped" />
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
      <StatusBar
        activeProject={project}
        runtimeState={project ? runtimeState : "stopped"}
        serverUrl={project ? serverUrl : null}
      />
    </div>
  );
}
