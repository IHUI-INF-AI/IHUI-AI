// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ext_ui 请求转发 glue(2026-09-21 立,方案 a:一条 WS、一处回执)。
 *
 * ext_ui 的执行环境是 sidepanel(它才有自己的 document),background 不能代执行。
 * 链路:WS agent.action → background bridge(`agent-control-bridge.ts`)→
 * `dispatchAgentActionRequest` 按 category 分流 —— `ext_ui` 经
 * chrome.runtime.sendMessage 转发 sidepanel(`entrypoints/sidepanel/ext-ui-listener.ts`
 * 监听执行,结果经 sendResponse 沿同一通道返回);其余 category 走既有
 * `agent-control.ts executeAgentActionRequest`。回执统一由 bridge 的 reportResult
 * POST /api/agent-control/result。
 *
 * sidepanel 未打开时如实回 TARGET_NOT_CONNECTED(不后台拉起 sidepanel —— MV3 的
 * chrome.sidePanel.open 需要用户手势,静默拉起既不可行也不该做)。
 */
import type { AgentActionErrorCode, AgentActionRequest, AgentActionResponse } from '@ihui/types'
import type { DomActionResult } from '@ihui/dom-actions'
import { executeAgentActionRequest } from './agent-control'

/** background ↔ sidepanel 的 ext_ui 转发消息类型(非 wire 协议,仅扩展内部) */
export const EXT_UI_FORWARD_MESSAGE_TYPE = 'agent.action.ext_ui'

export function isExtUiRequest(req: AgentActionRequest | null | undefined): boolean {
  return req?.category === 'ext_ui'
}

function isDomActionResult(v: unknown): v is DomActionResult {
  if (!v || typeof v !== 'object') return false
  return typeof (v as { success?: unknown }).success === 'boolean'
}

/**
 * background → sidepanel 转发,带超时。无监听者 / 抛错一律 TARGET_NOT_CONNECTED。
 */
export async function forwardExtUiToSidepanel(
  req: AgentActionRequest,
  timeoutMs = 30000,
): Promise<DomActionResult> {
  const g = globalThis as {
    chrome?: { runtime?: { sendMessage?: (msg: unknown) => Promise<unknown> } }
  }
  const runtime = g.chrome?.runtime
  if (typeof runtime?.sendMessage !== 'function') {
    return {
      success: false,
      errorCode: 'TARGET_NOT_CONNECTED',
      error: 'sidepanel not reachable: chrome.runtime.sendMessage unavailable',
    }
  }
  const sendPromise = runtime
    .sendMessage({ type: EXT_UI_FORWARD_MESSAGE_TYPE, payload: req })
    .then((res: unknown): DomActionResult => {
      if (isDomActionResult(res)) return res
      return {
        success: false,
        errorCode: 'EXECUTION_FAILED',
        error: 'invalid response from sidepanel',
      }
    })
    .catch((err: unknown): DomActionResult => ({
      success: false,
      errorCode: 'TARGET_NOT_CONNECTED',
      error: err instanceof Error ? err.message : String(err),
    }))
  const timeoutPromise = new Promise<DomActionResult>((resolve) => {
    setTimeout(() => {
      resolve({
        success: false,
        errorCode: 'TIMEOUT',
        error: `sidepanel no response after ${timeoutMs}ms`,
      })
    }, timeoutMs)
  })
  return Promise.race([sendPromise, timeoutPromise])
}

/**
 * 统一分流入口:ext_ui → sidepanel;其余 → 既有 browser 执行器。
 * 回执形状与 executeAgentActionRequest 完全一致(executedBy='extension')。
 */
export async function dispatchAgentActionRequest(
  req: AgentActionRequest,
): Promise<AgentActionResponse> {
  const start = Date.now()
  const result: DomActionResult = isExtUiRequest(req)
    ? await forwardExtUiToSidepanel(req, req.timeout ?? 30000)
    : await executeAgentActionRequest(req)
  return {
    requestId: req.requestId,
    success: result.success,
    error: result.error,
    errorCode: result.errorCode as AgentActionErrorCode | undefined,
    data: result.data,
    durationMs: Date.now() - start,
    executedBy: 'extension',
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
