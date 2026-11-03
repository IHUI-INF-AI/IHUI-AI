// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 设备指纹"区分度"结论的呈现层出口(G-6010 那一格的唯一实现)。
//
// 为什么要有它:服务端 `judgeFingerprintAffiliation` 已经算了 discriminating / matchedUserCount /
// withheldUserCount / note 四键并随每个列表项外发,而黑名单页的类型里一个都没接 ⇒ 管理员只看到
// "样本账号列表",看不到"这枚指纹不具区分度"。结论到不了做决定的人,和没有结论在后果上同形。
//
// 判读纪律(与 apps/api/src/routes/admin-auth-edu-routes.ts 的注释同形,不得自行放宽):
// `discriminating: true` 只说明"命中数落在单台设备的合理量级",**不等于**"这些账号共用一台设备"
// —— 哈希全程由客户端自报,谁都能抄。所以具区分度时**不出任何断言性徽章**,只在 false 时喊。
/** 列表项里与本判读相关的四键(全部可选:旧响应或其他列表复用时可能缺席)。 */
export interface FingerprintVerdictField {
  readonly type?: 'user' | 'ip' | 'device' | string
  readonly discriminating?: boolean
  readonly matchedUserCount?: number
  readonly withheldUserCount?: number
  readonly nonDiscriminationNote?: string | null
}

export interface FingerprintVerdict {
  /** 徽章文案;null = 不渲染徽章(非设备行 / 具区分度 / 字段缺席)。 */
  readonly label: string | null
  /** 成因说明(服务端原文);null = 没有可说的。 */
  readonly note: string | null
  /** 命中数是否可信地摆出来(字段缺席 ⇒ false,不得显示 0 冒充"命中 0 个")。 */
  readonly countKnown: boolean
  readonly matchedUserCount: number | null
  readonly withheldUserCount: number | null
}

const NO_VERDICT: FingerprintVerdict = {
  label: null,
  note: null,
  countKnown: false,
  matchedUserCount: null,
  withheldUserCount: null,
}

/**
 * 只认**显式** `discriminating === false`:字段缺席(旧响应/其他列表复用同一类型)一律不渲染,
 * 因为"没收到结论"与"结论是具区分度"是两件事 —— 把前者渲染成后者会替系统说一句没说过的话,
 * 而把前者渲染成"不具区分度"会凭空造出一条风控断言。
 */
export function fingerprintVerdict(item: FingerprintVerdictField): FingerprintVerdict {
  if (item.type !== 'device' || item.discriminating !== false) return NO_VERDICT
  const matched = typeof item.matchedUserCount === 'number' ? item.matchedUserCount : null
  const withheld = typeof item.withheldUserCount === 'number' ? item.withheldUserCount : null
  const parts = ['指纹不具区分度']
  if (matched !== null) parts.push(`命中 ${matched} 个账号`)
  if (withheld) parts.push(`另 ${withheld} 个未外发`)
  return {
    label: parts.join(' · '),
    note:
      typeof item.nonDiscriminationNote === 'string' && item.nonDiscriminationNote
        ? item.nonDiscriminationNote
        : null,
    countKnown: matched !== null,
    matchedUserCount: matched,
    withheldUserCount: withheld,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
