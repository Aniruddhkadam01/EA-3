import React from 'react';

import { ProCard } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Checkbox,
  Divider,
  Flex,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Steps,
  Switch,
  Table,
  Tabs,
  Typography,
  Upload,
  message,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';

import ProjectGate from '@/ea/ProjectGate';
import { useEaRepository } from '@/ea/EaRepositoryContext';

import type {
  CsvImportSourceEntity,
  CsvRowError,
} from '../../../backend/interoperability';
import type { ExportScope } from '../../../backend/interoperability/ExportScope';

import { executeCsvImport, exportCsv, validateCsvImport } from '@/services/ea/interoperability';

type SourceType = 'CSV' | 'ArchiMate' | 'ToolSpecific';

const SOURCE_TYPES: { value: SourceType; label: string; disabled?: boolean }[] = [
  { value: 'CSV', label: 'CSV (Strict)' },
  { value: 'ArchiMate', label: 'ArchiMate (Coming soon)', disabled: true },
  { value: 'ToolSpecific', label: 'Tool-Specific (Coming soon)', disabled: true },
];

const CSV_ENTITIES: { value: CsvImportSourceEntity; label: string }[] = [
  { value: 'Capabilities', label: 'Capabilities' },
  { value: 'BusinessProcesses', label: 'Business Processes' },
  { value: 'Applications', label: 'Applications' },
  { value: 'Technologies', label: 'Technologies' },
  { value: 'Programmes', label: 'Programmes' },
  { value: 'Relationships', label: 'Relationships' },
];

const ELEMENT_TYPES = ['Capability', 'BusinessProcess', 'Application', 'Technology', 'Programme'] as const;
const RELATIONSHIP_TYPES = ['DECOMPOSES_TO', 'REALIZED_BY', 'DEPENDS_ON', 'HOSTED_ON', 'IMPACTS'] as const;

const downloadTextFile = (fileName: string, text: string) => {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const isNonNullable = <T,>(v: T | null | undefined): v is T => v !== null && v !== undefined;

const CsvRowErrorsTable: React.FC<{ errors: CsvRowError[] }> = ({ errors }) => {
  return (
    <Table<CsvRowError>
      size="small"
      rowKey={(r) => `${r.line}:${r.code}:${r.column ?? ''}:${r.message}`}
      dataSource={errors}
      pagination={{ pageSize: 10 }}
      columns={[
        { title: 'Line', dataIndex: 'line', width: 90 },
        { title: 'Code', dataIndex: 'code', width: 220 },
        { title: 'Column', dataIndex: 'column', width: 220 },
        { title: 'Message', dataIndex: 'message' },
      ]}
    />
  );
};

const ImportWizard: React.FC = () => {
  const [step, setStep] = React.useState(0);

  const [sourceType, setSourceType] = React.useState<SourceType>('CSV');
  const [csvEntity, setCsvEntity] = React.useState<CsvImportSourceEntity | null>(null);

  const [fileList, setFileList] = React.useState<UploadFile[]>([]);
  const [fileText, setFileText] = React.useState<string>('');

  const [validationErrors, setValidationErrors] = React.useState<CsvRowError[] | null>(null);
  const [validationOkSummary, setValidationOkSummary] = React.useState<
    | {
        importedElementsCount: number;
        importedRelationshipsCount: number;
      }
    | null
  >(null);

  const [validating, setValidating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [acknowledged, setAcknowledged] = React.useState(false);

  const reset = React.useCallback(() => {
    setStep(0);
    setSourceType('CSV');
    setCsvEntity(null);
    setFileList([]);
    setFileText('');
    setValidationErrors(null);
    setValidationOkSummary(null);
    setAcknowledged(false);
  }, []);

  const canProceedUpload = sourceType === 'CSV' && Boolean(csvEntity) && fileText.trim().length > 0;

  const runValidation = React.useCallback(async () => {
    if (sourceType !== 'CSV' || !csvEntity) return;

    try {
      setValidating(true);
      const resp = await validateCsvImport({
        entity: csvEntity,
        csvText: fileText,
        sourceDescription: fileList[0]?.name,
      });

      const result = resp.data;
      if (!result.ok) {
        setValidationErrors(result.errors);
        setValidationOkSummary(null);
        setAcknowledged(false);
        return;
      }

      setValidationErrors([]);
      setValidationOkSummary({
        importedElementsCount: result.importedElementsCount,
        importedRelationshipsCount: result.importedRelationshipsCount,
      });
      setAcknowledged(false);
    } finally {
      setValidating(false);
    }
  }, [csvEntity, fileList, fileText, sourceType]);

  const confirmImport = React.useCallback(async () => {
    if (sourceType !== 'CSV' || !csvEntity) return;

    try {
      setImporting(true);
      const resp = await executeCsvImport({
        entity: csvEntity,
        csvText: fileText,
        sourceDescription: fileList[0]?.name,
      });

      const result = resp.data;
      if (!result.ok) {
        setValidationErrors(result.errors);
        setValidationOkSummary(null);
        setStep(2);
        setAcknowledged(false);
        message.error('Import failed. Fix errors and try again.');
        return;
      }

      try {
        window.dispatchEvent(new Event('ea:repositoryChanged'));
        window.dispatchEvent(new Event('ea:relationshipsChanged'));
      } catch {
        // Best-effort only.
      }

      message.success(
        `Imported ${result.importedElementsCount} elements and ${result.importedRelationshipsCount} relationships.`,
      );
      reset();
    } finally {
      setImporting(false);
    }
  }, [csvEntity, fileList, fileText, reset, sourceType]);

  const steps = [
    {
      title: 'Source',
      content: (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="Controlled import"
            description="Imports are never executed on upload. You must validate and explicitly confirm."
          />

          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Typography.Text strong>Source type</Typography.Text>
            <Select
              value={sourceType}
              options={SOURCE_TYPES}
              onChange={(v) => setSourceType(v)}
              style={{ maxWidth: 420 }}
            />
          </Space>

          {sourceType !== 'CSV' ? (
            <Alert
              type="warning"
              showIcon
              message="Not implemented"
              description="Only strict CSV imports are implemented right now."
            />
          ) : (
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Typography.Text strong>CSV entity schema</Typography.Text>
              <Select
                placeholder="Select entity type (no guessing)"
                value={csvEntity ?? undefined}
                options={CSV_ENTITIES}
                onChange={(v) => setCsvEntity(v)}
                style={{ maxWidth: 420 }}
              />
              <Typography.Text type="secondary">
                IDs must be explicit. Mandatory headers are enforced. Invalid rows are rejected.
              </Typography.Text>
            </Space>
          )}
        </Space>
      ),
    },
    {
      title: 'Upload',
      content: (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="warning"
            showIcon
            message="No auto-import"
            description="Uploading a file does not modify the repository. You will validate first, then confirm."
          />

          <Upload.Dragger
            multiple={false}
            accept=".csv,text/csv"
            fileList={fileList}
            beforeUpload={() => false}
            onChange={async (info) => {
              const nextList = info.fileList.slice(-1);
              setFileList(nextList);

              const f = nextList[0]?.originFileObj;
              if (!f) {
                setFileText('');
                return;
              }

              const text = await f.text();
              setFileText(text);

              // Reset any previous validation.
              setValidationErrors(null);
              setValidationOkSummary(null);
              setAcknowledged(false);
            }}
          >
            <p style={{ margin: 0, fontWeight: 600 }}>Drop CSV here, or click to select</p>
            <p style={{ margin: 0, color: 'rgba(0,0,0,0.45)' }}>
              Strict headers. Explicit IDs. No auto-fix.
            </p>
          </Upload.Dragger>

          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Typography.Text strong>Preview</Typography.Text>
            <Input.TextArea
              value={fileText ? fileText.slice(0, 2000) : ''}
              placeholder="File preview will appear here"
              autoSize={{ minRows: 4, maxRows: 10 }}
              readOnly
            />
            <Typography.Text type="secondary">Preview is truncated to 2000 characters.</Typography.Text>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Review',
      content: (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="Validation results"
            description="Fix all errors before confirming. No partial commits are allowed."
          />

          {validationErrors === null ? (
            <Alert
              type="warning"
              showIcon
              message="Not validated yet"
              description="Click Validate to run strict schema checks."
            />
          ) : validationErrors.length > 0 ? (
            <>
              <Alert
                type="error"
                showIcon
                message={`Validation failed (${validationErrors.length} errors)`}
                description="Nothing has been imported. Correct the CSV and validate again."
              />
              <CsvRowErrorsTable errors={validationErrors} />
            </>
          ) : (
            <Alert
              type="success"
              showIcon
              message="Validation passed"
              description={
                validationOkSummary
                  ? `Would import ${validationOkSummary.importedElementsCount} elements and ${validationOkSummary.importedRelationshipsCount} relationships.`
                  : 'Ready to confirm.'
              }
            />
          )}
        </Space>
      ),
    },
    {
      title: 'Confirm',
      content: (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="warning"
            showIcon
            message="Explicit confirmation required"
            description="This step will modify the in-memory repository. This action cannot be undone (without re-import)."
          />

          <ProCard bordered>
            <Space direction="vertical" size={6}>
              <Typography.Text strong>Import summary</Typography.Text>
              <Typography.Text type="secondary">Source: {sourceType}</Typography.Text>
              <Typography.Text type="secondary">Entity: {csvEntity ?? '—'}</Typography.Text>
              <Typography.Text type="secondary">File: {fileList[0]?.name ?? '—'}</Typography.Text>
            </Space>
          </ProCard>

          <Checkbox checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)}>
            I understand this will change the repository.
          </Checkbox>

          <Button
            type="primary"
            danger
            onClick={() => {
              Modal.confirm({
                title: 'Confirm import',
                content:
                  'This will apply the validated CSV data to the current in-memory repository. This action is not reversible without another import.',
                okText: 'Import',
                okButtonProps: { danger: true },
                cancelText: 'Cancel',
                onOk: async () => {
                  await confirmImport();
                },
              });
            }}
            disabled={
              !acknowledged || validationErrors === null || (validationErrors?.length ?? 0) > 0
            }
            loading={importing}
          >
            Confirm and Import
          </Button>
        </Space>
      ),
    },
  ] as const;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Steps current={step} items={steps.map((s) => ({ title: s.title }))} />

      <div>{steps[step]?.content}</div>

      <Divider style={{ margin: '12px 0' }} />

      <Flex justify="space-between" gap={8} wrap>
        <Space>
          <Button onClick={reset}>Reset</Button>
        </Space>

        <Space>
          <Button disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            Back
          </Button>

          {step === 0 ? (
            <Button
              type="primary"
              onClick={() => setStep(1)}
              disabled={sourceType !== 'CSV' || !csvEntity}
            >
              Next
            </Button>
          ) : null}

          {step === 1 ? (
            <Button type="primary" onClick={() => setStep(2)} disabled={!canProceedUpload}>
              Next
            </Button>
          ) : null}

          {step === 2 ? (
            <Space>
              <Button
                onClick={runValidation}
                disabled={sourceType !== 'CSV' || !csvEntity || fileText.trim().length === 0}
                loading={validating}
              >
                Validate
              </Button>
              <Button
                type="primary"
                onClick={() => setStep(3)}
                disabled={validationErrors === null || (validationErrors?.length ?? 0) > 0}
              >
                Next
              </Button>
            </Space>
          ) : null}

          {step === 3 ? (
            <Button
              type="primary"
              onClick={() => message.info('Click “Confirm and Import” to apply changes.')}
            >
              Done
            </Button>
          ) : null}
        </Space>
      </Flex>
    </Space>
  );
};

const ExportWizard: React.FC = () => {
  const { metadata } = useEaRepository();
  const [step, setStep] = React.useState(0);

  const [exportType, setExportType] = React.useState<ExportScope['exportType'] | null>(null);
  const [includedElementTypes, setIncludedElementTypes] = React.useState<string[]>([]);
  const [includedRelationshipTypes, setIncludedRelationshipTypes] = React.useState<string[]>([]);
  const [includeViews, setIncludeViews] = React.useState(false);
  const [includeGovernanceArtifacts, setIncludeGovernanceArtifacts] = React.useState(false);

  const [format, setFormat] = React.useState<'CSV' | 'ComingSoon'>('CSV');

  type ExportFile = { fileName: string; csvText: string };
  type ExportFiles = Partial<Record<CsvImportSourceEntity, ExportFile>>;

  const [exportResult, setExportResult] = React.useState<
    | {
        files: ExportFiles;
        warnings: string[];
        exportedElementsCount: number;
        exportedRelationshipsCount: number;
      }
    | null
  >(null);

  const safeSlug = React.useCallback(
    (value: string) =>
      (value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'export',
    [],
  );

  const [exportErrors, setExportErrors] = React.useState<string[] | null>(null);
  const [exporting, setExporting] = React.useState(false);

  const reset = React.useCallback(() => {
    setStep(0);
    setExportType(null);
    setIncludedElementTypes([]);
    setIncludedRelationshipTypes([]);
    setIncludeViews(false);
    setIncludeGovernanceArtifacts(false);
    setFormat('CSV');
    setExportResult(null);
    setExportErrors(null);
  }, []);

  const scope: ExportScope | null = React.useMemo(() => {
    if (!exportType) return null;
    return {
      exportType,
      includedElementTypes,
      includedRelationshipTypes,
      includeViews,
      includeGovernanceArtifacts,
    };
  }, [exportType, includeGovernanceArtifacts, includeViews, includedElementTypes, includedRelationshipTypes]);

  const buildExportMeta = React.useCallback(
    () => ({
      kind: 'ea-export-metadata' as const,
      exportedAt: new Date().toISOString(),
      repositoryName: metadata?.repositoryName ?? null,
      scope,
      format,
    }),
    [format, metadata?.repositoryName, scope],
  );

  const validateScope = React.useCallback((): string[] => {
    const errors: string[] = [];
    if (!exportType) errors.push('Select exportType.');
    // No defaults assumed: user must explicitly pick at least one element type to export repository contents meaningfully.
    if (includedElementTypes.length === 0) errors.push('Select at least one element type.');
    return errors;
  }, [exportType, includedElementTypes.length]);

  const generateExport = React.useCallback(async () => {
    if (!scope) return;

    const errors = validateScope();
    if (errors.length > 0) {
      message.error(errors[0]);
      return;
    }

    if (format !== 'CSV') {
      message.error('Only CSV export is implemented right now.');
      return;
    }

    try {
      setExporting(true);
      const resp = await exportCsv(scope);
      const result = resp.data;

      if (!result.ok) {
        setExportResult(null);
        setExportErrors(result.errors);
        message.error('Export failed. Review errors.');
        return;
      }

      setExportErrors(null);
      setExportResult({
        files: result.files,
        warnings: result.warnings,
        exportedElementsCount: result.exportedElementsCount,
        exportedRelationshipsCount: result.exportedRelationshipsCount,
      });
    } finally {
      setExporting(false);
    }
  }, [format, scope, validateScope]);

  const steps = [
    {
      title: 'Scope',
      content: (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="Controlled export"
            description="Exports require an explicit scope. No defaults are assumed."
          />

          <Form layout="vertical" style={{ maxWidth: 720 }}>
            <Form.Item label="Export type" required>
              <Select
                placeholder="Select export type"
                value={exportType ?? undefined}
                onChange={(v) => setExportType(v)}
                options={[
                  { value: 'Repository', label: 'Repository' },
                  { value: 'View', label: 'View (not CSV-ready)', disabled: true },
                  { value: 'Analysis', label: 'Analysis (not CSV-ready)', disabled: true },
                  { value: 'FullProject', label: 'Full Project' },
                ]}
              />
            </Form.Item>

            <Form.Item label="Included element types" required>
              <Select
                mode="multiple"
                placeholder="Select element types"
                value={includedElementTypes}
                onChange={(v) => setIncludedElementTypes(v)}
                options={ELEMENT_TYPES.map((t) => ({ value: t, label: t }))}
              />
            </Form.Item>

            <Form.Item label="Included relationship types">
              <Select
                mode="multiple"
                placeholder="Select relationship types"
                value={includedRelationshipTypes}
                onChange={(v) => setIncludedRelationshipTypes(v)}
                options={RELATIONSHIP_TYPES.map((t) => ({ value: t, label: t }))}
              />
            </Form.Item>

            <Form.Item>
              <Space>
                <Switch checked={includeViews} onChange={setIncludeViews} />
                <Typography.Text>Include view definitions</Typography.Text>
              </Space>
            </Form.Item>

            <Form.Item>
              <Space>
                <Switch checked={includeGovernanceArtifacts} onChange={setIncludeGovernanceArtifacts} />
                <Typography.Text>Include governance artifacts (rules, ADRs)</Typography.Text>
              </Space>
            </Form.Item>
          </Form>
        </Space>
      ),
    },
    {
      title: 'Format',
      content: (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="warning"
            showIcon
            message="No hidden conversions"
            description="Format selection is explicit. Only CSV (strict, round-trippable) is implemented right now."
          />

          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Typography.Text strong>Export format</Typography.Text>
            <Select
              value={format}
              onChange={(v) => setFormat(v)}
              style={{ maxWidth: 420 }}
              options={[
                { value: 'CSV', label: 'CSV (Import-compatible)' },
                { value: 'ComingSoon', label: 'Other formats (Coming soon)', disabled: true },
              ]}
            />
          </Space>
        </Space>
      ),
    },
    {
      title: 'Review',
      content: (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="Review contents"
            description="Generate the export to preview files and verify scope."
          />

          <Button type="primary" onClick={generateExport} disabled={!scope} loading={exporting}>
            Generate Export
          </Button>

          {exportErrors && exportErrors.length > 0 ? (
            <Alert
              type="error"
              showIcon
              message={`Export failed (${exportErrors.length} errors)`}
              description={
                <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                  {exportErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              }
            />
          ) : null}

          {exportResult ? (
            <>
              {exportResult.warnings.length > 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  message="Warnings"
                  description={
                    <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                      {exportResult.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  }
                />
              ) : null}

              <ProCard bordered>
                <Space direction="vertical" size={6}>
                  <Typography.Text strong>Summary</Typography.Text>
                  <Typography.Text type="secondary">
                    Elements: {exportResult.exportedElementsCount} | Relationships: {exportResult.exportedRelationshipsCount}
                  </Typography.Text>

                  <Divider style={{ margin: '8px 0' }} />

                  <Typography.Text strong>Files</Typography.Text>
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    {(Object.entries(exportResult.files) as Array<
                      [CsvImportSourceEntity, ExportFiles[CsvImportSourceEntity]]
                    >)
                      .filter(
                        (entry): entry is [CsvImportSourceEntity, ExportFile] => isNonNullable(entry[1]),
                      )
                      .map(([entity, file]) => {
                        const lineCount = file.csvText.trim().length
                          ? file.csvText.trim().split('\n').length - 1
                          : 0;
                        return (
                          <ProCard key={entity} size="small" bordered>
                            <Space direction="vertical" size={4} style={{ width: '100%' }}>
                              <Typography.Text strong>
                                {file.fileName} <Typography.Text type="secondary">({lineCount} rows)</Typography.Text>
                              </Typography.Text>
                              <Input.TextArea
                                value={file.csvText.slice(0, 2000)}
                                autoSize={{ minRows: 3, maxRows: 8 }}
                                readOnly
                              />
                              <Typography.Text type="secondary">Preview is truncated to 2000 characters.</Typography.Text>
                            </Space>
                          </ProCard>
                        );
                      })}
                  </Space>
                </Space>
              </ProCard>
            </>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'Download',
      content: (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="warning"
            showIcon
            message="Explicit download"
            description="Downloads are explicit per file. Nothing is exported automatically."
          />

          {!exportResult ? (
            <Alert
              type="info"
              showIcon
              message="No export generated"
              description="Go back and generate the export first."
            />
          ) : (
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {(Object.entries(exportResult.files) as Array<
                [CsvImportSourceEntity, ExportFiles[CsvImportSourceEntity]]
              >)
                .filter((entry): entry is [CsvImportSourceEntity, ExportFile] => isNonNullable(entry[1]))
                .map(([entity, file]) => {
                  return (
                    <Flex key={entity} align="center" justify="space-between" gap={12} wrap>
                      <Typography.Text>{file.fileName}</Typography.Text>
                      <Button
                        onClick={() => {
                          const repo = metadata?.repositoryName ? safeSlug(metadata.repositoryName) : '';
                          const prefix = repo ? `${repo}-` : '';
                          downloadTextFile(`${prefix}${file.fileName}`, file.csvText);
                        }}
                      >
                        Download
                      </Button>
                    </Flex>
                  );
                })}

              <Divider style={{ margin: '8px 0' }} />

              <Flex align="center" justify="space-between" gap={12} wrap>
                <Typography.Text>export-metadata.json</Typography.Text>
                <Button
                  onClick={() => {
                    const repo = metadata?.repositoryName ? safeSlug(metadata.repositoryName) : '';
                    const prefix = repo ? `${repo}-` : '';
                    downloadTextFile(`${prefix}export-metadata.json`, JSON.stringify(buildExportMeta(), null, 2));
                  }}
                >
                  Download
                </Button>
              </Flex>

              <Divider style={{ margin: '8px 0' }} />
              <Typography.Text type="secondary">
                Tip: re-import these CSVs using the Import Wizard to validate round-trip safety.
              </Typography.Text>
            </Space>
          )}
        </Space>
      ),
    },
  ] as const;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Steps current={step} items={steps.map((s) => ({ title: s.title }))} />
      <div>{steps[step]?.content}</div>

      <Divider style={{ margin: '12px 0' }} />

      <Flex justify="space-between" gap={8} wrap>
        <Button onClick={reset}>Reset</Button>

        <Space>
          <Button disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            Back
          </Button>
          <Button
            type="primary"
            onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
            disabled={step === 0 ? validateScope().length > 0 : false}
          >
            Next
          </Button>
        </Space>
      </Flex>
    </Space>
  );
};

const InteroperabilityPage: React.FC = () => {
  return (
    <div style={{ height: '100%', padding: 16 }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space direction="vertical" size={0}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Import / Export
          </Typography.Title>
          <Typography.Text type="secondary">
            Controlled, deterministic, loss-aware data exchange.
          </Typography.Text>
        </Space>

        <ProjectGate
          shell={
            <Tabs
              items={[
                {
                  key: 'import',
                  label: 'Import Wizard',
                  children: <ImportWizard />,
                },
                {
                  key: 'export',
                  label: 'Export Wizard',
                  children: <ExportWizard />,
                },
              ]}
            />
          }
        >
          <Alert
            type="warning"
            showIcon
            message="No project created"
            description={
              <Space direction="vertical" size={8}>
                <Typography.Text>
                  Create a project first to enable repository import/export.
                </Typography.Text>
                <Button type="primary" href="/project/create">
                  Create Project
                </Button>
              </Space>
            }
          />
        </ProjectGate>
      </Space>
    </div>
  );
};

export default InteroperabilityPage;
