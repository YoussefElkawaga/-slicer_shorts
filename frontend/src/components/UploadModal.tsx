import React, { useState, useEffect } from 'react'
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  Tag,
  Progress,
  message,
  Divider,
  Row,
  Col,
  Typography,
  Alert,
  Spin
} from 'antd'
import {
  UploadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons'
import { uploadApi } from '../services/uploadApi'
import { BILIBILI_PARTITIONS } from '../services/uploadApi'

const { Option } = Select
const { TextArea } = Input
const { Text } = Typography

interface UploadModalProps {
  visible: boolean
  onCancel: () => void
  projectId: string
  clipIds: string[]
  clipTitles: string[]
  onSuccess?: () => void
}

interface UploadProgress {
  status: 'pending' | 'processing' | 'success' | 'failed'
  message: string
  progress: number
  bvid?: string
  error?: string
}

const UploadModal: React.FC<UploadModalProps> = ({
  visible,
  onCancel,
  projectId,
  clipIds,
  clipTitles,
  onSuccess
}) => {
  const [form] = Form.useForm()
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    status: 'pending',
    message: 'Preparing upload...',
    progress: 0
  })
  const [uploadRecordId, setUploadRecordId] = useState<string>('')
  const [pollingInterval, setPollingInterval] = useState<ReturnType<typeof setInterval> | null>(null)

  // 表单初始值
  const initialValues = {
    title: clipTitles.length === 1 ? clipTitles[0] : `${clipTitles[0]} and ${clipIds.length - 1} more`,
    description: '',
    tags: [],
    partition_id: undefined,
    account_id: undefined
  }

  // 获取B站账号列表
  const [accounts, setAccounts] = useState<any[]>([])
  useEffect(() => {
    if (visible) {
      // 调用API获取B站账号列表
      uploadApi.getBilibiliAccounts()
        .then(data => {
          setAccounts(data)
        })
        .catch(error => {
          console.error('获取B站账号列表失败:', error)
          // 如果API调用失败，使用默认账号
          setAccounts([
            { id: '1', name: 'Main Account', username: 'main_account' }
          ])
        })
    }
  }, [visible])

  // 提交投稿
  const handleSubmit = async (values: any) => {
    // 显示开发中提示
    message.info('Bilibili upload feature is coming soon!', 3)
    return
    
    // 原有代码已禁用
    if (!values.account_id) {
      message.error('Please select a Bilibili account')
      return
    }

    setUploading(true)
    setUploadProgress({
      status: 'pending',
      message: 'Creating upload task...',
      progress: 10
    })

    try {
      // 创建投稿任务
      const response = await uploadApi.createUploadTask(projectId, {
        clip_ids: clipIds,
        account_id: values.account_id,
        title: values.title,
        description: values.description,
        tags: values.tags,
        partition_id: values.partition_id
      })

      setUploadRecordId(response.record_id)
      setUploadProgress({
        status: 'processing',
        message: `Upload task created, processing ${response.clip_count} videos...`,
        progress: 30
      })

      // 开始轮询上传状态
      startPolling(response.record_id)

      message.success('Upload task created!')
    } catch (error: any) {
      console.error('创建投稿任务失败:', error)
      setUploadProgress({
        status: 'failed',
        message: `Failed to create upload task: ${error.message || 'Unknown error'}`,
        progress: 0,
        error: error.message
      })
      setUploading(false)
    }
  }

  // 开始轮询上传状态
  const startPolling = (recordId: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await uploadApi.getUploadRecord(recordId)
        
        if (status.status === 'success') {
          setUploadProgress({
            status: 'success',
            message: 'Upload successful!',
            progress: 100,
            bvid: status.bvid
          })
          setUploading(false)
          clearInterval(interval)
          
          // 延迟关闭弹窗，让用户看到成功状态
          setTimeout(() => {
            onSuccess?.()
            onCancel()
          }, 2000)
        } else if (status.status === 'failed') {
          setUploadProgress({
            status: 'failed',
            message: `Upload failed: ${status.error_message || 'Unknown error'}`,
            progress: 0,
            error: status.error_message
          })
          setUploading(false)
          clearInterval(interval)
        } else if (status.status === 'processing') {
          setUploadProgress({
            status: 'processing',
            message: 'Uploading to Bilibili...',
            progress: 60
          })
        } else if (status.status === 'pending') {
          setUploadProgress({
            status: 'processing',
            message: 'Task queued, please wait...',
            progress: 40
          })
        } else {
          // 其他状态，逐步增加进度
          setUploadProgress(prev => ({
            ...prev,
            message: `Task status: ${status.status}`,
            progress: Math.min(prev.progress + 5, 90)
          }))
        }
      } catch (error) {
        console.error('获取上传状态失败:', error)
        setUploadProgress({
          status: 'failed',
          message: 'Failed to get upload status',
          progress: 0,
          error: 'Network error'
        })
        setUploading(false)
        clearInterval(interval)
      }
    }, 2000)

    setPollingInterval(interval)
  }

  // 清理轮询
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [pollingInterval])

  // 弹窗关闭时清理状态
  const handleCancel = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval)
    }
    setUploading(false)
    setUploadProgress({
      status: 'pending',
      message: 'Preparing upload...',
      progress: 0
    })
    setUploadRecordId('')
    form.resetFields()
    onCancel()
  }

  // 取消投稿任务
  const handleCancelUpload = async () => {
    if (!uploadRecordId) {
      handleCancel()
      return
    }

    try {
      // 调用取消投稿API
      await uploadApi.cancelUploadTask(uploadRecordId)
      
      // 清理状态
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
      setUploading(false)
      setUploadProgress({
        status: 'pending',
        message: 'Preparing upload...',
        progress: 0
      })
      setUploadRecordId('')
      form.resetFields()
      
      // 显示取消成功消息
      message.success('Upload task cancelled')
      onCancel()
    } catch (error) {
      console.error('取消投稿失败:', error)
      message.error('Failed to cancel upload, please retry')
    }
  }

  // 获取状态图标
  const getStatusIcon = () => {
    switch (uploadProgress.status) {
      case 'pending':
        return <ClockCircleOutlined style={{ color: '#1890ff' }} />
      case 'processing':
        return <ExclamationCircleOutlined style={{ color: '#faad14' }} />
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'failed':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      default:
        return <ClockCircleOutlined style={{ color: '#1890ff' }} />
    }
  }

  // 获取进度条状态
  const getProgressStatus = () => {
    if (uploadProgress.status === 'failed') return 'exception'
    if (uploadProgress.status === 'success') return 'success'
    return 'active'
  }

  return (
    <Modal
      title={
        <Space>
          <UploadOutlined style={{ color: '#1890ff' }} />
          <span>Upload to Bilibili</span>
          {clipIds.length > 1 && (
            <Tag color="blue">{clipIds.length} videos</Tag>
          )}
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={700}
      destroyOnClose
      maskClosable={!uploading}
      closable={!uploading}
    >
      {!uploading ? (
        // 投稿表单
        <Form
          form={form}
          layout="vertical"
          initialValues={initialValues}
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Bilibili Account"
                name="account_id"
                rules={[{ required: true, message: 'Please select a Bilibili account' }]}
              >
                <Select placeholder="Select Bilibili account">
                  {accounts.map(account => (
                    <Option key={account.id} value={account.id}>
                      {account.nickname || account.username} ({account.username})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Category"
                name="partition_id"
                rules={[{ required: true, message: 'Please select a category' }]}
              >
                <Select placeholder="Select video category" showSearch>
                  {BILIBILI_PARTITIONS.map(partition => (
                    <Option key={partition.id} value={partition.id}>
                      {partition.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Title"
            name="title"
            rules={[{ required: true, message: 'Please enter a video title' }]}
          >
            <Input placeholder="Enter video title" maxLength={80} showCount />
          </Form.Item>

          <Form.Item
            label="Description"
            name="description"
            rules={[{ required: true, message: 'Please enter a video description' }]}
          >
            <TextArea
              placeholder="Enter video description"
              rows={4}
              maxLength={250}
              showCount
            />
          </Form.Item>

          <Form.Item
            label="Tags"
            name="tags"
            extra="Add up to 10 tags, separated by commas"
          >
            <Select
              mode="tags"
              placeholder="Enter tags, press Enter to confirm"
              maxTagCount={10}
              maxTagTextLength={20}
            />
          </Form.Item>

          <Divider />

          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                type="primary"
                onClick={() => message.info('Coming soon!', 3)}
                icon={<UploadOutlined />}
              >
                Start Upload
              </Button>
            </Space>
          </div>
        </Form>
      ) : (
        // 上传进度
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ marginBottom: '24px' }}>
            {getStatusIcon()}
            <Text style={{ marginLeft: '8px', fontSize: '16px' }}>
              {uploadProgress.message}
            </Text>
          </div>

          <Progress
            percent={uploadProgress.progress}
            status={getProgressStatus()}
            strokeWidth={8}
            style={{ marginBottom: '24px' }}
          />

          {uploadProgress.status === 'success' && uploadProgress.bvid && (
            <Alert
              message="Upload Successful!"
              description={`BV号: ${uploadProgress.bvid}`}
              type="success"
              showIcon
              style={{ marginBottom: '16px' }}
            />
          )}

          {uploadProgress.status === 'failed' && uploadProgress.error && (
            <Alert
              message="Upload Failed"
              description={uploadProgress.error}
              type="error"
              showIcon
              style={{ marginBottom: '16px' }}
            />
          )}

          {uploadProgress.status === 'processing' && (
            <div style={{ color: '#666', fontSize: '14px' }}>
              <Spin size="small" style={{ marginRight: '8px' }} />
              Processing, please wait...
              {uploadRecordId && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
                  Task ID: {uploadRecordId}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: '16px' }}>
            {uploadProgress.status === 'failed' && (
              <Button
                type="primary"
                onClick={() => {
                  setUploading(false)
                  setUploadProgress({
                    status: 'pending',
                    message: 'Preparing upload...',
                    progress: 0
                  })
                }}
                style={{ marginRight: '8px' }}
              >
                Retry Upload
              </Button>
            )}
            
            <Button
              onClick={handleCancelUpload}
              disabled={uploadProgress.status === 'success'}
            >
              {uploadProgress.status === 'success' ? 'Close' : 'Cancel Upload'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default UploadModal
