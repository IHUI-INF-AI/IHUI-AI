/**
 * AI 能力模板服务。
 *
 * 基于 ai_capability_templates 表预定义模板：
 * - 内置模板：常用 AI 能力（文本生成/图像生成/摘要）的快速创建模板
 * - 模板实例化：传入参数 → 套用模板 → 创建 ai_capabilities 实例
 * - 模板管理：CRUD + 使用次数统计
 */

import { eq, and, ilike, sql, desc, or } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { aiCapabilityTemplates, aiCapabilities, type AiCapabilityTemplate } from '@ihui/database'

export interface CreateTemplateInput {
  name: string
  category: string
  description?: string
  templateSchema?: Record<string, unknown>
  defaultPayload?: Record<string, unknown>
  tags?: string[]
  isBuiltin?: boolean
}

/** 创建模板。 */
export async function createTemplate(input: CreateTemplateInput): Promise<AiCapabilityTemplate> {
  const [row] = await db
    .insert(aiCapabilityTemplates)
    .values({
      name: input.name,
      category: input.category,
      description: input.description,
      templateSchema: input.templateSchema ?? {},
      defaultPayload: input.defaultPayload ?? {},
      tags: input.tags ?? [],
      isBuiltin: input.isBuiltin ?? false,
      useCount: 0,
    })
    .returning()
  if (!row) throw new Error('模板创建失败')
  return row
}

/** 获取模板详情。 */
export async function getTemplate(templateId: string): Promise<AiCapabilityTemplate | null> {
  const [row] = await db
    .select()
    .from(aiCapabilityTemplates)
    .where(eq(aiCapabilityTemplates.id, templateId))
  return row ?? null
}

/** 列出所有模板。 */
export async function listTemplates(filter?: {
  category?: string
  isBuiltin?: boolean
  keyword?: string
}): Promise<AiCapabilityTemplate[]> {
  const conds = []
  if (filter?.category) conds.push(eq(aiCapabilityTemplates.category, filter.category))
  if (filter?.isBuiltin !== undefined) {
    conds.push(eq(aiCapabilityTemplates.isBuiltin, filter.isBuiltin))
  }
  if (filter?.keyword) {
    conds.push(
      or(
        ilike(aiCapabilityTemplates.name, `%${filter.keyword}%`),
        ilike(aiCapabilityTemplates.description, `%${filter.keyword}%`),
      )!,
    )
  }
  return db
    .select()
    .from(aiCapabilityTemplates)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(aiCapabilityTemplates.useCount))
}

/** 按热度排序（useCount 倒序）。 */
export async function listPopular(limit = 10): Promise<AiCapabilityTemplate[]> {
  return db
    .select()
    .from(aiCapabilityTemplates)
    .orderBy(desc(aiCapabilityTemplates.useCount))
    .limit(limit)
}

/** 实例化模板为能力：套用默认 payload + 用户覆盖参数。 */
export async function instantiateTemplate(params: {
  templateId: string
  name: string
  displayName: string
  provider: string
  overrides?: Record<string, unknown>
  authorId?: string
}): Promise<string> {
  const template = await getTemplate(params.templateId)
  if (!template) throw new Error(`模板 ${params.templateId} 不存在`)

  // 合并默认 payload 与用户覆盖
  const mergedPayload = {
    ...(template.defaultPayload as Record<string, unknown>),
    ...(params.overrides ?? {}),
  }

  const [capability] = await db
    .insert(aiCapabilities)
    .values({
      name: params.name,
      displayName: params.displayName,
      category: template.category,
      provider: params.provider,
      version: '1.0.0',
      description: template.description ?? '',
      status: 'draft',
      capabilitySchema: template.templateSchema,
      inputExample: mergedPayload,
      enabled: false,
      authorId: params.authorId,
    })
    .returning()
  if (!capability) throw new Error('能力实例创建失败')

  // 模板使用次数 +1
  await db
    .update(aiCapabilityTemplates)
    .set({ useCount: sql`${aiCapabilityTemplates.useCount} + 1`, updatedAt: new Date() })
    .where(eq(aiCapabilityTemplates.id, params.templateId))

  return capability.id
}

/** 更新模板。 */
export async function updateTemplate(
  templateId: string,
  updates: Partial<Omit<AiCapabilityTemplate, 'id' | 'createdAt'>>,
): Promise<AiCapabilityTemplate> {
  const [row] = await db
    .update(aiCapabilityTemplates)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(aiCapabilityTemplates.id, templateId))
    .returning()
  if (!row) throw new Error(`模板 ${templateId} 不存在`)
  return row
}

/** 删除模板（内置模板不允许删除）。 */
export async function deleteTemplate(templateId: string): Promise<void> {
  const template = await getTemplate(templateId)
  if (!template) return
  if (template.isBuiltin) throw new Error('内置模板不允许删除')
  await db.delete(aiCapabilityTemplates).where(eq(aiCapabilityTemplates.id, templateId))
}

/** 初始化内置模板（应用启动时调用，幂等）。 */
export async function seedBuiltinTemplates(): Promise<void> {
  const builtins: CreateTemplateInput[] = [
    {
      name: 'text-generation',
      category: 'text',
      description: '通用文本生成模板，支持指令跟随与风格控制',
      templateSchema: {
        type: 'object',
        properties: { prompt: { type: 'string' }, maxTokens: { type: 'number' } },
      },
      defaultPayload: { temperature: 0.7, maxTokens: 1000 },
      tags: ['text', 'generation'],
      isBuiltin: true,
    },
    {
      name: 'image-generation',
      category: 'image',
      description: '文生图模板，支持尺寸/风格/负面提示词',
      templateSchema: {
        type: 'object',
        properties: { prompt: { type: 'string' }, size: { type: 'string' } },
      },
      defaultPayload: { size: '1024x1024', steps: 30 },
      tags: ['image', 'generation'],
      isBuiltin: true,
    },
    {
      name: 'summarization',
      category: 'text',
      description: '长文本摘要模板，输出三段式摘要',
      templateSchema: {
        type: 'object',
        properties: { content: { type: 'string' }, ratio: { type: 'number' } },
      },
      defaultPayload: { ratio: 0.3, format: 'three-part' },
      tags: ['text', 'summary'],
      isBuiltin: true,
    },
    {
      name: 'translation',
      category: 'text',
      description: '多语言翻译模板，支持术语表与风格保持',
      templateSchema: {
        type: 'object',
        properties: { content: { type: 'string' }, target: { type: 'string' } },
      },
      defaultPayload: { preserveFormatting: true, glossary: [] },
      tags: ['text', 'translation'],
      isBuiltin: true,
    },
  ]
  for (const t of builtins) {
    const [existing] = await db
      .select()
      .from(aiCapabilityTemplates)
      .where(eq(aiCapabilityTemplates.name, t.name))
    if (existing) continue
    await createTemplate(t)
  }
}
