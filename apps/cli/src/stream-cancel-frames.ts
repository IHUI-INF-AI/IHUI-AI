// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-639(2026-09-29)每个 tool_call 各自的 cancelled 合成帧。
 *
 * 要解决的真实问题:取消时此前只交一帧整体 cancelled(stopReason),流里已经
 * 建卡(onToolCall → in_progress)却没等到结果(onToolResult)的 tool_call
 * 就悬在半空 —— IDE 面板上那张卡永远"进行中",或者被笼统的一帧整体状态覆盖,
 * 分不清是哪一个调用没跑完。
 *
 * 口径:取消出口必须**逐未完成的 tool_call 合成各自的 cancelled 帧** ——
 * 两个 in-flight ⇒ 两帧,N 个 ⇒ N 帧,一一对应、按建卡顺序、id 逐字保留。
 * "回合被取消"是已知的真实事实,所以这不是伪造终态:每个调用确实没跑完,
 * 帧把这个事实如实地逐卡落下去。
 *
 * 本模块只产出协议无关的帧(terminal: 'cancelled');各面(ACP 等)把它映射进
 * 自己的线格式词表 —— ACP 的 ToolCallStatus 没有 'cancelled' 档,映射口径是
 * status:'failed' + rawOutput.cancelled=true + 文本注明(与审批卡
 * "cancelled → failed" 的既有映射同形)。
 */

/** 一个未完成的 tool_call 引用(取消出口从自己的在途账里取) */
export interface OpenToolCallRef {
  toolCallId: string
  toolName?: string
}

/** 逐卡合成的取消帧(协议无关;ACP 映射口径见文件头) */
export interface CancelledToolCallFrame {
  toolCallId: string
  toolName?: string
  terminal: 'cancelled'
}

/**
 * 逐未完成的 tool_call 合成各自的 cancelled 帧。
 * 纯函数:按入参顺序一一对应输出;空入参 ⇒ 空帧列(没有 in-flight 就一帧都不发);
 * 空/非法 toolCallId 的条目跳过 —— 发不出可配对的帧,宁缺勿假。
 */
export function synthesizeCancelledToolFrames(
  openToolCalls: readonly OpenToolCallRef[],
): CancelledToolCallFrame[] {
  const frames: CancelledToolCallFrame[] = []
  for (const call of openToolCalls) {
    if (!call || typeof call.toolCallId !== 'string' || call.toolCallId === '') continue
    frames.push(
      call.toolName !== undefined
        ? { toolCallId: call.toolCallId, toolName: call.toolName, terminal: 'cancelled' }
        : { toolCallId: call.toolCallId, terminal: 'cancelled' },
    )
  }
  return frames
}
