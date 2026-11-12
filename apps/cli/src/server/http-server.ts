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
// 本地服务发现的认领件(判据在 @ihui/shared/local-registry,本文件只用其端侧出口)
import { startClaim } from './client-claims.js';
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
  /** 绑定地址(2026-10-31 安全强化第 10 批起默认 127.0.0.1;显式传 host 才放开局域网面) */
  host?: string;
  token?: string;
  /** O12:放行的机器凭据清单(ihui_ 前缀 + secret + scopes) */
  machineKeys?: MachineKeyEntry[];
  /** O12:机器凭据是否必须携带 X-Api-Secret,默认 true(对齐服务端 API_KEY_REQUIRE_SECRET) */
  requireApiSecret?: boolean;
  /**
   * 本地服务发现的认领件(goal-b49 Q1 复现:带心跳的认领件目录 = 不必固定端口的服务发现)。
   * 缺省 = 不落盘(测试与嵌入式调用零噪声);`serve` 命令显式开启。
   * 开启后 `/health` 多带一个 `generation`,发现侧拿它与实际口自述比对 ⇒
   * 伪造的认领件(把扩展指向别的口)会因代次不符被拒。
   */
  claim?: { productVersion?: string; root?: string };
}

export interface AgentServerHandle {
  server: http.Server;
  /** 实际监听端口(opts.port 传 0 时为系统分配的临时端口) */
  port: number;
  close: () => Promise<void>;
}

/** 是否回环绑定(决定 CORS 语义:回环面允许本机 web 开发消费,非回环面不发 CORS 头) */
export function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
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
  // 认领件开启后由 listen 回调填,`/health` 据此自述代次;未开启 ⇒ 恒 null ⇒ 该字段不发
  // (缺字段 ≠ 空串:发现侧要能分辨"这台没开认领件"与"开了但自述为空")。
  let claimGeneration: string | null = null;
  let runningClaim: { stop: () => void; generation: string } | null = null;
  // 2026-10-31 安全强化第 10 批:默认只绑回环(此前 listen(port) 落到 0.0.0.0,
  // 局域网对端可达);CORS 头只在回环面发 —— 非回环暴露面的浏览器跨源请求本身就是
  // drive-by,不发 ACAO 让预检直接失败。
  const bindHost = opts.host ?? '127.0.0.1';
  const loopback = isLoopbackHost(bindHost);

  const server = http.createServer(async (req, res) => {
    if (loopback) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Secret');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
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
        writeJson(res, 200, 'ok', {
          ok: true,
          uptime: Date.now() - startTime,
          // 代次只在认领件开启时发:发现侧靠它拒掉"写了别人不认的口"的伪造认领件
          ...(claimGeneration ? { generation: claimGeneration } : {}),
        });
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

        const abort = new AbortController();
        req.on('close', () => abort.abort());

        let sseBuffered = 0;
        const writeEvent = (event: AgentEvent): void => {
          // F-064:SSE 背压 —— 慢客户端读不动时 res 内部缓冲会无限增长;
          // 缓冲超过 1 MB 即中止本回合并断开,防单连接打爆内存。
          sseBuffered += JSON.stringify(event).length + 8;
          const ok = res.write(`data: ${JSON.stringify(event)}\n\n`);
          if (ok) sseBuffered = 0;
          if (sseBuffered > 1024 * 1024) {
            abort.abort();
            res.destroy();
          }
        };
        res.on('drain', () => {
          sseBuffered = 0;
        });

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
      // F-064/F-137:readJsonBody 的 413 超限按其状态码回,不落 500
      const statusCode = (err as { statusCode?: number }).statusCode;
      writeJson(res, statusCode === 413 ? 413 : 500, msg, null);
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    // F-064:显式超时 —— 不给默认值留巧合空间;headersTimeout < requestTimeout 是 Node 硬性要求
    server.requestTimeout = 300_000;
    server.headersTimeout = 60_000;
    server.listen(opts.port, bindHost, () => {
      // opts.port 可为 0(测试用临时端口),真实端口以 address() 为准
      const address = server.address();
      const boundPort = typeof address === 'object' && address ? address.port : opts.port;
      // 认领件用**实际端口**发布:传 0 时若按 opts.port 记,发现侧会拿到一个不存在的口
      if (opts.claim) {
        runningClaim = startClaim({
          port: boundPort,
          productVersion: opts.claim.productVersion,
          root: opts.claim.root,
        });
        claimGeneration = runningClaim.generation;
      }
      resolve({
        server,
        port: boundPort,
        close: async () => {
          // 先摘认领件再关服务:反过来的话,关闭窗口的那一瞬会有读者把已死的口当活的
          runningClaim?.stop();
          runningClaim = null;
          claimGeneration = null;
          await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
        },
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

/** F-064/F-137:请求体字节上限 —— 持 token 的客户端一条巨型 POST 即可把进程内存打满 */
const MAX_JSON_BODY_BYTES = 1 * 1024 * 1024;

function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    // F-064/F-137:累计字节闸 —— 既看 Content-Length(超限提前断),也逐块累计
    // (防 chunked 传输绕过声明头);超限 reject 413 并销毁连接。
    let total = 0;
    let settled = false;
    const overLimit = (): void => {
      if (settled) return;
      settled = true;
      const err = new Error(`请求体超过 ${MAX_JSON_BODY_BYTES} 字节上限`) as Error & { statusCode?: number };
      err.statusCode = 413;
      reject(err);
      req.destroy();
    };
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > MAX_JSON_BODY_BYTES) {
      overLimit();
      return;
    }
    req.on('data', (c) => {
      if (settled) return;
      const buf = c instanceof Buffer ? c : Buffer.from(c);
      total += buf.length;
      if (total > MAX_JSON_BODY_BYTES) {
        overLimit();
        return;
      }
      chunks.push(buf);
    });
    req.on('error', reject);
    req.on('end', () => {
      if (settled) return;
      settled = true;
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
