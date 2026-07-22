/**
 * ihui connect <url> — 作为 TUI client 连接远程 Agent server 的 WebSocket。
 * 复用 client/tui-client.ts(startTuiInteractive:readline 交互 + 流式渲染)。
 * 平台独占:仅 cli(W1-2 Client/Server 架构,对标 OpenCode 远程驱动)。
 */
import type { Command } from 'commander';
import chalk from 'chalk';
import { startTuiInteractive } from '../client/index.js';

interface ConnectOptions {
  token?: string;
}

export function registerConnectCommand(program: Command): void {
  program
    .command('connect <url>')
    .description('作为 TUI client 连接远程 Agent server 的 WebSocket')
    .option('--token <token>', '鉴权 token', process.env.IHUI_AGENT_TOKEN)
    .action(async (url: string, opts: ConnectOptions) => {
      try {
        await startTuiInteractive({ url, token: opts.token });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`连接失败: ${msg}`));
        process.exit(1);
      }
    });
}
