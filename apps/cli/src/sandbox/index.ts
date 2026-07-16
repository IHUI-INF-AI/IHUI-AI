/**
 * 子进程沙盒 — 为命令执行提供资源限制与路径白名单。
 *
 * 灵感来源:cli 的 sandbox 模块(命令执行隔离 + 资源上限)。
 * 简化策略(做减法):
 *   - 基于 node:child_process spawnSync(shell 模式)
 *   - 资源限制:超时(timeoutMs)/ 最大输出(maxOutputBytes)/ 内存(maxMemoryBytes,POSIX)/ CPU(maxCpuMs,POSIX)
 *   - 路径白名单(allowedPaths):cwd 之外的路径需显式授权,防止越权访问
 *   - 不实现 chroot/namespace 级隔离(超出 Node 能力范围)
 */

import { spawnSync, type SpawnSyncOptions } from 'node:child_process';
import * as path from 'node:path';

export interface SandboxOptions {
  cwd: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  /** POSIX only: 子进程最大内存(RSS,bytes)。Windows 上忽略。 */
  maxMemoryBytes?: number;
  /** POSIX only: 子进程最大 CPU 时间(ms)。Windows 上忽略。 */
  maxCpuMs?: number;
  /** 允许访问的额外路径白名单(绝对路径或相对 cwd)。cwd 本身始终允许。 */
  allowedPaths?: string[];
  /** 命令白名单(只允许这些命令,空数组或 undefined=允许全部,向后兼容)。
   *  匹配规则:取命令行第一个 token 的 basename,与白名单做大小写不敏感比对。
   *  Windows 上会自动尝试 .exe/.cmd/.bat 后缀匹配。 */
  commandAllowlist?: string[];
  /** 屏蔽的环境变量名(子进程不会继承这些变量)。
   *  默认会屏蔽常见 API key 相关变量(见 DEFAULT_BLOCKED_ENV_VARS)。 */
  blockedEnvVars?: string[];
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  truncated: boolean;
  blocked: boolean;
  blockReason?: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024;

/** 默认屏蔽的环境变量(匹配 key,大小写不敏感,支持后缀通配如 *_API_KEY) */
const DEFAULT_BLOCKED_ENV_VARS = [
  'IHUI_API_KEY',
  'IHUI_AUDIT',
  'STEPFUN_API_KEY',
  'AGNES_API_KEY',
  'AI_CALLBACK_SECRET',
  'CREDENTIALS_ENCRYPTION_KEY',
  '*_API_KEY',
  '*_SECRET',
  '*_TOKEN',
  '*_PASSWORD',
];

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

function buildFilteredEnv(blocked: string[]): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (blocked.some((p) => matchPattern(key, p))) {
      delete env[key];
    }
  }
  return env;
}

function isPathAllowed(target: string, cwd: string, allowed: string[]): boolean {
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

export function runSandboxed(commandLine: string, opts: SandboxOptions): SandboxResult {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutput = opts.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const allowed = opts.allowedPaths ?? [];
  const commandAllowlist = opts.commandAllowlist ?? [];
  const blockedEnvVars = opts.blockedEnvVars ?? DEFAULT_BLOCKED_ENV_VARS;

  // 命令白名单检查
  if (commandAllowlist.length > 0) {
    const cmdName = extractCommandName(commandLine);
    if (cmdName && !isCommandAllowed(cmdName, commandAllowlist)) {
      return {
        stdout: '',
        stderr: `⛔ 命令被沙盒拒绝: ${cmdName}(不在白名单)`,
        exitCode: null,
        timedOut: false,
        truncated: false,
        blocked: true,
        blockReason: `command_not_allowed: ${cmdName}`,
      };
    }
  }

  // 路径白名单检查
  if (allowed.length > 0) {
    const pathsInCmd = extractPathsFromCommand(commandLine);
    for (const p of pathsInCmd) {
      if (!isPathAllowed(p, opts.cwd, allowed)) {
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

  const spawnOpts: SpawnSyncOptions = {
    cwd: opts.cwd,
    encoding: 'utf-8',
    timeout: timeoutMs,
    maxBuffer: maxOutput,
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    env: buildFilteredEnv(blockedEnvVars),
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

  const stdout = typeof result.stdout === 'string' ? result.stdout : '';
  const stderr = typeof result.stderr === 'string' ? result.stderr : '';

  return {
    stdout,
    stderr,
    exitCode: result.status,
    timedOut: result.signal === 'SIGTERM' || result.signal === 'SIGKILL',
    truncated: stdout.length >= maxOutput || stderr.length >= maxOutput,
    blocked: false,
  };
}
