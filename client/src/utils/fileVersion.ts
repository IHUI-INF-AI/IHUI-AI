export interface VersionInfo {
  version: string
  version_id?: string
  version_number?: number
  file_size?: number
  created_at?: string
  is_current?: boolean
  change_summary?: string
  createdAt?: string
  [key: string]: unknown
}

export interface CreateVersionOptions {
  changeSummary?: string
}

export function useFileVersion(): {
  getVersions: (fileId: string) => Promise<VersionInfo[]>
  createVersion: (fileId: string, file: File, options?: CreateVersionOptions) => Promise<void>
  rollbackToVersion: (versionId: string) => Promise<void>
  getVersionDownloadUrl: (versionId: string) => string
} {
  const getVersions = async (_fileId: string): Promise<VersionInfo[]> => {
    return []
  }

  const createVersion = async (
    _fileId: string,
    _file: File,
    _options?: CreateVersionOptions
  ): Promise<void> => {
  }

  const rollbackToVersion = async (_versionId: string): Promise<void> => {
  }

  const getVersionDownloadUrl = (versionId: string): string => {
    return `/api/file-versions/${versionId}/download`
  }

  return { getVersions, createVersion, rollbackToVersion, getVersionDownloadUrl }
}
