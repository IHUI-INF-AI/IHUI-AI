/**
 * AI 能力文档服务。
 *
 * 为每个 AI 能力自动生成/管理文档：
 * - 自动生成：基于 capability schema + example 生成 API 文档
 * - Markdown 渲染：输出 markdown 格式，前端可直接渲染
 * - 多语言：中文/英文双语
 * - 版本化：保留历史版本（内存存储，简化版）
 */

import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { aiCapabilities } from '@ihui/database'

export type DocLanguage = 'zh' | 'en'

export interface CapabilityDoc {
  capabilityId: string
  name: string
  version: string
  language: DocLanguage
  markdown: string
  generatedAt: Date
}

const docVersions = new Map<string, CapabilityDoc[]>() // capabilityId -> 历史版本

/** 生成能力文档（Markdown）。 */
export async function generateDoc(
  capabilityId: string,
  language: DocLanguage = 'zh',
): Promise<CapabilityDoc> {
  const [cap] = await db.select().from(aiCapabilities).where(eq(aiCapabilities.id, capabilityId))
  if (!cap) throw new Error(`能力 ${capabilityId} 不存在`)

  const doc: CapabilityDoc = {
    capabilityId,
    name: cap.name,
    version: cap.version,
    language,
    markdown: renderMarkdown(cap, language),
    generatedAt: new Date(),
  }

  // 保留历史版本（最多 10 个）
  const history = docVersions.get(capabilityId) ?? []
  history.unshift(doc)
  if (history.length > 10) history.pop()
  docVersions.set(capabilityId, history)

  return doc
}

/** 获取最新的文档。 */
export async function getDoc(
  capabilityId: string,
  language: DocLanguage = 'zh',
): Promise<CapabilityDoc | null> {
  const history = docVersions.get(capabilityId)
  if (history && history.length > 0) {
    return history[0]!
  }
  return generateDoc(capabilityId, language)
}

/** 列出历史版本。 */
export function listDocVersions(capabilityId: string): CapabilityDoc[] {
  return docVersions.get(capabilityId) ?? []
}

/** 渲染 Markdown。 */
function renderMarkdown(
  cap: {
    name: string
    displayName: string
    category: string
    provider: string
    version: string
    description: string | null
    status: string
    capabilitySchema: unknown
    inputExample: unknown
    outputExample: unknown
    avgLatencyMs: number | null
    avgCostUsd: number | null
  },
  language: DocLanguage,
): string {
  const t = translations[language]
  const lines: string[] = []
  lines.push(`# ${cap.displayName}`)
  lines.push('')
  lines.push(`> ${cap.description ?? ''}`)
  lines.push('')
  lines.push(`## ${t.basicInfo}`)
  lines.push(`- **${t.name}**: ${cap.name}`)
  lines.push(`- **${t.category}**: ${cap.category}`)
  lines.push(`- **${t.provider}**: ${cap.provider}`)
  lines.push(`- **${t.version}**: ${cap.version}`)
  lines.push(`- **${t.status}**: ${cap.status}`)
  lines.push('')

  if (cap.avgLatencyMs !== null || cap.avgCostUsd !== null) {
    lines.push(`## ${t.performance}`)
    if (cap.avgLatencyMs !== null) lines.push(`- **${t.avgLatency}**: ${cap.avgLatencyMs} ms`)
    if (cap.avgCostUsd !== null) lines.push(`- **${t.avgCost}**: $${cap.avgCostUsd.toFixed(4)}`)
    lines.push('')
  }

  lines.push(`## ${t.schema}`)
  lines.push('```json')
  lines.push(JSON.stringify(cap.capabilitySchema ?? {}, null, 2))
  lines.push('```')
  lines.push('')

  if (cap.inputExample) {
    lines.push(`## ${t.inputExample}`)
    lines.push('```json')
    lines.push(JSON.stringify(cap.inputExample, null, 2))
    lines.push('```')
    lines.push('')
  }

  if (cap.outputExample) {
    lines.push(`## ${t.outputExample}`)
    lines.push('```json')
    lines.push(JSON.stringify(cap.outputExample, null, 2))
    lines.push('```')
    lines.push('')
  }

  return lines.join('\n')
}

const translations: Record<DocLanguage, Record<string, string>> = {
  zh: {
    basicInfo: '基本信息',
    name: '名称',
    category: '分类',
    provider: '提供商',
    version: '版本',
    status: '状态',
    performance: '性能指标',
    avgLatency: '平均延迟',
    avgCost: '平均成本',
    schema: '能力 Schema',
    inputExample: '输入示例',
    outputExample: '输出示例',
  },
  en: {
    basicInfo: 'Basic Info',
    name: 'Name',
    category: 'Category',
    provider: 'Provider',
    version: 'Version',
    status: 'Status',
    performance: 'Performance',
    avgLatency: 'Avg Latency',
    avgCost: 'Avg Cost',
    schema: 'Capability Schema',
    inputExample: 'Input Example',
    outputExample: 'Output Example',
  },
}

/** 批量生成所有能力的文档（用于文档站构建）。 */
export async function generateAllDocs(language: DocLanguage = 'zh'): Promise<CapabilityDoc[]> {
  const rows = await db.select().from(aiCapabilities)
  const docs: CapabilityDoc[] = []
  for (const row of rows) {
    try {
      docs.push(await generateDoc(row.id, language))
    } catch (err) {
      console.error(`[ai-capability-docs] generate ${row.id} failed:`, (err as Error).message)
    }
  }
  return docs
}

/** 搜索文档内容（简化：扫描 markdown 文本）。 */
export async function searchDocs(
  query: string,
  language: DocLanguage = 'zh',
): Promise<Array<{ capabilityId: string; name: string; snippet: string }>> {
  const allDocs = await generateAllDocs(language)
  const lower = query.toLowerCase()
  return allDocs
    .filter((d) => d.markdown.toLowerCase().includes(lower))
    .map((d) => {
      const idx = d.markdown.toLowerCase().indexOf(lower)
      const start = Math.max(0, idx - 30)
      const end = Math.min(d.markdown.length, idx + query.length + 50)
      return {
        capabilityId: d.capabilityId,
        name: d.name,
        snippet: `...${d.markdown.slice(start, end)}...`,
      }
    })
}
