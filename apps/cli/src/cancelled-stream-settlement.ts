// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-634(2026-09-29)被取消的流也必须持久化(cancelled stream settlement)。
 *
 * 要解决的真实问题:取消(SIGINT / ACP cancel / abort 信号)打断的是"正在流的
 * 这一轮"—— 流式回调里已经累积到一半的回答,此前随 abort 一起**整段蒸发**:
 * 既没进 messages(下游 --resume / 会话持久化自然看不到),结果里的
 * assistantText 也不含它。用户看到的"取消"变成了"已收到的内容从未存在"。
 *
 * 口径:取消路径与正常完成**同走结算出口** ——
 * - 已有内容逐字保留,不改写、不截断(静默变短等于伪造完整性);
 * - 终态显式落 'cancelled'(truncated=true),消费方据此知道内容不完整,
 *   不会把残缺回答误读成完整回答;
 * - 内容为空(一个 delta 都没收到)时不落空消息:没有内容就没有可保的,
 *   终态仍由 stopReason='cancelled' 承载。
 *
 * 本模块只负责"结算事实"的形状与生成;把内容写进消息列表/会话持久化的
 * 接线在 agent.ts 的结算出口(循环退出、stopReason 判定之前)。
 */

/** 被取消的流的唯一终态(与 AgentStopReason 的 'cancelled' 同值同义) */
export const CANCELLED_STREAM_TERMINAL = 'cancelled' as const;

/** 一次取消结算的最小事实集 */
export interface CancelledStreamSettlement {
  /** 恒为 'cancelled':这不是 end_turn,也不是 error,是显式的已取消终态 */
  terminal: typeof CANCELLED_STREAM_TERMINAL;
  /**
   * 流被取消时已收到的内容(逐字保留,可为空串)。
   * 非空时必须落盘;空串表示流在产出任何内容之前就被取消。
   */
  content: string;
  /** 结算时间戳(落盘方据此排序/审计) */
  settledAtMs: number;
  /** 恒为 true:取消截断了流,内容不完整 —— 消费方不得当完整回答消费 */
  truncated: boolean;
}

/**
 * 把一段被取消的流中内容结算成可持久化的事实。
 * 纯函数(now 可注入),不做任何 I/O —— 落盘由调用方的结算出口完成。
 */
export function buildCancelledStreamSettlement(
  partialText: string,
  now: () => number = Date.now,
): CancelledStreamSettlement {
  return {
    terminal: CANCELLED_STREAM_TERMINAL,
    content: partialText,
    settledAtMs: now(),
    truncated: true,
  };
}
