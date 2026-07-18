/**
 * MCP OAuth flow — 浏览器授权 + 本地回调 server + 跨进程文件锁 dedup。
 *
 * 策略(做减法):
 *   - 零依赖:不引入 open npm 包,用 child_process.spawn 调系统默认浏览器(跨平台)
 *   - 跨进程 dedup:写 mcp-oauth.lock(含 PID + 启动时间 + serverUrl)
 *     PID 存活 → 等待其他进程完成(轮询 lock 删除)
 *     PID 已死 → 删除 lock 继续
 *   - 本地 http server 监听 redirectUri 端口,接收 callback 的 authorization_code
 *   - state 防 CSRF:随机 16 字节 hex,回调必须匹配
 *   - PKCE S256:防 code 拦截
 *   - 失败/超时(默认 5 分钟)→ 抛错,释放 lock
 *
 * 流程:
 *   1. acquireLock(serverUrl)
 *   2. 启动本地 http server 监听 PORT
 *   3. 构造授权 URL(state + PKCE challenge + scope),打开浏览器
 *   4. 等待 callback,验证 state,取 code
 *   5. POST 到 tokenEndpoint 换 access_token + refresh_token
 *   6. 保存到 mcp-credentials.json
 *   7. releaseLock()
 *   8. 返回 OAuthResult
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { setCredential } from './mcp-credentials.js';

const OAUTH_LOCK_FILENAME = 'mcp-oauth.lock';
const OAUTH_TIMEOUT_MS = 5 * 60_000; // 5 分钟
const LOCK_POLL_INTERVAL_MS = 500;

function getIhuiHome(): string {
  return process.env.IHUI_HOME || path.join(os.homedir(), '.ihui');
}

function getLockPath(): string {
  return path.join(getIhuiHome(), OAUTH_LOCK_FILENAME);
}

export interface OAuthConfig {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  clientId: string;
  clientSecret?: string;
  /** http://localhost:PORT/callback */
  redirectUri: string;
  scope: string[];
  /** MCP server URL,作为凭证 key */
  serverUrl: string;
}

export interface OAuthResult {
  accessToken: string;
  refreshToken?: string;
  /** 过期时间(ms epoch) */
  expiresAt: number;
  scope: string[];
}

interface LockInfo {
  pid: number;
  startedAt: number;
  serverUrl: string;
}

/** 本地回调 server 句柄:可等待 code,也可手动关闭 */
interface CallbackHandle {
  /** Promise 在收到合法 code 时 resolve,超时/错误时 reject */
  waitForCode: Promise<string>;
  /** 关闭 server(成功或失败后都必须调用) */
  close: () => void;
}

/**
 * 启动 OAuth 授权流程:
 *   1. 跨进程 dedup(写 lock 文件)
 *   2. 启动本地 callback server
 *   3. 构造授权 URL + 打开浏览器
 *   4. 等待 callback,换取 token
 *   5. 保存凭证,删除 lock
 *
 * 任意步骤失败均释放 lock(避免死锁)。
 */
export async function startOAuthFlow(config: OAuthConfig): Promise<OAuthResult> {
  // 1. 跨进程 dedup:已有 lock 且 PID 存活 → 等待其他进程完成
  await acquireLock(config.serverUrl);

  try {
    // 2. 从 redirectUri 解析端口
    const port = extractPort(config.redirectUri);
    if (port === null) {
      throw new Error(`redirectUri 缺少端口: ${config.redirectUri}`);
    }

    // 3. 生成 state + PKCE
    const state = randomBytes(16).toString('hex');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

    // 4. 启动本地 callback server
    const handle = startLocalCallbackServer(port, state, OAUTH_TIMEOUT_MS);

    // 5. 构造授权 URL + 打开浏览器
    const authUrl = buildFullAuthorizationUrl(config, state, codeChallenge);
    console.info(`[mcp-oauth] 授权 URL(若浏览器未自动打开,请手动访问):\n  ${authUrl}`);
    await openBrowser(authUrl);

    // 6. 等待 code
    const code = await handle.waitForCode;

    // 7. 换取 token
    const result = await exchangeCodeForToken(config, code, codeVerifier);

    // 8. 保存凭证
    await setCredential(config.serverUrl, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
      scope: result.scope,
      obtainedAt: Date.now(),
    });

    return result;
  } finally {
    // 9. 释放 lock(无论成功/失败)
    await releaseLock();
  }
}

/**
 * 启动本地 http server 监听 callback。
 * - 验证 state 匹配(不匹配返回 400,拒绝)
 * - 收到 code 后关闭 server,resolve Promise
 * - 超时未收到 → reject
 *
 * 返回 CallbackHandle:waitForCode 等 code,close 关 server。
 * 调用方必须确保 close() 在成功/失败后都被调用(用 try/finally)。
 */
export function startLocalCallbackServer(
  port: number,
  expectedState: string,
  timeoutMs: number,
): CallbackHandle {
  let server: Server | null = null;
  let settled = false;
  let timer: NodeJS.Timeout | null = null;

  const waitForCode = new Promise<string>((resolve, reject) => {
    const cleanup = (): void => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (server) {
        try {
          server.close();
        } catch {
          // 忽略
        }
        server = null;
      }
    };

    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`OAuth 回调超时 (${timeoutMs}ms)`));
    }, timeoutMs);

    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (!req.url) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Bad Request');
        return;
      }
      const url = new URL(req.url, `http://localhost:${port}`);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (settled) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body>已处理,可关闭此窗口。</body></html>');
        return;
      }

      if (error) {
        settled = true;
        cleanup();
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<html><body>OAuth 失败: ${escapeHtml(error)}</body></html>`);
        reject(new Error(`OAuth 授权失败: ${error}`));
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('缺少 code 参数');
        return;
      }

      if (state !== expectedState) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body>state 不匹配,拒绝授权(CSRF 防护)。</body></html>');
        return;
      }

      // 成功
      settled = true;
      cleanup();
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body>授权成功,可关闭此窗口。</body></html>');
      resolve(code);
    });

    server.on('error', (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`本地回调 server 启动失败: ${err.message}`));
    });

    server.listen(port, '127.0.0.1');
  });

  const close = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (server) {
      try {
        server.close();
      } catch {
        // 忽略
      }
      server = null;
    }
  };

  return { waitForCode, close };
}

/**
 * 用 authorization_code 换取 access_token + refresh_token。
 * 标准 OAuth 2.0 token endpoint:grant_type=authorization_code。
 */
export async function exchangeCodeForToken(
  config: OAuthConfig,
  code: string,
  codeVerifier?: string,
): Promise<OAuthResult> {
  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('code', code);
  body.set('redirect_uri', config.redirectUri);
  body.set('client_id', config.clientId);
  if (config.clientSecret) body.set('client_secret', config.clientSecret);
  if (codeVerifier) body.set('code_verifier', codeVerifier);

  const json = await postTokenEndpoint(config.tokenEndpoint, body);
  if (!json.access_token) {
    throw new Error('token endpoint 响应缺少 access_token');
  }
  return parseTokenResponse(json, config.scope);
}

/**
 * 用 refresh_token 刷新 access_token(凭证过期时由 ManagedMcpClient 调用)。
 */
export async function refreshAccessToken(
  config: OAuthConfig,
  refreshToken: string,
): Promise<OAuthResult> {
  const body = new URLSearchParams();
  body.set('grant_type', 'refresh_token');
  body.set('refresh_token', refreshToken);
  body.set('client_id', config.clientId);
  if (config.clientSecret) body.set('client_secret', config.clientSecret);

  const json = await postTokenEndpoint(config.tokenEndpoint, body);
  if (!json.access_token) {
    throw new Error('refresh 响应缺少 access_token');
  }
  const result = parseTokenResponse(json, config.scope);
  // 部分服务器不返回新的 refresh_token,沿用旧值
  if (!json.refresh_token) {
    result.refreshToken = refreshToken;
  }
  return result;
}

/** POST 到 token endpoint,返回解析后的 JSON,处理 HTTP/网络错误 */
async function postTokenEndpoint(
  tokenEndpoint: string,
  body: URLSearchParams,
): Promise<{
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string | string[];
  error?: string;
  error_description?: string;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const resp = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`token endpoint 返回 ${resp.status}: ${errText.slice(0, 200)}`);
    }
    const json = (await resp.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string | string[];
      error?: string;
      error_description?: string;
    };
    if (json.error) {
      throw new Error(`token endpoint 错误: ${json.error} ${json.error_description ?? ''}`);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/** 把 token endpoint 响应解析为 OAuthResult(expires_in → expiresAt,scope 字符串→数组) */
function parseTokenResponse(
  json: { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string | string[] },
  fallbackScope: string[],
): OAuthResult {
  const expiresAt = json.expires_in
    ? Date.now() + json.expires_in * 1000
    : Date.now() + 3600 * 1000; // 默认 1 小时
  const scope = typeof json.scope === 'string'
    ? json.scope.split(' ').filter(Boolean)
    : Array.isArray(json.scope) ? json.scope : fallbackScope;
  return {
    accessToken: json.access_token!,
    refreshToken: json.refresh_token,
    expiresAt,
    scope,
  };
}

/** 从 http://localhost:PORT/callback 提取 PORT */
function extractPort(redirectUri: string): number | null {
  try {
    const u = new URL(redirectUri);
    if (u.port) return parseInt(u.port, 10);
    return u.protocol === 'http:' ? 80 : 443;
  } catch {
    return null;
  }
}

/**
 * 跨平台打开系统默认浏览器(零依赖,不引入 open 包)。
 *   - macOS:open <url>
 *   - Windows:cmd /c start <url>(用 spawn 避免 shell 注入)
 *   - Linux/其他:xdg-open <url>(失败回退到打印 URL)
 */
export async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  let cmd: string;
  let args: string[];
  if (platform === 'darwin') {
    cmd = 'open';
    args = [url];
  } else if (platform === 'win32') {
    cmd = 'cmd';
    args = ['/c', 'start', '', url];
  } else {
    cmd = 'xdg-open';
    args = [url];
  }
  return new Promise<void>((resolve) => {
    try {
      const proc = spawn(cmd, args, { detached: true, stdio: 'ignore' });
      proc.on('error', () => {
        // 启动失败不抛错,调用方应回退到打印 URL
        resolve();
      });
      proc.unref();
      resolve();
    } catch {
      resolve();
    }
  });
}

/** 构造完整授权 URL(state + PKCE + scope + redirect_uri) */
export function buildFullAuthorizationUrl(
  config: OAuthConfig,
  state: string,
  codeChallenge: string,
): string {
  const params = new URLSearchParams();
  params.set('response_type', 'code');
  params.set('client_id', config.clientId);
  params.set('redirect_uri', config.redirectUri);
  params.set('state', state);
  params.set('code_challenge', codeChallenge);
  params.set('code_challenge_method', 'S256');
  if (config.scope.length > 0) {
    params.set('scope', config.scope.join(' '));
  }
  const sep = config.authorizationEndpoint.includes('?') ? '&' : '?';
  return `${config.authorizationEndpoint}${sep}${params.toString()}`;
}

/**
 * 跨进程 lock dedup:
 *   - lock 不存在 → 写入 {pid, startedAt, serverUrl}
 *   - lock 存在且 PID 存活 → 轮询等待 lock 被释放(最多 OAUTH_TIMEOUT_MS)
 *   - lock 存在但 PID 已死 → 删除 lock,重新获取
 */
export async function acquireLock(serverUrl: string): Promise<void> {
  const lockPath = getLockPath();
  const dir = path.dirname(lockPath);
  await fs.mkdir(dir, { recursive: true });

  const start = Date.now();
  while (Date.now() - start < OAUTH_TIMEOUT_MS) {
    let existing: LockInfo | null = null;
    try {
      const raw = await fs.readFile(lockPath, 'utf-8');
      existing = JSON.parse(raw) as LockInfo;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        existing = null;
      } else if (err instanceof SyntaxError) {
        // lock 文件损坏,删除后重新获取
        try {
          await fs.unlink(lockPath);
        } catch {
          // 忽略
        }
        existing = null;
      } else {
        throw err;
      }
    }

    if (existing === null) {
      // 写入新 lock
      const info: LockInfo = {
        pid: process.pid,
        startedAt: Date.now(),
        serverUrl,
      };
      await fs.writeFile(lockPath, JSON.stringify(info), 'utf-8');
      return;
    }

    // lock 存在,检查 PID 是否存活
    const alive = await isProcessAlive(existing.pid);
    if (!alive) {
      // PID 已死,删除 lock,继续下一轮(重新获取)
      try {
        await fs.unlink(lockPath);
      } catch {
        // 忽略
      }
      continue;
    }

    // PID 存活,等待其他进程完成
    await sleep(LOCK_POLL_INTERVAL_MS);
  }
  throw new Error(`OAuth lock 等待超时 (${OAUTH_TIMEOUT_MS}ms),其他进程未释放 ${lockPath}`);
}

/** 释放 lock 文件(仅当 PID 匹配当前进程时才删除) */
export async function releaseLock(): Promise<void> {
  const lockPath = getLockPath();
  try {
    const raw = await fs.readFile(lockPath, 'utf-8');
    const info = JSON.parse(raw) as LockInfo;
    if (info.pid === process.pid) {
      await fs.unlink(lockPath);
    }
    // PID 不匹配则不动(可能是其他进程的 lock)
  } catch {
    // lock 文件不存在或损坏,忽略
  }
}

/** 检查指定 PID 是否存活(process.kill(pid, 0) 不实际发送信号,只检测存在性) */
export async function isProcessAlive(pid: number): Promise<boolean> {
  if (pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ESRCH') return false; // 进程不存在
    if (code === 'EPERM') return true; // 进程存在但无权限发信号
    return false;
  }
}

/** 读取 lock 文件内容(测试用) */
export async function readLockForTest(): Promise<LockInfo | null> {
  try {
    const raw = await fs.readFile(getLockPath(), 'utf-8');
    return JSON.parse(raw) as LockInfo;
  } catch {
    return null;
  }
}

/** 获取 lock 文件路径(测试用) */
export function getOAuthLockPath(): string {
  return getLockPath();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
