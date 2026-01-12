import React from 'react';

export type IdeSelectionKind =
  | 'none'
  | 'repository'
  | 'repositoryElement'
  | 'metamodel'
  | 'view'
  | 'analysis'
  | 'route'
  | 'workspace';

export type IdeSelectionSnapshot = {
  kind: IdeSelectionKind;
  keys: string[];
  /** Active document in the center workspace (route tab or workspace tab). */
  activeDocument: {
    kind: 'route' | 'workspace';
    key: string;
  };
};

export type IdeSelectionContextValue = {
  selection: IdeSelectionSnapshot;
  setSelection: (next: { kind: IdeSelectionKind; keys: string[] }) => void;
  setActiveDocument: (next: { kind: 'route' | 'workspace'; key: string }) => void;
};

const IdeSelectionContext = React.createContext<IdeSelectionContextValue | undefined>(undefined);

export const IdeSelectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selection, setSelectionState] = React.useState<IdeSelectionSnapshot>(() => ({
    kind: 'none',
    keys: [],
    activeDocument: { kind: 'route', key: '/workspace' },
  }));

  const setSelection = React.useCallback((next: { kind: IdeSelectionKind; keys: string[] }) => {
    setSelectionState((prev) => ({
      ...prev,
      kind: next.kind,
      keys: Array.isArray(next.keys) ? next.keys : [],
    }));
  }, []);

  const setActiveDocument = React.useCallback((next: { kind: 'route' | 'workspace'; key: string }) => {
    setSelectionState((prev) => ({
      ...prev,
      activeDocument: { kind: next.kind, key: next.key },
    }));
  }, []);

  const value = React.useMemo<IdeSelectionContextValue>(
    () => ({ selection, setSelection, setActiveDocument }),
    [selection, setSelection, setActiveDocument],
  );

  return <IdeSelectionContext.Provider value={value}>{children}</IdeSelectionContext.Provider>;
};

export function useIdeSelection(): IdeSelectionContextValue {
  const ctx = React.useContext(IdeSelectionContext);
  if (!ctx) throw new Error('useIdeSelection must be used within IdeSelectionProvider');
  return ctx;
}
