// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ext_ui sidepanel 侧监听 glue(2026-09-21 立,方案 a 的接收端)。
 *
 * background 收到 `category === 'ext_ui'` 的 AgentActionRequest 后经
 * chrome.runtime.sendMessage({ type: 'agent.action.ext_ui', payload }) 转发到这里;
 * 本文件在 sidepanel 上下文执行 `lib/ui-action-registry.ts` 的七动词执行器,
 * 结果(DomActionResult 形状)经 sendResponse 沿同一通道回 background。
 * main.tsx 启动时调用 `initExtUiListener()` 一次。
 */
import type { AgentActionRequest } from '@ihui/types'
import { executeExtUiAction } from '../../lib/ui-action-registry'
import { EXT_UI_FORWARD_MESSAGE_TYPE } from '../../lib/ext-ui-forwarder'
import { isTrustedTopLevelExtensionSender, type RuntimeSenderLike } from '../../lib/message-trust'

export function initExtUiListener(): void {
  chrome.runtime.onMessage.addListener(
    (
      msg: unknown,
      sender: RuntimeSenderLike | undefined,
      sendResponse: (response: unknown) => void,
    ) => {
      const m = msg as { type?: string; payload?: AgentActionRequest } | null
      if (!m || m.type !== EXT_UI_FORWARD_MESSAGE_TYPE || !m.payload) return false
      // 2026-11-08 同型根因 D 类:ext_ui 能点/填/滚动宿主页面,属高权限入口。
      // 只接受 background 转发(sender.tab === undefined 的顶层扩展上下文);
      // 内容脚本的 sender 必带 tab,外部扩展/网页 id 不同 —— 一律不执行、不回执。
      if (!isTrustedTopLevelExtensionSender(sender, chrome.runtime.id)) {
        console.warn(
          '[IHUI AI] ext_ui listener: 丢弃非白名单来源的动作',
          m.payload.requestId,
          sender?.id ?? '(none)',
          sender?.url ?? '(no-url)',
        )
        return false
      }
      const req = m.payload
      void executeExtUiAction(
        req.action as Parameters<typeof executeExtUiAction>[0],
        req.params ?? {},
      )
        .then(sendResponse)
        .catch((err: unknown) => {
          sendResponse({
            success: false,
            errorCode: 'EXECUTION_FAILED',
            error: err instanceof Error ? err.message : String(err),
          })
        })
      return true // 异步响应
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
