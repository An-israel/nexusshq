import * as React from "react";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  plan: "starter" | "growth" | "business" | "enterprise";
  plan_seats: number;
  is_active: boolean;
  trial_ends_at: string | null;
  created_at: string;
}

export type WorkspaceRole = "owner" | "admin" | "manager" | "employee";

export interface WorkspaceContextValue {
  workspace: Workspace | null;
  workspaceRole: WorkspaceRole | null;
  isOwner: boolean;
  isWorkspaceAdmin: boolean;
  isWorkspaceManager: boolean;
  memberCount: number;
  loading: boolean;
  error: string | null;
  setWorkspaceData: (
    workspace: Workspace,
    role: WorkspaceRole,
    memberCount: number,
  ) => void;
  clearWorkspace: () => void;
}

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null);

interface WorkspaceProviderProps {
  children: React.ReactNode;
}

function WorkspaceProvider({ children }: WorkspaceProviderProps): React.JSX.Element {
  const [workspace, setWorkspace] = React.useState<Workspace | null>(null);
  const [workspaceRole, setWorkspaceRole] = React.useState<WorkspaceRole | null>(null);
  const [memberCount, setMemberCount] = React.useState<number>(0);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const setWorkspaceData = React.useCallback(
    (nextWorkspace: Workspace, role: WorkspaceRole, count: number) => {
      setWorkspace(nextWorkspace);
      setWorkspaceRole(role);
      setMemberCount(count);
      setError(null);
      setLoading(false);
    },
    [],
  );

  const clearWorkspace = React.useCallback(() => {
    setWorkspace(null);
    setWorkspaceRole(null);
    setMemberCount(0);
    setError(null);
    setLoading(true);
  }, []);

  const isOwner = workspaceRole === "owner";
  const isWorkspaceAdmin = workspaceRole === "owner" || workspaceRole === "admin";
  const isWorkspaceManager =
    workspaceRole === "owner" ||
    workspaceRole === "admin" ||
    workspaceRole === "manager";

  const value = React.useMemo<WorkspaceContextValue>(
    () => ({
      workspace,
      workspaceRole,
      isOwner,
      isWorkspaceAdmin,
      isWorkspaceManager,
      memberCount,
      loading,
      error,
      setWorkspaceData,
      clearWorkspace,
    }),
    [
      workspace,
      workspaceRole,
      isOwner,
      isWorkspaceAdmin,
      isWorkspaceManager,
      memberCount,
      loading,
      error,
      setWorkspaceData,
      clearWorkspace,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

function useWorkspace(): WorkspaceContextValue {
  const ctx = React.useContext(WorkspaceContext);
  if (ctx === null) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}

export { WorkspaceContext, WorkspaceProvider, useWorkspace };
