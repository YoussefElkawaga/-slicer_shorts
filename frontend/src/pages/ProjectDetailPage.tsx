import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Layout, 
  Card, 
  Typography, 
  Button, 
  Space, 
  Alert, 
  Spin, 
  Empty,
  message,
  Radio
} from 'antd'
import { 
  ArrowLeftOutlined, 
  PlayCircleOutlined,
  PlusOutlined
} from '@ant-design/icons'
import { useProjectStore, Project, Clip } from '../store/useProjectStore'
import { projectApi } from '../services/api'
import ClipCard from '../components/ClipCard'
import CollectionCard from '../components/CollectionCard'
import CollectionPreviewModal from '../components/CollectionPreviewModal'
import CreateCollectionModal from '../components/CreateCollectionModal'
import { useCollectionVideoDownload } from '../hooks/useCollectionVideoDownload'
import { ProjectTaskManager } from '../components/ProjectTaskManager'
// import { useWebSocket, WebSocketEventMessage } from '../hooks/useWebSocket'  // WebSocket system disabled

const { Content } = Layout
const { Title, Text } = Typography

const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { 
    currentProject, 
    loading, 
    error,
    setCurrentProject,
    updateCollection,
    addCollection,
    deleteCollection,
    removeClipFromCollection,
    reorderCollectionClips,
    addClipToCollection
  } = useProjectStore()
  
  const [statusLoading, setStatusLoading] = useState(false)
  const [showCreateCollection, setShowCreateCollection] = useState(false)
  const [sortBy, setSortBy] = useState<'time' | 'score'>('score')
  const [showCollectionDetail, setShowCollectionDetail] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState<any>(null)
  const { generateAndDownloadCollectionVideo } = useCollectionVideoDownload()

  // WebSocket connection disabled, using new simplified progress system
  // const handleWebSocketMessage = (message: WebSocketEventMessage) => {
  //   console.log('ProjectDetailPage received WebSocket message:', message)
  //   
  //   switch (message.type) {
  //     case 'task_progress_update':
  //       console.log('📊 Received task progress update:', message)
  //       // Refresh project status if message is for the current project
  //       if (message.project_id === id) {
  //         loadProject()
  //         loadProcessingStatus()
  //       }
  //       break
  //       
  //     case 'project_update':
  //       console.log('📊 Received project update:', message)
  //       // Refresh project status if message is for the current project
  //       if (message.project_id === id) {
  //         loadProject()
  //         loadProcessingStatus()
  //       }
  //       break
  //       
  //     default:
  //       console.log('Ignoring unknown WebSocket message type:', (message as any).type)
  //   }
  // }

  // const { isConnected, syncSubscriptions } = useWebSocket({
  //   userId: `project-detail-${id}`,
  //   onMessage: handleWebSocketMessage
  // })

  // WebSocket subscriptions disabled, using new simplified progress system
  // useEffect(() => {
  //   if (isConnected && id) {
  //     const desiredChannels = [`project_${id}`]
  //     console.log('ProjectDetailPage synchronizing channels:', desiredChannels)
  //     syncSubscriptions(desiredChannels)
  //   } else if (isConnected && !id) {
  //     // Clear subscriptions if no project ID
  //     console.log('ProjectDetailPage clearing subscriptions')
  //     syncSubscriptions([])
  //   }
  // }, [isConnected, id, syncSubscriptions])

  useEffect(() => {
    if (id) {
      // Only reload if currentProject is missing or ID mismatch
      if (!currentProject || currentProject.id !== id) {
        loadProject()
      }
      loadProcessingStatus()
    }
  }, [id, currentProject])

  const loadProject = async () => {
    if (!id) return
    try {
      const project = await projectApi.getProject(id)
      
      // Load clips and collections if project is completed
      if (project.status === 'completed') {
        try {
          const [clips, collections] = await Promise.all([
            projectApi.getClips(id),
            projectApi.getCollections(id)
          ])
          
          console.log('🎬 Loaded clips in ProjectDetailPage:', clips)
          console.log('📚 Loaded collections in ProjectDetailPage:', collections)
          
          const projectWithData = {
            ...project,
            clips: clips || [],
            collections: collections || []
          }
          
          console.log('🎯 Final project with data:', projectWithData)
          setCurrentProject(projectWithData)
          
          // Synchronize projects array to match Store data
          const { projects } = useProjectStore.getState()
          const updatedProjects = projects.map(p => 
            p.id === id ? projectWithData : p
          )
          useProjectStore.setState({ projects: updatedProjects })
        } catch (error) {
          console.error('Failed to load clips/collections:', error)
          // Fallback to setting basic project info if clips/collections load fails
          setCurrentProject(project)
        }
      } else {
        setCurrentProject(project)
      }
    } catch (error) {
      console.error('Failed to load project:', error)
      message.error('Failed to load project')
    }
  }

  const loadProcessingStatus = async () => {
    if (!id) return
    setStatusLoading(true)
    try {
      await projectApi.getProcessingStatus(id)
    } catch (error) {
      console.error('Failed to load processing status:', error)
    } finally {
      setStatusLoading(false)
    }
  }

  const handleStartProcessing = async () => {
    if (!id) return
    try {
      await projectApi.startProcessing(id)
      message.success('Processing started')
      loadProcessingStatus()
    } catch (error) {
      console.error('Failed to start processing:', error)
      message.error('Failed to start processing')
    }
  }

  const handleCreateCollection = async (title: string, summary: string, clipIds: string[]) => {
    if (!id) return
    try {
      await addCollection(id, {
        id: `collection_${Date.now()}`,
        collection_title: title,
        collection_summary: summary,
        clip_ids: clipIds,
        collection_type: 'manual',
        created_at: new Date().toISOString()
      })
      setShowCreateCollection(false)
      message.success('Collection created successfully')
    } catch (error) {
      console.error('Failed to create collection:', error)
      message.error('Failed to create collection')
    }
  }

  const handleViewCollection = (collection: any) => {
    setSelectedCollection(collection)
    setShowCollectionDetail(true)
  }

  const handleRemoveClipFromCollection = async (collectionId: string, clipId: string): Promise<void> => {
    if (!id) return
    try {
      await removeClipFromCollection(id, collectionId, clipId)
      message.success('Clip removed from collection')
    } catch (error) {
      console.error('Failed to remove clip from collection:', error)
      message.error('Failed to remove clip')
    }
  }

  const handleDeleteCollection = async (collectionId: string) => {
    if (!id) return
    try {
      await deleteCollection(id, collectionId)
      setShowCollectionDetail(false)
      setSelectedCollection(null)
      message.success('Collection deleted')
    } catch (error) {
      console.error('Failed to delete collection:', error)
      message.error('Failed to delete collection')
    }
  }

  const handleReorderCollectionClips = async (collectionId: string, newClipIds: string[]): Promise<void> => {
    if (!id) return
    try {
      await reorderCollectionClips(id, collectionId, newClipIds)
      message.success('Collection order updated')
    } catch (error) {
      console.error('Failed to reorder collection clips:', error)
      message.error('Failed to update collection order')
    }
  }

  const handleAddClipToCollection = async (collectionId: string, clipIds: string[]): Promise<void> => {
    if (!id) return
    try {
      await addClipToCollection(id, collectionId, clipIds)
      message.success('Clip added to collection')
    } catch (error) {
      console.error('Failed to add clip to collection:', error)
      message.error('Failed to add clip')
    }
  }

  const getSortedClips = () => {
    if (!currentProject?.clips) return []
    const clips = [...currentProject.clips]
    
    if (sortBy === 'score') {
      return clips.sort((a, b) => b.final_score - a.final_score)
    } else {
      // Sort by time - convert time string to seconds for comparison
      return clips.sort((a, b) => {
        const getTimeInSeconds = (timeStr: string) => {
          const parts = timeStr.split(':')
          const hours = parseInt(parts[0])
          const minutes = parseInt(parts[1])
          const seconds = parseFloat(parts[2].replace(',', '.'))
          return hours * 3600 + minutes * 60 + seconds
        }
        
        const aTime = getTimeInSeconds(a.start_time)
        const bTime = getTimeInSeconds(b.start_time)
        return aTime - bTime
      })
    }
  }

  if (loading) {
    return (
      <Content style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" />
      </Content>
    )
  }

  if (error || !currentProject) {
    return (
      <Content style={{ padding: '24px' }}>
        <Alert
          message="Load Failed"
          description={error || 'Project not found'}
          type="error"
          action={
            <Button size="small" onClick={() => navigate('/')}>
              Back to Home
            </Button>
          }
        />
      </Content>
    )
  }

  return (
    <Content style={{ padding: '24px' }}>
      {/* Simplified Project Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Button 
            type="link" 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/')}
            style={{ padding: 0, marginBottom: '8px' }}
          >
            Back to Projects
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            {currentProject.name}
          </Title>
        </div>
        
        <Space>
          {currentProject.status === 'pending' && (
            <Button 
              type="primary" 
              onClick={handleStartProcessing}
              loading={statusLoading}
            >
              Start Processing
            </Button>
          )}
        </Space>
      </div>

      {/* Main Content */}
      {currentProject.status === 'completed' ? (
        <div>
          {/* AI Collections Horizontal Scroll Area */}
          {currentProject.collections && currentProject.collections.length > 0 && (
            <Card style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <Title level={4} style={{ margin: 0 }}>AI Recommended Collections</Title>
                  <Text type="secondary">
                    AI has recommended {currentProject.collections.length} themed collections for you
                  </Text>
                </div>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={() => setShowCreateCollection(true)}
                  style={{
                    borderRadius: '8px',
                    background: 'linear-gradient(45deg, #1890ff, #36cfc9)',
                    border: 'none',
                    fontWeight: 500,
                    height: '40px',
                    padding: '0 20px',
                    fontSize: '14px'
                  }}
                >
                  Create Collection
                </Button>
              </div>
              
              <div 
                className="collections-scroll-container"
                style={{ 
                  display: 'flex',
                  gap: '16px',
                  overflowX: 'auto',
                  paddingBottom: '8px'
                }}
              >
                {currentProject.collections
                  .sort((a, b) => {
                    // Sort by creation time descending, newest first
                    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
                    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
                    return timeB - timeA
                  })
                  .map((collection) => (
                  <CollectionCard
                    key={collection.id}
                    collection={collection}
                    clips={currentProject.clips || []}
                    onView={handleViewCollection}
                    onUpdate={(collectionId, updates) => 
                      updateCollection(currentProject.id, collectionId, updates)
                    }
                    onGenerateVideo={async (collectionId) => {
                      const collection = currentProject.collections?.find(c => c.id === collectionId)
                      if (collection) {
                        await generateAndDownloadCollectionVideo(
                          currentProject.id, 
                          collectionId, 
                          collection.collection_title
                        )
                      }
                    }}
                    onDelete={handleDeleteCollection}
                  />
                ))}
              </div>
            </Card>
          )}
          
          {/* Video Clips Area */}
          <Card 
            style={{
              borderRadius: '16px',
              border: '1px solid #303030',
              background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <Title level={4} style={{ margin: 0, color: '#ffffff', fontWeight: 600 }}>Video Clips</Title>
                <Text type="secondary" style={{ color: '#b0b0b0', fontSize: '14px' }}>
                  AI has generated {currentProject.clips?.length || 0} highlights for you
                </Text>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Sorting Controls - Dark Theme Optimized */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Text style={{ fontSize: '13px', color: '#b0b0b0', fontWeight: 500 }}>Sort</Text>
                  <Radio.Group
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    size="small"
                    buttonStyle="solid"
                    style={{
                      ['--ant-radio-button-bg' as string]: 'transparent',
                      ['--ant-radio-button-checked-bg' as string]: '#1890ff',
                      ['--ant-radio-button-color' as string]: '#b0b0b0',
                      ['--ant-radio-button-checked-color' as string]: '#ffffff'
                    }}
                  >
                    <Radio.Button 
                       value="time" 
                       style={{ 
                         fontSize: '13px',
                         height: '32px',
                         lineHeight: '30px',
                         padding: '0 16px',
                         background: sortBy === 'time' ? 'linear-gradient(45deg, #1890ff, #36cfc9)' : 'rgba(255,255,255,0.08)',
                         border: sortBy === 'time' ? '1px solid #1890ff' : '1px solid #404040',
                         color: sortBy === 'time' ? '#ffffff' : '#b0b0b0',
                         borderRadius: '6px 0 0 6px',
                         fontWeight: sortBy === 'time' ? 600 : 400,
                         boxShadow: sortBy === 'time' ? '0 2px 8px rgba(24, 144, 255, 0.3)' : 'none',
                         transition: 'all 0.2s ease'
                       }}
                     >
                       Time
                     </Radio.Button>
                     <Radio.Button 
                       value="score" 
                       style={{ 
                         fontSize: '13px',
                         height: '32px',
                         lineHeight: '30px',
                         padding: '0 16px',
                         background: sortBy === 'score' ? 'linear-gradient(45deg, #1890ff, #36cfc9)' : 'rgba(255,255,255,0.08)',
                         border: sortBy === 'score' ? '1px solid #1890ff' : '1px solid #404040',
                         borderLeft: 'none',
                         color: sortBy === 'score' ? '#ffffff' : '#b0b0b0',
                         borderRadius: '0 6px 6px 0',
                         fontWeight: sortBy === 'score' ? 600 : 400,
                         boxShadow: sortBy === 'score' ? '0 2px 8px rgba(24, 144, 255, 0.3)' : 'none',
                         transition: 'all 0.2s ease'
                       }}
                     >
                       Score
                     </Radio.Button>
                  </Radio.Group>
                </div>
                
                <Space>
                  {(!currentProject.collections || currentProject.collections.length === 0) && (
                    <Button 
                      type="primary" 
                      icon={<PlusOutlined />}
                      onClick={() => setShowCreateCollection(true)}
                      style={{
                        borderRadius: '8px',
                        background: 'linear-gradient(45deg, #1890ff, #36cfc9)',
                        border: 'none',
                        fontWeight: 500,
                        height: '40px',
                        padding: '0 20px',
                        fontSize: '14px'
                      }}
                    >
                      Create Collection
                    </Button>
                  )}
                </Space>
              </div>
            </div>
            
            {currentProject.clips && currentProject.clips.length > 0 ? (
              <div 
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '20px',
                  padding: '8px 0'
                }}
              >
                {getSortedClips().map((clip) => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                    projectId={currentProject.id}
                    videoUrl={projectApi.getClipVideoUrl(currentProject.id, clip.id, clip.title || clip.generated_title)}
                    onDownload={(clipId) => projectApi.downloadVideo(currentProject.id, clipId)}
                    onClipUpdate={(clipId: string, updates: Partial<Clip>) => {
                      // Update local state
                      if (currentProject) {
                        const updatedProject = {
                          ...currentProject,
                          clips: currentProject.clips?.map((c: Clip) => 
                            c.id === clipId ? { ...c, ...updates } : c
                          ) || []
                        }
                        setCurrentProject(updatedProject)
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <div style={{ 
                padding: '60px 0',
                textAlign: 'center',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '12px',
                border: '1px dashed #404040'
              }}>
                <Empty 
                  description={
                    <Text style={{ color: '#888', fontSize: '14px' }}>No video clips yet</Text>
                  }
                  image={<PlayCircleOutlined style={{ fontSize: '48px', color: '#555' }} />}
                />
              </div>
            )}
          </Card>
        </div>
      ) : (
        <div>
          {/* Task Management Component */}
          <ProjectTaskManager 
            projectId={currentProject.id} 
            projectName={currentProject.name}
          />
          
          {/* Project Status Note */}
          <Card style={{ marginTop: '16px' }}>
            <Empty 
              image={<PlayCircleOutlined style={{ fontSize: '64px', color: '#d9d9d9' }} />}
              description={
                <div>
                  <Text>Project is still processing</Text>
                  <br />
                  <Text type="secondary">Video clips and AI collections will be available after processing completes</Text>
                </div>
              }
            />
          </Card>
        </div>
      )}

      {/* Create Collection Modal */}
      <CreateCollectionModal
        visible={showCreateCollection}
        clips={currentProject.clips || []}
        onCancel={() => setShowCreateCollection(false)}
        onCreate={handleCreateCollection}
      />
      
      {/* Collection Preview Modal */}
      <CollectionPreviewModal
        visible={showCollectionDetail}
        collection={selectedCollection}
        clips={currentProject.clips || []}
        projectId={currentProject.id}
        onClose={() => {
          setShowCollectionDetail(false)
          setSelectedCollection(null)
        }}
        onUpdateCollection={(collectionId, updates) => 
          updateCollection(currentProject.id, collectionId, updates)
        }
        onRemoveClip={handleRemoveClipFromCollection}
        onReorderClips={handleReorderCollectionClips}
        onDelete={handleDeleteCollection}
        onAddClip={handleAddClipToCollection}
      />

    </Content>
  )
}

export default ProjectDetailPage