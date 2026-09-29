// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​​‌​‌‍‍​‌​​​​​‌‍‍​‌​​​‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​‌‌​⁠

/**
 * 遥测 provider 维度投影 + 事件 key 去重(2026-09-30 立,吸收批次 74 票 G-977969)。
 *
 * 机制吸收自上游 ARMS 上报投影(上游 packages/ui/src/lib/planUsageArmsTelemetry.ts:26-119),
 * 白名单内容与字段名按本仓域重定义(本仓内置 provider 参见 error-attribution.ts 的
 * ihui_relay/zhipu 与 user-llm-configs.ts 的 openai 模板码),未复制上游协议字段。
 *
 * 三条纪律:
 * 1. 投影只改写"上报值"——事件是否发送仍由调用处用原始 providerId 判闸门
 *    (hasReportableProvider),本地日志保留原值(logProviderValue);
 * 2. 自定义命名 provider 的 id/模型名由用户命名,原样上报会泄漏私有名并制造
 *    高基数维度 → 归一 'custom',模型维度不下发;
 * 3. 'unknown' 兜底表达"协议事件没带 provider",是既有独立计数口径,不得并入
 *    'custom';该口径下模型名按自身卫生化判据保留可用维度。
 */

export const TELEMETRY_PROVIDER_CUSTOM = 'custom'
export const TELEMETRY_PROVIDER_UNKNOWN = 'unknown'

/**
 * 内置 provider 白名单:上报保留稳定 id。
 * 收录本仓内置接入的稳定 provider 标识;新增内置接入时在此扩充。
 */
export const BUILTIN_TELEMETRY_PROVIDER_IDS: readonly string[] = [
  'ihui_relay',
  'zhipu',
  'openai',
  'anthropic',
  'deepseek',
]

const BUILTIN_PROVIDER_ID_SET: ReadonlySet<string> = new Set(BUILTIN_TELEMETRY_PROVIDER_IDS)

/** 模型维度卫生化:去首尾空白;空白结果不下发(避免空串维度)。 */
export function sanitizeModelDimension(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

export interface ProviderTelemetryProjection {
  /** 上报用 provider id(投影后)。 */
  providerId: string
  /** 上报用 provider 口径域(与 id 同源,供数仓分桶)。 */
  providerScope: string
  /** 上报用模型名;自定义命名 provider 下不下发(undefined)。 */
  modelName?: string
}

/**
 * provider/model 的上报投影。
 * - 空值 → unknown 兜底(独立口径);
 * - 白名单内 → 保留稳定 id 与模型名;
 * - 其余(用户自定义命名)→ 归一 custom,模型维度丢弃防泄漏私有名。
 */
export function projectTelemetryProvider(
  rawProviderId: string | null | undefined,
  rawModelName?: string | null,
): ProviderTelemetryProjection {
  const providerId = rawProviderId?.trim() ?? ''
  if (!providerId) {
    return {
      providerId: TELEMETRY_PROVIDER_UNKNOWN,
      providerScope: TELEMETRY_PROVIDER_UNKNOWN,
      modelName: sanitizeModelDimension(rawModelName),
    }
  }
  if (BUILTIN_PROVIDER_ID_SET.has(providerId)) {
    return {
      providerId,
      providerScope: providerId,
      modelName: sanitizeModelDimension(rawModelName),
    }
  }
  return {
    providerId: TELEMETRY_PROVIDER_CUSTOM,
    providerScope: TELEMETRY_PROVIDER_CUSTOM,
    modelName: undefined,
  }
}

/**
 * 发送闸门(用原始值判断,与投影分离):没有原始 provider id 就不上报,
 * 投影值只决定维度内容,不参与是否发送的决策。
 */
export function hasReportableProvider(rawProviderId: string | null | undefined): boolean {
  return Boolean(rawProviderId?.trim())
}

/** 本地日志保留原值(trim 后),不做投影——排障时需要看到用户真实配置。 */
export function logProviderValue(rawProviderId: string | null | undefined): string {
  return rawProviderId?.trim() ?? ''
}

/** 事件 key 去重容量:超出后按插入序(FIFO)淘汰最旧,非 LRU。 */
export const MAX_TRACKED_EVENT_KEYS = 2_000

export interface EventKeyDeduper {
  /** 首次出现返回 true 并登记;重复返回 false。 */
  tryClaim(eventKey: string): boolean
  /** 当前登记数量(恒 ≤ 容量)。 */
  size(): number
}

/**
 * 事件 key Set 去重器(容量上限 FIFO 淘汰)。
 * 工厂形态便于各上报域持有独立去重器,互不串桶。
 */
export function createEventKeyDeduper(capacity = MAX_TRACKED_EVENT_KEYS): EventKeyDeduper {
  const seen = new Set<string>()
  return {
    tryClaim(eventKey: string): boolean {
      if (seen.has(eventKey)) {
        return false
      }
      seen.add(eventKey)
      if (seen.size > capacity) {
        // Set 迭代序 = 插入序,取第一个即最旧。
        const oldest = seen.values().next().value
        if (typeof oldest === 'string') {
          seen.delete(oldest)
        }
      }
      return true
    },
    size: () => seen.size,
  }
}
