export type RelationshipEndpointRule = {
  from: readonly string[];
  to: readonly string[];
};

/**
 * Canonical relationship endpoint semantics.
 *
 * This is shared by:
 * - Relationship storage validation (safe writes)
 * - View definition validation (safe projections)
 * - View template instantiation (deterministic defaults)
 */
export const RELATIONSHIP_ENDPOINT_RULES: Readonly<Record<string, RelationshipEndpointRule>> = {
  // Capability decomposition (business structure)
  DECOMPOSES_TO: { from: ['Capability'], to: ['Capability'] },

  // Business-process execution (legacy support)
  REALIZES: { from: ['BusinessProcess'], to: ['Application'] },

  // Enterprise / organization
  OWNS: { from: ['Enterprise'], to: ['Enterprise', 'Capability', 'Application', 'Programme'] },
  HAS: { from: ['Enterprise'], to: ['Department'] },

  // Business services
  REALIZED_BY: { from: ['Capability'], to: ['BusinessService'] },

  // Application services
  PROVIDES: { from: ['Application'], to: ['ApplicationService'] },
  SUPPORTS: { from: ['ApplicationService'], to: ['BusinessService'] },

  // Cross-layer
  SUPPORTED_BY: { from: ['Capability'], to: ['Application'] },

  // Application dependency / impact analysis
  DEPENDS_ON: { from: ['Application'], to: ['Application'] },

  // Application-to-infrastructure traceability
  HOSTED_ON: { from: ['Application'], to: ['Technology'] },

  // Strategy-to-execution linkage
  IMPACTS: { from: ['Programme'], to: ['Capability'] },
  IMPLEMENTS: { from: ['Project'], to: ['Application'] },

  // Strategy (legacy)
  DELIVERS: { from: ['Programme'], to: ['Capability', 'Application', 'Technology'] },
} as const;

export function getRelationshipEndpointRule(type: string): RelationshipEndpointRule | null {
  const key = (type ?? '').trim();
  return RELATIONSHIP_ENDPOINT_RULES[key] ?? null;
}

export function isKnownRelationshipType(type: string): boolean {
  return Boolean(getRelationshipEndpointRule(type));
}
