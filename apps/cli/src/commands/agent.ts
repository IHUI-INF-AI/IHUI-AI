/**
 * Agent 执行模块 — 非交互式单次执行。
 * 连接后端 WebSocket /workspace/agent/ws, 流式接收事件。
 */

import WebSocket from 'ws';
import chalk from 'chalk';
import ora from 'ora';

export interface AgentOptions {
  prompt: string;
  modelId: string;
  workspacePath: string;
  apiUrl: string;
  apiKey?: string;
  maxIterations: number;
}

interface AgentContext {
  currentTool: string;
}

export async function runAgent(opts: AgentOptions): Promise<void> {
  const wsUrl =
    opts.apiUrl.replace(/^http/, 'ws').replace(/\/$/, '') + '/api/v1/workspace/agent/ws';

  console.log(chalk.dim(`\n🤖 IHUI Agent — ${opts.workspacePath}\n`));
  console.log(chalk.dim(`任务: ${opts.prompt}\n`));

  const spinner = ora({ text: '连接中...', color: 'cyan' }).start();
  const ctx: AgentContext = { currentTool: '' };

  return new Promise<void>((resolve) => {
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      spinner.succeed('已连接');
      ws.send(
        JSON.stringify({
          prompt: opts.prompt,
          model_id: opts.modelId,
          workspace_path: opts.workspacePath,
          max_iterations: opts.maxIterations,
        }),
      );
    });

    ws.on('message', (data: Buffer) => {
      try {
        const event = JSON.parse(data.toString()) as Record<string, unknown>;
        handleEvent(event, spinner, ctx);
      } catch {
        /* ignore parse errors */
      }
    });

    ws.on('error', (err: Error) => {
      spinner.fail('连接错误');
      console.error(chalk.red(`\n❌ ${err.message}`));
      resolve();
    });

    ws.on('close', () => {
      spinner.stop();
      console.log(chalk.dim('\n--- 会话结束 ---\n'));
      resolve();
    });
  });
}

function handleEvent(
  event: Record<string, unknown>,
  spinner: ReturnType<typeof ora>,
  ctx: AgentContext,
): void {
  const type = event.type as string;
  switch (type) {
    case 'agent.context':
      spinner.stop();
      console.log(chalk.dim(`📁 工作区: ${event.workspace}`));
      console.log(chalk.dim(`🧠 模型: ${event.model}`));
      break;

    case 'agent.text.delta':
      process.stdout.write((event.content as string) || '');
      break;

    case 'agent.tool.call':
      console.log('');
      ctx.currentTool = event.name as string;
      console.log(chalk.cyan(`🔧 调用工具: ${ctx.currentTool}`));
      spinner.start(`执行 ${ctx.currentTool}...`);
      break;

    case 'agent.tool.result':
      spinner.stop();
      if (event.success) {
        console.log(chalk.green(`✅ ${ctx.currentTool} 完成`));
      } else {
        console.log(chalk.red(`❌ ${ctx.currentTool} 失败: ${event.error}`));
      }
      console.log('');
      break;

    case 'agent.error':
      spinner.fail('错误');
      console.error(chalk.red(`\n❌ ${event.message}`));
      break;

    case 'agent.done':
      console.log(chalk.green(`\n\n✨ 完成 (${event.iterations} 次迭代)`));
      break;
  }
}
