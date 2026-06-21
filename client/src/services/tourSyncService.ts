import { StorageManager } from '@/utils/storage'

export interface SyncConfig {
  enabled: boolean
  endpoint?: string
  syncInterval: number
  lastSync: number
  deviceId: string
}

export interface SyncData {
  version: number
  deviceId: string
  timestamp: number
  data: {
    tours: Record<string, unknown>
    analytics: Record<string, unknown>
    templates: Record<string, unknown>
    settings: Record<string, unknown>
  }
  checksum: string
}

export interface SyncResult {
  success: boolean
  timestamp: number
  changes: {
    uploaded: number
    downloaded: number
    conflicts: number
  }
  error?: string
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'editor' | 'viewer'
  lastActive: number
}

export interface TeamProject {
  id: string
  name: string
  description: string
  members: TeamMember[]
  tours: string[]
  createdAt: number
  updatedAt: number
}

export interface CollaborationSession {
  id: string
  projectId: string
  tourId: string
  participants: string[]
  startTime: number
  changes: CollaborationChange[]
}

export interface CollaborationChange {
  id: string
  userId: string
  timestamp: number
  type: 'create' | 'update' | 'delete'
  target: string
  oldValue?: any
  newValue?: any
}

const SYNC_CONFIG_KEY = 'tour_sync_config'
const SYNC_HISTORY_KEY = 'tour_sync_history'
const TEAM_PROJECTS_KEY = 'tour_team_projects'

class TourSyncService {
  private config: SyncConfig
  private syncTimer: ReturnType<typeof setInterval> | null = null
  private pendingChanges: CollaborationChange[] = []
  private listeners: ((result: SyncResult) => void)[] = []

  constructor() {
    this.config = this.loadConfig()
  }

  private loadConfig(): SyncConfig {
    const stored = StorageManager.getItem<SyncConfig>(SYNC_CONFIG_KEY)
    return stored || {
      enabled: false,
      syncInterval: 5 * 60 * 1000,
      lastSync: 0,
      deviceId: this.generateDeviceId(),
    }
  }

  private saveConfig(): void {
    StorageManager.setItem(SYNC_CONFIG_KEY, this.config)
  }

  private generateDeviceId(): string {
    return `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  configure(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config }
    this.saveConfig()

    if (this.config.enabled && !this.syncTimer) {
      this.startAutoSync()
    } else if (!this.config.enabled && this.syncTimer) {
      this.stopAutoSync()
    }
  }

  getConfig(): SyncConfig {
    return { ...this.config }
  }

  private startAutoSync(): void {
    if (this.syncTimer) return
    
    this.syncTimer = setInterval(() => {
      void this.sync()
    }, this.config.syncInterval)
  }

  private stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
  }

  async sync(): Promise<SyncResult> {
    if (!this.config.enabled) {
      return {
        success: false,
        timestamp: Date.now(),
        changes: { uploaded: 0, downloaded: 0, conflicts: 0 },
        error: '同步未启用',
      }
    }

    try {
      const localData = this.collectLocalData()
      const checksum = this.calculateChecksum(localData)

      const syncData: SyncData = {
        version: 1,
        deviceId: this.config.deviceId,
        timestamp: Date.now(),
        data: localData,
        checksum,
      }

      const result = await this.performSync(syncData)
      
      this.config.lastSync = Date.now()
      this.saveConfig()

      this.listeners.forEach(listener => listener(result))
      return result
    } catch (error) {
      const result: SyncResult = {
        success: false,
        timestamp: Date.now(),
        changes: { uploaded: 0, downloaded: 0, conflicts: 0 },
        error: String(error),
      }
      this.listeners.forEach(listener => listener(result))
      return result
    }
  }

  private collectLocalData(): SyncData['data'] {
    return {
      tours: this.collectByPrefix('tour_'),
      analytics: this.collectByPrefix('tour_analytics_'),
      templates: this.collectByPrefix('tour_templates'),
      settings: this.collectByPrefix('tour_settings_'),
    }
  }

  private collectByPrefix(prefix: string): Record<string, unknown> {
    const data: Record<string, unknown> = {}
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix)) {
        const value = localStorage.getItem(key)
        if (value) {
          try {
            data[key] = JSON.parse(value)
          } catch {
            data[key] = value
          }
        }
      }
    }
    
    return data
  }

  private calculateChecksum(data: any): string {
    const str = JSON.stringify(data)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return hash.toString(16)
  }

  private async performSync(localData: SyncData): Promise<SyncResult> {
    const uploaded = Object.keys(localData.data.tours).length +
      Object.keys(localData.data.analytics).length +
      Object.keys(localData.data.templates).length

    return {
      success: true,
      timestamp: Date.now(),
      changes: {
        uploaded,
        downloaded: 0,
        conflicts: 0,
      },
    }
  }

  async backup(): Promise<{ success: boolean; data: string }> {
    const localData = this.collectLocalData()
    const backupData = {
      version: 1,
      timestamp: Date.now(),
      deviceId: this.config.deviceId,
      data: localData,
    }
    
    return {
      success: true,
      data: JSON.stringify(backupData, null, 2),
    }
  }

  async restore(backupData: string): Promise<{ success: boolean; error?: string }> {
    try {
      const parsed = JSON.parse(backupData)
      
      if (!parsed.data) {
        return { success: false, error: '无效的备份数据格式' }
      }

      Object.entries(parsed.data).forEach(([_category, items]) => {
        if (typeof items === 'object' && items !== null) {
          Object.entries(items as Record<string, unknown>).forEach(([key, value]) => {
            StorageManager.setItem(key, value)
          })
        }
      })

      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  createProject(name: string, description: string): TeamProject {
    const project: TeamProject = {
      id: `project-${Date.now()}`,
      name,
      description,
      members: [],
      tours: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const projects = this.getProjects()
    projects.push(project)
    this.saveProjects(projects)

    return project
  }

  getProjects(): TeamProject[] {
    return StorageManager.getItem<TeamProject[]>(TEAM_PROJECTS_KEY) || []
  }

  private saveProjects(projects: TeamProject[]): void {
    StorageManager.setItem(TEAM_PROJECTS_KEY, projects)
  }

  getProject(projectId: string): TeamProject | undefined {
    return this.getProjects().find(p => p.id === projectId)
  }

  updateProject(projectId: string, updates: Partial<TeamProject>): TeamProject | null {
    const projects = this.getProjects()
    const index = projects.findIndex(p => p.id === projectId)
    
    if (index === -1) return null

    projects[index] = {
      ...projects[index],
      ...updates,
      updatedAt: Date.now(),
    }
    
    this.saveProjects(projects)
    return projects[index]
  }

  deleteProject(projectId: string): boolean {
    const projects = this.getProjects()
    const index = projects.findIndex(p => p.id === projectId)
    
    if (index === -1) return false

    projects.splice(index, 1)
    this.saveProjects(projects)
    return true
  }

  addMember(projectId: string, member: Omit<TeamMember, 'id' | 'lastActive'>): TeamMember | null {
    const project = this.getProject(projectId)
    if (!project) return null

    const newMember: TeamMember = {
      ...member,
      id: `member-${Date.now()}`,
      lastActive: Date.now(),
    }

    project.members.push(newMember)
    this.updateProject(projectId, { members: project.members })

    return newMember
  }

  removeMember(projectId: string, memberId: string): boolean {
    const project = this.getProject(projectId)
    if (!project) return false

    const index = project.members.findIndex(m => m.id === memberId)
    if (index === -1) return false

    project.members.splice(index, 1)
    this.updateProject(projectId, { members: project.members })

    return true
  }

  updateMemberRole(projectId: string, memberId: string, role: TeamMember['role']): boolean {
    const project = this.getProject(projectId)
    if (!project) return false

    const member = project.members.find(m => m.id === memberId)
    if (!member) return false

    member.role = role
    this.updateProject(projectId, { members: project.members })

    return true
  }

  addTourToProject(projectId: string, tourId: string): boolean {
    const project = this.getProject(projectId)
    if (!project) return false

    if (!project.tours.includes(tourId)) {
      project.tours.push(tourId)
      this.updateProject(projectId, { tours: project.tours })
    }

    return true
  }

  removeTourFromProject(projectId: string, tourId: string): boolean {
    const project = this.getProject(projectId)
    if (!project) return false

    const index = project.tours.indexOf(tourId)
    if (index > -1) {
      project.tours.splice(index, 1)
      this.updateProject(projectId, { tours: project.tours })
    }

    return true
  }

  startCollaboration(projectId: string, tourId: string): CollaborationSession {
    const session: CollaborationSession = {
      id: `session-${Date.now()}`,
      projectId,
      tourId,
      participants: [],
      startTime: Date.now(),
      changes: [],
    }

    StorageManager.setItem(`collab_session_${session.id}`, session)
    return session
  }

  joinSession(sessionId: string, userId: string): boolean {
    const session = StorageManager.getItem<CollaborationSession>(`collab_session_${sessionId}`)
    if (!session) return false

    if (!session.participants.includes(userId)) {
      session.participants.push(userId)
      StorageManager.setItem(`collab_session_${sessionId}`, session)
    }

    return true
  }

  leaveSession(sessionId: string, userId: string): boolean {
    const session = StorageManager.getItem<CollaborationSession>(`collab_session_${sessionId}`)
    if (!session) return false

    const index = session.participants.indexOf(userId)
    if (index > -1) {
      session.participants.splice(index, 1)
      StorageManager.setItem(`collab_session_${sessionId}`, session)
    }

    return true
  }

  recordChange(sessionId: string, change: Omit<CollaborationChange, 'id' | 'timestamp'>): void {
    const session = StorageManager.getItem<CollaborationSession>(`collab_session_${sessionId}`)
    if (!session) return

    const fullChange: CollaborationChange = {
      ...change,
      id: `change-${Date.now()}`,
      timestamp: Date.now(),
    }

    session.changes.push(fullChange)
    StorageManager.setItem(`collab_session_${sessionId}`, session)

    this.pendingChanges.push(fullChange)
  }

  getSessionChanges(sessionId: string, since?: number): CollaborationChange[] {
    const session = StorageManager.getItem<CollaborationSession>(`collab_session_${sessionId}`)
    if (!session) return []

    if (since) {
      return session.changes.filter(c => c.timestamp > since)
    }
    return session.changes
  }

  endSession(sessionId: string): void {
    StorageManager.removeItem(`collab_session_${sessionId}`)
  }

  onSyncComplete(callback: (result: SyncResult) => void): () => void {
    this.listeners.push(callback)
    return () => {
      const index = this.listeners.indexOf(callback)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  getSyncHistory(): SyncResult[] {
    return StorageManager.getItem<SyncResult[]>(SYNC_HISTORY_KEY) || []
  }

  private saveSyncHistory(result: SyncResult): void {
    const history = this.getSyncHistory()
    history.push(result)
    if (history.length > 100) {
      history.shift()
    }
    StorageManager.setItem(SYNC_HISTORY_KEY, history)
  }
}

export const tourSyncService = new TourSyncService()
