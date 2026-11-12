// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 任务模板工具(HR-4,2026-11-11 立):把「一句话目标 → 编排执行」暴露成两枚 AI 工具。
 *
 * · ai_task_template_create:落一枚任务模板(目标 + 步骤序列 + 触发方式),POST /api/ai-tasks。
 * · ai_task_run:触发某枚模板执行(可指定 replayFromStep 从失败步续跑),POST /api/ai-tasks/:name/run。
 *
 * 端点 method/path/body 与 `apps/api/src/routes/ai-task-templates.ts` 逐字对齐(该文件 `POST /`
 * 挂在 `/api/ai-tasks` 前缀下,`POST /:name/run` 即 `/api/ai-tasks/:name/run`)。
 * 调用统一走 `invokeApi`(与 api-bridge 共用同一条 fetchApi 腿,AGENTS §3 共享层优先)。
 *
 * 本文件**只声明工具数组**,不注册进 api-bridge / CLI 入口(接线由主 agent 完成)。
 */

import type { ToolContract } from '@ihui/types'
import type { Tool, ToolParameter } from './index.js'
import { invokeApi } from './route-tools.js'

/**
 * 写档契约:与 api-bridge.ts 同级写工具同一形状(permissionKey 沿用 `api.invoke.write`)。
 * 授权由目标端点既有 RBAC(`hr:attendance:manage`)判定,桥层不复制权限判据;出网、不额外弹确认。
 */
const WRITE_CONTRACT: ToolContract = {
  shape: {
    visibleToProvider: true,
    input: {
      type: 'object',
      description: '入参与目标 API 端点的 path/body 逐字对齐。',
    },
  },
  permission: {
    permissionKey: 'api.invoke.write',
    reason: '变更后端业务数据(建模板/触发执行):授权由目标端点既有 RBAC 判定,桥层不复制权限判据',
    riskLevel: 'write',
    effectScope: 'network',
    requiresApproval: false,
    confirmation: {
      mode: 'none',
      reason: '写操作由 dangerLevel:write 档立即执行、由目标端点 RBAC 判定授权,不额外弹确认',
    },
  },
  resultBudget: {
    inlineLimitBytes: 64 * 1024,
    providerVisibleLimitBytes: 32 * 1024,
    policy: 'truncate',
    preview: { bytes: 4096, lines: 80, from: 'head' },
  },
}

const AI_TASKS_PREFIX = '/api/ai-tasks'

/**
 * 两枚 AI 任务模板工具。`ai_task_run` 的 `name` 是路径参数(逐字写进 URL,不经 body)。
 */
export const AI_TASK_TEMPLATE_TOOLS: Tool[] = [
  {
    name: 'ai_task_template_create',
    description:
      '把一句话目标建成一枚 AI 任务模板。body: name(唯一名)、goal(目标)、steps(步骤序列,每步 {method, path, params?, injectFromPrev?{into}})、triggerType(manual/cron/event,缺省 manual)、cron(triggerType=cron 时必填)。',
    parameters: {
      name: { type: 'string', description: '模板唯一名,执行器按名加载(≤120 字符)' },
      goal: { type: 'string', description: '一句话目标,人读(≤1000 字符)' },
      steps: {
        type: 'array',
        description:
          '步骤序列(1~50 步),每步 {method, path, params?, injectFromPrev?{into}};injectFromPrev.into 指定把上一步输出整包塞进本步 params 的哪个键',
      },
      triggerType: {
        type: 'string',
        enum: ['manual', 'cron', 'event'],
        description: '触发方式,缺省 manual;cron 需同时给 cron 表达式',
      },
      cron: { type: 'string', description: 'cron 表达式,triggerType=cron 时必填(≤100 字符)' },
    },
    required: ['name', 'goal', 'steps'],
    dangerLevel: 'write',
    contract: WRITE_CONTRACT,
    execute: async (args) => {
      try {
        const body: Record<string, unknown> = {
          name: args.name,
          goal: args.goal,
          steps: args.steps,
        }
        if (args.triggerType !== undefined && args.triggerType !== null) {
          body.triggerType = args.triggerType
        }
        if (args.cron !== undefined && args.cron !== null && args.cron !== '') {
          body.cron = args.cron
        }
        const data = await invokeApi('POST', AI_TASKS_PREFIX, { body })
        return {
          success: true,
          output: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
        }
      } catch (e) {
        return { success: false, output: '', error: e instanceof Error ? e.message : String(e) }
      }
    },
  },
  {
    name: 'ai_task_run',
    description:
      '触发一枚 AI 任务模板执行。name 为路径参数;可选 manual(手动触发,幂等键带毫秒后缀,同窗口可多次各留一痕)、replayFromStep(从该步续跑,失败重放用)。',
    parameters: {
      name: { type: 'string', description: '目标模板名(路径参数,必填)' },
      manual: { type: 'boolean', description: '是否手动触发,缺省 true;影响幂等键形态' },
      replayFromStep: {
        type: 'number',
        description: '重放起始步下标(≥0),失败续跑用;缺省 0 从头跑',
      },
    } satisfies Record<string, ToolParameter>,
    required: ['name'],
    dangerLevel: 'write',
    contract: WRITE_CONTRACT,
    execute: async (args) => {
      try {
        const name = String(args.name ?? '').trim()
        if (!name) return { success: false, output: '', error: '缺少路径参数 name' }
        const body: Record<string, unknown> = {}
        if (args.manual !== undefined && args.manual !== null) body.manual = args.manual
        if (args.replayFromStep !== undefined && args.replayFromStep !== null) {
          body.replayFromStep = args.replayFromStep
        }
        const data = await invokeApi('POST', `${AI_TASKS_PREFIX}/${encodeURIComponent(name)}/run`, {
          body,
        })
        return {
          success: true,
          output: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
        }
      } catch (e) {
        return { success: false, output: '', error: e instanceof Error ? e.message : String(e) }
      }
    },
  },
]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
