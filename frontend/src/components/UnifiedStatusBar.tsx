/**
 * Unified Status Bar Component - replaces old complex progress system
 * Supports unified display of downloading, processing, completed, and other statuses
 */

import React, { useEffect, useState } from 'react'
import { Progress, Space, Typography, Tag } from 'antd'
import { 
  DownloadOutlined, 
  LoadingOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons'
import { useSimpleProgressStore, getStageDisplayName, getStageColor, isCompleted, isFailed } from '../stores/useSimpleProgressStore'

const { Text } = Typography

interface UnifiedStatusBarProps {
  projectId: string
  status: string
  downloadProgress?: number
  onStatusChange?: (status: string) => void
  onDownloadProgressUpdate?: (progress: number) => void
}

export const UnifiedStatusBar: React.FC<UnifiedStatusBarProps> = ({
  projectId,
  status,
  downloadProgress = 0,
  onStatusChange,
  onDownloadProgressUpdate
}) => {
  const { getProgress, startPolling, stopPolling } = useSimpleProgressStore()
  const [isPolling, setIsPolling] = useState(false)
  const [currentDownloadProgress, setCurrentDownloadProgress] = useState(downloadProgress)
  
  const progress = getProgress(projectId)

  // Decide whether to poll based on status
  useEffect(() => {
    if ((status === 'processing' || status === 'pending') && !isPolling) {
      console.log(`Starting processing progress polling: ${projectId}`)
      startPolling([projectId], 2000)
      setIsPolling(true)
    } else if (status !== 'processing' && status !== 'pending' && isPolling) {
      console.log(`Stopping processing progress polling: ${projectId}`)
      stopPolling()
      setIsPolling(false)
    }

    return () => {
      if (isPolling) {
        console.log(`Cleaning up polling: ${projectId}`)
        stopPolling()
        setIsPolling(false)
      }
    }
  }, [status, projectId, isPolling, startPolling, stopPolling])

  // Download progress polling
  useEffect(() => {
    if (status === 'downloading') {
      const pollDownloadProgress = async () => {
        try {
          console.log(`Polling download progress: ${projectId}`)
          const response = await fetch(`http://localhost:8000/api/v1/projects/${projectId}`)
          if (response.ok) {
            const projectData = await response.json()
            console.log('Project data:', projectData)
            const newProgress = projectData.processing_config?.download_progress || 0
            console.log(`Download progress update: ${newProgress}%`)
            setCurrentDownloadProgress(newProgress)
            onDownloadProgressUpdate?.(newProgress)
            
            // If download complete, check if status should switch to processing
            if (newProgress >= 100) {
              console.log('Download complete, switching to processing status')
              setTimeout(() => {
                onStatusChange?.('processing')
              }, 1000)
            }
          } else {
            console.error('Failed to get project data:', response.status, response.statusText)
          }
        } catch (error) {
          console.error('Failed to get download progress:', error)
        }
      }

      // Fetch immediately
      pollDownloadProgress()
      
      // Poll every 2 seconds
      const interval = setInterval(pollDownloadProgress, 2000)
      
      return () => clearInterval(interval)
    }
  }, [status, projectId, onDownloadProgressUpdate, onStatusChange])

  // Handle status changes
  useEffect(() => {
    if (progress && onStatusChange) {
      if (isCompleted(progress.stage)) {
        onStatusChange('completed')
      } else if (isFailed(progress.message)) {
        onStatusChange('failed')
      }
    }
  }, [progress, onStatusChange])

  // Importing status
  if (status === 'importing') {
    return (
      <div style={{
        background: 'rgba(255, 193, 7, 0.1)',
        border: '1px solid rgba(255, 193, 7, 0.3)',
        borderRadius: '3px',
        padding: '3px 6px',
        textAlign: 'center',
        width: '100%'
      }}>
        <div style={{ 
          color: '#ffc107',
          fontSize: '11px', 
          fontWeight: 600, 
          lineHeight: '12px'
        }}>
          {Math.round(downloadProgress)}%
        </div>
        <div style={{ 
          color: '#999999', 
          fontSize: '8px', 
          lineHeight: '9px'
        }}>
          Importing
        </div>
      </div>
    )
  }

  // Downloading status — enhanced progress bar
  if (status === 'downloading') {
    const pct = Math.round(currentDownloadProgress)
    const statusLabel = pct < 30 ? 'Connecting...'
      : pct < 70 ? 'Downloading...'
      : pct < 95 ? 'Transcribing...'
      : 'Finishing...'
    return (
      <div style={{
        background: 'rgba(24, 144, 255, 0.08)',
        border: '1px solid rgba(24, 144, 255, 0.25)',
        borderRadius: '4px',
        padding: '4px 6px',
        textAlign: 'center',
        width: '100%'
      }}>
        {/* Progress bar */}
        <div style={{
          width: '100%',
          height: 4,
          borderRadius: 2,
          background: 'rgba(24, 144, 255, 0.15)',
          overflow: 'hidden',
          marginBottom: 3
        }}>
          <div style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 2,
            background: 'linear-gradient(90deg, #1890ff, #40a9ff)',
            transition: 'width 1s ease',
          }} />
        </div>
        <div style={{ 
          color: '#1890ff',
          fontSize: '11px', 
          fontWeight: 600, 
          lineHeight: '12px'
        }}>
          {pct}%
        </div>
        <div style={{ 
          color: '#999999', 
          fontSize: '8px', 
          lineHeight: '9px'
        }}>
          {statusLabel}
        </div>
      </div>
    )
  }

  // Processing status - using new simplified progress system
  if (status === 'processing') {
    if (!progress) {
      // Waiting for progress data
      return (
      <div style={{
        background: 'rgba(82, 196, 26, 0.1)',
        border: '1px solid rgba(82, 196, 26, 0.3)',
        borderRadius: '3px',
        padding: '3px 6px',
        textAlign: 'center',
        width: '100%'
      }}>
        <div style={{ 
          color: '#52c41a',
          fontSize: '11px', 
          fontWeight: 600, 
          lineHeight: '12px'
        }}>
          0%
        </div>
        <div style={{ 
          color: '#999999', 
          fontSize: '8px', 
          lineHeight: '9px'
        }}>
          Initializing...
        </div>
      </div>
      )
    }

    const { stage, percent, message } = progress
    const stageDisplayName = getStageDisplayName(stage)
    const stageColor = getStageColor(stage)
    const failed = isFailed(message)

    return (
      <div style={{
        background: failed 
          ? 'rgba(255, 77, 79, 0.1)'
          : 'rgba(82, 196, 26, 0.1)',
        border: failed 
          ? '1px solid rgba(255, 77, 79, 0.3)'
          : '1px solid rgba(82, 196, 26, 0.3)',
        borderRadius: '3px',
        padding: '3px 6px',
        textAlign: 'center',
        width: '100%'
      }}>
        <div style={{ 
          color: failed ? '#ff4d4f' : '#52c41a',
          fontSize: '11px', 
          fontWeight: 600, 
          lineHeight: '12px'
        }}>
          {failed ? '✗ Failed' : `${percent}%`}
        </div>
        <div style={{ 
          color: '#999999', 
          fontSize: '8px', 
          lineHeight: '9px',
          minHeight: '9px' // Ensure consistent height for failed status
        }}>
          {failed ? '' : stageDisplayName}
        </div>
      </div>
    )
  }

  // Completed status
  if (status === 'completed') {
    return (
      <div style={{
        background: 'rgba(82, 196, 26, 0.1)',
        border: '1px solid rgba(82, 196, 26, 0.3)',
        borderRadius: '3px',
        padding: '3px 6px',
        textAlign: 'center',
        width: '100%'
      }}>
        <div style={{ 
          color: '#52c41a',
          fontSize: '11px', 
          fontWeight: 600, 
          lineHeight: '12px'
        }}>
          ✓
        </div>
        <div style={{ 
          color: '#999999', 
          fontSize: '8px', 
          lineHeight: '9px'
        }}>
          Completed
        </div>
      </div>
    )
  }

  // Failed status
  if (status === 'failed') {
    return (
      <div style={{
        background: 'rgba(255, 77, 79, 0.1)',
        border: '1px solid rgba(255, 77, 79, 0.3)',
        borderRadius: '3px',
        padding: '3px 6px',
        textAlign: 'center',
        width: '100%'
      }}>
        <div style={{ 
          color: '#ff4d4f',
          fontSize: '11px', 
          fontWeight: 600, 
          lineHeight: '12px'
        }}>
          ✗ Failed
        </div>
        <div style={{ 
          color: '#999999', 
          fontSize: '8px', 
          lineHeight: '9px',
          minHeight: '9px' // Ensure consistent height for failed status
        }}>
          Process Failed
        </div>
      </div>
    )
  }

  // Pending status
  return (
    <div style={{
      background: 'rgba(217, 217, 217, 0.1)',
      border: '1px solid rgba(217, 217, 217, 0.3)',
      borderRadius: '3px',
      padding: '3px 6px',
      textAlign: 'center',
      width: '100%'
    }}>
      <div style={{ 
        color: '#d9d9d9',
        fontSize: '11px', 
        fontWeight: 600, 
        lineHeight: '12px'
      }}>
        ○ Pending
      </div>
      <div style={{ 
        color: '#999999', 
        fontSize: '8px', 
        lineHeight: '9px',
        minHeight: '9px' // Ensure consistent height for pending status
      }}>
        Awaiting Process
      </div>
    </div>
  )
}

// Simplified progress bar component - for detailed progress display
interface SimpleProgressDisplayProps {
  projectId: string
  status: string
  showDetails?: boolean
}

export const SimpleProgressDisplay: React.FC<SimpleProgressDisplayProps> = ({
  projectId,
  status,
  showDetails = false
}) => {
  const { getProgress } = useSimpleProgressStore()
  const progress = getProgress(projectId)

  if (status !== 'processing' || !progress || !showDetails) {
    return null
  }

  const { stage, percent, message } = progress
  const stageDisplayName = getStageDisplayName(stage)
  const stageColor = getStageColor(stage)

  return (
    <div style={{ marginTop: '8px' }}>
      <Progress
        percent={percent}
        strokeColor={stageColor}
        showInfo={true}
        size="small"
        format={(percent) => `${percent}%`}
      />
      {message && (
        <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: '4px' }}>
          {message}
        </Text>
      )}
    </div>
  )
}
