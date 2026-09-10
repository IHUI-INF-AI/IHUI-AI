// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 沙箱策略模型 — 对标 Codex CLI Landlock/seccomp/Seatbelt 的策略层。
 *
 * 纯函数实现:不触碰进程 / 文件系统,只做策略校验与命令评估,便于单测。
 * 白名单优先设计:
 *   1. commandAllowlist 设置后,不在白名单的命令直接拒绝(白名单优先)
 *   2. 内置危险命令黑名单 + 用户追加 denyPatterns(黑名单兜底)
 *   3. denyPaths 优先级最高,即使路径落在 allowWrite/allowRead 内也拒绝
 *   4. allowRead/allowWrite 未显式设置时默认 = [workspaceRoot](默认最小授权)
 *   5. allowNet 默认 false(默认拒绝网络)
 */

import * as path from 'node:path';
import * as os from 'node:os';

/** 沙箱策略(OS 级沙箱 + 策略引擎共用) */
export interface SandboxPolicy {
  /** 工作区根目录(绝对路径),命令执行的基准 cwd 与默认授权范围 */
  workspaceRoot: string;
  /** 额外允许读取的路径(绝对路径或相对 workspaceRoot;未设置默认仅 workspaceRoot) */
  allowRead?: string[];
  /** 允许写入的路径(未设置默认仅 workspaceRoot) */
  allowWrite?: string[];
  /** 是否允许网络访问(默认 false,默认拒绝) */
  allowNet?: boolean;
  /** 显式拒绝路径(优先级最高,即使落在工作区内也拒绝) */
  denyPaths?: string[];
  /** 命令白名单(设置后只允许执行列表内命令;空/未设置=允许全部) */
  commandAllowlist?: string[];
  /** 额外危险命令正则源字符串(追加到内置黑名单) */
  denyPatterns?: string[];
  /** 屏蔽的环境变量名(支持 * 通配,子进程不继承) */
  blockedEnvVars?: string[];
  /** 超时毫秒数 */
  timeoutMs?: number;
  /** 子进程最大内存(bytes;POSIX prlimit / Windows JOB 对象生效) */
  maxMemoryBytes?: number;
  /** 子进程最大 CPU 时间(ms;POSIX prlimit 生效) */
  maxCpuMs?: number;
  /** 最大输出字节 */
  maxOutputBytes?: number;
}

/** 策略违规类型 */
export type PolicyViolationKind =
  | 'empty_command'
  | 'command_not_allowed'
  | 'dangerous_command'
  | 'network_denied'
  | 'path_escape'
  | 'deny_path';

export interface PolicyViolation {
  kind: PolicyViolationKind;
  message: string;
}

export interface PolicyDecision {
  allowed: boolean;
  violations: PolicyViolation[];
}

/* ============ 沙箱执行层共享类型(各平台后端 + 门面共用) ============ */

/** 沙箱执行选项 */
export interface SandboxExecOptions {
  /** 工作目录(默认 policy.workspaceRoot) */
  cwd?: string;
  /** 附加环境变量(在 blockedEnvVars 过滤之后合并) */
  env?: Record<string, string>;
  /** 输出回调(实时流式,后端支持时调用) */
  onOutput?: (chunk: string) => void;
}

/** 沙箱执行结果(所有平台后端统一返回结构) */
export interface SandboxExecResult {
  /** 实际使用的后端 */
  backend: 'landlock' | 'bwrap' | 'sandbox-exec' | 'restricted-token' | 'prlimit' | 'plain';
  /** 退出码(策略拒绝时为 null) */
  exitCode: number | null;
  /** 终止信号 */
  signal: string | null;
  stdout: string;
  stderr: string;
  /** 是否因超时被强杀 */
  timedOut: boolean;
  /** 输出是否被 maxOutputBytes 截断 */
  truncated: boolean;
  /** 是否被策略层拒绝(未真正执行) */
  refused: boolean;
  /** 策略拒绝时的违规明细 */
  violations?: PolicyViolation[];
}

/** 内置危险命令黑名单(与 tools/command-safety.ts 风格对齐,覆盖跨平台破坏性命令) */
export const DANGEROUS_SANDBOX_PATTERNS: readonly RegExp[] = [
  // POSIX 破坏性删除
  /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f?|--recursive)\b/i,
  /\brd\s+\/s\b/i,
  // 文件系统 / 磁盘级破坏
  /\bmkfs(\.\w+)?\b/i,
  /\bdd\b[^;&|]*of=\/dev\//i,
  /\bformat\s+[a-zA-Z]:/i,
  /\bdiskpart\b/i,
  /\bdel\s+(\/s\s+\/q|\/q\s+\/s)\s+[a-zA-Z]:\\?/i,
  /\bRemove-Item\b[^|;&]*-Recurse\b/i,
  /\bshred\b/i,
  // 注册表系统级删除
  /\breg\s+delete\s+HKLM\b/i,
  // 系统控制
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bpkill\b/i,
  /\bkill(all)?\s+-9\b/i,
  // fork 炸弹
  /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;\s*:/,
  // 管道外联:远程脚本直接管道进 shell 执行(curl/wget ... | sh/bash/pwsh/iex)
  /https?:\/\/[^|;&\n]*\|\s*(sudo\s+)?(sh|bash|zsh|ksh|fish|powershell|pwsh|iex|Invoke-Expression)\b/i,
  /\b(iwr|irm|curl|wget|Invoke-WebRequest|Invoke-RestMethod|certutil|bitsadmin)\b[^;\n]{0,200}\|\s*(iex|Invoke-Expression)\b/i,
];

/** 网络访问类命令 basename(allowNet=false 时拒绝) */
export const NETWORK_COMMAND_BASENAMES: readonly string[] = [
  'curl', 'wget', 'nc', 'ncat', 'netcat', 'telnet', 'ssh', 'scp', 'sftp', 'ftp',
  'certutil', 'bitsadmin', 'Invoke-WebRequest', 'Invoke-RestMethod',
];

/**
 * 校验策略合法性,返回错误列表(空数组 = 合法)。
 * 注意:此函数不读盘,workspaceRoot 是否真实存在由运行时层负责。
 */
export function validatePolicy(policy: SandboxPolicy): string[] {
  const errors: string[] = [];
  if (!policy.workspaceRoot || typeof policy.workspaceRoot !== 'string') {
    errors.push('workspaceRoot 必须为非空字符串');
    return errors;
  }
  // 反斜杠归一为正斜杠再判盘符根(兼容 C:\ 与 C:/ 写法)
  const normalized = policy.workspaceRoot.replace(/\/+/g, '\\');
  if (!path.isAbsolute(policy.workspaceRoot)) {
    errors.push(`workspaceRoot 必须为绝对路径: ${policy.workspaceRoot}`);
  }
  // 盘符根目录授权面过大(C:\ 整盘可写),禁止作为工作区
  if (/^[a-zA-Z]:\\?$/.test(normalized)) {
    errors.push(`workspaceRoot 不能是盘符根目录(授权面过大): ${policy.workspaceRoot}`);
  }
  if (policy.commandAllowlist !== undefined && !Array.isArray(policy.commandAllowlist)) {
    errors.push('commandAllowlist 必须为字符串数组');
  }
  for (const key of ['allowRead', 'allowWrite', 'denyPaths'] as const) {
    const v = policy[key];
    if (v !== undefined && !Array.isArray(v)) {
      errors.push(`${key} 必须为字符串数组`);
    }
  }
  if (policy.timeoutMs !== undefined && (!Number.isFinite(policy.timeoutMs) || policy.timeoutMs <= 0)) {
    errors.push('timeoutMs 必须为正数');
  }
  if (policy.maxMemoryBytes !== undefined && (!Number.isFinite(policy.maxMemoryBytes) || policy.maxMemoryBytes <= 0)) {
    errors.push('maxMemoryBytes 必须为正数');
  }
  return errors;
}

/** 路径归一化:统一分隔符 + 解析为绝对路径 + Windows 大小写不敏感比较 */
export function normalizeAbsPath(p: string, base: string): string {
  const abs = path.isAbsolute(p) ? path.resolve(p) : path.resolve(base, p);
  return process.platform === 'win32' ? abs.toLowerCase() : abs;
}

/** 判断 child 是否在 parent 目录内(含自身) */
export function isWithinPath(child: string, parent: string): boolean {
  const c = normalizeAbsPath(child, process.cwd());
  const p = normalizeAbsPath(parent, process.cwd());
  if (c === p) return true;
  return c.startsWith(p.endsWith(path.sep) ? p : p + path.sep);
}

/** 命令是否在白名单内(basename 匹配,大小写不敏感,自动忽略 .exe/.cmd 等后缀) */
export function isCommandAllowed(commandLine: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;
  const name = extractCommandName(commandLine);
  if (!name) return false;
  return allowlist.some((a) => a.toLowerCase() === name.toLowerCase());
}

/** 提取命令行第一个 token 的 basename(去引号、去后缀;支持带引号的含空格路径) */
export function extractCommandName(commandLine: string): string {
  const trimmed = commandLine.trim();
  // 带引号的可执行路径:"C:\Program Files\nodejs\node.exe" → 取引号内完整路径的 basename
  const quoted = /^"([^"]+)"/.exec(trimmed) ?? /^'([^']+)'/.exec(trimmed);
  if (quoted) {
    return ((quoted[1] ?? '').split(/[/\\]/).pop() ?? '').replace(/\.(exe|cmd|bat|com|ps1)$/i, '');
  }
  const firstToken = trimmed.split(/\s+/)[0] ?? '';
  return (firstToken.split(/[/\\]/).pop() ?? '').replace(/\.(exe|cmd|bat|com|ps1)$/i, '');
}

/** 从命令行提取类路径 token(含 / 或 \,或以 ~ 开头,或为 . / ..) */
export function extractPathTokens(commandLine: string): string[] {
  // 先去引号(防 "C:\x" 伪装)
  const dequoted = commandLine.replace(/["']/g, '');
  return dequoted
    .split(/\s+/)
    .filter((t) => {
      if (!t) return false;
      if (t === '.' || t === '..') return true;
      if (t.startsWith('~')) return true;
      if (t.includes('\\')) return true;
      if (t.includes('/')) {
        // 排除 Windows 命令行开关(如 cmd /c /d /s、robocopy /mir 等 1-2 字符短开关),
        // 否则会被误判为路径导致合法命令被 path_escape 拒绝
        if (/^\/[a-zA-Z0-9]{1,2}$/.test(t)) return false;
        return true;
      }
      return false;
    });
}

/**
 * 综合策略评估(白名单优先,黑名单兜底,denyPaths 最高优先)。
 * 返回所有违规项(而非首个),便于调用方完整报告。
 */
export function evaluateCommand(policy: SandboxPolicy, commandLine: string): PolicyDecision {
  const violations: PolicyViolation[] = [];
  const trimmed = commandLine.trim();
  if (!trimmed) {
    return { allowed: false, violations: [{ kind: 'empty_command', message: '命令为空' }] };
  }

  // 1. 白名单优先:设置了 commandAllowlist 时,未列入白名单的命令直接拒绝
  if (policy.commandAllowlist && policy.commandAllowlist.length > 0) {
    if (!isCommandAllowed(trimmed, policy.commandAllowlist)) {
      violations.push({
        kind: 'command_not_allowed',
        message: `命令不在白名单: ${extractCommandName(trimmed)}`,
      });
    }
  }

  // 2. 危险命令黑名单(内置 + 用户追加)。匹配前去引号,防引号伪装绕过
  const dequoted = trimmed.replace(/["']/g, '');
  const patterns: RegExp[] = [...DANGEROUS_SANDBOX_PATTERNS];
  if (policy.denyPatterns) {
    for (const src of policy.denyPatterns) {
      try {
        patterns.push(new RegExp(src, 'i'));
      } catch {
        // 非法正则忽略,不影响其余黑名单生效
      }
    }
  }
  for (const re of patterns) {
    if (re.test(dequoted)) {
      violations.push({
        kind: 'dangerous_command',
        message: `命令匹配危险模式: ${re.source}`,
      });
      break; // 命中一条即报告,避免重复噪音
    }
  }

  // 3. 网络策略:allowNet=false 时拒绝网络类命令
  if (policy.allowNet !== true) {
    const name = extractCommandName(trimmed).toLowerCase();
    const netNames = NETWORK_COMMAND_BASENAMES.map((n) => n.toLowerCase());
    if (netNames.includes(name)) {
      violations.push({
        kind: 'network_denied',
        message: `沙箱策略禁止网络访问,但命令疑似网络命令: ${name}`,
      });
    }
  }

  // 4. 路径逃逸 + denyPaths 检查
  const ws = policy.workspaceRoot;
  // 跨平台可移植分析(2026-09-10 安全修复):统一反斜杠→正斜杠、剥离盘符后按
  // POSIX 语义求值。此前依赖宿主平台 path 语义,Windows 风格 token(C:\..、..\..)
  // 在 Linux 上被当作普通文件名,逃逸检测失效 = 策略绕过(CI 路径逃逸用例红)。
  const toPortable = (p: string): string => p.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '');
  const wsP = toPortable(path.resolve(ws));
  const portableAbs = (p: string): string =>
    path.isAbsolute(p) ? toPortable(path.resolve(p)) : path.posix.resolve(wsP, toPortable(p));
  const allowReadP = (policy.allowRead ?? [ws]).map(portableAbs);
  const allowWriteP = (policy.allowWrite ?? [ws]).map(portableAbs);
  const denyPathsP = (policy.denyPaths ?? []).map(portableAbs);
  const homeP = toPortable(os.homedir());

  const portableWithin = (child: string, parent: string): boolean => {
    const c = path.posix.resolve(child);
    const p = path.posix.resolve(parent);
    if (c === p) return true;
    return c.startsWith(p.endsWith('/') ? p : p + '/');
  };

  for (const token of extractPathTokens(trimmed)) {
    // ~ 展开到用户主目录(通常在工作区外);token 可能含反斜杠,统一可移植化
    const expanded = token.startsWith('~') ? toPortable(`${homeP}${token.slice(1)}`) : toPortable(token);
    const abs = path.posix.isAbsolute(expanded)
      ? path.posix.resolve(expanded)
      : path.posix.resolve(wsP, expanded);

    // 4a. denyPaths 最高优先级
    if (denyPathsP.some((d) => portableWithin(abs, d))) {
      violations.push({ kind: 'deny_path', message: `路径被策略显式拒绝: ${token}` });
      continue;
    }

    // 4b. 相对路径含 .. 逃逸出工作区(且不在额外授权列表内)
    // 4c. 绝对路径落在授权范围外(allowRead ∪ allowWrite)
    const inRead = allowReadP.some((a) => portableWithin(abs, a));
    const inWrite = allowWriteP.some((a) => portableWithin(abs, a));
    if (!inRead && !inWrite) {
      violations.push({
        kind: 'path_escape',
        message: `路径逃逸: ${token} 不在授权范围内(workspaceRoot=${ws})`,
      });
    }
  }

  return { allowed: violations.length === 0, violations };
}
