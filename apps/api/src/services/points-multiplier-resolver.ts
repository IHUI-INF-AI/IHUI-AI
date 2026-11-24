// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 积分倍率运行时解析(2026-11-23 立,用户定案「只接后台可配置」)。
 *
 * 背景:倍率原本只由 `inferPointsMultiplier(modelId)` 按关键词推断,数据库里的
 * `ai_model_config_models.points_multiplier` 没有任何消费方,后台改了也不生效。
 * 本文件把该列接成**覆盖源**:
 *   · 有 DB 值 → 用 DB 值(0 也是合法值,表示显式免费);
 *   · 无 DB 值/坏值 → 回落关键词推断,保持现价不变。
 *
 * 读取面只认全局配置(owner_uuid IS NULL):BYOK 个人配置不应影响平台公共定价。
 * 缓存 30s,后台保存后主动失效;查询失败时回空表(继续走推断),不把定价链路拖死。
 */
import { desc, eq, isNull } from 'drizzle-orm'
import { aiModelConfig, aiModelConfigModels } from '@ihui/database'
import { dbRead } from '../db/index.js'
import {
  buildPointsMultiplierOverrideMap,
  lookupPointsMultiplierOverride,
  resolvePointsMultiplierWithOverride,
} from './points-multiplier.js'

/** 覆盖表构造/查找的纯实现住在 points-multiplier.ts,本层只做 IO 与缓存。 */
export {
  buildPointsMultiplierOverrideMap,
  lookupPointsMultiplierOverride,
  normalizePointsModelId,
  type PointsMultiplierOverrideRow,
} from './points-multiplier.js'

/** DB 覆盖表缓存时长;后台保存会主动失效,30s 只是兜底上限。 */
export const POINTS_MULTIPLIER_CACHE_TTL_MS = 30_000

let cache: { at: number; map: Map<string, number> } | null = null
let loading: Promise<Map<string, number>> | null = null

/** 主动失效(后台保存倍率后调用),下一轮请求重新读库。 */
export function invalidatePointsMultiplierOverrides(): void {
  cache = null
}

/**
 * 读全局配置模型的倍率覆盖表。查询失败/测试桩无 dbRead.select 时回空表,
 * 让调用方回落到 inferPointsMultiplier —— 定价宁可按旧口径,不可整体失灵。
 */
export async function loadPointsMultiplierOverrides(force = false): Promise<Map<string, number>> {
  if (!force && cache && Date.now() - cache.at < POINTS_MULTIPLIER_CACHE_TTL_MS) {
    return cache.map
  }
  if (loading) return loading

  loading = (async () => {
    const selectFace = (dbRead as unknown as { select?: unknown }).select
    if (typeof selectFace !== 'function') return new Map<string, number>()
    try {
      const rows = await dbRead
        .select({
          modelId: aiModelConfigModels.modelId,
          providerCode: aiModelConfig.providerCode,
          pointsMultiplier: aiModelConfigModels.pointsMultiplier,
        })
        .from(aiModelConfigModels)
        .innerJoin(aiModelConfig, eq(aiModelConfigModels.configId, aiModelConfig.id))
        .where(isNull(aiModelConfig.ownerUuid))
        .orderBy(desc(aiModelConfigModels.isRelayPublic), desc(aiModelConfigModels.updatedAt))
      return buildPointsMultiplierOverrideMap(rows)
    } catch {
      return new Map<string, number>()
    }
  })()

  try {
    const map = await loading
    cache = { at: Date.now(), map }
    return map
  } finally {
    loading = null
  }
}

/** 运行时倍率:DB 覆盖优先,否则关键词推断。 */
export async function getPointsMultiplier(modelId: string): Promise<number> {
  const map = await loadPointsMultiplierOverrides()
  return resolvePointsMultiplierWithOverride(modelId, lookupPointsMultiplierOverride(map, modelId))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
