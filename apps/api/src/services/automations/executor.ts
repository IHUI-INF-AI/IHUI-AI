// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D30 修复执行器适配器(2026-09-26 立)。
 *
 * 范围控制:不实现真实代码修复沙箱。这里只定义注入式适配接口与两档实现:
 * - stub(默认):仅登记任务(供审计/联调),不执行任何真实修复;
 * - agent:经 ai-service 的 /api/agents/execute 通道提交修复任务
 *   (与 routes/v1-ai-core.ts 的转发通道同源;goal 必填契约已对齐)。
 */

import type { FixExecutor, FixResult, FixTask } from './types.js'

/** 创建 stub 执行器:任务推进 sink(可选,测试/审计可注入数组观察)。 */
export function createStubExecutor(sink?: FixTask[]): FixExecutor {
  return {
    name: 'stub',
    async execute(task) {
      sink?.push(task)
      return {
        ok: true,
        summary: 'stub 模式:任务已登记,未执行真实修复(D30 范围=编排与通道对接)',
      }
    },
  }
}

export interface AgentExecutorOptions {
  /** ai-service 侧目标 agent id(env IHUI_AUTOMATIONS_AGENT_ID) */
  agentId: string
  /**
   * 注入式 ai-service 通道;默认动态加载 utils/ai-service-fetch 的
   * aiServiceSystemFetch(自动带系统 token,与 v1-ai-core 转发同源)。
   * 动态 import 的目的:测试注入 fake 时绝不触发 config/env 依赖加载。
   */
  aiFetch?: (path: string, init: RequestInit) => Promise<Response>
}

/** 创建 agent 执行器:把修复任务经 ai-service /api/agents/execute 提交。 */
export function createAgentExecutor(options: AgentExecutorOptions): FixExecutor {
  const { agentId } = options
  const call = options.aiFetch
  return {
    name: 'agent',
    async execute(task): Promise<FixResult> {
      if (!call) {
        // 动态加载默认通道(仅真实运行时才会走到)
        const mod = await import('../../utils/ai-service-fetch.js')
        return submit(mod.aiServiceSystemFetch, task, agentId)
      }
      return submit(call, task, agentId)
    },
  }
}

async function submit(
  aiFetch: (path: string, init: RequestInit) => Promise<Response>,
  task: FixTask,
  agentId: string,
): Promise<FixResult> {
  const body = {
    agent_id: agentId,
    input: task.goal,
    goal: task.goal, // ai-service 的 goal 为必填字段(见 v1-ai-core buildAgentExecuteBody 教训)
    session_id: `automations_d30_${task.key}`,
    max_iterations: 5,
  }
  try {
    const resp = await aiFetch('/api/agents/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!resp.ok) {
      const txt = (await resp.text().catch(() => '')).slice(0, 200)
      return { ok: false, summary: '', error: `ai-service /api/agents/execute → ${resp.status}: ${txt}` }
    }
    const data = (await resp.json().catch(() => ({}))) as { task_id?: string; id?: string }
    const ref = data.task_id ?? data.id ?? 'n/a'
    return { ok: true, summary: `agent 执行器已受理(task=${ref})` }
  } catch (err) {
    return { ok: false, summary: '', error: `agent 执行器提交失败: ${String(err)}` }
  }
}
