#!/usr/bin/env node

/**
 * IHUI AI Coding Agent CLI
 * 对标 Claude Code / Codex CLI
 *
 * 用法:
 *   ihui                          # 交互式 REPL (默认当前目录)
 *   ihui "修复 bug"               # 直接执行任务
 *   ihui --model gpt-4o "..."     # 指定模型
 *   ihui --continue               # 继续最近的会话
 *   ihui --resume <session-id>    # 恢复指定会话
 *   ihui chat                     # 对话模式
 *   ihui agent "重构 auth 模块"   # Agent 模式
 *   ihui init                     # 创建 AGENTS.md 模板
 *   ihui mcp list                 # 列出 MCP 服务器
 *   ihui mcp add <name> <cmd>     # 添加 MCP 服务器
 *   ihui --help                   # 帮助
 */

import 'dotenv/config'
import { Command } from 'commander'
import chalk from 'chalk'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { startREPL } from './repl.js'
import { runAgent } from './agent.js'
import {
  loadSession,
  getMostRecentSession,
  listSessions,
  type ChatMessage,
} from './session.js'
import { writeAgentsMd, agentsMdExists } from './template.js'
import {
  loadMcpConfig,
  addMcpServer,
  getMcpConfigPath,
} from './mcp-config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
) as { version: string }

const program = new Command()

program
  .name('ihui')
  .description('IHUI AI Coding Agent — 对标 Claude Code / Codex')
  .version(pkg.version)
  .option('-m, --model <model_id>', '模型 ID (默认 default)', 'default')
  .option('-w, --workspace <path>', '工作区路径 (默认当前目录)', process.cwd())
  .option('--max-iterations <n>', '最大工具循环次数', '25')
  .option(
    '--api-url <url>',
    '后端 API 地址',
    process.env.IHUI_API_URL || 'http://localhost:8000',
  )
  .option('--api-key <key>', 'API 密钥', process.env.IHUI_API_KEY || '')
  .option('--resume <session-id>', '恢复之前的会话')
  .option('--continue', '继续最近的会话')

// ---------------------------------------------------------------------------
// 辅助: 解析全局选项 + 会话恢复
// ---------------------------------------------------------------------------

interface ResolvedSession {
  sessionId?: string
  history?: ChatMessage[]
}

/** 根据 --resume / --continue 标志解析会话 */
function resolveSession(opts: Record<string, unknown>): ResolvedSession {
  const continueFlag = opts.continue as boolean | undefined
  const resumeId = opts.resume as string | undefined

  if (continueFlag) {
    const session = getMostRecentSession()
    if (session) {
      console.log(chalk.dim(`恢复最近会话: ${session.id} (${session.history.length} 条历史)`))
      return { sessionId: session.id, history: session.history }
    }
    console.log(chalk.yellow('未找到历史会话, 将创建新会话'))
    return {}
  }

  if (resumeId) {
    const session = loadSession(resumeId)
    if (session) {
      console.log(chalk.dim(`恢复会话: ${session.id} (${session.history.length} 条历史)`))
      return { sessionId: session.id, history: session.history }
    }
    console.log(chalk.red(`未找到会话: ${resumeId}`))
    process.exit(1)
  }

  return {}
}

// ---------------------------------------------------------------------------
// 默认命令: 交互式 REPL 或直接执行任务
// ---------------------------------------------------------------------------

program
  .argument('[prompt]', '直接执行的任务 (省略则进入 REPL)')
  .action(async (prompt: string | undefined) => {
    const opts = program.opts()
    const session = resolveSession(opts)

    if (prompt) {
      // 直接执行任务
      await runAgent({
        prompt,
        modelId: opts.model,
        workspacePath: opts.workspace,
        apiUrl: opts.apiUrl,
        apiKey: opts.apiKey,
        maxIterations: parseInt(opts.maxIterations, 10),
      })
    } else {
      // 交互式 REPL
      await startREPL({
        modelId: opts.model,
        workspacePath: opts.workspace,
        apiUrl: opts.apiUrl,
        apiKey: opts.apiKey,
        maxIterations: parseInt(opts.maxIterations, 10),
        sessionId: session.sessionId,
        history: session.history,
      })
    }
  })

// ---------------------------------------------------------------------------
// chat 子命令: 对话模式
// ---------------------------------------------------------------------------

program
  .command('chat')
  .description('进入对话模式 (多轮)')
  .action(async () => {
    const opts = program.opts()
    const session = resolveSession(opts)
    await startREPL({
      modelId: opts.model,
      workspacePath: opts.workspace,
      apiUrl: opts.apiUrl,
      apiKey: opts.apiKey,
      maxIterations: parseInt(opts.maxIterations, 10),
      sessionId: session.sessionId,
      history: session.history,
    })
  })

// ---------------------------------------------------------------------------
// agent 子命令: Agent 模式 (自主多步)
// ---------------------------------------------------------------------------

program
  .command('agent <task>')
  .description('Agent 模式: 自主多步执行任务')
  .action(async (task: string) => {
    const opts = program.opts()
    await runAgent({
      prompt: task,
      modelId: opts.model,
      workspacePath: opts.workspace,
      apiUrl: opts.apiUrl,
      apiKey: opts.apiKey,
      maxIterations: parseInt(opts.maxIterations, 10),
    })
  })

// ---------------------------------------------------------------------------
// init 子命令: 创建 AGENTS.md
// ---------------------------------------------------------------------------

program
  .command('init')
  .description('在当前目录创建 AGENTS.md 模板')
  .option('-f, --force', '覆盖已存在的文件')
  .action(async (options: { force?: boolean }) => {
    const workspace = process.cwd()
    if (agentsMdExists(workspace) && !options.force) {
      console.log(chalk.yellow('AGENTS.md 已存在。使用 --force 覆盖。'))
      process.exit(1)
    }
    writeAgentsMd(workspace)
    console.log(chalk.green(`已创建: ${join(workspace, 'AGENTS.md')}`))
  })

// ---------------------------------------------------------------------------
// sessions 子命令: 列出历史会话
// ---------------------------------------------------------------------------

program
  .command('sessions')
  .description('列出历史会话')
  .action(async () => {
    const sessions = listSessions()
    if (sessions.length === 0) {
      console.log(chalk.dim('暂无历史会话'))
      return
    }
    console.log(chalk.cyan('\n历史会话:'))
    for (const s of sessions) {
      const time = new Date(s.updatedAt).toLocaleString()
      console.log(`  ${chalk.bold(s.id)}  ${chalk.dim(time)}`)
      console.log(`    工作区: ${s.workspacePath}  模型: ${s.modelId}  历史: ${s.history.length} 条`)
    }
    console.log('')
  })

// ---------------------------------------------------------------------------
// mcp 子命令组: MCP 服务器管理
// ---------------------------------------------------------------------------

const mcpCmd = program.command('mcp').description('MCP 服务器管理')

mcpCmd
  .command('list')
  .description('列出已配置的 MCP 服务器')
  .action(async () => {
    const opts = program.opts()
    const apiUrl = opts.apiUrl as string
    const workspace = opts.workspace as string

    // 1. 显示本地配置
    const config = loadMcpConfig()
    if (config.servers.length > 0) {
      console.log(chalk.cyan('\n本地 MCP 服务器配置:'))
      console.log(chalk.dim(`  配置文件: ${getMcpConfigPath()}`))
      for (const s of config.servers) {
        const argStr = s.args && s.args.length > 0 ? ' ' + s.args.join(' ') : ''
        console.log(`  ${chalk.bold(s.name)}: ${s.command}${argStr}`)
      }
    } else {
      console.log(chalk.dim('\n本地无 MCP 服务器配置'))
      console.log(chalk.dim(`  配置文件: ${getMcpConfigPath()}`))
    }

    // 2. 从后端 API 获取
    const url = `${apiUrl}/api/v1/workspace/mcp/servers?workspace_path=${encodeURIComponent(workspace)}`
    try {
      const resp = await fetch(url)
      if (resp.ok) {
        const data = await resp.json()
        console.log(chalk.cyan('\n后端 MCP 服务器:'))
        console.log(JSON.stringify(data, null, 2))
      } else {
        console.log(chalk.dim(`\n后端 API 返回 ${resp.status}`))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(chalk.dim(`\n无法连接后端: ${msg}`))
    }
  })

mcpCmd
  .command('add <name> <command>')
  .description('添加 MCP 服务器配置')
  .option('-a, --args <args...>', '命令参数')
  .action(async (name: string, command: string, options: { args?: string[] }) => {
    const server = addMcpServer(name, command, options.args)
    console.log(chalk.green(`已添加 MCP 服务器: ${server.name}`))
    console.log(`  命令: ${server.command}`)
    if (server.args && server.args.length > 0) {
      console.log(`  参数: ${server.args.join(' ')}`)
    }
    console.log(chalk.dim(`  配置文件: ${getMcpConfigPath()}`))
  })

mcpCmd
  .command('remove <name>')
  .description('移除 MCP 服务器配置')
  .action(async (name: string) => {
    const { removeMcpServer } = await import('./mcp-config.js')
    if (removeMcpServer(name)) {
      console.log(chalk.green(`已移除 MCP 服务器: ${name}`))
    } else {
      console.log(chalk.red(`未找到 MCP 服务器: ${name}`))
      process.exit(1)
    }
  })

program.parse()
