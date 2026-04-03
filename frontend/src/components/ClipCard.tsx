import React, { useState, useEffect, useRef } from 'react'
import { Card, Button, Tooltip, Modal, message } from 'antd'
import { PlayCircleOutlined, DownloadOutlined, ClockCircleOutlined, StarFilled, EditOutlined, UploadOutlined } from '@ant-design/icons'
import ReactPlayer from 'react-player'
import { Clip } from '../store/useProjectStore'
import SubtitleEditor from './SubtitleEditor'
import { subtitleEditorApi } from '../services/subtitleEditorApi'
import { SubtitleSegment, VideoEditOperation } from '../types/subtitle'
import BilibiliManager from './BilibiliManager'
import EditableTitle from './EditableTitle'
import './ClipCard.css'

interface ClipCardProps {
  clip: Clip
  videoUrl?: string
  onDownload: (clipId: string) => void
  projectId?: string
  onClipUpdate?: (clipId: string, updates: Partial<Clip>) => void
}

const ClipCard: React.FC<ClipCardProps> = ({ 
  clip, 
  videoUrl, 
  onDownload,
  projectId,
  onClipUpdate
}) => {
  const [showPlayer, setShowPlayer] = useState(false)
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null)
  const [showSubtitleEditor, setShowSubtitleEditor] = useState(false)
  const [subtitleData, setSubtitleData] = useState<SubtitleSegment[]>([])
  const [showBilibiliManager, setShowBilibiliManager] = useState(false)
  const playerRef = useRef<ReactPlayer>(null)

  // Generate video thumbnail
  useEffect(() => {
    if (videoUrl) {
      generateThumbnail()
    }
  }, [videoUrl])

  const generateThumbnail = () => {
    if (!videoUrl) return
    
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.currentTime = 1 // Get the frame at 1s as thumbnail
    
    video.onloadeddata = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      
      const thumbnail = canvas.toDataURL('image/jpeg', 0.8)
      setVideoThumbnail(thumbnail)
    }
    
    video.src = videoUrl
  }

  const handleDownloadWithTitle = async () => {
    try {
      // Call API download method directly, it handles filename
      await onDownload(clip.id)
    } catch (error) {
      console.error('Download failed:', error)
      message.error('Download failed')
    }
  }

  const handleClosePlayer = () => {
    setShowPlayer(false)
  }

  const handleOpenSubtitleEditor = async () => {
    // Show in-development notice
    message.info('Coming soon, stay tuned!')
  }

  const handleSubtitleEditorClose = () => {
    setShowSubtitleEditor(false)
    setSubtitleData([])
  }

  const handleSubtitleEditorSave = async (operations: VideoEditOperation[]) => {
    if (!projectId) return
    
    try {
      // Extract IDs of subtitle segments to delete
      const deletedSegments = operations
        .filter(op => op.type === 'delete')
        .flatMap(op => op.segmentIds)

      if (deletedSegments.length === 0) {
        console.log('No delete operations')
        return
      }

      // Execute video edit
      const result = await subtitleEditorApi.editClipBySubtitles(
        projectId,
        clip.id,
        deletedSegments
      )

      if (result.success) {
        console.log('Video edit successful:', result)
      }
    } catch (error) {
      console.error('Video edit failed:', error)
    }
  }

  const handleTitleUpdate = (newTitle: string) => {
    // Update local state
    onClipUpdate?.(clip.id, { title: newTitle })
  }


  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '00:00'
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const calculateDuration = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0
    
    try {
      // Parse time format "HH:MM:SS,mmm" or "HH:MM:SS.mmm"
      const parseTime = (timeStr: string): number => {
        const normalized = timeStr.replace(',', '.')
        const parts = normalized.split(':')
        if (parts.length !== 3) return 0
        
        const hours = parseInt(parts[0]) || 0
        const minutes = parseInt(parts[1]) || 0
        const seconds = parseFloat(parts[2]) || 0
        
        return hours * 3600 + minutes * 60 + seconds
      }
      
      const start = parseTime(startTime)
      const end = parseTime(endTime)
      
      return Math.max(0, end - start)
    } catch (error) {
      console.error('Error calculating duration:', error)
      return 0
    }
  }

  const getDuration = () => {
    if (!clip.start_time || !clip.end_time) return '00:00'
    const start = clip.start_time.replace(',', '.')
    const end = clip.end_time.replace(',', '.')
    return `${start.substring(0, 8)} - ${end.substring(0, 8)}`
  }

  const getScoreColor = (score: number) => {
    // Set different colors based on score ranges
    if (score >= 0.9) return '#52c41a' // Green - Excellent
    if (score >= 0.8) return '#1890ff' // Blue - Good
    if (score >= 0.7) return '#faad14' // Orange - Average
    if (score >= 0.6) return '#ff7a45' // Red-Orange - Poor
    return '#ff4d4f' // Red - Bad
  }


  // Get content to display as summary
  const getDisplayContent = () => {
    // Priority: show recommend reason (AI generated content points)
    if (clip.recommend_reason && clip.recommend_reason.trim()) {
      return clip.recommend_reason
    }
    
    // If no recommend reason, try to extract non-transcript content points from content array
    if (clip.content && clip.content.length > 0) {
      // Filter out likely transcript lines (long lines or lines with many punctuation marks)
      const contentPoints = clip.content.filter(item => {
        const text = item.trim()
        // If text exceeds 100 chars or has many punctuation marks, likely a transcript
        if (text.length > 100) return false
        if (text.split(/[，。！？；：""''（）【】]/).length > 3) return false
        return true
      })
      
      if (contentPoints.length > 0) {
        return contentPoints.join(' ')
      }
    }
    
    // Fallback to outline
    if (clip.outline && clip.outline.trim()) {
      return clip.outline
    }
    
    return 'No content summary available'
  }

  const textRef = useRef<HTMLDivElement>(null)

  return (
    <>
      <Card
          className="clip-card"
          hoverable
          style={{ 
            height: '380px',
            borderRadius: '16px',
            border: '1px solid #303030',
            background: 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)',
            overflow: 'hidden',
            cursor: 'pointer'
          }}
          styles={{
            body: {
              padding: 0,
            },
          }}
          cover={
            <div 
              style={{ 
                height: '200px', 
                background: videoThumbnail 
                  ? `url(${videoThumbnail}) center/cover` 
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                cursor: 'pointer',
                overflow: 'hidden'
              }}
              onClick={() => setShowPlayer(true)}
            >
              <div 
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0,
                  transition: 'opacity 0.3s ease'
                }}
                className="video-overlay"
              >
                <PlayCircleOutlined style={{ fontSize: '40px', color: 'white' }} />
              </div>
              
              {/* Top-right recommendation score */}
              <div 
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: getScoreColor(clip.final_score),
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <StarFilled style={{ fontSize: '12px' }} />
                {(clip.final_score * 100).toFixed(0)}pts
              </div>
              
              {/* Bottom-left time range */}
              <div 
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  background: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <ClockCircleOutlined style={{ fontSize: '12px' }} />
                {getDuration()}
              </div>
              
              {/* Bottom-right video duration */}
              <div 
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  right: '12px',
                  background: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {formatDuration(calculateDuration(clip.start_time, clip.end_time))}
              </div>
            </div>
          }
        >
          <div style={{ 
            padding: '16px', 
            height: '180px', 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            {/* Content Area - Fixed Height */}
            <div style={{ 
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0 // Allow flex children to shrink
            }}>
              {/* Title Area - Fixed Height */}
              <div style={{ 
                height: '44px',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'flex-start'
              }}>
                <EditableTitle
                  title={clip.title || clip.generated_title || 'Untitled Clip'}
                  clipId={clip.id}
                  onTitleUpdate={handleTitleUpdate}
                  style={{ 
                    fontSize: '16px',
                    fontWeight: 600,
                    lineHeight: '1.4',
                    color: '#ffffff',
                    width: '100%'
                  }}
                />
              </div>
              
              {/* Content Points - Fixed Height */}
              <div style={{ 
                height: '58px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'flex-start'
              }}>
                <Tooltip 
                  title={getDisplayContent()} 
                  placement="top" 
                  overlayStyle={{ maxWidth: '300px' }}
                  mouseEnterDelay={0.5}
                >
                  <div 
                    ref={textRef}
                    style={{ 
                      fontSize: '13px',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: '1.5',
                      color: '#b0b0b0',
                      cursor: 'pointer',
                      wordBreak: 'break-word',
                      textOverflow: 'ellipsis',
                      width: '100%'
                    }}
                  >
                    {getDisplayContent()}
                  </div>
                </Tooltip>
              </div>
            </div>
            
            {/* Action Buttons - Fixed at Bottom */}
            <div style={{ 
              display: 'flex', 
              gap: '8px',
              height: '28px',
              alignItems: 'center',
              marginTop: 'auto'
            }}>
              <Button 
                type="text" 
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => setShowPlayer(true)}
                style={{
                  color: '#4facfe',
                  border: '1px solid rgba(79, 172, 254, 0.3)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  height: '28px',
                  padding: '0 12px',
                  background: 'rgba(79, 172, 254, 0.1)'
                }}
              >
                Play
              </Button>
              <Button 
                type="text" 
                size="small"
                icon={<DownloadOutlined />}
                onClick={handleDownloadWithTitle}
                style={{
                  color: '#52c41a',
                  border: '1px solid rgba(82, 196, 26, 0.3)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  height: '28px',
                  padding: '0 12px',
                  background: 'rgba(82, 196, 26, 0.1)'
                }}
              >
                Download
              </Button>
              <Button 
                type="text" 
                size="small"
                icon={<UploadOutlined />}
                onClick={() => message.info('Coming soon, stay tuned!', 3)}
                style={{
                  color: '#ff7875',
                  border: '1px solid rgba(255, 120, 117, 0.3)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  height: '28px',
                  padding: '0 12px',
                  background: 'rgba(255, 120, 117, 0.1)'
                }}
              >
                Publish
              </Button>
            </div>
          </div>
        </Card>

      {/* Video Player Modal */}
      <Modal
        open={showPlayer}
        onCancel={handleClosePlayer}
        footer={[
          <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={handleDownloadWithTitle}>
            Download Video
          </Button>,
          <Button 
            key="subtitle" 
            icon={<EditOutlined />} 
            onClick={handleOpenSubtitleEditor}
          >
            Edit Subtitles
          </Button>,
          <Button 
            key="upload" 
            type="default" 
            icon={<UploadOutlined />} 
            onClick={() => message.info('Coming soon, stay tuned!', 3)}
          >
            Upload to Platform
          </Button>
        ]}
        width={800}
        centered
        destroyOnClose
        styles={{
          header: {
            borderBottom: '1px solid #303030',
            background: '#1f1f1f'
          }
        }}
        closeIcon={
          <span style={{ color: '#ffffff', fontSize: '16px' }}>×</span>
        }
        title={
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            width: '100%',
            paddingRight: '30px' // Leave space for close button
          }}>
            <EditableTitle
              title={clip.title || clip.generated_title || 'Video Preview'}
              clipId={clip.id}
              onTitleUpdate={(newTitle) => {
                // Update clip title
                console.log('Player title updated:', newTitle)
                // Trigger parent component callback
                if (onClipUpdate) {
                  onClipUpdate(clip.id, { title: newTitle })
                }
              }}
              style={{ 
                color: '#ffffff', 
                fontSize: '16px', 
                fontWeight: '500',
                flex: 1,
                maxWidth: 'calc(100% - 40px)' // Ensure it doesn't overlap with close button
              }}
            />
          </div>
        }
      >
        {videoUrl && (
          <ReactPlayer
            ref={playerRef}
            url={videoUrl}
            width="100%"
            height="400px"
            controls
            playing={showPlayer}
            config={{
              file: {
                attributes: {
                  controlsList: 'nodownload',
                  preload: 'metadata'
                },
                forceHLS: false,
                forceDASH: false
              }
            }}
            onReady={() => {
              console.log('Video ready for seeking')
            }}
            onError={(error) => {
              console.error('ReactPlayer error:', error)
            }}
          />
        )}
      </Modal>

      {/* Subtitle Editor */}
      {showSubtitleEditor && (
        <>
          {console.log('Rendering SubtitleEditor with:', { showSubtitleEditor, subtitleDataLength: subtitleData.length })}
          <SubtitleEditor
            videoUrl={videoUrl || ''}
            subtitles={subtitleData}
            onSave={handleSubtitleEditorSave}
            onClose={handleSubtitleEditorClose}
          />
        </>
      )}

      {/* Bilibili Management Modal */}
      <BilibiliManager
        visible={showBilibiliManager}
        onClose={() => setShowBilibiliManager(false)}
        projectId={projectId || ''}
        clipIds={[clip.id]}
        clipTitles={[clip.title || clip.generated_title || 'Video Clip']}
        onUploadSuccess={() => {
          // Publish succeeded - can refresh data or show notice
          console.log('Published successfully')
        }}
      />
    </>
  )
}

export default ClipCard