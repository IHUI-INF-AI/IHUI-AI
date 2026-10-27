// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-241 自动化终态成因的跨端判据 —— web / RN 共享屏 / RN 卡片三处消费端共用同一份。
 *
 * 职责边界(同 shared/chat/task-status.ts 的做法):这里只做"终态成因 → i18n 键后缀 +
 * 语义色调档"的纯映射,不含任何平台 API、不含样式类名、不含文案本身。
 *
 * 两张表:
 *  - AUTOMATION_TERMINAL_REASON_I18N_SUFFIXES:成因 → i18n 键后缀,与
 *    packages/i18n/messages/{web,mobile-rn}/{zh-CN,zh-TW,en,ja,ko}.json 里
 *    `automations.terminalReason.*` 的键名逐字对齐(键后缀本身不含命名空间前缀,
 *    因为 web 用 useTranslations('automations') 的作用域键、RN 用扁平键,前缀归各端)。
 *  - AUTOMATION_TERMINAL_REASON_TONES:成因 → 语义色调档。只落**档名**,色值不下沉 ——
 *    同 packages/shared/src/ui/badge-spec.ts 的规则 6(色值归端内 token,档名集合两端一致)。
 *
 * 成因词表本身**不在这里另立一份**:权威值住在 packages/api-client/src/endpoints/automations.ts
 * 的 AUTOMATION_TERMINAL_REASONS(客户端投影镜像,防漂移由成对锁
 * packages/api-client/tests/automations-terminal-reason-parity.test.ts 钉住),
 * 本模块只 import 类型(纯类型引入,编译期擦除 ⇒ 不给本包引入运行期依赖)。
 */
import type { AutomationTerminalReason } from '@ihui/api-client'

export type { AutomationTerminalReason }

/**
 * 终态徽章的语义色调档(只落档名,色值归各端 token)。
 * 四档 = 四种成因的语义色:中性 / 危险 / 警告 / 成功。
 */
export type AutomationTerminalTone = 'neutral' | 'danger' | 'warning' | 'success'

/** 成因 → i18n 键后缀(键名与 packages/i18n 的 automations.terminalReason.* 逐字对齐) */
export const AUTOMATION_TERMINAL_REASON_I18N_SUFFIXES = {
  manual_pause: 'manualPause',
  failed_permanent: 'failedPermanent',
  failed_retries_exhausted: 'failedRetriesExhausted',
  completed: 'completed',
} as const satisfies Record<AutomationTerminalReason, string>

/** 成因 → 语义色调档 */
export const AUTOMATION_TERMINAL_REASON_TONES = {
  manual_pause: 'neutral',
  failed_permanent: 'danger',
  failed_retries_exhausted: 'warning',
  completed: 'success',
} as const satisfies Record<AutomationTerminalReason, AutomationTerminalTone>

/** i18n 键后缀的字面量联合(消费端拼命名空间时保持字面量类型,避免把键名退化成 string) */
export type AutomationTerminalI18nSuffix =
  (typeof AUTOMATION_TERMINAL_REASON_I18N_SUFFIXES)[AutomationTerminalReason]

/** 终态徽章视图模型 —— 渲染层只读这两个字段,不再自行推导 */
export interface AutomationTerminalReasonView {
  /** i18n 键后缀(web `terminalReason.<suffix>` / RN `automations.terminalReason.<suffix>`) */
  i18nSuffix: AutomationTerminalI18nSuffix
  /** 语义色调档 */
  tone: AutomationTerminalTone
}

/** 按自有属性取表内值(取值不在封闭集内 ⇒ undefined,不折成默认成因) */
function lookup<T>(table: Record<AutomationTerminalReason, T>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(table, key)
    ? table[key as AutomationTerminalReason]
    : undefined
}

/**
 * 推导终态徽章视图模型。
 *
 * 返回 null 的语义 = "这一条没有终态可展示":
 *  - terminalReason 为 null/undefined(仍在排或在跑);
 *  - 取值不在封闭集内(服务端加了新成因、客户端镜像还没跟上)。
 *
 * 未知取值一律当"没有",绝不折成某个默认成因 —— 折成默认就是把"永久失败"说成"已完成"。
 */
export function deriveAutomationTerminalReason(
  reason: AutomationTerminalReason | string | null | undefined,
): AutomationTerminalReasonView | null {
  if (typeof reason !== 'string' || reason.length === 0) return null
  const suffix = lookup(AUTOMATION_TERMINAL_REASON_I18N_SUFFIXES, reason)
  const tone = lookup(AUTOMATION_TERMINAL_REASON_TONES, reason)
  if (suffix === undefined || tone === undefined) return null
  return { i18nSuffix: suffix, tone }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
