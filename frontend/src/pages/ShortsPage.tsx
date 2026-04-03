import { useState, useEffect, useRef } from 'react'
import {
  Input,
  Button,
  Upload,
  Typography,
  Space,
  message,
  Slider,
  Tag
} from 'antd'
import {
  UploadOutlined,
  LinkOutlined,
  ThunderboltOutlined,
  VideoCameraOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  FireOutlined,
  ScissorOutlined
} from '@ant-design/icons'
import axios from 'axios'

const { Text, Title } = Typography

const API_BASE = '/api/v1/shorts'

interface ClipResult {
  clip_number: number
  filename?: string
  path?: string
  start_time: string
  end_time: string
  title: string
  hook?: string
  caption?: string
  viral_score?: number
  editing_suggestions?: Record<string, string>
  file_size_mb?: number
  status: string
  error?: string
}

interface JobStatus {
  job_id: string
  status: string
  progress: number
  message: string
  clips: ClipResult[]
  error: string | null
}

const PIPELINE_STEPS = [
  { key: 'downloading', label: 'Download', icon: '📥' },
  { key: 'transcribing', label: 'Transcribe', icon: '🎙️' },
  { key: 'analyzing', label: 'AI Analysis', icon: '🧠' },
  { key: 'cutting', label: 'Create Shorts', icon: '✂️' },
  { key: 'completed', label: 'Done', icon: '✅' }
]

export default function ShortsPage() {
  const [mode, setMode] = useState<'url' | 'file'>('url')
  const [url, setUrl] = useState('')
  const [maxClips, setMaxClips] = useState(8)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Poll for job status
  useEffect(() => {
    if (!jobId) return

    const poll = async () => {
      try {
        const res = await axios.get(`${API_BASE}/status/${jobId}`)
        setJobStatus(res.data)

        if (res.data.status === 'completed' || res.data.status === 'failed') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          if (res.data.status === 'completed') {
            message.success(`${res.data.clips.filter((c: ClipResult) => c.status === 'success').length} shorts created!`)
          }
        }
      } catch {
        console.error('Poll error')
      }
    }

    poll()
    pollingRef.current = setInterval(poll, 2000)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [jobId])

  const handleURLSubmit = async () => {
    if (!url.trim()) {
      message.error('Please enter a YouTube URL')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await axios.post(`${API_BASE}/from-url`, {
        url: url.trim(),
        max_clips: maxClips
      })
      setJobId(res.data.job_id)
      message.info('Shorts pipeline started!')
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Failed to start')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    setIsSubmitting(true)
    const formData = new FormData()
    formData.append('video_file', file)
    formData.append('max_clips', String(maxClips))

    try {
      const res = await axios.post(`${API_BASE}/from-file`, formData)
      setJobId(res.data.job_id)
      message.info('Processing your video...')
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Upload failed')
    } finally {
      setIsSubmitting(false)
    }
    return false
  }

  const handleDownloadClip = (clipIndex: number) => {
    if (!jobId) return
    window.open(`${API_BASE}/download/${jobId}/${clipIndex}`, '_blank')
  }

  const resetPipeline = () => {
    setJobId(null)
    setJobStatus(null)
    setUrl('')
    if (pollingRef.current) clearInterval(pollingRef.current)
  }

  const getStepStatus = (stepKey: string) => {
    if (!jobStatus) return 'waiting'
    const currentIdx = PIPELINE_STEPS.findIndex(s => s.key === jobStatus.status)
    const stepIdx = PIPELINE_STEPS.findIndex(s => s.key === stepKey)
    if (jobStatus.status === 'failed') return 'failed'
    if (stepIdx < currentIdx) return 'done'
    if (stepIdx === currentIdx) return 'active'
    return 'waiting'
  }

  const isProcessing = jobId && jobStatus && !['completed', 'failed'].includes(jobStatus.status)

  return (
    <div style={{
      minHeight: 'calc(100vh - 64px)',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a1a 100%)',
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            fontSize: 48,
            marginBottom: 8,
            filter: 'drop-shadow(0 0 20px rgba(102, 126, 234, 0.5))'
          }}>
            <ScissorOutlined style={{ color: '#667eea' }} />
          </div>
          <Title level={2} style={{
            color: '#ffffff',
            margin: 0,
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            AI Shorts Creator
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
            Transform any video into viral short-form content with AI
          </Text>
        </div>

        {/* Input Section — only show when no active job */}
        {!jobId && (
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.08)',
            padding: 32,
            backdropFilter: 'blur(20px)',
            marginBottom: 32
          }}>
            {/* Mode Toggle */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              <Button
                type={mode === 'url' ? 'primary' : 'default'}
                icon={<LinkOutlined />}
                onClick={() => setMode('url')}
                style={{
                  borderRadius: 12,
                  height: 44,
                  ...(mode === 'url' ? {
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    border: 'none'
                  } : {
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#ccc'
                  })
                }}
              >
                YouTube URL
              </Button>
              <Button
                type={mode === 'file' ? 'primary' : 'default'}
                icon={<UploadOutlined />}
                onClick={() => setMode('file')}
                style={{
                  borderRadius: 12,
                  height: 44,
                  ...(mode === 'file' ? {
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    border: 'none'
                  } : {
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#ccc'
                  })
                }}
              >
                Upload File
              </Button>
            </div>

            {/* URL Input */}
            {mode === 'url' && (
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                <Input
                  size="large"
                  prefix={<VideoCameraOutlined style={{ color: '#667eea' }} />}
                  placeholder="Paste YouTube URL here..."
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onPressEnter={handleURLSubmit}
                  style={{
                    borderRadius: 14,
                    height: 52,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontSize: 16
                  }}
                />
              </Space>
            )}

            {/* File Upload */}
            {mode === 'file' && (
              <Upload.Dragger
                accept=".mp4,.avi,.mov,.mkv,.webm"
                beforeUpload={(file) => handleFileUpload(file as File)}
                showUploadList={false}
                style={{
                  background: 'rgba(102, 126, 234, 0.05)',
                  border: '2px dashed rgba(102, 126, 234, 0.3)',
                  borderRadius: 16,
                  padding: '30px 20px'
                }}
              >
                <p style={{ fontSize: 40, marginBottom: 8 }}>📁</p>
                <p style={{ color: '#ccc', fontSize: 16 }}>
                  Click or drag video file here
                </p>
                <p style={{ color: '#888', fontSize: 13 }}>
                  Supports MP4, AVI, MOV, MKV, WebM
                </p>
              </Upload.Dragger>
            )}

            {/* Max Clips Slider */}
            <div style={{ marginTop: 24 }}>
              <Text style={{ color: '#ccc', fontSize: 14 }}>
                Max shorts to create: <span style={{ color: '#667eea', fontWeight: 700 }}>{maxClips}</span>
              </Text>
              <Slider
                min={1}
                max={15}
                value={maxClips}
                onChange={setMaxClips}
                trackStyle={{ background: 'linear-gradient(90deg, #667eea, #764ba2)' }}
                handleStyle={{ borderColor: '#667eea', background: '#667eea' }}
                railStyle={{ background: 'rgba(255,255,255,0.1)' }}
              />
            </div>

            {/* Submit Button */}
            {mode === 'url' && (
              <Button
                type="primary"
                size="large"
                icon={<ThunderboltOutlined />}
                loading={isSubmitting}
                onClick={handleURLSubmit}
                style={{
                  marginTop: 16,
                  width: '100%',
                  height: 56,
                  borderRadius: 16,
                  fontSize: 18,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  boxShadow: '0 8px 30px rgba(102, 126, 234, 0.3)'
                }}
              >
                Create Viral Shorts
              </Button>
            )}
          </div>
        )}

        {/* Pipeline Progress */}
        {jobStatus && (
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.08)',
            padding: 32,
            marginBottom: 32,
            backdropFilter: 'blur(20px)'
          }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 600, display: 'block', marginBottom: 20 }}>
              Pipeline Progress
            </Text>

            {/* Step indicators */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              {PIPELINE_STEPS.map((step, i) => {
                const status = getStepStatus(step.key)
                return (
                  <div key={step.key} style={{ textAlign: 'center', flex: 1, position: 'relative' }}>
                    {i > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: 20,
                        left: -50 + '%',
                        width: '100%',
                        height: 2,
                        background: status === 'done' || status === 'active'
                          ? 'linear-gradient(90deg, #667eea, #764ba2)'
                          : 'rgba(255,255,255,0.1)',
                        zIndex: 0
                      }} />
                    )}
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 8px',
                      fontSize: 20,
                      position: 'relative',
                      zIndex: 1,
                      background: status === 'done' ? 'linear-gradient(135deg, #52c41a, #389e0d)'
                        : status === 'active' ? 'linear-gradient(135deg, #667eea, #764ba2)'
                        : status === 'failed' ? '#ff4d4f'
                        : 'rgba(255,255,255,0.08)',
                      boxShadow: status === 'active' ? '0 0 20px rgba(102,126,234,0.5)' : 'none',
                      animation: status === 'active' ? 'pulse 2s infinite' : 'none'
                    }}>
                      {status === 'done' ? <CheckCircleOutlined style={{ color: '#fff', fontSize: 18 }} /> :
                       status === 'active' ? <LoadingOutlined style={{ color: '#fff', fontSize: 18 }} /> :
                       step.icon}
                    </div>
                    <Text style={{
                      color: status === 'active' ? '#667eea' : status === 'done' ? '#52c41a' : '#666',
                      fontSize: 12,
                      fontWeight: status === 'active' ? 700 : 400
                    }}>
                      {step.label}
                    </Text>
                  </div>
                )
              })}
            </div>

            {/* Progress bar */}
            <div style={{
              width: '100%',
              height: 8,
              borderRadius: 4,
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
              marginBottom: 12
            }}>
              <div style={{
                width: `${jobStatus.progress}%`,
                height: '100%',
                borderRadius: 4,
                background: jobStatus.status === 'failed'
                  ? '#ff4d4f'
                  : 'linear-gradient(90deg, #667eea, #764ba2, #f093fb)',
                transition: 'width 0.5s ease'
              }} />
            </div>

            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
              {jobStatus.message}
            </Text>

            {jobStatus.status === 'failed' && (
              <div style={{ marginTop: 16 }}>
                <Text style={{ color: '#ff4d4f', fontSize: 14 }}>
                  {jobStatus.error}
                </Text>
                <br />
                <Button
                  onClick={resetPipeline}
                  style={{
                    marginTop: 12,
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.06)',
                    color: '#ccc',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  Try Again
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {jobStatus?.clips && jobStatus.clips.length > 0 && (
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.08)',
            padding: 32,
            backdropFilter: 'blur(20px)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>
                <FireOutlined style={{ color: '#fa8c16', marginRight: 8 }} />
                Generated Shorts ({jobStatus.clips.filter(c => c.status === 'success').length})
              </Text>
              {jobStatus.status === 'completed' && (
                <Button onClick={resetPipeline} style={{
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  color: '#fff',
                  border: 'none'
                }}>
                  Create More
                </Button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {jobStatus.clips.map((clip, idx) => (
                <div key={idx} style={{
                  background: clip.status === 'success'
                    ? 'rgba(102, 126, 234, 0.06)'
                    : 'rgba(255, 77, 79, 0.06)',
                  borderRadius: 16,
                  border: `1px solid ${clip.status === 'success' ? 'rgba(102,126,234,0.15)' : 'rgba(255,77,79,0.15)'}`,
                  padding: 20,
                  transition: 'all 0.3s ease'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Tag style={{
                          background: 'linear-gradient(135deg, #667eea, #764ba2)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          fontWeight: 700
                        }}>
                          #{clip.clip_number}
                        </Tag>
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>
                          {clip.title}
                        </Text>
                        {clip.viral_score && (
                          <Tag style={{
                            background: clip.viral_score >= 8 ? 'rgba(250,140,22,0.15)' : 'rgba(255,255,255,0.06)',
                            color: clip.viral_score >= 8 ? '#fa8c16' : '#888',
                            border: 'none',
                            borderRadius: 8
                          }}>
                            <FireOutlined /> {clip.viral_score}/10
                          </Tag>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                        <Text style={{ color: '#888', fontSize: 13 }}>
                          ⏱ {clip.start_time} → {clip.end_time}
                        </Text>
                        {clip.file_size_mb && (
                          <Text style={{ color: '#888', fontSize: 13 }}>
                            📦 {clip.file_size_mb} MB
                          </Text>
                        )}
                      </div>

                      {clip.hook && (
                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontStyle: 'italic' }}>
                          Hook: "{clip.hook}"
                        </Text>
                      )}

                      {clip.caption && (
                        <div style={{ marginTop: 4 }}>
                          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                            Caption: {clip.caption}
                          </Text>
                        </div>
                      )}

                      {clip.status === 'failed' && (
                        <Text style={{ color: '#ff4d4f', fontSize: 13, marginTop: 4 }}>
                          ❌ {clip.error}
                        </Text>
                      )}
                    </div>

                    {clip.status === 'success' && (
                      <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={() => handleDownloadClip(idx)}
                        style={{
                          borderRadius: 12,
                          background: 'linear-gradient(135deg, #52c41a, #389e0d)',
                          border: 'none',
                          height: 40
                        }}
                      >
                        Download
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <LoadingOutlined style={{ fontSize: 24, color: '#667eea' }} spin />
            <Text style={{ color: '#888', display: 'block', marginTop: 8, fontSize: 13 }}>
              This may take a few minutes depending on video length...
            </Text>
          </div>
        )}
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(102, 126, 234, 0); }
          100% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0); }
        }
      `}</style>
    </div>
  )
}
