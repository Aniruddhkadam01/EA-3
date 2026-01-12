import {
  PageContainer,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  StepsForm,
} from '@ant-design/pro-components';
import { useModel, request } from '@umijs/max';
import { Card, Divider, Form, Typography, message } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';

import type { BaseArchitectureElement } from '../../../../backend/repository/BaseArchitectureElement';
import type { ViewDefinition } from '../../../../backend/views/ViewDefinition';
import {
  STANDARD_VIEW_TEMPLATES,
  type ViewTemplateId,
  instantiateViewFromTemplate,
} from '../../../../backend/views/ViewTemplates';
import { getRelationshipEndpointRule } from '../../../../backend/relationships/RelationshipSemantics';
import { useEaRepository } from '@/ea/EaRepositoryContext';

type RepositoryElementsByType = {
  Application: BaseArchitectureElement[];
  Capability: BaseArchitectureElement[];
  BusinessProcess: BaseArchitectureElement[];
  Technology: BaseArchitectureElement[];
  Programme: BaseArchitectureElement[];
};

const emptyElements: RepositoryElementsByType = {
  Application: [],
  Capability: [],
  BusinessProcess: [],
  Technology: [],
  Programme: [],
};

const toSelectOptions = (elements: BaseArchitectureElement[]) =>
  (elements ?? []).map((e) => ({
    value: e.id,
    label: `${e.name} (${e.id})`,
  }));

const createViewId = (): string => {
  // Browser-safe unique-enough id for UI-only creation (no persistence).
  // If the backend later requires UUIDs, this can be swapped for a uuid library.
  return `view_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const nowIso = () => new Date().toISOString();

const CreateViewWizardPage: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const createdBy = initialState?.currentUser?.name || initialState?.currentUser?.userid || 'ui';
  const { metadata } = useEaRepository();

  const templateOptions = useMemo(() => {
    const templates =
      metadata?.architectureScope === 'Programme'
        ? STANDARD_VIEW_TEMPLATES.filter((t) => t.viewType === 'ImpactView')
        : STANDARD_VIEW_TEMPLATES;

    return templates.map((t) => ({
      value: t.id,
      label: `${t.name} (${t.viewType})`,
    }));
  }, [metadata?.architectureScope]);

  const [elements, setElements] = useState<RepositoryElementsByType>(emptyElements);
  const [loadingElements, setLoadingElements] = useState(false);
  const [createdView, setCreatedView] = useState<ViewDefinition | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<ViewTemplateId | undefined>(
    STANDARD_VIEW_TEMPLATES[0]?.id,
  );

  useEffect(() => {
    const load = async () => {
      setLoadingElements(true);
      try {
        const [apps, caps, procs, techs, progs] = await Promise.all([
          request<{ success: boolean; data: BaseArchitectureElement[] }>('/api/repository/applications'),
          request<{ success: boolean; data: BaseArchitectureElement[] }>('/api/repository/capabilities'),
          request<{ success: boolean; data: BaseArchitectureElement[] }>('/api/repository/processes'),
          request<{ success: boolean; data: BaseArchitectureElement[] }>('/api/repository/technologies'),
          request<{ success: boolean; data: BaseArchitectureElement[] }>('/api/repository/programmes'),
        ]);

        setElements({
          Application: apps?.data ?? [],
          Capability: caps?.data ?? [],
          BusinessProcess: procs?.data ?? [],
          Technology: techs?.data ?? [],
          Programme: progs?.data ?? [],
        });
      } catch (e) {
        message.error('Failed to load repository elements');
        setElements(emptyElements);
      } finally {
        setLoadingElements(false);
      }
    };

    load();
  }, []);

  const selectedTemplate = useMemo(
    () => STANDARD_VIEW_TEMPLATES.find((t) => t.id === selectedTemplateId) ?? null,
    [selectedTemplateId],
  );

  const rootTypeOptions = useMemo(() => {
    if (!selectedTemplate) return [];

    const supportedRootTypes: ReadonlySet<string> = new Set([
      'Application',
      'Capability',
      'BusinessProcess',
      'Technology',
      'Programme',
    ]);

    // Start with the template defaults.
    const allowed = new Set<string>(selectedTemplate.allowedElementTypes);
    // Ensure relationship endpoint types are eligible as roots as well.
    for (const relType of selectedTemplate.allowedRelationshipTypes) {
      const rule = getRelationshipEndpointRule(relType);
      if (!rule) continue;
      for (const from of rule.from) allowed.add(from);
      for (const to of rule.to) allowed.add(to);
    }

    const sorted = Array.from(allowed)
      .filter((t) => supportedRootTypes.has(t))
      .sort((a, b) => a.localeCompare(b));
    return sorted.map((t) => ({ value: t, label: t }));
  }, [selectedTemplate]);

  const elementOptionsByType = useMemo(() => {
    return {
      Application: toSelectOptions(elements.Application),
      Capability: toSelectOptions(elements.Capability),
      BusinessProcess: toSelectOptions(elements.BusinessProcess),
      Technology: toSelectOptions(elements.Technology),
      Programme: toSelectOptions(elements.Programme),
    } as const;
  }, [elements]);

  return (
    <PageContainer>
      <Card>
        <Typography.Title level={4}>Create View Wizard</Typography.Title>
        <Typography.Paragraph type="secondary">
          Creates a <Typography.Text code>ViewDefinition</Typography.Text> only. No repository writes, no
          diagram rendering.
        </Typography.Paragraph>

        <StepsForm
          onFinish={async (values: Record<string, unknown>) => {
            const templateId = values?.templateId as ViewTemplateId | undefined;
            if (!templateId) {
              message.error('Please select a template');
              return false;
            }

            const template = STANDARD_VIEW_TEMPLATES.find((t) => t.id === templateId) ?? null;
            const maxDepth =
              template?.maxDepthConfig?.configurable && typeof values?.maxDepth === 'number'
                ? values.maxDepth
                : undefined;

            const viewId = createViewId();
            const timestamp = nowIso();

            const view = instantiateViewFromTemplate(templateId, {
              id: viewId,
              createdBy,
              createdAt: timestamp,
              lastModifiedAt: timestamp,
              approvalStatus: 'Draft',

              name: typeof values?.name === 'string' ? values.name : undefined,
              description: typeof values?.description === 'string' ? values.description : undefined,
              rootElementType:
                typeof values?.rootElementType === 'string' ? values.rootElementType : undefined,
              rootElementId: typeof values?.rootElementId === 'string' ? values.rootElementId : undefined,
              maxDepth,
            });

            setCreatedView(view);
            message.success('ViewDefinition created (not saved)');
            return true;
          }}
          submitter={{
            searchConfig: {
              submitText: 'Create ViewDefinition',
            },
          }}
        >
          <StepsForm.StepForm
            name="template"
            title="Template"
            initialValues={{ templateId: STANDARD_VIEW_TEMPLATES[0]?.id }}
            onValuesChange={(changed: Record<string, unknown>) => {
              const next = changed?.templateId as ViewTemplateId | undefined;
              if (next) setSelectedTemplateId(next);
            }}
          >
            <ProFormSelect
              name="templateId"
              label="Template"
              options={templateOptions}
              rules={[{ required: true }]}
            />

            <Form.Item shouldUpdate>
              {() =>
                selectedTemplate ? (
                  <Card>
                    <Typography.Paragraph>{selectedTemplate.description}</Typography.Paragraph>
                    <Typography.Paragraph type="secondary">
                      Allowed elements: {selectedTemplate.allowedElementTypes.join(', ') || '(none)'}
                      <br />
                      Allowed relationships:{' '}
                      {selectedTemplate.allowedRelationshipTypes.join(', ') || '(none)'}
                      <br />
                      Layout: {selectedTemplate.layoutType} / {selectedTemplate.orientation}
                    </Typography.Paragraph>
                  </Card>
                ) : null
              }
            </Form.Item>
          </StepsForm.StepForm>

          <StepsForm.StepForm name="metadata" title="Name & Description">
            <ProFormText name="name" label="View name" rules={[{ required: true }]} />
            <ProFormTextArea
              name="description"
              label="Description"
              rules={[{ required: true }]}
              fieldProps={{ autoSize: { minRows: 3, maxRows: 6 } }}
            />
          </StepsForm.StepForm>

          <StepsForm.StepForm name="scope" title="Scope (Optional)">
            <ProFormSelect
              name="rootElementType"
              label="Root element type"
              options={rootTypeOptions}
              placeholder="(optional)"
            />
            <ProFormSelect
              name="rootElementId"
              label="Root element"
              dependencies={['rootElementType']}
              request={async (params: Record<string, unknown>) => {
                const rootType = params?.rootElementType as keyof RepositoryElementsByType | undefined;
                if (!rootType) return [];
                return elementOptionsByType[rootType] ?? [];
              }}
              placeholder={loadingElements ? 'Loading elements…' : '(optional)'}
              disabled={loadingElements}
              showSearch
            />
          </StepsForm.StepForm>

          {selectedTemplate?.maxDepthConfig?.configurable ? (
            <StepsForm.StepForm
              name="depth"
              title="Depth (Optional)"
              initialValues={{ maxDepth: selectedTemplate.maxDepthConfig.defaultValue }}
            >
              <ProFormDigit
                name="maxDepth"
                label="Max depth"
                min={1}
                max={25}
                fieldProps={{ precision: 0 }}
                placeholder="(optional)"
              />
            </StepsForm.StepForm>
          ) : null}
        </StepsForm>

        {createdView ? (
          <>
            <Divider />
            <Typography.Title level={5}>Created ViewDefinition (not saved)</Typography.Title>
            <pre>{JSON.stringify(createdView, null, 2)}</pre>
          </>
        ) : null}
      </Card>
    </PageContainer>
  );
};

export default CreateViewWizardPage;
