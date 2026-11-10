// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 把已经归一化的运行时导出规划成可落库的行。
 *
 * 输入只认本仓解析器交出的字段（name / prompt / trigger / text）。
 * 调度器只捞 status=active 的行，所以导入的自动化一律 paused，
 * 且终态记成 manual_pause；触发串不是本仓支持的 RRULE 时不写入 rrule。
 * 没有指令正文的自动化不落库，避免把 cron 文本当成要执行的 prompt。
 * 能力声明只有名字，不生成连接器。记忆必须挂到已归属校验过的会话。
 */

export interface RuntimeImportSource {
  skills?: unknown
  automations?: unknown
  memory?: unknown
  capabilities?: unknown
}

export interface PlannedSkill {
  name: string
  prompt: string
  category: 'custom'
  scenario: 'custom'
  enabled: true
}

export interface PlannedAutomation {
  name: string
  prompt: string
  status: 'paused'
  terminalReason: 'manual_pause'
  scheduleType: 'once' | 'recurring'
  rrule: string | null
  scheduledAt: null
  nextRunAt: null
  conversationId: string | null
}

export interface PlannedMemory {
  sessionId: string
  content: string
  metadata: { importedVia: 'conversation-import' }
}

export interface RuntimeSkip {
  dimension: string
  index: number | null
  reason: string
}

export interface RuntimeImportPlan {
  skills: PlannedSkill[]
  automations: PlannedAutomation[]
  memory: PlannedMemory[]
  skipped: RuntimeSkip[]
}

const NAME_CHARS = 128
const AUTOMATION_NAME_CHARS = 200
const TEXT_CHARS = 8_000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SUPPORTED_RRULE = /^FREQ=(HOURLY|DAILY|WEEKLY)(;(BYHOUR|BYMINUTE|BYDAY)=[0-9A-Z,+-]+)*$/

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function textOf(record: Record<string, unknown>, keys: string[], limit: number): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim().slice(0, limit)
    }
  }
  return ''
}

function skip(
  plan: RuntimeImportPlan,
  dimension: string,
  index: number | null,
  reason: string,
): void {
  plan.skipped.push({ dimension, index, reason })
}

function listOf(source: RuntimeImportSource, key: keyof RuntimeImportSource): unknown[] | null {
  const value = source[key]
  if (value === undefined) return []
  return Array.isArray(value) ? value : null
}

export function planRuntimeImport(
  source: RuntimeImportSource,
  conversationId: string | null,
): RuntimeImportPlan {
  const plan: RuntimeImportPlan = { skills: [], automations: [], memory: [], skipped: [] }
  const sessionId = conversationId !== null && UUID_RE.test(conversationId) ? conversationId : null

  const skills = listOf(source, 'skills')
  if (skills === null) {
    skip(plan, 'skills', null, 'not_a_list')
  } else {
    const seen = new Set<string>()
    skills.forEach((item, index) => {
      const record = asRecord(item)
      if (!record) {
        skip(plan, 'skills', index, 'not_object')
        return
      }
      const name = textOf(record, ['name'], NAME_CHARS)
      const prompt = textOf(record, ['prompt'], TEXT_CHARS)
      if (!name || !prompt) {
        skip(plan, 'skills', index, 'missing_name_or_prompt')
        return
      }
      if (seen.has(name)) {
        skip(plan, 'skills', index, 'duplicate_name')
        return
      }
      seen.add(name)
      plan.skills.push({ name, prompt, category: 'custom', scenario: 'custom', enabled: true })
    })
  }

  const automations = listOf(source, 'automations')
  if (automations === null) {
    skip(plan, 'automations', null, 'not_a_list')
  } else {
    automations.forEach((item, index) => {
      const record = asRecord(item)
      if (!record) {
        skip(plan, 'automations', index, 'not_object')
        return
      }
      const name = textOf(record, ['name'], AUTOMATION_NAME_CHARS)
      const prompt = textOf(record, ['prompt'], TEXT_CHARS)
      const trigger = textOf(record, ['trigger'], 500)
      if (!name || !prompt) {
        skip(plan, 'automations', index, 'missing_prompt')
        return
      }
      const mapped = SUPPORTED_RRULE.test(trigger)
      plan.automations.push({
        name,
        prompt,
        status: 'paused',
        terminalReason: 'manual_pause',
        scheduleType: mapped ? 'recurring' : 'once',
        rrule: mapped ? trigger : null,
        scheduledAt: null,
        nextRunAt: null,
        conversationId: sessionId,
      })
      if (trigger && !mapped) skip(plan, 'automations', index, 'schedule_unmapped')
    })
  }

  const memory = listOf(source, 'memory')
  if (memory === null) {
    skip(plan, 'memory', null, 'not_a_list')
  } else if (memory.length > 0 && sessionId === null) {
    skip(plan, 'memory', null, 'needs_conversation')
  } else if (sessionId !== null) {
    memory.forEach((item, index) => {
      const record = asRecord(item)
      const content = record ? textOf(record, ['text'], TEXT_CHARS) : ''
      if (!content) {
        skip(plan, 'memory', index, 'missing_text')
        return
      }
      plan.memory.push({
        sessionId,
        content,
        metadata: { importedVia: 'conversation-import' },
      })
    })
  }

  const capabilities = listOf(source, 'capabilities')
  if (capabilities === null) {
    skip(plan, 'capabilities', null, 'not_a_list')
  } else {
    capabilities.forEach((item, index) => {
      skip(plan, 'capabilities', index, asRecord(item) ? 'declaration_only' : 'not_object')
    })
  }

  return plan
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
