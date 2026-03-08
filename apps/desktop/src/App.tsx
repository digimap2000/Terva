import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { ActivityRail } from "@/components/layout/ActivityRail";
import { StatusBar } from "@/components/layout/StatusBar";
import { ZoomIndicator } from "@/components/layout/ZoomIndicator";
import {
  WorkspaceMenuProvider,
  type WorkspaceMenuContextValue,
} from "@/components/layout/WorkspaceMenuContext";
import { NewProjectDialog } from "@/components/workspace/NewProjectDialog";
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
import {
  getNewProjectPreview,
  pickProjectDirectory,
  type NewProjectPreview,
  type ProjectDocument,
  type ProjectMetadataUpdate,
} from "@/lib/tauri";

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

interface SharedShellProps {
  documentOpen: boolean;
  runtimeState: RuntimeState;
  children: React.ReactNode;
}

function Shell({ documentOpen, runtimeState, children }: SharedShellProps) {
  return (
    <>
      <ActivityRail documentOpen={documentOpen} runtimeState={runtimeState} />
      <main className="flex flex-1 flex-col overflow-hidden rounded-tl-xl bg-background">
        <div className="min-h-0 flex-1">{children}</div>
      </main>
    </>
  );
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
    <Shell documentOpen runtimeState={runtimeState}>
      <Routes>
        <Route path="/" element={<Navigate to="/workspace" replace />} />
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
    </Shell>
  );
}

interface NoProjectShellProps {
  error: string | null;
  loading: boolean;
  recentProjects: Parameters<typeof Welcome>[0]["recentProjects"];
  recentProjectsLoading: boolean;
  onCreateProject: () => void;
  onOpenProject: () => void;
  onOpenRecentProject: (path: string) => void;
}

function NoProjectShell({
  error,
  loading,
  recentProjects,
  recentProjectsLoading,
  onCreateProject,
  onOpenProject,
  onOpenRecentProject,
}: NoProjectShellProps) {
  return (
    <Shell documentOpen={false} runtimeState="stopped">
      <Routes>
        <Route path="/" element={<Navigate to="/workspace" replace />} />
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
        <Route path="/inspector" element={<Inspector project={null} />} />
        <Route path="/theme" element={<ThemeReference />} />
        <Route path="*" element={<Navigate to="/workspace" replace />} />
      </Routes>
    </Shell>
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
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDirectory, setNewProjectDirectory] = useState<string | null>(null);
  const [newProjectPreview, setNewProjectPreview] = useState<NewProjectPreview | null>(null);
  const [newProjectError, setNewProjectError] = useState<string | null>(null);
  const [newProjectBusy, setNewProjectBusy] = useState(false);

  useEffect(() => {
    if (!newProjectDialogOpen) {
      return;
    }

    let cancelled = false;

    async function refreshPreview() {
      try {
        const preview = await getNewProjectPreview(newProjectName, newProjectDirectory);
        if (cancelled) {
          return;
        }

        setNewProjectPreview(preview);
        setNewProjectDirectory(preview.directory);
        setNewProjectError(null);
      } catch (value) {
        if (cancelled) {
          return;
        }

        const message = value instanceof Error ? value.message : String(value);
        setNewProjectError(message);
      }
    }

    void refreshPreview();

    return () => {
      cancelled = true;
    };
  }, [newProjectDialogOpen, newProjectDirectory, newProjectName]);

  async function handleOpenProject() {
    const opened = await openProject();
    if (opened) {
      navigate("/project");
    }
  }

  function openNewProjectDialog() {
    setNewProjectName("");
    setNewProjectDirectory(null);
    setNewProjectPreview(null);
    setNewProjectError(null);
    setNewProjectDialogOpen(true);
  }

  function closeNewProjectDialog() {
    if (newProjectBusy) {
      return;
    }

    setNewProjectDialogOpen(false);
    setNewProjectError(null);
  }

  async function handleBrowseProjectDirectory() {
    try {
      const selected = await pickProjectDirectory(newProjectDirectory);
      if (selected) {
        setNewProjectDirectory(selected);
      }
    } catch (value) {
      const message = value instanceof Error ? value.message : String(value);
      setNewProjectError(message);
    }
  }

  async function handleCreateProject() {
    if (!newProjectPreview) {
      return;
    }

    setNewProjectBusy(true);
    setNewProjectError(null);

    const created = await createProject({
      friendly_name: newProjectPreview.friendly_name,
      directory: newProjectPreview.directory,
    });

    setNewProjectBusy(false);

    if (created) {
      setNewProjectDialogOpen(false);
      navigate("/project");
      return;
    }

    setNewProjectError("Terva could not create that project.");
  }

  async function handleOpenRecentProject(path: string) {
    const opened = await openRecentProject(path);
    if (opened) {
      navigate("/project");
    }
  }

  const workspaceMenu: WorkspaceMenuContextValue = {
    activeProjectName: project?.display_name ?? null,
    activeProjectPath: project?.path ?? null,
    recentProjects: recentProjects.map((value) => ({
      path: value.path,
      display_name: value.display_name,
    })),
    onCreateProject: openNewProjectDialog,
    onOpenProject: handleOpenProject,
    onOpenRecentProject: handleOpenRecentProject,
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <ZoomIndicator zoom={zoom} />
      <WorkspaceMenuProvider value={workspaceMenu}>
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
              onCreateProject={openNewProjectDialog}
              onOpenProject={handleOpenProject}
              onOpenRecentProject={handleOpenRecentProject}
              onSaveProjectMetadata={saveProjectMetadata}
              onStartServer={startServer}
              onStopServer={stopServer}
            />
          ) : (
            <NoProjectShell
              error={error}
              loading={loading}
              recentProjects={recentProjects}
              recentProjectsLoading={recentProjectsLoading}
              onCreateProject={openNewProjectDialog}
              onOpenProject={handleOpenProject}
              onOpenRecentProject={handleOpenRecentProject}
            />
          )}
        </div>
      </WorkspaceMenuProvider>
      <NewProjectDialog
        open={newProjectDialogOpen}
        busy={newProjectBusy || loading}
        error={newProjectError}
        friendlyName={newProjectName}
        preview={newProjectPreview}
        onFriendlyNameChange={setNewProjectName}
        onBrowseDirectory={handleBrowseProjectDirectory}
        onClose={closeNewProjectDialog}
        onCreate={handleCreateProject}
      />
      <StatusBar
        activeProject={project}
        runtimeState={project ? runtimeState : "stopped"}
        serverUrl={project ? serverUrl : null}
      />
    </div>
  );
}
