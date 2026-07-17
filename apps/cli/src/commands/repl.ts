/**
 * 交互式 REPL — 多轮对话模式。
 * 支持 slash 命令 (/help /exit /clear /model /tools /init /mcp 等)。
 */

import * as path from 'node:path';
import * as readline from 'node:readline';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { createSession, saveSession, repairSessionHistory, type Session, type ChatMessage } from './session.js';
import { loadMcpConfig } from './mcp-config.js';
import { agentsMdExists, writeAgentsMd } from './template.js';
import { cmdRead, cmdLs, cmdGrep, cmdGlob, cmdBash } from './file-ops.js';
import { CheckpointManager } from '../checkpoints/index.js';
import { setupAgentTools, runToolLoop, type ToolContext, type InterjectionBlock } from './agent.js';
import { renderSlashHelp, suggestSlashCommands } from './slash-registry.js';
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
import {
  registerTask,
  listTasks,
  getTaskOutput,
  waitForTask,
  killTask,
  clearAllTasks,
  startLoop,
  listLoops,
  stopLoop,
  clearAllLoops,
} from '../tools/background-registry.js';
import { runSandboxedAsync } from '../sandbox/index.js';
import { estimateMessagesTokens } from '../context.js';
import { loadHooks, runSessionStartHooks, runSessionEndHooks } from '../hooks/index.js';

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
  /** Plan Mode 是否已被批准(/plan approve 后置 true) */
  planApproved?: boolean;
  /** /rewind 用历史快照栈,每次 sendToAgent 前压入当前 history 深拷贝 */
  rewindStack: ChatMessage[][];
  /** P0-2 Interject:agent 运行中用户输入的非斜杠命令进入此 buffer,runToolLoop 在下一轮 drain。
   *  P0-4 扩展:支持 image content block(text/image 两类块) */
  interjectionBuffer: InterjectionBlock[];
  /** P0-2 Interject:agent 是否正在运行(用于 rl.on('line') 路由) */
  agentRunning: boolean;
}

export function formatContextStats(
  history: ChatMessage[],
  opts?: {
    planFirst?: boolean;
    planApproved?: boolean;
    skills?: number;
    memoryCount?: number;
    maxTokens?: number;
  },
): string {
  if (history.length === 0) {
    return chalk.dim('暂无对话历史');
  }
  const maxTokens = opts?.maxTokens ?? 24_000;
  const tokens = estimateMessagesTokens(
    history.map((m) => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
  );
  const pct = Math.min(100, (tokens / maxTokens) * 100);
  const pctStr = pct.toFixed(1);

  const filled = Math.min(20, Math.floor((pct / 100) * 20));
  const empty = 20 - filled;
  let bar: string;
  if (pct >= 85) {
    bar = chalk.red('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  } else if (pct >= 50) {
    bar = chalk.yellow('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  } else {
    bar = chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  }

  const lines: string[] = [];
  lines.push(chalk.cyan('📊 上下文用量:'));
  lines.push(`  消息数: ${history.length}`);
  lines.push(`  Token 估算: ${tokens} / ${maxTokens} (${pctStr}%)`);
  lines.push(`  ${bar} ${pctStr}%`);
  lines.push(`  压缩阈值: ${maxTokens} (达 85% 自动压缩到 60%)`);

  if (opts !== undefined) {
    lines.push('');
    lines.push('附加状态:');
    const planFirst = opts.planFirst ?? false;
    const planApproved = opts.planApproved ?? false;
    const planState = planFirst ? (planApproved ? 'on (approved)' : 'on (pending)') : 'off';
    lines.push(`  Plan Mode: ${planState}`);
    if (opts.skills !== undefined) {
      lines.push(`  Skills: ${opts.skills} 个`);
    }
    if (opts.memoryCount !== undefined) {
      lines.push(`  Memory: ${opts.memoryCount} 条`);
    }
  }

  return lines.join('\n');
}

export function rewindHistory(
  history: ChatMessage[],
  stack: ChatMessage[][],
  steps: number,
): { history: ChatMessage[]; stack: ChatMessage[][]; actualSteps: number; message: string } {
  if (steps < 0) steps = 1;
  if (steps === 0) {
    return { history, stack, actualSteps: 0, message: '未回退(steps=0)' };
  }
  if (stack.length === 0) {
    return { history, stack, actualSteps: 0, message: '无历史可回退' };
  }
  const newStack = [...stack];
  const actualSteps = Math.min(steps, newStack.length);
  let restored: ChatMessage[] = [];
  for (let i = 0; i < actualSteps; i++) {
    restored = newStack.pop()!;
  }
  const message =
    steps > stack.length
      ? `已回退 ${actualSteps} 步(栈不足,请求 ${steps}),当前消息数: ${restored.length}`
      : `已回退 ${actualSteps} 步,当前消息数: ${restored.length}`;
  return { history: restored, stack: newStack, actualSteps, message };
}

export function forkHistory(
  history: ChatMessage[],
  forkIndex: number,
): { ok: true; forkedHistory: ChatMessage[] } | { ok: false; error: string } {
  if (history.length === 0) {
    return { ok: false, error: 'history 为空,无法 fork' };
  }
  if (forkIndex < 1 || forkIndex > history.length) {
    return { ok: false, error: `forkIndex 越界(1-${history.length}),got ${forkIndex}` };
  }
  const forkedHistory = history.slice(0, forkIndex).map((m) => ({ ...m }));
  return { ok: true, forkedHistory };
}

export async function startREPL(opts: ReplOptions): Promise<void> {
  const hooksConfig = loadHooks();

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
    rewindStack: [],
    interjectionBuffer: [],
    agentRunning: false,
  };
  if (state.session) {
    state.checkpoints = new CheckpointManager({
      sessionId: state.session.id,
      workspacePath: opts.workspacePath,
    });
  }

  const sessionHookCtx = {
    workspacePath: opts.workspacePath,
    sessionId: state.session?.id ?? opts.sessionId,
  };

  console.info(chalk.cyan(`\n🤖 IHUI AI (模型: ${opts.modelId}, 工作区: ${opts.workspacePath})\n`));
  console.info(chalk.dim('输入消息开始对话, /help 查看命令, /exit 退出\n'));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green('> '),
  });

  const startResult = runSessionStartHooks(hooksConfig, sessionHookCtx);
  if (!startResult.proceed) {
    console.error(chalk.red(`\n❌ 会话启动被钩子阻断: ${startResult.reason ?? '未知'}`));
    process.exit(1);
  }

  rl.prompt();

  rl.on('line', async (line: string) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }
    // P0-2 Interject:agent 运行中,非斜杠输入进入 buffer(不取消当前回合)
    // 斜杠命令仍立即执行(如 /exit /clear 等紧急命令不能等 agent 完成)
    // P0-4 扩展:输入包装为 text block(支持 image block 的统一数据结构)
    if (state.agentRunning && !input.startsWith('/')) {
      state.interjectionBuffer.push({ type: 'text', text: input });
      console.info(chalk.dim(`  ↳ 已追加到 interjection buffer(当前 ${state.interjectionBuffer.length} 条),agent 下一轮处理`));
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
    // 清理后台任务和 loop 定时器,避免僵尸进程
    clearAllLoops();
    clearAllTasks();
    runSessionEndHooks(hooksConfig, sessionHookCtx);
    console.info(chalk.dim('\n再见 👋\n'));
    process.exit(0);
  });
}

async function handleSlashCommand(input: string, state: ReplState, rl: readline.Interface): Promise<void> {
  const [cmdRaw, ...args] = input.slice(1).split(/\s+/);
  const cmd = cmdRaw ?? '';
  switch (cmd) {
    case 'help':
      console.info(renderSlashHelp());
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

    case 'plan': {
      const sub = args[0] ?? 'show';
      if (sub === 'on') {
        state.opts.planFirst = true;
        state.planApproved = false;
        console.info(chalk.green('✓ Plan Mode 已启用:LLM 必须先输出 plan 块再执行工具'));
      } else if (sub === 'off') {
        state.opts.planFirst = false;
        state.planApproved = false;
        console.info(chalk.green('✓ Plan Mode 已关闭'));
      } else if (sub === 'approve') {
        state.planApproved = true;
        console.info(chalk.green('✓ Plan 已批准,后续工具调用将直接执行'));
      } else if (sub === 'reject') {
        // 拒绝当前 plan:重置 planApproved,推入 user 消息要求 LLM 重新规划
        state.planApproved = false;
        const rejectMsg = '用户拒绝了上一个 plan,请重新规划任务步骤(输出 ```plan 代码块),再执行工具。';
        state.history.push({ role: 'user', content: rejectMsg });
        if (state.session) {
          state.session.history = state.history;
          saveSession(state.session);
        }
        console.info(chalk.yellow('✓ Plan 已拒绝,已要求 LLM 重新规划(下一条消息将触发重新规划)'));
      } else if (sub === 'edit') {
        // 简化版 edit:提示用户用 /rewind 回退到 plan 之前重新规划
        console.info(chalk.cyan('\n编辑 Plan:'));
        console.info(chalk.dim('  Plan 块已记录在 history 中。要修改:'));
        console.info(chalk.dim('  1. /rewind 1   回退到 plan 之前的状态'));
        console.info(chalk.dim('  2. 重新发送你的任务消息'));
        console.info(chalk.dim('  3. LLM 会重新输出 plan 块'));
        console.info(chalk.dim('  或者直接 /plan reject 让 LLM 重新规划\n'));
      } else if (sub === 'show') {
        const planState = state.opts.planFirst
          ? (state.planApproved ? 'on (approved)' : 'on (pending)')
          : 'off';
        console.info(`Plan Mode: ${planState}`);
        // 尝试显示最近的 plan 块
        for (let i = state.history.length - 1; i >= 0; i--) {
          const m = state.history[i]!;
          const planMatch = m.content.match(/```plan\n([\s\S]*?)```/);
          if (planMatch) {
            console.info(chalk.dim(`\n最近的 Plan (来自消息 #${i + 1}):`));
            console.info(planMatch[1]?.trim() ?? '');
            break;
          }
        }
      } else {
        console.info(chalk.dim('用法:/plan on|off|approve|reject|edit|show'));
      }
      break;
    }

    case 'context': {
      console.info(formatContextStats(state.history, {
        planFirst: state.opts.planFirst,
        planApproved: state.planApproved,
        skills: state.skills.length,
        memoryCount: state.memory.length,
      }));
      console.info('');
      break;
    }

    case 'rewind': {
      const raw = args[0] ? Number(args[0]) : 1;
      const steps = Number.isFinite(raw) ? raw : 1;
      const result = rewindHistory(state.history, state.rewindStack, steps);
      state.history = result.history;
      state.rewindStack = result.stack;
      if (state.session) {
        state.session.history = state.history;
        saveSession(state.session);
      }
      if (result.actualSteps > 0) {
        console.info(chalk.green(result.message));
      } else {
        console.info(chalk.yellow(result.message));
      }
      break;
    }

    case 'fork': {
      let forkIndex: number;
      if (args[0]) {
        const parsed = Number(args[0]);
        if (!Number.isFinite(parsed)) {
          console.info(chalk.yellow('用法: /fork [msg-index]'));
          break;
        }
        forkIndex = parsed;
      } else {
        let lastUserIdx = -1;
        for (let i = state.history.length - 1; i >= 0; i--) {
          if (state.history[i]!.role === 'user') {
            lastUserIdx = i;
            break;
          }
        }
        if (lastUserIdx === -1) {
          console.info(chalk.yellow('history 为空或无 user 消息,无法 fork'));
          break;
        }
        forkIndex = lastUserIdx + 1;
      }
      const result = forkHistory(state.history, forkIndex);
      if (!result.ok) {
        console.info(chalk.yellow(`fork 失败: ${result.error}`));
        break;
      }
      const newSession = createSession(state.opts.workspacePath, state.opts.modelId);
      newSession.history = result.forkedHistory;
      saveSession(newSession);
      console.info(chalk.green(
        `已 fork 新 session: ${newSession.id},从消息 #${forkIndex} 分叉,包含 ${result.forkedHistory.length} 条消息`,
      ));
      break;
    }

    case 'repair': {
      // P1-1 会话历史自愈:清理非法 role / 空 content / 连续重复 / interjection 残留
      const before = state.history.length;
      const { repaired, removed, reasons } = repairSessionHistory(state.history);
      state.history = repaired;
      if (state.session) {
        state.session.history = state.history;
        saveSession(state.session);
      }
      console.info(chalk.cyan(`\n🔧 会话历史自愈完成:`));
      console.info(`  修复前: ${before} 条 → 修复后: ${repaired.length} 条(移除 ${removed} 条)`);
      if (reasons.length > 0) {
        console.info(chalk.dim('  修复原因:'));
        for (const r of reasons.slice(0, 10)) {
          console.info(chalk.dim(`    - ${r}`));
        }
        if (reasons.length > 10) {
          console.info(chalk.dim(`    ...(还有 ${reasons.length - 10} 条)`));
        }
      } else if (removed === 0) {
        console.info(chalk.dim('  历史结构正常,无需修复'));
      }
      console.info('');
      break;
    }

    case 'bg':
    case 'background': {
      const sub = args[0] ?? '';
      if (!sub) {
        console.info(chalk.dim('用法:/bg <cmd> | /bg list | /bg out <id> [N] | /bg wait <id> [ms] | /bg kill <id>'));
        break;
      }
      if (sub === 'list') {
        const list = listTasks();
        if (list.length === 0) {
          console.info(chalk.dim('当前无后台任务'));
        } else {
          console.info(chalk.cyan(`\n后台任务(${list.length} 个):`));
          for (const t of list) {
            const icon = t.status === 'running' ? chalk.green('●') : t.status === 'exited' ? chalk.dim('●') : chalk.red('●');
            console.info(`  ${icon} ${t.id}  [${t.status}]  ${t.command.slice(0, 50)}  exit=${t.exitCode ?? '-'}`);
          }
          console.info('');
        }
      } else if (sub === 'out') {
        const id = args[1] ?? '';
        const tail = args[2] ? Number(args[2]) : undefined;
        if (!id) { console.info(chalk.red('缺少 task_id')); break; }
        const output = getTaskOutput(id, tail);
        if (!output) { console.info(chalk.red(`任务 ${id} 不存在`)); break; }
        console.info(chalk.cyan(`任务 ${output.id}  状态: ${output.status}  exit: ${output.exitCode ?? '-'}`));
        if (output.stdout) console.info(output.stdout.trimEnd());
        if (output.stderr) console.info(chalk.yellow(`[stderr] ${output.stderr.trimEnd()}`));
        if (output.truncated) console.info(chalk.dim('[输出被截断]'));
      } else if (sub === 'wait') {
        const id = args[1] ?? '';
        const timeoutMs = args[2] ? Number(args[2]) : 30_000;
        if (!id) { console.info(chalk.red('缺少 task_id')); break; }
        console.info(chalk.dim(`等待 ${id} (超时 ${timeoutMs}ms)...`));
        const result = await waitForTask(id, timeoutMs);
        if (!result) { console.info(chalk.red('任务不存在')); break; }
        console.info(chalk.cyan(`任务 ${result.id}  状态: ${result.status}  exit: ${result.exitCode ?? '-'}`));
        if (result.stdoutBuf) console.info(result.stdoutBuf.trimEnd().slice(-2000));
      } else if (sub === 'kill') {
        const id = args[1] ?? '';
        if (!id) { console.info(chalk.red('缺少 task_id')); break; }
        const result = await killTask(id);
        if (result.killed) console.info(chalk.green(`✓ 任务 ${id} 已终止`));
        else console.info(chalk.red(`终止失败: ${result.reason ?? '未知'}`));
      } else {
        // /bg <cmd> — 启动后台任务
        const cmd = args.join(' ');
        const handle = runSandboxedAsync(cmd, {
          cwd: state.opts.workspacePath,
          timeoutMs: 600_000,
          allowedPaths: [state.opts.workspacePath],
        });
        if (!handle.process) {
          console.info(chalk.red('启动失败(沙盒拒绝)'));
          break;
        }
        const taskId = registerTask(handle.process, cmd);
        console.info(chalk.green(`✓ 后台任务已启动: ${taskId}`));
        console.info(chalk.dim(`  命令: ${cmd}`));
        console.info(chalk.dim(`  /bg out ${taskId} 查看输出, /bg wait ${taskId} 等待, /bg kill ${taskId} 终止`));
      }
      break;
    }

    case 'loop': {
      const sub = args[0] ?? '';
      if (!sub) {
        console.info(chalk.dim('用法:/loop <intvl> <cmd> | /loop list | /loop stop <id> | /loop clear'));
        console.info(chalk.dim('  intvl 格式: Ns/Nm/Nh/Nd(如 5m = 5 分钟)'));
        break;
      }
      if (sub === 'list') {
        const list = listLoops();
        if (list.length === 0) {
          console.info(chalk.dim('当前无 loop 任务'));
        } else {
          console.info(chalk.cyan(`\nLoop 任务(${list.length} 个):`));
          for (const l of list) {
            console.info(`  ${l.id}  每 ${l.intervalMs}ms  运行 ${l.runCount} 次  上次: ${l.lastRunAt ?? '-'}`);
            console.info(chalk.dim(`    命令: ${l.command.slice(0, 60)}`));
          }
          console.info('');
        }
      } else if (sub === 'stop') {
        const id = args[1] ?? '';
        if (!id) { console.info(chalk.red('缺少 loop_id')); break; }
        if (stopLoop(id)) console.info(chalk.green(`✓ Loop ${id} 已停止`));
        else console.info(chalk.red(`Loop ${id} 不存在`));
      } else if (sub === 'clear') {
        clearAllLoops();
        console.info(chalk.green('✓ 所有 loop 已停止'));
      } else {
        // /loop <intvl> <cmd>
        const intvl = sub;
        const cmd = args.slice(1).join(' ');
        if (!cmd) { console.info(chalk.red('缺少命令')); break; }
        const spawn = (command: string): string => {
          const handle = runSandboxedAsync(command, {
            cwd: state.opts.workspacePath,
            timeoutMs: 600_000,
            allowedPaths: [state.opts.workspacePath],
          });
          if (!handle.process) return '';
          return registerTask(handle.process, command);
        };
        const result = startLoop({ command: cmd, interval: intvl, spawn });
        if ('error' in result) {
          console.info(chalk.red(result.error));
        } else {
          console.info(chalk.green(`✓ Loop 已启动: ${result.id}`));
          console.info(chalk.dim(`  间隔: ${result.intervalMs}ms, 命令: ${cmd}`));
          console.info(chalk.dim(`  /loop list 查看, /loop stop ${result.id} 停止`));
        }
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

    default: {
      console.info(chalk.yellow(`未知命令: /${cmd}, /help 查看可用命令`));
      const suggestions = suggestSlashCommands(cmd);
      if (suggestions.length > 0) {
        console.info(chalk.dim(`  你是否想用: ${suggestions.map((s) => `/${s.name}`).join(', ')}?`));
      }
      break;
    }
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

  state.rewindStack.push(state.history.map((m) => ({ ...m })));
  if (state.rewindStack.length > 20) {
    state.rewindStack.shift();
  }
  state.history.push({ role: 'user', content: prompt });

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: state.systemPrompt! },
    ...state.history.map((m) => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
  ];

  // P0-2 Interject:agent 运行期间允许用户输入非斜杠命令到 buffer,runToolLoop 每轮 drain
  state.agentRunning = true;
  const drainInterjections = (): InterjectionBlock[] => {
    const buf = state.interjectionBuffer;
    state.interjectionBuffer = [];
    return buf;
  };

  const result = await runToolLoop({
    modelId: state.opts.modelId,
    messages,
    ctx: state.ctx!,
    maxIterations: state.opts.maxIterations,
    planFirst: state.opts.planFirst,
    planApproved: state.planApproved,
    drainInterjections,
    onDelta: (delta) => { process.stdout.write(delta); },
    onToolCall: (name, args) => console.info(chalk.cyan(`\n  🔧 ${name} ${JSON.stringify(args)}`)),
    onToolResult: (_name, success, output) => {
      const icon = success ? '✓' : '✗';
      console.info(chalk.dim(`  ${icon} ${output.slice(0, 200)}`));
    },
    onError: (err) => console.error(chalk.red(`\n❌ ${err}`)),
  });

  state.agentRunning = false;

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

