import { useEffect, useState } from "react";
import {
  closeActiveProjectDocument,
  createProjectDocumentWithOptions,
  deleteProjectDocument,
  drainCoreEvents,
  openProjectDocument,
  openProjectDocumentAtPath,
  startActiveRuntime,
  stopActiveRuntime,
  summarizeRecentProjects,
  updateProjectMetadata,
  type NewProjectRequest,
  type ProjectMetadataUpdate,
  type ProjectDocument,
  type ProjectSummary,
} from "@/lib/tauri";

const RECENT_PROJECTS_STORAGE_KEY = "terva.recent-projects.v1";
const MAX_RECENT_PROJECTS = 10;

interface StoredRecentProject {
  path: string;
  last_opened_at_ms: number;
}

export interface RecentProject {
  path: string;
  file_name: string;
  display_name: string;
  description: string | null;
  backend_count: number;
  capability_count: number;
  modified_at_ms: number | null;
  last_opened_at_ms: number;
}

export type RuntimeState = "stopped" | "starting" | "running" | "stopping" | "error";

export interface RuntimeLogEntry {
  id: string;
  event: string;
  timestamp: string;
  payload: unknown;
}

function normalizeLogEntry(payload: unknown): RuntimeLogEntry {
  const record =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const event = typeof record.event === "string" ? record.event : "terva.unknown";
  const timestamp =
    typeof record.timestamp === "string" ? record.timestamp : new Date().toISOString();

  return {
    id: `${timestamp}:${event}:${crypto.randomUUID()}`,
    event,
    timestamp,
    payload,
  };
}

function readStoredRecentProjects(): StoredRecentProject[] {
  try {
    const raw = localStorage.getItem(RECENT_PROJECTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((value): value is StoredRecentProject => {
        return (
          typeof value === "object" &&
          value !== null &&
          typeof value.path === "string" &&
          typeof value.last_opened_at_ms === "number"
        );
      })
      .sort((left, right) => right.last_opened_at_ms - left.last_opened_at_ms);
  } catch {
    return [];
  }
}

function writeStoredRecentProjects(projects: StoredRecentProject[]) {
  localStorage.setItem(RECENT_PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

function mergeRecentProject(
  projects: StoredRecentProject[],
  path: string,
): StoredRecentProject[] {
  const nextProject = {
    path,
    last_opened_at_ms: Date.now(),
  };

  return [nextProject, ...projects.filter((project) => project.path !== path)].slice(
    0,
    MAX_RECENT_PROJECTS,
  );
}

function removeRecentProject(
  projects: StoredRecentProject[],
  path: string,
): StoredRecentProject[] {
  return projects.filter((project) => project.path !== path);
}

function combineRecentProjects(
  storedProjects: StoredRecentProject[],
  summaries: ProjectSummary[],
): RecentProject[] {
  const summaryByPath = new Map(summaries.map((summary) => [summary.path, summary]));

  return storedProjects
    .filter((project) => summaryByPath.has(project.path))
    .map((project) => {
      const summary = summaryByPath.get(project.path)!;
      return {
        ...summary,
        last_opened_at_ms: project.last_opened_at_ms,
      };
    });
}

export function useActiveProject() {
  const [project, setProject] = useState<ProjectDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [recentProjectsLoading, setRecentProjectsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runtimeState, setRuntimeState] = useState<RuntimeState>("stopped");
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<RuntimeLogEntry[]>([]);

  async function refreshRecentProjects() {
    setRecentProjectsLoading(true);

    try {
      const storedProjects = readStoredRecentProjects();
      if (storedProjects.length === 0) {
        setRecentProjects([]);
        return;
      }

      const summaries = await summarizeRecentProjects(
        storedProjects.map((value) => value.path),
      );
      const nextProjects = combineRecentProjects(storedProjects, summaries);

      writeStoredRecentProjects(
        nextProjects.map((value) => ({
          path: value.path,
          last_opened_at_ms: value.last_opened_at_ms,
        })),
      );
      setRecentProjects(nextProjects);
    } finally {
      setRecentProjectsLoading(false);
    }
  }

  useEffect(() => {
    void refreshRecentProjects();
  }, []);

  useEffect(() => {
    if (!project) {
      setRuntimeState("stopped");
      setRuntimeError(null);
      setServerUrl(null);
      setLogs([]);
      return;
    }

    setRuntimeState("stopped");
    setRuntimeError(null);
    setServerUrl(null);
    setLogs([]);

    let cancelled = false;

    async function refreshLogs() {
      try {
        const batch = await drainCoreEvents();
        if (cancelled || batch.events.length === 0) {
          return;
        }

        const normalized = batch.events.map((event) => normalizeLogEntry(event));
        for (const entry of normalized) {
          const payload =
            entry.payload && typeof entry.payload === "object"
              ? (entry.payload as Record<string, unknown>)
              : {};
          if (entry.event === "terva.server_started") {
            setRuntimeState("running");
            if (typeof payload.listen_url === "string") {
              setServerUrl(payload.listen_url);
            }
          } else if (
            entry.event === "terva.server_stopped" ||
            entry.event === "terva.server_wait_completed"
          ) {
            setRuntimeState("stopped");
          }
        }

        setLogs((previous) => [...normalized, ...previous].slice(0, 500));
      } catch (value) {
        if (cancelled) {
          return;
        }
        const message = value instanceof Error ? value.message : String(value);
        setRuntimeError(message);
      }
    }

    void refreshLogs();
    const interval = window.setInterval(() => {
      void refreshLogs();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [project]);

  async function openProject() {
    setLoading(true);
    setError(null);

    try {
      const nextProject = await openProjectDocument();
      if (nextProject) {
        setProject(nextProject);
        writeStoredRecentProjects(
          mergeRecentProject(readStoredRecentProjects(), nextProject.path),
        );
        void refreshRecentProjects();
      }
      return nextProject;
    } catch (value) {
      const message = value instanceof Error ? value.message : String(value);
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function createProject(request: NewProjectRequest) {
    setLoading(true);
    setError(null);

    try {
      const nextProject = await createProjectDocumentWithOptions(request);
      setProject(nextProject);
      writeStoredRecentProjects(
        mergeRecentProject(readStoredRecentProjects(), nextProject.path),
      );
      void refreshRecentProjects();
      return nextProject;
    } catch (value) {
      const message = value instanceof Error ? value.message : String(value);
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function openRecentProject(path: string) {
    setLoading(true);
    setError(null);

    try {
      const nextProject = await openProjectDocumentAtPath(path);
      setProject(nextProject);
      writeStoredRecentProjects(
        mergeRecentProject(readStoredRecentProjects(), nextProject.path),
      );
      void refreshRecentProjects();
      return nextProject;
    } catch (value) {
      const message = value instanceof Error ? value.message : String(value);
      setError(message);
      void refreshRecentProjects();
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function startServer() {
    if (!project) {
      return false;
    }

    setRuntimeState("starting");
    setRuntimeError(null);

    try {
      const status = await startActiveRuntime();
      setRuntimeState("running");
      setServerUrl(status.listen_url ?? null);
      const batch = await drainCoreEvents();
      if (batch.events.length > 0) {
        setLogs((previous) =>
          [...batch.events.map((event) => normalizeLogEntry(event)), ...previous].slice(
            0,
            500,
          ),
        );
      }
      return true;
    } catch (value) {
      const message = value instanceof Error ? value.message : String(value);
      setRuntimeState("error");
      setRuntimeError(message);
      return false;
    }
  }

  async function stopServer() {
    if (!project) {
      return false;
    }

    setRuntimeState("stopping");
    setRuntimeError(null);

    try {
      await stopActiveRuntime();
      setRuntimeState("stopped");
      setServerUrl(null);
      const batch = await drainCoreEvents();
      if (batch.events.length > 0) {
        setLogs((previous) =>
          [...batch.events.map((event) => normalizeLogEntry(event)), ...previous].slice(
            0,
            500,
          ),
        );
      }
      return true;
    } catch (value) {
      const message = value instanceof Error ? value.message : String(value);
      setRuntimeState("error");
      setRuntimeError(message);
      return false;
    }
  }

  async function saveProjectMetadata(update: ProjectMetadataUpdate) {
    if (!project) {
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const nextProject = await updateProjectMetadata(update);
      setProject(nextProject);
      setRuntimeState("stopped");
      setRuntimeError(null);
      setServerUrl(null);
      return nextProject;
    } catch (value) {
      const message = value instanceof Error ? value.message : String(value);
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function removeProject(path: string) {
    setLoading(true);
    setError(null);

    try {
      const isActiveProject = project?.path === path;
      if (isActiveProject) {
        await closeActiveProjectDocument();
      }

      await deleteProjectDocument(path);

      writeStoredRecentProjects(removeRecentProject(readStoredRecentProjects(), path));

      if (isActiveProject) {
        setProject(null);
        setRuntimeState("stopped");
        setRuntimeError(null);
        setServerUrl(null);
        setLogs([]);
      }

      await refreshRecentProjects();
      return true;
    } catch (value) {
      const message = value instanceof Error ? value.message : String(value);
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }

  return {
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
    removeProject,
    startServer,
    stopServer,
    saveProjectMetadata,
  };
}
