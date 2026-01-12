import React from 'react';

import { createEaProject, getEaProject, type EaProject } from '@/services/ea/project';

export type EaProjectContextValue = {
  project: EaProject | null;
  loading: boolean;
  refreshProject: () => Promise<void>;
  createProject: (input: { name: string; description?: string }) => Promise<EaProject>;
};

const EaProjectContext = React.createContext<EaProjectContextValue | undefined>(undefined);

export const EaProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [project, setProject] = React.useState<EaProject | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refreshProject = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEaProject();
      setProject(res?.success ? (res.data ?? null) : null);
    } catch {
      // If the API is unavailable (e.g. mock disabled without a backend), treat as "no project".
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const createProject = React.useCallback(async (input: { name: string; description?: string }) => {
    const res = await createEaProject(input);
    if (!res?.success || !res.data) {
      throw new Error(res?.errorMessage || 'Failed to create project');
    }
    setProject(res.data);
    return res.data;
  }, []);

  React.useEffect(() => {
    refreshProject();
  }, [refreshProject]);

  return (
    <EaProjectContext.Provider value={{ project, loading, refreshProject, createProject }}>
      {children}
    </EaProjectContext.Provider>
  );
};

export function useEaProject(): EaProjectContextValue {
  const ctx = React.useContext(EaProjectContext);
  if (!ctx) throw new Error('useEaProject must be used within EaProjectProvider');
  return ctx;
}
