/**
 * 缓存键分析服务。
 *
 * 分析 react-query（前端）+ 服务端 Redis 缓存的键使用情况：
 * - 命中率：按 key_prefix 维度统计
 * - 冷键：长期未被访问的键（占用内存）
 * - 热键：高频访问的键（可能需要预热）
 * - 键命名规范检查：检测过长的键名/缺少前缀
 *
 * 数据来源：
 * - 服务端：通过 Redis SCAN + OBJECT FREQ/LRU 采集（要求 Redis 7+ LFU 模式）
 * - 前端：由前端定期上报 react-query cache 快照（POST /api/cache-analysis/report）
 */

export interface CacheKeyStat {
  keyPrefix: string
  totalKeys: number
  hitCount: number
  missCount: number
  hitRate: number
  avgSizeBytes: number
  lastAccessedAt: Date | null
  category: 'hot' | 'warm' | 'cold' | 'dead'
}

export interface CacheAnalysisReport {
  totalKeys: number
  totalMemoryBytes: number
  hotKeys: CacheKeyStat[]
  coldKeys: CacheKeyStat[]
  deadKeys: CacheKeyStat[]
  namingIssues: Array<{ key: string; issue: string; suggestion: string }>
  recommendations: string[]
}

const KEY_PATTERN = /^([a-z_]+):/i
const MAX_KEY_LENGTH = 200
const HOT_THRESHOLD = 1000 // 命中数
const COLD_THRESHOLD = 10 // 命中数

/** 内部统计缓存（按 key_prefix 聚合）。 */
const stats = new Map<string, CacheKeyStat>()

/** 记录一次缓存命中。 */
export function recordHit(key: string, sizeBytes = 0): void {
  const prefix = extractPrefix(key)
  const stat = stats.get(prefix) ?? createEmptyStat(prefix)
  stat.hitCount++
  stat.totalKeys = Math.max(stat.totalKeys, 1)
  stat.avgSizeBytes = (stat.avgSizeBytes * (stat.hitCount - 1) + sizeBytes) / stat.hitCount
  stat.lastAccessedAt = new Date()
  stats.set(prefix, stat)
}

/** 记录一次缓存未命中。 */
export function recordMiss(key: string): void {
  const prefix = extractPrefix(key)
  const stat = stats.get(prefix) ?? createEmptyStat(prefix)
  stat.missCount++
  stats.set(prefix, stat)
}

/** 提取键前缀（第一个冒号之前的部分）。 */
function extractPrefix(key: string): string {
  const m = KEY_PATTERN.exec(key)
  return m ? m[1]! : 'no_prefix'
}

function createEmptyStat(prefix: string): CacheKeyStat {
  return {
    keyPrefix: prefix,
    totalKeys: 0,
    hitCount: 0,
    missCount: 0,
    hitRate: 0,
    avgSizeBytes: 0,
    lastAccessedAt: null,
    category: 'warm',
  }
}

/** 重新计算所有统计的命中率和分类。 */
function recompute(): void {
  for (const stat of stats.values()) {
    const total = stat.hitCount + stat.missCount
    stat.hitRate = total > 0 ? stat.hitCount / total : 0
    if (stat.hitCount >= HOT_THRESHOLD) stat.category = 'hot'
    else if (stat.hitCount < COLD_THRESHOLD) {
      stat.category = stat.hitCount === 0 ? 'dead' : 'cold'
    } else {
      stat.category = 'warm'
    }
  }
}

/** 生成完整分析报告。 */
export function analyze(): CacheAnalysisReport {
  recompute()
  const all = Array.from(stats.values())
  const totalKeys = all.reduce((s, x) => s + x.totalKeys, 0)
  const totalMemory = all.reduce((s, x) => s + x.avgSizeBytes * x.totalKeys, 0)

  const sortedByHits = [...all].sort((a, b) => b.hitCount - a.hitCount)
  const hotKeys = sortedByHits.filter((s) => s.category === 'hot').slice(0, 20)
  const coldKeys = sortedByHits
    .filter((s) => s.category === 'cold' || s.category === 'dead')
    .slice(0, 50)
  const deadKeys = sortedByHits.filter((s) => s.category === 'dead').slice(0, 20)

  const recommendations: string[] = []
  if (deadKeys.length > 0) {
    recommendations.push(`检测到 ${deadKeys.length} 类前缀的缓存键从未命中，建议清理或调整 TTL`)
  }
  const lowHitRateKeys = all.filter((s) => s.hitRate < 0.3 && s.hitCount + s.missCount > 100)
  if (lowHitRateKeys.length > 0) {
    recommendations.push(
      `${lowHitRateKeys.length} 类前缀命中率低于 30%，建议检查缓存策略或延长 TTL`,
    )
  }

  return {
    totalKeys,
    totalMemoryBytes: Math.round(totalMemory),
    hotKeys,
    coldKeys,
    deadKeys,
    namingIssues: [],
    recommendations,
  }
}

/** 检查键命名规范。 */
export function checkNamingConvention(key: string): Array<{ issue: string; suggestion: string }> {
  const issues: Array<{ issue: string; suggestion: string }> = []
  if (key.length > MAX_KEY_LENGTH) {
    issues.push({
      issue: `键长度 ${key.length} 超过 ${MAX_KEY_LENGTH}`,
      suggestion: '使用哈希缩短键名或拆分为子键',
    })
  }
  if (!KEY_PATTERN.test(key)) {
    issues.push({
      issue: '缺少命名空间前缀（namespace:）',
      suggestion: '添加前缀，如 "user:123" 便于按业务域管理',
    })
  }
  if (key.includes(' ')) {
    issues.push({
      issue: '键包含空格',
      suggestion: '使用冒号或下划线分隔，避免空格',
    })
  }
  return issues
}

/** 批量分析键命名规范。 */
export function checkNamingBatch(
  keys: string[],
): Array<{ key: string; issues: Array<{ issue: string; suggestion: string }> }> {
  return keys
    .map((key) => {
      const issues = checkNamingConvention(key)
      return issues.length > 0 ? { key, issues } : null
    })
    .filter(
      (x): x is { key: string; issues: Array<{ issue: string; suggestion: string }> } => x !== null,
    )
}

/** 清空统计数据（主要用于测试）。 */
export function resetStats(): void {
  stats.clear()
}

/** 导出当前所有统计（用于持久化到 DB 或前端展示）。 */
export function exportStats(): CacheKeyStat[] {
  recompute()
  return Array.from(stats.values())
}

/** 接收前端上报的 react-query cache 快照并合并到统计中。 */
export function ingestReactQueryReport(
  snapshot: Array<{
    queryKey: string
    status: 'success' | 'error' | 'loading'
    dataUpdatedAt: number
  }>,
): { ingested: number } {
  let ingested = 0
  for (const item of snapshot) {
    if (item.status === 'success') {
      recordHit(item.queryKey)
    } else if (item.status === 'error' || item.status === 'loading') {
      recordMiss(item.queryKey)
    }
    ingested++
  }
  return { ingested }
}
