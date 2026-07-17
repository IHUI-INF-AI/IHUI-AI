#!/usr/bin/env node

/**
 * IHUI AI Coding Agent CLI 入口
 * 用法:
 *   ihui                          # 交互式 REPL
 *   ihui "修复 bug"               # 直接执行任务
 *   ihui --model gpt-4o "..."     # 指定模型
 *   ihui agent "重构 auth 模块"   # Agent 模式
 *   ihui init                     # 创建 AGENTS.md 模板
 *   ihui mcp list                 # 列出 MCP 服务器
 *   ihui sessions                 # 列出历史会话
 */

import 'dotenv/config';
import { Command, type OptionValues } from 'commander';
import chalk from 'chalk';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { setBaseUrl, setTokenProvider } from '@ihui/api-client';
import { startREPL } from './commands/repl.js';
import { runAgent, stopReasonToExitCode, parseOutputFormat } from './commands/agent.js';
import { loadSkills, findSkill } from './skills/index.js';
import {
  loadSession,
  getMostRecentSession,
  listSessions,
  createSession,
  type ChatMessage,
} from './commands/session.js';
import { writeAgentsMd, agentsMdExists } from './commands/template.js';
import {
  loadMcpConfig,
  addMcpServer,
  removeMcpServer,
  getMcpConfigPath,
} from './commands/mcp-config.js';
import { registerCapabilitiesCommand } from './commands/capabilities.js';
import { registerCheckpointCommand } from './commands/checkpoint.js';
import { registerHooksCommand } from './commands/hooks.js';
import { startAcpServer } from './acp/server.js';
import { CheckpointManager } from './checkpoints/index.js';
import {
  resolveEffectiveConfig,
  saveSettingsTemplate,
  getSettingsPath,
} from './commands/settings.js';
import { queryAuditLog } from './audit.js';
import { t } from './i18n/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
) as { version: string };

const program = new Command();

program
  .name('ihui')
  .description('IHUI AI Coding Agent — 对标 Claude Code / Codex')
  .version(pkg.version)
  .option('-m, --model <model_id>', '模型 ID', 'default')
  .option('-w, --workspace <path>', '工作区路径', process.cwd())
  .option('--max-iterations <n>', '最大工具循环次数', '25')
  .option('--api-url <url>', '后端 API 地址', process.env.IHUI_API_URL || 'http://localhost:8000')
  .option('--api-key <key>', 'API 密钥', process.env.IHUI_API_KEY || '')
  .option('--resume <session-id>', '恢复之前的会话')
  .option('--continue', '继续最近的会话')
  .option('--json', 'Headless 模式:输出 NDJSON 事件流 (非 TTY 自动启用,CI/CD 友好)')
  .option('--output-format <format>', 'P1-5 Headless 输出格式: text|json|markdown|yaml (覆盖 --json,默认 text)')
  .option('--mcp', '启用 MCP 工具(从 ~/.ihui/mcp.json 加载 MCP 服务器工具)')
  .option('--allow-dangerous', '允许危险工具(run_command/delete_file/git_commit)自动执行,无需确认(默认拒绝,REPL 模式下交互确认)')
  .option('--plan', '强制 Agent 先输出任务规划(plan 块)再执行工具(长任务推荐)')
  .option('--temperature <num>', 'LLM 温度(0-2,代码任务推荐 0.2,创意任务推荐 0.7)')
  .option('--max-tokens <num>', '最大生成 token 数')
  .option('-f, --prompt-file <path>', '从文件读取 prompt(支持超长 PRD,UTF-8 编码)');

interface ResolvedSession {
  sessionId?: string;
  history?: ChatMessage[];
}

function resolveSession(opts: Record<string, unknown>): ResolvedSession {
  if (opts.continue) {
    const session = getMostRecentSession();
    if (session) {
      console.info(
        chalk.dim(
          t('cli.sessionResumed', { id: session.id, count: session.history.length }),
        ),
      );
      return { sessionId: session.id, history: session.history };
    }
    console.info(chalk.yellow(t('cli.noSessions')));
    return {};
  }
  if (opts.resume) {
    const session = loadSession(opts.resume as string);
    if (session) {
      console.info(chalk.dim(`恢复会话: ${session.id} (${session.history.length} 条历史)`));
      return { sessionId: session.id, history: session.history };
    }
    console.info(chalk.red(t('common.notFound', { target: opts.resume as string })));
    process.exit(1);
  }
  return {};
}

function resolveJsonMode(opts: OptionValues): boolean {
  return opts.json === true || !process.stdout.isTTY;
}

export function readPromptFile(
  filePath: string,
): { ok: true; content: string } | { ok: false; error: string } {
  try {
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      return { ok: false, error: `路径是目录,不是文件: ${filePath}` };
    }
    const raw = readFileSync(filePath, 'utf-8');
    const content = raw.trim();
    if (content.length === 0) {
      return { ok: false, error: `文件内容为空: ${filePath}` };
    }
    return { ok: true, content };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ok: false, error: `文件不存在: ${filePath}` };
    }
    return { ok: false, error: `读取文件失败: ${(err as Error).message}` };
  }
}

function resolvePrompt(
  positional: string | undefined,
  opts: OptionValues,
): string | undefined {
  if (!opts.promptFile) {
    return positional;
  }
  const result = readPromptFile(opts.promptFile as string);
  if (!result.ok) {
    console.error(chalk.red(`--prompt-file 错误: ${result.error}`));
    process.exit(1);
  }
  if (positional) {
    console.warn(
      chalk.yellow('⚠ 同时传了 positional prompt 和 --prompt-file,优先使用 --prompt-file'),
    );
  }
  return result.content;
}

async function runAgentAndExit(
  prompt: string,
  opts: OptionValues,
  jsonMode: boolean,
): Promise<void> {
  const cfg = resolveEffectiveConfig({
    cliApiUrl: typeof opts.apiUrl === 'string' ? opts.apiUrl : undefined,
    cliApiKey: typeof opts.apiKey === 'string' ? opts.apiKey : undefined,
    cliModel: typeof opts.model === 'string' ? opts.model : undefined,
    cliMaxIterations: typeof opts.maxIterations === 'string' ? opts.maxIterations : undefined,
    cliAllowDangerous: opts.allowDangerous === true ? true : undefined,
    cliPlan: opts.plan === true ? true : undefined,
    cliMcp: opts.mcp === true ? true : undefined,
    cliTemperature: typeof opts.temperature === 'string' ? opts.temperature : undefined,
    cliMaxTokens: typeof opts.maxTokens === 'string' ? opts.maxTokens : undefined,
  });
  const abort = new AbortController();
  let session: ReturnType<typeof createSession> | null = null;
  const onSigint = (): void => {
    if (!abort.signal.aborted) {
      abort.abort();
      if (session && !jsonMode) {
        console.info(chalk.yellow('\n⚠ 中断中,正在保存会话...'));
      }
    }
  };
  process.on('SIGINT', onSigint);
  try {
    session = createSession(opts.workspace, cfg.model);
    // 如果 --resume/--continue,加载历史到 session.history
    const resumed = resolveSession(opts);
    if (resumed.sessionId && resumed.history) {
      session.id = resumed.sessionId;
      session.history = resumed.history;
    }
    const checkpoints = new CheckpointManager({
      sessionId: session.id,
      workspacePath: opts.workspace,
    });
    const result = await runAgent({
      prompt,
      modelId: cfg.model,
      workspacePath: opts.workspace,
      apiUrl: cfg.apiUrl,
      apiKey: cfg.apiKey,
      maxIterations: cfg.maxIterations,
      jsonMode,
      outputFormat: opts.outputFormat ? parseOutputFormat(opts.outputFormat) : undefined,
      checkpoints,
      enableMcp: cfg.enableMcp,
      allowDangerous: cfg.allowDangerous,
      session,
      signal: abort.signal,
      planFirst: cfg.planFirst,
      sampler: cfg.sampler,
    });
    process.exitCode = stopReasonToExitCode(result.stopReason);
  } finally {
    process.off('SIGINT', onSigint);
  }
}

program.hook('preAction', () => {
  const opts = program.opts();
  const cfg = resolveEffectiveConfig({
    cliApiUrl: typeof opts.apiUrl === 'string' ? opts.apiUrl : undefined,
    cliApiKey: typeof opts.apiKey === 'string' ? opts.apiKey : undefined,
  });
  setBaseUrl(cfg.apiUrl);
  if (cfg.apiKey) {
    if (opts.apiKey && process.env.IHUI_API_KEY !== opts.apiKey) {
      console.warn(chalk.yellow('⚠ --api-key 会暴露在进程列表中,推荐使用 IHUI_API_KEY 环境变量或 settings.json'));
    }
    setTokenProvider({ getToken: () => cfg.apiKey });
  }
});

// 默认命令: 交互式 REPL 或直接执行任务
program
  .argument('[prompt]', '直接执行的任务 (省略则进入 REPL)')
  .action(async (prompt: string | undefined) => {
    const opts = program.opts();
    const effectivePrompt = resolvePrompt(prompt, opts);
    if (effectivePrompt) {
      const jsonMode = resolveJsonMode(opts);
      await runAgentAndExit(effectivePrompt, opts, jsonMode);
    } else {
      const cfg = resolveEffectiveConfig({
        cliApiUrl: typeof opts.apiUrl === 'string' ? opts.apiUrl : undefined,
        cliApiKey: typeof opts.apiKey === 'string' ? opts.apiKey : undefined,
        cliModel: typeof opts.model === 'string' ? opts.model : undefined,
        cliMaxIterations: typeof opts.maxIterations === 'string' ? opts.maxIterations : undefined,
        cliAllowDangerous: opts.allowDangerous === true ? true : undefined,
    cliPlan: opts.plan === true ? true : undefined,
    cliMcp: opts.mcp === true ? true : undefined,
      });
      const session = resolveSession(opts);
      await startREPL({
        modelId: cfg.model,
        workspacePath: opts.workspace,
        apiUrl: cfg.apiUrl,
        apiKey: cfg.apiKey,
        maxIterations: cfg.maxIterations,
        sessionId: session.sessionId,
        history: session.history,
        enableMcp: cfg.enableMcp,
        allowDangerous: cfg.allowDangerous,
        planFirst: cfg.planFirst,
      });
    }
  });

// chat 子命令
program
  .command('chat')
  .description('进入对话模式 (多轮)')
  .action(async () => {
    const opts = program.opts();
    const cfg = resolveEffectiveConfig({
      cliApiUrl: typeof opts.apiUrl === 'string' ? opts.apiUrl : undefined,
      cliApiKey: typeof opts.apiKey === 'string' ? opts.apiKey : undefined,
      cliModel: typeof opts.model === 'string' ? opts.model : undefined,
      cliMaxIterations: typeof opts.maxIterations === 'string' ? opts.maxIterations : undefined,
      cliAllowDangerous: opts.allowDangerous === true ? true : undefined,
      cliMcp: opts.mcp === true ? true : undefined,
    });
    const session = resolveSession(opts);
    await startREPL({
      modelId: cfg.model,
      workspacePath: opts.workspace,
      apiUrl: cfg.apiUrl,
      apiKey: cfg.apiKey,
      maxIterations: cfg.maxIterations,
      sessionId: session.sessionId,
      history: session.history,
      enableMcp: cfg.enableMcp,
      allowDangerous: cfg.allowDangerous,
      planFirst: cfg.planFirst,
    });
  });

// agent 子命令
program
  .command('agent [task]')
  .description('Agent 模式: 自主多步执行任务 (支持 --json headless 模式,可用 --prompt-file 传入超长 prompt)')
  .action(async (task: string | undefined) => {
    const opts = program.opts();
    const effectiveTask = resolvePrompt(task, opts);
    if (!effectiveTask) {
      console.error(chalk.red('用法: ihui agent <task>  或  ihui agent --prompt-file <path>'));
      process.exit(1);
    }
    const jsonMode = resolveJsonMode(opts);
    await runAgentAndExit(effectiveTask, opts, jsonMode);
  });

// init 子命令
program
  .command('init')
  .description('在当前目录创建 AGENTS.md 模板')
  .option('-f, --force', '覆盖已存在的文件')
  .action(async (options: { force?: boolean }) => {
    const workspace = process.cwd();
    if (agentsMdExists(workspace) && !options.force) {
      console.info(chalk.yellow('AGENTS.md 已存在。使用 --force 覆盖。'));
      process.exit(1);
    }
    writeAgentsMd(workspace);
    console.info(chalk.green(`已创建: ${join(workspace, 'AGENTS.md')}`));
  });

// sessions 子命令
program
  .command('sessions')
  .description('列出历史会话')
  .action(() => {
    const sessions = listSessions();
    if (sessions.length === 0) {
      console.info(chalk.dim(t('cli.noSessions')));
      return;
    }
    console.info(chalk.cyan('\n历史会话:'));
    for (const s of sessions) {
      const time = new Date(s.updatedAt).toLocaleString();
      console.info(`  ${chalk.bold(s.id)}  ${chalk.dim(time)}`);
      console.info(`    工作区: ${s.workspacePath}  模型: ${s.modelId}  历史: ${s.history.length} 条`);
    }
    console.info('');
  });

// mcp 子命令组
const mcpCmd = program.command('mcp').description('MCP 服务器管理');

mcpCmd
  .command('list')
  .description('列出已配置的 MCP 服务器')
  .action(() => {
    const config = loadMcpConfig();
    if (config.servers.length > 0) {
      console.info(chalk.cyan('\n本地 MCP 服务器配置:'));
      console.info(chalk.dim(`  配置文件: ${getMcpConfigPath()}`));
      for (const s of config.servers) {
        const transport = s.transport ?? 'stdio';
        if (transport === 'stdio') {
          const argStr = s.args && s.args.length > 0 ? ' ' + s.args.join(' ') : '';
          console.info(`  ${chalk.bold(s.name)} [${transport}]: ${s.command ?? ''}${argStr}`);
        } else {
          console.info(`  ${chalk.bold(s.name)} [${transport}]: ${s.url ?? ''}`);
        }
      }
    } else {
      console.info(chalk.dim('\n本地无 MCP 服务器配置'));
      console.info(chalk.dim(`  配置文件: ${getMcpConfigPath()}`));
    }
  });

mcpCmd
  .command('add [name] [command]')
  .description('添加 MCP 服务器配置')
  .option('-a, --args <args...>', '命令参数 (stdio)')
  .option('-t, --transport <transport>', '传输类型: stdio|http|sse', 'stdio')
  .option('-u, --url <url>', 'http/sse 端点 URL')
  .option('--token <token>', 'bearer 认证 token')
  .action(
    (
      name: string | undefined,
      command: string | undefined,
      options: { args?: string[]; transport?: 'stdio' | 'http' | 'sse'; url?: string; token?: string },
    ) => {
      if (!name) {
        console.info(chalk.red('用法: ihui mcp add <name> [command] [-t stdio|http|sse] [-u url]'));
        process.exit(1);
      }
      const auth =
        options.token ? { type: 'bearer' as const, token: options.token } : undefined;
      const server = addMcpServer(name, command, options.args, {
        transport: options.transport,
        url: options.url,
        auth,
      });
      console.info(chalk.green(`已添加 MCP 服务器: ${server.name}`));
      console.info(`  传输: ${server.transport}`);
      if (server.transport === 'stdio') {
        console.info(`  命令: ${server.command ?? ''}`);
      } else {
        console.info(`  URL: ${server.url ?? ''}`);
      }
      console.info(chalk.dim(`  配置文件: ${getMcpConfigPath()}`));
    },
  );

mcpCmd
  .command('remove <name>')
  .description('移除 MCP 服务器配置')
  .action((name: string) => {
    if (removeMcpServer(name)) {
      console.info(chalk.green(`已移除 MCP 服务器: ${name}`));
    } else {
      console.info(chalk.red(`未找到 MCP 服务器: ${name}`));
      process.exit(1);
    }
  });

// capabilities 子命令组
registerCapabilitiesCommand(program);

// checkpoint 子命令组
registerCheckpointCommand(program);

// hooks 子命令组
registerHooksCommand(program);

// skills 子命令 — 列出/查看已加载的 skills(从 .ihui/.agents/.claude/.cursor/skills 平面加载)
const skillsCmd = program.command('skills').description('管理/查看 skills(.ihui/skills/*.md 等四级目录平面加载)');

skillsCmd
  .command('list')
  .description('列出当前工作区已加载的 skills')
  .action(() => {
    const skills = loadSkills({ cwd: process.cwd() });
    if (skills.length === 0) {
      console.info(chalk.dim('暂无 skills(可在以下目录创建 *.md 文件):'));
      console.info(chalk.dim('  <cwd>/.ihui/skills/   <cwd>/.agents/skills/   <cwd>/.claude/skills/   <cwd>/.cursor/skills/'));
      console.info(chalk.dim('  <repo-root>/.ihui/skills/ ...   ~/.ihui/skills/'));
      return;
    }
    console.info(chalk.cyan(`\n已加载 ${skills.length} 个 skill:`));
    for (const s of skills) {
      console.info(`  ${chalk.bold(s.name)} — ${chalk.dim(s.description)}`);
      console.info(chalk.dim(`    来源: ${s.source}`));
    }
    console.info('');
  });

skillsCmd
  .command('show <name>')
  .description('查看指定 skill 的内容')
  .action((name: string) => {
    const skills = loadSkills({ cwd: process.cwd() });
    const skill = findSkill(skills, name);
    if (!skill) {
      console.info(chalk.red(`未找到 skill: ${name}`));
      process.exit(1);
    }
    console.info(chalk.cyan(`# ${skill.name}`));
    console.info(chalk.dim(`来源: ${skill.source}`));
    console.info(chalk.dim(`描述: ${skill.description}\n`));
    console.info(skill.body);
  });

// settings 子命令组
const settingsCmd = program.command('settings').description('管理 ~/.ihui/settings.json 统一配置');

settingsCmd
  .command('init')
  .description('创建 settings.json 模板(已存在时需 --force 覆盖)')
  .option('-f, --force', '覆盖已存在的文件')
  .action((options: { force?: boolean }) => {
    const created = saveSettingsTemplate(options.force === true);
    if (created) {
      console.info(chalk.green(`已创建配置模板: ${getSettingsPath()}`));
      console.info(chalk.dim('编辑该文件设置默认值,CLI flag 优先级最高'));
    } else {
      console.info(chalk.yellow(`配置文件已存在: ${getSettingsPath()}`));
      console.info(chalk.dim('使用 --force 覆盖'));
    }
  });

settingsCmd
  .command('path')
  .description('显示 settings.json 路径')
  .action(() => {
    console.info(getSettingsPath());
  });

// acp 子命令 — 启动 ACP (Agent Client Protocol) server,供编辑器嵌入
program
  .command('acp')
  .description('启动 ACP (Agent Client Protocol) server,供 Zed/VSCode/Cursor 等编辑器嵌入')
  .action(async () => {
    const opts = program.opts();
    const cfg = resolveEffectiveConfig({
      cliApiUrl: typeof opts.apiUrl === 'string' ? opts.apiUrl : undefined,
      cliApiKey: typeof opts.apiKey === 'string' ? opts.apiKey : undefined,
      cliModel: typeof opts.model === 'string' ? opts.model : undefined,
      cliMaxIterations: typeof opts.maxIterations === 'string' ? opts.maxIterations : undefined,
      cliAllowDangerous: opts.allowDangerous === true ? true : undefined,
      cliMcp: opts.mcp === true ? true : undefined,
    });
    const connection = startAcpServer({
      apiUrl: cfg.apiUrl,
      apiKey: cfg.apiKey,
      modelId: cfg.model,
      maxIterations: cfg.maxIterations,
      enableMcp: cfg.enableMcp,
      allowDangerous: cfg.allowDangerous,
      planFirst: cfg.planFirst,
    });
    process.on('SIGINT', () => connection.close());
    process.on('SIGTERM', () => connection.close());
    await connection.closed;
  });

// audit 子命令组 — 查询/过滤审计日志(~/.ihui/audit.jsonl)
const auditCmd = program.command('audit').description('查询/过滤审计日志');

auditCmd
  .command('query')
  .description('查询审计日志(支持按工具名/时间/成功状态过滤)')
  .option('-t, --tool <name>', '按工具名过滤(子串匹配,大小写不敏感)')
  .option('-s, --since <time>', '起始时间(ISO 字符串或相对时间如 1h/30m/1d)')
  .option('--success', '只显示成功的调用')
  .option('--failure', '只显示失败的调用')
  .option('-l, --limit <n>', '返回条数上限(默认 50)', '50')
  .option('--json', '以 JSON 格式输出(便于管道处理)')
  .action((options: {
    tool?: string;
    since?: string;
    success?: boolean;
    failure?: boolean;
    limit?: string;
    json?: boolean;
  }) => {
    const success = options.success === true
      ? true
      : options.failure === true
        ? false
        : undefined;
    const limit = parseInt(options.limit ?? '50', 10);
    const result = queryAuditLog({
      tool: options.tool,
      since: options.since,
      success,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 50,
    });

    if (options.json) {
      console.info(JSON.stringify(result, null, 2));
      return;
    }

    if (result.entries.length === 0) {
      console.info(chalk.dim('无匹配的审计日志(总共 ' + result.total + ' 条)'));
      return;
    }

    console.info(chalk.cyan(`\n📋 审计日志(显示 ${result.entries.length} / 匹配 ${result.filtered} / 总共 ${result.total} 条):`));
    for (const e of result.entries) {
      const icon = e.success === false ? '✗' : e.success === true ? '✓' : '?';
      const iconColor = e.success === false ? chalk.red(icon) : e.success === true ? chalk.green(icon) : chalk.dim(icon);
      const ts = new Date(e.timestamp).toLocaleString('zh-CN', { hour12: false });
      const duration = e.durationMs !== undefined ? chalk.dim(` ${e.durationMs}ms`) : '';
      console.info(`  ${iconColor} ${ts} ${chalk.bold(e.tool)}${duration}`);
      if (e.error) {
        console.info(chalk.dim(`    error: ${e.error.slice(0, 120)}`));
      }
    }
    console.info('');
  });

auditCmd
  .command('stats')
  .description('统计审计日志(按工具名/成功失败聚合)')
  .option('-s, --since <time>', '起始时间(ISO 字符串或相对时间如 1h/30m/1d)')
  .action((options: { since?: string }) => {
    const result = queryAuditLog({ since: options.since, limit: 100_000 });

    if (result.total === 0) {
      console.info(chalk.dim('审计日志为空'));
      return;
    }

    const stats = new Map<string, { total: number; success: number; failure: number }>();
    for (const e of result.entries) {
      const s = stats.get(e.tool) ?? { total: 0, success: 0, failure: 0 };
      s.total++;
      if (e.success === true) s.success++;
      else if (e.success === false) s.failure++;
      stats.set(e.tool, s);
    }

    console.info(chalk.cyan(`\n📊 审计统计(总共 ${result.total} 条,匹配 ${result.filtered} 条):`));
    console.info(`  ${'工具'.padEnd(25)} ${'总数'.padStart(8)} ${'成功'.padStart(8)} ${'失败'.padStart(8)} ${'成功率'.padStart(8)}`);
    for (const [tool, s] of [...stats.entries()].sort((a, b) => b[1].total - a[1].total)) {
      const rate = s.total > 0 ? ((s.success / s.total) * 100).toFixed(1) + '%' : 'N/A';
      console.info(`  ${tool.padEnd(25)} ${String(s.total).padStart(8)} ${String(s.success).padStart(8)} ${String(s.failure).padStart(8)} ${rate.padStart(8)}`);
    }
    console.info('');
  });

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  program.parse();
}
