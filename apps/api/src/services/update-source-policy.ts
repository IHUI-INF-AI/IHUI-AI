// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * L11 更新链路判据层(2026-11-26)。
 *
 * 桌面更新器(update_v2.rs)已有 minisign 验签与灰度桶判定,但"用哪个源下载"这一步
 * 此前没有可测判据:本地代理(如内网镜像)一旦不可用,要么整个更新卡死,要么静默换源
 * 却不告诉任何人——后者最危险,用户以为走的是受控代理,实际拉了公网源。
 *
 * 本模块把源选择做成零 IO 的纯判据,三条纪律:
 * - **签名失败即拒**:签名为 false/未知一律拒绝,绝不因源切换而绕过验签;
 * - **代理不可用 → 回退官方 + 显式告警**:告警成结构字段,调用方必须消费(不静默);
 * - **灰度通道白名单**:只允许 stable / beta / canary,非法值 fail-closed 到 stable 并告警。
 *
 * 边界(诚实):本模块只判"该用哪个源/该不该放行",不下载、不验签、不写盘。
 * Rust 侧真正按结果切源与告警属宿主接线,本票不假装运行期已接。
 */

export const UPDATE_CHANNELS = ['stable', 'beta', 'canary'] as const
export type UpdateChannel = (typeof UPDATE_CHANNELS)[number]

export interface UpdateSourceConfig {
  /** 官方源 URL(必需,非空)。 */
  readonly officialUrl: string
  /** 可选本地代理 URL;留空表示不用代理。 */
  readonly proxyUrl?: string | null
  /** 灰度通道,默认 stable。 */
  readonly channel?: string | null
}

export interface UpdateSourceDecision {
  /** 是否放行本次更新下载。签名失败或双源皆不可用时为 false。 */
  readonly allowed: boolean
  /** 实际选用的源 URL;拒绝时为 null。 */
  readonly sourceUrl: string | null
  /** 是否走了回退(代理不可用 → 官方)。 */
  readonly fallback: boolean
  /** 归一化后的通道。 */
  readonly channel: UpdateChannel
  /** 必须被消费的告警列表(空数组=无告警);allowed=false 时至少一条。 */
  readonly warnings: readonly string[]
  /** 拒绝原因;allowed=true 时为 null。 */
  readonly reason: string | null
}

export interface UpdateSourceInputs {
  /** 本地代理当前是否可达;未启用代理时忽略。 */
  readonly proxyHealthy?: boolean
  /** 安装包签名校验结果;false/未传一律 fail-closed。 */
  readonly signatureValid?: boolean
}

function normalizeChannel(raw: string | null | undefined): {
  channel: UpdateChannel
  warning: string | null
} {
  if (raw === null || raw === undefined || raw.trim() === '' || raw === 'stable') {
    return { channel: 'stable', warning: null }
  }
  const v = raw.trim().toLowerCase()
  if ((UPDATE_CHANNELS as readonly string[]).includes(v)) {
    return { channel: v as UpdateChannel, warning: null }
  }
  return {
    channel: 'stable',
    warning: `灰度通道 ${JSON.stringify(raw)} 非法,已回退 stable`,
  }
}

/**
 * 纯判据:给定源配置 + 运行态探测结果,决定用哪个源、是否放行、要告警什么。
 */
export function decideUpdateSource(
  config: UpdateSourceConfig,
  inputs: UpdateSourceInputs,
): UpdateSourceDecision {
  const warnings: string[] = []
  const { channel, warning: channelWarning } = normalizeChannel(config.channel)
  if (channelWarning) warnings.push(channelWarning)

  const deny = (reason: string): UpdateSourceDecision => ({
    allowed: false,
    sourceUrl: null,
    fallback: false,
    channel,
    warnings: [...warnings, reason],
    reason,
  })

  // 签名闸最优先:任何源都不能绕过验签。
  if (inputs.signatureValid !== true) return deny('签名校验未通过或未执行,拒绝更新')

  const official = typeof config.officialUrl === 'string' ? config.officialUrl.trim() : ''
  if (!official) return deny('官方源 URL 未配置,拒绝更新')

  const proxy = typeof config.proxyUrl === 'string' ? config.proxyUrl.trim() : ''
  if (!proxy) {
    return {
      allowed: true,
      sourceUrl: official,
      fallback: false,
      channel,
      warnings,
      reason: null,
    }
  }

  if (inputs.proxyHealthy === true) {
    return {
      allowed: true,
      sourceUrl: proxy,
      fallback: false,
      channel,
      warnings,
      reason: null,
    }
  }

  // 代理配了但不可达 → 回退官方,并留下必须消费的告警。
  warnings.push('本地代理不可用,已回退官方源并告警')
  return {
    allowed: true,
    sourceUrl: official,
    fallback: true,
    channel,
    warnings,
    reason: null,
  }
}
