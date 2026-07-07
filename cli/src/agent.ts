/**
 * Agent 执行模块 — 非交互式单次执行。
 * 对标 claude "修复 bug" / codex "task" 的直接执行模式。
 *
 * 连接后端 WebSocket /workspace/agent/ws, 流式接收事件。
 */

import WebSocket from 'ws'
import chalk from 'chalk'
import ora from 'ora'

export interface AgentOptions {
  prompt: string
  modelId: string
  workspacePath: string
  apiUrl: string
  apiKey?: string
  maxIterations: number
}

/** 可变上下文, 用于在事件处理函数之间共享状态 */
interface AgentContext {
  currentTool: string
}

export async function runAgent(opts: AgentOptions): Promise<void> {
  const wsUrl =
    opts.apiUrl
      .replace(/^http/, 'ws')
      .replace(/\/$/, '') + '/api/v1/workspace/agent/ws'

  console.log(chalk.dim(`\n🤖 IHUI Agent — ${opts.workspacePath}\n`))
  console.log(chalk.dim(`任务: ${opts.prompt}\n`))

  const spinner = ora({ text: '连接中...', color: 'cyan' }).start()
  const ctx: AgentContext = { currentTool: '' }

  return new Promise<void>((resolve) => {
    const ws = new WebSocket(wsUrl)

    ws.on('open', () => {
      spinner.succeed('已连接')
      ws.send(
        JSON.stringify({
          prompt: opts.prompt,
          model_id: opts.modelId,
          workspace_path: opts.workspacePath,
          max_iterations: opts.maxIterations,
        }),
      )
    })

    ws.on('message', (data: Buffer) => {
      try {
        const event = JSON.parse(data.toString())
        handleEvent(event, spinner, ctx)
      } catch {
        // ignore parse errors
      }
    })

    ws.on('error', (err: Error) => {
      spinner.fail('连接错误')
      console.error(chalk.red(`\n❌ ${err.message}`))
      resolve()
    })

    ws.on('close', () => {
      spinner.stop()
      console.log(chalk.dim('\n--- 会话结束 ---\n'))
      resolve()
    })
  })
}

function handleEvent(
  event: Record<string, unknown>,
  spinner: ReturnType<typeof ora>,
  ctx: AgentContext,
): void {
  const type = event.type as string
  switch (type) {
    case 'agent.context':
      spinner.stop()
      console.log(chalk.dim(`📁 工作区: ${event.workspace}`))
      console.log(chalk.dim(`🧠 模型: ${event.model}`))
      {
        const tools = event.tools
        if (Array.isArray(tools)) {
          console.log(chalk.dim(`🔧 工具: ${tools.join(', ')}\n`))
        }
      }
      break

    case 'agent.text.delta':
      process.stdout.write((event.content as string) || '')
      break

    case 'agent.tool.call':
      console.log('') // 换行
      ctx.currentTool = event.name as string
      console.log(chalk.cyan(`🔧 调用工具: ${ctx.currentTool}`))
      console.log(chalk.dim(`   参数: ${JSON.stringify(event.input)}`))
      spinner.start(`执行 ${ctx.currentTool}...`)
      break

    case 'agent.tool.result':
      spinner.stop()
      if (event.success) {
        console.log(chalk.green(`✅ ${ctx.currentTool} 完成`))
      } else {
        console.log(chalk.red(`❌ ${ctx.currentTool} 失败: ${event.error}`))
      }
      // 显示输出前 500 字符
      {
        const output = (event.output as string) || ''
        if (output) {
          const preview =
            output.length > 500 ? output.slice(0, 500) + '...' : output
          console.log(chalk.dim(preview))
        }
      }
      console.log('')
      break

    case 'agent.error':
      spinner.fail('错误')
      console.error(chalk.red(`\n❌ ${event.message}`))
      break

    case 'agent.done':
      console.log(
        chalk.green(`\n\n✨ 完成 (${event.iterations} 次迭代)`),
      )
      break
  }
}
