#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/dev-prod-proxy.mjs — 网页预览专用「CORS 注入反代」(仅本机开发用)
//
// 背景(2026-09-22):用户定稿「网页预览也要连生产」。手机原生端连 https://aizhs.top
// 没有 CORS 概念;浏览器从 http://localhost:8806 跨源访问生产 API 被拦(生产白名单
// 不含 localhost 源,且本机 SSH 密钥全被生产拒,无法改生产配置)。
// 方案:本地 127.0.0.1:8807 起反代 → 转发到 https://aizhs.top,响应注入 CORS 头
// 放行 localhost:8806。流量真实打到生产,仅多一跳本机回环。
//
// 用法: node scripts/dev-prod-proxy.mjs   (由 dev-stack 作为可选服务 prod-proxy 托管)
//   上游优先级: 覆盖文件 .tmp-sync/prod-proxy-upstream.txt > 环境变量 PROD_PROXY_UPSTREAM
//               > 默认 https://aizhs.top
//   其余环境变量: PROD_PROXY_PORT(默认 8807) · PROD_PROXY_ALLOW_ORIGIN(默认 http://localhost:8806)
//
//   为什么用文件而不是环境变量:dev-stack 守护每 30s 复检,prod-proxy 掉了会由守护按它自己
//   那份 env 重拉(它没有你本次的 env),只设 env 的切换会在下次重拉时静默回生产。要临时改指
//   本地 api 就把上游写进该文件,删掉即回生产。实际生效的上游与来源打进启动日志和响应头
//   x-ihui-proxy-upstream,不靠人记。
//
// 安全边界:只绑 127.0.0.1;只对白名单 origin 注入 CORS;纯开发工具,生产不部署。

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UPSTREAM_FILE = path.join(ROOT, '.tmp-sync', 'prod-proxy-upstream.txt');

function resolveUpstream() {
  let fromFile = '';
  try {
    fromFile = fs.readFileSync(UPSTREAM_FILE, 'utf8').trim();
  } catch {
    /* 无覆盖文件 = 按 env / 默认 */
  }
  if (fromFile) return { value: fromFile, source: UPSTREAM_FILE };
  const fromEnv = (process.env.PROD_PROXY_UPSTREAM || '').trim();
  if (fromEnv) return { value: fromEnv, source: 'env:PROD_PROXY_UPSTREAM' };
  return { value: 'https://aizhs.top', source: 'default' };
}

const PORT = Number(process.env.PROD_PROXY_PORT || 8807);
const ALLOW_ORIGIN = process.env.PROD_PROXY_ALLOW_ORIGIN || 'http://localhost:8806';
const { value: UPSTREAM, source: UPSTREAM_SOURCE } = resolveUpstream();
const upstream = new URL(UPSTREAM);
// 上游可能是 http(本机 api)或 https(生产),客户端与缺省端口须跟着协议走,
// 否则 http 上游会被 https 客户端连成 TLS 错误
const UP_CLIENT = upstream.protocol === 'http:' ? http : https;
const UP_PORT = Number(upstream.port || (upstream.protocol === 'https:' ? 443 : 80));

// 逐跳头(hop-by-hop)不转发;upstream 已有的 access-control-* 丢弃防重复注入
const HOP_HEADERS = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'host',
]);
const CORS_DROP = /^access-control-/i;

const server = http.createServer((req, res) => {
  // 预检:直接应答(不打扰上游,生产本来就 404 OPTIONS)
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': ALLOW_ORIGIN,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': req.headers['access-control-request-headers'] || 'content-type,authorization',
      'access-control-max-age': '600',
      vary: 'Origin',
    });
    res.end();
    return;
  }

  const headers = { ...req.headers };
  for (const h of Object.keys(headers)) {
    if (HOP_HEADERS.has(h) || CORS_DROP.test(h)) delete headers[h];
  }
  headers.host = upstream.host;

  const upstreamReq = UP_CLIENT.request(
    {
      protocol: upstream.protocol,
      hostname: upstream.hostname,
      port: UP_PORT,
      method: req.method,
      path: req.url,
      headers,
    },
    (upstreamRes) => {
      const outHeaders = { ...upstreamRes.headers };
      for (const h of Object.keys(outHeaders)) {
        if (CORS_DROP.test(h)) delete outHeaders[h];
      }
      outHeaders['x-ihui-proxy-upstream'] = UPSTREAM;
      outHeaders['access-control-allow-origin'] = ALLOW_ORIGIN;
      outHeaders['access-control-allow-credentials'] = 'true';
      outHeaders.vary = outHeaders.vary ? `${outHeaders.vary}, Origin` : 'Origin';
      res.writeHead(upstreamRes.statusCode || 502, outHeaders);
      upstreamRes.pipe(res);
    },
  );
  upstreamReq.on('error', (e) => {
    if (!res.headersSent) {
      // 把"我这趟打的是哪个上游"带回响应,否则 502 分不清"生产挂了"与"本机指错了上游"
      res.writeHead(502, {
        'content-type': 'application/json',
        'access-control-allow-origin': ALLOW_ORIGIN,
        'x-ihui-proxy-upstream': UPSTREAM,
      });
    }
    res.end(JSON.stringify({ error: 'prod-proxy upstream failed', detail: String(e) }));
  });
  req.pipe(upstreamReq);
});

// WebSocket 升级:TCP 级透明隧道(SSE/fetch 轮询走上面 HTTP;chat WS 走这里)
server.on('upgrade', (req, socket) => {
  const headers = { ...req.headers };
  for (const h of Object.keys(headers)) {
    if (HOP_HEADERS.has(h) || CORS_DROP.test(h)) delete headers[h];
  }
  headers.host = upstream.host;
  const upstreamReq = UP_CLIENT.request(
    {
      protocol: upstream.protocol,
      hostname: upstream.hostname,
      port: UP_PORT,
      method: req.method,
      path: req.url,
      headers,
    },
  );
  upstreamReq.on('upgrade', (upRes, upSocket, upHead) => {
    const lines = [`HTTP/1.1 101 Switching Protocols`];
    for (const [k, v] of Object.entries(upRes.headers)) {
      if (!HOP_HEADERS.has(k.toLowerCase())) lines.push(`${k}: ${v}`);
    }
    socket.write(lines.join('\r\n') + '\r\n\r\n');
    if (upHead?.length) socket.write(upHead);
    upSocket.pipe(socket);
    socket.pipe(upSocket);
    const bye = () => { upSocket.destroy(); socket.destroy(); };
    upSocket.on('error', bye);
    socket.on('error', bye);
  });
  upstreamReq.on('response', (r) => {
    socket.write(`HTTP/1.1 ${r.statusCode} Upgrade Refused\r\nconnection: close\r\n\r\n`);
    socket.destroy();
  });
  upstreamReq.on('error', () => socket.destroy());
  upstreamReq.end();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[prod-proxy] http://127.0.0.1:${PORT} → ${UPSTREAM} (CORS 放行 ${ALLOW_ORIGIN}) [上游来源: ${UPSTREAM_SOURCE}]`);
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
