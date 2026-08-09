import { fetchApi } from '@/lib/api'
import type { SkillMarketListResponse, SkillInstallResponse } from '@ihui/shared/skills/market'
import type { UserSkill, UserSkillListResponse, BatchUpdateForm, ImportResult } from './types'

/** 统一 API 调用(throw on error) */
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

/** 获取用户技能列表 */
export function fetchUserSkills(): Promise<UserSkillListResponse> {
  return api<UserSkillListResponse>('/api/skills')
}

/** 获取市场技能列表 */
export function fetchMarketSkills(): Promise<SkillMarketListResponse> {
  return api<SkillMarketListResponse>('/api/skills/market?page=1&pageSize=200')
}

/** 安装单个市场技能 */
export function installSkill(name: string): Promise<SkillInstallResponse> {
  return api<SkillInstallResponse>(`/api/skills/${encodeURIComponent(name)}/install`, {
    method: 'POST',
  })
}

/** 删除单个用户技能 */
export function deleteSkill(name: string): Promise<{ name: string; deleted: boolean }> {
  return api<{ name: string; deleted: boolean }>(`/api/skills/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  })
}

/** 更新单个用户技能 */
export function updateSkill(
  name: string,
  data: { version: string; tags?: string[]; description?: string },
): Promise<{ name: string; updated: boolean }> {
  return api<{ name: string; updated: boolean }>('/api/skills', {
    method: 'POST',
    body: JSON.stringify({
      name,
      version: data.version,
      tags: data.tags,
      description: data.description,
      content: 'updated',
    }),
  })
}

/** 批量安装市场技能 */
export async function batchInstallSkills(
  names: string[],
  onProgress?: (current: number, total: number, name: string) => void,
): Promise<{ success: number; failed: number; errors: string[] }> {
  const errors: string[] = []
  let success = 0
  for (let i = 0; i < names.length; i++) {
    try {
      await installSkill(names[i]!)
      success++
      onProgress?.(i + 1, names.length, names[i]!)
    } catch (err) {
      errors.push(`${names[i]}: ${err instanceof Error ? err.message : String(err)}`)
      onProgress?.(i + 1, names.length, names[i]!)
    }
  }
  return { success, failed: errors.length, errors }
}

/** 批量删除用户技能 */
export async function batchDeleteSkills(
  names: string[],
  onProgress?: (current: number, total: number, name: string) => void,
): Promise<{ success: number; failed: number; errors: string[] }> {
  const errors: string[] = []
  let success = 0
  for (let i = 0; i < names.length; i++) {
    try {
      await deleteSkill(names[i]!)
      success++
      onProgress?.(i + 1, names.length, names[i]!)
    } catch (err) {
      errors.push(`${names[i]}: ${err instanceof Error ? err.message : String(err)}`)
      onProgress?.(i + 1, names.length, names[i]!)
    }
  }
  return { success, failed: errors.length, errors }
}

/** 批量更新用户技能 */
export async function batchUpdateSkills(
  names: string[],
  form: BatchUpdateForm,
  existingSkills: UserSkill[],
  onProgress?: (current: number, total: number, name: string) => void,
): Promise<{ success: number; failed: number; errors: string[] }> {
  const errors: string[] = []
  let success = 0
  const tags = form.tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  for (let i = 0; i < names.length; i++) {
    try {
      const skill = existingSkills.find((s) => s.name === names[i])
      await updateSkill(names[i]!, {
        version: form.version || skill?.version || '1.0.0',
        tags: tags.length > 0 ? tags : skill?.tags,
      })
      success++
      onProgress?.(i + 1, names.length, names[i]!)
    } catch (err) {
      errors.push(`${names[i]}: ${err instanceof Error ? err.message : String(err)}`)
      onProgress?.(i + 1, names.length, names[i]!)
    }
  }
  return { success, failed: errors.length, errors }
}

/** 导出技能为 JSON 文件 */
export function exportSkillsAsJson(skills: UserSkill[]): void {
  const blob = new Blob([JSON.stringify({ skills, exportedAt: new Date().toISOString() }, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `skills-export-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** 从 JSON 文件导入技能 */
export async function importSkillsFromJson(
  file: File,
  onProgress?: (current: number, total: number, name: string) => void,
): Promise<ImportResult> {
  const text = await file.text()
  let data: { skills?: unknown[] }
  try {
    data = JSON.parse(text) as { skills?: unknown[] }
  } catch {
    return { success: 0, failed: 1, errors: ['JSON 解析失败'] }
  }

  if (!Array.isArray(data.skills) || data.skills.length === 0) {
    return { success: 0, failed: 1, errors: ['未找到 skills 数组'] }
  }

  const errors: string[] = []
  let success = 0
  for (let i = 0; i < data.skills.length; i++) {
    const raw = data.skills[i] as Record<string, unknown>
    const name = String(raw.name ?? '')
    if (!name) {
      errors.push(`第 ${i + 1} 项缺少 name`)
      continue
    }
    try {
      await api('/api/skills', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description: raw.description ? String(raw.description) : undefined,
          content: raw.content ? String(raw.content) : '',
          version: raw.version ? String(raw.version) : '1.0.0',
          license: raw.license ? String(raw.license) : 'MIT',
          source: raw.source ?? 'user',
          tags: Array.isArray(raw.tags) ? raw.tags.map(String) : undefined,
        }),
      })
      success++
      onProgress?.(i + 1, data.skills.length, name)
    } catch (err) {
      errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`)
      onProgress?.(i + 1, data.skills.length, name)
    }
  }
  return { success, failed: errors.length, errors }
}