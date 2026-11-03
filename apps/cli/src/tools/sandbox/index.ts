// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * OS 级安全沙箱门面 — 对标 Codex CLI 的 Landlock/seccomp/Seatbelt。
 *
 * 架构:
 *   policy.ts            策略模型(白名单优先 + 黑名单兜底 + denyPaths 最高优先)
 *   platform/detect.ts   平台能力探测(选择后端与降级链路)
 *   platform/windows.ts  Windows 后端(PowerShell Start-Process -NoNewWindow,降级策略)
 *   platform/unix.ts     POSIX 后端(bwrap / sandbox-exec 真隔离 → prlimit / plain 降级)
 *
 * 使用方式:
 *   import { execSandboxed } from './tools/sandbox/index.js';
 *   const result = await execSandboxed({ workspaceRoot: 'G:\\proj' }, 'npm test');
 */

// 策略层全量透出(类型与纯函数,便于上层与测试直接引用)
export type {
  SandboxPolicy,
  SandboxExecOptions,
  SandboxExecResult,
  PolicyDecision,
  PolicyViolation,
  PolicyViolationKind,
} from './policy.js';
export {
  DANGEROUS_SANDBOX_PATTERNS,
  NETWORK_COMMAND_BASENAMES,
  evaluateCommand,
  extractCommandName,
  extractPathTokens,
  isCommandAllowed,
  isWithinPath,
  normalizeAbsPath,
  validatePolicy,
} from './policy.js';

// 平台能力探测透出
export {
  detectPlatformCapabilities,
  resetCapabilityCache,
} from './platform/detect.js';
export type { PlatformCapabilities, SandboxBackend } from './platform/detect.js';

import type { SandboxExecOptions, SandboxExecResult, SandboxPolicy } from './policy.js';
import { evaluateCommand, validatePolicy } from './policy.js';
import { runSandboxedWindows } from './platform/windows.js';
import { runSandboxedUnix } from './platform/unix.js';

/**
 * 在沙箱内执行命令(统一入口)。
 *
 * 流程:策略校验 → 命令评估(拒绝不执行)→ 按平台选择后端 → 收集统一结果。
 * 拒绝时返回 refused=true 并附 violations,不抛异常(调用方按业务决定如何呈现)。
 */
export async function execSandboxed(
  policy: SandboxPolicy,
  commandLine: string,
  options: SandboxExecOptions = {},
): Promise<SandboxExecResult> {
  // 1. 策略合法性校验(结构性错误直接拒绝)
  const policyErrors = validatePolicy(policy);
  if (policyErrors.length > 0) {
    return {
      backend: process.platform === 'win32' ? 'restricted-token' : 'plain',
      exitCode: null,
      signal: null,
      stdout: '',
      stderr: `沙箱策略非法: ${policyErrors.join('; ')}`,
      timedOut: false,
      truncated: false,
      refused: true,
    };
  }

  // 2. 命令策略评估(白名单优先 + 黑名单 + 网络 + 路径逃逸 + denyPaths)
  const decision = evaluateCommand(policy, commandLine);
  if (!decision.allowed) {
    return {
      backend: process.platform === 'win32' ? 'restricted-token' : 'plain',
      exitCode: null,
      signal: null,
      stdout: '',
      stderr: decision.violations.map((v) => `[${v.kind}] ${v.message}`).join('\n'),
      timedOut: false,
      truncated: false,
      refused: true,
      violations: decision.violations,
    };
  }

  // 3. 平台分派
  if (process.platform === 'win32') {
    return runSandboxedWindows(policy, commandLine, options);
  }
  return runSandboxedUnix(policy, commandLine, options);
}

/** 预检命令是否会命中沙箱策略(不执行,供 UI 提前预警) */
export function precheckSandboxedCommand(policy: SandboxPolicy, commandLine: string) {
  return evaluateCommand(policy, commandLine);
}
