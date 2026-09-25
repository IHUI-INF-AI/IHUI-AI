// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 危险工具放行策略的唯一出口(danger gate)。
 *
 * 背景:`confirmDangerous` 的策略(用户有没有给 --allow-dangerous)曾被多个调用方
 * 各自手写(短路放行 / 弹窗 / 静默放 / 静默拒 已开始分叉),工具层只看到一个布尔,
 * 看不见这次放行走的是哪条路。本文件是唯一策略实现:调用方只注入平台交互
 * (prompt)与观察口(onDecision),不得在调用方就地决定放行
 * (由 apps/cli/tests/danger-gate-wiring.test.ts 的棘轮钉死)。
 *
 * 三条路(decision.route,互斥且必居其一):
 * - flag      由 --allow-dangerous 自动放行(repl 原有的「自动允许」中文提示
 *             逐字保留在调用方,经 onDecision 挂回,行为与迁移前等价)
 * - approved  真人/编辑器批准(prompt 给出 true)
 * - denied    无人可问、人拒绝、prompt 空答复或抛错 ⇒ 拒绝。
 *             默认 fail-closed:没有 prompt 且没有 flag 一律拒绝,
 *             绝不允许「没人应答 = 放行」。
 */
import type { Tool } from './index.js'

export type DangerGateRoute = 'flag' | 'approved' | 'denied'

/** 拒绝成因:三种 fail-closed 情形如实区分,便于观测与排障 */
export type DangerGateDenyCause = 'no-prompt' | 'prompt-declined' | 'prompt-empty' | 'prompt-error'

export interface DangerGateDecision {
  route: DangerGateRoute
  tool: Tool
  args: Record<string, unknown>
  /** 仅 route === 'denied' 时携带 */
  cause?: DangerGateDenyCause
}

/**
 * 调用方注入的人工批准交互:返回 true 表示允许本次执行。
 * 只认 `=== true` 为肯定答复;返回 undefined/null 与抛错一律记为 denied(fail-closed)。
 */
export type DangerGatePrompt = (
  tool: Tool,
  args: Record<string, unknown>,
) => Promise<boolean | null | undefined | void>

export interface DangerGateOptions {
  /** CLI --allow-dangerous 的布尔语义 */
  allowDangerous?: boolean
  /** 人工批准通道(inquirer 确认 / IDE permission 弹窗)。缺省则只有 flag 一路可放行 */
  prompt?: DangerGatePrompt
  /**
   * true = 本闸门不产生任何 console 提示(仅回调 onDecision)。
   * 现有已迁移调用方一律传 silent: true,以保持迁移前的逐路径等价:
   * 它们原有的提示文案留在调用方(如 repl 的中文提示经 onDecision 保留)。
   * 不传 silent 的新调用方默认 fail-loud —— flag 自动放行与 denied 都会喊出来,
   * 杜绝「静默放/静默拒」这两种本票立门要终结的分叉形态。
   */
  silent?: boolean
  /** 三路决策定案前均回调:观测/审计/挂调用方自己的提示 */
  onDecision?: (decision: DangerGateDecision) => void
}

/** 与 ToolContext.confirmDangerous 完全兼容的返回形态 */
export type DangerGate = (tool: Tool, args: Record<string, unknown>) => Promise<boolean>

export function createDangerGate(opts: DangerGateOptions): DangerGate {
  const decide = (
    route: DangerGateRoute,
    tool: Tool,
    args: Record<string, unknown>,
    cause?: DangerGateDenyCause,
  ): boolean => {
    const decision: DangerGateDecision =
      cause === undefined ? { route, tool, args } : { route, tool, args, cause }
    opts.onDecision?.(decision)
    if (!opts.silent) {
      // 非静默档案的默认提示:仅 ASCII(守门 70 拦新增硬编码中文);
      // approved 路由不提示——人已批准,再打一行只是噪音。
      if (route === 'flag') {
        console.info(`  ! dangerous tool auto-allowed by --allow-dangerous: ${tool.name}`)
      } else if (route === 'denied') {
        console.error(`  x dangerous tool denied by danger-gate: ${tool.name} (${cause ?? 'denied'})`)
      }
    }
    return route !== 'denied'
  }

  return async (tool, args) => {
    // flag 优先:即使同时提供了 prompt,--allow-dangerous 也直接放行且不打扰人
    if (opts.allowDangerous === true) {
      return decide('flag', tool, args)
    }
    if (opts.prompt) {
      let answer: boolean | null | undefined | void
      try {
        answer = await opts.prompt(tool, args)
      } catch {
        return decide('denied', tool, args, 'prompt-error')
      }
      if (answer === true) {
        return decide('approved', tool, args)
      }
      return decide('denied', tool, args, answer === null || answer === undefined ? 'prompt-empty' : 'prompt-declined')
    }
    return decide('denied', tool, args, 'no-prompt')
  }
}

// ==================== 工具层披露:危险放行路径可追溯(2026-09-25 L7905 收口)====================

/**
 * 危险放行路径的进程内披露计数(**只记账,不参与任何判定**)。
 *
 * 背景:本闸门把策略收口到唯一出口,但工具层(`executeToolCall`)看到的仍只是
 * `confirmDangerous` 返回的布尔 —— 「这次放行走的是会话级 `--allow-dangerous`
 * 还是回调自批」此前不可追溯(本文件头部注释记录的同族问题在工具层的另一半)。
 * 现由 `ToolContext.allowDangerous`(影子披露字段)把会话级 flag 是否在位随 ctx
 * 下发,`executeToolCall` 在 dangerous 工具**获准后**调 `noteDangerousApproval` 记账:
 * 无 console 输出、不改返回值、不改确认语义(未提供回调依旧拒绝,fail-closed 不变)。
 *
 * 覆盖面边界(如实登记):仅 `executeToolCall` 的 dangerous 闸一层。
 * builtins/terminal 在 handler 内的二次确认(纵深防御)与 `runToolLoop` 的
 * permission-mode ask 分支不在本计数内。
 */
export interface DangerousApprovalCounts {
  /** 放行时会话级旁路在位(`ctx.allowDangerous === true`)的次数 */
  sessionFlagApproved: number
  /** 旁路未在位、由 confirmDangerous 自身批准的次数(真人批准 / 调用方策略) */
  callbackApproved: number
}

const dangerousApprovalByTool = new Map<string, DangerousApprovalCounts>()

export function noteDangerousApproval(sessionFlagActive: boolean, toolName: string): void {
  const bucket = dangerousApprovalByTool.get(toolName) ?? { sessionFlagApproved: 0, callbackApproved: 0 }
  if (sessionFlagActive) bucket.sessionFlagApproved += 1
  else bucket.callbackApproved += 1
  dangerousApprovalByTool.set(toolName, bucket)
}

/** 按工具名排序的快照(深拷贝,调用方改动不会污染计数器;供排查 / 测试 / 报表) */
export function snapshotDangerousApprovals(): Array<{ tool: string } & DangerousApprovalCounts> {
  return [...dangerousApprovalByTool.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([tool, counts]) => ({ tool, ...counts }))
}

/** 测试 / 巡检用:清零 */
export function resetDangerousApprovals(): void {
  dangerousApprovalByTool.clear()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
