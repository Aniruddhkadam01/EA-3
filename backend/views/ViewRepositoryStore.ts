import { projectStore } from '../project/ProjectStore';
import { ViewRepository } from './ViewRepository';
import type { ViewDefinition } from './ViewDefinition';

let viewRepository: ViewRepository | null = null;
let viewsRevision = 0;

export function getViewRepositoryRevision(): number {
  return viewsRevision;
}

const notifyViewsChanged = () => {
  viewsRevision += 1;
  // Browser-only: safe no-op in mock/server contexts.
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ea:viewsChanged'));
    }
  } catch {
    // Best-effort only.
  }
};

/**
 * Singleton in-memory ViewRepository for the running process.
 *
 * Project scoping:
 * - Enforces unique view names per project by binding the repository to the current project id.
 * - Resets on server restart / refresh.
 * - No persistence.
 */
export function getViewRepository(): ViewRepository {
  const project = projectStore.getProject();
  const projectId = project?.id ?? '';

  if (!projectId) {
    throw new Error('No active project. Create/select a project before creating views.');
  }

  if (!viewRepository || viewRepository.projectId !== projectId) {
    viewRepository = new ViewRepository(projectId);
    notifyViewsChanged();
  }

  return viewRepository;
}

export function createView(view: ViewDefinition) {
  const result = getViewRepository().createView(view);
  if (result.ok) notifyViewsChanged();
  return result;
}

export function deleteView(viewId: string) {
  const result = getViewRepository().deleteViewById(viewId);
  if (result.ok) notifyViewsChanged();
  return result;
}
