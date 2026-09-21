// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 工具活动行的双时态措辞(D81 第①项 / D83 词表机制)。
// 与 tool-display 的 tense-neutral 功能名分工:功能名回答"这是什么工具",本模块回答"它此刻在做什么/做完了什么"。
// 键约定:taskStatus 下 `<功能名键>Activity`,值走 ICU select(一种语义一个键,不拆 running/completed 两键)。

import { __toolDisplayKeys, toolDisplayKey } from './tool-display'

export type ToolActivityState = 'running' | 'completed'

/** 活动行 ICU select 的变量名(与语言包值里的 `{state, select, …}` 对齐) */
export const TOOL_ACTIVITY_PARAM = 'state'

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

/** 解析顺序:活动键 ICU → 中性功能名 → 原始工具码名(与 describeToolCall 的兜底口径一致) */
export function describeToolActivity({
  toolName,
  state,
  translate,
}: DescribeToolActivityInput): string {
  const activityKey = toolActivityKey(toolName)
  if (activityKey) {
    const rendered = translate(activityKey, { [TOOL_ACTIVITY_PARAM]: state })
    if (rendered !== activityKey && rendered.trim() !== '' && !looksLikeUnrenderedIcu(rendered)) {
      return rendered
    }
  }
  const baseKey = toolDisplayKey(toolName)
  if (baseKey) {
    const neutral = translate(baseKey)
    if (neutral !== baseKey && neutral.trim() !== '') return neutral
  }
  return toolName
}

/** 已登记双时态措辞的期望活动键清单(供覆盖率判据与"还剩多少工具待补"计数) */
export function toolActivityKeyList(): string[] {
  return [...new Set(Object.values(__toolDisplayKeys))].map((key) => `${key}Activity`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
