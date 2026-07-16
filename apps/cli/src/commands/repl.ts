/**
 * 交互式 REPL — 多轮对话模式。
 * 支持 slash 命令 (/help /exit /clear /model /tools /init /mcp 等)。
 */

import * as path from 'node:path';
import * as readline from 'node:readline';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { createSession, saveSession, type Session, type ChatMessage } from './session.js';
import { loadMcpConfig } from './mcp-config.js';
import { agentsMdExists, writeAgentsMd } from './template.js';
import { cmdRead, cmdLs, cmdGrep, cmdGlob, cmdBash } from './file-ops.js';
import { CheckpointManager } from '../checkpoints/index.js';
import { setupAgentTools, runToolLoop, type ToolContext } from './agent.js';
import { findSkill, type Skill } from '../skills/index.js';
import {
  getMemoryStore,
  loadMemory,
  searchMemory,
  addMemoryEntry,
  clearMemory,
  setMemoryEnabled,
  type MemoryEntry,
} from '../memory/index.js';

export interface ReplOptions {
  modelId: string;
  workspacePath: string;
  apiUrl: string;
  apiKey?: string;
  maxIterations: number;
  sessionId?: string;
  history?: ChatMessage[];
  enableMcp?: boolean;
  allowDangerous?: boolean;
  /** 强制 LLM 先输出 plan 块再执行工具 */
  planFirst?: boolean;
}

interface ReplState {
  opts: ReplOptions;
  history: ChatMessage[];
  session: Session | null;
  checkpoints: CheckpointManager | null;
  agentReady: boolean;
  systemPrompt: string | null;
  ctx: ToolContext | null;
  skills: Skill[];
  memory: MemoryEntry[];
}

export async function startREPL(opts: ReplOptions): Promise<void> {
  const state: ReplState = {
    opts,
    history: opts.history ?? [],
    session: opts.sessionId ? null : createSession(opts.workspacePath, opts.modelId),
    checkpoints: null,
    agentReady: false,
    systemPrompt: null,
    ctx: null,
    skills: [],
    memory: [],
  };
  if (state.session) {
    state.checkpoints = new CheckpointManager({
      sessionId: state.session.id,
      workspacePath: opts.workspacePath,
    });
  }

  console.info(chalk.cyan(`\n🤖 IHUI AI (模型: ${opts.modelId}, 工作区: ${opts.workspacePath})\n`));
  console.info(chalk.dim('输入消息开始对话, /help 查看命令, /exit 退出\n'));

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
    console.info(chalk.dim('\n再见 👋\n'));
    process.exit(0);
  });
}

async function handleSlashCommand(input: string, state: ReplState, rl: readline.Interface): Promise<void> {
  const [cmd, ...args] = input.slice(1).split(/\s+/);
  switch (cmd) {
    case 'help':
      console.info(chalk.cyan('\n可用命令:'));
      console.info('  /help              显示帮助');
      console.info('  /exit              退出');
      console.info('  /clear             清除对话历史');
      console.info('  /model [id]        切换模型');
      console.info('  /workspace         显示当前工作区');
      console.info('  /tools             列出可用工具');
      console.info('  /init              创建 AGENTS.md 模板');
      console.info('  /mcp               列出已配置的 MCP 服务器');
      console.info('  /skills            列出已加载的 skills');
      console.info('  /skill <name>      查看 skill 内容');
      console.info('  /memory [cmd]      管理跨会话记忆(on/off/show/add/clear/search)');
      console.info(chalk.cyan('\n检查点:'));
      console.info('  /checkpoint [files...]  创建/列出检查点 (别名 /cp)');
      console.info('  /rollback <id|auto>      回滚到检查点 (别名 /rb)');
      console.info('  /diff [id]                对比检查点与当前工作区');
      console.info(chalk.cyan('\n文件操作:'));
      console.info('  /read <file>       读取文件 (带行号)');
      console.info('  /ls [dir]          列出目录内容');
      console.info('  /grep <pat> [path] 递归搜索内容');
      console.info('  /glob <pattern>    匹配文件名 (如 *.ts)');
      console.info('  /bash <cmd>        执行 shell 命令');
      console.info('');
      break;

    case 'exit':
    case 'quit':
      rl.close();
      break;

    case 'clear':
      state.history = [];
      if (state.session) {
        state.session.history = [];
        saveSession(state.session);
      }
      console.info(chalk.green('对话历史已清除'));
      break;

    case 'model':
      if (args[0]) {
        state.opts.modelId = args[0];
        if (state.session) {
          state.session.modelId = args[0]!;
          saveSession(state.session);
        }
        console.info(chalk.green(`模型已切换为: ${args[0]}`));
      } else {
        await interactiveModelSelect(state);
      }
      break;

    case 'workspace':
      console.info(`工作区: ${state.opts.workspacePath}`);
      break;

    case 'tools': {
      const { listTools } = await import('../tools/index.js');
      const { BUILTIN_TOOLS } = await import('../tools/builtins.js');
      const tools = listTools().length > 0 ? listTools() : BUILTIN_TOOLS;
      console.info(chalk.cyan(`\n可用工具 (${tools.length}):`));
      for (const t of tools) {
        console.info(`  ${chalk.cyan(t.name)} — ${t.description}`);
      }
      console.info('');
      break;
    }

    case 'init':
      await handleInit(state);
      break;

    case 'mcp':
      handleMcpList();
      break;

    case 'skills': {
      if (state.skills.length === 0) {
        console.info(chalk.dim('暂无 skills(可在 .ihui/skills/*.md 或 ~/.ihui/skills/*.md 创建)'));
      } else {
        console.info(chalk.cyan(`\n已加载 ${state.skills.length} 个 skill:`));
        for (const s of state.skills) {
          console.info(`  ${chalk.bold(s.name)} — ${chalk.dim(s.description)}`);
        }
        console.info('');
      }
      break;
    }

    case 'skill': {
      const name = args[0];
      if (!name) {
        console.info(chalk.yellow('用法: /skill <name>'));
        break;
      }
      const skill = findSkill(state.skills, name);
      if (!skill) {
        console.info(chalk.yellow(`未找到 skill: ${name}(/skills 查看可用列表)`));
        break;
      }
      console.info(chalk.cyan(`\n# ${skill.name}`));
      console.info(chalk.dim(`来源: ${skill.source}`));
      console.info(chalk.dim(`描述: ${skill.description}\n`));
      console.info(skill.body);
      console.info('');
      break;
    }

    case 'memory': {
      const sub = args[0] ?? 'show';
      const store = getMemoryStore(state.opts.workspacePath);
      if (sub === 'on') {
        setMemoryEnabled(true);
        console.info(chalk.green('✓ memory 已启用'));
      } else if (sub === 'off') {
        setMemoryEnabled(false);
        console.info(chalk.yellow('✓ memory 已关闭'));
      } else if (sub === 'show') {
        const entries = loadMemory(state.opts.workspacePath);
        if (entries.length === 0) {
          console.info(chalk.dim('暂无 memory 条目(/memory add <text> 添加)'));
        } else {
          console.info(chalk.cyan(`\n已加载 ${entries.length} 条 memory:`));
          for (const e of entries) {
            const tag = e.source === 'global' ? '🌐' : '📁';
            console.info(`  ${tag} [${e.category}] ${e.text}`);
          }
          console.info('');
        }
      } else if (sub === 'add') {
        const text = args.slice(1).join(' ');
        if (!text) {
          console.info(chalk.yellow('用法: /memory add <text> [--global] [--category <名称>]'));
          break;
        }
        const isGlobal = args.includes('--global');
        const catIdx = args.indexOf('--category');
        const category = catIdx >= 0 ? args[catIdx + 1] ?? '通用' : '通用';
        const target = isGlobal ? store.globalPath : store.projectPath;
        addMemoryEntry(target, text, category);
        console.info(chalk.green(`✓ 已添加 memory(${isGlobal ? '全局' : '项目'}): ${text}`));
        // 重新加载到 state
        state.memory = loadMemory(state.opts.workspacePath);
      } else if (sub === 'clear') {
        const isGlobal = args.includes('--global');
        const target = isGlobal ? store.globalPath : store.projectPath;
        clearMemory(target);
        console.info(chalk.green(`✓ 已清空 ${isGlobal ? '全局' : '项目'} memory`));
        state.memory = loadMemory(state.opts.workspacePath);
      } else if (sub === 'search') {
        const query = args.slice(1).join(' ');
        if (!query) {
          console.info(chalk.yellow('用法: /memory search <关键词>'));
          break;
        }
        const entries = loadMemory(state.opts.workspacePath);
        const matched = searchMemory(entries, query);
        if (matched.length === 0) {
          console.info(chalk.dim(`未找到匹配 "${query}" 的 memory`));
        } else {
          console.info(chalk.cyan(`\n找到 ${matched.length} 条匹配:`));
          for (const e of matched) {
            const tag = e.source === 'global' ? '🌐' : '📁';
            console.info(`  ${tag} [${e.category}] ${e.text}`);
          }
          console.info('');
        }
      } else {
        console.info(chalk.yellow('用法: /memory [on|off|show|add <text>|clear|search <关键词>]'));
      }
      break;
    }

    case 'checkpoint':
    case 'cp':
      await handleCheckpoint(state, args);
      break;

    case 'rollback':
    case 'rb':
      await handleRollback(state, args);
      break;

    case 'diff':
      handleDiff(state, args);
      break;

    case 'read':
      cmdRead(state.opts.workspacePath, args[0] ?? '');
      break;

    case 'ls':
      cmdLs(state.opts.workspacePath, args[0] ?? '');
      break;

    case 'grep':
      cmdGrep(state.opts.workspacePath, args[0] ?? '', args[1] ?? '');
      break;

    case 'glob':
      cmdGlob(state.opts.workspacePath, args[0] ?? '');
      break;

    case 'bash':
      cmdBash(state.opts.workspacePath, args.join(' '), state.checkpoints ?? undefined);
      break;

    case 'sh':
      cmdBash(state.opts.workspacePath, args.join(' '), state.checkpoints ?? undefined);
      break;

    default:
      console.info(chalk.yellow(`未知命令: /${cmd}, /help 查看可用命令`));
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
    console.info(chalk.green(`模型已切换为: ${answers.model}`));
  } catch {
    console.info(chalk.dim('请使用 /model <id> 指定模型'));
  }
}

async function handleInit(state: ReplState): Promise<void> {
  const wsPath = state.opts.workspacePath;
  if (agentsMdExists(wsPath)) {
    console.info(chalk.yellow('AGENTS.md 已存在'));
    return;
  }
  writeAgentsMd(wsPath);
  console.info(chalk.green(`已创建: ${path.join(wsPath, 'AGENTS.md')}`));
}

function handleMcpList(): void {
  const config = loadMcpConfig();
  if (config.servers.length > 0) {
    console.info(chalk.cyan('\n本地 MCP 服务器配置 (~/.ihui/mcp.json):'));
    for (const s of config.servers) {
      const argStr = s.args && s.args.length > 0 ? ' ' + s.args.join(' ') : '';
      console.info(`  ${chalk.bold(s.name)}: ${s.command ?? ''}${argStr}`);
    }
  } else {
    console.info(chalk.dim('\n本地无 MCP 服务器配置'));
  }
}

async function handleCheckpoint(state: ReplState, args: string[]): Promise<void> {
  if (!state.checkpoints) {
    console.info(chalk.yellow('会话未初始化,无法管理检查点'));
    return;
  }
  if (args.length === 0) {
    const list = state.checkpoints.list();
    if (list.length === 0) {
      console.info(chalk.dim('暂无检查点'));
      return;
    }
    console.info(chalk.cyan(`\n检查点 (会话: ${state.session?.id ?? '-'}):`));
    for (const m of list) {
      const time = new Date(m.createdAt).toLocaleString();
      const fc = Object.keys(m.files).length;
      console.info(`  ${chalk.bold(m.id)}  ${chalk.dim(time)}  ${m.reason}  ${fc} 文件`);
    }
    console.info('');
    return;
  }
  try {
    const meta = await state.checkpoints.snapshot(args, 'manual_repl');
    console.info(chalk.green(`✓ 已创建检查点: ${meta.id} (${Object.keys(meta.files).length} 文件)`));
  } catch (err) {
    console.info(chalk.red(`✗ 快照失败: ${err instanceof Error ? err.message : String(err)}`));
  }
}

async function handleRollback(state: ReplState, args: string[]): Promise<void> {
  if (!state.checkpoints) {
    console.info(chalk.yellow('会话未初始化'));
    return;
  }
  const id = args[0];
  if (!id) {
    console.info(chalk.yellow('用法: /rollback <checkpoint-id> | /rollback auto'));
    return;
  }
  let targetId = id;
  if (id === 'auto') {
    const autoCp = state.checkpoints.list().find((c) => c.reason === 'auto_pre_bash');
    if (!autoCp) {
      console.info(chalk.yellow('暂无自动检查点(auto_pre_bash)'));
      return;
    }
    targetId = autoCp.id;
    console.info(chalk.dim(`  找到自动检查点: ${targetId}`));
  }
  try {
    const result = await state.checkpoints.restore(targetId);
    console.info(chalk.green(`✓ 已回滚到检查点: ${targetId}`));
    console.info(chalk.dim(`  恢复: ${result.restored.length} 个 / 移除: ${result.removed.length} 个`));
  } catch (err) {
    console.info(chalk.red(`✗ 回滚失败: ${err instanceof Error ? err.message : String(err)}`));
  }
}

function handleDiff(state: ReplState, args: string[]): void {
  if (!state.checkpoints) {
    console.info(chalk.yellow('会话未初始化'));
    return;
  }
  const entries = state.checkpoints.diff(args[0]);
  if (entries.length === 0) {
    console.info(chalk.dim('无差异'));
    return;
  }
  console.info(chalk.cyan('\n差异:'));
  for (const e of entries) {
    const icon = e.status === 'modified' ? chalk.yellow('M') : e.status === 'added' ? chalk.green('+') : chalk.red('-');
    console.info(`  ${icon} ${e.path}`);
  }
}

async function sendToAgent(prompt: string, state: ReplState): Promise<void> {
  if (!state.agentReady) {
    const result = await setupAgentTools({
      workspacePath: state.opts.workspacePath,
      checkpoints: state.checkpoints ?? undefined,
      enableMcp: state.opts.enableMcp,
      silent: true,
      planFirst: state.opts.planFirst,
      subagentParent: {
        modelId: state.opts.modelId,
        apiUrl: state.opts.apiUrl,
        apiKey: state.opts.apiKey,
        allowDangerous: state.opts.allowDangerous,
      },
      confirmDangerous: async (tool, args) => {
        if (state.opts.allowDangerous) {
          console.info(chalk.yellow(`  ⚠ 自动允许危险操作: ${tool.name}`));
          return true;
        }
        const argSummary = JSON.stringify(args).slice(0, 100);
        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: `⚠ 工具 ${tool.name} 将执行危险操作(${argSummary}),是否继续?`,
          default: false,
        }]);
        return confirm;
      },
    });
    state.systemPrompt = result.systemPrompt;
    state.ctx = result.ctx;
    state.skills = result.skills;
    state.memory = result.memory;
    state.agentReady = true;
  }

  state.history.push({ role: 'user', content: prompt });

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: state.systemPrompt! },
    ...state.history.map((m) => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
  ];

  const result = await runToolLoop({
    modelId: state.opts.modelId,
    messages,
    ctx: state.ctx!,
    maxIterations: state.opts.maxIterations,
    onDelta: (delta) => { process.stdout.write(delta); },
    onToolCall: (name, args) => console.info(chalk.cyan(`\n  🔧 ${name} ${JSON.stringify(args)}`)),
    onToolResult: (_name, success, output) => {
      const icon = success ? '✓' : '✗';
      console.info(chalk.dim(`  ${icon} ${output.slice(0, 200)}`));
    },
    onError: (err) => console.error(chalk.red(`\n❌ ${err}`)),
  });

  if (result.assistantText) {
    state.history.push({ role: 'assistant', content: result.assistantText });
  }
  if (state.session) {
    state.session.history = state.history;
    saveSession(state.session);
  }
  const u = result.usage;
  const cost = u.estimatedCostUsd > 0 ? `$${u.estimatedCostUsd.toFixed(4)}` : 'plan 套餐';
  console.info(chalk.green(`\n\n✨ 完成 (${result.iterations} 轮, ${result.stopReason})`));
  console.info(chalk.dim(`📊 tokens: ${u.totalTokens} (prompt ${u.promptTokens} + completion ${u.completionTokens}) — ${cost}\n`));
}

