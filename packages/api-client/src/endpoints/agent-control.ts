// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Agent 控制桥端点(2026-11-05 立,门 300 存量裁决 A 类:web / RN / 小程序端内直拼收口)。
 *
 * 后端真值:`apps/api/src/routes/index.ts:1015` 以 `/api/agent-control` 前缀注册,
 * 处理器在 `apps/api/src/routes/agent-control.ts:291`(POST /capability)与 `:456`(POST /result)。
 * 注:`apps/ai-service/app/main.py` 未注册该路由,故本文件走共享 `fetchApi` 而非 ai-service 专用基址。
 */
import type { AgentActionResponse, AgentControlCapability, ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/** POST /api/agent-control/capability 的载荷。 */
export interface AgentControlCapabilityData {
  registered: boolean
  instanceId: string
}

/** POST /api/agent-control/result 的载荷。 */
export interface AgentControlResultData {
  accepted: boolean
}

/** POST /api/agent-control/capability —— 上报端能力。 */
export async function reportAgentControlCapability(
  payload: AgentControlCapability,
): Promise<ApiResult<AgentControlCapabilityData>> {
  return fetchApi<AgentControlCapabilityData>('/api/agent-control/capability', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** POST /api/agent-control/result —— 回传动作执行结果。 */
export async function reportAgentControlResult(
  payload: AgentActionResponse,
): Promise<ApiResult<AgentControlResultData>> {
  return fetchApi<AgentControlResultData>('/api/agent-control/result', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
