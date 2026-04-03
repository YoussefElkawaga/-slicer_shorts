/**
 * Simplified progress state management - based on fixed stages and polling
 */

import { create } from 'zustand'

export interface SimpleProgress {
  project_id: string
  stage: string
  percent: number
  message: string
  ts: number
}

interface SimpleProgressState {
  // State data
  byId: Record<string, SimpleProgress>
  
  // Polling control
  pollingInterval: number | null
  isPolling: boolean
  
  // Actions
  upsert: (progress: SimpleProgress) => void
  startPolling: (projectIds: string[], intervalMs?: number) => void
  stopPolling: () => void
  clearProgress: (projectId: string) => void
  clearAllProgress: () => void
  
  // Getters
  getProgress: (projectId: string) => SimpleProgress | null
  getAllProgress: () => Record<string, SimpleProgress>
}

export const useSimpleProgressStore = create<SimpleProgressState>((set, get) => {
  let timer: ReturnType<typeof setInterval> | null = null

  return {
    // Initial state
    byId: {},
    pollingInterval: null,
    isPolling: false,

    // Upsert progress data
    upsert: (progress: SimpleProgress) => {
      set((state) => ({
        byId: {
          ...state.byId,
          [progress.project_id]: progress
        }
      }))
    },

    // Start polling
    startPolling: (projectIds: string[], intervalMs: number = 2000) => {
      const { stopPolling, isPolling } = get()
      
      // If already polling, stop first
      if (isPolling) {
        stopPolling()
      }

      if (projectIds.length === 0) {
        console.warn('No project IDs, skipping polling')
        return
      }

      console.log(`Starting progress polling: ${projectIds.join(', ')}`)

      // Fetch immediately
      const fetchSnapshots = async () => {
        try {
          const queryString = projectIds.map(id => `project_ids=${id}`).join('&')
          const token = localStorage.getItem('teamToken')
          const response = await fetch(`/api/v1/simple-progress/snapshot?${queryString}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
          })
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          
          const snapshots: SimpleProgress[] = await response.json()
          
          // Update state
          snapshots.forEach(snapshot => {
            console.log(`Progress update: ${snapshot.project_id} - ${snapshot.stage} (${snapshot.percent}%)`)
            get().upsert(snapshot)
          })
          
          console.log(`Polling update: ${snapshots.length} projects`)
          
        } catch (error) {
          console.error('Polling progress failed:', error)
        }
      }

      // Execute immediately
      fetchSnapshots()

      // Set up interval timer
      timer = setInterval(fetchSnapshots, intervalMs)

      set({
        isPolling: true,
        pollingInterval: intervalMs
      })
    },

    // Stop polling
    stopPolling: () => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
      
      set({
        isPolling: false,
        pollingInterval: null
      })
      
      console.log('Stopped progress polling')
    },

    // Clear progress for a single project
    clearProgress: (projectId: string) => {
      set((state) => {
        const newById = { ...state.byId }
        delete newById[projectId]
        return { byId: newById }
      })
    },

    // Clear all progress
    clearAllProgress: () => {
      set({ byId: {} })
    },

    // Get progress for a single project
    getProgress: (projectId: string) => {
      return get().byId[projectId] || null
    },

    // Get all progress
    getAllProgress: () => {
      return get().byId
    }
  }
})

// Stage display name mapping
export const STAGE_DISPLAY_NAMES: Record<string, string> = {
  'INGEST': 'Preparing',
  'SUBTITLE': 'Subtitles',
  'ANALYZE': 'Analyzing', 
  'HIGHLIGHT': 'Highlights',
  'EXPORT': 'Exporting',
  'DONE': 'Complete'
}

// Stage color mapping
export const STAGE_COLORS: Record<string, string> = {
  'INGEST': '#1890ff',      // Blue
  'SUBTITLE': '#52c41a',    // Green
  'ANALYZE': '#fa8c16',     // Orange
  'HIGHLIGHT': '#722ed1',   // Purple
  'EXPORT': '#eb2f96',      // Pink
  'DONE': '#13c2c2'         // Cyan
}

// Get stage display name
export const getStageDisplayName = (stage: string): string => {
  return STAGE_DISPLAY_NAMES[stage] || stage
}

// Get stage color
export const getStageColor = (stage: string): string => {
  return STAGE_COLORS[stage] || '#666666'
}

// Check if completed
export const isCompleted = (stage: string): boolean => {
  return stage === 'DONE'
}

// Check if failed
export const isFailed = (message: string): boolean => {
  return message.includes('failed') || message.includes('error') || message.includes('Failed') || message.includes('Error')
}
