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
 * 调用预算(票 07-A,2026-09-30):本文件**不得**再出现第二张预算表 —— 派生预算
 * (绝对路径候选 + `IHUI_GIT_BIN` 覆盖 + env 白名单投影 + 分档超时 + 10MiB 帽 + killSignal)
 * 一律经 `plugins/git-runner.ts::resolveGitSpawnOptions` 唯一出口解析:
 *   - 旧形态的 bare 命令名派生(直接 spawnSync "git" 字面量)、所有子命令共用一档 30s、
 *     maxBuffer 1MiB、无字节帽后 kill、无超时诊断,是同一纪律的两份实现里漂移的那一半;
 *   - 超时/超输出被杀时结果带 `killed` 诊断(elapsed/killAt/forceKill/orphaned);
 *   - stderr 进结果面前先过 `redactForPrint` 脱敏 —— push/fetch 失败时 git 会把
 *     `https://user:<token>@host` 原样打进 stderr,一旦进 transcript 就是守门 67 的对象。
 */
import { spawnSync } from 'node:child_process';
import {
  GIT_NETWORK_TIMEOUT_MS,
  gitVerbOf,
  redactForPrint,
  resolveGitSpawnOptions,
} from '../plugins/git-runner.js';
import type { ToolResult } from './index.js';

/** 网络族动词:比本地操作慢一个量级,走独立一档(档位表住在 git-runner,这里只选档不立档) */
const NETWORK_VERBS: ReadonlySet<string> = new Set(['clone', 'fetch', 'pull', 'push', 'ls-remote']);

/** 超时/超输出被杀时的封顶诊断(四字段名是验收契约,不得改名) */
export interface GitCappedDiagnostics {
  /** 实际耗时(ms) */
  elapsed: number;
  /** 封顶阈值(ms 或字节数换算的时限) */
  killAt: number;
  /** 是否升级到强杀(SIGTERM 一档到位时为 false) */
  forceKill: boolean;
  /** 是否存在孤儿进程(spawnSync 同步等待 ⇒ 恒 false) */
  orphaned: boolean;
  /** 触发原因 */
  reason: 'timeout' | 'output-too-large';
}

export interface GitExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  /** 仅当本次派生被预算封顶杀掉时出现(超时/输出超限) */
  killed?: GitCappedDiagnostics;
}

export interface GitExecOptions {
  /** 显式超时覆盖(不传 ⇒ 按 git-runner 档位:网络族 120s,其余 90s) */
  timeoutMs?: number;
  /**
   * 受控 env 扩展位:白名单投影之外的键(如按范围提交的 GIT_INDEX_FILE)必须从这里显式给,
   * 不得绕过白名单整份透传
   */
  extraEnv?: Record<string, string>;
}

/**
 * git 派生唯一出口(工具面)。预算解析全部委托 git-runner,本文件零预算字面量。
 */
export function execGit(args: string[], cwd: string, opts: GitExecOptions | number = {}): GitExecResult {
  // 兼容旧签名:第三参曾是裸 timeoutMs 数字
  const options: GitExecOptions = typeof opts === 'number' ? { timeoutMs: opts } : opts;
  const verb = gitVerbOf(args);
  // 分档:调用方显式给了就尊重;没给 ⇒ 网络族独立一档,其余走 git-runner 默认档
  const effectiveTimeout =
    options.timeoutMs ?? (NETWORK_VERBS.has(verb) ? GIT_NETWORK_TIMEOUT_MS : undefined);
  const resolved = resolveGitSpawnOptions({ cwd, timeoutMs: effectiveTimeout });
  const startedAt = Date.now();
  const result = spawnSync(resolved.binary, args, {
    cwd,
    encoding: 'utf8',
    timeout: resolved.timeoutMs,
    maxBuffer: resolved.maxBufferBytes,
    windowsHide: resolved.windowsHide,
    killSignal: resolved.killSignal,
    env:
      options.extraEnv && Object.keys(options.extraEnv).length > 0
        ? { ...resolved.env, ...options.extraEnv }
        : resolved.env,
    // 本调用不消费 stdin(无 input/--stdin):默认全管道在 Windows 病会话下
    // spawnSync 建子进程 stdin 管道必 EBUSY(实证见 .workbuddy/skills/ihui-spawn-ebusy-fix),
    // 凡不喂 stdin 的派生一律 ['ignore','pipe','pipe']
    stdio: ['ignore', 'pipe', 'pipe'] as const,
  });

  const rawError = result.error as (NodeJS.ErrnoException | undefined) | undefined;
  const errCode = rawError && typeof rawError === 'object' ? String(rawError.code ?? '') : '';
  if (errCode === 'ETIMEDOUT') {
    return {
      stdout: (result.stdout as string) ?? '',
      stderr: redactForPrint((result.stderr as string) ?? ''),
      exitCode: null,
      killed: {
        elapsed: Date.now() - startedAt,
        killAt: resolved.timeoutMs,
        forceKill: false,
        orphaned: false,
        reason: 'timeout',
      },
    };
  }
  if (errCode === 'ENOBUFS') {
    return {
      stdout: (result.stdout as string) ?? '',
      stderr: redactForPrint((result.stderr as string) ?? ''),
      exitCode: null,
      killed: {
        elapsed: Date.now() - startedAt,
        killAt: resolved.maxBufferBytes,
        forceKill: false,
        orphaned: false,
        reason: 'output-too-large',
      },
    };
  }
  return {
    stdout: (result.stdout as string) ?? '',
    // stderr 先脱敏再进结果面:git 会把内嵌口令的远端 URL 原样打进 stderr
    stderr: redactForPrint((result.stderr as string) ?? ''),
    exitCode: result.status,
  };
}

export function formatGitResult(r: GitExecResult, successOnZero = true): ToolResult {
  const parts: string[] = [];
  if (r.stdout.trim()) parts.push(r.stdout.trimEnd());
  if (r.stderr.trim()) parts.push(`[stderr] ${r.stderr.trimEnd()}`);
  if (r.killed) {
    parts.push(
      `[git-capped] ${r.killed.reason}: ${JSON.stringify(r.killed)} (预算表见 plugins/git-runner.ts)`,
    );
  }
  let error: string | undefined;
  if (r.killed) {
    error = `git ${r.killed.reason} 已被预算封顶(${r.killed.elapsed}ms)`;
  } else if (r.exitCode !== null && r.exitCode !== 0) {
    error = `git 退出码 ${r.exitCode}`;
  }
  return {
    success: r.killed ? false : successOnZero ? r.exitCode === 0 : true,
    output: parts.join('\n') || '(无输出)',
    error,
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
