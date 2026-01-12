import { ProCard } from '@ant-design/pro-components';
import { Alert, Descriptions, Tag, Typography } from 'antd';
import cytoscape, { type Core } from 'cytoscape';
import React from 'react';

import type { ViewDefinition } from '../../../backend/views/ViewDefinition';
import { getViewRepository } from '../../../backend/views/ViewRepositoryStore';
import { viewResolver, type ResolvedViewData } from '../../../backend/views/ViewResolver';
import { graphRenderingAdapter } from '../../pages/dependency-view/utils/GraphRenderingAdapter';
import { ENTERPRISE_VIEW_GOVERNANCE_POLICY, evaluateViewGovernance } from '../../../backend/views/ViewGovernance';
import ArchitectureReviewPanel from '@/components/ArchitectureReviewPanel';
import { useEaRepository } from '@/ea/EaRepositoryContext';
import { getTimeHorizonWindow } from '@/repository/timeHorizonPolicy';

export type ViewDefinitionTabProps = {
  viewId: string;
};

type ImpactSelectionDetail =
  | {
      kind: 'clear';
    }
  | {
      kind: 'path';
      rootElementId: string;
      impactedElementId: string;
      orderedElementIds: string[];
      orderedRelationshipIds: string[];
    };

const normalizeId = (value: string) => (value ?? '').trim();

const ViewDefinitionTab: React.FC<ViewDefinitionTabProps> = ({ viewId }) => {
  const { metadata } = useEaRepository();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const cyRef = React.useRef<Core | null>(null);
  const [refreshToken, setRefreshToken] = React.useState(0);

  const impactSelectionRef = React.useRef<ImpactSelectionDetail | null>(null);

  const applyImpactHighlight = React.useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.batch(() => {
      cy.elements().removeClass('impact-involved impact-faded');

      const detail = impactSelectionRef.current;
      if (!detail || detail.kind !== 'path') return;

      const elementIds = Array.from(new Set((detail.orderedElementIds ?? []).map(normalizeId).filter(Boolean)));
      const relationshipIds = Array.from(
        new Set((detail.orderedRelationshipIds ?? []).map(normalizeId).filter(Boolean)),
      );

      // Only apply fading if this diagram contains at least one involved node/edge.
      const hasAny =
        elementIds.some((id) => cy.$id(id).nonempty()) || relationshipIds.some((id) => cy.$id(id).nonempty());
      if (!hasAny) return;

      cy.elements().addClass('impact-faded');

      for (const id of elementIds) {
        cy.$id(id).removeClass('impact-faded').addClass('impact-involved');
      }
      for (const id of relationshipIds) {
        cy.$id(id).removeClass('impact-faded').addClass('impact-involved');
      }
    });
  }, []);

  const view: ViewDefinition | null = React.useMemo(() => {
    try {
      return getViewRepository().getViewById(viewId);
    } catch {
      return null;
    }
  }, [viewId, refreshToken]);

  React.useEffect(() => {
    const onChanged = () => setRefreshToken((x) => x + 1);
    window.addEventListener('ea:repositoryChanged', onChanged);
    window.addEventListener('ea:relationshipsChanged', onChanged);
    window.addEventListener('ea:viewsChanged', onChanged);

    const onImpactSelection = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail as ImpactSelectionDetail | undefined;
      if (!detail) return;
      impactSelectionRef.current = detail;
      applyImpactHighlight();
    };
    window.addEventListener('ea:impactSelectionChanged', onImpactSelection);

    return () => {
      window.removeEventListener('ea:repositoryChanged', onChanged);
      window.removeEventListener('ea:relationshipsChanged', onChanged);
      window.removeEventListener('ea:viewsChanged', onChanged);
      window.removeEventListener('ea:impactSelectionChanged', onImpactSelection);
    };
  }, [applyImpactHighlight]);

  const [resolved, setResolved] = React.useState<ResolvedViewData | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setResolved(null);
    if (!view) return () => {
      cancelled = true;
    };

    (async () => {
      try {
        const next = await viewResolver.resolve(view);
        if (!cancelled) setResolved(next);
      } catch {
        if (!cancelled) setResolved(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [view]);

  const graph = React.useMemo(() => {
    if (!view || !resolved) return null;
    return graphRenderingAdapter.toCytoscape({
      elements: resolved.elements,
      relationships: resolved.relationships,
      layoutType: view.layoutType,
      orientation: view.orientation,
    });
  }, [view, resolved]);

  const governance = React.useMemo(() => {
    if (!view) return null;
    return evaluateViewGovernance(view, { resolvedElements: resolved?.elements ?? [] });
  }, [view, resolved]);

  const timeHorizon = metadata?.timeHorizon;
  const horizonWindow = React.useMemo(() => getTimeHorizonWindow(timeHorizon), [timeHorizon]);

  React.useEffect(() => {
    if (!containerRef.current) return undefined;
    if (!view || !graph) return undefined;

    // Initialize once per tab instance.
    if (!cyRef.current) {
      cyRef.current = cytoscape({
        container: containerRef.current,
        elements: graph.elements,
        layout: graph.layout,
        autoungrabify: true,
        userPanningEnabled: true,
        userZoomingEnabled: true,
        boxSelectionEnabled: false,
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
            selector: 'node.impact-faded',
            style: {
              opacity: 0.15,
              'text-opacity': 0.15,
            },
          },
          {
            selector: 'edge.impact-faded',
            style: {
              opacity: 0.1,
            },
          },
          {
            selector: 'node.impact-involved',
            style: {
              'border-width': 3,
              'border-color': '#faad14',
              'background-color': '#fa8c16',
            },
          },
          {
            selector: 'edge.impact-involved',
            style: {
              width: 3,
              'line-color': '#faad14',
              'target-arrow-color': '#faad14',
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

      // If an impact selection existed before this tab mounted, apply it now.
      applyImpactHighlight();

      return () => {
        try {
          cyRef.current?.destroy();
        } catch {
          // Best-effort only.
        } finally {
          cyRef.current = null;
        }
      };
    }

    // Refresh existing instance (data selection may have changed).
    const cy = cyRef.current;
    cy.batch(() => {
      cy.elements().remove();
      cy.add(graph.elements);
    });
    try {
      cy.layout(graph.layout).run();
    } catch {
      // Best-effort only.
    }

    // Re-apply any active impact highlighting after graph refresh.
    applyImpactHighlight();

    return undefined;
  }, [view, graph]);

  if (!view) {
    return (
      <ProCard>
        <Alert
          type="warning"
          message="View not available"
          description="No active project selected, or the view id was not found in the ViewRepository."
          showIcon
        />
      </ProCard>
    );
  }

  return (
    <ProCard>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {view.name}
      </Typography.Title>
      <Typography.Paragraph type="secondary">Read-only diagram lens (pan/zoom enabled).</Typography.Paragraph>

      <div style={{ marginBottom: 12 }}>
        <ArchitectureReviewPanel subjectKind="View" subjectId={view.id} defaultReviewer={view.createdBy} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 0 }}>
          Diagram
        </Typography.Title>
        <Tag>
          Time Horizon: {timeHorizon ?? '1–3 years'} (analysis depth cap {horizonWindow.maxAnalysisDepth})
        </Tag>
      </div>

      {governance && governance.findings.length > 0 ? (
        <Alert
          type="warning"
          showIcon
          message={`Governance warnings (${governance.findings.length})`}
          description={
            <div>
              <Typography.Paragraph style={{ marginBottom: 8 }} type="secondary">
                Policy: maxDepth ≤ {ENTERPRISE_VIEW_GOVERNANCE_POLICY.maxDepth}. Warnings do not block usage.
              </Typography.Paragraph>
              <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                {governance.findings.map((f) => (
                  <li key={f.id}>{f.message}</li>
                ))}
              </ul>
            </div>
          }
        />
      ) : null}

      <div style={{ width: '100%', height: 420, border: '1px solid rgba(0,0,0,0.06)', borderRadius: 6 }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>

      <Descriptions bordered size="small" column={1}>
        <Descriptions.Item label="View id">{view.id}</Descriptions.Item>
        <Descriptions.Item label="View type">{view.viewType}</Descriptions.Item>
        <Descriptions.Item label="Architecture layer">{view.architectureLayer}</Descriptions.Item>
        <Descriptions.Item label="Root element type">{view.rootElementType ?? '(none)'}</Descriptions.Item>
        <Descriptions.Item label="Root element id">{view.rootElementId ?? '(none)'}</Descriptions.Item>
        <Descriptions.Item label="Max depth">{typeof view.maxDepth === 'number' ? view.maxDepth : '(none)'}</Descriptions.Item>
        <Descriptions.Item label="Allowed element types">
          {(view.allowedElementTypes ?? []).join(', ') || '(none)'}
        </Descriptions.Item>
        <Descriptions.Item label="Allowed relationship types">
          {(view.allowedRelationshipTypes ?? []).join(', ') || '(none)'}
        </Descriptions.Item>
        <Descriptions.Item label="Layout">{`${view.layoutType} / ${view.orientation}`}</Descriptions.Item>
        <Descriptions.Item label="Approval status">{view.approvalStatus}</Descriptions.Item>
        <Descriptions.Item label="Created by">{view.createdBy}</Descriptions.Item>
        <Descriptions.Item label="Created at">{view.createdAt}</Descriptions.Item>
        <Descriptions.Item label="Last modified at">{view.lastModifiedAt}</Descriptions.Item>
      </Descriptions>

      <Typography.Title level={5} style={{ marginTop: 16 }}>
        Raw ViewDefinition
      </Typography.Title>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(view, null, 2)}</pre>
    </ProCard>
  );
};

export default ViewDefinitionTab;
