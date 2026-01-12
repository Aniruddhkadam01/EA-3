import { createArchitectureRepository, type ArchitectureRepository } from './ArchitectureRepository';
import type { BaseArchitectureElement } from './BaseArchitectureElement';
import type { RepositoryCollectionType } from './ArchitectureRepository';

let repository: ArchitectureRepository | null = null;
let repositoryRevision = 0;

export function getRepositoryRevision(): number {
  return repositoryRevision;
}

const notifyRepositoryChanged = () => {
  repositoryRevision += 1;
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ea:repositoryChanged'));
    }
  } catch {
    // Best-effort only.
  }
};

/**
 * Singleton in-memory repository for the running process.
 *
 * - Resets on server restart / refresh.
 * - No persistence.
 */
export function getRepository(): ArchitectureRepository {
  if (!repository) {
    repository = createArchitectureRepository();
    notifyRepositoryChanged();
  }
  return repository;
}

/**
 * Replace the singleton repository (transactional swap).
 *
 * Intended for bulk operations that must be all-or-nothing (e.g., CSV import).
 */
export function setRepository(next: ArchitectureRepository) {
  repository = next;
  notifyRepositoryChanged();
}

export function addElement(type: RepositoryCollectionType, element: BaseArchitectureElement) {
  const result = getRepository().addElement(type, element);
  if (result.ok) notifyRepositoryChanged();
  return result;
}
