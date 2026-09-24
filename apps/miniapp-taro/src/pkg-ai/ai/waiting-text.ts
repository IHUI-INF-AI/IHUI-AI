// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:仅 miniapp-taro 渲染位使用(依赖端内 `useI18n()` 的 locale/t 形态与
// `AiHomeState.conversationMessages` 形状)。语义推导零自研,全部下沉共享层
// `@ihui/shared/chat#resolveWaitingText`,本文件只是 D79 等待态轮换池的薄接线层。
//
// 参照正例:apps/cli/src/commands/waiting-text.ts(同形态:取词 + 象限/阶段推导)。
import { resolveWaitingText, type WaitingLocale, type WaitingPhase } from '@ihui/shared/chat'

/**
 * 未进池时的固定串(词表侧同义键是 `ai.thinking`,其值为省略号写法 `思考中…`;
 * 本串保留三个点的历史显示形态,两者语义同指"正在思考")。
 * 触发条件:本轮无用户输入(拿不到 seed)/ 人格化开关关闭 —— 宁可朴素显示,
 * 也不在缺原料时抛一条随机池文案(会让用户误判"卡住")。
 */
export const TARO_THINKING_FALLBACK = '思考中...'

/** 会话消息的最小结构:刻意不 import `@/api`(会把 Taro 运行时拖进 node 环境测试) */
export interface TaroWaitingTurn {
  role: 'user' | 'assistant'
  content: string
}

/** 等待池入料(全部来自渲染位既有状态,不新增采集成本) */
export interface TaroWaitingTextInput {
  /** 本轮用户输入 —— 确定性 seed(同输入必同文案,禁用 Math.random) */
  prompt: string
  /** 会话内 user 消息条数(含本轮):≤1 判首轮,>1 判追问 */
  userMessageCount: number
  /** 端内 `useI18n().locale` */
  locale?: WaitingLocale
  /** 端内 `useI18n().t`:按完整点键(`waiting.<象限>.<阶段>.<下标>`)取词;缺省走共享层英文回退池 */
  t?: (key: string) => string | undefined
  /** 人格化开关:false 直接回退固定串 */
  personaEnabled?: boolean
}

/**
 * 从会话消息派生等待池原料:seed = **末条** user 消息内容(本轮输入,发送时先入列
 * 再置 isStreaming,故等待期内恒定 ⇒ 同一次等待不跳字),
 * userMessageCount = user 消息条数(判首轮/追问)。
 */
export function deriveTaroWaitingTurn(messages: readonly TaroWaitingTurn[]): {
  prompt: string
  userMessageCount: number
} {
  let prompt = ''
  let userMessageCount = 0
  for (const msg of messages) {
    if (msg.role !== 'user') continue
    userMessageCount += 1
    prompt = msg.content
  }
  return { prompt, userMessageCount }
}

/**
 * 构造"首 token 未到时"的等待文案:象限定 `agent`(等待对象就是智能体本身),
 * 阶段按 user 消息条数分首轮/追问,seed 取本轮输入。
 * 不满足进池条件时回退固定串 `TARO_THINKING_FALLBACK`。
 */
export function buildTaroWaitingText(input: TaroWaitingTextInput): string {
  if (input.personaEnabled === false) return TARO_THINKING_FALLBACK
  if (input.prompt.trim() === '') return TARO_THINKING_FALLBACK
  const phase: WaitingPhase = input.userMessageCount > 1 ? 'followup' : 'first'
  return resolveWaitingText({
    quadrant: 'agent',
    phase,
    locale: input.locale,
    seed: input.prompt,
    t: input.t,
    fallback: TARO_THINKING_FALLBACK,
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
