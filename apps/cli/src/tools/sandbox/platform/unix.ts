// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * POSIX 沙箱后端 — Linux(bwrap → prlimit → plain) / macOS(sandbox-exec → prlimit → plain)。
 *
 * 真实能力边界(如实声明):
 *   - bwrap:挂载命名空间真隔离(文件系统白名单 + 可选 --unshare-net 断网)
 *   - sandbox-exec:macOS Seatbelt profile 真隔离(系统自带的 profile 语法)
 *   - prlimit:仅资源上限(地址空间/CPU 时间),无文件系统隔离(降级)
 *   - plain:纯 shell ulimit 兜底,最弱(降级)
 *   - Landlock:Node 无原生 syscall 封装,依赖 bwrap 转达;无 bwrap 时降级
 */

import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import type { SandboxExecOptions, SandboxExecResult, SandboxPolicy } from '../policy.js';
import { evaluateCommand, validatePolicy } from '../policy.js';
import { detectPlatformCapabilities } from './detect.js';

/** 默认超时 60s */
const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * POSIX 统一入口:按 detect 的降级链选择后端执行。
 * 所有后端都先过策略层(evaluateCommand)拦截。
 */
export async function runSandboxedUnix(
  policy: SandboxPolicy,
  commandLine: string,
  options: SandboxExecOptions = {},
): Promise<SandboxExecResult> {
  const caps = await detectPlatformCapabilities();
  switch (caps.backend) {
    case 'bwrap':
      return runWithBwrap(policy, commandLine, options);
    case 'sandbox-exec':
      return runWithSandboxExec(policy, commandLine, options);
    case 'prlimit':
      return runWithPrlimit(policy, commandLine, options);
    default:
      return runWithPlain(policy, commandLine, options);
  }
}

/* ============================ bwrap(Linux) ============================ */

/** 构建 bubblewrap 参数:只读挂载根 + 工作区可写 + denyPaths 用 tmpfs 遮蔽 + 可选断网 */
export function buildBwrapArgs(policy: SandboxPolicy, commandLine: string, cwd: string): string[] {
  // 相对路径统一解析到 workspaceRoot 下(bwrap/seatbelt 都需要绝对路径)
  const resolveRel = (p: string): string =>
    path.isAbsolute(p) ? p : path.join(policy.workspaceRoot, p);
  const args: string[] = [
    '--dev', '/dev',
    '--proc', '/proc',
    // 整个根文件系统只读(基础视野),再按需放开可写面
    '--ro-bind', '/', '/',
    // 工作区可写
    '--bind', policy.workspaceRoot, policy.workspaceRoot,
    // 额外可写授权
    ...(policy.allowWrite ?? []).map((p) => ['--bind', resolveRel(p), resolveRel(p)]).flat(),
    // denyPaths 最高优先:用 tmpfs 遮蔽(bwrap 后参数覆盖前参数),写入落内存盘不落真实磁盘
    ...(policy.denyPaths ?? []).map((p) => ['--tmpfs', resolveRel(p)]).flat(),
    // 断网(默认拒绝)
    ...(policy.allowNet === true ? [] : ['--unshare-net']),
    // 加固项:父进程死则子进程死 + 新会话脱离 TTY 控制
    '--die-with-parent',
    '--new-session',
    '--chdir', cwd,
  ];
  // 工作目录必须存在,bwrap 才能绑定
  if (cwd !== policy.workspaceRoot && !cwd.startsWith(policy.workspaceRoot)) {
    args.push('--bind', cwd, cwd);
  }
  args.push('--', '/bin/sh', '-c', commandLine);
  return args;
}

async function runWithBwrap(policy: SandboxPolicy, commandLine: string, options: SandboxExecOptions): Promise<SandboxExecResult> {
  const decision = evaluateCommand(policy, commandLine);
  if (!decision.allowed) {
    return refusedResult('bwrap', decision.violations);
  }
  const cwd = options.cwd ?? policy.workspaceRoot;
  const args = buildBwrapArgs(policy, commandLine, cwd);
  return spawnPosix('bwrap', args, policy, cwd, options, 'bwrap');
}

/* ======================= sandbox-exec(macOS) ======================= */

/** 生成 Seatbelt profile(默认拒绝,按策略放开读/写/网络) */
export function buildSeatbeltProfile(policy: SandboxPolicy): string {
  // 相对路径统一解析到 workspaceRoot 下(profile 的 subpath 需要绝对路径)
  const resolveRel = (p: string): string =>
    path.isAbsolute(p) ? p : path.join(policy.workspaceRoot, p);
  const lines: string[] = ['(version 1)', '(deny default)'];
  // 读取:全盘读放宽(Seatbelt 下全禁读会导致动态链接器无法工作),写入按白名单收紧
  lines.push('(allow file-read*)');
  lines.push(`(allow file-write* (subpath "${policy.workspaceRoot}"))`);
  for (const p of policy.allowWrite ?? []) {
    lines.push(`(allow file-write* (subpath "${resolveRel(p)}"))`);
  }
  // denyPaths 最高优先:显式拒绝写与读元数据
  for (const p of policy.denyPaths ?? []) {
    lines.push(`(deny file-write* (subpath "${resolveRel(p)}"))`);
  }
  lines.push('(allow process-exec)');
  lines.push('(allow process-fork)');
  lines.push('(allow sysctl-read)');
  lines.push('(allow mach-lookup)');
  if (policy.allowNet === true) {
    lines.push('(allow network*)');
  }
  return lines.join('\n');
}

async function runWithSandboxExec(policy: SandboxPolicy, commandLine: string, options: SandboxExecOptions): Promise<SandboxExecResult> {
  const decision = evaluateCommand(policy, commandLine);
  if (!decision.allowed) {
    return refusedResult('sandbox-exec', decision.violations);
  }
  const cwd = options.cwd ?? policy.workspaceRoot;
  let workDir: string | undefined;
  try {
    workDir = await mkdtemp(path.join(tmpdir(), 'ihui-sb-'));
    const profileFile = path.join(workDir, 'sandbox.sb');
    await writeFile(profileFile, buildSeatbeltProfile(policy), 'utf8');
    const shellCmd = `exec ${commandLine}`;
    return await spawnPosix(
      'sandbox-exec',
      ['-f', profileFile, '/bin/sh', '-c', shellCmd],
      policy, cwd, options, 'sandbox-exec',
    );
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/* ======================= prlimit(Linux 降级) ======================= */

/** prlimit 降级:仅设置地址空间与 CPU 时间上限,无文件系统隔离 */
export function buildPrlimitArgs(policy: SandboxPolicy, commandLine: string): string[] {
  const args: string[] = [];
  if (policy.maxMemoryBytes) args.push(`--as=${policy.maxMemoryBytes}`);
  if (policy.maxCpuMs) args.push(`--cpu=${Math.max(1, Math.ceil(policy.maxCpuMs / 1000))}`);
  args.push('--', '/bin/sh', '-c', `ulimit -v 262144 2>/dev/null; exec ${commandLine}`);
  return args;
}

async function runWithPrlimit(policy: SandboxPolicy, commandLine: string, options: SandboxExecOptions): Promise<SandboxExecResult> {
  const decision = evaluateCommand(policy, commandLine);
  if (!decision.allowed) {
    return refusedResult('prlimit', decision.violations);
  }
  const cwd = options.cwd ?? policy.workspaceRoot;
  const args = buildPrlimitArgs(policy, commandLine);
  return spawnPosix('prlimit', args, policy, cwd, options, 'prlimit');
}

/* ========================= plain(最终兜底) ========================= */

/** plain 降级:sh -c + ulimit 软限制,无 OS 隔离,仅策略层过滤 */
async function runWithPlain(policy: SandboxPolicy, commandLine: string, options: SandboxExecOptions): Promise<SandboxExecResult> {
  const decision = evaluateCommand(policy, commandLine);
  if (!decision.allowed) {
    return refusedResult('plain', decision.violations);
  }
  const cwd = options.cwd ?? policy.workspaceRoot;
  const script = [
    `ulimit -t ${policy.maxCpuMs ? Math.max(1, Math.ceil(policy.maxCpuMs / 1000)) : 60} 2>/dev/null || true`,
    `exec ${commandLine}`,
  ].join('\n');
  return spawnPosix('/bin/sh', ['-c', script], policy, cwd, options, 'plain');
}

/* ============================ 通用 spawn ============================ */

/** POSIX 通用子进程执行:超时强杀 + 输出收集 + maxOutputBytes 截断 */
async function spawnPosix(
  file: string,
  args: string[],
  policy: SandboxPolicy,
  cwd: string,
  options: SandboxExecOptions,
  backend: SandboxExecResult['backend'],
): Promise<SandboxExecResult> {
  const timeoutMs = policy.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutputBytes = policy.maxOutputBytes ?? 512 * 1024;

  return new Promise<SandboxExecResult>((resolve) => {
    const child = spawn(file, args, {
      cwd,
      env: process.env, // POSIX 后端依赖系统 PATH;敏感变量过滤由策略层 blockedEnvVars 覆盖 bwrap --clearenv 场景
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let truncated = false;
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    const finish = (code: number | null, signal: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        backend,
        exitCode: timedOut ? 124 : code,
        signal,
        stdout: truncated ? stdout.slice(0, maxOutputBytes) : stdout,
        stderr,
        timedOut,
        truncated,
        refused: false,
      });
    };

    child.stdout!.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      if (Buffer.byteLength(stdout, 'utf8') > maxOutputBytes) {
        truncated = true;
        child.kill('SIGKILL'); // 输出超限即终止,防内存打爆
      } else if (options.onOutput) {
        options.onOutput(chunk.toString('utf8'));
      }
    });
    child.stderr!.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
      if (Buffer.byteLength(stderr, 'utf8') > maxOutputBytes) stderr = stderr.slice(0, maxOutputBytes);
    });
    child.on('error', (err) => {
      stderr += `\n[sandbox] spawn 失败: ${err.message}`;
      finish(null, null);
    });
    child.on('close', (code, signal) => finish(code, signal));
  });
}

/** 策略拒绝的统一返回结构 */
function refusedResult(backend: SandboxExecResult['backend'], violations: NonNullable<SandboxExecResult['violations']>): SandboxExecResult {
  return {
    backend,
    exitCode: null,
    signal: null,
    stdout: '',
    stderr: violations.map((v) => `[${v.kind}] ${v.message}`).join('\n'),
    timedOut: false,
    truncated: false,
    refused: true,
    violations,
  };
}

/** 导出校验函数供门面复用(保持单一路径) */
export { validatePolicy };
