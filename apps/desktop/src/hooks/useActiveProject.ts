import { useState } from "react";
import { openProjectDocument, type ProjectDocument } from "@/lib/tauri";

export function useActiveProject() {
  const [project, setProject] = useState<ProjectDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openProject() {
    setLoading(true);
    setError(null);

    try {
      const nextProject = await openProjectDocument();
      if (nextProject) {
        setProject(nextProject);
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

  function closeProject() {
    setProject(null);
    setError(null);
  }

  return {
    project,
    loading,
    error,
    openProject,
    closeProject,
  };
}
