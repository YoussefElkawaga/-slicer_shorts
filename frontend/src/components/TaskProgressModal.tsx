import React, { useState, useEffect } from 'react'
import { Modal, Steps, Progress, Typography, Button, Alert, Space, Spin } from 'antd'
import { 
  CheckCircleOutlined, 
  LoadingOutlined, 
  ExclamationCircleOutlined, 
  ReloadOutlined
} from '@ant-design/icons'
import { projectApi } from '../services/api'
import { useProjectStore } from '../store/useProjectStore'

const { Text } = Typography
const { Step } = Steps

interface ProcessingStatus {
  status: 'processing' | 'completed' | 'error'
  current_step: number
  total_steps: number
  step_name: string
  progress: number
  error_message?: string
}

interface TaskProgressModalProps {
  visible: boolean
  projectId: string | null
  onClose: () => void
  onComplete?: (projectId: string) => void
}

const TaskProgressModal: React.FC<TaskProgressModalProps> = ({
  visible,
  projectId,
  onClose,
  onComplete
}) => {
  const [status, setStatus] = useState<ProcessingStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const { updateProject } = useProjectStore()

  const steps = [
    { title: 'Outline Extraction', description: 'Extract structural outline from video transcripts' },
    { title: 'Time Localization', description: 'Locate topic time intervals based on SRT subtitles' },
    { title: 'Content Scoring', description: 'Multi-dimensional evaluation of clip quality and potential' },
    { title: 'Title Generation', description: 'Generate engaging titles for high-scoring clips' },
    { title: 'Topic Clustering', description: 'Cluster related clips into collection recommendations' },
    { title: 'Video Slicing', description: 'Use FFmpeg to generate clips and collections' }
  ]

  useEffect(() => {
    if (!visible || !projectId) {
      setStatus(null)
      return
    }

    const checkStatus = async () => {
      try {
        const statusData = await projectApi.getProcessingStatus(projectId)
        setStatus(statusData)
        
        // Update project status
        updateProject(projectId, {
          status: statusData.status,
          current_step: statusData.current_step,
          total_steps: statusData.total_steps,
          error_message: statusData.error_message
        })
        
        // If processing is complete, notify parent component
        if (statusData.status === 'completed') {
          onComplete?.(projectId)
        }
      } catch (error) {
        console.error('Check status error:', error)
      }
    }

    // Check status immediately
    checkStatus()
    
    // If task is still in progress, check status periodically
    const interval = setInterval(checkStatus, 2000)
    
    return () => clearInterval(interval)
  }, [visible, projectId, updateProject, onComplete])

  const handleRetry = async () => {
    if (!projectId) return
    
    setLoading(true)
    try {
      if (status?.current_step !== undefined) {
        // Retry from current step
        await projectApi.restartStep(projectId, status.current_step)
      } else {
        // Full retry
        await projectApi.retryProcessing(projectId)
      }
      // Restart status checking
      setStatus(null)
    } catch (error) {
      console.error('Retry error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStepStatus = (stepIndex: number) => {
    if (!status) return 'wait'
    
    if (status.status === 'error' && stepIndex === status.current_step) {
      return 'error'
    }
    
    if (stepIndex < status.current_step) {
      return 'finish'
    }
    
    if (stepIndex === status.current_step) {
      return status.status === 'completed' ? 'finish' : 'process'
    }
    
    return 'wait'
  }

  const getStepIcon = (stepIndex: number) => {
    const stepStatus = getStepStatus(stepIndex)
    
    if (stepStatus === 'error') {
      return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
    }
    
    if (stepStatus === 'finish') {
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />
    }
    
    if (stepStatus === 'process') {
      return <LoadingOutlined style={{ color: '#1890ff' }} />
    }
    
    return null
  }

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <LoadingOutlined style={{ color: '#1890ff' }} />
          <span>Task Processing Progress</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
        ...(status?.status === 'error' ? [
          <Button 
            key="retry" 
            type="primary" 
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={handleRetry}
          >
            Retry from Current Step
          </Button>
        ] : [])
      ]}
      width={600}
      centered
      maskClosable={false}
      destroyOnClose
    >
      <div style={{ padding: '16px 0' }}>
        {!status ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: '16px', color: '#666' }}>
              Fetching task status...
            </div>
          </div>
        ) : (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Overall Progress */}
            <div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <Text strong>Overall Progress</Text>
                <Text type="secondary">
                  {status.current_step}/{status.total_steps} steps
                </Text>
              </div>
              <Progress 
                percent={Math.round((status.current_step / status.total_steps) * 100)}
                status={status.status === 'error' ? 'exception' : 'active'}
                strokeColor={{
                  '0%': '#4facfe',
                  '100%': '#00f2fe'
                }}
              />
            </div>

            {/* Current Step Info */}
            <div style={{
              background: '#f8f9fa',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #e9ecef'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                {getStepIcon(status.current_step)}
                <Text strong>Current Step: {status.step_name}</Text>
              </div>
              <Progress 
                percent={status.progress}
                size="small"
                status={status.status === 'error' ? 'exception' : 'active'}
              />
            </div>

            {/* Error Information */}
            {status.status === 'error' && status.error_message && (
              <Alert
                message="Processing Failed"
                description={status.error_message}
                type="error"
                showIcon
              />
            )}

            {/* Step List */}
            <div>
              <Text strong style={{ marginBottom: '16px', display: 'block' }}>Processing Steps</Text>
              <Steps
                direction="vertical"
                size="small"
                current={status.current_step}
                status={status.status === 'error' ? 'error' : 'process'}
              >
                {steps.map((step, index) => (
                  <Step
                    key={index}
                    title={step.title}
                    description={step.description}
                    status={getStepStatus(index)}
                    icon={getStepIcon(index)}
                  />
                ))}
              </Steps>
            </div>

            {/* Completion Notice */}
            {status.status === 'completed' && (
              <Alert
                message="Processing Complete"
                description="The video has been successfully processed. You can now view the generated clips and collections."
                type="success"
                showIcon
              />
            )}
          </Space>
        )}
      </div>
    </Modal>
  )
}

export default TaskProgressModal