/**
 * WebSocket 实时事件桥 — 升级 /ws 连接,推送 onEvent 流式事件。
 *
 * 用 createRequire 动态加载 ws 包(Node 内置无 WebSocketServer),避免静态 import 导致
 * typecheck 失败。运行时若 ws 包未安装,attachWsBridge 抛出友好错误。
 *
 * 协议:client 发送 JSON {type:'message', text, sessionId?},server 流式推送 AgentEvent,
 * 最终推送 {type:'result', ...} 或 {type:'error', message}。
 */

import { createRequire } from 'node:module';
import type { Server } from 'node:http';
import type { AgentCore, AgentEvent } from './agent-core.js';

const dynamicRequire = createRequire(import.meta.url);

interface WsServerLike {
  on(event: 'connection', listener: (ws: WsSocketLike, req: { url?: string }) => void): void;
  close(callback?: () => void): void;
}

interface WsSocketLike {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: 'message', listener: (data: Buffer) => void): void;
  on(event: 'close', listener: () => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
}

type WsServerCtor = new (options: { server: Server; path: string }) => WsServerLike;

export interface WsBridgeOptions {
  server: Server;
  path?: string;
  token?: string;
}

export interface WsBridgeHandle {
  close: () => Promise<void>;
}

function loadWsServer(): WsServerCtor | null {
  try {
    const mod = dynamicRequire('ws') as {
      WebSocketServer?: WsServerCtor;
      default?: WsServerCtor;
    };
    return mod.WebSocketServer ?? mod.default ?? null;
  } catch {
    return null;
  }
}

export async function attachWsBridge(core: AgentCore, opts: WsBridgeOptions): Promise<WsBridgeHandle> {
  const path = opts.path ?? '/ws';
  const token = opts.token ?? process.env.IHUI_AGENT_TOKEN;

  const WsServer = loadWsServer();
  if (!WsServer) {
    throw new Error(
      'ws 包未安装,WebSocket 桥未启动。请运行:pnpm --filter @ihui/cli add ws && pnpm --filter @ihui/cli add -D @types/ws',
    );
  }

  const wss = new WsServer({ server: opts.server, path });
  const clients = new Set<WsSocketLike>();

  wss.on('connection', (ws, req) => {
    if (token) {
      const url = new URL(req.url ?? '', 'http://localhost');
      if (url.searchParams.get('token') !== token) {
        ws.close(4001, 'Unauthorized');
        return;
      }
    }
    clients.add(ws);
    ws.on('message', (data: Buffer) => {
      void handleMessage(ws, core, data);
    });
    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  async function handleMessage(ws: WsSocketLike, core: AgentCore, data: Buffer): Promise<void> {
    let msg: { type?: string; text?: string; sessionId?: string };
    try {
      msg = JSON.parse(data.toString('utf-8'));
    } catch {
      return;
    }
    if (msg.type !== 'message' || typeof msg.text !== 'string') return;

    const sessionId = msg.sessionId;
    const onEvent = (event: AgentEvent): void => {
      if (ws.readyState === 1) {
        try {
          ws.send(JSON.stringify(event));
        } catch {
          // socket 已关闭,忽略
        }
      }
    };

    try {
      const result = await core.sendMessage(
        msg.text,
        onEvent,
        sessionId ? { sessionId } : undefined,
      );
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'result', ...result }));
      }
    } catch (err) {
      if (ws.readyState === 1) {
        ws.send(
          JSON.stringify({
            type: 'error',
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }
  }

  return {
    close: () =>
      new Promise<void>((resolve) => {
        for (const ws of clients) {
          try {
            ws.close();
          } catch {
            // ignore
          }
        }
        clients.clear();
        wss.close(() => resolve());
      }),
  };
}
