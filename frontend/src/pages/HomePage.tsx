import React, { useState, useEffect } from 'react'
import { 
  Layout, 
  Typography, 
  Select, 
  Spin, 
  Empty,
  message 
} from 'antd'
import { useNavigate } from 'react-router-dom'
import ProjectCard from '../components/ProjectCard'
import FileUpload from '../components/FileUpload'
import BilibiliDownload from '../components/BilibiliDownload'

import { projectApi } from '../services/api'
import { Project, useProjectStore } from '../store/useProjectStore'
import { useProjectPolling } from '../hooks/useProjectPolling'
// import { useWebSocket, WebSocketEventMessage } from '../hooks/useWebSocket'  // 已禁用WebSocket系统

const { Content } = Layout
const { Title, Text } = Typography
const { Option } = Select

const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const { projects, setProjects, deleteProject, loading, setLoading } = useProjectStore()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'upload' | 'bilibili'>('upload')

  // WebSocket连接已禁用，使用新的简化进度系统
  // const handleWebSocketMessage = (message: WebSocketEventMessage) => {
  //   console.log('HomePage收到WebSocket消息:', message)
  //   
  //   switch (message.type) {
  //     case 'task_progress_update':
  //       console.log('📊 收到任务进度更新:', message)
  //       // 刷新项目列表以获取最新状态
  //       loadProjects()
  //       break
  //       
  //     case 'project_update':
  //       console.log('📊 收到项目更新:', message)
  //       // 刷新项目列表以获取最新状态
  //       loadProjects()
  //       break
  //       
  //     default:
  //       console.log('忽略未知类型的WebSocket消息:', (message as any).type)
  //   }
  // }

  // const { isConnected, syncSubscriptions } = useWebSocket({
  //   userId: 'homepage-user',
  //   onMessage: handleWebSocketMessage
  // })

  // 使用项目轮询Hook
  useProjectPolling({
    onProjectsUpdate: (updatedProjects) => {
      setProjects(updatedProjects || [])
    },
    enabled: true,
    interval: 10000 // 10秒轮询一次
  })

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    setLoading(true)
    try {
      // 从后端API获取真实项目数据
      const projects = await projectApi.getProjects()
      setProjects(projects || [])
    } catch (error) {
      message.error('Failed to load projects')
      console.error('Load projects error:', error)
      // 如果API调用失败，设置空数组
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  // 使用集合差异对齐订阅项目WebSocket主题
  // WebSocket订阅已禁用，使用新的简化进度系统
  // useEffect(() => {
  //   if (isConnected && projects.length > 0) {
  //     const desiredChannels = projects.map(project => `project_${project.id}`)
  //     console.log('同步订阅项目频道:', desiredChannels)
  //     syncSubscriptions(desiredChannels)
  //   } else if (isConnected && projects.length === 0) {
  //     // 如果没有项目，清空所有订阅
  //     console.log('清空所有项目订阅')
  //     syncSubscriptions([])
  //   }
  // }, [isConnected, projects, syncSubscriptions])

  const handleDeleteProject = async (id: string) => {
    try {
      await projectApi.deleteProject(id)
      deleteProject(id)
      message.success('Project deleted successfully')
    } catch (error) {
      message.error('Failed to delete project')
      console.error('Delete project error:', error)
    }
  }

  const handleRetryProject = async (projectId: string) => {
    try {
      // 查找项目状态
      const project = projects.find(p => p.id === projectId)
      if (!project) {
        message.error('Project not found')
        return
      }
      
      // 统一使用retryProcessing API，它会自动处理视频文件不存在的情况
      await projectApi.retryProcessing(projectId)
      message.success('Retrying project processing...')
      
      await loadProjects()
    } catch (error) {
      message.error('Retry failed, please try again later')
      console.error('Retry project error:', error)
    }
  }

  // handleStartProcessing removed as it is no longer used

  const handleProjectCardClick = (project: Project) => {
    // 导入中状态的项目不能点击进入详情页
    if (project.status === 'pending') {
      message.warning('Project is still importing, please wait')
      return
    }
    
    // 其他状态可以正常进入详情页
    navigate(`/project/${project.id}`)
  }

  const filteredProjects = projects
    .filter(project => {
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter
      return matchesStatus
    })
    .sort((a, b) => {
      // 按创建时间倒序排列，最新的在前面
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  return (
    <Layout style={{ 
      minHeight: '100vh', 
      background: '#0f0f0f'
    }}>
      <Content style={{ padding: '40px 24px', position: 'relative' }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          {/* 文件上传区域 */}
          <div style={{ 
            marginBottom: '48px',
            marginTop: '20px',
            display: 'flex',
            justifyContent: 'center'
          }}>
            <div style={{
              width: '100%',
              maxWidth: '800px',
              background: 'rgba(26, 26, 46, 0.8)',
              backdropFilter: 'blur(20px)',
              borderRadius: '16px',
              border: '1px solid rgba(79, 172, 254, 0.2)',
              padding: '20px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)'
            }}>
              {/* 标签页切换 */}
              <div style={{
                display: 'flex',
                marginBottom: '16px',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '3px'
              }}>
                 <button 
                   style={{
                     flex: 1,
                     padding: '12px 24px',
                     borderRadius: '8px',
                     background: activeTab === 'bilibili' ? 'rgba(79, 172, 254, 0.2)' : 'transparent',
                     color: activeTab === 'bilibili' ? '#4facfe' : '#cccccc',
                     cursor: 'pointer',
                     fontSize: '16px',
                     fontWeight: 600,
                     transition: 'all 0.3s ease',
                     border: activeTab === 'bilibili' ? '1px solid rgba(79, 172, 254, 0.4)' : '1px solid transparent'
                   }}
                   onClick={() => setActiveTab('bilibili')}
                 >
                   📺 Import from URL
                 </button>
                <button 
                   style={{
                     flex: 1,
                     padding: '12px 24px',
                     borderRadius: '8px',
                     background: activeTab === 'upload' ? 'rgba(79, 172, 254, 0.2)' : 'transparent',
                     color: activeTab === 'upload' ? '#4facfe' : '#cccccc',
                     cursor: 'pointer',
                     fontSize: '16px',
                     fontWeight: 600,
                     transition: 'all 0.3s ease',
                     border: activeTab === 'upload' ? '1px solid rgba(79, 172, 254, 0.4)' : '1px solid transparent'
                   }}
                   onClick={() => setActiveTab('upload')}
                 >
                   📁 Upload File
                 </button>
              </div>
              
              {/* 内容区域 */}
              <div>
                {activeTab === 'bilibili' && (
                  <BilibiliDownload onDownloadSuccess={async (projectId: string) => {
                    // 直接跳转到处理页面，改善UX
                    navigate(`/processing/${projectId}`)
                  }} />
                )}
                {activeTab === 'upload' && (
                  <FileUpload onUploadSuccess={async (projectId: string) => {
                    // 直接跳转到处理页面，改善UX
                    navigate(`/processing/${projectId}`)
                  }} />
                )}
              </div>
            </div>
          </div>

          {/* 项目管理区域 */}
          <div style={{
            background: 'rgba(26, 26, 46, 0.7)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            border: '1px solid rgba(79, 172, 254, 0.15)',
            padding: '32px',
            marginBottom: '32px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.03)'
          }}>
            {/* 项目列表标题区域 */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '24px',
              paddingBottom: '16px',
              borderBottom: '1px solid rgba(79, 172, 254, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <Title 
                  level={2} 
                  style={{ 
                    margin: 0,
                    color: '#ffffff',
                    fontSize: '24px',
                    fontWeight: 600,
                    background: 'linear-gradient(135deg, #ffffff 0%, #cccccc 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  My Projects
                </Title>
                <div style={{
                  padding: '8px 16px',
                  background: 'rgba(79, 172, 254, 0.1)',
                  borderRadius: '20px',
                  border: '1px solid rgba(79, 172, 254, 0.3)',
                  backdropFilter: 'blur(10px)'
                }}>
                  <Text style={{ color: '#4facfe', fontWeight: 600, fontSize: '14px' }}>
                    {filteredProjects.length} Projects
                  </Text>
                </div>
              </div>
              
              {/* 状态筛选移到右侧 */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center'
              }}>
                <Select
                  placeholder="Filter by status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  style={{ 
                    minWidth: '140px',
                    height: '36px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(79, 172, 254, 0.2)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '14px'
                  }}
                  styles={{
                    popup: {
                      root: {
                        background: 'rgba(26, 26, 46, 0.95)',
                        border: '1px solid rgba(79, 172, 254, 0.3)',
                        borderRadius: '8px',
                        backdropFilter: 'blur(20px)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
                      }
                    }
                  }}
                  suffixIcon={
                    <span style={{ 
                      color: '#8c8c8c', 
                      fontSize: '10px',
                      transition: 'all 0.2s ease'
                    }}>
                      ⌄
                    </span>
                  }
                  allowClear
                >
                  <Option value="all" style={{ color: '#ffffff' }}>All Status</Option>
                  <Option value="completed" style={{ color: '#52c41a' }}>Completed</Option>
                  <Option value="processing" style={{ color: '#1890ff' }}>Processing</Option>
                  <Option value="error" style={{ color: '#ff4d4f' }}>Failed</Option>
                </Select>
              </div>
            </div>

            {/* 项目列表内容 */}
             <div>
               {loading ? (
                 <div style={{ 
                   textAlign: 'center', 
                   padding: '60px 0',
                   background: '#262626',
                   borderRadius: '12px',
                   border: '1px solid #404040'
                 }}>
                   <Spin size="large" />
                   <div style={{ 
                     marginTop: '20px', 
                     color: '#cccccc',
                     fontSize: '16px'
                   }}>
                     Loading projects...
                   </div>
                 </div>
               ) : filteredProjects.length === 0 ? (
                 <div style={{
                   textAlign: 'center',
                   padding: '60px 0',
                   background: '#262626',
                   borderRadius: '12px',
                   border: '1px solid #404040'
                 }}>
                   <Empty
                     image={Empty.PRESENTED_IMAGE_SIMPLE}
                     description={
                       <div>
                         <Text type="secondary">
                           {projects.length === 0 ? 'No projects yet. Use the import area above to create your first project.' : 'No matching projects found'}
                         </Text>
                       </div>
                     }
                   />
                 </div>
               ) : (
                 <div style={{
                   display: 'grid',
                   gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                   gap: '16px',
                   justifyContent: 'start',
                   padding: '6px 0'
                 }}>
                   {filteredProjects.map((project: Project) => (
                     <div key={project.id} style={{ position: 'relative', zIndex: 1 }}>
                       <ProjectCard 
                         project={project} 
                         onDelete={handleDeleteProject}
                         onRetry={() => handleRetryProject(project.id)}
                         onClick={() => handleProjectCardClick(project)}
                       />
                     </div>
                   ))}
                 </div>
               )}
             </div>
           </div>
         </div>
      </Content>
    </Layout>
  )
}

export default HomePage