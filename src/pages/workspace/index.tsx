import React from 'react';

import { Card, Empty, Space, Typography } from 'antd';

import { useEaProject } from '@/ea/EaProjectContext';

const WorkspacePage: React.FC = () => {
  const { project } = useEaProject();

  return (
    <div style={{ height: '100%', padding: 24 }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Workspace
        </Typography.Title>

        {project ? (
          <Card>
            <Space direction="vertical" size={4}>
              <Typography.Text strong>{project.name}</Typography.Text>
              {project.description ? (
                <Typography.Text type="secondary">{project.description}</Typography.Text>
              ) : (
                <Typography.Text type="secondary">No description</Typography.Text>
              )}
              <Typography.Text type="secondary">
                Created: {new Date(project.createdAt).toLocaleString()}
              </Typography.Text>
            </Space>
          </Card>
        ) : null}

        <Card>
          <Empty
            description={
              <Space direction="vertical" size={0}>
                <Typography.Text strong>Repository is empty</Typography.Text>
                <Typography.Text type="secondary">Add elements from the Catalogues panel.</Typography.Text>
              </Space>
            }
          />
        </Card>
      </Space>
    </div>
  );
};

export default WorkspacePage;
