#!/usr/bin/env node
/**
 * refresh-cli-token.mjs — 刷新 CLI apiKey(JWT accessToken)
 *
 * 运行环境:Windows 任务计划程序(每周一 03:00)+ 手动 node 调用
 *
 * 策略(做减法,0 外部依赖,纯 node:http 避免 Node 24 global fetch 栈溢出):
 *   1. 读取 .ihui/settings.json(项目级优先,回退 ~/.ihui/settings.json)
 *   2. 若存在 refreshToken → POST /api/auth/refresh 轮换获取新 token 对,更新 settings.json
 *   3. 若无 refreshToken → GET /api/auth/info 验证当前 apiKey:
 *      - 200:token 仍有效,无需刷新(输出剩余天数)
 *      - 401:token 已过期,提示重新 `ihui login`
 *
 * 退出码:
 *   0 — 成功刷新 或 token 仍有效
 *   1 — 配置错误 / API 不可达 / token 过期需重新登录
 *
 * 用法:
 *   node scripts/refresh-cli-token.mjs
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as http from 'node:http';
import { URL } from 'node:url';

const PROJECT_SETTINGS = path.join(process.cwd(), '.ihui', 'settings.json');
const GLOBAL_SETTINGS = path.join(os.homedir(), '.ihui', 'settings.json');

/**
 * 读取 settings.json(项目级优先,回退全局)
 * @returns {{ path: string, data: any } | null}
 */
function loadSettings() {
  for (const p of [PROJECT_SETTINGS, GLOBAL_SETTINGS]) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        return { path: p, data: JSON.parse(raw) };
      }
    } catch {
      // 读取/解析失败,尝试下一个
    }
  }
  return null;
}

/** 原子写入 settings.json(先写临时文件再 rename,避免中途崩溃损坏配置) */
function saveSettings(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = filePath + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

/**
 * 用 node:http 发送请求(避免 Node 24 global fetch 在 Windows 上的栈溢出 + IPv6 问题)
 * @param {string} baseUrl  例如 http://127.0.0.1:3001
 * @param {string} pathname 例如 /api/auth/refresh
 * @param {{ method?: string, body?: any, headers?: Record<string,string> }} opts
 * @returns {Promise<{ status: number, body: any }>}
 */
function httpRequest(baseUrl, pathname, opts = {}) {
  const url = new URL(baseUrl);
  // 强制 127.0.0.1,避免 localhost 解析到 IPv6 ::1 导致 ECONNREFUSED
  const hostname = url.hostname === 'localhost' ? '127.0.0.1' : url.hostname;
  const port = url.port || (url.protocol === 'https:' ? 443 : 80);
  const method = opts.method || 'GET';
  const bodyStr = opts.body ? JSON.stringify(opts.body) : null;
  const headers = {
    'Accept': 'application/json',
    ...(bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
    ...(opts.headers || {}),
  };

  return new Promise((resolve, reject) => {
    const req = http.request({ hostname, port, path: pathname, method, headers }, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => {
        let parsed = null;
        try { parsed = chunks ? JSON.parse(chunks) : null; } catch { parsed = chunks; }
        resolve({ status: res.statusCode || 0, body: parsed });
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(new Error('request timeout 15s')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/** 从 JWT payload 读取 exp(秒级 Unix 时间戳),不验签 */
function readJwtExp(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

async function main() {
  console.info('[refresh-cli-token] Starting at', new Date().toISOString());

  // 1. 加载配置
  const settings = loadSettings();
  if (!settings) {
    console.error('[refresh-cli-token] No settings.json found in .ihui/ or ~/.ihui/');
    console.error('  Run `ihui login` first to configure CLI.');
    process.exit(1);
  }
  const { path: settingsPath, data: cfg } = settings;
  console.info('[refresh-cli-token] Using settings:', settingsPath);

  const apiUrl = cfg.apiUrl;
  const apiKey = cfg.apiKey;
  const refreshToken = cfg.refreshToken;
  if (!apiUrl) {
    console.error('[refresh-cli-token] Missing apiUrl in settings.json');
    process.exit(1);
  }
  if (!apiKey) {
    console.error('[refresh-cli-token] Missing apiKey in settings.json');
    process.exit(1);
  }
  console.info('[refresh-cli-token] API URL:', apiUrl);

  // 2a. 若有 refreshToken → 轮换刷新
  if (refreshToken) {
    console.info('[refresh-cli-token] Found refreshToken, attempting /api/auth/refresh...');
    try {
      const res = await httpRequest(apiUrl, '/api/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
      });
      if (res.status === 200 && res.body?.data?.accessToken) {
        cfg.apiKey = res.body.data.accessToken;
        if (res.body.data.refreshToken) cfg.refreshToken = res.body.data.refreshToken;
        saveSettings(settingsPath, cfg);
        console.info('[refresh-cli-token] Token refreshed successfully.');
        const exp = readJwtExp(cfg.apiKey);
        if (exp) console.info('[refresh-cli-token] New token expires at', new Date(exp * 1000).toISOString());
        process.exit(0);
      }
      console.error(`[refresh-cli-token] Refresh failed: status=${res.status}`, res.body);
      // refreshToken 失效 → 删除它,继续走 2b 验证 apiKey
      delete cfg.refreshToken;
    } catch (err) {
      console.error('[refresh-cli-token] Refresh request error:', err.message);
      // 网络错误/API 不可达 → 直接退出,等下次任务重试
      process.exit(1);
    }
  }

  // 2b. 无 refreshToken(或 refreshToken 已失效)→ 验证现有 apiKey
  console.info('[refresh-cli-token] No valid refreshToken, verifying apiKey via /api/auth/info...');
  try {
    const res = await httpRequest(apiUrl, '/api/auth/info', {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 200) {
      const exp = readJwtExp(apiKey);
      if (exp) {
        const daysLeft = Math.max(0, (exp * 1000 - Date.now()) / 86400000);
        console.info(`[refresh-cli-token] apiKey still valid, ${daysLeft.toFixed(1)} days remaining.`);
        if (daysLeft < 1) {
          console.warn('[refresh-cli-token] WARNING: token expires within 1 day. Re-login with `ihui login` to get refreshToken for auto-refresh.');
        }
      } else {
        console.info('[refresh-cli-token] apiKey verified (no exp in payload).');
      }
      // 保存可能被删除的 refreshToken 字段
      saveSettings(settingsPath, cfg);
      process.exit(0);
    }
    if (res.status === 401) {
      console.error('[refresh-cli-token] apiKey expired or invalid (401).');
      console.error('  Run `ihui login` to obtain a new token.');
      process.exit(1);
    }
    console.error(`[refresh-cli-token] Unexpected status ${res.status}:`, res.body);
    process.exit(1);
  } catch (err) {
    console.error('[refresh-cli-token] /api/auth/info request error:', err.message);
    console.error('  Is the API service running at', apiUrl, '?');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[refresh-cli-token] Uncaught error:', err);
  process.exit(1);
});
