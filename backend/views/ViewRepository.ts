import type { ViewDefinition, ViewType } from './ViewDefinition';
import { getRelationshipEndpointRule } from '../relationships/RelationshipSemantics';

export type ViewRepositoryCreateSuccess = { ok: true; view: ViewDefinition };
export type ViewRepositoryCreateFailure = { ok: false; error: string };
export type ViewRepositoryCreateResult = ViewRepositoryCreateSuccess | ViewRepositoryCreateFailure;

export type ViewRepositoryDeleteSuccess = { ok: true; deleted: ViewDefinition };
export type ViewRepositoryDeleteFailure = { ok: false; error: string };
export type ViewRepositoryDeleteResult = ViewRepositoryDeleteSuccess | ViewRepositoryDeleteFailure;

const VIEW_TYPES: readonly ViewType[] = [
  'ApplicationDependency',
  'CapabilityMap',
  'ApplicationLandscape',
  'TechnologyLandscape',
  'ImpactView',
] as const;

const isValidViewType = (value: unknown): value is ViewType =>
  typeof value === 'string' && (VIEW_TYPES as readonly string[]).includes(value);

const normalizeName = (value: string) => value.trim().toLowerCase();

const normalizeList = (values: readonly string[]) =>
  Array.from(
    new Set(
      (values ?? [])
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter((v) => v.length > 0),
    ),
  );

const hasAny = (set: ReadonlySet<string>, candidates: readonly string[]): boolean => {
  for (const c of candidates) if (set.has(c)) return true;
  return false;
};

const FORBIDDEN_EMBEDDED_KEYS: readonly string[] = [
  // Prevent diagrams from embedding catalog payloads or render state.
  'elements',
  'relationships',
  'objects',
  'nodes',
  'edges',
  'positions',
  'nodePositions',
  'layout',
  'graph',
  'repository',
  'catalog',
  'render',
  'cytoscape',
];

const hasEmbeddedPayload = (view: unknown): string | null => {
  if (!view || typeof view !== 'object') return null;
  const obj = view as Record<string, unknown>;
  for (const key of FORBIDDEN_EMBEDDED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] != null) {
      return key;
    }
  }
  return null;
};

const viewTypeRules: Record<
  ViewType,
  {
    allowedElementTypes: readonly string[];
    allowedRelationshipTypes: readonly string[];
  }
> = {
  CapabilityMap: {
    // Enterprise-grade business traceability: Capability → BusinessService → ApplicationService → Application.
    allowedElementTypes: ['Capability', 'BusinessService', 'ApplicationService', 'Application'],
    allowedRelationshipTypes: ['DECOMPOSES_TO', 'REALIZED_BY', 'SUPPORTS', 'SUPPORTED_BY'],
  },
  ApplicationDependency: {
    allowedElementTypes: ['Application'],
    allowedRelationshipTypes: ['DEPENDS_ON'],
  },
  ApplicationLandscape: {
    allowedElementTypes: ['Application'],
    allowedRelationshipTypes: [],
  },
  TechnologyLandscape: {
    allowedElementTypes: ['Technology'],
    allowedRelationshipTypes: [],
  },
  ImpactView: {
    allowedElementTypes: ['Programme', 'Capability'],
    allowedRelationshipTypes: ['IMPACTS'],
  },
};

/**
 * In-memory repository for architectural view definitions.
 *
 * Persistence-ready boundaries:
 * - Keeps project scoping explicit via constructor.
 * - Uses immutable ids.
 * - Enforces governance constraints at write-time.
 */
export class ViewRepository {
  readonly projectId: string;

  private readonly byId = new Map<string, ViewDefinition>();
  private readonly idByNormalizedName = new Map<string, string>();

  constructor(projectId: string) {
    this.projectId = (projectId ?? '').trim();
    if (!this.projectId) throw new Error('ViewRepository requires a projectId.');
  }

  createView(view: ViewDefinition): ViewRepositoryCreateResult {
    const embeddedKey = hasEmbeddedPayload(view);
    if (embeddedKey) {
      return {
        ok: false,
        error: `Rejected createView: view definitions must not embed payloads (forbidden key "${embeddedKey}").`,
      };
    }

    const id = (view.id ?? '').trim();
    if (!id) return { ok: false, error: 'Rejected createView: id is required.' };

    if (this.byId.has(id)) {
      return { ok: false, error: `Rejected createView: duplicate id "${id}".` };
    }

    const name = (view.name ?? '').trim();
    if (!name) return { ok: false, error: 'Rejected createView: name is required.' };

    const normalizedName = normalizeName(name);
    if (this.idByNormalizedName.has(normalizedName)) {
      return { ok: false, error: `Rejected createView: duplicate view name "${name}" for project.` };
    }

    if (!isValidViewType(view.viewType)) {
      return { ok: false, error: `Rejected createView: invalid viewType "${String(view.viewType)}".` };
    }

    const normalizedElementTypes = normalizeList(view.allowedElementTypes);
    const normalizedRelationshipTypes = normalizeList(view.allowedRelationshipTypes);

    if (normalizedElementTypes.length === 0) {
      return { ok: false, error: 'Rejected createView: allowedElementTypes must be non-empty.' };
    }

    // Ensure view definition content is compatible with the declared viewType.
    const rule = viewTypeRules[view.viewType];

    for (const t of normalizedElementTypes) {
      if (!rule.allowedElementTypes.includes(t)) {
        return {
          ok: false,
          error: `Rejected createView: elementType "${t}" is not allowed for viewType "${view.viewType}".`,
        };
      }
    }

    for (const t of normalizedRelationshipTypes) {
      if (!rule.allowedRelationshipTypes.includes(t)) {
        return {
          ok: false,
          error: `Rejected createView: relationshipType "${t}" is not allowed for viewType "${view.viewType}".`,
        };
      }
    }

    // Reject invalid element/relationship combinations.
    // For each relationship type included, the view must include at least one valid from type AND one valid to type.
    const elementTypeSet = new Set(normalizedElementTypes);

    for (const relationshipType of normalizedRelationshipTypes) {
      const endpoints = getRelationshipEndpointRule(relationshipType);
      if (!endpoints) {
        return {
          ok: false,
          error: `Rejected createView: unknown relationshipType "${relationshipType}" (no endpoint semantics defined).`,
        };
      }

      if (!hasAny(elementTypeSet, endpoints.from) || !hasAny(elementTypeSet, endpoints.to)) {
        return {
          ok: false,
          error: `Rejected createView: relationshipType "${relationshipType}" requires endpoint types (${endpoints.from.join(
            ' | ',
          )} -> ${endpoints.to.join(' | ')}), but allowedElementTypes=[${normalizedElementTypes.join(', ')}].`,
        };
      }
    }

    // Store a normalized copy to keep comparisons deterministic.
    const stored: ViewDefinition = {
      ...view,
      name,
      allowedElementTypes: normalizedElementTypes,
      allowedRelationshipTypes: normalizedRelationshipTypes,
    };

    this.byId.set(id, stored);
    this.idByNormalizedName.set(normalizedName, id);

    return { ok: true, view: stored };
  }

  deleteViewById(id: string): ViewRepositoryDeleteResult {
    const key = (id ?? '').trim();
    if (!key) return { ok: false, error: 'Rejected deleteViewById: id is required.' };

    const existing = this.byId.get(key);
    if (!existing) return { ok: false, error: `Rejected deleteViewById: no such view "${key}".` };

    this.byId.delete(key);
    this.idByNormalizedName.delete(normalizeName(existing.name));

    return { ok: true, deleted: existing };
  }

  getViewById(id: string): ViewDefinition | null {
    const key = (id ?? '').trim();
    return this.byId.get(key) ?? null;
  }

  getViewsByType(viewType: ViewType): ViewDefinition[] {
    const results: ViewDefinition[] = [];
    for (const v of this.byId.values()) {
      if (v.viewType === viewType) results.push(v);
    }
    results.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    return results;
  }

  listAllViews(): ViewDefinition[] {
    const results = Array.from(this.byId.values());
    results.sort((a, b) => a.viewType.localeCompare(b.viewType) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    return results;
  }
}
