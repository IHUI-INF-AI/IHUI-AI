/**
 * 技能管理服务。
 *
 * 复用 clawdbot/skills.ts 的 SkillManager（内存注册 + 执行引擎），
 * 补充以下能力：
 * - 持久化：将已安装的技能导出/导入为 JSON（文件或 DB 字段）
 * - 搜索：按名称/描述/分类模糊搜索
 * - 启用/禁用：批量切换技能状态
 * - 统计：按分类、来源聚合
 *
 * 设计：本服务不重新实现技能执行逻辑，仅作为 SkillManager 的增强门面。
 */

import { getSkillManager, type SkillDefinition } from './clawdbot/skills.js'

export interface SkillSearchQuery {
  keyword?: string
  category?: string
  source?: SkillDefinition['source']
  enabledOnly?: boolean
}

export interface SkillStats {
  total: number
  enabled: number
  disabled: number
  byCategory: Record<string, number>
  bySource: Record<string, number>
}

/** 获取技能管理器单例（委托给 clawdbot/skills.ts）。 */
export function getSkills() {
  return getSkillManager()
}

/** 列出所有技能（可过滤）。 */
export function listSkills(query?: SkillSearchQuery): SkillDefinition[] {
  const manager = getSkillManager()
  let skills = manager.list()

  if (query?.category) skills = skills.filter((s) => s.category === query.category)
  if (query?.source) skills = skills.filter((s) => s.source === query.source)
  if (query?.enabledOnly) skills = skills.filter((s) => s.enabled)
  if (query?.keyword) {
    const kw = query.keyword.toLowerCase()
    skills = skills.filter(
      (s) => s.name.toLowerCase().includes(kw) || s.description.toLowerCase().includes(kw),
    )
  }
  return skills
}

/** 按分类列出技能。 */
export function listByCategory(category: string): SkillDefinition[] {
  return getSkillManager().listByCategory(category)
}

/** 安装技能（委托）。 */
export function installSkill(skill: Omit<SkillDefinition, 'installedAt'>): void {
  getSkillManager().install(skill)
}

/** 卸载技能（委托）。 */
export function uninstallSkill(name: string): boolean {
  return getSkillManager().uninstall(name)
}

/** 获取单个技能详情。 */
export function getSkill(name: string): SkillDefinition | undefined {
  return getSkillManager().get(name)
}

/** 批量启用/禁用技能。 */
export function setSkillsEnabled(
  names: string[],
  enabled: boolean,
): {
  updated: string[]
  notFound: string[]
} {
  const manager = getSkillManager()
  const updated: string[] = []
  const notFound: string[] = []

  for (const name of names) {
    const skill = manager.get(name)
    if (!skill) {
      notFound.push(name)
      continue
    }
    // 重新安装以更新 enabled 状态（SkillManager.install 会覆盖）
    manager.install({ ...skill, enabled })
    updated.push(name)
  }
  return { updated, notFound }
}

/** 执行技能（委托）。 */
export async function executeSkill(
  name: string,
  params: Record<string, unknown>,
  context?: Parameters<ReturnType<typeof getSkillManager>['execute']>[2],
) {
  return getSkillManager().execute(name, params, context)
}

/** 导出所有技能为 JSON（用于持久化/迁移）。 */
export function exportSkills(): string {
  const skills = getSkillManager().list()
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), skills }, null, 2)
}

/** 从 JSON 导入技能（跳过已存在的）。 */
export function importSkills(
  json: string,
  overwrite = false,
): {
  imported: number
  skipped: number
} {
  const manager = getSkillManager()
  const parsed = JSON.parse(json) as { skills: SkillDefinition[] }

  let imported = 0
  let skipped = 0
  for (const skill of parsed.skills) {
    const existing = manager.get(skill.name)
    if (existing && !overwrite) {
      skipped++
      continue
    }
    const { installedAt: _omit, ...rest } = skill
    void _omit
    manager.install(rest)
    imported++
  }
  return { imported, skipped }
}

/** 获取技能统计信息。 */
export function getSkillStats(): SkillStats {
  const skills = getSkillManager().list()
  const byCategory: Record<string, number> = {}
  const bySource: Record<string, number> = {}

  for (const s of skills) {
    byCategory[s.category] = (byCategory[s.category] ?? 0) + 1
    bySource[s.source] = (bySource[s.source] ?? 0) + 1
  }

  return {
    total: skills.length,
    enabled: skills.filter((s) => s.enabled).length,
    disabled: skills.filter((s) => !s.enabled).length,
    byCategory,
    bySource,
  }
}
