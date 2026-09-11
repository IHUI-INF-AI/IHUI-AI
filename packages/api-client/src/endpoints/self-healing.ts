// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * Self-healing 验证自愈引擎端点(2026-09-11 立,2-3 产品化第一批:web 自愈驾驶舱)。
 *
 * 后端:apps/ai-service/app/routers/self_healing.py(
 *   prefix /api/v1/self-healing,经 web rewrites 以 /api/self-healing 暴露):
 *   - POST /run  body: {task, target_path}
 *     * AGENT_SELF_HEALING_ENABLED 未开启 → HTTP 200 + {code:1, data:{enabled:false}}
 *     * target_path 越出 MCP workspace 白名单 → HTTP 400 信封
 *     * 正常返回 {code:0, message:"ok", data: HealOutcome.to_dict()}
 *
 * 注意:heal 循环真实起 pytest 子进程 + 多轮 LLM 补丁,耗时可达分钟级,
 * 超时设 10 分钟(远超 fetchAiServiceJson 默认 30s)。
 */

import type { ApiResult } from '@ihui/types'
import { fetchAiServiceJson } from '../client'

// ===================== 类型定义(镜像 services/self_healing.py dataclass) =====================

/** 单次修复尝试记录(HealOutcome.run_history 元素) */
export interface SelfHealingAttemptRecord {
  attempt: number
  passed: number
  failed: number
  /** LLM 生成的补丁(通常为 {path, new_content} 结构,失败为 null) */
  patch_applied: unknown
}

/** 自愈循环最终结果(HealOutcome) */
export interface SelfHealingOutcome {
  ok: boolean
  final_passed: boolean
  attempts: number
  run_history: SelfHealingAttemptRecord[]
  suggestions: string[]
}

/** POST /run 统一信封(后端所有分支都包 {code, message, data},含未开启/非法路径) */
export interface SelfHealingRunResponse {
  code: number
  message: string
  data: SelfHealingOutcome | { enabled: boolean } | null
}

// ===================== 接口函数 =====================

/**
 * 执行自愈循环:LLM 生成用例 → pytest 运行 → LLM 补丁 → 重跑。
 * 未开启(AGENT_SELF_HEALING_ENABLED)时后端返回 code=1 + data.enabled=false(HTTP 200)。
 */
export function runSelfHealing(input: {
  task: string
  targetPath: string
}): Promise<ApiResult<SelfHealingRunResponse>> {
  return fetchAiServiceJson<SelfHealingRunResponse>('/api/self-healing/run', {
    method: 'POST',
    body: JSON.stringify({ task: input.task, target_path: input.targetPath }),
    timeoutMs: 600_000,
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​​‌‍‍​‌​​‌​​​‌‍‍​‌​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍​​‌‌​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍‌​‌‌​‌‌​‌‍‍‌‌​​‌‌​​​‌​​​‌‌‌‍‍‌​‌‌​‌‌​‌‍‍‌‌​​‌‌​‌‌‌​‍‍‌‌​​‌‌​‌‍‍​‌‌​‌‌​‍‍‌​‌‌​‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‍‍‌​‌‌​‌‌​‌‍‍‌​‌‌​‌‌​‌‍‍​‌​​‌​‌‌​‌‍‍‌‌​​‌‌​‌‍‍​‌‌​‌​‌‌​‍‍‌​‌‌​‌​‌‍‍‌‌​‌‌​​‌‌‍‍‌​‌‌​‌‌​‍‍​‌​‌‌​‌​‌‍‍‌‌​​‌​‌‌​‌‍‍‌​‌‌​‌​‍‍‌‌​‌‌​‌​‌‍‍‌‌​​‌‌​‍‍
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
