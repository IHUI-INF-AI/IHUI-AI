export interface SkillVersion {
  name: string
  version: string
  updatedAt: string
  changelog?: string
  content?: string
}

export interface SkillWithVersions {
  name: string
  versions: SkillVersion[]
}

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  text: string
}