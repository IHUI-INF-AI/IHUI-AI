// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 中间步骤折叠策略(D21,2026-09-19 立)。
 *
 * 对话流折叠收口:竞品已分化(Trae 默认折叠摘要 vs Qoder 0.2.1 起默认展开),
 * 故不可强制默认,须留用户配置开关(对标 Codex auto recap)。
 *
 * 三层判定(优先级从高到低):
 *   1. 用户显式操作(展开/收起)永远最优先,策略不覆盖
 *   2. 用户配置模式:
 *      · 'auto'  自适应(默认)— 按字数/工具数/耗时三维阈值判定折叠
 *      · 'collapsed' 强制折叠(承载体量大的会话)
 *      · 'expanded'  强制展开(参考 Qoder 0.2.1,偏好全程可见)
 *   3. 'auto' 模式下的纯函数判定:
 *      · 正文(或 reasoning)字数 ≥ AUTO_COLLAPSE_CHARS → 折叠(中间步骤让位正文)
 *      · 工具调用数 > AUTO_COLLAPSE_TOOL_CALLS → 折叠(体量大,默认收起防淹没)
 *      · 总耗时 ≥ AUTO_COLLAPSE_DURATION_MS → 折叠(长任务默认收起)
 *      三条件全不满足(轻量任务:字数少 + 工具少 + 快)→ 默认展开,
 *      即"轻查询展开、重任务折叠"。
 *
 * 配置持久化复用 voice-toolbar 模板:localStorage 写入 + window 事件广播,
 * 跨组件(FoldPolicyButton ↔ MessageItem)同步,无需引入额外状态库。
 */

/** localStorage key(与 'ihui_voice_playback' / 'ihui:thinking-expanded' 同族命名) */
export const FOLD_POLICY_KEY = 'ihui_fold_policy'
/** 配置变更广播事件名 */
export const FOLD_POLICY_EVENT = 'ihui-fold-policy-changed'

/** 用户配置模式:自适应 / 强制折叠 / 强制展开 */
export type FoldPolicyMode = 'auto' | 'collapsed' | 'expanded'

/** 自适应阈值:正文字数达到此值 → 折叠中间步骤(轻量阈值,经验值 200 字) */
export const AUTO_COLLAPSE_CHARS = 200
/** 自适应阈值:工具调用数超过此值 → 折叠(3 个以内视为轻任务) */
export const AUTO_COLLAPSE_TOOL_CALLS = 3
/** 自适应阈值:本轮总耗时达到此毫秒数 → 折叠(30 秒内视为轻任务) */
export const AUTO_COLLAPSE_DURATION_MS = 30_000

const VALID_MODES: readonly FoldPolicyMode[] = ['auto', 'collapsed', 'expanded']

/** 读取用户配置(非法值/未设置 → 'auto');SSR 安全 */
export function readFoldPolicyMode(): FoldPolicyMode {
  if (typeof window === 'undefined') return 'auto'
  const raw = window.localStorage.getItem(FOLD_POLICY_KEY)
  if (raw && (VALID_MODES as readonly string[]).includes(raw)) return raw as FoldPolicyMode
  return 'auto'
}

/** 写入用户配置并广播变更事件(跨组件同步) */
export function writeFoldPolicyMode(mode: FoldPolicyMode): void {
  window.localStorage.setItem(FOLD_POLICY_KEY, mode)
  window.dispatchEvent(new Event(FOLD_POLICY_EVENT))
}

export interface FoldPolicyInput {
  /** 已到达正文字数(assistant m.content.length;用户消息不适用策略恒 false) */
  contentChars: number
  /** 工具调用数 */
  toolCallCount: number
  /** 本轮累计耗时毫秒(工具卡 durationMs 求和;缺省 0) */
  durationMs: number
}

/**
 * 自适应模式纯函数判定:轻查询(字数少 + 工具少 + 快)→ 展开,其余折叠。
 * 任何一维达到重任务阈值即折叠;三维全轻才展开。
 */
export function shouldCollapseSteps(input: FoldPolicyInput): boolean {
  if (input.contentChars >= AUTO_COLLAPSE_CHARS) return true
  if (input.toolCallCount > AUTO_COLLAPSE_TOOL_CALLS) return true
  if (input.durationMs >= AUTO_COLLAPSE_DURATION_MS) return true
  return false
}

/**
 * 综合策略:配置模式 + 自适应判定 → 初始「展开」布尔(消费方直接作 open 态)。
 * 'collapsed' 恒 false;'expanded' 恒 true;'auto' 取 shouldCollapseSteps 的反
 * (轻任务 → 展开,重任务 → 折叠)。
 */
export function resolveInitialStepsOpen(mode: FoldPolicyMode, input: FoldPolicyInput): boolean {
  if (mode === 'collapsed') return false
  if (mode === 'expanded') return true
  return !shouldCollapseSteps(input)
}

// ─── D58 工具类目聚合层接入(2026-09-23 · G-71/G-72) ─────────────────
// 不新建第二套分组逻辑:类目映射与纯函数全部来自唯一入口 tool-category.ts,
// 此处仅做"展开策略与 D21 折叠策略联动"的整合,供 tool-call-summary-card.tsx 复用。

export {
  CATEGORY_TABLE,
  CATEGORY_TABLE_BY_KEY,
  resolveToolCategory,
  aggregateCategoryRuns,
  summarizeCategoriesByTool,
  sortRuns,
  type CategoryKey,
  type CategoryDef,
  type ExpandStrategy,
  type CategoryRun,
  type ToolNameCount,
} from '@/components/ai/progress-sections/tool-category'

import type { ExpandStrategy } from '@/components/ai/progress-sections/tool-category'

/**
 * 类目卡的"默认展开态"决策(与 shouldCollapseSteps 同源,不另起判定):
 * - 'expand'   → 恒展开(对标 Qoder 全程可见偏好)
 * - 'collapse' → 恒收起(思考/结束等阶段标记,默认让位正文)
 * - 'auto'     → 跟随 D21 自适应策略(轻任务展开、重任务折叠)
 *
 * 返回的是"默认初值";用户显式操作(D21 规则①)永远最高优先,此处结果不被用于覆盖它。
 * 纯函数,可单测。
 */
export function resolveCategoryInitialOpen(
  strategy: ExpandStrategy,
  input: FoldPolicyInput,
): boolean {
  if (strategy === 'expand') return true
  if (strategy === 'collapse') return false
  return !shouldCollapseSteps(input)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
