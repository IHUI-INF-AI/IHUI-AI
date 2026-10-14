// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// D38/D69 插话能力协商 —— **RN 侧消费端**(只消费、不生产;G-84 前置)
//
// **自证结论(改本文件前先读)**:
//   · 判据入口只有一个:`packages/shared/src/chat/input-notices.ts` 的
//     `QueueInteractionContext.runtimeSupportsInterjection`(端内不得再立第二套判定)。
//   · 该字段的**生产者**(ai-service 侧能力声明)此前全仓缺席 ⇒ RN 宿主曾硬编码 false。
//     硬编码的代价是"声明到了也不生效"(能力落地后还得回来改一遍端内)。
//
// **本模块契约只有一条:字段缺失即回落 false。**
//   · 声明没到(undefined / null / 路径不存在 / 非布尔) ⇒ false —— 与硬编码 false
//     **逐字节同行为**,零回归;
//   · 声明到了(布尔 true / false)⇒ 原样透传,不解释语义、不猜字符串
//     (`'true'` / 1 这类非布尔一律当没读到,不把"没判"写成"判过了")。
//
// 于是本端与生产侧**零耦合**:能力声明落地即自动生效,本文件不用再动;
// 生产侧改了承载路径,只需在 INTERJECTION_CAPABILITY_PATHS 加一条(仍是同一条契约)。

/**
 * 能力声明的候选读取路径(点分;顺序即优先级)。
 *
 * 为什么是"候选列表"而不是"一个约定字段":生产侧(ai-service / 网关)尚未落地声明,
 * 不确定最终挂在 `capabilities.interjection` 还是会话载荷的 `runtimeSupportsInterjection`。
 * 这里逐个探一遍 —— 命中任一布尔即采用,全部不命中即 false。
 */
export const INTERJECTION_CAPABILITY_PATHS = [
  'capabilities.interjection',
  'capabilities.runtimeSupportsInterjection',
  'capabilities.supportsInterjection',
  'runtimeCapabilities.interjection',
  'runtimeCapabilities.supportsInterjection',
  'runtime.capabilities.interjection',
  'runtime.supportsInterjection',
  'runtimeSupportsInterjection',
  'supportsInterjection',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 按点分路径**只读**一路下探;任一跳不是对象 / 键不存在 ⇒ undefined(不抛) */
function readPath(source: unknown, path: string): unknown {
  let cursor: unknown = source
  for (const key of path.split('.')) {
    if (!isRecord(cursor)) return undefined
    if (!Object.prototype.hasOwnProperty.call(cursor, key)) return undefined
    cursor = cursor[key]
  }
  return cursor
}

/**
 * 从**一个**能力声明载荷读插话能力:读到布尔才作数,其余一律 false。
 *
 * 入参是 `unknown`:声明来自流/会话,形状不由本端定义,故不做结构性假设。
 */
export function readInterjectionCapability(source: unknown): boolean {
  if (!isRecord(source)) return false
  for (const path of INTERJECTION_CAPABILITY_PATHS) {
    const value = readPath(source, path)
    // 严格布尔:只认 true/false。"true" / 1 / 'yes' 一律当未声明(宁可不放量,不误判)。
    if (value === true) return true
    if (value === false) return false
  }
  return false
}

/**
 * 从**多个**能力声明来源读插话能力(宿主通常有"会话载荷 + 路由入参"两处)。
 *
 * 合成规则:任一来源显式声明 true ⇒ true(能力是"有"才生效,一票放量);
 * 否则 false(全缺席 / 全 false / 非布尔,都等于"没有声明")。
 */
export function resolveInterjectionCapability(sources: readonly unknown[]): boolean {
  for (const source of sources) {
    if (readInterjectionCapability(source)) return true
  }
  return false
}
