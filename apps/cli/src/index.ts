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
import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setBaseUrl, setTokenProvider } from '@ihui/api-client';
import { startREPL } from './commands/repl.js';
import { runAgent } from './commands/agent.js';
import {
  loadSession,
  getMostRecentSession,
  listSessions,
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
import { startAcpServer } from './acp/server.js';

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
  .option('--continue', '继续最近的会话');

interface ResolvedSession {
  sessionId?: string;
  history?: ChatMessage[];
}

function resolveSession(opts: Record<string, unknown>): ResolvedSession {
  if (opts.continue) {
    const session = getMostRecentSession();
    if (session) {
      console.info(chalk.dim(`恢复最近会话: ${session.id} (${session.history.length} 条历史)`));
      return { sessionId: session.id, history: session.history };
    }
    console.info(chalk.yellow('未找到历史会话, 将创建新会话'));
    return {};
  }
  if (opts.resume) {
    const session = loadSession(opts.resume as string);
    if (session) {
      console.info(chalk.dim(`恢复会话: ${session.id} (${session.history.length} 条历史)`));
      return { sessionId: session.id, history: session.history };
    }
    console.info(chalk.red(`未找到会话: ${opts.resume}`));
    process.exit(1);
  }
  return {};
}

program.hook('preAction', () => {
  const opts = program.opts();
  if (typeof opts.apiUrl === 'string') {
    setBaseUrl(opts.apiUrl);
  }
  const apiKey = typeof opts.apiKey === 'string' ? opts.apiKey : '';
  if (apiKey) {
    if (process.env.IHUI_API_KEY !== apiKey) {
      console.warn(chalk.yellow('⚠ --api-key 会暴露在进程列表中,推荐使用 IHUI_API_KEY 环境变量'));
    }
    setTokenProvider({ getToken: () => apiKey });
  }
});

// 默认命令: 交互式 REPL 或直接执行任务
program
  .argument('[prompt]', '直接执行的任务 (省略则进入 REPL)')
  .action(async (prompt: string | undefined) => {
    const opts = program.opts();
    const session = resolveSession(opts);
    if (prompt) {
      await runAgent({
        prompt,
        modelId: opts.model,
        workspacePath: opts.workspace,
        apiUrl: opts.apiUrl,
        apiKey: opts.apiKey,
        maxIterations: parseInt(opts.maxIterations, 10),
      });
    } else {
      await startREPL({
        modelId: opts.model,
        workspacePath: opts.workspace,
        apiUrl: opts.apiUrl,
        apiKey: opts.apiKey,
        maxIterations: parseInt(opts.maxIterations, 10),
        sessionId: session.sessionId,
        history: session.history,
      });
    }
  });

// chat 子命令
program
  .command('chat')
  .description('进入对话模式 (多轮)')
  .action(async () => {
    const opts = program.opts();
    const session = resolveSession(opts);
    await startREPL({
      modelId: opts.model,
      workspacePath: opts.workspace,
      apiUrl: opts.apiUrl,
      apiKey: opts.apiKey,
      maxIterations: parseInt(opts.maxIterations, 10),
      sessionId: session.sessionId,
      history: session.history,
    });
  });

// agent 子命令
program
  .command('agent <task>')
  .description('Agent 模式: 自主多步执行任务')
  .action(async (task: string) => {
    const opts = program.opts();
    await runAgent({
      prompt: task,
      modelId: opts.model,
      workspacePath: opts.workspace,
      apiUrl: opts.apiUrl,
      apiKey: opts.apiKey,
      maxIterations: parseInt(opts.maxIterations, 10),
    });
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
      console.info(chalk.dim('暂无历史会话'));
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

// acp 子命令 — 启动 ACP (Agent Client Protocol) server,供编辑器嵌入
program
  .command('acp')
  .description('启动 ACP (Agent Client Protocol) server,供 Zed/VSCode/Cursor 等编辑器嵌入')
  .action(async () => {
    const opts = program.opts();
    const connection = startAcpServer({
      apiUrl: opts.apiUrl,
      apiKey: opts.apiKey,
      modelId: opts.model,
      maxIterations: parseInt(opts.maxIterations, 10),
    });
    process.on('SIGINT', () => connection.close());
    process.on('SIGTERM', () => connection.close());
    await connection.closed;
  });

program.parse();
