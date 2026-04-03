import React, { useState, useRef, useCallback } from 'react'
import { Card, Button, Space, Typography, message, Modal } from 'antd'
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined,
  DeleteOutlined,
  UndoOutlined,
  RedoOutlined,
  SaveOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  LinkOutlined,
  ReloadOutlined,
  HighlightOutlined
} from '@ant-design/icons'
import ReactPlayer from 'react-player'
import { SubtitleSegment, VideoEditOperation } from '../types/subtitle'

const { Text } = Typography

interface SubtitleEditorProps {
  videoUrl: string
  subtitles: SubtitleSegment[]
  onSave: (operations: VideoEditOperation[]) => void
  onClose: () => void
}

interface SubtitleEditorState {
  currentTime: number
  playing: boolean
  selectedWords: Set<string>
  deletedSegments: Set<string>
  editHistory: VideoEditOperation[]
  historyIndex: number
  showDeleted: boolean
  contextMenu: {
    visible: boolean
    x: number
    y: number
    segmentId: string | null
  }
}

const SubtitleEditor: React.FC<SubtitleEditorProps> = ({
  videoUrl,
  subtitles,
  onSave,
  onClose
}) => {
  console.log('SubtitleEditor rendered with:', { videoUrl, subtitlesCount: subtitles.length })
  
  const [state, setState] = useState<SubtitleEditorState>({
    currentTime: 0,
    playing: false,
    selectedWords: new Set(),
    deletedSegments: new Set(),
    editHistory: [],
    historyIndex: -1,
    showDeleted: false,
    contextMenu: {
      visible: false,
      x: 0,
      y: 0,
      segmentId: null
    }
  })

  const playerRef = useRef<ReactPlayer>(null)


  // Handle playback progress update
  const handleProgress = useCallback((progress: { playedSeconds: number }) => {
    setState(prev => ({ ...prev, currentTime: progress.playedSeconds }))
  }, [])

  // Handle playback state change
  const handlePlayPause = useCallback(() => {
    setState(prev => ({ ...prev, playing: !prev.playing }))
  }, [])

  // Seek to specific time
  const seekTo = useCallback((time: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(time)
    }
  }, [])

  // Select word
  const selectWord = useCallback((wordId: string, addToSelection: boolean = false) => {
    setState(prev => {
      const newSelectedWords = addToSelection 
        ? new Set([...prev.selectedWords, wordId])
        : new Set([wordId])
      return { ...prev, selectedWords: newSelectedWords }
    })
  }, [])

  // Delete selected subtitle segments
  const deleteSelectedSegments = useCallback(() => {
    setState(prev => {
      const selectedSegmentIds = new Set<string>()
      
      // Find corresponding subtitle segments based on selected words
      prev.selectedWords.forEach(wordId => {
        const segment = subtitles.find(seg => 
          seg.words.some(word => word.id === wordId)
        )
        if (segment) {
          selectedSegmentIds.add(segment.id)
        }
      })

      if (selectedSegmentIds.size === 0) {
        message.warning('Please select subtitle content to delete first')
        return prev
      }

      const newDeletedSegments = new Set([...prev.deletedSegments, ...selectedSegmentIds])
      const operation: VideoEditOperation = {
        type: 'delete',
        segmentIds: Array.from(selectedSegmentIds),
        timestamp: Date.now()
      }

      const newHistory = [...prev.editHistory.slice(0, prev.historyIndex + 1), operation]

      return {
        ...prev,
        deletedSegments: newDeletedSegments,
        selectedWords: new Set(),
        editHistory: newHistory,
        historyIndex: prev.historyIndex + 1
      }
    })
  }, [subtitles])

  // Delete specific subtitle segment
  const deleteSegment = useCallback((segmentId: string) => {
    setState(prev => {
      const newDeletedSegments = new Set([...prev.deletedSegments, segmentId])
      const operation: VideoEditOperation = {
        type: 'delete',
        segmentIds: [segmentId],
        timestamp: Date.now()
      }

      const newHistory = [...prev.editHistory.slice(0, prev.historyIndex + 1), operation]

      return {
        ...prev,
        deletedSegments: newDeletedSegments,
        editHistory: newHistory,
        historyIndex: prev.historyIndex + 1,
        contextMenu: { ...prev.contextMenu, visible: false }
      }
    })
  }, [])

  // Undo operation
  const undo = useCallback(() => {
    setState(prev => {
      if (prev.historyIndex < 0) return prev

      const operation = prev.editHistory[prev.historyIndex]
      const newDeletedSegments = new Set(prev.deletedSegments)
      
      if (operation.type === 'delete') {
        operation.segmentIds.forEach(id => newDeletedSegments.delete(id))
      }

      return {
        ...prev,
        deletedSegments: newDeletedSegments,
        historyIndex: prev.historyIndex - 1
      }
    })
  }, [])

  // Redo operation
  const redo = useCallback(() => {
    setState(prev => {
      if (prev.historyIndex >= prev.editHistory.length - 1) return prev

      const operation = prev.editHistory[prev.historyIndex + 1]
      const newDeletedSegments = new Set(prev.deletedSegments)
      
      if (operation.type === 'delete') {
        operation.segmentIds.forEach(id => newDeletedSegments.add(id))
      }

      return {
        ...prev,
        deletedSegments: newDeletedSegments,
        historyIndex: prev.historyIndex + 1
      }
    })
  }, [])

  // Save edit result
  const handleSave = useCallback(() => {
    const operations = state.editHistory.slice(0, state.historyIndex + 1)
    onSave(operations)
    message.success('Edits saved')
  }, [state.editHistory, state.historyIndex, onSave])

  // Handle context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, segmentId: string) => {
    e.preventDefault()
    setState(prev => ({
      ...prev,
      contextMenu: {
        visible: true,
        x: e.clientX,
        y: e.clientY,
        segmentId
      }
    }))
  }, [])

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setState(prev => ({
      ...prev,
      contextMenu: { ...prev.contextMenu, visible: false }
    }))
  }, [])


  // Add global click event listener
  React.useEffect(() => {
    const handleClick = () => {
      if (state.contextMenu.visible) {
        closeContextMenu()
      }
    }

    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
    }
  }, [state.contextMenu.visible, closeContextMenu])

  // Render subtitle segment
  const renderSubtitleSegment = (segment: SubtitleSegment) => {
    const isDeleted = state.deletedSegments.has(segment.id)
    const isCurrent = state.currentTime >= segment.startTime && state.currentTime <= segment.endTime
    const duration = segment.endTime - segment.startTime

    if (isDeleted && !state.showDeleted) return null

    return (
      <div
        key={segment.id}
        className={`subtitle-segment ${isCurrent ? 'current' : ''} ${isDeleted ? 'deleted' : ''}`}
        style={{
          padding: '12px',
          margin: '8px 0',
          borderRadius: '8px',
          backgroundColor: isCurrent ? '#1890ff20' : '#1a1a1a',
          border: isDeleted ? '1px dashed #ff4d4f' : '1px solid #2d2d2d',
          opacity: isDeleted ? 0.6 : 1,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          position: 'relative'
        }}
        onClick={() => seekTo(segment.startTime)}
        onContextMenu={(e) => handleContextMenu(e, segment.id)}
      >
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
          </div>
          <div style={{ fontSize: '12px', color: '#888', fontWeight: '500' }}>
            {duration.toFixed(2)}s
          </div>
        </div>
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '4px',
          lineHeight: '1.5'
        }}>
          {segment.words.map(word => (
            <span
              key={word.id}
              className={`subtitle-word ${state.selectedWords.has(word.id) ? 'selected' : ''}`}
              style={{
                padding: '4px 6px',
                borderRadius: '4px',
                backgroundColor: state.selectedWords.has(word.id) ? '#1890ff' : 'transparent',
                color: state.selectedWords.has(word.id) ? 'white' : '#ffffff',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'all 0.2s ease'
              }}
              onClick={(e) => {
                e.stopPropagation()
                selectWord(word.id, e.ctrlKey || e.metaKey)
              }}
            >
              {word.text}
            </span>
          ))}
        </div>
      </div>
    )
  }

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
  }

  // Context menu items
  const contextMenuItems = [
    {
      key: 'associate',
      icon: <LinkOutlined />,
      label: 'Link Media',
      onClick: () => {
        message.info('Link Media feature in development')
        closeContextMenu()
      }
    },
    {
      key: 'reset',
      icon: <ReloadOutlined />,
      label: 'Reset',
      onClick: () => {
        message.info('Reset feature in development')
        closeContextMenu()
      }
    },
    {
      key: 'hide',
      icon: <EyeInvisibleOutlined />,
      label: 'Hide Subtitle',
      onClick: () => {
        message.info('Hide Subtitle feature in development')
        closeContextMenu()
      }
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: 'Delete Segment',
      onClick: () => {
        if (state.contextMenu.segmentId) {
          deleteSegment(state.contextMenu.segmentId)
        }
      }
    },
    {
      key: 'highlight',
      icon: <HighlightOutlined />,
      label: 'Highlight',
      onClick: () => {
        message.info('Highlight feature in development')
        closeContextMenu()
      }
    }
  ]

  return (
    <Modal
      title="Subtitle Editor"
      open={true}
      onCancel={onClose}
      width={1400}
      footer={null}
      destroyOnClose
      style={{ top: 20 }}
    >
      <div style={{ display: 'flex', height: '700px', gap: '16px' }}>
        {/* Left Subtitle List */}
        <div style={{ width: '300px', display: 'flex', flexDirection: 'column' }}>
          <Card 
            title="Subtitles" 
            size="small"
            style={{ height: '100%' }}
            bodyStyle={{ padding: '12px', height: 'calc(100% - 57px)', overflow: 'hidden' }}
          >
            <div style={{ 
              height: '100%', 
              overflowY: 'auto',
              paddingRight: '8px'
            }}>
              {subtitles.length > 0 ? (
                subtitles.map(renderSubtitleSegment)
              ) : (
                <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                  No subtitle data
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Middle Style Selection Area */}
        <div style={{ width: '250px', display: 'flex', flexDirection: 'column' }}>
          <Card 
            title="Style" 
            size="small"
            style={{ height: '100%' }}
            bodyStyle={{ padding: '12px', height: 'calc(100% - 57px)', overflow: 'hidden' }}
          >
            <div style={{ 
              height: '100%', 
              overflowY: 'auto',
              paddingRight: '8px'
            }}>
              {/* Style Template */}
              <div style={{ marginBottom: '16px' }}>
                <Text style={{ color: '#999', fontSize: '12px', marginBottom: '8px', display: 'block' }}>
                  Subtitle Style
                </Text>
                <div 
                  className="style-template"
                  style={{
                    padding: '12px',
                    margin: '8px 0',
                    borderRadius: '8px',
                    backgroundColor: '#2d2d2d',
                    border: '1px solid #404040',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)'
                    e.currentTarget.style.borderColor = '#4facfe'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.borderColor = '#404040'
                  }}
                >
                  <div style={{ color: '#ffffff', fontSize: '14px', marginBottom: '4px', fontWeight: '500' }}>
                    Default Text
                  </div>
                  <div style={{ color: '#666', fontSize: '12px' }}>
                    00:11.400 - 00:16.400
                  </div>
                </div>
                <div 
                  className="style-template"
                  style={{
                    padding: '12px',
                    margin: '8px 0',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #ff6b9d 0%, #4facfe 100%)',
                    border: '1px solid #404040',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
                    e.currentTarget.style.boxShadow = '0 12px 32px rgba(255, 107, 157, 0.3)'
                    e.currentTarget.style.borderColor = '#ff6b9d'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)'
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.borderColor = '#404040'
                  }}
                >
                  <div style={{ color: '#ffffff', fontSize: '14px', marginBottom: '4px', fontWeight: '500' }}>
                    Gradient Text
                  </div>
                  <div style={{ color: '#ffffff', fontSize: '12px', opacity: 0.8 }}>
                    00:11.400 - 00:22.430
                  </div>
                </div>
              </div>

              {/* Create Project Button */}
              <div style={{ marginBottom: '16px' }}>
                <Button 
                  type="primary" 
                  size="large"
                  className="create-project-btn"
                  style={{ 
                    width: '100%', 
                    height: '48px',
                    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
                    e.currentTarget.style.boxShadow = '0 12px 32px rgba(79, 172, 254, 0.4)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  Create Project
                </Button>
                <div style={{ color: '#666', fontSize: '12px', textAlign: 'center', marginTop: '4px' }}>
                  00:24.170 - 00:25.855
                </div>
              </div>

              {/* Edit Toolbar */}
              <div style={{ marginBottom: '16px' }}>
                <Text style={{ color: '#999', fontSize: '12px', marginBottom: '8px', display: 'block' }}>
                  Edit Tools
                </Text>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button 
                    icon={<DeleteOutlined />}
                    danger
                    size="small"
                    onClick={deleteSelectedSegments}
                    disabled={state.selectedWords.size === 0}
                    style={{ width: '100%' }}
                  >
                    Delete Selected ({state.selectedWords.size})
                  </Button>
                  <Button 
                    icon={<UndoOutlined />}
                    size="small"
                    onClick={undo}
                    disabled={state.historyIndex < 0}
                    style={{ width: '100%' }}
                  >
                    Undo
                  </Button>
                  <Button 
                    icon={<RedoOutlined />}
                    size="small"
                    onClick={redo}
                    disabled={state.historyIndex >= state.editHistory.length - 1}
                    style={{ width: '100%' }}
                  >
                    Redo
                  </Button>
                  <Button 
                    type="primary"
                    icon={<SaveOutlined />}
                    size="small"
                    onClick={handleSave}
                    style={{ width: '100%' }}
                  >
                    Save Edits
                  </Button>
                </Space>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Video Player */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Card 
            title="Video Preview" 
            size="small"
            style={{ height: '100%' }}
            bodyStyle={{ padding: '12px', height: 'calc(100% - 57px)', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ flex: 1, position: 'relative', marginBottom: '12px' }}>
              <ReactPlayer
                ref={playerRef}
                url={videoUrl}
                width="100%"
                height="100%"
                playing={state.playing}
                controls
                onProgress={handleProgress}
                onPlay={() => setState(prev => ({ ...prev, playing: true }))}
                onPause={() => setState(prev => ({ ...prev, playing: false }))}
                style={{ borderRadius: '8px', overflow: 'hidden' }}
              />
            </div>
            
            {/* Playback Controls */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '8px 0'
            }}>
              <Space>
                <Button 
                  icon={state.playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                  onClick={handlePlayPause}
                  size="small"
                >
                  {state.playing ? 'Pause' : 'Play'}
                </Button>
                <Text style={{ color: '#999', fontSize: '12px' }}>
                  {formatTime(state.currentTime)} / {formatTime(120)} {/* Assuming total duration 120s */}
                </Text>
              </Space>
              <Button
                icon={state.showDeleted ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                onClick={() => setState(prev => ({ ...prev, showDeleted: !prev.showDeleted }))}
                size="small"
              >
                {state.showDeleted ? 'Hide Deleted' : 'Show Deleted'}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Context Menu */}
      {state.contextMenu.visible && (
        <div
          style={{
            position: 'fixed',
            top: state.contextMenu.y,
            left: state.contextMenu.x,
            zIndex: 1000,
            backgroundColor: '#1a1a1a',
            border: '1px solid #2d2d2d',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            padding: '4px 0',
            minWidth: '140px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenuItems.map(item => (
            <div
              key={item.key}
              style={{
                padding: '10px 16px',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'all 0.2s ease',
                borderRadius: '4px',
                margin: '2px 4px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2d2d2d'
                e.currentTarget.style.transform = 'translateX(2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.transform = 'translateX(0)'
              }}
              onClick={item.onClick}
            >
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .subtitle-segment:hover {
          background-color: #2d2d2d !important;
          border-color: #404040 !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
        }
        
        .subtitle-segment.current {
          background-color: rgba(24, 144, 255, 0.2) !important;
          border-color: #1890ff !important;
          box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.1) !important;
        }
        
        .subtitle-segment.deleted {
          background-color: rgba(255, 77, 79, 0.1) !important;
          border-color: #ff4d4f !important;
        }
        
        .subtitle-word:hover {
          background-color: #404040 !important;
          transform: scale(1.05) !important;
        }
        
        .subtitle-word.selected {
          background-color: #1890ff !important;
          color: white !important;
          box-shadow: 0 2px 8px rgba(24, 144, 255, 0.3) !important;
        }

        /* Style template hover effect */
        .style-template::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
          transition: left 0.5s ease;
        }

        .style-template:hover::before {
          left: 100%;
        }

        /* Create project button effect */
        .create-project-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          transition: left 0.6s ease;
        }

        .create-project-btn:hover::before {
          left: 100%;
        }

        /* Custom scrollbar */
        .ant-card-body::-webkit-scrollbar {
          width: 6px;
        }

        .ant-card-body::-webkit-scrollbar-track {
          background: #1a1a1a;
          border-radius: 3px;
        }

        .ant-card-body::-webkit-scrollbar-thumb {
          background: #404040;
          border-radius: 3px;
        }

        .ant-card-body::-webkit-scrollbar-thumb:hover {
          background: #555555;
        }

        /* Modal animation */
        .ant-modal-content {
          animation: modalSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </Modal>
  )
}

export default SubtitleEditor
