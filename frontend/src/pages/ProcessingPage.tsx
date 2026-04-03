import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout, Card, Progress, Steps, Typography, Button, Alert, Space, Spin, message } from 'antd'
import { CheckCircleOutlined, LoadingOutlined, ExclamationCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { projectApi } from '../services/api'
import { useProjectStore } from '../store/useProjectStore'

const { Content } = Layout
const { Title, Text } = Typography
const { Step } = Steps

interface ProcessingStatus {
  status: 'processing' | 'completed' | 'error'
  current_step: number
  total_steps: number
  step_name: string
  progress: number
  error_message?: string
}

const ProcessingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentProject, setCurrentProject } = useProjectStore()
  const [status, setStatus] = useState<ProcessingStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const steps = [
    { title: 'Outline Extraction', description: 'Extracting structured outline from video transcript' },
    { title: 'Time Positioning', description: 'Locating topic time ranges based on SRT subtitles' },
    { title: 'Content Scoring', description: 'Multi-dimensional quality and virality assessment' },
    { title: 'Title Generation', description: 'Generating engaging titles for top clips' },
    { title: 'Topic Clustering', description: 'Grouping related clips into collections' },
    { title: 'Video Slicing', description: 'Using FFmpeg to generate clips and collection videos' }
  ]

  useEffect(() => {
    if (!id) return
    
    loadProject()
    const interval = setInterval(checkStatus, 2000)
    
    return () => clearInterval(interval)
  }, [id])

  const loadProject = async () => {
    if (!id) return
    
    try {
      const project = await projectApi.getProject(id)
      setCurrentProject(project)
      
      if (project.status === 'completed') {
        navigate(`/project/${id}`)
        return
      }
      
      if (project.status === 'pending') {
        await startProcessing()
      }
    } catch (error) {
      message.error('Failed to load project')
      console.error('Load project error:', error)
    } finally {
      setLoading(false)
    }
  }

  const startProcessing = async () => {
    if (!id) return
    
    try {
      await projectApi.startProcessing(id)
      message.success('Processing started')
    } catch (error) {
      message.error('Failed to start processing')
      console.error('Start processing error:', error)
    }
  }

  const checkStatus = async () => {
    if (!id) return
    
    try {
      const statusData = await projectApi.getProcessingStatus(id)
      setStatus(statusData)
      
      if (statusData.status === 'completed') {
        message.success('🎉 Video processing complete! Redirecting to results...')
        setTimeout(() => {
          navigate(`/project/${id}`)
        }, 2000)
      }
      
      if (statusData.status === 'error') {
        const errorMsg = statusData.error_message || 'An unknown error occurred during processing'
        message.error(`Processing failed: ${errorMsg}`)
        message.info('You can go back to the homepage and re-upload, or contact support.', 5)
      }
      
    } catch (error: any) {
      console.error('Check status error:', error)
      
      if (error.response?.status === 404) {
        message.error('Project not found or has been deleted')
        setTimeout(() => navigate('/'), 2000)
      } else if (error.code === 'ECONNABORTED') {
        message.warning('Network timeout, retrying...')
      } else {
        message.error('Failed to get processing status. Please refresh the page.')
      }
    }
  }

  const getStepStatus = (stepIndex: number) => {
    if (!status) return 'wait'
    
    if (status.status === 'error') {
      return stepIndex < status.current_step ? 'finish' : 'error'
    }
    
    if (stepIndex < status.current_step) return 'finish'
    if (stepIndex === status.current_step) return 'process'
    return 'wait'
  }

  const getStepIcon = (stepIndex: number) => {
    const stepStatus = getStepStatus(stepIndex)
    
    if (stepStatus === 'finish') return <CheckCircleOutlined />
    if (stepStatus === 'process') return <LoadingOutlined />
    if (stepStatus === 'error') return <ExclamationCircleOutlined />
    return null
  }

  if (loading) {
    return (
      <Content style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" tip="Loading..." />
      </Content>
    )
  }

  return (
    <Content style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title level={2} style={{ color: '#fff' }}>Video Processing Progress</Title>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/')}
          >
            Back to Home
          </Button>
        </div>

        {currentProject && (
          <Card style={{ background: 'rgba(38, 38, 38, 0.8)', border: '1px solid rgba(79, 172, 254, 0.2)' }}>
            <Title level={4} style={{ color: '#fff' }}>{currentProject.name}</Title>
            <Text style={{ color: '#aaa', display: 'block' }}>Project ID: {currentProject.id}</Text>
            
            <Alert 
              message="Processing in Background" 
              description="Your video is safely processing on our servers. You may close this tab, refresh, or navigate away at any time. Your results will be saved in your Projects list." 
              type="info" 
              showIcon 
              style={{ marginTop: '16px', background: 'rgba(79, 172, 254, 0.1)', border: '1px solid rgba(79, 172, 254, 0.3)' }}
            />
          </Card>
        )}

        {status?.status === 'error' && (
          <Alert
            message="Processing Failed"
            description={
              <div>
                <p>{status.error_message || 'An unknown error occurred during processing'}</p>
                <p style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                  Possible causes: unsupported format, corrupted file, network issues, or server error
                </p>
              </div>
            }
            type="error"
            showIcon
            action={
              <Space>
                <Button size="small" onClick={() => window.location.reload()}>
                  Refresh Page
                </Button>
                <Button size="small" onClick={() => navigate('/')}>
                  Back to Home
                </Button>
              </Space>
            }
          />
        )}

        {status && status.status === 'processing' && (
          <Card title="Processing Progress">
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <Text strong>Overall Progress</Text>
                  <Text>{Math.round(status.progress)}%</Text>
                </div>
                <Progress 
                  percent={status.progress} 
                  status="active"
                  strokeColor={{
                    '0%': '#108ee9',
                    '100%': '#87d068',
                  }}
                />
              </div>

              <div>
                <Text strong>Current Step: </Text>
                <Text>{status.step_name}</Text>
              </div>

              <Steps 
                direction="vertical" 
                current={status.current_step}
                status="process"
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
            </Space>
          </Card>
        )}

        {status?.status === 'completed' && (
          <Alert
            message="Processing Complete"
            description="Your video has been successfully processed. Redirecting to the project details page..."
            type="success"
            showIcon
          />
        )}
      </Space>
    </Content>
  )
}

export default ProcessingPage