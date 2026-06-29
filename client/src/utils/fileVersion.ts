interface VersionInfo {
  version_id: string
  file_id: string
  version_number: number
  file_size: number
  checksum: string
  change_summary: string | null
  changed_by: string | null
  is_current: boolean
  created_at: string
}
export type { VersionInfo }

interface DiffResult {
  additions: number
  deletions: number
  changes: number
  from_content: string
  to_content: string
  from_content_html: string
  to_content_html: string
  changes_list: Array<{
    type: string
    line: number
    content: string
  }>
}

interface VersionComparison {
  version1: VersionInfo
  version2: VersionInfo
  size_diff: number
  checksum_match: boolean
  diff: DiffResult
  similarity: number
}

const API_BASE = '/api'

class FileVersionService {
  async createVersion(fileId: string, file: File, options: {
    changeSummary?: string
    changedBy?: string
  } = {}): Promise<VersionInfo> {
    const formData = new FormData()
    formData.append('file_id', fileId)
    formData.append('file', file)
    if (options.changeSummary) {
      formData.append('change_summary', options.changeSummary)
    }
    if (options.changedBy) {
      formData.append('changed_by', options.changedBy)
    }

    const response = await fetch(`${API_BASE}/version/create`, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error('Failed to create version')
    }

    const data = await response.json()
    return data.version
  }

  async getVersions(fileId: string): Promise<VersionInfo[]> {
    const response = await fetch(`${API_BASE}/version/list/${fileId}`)
    
    if (!response.ok) {
      throw new Error('Failed to get versions')
    }

    const data = await response.json()
    return data.versions
  }

  async getVersion(versionId: string): Promise<Blob> {
    const response = await fetch(`${API_BASE}/version/${versionId}`)
    
    if (!response.ok) {
      throw new Error('Failed to get version')
    }

    return response.blob()
  }

  async getCurrentVersion(fileId: string): Promise<VersionInfo | null> {
    const response = await fetch(`${API_BASE}/version/current/${fileId}`)
    
    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.version
  }

  async rollbackToVersion(versionId: string): Promise<VersionInfo> {
    const response = await fetch(`${API_BASE}/version/rollback/${versionId}`, {
      method: 'POST'
    })

    if (!response.ok) {
      throw new Error('Failed to rollback version')
    }

    const data = await response.json()
    return data.version
  }

  async deleteVersion(versionId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/version/${versionId}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      throw new Error('Failed to delete version')
    }
  }

  async compareVersions(fileId: string, version1: number, version2: number): Promise<VersionComparison> {
    const response = await fetch(
      `${API_BASE}/version/compare/${fileId}?version1=${version1}&version2=${version2}`
    )

    if (!response.ok) {
      throw new Error('Failed to compare versions')
    }

    const data = await response.json()
    return data.comparison
  }

  getVersionDownloadUrl(versionId: string): string {
    return `${API_BASE}/version/${versionId}`
  }
}

export const fileVersionService = new FileVersionService()

export function useFileVersion() {
  return {
    createVersion: fileVersionService.createVersion.bind(fileVersionService),
    getVersions: fileVersionService.getVersions.bind(fileVersionService),
    getVersion: fileVersionService.getVersion.bind(fileVersionService),
    getCurrentVersion: fileVersionService.getCurrentVersion.bind(fileVersionService),
    rollbackToVersion: fileVersionService.rollbackToVersion.bind(fileVersionService),
    deleteVersion: fileVersionService.deleteVersion.bind(fileVersionService),
    compareVersions: fileVersionService.compareVersions.bind(fileVersionService),
    getVersionDownloadUrl: fileVersionService.getVersionDownloadUrl.bind(fileVersionService)
  }
}
