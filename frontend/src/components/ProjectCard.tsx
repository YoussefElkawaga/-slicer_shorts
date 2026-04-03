import React, { useState, useEffect } from 'react'
import { Card, Tag, Button, Space, Typography, Progress, Popconfirm, message, Tooltip } from 'antd'
import { PlayCircleOutlined, DeleteOutlined, EyeOutlined, DownloadOutlined, ReloadOutlined, LoadingOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { Project } from '../store/useProjectStore'
import { projectApi } from '../services/api'
import { UnifiedStatusBar } from './UnifiedStatusBar'
// import { 
//   getProjectStatusConfig, 
//   calculateProjectProgress, 
//   normalizeProjectStatus,
//   getProgressStatus 
// } from '../utils/statusUtils'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import 'dayjs/locale/en'

dayjs.extend(relativeTime)
dayjs.extend(timezone)
dayjs.extend(utc)
dayjs.locale('en')

// Add CSS animation styles
const pulseAnimation = `
  @keyframes pulse {
    0% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.1);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }
`

// Inject styles into the page
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = pulseAnimation
  document.head.appendChild(style)
}

const { Text, Title } = Typography
const { Meta } = Card

interface ProjectCardProps {
  project: Project
  onDelete: (id: string) => void
  onRetry?: (id: string) => void
  onClick?: () => void
}

interface LogEntry {
  timestamp: string
  module: string
  level: string
  message: string
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onDelete, onRetry, onClick }) => {
  const navigate = useNavigate()
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null)
  const [thumbnailLoading, setThumbnailLoading] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [currentLogIndex, setCurrentLogIndex] = useState(0)

  // Get category information
  const getCategoryInfo = (category?: string) => {
    const categoryMap: Record<string, { name: string; icon: string; color: string }> = {
      'default': { name: 'Default', icon: '🎬', color: '#4facfe' },
      'knowledge': { name: 'Knowledge', icon: '📚', color: '#52c41a' },
      'business': { name: 'Business', icon: '💼', color: '#faad14' },
      'opinion': { name: 'Opinion', icon: '💭', color: '#722ed1' },
      'experience': { name: 'Experience', icon: '🌟', color: '#13c2c2' },
      'speech': { name: 'Speech', icon: '🎙️', color: '#eb2f96' },
      'content_review': { name: 'Commentary', icon: '🎭', color: '#f5222d' },
      'entertainment': { name: 'Entertainment', icon: '🎪', color: '#fa8c16' }
    }
    return categoryMap[category || 'default'] || categoryMap['default']
  }

  // Thumbnail cache management
  const thumbnailCacheKey = `thumbnail_${project.id}`
  
  // Generate project video thumbnail (with caching)
  useEffect(() => {
    const generateThumbnail = async () => {
      // Prefer backend-provided thumbnail
      if (project.thumbnail) {
        setVideoThumbnail(project.thumbnail)
        console.log(`Using backend thumbnail: ${project.id}`)
        return
      }
      
      if (!project.video_path) {
        console.log('Project has no video path:', project.id)
        return
      }
      
      // Check cache
      const cachedThumbnail = localStorage.getItem(thumbnailCacheKey)
      if (cachedThumbnail) {
        setVideoThumbnail(cachedThumbnail)
        return
      }
      
      setThumbnailLoading(true)
      
      try {
        const video = document.createElement('video')
        video.crossOrigin = 'anonymous'
        video.muted = true
        video.preload = 'metadata'
        
        // Try multiple possible video file paths
        const possiblePaths = [
          'input/input.mp4',
          'input.mp4',
          project.video_path,
          `${project.video_path}/input.mp4`
        ].filter(Boolean)
        
        let videoLoaded = false
        
        for (const path of possiblePaths) {
          if (videoLoaded) break
          
          try {
            const videoUrl = projectApi.getProjectFileUrl(project.id, path)
            console.log('Trying to load video:', videoUrl)
            
            await new Promise((resolve, reject) => {
              const timeoutId = setTimeout(() => {
                reject(new Error('Video loading timeout'))
              }, 10000) // 10s timeout
              
              video.onloadedmetadata = () => {
                clearTimeout(timeoutId)
                console.log('Video metadata loaded:', videoUrl)
                video.currentTime = Math.min(5, video.duration / 4) // Capture frame at 1/4 or 5s
              }
              
              video.onseeked = () => {
                clearTimeout(timeoutId)
                try {
                  const canvas = document.createElement('canvas')
                  const ctx = canvas.getContext('2d')
                  if (!ctx) {
                    reject(new Error('Unable to get canvas context'))
                    return
                  }
                  
                  // Set appropriate thumbnail dimensions
                  const maxWidth = 320
                  const maxHeight = 180
                  const aspectRatio = video.videoWidth / video.videoHeight
                  
                  let width = maxWidth
                  let height = maxHeight
                  
                  if (aspectRatio > maxWidth / maxHeight) {
                    height = maxWidth / aspectRatio
                  } else {
                    width = maxHeight * aspectRatio
                  }
                  
                  canvas.width = width
                  canvas.height = height
                  ctx.drawImage(video, 0, 0, width, height)
                  
                  const thumbnail = canvas.toDataURL('image/jpeg', 0.7)
                  setVideoThumbnail(thumbnail)
                  
                  // Cache thumbnail
                  try {
                    localStorage.setItem(thumbnailCacheKey, thumbnail)
                  } catch (e) {
                    // If localStorage is full, clear old cache
                    const keys = Object.keys(localStorage).filter(key => key.startsWith('thumbnail_'))
                    if (keys.length > 50) { // Keep at most 50 thumbnail caches
                      keys.slice(0, 10).forEach(key => localStorage.removeItem(key))
                      localStorage.setItem(thumbnailCacheKey, thumbnail)
                    }
                  }
                  
                  videoLoaded = true
                  resolve(thumbnail)
                } catch (error) {
                  reject(error)
                }
              }
              
              video.onerror = (error) => {
                clearTimeout(timeoutId)
                console.error('Video loading failed:', videoUrl, error)
                reject(error)
              }
              
              video.src = videoUrl
            })
            
            break // If successful, exit loop
          } catch (error) {
            console.warn(`Path ${path} loading failed:`, error)
            continue // Try next path
          }
        }
        
        if (!videoLoaded) {
          console.error('All video paths failed to load')
        }
      } catch (error) {
        console.error('Error generating thumbnail:', error)
      } finally {
        setThumbnailLoading(false)
      }
    }
    
    generateThumbnail()
  }, [project.id, project.video_path, thumbnailCacheKey])

  // Fetch project logs (only when processing)
  useEffect(() => {
    if (project.status !== 'processing') {
      setLogs([])
      return
    }

    const fetchLogs = async () => {
      try {
        const response = await projectApi.getProjectLogs(project.id, 20)
        setLogs(response.logs.filter(log => 
          log.message.includes('Step') || 
          log.message.includes('Start') || 
          log.message.includes('Complete') ||
          log.message.includes('Processing') ||
          log.level === 'ERROR'
        ))
      } catch (error) {
        console.error('Failed to fetch logs:', error)
      }
    }

    // Fetch immediately
    fetchLogs()
    
    // Update logs every 3 seconds
    const logInterval = setInterval(fetchLogs, 3000)
    
    return () => clearInterval(logInterval)
  }, [project.id, project.status])

  // Log carousel
  useEffect(() => {
    if (logs.length <= 1) return
    
    const interval = setInterval(() => {
      setCurrentLogIndex(prev => (prev + 1) % logs.length)
    }, 2000) // Switch log every 2 seconds
    
    return () => clearInterval(interval)
  }, [logs.length])

  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'completed': return 'success'
      case 'processing': return 'processing'
      case 'error': return 'error'
      default: return 'default'
    }
  }

  // Check if pending status - pending shows as importing
  const isImporting = project.status === 'pending'
  
  // Status normalization - pending shows as importing
  const normalizedStatus = project.status === 'error' ? 'failed' : 
                          isImporting ? 'importing' : project.status
  
  // Debug info
  console.log('ProjectCard Debug:', {
    projectId: project.id,
    projectStatus: project.status,
    isImporting,
    normalizedStatus,
    processingConfig: project.processing_config
  })
  
  // Calculate progress percentage
  const progressPercent = project.status === 'completed' ? 100 : 
                         project.status === 'failed' ? 0 :
                         isImporting ? 20 : // Show 20% progress when importing
                         project.current_step && project.total_steps ? 
                         Math.round((project.current_step / project.total_steps) * 100) : 
                         project.status === 'processing' ? 10 : 0

  const handleRetry = async () => {
    if (isRetrying) return
    
    setIsRetrying(true)
    try {
      // For PENDING projects, use startProcessing; for others, use retryProcessing
      if (project.status === 'pending') {
        await projectApi.startProcessing(project.id)
      } else {
        await projectApi.retryProcessing(project.id)
      }
      // Remove duplicate toast display, let parent component handle it
      if (onRetry) {
        onRetry(project.id)
      }
    } catch (error) {
      console.error('Retry failed:', error)
      message.error('Retry failed, please try again later')
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <Card
      hoverable
      className="project-card"
      style={{ 
        width: 200, 
        height: 240,
        borderRadius: '4px',
        overflow: 'hidden',
        background: 'linear-gradient(145deg, #1e1e1e 0%, #2a2a2a 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        marginBottom: '0px'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.4)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)'
      }}
      bodyStyle={{
        padding: '12px',
        background: 'transparent',
        height: 'calc(100% - 120px)',
        display: 'flex',
        flexDirection: 'column'
      }}
      cover={
        <div 
          style={{ 
            height: 120, 
            position: 'relative',
            background: videoThumbnail 
              ? `url(${videoThumbnail}) center/cover` 
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
          onClick={() => {
            // Projects in importing status cannot navigate to detail page
            if (project.status === 'pending') {
              message.warning('Project is still importing, please wait')
              return
            }
            
            if (onClick) {
              onClick()
            } else {
              navigate(`/project/${project.id}`)
            }
          }}
        >
          {/* Thumbnail loading state */}
          {thumbnailLoading && (
            <div style={{ 
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 0.8)'
            }}>
              <LoadingOutlined 
                style={{ 
                  fontSize: '24px', 
                  marginBottom: '4px'
                }} 
              />
              <div style={{ 
                fontSize: '12px',
                fontWeight: 500
              }}>
                Loading cover...
              </div>
            </div>
          )}
          
          {/* Default display when no thumbnail */}
          {!videoThumbnail && !thumbnailLoading && (
            <div style={{ textAlign: 'center' }}>
              <PlayCircleOutlined 
                style={{ 
                  fontSize: '40px', 
                  color: 'rgba(255, 255, 255, 0.9)',
                  marginBottom: '4px',
                  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))'
                }} 
              />
              <div style={{ 
                color: 'rgba(255, 255, 255, 0.8)', 
                fontSize: '12px',
                fontWeight: 500
              }}>
                Click to preview
              </div>
            </div>
          )}
          
          {/* Category tag - top left */}
          {project.video_category && project.video_category !== 'default' && (
            <div style={{
              position: 'absolute',
              top: '8px',
              left: '8px'
            }}>
              <Tag
                style={{
                  background: `${getCategoryInfo(project.video_category).color}15`,
                  border: `1px solid ${getCategoryInfo(project.video_category).color}40`,
                  borderRadius: '3px',
                  color: getCategoryInfo(project.video_category).color,
                  fontSize: '10px',
                  fontWeight: 500,
                  padding: '2px 6px',
                  lineHeight: '14px',
                  height: '18px',
                  margin: 0
                }}
              >
                <span style={{ marginRight: '2px' }}>{getCategoryInfo(project.video_category).icon}</span>
                {getCategoryInfo(project.video_category).name}
              </Tag>
            </div>
          )}
          
          {/* Removed top-right status indicator - poor readability and redundant */}
          
          {/* Timestamp and action buttons - moved to cover bottom */}
          <div style={{
            position: 'absolute',
            bottom: '0',
            left: '0',
            right: '0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(10px)',
            borderRadius: '0',
            padding: '6px 8px',
            height: '28px'
          }}>
            <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)' }}>
              {dayjs(project.created_at).fromNow()}
            </Text>
            
            {/* Action buttons */}
            <div 
              className="card-action-buttons"
              style={{
                display: 'flex',
                gap: '4px',
                opacity: 0,
                transition: 'opacity 0.3s ease'
              }}
            >
              {/* Failed status: show only retry and delete buttons */}
              {normalizedStatus === 'failed' ? (
                <>
                  <Button
                    type="text"
                    icon={<ReloadOutlined />}
                    loading={isRetrying}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRetry()
                    }}
                    style={{
                      height: '20px',
                      width: '20px',
                      borderRadius: '3px',
                      color: '#52c41a',
                      border: '1px solid rgba(82, 196, 26, 0.5)',
                      background: 'rgba(82, 196, 26, 0.1)',
                      padding: 0,
                      minWidth: '20px',
                      fontSize: '10px'
                    }}
                  />
                  
                  <Popconfirm
                    title="Delete this project?"
                    description="This action cannot be undone"
                    onConfirm={(e) => {
                      e?.stopPropagation()
                      onDelete(project.id)
                    }}
                    onCancel={(e) => {
                      e?.stopPropagation()
                    }}
                    okText="Delete"
                    cancelText="Cancel"
                  >
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                      style={{
                        height: '20px',
                        width: '20px',
                        borderRadius: '3px',
                        color: '#ff6b6b',
                        border: '1px solid rgba(255, 107, 107, 0.5)',
                        background: 'rgba(255, 107, 107, 0.1)',
                        padding: 0,
                        minWidth: '20px',
                        fontSize: '10px'
                      }}
                    />
                  </Popconfirm>
                </>
              ) : (
                /* Other status: show download, retry and delete buttons */
                <>
                  <Space size={4}>
                    {/* Retry button - shown during processing and pending, allows resubmitting tasks */}
                    {(normalizedStatus === 'processing' || normalizedStatus === 'importing' || project.status === 'pending') && (
                      <Tooltip title={project.status === 'pending' ? "Start processing" : "Resubmit task"}>
                        <Button
                          type="text"
                          icon={<ReloadOutlined />}
                          loading={isRetrying}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRetry()
                          }}
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '3px',
                            color: '#1890ff',
                            border: '1px solid rgba(24, 144, 255, 0.5)',
                            background: 'rgba(24, 144, 255, 0.1)',
                            padding: 0,
                            minWidth: '20px',
                            fontSize: '10px'
                          }}
                        />
                      </Tooltip>
                    )}
                    
                    {/* Download button - only shown when completed */}
                    {normalizedStatus === 'completed' && (
                      <Button
                        type="text"
                        icon={<DownloadOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                          // Implement download feature
                          message.info('Download feature coming soon...')
                        }}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '3px',
                          color: 'rgba(255, 255, 255, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          background: 'rgba(255, 255, 255, 0.1)',
                          padding: 0,
                          minWidth: '20px',
                          fontSize: '10px'
                        }}
                      />
                    )}
                    
                    {/* Delete button */}
                    <Popconfirm
                      title="Delete this project?"
                      description="This action cannot be undone"
                      onConfirm={(e) => {
                        e?.stopPropagation()
                        onDelete(project.id)
                      }}
                      onCancel={(e) => {
                        e?.stopPropagation()
                      }}
                      okText="Delete"
                      cancelText="Cancel"
                    >
                      <Button
                        type="text"
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                        }}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '3px',
                          color: 'rgba(255, 255, 255, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          background: 'rgba(255, 255, 255, 0.1)',
                          padding: 0,
                          minWidth: '20px',
                          fontSize: '10px'
                        }}
                      />
                    </Popconfirm>
                  </Space>
                 </>
               )}
            </div>
          </div>
        </div>
      }
    >
      <div style={{ padding: '0', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {/* Project name - always at top */}
          <div style={{ marginBottom: '12px', position: 'relative' }}>
            <Tooltip title={project.name} placement="top">
              <Text 
                strong 
                style={{ 
                  fontSize: '13px', 
                  color: '#ffffff',
                  fontWeight: 600,
                  lineHeight: '16px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  cursor: 'help',
                  height: '32px'
                }}
              >
                {project.name}
              </Text>
            </Tooltip>
          </div>
          
          {/* Status and statistics info */}
          {(normalizedStatus === 'importing' || normalizedStatus === 'processing' || normalizedStatus === 'failed') ? (
            // Importing, processing, failed: show only status block, centered
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center',
              marginBottom: '12px'
            }}>
              <div style={{ width: '100%', maxWidth: '200px' }}>
                <UnifiedStatusBar
                  projectId={project.id}
                  status={normalizedStatus}
                  downloadProgress={progressPercent}
                  onStatusChange={(newStatus) => {
                    console.log(`Project ${project.id} status changed: ${normalizedStatus} -> ${newStatus}`)
                  }}
                  onDownloadProgressUpdate={(progress) => {
                    console.log(`Project ${project.id} download progress: ${progress}%`)
                  }}
                />
              </div>
            </div>
          ) : (
            // Other status: show status block + clips count + collections count
            <div style={{ 
              display: 'flex', 
              gap: '6px',
              marginBottom: '12px'
            }}>
              {/* Status display - takes more space */}
              <div style={{ flex: 2 }}>
                <UnifiedStatusBar
                  projectId={project.id}
                  status={normalizedStatus}
                  downloadProgress={progressPercent}
                  onStatusChange={(newStatus) => {
                    console.log(`Project ${project.id} status changed: ${normalizedStatus} -> ${newStatus}`)
                  }}
                  onDownloadProgressUpdate={(progress) => {
                    console.log(`Project ${project.id} download progress: ${progress}%`)
                  }}
                />
              </div>
              
              {/* Clip count - reduced width */}
              <div style={{
                background: 'rgba(102, 126, 234, 0.15)',
                border: '1px solid rgba(102, 126, 234, 0.3)',
                borderRadius: '3px',
                padding: '3px 4px',
                textAlign: 'center',
                minWidth: '50px',
                flex: 0.8
              }}>
                <div style={{ color: '#667eea', fontSize: '11px', fontWeight: 600, lineHeight: '12px' }}>
                  {project.total_clips || 0}
                </div>
                <div style={{ color: '#999999', fontSize: '8px', lineHeight: '9px' }}>
                  Clips
                </div>
              </div>
              
              {/* Collection count - reduced width */}
              <div style={{
                background: 'rgba(118, 75, 162, 0.15)',
                border: '1px solid rgba(118, 75, 162, 0.3)',
                borderRadius: '3px',
                padding: '3px 4px',
                textAlign: 'center',
                minWidth: '50px',
                flex: 0.8
              }}>
                <div style={{ color: '#764ba2', fontSize: '11px', fontWeight: 600, lineHeight: '12px' }}>
                  {project.total_collections || 0}
                </div>
                <div style={{ color: '#999999', fontSize: '8px', lineHeight: '9px' }}>
                  Collections
                </div>
              </div>
            </div>
          )}

          {/* Detailed progress display hidden - only show percentage in status block */}

        </div>
      </div>
    </Card>
  )
}

export default ProjectCard