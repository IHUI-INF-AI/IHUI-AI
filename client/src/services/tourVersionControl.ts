import { StorageManager } from '@/utils/storage'

export interface TourVersion {
  id: string
  tourId: string
  version: string
  message: string
  author: string
  timestamp: number
  data: TourVersionData
  tags: string[]
  isPublished: boolean
}

export interface TourVersionData {
  steps: TourStep[]
  config: Record<string, unknown>
  metadata: Record<string, unknown>
}

export interface TourStep {
  id: string
  title?: string
  content?: string
  target?: string
  placement?: string
  order?: number
  [key: string]: any
}

export interface TourBranch {
  id: string
  tourId: string
  name: string
  parentId: string
  createdAt: number
  updatedAt: number
  headVersionId: string
}

export interface VersionDiff {
  added: TourStep[]
  modified: { old: TourStep; new: TourStep }[]
  deleted: TourStep[]
  unchanged: TourStep[]
}

export interface MergeResult {
  success: boolean
  conflicts: MergeConflict[]
  mergedData: TourVersionData | null
}

export interface MergeConflict {
  path: string
  sourceValue: TourStep | Record<string, unknown>
  targetValue: TourStep | Record<string, unknown>
  resolved: boolean
  resolution?: 'source' | 'target' | 'custom'
  customValue?: TourStep | Record<string, unknown>
}

const VERSIONS_KEY = 'tour_versions'
const BRANCHES_KEY = 'tour_branches'
const CURRENT_VERSION_KEY = 'tour_current_version'

class TourVersionControl {
  private versions: Map<string, TourVersion> = new Map()
  private branches: Map<string, TourBranch> = new Map()
  private currentVersion: Map<string, string> = new Map()

  constructor() {
    this.load()
  }

  private load(): void {
    const versions = StorageManager.getItem<Record<string, TourVersion>>(VERSIONS_KEY)
    if (versions) {
      Object.entries(versions).forEach(([id, version]) => {
        this.versions.set(id, version)
      })
    }

    const branches = StorageManager.getItem<Record<string, TourBranch>>(BRANCHES_KEY)
    if (branches) {
      Object.entries(branches).forEach(([id, branch]) => {
        this.branches.set(id, branch)
      })
    }

    const current = StorageManager.getItem<Record<string, string>>(CURRENT_VERSION_KEY)
    if (current) {
      Object.entries(current).forEach(([tourId, versionId]) => {
        this.currentVersion.set(tourId, versionId)
      })
    }
  }

  private save(): void {
    const versionsObj: Record<string, TourVersion> = {}
    this.versions.forEach((version, id) => {
      versionsObj[id] = version
    })
    StorageManager.setItem(VERSIONS_KEY, versionsObj)

    const branchesObj: Record<string, TourBranch> = {}
    this.branches.forEach((branch, id) => {
      branchesObj[id] = branch
    })
    StorageManager.setItem(BRANCHES_KEY, branchesObj)

    const currentObj: Record<string, string> = {}
    this.currentVersion.forEach((versionId, tourId) => {
      currentObj[tourId] = versionId
    })
    StorageManager.setItem(CURRENT_VERSION_KEY, currentObj)
  }

  createVersion(
    tourId: string,
    data: TourVersionData,
    message: string,
    author: string = 'system'
  ): TourVersion {
    const lastVersion = this.getLatestVersion(tourId)
    const versionNumber = lastVersion
      ? this.incrementVersion(lastVersion.version)
      : '1.0.0'

    const version: TourVersion = {
      id: `version-${Date.now()}`,
      tourId,
      version: versionNumber,
      message,
      author,
      timestamp: Date.now(),
      data: JSON.parse(JSON.stringify(data)),
      tags: [],
      isPublished: false,
    }

    this.versions.set(version.id, version)
    this.currentVersion.set(tourId, version.id)
    this.save()

    return version
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number)
    parts[2]++
    return parts.join('.')
  }

  getVersion(versionId: string): TourVersion | undefined {
    return this.versions.get(versionId)
  }

  getVersionByNumber(tourId: string, versionNumber: string): TourVersion | undefined {
    return Array.from(this.versions.values()).find(
      v => v.tourId === tourId && v.version === versionNumber
    )
  }

  getVersions(tourId: string): TourVersion[] {
    return Array.from(this.versions.values())
      .filter(v => v.tourId === tourId)
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  getLatestVersion(tourId: string): TourVersion | undefined {
    const versions = this.getVersions(tourId)
    return versions[0]
  }

  getCurrentVersion(tourId: string): TourVersion | undefined {
    const versionId = this.currentVersion.get(tourId)
    return versionId ? this.versions.get(versionId) : undefined
  }

  checkoutVersion(tourId: string, versionId: string): TourVersionData | null {
    const version = this.versions.get(versionId)
    if (!version || version.tourId !== tourId) return null

    this.currentVersion.set(tourId, versionId)
    this.save()
    return JSON.parse(JSON.stringify(version.data))
  }

  diffVersions(sourceId: string, targetId: string): VersionDiff {
    const source = this.versions.get(sourceId)
    const target = this.versions.get(targetId)

    if (!source || !target) {
      return { added: [], modified: [], deleted: [], unchanged: [] }
    }

    return this.calculateDiff(source.data, target.data)
  }

  private calculateDiff(source: TourVersionData, target: TourVersionData): VersionDiff {
    const diff: VersionDiff = { added: [], modified: [], deleted: [], unchanged: [] }

    const sourceSteps = source.steps || []
    const targetSteps = target.steps || []

    const sourceMap = new Map(sourceSteps.map(s => [s.id, s]))
    const targetMap = new Map(targetSteps.map(s => [s.id, s]))

    targetSteps.forEach(step => {
      if (!sourceMap.has(step.id)) {
        diff.added.push(step)
      } else {
        const oldStep = sourceMap.get(step.id)
        if (oldStep && JSON.stringify(oldStep) !== JSON.stringify(step)) {
          diff.modified.push({ old: oldStep, new: step })
        } else {
          diff.unchanged.push(step)
        }
      }
    })

    sourceSteps.forEach(step => {
      if (!targetMap.has(step.id)) {
        diff.deleted.push(step)
      }
    })

    return diff
  }

  createBranch(tourId: string, name: string, parentId?: string): TourBranch {
    const parent = parentId
      ? this.branches.get(parentId)
      : Array.from(this.branches.values()).find(b => b.tourId === tourId && b.name === 'main')

    const currentVersionId = this.currentVersion.get(tourId) || ''

    const branch: TourBranch = {
      id: `branch-${Date.now()}`,
      tourId,
      name,
      parentId: parent?.id || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      headVersionId: currentVersionId,
    }

    this.branches.set(branch.id, branch)
    this.save()
    return branch
  }

  getBranches(tourId: string): TourBranch[] {
    return Array.from(this.branches.values())
      .filter(b => b.tourId === tourId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  getBranch(branchId: string): TourBranch | undefined {
    return this.branches.get(branchId)
  }

  deleteBranch(branchId: string): boolean {
    const branch = this.branches.get(branchId)
    if (!branch || branch.name === 'main') return false

    this.branches.delete(branchId)
    this.save()
    return true
  }

  mergeBranch(sourceBranchId: string, targetBranchId: string): MergeResult {
    const sourceBranch = this.branches.get(sourceBranchId)
    const targetBranch = this.branches.get(targetBranchId)

    if (!sourceBranch || !targetBranch) {
      return { success: false, conflicts: [], mergedData: null }
    }

    const sourceVersion = this.versions.get(sourceBranch.headVersionId)
    const targetVersion = this.versions.get(targetBranch.headVersionId)

    if (!sourceVersion || !targetVersion) {
      return { success: false, conflicts: [], mergedData: null }
    }

    const conflicts = this.detectConflicts(sourceVersion.data, targetVersion.data)

    if (conflicts.length > 0) {
      return { success: false, conflicts, mergedData: null }
    }

    const mergedData = this.mergeData(sourceVersion.data, targetVersion.data)

    targetBranch.headVersionId = sourceBranch.headVersionId
    targetBranch.updatedAt = Date.now()
    this.save()

    return { success: true, conflicts: [], mergedData }
  }

  private detectConflicts(source: TourVersionData, target: TourVersionData): MergeConflict[] {
    const conflicts: MergeConflict[] = []

    const sourceSteps = source.steps || []
    const targetSteps = target.steps || []

    const _sourceMap = new Map(sourceSteps.map(s => [s.id, s]))
    const targetMap = new Map(targetSteps.map(s => [s.id, s]))

    sourceSteps.forEach(step => {
      const targetStep = targetMap.get(step.id)
      if (targetStep && JSON.stringify(step) !== JSON.stringify(targetStep)) {
        conflicts.push({
          path: `steps.${step.id}`,
          sourceValue: step,
          targetValue: targetStep,
          resolved: false,
        })
      }
    })

    return conflicts
  }

  private mergeData(source: TourVersionData, target: TourVersionData): TourVersionData {
    const mergedSteps: TourStep[] = []
    const sourceMap = new Map((source.steps || []).map(s => [s.id, s]))
    const _targetMap = new Map((target.steps || []).map(s => [s.id, s]))
    const mergedIds = new Set<string>()

    target.steps?.forEach(step => {
      if (!sourceMap.has(step.id)) {
        mergedSteps.push(step)
        mergedIds.add(step.id)
      }
    })

    source.steps?.forEach(step => {
      mergedSteps.push(step)
      mergedIds.add(step.id)
    })

    return {
      steps: mergedSteps,
      config: { ...target.config, ...source.config },
      metadata: { ...target.metadata, ...source.metadata },
    }
  }

  resolveConflict(
    _sourceBranchId: string,
    _targetBranchId: string,
    _conflictPath: string,
    _resolution: 'source' | 'target' | 'custom',
    _customValue?: any
  ): boolean {
    return true
  }

  tagVersion(versionId: string, tag: string): boolean {
    const version = this.versions.get(versionId)
    if (!version) return false

    if (!version.tags.includes(tag)) {
      version.tags.push(tag)
      this.save()
    }
    return true
  }

  untagVersion(versionId: string, tag: string): boolean {
    const version = this.versions.get(versionId)
    if (!version) return false

    const index = version.tags.indexOf(tag)
    if (index > -1) {
      version.tags.splice(index, 1)
      this.save()
    }
    return true
  }

  getVersionsByTag(tourId: string, tag: string): TourVersion[] {
    return this.getVersions(tourId).filter(v => v.tags.includes(tag))
  }

  publishVersion(versionId: string): boolean {
    const version = this.versions.get(versionId)
    if (!version) return false

    this.versions.forEach(v => {
      if (v.tourId === version.tourId && v.isPublished) {
        v.isPublished = false
      }
    })

    version.isPublished = true
    this.save()
    return true
  }

  unpublishVersion(versionId: string): boolean {
    const version = this.versions.get(versionId)
    if (!version) return false

    version.isPublished = false
    this.save()
    return true
  }

  getPublishedVersion(tourId: string): TourVersion | undefined {
    return this.getVersions(tourId).find(v => v.isPublished)
  }

  getVersionHistory(tourId: string): {
    versions: TourVersion[]
    branches: TourBranch[]
    currentVersionId: string | undefined
  } {
    return {
      versions: this.getVersions(tourId),
      branches: this.getBranches(tourId),
      currentVersionId: this.currentVersion.get(tourId),
    }
  }

  exportVersion(versionId: string): string {
    const version = this.versions.get(versionId)
    if (!version) return '{}'
    return JSON.stringify(version, null, 2)
  }

  importVersion(tourId: string, json: string): TourVersion | null {
    try {
      const data = JSON.parse(json)
      const version: TourVersion = {
        ...data,
        id: `version-${Date.now()}`,
        tourId,
        timestamp: Date.now(),
      }
      this.versions.set(version.id, version)
      this.save()
      return version
    } catch {
      return null
    }
  }
}

export const tourVersionControl = new TourVersionControl()
