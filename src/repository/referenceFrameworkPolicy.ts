import type { ReferenceFramework } from './repositoryMetadata';

export type FrameworkRelationshipPolicy = {
  allowedRelationshipTypes: readonly string[];
};

const ARCHIMATE_RELATIONSHIPS: readonly string[] = [
  // Structural / decomposition
  'DECOMPOSES_TO',

  // Cross-layer enablement
  'REALIZES',

  // Generic dependency (maps best-fit to ArchiMate Association)
  'DEPENDS_ON',

  // Application deployment/hosting traceability
  'HOSTED_ON',

  // Implementation & migration (best-fit to ArchiMate Influence)
  'IMPACTS',
] as const;

const DEFAULT_POLICY: FrameworkRelationshipPolicy = {
  allowedRelationshipTypes: [],
};

export function getFrameworkRelationshipPolicy(referenceFramework: ReferenceFramework | null | undefined): FrameworkRelationshipPolicy {
  if (referenceFramework === 'ArchiMate') {
    return {
      allowedRelationshipTypes: ARCHIMATE_RELATIONSHIPS,
    };
  }

  return DEFAULT_POLICY;
}

export function isRelationshipTypeAllowedForReferenceFramework(
  referenceFramework: ReferenceFramework | null | undefined,
  relationshipType: string,
): boolean {
  const t = (relationshipType ?? '').trim();
  if (!t) return false;

  const policy = getFrameworkRelationshipPolicy(referenceFramework);
  // Empty list means "no additional restriction".
  if (policy.allowedRelationshipTypes.length === 0) return true;

  return policy.allowedRelationshipTypes.includes(t);
}
