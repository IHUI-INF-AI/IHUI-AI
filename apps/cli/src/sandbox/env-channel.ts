// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 子进程环境白名单通道 —— 「宿主环境只给必需的，其余一律不进」。
 *
 * ## 为什么不是又一张黑名单
 *
 * `env-guard.ts` 是归类表 + 黑名单语义：**未登记的键默认放行**（它自己文档里写了
 * 这个刻意的取舍）。黑名单的固有缺口是"没列进去就穿透"——新增一个会泄漏会话身份的
 * 键（`*_SESSION_ID` / `*_OWNER_KEY` / 新的 `*_TOKEN`），在有人想起补表之前一直是漏的。
 *
 * 本模块补的是**相反的一条腿**：白名单语义。宿主环境进子进程时默认**什么都不给**，
 * 只有显式列进 `HOST_PASSTHROUGH_*` 的必需键才透传；会话键、疑似凭据名一律拦下并
 * 给出原因码。两条腿并存：`env-guard` 管"已知该走别处的键"，本模块管"没被点名的键"。
 *
 * 对齐依据（2026-11-23 五程序原生取证 B4-02）：`lite-wb.mjs` 的 L358 白名单
 * （`USERPROFILE` / `SYSTEMROOT` / `TEMP` 等必需键）与隔离集
 * （`*_SESSION_ID` / `*_OWNER_KEY` 等），以及 `daemon-supervisor.cjs` 的
 * `CODEBUDDY_INTERNAL_DAEMON_CHANNEL` / `CODEBUDDY_SESSION_KIND` 显式通道键。
 * 只取**白名单 + 隔离集 + 可诊断丢弃**这套纪律，不搬运任何代码。
 *
 * ## 三条硬约束
 *
 * ① **默认不进**：宿主环境里未被点名的键一律不传（`dropped` 记原因码，不记值）。
 * ② **值不出日志**：`dropped` / `denied` 只带键名与原因，绝不回传值——被丢的往往
 *    正是凭据，把它打进日志等于换个地方泄漏。
 * ③ **大小写不敏感**：Windows 环境变量名大小写不敏感（`Path` / `PATH` 是同一个），
 *    白名单匹配统一 fold 到 upper，输出时保留宿主原始键名与值。
 */

import { checkEnvKey } from './env-guard'

/** 宿主必需键 —— Windows。少一个都可能导致子进程起不来或找不到系统 DLL。 */
export const HOST_PASSTHROUGH_WINDOWS: readonly string[] = Object.freeze([
  'PATH',
  'PATHEXT',
  'SYSTEMROOT',
  'SYSTEMDRIVE',
  'WINDIR',
  'COMSPEC',
  'TEMP',
  'TMP',
  'USERPROFILE',
  'HOMEDRIVE',
  'HOMEPATH',
  'APPDATA',
  'LOCALAPPDATA',
  'PROGRAMDATA',
  'PROGRAMFILES',
  'PROGRAMFILES(X86)',
  'COMMONPROGRAMFILES',
  'NUMBER_OF_PROCESSORS',
  'OS',
  'PROCESSOR_ARCHITECTURE',
  'PROCESSOR_IDENTIFIER',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TZ',
])

/** 宿主必需键 —— POSIX。 */
export const HOST_PASSTHROUGH_POSIX: readonly string[] = Object.freeze([
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TMPDIR',
  'TZ',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TERM',
])

/** 会话身份类键的后缀：这些键一旦进子进程，子进程就能冒充当前会话。 */
const ISOLATION_SUFFIXES: readonly string[] = Object.freeze([
  '_SESSION_ID',
  '_OWNER_KEY',
  '_SESSION_KEY',
  '_SESSION_TOKEN',
  '_WORKER_ID',
])

/** 疑似凭据的键名片段（不含白名单命中者）。 */
const SECRET_LIKE_PARTS: readonly string[] = Object.freeze([
  'API_KEY',
  'APIKEY',
  'ACCESS_TOKEN',
  'AUTH_TOKEN',
  'SECRET',
  'PASSWORD',
  'PASSWD',
  'CREDENTIAL',
  'PRIVATE_KEY',
])

/** 丢弃原因码（可诊断、不含值）。 */
export type EnvDropReason =
  /** 不在白名单里（默认不进）。 */
  | 'not_in_whitelist'
  /** 会话身份键（隔离集命中）。 */
  | 'session_key_isolation'
  /** 疑似凭据名。 */
  | 'secret_like_name'
  /** 经 `env-guard` 归类表判定不该走 env（如 `IHUI_API_TOKEN`）。 */
  | 'guarded_forbidden'
  /** 键名/值形态非法（含 `=` / NUL / 非字符串）。 */
  | 'malformed'

/** 一个被丢弃的键。**不带值**。 */
export interface EnvDrop {
  readonly key: string
  readonly reason: EnvDropReason
  /** 人话补充（为什么丢 / 该走哪条通道），不含值。 */
  readonly why: string
}

/** 构造结果。 */
export interface ChildEnvResult {
  /** 真正要传给子进程的环境。 */
  readonly env: Readonly<Record<string, string>>
  /** 被丢弃的键（键名 + 原因，无值）。 */
  readonly dropped: readonly EnvDrop[]
  /** 实际保留的键（排序后，供审计对账）。 */
  readonly kept: readonly string[]
}

function foldUpper(name: string): string {
  return name.toUpperCase()
}

function isWhitelisted(key: string, whitelist: ReadonlySet<string>): boolean {
  return whitelist.has(foldUpper(key))
}

function isolationHit(key: string): boolean {
  const upper = foldUpper(key)
  return ISOLATION_SUFFIXES.some((suffix) => upper.endsWith(suffix))
}

function secretLikeHit(key: string): boolean {
  const upper = foldUpper(key)
  // `_TOKEN` 只按**后缀**判：用 includes 会把 `IHUI_COMPACTED_TOKENS_BEFORE`
  // 这类计数键误杀（它含 `_TOKEN` 子串但不是凭据）。
  if (upper.endsWith('_TOKEN')) return true
  return SECRET_LIKE_PARTS.some((part) => upper.includes(part))
}

/**
 * 依平台取宿主白名单（`process.platform` 之外的平台按 POSIX 处理并在调用方标注）。
 */
export function hostWhitelistFor(
  platform: NodeJS.Platform | string = process.platform,
): readonly string[] {
  return platform === 'win32' ? HOST_PASSTHROUGH_WINDOWS : HOST_PASSTHROUGH_POSIX
}

/**
 * 构造子进程的 env（白名单语义）。
 *
 * @param host 宿主环境（通常 `process.env`）。
 * @param extras 调用方追加的键（如工具配置）；**同样**要过白名单/隔离/凭据三道判定，
 *               只有已被点名的白名单键或非敏感的自定义键才会进——见 `allowExtraKeys`。
 * @param platform 平台（决定白名单集），默认当前进程平台。
 *
 * 规则：
 * 1. 宿主键：白名单内 ⇒ 透传；不在白名单 ⇒ `not_in_whitelist`。
 * 2. 隔离集（`*_SESSION_ID` 等）：**无论是否在白名单**都拦（白名单里本就没有它们）。
 * 3. 疑似凭据名：拦（`secret_like_name`）。
 * 4. `extras`：先过 `env-guard.checkEnvKey`（`forbidden`/`set-by-us` 直接拒），
 *    再过隔离集与凭据名判定；全部通过才进。**未在白名单的自定义键默认不进**
 *    ——这正是与 `env-guard` 相反的那条腿，调用方要传自定义键必须显式走 `extras`。
 */
export function buildChildEnv(
  host: Readonly<Record<string, string | undefined>>,
  extras: Readonly<Record<string, string | undefined>> = {},
  platform: NodeJS.Platform | string = process.platform,
): ChildEnvResult {
  const whitelist = new Set(hostWhitelistFor(platform).map(foldUpper))
  const env: Record<string, string> = {}
  const dropped: EnvDrop[] = []

  for (const [key, value] of Object.entries(host)) {
    if (value === undefined) continue
    if (isolationHit(key)) {
      dropped.push({
        key,
        reason: 'session_key_isolation',
        why: '会话身份键不进子进程（否则子进程可冒充当前会话）',
      })
      continue
    }
    if (secretLikeHit(key) && !isWhitelisted(key, whitelist)) {
      dropped.push({
        key,
        reason: 'secret_like_name',
        why: '疑似凭据名不进 env（env 会进 /proc/<pid>/environ 与崩溃日志）',
      })
      continue
    }
    if (!isWhitelisted(key, whitelist)) {
      dropped.push({ key, reason: 'not_in_whitelist', why: '宿主键未列入白名单（默认不进）' })
      continue
    }
    env[key] = value
  }

  for (const [key, value] of Object.entries(extras)) {
    if (value === undefined) continue
    const verdict = checkEnvKey(key)
    if (!verdict.ok) {
      dropped.push({ key, reason: 'guarded_forbidden', why: verdict.reason })
      continue
    }
    // 顺序要紧：先判凭据形态（`*_SESSION_TOKEN` 这类既会话又凭据的键必须拦），
    // 再判隔离（显式授权放行）。反过来的话 token 会被当成普通会话键放出去。
    if (secretLikeHit(key)) {
      dropped.push({
        key,
        reason: 'secret_like_name',
        why: '疑似凭据名不进 env（env 会进 /proc/<pid>/environ 与崩溃日志）',
      })
      continue
    }
    if (isolationHit(key)) {
      // 显式通道即授权：调用方点名的会话键**可以**进（hook 上下文就靠这条）。
      // 拦的是宿主环境里同名键的「意外继承」——那才是子进程冒充会话的来源。
      env[key] = value
      continue
    }
    env[key] = value
  }

  return {
    env,
    dropped,
    kept: Object.keys(env).sort(),
  }
}

/** 只问「这个键会不会被丢」——给调用方在构造前自检用（纯判定，无副作用）。 */
export function wouldDrop(
  key: string,
  platform: NodeJS.Platform | string = process.platform,
): EnvDropReason | undefined {
  if (key === '' || key.includes('=') || key.includes('\u0000')) return 'malformed'
  if (isolationHit(key)) return 'session_key_isolation'
  const whitelist = new Set(hostWhitelistFor(platform).map(foldUpper))
  if (secretLikeHit(key) && !isWhitelisted(key, whitelist)) return 'secret_like_name'
  if (!isWhitelisted(key, whitelist)) return 'not_in_whitelist'
  return undefined
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
