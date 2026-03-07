import { useEffect, useState } from "react";
import {
  createProjectDocument,
  openProjectDocument,
  openProjectDocumentAtPath,
  summarizeRecentProjects,
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

  async function createProject() {
    setLoading(true);
    setError(null);

    try {
      const nextProject = await createProjectDocument();
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

  function closeProject() {
    setProject(null);
    setError(null);
  }

  return {
    project,
    loading,
    recentProjects,
    recentProjectsLoading,
    error,
    openProject,
    createProject,
    openRecentProject,
    closeProject,
  };
}
