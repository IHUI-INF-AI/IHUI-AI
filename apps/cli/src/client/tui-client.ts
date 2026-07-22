/**
 * TUI client — 连接远程 Agent server(WebSocket),发送消息,渲染流式响应。
 *
 * 用 createRequire 动态加载 ws 包(Node 内置 WebSocket 全局为浏览器风格 API,与本实现不兼容),
 * 运行时若 ws 包未安装,connectToServer 抛出友好错误。
 *
 * 交互模式:startTuiInteractive 启动 readline 循环,输入 /quit 退出。
 */

import { createRequire } from 'node:module';
import * as readline from 'node:readline';
import chalk from 'chalk';
import type { AgentEvent } from '../server/agent-core.js';

const dynamicRequire = createRequire(import.meta.url);

interface WsClientSocket {
  readyState: number;
  send(data: string): void;
  close(): void;
  on(event: 'message', listener: (data: Buffer) => void): void;
  on(event: 'open', listener: () => void): void;
  on(event: 'close', listener: () => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
}

type WsClientCtor = new (url: string) => WsClientSocket;

export interface TuiClientOptions {
  url: string;
  token?: string;
}

export interface TuiClient {
  send(text: string): Promise<void>;
  on(event: 'event', cb: (event: AgentEvent) => void): void;
  close(): void;
}

function loadWsClient(): WsClientCtor | null {
  try {
    const mod = dynamicRequire('ws') as { WebSocket?: WsClientCtor };
    return mod.WebSocket ?? null;
  } catch {
    return null;
  }
}

export async function connectToServer(opts: TuiClientOptions): Promise<TuiClient> {
  const WsCtor = loadWsClient();
  if (!WsCtor) {
    throw new Error(
      'ws 包未安装,TUI client 无法启动。请运行:pnpm --filter @ihui/cli add ws && pnpm --filter @ihui/cli add -D @types/ws',
    );
  }

  const wsUrl = new URL(opts.url);
  if (opts.token) {
    wsUrl.searchParams.set('token', opts.token);
  }

  const ws = new WsCtor(wsUrl.toString());
  const handlers = new Set<(event: AgentEvent) => void>();
  const pendingResolvers: Array<() => void> = [];

  return new Promise<TuiClient>((resolve, reject) => {
    ws.on('open', () => {
      resolve({
        send: (text: string) =>
          new Promise<void>((res) => {
            pendingResolvers.push(res);
            ws.send(JSON.stringify({ type: 'message', text }));
          }),
        on: (_event: 'event', cb: (event: AgentEvent) => void) => {
          handlers.add(cb);
        },
        close: () => {
          try {
            ws.close();
          } catch {
            // ignore
          }
        },
      });
    });

    ws.on('error', (err: Error) => {
      reject(err);
    });

    ws.on('message', (data: Buffer) => {
      try {
        const raw = JSON.parse(data.toString('utf-8')) as { type: string } & Record<string, unknown>;
        for (const cb of handlers) cb(raw as AgentEvent);
        if (raw.type === 'done' || raw.type === 'error' || raw.type === 'result') {
          const r = pendingResolvers.shift();
          if (r) r();
        }
      } catch {
        // ignore invalid JSON
      }
    });

    ws.on('close', () => {
      for (const r of pendingResolvers) r();
      pendingResolvers.length = 0;
    });
  });
}

export async function startTuiInteractive(opts: TuiClientOptions): Promise<void> {
  const client = await connectToServer(opts);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  client.on('event', (event) => {
    switch (event.type) {
      case 'token':
        process.stdout.write(event.text);
        break;
      case 'tool_call':
        process.stdout.write(chalk.cyan(`\n  🔧 ${event.name} ${JSON.stringify(event.args)}\n`));
        break;
      case 'tool_result':
        process.stdout.write(
          chalk.dim(`  ${event.success ? '✓' : '✗'} ${event.output.slice(0, 200)}\n`),
        );
        break;
      case 'iteration':
        process.stdout.write(chalk.dim(`\n  [轮次 ${event.count}/${event.max}]\n`));
        break;
      case 'error':
        process.stdout.write(chalk.red(`\n❌ ${event.message}\n`));
        break;
      case 'done':
        process.stdout.write(
          chalk.green(`\n✨ 完成 (${event.iterations} 轮, ${event.stopReason})\n`),
        );
        break;
    }
  });

  process.stdout.write(chalk.dim(`🤖 IHUI TUI Client → ${opts.url}\n`));
  process.stdout.write(chalk.dim('输入消息发送,/quit 退出\n'));

  for await (const line of rl) {
    const text = line.trim();
    if (!text) continue;
    if (text === '/quit' || text === '/exit') {
      client.close();
      rl.close();
      break;
    }
    process.stdout.write(chalk.dim('→ '));
    await client.send(text);
  }
}
