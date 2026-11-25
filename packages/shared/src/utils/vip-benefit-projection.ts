// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * VIP 权益行 → 权益条目的投影(跨端单一真相源)
 *
 * 服务端 `GET /member/benefits`、`GET /api/vip/benefits` 返回的是
 * `{ id, levelName, benefits }`,`benefits` 是 jsonb:可能是字符串数组,
 * 也可能是任意脏值(字符串/数字/null/未登记键)。三端此前各写一份摊平逻辑
 * (miniapp-taro `api/index.ts` 的 TRANSLATED_BENEFITS + mobile-rn 端内自拼),
 * 口径迟早漂移 —— 2026-11-22 收敛到本文件:
 *
 *  - 非数组/缺列 ⇒ 摊平成 0 行(不抛错、不造 `L3:undefined` 这种假条目);
 *  - 数组内只收非空字符串,数字与 null 丢弃;
 *  - **登记与否按本文件的键表判定**,不看 `t()` 的返回值 —— 退化语言包返回 key 时
 *    会把未登记键误判成已登记,端内就会拼出 `vip.benefitList.xxx` 这种生键;
 *  - 未登记键原样透出(与 web/miniapp 权益页同口径,不在端内另拼中文)。
 */

/** 已在 `vip.benefitList.*` 登记译名的键(五语言齐备,见 packages/i18n/messages) */
import { VIP_BENEFIT_LABELS } from '../constants/vip-benefits'

export const VIP_TRANSLATED_BENEFIT_KEYS = [
  'unlimitedChat',
  'exclusiveModel',
  'prioritySupport',
  'referral',
] as const

export type VipTranslatedBenefitKey = (typeof VIP_TRANSLATED_BENEFIT_KEYS)[number]

/**
 * 展示名解析:五语译名优先 → 中文共享标签兜底 → 原键透出。
 *
 * 2026-11-26 补的第二道兜底:库内 `benefits` 实际有 16 个键,而 `vip.benefitList.*`
 * 只登记了上面 4 个 ⇒ 其余 12 个(含 `testPaymentFlow`)此前**原样透出裸键名**,
 * 小程序 VIP 页「权益详情」实测就是这么露的。中文标签统一取自
 * `constants/vip-benefits` 的 VIP_BENEFIT_LABELS(单一真相源),端内不另拼。
 * 退化语言包会把 key 原样返回 ⇒ 同样退回中文标签,不显示 `vip.benefitList.xxx`。
 */
function benefitDisplayName(key: string, t: (k: string) => string): string {
  if (isTranslatedVipBenefitKey(key)) {
    const translated = t(`vip.benefitList.${key}`)
    if (translated && translated !== `vip.benefitList.${key}`) return translated
  }
  return VIP_BENEFIT_LABELS[key] ?? key
}

/** 会员档位行(服务端实际返回形状;`benefits` 保真为 unknown,由本文件判定) */
export interface VipLevelRow {
  id: string | number
  /** 档位名(月度会员/年度会员…);缺省则不渲染等级徽标 */
  levelName?: string | null
  /** jsonb:期望是权益键数组,脏值时按 0 条处理 */
  benefits?: unknown
}

/** 投影后的权益条目,字段对齐 @ihui/types 的 VipBenefitItem */
export interface VipBenefitProjectionItem {
  id: string
  name: string
  desc: string
  level?: string
}

/** 该键是否有 `vip.benefitList.*` 译名(不看 t() 返回值) */
export function isTranslatedVipBenefitKey(key: string): key is VipTranslatedBenefitKey {
  return (VIP_TRANSLATED_BENEFIT_KEYS as readonly string[]).includes(key)
}

/**
 * 把档位行摊平成权益条目。
 *
 * @param rows 服务端档位行(null/undefined 一律按空处理)
 * @param t    译名函数;只对已登记键调用,未登记键不会进 t()
 */
export function toVipBenefitItems(
  rows: readonly VipLevelRow[] | null | undefined,
  t: (key: string) => string,
): VipBenefitProjectionItem[] {
  if (!Array.isArray(rows)) return []
  return rows.flatMap((row) => {
    // `Array.isArray(unknown)` 会把元素收敛成 any[];显式声明 unknown[] 才让下面两道
    // 守卫(非字符串丢弃 / 空串丢弃)真正参与类型收敛,而不是把 any 漏进条目字段。
    const benefits: unknown[] = Array.isArray(row?.benefits) ? (row.benefits as unknown[]) : []
    const level = row?.levelName ?? undefined
    return benefits
      .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
      .map((entry) => ({
        id: `${row.id}:${entry}`,
        name: benefitDisplayName(entry, t),
        desc: '',
        ...(level ? { level } : {}),
      }))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
