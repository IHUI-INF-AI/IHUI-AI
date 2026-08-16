/**
 * 模型映射服务(2026-07-31 立,P0-4 降本神器)。
 *
 * 三级映射优先级:Key 级 > 用户级 > 全局,同级别按 priority desc + created_at asc。
 * resolveModelMapping 在 v1-public.ts 调用 ai-service 前替换 model 名,
 * 实现客户端代码不变但后端成本下降(gpt-4o → deepseek-chat 降本 90%)。
 */
import { eq, and, or, isNull, desc, asc, type SQL } from 'drizzle-orm'
import { dbRead, db } from '../db/index.js'
import { aiModelMappings, type AiModelMapping, type NewAiModelMapping } from '@ihui/database'

export interface ResolveResult {
  /** 实际应调用的 model 名 */
  resolvedModel: string
  /** 是否命中映射 */
  mapped: boolean
  /** 命中的映射行(未命中时不存在) */
  mapping?: AiModelMapping
}

/**
 * 解析模型映射,返回实际应该调用的 model 名。
 * 优先级:Key 级 > 用户级 > 全局,同级别按 priority desc + created_at asc。
 * 未找到映射 → 返回原 model 名。
 */
export async function resolveModelMapping(
  model: string,
  userId?: string,
  apiKeyId?: string,
): Promise<ResolveResult> {
  // 一次查询拉取所有候选(Key 级 + 用户级 + 全局),应用层排序选择
  const rows = await dbRead
    .select()
    .from(aiModelMappings)
    .where(
      and(
        eq(aiModelMappings.sourceModel, model),
        eq(aiModelMappings.enabled, true),
        or(
          // Key 级映射
          apiKeyId ? eq(aiModelMappings.apiKeyId, apiKeyId) : undefined,
          // 用户级映射(userId 匹配 + 非 Key 级)
          userId
            ? and(eq(aiModelMappings.userId, userId), isNull(aiModelMappings.apiKeyId))
            : undefined,
          // 全局映射(userId + apiKeyId 均为 null)
          and(isNull(aiModelMappings.userId), isNull(aiModelMappings.apiKeyId)),
        ),
      ),
    )

  if (rows.length === 0) {
    return { resolvedModel: model, mapped: false }
  }

  // 防御性:JS 层过滤 enabled(与 SQL enabled=true 双保险,防 mock/重构遗漏 disabled 行)
  const enabledRows = rows.filter((r) => r.enabled)
  if (enabledRows.length === 0) {
    return { resolvedModel: model, mapped: false }
  }

  // 按优先级排序:Key 级(3) > 用户级(2) > 全局(1),同级别 priority desc + created_at asc
  enabledRows.sort((a, b) => {
    const rankA = a.apiKeyId ? 3 : a.userId ? 2 : 1
    const rankB = b.apiKeyId ? 3 : b.userId ? 2 : 1
    if (rankA !== rankB) return rankB - rankA
    const prioDiff = (b.priority ?? 0) - (a.priority ?? 0)
    if (prioDiff !== 0) return prioDiff
    return (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)
  })

  const mapping = enabledRows[0]!
  return { resolvedModel: mapping.targetModel, mapped: true, mapping }
}

/** 创建映射(admin/user 都可调) */
export async function createMapping(input: NewAiModelMapping): Promise<AiModelMapping> {
  const [row] = await db.insert(aiModelMappings).values(input).returning()
  if (!row) throw new Error('创建模型映射失败')
  return row
}

/** 列出映射(admin 看全部,user 看自己的,可筛选 scope) */
export async function listMappings(filter: {
  /** undefined=不筛选,null=全局,string=具体用户 */
  userId?: string | null
  /** undefined=不筛选,null=全局,string=具体 Key */
  apiKeyId?: string | null
  enabledOnly?: boolean
}): Promise<AiModelMapping[]> {
  const conds: SQL[] = []
  if (filter.userId !== undefined) {
    conds.push(
      filter.userId === null
        ? isNull(aiModelMappings.userId)
        : eq(aiModelMappings.userId, filter.userId),
    )
  }
  if (filter.apiKeyId !== undefined) {
    conds.push(
      filter.apiKeyId === null
        ? isNull(aiModelMappings.apiKeyId)
        : eq(aiModelMappings.apiKeyId, filter.apiKeyId),
    )
  }
  if (filter.enabledOnly) {
    conds.push(eq(aiModelMappings.enabled, true))
  }
  const query = dbRead.select().from(aiModelMappings)
  const ordered = query.orderBy(desc(aiModelMappings.priority), asc(aiModelMappings.createdAt))
  if (conds.length === 0) return ordered
  return ordered.where(and(...conds))
}
