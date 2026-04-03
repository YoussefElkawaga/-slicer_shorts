import React, { useState, useRef } from 'react'
import { Modal, Typography, Button, Tag, Space, Row, Col, Divider, message } from 'antd'
import { 
  PlayCircleOutlined, 
  DownloadOutlined, 
  ClockCircleOutlined, 
  StarFilled,
  CloseOutlined,
  EditOutlined
} from '@ant-design/icons'
import ReactPlayer from 'react-player'
import { Clip } from '../store/useProjectStore'
import { projectApi } from '../services/api'
import SubtitleEditor from './SubtitleEditor'
import { subtitleEditorApi } from '../services/subtitleEditorApi'
import EditableTitle from './EditableTitle'
import { SubtitleSegment, VideoEditOperation } from '../types/subtitle'

const { Text, Title } = Typography

interface ClipDetailModalProps {
  visible: boolean
  clip: Clip | null
  projectId: string
  onClose: () => void
  onDownload: (clipId: string) => void
}

const ClipDetailModal: React.FC<ClipDetailModalProps> = ({
  visible,
  clip,
  projectId,
  onClose,
  onDownload
}) => {
  const [playing, setPlaying] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [showSubtitleEditor, setShowSubtitleEditor] = useState(false)
  const [subtitleData, setSubtitleData] = useState<SubtitleSegment[]>([])
  const playerRef = useRef<ReactPlayer>(null)

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '00:00:00'
    // Remove ms part, keep only hh:mm:ss
    return timeStr.replace(',', '.').substring(0, 8)
  }

  const getDuration = () => {
    if (!clip?.start_time || !clip?.end_time) return '00:00:00'
    const start = clip.start_time.replace(',', '.')
    const end = clip.end_time.replace(',', '.')
    return `${start.substring(0, 8)} - ${end.substring(0, 8)}`
  }

  const getScoreColor = (score: number) => {
    // Set colors based on score ranges
    if (score >= 0.9) return '#52c41a' // Green - Excellent
    if (score >= 0.8) return '#1890ff' // Blue - Good
    if (score >= 0.7) return '#faad14' // Orange - Average
    if (score >= 0.6) return '#ff7a45' // Red-Orange - Poor
    return '#ff4d4f' // Red - Bad
  }

  const handleDownload = async () => {
    if (!clip) return
    setDownloading(true)
    try {
      await onDownload(clip.id)
    } finally {
      setDownloading(false)
    }
  }

  const handleClose = () => {
    setPlaying(false)
    onClose()
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
    if (!clip) return
    
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
        // Add success notice here
        // Can refresh clip list or update UI
      }
    } catch (error) {
      console.error('Video edit failed:', error)
      // Add error notice here
    }
  }

  if (!clip) return null

  return (
    <>
      <Modal
        visible={visible}
        onCancel={handleClose}
        footer={null}
        width={800}
        centered
        destroyOnClose
        style={{ top: 20 }}
        styles={{
          body: {
            padding: 0,
            background: 'rgba(26, 26, 46, 0.95)',
            borderRadius: '12px'
          }
        }}
      >
        <div style={{ padding: '24px' }}>
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <Title level={4} style={{ margin: 0, color: '#ffffff' }}>
              Clip Details
            </Title>
            <Button 
              type="text" 
              icon={<CloseOutlined />} 
              onClick={handleClose}
              style={{ color: '#cccccc' }}
            />
          </div>

          <Row gutter={24}>
            {/* Left side: Video Player */}
            <Col span={14}>
              <div style={{ 
                background: '#000', 
                borderRadius: '8px', 
                overflow: 'hidden',
                marginBottom: '16px'
              }}>
                <ReactPlayer
                  ref={playerRef}
                  url={projectApi.getClipVideoUrl(projectId, clip.id, clip.title || clip.generated_title)}
                  width="100%"
                  height="300px"
                  playing={playing}
                  controls
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  style={{ borderRadius: '8px' }}
                />
              </div>

              {/* Video Info */}
              <div style={{ marginBottom: '16px' }}>
                <Space size="middle">
                  <Tag color="blue" icon={<ClockCircleOutlined />}>
                    {getDuration()}
                  </Tag>
                  {clip.final_score && (
                    <Tag 
                      icon={<StarFilled />}
                      style={{ 
                        background: getScoreColor(clip.final_score),
                        color: 'white',
                        border: 'none'
                      }}
                    >
                      Score: {(clip.final_score * 100).toFixed(0)}
                    </Tag>
                  )}
                  {clip.outline && (
                    <Tag color="purple">{clip.outline}</Tag>
                  )}
                </Space>
              </div>

              {/* Action Buttons */}
              <Space>
                <Button 
                  type="primary" 
                  icon={<PlayCircleOutlined />}
                  onClick={() => setPlaying(!playing)}
                >
                  {playing ? 'Pause' : 'Play'}
                </Button>
                <Button 
                  type="default" 
                  icon={<DownloadOutlined />}
                  loading={downloading}
                  onClick={handleDownload}
                >
                  Download Clip
                </Button>
                <Button 
                  type="default" 
                  icon={<EditOutlined />}
                  onClick={handleOpenSubtitleEditor}
                >
                  Edit Subtitles
                </Button>
              </Space>
            </Col>

            {/* Right side: Details */}
            <Col span={10}>
              <div style={{ color: '#ffffff' }}>
                {/* Title */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <EditableTitle
                      title={clip.generated_title || clip.title || 'Untitled Clip'}
                      clipId={clip.id}
                      onTitleUpdate={(newTitle) => {
                        // Update clip title
                        console.log('Title updated:', newTitle)
                        // Trigger parent component callback
                      }}
                      style={{ color: '#ffffff', fontSize: '18px', fontWeight: '600' }}
                    />
                  </div>
                  <Text style={{ color: '#cccccc', fontSize: '12px' }}>
                    ID: {clip.id}
                  </Text>
                </div>

                <Divider style={{ borderColor: 'rgba(255,255,255,0.1)' }} />

                {/* Content Points */}
                {clip.content && clip.content.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <Text strong style={{ color: '#ffffff', display: 'block', marginBottom: '8px' }}>
                      Key Points:
                    </Text>
                    <div>
                      {clip.content.map((point, index) => (
                        <div key={index} style={{ 
                          color: '#cccccc', 
                          fontSize: '14px',
                          marginBottom: '4px',
                          padding: '4px 8px',
                          background: 'rgba(255,255,255,0.05)',
                          borderRadius: '4px'
                        }}>
                          • {point}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timestamp Info */}
                <div style={{ marginBottom: '16px' }}>
                  <Text strong style={{ color: '#ffffff', display: 'block', marginBottom: '8px' }}>
                    Timing:
                  </Text>
                  <div style={{ color: '#cccccc', fontSize: '14px' }}>
                    <div>Start: {formatTime(clip.start_time)}</div>
                    <div>End: {formatTime(clip.end_time)}</div>
                  </div>
                </div>


              </div>
            </Col>
          </Row>
        </div>
      </Modal>

      {/* Subtitle Editor */}
      {showSubtitleEditor && (
        <>
          {console.log('Rendering SubtitleEditor with:', { showSubtitleEditor, subtitleDataLength: subtitleData.length })}
          <SubtitleEditor
            videoUrl={projectApi.getClipVideoUrl(projectId, clip.id, clip.title || clip.generated_title)}
            subtitles={subtitleData}
            onSave={handleSubtitleEditorSave}
            onClose={handleSubtitleEditorClose}
          />
        </>
      )}
    </>
  )
}

export default ClipDetailModal 