import React from 'react';
import { Button, Divider, Form, Input, Modal, Select, Space, Table, Typography, message } from 'antd';
import { useEaRepository } from '@/ea/EaRepositoryContext';
import type { ObjectType, RelationshipType } from '@/pages/dependency-view/utils/eaMetaModel';
import { OBJECT_TYPE_DEFINITIONS, isValidRelationshipType } from '@/pages/dependency-view/utils/eaMetaModel';
import { isRelationshipTypeAllowedForReferenceFramework } from '@/repository/referenceFrameworkPolicy';

type ObjectTableTabProps = {
  id: string;
  name: string;
  objectType: string;
};

const ObjectTableTab: React.FC<ObjectTableTabProps> = ({ id, name, objectType }) => {
  const { eaRepository, setEaRepository, metadata } = useEaRepository();
  const [form] = Form.useForm();

  const obj = eaRepository?.objects.get(id) ?? null;
  const attrs = (obj?.attributes ?? {}) as Record<string, unknown>;

  const resolvedName = (typeof attrs.name === 'string' && attrs.name.trim()) ? String(attrs.name) : name;
  const resolvedDescription = typeof attrs.description === 'string' ? attrs.description : '';

  React.useEffect(() => {
    form.setFieldsValue({
      name: resolvedName,
      description: resolvedDescription,
      lifecycleState: typeof attrs.lifecycleState === 'string' ? attrs.lifecycleState : 'Baseline',
      ownerRole: typeof attrs.ownerRole === 'string' ? attrs.ownerRole : '',
      ownerName: typeof attrs.ownerName === 'string' ? attrs.ownerName : '',
    });
  }, [attrs.lifecycleState, attrs.ownerName, attrs.ownerRole, form, resolvedDescription, resolvedName]);

  const outgoing = React.useMemo(() => {
    if (!eaRepository) return [];
    return eaRepository.relationships.filter((r) => r.fromId === id);
  }, [eaRepository, id]);

  const incoming = React.useMemo(() => {
    if (!eaRepository) return [];
    return eaRepository.relationships.filter((r) => r.toId === id);
  }, [eaRepository, id]);

  const relationshipRows = React.useMemo(() => {
    const rows: Array<{
      key: string;
      direction: 'Outgoing' | 'Incoming';
      type: string;
      peer: string;
      peerName: string;
      fromId: string;
      toId: string;
    }> = [];

    for (const r of outgoing) {
      const peer = r.toId;
      const peerObj = eaRepository?.objects.get(peer);
      const peerName = peerObj && typeof peerObj.attributes?.name === 'string' && peerObj.attributes.name.trim()
        ? String(peerObj.attributes.name)
        : peer;
      rows.push({
        key: `out:${r.type}:${r.fromId}->${r.toId}`,
        direction: 'Outgoing',
        type: r.type,
        peer,
        peerName,
        fromId: r.fromId,
        toId: r.toId,
      });
    }

    for (const r of incoming) {
      const peer = r.fromId;
      const peerObj = eaRepository?.objects.get(peer);
      const peerName = peerObj && typeof peerObj.attributes?.name === 'string' && peerObj.attributes.name.trim()
        ? String(peerObj.attributes.name)
        : peer;
      rows.push({
        key: `in:${r.type}:${r.fromId}->${r.toId}`,
        direction: 'Incoming',
        type: r.type,
        peer,
        peerName,
        fromId: r.fromId,
        toId: r.toId,
      });
    }

    rows.sort((a, b) => a.direction.localeCompare(b.direction) || a.type.localeCompare(b.type) || a.peerName.localeCompare(b.peerName));
    return rows;
  }, [eaRepository, incoming, outgoing]);

  const deleteRelationship = React.useCallback(
    (rel: { fromId: string; toId: string; type: string }) => {
      Modal.confirm({
        title: 'Delete relationship?',
        content: `Deletes relationship ${rel.type} (${rel.fromId} → ${rel.toId}).`,
        okText: 'Delete',
        okButtonProps: { danger: true },
        cancelText: 'Cancel',
        onOk: () => {
          setEaRepository((prev) => {
            if (!prev) return prev;
            const next = prev.clone();
            next.relationships = next.relationships.filter(
              (r) => !(r.type === rel.type && r.fromId === rel.fromId && r.toId === rel.toId),
            );
            return next;
          });
          message.success('Relationship deleted.');
        },
      });
    },
    [setEaRepository],
  );

  const openCreateRelationship = React.useCallback(() => {
    if (!eaRepository || !obj) {
      message.warning('No repository loaded.');
      return;
    }

    const fromType = obj.type as ObjectType;
    const allowedOutgoing: RelationshipType[] = (OBJECT_TYPE_DEFINITIONS[fromType]?.allowedOutgoingRelationships ?? []) as any;
    const relationshipOptions = allowedOutgoing
      .filter((t) => isValidRelationshipType(t))
      .filter((t) => isRelationshipTypeAllowedForReferenceFramework(metadata?.referenceFramework, String(t)))
      .map((t) => ({ value: t, label: t }));

    if (relationshipOptions.length === 0) {
      message.warning('No relationship types are available for this element under the current reference framework.');
      return;
    }

    const candidateTargets = Array.from(eaRepository.objects.values())
      .filter((o) => o.id !== id && (o.attributes as any)?._deleted !== true)
      .map((o) => ({
        id: o.id,
        type: o.type,
        name: (typeof o.attributes?.name === 'string' && o.attributes.name.trim()) ? String(o.attributes.name) : o.id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    let relType: string = relationshipOptions[0]?.value ?? '';
    let toId: string = candidateTargets[0]?.id ?? '';

    Modal.confirm({
      title: 'Create Relationship',
      okText: 'Create',
      cancelText: 'Cancel',
      content: (
        <div style={{ display: 'grid', gap: 8 }}>
          <div>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 4 }}>Type</div>
            <Select
              options={relationshipOptions}
              defaultValue={relType}
              onChange={(v) => {
                relType = String(v);
              }}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 4 }}>Target</div>
            <Select
              showSearch
              optionFilterProp="label"
              options={candidateTargets.map((t) => ({ value: t.id, label: `${t.name} · ${t.type} · ${t.id}` }))}
              defaultValue={toId}
              onChange={(v) => {
                toId = String(v);
              }}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Strict mode blocks invalid endpoints per meta-model.
          </div>
        </div>
      ),
      onOk: () => {
        const finalType = relType.trim();
        const finalTo = toId.trim();
        if (!finalType || !finalTo) {
          message.error('Relationship type and target are required.');
          return Promise.reject();
        }

        if (metadata?.architectureScope === 'Domain') {
          const normalizeDomainId = (value: unknown): string | null => {
            const raw = typeof value === 'string' ? value.trim() : '';
            if (!raw) return null;
            return raw.toLowerCase();
          };

          const currentDomainId = normalizeDomainId(metadata?.repositoryName);
          const toObj = eaRepository.objects.get(finalTo);
          const fromDomain = normalizeDomainId((obj.attributes as any)?.domainId) ?? currentDomainId;
          const toDomain = normalizeDomainId((toObj?.attributes as any)?.domainId) ?? currentDomainId;
          if (fromDomain && toDomain && fromDomain !== toDomain) {
            message.error('Cross-domain relationships are blocked in Domain scope.');
            return Promise.reject();
          }
        }

        if (metadata?.architectureScope === 'Business Unit' && finalType === 'OWNS') {
          const targetObj = eaRepository.objects.get(finalTo);
          if (fromType === 'Enterprise' && targetObj?.type === 'Enterprise') {
            message.error('Enterprise-to-Enterprise ownership is disabled in Business Unit scope.');
            return Promise.reject();
          }
        }

        setEaRepository((prev) => {
          if (!prev) return prev;
          const next = prev.clone();
          const res = next.addRelationship({
            fromId: id,
            toId: finalTo,
            type: finalType,
            attributes: {},
          });
          if (!res.ok) {
            message.error(res.error);
            return prev;
          }
          return next;
        });

        message.success('Relationship created.');
        return undefined;
      },
    });
  }, [eaRepository, id, metadata?.architectureScope, metadata?.repositoryName, obj, setEaRepository]);

  const applyEdits = React.useCallback(() => {
    const values = form.getFieldsValue();
    const nextPatch = {
      name: typeof values?.name === 'string' ? values.name.trim() : '',
      description: typeof values?.description === 'string' ? values.description : '',
      lifecycleState: typeof values?.lifecycleState === 'string' ? values.lifecycleState : 'Baseline',
      ownerRole: typeof values?.ownerRole === 'string' ? values.ownerRole : '',
      ownerName: typeof values?.ownerName === 'string' ? values.ownerName : '',
    };

    if (!nextPatch.name) {
      message.error('Name is required.');
      return;
    }

    setEaRepository((prev) => {
      if (!prev) return prev;
      const next = prev.clone();
      const res = next.updateObjectAttributes(id, nextPatch, 'merge');
      if (!res.ok) {
        message.error(res.error);
        return prev;
      }
      return next;
    });
    message.success('Properties updated.');
  }, [form, id, setEaRepository]);

  if (!eaRepository || !obj) {
    return (
      <div style={{ padding: 12 }}>
        <Typography.Text type="secondary">Element not found in repository.</Typography.Text>
      </div>
    );
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={{ marginBottom: 10 }}>
        <Typography.Text strong>{resolvedName}</Typography.Text>
        <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
          {objectType}
        </Typography.Text>
      </div>

      <Typography.Title level={5} style={{ marginTop: 0 }}>
        Properties
      </Typography.Title>
      <Form form={form} layout="vertical">
        <Form.Item label="Name" name="name" rules={[{ required: true, whitespace: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Description" name="description">
          <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
        </Form.Item>
        <Form.Item label="Lifecycle state" name="lifecycleState">
          <Select
            options={[
              { value: 'Baseline', label: 'Baseline' },
              { value: 'Target', label: 'Target' },
              { value: 'Retired', label: 'Retired' },
            ]}
          />
        </Form.Item>
        <Form.Item label="Ownership (role)" name="ownerRole">
          <Input placeholder="e.g. Business Owner" />
        </Form.Item>
        <Form.Item label="Ownership (name)" name="ownerName">
          <Input placeholder="e.g. Jane Doe" />
        </Form.Item>
        <Space>
          <Button type="primary" onClick={applyEdits}>
            Save
          </Button>
          <Button onClick={() => form.resetFields()}>Reset</Button>
        </Space>
      </Form>

      <Divider />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          Relationships
        </Typography.Title>
        <Button onClick={openCreateRelationship}>Create Relationship</Button>
      </div>

      <Table
        size="small"
        pagination={false}
        rowKey="key"
        columns={[
          { title: 'Direction', dataIndex: 'direction', width: 110 },
          { title: 'Type', dataIndex: 'type', width: 160 },
          { title: 'Peer', dataIndex: 'peerName' },
          { title: 'Peer ID', dataIndex: 'peer', width: 240 },
          {
            title: 'Actions',
            width: 110,
            render: (_: unknown, row: any) => (
              <Button danger size="small" onClick={() => deleteRelationship({ fromId: row.fromId, toId: row.toId, type: row.type })}>
                Delete
              </Button>
            ),
          },
        ]}
        dataSource={relationshipRows}
        locale={{ emptyText: 'No relationships (empty is correct).' }}
      />
    </div>
  );
};

export default ObjectTableTab;
