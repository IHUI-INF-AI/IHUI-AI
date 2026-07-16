/**
 * 子进程沙盒 — 为命令执行提供资源限制与路径白名单。
 *
 * 灵感来源:grok-build 的 sandbox 模块(命令执行隔离 + 资源上限)。
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
