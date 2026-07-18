/**
 * Crew 角色 prompt 加载器.
 *
 * 优先级:
 *   1. CREW_ROLES_JSON 环境变量 (运营/产品可在不改代码情况下覆盖 prompt)
 *   2. 内置 crew-roles.json (通过 import 加载, 编译时静态绑定)
 *   3. fallback (与历史硬编码默认值保持一致, 加载失败时兜底)
 *
 * 设计原则:
 *   - 加载失败不抛错, 而是回退到 fallback, 保证 Crew 模块始终可用
 *   - 缓存: 同一进程只解析一次 (env 变化时需要 __resetCrewRoleLoaderForTests)
 *   - 不在 loader 内部做 schema 验证: 失败时打印 warn 并 fallback
 */

import { createRequire } from 'node:module'
import type { AgentRoleConfig } from './crew-agent-registry.js'

// =============================================================================
// Fallback (与历史硬编码默认值保持一致, 加载失败时兜底)
// =============================================================================

const FALLBACK_ROLES: Record<string, AgentRoleConfig> = {
  planner: {
    role: 'planner',
    goal: '分析用户需求,将复杂任务分解为可执行的子任务序列,制定最优执行计划',
    backstory:
      '你是一位经验丰富的项目规划师,擅长将复杂问题拆解为清晰的步骤。你总是考虑任务间的依赖关系和执行优先级,确保计划的高效性和可操作性。',
    llmModelId: '',
    tools: [],
    allowDelegation: true,
    verbose: true,
  },
  researcher: {
    role: 'researcher',
    goal: '利用知识库和外部资源收集与任务相关的信息,为团队提供准确的知识支撑',
    backstory:
      '你是一位严谨的研究员,拥有强大的信息检索和分析能力。你善于从海量信息中提取关键知识点,为后续执行提供可靠的依据。',
    llmModelId: '',
    tools: ['rag_search'],
    allowDelegation: false,
    verbose: true,
  },
  executor: {
    role: 'executor',
    goal: '根据规划和研究结果,高效执行具体任务,产出高质量的工作成果',
    backstory:
      '你是一位全能的执行专家,具备广泛的技能和丰富的实战经验。你能够调用各种工具和API来完成任务,确保输出结果的准确性和完整性。',
    llmModelId: '',
    tools: ['coze_workflow', 'llm_generate'],
    allowDelegation: false,
    verbose: true,
  },
  reviewer: {
    role: 'reviewer',
    goal: '审查执行结果的质量和准确性,提供改进建议,确保最终交付物满足要求',
    backstory:
      '你是一位严格的质量审查专家,对细节有着极高的敏感度。你不仅检查结果的正确性,还关注逻辑性、完整性和用户体验。',
    llmModelId: '',
    tools: [],
    allowDelegation: false,
    verbose: true,
  },
  reporter: {
    role: 'reporter',
    goal: '汇总所有阶段的结果,生成结构清晰、内容完整的最终报告',
    backstory:
      '你是一位专业的技术写作专家,擅长将复杂的技术内容转化为清晰易懂的报告。你注重逻辑结构和表达效果,确保读者能快速获取关键信息。',
    llmModelId: '',
    tools: [],
    allowDelegation: false,
    verbose: true,
  },
}

// =============================================================================
// 加载逻辑
// =============================================================================

/** 从 JSON 字符串解析并校验 */
function parseRoles(json: string, source: string): Record<string, AgentRoleConfig> {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (err) {
    console.warn(`[crew-role-loader] ${source} JSON 解析失败, 使用 fallback:`, err)
    return FALLBACK_ROLES
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.warn(`[crew-role-loader] ${source} 顶层不是对象, 使用 fallback`)
    return FALLBACK_ROLES
  }
  const result: Record<string, AgentRoleConfig> = {}
  for (const [name, cfg] of Object.entries(parsed as Record<string, unknown>)) {
    if (name.startsWith('_')) continue // 注释字段
    if (!cfg || typeof cfg !== 'object') continue
    const c = cfg as Partial<AgentRoleConfig>
    if (
      typeof c.role !== 'string' ||
      typeof c.goal !== 'string' ||
      typeof c.backstory !== 'string'
    ) {
      console.warn(`[crew-role-loader] ${source} 角色 ${name} 缺少必要字段, 已跳过`)
      continue
    }
    result[name] = {
      role: c.role,
      goal: c.goal,
      backstory: c.backstory,
      llmModelId: typeof c.llmModelId === 'string' ? c.llmModelId : '',
      tools: Array.isArray(c.tools)
        ? c.tools.filter((t): t is string => typeof t === 'string')
        : [],
      allowDelegation: typeof c.allowDelegation === 'boolean' ? c.allowDelegation : false,
      verbose: typeof c.verbose === 'boolean' ? c.verbose : false,
    }
  }
  return result
}

/** 加载内置 crew-roles.json (通过 createRequire 避免 ESM JSON import 限制) */
function loadBuiltin(): Record<string, AgentRoleConfig> {
  try {
    const require = createRequire(import.meta.url)
    const json = require('./crew-roles.json') as string
    return parseRoles(json, '内置 crew-roles.json')
  } catch (err) {
    console.warn('[crew-role-loader] 加载内置 crew-roles.json 失败, 使用 fallback:', err)
    return FALLBACK_ROLES
  }
}

let cached: Record<string, AgentRoleConfig> | undefined

/** 获取所有角色配置 (按 env > 内置 > fallback 优先级) */
export function loadCrewRoles(): Record<string, AgentRoleConfig> {
  if (cached) return cached

  const envJson = process.env.CREW_ROLES_JSON
  if (envJson && envJson.trim()) {
    cached = parseRoles(envJson, 'CREW_ROLES_JSON env')
    return cached
  }
  cached = loadBuiltin()
  return cached
}

/** 单元测试 hook: 重置缓存, 让下次 loadCrewRoles() 重新解析 */
export function __resetCrewRoleLoaderForTests(): void {
  cached = undefined
}
