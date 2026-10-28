// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Token Manager — 统一管理 access token / refresh token 自动续期。
 *
 * 解决问题:后端 access token 默认 15min 过期,CLI 之前每次过期都要用户手动重登录,
 * 体验极差。本模块封装"检测过期 → 用 refresh token 调 /api/auth/refresh → 持久化新 token"流程。
 *
 * 使用方式:
 *   import { ensureFreshAccessToken } from './token-manager.js';
 *   const token = await ensureFreshAccessToken(apiUrl);
 *   if (!token) { /* 无 token 或 refresh 失败,让用户重新 ihui login *\/ }
 *
 * 设计:
 *   - 检测 access token 是否过期:JWT payload 解析 exp 字段,提前 30s 视为过期(避免请求中途过期)
 *   - refresh 失败时返回原 token,让上游 API 返回 401,由调用方提示用户重新登录
 *   - 并发去重:多个命令同时调用 ensureFreshAccessToken 时,只触发一次 refresh
 *   - O12 机器凭据隔离:`apiKey` 为服务端 API Key(ihui_ 前缀)时**不参与续期**
 *     (它没有 exp / refresh 语义),原样返回;落盘守卫亦拒绝用 JWT 覆盖机器凭据。
 *   - **失败固化台账(不是 single-flight)**:`inflightRefresh` 那套"只缓存那一次
 *     Promise"的去重只保证"并发只做一次",不保证"第 N 个迟到者拿到第 1 个的失败原因"。
 *     现由 `InflightLedger` 记录成功与失败两态,见 `util/inflight-ledger.ts` 的 A/B/C 三条判据。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { getSettingsPath, loadSettings, type Settings } from './settings.js';
import { tryParseJson, isRecord } from '../util/json.js';
import { classifyCredential, isMachineCredential, decodeJwtClaims } from '../config/credentials.js';
import {
  InflightLedger,
  LedgerFailure,
  type LedgerFailureCode,
} from '../util/inflight-ledger.js';

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

/** 解析 JWT payload(不验证签名,仅用于读取 exp)。失败返回 null。 */
function decodeJwtExp(token: string): number | null {
  // 解码实现全 CLI 只有一份(§"两处算同一件事必须共用一份实现");本函数只负责取 exp
  const payload = decodeJwtClaims(token);
  return typeof payload?.exp === 'number' ? payload.exp : null;
}

/** 提前 30s 视为过期(避免请求中途过期)。 */
const EXPIRY_LEAD_TIME_SECONDS = 30;

/** 检测 access token 是否即将过期(或已过期)。无 token / 解析失败均视为需要 refresh。 */
export function isAccessTokenExpired(token: string | undefined): boolean {
  if (!token) return true;
  const exp = decodeJwtExp(token);
  if (exp === null) return true; // 解析失败保守视为过期,让 API 报 401
  const now = Math.floor(Date.now() / 1000);
  return now + EXPIRY_LEAD_TIME_SECONDS >= exp;
}

/**
 * 持久化新 token 对到 settings.json(保留其他字段)。
 *
 * O12 凭据种类显式化:
 *   - 既有 apiKey 是机器凭据(ihui_ 前缀)时**拒绝覆盖** —— 人的 JWT 不得挤掉机器凭据,
 *     否则一次意外的续期就会静默改掉 serve/CI 用的机器身份。此处按**前缀**判定而非按
 *     声明判定:`ihui_` 开头就是服务端 API Key,与 settings 里写了什么无关,保护必须比
 *     声明更硬。
 *   - 写入成功时把 `credentialKind` 落为 `'jwt'`(仅当原先未显式声明),
 *     把"apiKey 里塞的是 JWT"这一历史隐含事实变成显式记录。
 * 返回是否真正写入(供调用方诊断)。
 */
function persistTokens(accessToken: string, refreshToken: string): boolean {
  const settingsPath = getSettingsPath();
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  let existing: Settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      // 损坏/非对象(如数组、标量)一律从头建,防止把数组误当 Settings 写丢 token
      const parsed = tryParseJson(raw);
      if (isRecord(parsed)) existing = parsed as Settings;
    } catch {
      // 读文件失败,从头建
    }
  }
  if (classifyCredential(existing.apiKey) === 'api_key') {
    return false;
  }
  existing.apiKey = accessToken;
  existing.refreshToken = refreshToken;
  if (existing.credentialKind === undefined || existing.credentialKind === 'auto') {
    existing.credentialKind = 'jwt';
  }
  fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2) + '\n', 'utf-8');
  return true;
}

/** 单次 refresh 的 HTTP 超时。到点归因必须是 `timeout`,不得与网络错混成一类。 */
const REFRESH_TIMEOUT_MS = 10_000;

/**
 * refresh 失败答案对**迟到者**保持有效的窗口。
 * 取值理由:要大于一次 refresh 的上界(10s),否则"第一批命令还在等、窗口先到期",
 * 迟到者仍会重发一次;又要明显小于人的重试节奏(重新登录 / 下一条命令),
 * 否则一次瞬时网络抖动会把续期永久锁死。
 */
const REFRESH_FAILURE_MEMO_MS = 30_000;

/**
 * 调用 /api/auth/refresh 换新 token。
 *
 * **失败一律抛 `LedgerFailure` 并带封闭集原因码**,不再"返回 null 由上游再判"——
 * 返回 null 会把 timeout / 网络错 / 服务端拒绝 / 用户取消四件事压成同一句话,
 * 而台账能固化的一切前提就是"失败是有成因的"。对外契约(失败时把原 token 交回去)
 * 由 `ensureFreshAccessToken` 在边界上维持,见其注释。
 *
 * 原因码归类:
 *  - 外部 signal 取消 → `cancelled`(这是人的动作,不是刷新失败)
 *  - 自身定时器到点 → `timeout`
 *  - 4xx / 响应体不合契约 → `auth`(该重新登录)
 *  - 5xx 及其余抛错(含 DNS/连接失败)→ `network`(可重试)
 */
async function refreshTokens(
  apiUrl: string,
  refreshToken: string,
  externalSignal?: AbortSignal,
): Promise<RefreshResponse> {
  const url = `${apiUrl.replace(/\/+$/, '')}/api/auth/refresh`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
  // 一个还没响的 setTimeout 会把 CLI 的退出拖到上界(与 A10A-2 撤闹钟同一条理由):
  // 续期不该成为"进程退不掉"的原因。
  timer.unref?.();
  // 把外部取消接到同一个 controller 上:两条取消路径共用一处中止逻辑,不各写一遍
  const relayAbort = (): void => controller.abort(externalSignal?.reason);
  externalSignal?.addEventListener('abort', relayAbort, { once: true });
  try {
    if (externalSignal?.aborted) {
      throw new LedgerFailure('cancelled', 'token 续期在发起前已被取消', externalSignal.reason);
    }
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    });
    // 先判是否被取消/超时中止,再看状态码:中止会同时让 resp.ok 为 false,
    // 判序反了就把"用户取消"报成了"服务端拒绝"。
    if (externalSignal?.aborted) {
      throw new LedgerFailure('cancelled', 'token 续期被取消', externalSignal.reason);
    }
    if (controller.signal.aborted) {
      throw new LedgerFailure('timeout', `token 续期超过 ${REFRESH_TIMEOUT_MS}ms 未返回`, controller.signal.reason);
    }
    if (!resp.ok) {
      const code: LedgerFailureCode = resp.status >= 500 ? 'network' : 'auth';
      throw new LedgerFailure(code, `token 续期被服务端拒绝(HTTP ${resp.status})`);
    }
    const text = await resp.text();
    const parsed = JSON.parse(text) as { code?: number; data?: RefreshResponse };
    if (parsed.code !== 0 || !parsed.data) {
      throw new LedgerFailure('auth', 'token 续期响应体不符合契约(缺 code=0 或 data)');
    }
    return parsed.data;
  } catch (err) {
    if (err instanceof LedgerFailure) throw err;
    throw new LedgerFailure('network', `token 续期请求失败: ${err instanceof Error ? err.message : String(err)}`, err);
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', relayAbort);
  }
}

/**
 * 并发去重 + 失败固化台账(取代旧的 `inflightRefresh: Promise | null` 单槽)。
 * 导出是为了让上层与测试能在不改变 `ensureFreshAccessToken` 返回契约的前提下
 * 用 `peekFailure(key)` 问出"这件事上一次为什么没成"。
 */
export const tokenRefreshLedger = new InflightLedger<string>({
  failureMemoMs: REFRESH_FAILURE_MEMO_MS,
});

/**
 * 台账键:apiUrl + refreshToken 的哈希。
 * 为什么键里要带 refreshToken —— 用户重新登录后 refreshToken 变了,那是**另一件事**,
 * 若键只按 apiUrl,上一次固化下来的失败会把新凭据的首次续期也一起拒掉
 * ("取消/失败要改写被等待的事实"不能越界改写到没被等过的那件事上)。
 * 用哈希而不是原值:失败答案会在进程内被复用并写进 message,不能顺手带上凭据材料。
 */
function refreshLedgerKey(apiUrl: string, refreshToken: string): string {
  return createHash('sha256')
    .update(`${apiUrl.replace(/\/+$/, '')}|${refreshToken}`)
    .digest('hex')
    .slice(0, 16);
}

export interface EnsureFreshAccessTokenOptions {
  /** 取消信号:取消会以 `cancelled` 原因码固化进台账,而不是悄悄返回一个旧 token */
  signal?: AbortSignal;
  /** 注入台账(测试用);生产不传,走模块级唯一实例 */
  ledger?: InflightLedger<string>;
}

/**
 * 确保 access token 有效:未过期直接返回;过期则用 refresh token 自动续期。
 *
 * 返回值:
 *   - string:有效的 access token,可直接用于 Authorization: Bearer <token>
 *   - null:无 token,或 refresh 失败(调用方应提示用户 `ihui login`)
 *
 * 并发安全:多个命令同时调用时,只触发一次 refresh,共享同一 Promise。
 * **失败固化**:第一个失败(含超时/取消)之后,在 `REFRESH_FAILURE_MEMO_MS` 窗口内
 * 再问一次的人立刻拿到同一份带原因的结果,而不是各自重挂一个 10s HTTP 超时。
 *
 * 对外契约保持不变的一点(刻意):失败仍然"返回原 access token / null",由上游 API
 * 报 401。改成抛错会波及 developer.ts / http-utils.ts 等既有调用方,而本票的范围是
 * 把失败**归因**做对,不是重排错误处理链。归因结果可从 `tokenRefreshLedger.peekFailure`
 * 取到,需要区分成因的调用方用它,不要靠 message 文本猜。
 */
export async function ensureFreshAccessToken(
  apiUrl: string,
  opts?: EnsureFreshAccessTokenOptions,
): Promise<string | null> {
  const settings = loadSettings();
  const accessToken = settings.apiKey;

  // O12:机器凭据(ihui_ API Key)不参与本地续期 —— 它没有 exp / refresh 语义。
  // 若放任它进入 refresh 分支,会拿"上次登录残留的 refreshToken"去换人的 JWT 并覆盖
  // apiKey,造成凭据串型(机器身份被人身份悄悄替换)。
  if (isMachineCredential(accessToken, settings.credentialKind ?? 'auto')) {
    return accessToken ?? null;
  }

  // 1. access token 未过期,直接返回
  if (accessToken && !isAccessTokenExpired(accessToken)) {
    return accessToken;
  }

  // 2. access token 过期,需要 refresh
  const refreshToken = settings.refreshToken;
  if (!refreshToken) {
    // 无 refresh token,无法续期
    return accessToken ?? null;
  }

  // 3. 台账:在途复用同一 Promise / 迟到者立刻拿到已固化的失败
  const ledger = opts?.ledger ?? tokenRefreshLedger;
  const key = refreshLedgerKey(apiUrl, refreshToken);
  try {
    return await ledger.run(
      key,
      async () => {
        const result = await refreshTokens(apiUrl, refreshToken, opts?.signal);
        // 落盘放在 task 内:一次成功的 refresh 对 settings.json 只写一遍,
        // 复用在途 Promise 的迟到者不会再触发第二次写入(旧写法也是这个形状)。
        persistTokens(result.accessToken, result.refreshToken);
        return result.accessToken;
      },
      { signal: opts?.signal },
    );
  } catch {
    // 失败已固化在台账里(原因码见 refreshTokens 的归类)。这里只维持对外契约:
    // 把原 access token 交回去,让上游 API 报 401。
    // 需要区分成因的调用方用 `readRefreshFailure`,不要靠 message 文本猜。
    return accessToken ?? null;
  }
}

/**
 * 读取"当前这套凭据上一次续期为什么没成"(已固化的失败)。没有则 null。
 *
 * 存在的理由:`ensureFreshAccessToken` 的返回契约是 `string | null`,而 null 同时
 * 意味着"没凭据"和"续期失败",这两件事的处置动作完全不同(前者要 login,后者要看是
 * 该重试的 network/timeout 还是该重登的 auth/cancelled)。不改返回契约,就得另开一个
 * **只读**出口;键的推导与台账共用 `refreshLedgerKey`,不另算一份。
 */
export function readRefreshFailure(apiUrl: string, ledger?: InflightLedger<string>): LedgerFailure | null {
  const refreshToken = loadSettings().refreshToken;
  if (!refreshToken) return null;
  return (ledger ?? tokenRefreshLedger).peekFailure(refreshLedgerKey(apiUrl, refreshToken));
}

/** 「这次没拿到可用 token」的默认提示(现状文案,逐字不变)。 */
export const NO_TOKEN_HINT = '✗ 未登录或 token 已失效,请运行: ihui login';

/**
 * 原因码 → 给人看的那句话。`Record<LedgerFailureCode, …>` 让这张表**在类型层就被
 * 封闭集约束**:新增一档原因码而不给它文案,`tsc` 直接报错 —— 这正是"判据只能有一份"
 * 的可执行形态(调用点不许再写 `err.message.includes(...)`,那是在别处重算一遍成因)。
 *
 * 三档文案的处置动作互不相同,压成一句就是误导人:
 *  - `auth` 该重新登录;
 *  - `network` / `timeout` 稍后重试即可,**不需要**重新登录(旧文案在此是错的引导);
 *  - `cancelled` 是人的动作,不得与失败混写。
 */
const HINT_BY_FAILURE_CODE: Record<LedgerFailureCode, string> = {
  auth: NO_TOKEN_HINT,
  network: '✗ token 续期失败(网络/超时),稍后重试即可,不需要重新登录',
  timeout: '✗ token 续期失败(网络/超时),稍后重试即可,不需要重新登录',
  cancelled: '✗ token 续期已被取消,本次命令没有执行,重新运行即可',
};

/**
 * 纯投影:**台账无记录 ⇒ 返回现状文案,绝不伪造成因**。
 * 单独成函数是因为"成因到人"这一格的判据必须可测,而不必先把 settings.json / 网络
 * 状态摆出来(那属于 `readRefreshFailure` 自己的职责)。
 */
export function hintForRefreshFailure(failure: LedgerFailure | null): string {
  return failure ? HINT_BY_FAILURE_CODE[failure.code] : NO_TOKEN_HINT;
}

/**
 * 命令层拿不到 token 时该喊的那句话 —— 把成因接到人的**唯一出口**。
 * 消费点(`commands/*.ts` 的"未登录"分支)一律调它,不得各自再判一遍。
 * 取不到成因(`readRefreshFailure` 返回 null)时退回现状文案。
 */
export function missingTokenHint(apiUrl: string, ledger?: InflightLedger<string>): string {
  return hintForRefreshFailure(readRefreshFailure(apiUrl, ledger));
}

/**
 * 同步获取 access token(不触发 refresh)。
 * 用于不需要自动续期的场景(如显示当前 token 状态)。
 */
export function getAccessTokenSync(): string | undefined {
  return loadSettings().apiKey;
}

/** 同步获取 refresh token。 */
export function getRefreshTokenSync(): string | undefined {
  return loadSettings().refreshToken;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
