// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 工具活动行的双时态措辞(D81 第①项 / D83 词表机制)。
// 与 tool-display 的 tense-neutral 功能名分工:功能名回答"这是什么工具",本模块回答"它此刻在做什么/做完了什么"。
// 键约定:taskStatus 下 `<功能名键>Activity`,值走 ICU select(一种语义一个键,不拆 running/completed 两键)。
// 措辞分两档:惯用档(逐工具手写,当前 24 个高频工具)→ 通用档(`toolGenericActivity` 把已本地化功能名嵌进
// "正在执行:{name}/已完成:{name}")。91 个工具全部至少落在通用档,长尾工具不再退化成无时态的裸功能名。

import { __toolDisplayKeys, toolDisplayKey } from './tool-display'

export type ToolActivityState = 'running' | 'completed'

/** 活动行 ICU select 的变量名(与语言包值里的 `{state, select, …}` 对齐) */
export const TOOL_ACTIVITY_PARAM = 'state'

/** 通用活动框架里承载功能名的变量名(与 `toolGenericActivity` 值里的 `{name}` 对齐) */
export const TOOL_ACTIVITY_NAME_PARAM = 'name'

/**
 * 通用双时态框架键:未配惯用措辞的长尾工具靠它保住"在做什么/做完了什么"的时态信息。
 * 惯用键(24 个高频工具)优先级更高,本键是它们的下一档。
 */
export const TOOL_GENERIC_ACTIVITY_KEY = 'toolGenericActivity'

const UNRENDERED_ICU_RE = /\{\s*[\w$]+\s*,\s*(?:plural|select|selectordinal|number)\b/u

/** 该端取词引擎没解释 ICU 时会把语法原样吐出,界面宁可退回中性功能名 */
export function looksLikeUnrenderedIcu(text: string): boolean {
  return UNRENDERED_ICU_RE.test(text)
}

export function toolActivityKey(toolName: string): string | null {
  const base = toolDisplayKey(toolName)
  return base ? `${base}Activity` : null
}

export interface DescribeToolActivityInput {
  toolName: string
  state: ToolActivityState
  /** 端内取词函数:必须接受 params 第二参(web=next-intl t、miniapp/rn/cli=共享 translate 包装) */
  translate: (key: string, params?: Record<string, string | number>) => string
}

/** 工具卡状态(与 @ihui/types 的 AgentToolCall['status'] 同集合,此处不引类型包以免成环) */
export type ToolCallStatus = 'running' | 'success' | 'error' | 'cancelled'

/**
 * 状态 → 时态。**error / cancelled 一律 null**:
 * 失败或被撤回的调用显示"已 X"是假陈述,宁可只显示中性功能名(界面已有红叉/禁行图标承载状态)。
 */
export function toolActivityState(status: ToolCallStatus): ToolActivityState | null {
  if (status === 'running') return 'running'
  if (status === 'success') return 'completed'
  return null
}

/** 一帧渲染结果是否可用:没回显键名、非空、没把 ICU 语法吐到界面 */
function isUsable(text: string, key: string): boolean {
  return text !== key && text.trim() !== '' && !looksLikeUnrenderedIcu(text)
}

/** 中性功能名(键缺失或该端取不到值时返回空串) */
function resolveNeutralName(
  toolName: string,
  translate: DescribeToolActivityInput['translate'],
): string {
  const baseKey = toolDisplayKey(toolName)
  if (!baseKey) return ''
  const neutral = translate(baseKey)
  return isUsable(neutral, baseKey) ? neutral : ''
}

/** 解析顺序:惯用活动键 ICU → 通用框架(带本地化功能名)→ 中性功能名 → 原始工具码名 */
export function describeToolActivity({
  toolName,
  state,
  translate,
}: DescribeToolActivityInput): string {
  const params = { [TOOL_ACTIVITY_PARAM]: state }

  const activityKey = toolActivityKey(toolName)
  if (activityKey) {
    const rendered = translate(activityKey, params)
    if (isUsable(rendered, activityKey)) return rendered
  }

  const usableNeutral = resolveNeutralName(toolName, translate)
  if (usableNeutral) {
    const genericKey = TOOL_GENERIC_ACTIVITY_KEY
    const generic = translate(genericKey, {
      ...params,
      [TOOL_ACTIVITY_NAME_PARAM]: usableNeutral,
    })
    // 必须含功能名:语言包漏写 {name} 时"正在执行:"比无时态的"API 调用"信息量更低,宁可退回后者
    if (isUsable(generic, genericKey) && generic.includes(usableNeutral)) return generic
  }

  return usableNeutral || toolName
}

export interface DescribeToolActivityByStatusInput {
  toolName: string
  status: ToolCallStatus
  translate: DescribeToolActivityInput['translate']
}

/** 渲染位入口:running/success 出双时态措辞,error/cancelled 只出中性功能名(不假称"已完成") */
export function describeToolActivityByStatus({
  toolName,
  status,
  translate,
}: DescribeToolActivityByStatusInput): string {
  const state = toolActivityState(status)
  if (!state) return resolveNeutralName(toolName, translate) || toolName
  return describeToolActivity({ toolName, state, translate })
}

/** 已登记双时态措辞的期望活动键清单(供覆盖率判据与"还剩多少工具待补"计数) */
export function toolActivityKeyList(): string[] {
  return [...new Set(Object.values(__toolDisplayKeys))].map((key) => `${key}Activity`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
