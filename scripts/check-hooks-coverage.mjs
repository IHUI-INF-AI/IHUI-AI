#!/usr/bin/env node
/**
 * check-hooks-coverage.mjs — Hook 扩展点覆盖率守门 (Stage B)
 *
 * 背景:
 *   skills.py 定义了 10 个 HOOK_EVENTS (PreToolUse/PostToolUse/SessionStart/.../SubagentStart/SubagentStop),
 *   每个事件必须在 agent_loop.py 或 subagents.py 中被实际触发 (await run_hooks 调用),
 *   否则用户配置的 hook 永远不会执行, 静默失效.
 *
 * 检查项 (10 个 HOOK_EVENTS 必须全部被触发):
 *   1. SessionStart     - agent_loop.py: 启动会话时
 *   2. UserPromptSubmit - agent_loop.py: 用户提交 prompt 时
 *   3. PreToolUse       - agent_loop.py: 工具调用前
 *   4. PostToolUse      - agent_loop.py: 工具调用后
 *   5. PreCompact       - agent_loop.py: 上下文压缩前
 *   6. PostCompact      - agent_loop.py: 上下文压缩后 (声明但未实现也算违规)
 *   7. Stop             - agent_loop.py: Agent 回合结束
 *   8. SessionEnd       - agent_loop.py: 会话结束
 *   9. SubagentStart    - subagents.py: 子代理启动
 *   10. SubagentStop    - subagents.py: 子代理结束
 *
 * 触发:
 *   - pre-commit: 总检查 (与文件 staged 状态无关, 因为是结构性守门)
 *   - 手动: node scripts/check-hooks-coverage.mjs
 *
 * 退出码: 0=全部通过, 1=发现 Hook 事件未被触发
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

const SKILLS_FILE = join(ROOT, 'server/app/api/v1/workspace/skills.py')
const AGENT_LOOP_FILE = join(ROOT, 'server/app/api/v1/workspace/agent_loop.py')
const SUBAGENTS_FILE = join(ROOT, 'server/app/api/v1/workspace/subagents.py')

// 10 个 HOOK_EVENTS 在 skills.py 中声明
const HOOK_EVENTS = [
  'SessionStart',
  'SessionEnd',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PreCompact',
  'PostCompact',
  'Stop',
  'SubagentStart',
  'SubagentStop',
]

// 每个事件预期的触发位置 (事件 -> 触发该事件的源文件)
const HOOK_TRIGGER_LOCATIONS = {
  SessionStart: AGENT_LOOP_FILE,
  SessionEnd: AGENT_LOOP_FILE,
  UserPromptSubmit: AGENT_LOOP_FILE,
  PreToolUse: AGENT_LOOP_FILE,
  PostToolUse: AGENT_LOOP_FILE,
  PreCompact: AGENT_LOOP_FILE,
  PostCompact: AGENT_LOOP_FILE,
  Stop: AGENT_LOOP_FILE,
  SubagentStart: SUBAGENTS_FILE,
  SubagentStop: SUBAGENTS_FILE,
}

const violations = []

function fail(msg) {
  violations.push(msg)
}

function checkHookEventsDeclared() {
  if (!existsSync(SKILLS_FILE)) {
    fail(`[后端] 文件不存在: ${SKILLS_FILE}`)
    return
  }
  const src = readFileSync(SKILLS_FILE, 'utf-8')

  // 验证 HOOK_EVENTS 列表声明 (必须在 skills.py 中)
  if (!/HOOK_EVENTS\s*=\s*\[/.test(src)) {
    fail(`[后端] skills.py 缺少 HOOK_EVENTS 列表声明`)
    return
  }

  // 验证所有 10 个事件都声明
  for (const event of HOOK_EVENTS) {
    const pattern = new RegExp(`["']${event}["']`)
    if (!pattern.test(src)) {
      fail(`[后端] skills.py HOOK_EVENTS 缺少 ${event} 事件声明`)
    }
  }
}

function checkHookEventsTriggered() {
  for (const [event, file] of Object.entries(HOOK_TRIGGER_LOCATIONS)) {
    if (!existsSync(file)) {
      fail(`[触发] ${event} 的预期触发文件不存在: ${file}`)
      continue
    }
    const src = readFileSync(file, 'utf-8')

    // 验证实际触发: 找 run_hooks 调用并传 event 参数
    // 匹配: run_hooks(workspace_path, "EventName", ...) 或 run_hooks(workspace_path, 'EventName', ...)
    // 或通过变量: run_hooks(workspace_path, event_str, ...)
    // 最稳妥的检测: run_hooks 调用的第二个参数为事件名 (字面量字符串)
    const triggerPattern = new RegExp(
      `run_hooks\\s*\\(\\s*[\\w.]+\\s*,\\s*["']${event}["']`,
    )
    if (!triggerPattern.test(src)) {
      fail(`[触发] ${event} 事件在 ${file.replace(ROOT + '\\\\', '').replace(ROOT + '/', '')} 中未被实际触发 (找不到 run_hooks(..., "${event}", ...))`)
    }
  }
}

function checkRunHooksExported() {
  if (!existsSync(SKILLS_FILE)) {
    return
  }
  const src = readFileSync(SKILLS_FILE, 'utf-8')

  if (!/async def\s+run_hooks\s*\(/.test(src)) {
    fail(`[后端] skills.py 缺少 async def run_hooks 函数`)
  }
}

// 主流程
const args = process.argv.slice(2)
const stagedOnly = args.includes('--staged')

if (stagedOnly) {
  console.log('[INFO] staged 模式: 仍执行全量守门 (结构性检查)')
}

checkHookEventsDeclared()
checkRunHooksExported()
checkHookEventsTriggered()

if (violations.length === 0) {
  console.log(`[OK] Hook 扩展点覆盖率守门通过: ${HOOK_EVENTS.length} 个 HOOK_EVENTS 全部已实现触发`)
  console.log('     主 Agent (agent_loop.py): SessionStart, SessionEnd, UserPromptSubmit,')
  console.log('                              PreToolUse, PostToolUse, PreCompact, PostCompact, Stop')
  console.log('     子 Agent (subagents.py): SubagentStart, SubagentStop')
  process.exit(0)
} else {
  console.error(`[FAIL] Hook 扩展点发现 ${violations.length} 处违规:`)
  for (const v of violations) {
    console.error(`  - ${v}`)
  }
  console.error('')
  console.error('修复方法:')
  console.error('  - 主 Agent 事件: 在 agent_loop.py 添加 `await run_hooks(workspace_path, "EventName", {...})`')
  console.error('  - 子 Agent 事件: 在 subagents.py 添加 `await run_hooks(workspace_path, "EventName", {...})`')
  console.error('  - skills.py HOOK_EVENTS 列表: 必须包含事件名, 否则 run_hooks 会过滤掉')
  process.exit(1)
}
