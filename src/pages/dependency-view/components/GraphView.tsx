import React, { useEffect, useRef } from 'react';
import cytoscape, { Core } from 'cytoscape';

import type { ObjectType, RelationshipType } from '../utils/eaMetaModel';
import type { EaRepository } from '../utils/eaRepository';
import type { EaViewDefinition } from '../utils/eaViewDefinitions';
import type { LifecycleCoverage } from '@/repository/repositoryMetadata';
import { isObjectVisibleForLifecycleCoverage } from '@/repository/lifecycleCoveragePolicy';

export type EaGraphNode = {
  id: string;
  label: string;
  objectType: ObjectType;
  attributes?: Record<string, unknown>;
};

export type EaGraphEdge = {
  fromId: string;
  toId: string;
  relationshipType: RelationshipType;
  attributes?: Record<string, unknown>;
};

type GraphViewProps = {
  depth: 1 | 2 | 3;
  eaRepository: EaRepository;
  lifecycleCoverage?: LifecycleCoverage | null;
  viewDefinition: EaViewDefinition;
  viewMode: 'landscape' | 'impact';
  rootNodeId?: string;
  impactPaths?: string[][];
  defaultLayout?: 'grid' | 'cose' | 'breadthfirst';
  onSelectNode?: (node: EaGraphNode) => void;
  onSelectEdge?: (edge: EaGraphEdge) => void;
};

const filterGraphByDepth = (
  data: { nodes: EaGraphNode[]; edges: EaGraphEdge[] },
  rootId: string,
  depth: number,
) => {
  if (!rootId) {
    return { nodes: [], edges: [] };
  }
  const outgoing = new Map<string, string[]>();
  for (const e of data.edges) {
    const current = outgoing.get(e.fromId);
    if (current) current.push(e.toId);
    else outgoing.set(e.fromId, [e.toId]);
  }

  const included = new Set<string>([rootId]);
  let frontier = new Set<string>([rootId]);

  for (let i = 0; i < depth; i += 1) {
    const next = new Set<string>();
    for (const nodeId of frontier) {
      const neighbors = outgoing.get(nodeId) ?? [];
      for (const neighborId of neighbors) {
        if (!included.has(neighborId)) {
          included.add(neighborId);
          next.add(neighborId);
        }
      }
    }
    frontier = next;
    if (frontier.size === 0) break;
  }

  return {
    nodes: data.nodes.filter((n) => included.has(n.id)),
    edges: data.edges.filter((e) => included.has(e.fromId) && included.has(e.toId)),
  };
};

const GraphView = ({
  depth,
  eaRepository,
  lifecycleCoverage,
  viewDefinition,
  viewMode,
  rootNodeId,
  impactPaths,
  defaultLayout,
  onSelectNode,
  onSelectEdge,
}: GraphViewProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const impactPathsRef = useRef<string[][] | undefined>(impactPaths);

  const applyImpactPathHighlight = (cy: Core, paths?: string[][]) => {
    cy.elements().removeClass('highlighted faded');

    if (!paths || paths.length === 0) return;

    const nodeIds = new Set<string>();
    const edgePairs = new Set<string>();

    for (const path of paths) {
      for (let i = 0; i < path.length; i += 1) {
        const nodeId = path[i];
        nodeIds.add(nodeId);
        if (i > 0) edgePairs.add(`${path[i - 1]}->${nodeId}`);
      }
    }

    const nodesToHighlight = cy.nodes().filter((n) => nodeIds.has(n.id()));
    const edgesToHighlight = cy
      .edges()
      .filter((e) => edgePairs.has(`${e.data('source')}->${e.data('target')}`));

    const elementsToHighlight = nodesToHighlight.union(edgesToHighlight);
    cy.elements().not(elementsToHighlight).addClass('faded');
    elementsToHighlight.addClass('highlighted');
  };

  useEffect(() => {
    impactPathsRef.current = impactPaths;
    if (cyRef.current) applyImpactPathHighlight(cyRef.current, impactPaths);
  }, [impactPaths]);

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;
    let raf1: number | undefined;
    let raf2: number | undefined;

    const allowedObjectTypeSet = new Set(viewDefinition.allowedObjectTypes);
    const allowedRelationshipTypeSet = new Set(viewDefinition.allowedRelationshipTypes);

    const nodes: EaGraphNode[] = Array.from(eaRepository.objects.values())
      .filter((obj) => allowedObjectTypeSet.has(obj.type))
      .filter((obj) => obj.attributes.hiddenFromDiagrams !== true)
      .filter((obj) => obj.attributes._deleted !== true)
      .filter((obj) => isObjectVisibleForLifecycleCoverage(lifecycleCoverage, obj.attributes ?? {}))
      .map((obj) => {
        const name = typeof obj.attributes.name === 'string' && obj.attributes.name.trim() ? obj.attributes.name : obj.id;
        return {
          id: obj.id,
          label: name,
          objectType: obj.type,
          attributes: obj.attributes,
        };
      });

    const nodeIdSet = new Set(nodes.map((n) => n.id));

    const edges: EaGraphEdge[] = eaRepository.relationships
      .filter((r) => allowedRelationshipTypeSet.has(r.type))
      .filter((r) => nodeIdSet.has(r.fromId) && nodeIdSet.has(r.toId))
      .map((r) => ({
        fromId: r.fromId,
        toId: r.toId,
        relationshipType: r.type,
        attributes: r.attributes,
      }));

    const data = { nodes, edges };
    const resolvedRootId = rootNodeId && nodes.some((n) => n.id === rootNodeId) ? rootNodeId : '';

    const filtered =
      viewMode === 'landscape'
        ? data
        : resolvedRootId
          ? filterGraphByDepth(data, resolvedRootId, depth)
          : { nodes: [], edges: [] };
    const nodeById = new Map(filtered.nodes.map((n) => [n.id, n] as const));
    const edgeByEdgeId = new Map<string, EaGraphEdge>();

    const elements = [
      ...filtered.nodes.map((n) => ({
        data: { id: n.id, label: n.label, objectType: n.objectType },
      })),
      ...filtered.edges
        .filter((e) => nodeById.has(e.fromId) && nodeById.has(e.toId))
        .map((e, index) => {
          const id = `e-${index}`;
          edgeByEdgeId.set(id, e);
          return {
            data: {
              id,
              source: e.fromId,
              target: e.toId,
              relationshipType: e.relationshipType,
            },
          };
        }),
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      layout: { name: defaultLayout ?? viewDefinition.defaultLayout ?? 'grid', avoidOverlap: true },
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'background-color': '#1677ff',
            color: '#ffffff',
            'font-size': 12,
            width: 56,
            height: 56,
          },
        },
        {
          selector: 'node.faded',
          style: {
            opacity: 0.2,
            'text-opacity': 0.2,
          },
        },
        {
          selector: 'edge.faded',
          style: {
            opacity: 0.1,
          },
        },
        {
          selector: 'node.highlighted',
          style: {
            'border-width': 3,
            'border-color': '#52c41a',
          },
        },
        {
          selector: 'edge.highlighted',
          style: {
            width: 3,
            'line-color': '#52c41a',
            'target-arrow-color': '#52c41a',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#91caff',
            'target-arrow-color': '#91caff',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
          },
        },
      ],
    });

    cyRef.current = cy;

    const resizeAndFit = () => {
      if (disposed) return;
      // Avoid calling into Cytoscape after destroy/unmount.
      if (!cyRef.current) return;
      try {
        cy.resize();
        cy.fit(undefined, 24);
      } catch {
        // Best-effort: Cytoscape can throw if container is gone mid-frame.
      }
    };

    // Cytoscape can initialize before the container has a final size.
    // A couple of rAF ticks makes it much more reliable in complex layouts.
    raf1 = requestAnimationFrame(() => {
      resizeAndFit();
      raf2 = requestAnimationFrame(resizeAndFit);
    });

    window.addEventListener('resize', resizeAndFit);

    const onNodeTap = (event: cytoscape.EventObject) => {
      const node = event.target as cytoscape.NodeSingular;
      const hasImpactPaths = (impactPathsRef.current?.length ?? 0) > 0;
      if (!hasImpactPaths) {
        const neighborhood = node.neighborhood().add(node);

        cy.elements().removeClass('highlighted faded');
        cy.elements().not(neighborhood).addClass('faded');
        neighborhood.addClass('highlighted');
      }

      const selected = nodeById.get(node.id());
      if (selected) onSelectNode?.(selected);
    };

    const onEdgeTap = (event: cytoscape.EventObject) => {
      const edge = event.target as cytoscape.EdgeSingular;
      const hasImpactPaths = (impactPathsRef.current?.length ?? 0) > 0;
      if (!hasImpactPaths) {
        cy.elements().removeClass('highlighted faded');
        edge.addClass('highlighted');
      }

      const selected = edgeByEdgeId.get(edge.id());
      if (selected) onSelectEdge?.(selected);
    };

    cy.on('tap', 'node', onNodeTap);
    cy.on('tap', 'edge', onEdgeTap);

    // If parent already has computed paths, apply them immediately.
    applyImpactPathHighlight(cy, impactPathsRef.current);

    return () => {
      disposed = true;
      if (raf1 !== undefined) cancelAnimationFrame(raf1);
      if (raf2 !== undefined) cancelAnimationFrame(raf2);
      window.removeEventListener('resize', resizeAndFit);
      cy.off('tap', 'node', onNodeTap);
      cy.off('tap', 'edge', onEdgeTap);
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [
    defaultLayout,
    depth,
    eaRepository,
    lifecycleCoverage,
    onSelectEdge,
    onSelectNode,
    rootNodeId,
    viewDefinition,
    viewMode,
  ]);

  return <div id="graph-container" ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default GraphView;
