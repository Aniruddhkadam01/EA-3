import {
  ApartmentOutlined,
  AppstoreOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  CloudOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  FileTextOutlined,
  ForkOutlined,
  FundProjectionScreenOutlined,
  PlusOutlined,
  ProjectOutlined,
  SafetyOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Dropdown, Modal, Tree, message } from 'antd';
import type { DataNode } from 'antd/es/tree';
import React from 'react';
import { useIdeShell } from './index';
import styles from './style.module.less';
import { useIdeSelection } from '@/ide/IdeSelectionContext';
import { useEaRepository } from '@/ea/EaRepositoryContext';
import type { ObjectType } from '@/pages/dependency-view/utils/eaMetaModel';
import { getViewRepository, deleteView as deleteViewById } from '../../../backend/views/ViewRepositoryStore';
import type { ViewDefinition } from '../../../backend/views/ViewDefinition';

const ROOT_KEYS = {
  business: 'explorer:business',
  application: 'explorer:application',
  technology: 'explorer:technology',
  implMig: 'explorer:implementation-migration',
  governance: 'explorer:governance',
  views: 'explorer:views',
} as const;

const ENTERPRISE_FULLY_EXPANDED_KEYS: readonly string[] = [
  ROOT_KEYS.business,
  ROOT_KEYS.application,
  ROOT_KEYS.technology,
  ROOT_KEYS.implMig,
  ROOT_KEYS.governance,
  ROOT_KEYS.views,

  'explorer:business:enterprises',
  'explorer:business:capabilities',
  'explorer:business:business-services',
  'explorer:business:processes',
  'explorer:business:departments',

  'explorer:application:applications',
  'explorer:application:application-services',

  'explorer:technology:technologies',

  'explorer:implmig:programmes',
  'explorer:implmig:projects',

  'explorer:governance:principles',
  'explorer:governance:requirements',

  'explorer:views:business',
  'explorer:views:application',
  'explorer:views:technology',
  'explorer:views:roadmaps',
];

const KEY = {
  element: (id: string) => `explorer:element:${id}`,
  view: (id: string) => `explorer:view:${id}`,
} as const;

const BUSINESS_UNIT_ENTERPRISE_PLACEHOLDER_KEY = 'explorer:business:enterprises:root-placeholder';

const normalizeId = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

const isSoftDeleted = (attributes: Record<string, unknown> | null | undefined) => Boolean((attributes as any)?._deleted === true);

const nameForObject = (obj: { id: string; attributes?: Record<string, unknown> }) => {
  const raw = (obj.attributes as any)?.name;
  const name = typeof raw === 'string' ? raw.trim() : '';
  return name || obj.id;
};

const titleForObjectType = (type: ObjectType): string => {
  switch (type) {
    case 'Enterprise':
      return 'Enterprise';
    case 'Capability':
      return 'Capability';
    case 'BusinessService':
      return 'Business Service';
    case 'BusinessProcess':
      return 'Business Process';
    case 'Department':
      return 'Department';
    case 'Application':
      return 'Application';
    case 'ApplicationService':
      return 'Application Service';
    case 'Technology':
      return 'Technology';
    case 'Programme':
      return 'Programme';
    case 'Project':
      return 'Project';
    case 'Principle':
      return 'Principle';
    case 'Requirement':
      return 'Requirement';
    default:
      return String(type);
  }
};

const defaultIdPrefixForType = (type: ObjectType) => {
  switch (type) {
    case 'Enterprise':
      return 'ent-';
    case 'Application':
      return 'app-';
    case 'ApplicationService':
      return 'appsvc-';
    case 'Technology':
      return 'tech-';
    case 'Programme':
      return 'prog-';
    case 'Project':
      return 'proj-';
    case 'Capability':
      return 'cap-';
    case 'BusinessService':
      return 'bizsvc-';
    case 'BusinessProcess':
      return 'proc-';
    case 'Department':
      return 'dept-';
    case 'Principle':
      return 'principle-';
    case 'Requirement':
      return 'req-';
    default:
      return `${String(type).toLowerCase()}-`;
  }
};

const makeUniqueId = (existingIds: Set<string>, base: string) => {
  const normalized = (base ?? '').trim() || 'new';
  if (!existingIds.has(normalized)) return normalized;
  let i = 2;
  while (existingIds.has(`${normalized}-${i}`)) i += 1;
  return `${normalized}-${i}`;
};

const objectLeaves = (args: {
  objectsById: Map<string, { id: string; type: ObjectType; attributes: Record<string, unknown> }>;
  type: ObjectType;
  icon: React.ReactNode;
}): DataNode[] => {
  const { objectsById, type, icon } = args;
  const items = Array.from(objectsById.values()).filter((o) => o.type === type && !isSoftDeleted(o.attributes));
  items.sort((a, b) => nameForObject(a).localeCompare(nameForObject(b)) || a.id.localeCompare(b.id));
  return items.map((o) => ({
    key: KEY.element(o.id),
    title: nameForObject(o),
    icon,
    isLeaf: true,
  }));
};

const countLiveObjectsByType = (
  objectsById: Map<string, { id: string; type: ObjectType; attributes: Record<string, unknown> }>,
  type: ObjectType,
): number => {
  let count = 0;
  for (const o of objectsById.values()) {
    if (o.type !== type) continue;
    if (isSoftDeleted(o.attributes)) continue;
    count += 1;
  }
  return count;
};

const viewsByCategory = (views: ViewDefinition[]) => {
  const business = views.filter((v) => v.architectureLayer === 'Business');
  const application = views.filter((v) => v.architectureLayer === 'Application');
  const technology = views.filter((v) => v.architectureLayer === 'Technology');
  // Roadmaps are represented as analysis workspaces in this build; keep the category empty by default.
  return { business, application, technology };
};

const ExplorerTree: React.FC = () => {
  const { setSelection } = useIdeSelection();
  const { openRouteTab, openWorkspaceTab } = useIdeShell();
  const { eaRepository, setEaRepository, metadata } = useEaRepository();

  const [refreshToken, setRefreshToken] = React.useState(0);

  const [showTechnologyInProgrammeScope, setShowTechnologyInProgrammeScope] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem('ea.programmeScope.showTechnology') === 'true';
    } catch {
      return false;
    }
  });

  const setShowTechnologyFlag = React.useCallback((next: boolean) => {
    setShowTechnologyInProgrammeScope(next);
    try {
      localStorage.setItem('ea.programmeScope.showTechnology', next ? 'true' : 'false');
    } catch {
      // Best-effort.
    }
  }, []);

  const [expandedKeys, setExpandedKeys] = React.useState<React.Key[]>(() => {
    const scope = metadata?.architectureScope ?? null;
    if (scope === 'Enterprise') return [...ENTERPRISE_FULLY_EXPANDED_KEYS];
    if (scope === 'Business Unit') return [ROOT_KEYS.business, ROOT_KEYS.application, ROOT_KEYS.technology];
    if (scope === 'Domain') return [ROOT_KEYS.business, ROOT_KEYS.application];
    if (scope === 'Programme') return [ROOT_KEYS.implMig, 'explorer:implmig:programmes', ROOT_KEYS.views, 'explorer:views:roadmaps'];
    return [ROOT_KEYS.business, ROOT_KEYS.application, ROOT_KEYS.technology, ROOT_KEYS.implMig, ROOT_KEYS.governance, ROOT_KEYS.views];
  });

  React.useEffect(() => {
    // Recompute default expansion when creating/loading a repository.
    const scope = metadata?.architectureScope ?? null;
    if (scope === 'Enterprise') {
      setExpandedKeys([...ENTERPRISE_FULLY_EXPANDED_KEYS]);
    } else if (scope === 'Business Unit') {
      setExpandedKeys([ROOT_KEYS.business, ROOT_KEYS.application, ROOT_KEYS.technology]);
    } else if (scope === 'Domain') {
      setExpandedKeys([ROOT_KEYS.business, ROOT_KEYS.application]);
    } else if (scope === 'Programme') {
      setExpandedKeys([ROOT_KEYS.implMig, 'explorer:implmig:programmes', ROOT_KEYS.views, 'explorer:views:roadmaps']);
    } else {
      setExpandedKeys([ROOT_KEYS.business, ROOT_KEYS.application, ROOT_KEYS.technology, ROOT_KEYS.implMig, ROOT_KEYS.governance, ROOT_KEYS.views]);
    }
  }, [metadata?.architectureScope]);

  React.useEffect(() => {
    const handler = () => setRefreshToken((x) => x + 1);
    try {
      window.addEventListener('ea:viewsChanged', handler);
      return () => window.removeEventListener('ea:viewsChanged', handler);
    } catch {
      return;
    }
  }, []);

  const existingObjectIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const id of eaRepository?.objects.keys() ?? []) ids.add(id);
    return ids;
  }, [eaRepository, refreshToken]);

  const views = React.useMemo<ViewDefinition[]>(() => {
    try {
      return getViewRepository().listAllViews();
    } catch {
      return [];
    }
  }, [refreshToken]);

  const treeData = React.useMemo<DataNode[]>(() => {
    const objectsById = eaRepository?.objects ?? new Map();
    const viewCats = viewsByCategory(views);
    const scope = metadata?.architectureScope ?? null;

    const collectionNode = (args: {
      key: string;
      title: string;
      icon: React.ReactNode;
      children: DataNode[];
    }): DataNode => ({
      key: args.key,
      title: args.title,
      icon: args.icon,
      selectable: true,
      children: args.children,
    });

    const viewLeaf = (v: ViewDefinition): DataNode => ({
      key: KEY.view(v.id),
      title: v.name,
      icon: <FileTextOutlined />,
      isLeaf: true,
    });

    const enterpriseLeaves = objectLeaves({ objectsById, type: 'Enterprise', icon: <ApartmentOutlined /> });
    const businessUnitEnterpriseChildren: DataNode[] =
      enterpriseLeaves.length > 0
        ? [enterpriseLeaves[0]!]
        : [
            {
              key: BUSINESS_UNIT_ENTERPRISE_PLACEHOLDER_KEY,
              title: 'Business Unit (root)',
              icon: <ApartmentOutlined />,
              isLeaf: true,
            },
          ];

    const businessRoot: DataNode = {
      key: ROOT_KEYS.business,
      title: 'Business',
      icon: <DatabaseOutlined />,
      children:
        scope === 'Domain'
          ? [
              collectionNode({
                key: 'explorer:business:capabilities',
                title: 'Capabilities',
                icon: <ApartmentOutlined />,
                children: objectLeaves({ objectsById, type: 'Capability', icon: <ApartmentOutlined /> }),
              }),
              collectionNode({
                key: 'explorer:business:business-services',
                title: 'Business Services',
                icon: <ForkOutlined />,
                children: objectLeaves({ objectsById, type: 'BusinessService', icon: <ForkOutlined /> }),
              }),
            ]
          : scope === 'Programme'
            ? [
                collectionNode({
                  key: 'explorer:business:capabilities',
                  title: 'Capabilities',
                  icon: <ApartmentOutlined />,
                  children: objectLeaves({ objectsById, type: 'Capability', icon: <ApartmentOutlined /> }),
                }),
              ]
          : [
              collectionNode({
                key: 'explorer:business:enterprises',
                title: 'Enterprises',
                icon: <ApartmentOutlined />,
                children: scope === 'Business Unit' ? businessUnitEnterpriseChildren : enterpriseLeaves,
              }),
              collectionNode({
                key: 'explorer:business:capabilities',
                title: 'Capabilities',
                icon: <ApartmentOutlined />,
                children: objectLeaves({ objectsById, type: 'Capability', icon: <ApartmentOutlined /> }),
              }),
              collectionNode({
                key: 'explorer:business:business-services',
                title: 'Business Services',
                icon: <ForkOutlined />,
                children: objectLeaves({ objectsById, type: 'BusinessService', icon: <ForkOutlined /> }),
              }),
              collectionNode({
                key: 'explorer:business:processes',
                title: 'Business Processes',
                icon: <ForkOutlined />,
                children: objectLeaves({ objectsById, type: 'BusinessProcess', icon: <ForkOutlined /> }),
              }),
              collectionNode({
                key: 'explorer:business:departments',
                title: 'Departments',
                icon: <TeamOutlined />,
                children: objectLeaves({ objectsById, type: 'Department', icon: <TeamOutlined /> }),
              }),
            ],
    };

    const applicationRoot: DataNode = {
      key: ROOT_KEYS.application,
      title: 'Application',
      icon: <DatabaseOutlined />,
      children:
        scope === 'Programme'
          ? [
              collectionNode({
                key: 'explorer:application:applications',
                title: 'Applications',
                icon: <AppstoreOutlined />,
                children: objectLeaves({ objectsById, type: 'Application', icon: <AppstoreOutlined /> }),
              }),
            ]
          : [
              collectionNode({
                key: 'explorer:application:applications',
                title: 'Applications',
                icon: <AppstoreOutlined />,
                children: objectLeaves({ objectsById, type: 'Application', icon: <AppstoreOutlined /> }),
              }),
              collectionNode({
                key: 'explorer:application:application-services',
                title: 'Application Services',
                icon: <AppstoreOutlined />,
                children: objectLeaves({ objectsById, type: 'ApplicationService', icon: <AppstoreOutlined /> }),
              }),
            ],
    };

    const technologyRoot: DataNode = {
      key: ROOT_KEYS.technology,
      title: 'Technology',
      icon: <DatabaseOutlined />,
      children: [
        collectionNode({
          key: 'explorer:technology:technologies',
          title: 'Technologies',
          icon: <CloudOutlined />,
          children: objectLeaves({ objectsById, type: 'Technology', icon: <CloudOutlined /> }),
        }),
      ],
    };

    if (scope === 'Business Unit') return [businessRoot, applicationRoot, technologyRoot];

    if (scope === 'Domain') return [businessRoot, applicationRoot];

    if (scope === 'Programme') {
      const implMigRoot: DataNode = {
        key: ROOT_KEYS.implMig,
        title: 'Implementation & Migration',
        icon: <DatabaseOutlined />,
        children: [
          collectionNode({
            key: 'explorer:implmig:programmes',
            title: 'Programmes',
            icon: <ProjectOutlined />,
            children: objectLeaves({ objectsById, type: 'Programme', icon: <ProjectOutlined /> }),
          }),
          collectionNode({
            key: 'explorer:implmig:projects',
            title: 'Projects',
            icon: <FundProjectionScreenOutlined />,
            children: objectLeaves({ objectsById, type: 'Project', icon: <FundProjectionScreenOutlined /> }),
          }),
        ],
      };

      const viewsRoot: DataNode = {
        key: ROOT_KEYS.views,
        title: 'Views',
        icon: <ApartmentOutlined />,
        children: [
          {
            key: 'explorer:views:roadmaps',
            title: 'Roadmaps',
            icon: <ApartmentOutlined />,
            children: [],
          },
          {
            key: 'explorer:views:application',
            title: 'Application Views',
            icon: <ApartmentOutlined />,
            children: viewCats.application.map(viewLeaf),
          },
          {
            key: 'explorer:views:business',
            title: 'Business Views',
            icon: <ApartmentOutlined />,
            children: viewCats.business.map(viewLeaf),
          },
        ],
      };

      return [
        implMigRoot,
        viewsRoot,
        applicationRoot,
        businessRoot,
        ...(showTechnologyInProgrammeScope ? [technologyRoot] : []),
      ];
    }

    return [
      businessRoot,
      applicationRoot,
      technologyRoot,
      {
        key: ROOT_KEYS.implMig,
        title: 'Implementation & Migration',
        icon: <DatabaseOutlined />,
        children: [
          collectionNode({
            key: 'explorer:implmig:programmes',
            title: 'Programmes',
            icon: <ProjectOutlined />,
            children: objectLeaves({ objectsById, type: 'Programme', icon: <ProjectOutlined /> }),
          }),
          collectionNode({
            key: 'explorer:implmig:projects',
            title: 'Projects',
            icon: <FundProjectionScreenOutlined />,
            children: objectLeaves({ objectsById, type: 'Project', icon: <FundProjectionScreenOutlined /> }),
          }),
        ],
      },
      {
        key: ROOT_KEYS.governance,
        title: 'Governance',
        icon: <DatabaseOutlined />,
        children: [
          collectionNode({
            key: 'explorer:governance:principles',
            title: 'Principles',
            icon: <SafetyOutlined />,
            children: objectLeaves({ objectsById, type: 'Principle', icon: <SafetyOutlined /> }),
          }),
          collectionNode({
            key: 'explorer:governance:requirements',
            title: 'Requirements',
            icon: <FileTextOutlined />,
            children: objectLeaves({ objectsById, type: 'Requirement', icon: <FileTextOutlined /> }),
          }),
        ],
      },
      {
        key: ROOT_KEYS.views,
        title: 'Views',
        icon: <ApartmentOutlined />,
        children: [
          {
            key: 'explorer:views:business',
            title: 'Business Views',
            icon: <ApartmentOutlined />,
            children: viewCats.business.map(viewLeaf),
          },
          {
            key: 'explorer:views:application',
            title: 'Application Views',
            icon: <ApartmentOutlined />,
            children: viewCats.application.map(viewLeaf),
          },
          {
            key: 'explorer:views:technology',
            title: 'Technology Views',
            icon: <ApartmentOutlined />,
            children: viewCats.technology.map(viewLeaf),
          },
          {
            key: 'explorer:views:roadmaps',
            title: 'Roadmaps',
            icon: <ApartmentOutlined />,
            children: [],
          },
        ],
      },
    ];
  }, [eaRepository, metadata?.architectureScope, refreshToken, showTechnologyInProgrammeScope, views]);

  const createObject = React.useCallback(
    (type: ObjectType) => {
      if (!eaRepository) {
        message.warning('No repository loaded. Create a repository first.');
        return;
      }

      if (metadata?.architectureScope === 'Programme') {
        const programmeCount = countLiveObjectsByType(eaRepository.objects, 'Programme');
        if (programmeCount < 1 && type !== 'Programme') {
          message.warning('Create at least one Programme before creating other elements.');
          return;
        }
        const allowed: ReadonlySet<ObjectType> = new Set(['Programme', 'Project', 'Capability', 'Application']);
        if (!allowed.has(type)) {
          message.warning('Programme scope is focused: only Programmes, Projects, Capabilities, and Applications can be created.');
          return;
        }
      }

      if (metadata?.architectureScope === 'Domain') {
        const allowed: ReadonlySet<ObjectType> = new Set([
          'Capability',
          'BusinessService',
          'Application',
          'ApplicationService',
        ]);
        if (!allowed.has(type)) {
          message.warning(
            'Domain scope is focused: only Capabilities, Business Services, Applications, and Application Services can be created.',
          );
          return;
        }
      }

      if (metadata?.architectureScope === 'Business Unit' && type === 'Enterprise') {
        const liveEnterprises = countLiveObjectsByType(eaRepository.objects, 'Enterprise');
        if (liveEnterprises >= 1) {
          message.warning('Business Unit scope allows exactly one Enterprise root.');
          return;
        }
      }

      const defaultId = makeUniqueId(existingObjectIds, `${defaultIdPrefixForType(type)}${Date.now()}`);

      let name = '';
      let description = '';
      let lifecycleState: 'Baseline' | 'Target' | 'Retired' = 'Baseline';
      let ownerRole = '';
      let ownerName = '';

      Modal.confirm({
        title: `Create ${titleForObjectType(type)}`,
        okText: 'Create',
        cancelText: 'Cancel',
        content: (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ opacity: 0.8, fontSize: 12 }}>ID will be auto-generated but remains editable in Properties later.</div>
            <input
              defaultValue={name}
              placeholder="Name"
              onChange={(e) => {
                name = e.target.value;
              }}
              style={{ width: '100%', padding: 6, border: '1px solid rgba(0,0,0,0.15)', borderRadius: 4 }}
            />
            <textarea
              defaultValue={description}
              placeholder="Description"
              onChange={(e) => {
                description = e.target.value;
              }}
              style={{ width: '100%', padding: 6, border: '1px solid rgba(0,0,0,0.15)', borderRadius: 4, minHeight: 80 }}
            />
            <select
              defaultValue={lifecycleState}
              onChange={(e) => {
                lifecycleState = e.target.value as any;
              }}
              style={{ width: '100%', padding: 6, border: '1px solid rgba(0,0,0,0.15)', borderRadius: 4 }}
            >
              <option value="Baseline">Baseline</option>
              <option value="Target">Target</option>
              <option value="Retired">Retired</option>
            </select>
            <input
              defaultValue={ownerRole}
              placeholder="Owner Role (e.g. Business Owner)"
              onChange={(e) => {
                ownerRole = e.target.value;
              }}
              style={{ width: '100%', padding: 6, border: '1px solid rgba(0,0,0,0.15)', borderRadius: 4 }}
            />
            <input
              defaultValue={ownerName}
              placeholder="Owner Name"
              onChange={(e) => {
                ownerName = e.target.value;
              }}
              style={{ width: '100%', padding: 6, border: '1px solid rgba(0,0,0,0.15)', borderRadius: 4 }}
            />
          </div>
        ),
        onOk: () => {
          const finalName = (name ?? '').trim();
          if (!finalName) {
            message.error('Name is required.');
            return Promise.reject();
          }

          setEaRepository((prev) => {
            if (!prev) return prev;
            const next = prev.clone();
            const id = defaultId;
            const res = next.addObject({
              id,
              type,
              attributes: {
                name: finalName,
                description: (description ?? '').trim(),
                lifecycleState,
                ownerRole: (ownerRole ?? '').trim(),
                ownerName: (ownerName ?? '').trim(),
                ...(metadata?.architectureScope === 'Domain'
                  ? { domainId: (metadata?.repositoryName ?? '').trim() || 'domain' }
                  : {}),
              },
            });
            if (!res.ok) {
              message.error(res.error);
              return prev;
            }
            return next;
          });

          message.success(`${titleForObjectType(type)} created.`);
          setRefreshToken((x) => x + 1);
          return undefined;
        },
      });
    },
    [eaRepository, existingObjectIds, metadata?.architectureScope, metadata?.repositoryName, setEaRepository],
  );

  const duplicateObject = React.useCallback(
    (id: string) => {
      if (!eaRepository) return;
      const src = eaRepository.objects.get(id);
      if (!src) return;

      if (metadata?.architectureScope === 'Business Unit' && src.type === 'Enterprise') {
        message.warning('Business Unit scope allows exactly one Enterprise root.');
        return;
      }

      setEaRepository((prev) => {
        if (!prev) return prev;
        const next = prev.clone();
        const base = `${defaultIdPrefixForType(src.type)}copy-${Date.now()}`;
        const newId = makeUniqueId(new Set(Array.from(prev.objects.keys())), base);
        const res = next.addObject({
          id: newId,
          type: src.type,
          attributes: { ...(src.attributes ?? {}), name: `${nameForObject(src)} (Copy)` },
        });
        if (!res.ok) {
          message.error(res.error);
          return prev;
        }
        return next;
      });
      setRefreshToken((x) => x + 1);
      message.success('Element duplicated.');
    },
    [eaRepository, metadata?.architectureScope, setEaRepository],
  );

  const deleteObject = React.useCallback(
    (id: string) => {
      if (!eaRepository) return;
      const obj = eaRepository.objects.get(id);
      if (!obj) return;

      if (metadata?.architectureScope === 'Business Unit' && obj.type === 'Enterprise') {
        message.warning('Business Unit scope requires exactly one Enterprise root; it cannot be deleted.');
        return;
      }

      Modal.confirm({
        title: 'Delete element?',
        content: `Deletes "${nameForObject(obj)}" from the repository (relationships will also be removed).`,
        okText: 'Delete',
        okButtonProps: { danger: true },
        cancelText: 'Cancel',
        onOk: () => {
          setEaRepository((prev) => {
            if (!prev) return prev;
            const next = prev.clone();
            // Best-effort: mark as deleted (hard delete is implemented in EaRepository next iteration).
            const res = next.updateObjectAttributes(id, { _deleted: true }, 'merge');
            if (!res.ok) {
              message.error(res.error);
              return prev;
            }
            return next;
          });
          setRefreshToken((x) => x + 1);
          message.success('Element deleted.');
        },
      });
    },
    [eaRepository, metadata?.architectureScope, setEaRepository],
  );

  const deleteView = React.useCallback((viewId: string) => {
    Modal.confirm({
      title: 'Delete view?',
      content: 'Deletes the view definition only. Repository elements are not deleted.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: () => {
        try {
          deleteViewById(viewId);
          setRefreshToken((x) => x + 1);
          message.success('View deleted.');
        } catch {
          message.error('Failed to delete view.');
        }
      },
    });
  }, []);

  const openForKey = React.useCallback(
    (key: string) => {
      const scope = metadata?.architectureScope ?? null;
      // Root nodes open the most common catalog / view for that domain.
      if (key === ROOT_KEYS.business) {
        if (scope === 'Programme') {
          openWorkspaceTab({ type: 'catalog', catalog: 'capabilities' });
          return;
        }
        openWorkspaceTab({ type: 'catalog', catalog: scope === 'Domain' ? 'capabilities' : 'enterprises' });
        return;
      }
      if (key === ROOT_KEYS.application) {
        openWorkspaceTab({ type: 'catalog', catalog: 'applications' });
        return;
      }
      if (key === ROOT_KEYS.technology) {
        openWorkspaceTab({ type: 'catalog', catalog: 'technologies' });
        return;
      }
      if (key === ROOT_KEYS.implMig) {
        openWorkspaceTab({ type: 'catalog', catalog: 'programmes' });
        return;
      }
      if (key === ROOT_KEYS.governance) {
        openWorkspaceTab({ type: 'catalog', catalog: 'principles' });
        return;
      }
      if (key === ROOT_KEYS.views) {
        // Views are managed under the Diagrams activity; keep this as a no-op open.
        openRouteTab('/workspace');
        return;
      }

      // Second-level catalogs.
      if (key === 'explorer:business:enterprises') {
        openWorkspaceTab({ type: 'catalog', catalog: 'enterprises' });
        return;
      }
      if (key === BUSINESS_UNIT_ENTERPRISE_PLACEHOLDER_KEY) {
        openWorkspaceTab({ type: 'catalog', catalog: 'enterprises' });
        return;
      }
      if (key === 'explorer:business:capabilities') {
        openWorkspaceTab({ type: 'catalog', catalog: 'capabilities' });
        return;
      }
      if (key === 'explorer:business:business-services') {
        openWorkspaceTab({ type: 'catalog', catalog: 'businessServices' });
        return;
      }
      if (key === 'explorer:business:processes') {
        openWorkspaceTab({ type: 'catalog', catalog: 'processes' });
        return;
      }
      if (key === 'explorer:business:departments') {
        openWorkspaceTab({ type: 'catalog', catalog: 'departments' });
        return;
      }
      if (key === 'explorer:application:applications') {
        openWorkspaceTab({ type: 'catalog', catalog: 'applications' });
        return;
      }
      if (key === 'explorer:application:application-services') {
        openWorkspaceTab({ type: 'catalog', catalog: 'applicationServices' });
        return;
      }
      if (key === 'explorer:technology:technologies') {
        openWorkspaceTab({ type: 'catalog', catalog: 'technologies' });
        return;
      }
      if (key === 'explorer:implmig:programmes') {
        openWorkspaceTab({ type: 'catalog', catalog: 'programmes' });
        return;
      }

      if (key === 'explorer:implmig:projects') {
        openWorkspaceTab({ type: 'catalog', catalog: 'projects' });
        return;
      }

      if (key === 'explorer:governance:principles') {
        openWorkspaceTab({ type: 'catalog', catalog: 'principles' });
        return;
      }
      if (key === 'explorer:governance:requirements') {
        openWorkspaceTab({ type: 'catalog', catalog: 'requirements' });
        return;
      }

      if (key.startsWith('explorer:views:')) {
        if (key === 'explorer:views:roadmaps') {
          openWorkspaceTab({ type: 'analysis', kind: 'roadmap' });
          return;
        }
        openRouteTab('/workspace');
        return;
      }

      if (key.startsWith('explorer:view:')) {
        const viewId = key.replace('explorer:view:', '').trim();
        if (viewId) openWorkspaceTab({ type: 'view', viewId });
        return;
      }

      if (key.startsWith('explorer:element:')) {
        const id = key.replace('explorer:element:', '').trim();
        const obj = eaRepository?.objects.get(id);
        if (!obj) return;
        openWorkspaceTab({ type: 'object', objectId: obj.id, objectType: obj.type, name: nameForObject(obj) });
        return;
      }

      openRouteTab('/workspace');
    },
    [eaRepository, metadata?.architectureScope, metadata?.repositoryName, openRouteTab, openWorkspaceTab],
  );

  const menuForKey = React.useCallback(
    (key: string) => {
      if (metadata?.architectureScope === 'Programme' && key === ROOT_KEYS.implMig) {
        const show = showTechnologyInProgrammeScope;

        return {
          items: [
            {
              key: 'openProgrammes',
              label: 'Open Programmes Catalog',
              onClick: () => openWorkspaceTab({ type: 'catalog', catalog: 'programmes' }),
            },
            {
              key: 'toggleTechnology',
              label: show ? 'Hide Technology Layer' : 'Show Technology Layer',
              onClick: () => {
                setShowTechnologyFlag(!show);
              },
            },
            {
              key: 'refresh',
              label: 'Refresh',
              onClick: () => setRefreshToken((x) => x + 1),
            },
          ],
        };
      }

      if (key === BUSINESS_UNIT_ENTERPRISE_PLACEHOLDER_KEY) {
        return {
          items: [
            {
              key: 'create',
              icon: <PlusOutlined />,
              label: 'Create Enterprise Root',
              onClick: () => createObject('Enterprise'),
            },
            {
              key: 'open',
              label: 'Open Enterprises Catalog',
              onClick: () => openWorkspaceTab({ type: 'catalog', catalog: 'enterprises' }),
            },
          ],
        };
      }

      // Collections: Create / Import / Bulk Edit / Refresh
      const collectionToCreateType: Record<string, ObjectType | undefined> = {
        'explorer:business:enterprises': 'Enterprise',
        'explorer:business:capabilities': 'Capability',
        'explorer:business:business-services': 'BusinessService',
        'explorer:business:processes': 'BusinessProcess',
        'explorer:business:departments': 'Department',
        'explorer:application:applications': 'Application',
        'explorer:application:application-services': 'ApplicationService',
        'explorer:technology:technologies': 'Technology',
        'explorer:implmig:programmes': 'Programme',
        'explorer:implmig:projects': 'Project',
        'explorer:governance:principles': 'Principle',
        'explorer:governance:requirements': 'Requirement',
      };

      const createType = collectionToCreateType[key];
      if (createType) {
        const programmeCreateBlocked =
          metadata?.architectureScope === 'Programme' &&
          createType !== 'Programme' &&
          countLiveObjectsByType(eaRepository?.objects ?? new Map<string, any>(), 'Programme') < 1;

        const enterpriseCreateDisabled =
          metadata?.architectureScope === 'Business Unit' &&
          createType === 'Enterprise' &&
          countLiveObjectsByType(eaRepository?.objects ?? new Map<string, any>(), 'Enterprise') >= 1;

        return {
          items: [
            {
              key: 'create',
              icon: <PlusOutlined />,
              label: `Create ${titleForObjectType(createType)}`,
              disabled: enterpriseCreateDisabled || programmeCreateBlocked,
              onClick: () => createObject(createType),
            },
            {
              key: 'import',
              label: 'Import (CSV / Excel)',
              onClick: () => openRouteTab('/interoperability'),
            },
            {
              key: 'bulk',
              label: 'Bulk Edit',
              onClick: () => openForKey(key),
            },
            {
              key: 'refresh',
              label: 'Refresh',
              onClick: () => setRefreshToken((x) => x + 1),
            },
          ],
        };
      }

      // Element: Open Properties / Duplicate / Delete
      if (key.startsWith('explorer:element:')) {
        const id = key.replace('explorer:element:', '').trim();
        const obj = eaRepository?.objects.get(id);
        const isBusinessUnitRootEnterprise =
          metadata?.architectureScope === 'Business Unit' && obj?.type === 'Enterprise';
        return {
          items: [
            {
              key: 'open',
              label: 'Open Properties',
              onClick: () => {
                if (!obj) return;
                openWorkspaceTab({ type: 'object', objectId: obj.id, objectType: obj.type, name: nameForObject(obj) });
              },
            },
            {
              key: 'rel',
              label: 'Create Relationship',
              onClick: () => {
                if (!obj) return;
                openWorkspaceTab({ type: 'object', objectId: obj.id, objectType: obj.type, name: nameForObject(obj) });
              },
            },
            {
              key: 'addToView',
              label: 'Add to View',
              onClick: () => {
                openRouteTab('/views/create');
              },
            },
            {
              key: 'impact',
              label: 'Impact Analysis',
              onClick: () => {
                openWorkspaceTab({ type: 'analysis', kind: 'impact' });
              },
            },
            {
              key: 'dup',
              label: 'Duplicate',
              onClick: () => duplicateObject(id),
            },
            {
              key: 'del',
              icon: <DeleteOutlined />,
              danger: true,
              label: 'Delete',
              disabled: isBusinessUnitRootEnterprise,
              onClick: () => deleteObject(id),
            },
          ],
        };
      }

      // View: Open / Delete
      if (key.startsWith('explorer:view:')) {
        const viewId = key.replace('explorer:view:', '').trim();
        return {
          items: [
            {
              key: 'open',
              label: 'Open View',
              onClick: () => openWorkspaceTab({ type: 'view', viewId }),
            },
            {
              key: 'delete',
              icon: <DeleteOutlined />,
              danger: true,
              label: 'Delete View',
              onClick: () => deleteView(viewId),
            },
          ],
        };
      }

      return {
        items: [
          {
            key: 'refresh',
            label: 'Refresh',
            onClick: () => setRefreshToken((x) => x + 1),
          },
        ],
      };
    },
    [createObject, deleteObject, deleteView, duplicateObject, eaRepository, metadata?.architectureScope, openForKey, openRouteTab, openWorkspaceTab, setShowTechnologyFlag, showTechnologyInProgrammeScope],
  );

  return (
    <div className={styles.explorerTree}>
      <Tree
        virtual={false}
        showIcon
        showLine={{ showLeafIcon: false }}
        blockNode
        selectable
        expandAction={false}
        expandedKeys={expandedKeys}
        onExpand={(next) => setExpandedKeys(next)}
        /* Intentionally keep visual selection empty (no blue highlight). */
        selectedKeys={[]}
        treeData={treeData}
        switcherIcon={({ expanded }) => (expanded ? <CaretDownOutlined /> : <CaretRightOutlined />)}
        titleRender={(node) => {
          const k = typeof node.key === 'string' ? node.key : '';
          return (
            <Dropdown trigger={['contextMenu']} menu={menuForKey(k)}>
              <span>{node.title as any}</span>
            </Dropdown>
          );
        }}
        onSelect={(selectedKeys: React.Key[], info) => {
          const key = selectedKeys?.[0];
          if (typeof key !== 'string') return;

          // Explorer rule: caret/switcher click should ONLY expand/collapse.
          const target = (info?.nativeEvent?.target as HTMLElement | null) ?? null;
          if (target?.closest?.('.ant-tree-switcher')) return;

          setSelection({ kind: 'repository', keys: [key] });
          openForKey(key);
        }}
      />
    </div>
  );
};

export default ExplorerTree;
