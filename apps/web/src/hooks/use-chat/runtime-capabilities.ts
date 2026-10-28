// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D69 `runtimeSupportsInterjection` 的 web 端**能力声明读取层**(契约未定死 ⇒ 最保守消费)
//
// **为什么要有这一层**:共享层 `QueueInteractionContext.runtimeSupportsInterjection`
// 要的是一个布尔,而"当前 Runtime 是否支持插话"只能由服务端(ai-service / 网关)声明 ——
// 端上自己判就是臆造。此前 message-input.tsx 三处写死 false,注释自述"全仓尚无该能力
// 协商的生产者";本模块把"写死"换成"读声明 + 缺失回落",生产者一到即自动生效。
//
// **回落形态(零回归的保证)**:
//   · 读到**严格 boolean** ⇒ 声明生效(true 支持 / false 明确不支持,两者都是声明);
//   · 读不到 / 非 boolean(字符串 "true" / 数字 1 / undefined / 数组…) ⇒ `null` = **未声明**,
//     回落 `false` —— 与改造前写死 false 完全同形,因此能力协商落地前界面零变化。
//   · `null`(未声明)落库时**不覆盖**既有声明:一轮里后到的空帧不得把已生效的声明抹回未知。
//
// 端内不得再建第二套判定(同 D69「端内不得再建第二套」纪律);渲染层只拿 resolve 后的布尔。

import { useChatStore } from '@/stores/chat'

/** 能力声明值:`true` 支持 / `false` 明确不支持 / `null` 未声明(生产者还没说话) */
export type InterjectionDeclaration = boolean | null

/**
 * 声明载体的候选键(契约未定死 ⇒ 逐条保守探测,命中即止,不跨键合并)。
 *
 * 之所以要多个候选:生产者(ai-service 侧)的字段形态尚在落地,web 不等它 —— 但**只认
 * 严格 boolean**这一条不变,所以多候选不会把无关字段误读成能力声明。
 * 契约定死后收窄到唯一键即可,消费端无需改动(改这里一处)。
 */
const FLAT_KEYS = ['supportsInterjection', 'supports_interjection'] as const
const OBJECT_KEYS = ['capabilities', 'runtimeCapabilities'] as const

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

/** 从任意声明载体(流帧载荷 / 会话元数据)里读插话能力:读不到 ⇒ null(未声明) */
export function readInterjectionDeclaration(raw: unknown): InterjectionDeclaration {
  const obj = asRecord(raw)
  if (!obj) return null
  for (const key of FLAT_KEYS) {
    const value = obj[key]
    if (typeof value === 'boolean') return value
  }
  for (const key of OBJECT_KEYS) {
    const nested = asRecord(obj[key])
    const value = nested?.['interjection']
    if (typeof value === 'boolean') return value
  }
  return null
}

/**
 * 声明 → 输入区可用的布尔(**唯一的回落判点**):只有显式 `true` 才算支持。
 * 未声明(null/undefined)/ 非 boolean 一律 false —— 宁可继续显示"不支持插话"的降级句,
 * 也绝不把"没读到"渲染成"可以插话"。
 */
export function resolveInterjectionSupport(
  declared: InterjectionDeclaration | undefined,
): boolean {
  return declared === true
}

/**
 * 声明到达的**唯一落库口**:读到声明才写;读不到(null)原样返回不写。
 * 形参是任意帧载荷 / 会话元数据,调用方不必知道键形态。
 */
export function noteRuntimeCapabilities(raw: unknown): InterjectionDeclaration {
  const declared = readInterjectionDeclaration(raw)
  if (declared === null) return null
  useChatStore.getState().setRuntimeInterjection(declared)
  return declared
}
