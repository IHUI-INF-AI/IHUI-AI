/**
 * 交互式 REPL — 多轮对话模式。
 * 支持 slash 命令 (/help /exit /clear /model /tools /init /mcp /diff /undo 等)。
 */

import * as path from 'node:path';
import * as readline from 'node:readline';
import WebSocket from 'ws';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { createSession, saveSession, type Session, type ChatMessage } from './session.js';
import { loadMcpConfig } from './mcp-config.js';
import { agentsMdExists, writeAgentsMd } from './template.js';

export interface ReplOptions {
  modelId: string;
  workspacePath: string;
  apiUrl: string;
  apiKey?: string;
  maxIterations: number;
  sessionId?: string;
  history?: ChatMessage[];
}

interface FileChange {
  file: string;
  action: string;
  content?: string;
}

interface ReplState {
  opts: ReplOptions;
  history: ChatMessage[];
  session: Session | null;
  fileChanges: FileChange[];
  lastDiff: FileChange | null;
}

export async function startREPL(opts: ReplOptions): Promise<void> {
  const state: ReplState = {
    opts,
    history: opts.history ?? [],
    session: opts.sessionId ? null : createSession(opts.workspacePath, opts.modelId),
    fileChanges: [],
    lastDiff: null,
  };

  console.log(chalk.cyan(`\n🤖 IHUI AI (模型: ${opts.modelId}, 工作区: ${opts.workspacePath})\n`));
  console.log(chalk.dim('输入消息开始对话, /help 查看命令, /exit 退出\n'));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green('> '),
  });

  rl.prompt();

  rl.on('line', async (line: string) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }
    if (input.startsWith('/')) {
      await handleSlashCommand(input, state, rl);
      rl.prompt();
      return;
    }
    await sendToAgent(input, state);
    rl.prompt();
  });

  rl.on('close', () => {
    console.log(chalk.dim('\n再见 👋\n'));
    process.exit(0);
  });
}

async function handleSlashCommand(input: string, state: ReplState, rl: readline.Interface): Promise<void> {
  const [cmd, ...args] = input.slice(1).split(/\s+/);
  switch (cmd) {
    case 'help':
      console.log(chalk.cyan('\n可用命令:'));
      console.log('  /help              显示帮助');
      console.log('  /exit              退出');
      console.log('  /clear             清除对话历史');
      console.log('  /model [id]        切换模型');
      console.log('  /workspace         显示当前工作区');
      console.log('  /tools             列出可用工具');
      console.log('  /init              创建 AGENTS.md 模板');
      console.log('  /mcp               列出已配置的 MCP 服务器');
      console.log('  /diff              显示最近的文件修改');
      console.log('');
      break;

    case 'exit':
    case 'quit':
      rl.close();
      break;

    case 'clear':
      state.history = [];
      state.fileChanges = [];
      state.lastDiff = null;
      if (state.session) {
        state.session.history = [];
        saveSession(state.session);
      }
      console.log(chalk.green('对话历史已清除'));
      break;

    case 'model':
      if (args[0]) {
        state.opts.modelId = args[0];
        if (state.session) {
          state.session.modelId = args[0]!;
          saveSession(state.session);
        }
        console.log(chalk.green(`模型已切换为: ${args[0]}`));
      } else {
        await interactiveModelSelect(state);
      }
      break;

    case 'workspace':
      console.log(`工作区: ${state.opts.workspacePath}`);
      break;

    case 'tools':
      console.log(chalk.cyan('\n可用工具:'));
      console.log('  read_file  write_file  edit_file  delete_file  list_dir');
      console.log('  glob  grep  run_command  web_fetch  web_search  todo_write');
      console.log('');
      break;

    case 'init':
      await handleInit(state);
      break;

    case 'mcp':
      handleMcpList();
      break;

    case 'diff':
      handleDiff(state);
      break;

    default:
      console.log(chalk.yellow(`未知命令: /${cmd}, /help 查看可用命令`));
  }
}

async function interactiveModelSelect(state: ReplState): Promise<void> {
  try {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'model',
        message: '输入模型 ID:',
        default: state.opts.modelId,
      },
    ]);
    state.opts.modelId = answers.model;
    if (state.session) {
      state.session.modelId = answers.model;
      saveSession(state.session);
    }
    console.log(chalk.green(`模型已切换为: ${answers.model}`));
  } catch {
    console.log(chalk.dim('请使用 /model <id> 指定模型'));
  }
}

async function handleInit(state: ReplState): Promise<void> {
  const wsPath = state.opts.workspacePath;
  if (agentsMdExists(wsPath)) {
    console.log(chalk.yellow('AGENTS.md 已存在'));
    return;
  }
  writeAgentsMd(wsPath);
  console.log(chalk.green(`已创建: ${path.join(wsPath, 'AGENTS.md')}`));
}

function handleMcpList(): void {
  const config = loadMcpConfig();
  if (config.servers.length > 0) {
    console.log(chalk.cyan('\n本地 MCP 服务器配置 (~/.ihui/mcp.json):'));
    for (const s of config.servers) {
      const argStr = s.args && s.args.length > 0 ? ' ' + s.args.join(' ') : '';
      console.log(`  ${chalk.bold(s.name)}: ${s.command ?? ''}${argStr}`);
    }
  } else {
    console.log(chalk.dim('\n本地无 MCP 服务器配置'));
  }
}

function handleDiff(state: ReplState): void {
  if (!state.lastDiff) {
    console.log(chalk.dim('尚无文件修改记录'));
    return;
  }
  const diff = state.lastDiff;
  console.log(chalk.cyan(`\n最近修改的文件: ${diff.file}`));
  console.log(chalk.dim(`操作: ${diff.action}`));
  if (diff.content) {
    console.log(chalk.dim('\n内容:'));
    console.log(diff.content);
  }
}

async function sendToAgent(prompt: string, state: ReplState): Promise<void> {
  const wsUrl = state.opts.apiUrl.replace(/^http/, 'ws').replace(/\/$/, '') + '/api/v1/workspace/agent/ws';

  return new Promise<void>((resolve) => {
    const ws = new WebSocket(wsUrl);
    const spinner = ora();
    let assistantText = '';

    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          prompt,
          history: state.history,
          model_id: state.opts.modelId,
          workspace_path: state.opts.workspacePath,
          max_iterations: state.opts.maxIterations,
        }),
      );
    });

    ws.on('message', (data: Buffer) => {
      try {
        const event = JSON.parse(data.toString()) as Record<string, unknown>;
        if (event.type === 'agent.text.delta') {
          assistantText += (event.content as string) || '';
        }
        if (event.type === 'agent.tool.call' && event.input) {
          const toolName = event.name as string;
          if (['write_file', 'edit_file', 'delete_file'].includes(toolName)) {
            const input = event.input as Record<string, unknown>;
            const fileChange: FileChange = {
              file: String(input.path ?? input.file ?? 'unknown'),
              action: toolName,
              content: typeof input.content === 'string' ? input.content : undefined,
            };
            state.fileChanges.push(fileChange);
            state.lastDiff = fileChange;
          }
        }
        handleEvent(event, spinner);
      } catch {
        /* ignore parse errors */
      }
    });

    ws.on('error', (err: Error) => {
      spinner.fail('连接错误');
      console.error(chalk.red(`❌ ${err.message}`));
      resolve();
    });

    ws.on('close', () => {
      spinner.stop();
      state.history.push({ role: 'user', content: prompt });
      if (assistantText) {
        state.history.push({ role: 'assistant', content: assistantText });
      }
      if (state.session) {
        state.session.history = state.history;
        saveSession(state.session);
      }
      resolve();
    });
  });
}

function handleEvent(event: Record<string, unknown>, spinner: ReturnType<typeof ora>): void {
  const type = event.type as string;
  switch (type) {
    case 'agent.text.delta':
      process.stdout.write((event.content as string) || '');
      break;

    case 'agent.tool.call':
      console.log('');
      console.log(chalk.cyan(`  🔧 ${event.name}`));
      spinner.start(`  执行 ${event.name}...`);
      break;

    case 'agent.tool.result':
      spinner.stop();
      if (!event.success) {
        console.log(chalk.red(`  ❌ ${event.error}`));
      }
      break;

    case 'agent.error':
      spinner.fail('错误');
      console.error(chalk.red(`\n❌ ${event.message}`));
      break;

    case 'agent.done':
      console.log(chalk.green(`\n\n✨ 完成 (${event.iterations} 次迭代)\n`));
      break;
  }
}

