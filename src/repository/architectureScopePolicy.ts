import type { ArchitectureScope } from '@/repository/repositoryMetadata';
import {
  OBJECT_TYPE_DEFINITIONS,
  type ObjectType,
  isValidObjectType,
} from '@/pages/dependency-view/utils/eaMetaModel';

export type WritableLayer = 'Business' | 'Application' | 'Technology';

export function isObjectTypeWritableForScope(
  architectureScope: ArchitectureScope | null | undefined,
  objectType: ObjectType,
): boolean {
  const layer = OBJECT_TYPE_DEFINITIONS[objectType]?.layer;

  if (architectureScope === 'Programme') {
    // Programme scope is transformation-centric:
    // - Programmes + Projects are first-class
    // - Capabilities + Applications are editable only as impacted outcomes
    return (
      objectType === 'Programme' ||
      objectType === 'Project' ||
      objectType === 'Capability' ||
      objectType === 'Application'
    );
  }

  if (architectureScope === 'Business Unit') {
    return layer === 'Business' || layer === 'Application' || layer === 'Technology';
  }

  if (architectureScope === 'Domain') {
    // Domain scope is intentionally focused: business + application only, excluding
    // enterprise hierarchy and transformation/technology clutter.
    return (
      objectType === 'Capability' ||
      objectType === 'BusinessService' ||
      objectType === 'Application' ||
      objectType === 'ApplicationService'
    );
  }

  return true;
}

export function isAnyObjectTypeWritableForScope(
  architectureScope: ArchitectureScope | null | undefined,
  objectType: string | null | undefined,
): boolean {
  if (!objectType) return false;
  if (!isValidObjectType(objectType)) return false;
  return isObjectTypeWritableForScope(architectureScope, objectType);
}

export function getReadOnlyReason(
  architectureScope: ArchitectureScope | null | undefined,
  objectType: string | null | undefined,
): string | null {
  if (!objectType || !isValidObjectType(objectType)) {
    if (architectureScope === 'Programme') return 'Read-only in Programme scope.';
    if (architectureScope === 'Business Unit') return 'Read-only in Business Unit scope.';
    if (architectureScope === 'Domain') return 'Read-only in Domain scope.';
    return null;
  }

  const layer = OBJECT_TYPE_DEFINITIONS[objectType]?.layer;

  if (architectureScope === 'Business Unit') {
    if (layer === 'Business' || layer === 'Application' || layer === 'Technology') return null;
    return 'Read-only in Business Unit scope: only Business + Application + Technology layers are editable.';
  }

  if (architectureScope === 'Domain') {
    if (
      objectType === 'Capability' ||
      objectType === 'BusinessService' ||
      objectType === 'Application' ||
      objectType === 'ApplicationService'
    ) {
      return null;
    }
    return 'Read-only in Domain scope: only Capabilities + Business Services + Applications + Application Services are editable.';
  }

  if (architectureScope === 'Programme') {
    if (
      objectType === 'Programme' ||
      objectType === 'Project' ||
      objectType === 'Capability' ||
      objectType === 'Application'
    ) {
      return null;
    }
    return 'Read-only in Programme scope: only Programmes, Projects, impacted Capabilities, and impacted Applications are editable.';
  }

  return null;
}
