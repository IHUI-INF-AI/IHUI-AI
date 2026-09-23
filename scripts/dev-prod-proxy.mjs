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
//   环境变量: PROD_PROXY_PORT(默认 8807) · PROD_PROXY_UPSTREAM(默认 https://aizhs.top)
//             PROD_PROXY_ALLOW_ORIGIN(默认 http://localhost:8806)
//
// 安全边界:只绑 127.0.0.1;只对白名单 origin 注入 CORS;纯开发工具,生产不部署。

import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

const PORT = Number(process.env.PROD_PROXY_PORT || 8807);
const UPSTREAM = process.env.PROD_PROXY_UPSTREAM || 'https://aizhs.top';
const ALLOW_ORIGIN = process.env.PROD_PROXY_ALLOW_ORIGIN || 'http://localhost:8806';
const upstream = new URL(UPSTREAM);

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

  const upstreamReq = https.request(
    {
      protocol: upstream.protocol,
      hostname: upstream.hostname,
      port: upstream.port || 443,
      method: req.method,
      path: req.url,
      headers,
    },
    (upstreamRes) => {
      const outHeaders = { ...upstreamRes.headers };
      for (const h of Object.keys(outHeaders)) {
        if (CORS_DROP.test(h)) delete outHeaders[h];
      }
      outHeaders['access-control-allow-origin'] = ALLOW_ORIGIN;
      outHeaders['access-control-allow-credentials'] = 'true';
      outHeaders.vary = outHeaders.vary ? `${outHeaders.vary}, Origin` : 'Origin';
      res.writeHead(upstreamRes.statusCode || 502, outHeaders);
      upstreamRes.pipe(res);
    },
  );
  upstreamReq.on('error', (e) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'application/json', 'access-control-allow-origin': ALLOW_ORIGIN });
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
  const upstreamReq = https.request(
    {
      protocol: upstream.protocol,
      hostname: upstream.hostname,
      port: upstream.port || 443,
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
  console.log(`[prod-proxy] http://127.0.0.1:${PORT} → ${UPSTREAM} (CORS 放行 ${ALLOW_ORIGIN})`);
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
