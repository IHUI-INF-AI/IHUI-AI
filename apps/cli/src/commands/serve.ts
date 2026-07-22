/**
 * ihui serve — 启动 Agent 内核 HTTP/WS server,支持远程驱动。
 * 端口 8841(strictPort:占用即失败,不回退到其他端口)。
 * GET /health 返回 200;WS 桥 /ws 推送实时事件。
 * 复用 server/http-server.ts(node:http 创建 server)+ server/ws-bridge.ts(WS 桥)。
 * 平台独占:仅 cli(W1-2 Client/Server 架构,对标 OpenCode client/server)。
 */
import type { Command } from 'commander';
import chalk from 'chalk';
import { AgentCore, startAgentServer, attachWsBridge } from '../server/index.js';

interface ServeOptions {
  port: string;
  workspace: string;
  model: string;
  apiUrl: string;
  apiKey: string;
  token?: string;
}

export function registerServeCommand(program: Command): void {
  program
    .command('serve')
    .description('启动 Agent 内核 HTTP/WS server,支持远程驱动(端口 8841,strictPort)')
    .option('-p, --port <port>', '端口(strictPort,占用即失败不回退)', '8841')
    .option('-w, --workspace <path>', '工作区路径', process.cwd())
    .option('-m, --model <model>', '模型 ID', 'default')
    .option('--api-url <url>', '后端 API 地址', process.env.IHUI_API_URL || 'http://localhost:8803')
    .option('--api-key <key>', 'API 密钥', process.env.IHUI_API_KEY || '')
    .option('--token <token>', '鉴权 Bearer token', process.env.IHUI_AGENT_TOKEN)
    .action(async (opts: ServeOptions) => {
      const port = parseInt(opts.port, 10);
      if (!Number.isFinite(port) || port <= 0 || port > 65535) {
        console.error(chalk.red(`无效端口: ${opts.port}`));
        process.exit(1);
      }
      const core = new AgentCore({
        workspacePath: opts.workspace,
        model: opts.model,
        apiUrl: opts.apiUrl,
        apiKey: opts.apiKey || undefined,
      });
      try {
        const handle = await startAgentServer(core, { port, token: opts.token });
        await attachWsBridge(core, { server: handle.server, token: opts.token });
        console.info(chalk.green(`✓ IHUI Agent server listening on http://localhost:${port}`));
        console.info(chalk.dim('  GET  /health       健康检查'));
        console.info(chalk.dim('  POST /message      SSE 流式对话'));
        console.info(chalk.dim('  WS   /ws           WebSocket 实时事件桥'));
        console.info(chalk.dim('  Ctrl+C 停止'));
        const shutdown = async (): Promise<void> => {
          try {
            await handle.close();
          } catch {
            // ignore close errors
          }
          process.exit(0);
        };
        process.on('SIGINT', () => void shutdown());
        process.on('SIGTERM', () => void shutdown());
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`✗ 启动失败(端口 ${port} 可能被占用): ${msg}`));
        process.exit(1);
      }
    });
}
