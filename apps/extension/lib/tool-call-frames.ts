// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 扩展端工具调用帧的纯归并层(D113,2026-09-27)。
 *
 * 为什么单拆一个文件而不是写在 `ChatPage` 里:`ChatPage` 的回调此前是两段内联 map,
 * "重复 start 帧该不该抹掉预览"这种语义只能靠读代码保证;拆成纯函数后它可被单测钉住,
 * 且与 RN(`apps/mobile-rn/src/utils/chat-render-model.ts` 的 `applyToolCallEvent` /
 * `applyToolDelta`)、小程序(`apps/miniapp-taro/src/pkg-ai/ai/cards/types.ts`)同形 ——
 * 三端都是"纯函数 + 薄接线",不得一端有测试另一端只有散文。
 *
 * 三条跨端一致口径(不是本地偏好,是与 web/RN/小程序同值):
 *  1. `partialText` 是**累积文本**,按 `toolCallId` 整帧覆盖 —— `seq` 不参与判断,
 *     所以同帧重放与乱序天然幂等(web `createToolDeltaHandler` 同口径)。
 *  2. 空 `toolCallId` 整帧丢弃;列表里没有该 id(start 帧未到)**不凭空造条目**。
 *  3. 重复 start 帧**按 id 原位替换且保留已有预览**(本端此前是 `...list, 新条目`,
 *     重放一次就多一行并把预览抹空;RN `chat-render-model.ts:139` /
 *     小程序 `applyToolCallStart` 同口径)。
 *     tool-result 侧的清预览写在 `ChatPage` 的 result 分支(`partialDiff: undefined`),
 *     与 web `stream-handlers.ts:122` 同一行语义 —— 那里还要并回填 10 余个端内字段,
 *     把它们整段搬进本文件等于重写他人逻辑,所以只由测试按源码相邻性钉住。
 */
import type { ToolCall } from '@ihui/types/chat'

export type ToolDeltaFrame = { toolCallId: string; partialText: string }

/** 按 toolCallId 整帧覆盖写入流中预览(见文件头第 1、2 条口径)。 */
export function applyToolDelta(calls: readonly ToolCall[], evt: ToolDeltaFrame): ToolCall[] {
  if (!evt.toolCallId) return [...calls]
  if (!calls.some((c) => c.id === evt.toolCallId)) return [...calls]
  return calls.map((c) => (c.id === evt.toolCallId ? { ...c, partialDiff: evt.partialText } : c))
}

/**
 * tool-call-start 归并(第 3 条口径):同 id 原位替换、`partialDiff` 从旧条目继承。
 * `startedAt` 由调用方传入(端内用它给 tool-result 补算耗时,不进契约字段)。
 */
export function applyToolCallStart(
  calls: readonly ToolCall[],
  evt: {
    toolCallId: string
    toolName: string
    args?: Record<string, unknown>
    serverSource?: ToolCall['serverSource']
    serverId?: string
    serverName?: string
  },
): ToolCall[] {
  const prev = calls.find((c) => c.id === evt.toolCallId)
  return [
    ...calls.filter((c) => c.id !== evt.toolCallId),
    {
      id: evt.toolCallId,
      toolName: evt.toolName,
      args: evt.args ?? {},
      status: 'running',
      serverSource: evt.serverSource,
      serverId: evt.serverId,
      serverName: evt.serverName,
      partialDiff: prev?.partialDiff,
    },
  ]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
