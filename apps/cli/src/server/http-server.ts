/**
 * HTTP server — 暴露 Agent 内核为 REST + SSE 接口,供远程 client 驱动。
 *
 * 路由:
 *   POST /message           {text, sessionId?} → SSE 流式响应(token/tool_call/tool_result/done)
 *   GET  /sessions                           → 会话列表
 *   POST /sessions/:id/resume                → 恢复会话
 *   GET  /health                             → {ok, uptime}
 *
 * 鉴权:Bearer token(可选,env IHUI_AGENT_TOKEN)
 */

import * as http from 'node:http';
import type { AgentCore, AgentEvent } from './agent-core.js';

export interface AgentServerOptions {
  port: number;
  token?: string;
}

export interface AgentServerHandle {
  server: http.Server;
  port: number;
  close: () => Promise<void>;
}

export function startAgentServer(core: AgentCore, opts: AgentServerOptions): Promise<AgentServerHandle> {
  const token = opts.token ?? process.env.IHUI_AGENT_TOKEN;
  const startTime = Date.now();

  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (token) {
      const auth = req.headers.authorization ?? '';
      if (auth !== `Bearer ${token}`) {
        writeJson(res, 401, 'Unauthorized', null);
        return;
      }
    }

    const url = new URL(req.url ?? '/', `http://localhost:${opts.port}`);
    const pathname = url.pathname;

    try {
      if (req.method === 'GET' && pathname === '/health') {
        writeJson(res, 200, 'ok', { ok: true, uptime: Date.now() - startTime });
        return;
      }

      if (req.method === 'GET' && pathname === '/sessions') {
        writeJson(res, 200, 'ok', core.listSessions());
        return;
      }

      const resumeMatch = pathname.match(/^\/sessions\/([^/]+)\/resume$/);
      if (req.method === 'POST' && resumeMatch) {
        const session = await core.resumeSession(resumeMatch[1]!);
        if (!session) {
          writeJson(res, 404, 'Session not found', null);
          return;
        }
        writeJson(res, 200, 'ok', session);
        return;
      }

      if (req.method === 'POST' && pathname === '/message') {
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
          const msg = err instanceof Error ? err.message : String(err);
          res.write(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`);
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
      resolve({
        server,
        port: opts.port,
        close: () =>
          new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r()))),
      });
    });
  });
}

function writeJson(res: http.ServerResponse, code: number, message: string, data: unknown): void {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ code, message, data }));
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
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch (e) {
        reject(e);
      }
    });
  });
}
