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
import { PlanMachine } from '../plan/index.js';
import { setupAgentTools, runToolLoop, type ToolContext, type InterjectionBlock } from './agent.js';
import { InterjectionBuffer } from '../interjection.js';
import { renderSlashHelp, suggestSlashCommands } from './slash-registry.js';
import type { PermissionRules, PermissionMode } from '../tools/permissions.js';
import type { PluginRegistry } from '../plugins/index.js';
import { readTodoList } from '../tools/todo-write.js';
import { findSkill, type Skill } from '../skills/index.js';
import {
  getMemoryStore,
  loadMemory,
  searchMemory,
  addMemoryEntry,
  clearMemory,
  setMemoryEnabled,
  hybridSearchSync,
  MockEmbeddingProvider,
  ApiEmbeddingProvider,
  type MemoryEntry,
  type MemoryChunk,
  type MemorySource,
  type EmbeddingProvider,
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
import { loadHooks, runSessionStartHooks, runSessionEndHooks, runHook } from '../hooks/index.js';
import {
  saveSession as saveSessionState,
  loadSession as loadSessionState,
  listSessions as listSessionStates,
  newSessionId,
} from '../sessions/index.js';
import { loadSettings, type Settings } from './settings.js';
import { handlePluginMarketplaceCommand } from './plugin-marketplace.js';
import {
  getAnnouncements,
  refreshAnnouncements,
  loadSeenIds,
  markSeen,
  markAllSeen,
  countUnread,
  formatAnnouncements,
  formatStartupBanner,
  getDefaultSeenPath,
} from '../announcements/index.js';
import {
  checkMicrophoneAvailable,
  voiceInput,
  formatRecordResult,
  formatTranscribeResult,
} from '../voice/index.js';
import { PromptQueue, type PromptQueueItem } from '../prompt-queue.js';

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
  /** P0-7 Permission rules:白名单/黑名单(--tools/--disallowed-tools) */
  permissions?: PermissionRules;
  /** 权限模式:default|acceptEdits|bypassPermissions|plan|manual */
  permissionMode?: PermissionMode;
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
  /** PlanMachine 状态机(可选,/plan on 后实例化,提供硬阻断:gathering 状态阻止工具执行) */
  planMachine?: PlanMachine;
  /** PluginRegistry(可选,setupAgentTools 加载后注入,runToolLoop 触发 preToolCall/postToolCall hook) */
  pluginRegistry?: PluginRegistry;
  /** /rewind 用历史快照栈,每次 sendToAgent 前压入当前 history 深拷贝 */
  rewindStack: ChatMessage[][];
  /** InterjectionBuffer:agent 运行中用户输入的非斜杠命令进入此 buffer,按优先级处理。
   *  P2-2 改进:drain 机制在 runToolLoop 循环内注入(每轮 popAll),循环结束后递归消费所有 pending。
   *  原"机制 1 formatForLLM 注入 system 消息"已删除(避免与 drain 双重注入)。 */
  interjectionBuffer: InterjectionBuffer;
  /** P0-2 Interject:agent 是否正在运行(用于 rl.on('line') 路由) */
  agentRunning: boolean;
  /** P2-2 REPL Abort:agent 被中止标志(SIGINT 触发),控制 interjection 递归消费 */
  aborted: boolean;
  /** P2-2 REPL Abort:当前 agent 运行的 AbortController,SIGINT handler 调用 .abort() */
  abortController: AbortController | null;
  /** P3-3 Prompt Queue:用户在 agent 运行时排队的提示词,agent 完成后自动 drain 顺序执行 */
  promptQueue: PromptQueue;
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

// === P1-4 Memory Hybrid Search 集成(复用现有 /memory search 子命令) ===

/**
 * MemoryEntry → MemoryChunk 适配器。
 * MEMORY.md 无时间戳/accessCount,用默认值填充;category 写入 ancestors[0] 保留分类。
 */
export function memoryEntryToChunk(
  entry: MemoryEntry,
  source: MemorySource = 'workspace',
): MemoryChunk {
  return {
    id: `${entry.category || 'uncategorized'}:${entry.text.slice(0, 32)}`,
    text: entry.text,
    source,
    createdAt: Date.now(),
    accessCount: 0,
    lastAccessed: Date.now(),
    ancestors: [entry.category || 'uncategorized'],
  };
}

/**
 * 从 settings 解析 embedding provider。
 * - settings.embeddingEnabled === false → undefined(纯 BM25)
 * - settings.embeddingApiBase + embeddingApiKey → ApiEmbeddingProvider
 * - 否则 → MockEmbeddingProvider(默认,零配置)
 *
 * 注意:hybridSearchSync 当前忽略 provider(纯 FTS),此函数为后续迁移到 async hybridSearch 预留。
 */
export function resolveEmbeddingProvider(): EmbeddingProvider | undefined {
  const settings = loadSettings() as Settings & {
    embeddingApiBase?: string;
    embeddingApiKey?: string;
    embeddingEnabled?: boolean;
  };
  if (settings.embeddingEnabled === false) return undefined;
  if (settings.embeddingApiBase && settings.embeddingApiKey) {
    return new ApiEmbeddingProvider({
      apiBase: settings.embeddingApiBase,
      apiKey: settings.embeddingApiKey,
    });
  }
  return new MockEmbeddingProvider();
}

export interface MemorySearchResult {
  text: string;
  category: string;
  source: 'global' | 'project';
  score: number;
  matchedBy: string;
}

/**
 * 执行 memory 搜索(核心逻辑,从 REPL handler 提取以便测试)。
 * 优先用 hybridSearchSync(BM25 + 时间衰减 + MMR),失败或返回空则降级到 substring。
 */
export function executeMemorySearch(
  entries: MemoryEntry[],
  query: string,
  provider?: EmbeddingProvider,
): MemorySearchResult[] {
  if (entries.length === 0) return [];

  try {
    const chunks = entries.map((e) =>
      memoryEntryToChunk(e, e.source === 'global' ? 'global' : 'workspace'),
    );
    const searchResults = hybridSearchSync({
      query,
      chunks,
      provider,
      maxResults: 10,
    });
    if (searchResults.length === 0) {
      // hybrid search 返回空 → fallback 到 substring
      return searchMemory(entries, query).map((e) => ({
        text: e.text,
        category: e.category,
        source: e.source,
        score: 0,
        matchedBy: 'substring-fallback',
      }));
    }
    return searchResults.map((r) => ({
      text: r.chunk.text,
      category: r.chunk.ancestors?.[0] ?? 'general',
      source: r.chunk.source === 'global' ? 'global' : 'project',
      score: r.score,
      matchedBy: r.matchedBy,
    }));
  } catch {
    // hybridSearchSync 抛错 → fallback 到 substring
    return searchMemory(entries, query).map((e) => ({
      text: e.text,
      category: e.category,
      source: e.source,
      score: 0,
      matchedBy: 'substring-fallback',
    }));
  }
}

// === P2-2 REPL Abort + Drain 增强:可测试的工厂函数 ===

/**
 * P2-2 创建 REPL SIGINT handler(可测试,不依赖真实 process 信号)。
 *
 * 行为契约:
 * - 两次 SIGINT 间隔 < 1s → 调 onForceExit(由调用方实现 process.exit(130))
 * - agent 未运行(agentRunning=false)→ 维持 Node 默认行为(不调 abort,Node 自动打印 ^C)
 * - agent 运行中(agentRunning=true)→ 调 abortController.abort() + onAbort 回调
 *
 * 导出供单元测试:测试可注入 now() 假时钟 + mock 回调,无需真实 process 信号。
 *
 * @param state REPL 状态(读 agentRunning/abortController,写 aborted)
 * @param opts.onForceExit 强杀回调(REPL 注入 () => process.exit(130))
 * @param opts.onAbort 中止成功回调(REPL 注入打印中文提示)
 * @param opts.now 时间戳获取(测试用假时钟)
 */
export function createReplSigintHandler(
  state: {
    agentRunning: boolean;
    aborted: boolean;
    abortController: AbortController | null;
  },
  opts: {
    onForceExit?: () => void;
    onAbort?: () => void;
    now?: () => number;
  } = {},
): () => void {
  let lastSigintTime = 0;
  return () => {
    const now = (opts.now ?? Date.now)();
    // 双击 SIGINT 间隔 < 1s → 强杀退出(标准 SIGINT 退出码 130)
    if (now - lastSigintTime < 1000) {
      opts.onForceExit?.();
      return;
    }
    lastSigintTime = now;
    // agent 未运行:维持 Node 默认行为(不调 abort,Node 自动打印 ^C,等下一次输入或第二次 SIGINT 退出)
    if (!state.agentRunning) {
      return;
    }
    // agent 运行中:触发 abort + 提示
    if (state.abortController && !state.abortController.signal.aborted) {
      state.abortController.abort();
      state.aborted = true;
      opts.onAbort?.();
    }
  };
}

/**
 * P2-2 创建 drainInterjections 回调:从 InterjectionBuffer 弹出所有 pending,
 * 包装为 InterjectionBlock[] 供 runToolLoop 在循环内注入。
 *
 * 不修改 InterjectionBuffer(没有 popAll),用 while + pop 循环模拟。
 *
 * 导出供单元测试:验证 drain 真正消费 buffer(不再返回 [])。
 */
export function createDrainInterjections(
  buffer: InterjectionBuffer,
): () => InterjectionBlock[] {
  return () => {
    const blocks: InterjectionBlock[] = [];
    while (buffer.hasPending()) {
      const ij = buffer.pop();
      if (ij) {
        blocks.push({ type: 'text', text: ij.content });
      }
    }
    return blocks;
  };
}

/**
 * P2-2 消费所有 pending interjection(无论优先级),递归调用 sendFn 触发新轮次。
 *
 * 改进点(对比原逻辑只消费 high/critical):
 * - normal/low 也加入递归消费,避免用户输入堆积在 buffer 等待下次 sendToAgent
 * - aborted 时停止消费(避免中止后继续触发新轮次)
 * - depth 限制防止无限递归(用户连续 push 的极端场景)
 *
 * 导出供单元测试:测试可注入 mock sendFn 验证递归调用次数 + 优先级覆盖。
 *
 * @param state REPL 状态(读 aborted + interjectionBuffer)
 * @param sendFn 递归发送函数(即 sendToAgent 自身)
 * @param depth 当前递归深度
 * @param maxDepth 最大深度(默认 5)
 * @param onConsume 每条 interjection 被消费时的日志回调(REPL 注入 chalk.dim 打印)
 */
export async function consumePendingInterjections(
  state: ReplState,
  sendFn: (prompt: string, state: ReplState, depth: number) => Promise<void>,
  depth: number,
  maxDepth = 5,
  onConsume?: (priority: string, content: string) => void,
): Promise<void> {
  if (depth >= maxDepth) return;
  if (state.aborted) return;
  while (true) {
    if (state.aborted) break;
    const next = state.interjectionBuffer.peek();
    if (!next) break;
    state.interjectionBuffer.pop();
    onConsume?.(next.priority, next.content);
    await sendFn(next.content, state, depth + 1);
  }
}

export async function startREPL(opts: ReplOptions): Promise<void> {
  const hooksConfig = loadHooks();
  const settings = loadSettings();

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
    interjectionBuffer: new InterjectionBuffer(),
    agentRunning: false,
    // P2-2 REPL Abort:初始化中止状态
    aborted: false,
    abortController: null,
    // P3-3 Prompt Queue:初始化提示词队列
    promptQueue: new PromptQueue(),
  };
  // Sessions 模块集成:若 opts.sessionId 提供且 history 为空,尝试从新 sessions 模块加载
  // (兼容老 session.ts 模块:若老模块已加载 history,新模块不覆盖)
  if (opts.sessionId && state.history.length === 0) {
    const loaded = loadSessionState(opts.sessionId);
    if (loaded?.messages && Array.isArray(loaded.messages) && loaded.messages.length > 0) {
      state.history = loaded.messages.map((m) => ({ role: m.role, content: m.content }));
      console.info(chalk.dim(`  📂 已从 sessions 模块恢复 ${loaded.messages.length} 条消息`));
    } else if (opts.sessionId) {
      console.info(chalk.yellow(`  session not found: ${opts.sessionId},启动新会话`));
    }
  }
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

  // P2-2 公告系统:启用时异步拉取最新公告 + 显示未读横幅(失败静默,不阻塞 REPL)
  if (settings.announcements?.enabled === true) {
    void (async () => {
      try {
        const apiUrl = settings.announcements?.apiUrl ?? opts.apiUrl;
        const list = await getAnnouncements({ apiUrl, cacheTtlMs: settings.announcements?.cacheTtlMs });
        if (list.length === 0) return;
        const seen = loadSeenIds(getDefaultSeenPath());
        const banner = formatStartupBanner(list, seen);
        if (banner) {
          console.info(chalk.yellow(banner));
          console.info('');
        }
      } catch {
        // 公告拉取失败不影响 REPL 启动
      }
    })();
  }

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

  // P2-2 REPL Abort:注册 SIGINT handler
  // - agent 未运行:维持 Node 默认行为(打印 ^C,等下一次输入或第二次 SIGINT 退出)
  // - agent 运行中:abort + 中文提示,不杀进程
  // - 两次 SIGINT 间隔 < 1s:强杀退出(标准 SIGINT 退出码 130)
  const sigintHandler = createReplSigintHandler(state, {
    onForceExit: () => {
      console.info(chalk.red('\n⚠ 强制退出'));
      process.exit(130);
    },
    onAbort: () => {
      console.info(chalk.yellow('\n[正在取消当前任务,请稍候...]'));
    },
  });
  process.on('SIGINT', sigintHandler);

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
      state.interjectionBuffer.push(input);
      console.info(chalk.dim(`  ↳ 已追加到 interjection buffer(当前 ${state.interjectionBuffer.size()} 条),agent 下一轮处理`));
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
    // P2-2 REPL Abort:清理 SIGINT handler,避免内存泄漏
    process.off('SIGINT', sigintHandler);
    // 清理后台任务和 loop 定时器,避免僵尸进程
    clearAllLoops();
    clearAllTasks();
    runSessionEndHooks(hooksConfig, sessionHookCtx);
    // Sessions 模块集成:退出时持久化当前会话状态(静默保存,失败不影响退出)
    try {
      if (state.history.length > 0) {
        const now = new Date().toISOString();
        const stateId = newSessionId();
        saveSessionState({
          id: stateId,
          sessionId: state.session?.id ?? opts.sessionId ?? stateId,
          createdAt: now,
          updatedAt: now,
          model: opts.modelId,
          messages: state.history.map((m) => ({
            role: m.role as 'user' | 'assistant' | 'system' | 'tool',
            content: m.content,
          })),
          status: 'completed',
          cwd: opts.workspacePath,
        });
        console.info(chalk.dim(`session saved: ${stateId}`));
      }
    } catch {
      // 静默失败:session 保存失败不影响退出
    }
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

    case 'sessions': {
      // Sessions 模块集成:列出/恢复历史 session(从新 sessions 模块读取)
      const sub = args[0] ?? '';
      if (sub === 'resume') {
        const id = args[1] ?? '';
        if (!id) {
          console.info(chalk.yellow('用法: /sessions resume <id>'));
          break;
        }
        const loaded = loadSessionState(id);
        if (!loaded || !loaded.messages || loaded.messages.length === 0) {
          console.info(chalk.yellow(`未找到 session: ${id}(/sessions 查看可用列表)`));
          break;
        }
        state.history = loaded.messages.map((m) => ({ role: m.role, content: m.content }));
        if (state.session) {
          state.session.history = state.history;
          saveSession(state.session);
        }
        console.info(chalk.green(`✓ 已恢复 session ${id}(${loaded.messages.length} 条消息)`));
      } else {
        const list = listSessionStates();
        if (list.length === 0) {
          console.info(chalk.dim('暂无 sessions(退出 REPL 时自动保存)'));
        } else {
          console.info(chalk.cyan(`\n历史 sessions(${list.length} 条,显示前 10):`));
          for (const s of list.slice(0, 10)) {
            const time = new Date(s.updatedAt).toLocaleString();
            const loaded = loadSessionState(s.id);
            const msgCount = loaded?.messages?.length ?? 0;
            console.info(`  ${chalk.bold(s.id)}  ${chalk.dim(time)}  [${s.status}]  ${msgCount} 条消息`);
          }
          console.info(chalk.dim('  /sessions resume <id> 恢复指定 session'));
          console.info('');
        }
      }
      break;
    }

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
        const query = args.slice(1).join(' ').trim();
        if (!query) {
          console.info(chalk.yellow('用法: /memory search <关键词>'));
          break;
        }
        const entries = loadMemory(state.opts.workspacePath);
        if (entries.length === 0) {
          console.info(chalk.dim('  memory 为空,先用 /memory add <text> 添加'));
          break;
        }
        const provider = resolveEmbeddingProvider();
        const results = executeMemorySearch(entries, query, provider);
        if (results.length === 0) {
          console.info(chalk.dim(`  未找到匹配 "${query}" 的 memory`));
        } else {
          console.info(chalk.cyan(`  找到 ${results.length} 条匹配(hybrid search):`));
          for (const r of results) {
            const tag = r.source === 'global' ? '🌐' : '📁';
            const scoreStr = r.matchedBy === 'substring-fallback'
              ? ''
              : ` (score: ${r.score.toFixed(3)}, ${r.matchedBy})`;
            console.info(`  ${tag} [${r.category}] ${r.text}${scoreStr}`);
          }
        }
      } else {
        console.info(chalk.yellow('用法: /memory [on|off|show|add <text>|clear|search <关键词>]'));
      }
      break;
    }

    case 'todo': {
      // P0-9 TodoWrite 工具配套 slash 命令:显示/清除 todo 清单
      const sub = args[0] ?? 'show';
      if (sub === 'clear') {
        const todoPath = `${state.opts.workspacePath}/.ihui/todos.json`;
        try {
          const fs = await import('node:fs');
          if (fs.existsSync(todoPath)) {
            fs.unlinkSync(todoPath);
            console.info(chalk.green('✓ todo 清单已清空'));
          } else {
            console.info(chalk.dim('当前无 todo 清单文件'));
          }
        } catch {
          console.info(chalk.red('清空失败'));
        }
      } else if (sub === 'show') {
        const ctx = state.ctx ?? { workspacePath: state.opts.workspacePath };
        const todos = readTodoList(ctx);
        if (todos.length === 0) {
          console.info(chalk.dim('暂无 todo(Agent 可通过 todo_write 工具创建)'));
        } else {
          const inProgress = todos.filter((t) => t.status === 'in_progress').length;
          const completed = todos.filter((t) => t.status === 'completed').length;
          console.info(chalk.cyan(`\n📋 Todo 清单 (${todos.length} 项, ${inProgress} 进行中, ${completed} 已完成):`));
          const icons: Record<string, string> = { pending: '⏳', in_progress: '🚧', completed: '✅' };
          const priIcons: Record<string, string> = { high: '🔴', medium: '🟡', low: '🟢' };
          for (const t of todos) {
            console.info(`  ${icons[t.status]} ${priIcons[t.priority]} [${t.id}] ${t.content}`);
          }
          console.info('');
        }
      } else {
        console.info(chalk.yellow('用法: /todo [show|clear]'));
      }
      break;
    }

    case 'plugin': {
      // P1-4 Plugin Marketplace:委托 handlePluginMarketplaceCommand,受 settings.pluginMarketplace.enabled 控制
      const result = await handlePluginMarketplaceCommand(args);
      if (result.ok) {
        console.info(chalk.green(`✓ ${result.message}`));
      } else {
        console.info(chalk.yellow(result.message));
      }
      break;
    }

    case 'plan': {
      const sub = args[0] ?? 'show';
      if (sub === 'on') {
        state.opts.planFirst = true;
        state.planApproved = false;
        // 实例化 PlanMachine 直接进入 gathering 状态(写入被硬阻断)
        // 灵感来源:参考行业 Agent 框架的强制阻断式 Plan Mode(gathering 期间所有工具调用跳过)
        state.planMachine = new PlanMachine('gathering');
        console.info(chalk.green('✓ Plan Mode 已启用:LLM 必须先输出 plan 块再执行工具(PlanMachine: gathering,写入硬阻断)'));
      } else if (sub === 'off') {
        state.opts.planFirst = false;
        state.planApproved = false;
        // 销毁 PlanMachine(进入 initialized 终结态,无阻断)
        state.planMachine = undefined;
        console.info(chalk.green('✓ Plan Mode 已关闭'));
      } else if (sub === 'approve') {
        state.planApproved = true;
        // gathering → executing(写入允许)
        if (state.planMachine && state.planMachine.canTransition('gather_complete')) {
          state.planMachine.transition('gather_complete');
        }
        console.info(chalk.green('✓ Plan 已批准,后续工具调用将直接执行(PlanMachine: executing)'));
      } else if (sub === 'reject') {
        // 拒绝当前 plan:重置 planApproved,推入 user 消息要求 LLM 重新规划
        state.planApproved = false;
        // 重置 PlanMachine 回到 gathering(再次阻断写入)
        if (state.planMachine) {
          state.planMachine.reset();
          state.planMachine.transition('start');
        }
        const rejectMsg = '用户拒绝了上一个 plan,请重新规划任务步骤(输出 ```plan 代码块),再执行工具。';
        state.history.push({ role: 'user', content: rejectMsg });
        if (state.session) {
          state.session.history = state.history;
          saveSession(state.session);
        }
        console.info(chalk.yellow('✓ Plan 已拒绝,已要求 LLM 重新规划(PlanMachine: gathering,写入硬阻断)'));
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
        const machineState = state.planMachine ? state.planMachine.getCurrentState() : 'inactive';
        console.info(`Plan Mode: ${planState} (PlanMachine: ${machineState})`);
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

    case 'announcements':
    case 'announce': {
      await handleAnnouncements(args, state);
      break;
    }

    case 'voice': {
      await handleVoice(args, state);
      break;
    }

    case 'queue': {
      handleQueue(args, state);
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

/** P2-2 公告系统命令处理:/announcements [list|unread|read <id>|read-all|refresh] */
async function handleAnnouncements(args: string[], state: ReplState): Promise<void> {
  const settings = loadSettings();
  const flagEnabled = settings.announcements?.enabled === true;
  const apiUrl = settings.announcements?.apiUrl ?? state.opts.apiUrl;
  if (!flagEnabled) {
    console.info(chalk.dim('公告系统未启用(在 settings.announcements.enabled=true 开启)'));
    return;
  }
  const seenPath = getDefaultSeenPath();
  const sub = args[0] ?? 'list';
  const opts = { apiUrl, cacheTtlMs: settings.announcements?.cacheTtlMs };
  try {
    if (sub === 'refresh') {
      const list = await refreshAnnouncements(opts);
      const seen = loadSeenIds(seenPath);
      console.info(chalk.green(`✓ 已刷新,共 ${list.length} 条公告,未读 ${countUnread(list, seen)} 条`));
      return;
    }
    if (sub === 'read-all') {
      const list = await getAnnouncements(opts);
      markAllSeen(seenPath, list);
      console.info(chalk.green(`✓ 已将 ${list.length} 条公告标记为已读`));
      return;
    }
    if (sub === 'read') {
      const idx = args[1] ? Number(args[1]) : NaN;
      if (!Number.isFinite(idx) || idx < 1) {
        console.info(chalk.yellow('用法: /announcements read <序号>(先用 /announcements 查看序号)'));
        return;
      }
      const list = await getAnnouncements(opts);
      const target = list[idx - 1];
      if (!target) {
        console.info(chalk.yellow(`序号 ${idx} 超出范围(共 ${list.length} 条)`));
        return;
      }
      markSeen(seenPath, target.id);
      console.info(chalk.green(`✓ 已标记公告 #${idx} 为已读: ${target.title}`));
      return;
    }
    // list / unread / 无参数
    const onlyUnread = sub === 'unread';
    const list = await getAnnouncements(opts);
    if (list.length === 0) {
      console.info(chalk.dim('暂无公告(后端未返回或网络异常)'));
      return;
    }
    const seen = loadSeenIds(seenPath);
    console.info(formatAnnouncements(list, seen, { showOnlyUnread: onlyUnread }));
    console.info(chalk.dim('\n  /announcements read <序号>  标记已读'));
    console.info(chalk.dim('  /announcements read-all      全部标记已读'));
    console.info(chalk.dim('  /announcements refresh        强制刷新缓存'));
    console.info('');
  } catch {
    console.info(chalk.yellow('公告获取失败(请检查后端 API 是否可用)'));
  }
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

/**
 * P2-6 Voice STT 命令处理:/voice [秒数]
 *
 * 行为契约:
 * - settings.voice.enabled !== true 时提示未启用(零回归)
 * - 解析秒数参数(默认 settings.voice.durationSec 或 5)
 * - 检测 ffmpeg 可用性(不可用时友好提示安装)
 * - 调用 voiceInput({ durationSec, apiUrl, language }) 录音 + 转写
 * - 显示录音 + 转写结果
 * - 转写文本注入下一条 user 消息(进入 sendToAgent)
 *
 * 灵感来源:参考行业 Agent 框架的 voice input slash 命令。
 */
async function handleVoice(args: string[], state: ReplState): Promise<void> {
  const settings = loadSettings();
  const flagEnabled = settings.voice?.enabled === true;
  if (!flagEnabled) {
    console.info(chalk.dim('语音输入未启用(在 settings.voice.enabled=true 开启)'));
    return;
  }
  // 解析秒数参数:优先命令行参数,其次 settings,最后默认 5
  const argNum = args[0] ? Number(args[0]) : NaN;
  const durationSec = Number.isFinite(argNum) && argNum > 0
    ? Math.min(Math.floor(argNum), 60)  // 限制 1-60 秒
    : (settings.voice?.durationSec ?? 5);
  const apiUrl = settings.voice?.apiUrl ?? state.opts.apiUrl;
  const language = settings.voice?.language;

  // 检测 ffmpeg 可用性
  if (!checkMicrophoneAvailable()) {
    console.info(chalk.yellow('✗ 未检测到 ffmpeg(请先安装 ffmpeg 并加入 PATH)'));
    console.info(chalk.dim('  Windows: choco install ffmpeg'));
    console.info(chalk.dim('  macOS:   brew install ffmpeg'));
    console.info(chalk.dim('  Linux:   sudo apt install ffmpeg'));
    return;
  }

  console.info(chalk.cyan(`\n🎤 开始录音 ${durationSec} 秒(请对麦克风说话)...`));
  try {
    const result = await voiceInput({
      durationSec,
      apiUrl,
      language,
      apiKey: state.opts.apiKey,
    });
    console.info(chalk.green(formatRecordResult(result.record)));
    console.info(chalk.green(formatTranscribeResult(result.transcribe)));
    console.info(chalk.dim('\n  ↳ 转写文本将作为下一条 user 消息发送\n'));
    // 转写文本非空时注入 sendToAgent
    const text = result.text.trim();
    if (text.length > 0) {
      await sendToAgent(text, state);
    } else {
      console.info(chalk.yellow('转写结果为空,已跳过'));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.info(chalk.red(`✗ 语音输入失败: ${msg}`));
  }
}

/** P3-3 Prompt Queue:/queue 命令处理器 */
function handleQueue(args: string[], state: ReplState): void {
  const sub = args[0] ?? '';
  // /queue <prompt>  → 入队(子命令 list/clear/rm/help 之外的文本都视为 prompt)
  // /queue           → 显示队列(默认)
  // /queue list      → 显示队列(显式)
  // /queue clear     → 清空所有 pending
  // /queue rm <id>   → 取消指定 id 的 pending 项
  // /queue help      → 显示用法
  if (sub === '' || sub === 'list') {
    const items = state.promptQueue.snapshot();
    const pending = items.filter((it) => it.status === 'pending');
    const running = items.filter((it) => it.status === 'running');
    const done = items.filter((it) => it.status === 'completed' || it.status === 'cancelled');
    if (items.length === 0) {
      console.info(chalk.dim('队列为空(/queue <prompt> 排队新提示词)'));
      return;
    }
    console.info(chalk.cyan(`\n提示词队列(${items.length} 项, ${pending.length} pending, ${running.length} running, ${done.length} done):`));
    for (const it of items) {
      const statusLabel = formatQueueStatus(it);
      const preview = it.prompt.length > 50 ? `${it.prompt.slice(0, 50)}...` : it.prompt;
      console.info(`  ${chalk.bold(it.id)}  ${statusLabel}  ${chalk.dim(preview)}`);
    }
    console.info(chalk.dim('  /queue <prompt> 排队 | /queue rm <id> 取消 | /queue clear 清空'));
    console.info('');
    return;
  }
  if (sub === 'help') {
    console.info(chalk.cyan('\n/queue 用法:'));
    console.info(chalk.dim('  /queue <prompt>   排队新提示词(agent 完成后自动执行)'));
    console.info(chalk.dim('  /queue            显示队列'));
    console.info(chalk.dim('  /queue list       显示队列(同上)'));
    console.info(chalk.dim('  /queue rm <id>    取消指定 id 的 pending 项'));
    console.info(chalk.dim('  /queue clear      清空所有 pending 项'));
    console.info('');
    return;
  }
  if (sub === 'clear') {
    const before = state.promptQueue.size();
    state.promptQueue.cancel();
    console.info(chalk.green(`✓ 已取消 ${before} 个 pending 项`));
    return;
  }
  if (sub === 'rm') {
    const id = args[1] ?? '';
    if (!id) {
      console.info(chalk.yellow('用法: /queue rm <id>(/queue 查看可用 id)'));
      return;
    }
    const before = state.promptQueue.snapshot().find((it) => it.id === id);
    if (!before) {
      console.info(chalk.yellow(`未找到 id: ${id}(/queue 查看可用 id)`));
      return;
    }
    state.promptQueue.cancel(id);
    console.info(chalk.green(`✓ 已取消 ${id}`));
    return;
  }
  // 其他文本视为 prompt 入队
  const prompt = args.join(' ').trim();
  if (!prompt) {
    console.info(chalk.yellow('用法: /queue <prompt> | /queue list | /queue clear | /queue rm <id>'));
    return;
  }
  const item = state.promptQueue.enqueue(prompt);
  console.info(chalk.green(`✓ 已入队 [${item.id}](当前队列 ${state.promptQueue.size()} 项,agent 完成后自动执行)`));
}

/** 格式化队列项状态标签 */
function formatQueueStatus(it: PromptQueueItem): string {
  switch (it.status) {
    case 'pending':
      return chalk.yellow('⏳ pending');
    case 'running':
      return chalk.cyan('▶ running');
    case 'completed':
      return chalk.green('✓ completed');
    case 'cancelled':
      return chalk.dim('✗ cancelled');
    default:
      return chalk.dim(it.status);
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

async function sendToAgent(prompt: string, state: ReplState, depth = 0): Promise<void> {
  if (!state.agentReady) {
    const result = await setupAgentTools({
      workspacePath: state.opts.workspacePath,
      checkpoints: state.checkpoints ?? undefined,
      enableMcp: state.opts.enableMcp,
      silent: true,
      planFirst: state.opts.planFirst,
      permissions: state.opts.permissions,
      permissionMode: state.opts.permissionMode,
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
    state.pluginRegistry = result.pluginRegistry;
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

  // P2-2 删除原机制 1(formatForLLM 注入 system 消息):
  // 改为 drain 机制在 runToolLoop 循环内每轮注入(避免与 formatForLLM 双重注入)
  // drain 逻辑见下方 createDrainInterjections

  // Hook 埋点:userPromptSubmit(REPL 入口埋一次,避免与 agent.ts 重复)
  runHook('userPromptSubmit', {
    workspacePath: state.opts.workspacePath,
    sessionId: state.session?.id ?? state.opts.sessionId,
    prompt,
  });

  // P2-2 创建 AbortController,SIGINT handler 可调 .abort() 中止当前 agent 运行
  const controller = new AbortController();
  state.abortController = controller;
  state.aborted = false;
  state.agentRunning = true;

  // P2-2 恢复 drain 机制:从 InterjectionBuffer 弹出所有 pending,供 runToolLoop 循环内注入
  // 替代原 `() => []` 禁用代码:agent 循环内每轮调一次 drain,interjection 内容追加到 messages
  const drainInterjections = createDrainInterjections(state.interjectionBuffer);

  try {
    const result = await runToolLoop({
      modelId: state.opts.modelId,
      messages,
      ctx: state.ctx!,
      maxIterations: state.opts.maxIterations,
      sessionId: state.session?.id ?? state.opts.sessionId,
      signal: controller.signal,  // P2-2 传 signal,SIGINT 触发后 runToolLoop 内部响应 abort
      planFirst: state.opts.planFirst,
      planApproved: state.planApproved,
      planMachine: state.planMachine,
      plugins: state.pluginRegistry,
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
  } finally {
    // P2-2 确保无论成功/失败/中止都清理 abort 状态,避免泄漏到下次 sendToAgent
    state.agentRunning = false;
    state.abortController = null;
  }

  // P2-2 循环结束后自动消费所有 pending interjection(无论优先级)
  // 改进:原逻辑只消费 high/critical,normal/low 必须等用户再发新 prompt 才会被 formatForLLM 注入
  // 现在改为:所有 pending interjection 都自动消费,用 rewindStack 快照保证可回退
  // aborted 时停止消费(避免中止后继续触发新轮次,语义对齐 SIGINT 用户意图)
  // depth 限制防止无限递归(用户连续 push 的极端场景)
  await consumePendingInterjections(
    state,
    sendToAgent,
    depth,
    5,
    (priority, content) => {
      console.info(chalk.dim(`  ↳ 自动处理 [${priority}] interjection: ${content.slice(0, 50)}`));
    },
  );

  // P3-3 Prompt Queue drain:只在顶层(depth=0)执行,避免递归时重复 drain
  // aborted 时不 drain(语义对齐 SIGINT 用户意图:用户中止后剩余队列项保留,用户可 /queue 查看)
  if (depth === 0 && !state.aborted) {
    while (!state.aborted && state.promptQueue.size() > 0) {
      const next = state.promptQueue.dequeue();
      if (!next) break;
      const preview = next.prompt.length > 80 ? `${next.prompt.slice(0, 80)}...` : next.prompt;
      console.info(chalk.cyan(`\n▶ 执行队列 [${next.id}]: ${preview}`));
      try {
        await sendToAgent(next.prompt, state);
        state.promptQueue.complete(next.id);
      } catch {
        // sendToAgent 内部已处理错误,这里只标记完成避免无限重试
        state.promptQueue.complete(next.id);
      }
      // sendToAgent 不重置 state.aborted(只在 start 时重置),这里检查本次是否被中止
      if (state.aborted) {
        console.info(chalk.yellow(`⚠ 已中止,剩余 ${state.promptQueue.size()} 个队列项未执行(/queue 查看)`));
        break;
      }
    }
  }
}

