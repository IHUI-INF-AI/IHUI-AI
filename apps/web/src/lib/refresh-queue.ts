// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b75-1#3 刷新队列 single-flight + 尾随重跑 + manual 旁路 + skip 留痕。
 *
 * 上游出处 zcode packages/ui/src/settings/McpSettingsSection.tsx:254-313,737-864。
 *
 * 机制:
 *  - inFlight 期间新请求只更新 latestRun + 置 rerunAfterCurrent,完成后 do-while 尾随重跑一次
 *    (不并发也不丢最后一次);
 *  - manual 触发绕过自动去重(否则按钮看起来没反应);
 *  - 被 guard skip 时 warn 日志带 reason(过去 manual 无痕 = "按钮没反应"事故);
 *  - 请求-合并全程 workspace key 三重校验,stale-workspace 直接丢弃。
 *
 * 本实现为通用队列工厂,调用方注入 fetcher + getKey + skipReason 三件套即可。
 * key 用于请求合并与 stale 判定(workspace 切换等场景)。
 */

export type SkipReason = string | null

export interface RefreshQueueOptions<TInput, TResult> {
  /** 实际刷新动作;input 为本次请求参数 */
  fetcher: (input: TInput) => Promise<TResult>
  /** workspace / scope key;返回 null 表示"无 scope,不做合并" */
  getKey: () => string | null
  /**
   * 判定本次请求是否应被 skip(返回 reason 字符串即 skip)。
   * 用于 workspace 未对齐 / config 未就绪等 guard。
   * manual 触发时 skipReason 仍被调用,但会留痕。
   */
  skipReason?: () => SkipReason
  /** 日志回调:skip 留痕用(manual 必留痕,auto 默认静默) */
  onSkip?: (reason: string, source: 'manual' | 'auto') => void
}

export interface RefreshQueue<TInput> {
  /** 触发一次刷新;manual=true 绕过 in-flight 自动去重 */
  refresh: (input: TInput, opts?: { manual?: boolean }) => Promise<void>
  /** 当前是否有请求在飞 */
  isInFlight: () => boolean
}

/**
 * 创建刷新队列。
 *
 * 行为约定:
 *  - 同 key 并发只飞一个请求;新请求只记录 latestInput 并标记 rerun。
 *  - 当前请求完成后若 rerun 标记,用 latestInput 再跑一次(尾随重跑,不并发)。
 *  - 请求完成时若 key 已变(stale-workspace),结果直接丢弃不回调。
 *  - manual 触发:即使被 skip 也通过 onSkip 留痕;auto 触发 skip 静默。
 */
export function createRefreshQueue<TInput, TResult>(
  options: RefreshQueueOptions<TInput, TResult>,
): RefreshQueue<TInput> {
  const { fetcher, getKey, skipReason, onSkip } = options

  let inFlight = false
  let rerunAfterCurrent = false
  let latestInput: TInput | null = null

  const runOnce = async (input: TInput, source: 'manual' | 'auto'): Promise<void> => {
    const startKey = getKey()
    // skip guard:manual 必须留痕(按钮不能像没反应)
    const reason = skipReason?.() ?? null
    if (reason !== null) {
      if (source === 'manual') onSkip?.(reason, 'manual')
      return
    }
    inFlight = true
    try {
      await fetcher(input)
    } catch {
      // 错误由调用方在 fetcher 内部处理(队列不吞也不抛,保持尾随语义)
    } finally {
      inFlight = false
    }
    // key 已变(stale-workspace):丢弃,不尾随
    if (getKey() !== startKey) {
      rerunAfterCurrent = false
      latestInput = null
      return
    }
  }

  const refresh: RefreshQueue<TInput>['refresh'] = async (input, opts) => {
    const manual = opts?.manual === true
    if (inFlight) {
      // 飞行中:只更新 latest + 标记尾随,不并发
      latestInput = input
      rerunAfterCurrent = true
      return
    }
    // do-while 尾随重跑:至少跑一次,若期间有新请求则再跑一次(用最新 input)
    do {
      rerunAfterCurrent = false
      const currentInput = latestInput ?? input
      latestInput = null
      await runOnce(currentInput, manual ? 'manual' : 'auto')
    } while (rerunAfterCurrent)
  }

  return {
    refresh,
    isInFlight: () => inFlight,
  }
}

