/**
 * 协作与版本管理模块
 * 
 * 功能：
 * 1. 版本历史管理
 * 2. 变更追踪
 * 3. 评论系统
 * 4. 协作状态
 * 5. 冲突解决
 */

import { logger } from '@/utils/logger'
import type { SceneFragment, Character } from './DramaScriptExcel.types'

// ========== 类型定义 ==========

export interface Version {
  id: string
  version: string  // e.g., "1.0.0", "1.0.1"
  name: string
  description: string
  fragments: SceneFragment[]
  characters: Character[]
  createdAt: string
  createdBy: string
  parentVersion?: string
  tags: string[]
  isAutoSave: boolean
}

export interface ChangeRecord {
  id: string
  versionId: string
  timestamp: string
  userId: string
  userName: string
  changeType: 'create' | 'update' | 'delete' | 'reorder' | 'batch'
  entityType: 'fragment' | 'character' | 'template' | 'project'
  entityId: string
  entityName?: string
  previousValue?: any
  newValue?: any
  summary: string
}

export interface Comment {
  id: string
  fragmentId?: string
  characterId?: string
  projectLevel: boolean
  userId: string
  userName: string
  userAvatar?: string
  content: string
  createdAt: string
  updatedAt?: string
  resolved: boolean
  resolvedBy?: string
  resolvedAt?: string
  replies: Comment[]
  mentions: string[]
  reactions: Record<string, string[]>  // emoji -> userIds
}

export interface Collaborator {
  userId: string
  userName: string
  userAvatar?: string
  role: 'owner' | 'editor' | 'viewer'
  joinedAt: string
  lastActiveAt: string
  isOnline: boolean
  currentFocus?: string  // fragmentId being edited
}

export interface CollaborationSession {
  projectId: string
  projectName: string
  collaborators: Collaborator[]
  activeEdits: Map<string, string>  // fragmentId -> userId
  chatMessages: ChatMessage[]
  startedAt: string
}

export interface ChatMessage {
  id: string
  userId: string
  userName: string
  content: string
  timestamp: string
  type: 'text' | 'system' | 'notification'
}

export interface ConflictResolution {
  fragmentId: string
  localVersion: SceneFragment
  remoteVersion: SceneFragment
  resolvedVersion?: SceneFragment
  resolvedBy?: string
  resolvedAt?: string
  status: 'pending' | 'resolved' | 'rejected'
}

// ========== 版本管理 ==========

const VERSIONS_STORAGE_KEY = 'drama-script-versions'
const CHANGES_STORAGE_KEY = 'drama-script-changes'
const MAX_VERSIONS = 50
const MAX_CHANGES = 500

/**
 * 创建新版本
 */
export function createVersion(
  fragments: SceneFragment[],
  characters: Character[],
  options: {
    name?: string
    description?: string
    userId?: string
    parentVersion?: string
    tags?: string[]
    isAutoSave?: boolean
  } = {}
): Version {
  const versions = getVersions()
  const latestVersion = versions[0]
  
  // 计算新版本号
  let newVersionNumber = '1.0.0'
  if (latestVersion) {
    const parts = latestVersion.version.split('.').map(Number)
    if (options.isAutoSave) {
      parts[2]++  // 补丁版本
    } else {
      parts[1]++  // 次版本
      parts[2] = 0
    }
    newVersionNumber = parts.join('.')
  }

  const version: Version = {
    id: `ver-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    version: newVersionNumber,
    name: options.name || `版本 ${newVersionNumber}`,
    description: options.description || (options.isAutoSave ? '自动保存' : '手动保存'),
    fragments: JSON.parse(JSON.stringify(fragments)),
    characters: JSON.parse(JSON.stringify(characters)),
    createdAt: new Date().toISOString(),
    createdBy: options.userId || 'anonymous',
    parentVersion: options.parentVersion || latestVersion?.id,
    tags: options.tags || [],
    isAutoSave: options.isAutoSave ?? false,
  }

  // 保存版本
  saveVersion(version)
  
  return version
}

/**
 * 获取所有版本
 */
export function getVersions(): Version[] {
  try {
    const stored = localStorage.getItem(VERSIONS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    logger.error('Failed to get version:', error)
    return []
  }
}

/**
 * 保存版本
 */
function saveVersion(version: Version): void {
  try {
    const versions = getVersions()
    versions.unshift(version)
    
    // 限制版本数量
    if (versions.length > MAX_VERSIONS) {
      // 保留手动保存的版本，删除自动保存
      const manualVersions = versions.filter(v => !v.isAutoSave)
      const autoVersions = versions.filter(v => v.isAutoSave)
      const trimmedAuto = autoVersions.slice(0, MAX_VERSIONS - manualVersions.length)
      const finalVersions = [...manualVersions, ...trimmedAuto]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, MAX_VERSIONS)
      
      localStorage.setItem(VERSIONS_STORAGE_KEY, JSON.stringify(finalVersions))
    } else {
      localStorage.setItem(VERSIONS_STORAGE_KEY, JSON.stringify(versions))
    }
  } catch (error) {
    logger.error('Failed to save version:', error)
  }
}

/**
 * 获取版本详情
 */
export function getVersionById(versionId: string): Version | null {
  const versions = getVersions()
  return versions.find(v => v.id === versionId) || null
}

/**
 * 恢复到指定版本
 */
export function restoreVersion(versionId: string): { fragments: SceneFragment[]; characters: Character[] } | null {
  const version = getVersionById(versionId)
  if (!version) return null
  
  return {
    fragments: JSON.parse(JSON.stringify(version.fragments)),
    characters: JSON.parse(JSON.stringify(version.characters)),
  }
}

/**
 * 删除版本
 */
export function deleteVersion(versionId: string): boolean {
  try {
    const versions = getVersions()
    const filtered = versions.filter(v => v.id !== versionId)
    localStorage.setItem(VERSIONS_STORAGE_KEY, JSON.stringify(filtered))
    return true
  } catch (error) {
    logger.error('Failed to delete version:', error)
    return false
  }
}

/**
 * 比较两个版本
 */
export function compareVersions(
  versionIdA: string,
  versionIdB: string
): {
  added: SceneFragment[]
  removed: SceneFragment[]
  modified: Array<{ before: SceneFragment; after: SceneFragment }>
} | null {
  const versionA = getVersionById(versionIdA)
  const versionB = getVersionById(versionIdB)
  
  if (!versionA || !versionB) return null
  
  const fragmentsA = new Map(versionA.fragments.map(f => [f.id, f]))
  const fragmentsB = new Map(versionB.fragments.map(f => [f.id, f]))
  
  const added: SceneFragment[] = []
  const removed: SceneFragment[] = []
  const modified: Array<{ before: SceneFragment; after: SceneFragment }> = []
  
  // 找出新增和修改
  for (const [id, fragmentB] of fragmentsB) {
    const fragmentA = fragmentsA.get(id)
    if (!fragmentA) {
      added.push(fragmentB)
    } else if (JSON.stringify(fragmentA) !== JSON.stringify(fragmentB)) {
      modified.push({ before: fragmentA, after: fragmentB })
    }
  }
  
  // 找出删除
  for (const [id, fragmentA] of fragmentsA) {
    if (!fragmentsB.has(id)) {
      removed.push(fragmentA)
    }
  }
  
  return { added, removed, modified }
}

// ========== 变更追踪 ==========

/**
 * 记录变更
 */
export function recordChange(change: Omit<ChangeRecord, 'id' | 'timestamp'>): void {
  try {
    const changes = getChanges()
    const record: ChangeRecord = {
      ...change,
      id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    }
    
    changes.unshift(record)
    
    // 限制记录数量
    if (changes.length > MAX_CHANGES) {
      changes.length = MAX_CHANGES
    }
    
    localStorage.setItem(CHANGES_STORAGE_KEY, JSON.stringify(changes))
  } catch (error) {
    logger.error('Failed to record changes:', error)
  }
}

/**
 * 获取变更记录
 */
export function getChanges(options?: {
  limit?: number
  entityType?: ChangeRecord['entityType']
  entityId?: string
  userId?: string
  startDate?: string
  endDate?: string
}): ChangeRecord[] {
  try {
    const stored = localStorage.getItem(CHANGES_STORAGE_KEY)
    let changes: ChangeRecord[] = stored ? JSON.parse(stored) : []
    
    if (options) {
      if (options.entityType) {
        changes = changes.filter(c => c.entityType === options.entityType)
      }
      if (options.entityId) {
        changes = changes.filter(c => c.entityId === options.entityId)
      }
      if (options.userId) {
        changes = changes.filter(c => c.userId === options.userId)
      }
      if (options.startDate) {
        changes = changes.filter(c => c.timestamp >= options.startDate!)
      }
      if (options.endDate) {
        changes = changes.filter(c => c.timestamp <= options.endDate!)
      }
      if (options.limit) {
        changes = changes.slice(0, options.limit)
      }
    }
    
    return changes
  } catch (error) {
    logger.error('Failed to get change records:', error)
    return []
  }
}

/**
 * 获取实体的变更历史
 */
export function getEntityHistory(
  entityType: ChangeRecord['entityType'],
  entityId: string
): ChangeRecord[] {
  return getChanges({ entityType, entityId })
}

/**
 * 生成变更摘要
 */
export function generateChangeSummary(
  previousFragments: SceneFragment[],
  currentFragments: SceneFragment[]
): string {
  const prevMap = new Map(previousFragments.map(f => [f.id, f]))
  const currMap = new Map(currentFragments.map(f => [f.id, f]))
  
  let added = 0
  let modified = 0
  let deleted = 0
  
  for (const [id] of currMap) {
    if (!prevMap.has(id)) added++
    else if (JSON.stringify(prevMap.get(id)) !== JSON.stringify(currMap.get(id))) modified++
  }
  
  for (const [id] of prevMap) {
    if (!currMap.has(id)) deleted++
  }
  
  const parts: string[] = []
  if (added > 0) parts.push(`新增 ${added} 个片段`)
  if (modified > 0) parts.push(`修改 ${modified} 个片段`)
  if (deleted > 0) parts.push(`删除 ${deleted} 个片段`)
  
  return parts.length > 0 ? parts.join('，') : '无变更'
}

// ========== 评论系统 ==========

const COMMENTS_STORAGE_KEY = 'drama-script-comments'

/**
 * 添加评论
 */
export function addComment(
  comment: Omit<Comment, 'id' | 'createdAt' | 'resolved' | 'replies' | 'reactions'>
): Comment {
  const newComment: Comment = {
    ...comment,
    id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    resolved: false,
    replies: [],
    reactions: {},
  }
  
  const comments = getComments()
  comments.push(newComment)
  saveComments(comments)
  
  return newComment
}

/**
 * 获取评论
 */
export function getComments(options?: {
  fragmentId?: string
  characterId?: string
  projectLevel?: boolean
  resolved?: boolean
}): Comment[] {
  try {
    const stored = localStorage.getItem(COMMENTS_STORAGE_KEY)
    let comments: Comment[] = stored ? JSON.parse(stored) : []
    
    if (options) {
      if (options.fragmentId) {
        comments = comments.filter(c => c.fragmentId === options.fragmentId)
      }
      if (options.characterId) {
        comments = comments.filter(c => c.characterId === options.characterId)
      }
      if (options.projectLevel !== undefined) {
        comments = comments.filter(c => c.projectLevel === options.projectLevel)
      }
      if (options.resolved !== undefined) {
        comments = comments.filter(c => c.resolved === options.resolved)
      }
    }
    
    return comments
  } catch (error) {
    logger.error('Failed to get comments:', error)
    return []
  }
}

/**
 * 保存评论
 */
function saveComments(comments: Comment[]): void {
  try {
    localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(comments))
  } catch (error) {
    logger.error('Failed to save comments:', error)
  }
}

/**
 * 回复评论
 */
export function replyToComment(
  parentCommentId: string,
  reply: Omit<Comment, 'id' | 'createdAt' | 'resolved' | 'replies' | 'reactions' | 'fragmentId' | 'characterId' | 'projectLevel'>
): Comment | null {
  const comments = getComments()
  const parentComment = comments.find(c => c.id === parentCommentId)
  
  if (!parentComment) return null
  
  const newReply: Comment = {
    ...reply,
    id: `reply-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    fragmentId: parentComment.fragmentId,
    characterId: parentComment.characterId,
    projectLevel: parentComment.projectLevel,
    createdAt: new Date().toISOString(),
    resolved: false,
    replies: [],
    reactions: {},
  }
  
  parentComment.replies.push(newReply)
  saveComments(comments)
  
  return newReply
}

/**
 * 解决评论
 */
export function resolveComment(
  commentId: string,
  userId: string
): boolean {
  const comments = getComments()
  const comment = comments.find(c => c.id === commentId)
  
  if (!comment) return false
  
  comment.resolved = true
  comment.resolvedBy = userId
  comment.resolvedAt = new Date().toISOString()
  
  saveComments(comments)
  return true
}

/**
 * 添加反应
 */
export function addReaction(
  commentId: string,
  userId: string,
  emoji: string
): boolean {
  const comments = getComments()
  const comment = findCommentById(comments, commentId)
  
  if (!comment) return false
  
  if (!comment.reactions[emoji]) {
    comment.reactions[emoji] = []
  }
  
  if (!comment.reactions[emoji].includes(userId)) {
    comment.reactions[emoji].push(userId)
  }
  
  saveComments(comments)
  return true
}

/**
 * 移除反应
 */
export function removeReaction(
  commentId: string,
  userId: string,
  emoji: string
): boolean {
  const comments = getComments()
  const comment = findCommentById(comments, commentId)
  
  if (!comment || !comment.reactions[emoji]) return false
  
  comment.reactions[emoji] = comment.reactions[emoji].filter(id => id !== userId)
  
  if (comment.reactions[emoji].length === 0) {
    delete comment.reactions[emoji]
  }
  
  saveComments(comments)
  return true
}

/**
 * 递归查找评论
 */
function findCommentById(comments: Comment[], id: string): Comment | null {
  for (const comment of comments) {
    if (comment.id === id) return comment
    const found = findCommentById(comment.replies, id)
    if (found) return found
  }
  return null
}

/**
 * 删除评论
 */
export function deleteComment(commentId: string): boolean {
  const comments = getComments()
  const filtered = filterOutComment(comments, commentId)
  
  if (filtered.length === comments.length) return false
  
  saveComments(filtered)
  return true
}

/**
 * 递归过滤评论
 */
function filterOutComment(comments: Comment[], id: string): Comment[] {
  return comments
    .filter(c => c.id !== id)
    .map(c => ({
      ...c,
      replies: filterOutComment(c.replies, id),
    }))
}

// ========== 协作状态 ==========

/**
 * 获取片段评论数
 */
export function getFragmentCommentCount(fragmentId: string): number {
  const comments = getComments({ fragmentId })
  return comments.reduce((count, c) => count + 1 + c.replies.length, 0)
}

/**
 * 获取未解决评论数
 */
export function getUnresolvedCommentCount(fragmentId?: string): number {
  const comments = getComments({ fragmentId, resolved: false })
  return comments.length
}

/**
 * 导出评论为报告
 */
export function exportCommentsReport(projectName: string): string {
  const comments = getComments()
  const unresolvedComments = comments.filter(c => !c.resolved)
  const resolvedComments = comments.filter(c => c.resolved)
  
  let report = `# ${projectName} - 评论报告\n\n`
  report += `生成时间: ${new Date().toLocaleString()}\n\n`
  report += `## 统计\n`
  report += `- 总评论数: ${comments.length}\n`
  report += `- 未解决: ${unresolvedComments.length}\n`
  report += `- 已解决: ${resolvedComments.length}\n\n`
  
  if (unresolvedComments.length > 0) {
    report += `## 未解决的评论\n\n`
    for (const comment of unresolvedComments) {
      report += `### ${comment.userName} (${new Date(comment.createdAt).toLocaleString()})\n`
      report += `${comment.content}\n\n`
      if (comment.replies.length > 0) {
        report += `回复:\n`
        for (const reply of comment.replies) {
          report += `  - ${reply.userName}: ${reply.content}\n`
        }
        report += '\n'
      }
    }
  }
  
  return report
}

// ========== 自动保存 ==========

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
const AUTO_SAVE_INTERVAL = 60000  // 1分钟

/**
 * 启动自动保存
 */
export function startAutoSave(
  getState: () => { fragments: SceneFragment[]; characters: Character[] },
  userId: string = 'anonymous'
): void {
  stopAutoSave()
  
  autoSaveTimer = setInterval(() => {
    const state = getState()
    createVersion(state.fragments, state.characters, {
      userId,
      isAutoSave: true,
      description: '自动保存',
    })
    logger.debug('Auto-saving version')
  }, AUTO_SAVE_INTERVAL)
}

/**
 * 停止自动保存
 */
export function stopAutoSave(): void {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer)
    autoSaveTimer = null
  }
}

/**
 * 清理旧版本
 */
export function cleanupOldVersions(keepCount: number = 20): number {
  const versions = getVersions()
  
  if (versions.length <= keepCount) return 0
  
  // 保留手动版本和最近的自动版本
  const manualVersions = versions.filter(v => !v.isAutoSave)
  const autoVersions = versions.filter(v => v.isAutoSave)
  
  const keepAutoCount = Math.max(0, keepCount - manualVersions.length)
  const keptVersions = [
    ...manualVersions,
    ...autoVersions.slice(0, keepAutoCount),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  
  const deletedCount = versions.length - keptVersions.length
  
  localStorage.setItem(VERSIONS_STORAGE_KEY, JSON.stringify(keptVersions))
  
  return deletedCount
}
