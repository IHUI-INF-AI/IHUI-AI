// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Git 工具共享层 — 抽出 execGit / formatGitResult,供 git.ts 和 git-advanced.ts 复用。
 *
 * 解决循环依赖:
 *   - git.ts          → import { GIT_ADVANCED_TOOLS } from './git-advanced.js'
 *   - git-advanced.ts → import { execGit, formatGitResult } from './git.js'
 *   - 两边互相 import 会触发 ESM TDZ(顶层 const GIT_ADVANCED_TOOLS 在 import 阶段未初始化)
 *
 * 修复:把 execGit / formatGitResult 移到本文件,两边都 import ./git-shared.js,
 *       git-advanced.ts 不再 import git.ts,循环被打破。
 *
 * G-998107:本文件是 tools/ 域 git 派生的唯一出口 — execGit 直接复用
 * plugins/git-runner.ts 的 execGitCapped(绝对路径候选 + IHUI_GIT_BIN +
 * outlet 默认超时/10MiB 输出帽 + SIGTERM 封顶 + env 白名单),本文件内不得
 * 再出现第二张预算表(bare 'git' / 自写 timeout / maxBuffer 常量)。
 * stderr 进结果面前一律过 @ihui/shared 的 sanitizeEvidenceText 脱敏;
 * stdout 是命令正常输出(含 SHA 等机器标识),保持原字节不改形。
 */
import {
  execGitCapped,
  GIT_KILL_SIGNAL,
  GitBinaryUnavailableError,
  GitCommandFailedError,
  GitCommandTimeoutError,
  GitOutputTooLargeError,
  gitVerbOf,
} from '../plugins/git-runner.js';
import { sanitizeEvidenceText } from '@ihui/shared/utils/redact';
import type { ToolResult } from './index.js';

export interface GitExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export function execGit(args: string[], cwd: string, timeoutMs?: number): GitExecResult {
  const verb = gitVerbOf(args);
  const startedAt = Date.now();
  try {
    const stdout = execGitCapped(
      args,
      timeoutMs !== undefined && timeoutMs > 0 ? { cwd, timeoutMs } : { cwd },
    );
    return { stdout, stderr: '', exitCode: 0 };
  } catch (raw: unknown) {
    if (raw instanceof GitCommandTimeoutError) {
      const elapsedMs = Date.now() - startedAt;
      return {
        stdout: '',
        stderr:
          `git ${verb} 超时(timeout): elapsed=${elapsedMs}ms killAt=${raw.timeoutMs}ms ` +
          `forceKill=${GIT_KILL_SIGNAL} orphaned=unknown(已发终止信号,孙进程残留未探活)`,
        exitCode: null,
      };
    }
    if (raw instanceof GitOutputTooLargeError) {
      return { stdout: '', stderr: sanitizeEvidenceText(raw.message), exitCode: null };
    }
    if (raw instanceof GitBinaryUnavailableError) {
      return { stdout: '', stderr: sanitizeEvidenceText(raw.message), exitCode: null };
    }
    if (raw instanceof GitCommandFailedError) {
      const cause = raw.cause as { stdout?: unknown; stderr?: unknown } | undefined;
      const rawStdout = typeof cause?.stdout === 'string' ? cause.stdout : '';
      const rawStderr =
        typeof cause?.stderr === 'string' && cause.stderr.length > 0 ? cause.stderr : raw.message;
      return {
        stdout: rawStdout,
        stderr: sanitizeEvidenceText(rawStderr),
        exitCode: raw.status,
      };
    }
    const message = raw instanceof Error ? raw.message : String(raw);
    return { stdout: '', stderr: sanitizeEvidenceText(message), exitCode: statusOf(raw) };
  }
}

function statusOf(error: unknown): number | null {
  if (typeof error === 'object' && error !== null) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return null;
}

export function formatGitResult(r: GitExecResult, successOnZero = true): ToolResult {
  const cleanStderr = sanitizeEvidenceText(r.stderr);
  const parts: string[] = [];
  if (r.stdout.trim()) parts.push(r.stdout.trimEnd());
  if (cleanStderr.trim()) parts.push(`[stderr] ${cleanStderr.trimEnd()}`);
  const failed = r.exitCode !== null && r.exitCode !== 0;
  // 封顶失败(超时/超输出帽/git 缺失)无退出码:旧形态 error 为 undefined 会把一次失败
  // 读成"无错误说明",故把脱敏后的诊断文本直接作为 error(成功与数字退出码两档一字未动)。
  const cappedFailure = r.exitCode === null && cleanStderr.trim().length > 0;
  return {
    success: successOnZero ? r.exitCode === 0 : true,
    output: parts.join('\n') || '(无输出)',
    error: failed ? `git 退出码 ${r.exitCode}` : cappedFailure ? cleanStderr.trim() : undefined,
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
