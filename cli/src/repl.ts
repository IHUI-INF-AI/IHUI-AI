/**
 * REPL (Read-Eval-Print Loop) — 交互式对话模式。
 * 对标 claude / codex 的交互式 REPL。
 *
 * 特性:
 * - 多轮对话 (历史上下文, history 数组)
 * - 流式输出
 * - 工具调用可视化
 * - 会话持久化 (保存到 ~/.ihui/sessions/)
 * - /命令 (/help /clear /exit /model /workspace /tools /skills /hooks /memory /init /mcp /agents /diff /undo /checkpoints /rollback)
 * - 交互式模型选择 (inquirer)
 * - 语法高亮输出 (cli-highlight)
 */

import * as readline from 'readline'
import * as fs from 'fs'
import * as path from 'path'
import WebSocket from 'ws'
import chalk from 'chalk'
import ora from 'ora'
import { highlight } from 'cli-highlight'
import inquirer from 'inquirer'
import {
  createSession,
  saveSession,
  type Session,
  type ChatMessage,
} from './session.js'
import { writeAgentsMd, agentsMdExists } from './template.js'
import { loadMcpConfig } from './mcp-config.js'

export interface REPLOptions {
  modelId: string
  workspacePath: string
  apiUrl: string
  apiKey?: string
  maxIterations: number
  sessionId?: string
  history?: ChatMessage[]
}

interface FileChange {
  file: string
  action: string
  content?: string
}

interface REPLState {
  history: ChatMessage[]
  fileChanges: FileChange[]
  lastDiff: FileChange | null
  session: Session | null
  opts: REPLOptions
}

/** 从 API URL 派生 WebSocket URL */
export function deriveWsUrl(apiUrl: string): string {
  return (
    apiUrl
      .replace(/^http/, 'ws')
      .replace(/\/$/, '') + '/api/v1/workspace/agent/ws'
  )
}

export async function startREPL(opts: REPLOptions): Promise<void> {
  console.log(chalk.bold.cyan('\n╔══════════════════════════════════════════╗'))
  console.log(chalk.bold.cyan('║   IHUI AI Coding Agent — 交互模式         ║'))
  console.log(chalk.bold.cyan('╚══════════════════════════════════════════╝'))
  console.log(chalk.dim(`工作区: ${opts.workspacePath}`))
  console.log(chalk.dim(`模型: ${opts.modelId}`))
  console.log(chalk.dim(`后端: ${opts.apiUrl}`))

  // 初始化会话
  let session: Session | null = null
  let history: ChatMessage[] = []

  if (opts.sessionId && opts.history && opts.history.length > 0) {
    // 恢复已有会话
    session = {
      id: opts.sessionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      workspacePath: opts.workspacePath,
      modelId: opts.modelId,
      history: opts.history,
    }
    history = [...opts.history]
    console.log(chalk.dim(`会话: ${opts.sessionId} (已恢复 ${history.length} 条历史)`))
  } else {
    // 创建新会话
    session = createSession(opts.workspacePath, opts.modelId)
    saveSession(session)
    console.log(chalk.dim(`会话: ${session.id}`))
  }

  console.log(chalk.dim('输入 /help 查看命令, /exit 退出\n'))

  const state: REPLState = {
    history,
    fileChanges: [],
    lastDiff: null,
    session,
    opts,
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.bold.green('ihui> '),
    historySize: 100,
  })

  rl.prompt()

  rl.on('line', async (input: string) => {
    const trimmed = input.trim()
    if (!trimmed) {
      rl.prompt()
      return
    }

    // 命令处理
    if (trimmed.startsWith('/')) {
      await handleCommand(trimmed, state, rl)
      rl.prompt()
      return
    }

    // 发送到 Agent
    await sendToAgent(trimmed, state)
    rl.prompt()
  })

  rl.on('close', () => {
    // 保存会话后退出
    if (state.session) {
      state.session.history = state.history
      saveSession(state.session)
    }
    console.log(chalk.dim('\n再见! 👋\n'))
    process.exit(0)
  })
}

async function handleCommand(
  cmd: string,
  state: REPLState,
  rl: readline.Interface,
): Promise<void> {
  const [command, ...args] = cmd.slice(1).split(' ')
  const opts = state.opts

  switch (command.toLowerCase()) {
    case 'help':
      console.log(chalk.cyan('\n可用命令:'))
      console.log('  /help              显示帮助')
      console.log('  /exit              退出')
      console.log('  /clear             清除对话历史')
      console.log('  /model [id]        切换模型 (无参数时交互式选择)')
      console.log('  /workspace         显示当前工作区')
      console.log('  /tools             列出可用工具')
      console.log('  /skills            列出 Skills (API)')
      console.log('  /hooks             列出 Hooks (API)')
      console.log('  /memory [show|save|clear]  记忆管理 (API)')
      console.log('  /init              创建 AGENTS.md 模板')
      console.log('  /mcp               列出已配置的 MCP 服务器 (API)')
      console.log('  /agents            列出后台 Agent (API)')
      console.log('  /cost              显示会话 Token 用量与成本 (API)')
      console.log('  /usage             显示工作区全局用量统计 (API)')
      console.log('  /pr [create|<编号>]  GitHub PR 管理 (API)')
      console.log('  /routine [add|remove|enable|disable|trigger]  定时任务 (API)')
      console.log('  /swarm <task>      Swarm 多智能体编排 (API)')
      console.log('  /plan              进入 Plan 模式 (API)')
      console.log('  /goal <task>       进入 Goal 模式 (API)')
      console.log('  /diff              显示最近的文件修改')
      console.log('  /undo              撤销最近一次文件修改 (API)')
      console.log('  /checkpoints       列出检查点历史 (API)')
      console.log('  /rollback <id>     回滚到指定检查点 (API)')
      console.log('')
      break

    case 'exit':
    case 'quit':
      rl.close()
      break

    case 'clear':
      state.history = []
      state.fileChanges = []
      state.lastDiff = null
      if (state.session) {
        state.session.history = []
        saveSession(state.session)
      }
      console.log(chalk.green('对话历史已清除'))
      break

    case 'model':
      if (args[0]) {
        opts.modelId = args[0]
        if (state.session) {
          state.session.modelId = args[0]
          saveSession(state.session)
        }
        console.log(chalk.green(`模型已切换为: ${args[0]}`))
      } else {
        await interactiveModelSelect(state)
      }
      break

    case 'workspace':
      console.log(`工作区: ${opts.workspacePath}`)
      break

    case 'tools':
      console.log(chalk.cyan('\n可用工具:'))
      console.log('  read_file        读取文件 (带行号)')
      console.log('  write_file       写入文件 (支持 dry_run 预览)')
      console.log('  edit_file        编辑文件 (模糊匹配 + dry_run)')
      console.log('  multi_edit       批量编辑 (原子性 + dry_run)')
      console.log('  delete_file      删除文件 (可撤销)')
      console.log('  list_dir         列目录')
      console.log('  glob             文件匹配')
      console.log('  grep             内容搜索')
      console.log('  run_command      执行命令')
      console.log('  web_fetch        抓取 URL')
      console.log('  web_search       搜索互联网')
      console.log('  todo_write       写入任务清单')
      console.log('  todo_read        读取任务清单')
      console.log('  git_status       查看 git 状态')
      console.log('  git_diff         查看 git diff')
      console.log('  git_log          查看 git 日志')
      console.log('  undo             撤销最近修改')
      console.log('  list_checkpoints 列出检查点')
      console.log('  rollback         回滚到检查点')
      console.log('')
      console.log(chalk.dim('  环境变量:'))
      console.log(chalk.dim('  IHUI_GIT_AUTOCOMMIT=1  启用 Aider 风格自动 git commit (每次修改/撤销自动提交)'))
      console.log('')
      break

    case 'skills':
      await fetchApiResource(state, 'skills')
      break

    case 'hooks':
      await fetchApiResource(state, 'hooks')
      break

    case 'memory':
      await fetchApiResource(state, 'memory')
      break

    case 'init':
      await handleInit(state)
      break

    case 'mcp':
      await handleMcpList(state)
      break

    case 'agents':
      handleAgentsList(state)
      break

    case 'diff':
      handleDiff(state)
      break

    case 'undo':
      await handleUndo(state)
      break

    case 'checkpoints':
      await handleCheckpoints(state)
      break

    case 'rollback':
      if (!args[0]) {
        console.log(chalk.yellow('用法: /rollback <checkpoint_id>'))
        console.log(chalk.dim('使用 /checkpoints 查看可用检查点 ID'))
        break
      }
      await handleRollback(state, args[0])
      break

    default:
      // 未知命令转发到后端 (后端会处理 /cost /usage /memory /pr /agents /routine /swarm 等新命令)
      await sendToAgent(cmd, state)
      return
  }
}

// ---------------------------------------------------------------------------
// 命令实现
// ---------------------------------------------------------------------------

/** 交互式模型选择 (使用 inquirer) */
async function interactiveModelSelect(state: REPLState): Promise<void> {
  const opts = state.opts
  const models = await fetchModels(opts.apiUrl)
  if (models.length === 0) {
    console.log(chalk.dim(`当前模型: ${opts.modelId} (无法从 API 获取模型列表)`))
    return
  }
  try {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'model',
        message: '选择模型:',
        choices: models,
        default: opts.modelId,
      },
    ])
    opts.modelId = answers.model
    if (state.session) {
      state.session.modelId = answers.model
      saveSession(state.session)
    }
    console.log(chalk.green(`模型已切换为: ${answers.model}`))
  } catch {
    console.log(chalk.dim('交互式选择不可用, 请使用 /model <id> 指定模型'))
  }
}

/** 从后端 API 获取可用模型列表 */
async function fetchModels(apiUrl: string): Promise<string[]> {
  try {
    const resp = await fetch(
      `${apiUrl}/api/v1/models`,
    )
    if (!resp.ok) return []
    const data = (await resp.json()) as unknown
    if (Array.isArray(data)) {
      return data.map((m: unknown) => {
        if (typeof m === 'string') return m
        const obj = m as Record<string, unknown>
        return String(obj.id || obj.name || m)
      })
    }
    const obj = data as Record<string, unknown>
    const models = obj.models
    if (Array.isArray(models)) {
      return models.map((m: unknown) => {
        if (typeof m === 'string') return m
        const mo = m as Record<string, unknown>
        return String(mo.id || mo.name || m)
      })
    }
    return []
  } catch {
    return []
  }
}

/** 调用 REST API 获取资源 (skills / hooks / memory) 并高亮显示 */
async function fetchApiResource(
  state: REPLState,
  resource: string,
): Promise<void> {
  const opts = state.opts
  const url = `${opts.apiUrl}/api/v1/workspace/${resource}?workspace_path=${encodeURIComponent(opts.workspacePath)}`
  const spinner = ora(`获取 ${resource}...`).start()
  try {
    const resp = await fetch(url)
    if (!resp.ok) {
      spinner.fail(`API 返回 ${resp.status}`)
      console.log(chalk.red(`获取 ${resource} 失败: HTTP ${resp.status}`))
      return
    }
    const data = (await resp.json()) as unknown
    spinner.succeed(`${resource} 获取成功`)
    const jsonStr = JSON.stringify(data, null, 2)
    try {
      console.log(highlight(jsonStr, { language: 'json' }))
    } catch {
      console.log(jsonStr)
    }
  } catch (err) {
    spinner.fail('请求失败')
    const msg = err instanceof Error ? err.message : String(err)
    console.log(chalk.red(`获取 ${resource} 失败: ${msg}`))
  }
}

/** /init — 创建 AGENTS.md 模板 */
async function handleInit(state: REPLState): Promise<void> {
  const wsPath = state.opts.workspacePath
  if (agentsMdExists(wsPath)) {
    console.log(chalk.yellow('AGENTS.md 已存在'))
    try {
      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: '是否覆盖?',
          default: false,
        },
      ])
      if (!answers.overwrite) {
        console.log(chalk.dim('已取消'))
        return
      }
    } catch {
      // 非交互环境, 直接跳过
      console.log(chalk.dim('已取消 (非交互环境)'))
      return
    }
  }
  writeAgentsMd(wsPath)
  console.log(chalk.green(`已创建: ${path.join(wsPath, 'AGENTS.md')}`))
}

/** /mcp — 列出 MCP 服务器 (本地配置 + 后端 API) */
async function handleMcpList(state: REPLState): Promise<void> {
  const opts = state.opts

  // 1. 显示本地配置
  const config = loadMcpConfig()
  if (config.servers.length > 0) {
    console.log(chalk.cyan('\n本地 MCP 服务器配置 (~/.ihui/mcp.json):'))
    for (const s of config.servers) {
      const argStr = s.args && s.args.length > 0 ? ' ' + s.args.join(' ') : ''
      console.log(`  ${chalk.bold(s.name)}: ${s.command}${argStr}`)
    }
  } else {
    console.log(chalk.dim('\n本地无 MCP 服务器配置'))
  }

  // 2. 从后端 API 获取
  const url = `${opts.apiUrl}/api/v1/workspace/mcp/servers?workspace_path=${encodeURIComponent(opts.workspacePath)}`
  const spinner = ora('从后端获取 MCP 服务器...').start()
  try {
    const resp = await fetch(url)
    if (!resp.ok) {
      spinner.fail(`API 返回 ${resp.status}`)
      return
    }
    const data = (await resp.json()) as unknown
    spinner.succeed('后端 MCP 服务器获取成功')
    const jsonStr = JSON.stringify(data, null, 2)
    try {
      console.log(highlight(jsonStr, { language: 'json' }))
    } catch {
      console.log(jsonStr)
    }
  } catch (err) {
    spinner.fail('请求失败')
    const msg = err instanceof Error ? err.message : String(err)
    console.log(chalk.red(`从后端获取 MCP 服务器失败: ${msg}`))
  }
}

/** /agents — 列出 .claude/agents/ 目录下的 agent 配置 */
function handleAgentsList(state: REPLState): void {
  const agentsDir = path.join(state.opts.workspacePath, '.claude', 'agents')
  if (!fs.existsSync(agentsDir)) {
    console.log(chalk.dim('未找到 .claude/agents/ 目录'))
    return
  }
  const files = fs
    .readdirSync(agentsDir)
    .filter((f) => f.endsWith('.md'))
  if (files.length === 0) {
    console.log(chalk.dim('未找到 agent 配置文件 (.claude/agents/*.md)'))
    return
  }
  console.log(chalk.cyan('\nAgent 配置:'))
  for (const f of files) {
    const filePath = path.join(agentsDir, f)
    const content = fs.readFileSync(filePath, 'utf-8')
    const heading =
      content
        .split('\n')
        .find((l) => l.trim().startsWith('#')) || f
    const title = heading.replace(/^#+\s*/, '')
    console.log(`  ${chalk.bold(f)} — ${title}`)
  }
  console.log('')
}

/** /diff — 显示最近的文件修改 */
function handleDiff(state: REPLState): void {
  if (!state.lastDiff) {
    console.log(chalk.dim('尚无文件修改记录'))
    return
  }
  const diff = state.lastDiff
  console.log(chalk.cyan(`\n最近修改的文件: ${diff.file}`))
  console.log(chalk.dim(`操作: ${diff.action}`))
  if (diff.content) {
    console.log(chalk.dim('\n内容:'))
    const ext = path.extname(diff.file).slice(1) || 'javascript'
    try {
      console.log(highlight(diff.content, { language: ext }))
    } catch {
      console.log(diff.content)
    }
  }
  console.log('')

  // 如果有更多修改历史, 显示摘要
  if (state.fileChanges.length > 1) {
    console.log(chalk.dim(`共 ${state.fileChanges.length} 次文件修改:`))
    for (const c of state.fileChanges.slice(-10)) {
      const marker = c === state.lastDiff ? chalk.green('►') : ' '
      console.log(`  ${marker} ${c.action}: ${c.file}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Checkpoint 命令 (对标 Aider git revert / Gemini checkpointing)
// ---------------------------------------------------------------------------

/** /undo — 撤销最近一次文件修改 (调用后端 checkpoint API) */
async function handleUndo(state: REPLState): Promise<void> {
  const opts = state.opts
  const url = `${opts.apiUrl}/api/v1/workspace/checkpoints/undo?workspace_path=${encodeURIComponent(opts.workspacePath)}`
  const spinner = ora('撤销中...').start()
  try {
    const resp = await fetch(url, { method: 'POST' })
    const data = (await resp.json()) as Record<string, unknown>
    if (resp.ok && data.code === 0) {
      spinner.succeed('撤销成功')
      const msg = (data.message as string) || '已撤销'
      console.log(chalk.green(`\n  ✓ ${msg}`))
    } else {
      spinner.fail('撤销失败')
      console.log(chalk.yellow(`\n  ${(data.message as string) || '没有可撤销的检查点'}`))
    }
  } catch (err) {
    spinner.fail('请求失败')
    const msg = err instanceof Error ? err.message : String(err)
    console.log(chalk.red(`撤销失败: ${msg}`))
  }
}

/** /checkpoints — 列出检查点历史 */
async function handleCheckpoints(state: REPLState): Promise<void> {
  const opts = state.opts
  const url = `${opts.apiUrl}/api/v1/workspace/checkpoints?workspace_path=${encodeURIComponent(opts.workspacePath)}&limit=20`
  const spinner = ora('获取检查点...').start()
  try {
    const resp = await fetch(url)
    if (!resp.ok) {
      spinner.fail(`API 返回 ${resp.status}`)
      return
    }
    const data = (await resp.json()) as Record<string, unknown>
    spinner.succeed('检查点获取成功')
    const checkpoints = data.data as Array<Record<string, unknown>>
    if (!checkpoints || checkpoints.length === 0) {
      console.log(chalk.dim('\n无检查点历史'))
      return
    }
    console.log(chalk.cyan(`\n检查点历史 (最近 ${checkpoints.length} 个):`))
    for (const cp of checkpoints) {
      const status = cp.applied ? chalk.green('✓已应用') : chalk.red('✗已撤销')
      const files = (cp.files as string[]) || []
      const fileList = files.length > 0 ? files.join(', ') : '(无文件)'
      console.log(`  [${cp.id}] ${cp.tool} — ${cp.description} [${status}]`)
      console.log(chalk.dim(`    文件: ${fileList}`))
    }
    console.log(chalk.dim('\n使用 /rollback <id> 回滚到指定检查点'))
    console.log('')
  } catch (err) {
    spinner.fail('请求失败')
    const msg = err instanceof Error ? err.message : String(err)
    console.log(chalk.red(`获取检查点失败: ${msg}`))
  }
}

/** /rollback <id> — 回滚到指定检查点 */
async function handleRollback(state: REPLState, checkpointId: string): Promise<void> {
  const opts = state.opts
  const url = `${opts.apiUrl}/api/v1/workspace/checkpoints/rollback?workspace_path=${encodeURIComponent(opts.workspacePath)}&checkpoint_id=${encodeURIComponent(checkpointId)}`
  const spinner = ora(`回滚到 ${checkpointId}...`).start()
  try {
    const resp = await fetch(url, { method: 'POST' })
    const data = (await resp.json()) as Record<string, unknown>
    if (resp.ok && data.code === 0) {
      spinner.succeed('回滚成功')
      const msg = (data.message as string) || '已回滚'
      console.log(chalk.green(`\n  ✓ ${msg}`))
    } else {
      spinner.fail('回滚失败')
      console.log(chalk.red(`\n  ${(data.message as string) || '检查点不存在'}`))
    }
  } catch (err) {
    spinner.fail('请求失败')
    const msg = err instanceof Error ? err.message : String(err)
    console.log(chalk.red(`回滚失败: ${msg}`))
  }
}

// ---------------------------------------------------------------------------
// Agent 通信
// ---------------------------------------------------------------------------

async function sendToAgent(prompt: string, state: REPLState): Promise<void> {
  const opts = state.opts
  const wsUrl = deriveWsUrl(opts.apiUrl)

  return new Promise<void>((resolve) => {
    const ws = new WebSocket(wsUrl)
    const spinner = ora()
    let assistantText = ''

    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          prompt,
          history: state.history,
          model_id: opts.modelId,
          workspace_path: opts.workspacePath,
          max_iterations: opts.maxIterations,
        }),
      )
    })

    ws.on('message', (data: Buffer) => {
      try {
        const event = JSON.parse(data.toString())

        // 收集助手回复文本
        if (event.type === 'agent.text.delta') {
          assistantText += event.content || ''
        }

        // 跟踪文件修改 (用于 /diff)
        if (
          event.type === 'agent.tool.call' &&
          event.input
        ) {
          const toolName = event.name as string
          if (
            ['write_file', 'edit_file', 'delete_file'].includes(toolName)
          ) {
            const input = event.input as Record<string, unknown>
            const fileChange: FileChange = {
              file: String(input.path || input.file || 'unknown'),
              action: toolName,
              content:
                typeof input.content === 'string'
                  ? input.content
                  : typeof input.new_str === 'string'
                    ? input.new_str
                    : undefined,
            }
            state.fileChanges.push(fileChange)
            state.lastDiff = fileChange
          }
        }

        handleEvent(event, spinner)
      } catch {
        // ignore parse errors
      }
    })

    ws.on('error', (err: Error) => {
      spinner.fail('连接错误')
      console.error(chalk.red(`❌ ${err.message}`))
      resolve()
    })

    ws.on('close', () => {
      spinner.stop()

      // 将本轮对话追加到历史
      state.history.push({ role: 'user', content: prompt })
      if (assistantText) {
        state.history.push({ role: 'assistant', content: assistantText })
      }

      // 持久化会话
      if (state.session) {
        state.session.history = state.history
        saveSession(state.session)
      }

      resolve()
    })
  })
}

function handleEvent(event: Record<string, unknown>, spinner: any): void {
  const type = event.type as string
  switch (type) {
    case 'agent.context':
      // 不重复显示 (REPL 启动时已显示)
      break

    case 'agent.text.delta':
      process.stdout.write((event.content as string) || '')
      break

    case 'agent.tool.call':
      console.log('')
      console.log(chalk.cyan(`  🔧 ${event.name}`))
      spinner.start(`  执行 ${event.name}...`)
      break

    case 'agent.tool.result':
      spinner.stop()
      if (!event.success) {
        console.log(chalk.red(`  ❌ ${event.error}`))
      }
      break

    case 'agent.usage': {
      // Token 用量追踪 (对标 Codex/Gemini)
      const usage = event.usage as Record<string, number> | undefined
      const total = event.total as Record<string, number> | undefined
      if (usage) {
        const prompt = usage.prompt_tokens || 0
        const completion = usage.completion_tokens || 0
        const totalTokens = total?.total_tokens || 0
        spinner.stop()
        console.log(chalk.dim(`  📊 tokens: +${prompt}↑ +${completion}↓ (累计 ${totalTokens})`))
      }
      break
    }

    case 'agent.error':
      spinner.fail('错误')
      console.error(chalk.red(`\n❌ ${event.message}`))
      break

    case 'agent.command.result':
      // Slash 纯命令结果 (/cost /usage /memory /pr /agents /routine /swarm /help /clear /init)
      spinner.stop()
      if (event.message) {
        console.log(chalk.cyan(`\n${event.message}`))
      }
      break

    case 'agent.command.handled':
      // 状态修改命令已应用 (/plan /goal /compact /plan-accept), 继续进入 agent loop
      spinner.stop()
      if (event.message) {
        console.log(chalk.dim(`\n> ${event.message}`))
      }
      break

    case 'agent.done':
      console.log(
        chalk.green(`\n\n✨ 完成 (${event.iterations} 次迭代)\n`),
      )
      break
  }
}
