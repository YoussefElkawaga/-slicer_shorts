import React, { useEffect, useState, useCallback } from 'react';
import { Card, Row, Col, Statistic, Space, Tag, Button, Typography } from 'antd';
import { 
  WifiOutlined, 
  WifiOutlined as WifiDisconnectedOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import TaskProgress from './TaskProgress';
import { NotificationList } from './NotificationList';
import { useNotifications } from '../hooks/useNotifications';
import { useProjectStore } from '../store/useProjectStore';
import { projectApi } from '../api/projectApi';

const { Text } = Typography;

interface RealTimeStatusProps {
  userId: string;
}

export const RealTimeStatus: React.FC<RealTimeStatusProps> = ({ userId }) => {
  console.log('🎬 RealTimeStatus component loaded');
  const { setProjects } = useProjectStore();
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Simple state management without complex hooks
  const loadProjectTasks = useCallback(async (projectId: string) => {
    console.log('📤 Loading project tasks:', projectId);
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/tasks/project/${projectId}`);
      console.log('📡 API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        const projectTasks = data.items || [];
        console.log('📋 Tasks retrieved:', projectTasks.length);
        
        // Convert to format expected by TaskProgress component
        const formattedTasks = projectTasks.map((task: any) => ({
          id: task.id,
          status: task.status,
          progress: task.progress || 0,
          message: task.name || `Task ${task.id}`,
          updatedAt: task.created_at || task.updated_at || new Date().toISOString(),
          project_id: task.project_id
        }));
        
        setTasks(formattedTasks);
      } else {
        console.error('❌ API call failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Failed to load project tasks:', error);
    } finally {
      setLoading(false);
      console.log('✅ Task loading complete');
    }
  }, []);

  const {
    notifications,
    unreadCount,
    markAsRead,
    removeNotification,
    markAllAsRead,
    clearAll: clearAllNotifications,
    handleSystemNotification,
    handleErrorNotification
  } = useNotifications();

  // Load project tasks
  useEffect(() => {
    const projectId = '64d5768e-7b6b-40d0-9aed-f216768a6526'; // Example project ID
    console.log('🔄 Loading project tasks:', projectId);
    loadProjectTasks(projectId);
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <Row gutter={[16, 16]}>
        {/* Statistics */}
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Total Tasks"
              value={tasks.length}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Loading Status"
              value={loading ? 'Loading...' : 'Done'}
              valueStyle={{ color: loading ? '#52c41a' : '#999' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Unread Notifications"
              value={unreadCount}
              valueStyle={{ color: unreadCount > 0 ? '#ff4d4f' : '#999' }}
            />
          </Card>
        </Col>

        {/* Task Progress */}
        <Col span={12}>
          <Card 
            title="Task Progress" 
            size="small"
            extra={
              <Button size="small" onClick={() => setTasks([])}>
                Clear
              </Button>
            }
          >
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {tasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                  No tasks
                </div>
              ) : (
                tasks.map((task) => (
                  <TaskProgress 
                    key={task.id} 
                    projectId={task.project_id || userId}
                    status={task.status}
                  />
                ))
              )}
            </div>
          </Card>
        </Col>

        {/* Notification List */}
        <Col span={12}>
          <NotificationList
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAsRead={markAsRead}
            onRemove={removeNotification}
            onMarkAllAsRead={markAllAsRead}
            onClearAll={clearAllNotifications}
            maxHeight={300}
          />
        </Col>
      </Row>
    </div>
  );
};