export const OBJECT_TYPES = [
  'Enterprise',
  'CapabilityCategory',
  'Capability',
  'SubCapability',
  'BusinessService',
  'BusinessProcess',
  'Department',
  'Application',
  'ApplicationService',
  'Technology',
  'Programme',
  'Project',
  'Principle',
  'Requirement',
] as const;

export type ObjectType = (typeof OBJECT_TYPES)[number];

export const RELATIONSHIP_TYPES = [
  'DECOMPOSES_TO',
  // Business-process execution (legacy)
  'REALIZES',
  'DEPENDS_ON',
  'HOSTED_ON',
  // Enterprise / organization
  'OWNS',
  'HAS',

  // Business service traceability
  'REALIZED_BY',

  // Application service traceability
  'PROVIDES',
  'SUPPORTS',

  // Cross-layer (core)
  'SUPPORTED_BY',
  'IMPACTS',
  'IMPLEMENTS',

  // Strategy (legacy)
  'DELIVERS',
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export type EaLayer = 'Strategy' | 'Business' | 'Application' | 'Technology';

export type EaObjectTypeDefinition = {
  type: ObjectType;
  layer: EaLayer;
  description: string;
  attributes: readonly string[];
  allowedOutgoingRelationships: readonly RelationshipType[];
  allowedIncomingRelationships: readonly RelationshipType[];
};

export type EaRelationshipTypeDefinition = {
  type: RelationshipType;
  layer: EaLayer;
  description: string;
  fromTypes: readonly ObjectType[];
  toTypes: readonly ObjectType[];
  attributes: readonly string[];
};

export const EA_LAYERS: readonly EaLayer[] = ['Strategy', 'Business', 'Application', 'Technology'] as const;

export const OBJECT_TYPE_DEFINITIONS: Record<ObjectType, EaObjectTypeDefinition> = {
  Enterprise: {
    type: 'Enterprise',
    layer: 'Business',
    description:
      'A legal entity / enterprise / business unit. Supports hierarchical ownership (group → subsidiary → unit).',
    attributes: ['name'],
    allowedOutgoingRelationships: ['OWNS', 'HAS'],
    allowedIncomingRelationships: ['OWNS'],
  },
  Programme: {
    type: 'Programme',
    layer: 'Strategy',
    description: 'A strategic initiative grouping related change outcomes and delivery work.',
    attributes: ['name'],
    allowedOutgoingRelationships: ['DELIVERS', 'IMPACTS'],
    allowedIncomingRelationships: [],
  },
  Project: {
    type: 'Project',
    layer: 'Strategy',
    description: 'A time-bound delivery effort (v1: catalogued but not fully modeled).',
    attributes: ['name'],
    allowedOutgoingRelationships: ['IMPLEMENTS'],
    allowedIncomingRelationships: [],
  },
  Principle: {
    type: 'Principle',
    layer: 'Strategy',
    description: 'A guiding principle that shapes architecture decisions.',
    attributes: ['name'],
    allowedOutgoingRelationships: [],
    allowedIncomingRelationships: [],
  },
  Requirement: {
    type: 'Requirement',
    layer: 'Strategy',
    description: 'A requirement that constrains or informs architecture and change work.',
    attributes: ['name'],
    allowedOutgoingRelationships: [],
    allowedIncomingRelationships: [],
  },
  CapabilityCategory: {
    type: 'CapabilityCategory',
    layer: 'Business',
    description: 'A top-level grouping of business capabilities.',
    attributes: ['name', 'category'],
    allowedOutgoingRelationships: ['DECOMPOSES_TO'],
    allowedIncomingRelationships: ['DECOMPOSES_TO', 'DELIVERS'],
  },
  Capability: {
    type: 'Capability',
    layer: 'Business',
    description: 'A business capability (what the business does).',
    attributes: ['name', 'category'],
    allowedOutgoingRelationships: ['DECOMPOSES_TO', 'REALIZED_BY', 'SUPPORTED_BY'],
    allowedIncomingRelationships: ['DECOMPOSES_TO', 'DELIVERS', 'IMPACTS', 'OWNS'],
  },
  SubCapability: {
    type: 'SubCapability',
    layer: 'Business',
    description: 'A decomposed business capability (more granular capability).',
    attributes: ['name', 'category'],
    allowedOutgoingRelationships: [],
    allowedIncomingRelationships: ['DECOMPOSES_TO', 'DELIVERS'],
  },
  BusinessProcess: {
    type: 'BusinessProcess',
    layer: 'Business',
    description: 'A business process (how work is performed across steps/activities).',
    attributes: ['name'],
    allowedOutgoingRelationships: ['REALIZES'],
    allowedIncomingRelationships: [],
  },
  BusinessService: {
    type: 'BusinessService',
    layer: 'Business',
    description: 'A business service that exposes value delivery, realized by capabilities and supported by application services.',
    attributes: ['name'],
    allowedOutgoingRelationships: [],
    allowedIncomingRelationships: ['REALIZED_BY', 'SUPPORTS'],
  },
  Department: {
    type: 'Department',
    layer: 'Business',
    description: 'An organizational unit (cannot exist without an owning Enterprise).',
    attributes: ['name'],
    allowedOutgoingRelationships: [],
    allowedIncomingRelationships: ['HAS'],
  },
  Application: {
    type: 'Application',
    layer: 'Application',
    description: 'A software application or service.',
    attributes: ['name', 'criticality', 'lifecycle'],
    allowedOutgoingRelationships: ['DEPENDS_ON', 'HOSTED_ON', 'PROVIDES'],
    allowedIncomingRelationships: ['DEPENDS_ON', 'REALIZES', 'DELIVERS', 'SUPPORTED_BY', 'OWNS', 'IMPLEMENTS'],
  },
  ApplicationService: {
    type: 'ApplicationService',
    layer: 'Application',
    description: 'An application-exposed service (fine-grained traceability layer). Belongs to exactly one Application.',
    attributes: ['name'],
    allowedOutgoingRelationships: ['SUPPORTS'],
    allowedIncomingRelationships: ['PROVIDES'],
  },
  Technology: {
    type: 'Technology',
    layer: 'Technology',
    description: 'A technology platform/component that applications run on or use.',
    attributes: ['name'],
    allowedOutgoingRelationships: [],
    allowedIncomingRelationships: ['HOSTED_ON'],
  },
} as const;

export const RELATIONSHIP_TYPE_DEFINITIONS: Record<RelationshipType, EaRelationshipTypeDefinition> = {
  DECOMPOSES_TO: {
    type: 'DECOMPOSES_TO',
    layer: 'Business',
    description: 'Decomposition relationship used to break a parent element into child elements.',
    fromTypes: ['CapabilityCategory', 'Capability', 'SubCapability'],
    toTypes: ['CapabilityCategory', 'Capability', 'SubCapability'],
    attributes: [],
  },
  REALIZES: {
    type: 'REALIZES',
    layer: 'Business',
    description: 'Indicates an application realizes (implements/enables) a business process.',
    fromTypes: ['BusinessProcess'],
    toTypes: ['Application'],
    attributes: [],
  },
  DEPENDS_ON: {
    type: 'DEPENDS_ON',
    layer: 'Application',
    description: 'Dependency relationship between applications (service/application calling another).',
    fromTypes: ['Application'],
    toTypes: ['Application'],
    attributes: ['dependencyStrength', 'dependencyType'],
  },
  HOSTED_ON: {
    type: 'HOSTED_ON',
    layer: 'Technology',
    description: 'Hosting relationship (application hosted on / deployed to technology).',
    fromTypes: ['Application'],
    toTypes: ['Technology'],
    attributes: [],
  },
  DELIVERS: {
    type: 'DELIVERS',
    layer: 'Strategy',
    description: 'Delivery relationship from a programme to a delivered business/application outcome.',
    fromTypes: ['Programme'],
    toTypes: ['CapabilityCategory', 'Capability', 'SubCapability', 'Application'],
    attributes: [],
  },
  OWNS: {
    type: 'OWNS',
    layer: 'Business',
    description:
      'Ownership relationship. Enterprises can own enterprises (hierarchy) and own key EA elements for accountability.',
    fromTypes: ['Enterprise'],
    toTypes: ['Enterprise', 'Capability', 'Application', 'Programme'],
    attributes: [],
  },
  HAS: {
    type: 'HAS',
    layer: 'Business',
    description: 'Enterprise has a Department (Departments cannot exist without an Enterprise).',
    fromTypes: ['Enterprise'],
    toTypes: ['Department'],
    attributes: [],
  },
  REALIZED_BY: {
    type: 'REALIZED_BY',
    layer: 'Business',
    description: 'Capability is realized by a Business Service.',
    fromTypes: ['Capability', 'SubCapability'],
    toTypes: ['BusinessService'],
    attributes: [],
  },
  PROVIDES: {
    type: 'PROVIDES',
    layer: 'Application',
    description: 'Application provides an Application Service.',
    fromTypes: ['Application'],
    toTypes: ['ApplicationService'],
    attributes: [],
  },
  SUPPORTS: {
    type: 'SUPPORTS',
    layer: 'Application',
    description: 'Application Service supports a Business Service (traceability layer).',
    fromTypes: ['ApplicationService'],
    toTypes: ['BusinessService'],
    attributes: [],
  },
  SUPPORTED_BY: {
    type: 'SUPPORTED_BY',
    layer: 'Business',
    description: 'Capability is supported by an Application (business → application alignment).',
    fromTypes: ['Capability', 'SubCapability'],
    toTypes: ['Application'],
    attributes: [],
  },
  IMPACTS: {
    type: 'IMPACTS',
    layer: 'Strategy',
    description: 'Programme impacts a Capability (roadmap / change traceability).',
    fromTypes: ['Programme'],
    toTypes: ['Capability', 'SubCapability'],
    attributes: [],
  },
  IMPLEMENTS: {
    type: 'IMPLEMENTS',
    layer: 'Strategy',
    description: 'Project implements an Application.',
    fromTypes: ['Project'],
    toTypes: ['Application'],
    attributes: [],
  },
} as const;

export function isValidObjectType(type: unknown): type is ObjectType {
  return typeof type === 'string' && (OBJECT_TYPES as readonly string[]).includes(type);
}

export function isValidRelationshipType(type: unknown): type is RelationshipType {
  return typeof type === 'string' && (RELATIONSHIP_TYPES as readonly string[]).includes(type);
}
