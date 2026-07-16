/**
 * 子进程沙盒 — 为命令执行提供资源限制。
 *
 * 灵感来源:grok-build 的 sandbox 模块(命令执行隔离 + 资源上限)。
 * 简化策略(做减法):
 *   - 基于 node:child_process spawnSync(shell 模式)
 *   - 资源限制:超时(timeoutMs)/ 最大输出(maxOutputBytes)
 *   - 不实现 chroot/namespace 级隔离(超出 Node 能力范围)
 *   - cwd 强制设为工作区路径,防止越权访问
 */

import { spawnSync } from 'node:child_process';

export interface SandboxOptions {
  cwd: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  truncated: boolean;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024;

export function runSandboxed(commandLine: string, opts: SandboxOptions): SandboxResult {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutput = opts.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;

  const result = spawnSync(commandLine, {
    cwd: opts.cwd,
    encoding: 'utf-8',
    timeout: timeoutMs,
    maxBuffer: maxOutput,
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';

  return {
    stdout,
    stderr,
    exitCode: result.status,
    timedOut: result.signal === 'SIGTERM' || result.signal === 'SIGKILL',
    truncated: stdout.length >= maxOutput || stderr.length >= maxOutput,
  };
}
