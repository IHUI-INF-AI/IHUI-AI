#!/usr/bin/env node
/**
 * check-plan-mode.mjs — Plan Mode 两阶段分离守门 (Stage B)
 *
 * 背景:
 *   AI Agent 对标 Claude Code 引入两阶段 Plan Mode:
 *   阶段1 (探索): Agent 用 submit_plan 工具提交完整计划
 *   阶段2 (确认): 用户 /plan-accept 接受, 切换到执行模式
 *
 * 检查项:
 *   1. 后端 slash_commands.py 必须注册 /plan-accept 和 /plan-reject
 *   2. 后端 slash_commands.py 必须实现 handle_plan_accept 和 handle_plan_reject
 *   3. 后端 agent_loop.py 必须有 submit_plan 工具定义 (SUBMIT_PLAN_TOOL_DEFINITION)
 *   4. 后端 agent_loop.py 必须有 agent.plan.proposed 事件 yield
 *   5. 后端 permissions.py plan 模式必须允许 submit_plan
 *   6. 后端 session_store.py 必须有 save_plan / get_plan / clear_plan
 *   7. 前端 PlanReviewPanel.vue 必须存在
 *   8. 前端 AIChat.vue 必须挂载 PlanReviewPanel
 *   9. 前端 useWorkspaceAgent.ts 必须处理 agent.plan.proposed 事件
 *   10. 前端 5 个 locales 文件必须有 planReview 命名空间
 *   11. 后端 AgentEventType 枚举必须有 PLAN_PROPOSED
 *
 * 触发:
 *   - pre-commit: 总检查 (与文件 staged 状态无关, 因为是结构性守门)
 *   - 手动: node scripts/check-plan-mode.mjs
 *
 * 退出码: 0=全部通过, 1=发现遗漏
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

const BACKEND_SLASH = join(ROOT, 'server/app/api/v1/workspace/slash_commands.py')
const BACKEND_AGENT_LOOP = join(ROOT, 'server/app/api/v1/workspace/agent_loop.py')
const BACKEND_PERMISSIONS = join(ROOT, 'server/app/api/v1/workspace/permissions.py')
const BACKEND_SESSION = join(ROOT, 'server/app/api/v1/workspace/session_store.py')
const BACKEND_SCHEMAS = join(ROOT, 'server/app/api/v1/workspace/schemas.py')
const FRONTEND_PANEL = join(ROOT, 'client/src/components/ai/PlanReviewPanel.vue')
const FRONTEND_AI_CHAT = join(ROOT, 'client/src/components/ai/AIChat.vue')
const FRONTEND_COMPOSABLE = join(ROOT, 'client/src/composables/useWorkspaceAgent.ts')

const LOCALES = [
  join(ROOT, 'client/src/locales/modules/zh-CN/floatingChat.json'),
  join(ROOT, 'client/src/locales/modules/en/floatingChat.json'),
  join(ROOT, 'client/src/locales/modules/zh-TW/floatingChat.json'),
  join(ROOT, 'client/src/locales/modules/ja/floatingChat.json'),
  join(ROOT, 'client/src/locales/modules/ko/floatingChat.json'),
]

const violations = []

function fail(msg) {
  violations.push(msg)
}

function checkBackendSlash() {
  if (!existsSync(BACKEND_SLASH)) {
    fail(`[后端] 文件不存在: ${BACKEND_SLASH}`)
    return
  }
  const src = readFileSync(BACKEND_SLASH, 'utf-8')

  // 1. SLASH_COMMANDS 必须含 plan-accept 和 plan-reject
  for (const cmd of ['plan-accept', 'plan-reject']) {
    const pattern = new RegExp(`["']${cmd}["']\\s*:`)
    if (!pattern.test(src)) {
      fail(`[后端] SLASH_COMMANDS 缺少 /${cmd} 命令`)
    }
  }

  // 2. handle_plan_accept 和 handle_plan_reject 必须存在
  for (const fn of ['handle_plan_accept', 'handle_plan_reject']) {
    const pattern = new RegExp(`async def\\s+${fn}\\s*\\(`)
    if (!pattern.test(src)) {
      fail(`[后端] 缺少 async def ${fn} 函数`)
    }
  }

  // 3. COMMAND_HANDLERS 必须注册 plan-accept / plan-reject
  for (const cmd of ['plan-accept', 'plan-reject']) {
    const pattern = new RegExp(`["']${cmd}["']\\s*:\\s*handle_plan`)
    if (!pattern.test(src)) {
      fail(`[后端] COMMAND_HANDLERS 缺少 /${cmd} -> handle 映射`)
    }
  }
}

function checkBackendAgentLoop() {
  if (!existsSync(BACKEND_AGENT_LOOP)) {
    fail(`[后端] 文件不存在: ${BACKEND_AGENT_LOOP}`)
    return
  }
  const src = readFileSync(BACKEND_AGENT_LOOP, 'utf-8')

  // 4. submit_plan 工具定义必须存在
  if (!/SUBMIT_PLAN_TOOL_DEFINITION\s*=/.test(src)) {
    fail(`[后端] agent_loop.py 缺少 SUBMIT_PLAN_TOOL_DEFINITION 工具定义`)
  }
  if (!/"submit_plan"/.test(src)) {
    fail(`[后端] agent_loop.py 缺少 submit_plan 工具注册 (TOOL 名)`)
  }

  // 5. agent.plan.proposed 事件 yield 必须存在
  if (!/"agent\.plan\.proposed"/.test(src)) {
    fail(`[后端] agent_loop.py 缺少 agent.plan.proposed 事件 yield`)
  }

  // 6. Plan 模式工具注入逻辑必须存在
  if (!/is_plan_mode\s*=\s*permission_mode\s*==\s*PermissionMode\.PLAN/.test(src)) {
    fail(`[后端] agent_loop.py 缺少 is_plan_mode 判断`)
  }
  if (!/is_plan_mode\s+and\s+tc_name\s*==\s*["']submit_plan["']/.test(src)) {
    fail(`[后端] agent_loop.py 缺少 plan 模式 + submit_plan 工具的特殊处理分支`)
  }

  // 7. save_plan 调用 (持久化 plan 到 session)
  if (!/save_plan\s*\(/.test(src)) {
    fail(`[后端] agent_loop.py 缺少 save_plan() 调用 (持久化 plan)`)
  }
}

function checkBackendPermissions() {
  if (!existsSync(BACKEND_PERMISSIONS)) {
    fail(`[后端] 文件不存在: ${BACKEND_PERMISSIONS}`)
    return
  }
  const src = readFileSync(BACKEND_PERMISSIONS, 'utf-8')

  // 8. plan 模式必须包含 submit_plan
  if (!/plan_mode_tools\s*=\s*read_only_tools\s*\|\s*\{[\s\S]*?submit_plan/.test(src)) {
    fail(`[后端] permissions.py plan 模式未包含 submit_plan (两阶段分离核心)`)
  }
}

function checkBackendSession() {
  if (!existsSync(BACKEND_SESSION)) {
    fail(`[后端] 文件不存在: ${BACKEND_SESSION}`)
    return
  }
  const src = readFileSync(BACKEND_SESSION, 'utf-8')

  // 9. save_plan / get_plan / clear_plan 函数必须存在
  for (const fn of ['save_plan', 'get_plan', 'clear_plan']) {
    const pattern = new RegExp(`def\\s+${fn}\\s*\\(`)
    if (!pattern.test(src)) {
      fail(`[后端] session_store.py 缺少 def ${fn} 函数`)
    }
  }

  // 10. pending_plan 字段持久化
  if (!/pending_plan/.test(src)) {
    fail(`[后端] session_store.py 缺少 pending_plan 字段持久化`)
  }
}

function checkBackendSchemas() {
  if (!existsSync(BACKEND_SCHEMAS)) {
    fail(`[后端] 文件不存在: ${BACKEND_SCHEMAS}`)
    return
  }
  const src = readFileSync(BACKEND_SCHEMAS, 'utf-8')

  // 11. PLAN_PROPOSED 事件枚举
  if (!/PLAN_PROPOSED\s*=\s*["']agent\.plan\.proposed["']/.test(src)) {
    fail(`[后端] schemas.py AgentEventType 缺少 PLAN_PROPOSED 枚举值`)
  }
}

function checkFrontendPanel() {
  if (!existsSync(FRONTEND_PANEL)) {
    fail(`[前端] PlanReviewPanel.vue 不存在: ${FRONTEND_PANEL}`)
    return
  }
  const src = readFileSync(FRONTEND_PANEL, 'utf-8')

  if (!/plan-review-panel/.test(src)) {
    fail(`[前端] PlanReviewPanel.vue 缺少 .plan-review-panel 根 class`)
  }
  if (!/export\s+interface\s+PlanData/.test(src)) {
    fail(`[前端] PlanReviewPanel.vue 缺少 export interface PlanData 类型定义`)
  }
  // 2026-07-07 修复: 改为检测 emit('accept') / emit('reject') 实际调用, 而非模板 @accept/@reject (脚本误报)
  if (!/emit\s*\(\s*['"]accept['"]/.test(src)) {
    fail(`[前端] PlanReviewPanel.vue 缺少 accept 事件 emit`)
  }
  if (!/emit\s*\(\s*['"]reject['"]/.test(src)) {
    fail(`[前端] PlanReviewPanel.vue 缺少 reject 事件 emit`)
  }
}

function checkFrontendAIChat() {
  if (!existsSync(FRONTEND_AI_CHAT)) {
    fail(`[前端] AIChat.vue 不存在: ${FRONTEND_AI_CHAT}`)
    return
  }
  const src = readFileSync(FRONTEND_AI_CHAT, 'utf-8')

  if (!/PlanReviewPanel/.test(src)) {
    fail(`[前端] AIChat.vue 未挂载 PlanReviewPanel 组件`)
  }
  if (!/pendingPlanForReview/.test(src)) {
    fail(`[前端] AIChat.vue 缺少 pendingPlanForReview 响应式状态`)
  }
  if (!/onAcceptPlan|onRejectPlan/.test(src)) {
    fail(`[前端] AIChat.vue 缺少 onAcceptPlan / onRejectPlan 处理函数`)
  }
}

function checkFrontendComposable() {
  if (!existsSync(FRONTEND_COMPOSABLE)) {
    fail(`[前端] useWorkspaceAgent.ts 不存在: ${FRONTEND_COMPOSABLE}`)
    return
  }
  const src = readFileSync(FRONTEND_COMPOSABLE, 'utf-8')

  // 12. agent.plan.proposed 事件处理
  if (!/case\s+["']agent\.plan\.proposed["']/.test(src)) {
    fail(`[前端] useWorkspaceAgent.ts 缺少 agent.plan.proposed 事件处理`)
  }

  // 13. acceptPlan / rejectPlan 函数
  for (const fn of ['acceptPlan', 'rejectPlan']) {
    const pattern = new RegExp(`function\\s+${fn}\\s*\\(`)
    if (!pattern.test(src)) {
      fail(`[前端] useWorkspaceAgent.ts 缺少 function ${fn} 函数`)
    }
  }

  // 14. currentPendingPlan 状态
  if (!/currentPendingPlan/.test(src)) {
    fail(`[前端] useWorkspaceAgent.ts 缺少 currentPendingPlan 响应式状态`)
  }
}

function checkLocales() {
  for (const file of LOCALES) {
    if (!existsSync(file)) {
      fail(`[i18n] 文件不存在: ${file}`)
      continue
    }
    const src = readFileSync(file, 'utf-8')
    // 2026-07-07 修复: 检测路径切换到 modules/{lang}/floatingChat.json,
    // 实际 planReview 命名空间位于 floatingChat.workspaceAgent.planReview
    if (!/"workspaceAgent"\s*:\s*\{/.test(src)) {
      fail(`[i18n] ${file} 缺少 floatingChat.workspaceAgent 命名空间`)
      continue
    }
    if (!/"planReview"\s*:\s*\{/.test(src)) {
      fail(`[i18n] ${file} 缺少 workspaceAgent.planReview 命名空间`)
      continue
    }
    // 关键 key 完整性
    for (const key of ['accept', 'reject', 'badge', 'stepsTitle']) {
      const pattern = new RegExp(`"${key}"\\s*:`)
      if (!pattern.test(src)) {
        fail(`[i18n] ${file} planReview.${key} key 缺失`)
      }
    }
  }
}

// 主流程
const args = process.argv.slice(2)
const stagedOnly = args.includes('--staged')

if (stagedOnly) {
  console.log('[INFO] staged 模式: 仍执行全量守门 (结构性检查)')
}

checkBackendSlash()
checkBackendAgentLoop()
checkBackendPermissions()
checkBackendSession()
checkBackendSchemas()
checkFrontendPanel()
checkFrontendAIChat()
checkFrontendComposable()
checkLocales()

if (violations.length === 0) {
  console.log('[OK] Plan Mode 两阶段分离守门通过:')
  console.log('     - 后端: 8 个检查项 (slash commands / submit_plan / plan.proposed / permissions / session / schemas)')
  console.log('     - 前端: 3 个检查项 (PlanReviewPanel / AIChat 集成 / useWorkspaceAgent 事件处理)')
  console.log('     - i18n: 5 个 locales × 4 个 key = 20 个 key 完整')
  process.exit(0)
} else {
  console.error(`[FAIL] Plan Mode 两阶段分离发现 ${violations.length} 处违规:`)
  for (const v of violations) {
    console.error(`  - ${v}`)
  }
  console.error('')
  console.error('修复方法:')
  console.error('  1. 后端 slash_commands.py: 注册 /plan-accept / /plan-reject + handler')
  console.error('  2. 后端 agent_loop.py: SUBMIT_PLAN_TOOL_DEFINITION + agent.plan.proposed 事件')
  console.error('  3. 后端 permissions.py: plan 模式允许 submit_plan')
  console.error('  4. 后端 session_store.py: save_plan / get_plan / clear_plan + pending_plan 字段')
  console.error('  5. 后端 schemas.py: AgentEventType.PLAN_PROPOSED = "agent.plan.proposed"')
  console.error('  6. 前端 PlanReviewPanel.vue: 组件 + PlanData 类型 + accept/reject emit')
  console.error('  7. 前端 AIChat.vue: 挂载 PlanReviewPanel + onAcceptPlan / onRejectPlan')
  console.error('  8. 前端 useWorkspaceAgent.ts: 事件处理 + currentPendingPlan + acceptPlan/rejectPlan')
  console.error('  9. 前端 locales: 5 个语言 + planReview 命名空间 + accept/reject/badge/stepsTitle 4 个 key')
  process.exit(1)
}
