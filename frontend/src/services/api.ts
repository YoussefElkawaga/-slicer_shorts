import axios from 'axios'
import { Project, Clip, Collection } from '../store/useProjectStore'

// Format time function (unused, kept as reserve)

const api = axios.create({
  baseURL: '/api/v1', // FastAPI backend server address
  timeout: 300000, // Increased to 5-minute timeout
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('teamToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    console.error('API Error:', error)
    
    // Handle 429 error (system busy)
    if (error.response?.status === 429) {
      const message = error.response?.data?.detail || 'System is processing other projects, please try again later'
      error.userMessage = message
    }
    // Handle timeout error
    else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      error.userMessage = 'Request timed out. The project may still be processing in the background. Please check the project status later.'
    }
    // Handle network error
    else if (error.code === 'NETWORK_ERROR' || !error.response) {
      error.userMessage = 'Network connection failed. Please check your connection.'
    }
    // Handle server error
    else if (error.response?.status >= 500) {
      error.userMessage = 'Internal server error. Please try again later.'
    }
    
    return Promise.reject(error)
  }
)

export interface UploadFilesRequest {
  video_file: File
  srt_file?: File
  project_name: string
  video_category?: string
  shorts_duration_preset?: string
}

export interface VideoCategory {
  value: string
  name: string
  description: string
  icon: string
  color: string
}

export interface VideoCategoriesResponse {
  categories: VideoCategory[]
  default_category: string
}

export interface ProcessingStatus {
  status: 'processing' | 'completed' | 'error'
  current_step: number
  total_steps: number
  step_name: string
  progress: number
  error_message?: string
}

// Video download related interface types
export interface BilibiliVideoInfo {
  title: string
  description: string
  duration: number
  uploader: string
  upload_date: string
  view_count: number
  like_count: number
  thumbnail: string
  url: string
}

export interface BilibiliDownloadRequest {
  url: string
  project_name: string
  video_category?: string
  browser?: string
  cookies_content?: string
  shorts_duration_preset?: string
}

export interface BilibiliDownloadTask {
  id: string
  url: string
  project_name: string
  video_category?: string
  browser?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  error_message?: string
  video_info?: BilibiliVideoInfo
  project_id?: string
  created_at: string
  updated_at: string
}

// Settings API
export const settingsApi = {
  // Get system settings
  getSettings: (): Promise<any> => {
    return api.get('/settings')
  },

  // Update system settings
  updateSettings: (settings: any): Promise<any> => {
    return api.post('/settings', settings)
  },

  // Test API key
  testApiKey: (provider: string, apiKey: string, modelName: string): Promise<{ success: boolean; error?: string }> => {
    return api.post('/settings/test-api-key', { 
      provider, 
      api_key: apiKey, 
      model_name: modelName 
    })
  },

  // Get all available models
  getAvailableModels: (): Promise<any> => {
    return api.get('/settings/available-models')
  },

  // Get current provider info
  getCurrentProvider: (): Promise<any> => {
    return api.get('/settings/current-provider')
  }
}

// Project API
export const projectApi = {
  // Get video categories config
  getVideoCategories: async (): Promise<VideoCategoriesResponse> => {
    return api.get('/video-categories')
  },

  // Get all projects
  getProjects: async (): Promise<Project[]> => {
    const response = await api.get('/projects/')
    // Handle paginated response structure, return items array
    return (response as any).items || response || []
  },

  // Get a single project
  getProject: async (id: string): Promise<Project> => {
    return api.get(`/projects/${id}`)
  },

  // Upload files and create project
  uploadFiles: async (data: UploadFilesRequest): Promise<Project> => {
    const formData = new FormData()
    formData.append('video_file', data.video_file)
    if (data.srt_file) {
      formData.append('srt_file', data.srt_file)
    }
    formData.append('project_name', data.project_name)
    if (data.video_category) {
      formData.append('video_category', data.video_category)
    }
    if (data.shorts_duration_preset) {
      formData.append('shorts_duration_preset', data.shorts_duration_preset)
    }
    
    return api.post('/projects/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  // Delete project
  deleteProject: async (id: string): Promise<void> => {
    await api.delete(`/projects/${id}`)
  },

  // Start processing project
  startProcessing: async (id: string): Promise<void> => {
    await api.post(`/projects/${id}/process`)
  },

  // Retry processing project
  retryProcessing: async (id: string): Promise<void> => {
    await api.post(`/projects/${id}/retry`)
  },

  // Get processing status
  getProcessingStatus: async (id: string): Promise<ProcessingStatus> => {
    return api.get(`/projects/${id}/status`)
  },

  // Get project logs
  getProjectLogs: async (id: string, lines: number = 50): Promise<{logs: Array<{timestamp: string, module: string, level: string, message: string}>}> => {
    return api.get(`/projects/${id}/logs?lines=${lines}`)
  },

  // Get project clips
  getClips: async (projectId: string): Promise<any[]> => {
    try {
      // Only fetch data from database, no fallback to file system
      console.log('🔍 Calling clips API for project:', projectId)
      const response = await api.get(`/clips/?project_id=${projectId}`)
      console.log('📦 Raw API response:', response)
      const clips = (response as any).items || response || []
      console.log('📋 Extracted clips:', clips.length, 'clips found')
      
      // Convert backend data format to frontend expected format
      const convertedClips = clips.map((clip: any) => {
        // Convert seconds to time string format
        const formatSecondsToTime = (seconds: number) => {
          const hours = Math.floor(seconds / 3600)
          const minutes = Math.floor((seconds % 3600) / 60)
          const secs = Math.floor(seconds % 60)
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        }
        
        // Get content from metadata
        const metadata = clip.clip_metadata || {}
        
        return {
          id: clip.id,
          title: clip.title,
          generated_title: clip.title,
          start_time: formatSecondsToTime(clip.start_time),
          end_time: formatSecondsToTime(clip.end_time),
          duration: clip.duration || 0,
          final_score: clip.score || 0,
          recommend_reason: metadata.recommend_reason || '',
          outline: metadata.outline || '',
          // Only use content from metadata, avoid using description (may be transcription text)
          content: metadata.content || [],
          chunk_index: metadata.chunk_index || 0
        }
      })
      
      console.log('✅ Converted clips:', convertedClips.length, 'clips')
      console.log('📄 First clip sample:', convertedClips[0])
      return convertedClips
    } catch (error) {
      console.error('❌ Failed to get clips:', error)
      return []
    }
  },

  // Get project collections
  getCollections: async (projectId: string): Promise<any[]> => {
    try {
      // Only fetch data from database, no fallback to file system
      const response = await api.get(`/collections/?project_id=${projectId}`)
      const collections = (response as any).items || response || []
      
      // Convert backend data format to frontend expected format
      return collections.map((collection: any) => ({
        id: collection.id,
        collection_title: collection.name || collection.collection_title || '',
        collection_summary: collection.description || collection.collection_summary || '',
        clip_ids: collection.clip_ids || collection.metadata?.clip_ids || [],
        collection_type: collection.collection_type || 'ai_recommended',
        created_at: collection.created_at,
        project_id: collection.project_id,
        thumbnail_path: collection.thumbnail_path
      }))
    } catch (error) {
      console.error('Failed to get collections:', error)
      return []
    }
  },

  // Restart specific step
  restartStep: async (id: string, step: number): Promise<void> => {
    await api.post(`/projects/${id}/restart-step`, { step })
  },

  // Update clip info
  updateClip: (projectId: string, clipId: string, updates: Partial<Clip>): Promise<Clip> => {
    return api.patch(`/projects/${projectId}/clips/${clipId}`, updates)
  },

  // Update clip title
  updateClipTitle: async (clipId: string, title: string): Promise<any> => {
    return api.patch(`/clips/${clipId}/title`, { title })
  },

  // Generate clip title
  generateClipTitle: async (clipId: string): Promise<{clip_id: string, generated_title: string, success: boolean}> => {
    return api.post(`/clips/${clipId}/generate-title`)
  },

  // Create collection
  createCollection: (projectId: string, collectionData: { collection_title: string, collection_summary: string, clip_ids: string[] }): Promise<Collection> => {
    return api.post(`/collections/`, {
      project_id: projectId,
      name: collectionData.collection_title,
      description: collectionData.collection_summary,
      metadata: {
        clip_ids: collectionData.clip_ids,
        collection_type: 'manual'
      }
    })
  },

  // Update collection info
  updateCollection: (_projectId: string, collectionId: string, updates: Partial<Collection>): Promise<Collection> => {
    // If updates contain clip_ids, wrap them in metadata
    const apiUpdates: Record<string, any> = { ...updates }
    if ('clip_ids' in updates && updates.clip_ids !== undefined) {
      apiUpdates.metadata = { clip_ids: updates.clip_ids }
      delete apiUpdates.clip_ids
    }
    return api.put(`/collections/${collectionId}`, apiUpdates)
  },

  // Reorder collection clips
  reorderCollectionClips: (projectId: string, collectionId: string, clipIds: string[]): Promise<Collection> => {
    return api.patch(`/projects/${projectId}/collections/${collectionId}/reorder`, clipIds)
  },

  // Delete collection
  deleteCollection: (_projectId: string, collectionId: string): Promise<{message: string, deleted_collection: string}> => {
    return api.delete(`/collections/${collectionId}`)
  },

  // Generate collection title
  generateCollectionTitle: (collectionId: string): Promise<{collection_id: string, generated_title: string, success: boolean}> => {
    return api.post(`/collections/${collectionId}/generate-title`)
  },

  // Update collection title
  updateCollectionTitle: (collectionId: string, title: string): Promise<{collection_id: string, title: string, success: boolean}> => {
    return api.put(`/collections/${collectionId}/title`, { title })
  },

  // Download clip video
  downloadClip: (_projectId: string, clipId: string): Promise<Blob> => {
    return api.get(`/files/projects/${_projectId}/clips/${clipId}`, {
      responseType: 'blob'
    })
  },

  // Download collection video
  downloadCollection: (projectId: string, collectionId: string): Promise<Blob> => {
    return api.get(`/files/projects/${projectId}/collections/${collectionId}`, {
      responseType: 'blob'
    })
  },

  // Export metadata
  exportMetadata: (projectId: string): Promise<Blob> => {
    return api.get(`/projects/${projectId}/export`, {
      responseType: 'blob'
    })
  },

  // Generate collection video
  generateCollectionVideo: (projectId: string, collectionId: string) => {
    return api.post(`/projects/${projectId}/collections/${collectionId}/generate`)
  },

  downloadVideo: async (projectId: string, clipId?: string, collectionId?: string) => {
    let url = `/projects/${projectId}/download`
    if (clipId) {
      url += `?clip_id=${clipId}`
    } else if (collectionId) {
      url += `?collection_id=${collectionId}`
    }
    
    try {
      const token = localStorage.getItem('teamToken');
      // For blob-type responses, use axios directly instead of going through interceptors
      const response = await axios.get(`/api/v1${url}`, { 
        responseType: 'blob',
        headers: {
          'Accept': 'application/octet-stream',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      })
      
      // Get filename from response headers, use default name if not available
      const contentDisposition = response.headers['content-disposition']
      let filename = clipId ? `clip_${clipId}.mp4` : 
                     collectionId ? `collection_${collectionId}.mp4` : 
                     `project_${projectId}.mp4`
      
      if (contentDisposition) {
        // Try parsing RFC 6266 format filename* parameter first
        const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/)
        if (filenameStarMatch) {
          filename = decodeURIComponent(filenameStarMatch[1])
        } else {
          // Fall back to traditional filename parameter
          const filenameMatch = contentDisposition.match(/filename="([^"]+)"/)
          if (filenameMatch) {
            filename = filenameMatch[1]
          }
        }
      }
      
      // Create download link
      const blob = new Blob([response.data], { type: 'video/mp4' })
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      
      // Trigger download
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
      
      return response.data
    } catch (error) {
      console.error('Download failed:', error)
      throw error
    }
  },

  // Get project file URL
  getProjectFileUrl: (projectId: string, filename: string): string => {
    const token = localStorage.getItem('teamToken');
    return `${api.defaults.baseURL}/projects/${projectId}/files/${filename}${token ? `?token=${token}` : ''}`
  },

  // Get project video URL
  getProjectVideoUrl: (projectId: string): string => {
    const token = localStorage.getItem('teamToken');
    return `${api.defaults.baseURL}/projects/${projectId}/video${token ? `?token=${token}` : ''}`
  },

  // Get clip video URL
  getClipVideoUrl: (projectId: string, clipId: string, _clipTitle?: string): string => {
    const token = localStorage.getItem('teamToken');
    // Use projects route to get clip video
    return `/api/v1/projects/${projectId}/clips/${clipId}${token ? `?token=${token}` : ''}`
  },

  // Get collection video URL
  getCollectionVideoUrl: (projectId: string, collectionId: string): string => {
    const token = localStorage.getItem('teamToken');
    // Use files route to get collection video
    return `/api/v1/files/projects/${projectId}/collections/${collectionId}${token ? `?token=${token}` : ''}`
  },

  // Generate project thumbnail
  generateThumbnail: async (projectId: string): Promise<{success: boolean, thumbnail: string, message: string}> => {
    return api.post(`/projects/${projectId}/generate-thumbnail`)
  }
}

// Video download API
export const bilibiliApi = {
  // Parse Bilibili video info
  parseVideoInfo: async (url: string, browser?: string): Promise<{success: boolean, video_info: BilibiliVideoInfo}> => {
    const formData = new FormData()
    formData.append('url', url)
    if (browser) {
      formData.append('browser', browser)
    }
    return api.post('/bilibili/parse', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  // Parse YouTube video info
  parseYouTubeVideoInfo: async (url: string, cookies_content?: string, browser?: string): Promise<{success: boolean, video_info: BilibiliVideoInfo}> => {
    const formData = new FormData()
    formData.append('url', url)
    if (cookies_content) {
      formData.append('cookies_content', cookies_content)
    }
    if (browser) {
      formData.append('browser', browser)
    }
    return api.post('/youtube/parse', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  // Create Bilibili download task
  createDownloadTask: async (data: BilibiliDownloadRequest): Promise<BilibiliDownloadTask> => {
    return api.post('/bilibili/download', data)
  },

  // Create YouTube download task
  createYouTubeDownloadTask: async (data: BilibiliDownloadRequest): Promise<BilibiliDownloadTask> => {
    return api.post('/youtube/download', data)
  },

  // Get download task status
  getTaskStatus: async (taskId: string): Promise<BilibiliDownloadTask> => {
    return api.get(`/bilibili/tasks/${taskId}`)
  },

  // Get YouTube download task status
  getYouTubeTaskStatus: async (taskId: string): Promise<BilibiliDownloadTask> => {
    return api.get(`/youtube/tasks/${taskId}`)
  },

  // Get all download tasks
  getAllTasks: async (): Promise<BilibiliDownloadTask[]> => {
    return api.get('/bilibili/tasks')
  },

  // Get all YouTube download tasks
  getAllYouTubeTasks: async (): Promise<BilibiliDownloadTask[]> => {
    return api.get('/youtube/tasks')
  }
}

// System status API
export const systemApi = {
  // Get system status
  getSystemStatus: (): Promise<{
    current_processing_count: number
    max_concurrent_processing: number
    total_projects: number
    processing_projects: string[]
  }> => {
    return api.get('/system/status')
  }
}

export default api