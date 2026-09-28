// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 *   - 票A(2026-09-28):refresh_token 刷新走 mcp-refresh.lock 跨进程单飞 + 代次 CAS +
 *     失败三分(temporary / invalid_grant / invalid_client,外加 undetermined 未判定档);
 *     锁/判活/抢占**复用下面同一份 acquireLock 实现**,不另建第二份算法
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
import { setCredential, getCredentialWithGeneration, commitCredentialCas, isExpired, type McpCredentialEntry } from './mcp-credentials.js';
import { tryParseJson, isRecord } from '../util/json.js';
import { assertSafeFetchUrl, formatSsrfRejection, type SelfHostedTrust } from '@ihui/shared/utils/ssrf-guard';

const OAUTH_LOCK_FILENAME = 'mcp-oauth.lock';
/**
 * 票A:凭据刷新的跨进程单飞锁。路径**必须与被保护的 credentials 文件不同**
 * (上游实测踩过:锁与数据同路径 ⇒ 落库动作结构上碰锁自身 ⇒ 自重入死锁)。
 */
const MCP_REFRESH_LOCK_FILENAME = 'mcp-refresh.lock';
const OAUTH_TIMEOUT_MS = 5 * 60_000; // 5 分钟
const LOCK_POLL_INTERVAL_MS = 500;

/**
 * 刷新单飞锁等待预算(票A)。判据不是"平时要多快",而是 holder 的**病态上界**:
 * holder 在锁内做"一次 discovery(SSRF 守卫的 DNS 解析)+ 一次 token 请求"。
 * 本机实测(2026-09-28,现读,勿照抄):dns lookup ≈ 27ms、本地 token RTT ≈ 15ms、
 * 注入 1.2s 延迟的完整单飞往返 ≈ 1.3s —— 常态远低于预算,但预算必须钉在尾档:
 *   postTokenEndpoint 内部 fetch 硬超时 15_000ms + DNS 解析器最差档(秒级×重试)
 * ⇒ holder 最差 ≈ 20s,取 45s ≈ 2× 最差 + 调度余量。
 * 上游实测默认 8s 不够(等待方在 holder 正常完成前就超时,把"等锁超时"错读成"刷新失败")。
 */
export const REFRESH_LOCK_WAIT_MS = 45_000;

function getIhuiHome(): string {
  return process.env.IHUI_HOME || path.join(os.homedir(), '.ihui');
}

function getLockPath(): string {
  return path.join(getIhuiHome(), OAUTH_LOCK_FILENAME);
}

/** 刷新单飞锁路径(票A)——与 credentials 文件必然不同路径,见 MCP_REFRESH_LOCK_FILENAME 注释 */
export function getRefreshLockPath(): string {
  return path.join(getIhuiHome(), MCP_REFRESH_LOCK_FILENAME);
}

/**
 * 刷新失败的三分类型(票A)。调用侧(mcp-runtime)只按本类型分流,
 * **禁止**再靠错误文案猜 —— 文案匹配正是上一版把网络抖动/invalid_client 全走
 * 交互式授权的成因。
 *  - temporary     :非确定性失败(网络、超时、SSRF 守卫拒发、5xx)⇒ 向上抛、可重试,**不得**起交互
 *  - invalid_grant :确定性失效(refresh_token 撤销/过期/重放被拒)⇒ 允许起交互式重新授权
 *  - invalid_client:不可自愈的配置错(本仓 clientId 一律出自用户静态配置,无动态注册路径 ⇒
 *                   invalid_client 重跑授权仍是同一个 client,起交互就是造环)⇒ 向上抛
 *  - undetermined  :等到了"换代但没有可用 token"这一格 ⇒ 如实报未判定,既不读成失败也不读成没有凭据
 */
export type McpRefreshFailureKind = 'temporary' | 'invalid_grant' | 'invalid_client' | 'undetermined';

export class McpRefreshError extends Error {
  readonly mcpRefreshKind: McpRefreshFailureKind;
  readonly retryable: boolean;
  constructor(kind: McpRefreshFailureKind, message: string, options?: { cause?: unknown }) {
    super(message, options !== undefined ? { cause: options.cause } : undefined);
    this.name = 'McpRefreshError';
    this.mcpRefreshKind = kind;
    this.retryable = kind === 'temporary';
  }
}

/** 读取任意错误的刷新失败类型(不依赖 instanceof:模块 mock/跨包副本下 instanceof 会失真) */
export function readMcpRefreshKind(err: unknown): McpRefreshFailureKind | undefined {
  if (err === null || typeof err !== 'object') return undefined;
  const raw = (err as { mcpRefreshKind?: unknown }).mcpRefreshKind;
  switch (raw) {
    case 'temporary':
    case 'invalid_grant':
    case 'invalid_client':
    case 'undetermined':
      return raw;
    default:
      return undefined;
  }
}

/** acquireLock 等待超时专用错误(票A:等锁超时 ≠ 刷新失败,调用侧要先重读再定性) */
export class McpLockTimeoutError extends Error {
  readonly mcpLockTimeout = true;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options !== undefined ? { cause: options.cause } : undefined);
    this.name = 'McpLockTimeoutError';
  }
}

function isLockTimeoutError(err: unknown): boolean {
  return err instanceof McpLockTimeoutError || (err !== null && typeof err === 'object' && (err as { mcpLockTimeout?: unknown }).mcpLockTimeout === true);
}

/**
 * token endpoint 返回的协议级错误(带 OAuth error code 或 4xx 文本里可识别的 code)。
 * 消息形态与旧版逐字同文(既有测试按 /token endpoint 返回 400/、/invalid_grant/ 断言),
 * 新增的 oauthError 字段只供单飞侧做三分,不改变任何旧行为。
 */
class OAuthProtocolError extends Error {
  readonly oauthError: string | undefined;
  constructor(message: string, oauthError?: string) {
    super(message);
    this.name = 'OAuthProtocolError';
    this.oauthError = oauthError;
  }
}

/** 从错误响应文本里识别确定性 OAuth error code;识别不出返回 undefined(绝不猜) */
function detectOauthErrorCode(text: string): string | undefined {
  if (/\binvalid_grant\b/.test(text)) return 'invalid_grant';
  if (/\binvalid_client\b/.test(text)) return 'invalid_client';
  return undefined;
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
  /**
   * token endpoint 的信任声明(D-1):仅当这份端点出自用户自己写的
   * `mcpServers[].auth.oauth.tokenEndpoint` 时才可传;由服务端元数据发现/远端下发的
   * 端点一律不得带 —— 无声明即默认档,内网与元数据地址照旧拒。
   */
  tokenEndpointTrust?: SelfHostedTrust;
  /**
   * 票A(2026-09-28):true ⇒ refreshAccessToken 走"跨进程单飞锁 + 代次 CAS + 失败三分"
   * 完整协议(见 refreshAccessTokenSingleFlight)。生产刷新路径(mcp-runtime 的 OAuth 刷新)
   * 必须开启;不开启时保持旧的纯网络语义,既有直接调用方零回归。
   */
  refreshSingleFlight?: boolean;
  /**
   * 单飞锁等待预算(ms)。缺省 = REFRESH_LOCK_WAIT_MS(45s);
   * 仅测试/特殊场景显式覆写,生产不传。
   */
  refreshLockWaitMs?: number;
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
  /** 实际监听的端口(port=0 时由 OS 分配,否则与入参一致) */
  actualPort: number;
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
export async function startOAuthFlow(
  config: OAuthConfig,
  portOverride?: number,
  /**
   * 依赖注入(测试用):可替换内部 startLocalCallbackServer / exchangeCodeForToken 的实现。
   * 生产代码无需传,默认走模块内导出。
   */
  deps?: {
    startLocalCallbackServer?: typeof startLocalCallbackServer;
  },
): Promise<OAuthResult> {
  // 1. 跨进程 dedup:已有 lock 且 PID 存活 → 等待其他进程完成
  await acquireLock(config.serverUrl);

  // 1.5 依赖注入默认值(测试可替换,生产用原实现)
  const _startLocalCallbackServer = deps?.startLocalCallbackServer ?? startLocalCallbackServer;

  try {
    // 2. 从 redirectUri 解析端口(portOverride 优先:用于测试场景下用 0 让 OS 分配空闲端口)
    const port =
      typeof portOverride === 'number' && portOverride >= 0
        ? portOverride
        : extractPort(config.redirectUri);
    if (port === null) {
      throw new Error(`redirectUri 缺少端口: ${config.redirectUri}`);
    }

    // 3. 生成 state + PKCE
    const state = randomBytes(16).toString('hex');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

    // 4. 启动本地 callback server(可被测试替换)
    const handle = _startLocalCallbackServer(port, state, OAUTH_TIMEOUT_MS);

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

  const waitForCode = new Promise<string>((resolve, reject) => {
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
    cleanup();
  };

  // 拿到 OS 实际分配的端口(port=0 时由系统决定)。
  // 注意:此处 server 在 Promise executor 内部被赋值,TS 控制流分析看不到,
  // 所以使用强类型转换保留 narrow 类型(避免被推成 never)。
  const serverRef = server as Server | null;
  let actualPort = port;
  if (serverRef !== null) {
    const addr = serverRef.address();
    if (addr && typeof addr === 'object' && typeof addr.port === 'number') {
      actualPort = addr.port;
    }
  }

  return { waitForCode, close, actualPort };
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

  const json = await postTokenEndpoint(config.tokenEndpoint, body, config.tokenEndpointTrust);
  if (!json.access_token) {
    throw new Error('token endpoint 响应缺少 access_token');
  }
  return parseTokenResponse(json, config.scope);
}

/**
 * 用 refresh_token 刷新 access_token(凭证过期时由 ManagedMcpClient / mcp-runtime 调用)。
 *
 * 票A:config.refreshSingleFlight=true 时进入"跨进程单飞 + 代次 CAS + 失败三分"协议
 * (生产刷新路径必须开);否则保持旧的纯网络语义(既有直接调用方零回归)。
 */
export async function refreshAccessToken(
  config: OAuthConfig,
  refreshToken: string,
): Promise<OAuthResult> {
  if (!config.refreshSingleFlight) {
    return refreshAccessTokenOnce(config, refreshToken);
  }
  return refreshAccessTokenSingleFlight(config, refreshToken);
}

/** 旧的一次性网络刷新(无锁无落盘),行为与票A 改动前逐字一致 */
async function refreshAccessTokenOnce(
  config: OAuthConfig,
  refreshToken: string,
): Promise<OAuthResult> {
  const body = new URLSearchParams();
  body.set('grant_type', 'refresh_token');
  body.set('refresh_token', refreshToken);
  body.set('client_id', config.clientId);
  if (config.clientSecret) body.set('client_secret', config.clientSecret);

  const json = await postTokenEndpoint(config.tokenEndpoint, body, config.tokenEndpointTrust);
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

/**
 * 跨进程单飞刷新(票A 的核心协议,一步都不能少):
 *   ① 取锁**前**先观察 generation;
 *   ② acquireLock(复用本文件既有那一份判活/抢占实现,锁路径 = mcp-refresh.lock,
 *      与被保护的 mcp-credentials.json **不同路径** —— 同路径会自重入死锁);
 *   ③ 锁内**再**读 generation:已换代 ⇒ 零二次请求,复用 winner 落库结果;
 *      winner 没留可用 token ⇒ 如实判 undetermined,绝不读成"没有凭据";
 *   ④ 未换代 ⇒ 发唯一一次 refresh(失败按三分抛 McpRefreshError);
 *   ⑤ commitCredentialCas(expectedGeneration=观察值)提交;CAS 输给了插队的 winner ⇒
 *      同样复用其结果或判 undetermined;
 *   ⑥ 等锁超时 ≠ 刷新失败:先重读,换代且有可用 token ⇒ 直接用;否则按 temporary 抛。
 */
async function refreshAccessTokenSingleFlight(
  config: OAuthConfig,
  refreshToken: string,
): Promise<OAuthResult> {
  const serverUrl = config.serverUrl;
  const waitMs = config.refreshLockWaitMs ?? REFRESH_LOCK_WAIT_MS;

  // ① 锁前观察
  const before = await getCredentialWithGeneration(serverUrl);

  let lockAcquired = false;
  try {
    // ② 跨进程单飞锁(预算覆盖 discovery + token 请求,见 REFRESH_LOCK_WAIT_MS 注释)
    await acquireLock(serverUrl, { lockPath: getRefreshLockPath(), timeoutMs: waitMs });
    lockAcquired = true;

    // ③ 锁内复核代次
    const during = await getCredentialWithGeneration(serverUrl);
    if (during.generation !== before.generation) {
      const replay = await replayWinnerResult(during.entry);
      if (replay !== null) return replay;
      throw new McpRefreshError(
        'undetermined',
        `锁内发现凭据已换代(${before.generation}→${during.generation})但 winner 未留下可用 access_token —— ` +
          `判"未判定",不读成没有凭据,也不起交互式授权;稍后重试或人工确认`,
      );
    }

    // ④ 唯一一次网络刷新
    let refreshed: OAuthResult;
    try {
      refreshed = await refreshAccessTokenOnce(config, refreshToken);
    } catch (err) {
      throw classifyRefreshError(err);
    }

    // ⑤ 代次 CAS 提交(锁内落库,等待方出锁后必须看得见这份结果)
    const commit = await commitCredentialCas(
      serverUrl,
      {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: refreshed.expiresAt,
        scope: refreshed.scope,
        obtainedAt: Date.now(),
      },
      before.generation,
    );
    if (!commit.committed) {
      // CAS 失败 = 有写方绕过锁插了队:它的结果优先,绝不覆盖
      const replay = await replayWinnerResult(commit.current);
      if (replay !== null) return replay;
      throw new McpRefreshError(
        'undetermined',
        `CAS 提交遇换代(${before.generation}→${commit.generation})且当前 entry 无可用 access_token —— 判未判定`,
      );
    }
    return refreshed;
  } catch (err) {
    // ⑥ 等锁超时 ⇒ 先重读再定性,绝不把"没等到"读成"刷坏了"
    if (isLockTimeoutError(err)) {
      const after = await getCredentialWithGeneration(serverUrl);
      if (after.generation !== before.generation) {
        const replay = await replayWinnerResult(after.entry);
        if (replay !== null) return replay;
        throw new McpRefreshError(
          'undetermined',
          `等锁超时且凭据已换代(${before.generation}→${after.generation})但无可用 token —— 判未判定`,
          { cause: err },
        );
      }
      throw new McpRefreshError(
        'temporary',
        `等锁超时(${waitMs}ms)且未观察到换代 —— 按瞬态失败上报(可重试),不起交互式授权`,
        { cause: err },
      );
    }
    // 刷新出口一律带类型:已分好类的原样上抛;判不出类型的(落盘 IO 等)按 temporary,
    // 绝不把"没分出来"静默成"没发生"。
    if (readMcpRefreshKind(err) !== undefined) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new McpRefreshError('temporary', `刷新出口未分类型的失败(按瞬态处理,可重试): ${message}`, {
      cause: err,
    });
  } finally {
    if (lockAcquired) {
      await releaseLock({ lockPath: getRefreshLockPath() });
    }
  }
}

/** 把 winner 落库的 entry 折算成 OAuthResult;无 token 或已到期(skew 0)⇒ null(交给未判定档) */
async function replayWinnerResult(entry: McpCredentialEntry | undefined): Promise<OAuthResult | null> {
  if (!entry?.accessToken) return null;
  if (await isExpired(entry, 0)) return null;
  return {
    accessToken: entry.accessToken,
    refreshToken: entry.refreshToken,
    expiresAt: entry.expiresAt ?? Date.now() + 3600 * 1000,
    scope: entry.scope ?? [],
  };
}

/** 失败三分(票A):只有 invalid_grant 算确定性失效;invalid_client 判配置错;其余一律 temporary */
function classifyRefreshError(err: unknown): McpRefreshError {
  const message = err instanceof Error ? err.message : String(err);
  const oauthError = err instanceof OAuthProtocolError ? err.oauthError : undefined;
  if (oauthError === 'invalid_grant') {
    return new McpRefreshError(
      'invalid_grant',
      `refresh_token 确定性失效(invalid_grant),需要重新授权: ${message}`,
      { cause: err },
    );
  }
  if (oauthError === 'invalid_client') {
    // 本仓 clientId 一律出自 mcpServers 用户静态配置(无动态注册路径)⇒ 重跑授权用的还是
    // 同一个 client,必然撞同一个错 —— 起交互式就是造环,这是不可自愈的配置错。
    return new McpRefreshError(
      'invalid_client',
      `client 认证失败(invalid_client),clientId 为静态配置 —— 配置错,不起交互式授权`,
      { cause: err },
    );
  }
  return new McpRefreshError('temporary', `刷新未完成(瞬态失败,可重试): ${message}`, { cause: err });
}

/** POST 到 token endpoint,返回解析后的 JSON,处理 HTTP/网络错误 */
async function postTokenEndpoint(
  tokenEndpoint: string,
  body: URLSearchParams,
  trust?: SelfHostedTrust,
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
    // 出站前过一次共享 SSRF 守卫。此前这条 POST 完全没有守卫:tokenEndpoint 可能出自
    // 服务端元数据下发(远端可控),带着 client_secret 打内网或元数据地址即 SSRF。
    const verdict = await assertSafeFetchUrl(tokenEndpoint, { selfHosted: trust });
    if (!verdict.safe) throw new Error(formatSsrfRejection(verdict));
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
      // 票A:文本里能识别出确定性 error code 时带出来供三分;识别不出保持旧语义。
      // 消息形态与旧版逐字同文(既有测试按 /token endpoint 返回 400/ 断言)。
      throw new OAuthProtocolError(
        `token endpoint 返回 ${resp.status}: ${errText.slice(0, 200)}`,
        detectOauthErrorCode(errText),
      );
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
      throw new OAuthProtocolError(
        `token endpoint 错误: ${json.error} ${json.error_description ?? ''}`,
        json.error,
      );
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
      const proc = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true });
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
 *   - lock 存在且 PID 存活 → 轮询等待 lock 被释放(最多 timeoutMs,缺省 OAUTH_TIMEOUT_MS)
 *   - lock 存在但 PID 已死 → 删除 lock,重新获取
 *
 * 票A:锁路径与等待预算参数化 —— **复用这同一份判活/抢占实现**,不在别处再抄第二份。
 * opts 缺省时行为与旧签名逐字等价(交互授权路径零回归)。
 */
export async function acquireLock(
  serverUrl: string,
  opts?: { lockPath?: string; timeoutMs?: number },
): Promise<void> {
  const lockPath = opts?.lockPath ?? getLockPath();
  const timeoutMs = opts?.timeoutMs ?? OAUTH_TIMEOUT_MS;
  const dir = path.dirname(lockPath);
  await fs.mkdir(dir, { recursive: true });

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    let existing: LockInfo | null = null;
    try {
      const raw = await fs.readFile(lockPath, 'utf-8');
      const parsed = tryParseJson(raw);
      // 非 lock 结构(如 null/数组/缺 pid)视为损坏 lock,删除后重新获取,
      // 防止 existing.pid 在 try 外触发 TypeError 逃逸
      existing =
        isRecord(parsed) && typeof parsed.pid === 'number' ? (parsed as unknown as LockInfo) : null;
      if (existing === null && parsed !== undefined) {
        try {
          await fs.unlink(lockPath);
        } catch {
          // 忽略
        }
      }
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
  throw new McpLockTimeoutError(`OAuth lock 等待超时 (${timeoutMs}ms),其他进程未释放 ${lockPath}`);
}

/** 释放 lock 文件(仅当 PID 匹配当前进程时才删除)。opts 缺省 = 交互授权锁(旧行为)。 */
export async function releaseLock(opts?: { lockPath?: string }): Promise<void> {
  const lockPath = opts?.lockPath ?? getLockPath();
  try {
    const raw = await fs.readFile(lockPath, 'utf-8');
    const info = tryParseJson(raw);
    if (isRecord(info) && typeof info.pid === 'number' && info.pid === process.pid) {
      await fs.unlink(lockPath);
    }
    // PID 不匹配/结构非法则不动(可能是其他进程的 lock 或已损坏)
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
    const parsed = tryParseJson(raw);
    return isRecord(parsed) ? (parsed as unknown as LockInfo) : null;
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
