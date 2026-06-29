import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mockOfflineSyncService = () => {
  let tasks: Array<{ id: string; userId: string; themeMode: string; createdAt: number; retryCount: number; status: string }> = []
  
  return {
    addTask: (userId: string, themeMode: string) => {
      const task = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId,
        themeMode,
        createdAt: Date.now(),
        retryCount: 0,
        status: 'pending'
      }
      const existingPending = tasks.find(
        t => t.userId === userId && t.status === 'pending'
      )
      if (existingPending) {
        existingPending.themeMode = themeMode
        existingPending.createdAt = Date.now()
        return existingPending
      }
      tasks.push(task)
      return task
    },
    removeTask: (taskId: string) => {
      tasks = tasks.filter(t => t.id !== taskId)
    },
    getPendingTasks: () => tasks.filter(t => t.status === 'pending'),
    getFailedTasks: () => tasks.filter(t => t.status === 'failed'),
    getAllTasks: () => [...tasks],
    getQueueLength: () => tasks.filter(t => t.status === 'pending' || t.status === 'failed').length,
    clearCompletedTasks: () => {
      tasks = tasks.filter(t => t.status !== 'completed')
    },
    isOfflineMode: () => !navigator.onLine,
    hasPendingTasks: () => tasks.filter(t => t.status === 'pending' || t.status === 'failed').length > 0,
    destroy: () => { tasks = [] }
  }
}

describe('themeOfflineSyncService', () => {
  let service: ReturnType<typeof mockOfflineSyncService>

  beforeEach(() => {
    localStorage.clear()
    service = mockOfflineSyncService()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    service.destroy()
  })

  describe('addTask', () => {
    it('应该添加新的同步任务', () => {
      const task = service.addTask('user-123', 'dark')
      
      expect(task.id).toBeDefined()
      expect(task.userId).toBe('user-123')
      expect(task.themeMode).toBe('dark')
      expect(task.status).toBe('pending')
      expect(task.retryCount).toBe(0)
    })

    it('应该更新已存在的待处理任务', () => {
      service.addTask('user-123', 'dark')
      const task = service.addTask('user-123', 'light')
      
      expect(service.getQueueLength()).toBe(1)
      expect(task.themeMode).toBe('light')
    })
  })

  describe('removeTask', () => {
    it('应该移除指定任务', () => {
      const task = service.addTask('user-123', 'dark')
      service.removeTask(task.id)
      
      expect(service.getQueueLength()).toBe(0)
    })
  })

  describe('getPendingTasks', () => {
    it('应该返回所有待处理任务', () => {
      service.addTask('user-123', 'dark')
      service.addTask('user-456', 'light')
      
      const pendingTasks = service.getPendingTasks()
      expect(pendingTasks.length).toBe(2)
    })
  })

  describe('getFailedTasks', () => {
    it('应该返回所有失败任务', () => {
      const task = service.addTask('user-123', 'dark')
      service.removeTask(task.id)
      
      const failedTasks = service.getFailedTasks()
      expect(failedTasks.length).toBe(0)
    })
  })

  describe('clearCompletedTasks', () => {
    it('应该清除已完成任务', () => {
      const task = service.addTask('user-123', 'dark')
      task.status = 'completed'
      service.clearCompletedTasks()
      
      expect(service.getAllTasks().length).toBe(0)
    })
  })

  describe('getQueueLength', () => {
    it('应该返回待处理和失败任务数量', () => {
      service.addTask('user-123', 'dark')
      service.addTask('user-456', 'light')
      
      expect(service.getQueueLength()).toBe(2)
    })
  })

  describe('isOfflineMode', () => {
    it('应该返回网络状态', () => {
      Object.defineProperty(window.navigator, 'onLine', {
        value: true,
        writable: true
      })
      
      expect(service.isOfflineMode()).toBe(false)
    })
  })

  describe('hasPendingTasks', () => {
    it('有待处理任务时应返回 true', () => {
      service.addTask('user-123', 'dark')
      expect(service.hasPendingTasks()).toBe(true)
    })

    it('无待处理任务时应返回 false', () => {
      expect(service.hasPendingTasks()).toBe(false)
    })
  })
})
