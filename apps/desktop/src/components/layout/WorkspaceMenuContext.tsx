import { createContext, useContext } from "react";

export interface WorkspaceMenuProject {
  path: string;
  display_name: string;
}

export interface WorkspaceMenuContextValue {
  activeProjectName: string | null;
  activeProjectPath: string | null;
  recentProjects: WorkspaceMenuProject[];
  onCreateProject: () => void;
  onOpenProject: () => void;
  onOpenRecentProject: (path: string) => void;
}

const WorkspaceMenuContext = createContext<WorkspaceMenuContextValue | null>(null);

export function WorkspaceMenuProvider({
  value,
  children,
}: {
  value: WorkspaceMenuContextValue;
  children: React.ReactNode;
}) {
  return (
    <WorkspaceMenuContext.Provider value={value}>
      {children}
    </WorkspaceMenuContext.Provider>
  );
}

export function useWorkspaceMenu() {
  return useContext(WorkspaceMenuContext);
}
