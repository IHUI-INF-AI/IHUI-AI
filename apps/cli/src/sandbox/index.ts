// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 子进程沙盒 — 为命令执行提供资源限制与路径白名单。
 *
 * 灵感来源:参考行业 Agent 框架的 sandbox 模块(命令执行隔离 + 资源上限)。
 * 简化策略(做减法):
 *   - 基于 node:child_process spawnSync(shell 模式)
 *   - 资源限制:超时(timeoutMs)/ 最大输出(maxOutputBytes)/ 内存(maxMemoryBytes,POSIX)/ CPU(maxCpuMs,POSIX)
 *   - 路径白名单(allowedPaths):cwd 之外的路径需显式授权,防止越权访问
 *   - 不实现 chroot/namespace 级隔离(超出 Node 能力范围)
 */

import { spawnSync, spawn, type SpawnSyncOptions, type SpawnOptions, type ChildProcess } from 'node:child_process';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';

// 失败归因/安全边界文案走 cli 语言包(AGENTS §19)。与 tools/command-safety.ts 同一既有形态
// (端内同层 import,不新建跨层依赖)。失效方向:t() 取不到键时回显键名,且各条 note 的
// ASCII 机器码前缀(spawn_error / output_limit / unattributed / fs_probe_unavailable /
// fs_exhausted.*)留在模板里、不进词表 —— 取词失败时行仍读得出"没配上",不是"没发生"。
import { t } from '../i18n/index.js';
// b75-4#9:kill(-pgid,0) 探组存活性(ESRCH=已消亡 / EPERM=存活但无权),升级 SIGKILL 前先探
import { isPosixProcessGroupAlive } from '../util/spawn-isolated.js';

export interface SandboxOptions {
  cwd: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  /**
   * 到点改收编不杀(G-896416,仅异步变体有意义):提供时,内部 deadline 触发**不杀进程、
   * 不置 timedOutFlag**,只回调一次 —— 调用方(build run_command 的超时自动转后台)
   * 在回调里把 ChildProcess 收编进后台注册表,此后生命周期归注册表,本函数的
   * result Promise 继续等到 close(自然退出或日后被注册表杀)才结算。
   * 语义锚点:上游 ZCode `runBashWithBackgroundLifecycle(request, {mode:"auto_on_timeout"})`
   * 的前台/后台化双终态 —— 到点是分叉点不是终点。
   */
  onDeadline?: () => void;
  /** POSIX only: 子进程最大内存(RSS,bytes)。Windows 上忽略。 */
  maxMemoryBytes?: number;
  /** POSIX only: 子进程最大 CPU 时间(ms)。Windows 上忽略。 */
  maxCpuMs?: number;
  /** 允许访问的额外路径白名单(绝对路径或相对 cwd)。cwd 本身始终允许。 */
  allowedPaths?: string[];
  /** 命令白名单三态:
   *  - `null`      = 一律拒绝所有命令(**含解析不出命令名的畸形输入**,fail closed)
   *  - `string[]` 非空 = 只允许这些命令
   *  - `undefined` / `[]` = 不检查(沿用旧语义,向后兼容)
   *  为什么把"禁止一切"做成 null 而不是空数组:空数组历史上一直被当作"未设置"
   *  (`length > 0` 才检查),所以只写 `commandAllowlist: []` 的档位对命令名**零限制**,
   *  与 readonly 档描述相反 —— null 是机器能表达、且不改动旧免确认面的那一档。
   *  匹配规则:取命令行第一个 token 的 basename,与白名单做大小写不敏感比对。
   *  Windows 上会自动尝试 .exe/.cmd/.bat 后缀匹配。 */
  commandAllowlist?: string[] | null;
  /** 屏蔽的环境变量名(子进程不会继承这些变量)。
   *  默认会屏蔽常见 API key 相关变量(见 DEFAULT_BLOCKED_ENV_VARS)。 */
  blockedEnvVars?: string[];
}

export type FolderTrustLevel = 'trusted' | 'read-only' | 'forbidden';

/**
 * 路径模式 → 信任级别映射。
 * 路径匹配规则:
 * - 精确路径优先(如 '.env' 匹配根目录 .env 文件)
 * - 目录通配(如 'src/*' 匹配 src 下所有文件,'src/**' 递归匹配)
 * - glob 风格(* 单层,** 递归)
 * 未匹配的路径默认 'trusted'(不阻塞正常工作)
 */
export type FolderTrustMap = Record<string, FolderTrustLevel>;

/**
 * 检查给定路径的信任级别。
 * @param filePath 相对工作区的路径(POSIX 风格)
 * @param trustMap 信任映射
 * @returns 匹配的信任级别,未匹配返回 'trusted'
 */
export function checkFolderTrust(filePath: string, trustMap: FolderTrustMap | undefined): FolderTrustLevel {
  if (!trustMap) return 'trusted';

  const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');

  if (trustMap[normalized]) return trustMap[normalized]!;

  let bestMatch: { level: FolderTrustLevel; specificity: number } | null = null;
  for (const [pattern, level] of Object.entries(trustMap)) {
    if (pattern === normalized) {
      return level;
    }
    const regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '<<<GLOBSTAR>>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<<GLOBSTAR>>>/g, '.*');
    if (new RegExp(`^${regexStr}$`).test(normalized)) {
      const specificity = (pattern.match(/[*/]/g) ?? []).length;
      if (!bestMatch || specificity < bestMatch.specificity) {
        bestMatch = { level, specificity };
      }
    }
  }
  return bestMatch?.level ?? 'trusted';
}

export type SandboxProfile = 'readonly' | 'limited' | 'trusted' | 'open' | 'full';

export interface SandboxProfileConfig {
  description: string;
  overrides: Partial<SandboxOptions>;
}

export const SANDBOX_PROFILES: Record<SandboxProfile, SandboxProfileConfig> = {
  readonly: {
    description: '只读:无写操作,无网络,无 shell 命令',
    overrides: {
      // null 而不是 []:[] 在判定里等价于"未设置",会让本档描述里的"无 shell 命令"落空
      commandAllowlist: null,
      blockedEnvVars: ['*'],
      timeoutMs: 10_000,
      maxOutputBytes: 1024 * 1024,
    },
  },
  limited: {
    description: '受限:仅白名单命令(默认 node/npm/pnpm/git/rg/tsc/eslint/vitest),保护 API key',
    overrides: {
      commandAllowlist: ['node', 'npm', 'npx', 'pnpm', 'git', 'rg', 'tsc', 'eslint', 'vitest', 'tsx'],
      blockedEnvVars: ['*_API_KEY', '*_SECRET', '*_TOKEN', '*_PASSWORD', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'],
      timeoutMs: 60_000,
      maxOutputBytes: 10 * 1024 * 1024,
    },
  },
  trusted: {
    description: '信任:限工作区路径,白名单命令,保护 API key(默认推荐)',
    overrides: {
      commandAllowlist: ['node', 'npm', 'npx', 'pnpm', 'git', 'rg', 'tsc', 'eslint', 'vitest', 'tsx', 'cat', 'ls', 'echo'],
      blockedEnvVars: ['*_API_KEY', '*_SECRET', '*_TOKEN', '*_PASSWORD'],
      timeoutMs: 120_000,
      maxOutputBytes: 50 * 1024 * 1024,
    },
  },
  open: {
    description: '开放:全本地访问,不限命令,仍保护 API key',
    overrides: {
      blockedEnvVars: ['*_API_KEY', '*_SECRET', '*_TOKEN', '*_PASSWORD'],
      timeoutMs: 300_000,
      maxOutputBytes: 100 * 1024 * 1024,
    },
  },
  full: {
    description: '完全:无任何限制(危险,仅用于可信调试场景)',
    overrides: {
      timeoutMs: 600_000,
      maxOutputBytes: 500 * 1024 * 1024,
    },
  },
};

/** 按 profile 解析 sandbox 配置:profile 提供基础,用户 opts 覆盖 */
export function resolveSandboxOptions(
  profile: SandboxProfile | undefined,
  userOpts: Partial<SandboxOptions>
): Partial<SandboxOptions> {
  if (!profile) return userOpts;
  const profileConfig = SANDBOX_PROFILES[profile];
  if (!profileConfig) return userOpts;
  return { ...profileConfig.overrides, ...userOpts };
}

/**
 * 沙盒同步结算的失败分型 —— 归因词表唯一定义处(判据/结算/审计读同一份)。
 *
 * 为什么必须分型而不是一个 `timedOut` 布尔:HEAD 实测 spawnSync 在撞 maxBuffer 时返回
 * `error.code='ENOBUFS' + signal=SIGTERM + status=null`(本机 Node v24 现测),而旧结算只按
 * signal 判超时 ⇒ **没超时却报超时**,真因(输出撞上限)整条丢失;ENOENT 时 `status=null,
 * stdout=undefined` 又被读成"跑了且无输出"。
 *
 * 归因序(票面口径):`spawn_error > timed_out > cancelled > output_limit`。
 * "互不塌缩"不靠顺序本身实现,而是每一档证据自我收窄 —— 见 classifySpawnSyncFailure。
 * 失效方向恒为"多喊一次":判不出类型的落 `unattributed` 并保留原始信息,
 * **绝不**把未知归成 `timed_out` 或归成正常完成(null)。
 */
export type SandboxFailureKind =
  /** 子进程根本没被拉起(ENOENT/EACCES/…,命令与 cwd 其中之一不存在) */
  | 'spawn_error'
  /** 真超时(ETIMEDOUT,或无归因错误码时被 SIGTERM/SIGKILL 杀掉) */
  | 'timed_out'
  /** 调用方主动终止(同步路径结构上没有取消源,此档为共享词汇/注入面保留) */
  | 'cancelled'
  /** 输出撞 maxBuffer 上限(ENOBUFS)—— 独立终态,不折进超时 */
  | 'output_limit'
  /** 空输出 + 非零退出 + 现场 statfs 量到文件系统空间/inode 已尽 */
  | 'fs_exhausted'
  /** 命令自己跑完并以非零码退出(exit code 即结论) */
  | 'failed'
  /** 归因不出:保留原始信息、追加"未判定"喊话,不冒充任何已知终态 */
  | 'unattributed';

/** fs_exhausted 的根因维度:space=字节已尽 / inodes=inode 已尽 / both=两轴都尽。 */
export type SandboxFsExhaustion = 'space' | 'inodes' | 'both';

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  truncated: boolean;
  blocked: boolean;
  blockReason?: string;
  /** 失败分型归因(null=正常完成 exitCode 0);blocked=true 的拒绝分支不参与,保持 undefined。 */
  failureKind?: SandboxFailureKind | null;
  /** 仅 failureKind==='fs_exhausted' 时在场:哪个轴量到了已尽。 */
  fsExhaustion?: SandboxFsExhaustion;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024;

/** 默认屏蔽的环境变量(匹配 key,大小写不敏感,支持后缀通配如 *_API_KEY) */
export const DEFAULT_BLOCKED_ENV_VARS = [
  'IHUI_API_KEY',
  'IHUI_AUDIT',
  'STEPFUN_API_KEY',
  'AGNES_API_KEY',
  'AI_CALLBACK_SECRET',
  'CREDENTIALS_ENCRYPTION_KEY',
  // 机器凭据清单:通配 `*_API_KEY`/`*_SECRET`/`*_TOKEN` 都盖不到复数 KEYS 结尾
  'IHUI_SERVE_MACHINE_KEYS',
  '*_API_KEY',
  '*_SECRET',
  '*_TOKEN',
  '*_PASSWORD',
];

/**
 * G-465 报名面(只报名,**不剥、不拦**)—— 与上方 deny 表(buildFilteredEnv 消费的那份)
 * 是两回事:deny 表决定"什么不进子进程",本表决定"什么进子进程但要喊一声"。
 *
 * 现量(2026-10-06 用真实现直测):deny 表四个后缀族(`*_API_KEY/*_SECRET/*_TOKEN/*_PASSWORD`)
 * 盖不到单数 `*_KEY`、`*_SENDKEY`、`*_TOKEN_ID`、`*_AUTH_PAYLOAD_FILE`、`*_TOKEN_PATH` 等形态,
 * LIBTV_ACCESS_KEY / SERVERCHAN_SENDKEY / TUNNEL_SERVICE_TOKEN_ID / QODER_SDK_AUTH_PAYLOAD_FILE /
 * TRAE_JWT_TOKEN_PATH 一类第三方凭据原样漏进子进程。
 *
 * 为什么只报名不拦(机主拍板,与 tests/child-env-boundary.test.ts"宁窄不误伤"同向):
 * 宽 deny 会打断交互终端里**靠 env 工作**的第三方 CLI(aws/gcloud 这类),是用户可见回归。
 * 本表把敞口变成可见的报名(log + 结构化审计字段,点名变量名与命中模式),
 * 拦不拦由后续按"对 MCP+hook 子进程改白名单"那一型单独拍板。
 *
 * 纪律:本表**不得**被 buildFilteredEnv 或任何剥离路径消费 —— 它不是 deny 表。
 * 匹配顺序即报名的模式归因序:更具体的形态在前,宽后缀 `*_KEY` 收尾兜底。
 */
export const SUSPICIOUS_CREDENTIAL_ENV_PATTERNS: readonly string[] = [
  '*_SENDKEY', // 推送服务 sendkey(SERVERCHAN_SENDKEY;更具体,先于 *_KEY 归因)
  '*_AUTH_PAYLOAD_FILE', // 指向凭据载荷文件的路径(QODER_SDK_AUTH_PAYLOAD_FILE)—— 路径型也是敞口
  '*_TOKEN_ID', // token 标识符(TUNNEL_SERVICE_TOKEN_ID)
  '*_SECRET_ID', // secret 标识符(腾讯云 SECRET_ID 族)
  '*_KEY_ID', // key 标识符(AWS_ACCESS_KEY_ID 族)
  '*_TOKEN_PATH', // 指向 token 文件的路径(TRAE_JWT_TOKEN_PATH)
  '*_TOKEN_FILE', // 同上(AWS_WEB_IDENTITY_TOKEN_FILE 族)
  '*_KEY_PATH', // 指向 key 文件的路径(SSH_KEY_PATH 族)
  '*_KEY_FILE', // 同上(GIT_SSH_KEY_FILE 族)
  '*_KEY', // 单数 KEY 后缀兜底(LIBTV_ACCESS_KEY / *_ACCESS_KEY / *_SECRET_KEY …)
];

/** 一条报名:子进程将继承的"疑似凭据形态"变量,点名变量名与命中模式。 */
export interface SuspiciousEnvVarReport {
  /** 变量名(经 deny 表过滤后的**幸存者** —— 它真的会进子进程 env)。 */
  name: string;
  /** 命中的报名模式(来自 SUSPICIOUS_CREDENTIAL_ENV_PATTERNS,首个命中者)。 */
  pattern: string;
}

/**
 * 报名面识别(纯函数):对**将要交给子进程的 env**(即 buildFilteredEnv 产物)逐键过
 * SUSPICIOUS_CREDENTIAL_ENV_PATTERNS,返回全部幸存的疑似凭据变量。
 * 输入必须是过滤后的 env:被 deny 表剥掉的键不报名(它们没进子进程,无敞口)。
 */
export function detectSuspiciousEnvVars(env: NodeJS.ProcessEnv): SuspiciousEnvVarReport[] {
  const reports: SuspiciousEnvVarReport[] = [];
  for (const name of Object.keys(env)) {
    const pattern = SUSPICIOUS_CREDENTIAL_ENV_PATTERNS.find((p) => matchPattern(name, p));
    if (pattern) reports.push({ name, pattern });
  }
  return reports;
}

/** 报名去重账:同一组(变量,模式)签名只喊一次 —— 每条命令都喊会刷屏,静默则敞口不可见。 */
const suspiciousEnvReportedSignatures = new Set<string>();

/**
 * 报名出口:往父进程 stderr 写一行(子进程自己的 stderr 是管道收的,不会混进命令输出)。
 * 同一签名去重(进程生命周期内只喊一次);reports 为空时零输出。
 * 测试注入口:spy process.stderr.write 后直接调用本函数(签名里放全新变量名即绕过去重)。
 */
export function reportSuspiciousEnvVars(reports: readonly SuspiciousEnvVarReport[]): void {
  if (reports.length === 0) return;
  const signature = reports.map((r) => `${r.name}=${r.pattern}`).sort().join('|');
  if (suspiciousEnvReportedSignatures.has(signature)) return;
  suspiciousEnvReportedSignatures.add(signature);
  const vars = reports.map((r) => `${r.name}(${r.pattern})`).join(', ');
  // 安全边界文案走 cli 语言包(AGENTS §19,与 spawn_error/outputLimit 同一形态)
  process.stderr.write(`⚠ env-report: ${t('cli.sandbox.envCredentialReport', { vars })}\n`);
}

/** 从命令行提取主命令名(第一个 token 的 basename,去扩展名) */
function extractCommandName(commandLine: string): string {
  const trimmed = commandLine.trim();
  if (!trimmed) return '';
  // 取第一个 token(处理引号)
  let end = 0;
  let quote: '"' | "'" | null = null;
  while (end < trimmed.length) {
    const ch = trimmed[end]!;
    if (quote) {
      if (ch === quote) break;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (/\s/.test(ch)) {
      break;
    }
    end++;
  }
  const firstToken = trimmed.slice(0, end).replace(/^["']|["']$/g, '');
  const base = path.basename(firstToken);
  const ext = path.extname(base).toLowerCase();
  return ext ? base.slice(0, -ext.length) : base;
}

/** 大小写不敏感匹配,支持 * 通配(前缀/后缀) */
function matchPattern(name: string, pattern: string): boolean {
  const n = name.toLowerCase();
  const p = pattern.toLowerCase();
  if (!p.includes('*')) return n === p;
  const parts = p.split('*');
  let idx = 0;
  for (let i = 0; i < parts.length; i++) {
    if (i === 0) {
      if (!n.startsWith(parts[i]!)) return false;
      idx = parts[i]!.length;
    } else if (i === parts.length - 1) {
      return n.endsWith(parts[i]!) && idx + parts[i]!.length <= n.length;
    } else {
      const found = n.indexOf(parts[i]!, idx);
      if (found === -1) return false;
      idx = found + parts[i]!.length;
    }
  }
  return true;
}

function isCommandAllowed(commandName: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;
  return allowlist.some((p) => matchPattern(commandName, p));
}

/**
 * 命令白名单判定 —— `runSandboxed` 与 `precheckSandbox` 两处强制点**共用这一份实现**。
 *
 * 为什么必须共用:同一条判据写在两处时,改一处漏一处是这里出现过的真实缺陷
 * (readonly 档描述与行为相反就是两处各自判 `length > 0` 的结果)。
 *
 * @returns 拒绝时返回 blockReason 字符串;放行时返回 null
 */
export function evaluateCommandAllowlist(
  commandLine: string,
  allowlist: string[] | null | undefined,
): string | null {
  if (allowlist === null) {
    // 一律拒绝:连命令名都取不出来时也拒绝(这一档的意义就是"这里不许跑任何命令")
    const cmdName = extractCommandName(commandLine);
    return `command_not_allowed: ${cmdName || '<无法解析命令名>'}`;
  }
  // undefined / 空数组 = 不检查(旧语义,不得改动:全仓现有免确认面依赖它)
  if (!allowlist || allowlist.length === 0) return null;
  const cmdName = extractCommandName(commandLine);
  if (!cmdName) return null;
  return isCommandAllowed(cmdName, allowlist) ? null : `command_not_allowed: ${cmdName}`;
}

/**
 * 交给子进程前剥掉敏感环境变量。
 *
 * 这是本仓**唯一**一份 env 过滤实现:沙箱执行与所有第三方边界(MCP stdio 子进程、
 * hook 命令、交互终端里跑的 shell)都必须经这里,不得在别处再抄一张 deny 表 ——
 * 两处清单必漂移是本项目记过最多次的失败型。
 */
export function buildFilteredEnv(blocked: string[]): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (blocked.some((p) => matchPattern(key, p))) {
      delete env[key];
    }
  }
  return env;
}

function isPathAllowed(target: string, cwd: string, allowed: string[]): boolean {
  return isPathAllowedWithRealpath(target, cwd, allowed, fs.realpathSync);
}

/**
 * 路径白名单校验(带 symlink 逃逸防护,2026-09-07 加固)。
 *
 * 之前只做字符串前缀比对:`src/link/secret` 形式上落在 cwd 内,
 * 但 src/link 是指向外部的符号链接时,实际读写会逃逸出沙盒。
 * 现在:对命令中出现的每个已存在路径解析真实路径(fs.realpathSync),
 * 真实路径必须同样落在白名单内;不存在的路径(将要创建的文件)按
 * 解析后的形式路径校验(无法预判 symlink,如实注释此残余风险)。
 */
export function isPathAllowedWithRealpath(
  target: string,
  cwd: string,
  allowed: string[],
  realpathFn: (p: string) => string,
): boolean {
  const candidates = [target];
  const abs = path.isAbsolute(target) ? path.resolve(target) : path.resolve(cwd, target);
  candidates.push(abs);
  // 真实路径解析:存在则解析(symlink 防护核心),不存在则用形式路径
  try {
    candidates.push(realpathFn(abs));
  } catch {
    /* 不存在:保留形式路径 */
  }
  return candidates.every((p) => isPathAllowedRaw(p, cwd, allowed));
}

function isPathAllowedRaw(target: string, cwd: string, allowed: string[]): boolean {
  const abs = path.isAbsolute(target) ? path.resolve(target) : path.resolve(cwd, target);
  if (abs === cwd || abs.startsWith(cwd + path.sep)) return true;
  return allowed.some((p) => {
    const ap = path.isAbsolute(p) ? path.resolve(p) : path.resolve(cwd, p);
    return abs === ap || abs.startsWith(ap + path.sep);
  });
}

function extractPathsFromCommand(commandLine: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < commandLine.length; i++) {
    const ch = commandLine[i]!;
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens.filter((t) => t.includes('/') || t.includes('\\') || t.includes(path.sep));
}

export interface SandboxAuditEntry {
  timestamp: string;
  command: string;
  cwd: string;
  exitCode: number | null;
  timedOut: boolean;
  truncated: boolean;
  blocked: boolean;
  blockReason?: string;
  /** 失败分型归因(见 SandboxFailureKind 词表注释);blocked 分支与旧版调用可不带。 */
  failureKind?: SandboxFailureKind | null;
  /** failureKind==='fs_exhausted' 时点名的维度。 */
  fsExhaustion?: SandboxFsExhaustion;
  /** G-465 报名面:本次子进程将继承的"疑似凭据形态"变量(只报名,不剥不拦);空缺=无命中。 */
  suspiciousEnvVars?: SuspiciousEnvVarReport[];
  durationMs: number;
}

/**
 * 沙盒审计日志(jsonl 追加,2026-09-07 加固)。
 * 路径取 env IHUI_SANDBOX_AUDIT_LOG;未设置时静默跳过(零开销)。
 * 写失败静默降级(审计不可用不应阻塞命令执行)。
 */
export function appendSandboxAuditLog(entry: SandboxAuditEntry): void {
  const logPath = process.env.IHUI_SANDBOX_AUDIT_LOG;
  if (!logPath) return;
  try {
    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf-8');
  } catch {
    /* 审计写失败不阻塞执行 */
  }
}

/**
 * 超时被杀的信号档:spawnSync `timeout` 到期后按 killSignal(默认 SIGTERM)终止。
 * 注意 ENOBUFS 的返回里 signal **同样** 是 SIGTERM(本机 Node v24.19.0 现测),
 * 所以这一档只能作为"错误码归因不上的那一次 signal"的证据,不得先于错误码判。
 */
const TIMEOUT_KILL_SIGNALS: ReadonlySet<string> = new Set(['SIGTERM', 'SIGKILL']);

/** 输出撞 maxBuffer 上限的错误码(实测形态:ENOBUFS + signal=SIGTERM + status=null)。 */
const OUTPUT_LIMIT_ERROR_CODES: ReadonlySet<string> = new Set(['ENOBUFS', 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER']);

/** "子进程没能拉起"的特定错误码(Node 文档化集合)。未知错误码**不**并入本档 ——
 *  不得把"不知道"打扮成"知道是 spawn 失败";未知码落 unattributed 并保留原文。 */
const SPAWN_LAUNCH_ERROR_CODES: ReadonlySet<string> = new Set([
  'ENOENT',
  'EACCES',
  'EPERM',
  'ENOTDIR',
  'ENAMETOOLONG',
  'EINVAL',
  'EMFILE',
  'ENFILE',
  'ELOOP',
  'ENOEXEC',
]);

/** shell 惯例的"被信号杀死"退出码哨兵(128+9=SIGKILL,如 OOM-kill):另有归因,
 *  不进"空输出 ⇒ 文件系统已尽"的诊断门(票面口径 code!==137)。 */
const EXIT_SIGKILL_SENTINEL = 137;

/** b75-4#5:子进程自己把"写不动了"报上来的错误码(ENOSPC=设备空间尽 / EDQUOT=配额尽)。
 *  这是**直接证据**(比 statfs 间接量数强),必须落 fs_exhausted 而不是 unattributed。 */
const FS_EXHAUSTION_ERROR_CODES: ReadonlySet<string> = new Set(['ENOSPC', 'EDQUOT']);

/** 诊断阈(票面口径):bavail×bsize 折算 <10MB ⇒ 空间已尽;ffree <1000 ⇒ inode 已尽。 */
const FS_MIN_FREE_BYTES = 10n * 1024n * 1024n;
const FS_MIN_FREE_INODES = 1000n;

/** spawnSync 返回体里归因消费到的字段子集(与 SpawnSyncReturns<string|Buffer> 结构兼容;
 *  错误态时 Node 实测不写 stdout/stderr,故允许 undefined/null)。 */
export interface SpawnSyncOutcomeLike {
  error?: Error;
  status?: number | null;
  signal?: NodeJS.Signals | null;
  stdout?: string | NodeJS.ArrayBufferView | null;
  stderr?: string | NodeJS.ArrayBufferView | null;
}

/** statfs 探针的归一读数:null 表示该轴**测不到**,不是"已尽"(判不出不得写成结论)。 */
export interface FsSpaceProbeResult {
  /** bavail×bsize 折算的可用字节;null=文件系统不报 bsize/bavail。 */
  availableBytes: bigint | null;
  /** ffree 空闲 inode 数;null=该文件系统不上报 inode 维度。
   *  实测:NTFS 上 statfsSync 的 files=0、ffree=0(本机 G: 盘现测),"全零"意味着
   *  **不报数**,不得读成"inode 已尽"—— 否则 Windows 上每一次空输出非零退出都会被误诊。 */
  freeInodes: bigint | null;
}

/** 文件系统探针出口(可注入):生产默认走 fs.statfsSync(bigint:true)。 */
export type StatfsSyncProbe = (path: string) => FsSpaceProbeResult;

function defaultStatfsProbe(target: string): FsSpaceProbeResult {
  const s = fs.statfsSync(target, { bigint: true });
  return {
    availableBytes: s.bsize > 0n ? s.bavail * s.bsize : null,
    freeInodes: s.files > 0n ? s.ffree : null,
  };
}

function spawnErrorInfo(error: Error | undefined): { code: string | undefined; message: string | undefined } {
  if (!error) return { code: undefined, message: undefined };
  const code = (error as NodeJS.ErrnoException).code;
  return { code: typeof code === 'string' ? code : undefined, message: error.message };
}

function appendStderrNote(base: string, note: string): string {
  return base ? `${base}\n${note}` : note;
}

/** 结算归一的取文:本沙盒恒传 encoding:'utf-8'(文本),Buffer 形态是给复用者的兜底,
 *  解码为 utf-8 而非静默丢 —— 把"看得见的字节"读成空字符串,等于伪造"跑了且无输出"。 */
function outcomeText(v: string | NodeJS.ArrayBufferView | null | undefined): string {
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return '';
  return Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('utf8');
}

/**
 * 归因序:`spawn_error > timed_out > cancelled > output_limit`。
 *
 * 每档证据自我收窄,互不塌缩:
 *  - ETIMEDOUT 先于一切 signal 判(现测:真超时必带该码,Node 24);
 *  - 其余错误码里只有文档化的 spawn 失败族算 spawn_error,ENOBUFS/maxBuffer 族留给
 *    output_limit,未知码 ⇒ unattributed(不冒充任何一种"已知失败类型");
 *  - "signal 被超时杀"只在**错误码归因不上**时成立 —— 这正是 ENOBUFS 不再被折进
 *    timed_out 的地方(HEAD 现症:撞上限产出 timedOut:true);
 *  - cancelled 需要调用方**显式**盖章(同步路径结构上无取消源)。
 */
export function classifySpawnSyncFailure(
  outcome: SpawnSyncOutcomeLike,
  opts: { cancelled?: boolean } = {},
): SandboxFailureKind | null {
  const { code } = spawnErrorInfo(outcome.error);
  if (code === 'ETIMEDOUT') return 'timed_out';
  // b75-4#5:子进程自己报的"写不动了"是直接证据,先于 spawn 启动族判定(ENOSPC 不在其列,
  // 旧归因会落 unattributed 把磁盘满伪装成"不知道")。
  if (code !== undefined && FS_EXHAUSTION_ERROR_CODES.has(code)) return 'fs_exhausted';
  if (code !== undefined && !OUTPUT_LIMIT_ERROR_CODES.has(code)) {
    return SPAWN_LAUNCH_ERROR_CODES.has(code) ? 'spawn_error' : 'unattributed';
  }
  // 到这里 code 要么 undefined,要么属输出上限族。
  if (outcome.signal) {
    if (code === undefined && !opts.cancelled) {
      return TIMEOUT_KILL_SIGNALS.has(outcome.signal) ? 'timed_out' : 'unattributed';
    }
    if (opts.cancelled) return 'cancelled';
    return 'output_limit';
  }
  if (code !== undefined) return 'output_limit';
  if (outcome.status === null || outcome.status === undefined) return 'unattributed';
  return outcome.status !== 0 ? 'failed' : null;
}

export interface SpawnSyncSettlementOptions {
  /** 命令工作目录 —— 文件系统诊断量这条路径(命令真正落盘/写输出的"现场")。 */
  cwd: string;
  /** 喂给 maxBuffer 的**字节**预算:截断标志必须与之同量纲(票面判据②)。 */
  maxOutputBytes: number;
  /** 调用方已盖章"是我主动终止"(同步路径无取消源;为异步复用与测试注入保留)。 */
  cancelled?: boolean;
  /** 文件系统探针注入口:生产恒缺省(真 statfsSync);"满盘/inode 尽"成对对照只能经注入面证明。 */
  statfs?: StatfsSyncProbe;
}

/** settleSpawnSyncOutcome 的输出 —— runSandboxed 的同步返回即由它逐字段映射。 */
export interface SpawnSyncSettlement {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  truncated: boolean;
  failureKind: SandboxFailureKind | null;
  fsExhaustion?: SandboxFsExhaustion;
}

/**
 * 同步结算的唯一实现:把 spawnSync 原始返回归因、补人话、量文件系统,产出 SandboxResult。
 * 与 runSandboxed 同受测试直接问责(生产出口 = runSandboxed,结算函数 = 本函数,
 * 测试内**不得**内联第二份归因逻辑)。
 */
export function settleSpawnSyncOutcome(
  outcome: SpawnSyncOutcomeLike,
  opts: SpawnSyncSettlementOptions,
): SpawnSyncSettlement {
  const stdout = outcomeText(outcome.stdout);
  const stderrBase = outcomeText(outcome.stderr);
  const kind = classifySpawnSyncFailure(outcome, { cancelled: opts.cancelled });
  // reported:文件系统现场诊断可把 'failed' 升级为 'fs_exhausted'(点名具体根因);
  // 其余分型不改写 —— 分型判据(kind)与对外结论(reported)在此分账,不得混写。
  let reported: SandboxFailureKind | null = kind;
  const { code, message } = spawnErrorInfo(outcome.error);

  // 与 maxBuffer 同量纲:**字节**。实测 1000 个汉字 length=1000 / Buffer.byteLength=3000,
  // 旧写法 `stdout.length >= maxOutput` 对中文为主的输出(本仓常态)系统性漏报截断。
  const truncated =
    kind === 'output_limit' ||
    Buffer.byteLength(stdout, 'utf8') >= opts.maxOutputBytes ||
    Buffer.byteLength(stderrBase, 'utf8') >= opts.maxOutputBytes;

  let stderr = stderrBase;
  let fsExhaustion: SandboxFsExhaustion | undefined;

  if (kind === 'spawn_error') {
    // 原文形态 `(${code}${message ? `:${message}` : ''})` 收进词表参数,占位符 {code} 由调用方拼好
    const codeWithDetail = message ? `${code}:${message}` : `${code}`;
    stderr = appendStderrNote(
      stderr,
      `⛔ spawn_error: ${t('cli.sandbox.spawnError', { code: codeWithDetail, cwd: opts.cwd })}`,
    );
  } else if (kind === 'output_limit') {
    stderr = appendStderrNote(
      stderr,
      `⚠ output_limit: ${t('cli.sandbox.outputLimit', { maxOutputBytes: opts.maxOutputBytes, code: code ?? 'ENOBUFS' })}`,
    );
  } else if (kind === 'fs_exhausted' && code !== undefined) {
    // b75-4#5 的错误码归因档:ENOSPC/EDQUOT 报自子进程,是直接证据;statfs 只负责补
    // "现场还剩多少"的人话数字,量不到也不推翻子进程自己的结论(它比间接量数强)。
    let read: FsSpaceProbeResult | null = null;
    try {
      read = (opts.statfs ?? defaultStatfsProbe)(opts.cwd);
    } catch {
      read = null;
    }
    const status = outcome.status ?? 0;
    if (read) {
      // EDQUOT 可能是空间也可能是 inode 配额:probe 两轴各自能判就按轴点名;ENOSPC 默认空间轴
      const inodesOnly = code === 'EDQUOT' && read.freeInodes !== null && read.freeInodes < FS_MIN_FREE_INODES
        && !(read.availableBytes !== null && read.availableBytes < FS_MIN_FREE_BYTES);
      const axis: 'space' | 'inodes' = inodesOnly ? 'inodes' : 'space';
      fsExhaustion = axis;
      stderr = appendStderrNote(stderr, `${fsExhaustedNote(status, opts.cwd, read, axis)} (errno=${code})`);
    } else {
      fsExhaustion = 'space';
      stderr = appendStderrNote(
        stderr,
        `⛔ fs_exhausted: ${t('cli.sandbox.fsProbeUnavailable', { status, why: `child reported ${code}` })} (errno=${code})`,
      );
    }
  } else if (kind === 'unattributed') {
    const raw = [
      code ? `code=${code}` : '',
      message ? `error=${message}` : '',
      outcome.signal ? `signal=${outcome.signal}` : `status=${outcome.status ?? t('cli.sandbox.statusMissing')}`,
    ]
      .filter(Boolean)
      .join(', ');
    stderr = appendStderrNote(
      stderr,
      `⚠ unattributed: ${t('cli.sandbox.unattributed', { raw })}`,
    );
  } else if (kind === 'failed') {
    const status = outcome.status ?? 0;
    // 票面判据③的准入:空输出 + 非零 + 非 SIGKILL 哨兵,才去现场量文件系统;
    // 正常无输出的命令(如 touch)走"两轴健康 ⇒ 一字不加"分支,不得被诊断成丢失。
    if (stdout === '' && stderrBase === '' && status !== EXIT_SIGKILL_SENTINEL) {
      const probe = opts.statfs ?? defaultStatfsProbe;
      let read: FsSpaceProbeResult | null = null;
      try {
        read = probe(opts.cwd);
      } catch (e) {
        const why = e instanceof Error ? e.message || String(e) : String(e);
        stderr = appendStderrNote(
          stderr,
          `⚠ fs_probe_unavailable: ${t('cli.sandbox.fsProbeUnavailable', { status, why })}`,
        );
      }
      if (read) {
        const spaceExhausted = read.availableBytes !== null && read.availableBytes < FS_MIN_FREE_BYTES;
        const inodesExhausted = read.freeInodes !== null && read.freeInodes < FS_MIN_FREE_INODES;
        if (spaceExhausted || inodesExhausted) {
          // 升级对外结论:不是"什么都没发生",而是量到了具体根因。
          reported = 'fs_exhausted';
          if (spaceExhausted && inodesExhausted) {
            fsExhaustion = 'both';
            stderr = appendStderrNote(
              stderr,
              `${fsExhaustedNote(status, opts.cwd, read, 'space')} ${fsExhaustedNote(status, opts.cwd, read, 'inodes')}`,
            );
          } else if (spaceExhausted) {
            fsExhaustion = 'space';
            stderr = appendStderrNote(stderr, fsExhaustedNote(status, opts.cwd, read, 'space'));
          } else {
            fsExhaustion = 'inodes';
            stderr = appendStderrNote(stderr, fsExhaustedNote(status, opts.cwd, read, 'inodes'));
          }
        }
        // 两轴都健康(或都测不到)⇒ 不点名:空输出+非零就是命令自身行为,诊断不越权。
      }
    }
  }

  return {
    stdout,
    stderr,
    exitCode: outcome.status ?? null,
    // timedOut 只在归因到 timed_out 时为 true:撞上限(ENOBUFS)/未知类型都不得冒充超时。
    timedOut: kind === 'timed_out',
    truncated,
    failureKind: reported,
    fsExhaustion,
  };
}

/** fs_exhausted 的人话根因:点名实测数字与阈值,并给出可执行的出路。 */
function fsExhaustedNote(status: number, cwd: string, read: FsSpaceProbeResult, axis: 'space' | 'inodes'): string {
  if (axis === 'space') {
    const availMB = read.availableBytes !== null ? Number(read.availableBytes / (1024n * 1024n)) : null;
    return `⛔ fs_exhausted.space: ${t('cli.sandbox.fsExhaustedSpace', { status, cwd, availMB: String(availMB) })}`;
  }
  return `⛔ fs_exhausted.inodes: ${t('cli.sandbox.fsExhaustedInodes', { status, cwd, freeInodes: String(read.freeInodes) })}`;
}

export function runSandboxed(commandLine: string, opts: SandboxOptions): SandboxResult {
  const startedAt = Date.now();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutput = opts.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const allowed = opts.allowedPaths ?? [];
  const blockedEnvVars = opts.blockedEnvVars ?? DEFAULT_BLOCKED_ENV_VARS;

  // 命令白名单检查(判据见 evaluateCommandAllowlist,与 precheckSandbox 同一份实现)
  const commandBlockReason = evaluateCommandAllowlist(commandLine, opts.commandAllowlist);
  if (commandBlockReason) {
    appendSandboxAuditLog({
      timestamp: new Date().toISOString(),
      command: commandLine,
      cwd: opts.cwd,
      exitCode: null,
      timedOut: false,
      truncated: false,
      blocked: true,
      blockReason: commandBlockReason,
      durationMs: Date.now() - startedAt,
    });
    return {
      stdout: '',
      stderr: `⛔ 命令被沙盒拒绝: ${commandBlockReason}(命令白名单未放行)`,
      exitCode: null,
      timedOut: false,
      truncated: false,
      blocked: true,
      blockReason: commandBlockReason,
    };
  }

  // 路径白名单检查
  if (allowed.length > 0) {
    const pathsInCmd = extractPathsFromCommand(commandLine);
    for (const p of pathsInCmd) {
      if (!isPathAllowed(p, opts.cwd, allowed)) {
        appendSandboxAuditLog({
          timestamp: new Date().toISOString(),
          command: commandLine,
          cwd: opts.cwd,
          exitCode: null,
          timedOut: false,
          truncated: false,
          blocked: true,
          blockReason: `path_not_allowed: ${p}`,
          durationMs: Date.now() - startedAt,
        });
        return {
          stdout: '',
          stderr: `⛔ 路径被沙盒拒绝: ${p}`,
          exitCode: null,
          timedOut: false,
          truncated: false,
          blocked: true,
          blockReason: `path_not_allowed: ${p}`,
        };
      }
    }
  }

  // G-465 报名面:先算出真正交给子进程的 env,对幸存者做疑似凭据报名(只报名,不剥不拦;
  // 剥离仍由 buildFilteredEnv + blockedEnvVars 一家独管,两表不得混用)。
  const filteredEnv = buildFilteredEnv(blockedEnvVars);
  const suspiciousEnvVars = detectSuspiciousEnvVars(filteredEnv);
  reportSuspiciousEnvVars(suspiciousEnvVars);

  const spawnOpts: SpawnSyncOptions = {
    cwd: opts.cwd,
    encoding: 'utf-8',
    timeout: timeoutMs,
    maxBuffer: maxOutput,
    shell: true,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: filteredEnv,
  };

  if (process.platform !== 'win32') {
    const resource: { maxMemory?: number; maxCpuTime?: number } = {};
    if (opts.maxMemoryBytes) resource.maxMemory = opts.maxMemoryBytes;
    if (opts.maxCpuMs) resource.maxCpuTime = opts.maxCpuMs;
    if (Object.keys(resource).length > 0) {
      (spawnOpts as Record<string, unknown>).resource = resource;
    }
  }

  const result = spawnSync(commandLine, spawnOpts);

  // 结算唯一实现:分型归因 + 字节量纲截断 + 空输出非零退出时的文件系统现场诊断。
  const settled = settleSpawnSyncOutcome(result, { cwd: opts.cwd, maxOutputBytes: maxOutput });

  appendSandboxAuditLog({
    timestamp: new Date().toISOString(),
    command: commandLine,
    cwd: opts.cwd,
    exitCode: settled.exitCode,
    timedOut: settled.timedOut,
    truncated: settled.truncated,
    blocked: false,
    failureKind: settled.failureKind,
    fsExhaustion: settled.fsExhaustion,
    suspiciousEnvVars: suspiciousEnvVars.length > 0 ? suspiciousEnvVars : undefined,
    durationMs: Date.now() - startedAt,
  });

  return {
    stdout: settled.stdout,
    stderr: settled.stderr,
    exitCode: settled.exitCode,
    timedOut: settled.timedOut,
    truncated: settled.truncated,
    blocked: false,
    failureKind: settled.failureKind,
    fsExhaustion: settled.fsExhaustion,
  };
}

// ==================== 异步变体(后台任务用) ====================

export interface SandboxPrecheckResult {
  blocked: boolean;
  blockReason?: string;
}

/** 沙盒预检查(命令白名单 + 路径白名单),供同步/异步版本共用。 */
export function precheckSandbox(commandLine: string, opts: SandboxOptions): SandboxPrecheckResult {
  const allowed = opts.allowedPaths ?? [];
  const commandBlockReason = evaluateCommandAllowlist(commandLine, opts.commandAllowlist);
  if (commandBlockReason) return { blocked: true, blockReason: commandBlockReason };
  if (allowed.length > 0) {
    const pathsInCmd = extractPathsFromCommand(commandLine);
    for (const p of pathsInCmd) {
      if (!isPathAllowed(p, opts.cwd, allowed)) {
        return { blocked: true, blockReason: `path_not_allowed: ${p}` };
      }
    }
  }
  return { blocked: false };
}

export interface SandboxAsyncHandle {
  process: ChildProcess;
  result: Promise<SandboxResult>;
}

/**
 * 异步沙盒执行 — 启动后台进程,返回 ChildProcess + Promise<SandboxResult>。
 * 不阻塞,适合后台任务。stdout/stderr 流式收集,超时用 SIGTERM。
 */
export function runSandboxedAsync(commandLine: string, opts: SandboxOptions): SandboxAsyncHandle {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutput = opts.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const blockedEnvVars = opts.blockedEnvVars ?? DEFAULT_BLOCKED_ENV_VARS;

  const precheck = precheckSandbox(commandLine, opts);
  if (precheck.blocked) {
    const blockedResult: SandboxResult = {
      stdout: '',
      stderr: `⛔ 命令被沙盒拒绝: ${precheck.blockReason}`,
      exitCode: null,
      timedOut: false,
      truncated: false,
      blocked: true,
      blockReason: precheck.blockReason,
    };
    appendSandboxAuditLog({
      timestamp: new Date().toISOString(),
      command: commandLine,
      cwd: opts.cwd,
      exitCode: null,
      timedOut: false,
      truncated: false,
      blocked: true,
      blockReason: precheck.blockReason,
      durationMs: 0,
    });
    return {
      process: null as unknown as ChildProcess,
      result: Promise.resolve(blockedResult),
    };
  }

  // G-465 报名面:与同步路径同一出口(只报名,不剥不拦;precheck 拒绝分支没拉起子进程,
  // 没有 env 交接,不报名)。
  const filteredEnv = buildFilteredEnv(blockedEnvVars);
  const suspiciousEnvVars = detectSuspiciousEnvVars(filteredEnv);
  reportSuspiciousEnvVars(suspiciousEnvVars);

  const spawnOpts: SpawnOptions = {
    cwd: opts.cwd,
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    env: filteredEnv,
    // POSIX:detached 建立独立进程组,超时可 kill(-pid) 团灭整组(含孙进程);
    // Windows:detached 无进程组语义,团灭走 taskkill /T /F(见 killTree)。
    detached: process.platform !== 'win32',
  };

  const child = spawn(commandLine, spawnOpts);
  let timedOutFlag = false;

  /**
   * 进程树强杀(2026-09-07 加固):之前只 kill 直接子进程,
   * shell 模式下 spawn 的实际命令是子进程的子进程,超时后仍会存活变孤儿。
   * Windows: taskkill /T /F 团灭进程树;POSIX: kill(-pid) 团灭进程组。
   */
  const killTree = () => {
    const pid = child.pid;
    if (!pid) return;
    if (process.platform === 'win32') {
      try {
        spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true });
      } catch { /* ignore */ }
    } else {
      try {
        process.kill(-pid, 'SIGTERM');
      } catch { /* 进程组可能已退出 */ }
      setTimeout(() => {
        // b75-4#9:升级 SIGKILL 前先探组存活性 —— ESRCH(组已消亡)不再补刀;
        // EPERM(组存活但本进程无权发信号)视为存活,照常升级。旧写法不看存活性一律补刀。
        if (isPosixProcessGroupAlive(pid)) {
          try {
            process.kill(-pid, 'SIGKILL');
          } catch { /* 已退出 */ }
        }
      }, 5000);
    }
  };
  let truncated = false;
  let settled = false;

  // b75-4#5 输出文件化:内存窗口按**字节**冻结(maxOutput;旧实现按字符累加,UTF-16 下内存翻倍),
  // 超窗字节懒建 WriteStream 落 os.tmpdir() —— 大输出不再整段驻留内存,也不再被直接丢弃。
  // 流式期间只攒 chunk 引用不拷贝(结算时才一次性 concat);spill 自身写不动(如磁盘满 ENOSPC)
  // 时 best-effort 静默 —— 文件系统归因交给结算诊断矩阵,不让 spill 二次炸流。
  const SPILL_TAIL_PREVIEW_BYTES = 4 * 1024;
  const makeOutputSink = () => {
    const parts: Buffer[] = [];
    let size = 0;
    let capped = false; // 窗口已封顶。恰好填满(size >= maxOutput)也置 truncated,与同步结算的 >= 语义一致
    let spill: fs.WriteStream | null = null;
    let spillPath: string | null = null;
    const spillBytes = (part: Buffer) => {
      if (part.length === 0) return;
      if (!spill || !spillPath) {
        spillPath = path.join(
          os.tmpdir(),
          `ihui-sandbox-spill-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.log`,
        );
        spill = fs.createWriteStream(spillPath, { flags: 'w' });
        spill.on('error', () => { /* 磁盘满等写失败:诊断归结算矩阵,spill 尽力而为 */ });
      }
      spill.write(part);
    };
    return {
      push(chunk: Buffer) {
        if (capped) {
          truncated = true;
          spillBytes(chunk);
          return;
        }
        parts.push(chunk);
        size += chunk.length;
        if (size >= maxOutput) {
          truncated = true;
          capped = true;
          spillBytes(chunk.subarray(chunk.length - (size - maxOutput))); // 恰好填满时为空 → 不建文件
        }
      },
      /** 内存窗口文本(最多 maxOutput 字节)。 */
      view(): string {
        const whole = Buffer.concat(parts);
        return (whole.length > maxOutput ? whole.subarray(0, maxOutput) : whole).toString('utf-8');
      },
      /** close 后结算:收尾 spill 流并读尾 4KB 作预览;文件保留(输出文件化 —— 全量证据落盘,
       *  路径进 stderr 供人工取证,临时目录由系统回收)。 */
      async drain(): Promise<string> {
        if (!spillPath) return '';
        const stream = spill;
        spill = null;
        if (stream) await new Promise<void>((resolve) => stream.end(() => resolve()));
        let tail = '';
        try {
          const stat = fs.statSync(spillPath);
          const start = Math.max(0, stat.size - SPILL_TAIL_PREVIEW_BYTES);
          const buf = Buffer.alloc(stat.size - start);
          const fd = fs.openSync(spillPath, 'r');
          try {
            fs.readSync(fd, buf, 0, buf.length, start);
          } finally {
            fs.closeSync(fd);
          }
          tail = buf.toString('utf-8');
        } catch { /* 预览读不到就只报路径,不冒充"没溢出" */ }
        return `\n⚠ output_spilled: ${t('cli.sandbox.outputSpilled', { maxOutputBytes: maxOutput, path: spillPath })}\n${tail}`;
      },
    };
  };
  const stdoutSink = makeOutputSink();
  const stderrSink = makeOutputSink();

  const startedAt = Date.now();
  const result = new Promise<SandboxResult>((resolve) => {
    const timer = setTimeout(() => {
      if (!settled) {
        // G-896416 收编模式:到点把"杀不杀"的决定让给回调方 —— 不置 timedOutFlag
        // (本函数没杀,不能谎报超时),不 killTree;若到点时进程已恰好自行退出,
        // close 事件已把 settled 置位,这里自然不会再走。
        if (opts.onDeadline) {
          opts.onDeadline();
          return;
        }
        timedOutFlag = true;
        killTree();
        setTimeout(() => {
          if (!settled && process.platform === 'win32') {
            try { child.kill('SIGKILL'); } catch { /* ignore */ }
          }
        }, 5000);
      }
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => stdoutSink.push(chunk));
    child.stderr?.on('data', (chunk: Buffer) => stderrSink.push(chunk));

    child.on('error', async (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const spillNote = (await stdoutSink.drain()) + (await stderrSink.drain());
      resolve({
        stdout: stdoutSink.view(),
        stderr: stderrSink.view() + spillNote + `\n[启动失败: ${err.message}]`,
        exitCode: null,
        timedOut: false,
        truncated,
        blocked: false,
      });
    });

    child.on('close', async (code: number | null, signal: NodeJS.Signals | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const spillNote = (await stdoutSink.drain()) + (await stderrSink.drain());
      // Windows taskkill /F 后 close 的 signal 为 null,必须用显式标志而非 signal 判断
      const timedOut = timedOutFlag || signal === 'SIGTERM' || signal === 'SIGKILL';
      appendSandboxAuditLog({
        timestamp: new Date().toISOString(),
        command: commandLine,
        cwd: opts.cwd,
        exitCode: code,
        timedOut,
        truncated,
        blocked: false,
        suspiciousEnvVars: suspiciousEnvVars.length > 0 ? suspiciousEnvVars : undefined,
        durationMs: Date.now() - startedAt,
      });
      resolve({
        stdout: stdoutSink.view(),
        stderr: stderrSink.view() + spillNote,
        exitCode: code,
        timedOut,
        truncated,
        blocked: false,
      });
    });
  });

  return { process: child, result };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
