// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * HTTP server — 暴露 Agent 内核为 REST + SSE 接口,供远程 client 驱动。
 *
 * 路由(→ 机器凭据所需 scope 见 requiredScopeFor):
 *   POST /message           {text, sessionId?} → SSE 流式响应(token/tool_call/tool_result/done)
 *   GET  /sessions                            → 会话列表
 *   POST /sessions/:id/resume                → 恢复会话
 *   GET  /health                             → {ok, uptime}
 *
 * 鉴权(O12 起两条通道,任一命中即放行):
 *   1. 共享 Bearer token(env IHUI_AGENT_TOKEN / --token)— 人驱动的远程 client
 *   2. 服务端 API Key 透传(`Authorization: Bearer ihui_xxx` + `X-Api-Secret: sk_xxx`)
 *      — 机器驱动,按端点所需 scope 做能力闸(判据取 @ihui/types 能力目录,与服务端同源)
 *   两条都未配置时保持「无鉴权」的本地开发语义(行为不变)。
 *
 * 失败响应在既有 `{code,message,data}` 之外追加 `errorCode`(+ `requiredScope`),
 * 供 agent 程序化判别:CREDENTIAL_MISSING / CREDENTIAL_INVALID / SECRET_REQUIRED /
 * SCOPE_REQUIRED / M2M_FORBIDDEN。
 */

import * as http from 'node:http';
import type { AgentCore, AgentEvent } from './agent-core.js';
import { tryParseJson, isRecord } from '../util/json.js';
import {
  authenticateInbound,
  classifyAuthError,
  type AuthErrorCode,
  type InboundAuthContext,
  type MachineKeyEntry,
} from '../config/credentials.js';
import type { ApiKeyPermission } from '@ihui/types';

export interface AgentServerOptions {
  port: number;
  token?: string;
  /** O12:放行的机器凭据清单(ihui_ 前缀 + secret + scopes) */
  machineKeys?: MachineKeyEntry[];
  /** O12:机器凭据是否必须携带 X-Api-Secret,默认 true(对齐服务端 API_KEY_REQUIRE_SECRET) */
  requireApiSecret?: boolean;
}

export interface AgentServerHandle {
  server: http.Server;
  /** 实际监听端口(opts.port 传 0 时为系统分配的临时端口) */
  port: number;
  close: () => Promise<void>;
}

/**
 * 端点 → 所需能力 scope。/health 只要求"凭据有效",不额外要求 scope
 * (存活探针通常由无 scope 的运维凭据 / agent token 调用)。
 */
function requiredScopeFor(method: string, pathname: string): ApiKeyPermission | undefined {
  if (method === 'GET' && pathname === '/health') return undefined;
  if (method === 'GET' && pathname === '/sessions') return 'chat:read';
  if (method === 'POST' && /^\/sessions\/[^/]+\/resume$/.test(pathname)) return 'chat:read';
  if (method === 'POST' && pathname === '/message') return 'chat:write';
  return undefined;
}

/** 取单值请求头(node:http 允许重复头为数组)。 */
function headerValue(raw: string | string[] | undefined): string | undefined {
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

export function startAgentServer(core: AgentCore, opts: AgentServerOptions): Promise<AgentServerHandle> {
  const authCtx: InboundAuthContext = {
    agentToken: opts.token ?? process.env.IHUI_AGENT_TOKEN,
    machineKeys: opts.machineKeys ?? [],
    requireApiSecret: opts.requireApiSecret,
  };
  const startTime = Date.now();

  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Secret');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', `http://localhost:${opts.port}`);
    const pathname = url.pathname;
    const method = req.method ?? 'GET';

    const decision = authenticateInbound(
      {
        authorization: headerValue(req.headers.authorization),
        apiSecret: headerValue(req.headers['x-api-secret']),
        requiredScope: requiredScopeFor(method, pathname),
      },
      authCtx,
    );
    if (!decision.ok) {
      writeJson(res, decision.status, decision.message, null, {
        errorCode: decision.errorCode,
        requiredScope: decision.requiredScope,
      });
      return;
    }

    try {
      if (method === 'GET' && pathname === '/health') {
        writeJson(res, 200, 'ok', { ok: true, uptime: Date.now() - startTime });
        return;
      }

      if (method === 'GET' && pathname === '/sessions') {
        writeJson(res, 200, 'ok', core.listSessions());
        return;
      }

      const resumeMatch = pathname.match(/^\/sessions\/([^/]+)\/resume$/);
      if (method === 'POST' && resumeMatch) {
        const session = await core.resumeSession(resumeMatch[1]!);
        if (!session) {
          writeJson(res, 404, 'Session not found', null);
          return;
        }
        writeJson(res, 200, 'ok', session);
        return;
      }

      if (method === 'POST' && pathname === '/message') {
        const body = await readJsonBody(req);
        const text = String(body.text ?? '');
        const sessionId = body.sessionId ? String(body.sessionId) : undefined;
        if (!text) {
          writeJson(res, 400, 'Missing text', null);
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });

        const writeEvent = (event: AgentEvent): void => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        };

        const abort = new AbortController();
        req.on('close', () => abort.abort());

        try {
          const result = await core.sendMessage(text, writeEvent, { sessionId, signal: abort.signal });
          res.write(`event: result\ndata: ${JSON.stringify(result)}\n\n`);
        } catch (err) {
          // 上游鉴权失败(403 SCOPE_REQUIRED / 401 SECRET_REQUIRED / 503 限流后端不可用)
          // 必须让 client 侧程序可判别,而非只留一段人读消息。
          const msg = err instanceof Error ? err.message : String(err);
          const errorCode = classifyAuthError(err);
          res.write(
            `event: error\ndata: ${JSON.stringify({ message: msg, ...(errorCode ? { errorCode } : {}) })}\n\n`,
          );
        } finally {
          res.end();
        }
        return;
      }

      writeJson(res, 404, 'Not found', null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      writeJson(res, 500, msg, null);
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(opts.port, () => {
      // opts.port 可为 0(测试用临时端口),真实端口以 address() 为准
      const address = server.address();
      const boundPort = typeof address === 'object' && address ? address.port : opts.port;
      resolve({
        server,
        port: boundPort,
        close: () =>
          new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r()))),
      });
    });
  });
}

function writeJson(
  res: http.ServerResponse,
  code: number,
  message: string,
  data: unknown,
  extra?: { errorCode?: AuthErrorCode; requiredScope?: string },
): void {
  const payload: Record<string, unknown> = { code, message, data };
  if (extra?.errorCode) payload.errorCode = extra.errorCode;
  if (extra?.requiredScope) payload.requiredScope = extra.requiredScope;
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c instanceof Buffer ? c : Buffer.from(c)));
    req.on('error', reject);
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw) {
        resolve({});
        return;
      }
      const parsed = tryParseJson(raw);
      if (!isRecord(parsed)) {
        reject(new Error('请求体必须是合法的 JSON 对象'));
        return;
      }
      resolve(parsed);
    });
  });
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
