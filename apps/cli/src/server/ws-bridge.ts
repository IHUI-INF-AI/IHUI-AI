// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WebSocket 实时事件桥 — 升级 /ws 连接,推送 onEvent 流式事件。
 *
 * ws 为硬依赖,静态导入(运行时 createRequire(import.meta.url) 中转在 SEA 单文件
 * 形态下锚定 exe 目录且经变量中转,esbuild 无法解析,必抛误导性错误)。
 *
 * 协议:client 发送 JSON {type:'message', text, sessionId?},server 流式推送 AgentEvent,
 * 最终推送 {type:'result', ...} 或 {type:'error', message, errorCode?}。
 *
 * 鉴权(O12 两条通道,与 HTTP 面同一实现):
 *   1. `Authorization: Bearer <IHUI_AGENT_TOKEN>` 握手头,或既有的 `?token=` query
 *   2. 服务端 API Key:`Authorization: Bearer ihui_xxx` + `X-Api-Secret: sk_xxx`,
 *      并按 /ws 端点所需 scope(chat:write)做能力闸
 *   拒绝时先发一帧 `{type:'error', errorCode, message}` 再关闭,让机器 client 能判别原因,
 *   而不是只拿到一个 4001 关闭码。
 */

import type { IncomingHttpHeaders, Server } from 'node:http';
import { WebSocketServer as WsServerNamed } from 'ws';
import type { AgentCore, AgentEvent } from './agent-core.js';
import {
  authenticateInbound,
  classifyAuthError,
  type InboundAuthContext,
  type MachineKeyEntry,
} from '../config/credentials.js';
import type { ApiKeyPermission } from '@ihui/types';

/** /ws 只做消息驱动,所需能力与 POST /message 一致。 */
const WS_REQUIRED_SCOPE: ApiKeyPermission = 'chat:write';

interface WsServerLike {
  on(
    event: 'connection',
    listener: (ws: WsSocketLike, req: { url?: string; headers?: IncomingHttpHeaders }) => void,
  ): void;
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
  /** O12:放行的机器凭据清单 */
  machineKeys?: MachineKeyEntry[];
  /** O12:机器凭据是否必须携带 X-Api-Secret,默认 true */
  requireApiSecret?: boolean;
}

export interface WsBridgeHandle {
  close: () => Promise<void>;
}

function loadWsServer(): WsServerCtor | null {
  /**
   * 取具名档,且**不得**再留 `?? mod.default` 那一档兜底:ws 的默认导出是**客户端** WebSocket
   * (ESM 走 wrapper.mjs 的 `export default WebSocket`;CJS 互操作下 `mod.default` 也是那枚裸类),
   * 兜底成功时拿到的是构造函数型别不对 —— `new WsServer({server,path})` 会变成一条向外拨号的客户端连接,
   * 比当场报 null 更坏(桥"起来了",但没人能连上)。具名 WebSocketServer 四条载入形态都取得到:
   * ESM wrapper、CJS index 别名、esbuild `--format=cjs` 的 SEA 产物、CI 现用形态。
   */
  return typeof WsServerNamed === 'function' ? (WsServerNamed as unknown as WsServerCtor) : null;
}

/** 取单值请求头(重复头时 node:http 给数组)。 */
function headerValue(raw: string | string[] | undefined): string | undefined {
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

export async function attachWsBridge(core: AgentCore, opts: WsBridgeOptions): Promise<WsBridgeHandle> {
  const path = opts.path ?? '/ws';
  const authCtx: InboundAuthContext = {
    agentToken: opts.token ?? process.env.IHUI_AGENT_TOKEN,
    machineKeys: opts.machineKeys ?? [],
    requireApiSecret: opts.requireApiSecret,
  };

  const WsServer = loadWsServer();
  if (!WsServer) {
    throw new Error(
      'ws 载入形态不认识:具名 WebSocketServer 不是构造函数(不是"没装"—— ws 已在 apps/cli 的 devDependencies/dependencies 与 lock 里;缺包会在加载期就报 ERR_MODULE_NOT_FOUND)',
    );
  }

  const wss = new WsServer({ server: opts.server, path });
  const clients = new Set<WsSocketLike>();

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    const headers = req.headers ?? {};
    const decision = authenticateInbound(
      {
        authorization: headerValue(headers.authorization),
        apiSecret: headerValue(headers['x-api-secret']),
        // 既有 client 用 ?token= 传凭据,继续接受(header 优先)
        queryToken: url.searchParams.get('token') ?? undefined,
        requiredScope: WS_REQUIRED_SCOPE,
      },
      authCtx,
    );
    if (!decision.ok) {
      try {
        ws.send(
          JSON.stringify({
            type: 'error',
            message: decision.message,
            errorCode: decision.errorCode,
            ...(decision.requiredScope ? { requiredScope: decision.requiredScope } : {}),
          }),
        );
      } catch {
        // 握手后 socket 可能已被对端关闭,关闭码仍携带原因
      }
      ws.close(decision.status === 403 ? 4003 : 4001, decision.errorCode);
      return;
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
        const msg = err instanceof Error ? err.message : String(err);
        const errorCode = classifyAuthError(err);
        ws.send(
          JSON.stringify({
            type: 'error',
            message: msg,
            ...(errorCode ? { errorCode } : {}),
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
