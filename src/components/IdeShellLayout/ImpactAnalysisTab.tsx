import React from 'react';
import ImpactAnalysisWorkspaceTab from './ImpactAnalysisWorkspaceTab';

const ImpactAnalysisTab: React.FC = () => {
  return <ImpactAnalysisWorkspaceTab />;
};

export default ImpactAnalysisTab;

/*
 * Legacy coupled implementation (runner + result rendering) is intentionally disabled.
 * Analysis results now open in separate read-only tabs.


  const [loadingExplanation, setLoadingExplanation] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [state, setState] = React.useState<ImpactTabState>({});

  const loadElements = React.useCallback(async () => {
    setLoadingElements(true);
    setError(null);
    try {
      const [caps, procs, apps, tech, progs] = await Promise.all([
        getRepositoryCapabilities(),
        getRepositoryProcesses(),
        getRepositoryApplications(),
        getRepositoryTechnologies(),
        getRepositoryProgrammes(),
      ]);

      const all: BaseArchitectureElement[] = [];
      if (caps?.success) all.push(...(caps.data ?? []));
      if (procs?.success) all.push(...(procs.data ?? []));
      if (apps?.success) all.push(...(apps.data ?? []));
      if (tech?.success) all.push(...(tech.data ?? []));
      if (progs?.success) all.push(...(progs.data ?? []));

      const next = all
        .map((e) => ({ id: normalizeId(e.id), name: e.name || e.id, elementType: e.elementType }))
        .filter((e) => e.id.length > 0)
        .sort((a, b) =>
          compareStrings(a.elementType, b.elementType) || compareStrings(a.name, b.name) || compareStrings(a.id, b.id),
        );

      setElements(next);
    } catch (e: any) {
      setError(e?.message || 'Failed to load repository elements.');
    } finally {
      setLoadingElements(false);
    }
  }, []);

  React.useEffect(() => {
    // Read-only data load is allowed; analysis is never auto-run.
    void loadElements();

    // Visible defaults (not hidden assumptions).
    form.setFieldsValue({
      direction: 'Downstream',
      maxDepth: 6,
      includedRelationshipTypes: relationshipTypeOptions,
      analysisIntent: 'Change',
      requestedBy: 'analyst',
      includePaths: false,
    });
  }, [form, loadElements]);

  const runAnalysis = React.useCallback(async () => {
    setRunning(true);
    setError(null);
    const { openWorkspaceTab } = useIdeShell();
    const { project } = useEaProject();

    // Explicit run should clear any previous cross-diagram highlighting.
    dispatchImpactSelection({ kind: 'clear' });

    try {
      const values = await form.validateFields();

      const rootElementId = normalizeId(values.rootElementId);
      const direction = values.direction as ImpactAnalysisDirection;
      const maxDepth = Number(values.maxDepth);
      const includedRelationshipTypes = (values.includedRelationshipTypes as string[]).slice().sort(compareStrings);
      const analysisIntent = values.analysisIntent as ImpactAnalysisIntent;
      const requestedBy = String(values.requestedBy ?? '').trim();
      const includePaths = Boolean(values.includePaths);

      const root = elementById.get(rootElementId);
      const rootElementType = root?.elementType ?? 'Unknown';

      const requestedAt = new Date().toISOString();
      const basis = `${rootElementId}|${rootElementType}|${direction}|${maxDepth}|${includedRelationshipTypes.join(',')}|${analysisIntent}`;

      const request: ImpactAnalysisRequest = {
        requestId: stableRequestId(basis),
        projectId: '',
        requestedBy,
        requestedAt,

        rootElementId,
        rootElementType,
        direction,
        maxDepth,

        includedElementTypes: [],
        includedRelationshipTypes,

        analysisIntent,
      };

      const resp = await postImpactAnalyze(request, { includePaths });
      if (!resp?.success) {
        throw new Error(resp?.errorMessage || 'Impact analysis failed.');
      }

      const data = resp.data;

      setState({
        request,
        summary: data.impactSummary,
        rankedImpacts: data.rankedImpacts,
        impactPathsCount: data.impactPaths?.length,
        audit: data.audit
          ? {
              auditId: data.audit.auditId,
              requestId: data.audit.requestId,
              ranBy: data.audit.ranBy,
              ranAt: data.audit.ranAt,
              direction: data.audit.parameters.direction,
              maxDepth: data.audit.parameters.maxDepth,
              includedRelationshipTypes: data.audit.parameters.includedRelationshipTypes,
            }
          : undefined,
        selectedElementId: undefined,
        explanationText: undefined,
        representativePathLength: undefined,
        selectionPolicy: undefined,
      });
    } catch (e: any) {
      setError(e?.message || 'Impact analysis failed.');
    } finally {
      setRunning(false);
    }
  }, [elementById, form]);

  const explainSelected = React.useCallback(
    async (elementId: string) => {
      const request = state.request;
      if (!request) return;

      setLoadingExplanation(true);
      setError(null);

      try {
        const resp = await getImpactExplanation({
          rootId: request.rootElementId,
          elementId,
          direction: request.direction,
          maxDepth: request.maxDepth,
          relationshipTypes: request.includedRelationshipTypes,
        });

        if (!resp?.success) {
          const msg = resp?.errorMessage || 'Explanation not found.';
          throw new Error(msg);
        }

        const result = resp.data;
        if (!result.ok) throw new Error(result.error);

        dispatchImpactSelection({
          kind: 'path',
          rootElementId: result.rootElementId,
          impactedElementId: result.impactedElementId,
          orderedElementIds: (result.representativePath.orderedElementIds ?? []).slice(),
          orderedRelationshipIds: (result.representativePath.orderedRelationshipIds ?? []).slice(),
        });

        setState((prev) => ({
          ...prev,
          selectedElementId: elementId,
          explanationText: result.explanationText,
          representativePathLength: result.representativePath.pathLength,
          selectionPolicy: result.selectionPolicy,
        }));
      } catch (e: any) {
        setError(e?.message || 'Failed to retrieve explanation.');
      } finally {
        setLoadingExplanation(false);
      }
    },
    [state.request],
  );

  const columns: ColumnsType<ImpactRankedElement> = [
    {
      title: 'Score',
      width: 90,
      render: (_: unknown, row) => row.score?.computedScore ?? 0,
      sorter: false,
    },
    {
      title: 'Severity',
      width: 110,
      render: (_: unknown, row) => row.score?.severityLabel ?? 'Low',
    },
    {
      title: 'Element',
      render: (_: unknown, row) => {
        const e = elementById.get(row.elementId);
        return (
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{e?.name ?? row.elementId}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {e?.elementType ?? 'Unknown'} · {row.elementId}
            </Typography.Text>
          </Space>
        );
      },
    },
    {
      title: 'Paths',
      width: 90,
      render: (_: unknown, row) => row.evidence.totalPathsAffectingElement,
    },
    {
      title: 'Hard',
      width: 80,
      render: (_: unknown, row) => row.evidence.hardPathCount,
    },
    {
      title: 'Soft-only',
      width: 100,
      render: (_: unknown, row) => row.evidence.softOnlyPathCount,
    },
    {
      title: 'Max depth',
      width: 110,
      render: (_: unknown, row) => row.evidence.maxDepthObserved,
    },
  ];

  const summary = state.summary;
  const ranked = state.rankedImpacts ?? [];
  const selectedId = state.selectedElementId;

  return (
    <div style={{ padding: 12 }}>
      <Typography.Title level={5} style={{ marginTop: 0 }}>
          const rootLabel = root?.name ? root.name : rootElementId;
          const result = createAnalysisResult({
            kind: 'impact',
            title: `Impact: ${rootLabel}`,
            data: {
              request,
              summary: data.impactSummary,
              rankedImpacts: data.rankedImpacts,
              impactPathsCount: data.impactPaths?.length,
              audit: data.audit
                ? {
                    auditId: data.audit.auditId,
                    requestId: data.audit.requestId,
                    ranBy: data.audit.ranBy,
                    ranAt: data.audit.ranAt,
                    direction: data.audit.parameters.direction,
                    maxDepth: data.audit.parameters.maxDepth,
                    includedRelationshipTypes: data.audit.parameters.includedRelationshipTypes,
                  }
                : undefined,
              elementIndex: elements,
            },
          });

          message.success('Impact analysis completed. Opening result tab…');
          openWorkspaceTab({ type: 'analysisResult', resultId: result.id });
          description="Element criticality is currently assumed Unknown for all elements (no criticality field exists in the repository model yet)."
          style={{ marginBottom: 12 }}
        />
        <Form form={form} layout="vertical">
          <Space align="start" size={16} wrap>
            <Form.Item
              label="Root element"
              name="rootElementId"
              rules={[{ required: true, message: 'Select a root element' }]}
              style={{ minWidth: 420 }}
            >
              <Select
                showSearch
                placeholder={loadingElements ? 'Loading…' : 'Select root'}
                optionFilterProp="label"
                options={elements.map((e) => ({
            message="Repository-only, explicit analysis"
                  label: `${e.name} (${e.elementType})`,
                }))}
                Analysis only runs when you click <strong>Run analysis</strong>. It reads repository data only and opens results in a separate read-only tab.
            </Form.Item>

            <Form.Item label="Direction" name="direction" rules={[{ required: true }]} style={{ minWidth: 240 }}>
              <Select options={directionOptions} />
            </Form.Item>

            <Form.Item label="Max depth" name="maxDepth" rules={[{ required: true }]} style={{ width: 140 }}>
              <InputNumber min={1} max={25} />
            </Form.Item>

            <Form.Item label="Intent" name="analysisIntent" rules={[{ required: true }]} style={{ minWidth: 200 }}>
              <Select options={intentOptions} />
            </Form.Item>

            <Form.Item label="Requested by" name="requestedBy" rules={[{ required: true }]} style={{ minWidth: 200 }}>
              <Input />
            </Form.Item>
          </Space>

          <Form.Item
            label="Allowed relationship types"
            name="includedRelationshipTypes"
            rules={[{ required: true, message: 'Select at least one relationship type' }]}
          >
            <Select
              mode="multiple"
              placeholder="Select relationship types"
              options={relationshipTypeOptions.map((t) => ({ value: t, label: t }))}
            />
          </Form.Item>

          <Form.Item
            label="Include raw paths (optional)"
            name="includePaths"
            valuePropName="checked"
            tooltip="Gated. When enabled, the API returns raw ImpactPaths which can be large."
          >
            <Switch />
          </Form.Item>

          <Space>
            <Button type="primary" onClick={() => void runAnalysis()} loading={running}>
              Run analysis
            </Button>
            <Typography.Text type="secondary">No auto-run; results update only on explicit run.</Typography.Text>
          </Space>
        </Form>
      </Card>

      {error ? (
        <div style={{ marginTop: 12 }}>
          <Alert type="error" showIcon message={error} />
        </div>
      ) : null}

      <Divider style={{ margin: '12px 0' }} />

      <Card size="small" title="1) Impact Summary">
        {summary ? (
          <Descriptions size="small" column={2}>
            <Descriptions.Item label="Root">{elementById.get(summary.rootElementId)?.name ?? summary.rootElementId}</Descriptions.Item>
            <Descriptions.Item label="Total impacted elements">{summary.totalImpactedElements}</Descriptions.Item>
            <Descriptions.Item label="Severity (H/M/L)">
              {summary.severityBreakdown.High}/{summary.severityBreakdown.Medium}/{summary.severityBreakdown.Low}
            </Descriptions.Item>
            <Descriptions.Item label="Max dependency depth observed">{summary.maxDependencyDepthObserved}</Descriptions.Item>
            <Descriptions.Item label="Analysis timestamp" span={2}>
              {summary.analysisTimestamp}
            </Descriptions.Item>

            {state.audit ? (
              <>
                <Descriptions.Item label="Audit id" span={2}>
                  {state.audit.auditId}
                </Descriptions.Item>
                <Descriptions.Item label="Ran by">{state.audit.ranBy}</Descriptions.Item>
                <Descriptions.Item label="Ran at">{state.audit.ranAt}</Descriptions.Item>
                <Descriptions.Item label="Direction">{state.audit.direction}</Descriptions.Item>
                <Descriptions.Item label="Max depth">{state.audit.maxDepth}</Descriptions.Item>
                <Descriptions.Item label="Relationship types" span={2}>
                  {(state.audit.includedRelationshipTypes ?? []).join(', ') || '(none)'}
                </Descriptions.Item>
              </>
            ) : null}
          </Descriptions>
        ) : (
          <Typography.Text type="secondary">Run an analysis to see the summary.</Typography.Text>
        )}
      </Card>

      {state.audit ? (
        <div style={{ marginTop: 12 }}>
          <ArchitectureReviewPanel
            subjectKind="ImpactAnalysis"
            subjectId={state.audit.auditId}
            defaultReviewer={state.audit.ranBy}
          />
        </div>
      ) : null}

      <Divider style={{ margin: '12px 0' }} />

      <Card size="small" title="2) Ranked Impact List" extra={state.impactPathsCount != null ? <Typography.Text type="secondary">Paths returned: {state.impactPathsCount}</Typography.Text> : null}>
        <Table
          rowKey={(r) => r.elementId}
          size="small"
          columns={columns}
          dataSource={ranked}
          pagination={{ pageSize: 8 }}
          onRow={(record) => ({
            onClick: () => void explainSelected(record.elementId),
          })}
          rowClassName={(record) => (record.elementId === selectedId ? 'ant-table-row-selected' : '')}
        />
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Click an element to fetch a single representative explanation (no path dumping).
        </Typography.Paragraph>
      </Card>

      <Divider style={{ margin: '12px 0' }} />

      <Card size="small" title="3) Selected Impact Explanation" extra={loadingExplanation ? 'Loading…' : null}>
        {selectedId && state.explanationText ? (
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <Typography.Text strong>
              {elementById.get(selectedId)?.name ?? selectedId}
            </Typography.Text>
            <Typography.Text type="secondary">
              Policy: {state.selectionPolicy} · Path length: {state.representativePathLength}
            </Typography.Text>
            <Typography.Paragraph style={{ marginBottom: 0 }}>{state.explanationText}</Typography.Paragraph>
          </Space>
        ) : (
          <Typography.Text type="secondary">Select an impacted element to see “why it is impacted”.</Typography.Text>
        )}
      </Card>
    </div>
  );
};

*/
