import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout, Typography, Spin, Empty, Button, message } from 'antd'
import {
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
  ArrowLeftOutlined,
  RightOutlined
} from '@ant-design/icons'
import { projectApi } from '../services/api'
import { Project } from '../store/useProjectStore'

const { Content } = Layout
const { Title, Text } = Typography

// Status configuration
const STATUS_CONFIG: Record<string, {
  label: string
  icon: React.ReactNode
  color: string
  bgColor: string
  borderColor: string
  glowColor: string
  pulseAnimation?: boolean
}> = {
  completed: {
    label: 'Completed',
    icon: <CheckCircleOutlined />,
    color: '#52c41a',
    bgColor: 'rgba(82, 196, 26, 0.08)',
    borderColor: 'rgba(82, 196, 26, 0.25)',
    glowColor: 'rgba(82, 196, 26, 0.15)'
  },
  processing: {
    label: 'Processing',
    icon: <SyncOutlined spin />,
    color: '#4facfe',
    bgColor: 'rgba(79, 172, 254, 0.08)',
    borderColor: 'rgba(79, 172, 254, 0.25)',
    glowColor: 'rgba(79, 172, 254, 0.15)',
    pulseAnimation: true
  },
  pending: {
    label: 'Pending',
    icon: <ClockCircleOutlined />,
    color: '#faad14',
    bgColor: 'rgba(250, 173, 20, 0.08)',
    borderColor: 'rgba(250, 173, 20, 0.25)',
    glowColor: 'rgba(250, 173, 20, 0.15)'
  },
  failed: {
    label: 'Failed',
    icon: <CloseCircleOutlined />,
    color: '#ff4d4f',
    bgColor: 'rgba(255, 77, 79, 0.08)',
    borderColor: 'rgba(255, 77, 79, 0.25)',
    glowColor: 'rgba(255, 77, 79, 0.15)'
  },
  error: {
    label: 'Error',
    icon: <CloseCircleOutlined />,
    color: '#ff4d4f',
    bgColor: 'rgba(255, 77, 79, 0.08)',
    borderColor: 'rgba(255, 77, 79, 0.25)',
    glowColor: 'rgba(255, 77, 79, 0.15)'
  }
}

const DEFAULT_STATUS_CONFIG = {
  label: 'Unknown',
  icon: <ClockCircleOutlined />,
  color: '#999',
  bgColor: 'rgba(153, 153, 153, 0.08)',
  borderColor: 'rgba(153, 153, 153, 0.25)',
  glowColor: 'rgba(153, 153, 153, 0.1)'
}

// Format relative time
function formatRelativeTime(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Status filter type
type StatusFilter = 'all' | 'processing' | 'completed' | 'failed' | 'pending'

const StatusPage: React.FC = () => {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

  const loadProjects = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true)
    try {
      const data = await projectApi.getProjects()
      setProjects(data || [])
    } catch (error) {
      console.error('Failed to load projects:', error)
      message.error('Failed to load project status')
      setProjects([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // Auto-poll every 8 seconds if there are active/processing projects
  useEffect(() => {
    const hasActiveProjects = projects.some(p =>
      p.status === 'processing' || p.status === 'pending'
    )

    if (hasActiveProjects) {
      const interval = setInterval(() => loadProjects(), 8000)
      return () => clearInterval(interval)
    }
  }, [projects, loadProjects])

  // Compute counts
  const counts = {
    all: projects.length,
    processing: projects.filter(p => p.status === 'processing' || p.status === 'pending').length,
    completed: projects.filter(p => p.status === 'completed').length,
    failed: projects.filter(p => p.status === 'failed' || p.status === 'error').length,
    pending: projects.filter(p => p.status === 'pending').length
  }

  // Filter projects
  const filteredProjects = projects
    .filter(p => {
      if (filter === 'all') return true
      if (filter === 'failed') return p.status === 'failed' || p.status === 'error'
      if (filter === 'processing') return p.status === 'processing' || p.status === 'pending'
      return p.status === filter
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const getConfig = (status: string) => STATUS_CONFIG[status] || DEFAULT_STATUS_CONFIG

  const handleRetry = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await projectApi.retryProcessing(projectId)
      message.success('Retrying processing...')
      loadProjects(true)
    } catch {
      message.error('Retry failed')
    }
  }

  const handleCardClick = (project: Project) => {
    if (project.status === 'completed') {
      navigate(`/project/${project.id}`)
    } else if (project.status === 'processing') {
      navigate(`/processing/${project.id}`)
    }
  }

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh', background: '#0f0f0f' }}>
        <Content style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh'
        }}>
          <div style={{ textAlign: 'center' }}>
            <Spin size="large" />
            <div style={{ marginTop: 20, color: '#999', fontSize: 16 }}>
              Loading status...
            </div>
          </div>
        </Content>
      </Layout>
    )
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#0f0f0f' }}>
      <Content style={{ padding: '40px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 32
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/')}
                style={{
                  color: '#999',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  height: 40
                }}
              >
                Back
              </Button>
              <Title level={2} style={{
                margin: 0,
                background: 'linear-gradient(135deg, #ffffff 0%, #cccccc 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontSize: 28,
                fontWeight: 700
              }}>
                Video Status
              </Title>
            </div>

            <Button
              icon={<ReloadOutlined spin={refreshing} />}
              onClick={() => loadProjects(true)}
              style={{
                background: 'rgba(79, 172, 254, 0.1)',
                border: '1px solid rgba(79, 172, 254, 0.3)',
                color: '#4facfe',
                borderRadius: 8,
                height: 40,
                fontWeight: 500
              }}
            >
              Refresh
            </Button>
          </div>

          {/* Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
            marginBottom: 32
          }}>
            {([
              { key: 'all' as StatusFilter, label: 'Total', count: counts.all, color: '#4facfe', icon: <PlayCircleOutlined /> },
              { key: 'processing' as StatusFilter, label: 'In Progress', count: counts.processing, color: '#faad14', icon: <SyncOutlined /> },
              { key: 'completed' as StatusFilter, label: 'Completed', count: counts.completed, color: '#52c41a', icon: <CheckCircleOutlined /> },
              { key: 'failed' as StatusFilter, label: 'Failed', count: counts.failed, color: '#ff4d4f', icon: <CloseCircleOutlined /> }
            ]).map(item => (
              <button
                key={item.key}
                onClick={() => setFilter(item.key)}
                style={{
                  cursor: 'pointer',
                  background: filter === item.key
                    ? `rgba(${item.color === '#4facfe' ? '79,172,254' : item.color === '#faad14' ? '250,173,20' : item.color === '#52c41a' ? '82,196,26' : '255,77,79'}, 0.12)`
                    : 'rgba(26, 26, 46, 0.6)',
                  border: filter === item.key
                    ? `1px solid ${item.color}`
                    : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 16,
                  padding: '20px 24px',
                  textAlign: 'left',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(12px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16
                }}
              >
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: `rgba(${item.color === '#4facfe' ? '79,172,254' : item.color === '#faad14' ? '250,173,20' : item.color === '#52c41a' ? '82,196,26' : '255,77,79'}, 0.15)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  color: item.color,
                  flexShrink: 0
                }}>
                  {item.icon}
                </div>
                <div>
                  <div style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: '#fff',
                    lineHeight: 1.1
                  }}>
                    {item.count}
                  </div>
                  <div style={{
                    fontSize: 13,
                    color: '#888',
                    marginTop: 4,
                    fontWeight: 500
                  }}>
                    {item.label}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Project List */}
          <div style={{
            background: 'rgba(26, 26, 46, 0.5)',
            backdropFilter: 'blur(20px)',
            borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.06)',
            padding: '24px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
              paddingBottom: 16,
              borderBottom: '1px solid rgba(255,255,255,0.06)'
            }}>
              <Text style={{
                fontSize: 16,
                fontWeight: 600,
                color: '#ccc'
              }}>
                {filter === 'all' ? 'All Projects' :
                 filter === 'processing' ? 'In Progress' :
                 filter === 'completed' ? 'Completed' : 'Failed'
                }
                <span style={{
                  marginLeft: 8,
                  fontSize: 13,
                  color: '#666',
                  fontWeight: 400
                }}>
                  ({filteredProjects.length})
                </span>
              </Text>

              {counts.processing > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 14px',
                  background: 'rgba(79, 172, 254, 0.08)',
                  borderRadius: 20,
                  border: '1px solid rgba(79, 172, 254, 0.2)'
                }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#4facfe',
                    animation: 'pulse 2s ease-in-out infinite'
                  }} />
                  <Text style={{ color: '#4facfe', fontSize: 13, fontWeight: 500 }}>
                    {counts.processing} processing — auto-refreshing
                  </Text>
                </div>
              )}
            </div>

            {filteredProjects.length === 0 ? (
              <div style={{ padding: '60px 0' }}>
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <Text style={{ color: '#666' }}>
                      {projects.length === 0
                        ? 'No projects yet. Upload a video to get started.'
                        : 'No projects match this filter.'}
                    </Text>
                  }
                />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredProjects.map(project => {
                  const config = getConfig(project.status)
                  const isHovered = hoveredCard === project.id
                  const isClickable = project.status === 'completed' || project.status === 'processing'

                  return (
                    <div
                      key={project.id}
                      onClick={() => handleCardClick(project)}
                      onMouseEnter={() => setHoveredCard(project.id)}
                      onMouseLeave={() => setHoveredCard(null)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '16px 20px',
                        background: isHovered
                          ? config.bgColor
                          : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isHovered ? config.borderColor : 'rgba(255,255,255,0.05)'}`,
                        borderRadius: 14,
                        cursor: isClickable ? 'pointer' : 'default',
                        transition: 'all 0.25s ease',
                        transform: isHovered && isClickable ? 'translateX(4px)' : 'none',
                        boxShadow: isHovered
                          ? `0 4px 20px ${config.glowColor}`
                          : 'none',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Left: Status indicator line */}
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 3,
                        background: config.color,
                        borderRadius: '3px 0 0 3px',
                        opacity: isHovered ? 1 : 0.6,
                        transition: 'opacity 0.25s ease'
                      }} />

                      {/* Status Icon */}
                      <div style={{
                        width: 42,
                        height: 42,
                        borderRadius: 10,
                        background: config.bgColor,
                        border: `1px solid ${config.borderColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        color: config.color,
                        marginRight: 16,
                        flexShrink: 0,
                        animation: config.pulseAnimation ? 'pulse 2s ease-in-out infinite' : 'none'
                      }}>
                        {config.icon}
                      </div>

                      {/* Project Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: '#fff',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginBottom: 4
                        }}>
                          {project.name}
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          fontSize: 12,
                          color: '#666'
                        }}>
                          <span>{formatRelativeTime(project.updated_at || project.created_at)}</span>
                          {project.total_clips !== undefined && project.total_clips > 0 && (
                            <span>• {project.total_clips} clips</span>
                          )}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 14px',
                        background: config.bgColor,
                        border: `1px solid ${config.borderColor}`,
                        borderRadius: 20,
                        color: config.color,
                        fontSize: 13,
                        fontWeight: 600,
                        flexShrink: 0,
                        marginRight: 8
                      }}>
                        <span style={{ fontSize: 14 }}>{config.icon}</span>
                        {config.label}
                      </div>

                      {/* Actions */}
                      {(project.status === 'failed' || project.status === 'error') && (
                        <Button
                          size="small"
                          onClick={(e) => handleRetry(project.id, e)}
                          icon={<ReloadOutlined />}
                          style={{
                            background: 'rgba(255, 77, 79, 0.1)',
                            border: '1px solid rgba(255, 77, 79, 0.3)',
                            color: '#ff4d4f',
                            borderRadius: 8,
                            fontWeight: 500,
                            marginRight: 8
                          }}
                        >
                          Retry
                        </Button>
                      )}

                      {/* Chevron for clickable items */}
                      {isClickable && (
                        <RightOutlined style={{
                          color: '#555',
                          fontSize: 12,
                          opacity: isHovered ? 1 : 0.3,
                          transition: 'opacity 0.25s ease'
                        }} />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </Content>
    </Layout>
  )
}

export default StatusPage
