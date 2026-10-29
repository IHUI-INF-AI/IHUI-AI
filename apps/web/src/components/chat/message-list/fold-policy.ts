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
 *   3. 'auto' 模式下的纯函数判定(**语义优先于阈值**,2026-10-29 对标 Qoder 0.4.11):
 *      · 本轮含"永不折叠"工具(例外集见 tool-category.ts 的 NEVER_FOLD_TOOLS /
 *        类目级 neverFold)⇒ **一律不折叠**,三维读数再大也不例外
 *      · 否则按三维阈值:正文(或 reasoning)字数 ≥ AUTO_COLLAPSE_CHARS → 折叠(中间步骤让位正文)
 *      · 工具调用数 > AUTO_COLLAPSE_TOOL_CALLS → 折叠(体量大,默认收起防淹没)
 *      · 总耗时 ≥ AUTO_COLLAPSE_DURATION_MS → 折叠(长任务默认收起)
 *      三维全不满足(轻量任务:字数少 + 工具少 + 快)→ 默认展开,
 *      即"轻查询展开、重任务折叠;等人回话/子代理/独立 UI 永不折叠"。
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
  /**
   * 本轮工具名(2026-10-29 新增,**可选**,缺省即旧语义)。
   *
   * 存在的唯一理由:让"语义例外集"能压过三维阈值 —— 需要用户确认的、子代理的、
   * 独立 UI 的工具体量再大也不许被自动折叠(详见 `tool-category.ts` 的 `isNeverFoldTool`)。
   * 不传 ⇒ 只看三维阈值,既有调用方与用例零回归。
   *
   * 接线状态(如实登记,2026-10-29):
   *  - **已接**:类目卡(`tool-call-summary-card.tsx` 的 `CategoryCard`,传 `run.tools` 的工具名);
   *  - **未接**:消息级「中间步骤」开关(`MessageItem.tsx` 的 `stepDims`)当时仍只喂三维 ——
   *    该文件被他席未提交改动占用,本票禁改;它落地后只需把 `toolNames: m.toolCalls?.map(tc => tc.toolName)`
   *    加进 `stepDims`,语义例外即在消息级生效,本模块无需再改。
   */
  toolNames?: readonly string[]
}

/**
 * 本轮是否含"永不折叠"的工具(语义维)。
 *
 * 判据**只经** `tool-category.ts` 的 `isNeverFoldTool`(§0.6 单一真相源),
 * 本处零名单、零复制:名单加一枚工具只改 `tool-category.ts` 一处。
 */
export function hasNeverFoldTool(input: FoldPolicyInput): boolean {
  const names = input.toolNames
  if (!names || names.length === 0) return false
  return names.some((name) => isNeverFoldTool(name))
}

/**
 * 自适应模式纯函数判定:轻查询(字数少 + 工具少 + 快)→ 展开,其余折叠。
 * 任何一维达到重任务阈值即折叠;三维全轻才展开。
 *
 * **语义优先于阈值**(2026-10-29 对标 Qoder 0.4.11):本轮只要含一枚永不折叠的工具,
 * 无论三维读数多大都**不折叠** —— 理由不是"体积小",而是"折了会丢掉等人回话的入口
 * 或一整块自成一体的 UI"(子代理树 / 图 / 思考块 / 计划模式确认)。
 * 这条优先级在用户显式档位之下(FoldPolicyMode 由 resolve* 先判,不在本函数射程内)。
 */
export function shouldCollapseSteps(input: FoldPolicyInput): boolean {
  if (hasNeverFoldTool(input)) return false
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

// 语义例外集的判定入口与名单:本模块只**转出**共享实现,不复制(§0.6)。
// 转出的理由:类目卡渲染(expandStrategy 已提升)与三维判定(shouldCollapseSteps)
// 都要问同一件事,让调用方都从这里拿,免得各自去猜该 import 哪个文件。
import {
  NEVER_FOLD_TOOLS as NEVER_FOLD_TOOLS_IMPL,
  isNeverFoldTool as isNeverFoldToolImpl,
} from '@/components/ai/progress-sections/tool-category'
import type { ExpandStrategy } from '@/components/ai/progress-sections/tool-category'

/** 永不折叠工具名集合(原样转出,判据仍在 tool-category.ts) */
export const NEVER_FOLD_TOOLS = NEVER_FOLD_TOOLS_IMPL
/** 永不折叠判定(原样转出,判据仍在 tool-category.ts) */
export const isNeverFoldTool = isNeverFoldToolImpl

/**
 * 类目卡的"默认展开态"决策(与 shouldCollapseSteps 同源,不另起判定)。
 * - 'expand'   → 恒展开(对标 Qoder 全程可见偏好)
 * - 'collapse' → 恒收起(思考/结束等阶段标记,默认让位正文)
 * - 'auto'     → 跟随 D21 自适应策略(轻任务展开、重任务折叠)
 *
 * 返回的是"默认初值";用户显式操作(D21 规则①)永远最高优先,此处结果不被用于覆盖它。
 * 纯函数,可单测。
 *
 * 2026-10-29 补 `mode`(用户折叠模式)入参:此前本函数只吃类目自身档位,
 * 于是用户在 FoldPolicyButton 里选"强制展开/强制折叠"对类目卡**完全无效** ——
 * 15 个 'auto' 档类目一律按自适应走,用户意志落不了地。
 *
 * 优先级(D21 规则①/②的展开):**用户模式 > 类目档位 > 自适应**。
 * - 'expanded'  → 恒展开(用户要全程可见,类目卡也不例外)
 * - 'collapsed' → 恒收起
 * - 'auto'      → 落到类目自身档位('expand'/'collapse' 恒值、'auto' 走自适应)
 *
 * `mode` 缺省不传 ⇒ 沿用旧语义(只按类目档位),既有调用方与用例零回归。
 *
 * 2026-10-29 补"语义维":`input.toolNames` 里出现永不折叠的工具 ⇒ 恒展开。
 * 位置在**用户模式之后、类目档位之前** —— 用户显式选「强制折叠」仍然赢(D21 规则①
 * 说的是用户意志最高),但类目的 'auto'/'collapse' 档位与三维阈值都压不过语义例外:
 * `user_interaction` 这类"等人回话"的卡一旦折起来,用户就看不见该点哪儿了。
 * 类目级语义(`CategoryDef.neverFold`)已由 `makeRun` 提升成 'expand' 档位,
 * 故两个入口说的是同一件事,不产生第二套判据。
 */
export function resolveCategoryInitialOpen(
  strategy: ExpandStrategy,
  input: FoldPolicyInput,
  mode?: FoldPolicyMode,
): boolean {
  if (mode === 'expanded') return true
  if (mode === 'collapsed') return false
  if (hasNeverFoldTool(input)) return true
  if (strategy === 'expand') return true
  if (strategy === 'collapse') return false
  return !shouldCollapseSteps(input)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
