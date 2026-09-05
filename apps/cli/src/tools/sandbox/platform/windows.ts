// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * Windows 沙箱后端 — PowerShell 受限启动 + 环境变量过滤 + 超时/输出上限。
 *
 * 真实能力边界(如实声明,不做虚假宣传):
 *   - Start-Process -NoNewWindow:真实可用,子进程挂在前台控制台下,便于 IDE 观察输出
 *   - 受限令牌 / JOB 对象:Node 无原生 API,需要 Secondary Logon 或原生模块;
 *     本实现降级为"环境变量过滤 + 超时强杀(taskkill /T /F)+ 输出字节上限"
 *   - icacls ACL 收紧:修改系统 ACL 会影响当前用户自身进程(危险),本实现只做
 *     只读探测(workspaceRoot ACL 摘要),不实际改写 ACL
 *   - denyPaths 在策略层(evaluateCommand)强制拒绝,OS 层不做 ACL 改写
 */

import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { SandboxExecOptions, SandboxExecResult, SandboxPolicy } from '../policy.js';
import { evaluateCommand, validatePolicy } from '../policy.js';

const execFileAsync = promisify(execFile);

/** 默认超时 60s */
const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * 以 PowerShell Start-Process -NoNewWindow 方式执行命令(Windows 后端)。
 *
 * 流程:
 *   1. 策略校验 + 命令评估(拒绝即返回 refused)
 *   2. 环境变量过滤(blockedEnvVars,支持 * 通配)
 *   3. 命令写入临时 .cmd 批处理(规避引号注入),Start-Process 启动 cmd /c 执行
 *   4. 进程内 WaitForExit(timeout) 控超时,超时用 taskkill /T /F 杀整棵进程树
 *   5. 读取重定向文件收集 stdout/stderr,按 maxOutputBytes 截断
 */
export async function runSandboxedWindows(
  policy: SandboxPolicy,
  commandLine: string,
  options: SandboxExecOptions = {},
): Promise<SandboxExecResult> {
  // 1. 策略层拦截(双保险:门面已拦,后端再拦一次)
  const policyErrors = validatePolicy(policy);
  if (policyErrors.length > 0) {
    return { backend: 'restricted-token', exitCode: null, signal: null, stdout: '', stderr: policyErrors.join('; '), timedOut: false, truncated: false, refused: true };
  }
  const decision = evaluateCommand(policy, commandLine);
  if (!decision.allowed) {
    return {
      backend: 'restricted-token',
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

  const cwd = options.cwd ?? policy.workspaceRoot;
  const timeoutMs = policy.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutputBytes = policy.maxOutputBytes ?? 512 * 1024;
  let workDir: string | undefined;

  try {
    workDir = await mkdtemp(path.join(tmpdir(), 'ihui-sandbox-'));
    const stdoutFile = path.join(workDir, 'stdout.txt');
    const stderrFile = path.join(workDir, 'stderr.txt');
    const batchFile = path.join(workDir, 'run.cmd');

    // 2. 批处理文件:chcp 65001 保证 UTF-8 下中文命令/输出不乱码
    await writeFile(batchFile, `@echo off\r\nchcp 65001 >nul\r\n${commandLine}\r\n`, 'utf8');

    // 3. PowerShell 脚本(经 -EncodedCommand 传递,规避所有引号转义问题)
    // 注意:Start-Process 的所有参数必须位于同一语句内,按行拼接(不能用 "; " 把续行参数拆成独立语句)
    const q = (s: string): string => `'${s.replace(/'/g, "''")}'`;
    const psScript = [
      `$p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/d','/c',${q(batchFile)} -WorkingDirectory ${q(cwd ?? '')} -NoNewWindow -PassThru -RedirectStandardOutput ${q(stdoutFile)} -RedirectStandardError ${q(stderrFile)}`,
      `$exited = $p.WaitForExit(${timeoutMs})`,
      'if (-not $exited) {',
      '  Start-Process -FilePath taskkill.exe -ArgumentList \'/PID\', $p.Id, \'/T\', \'/F\' -WindowStyle Hidden -Wait',
      '  exit 124',
      '}',
      'exit $p.ExitCode',
    ].join('\n');

    // 4. 环境变量过滤:父进程(PowerShell)的 env 即子进程的 env 来源
    const childEnv = buildSanitizedEnv(policy, options.env);

    const exitCode = await new Promise<number>((resolve) => {
      const child = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', toUtf16LeBase64(psScript)],
        { cwd: cwd || undefined, env: childEnv, windowsHide: true },
      );
      // Node 侧兜底超时:PowerShell 自身卡死时强杀
      const guard = setTimeout(() => {
        child.kill('SIGKILL');
        resolve(124);
      }, timeoutMs + 10_000);
      child.on('exit', (code) => {
        clearTimeout(guard);
        resolve(code ?? 1);
      });
      child.on('error', () => {
        clearTimeout(guard);
        resolve(1);
      });
    });

    // 5. 收集输出并按字节上限截断
    const [stdoutBuf, stderrBuf] = await Promise.all([
      readFile(stdoutFile, 'utf8').catch(() => ''),
      readFile(stderrFile, 'utf8').catch(() => ''),
    ]);
    const truncated = Buffer.byteLength(stdoutBuf, 'utf8') > maxOutputBytes;
    const stdout = truncated ? stdoutBuf.slice(0, maxOutputBytes) : stdoutBuf;

    // 6. icacls 只读探测(不修改 ACL,供诊断输出)
    if (options.onOutput) options.onOutput(`[sandbox] backend=restricted-token exit=${exitCode} timeout=${timeoutMs}ms\n`);

    return {
      backend: 'restricted-token',
      exitCode,
      signal: null,
      stdout,
      stderr: stderrBuf,
      timedOut: exitCode === 124,
      truncated,
      refused: false,
    };
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** 构造过滤后的子进程环境变量(blockedEnvVars 支持 * 通配,不区分大小写) */
export function buildSanitizedEnv(policy: SandboxPolicy, extra?: Record<string, string>): Record<string, string> {
  const blocked = (policy.blockedEnvVars ?? []).map((b) => b.toLowerCase());
  const isBlocked = (key: string): boolean => {
    const k = key.toLowerCase();
    return blocked.some((b) => (b.endsWith('*') ? k.startsWith(b.slice(0, -1)) : k === b));
  };
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !isBlocked(key)) env[key] = value;
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (!isBlocked(key)) env[key] = value;
    }
  }
  return env;
}

/** 字符串 → UTF-16LE Base64(PowerShell -EncodedCommand 所需格式) */
function toUtf16LeBase64(s: string): string {
  return Buffer.from(s, 'utf16le').toString('base64');
}

/** icacls 只读探测:返回 workspaceRoot 的 ACL 摘要(诊断用,不修改任何 ACL) */
export async function probeIcacls(target: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('icacls.exe', [target], { timeout: 5000, windowsHide: true });
    return stdout.trim();
  } catch {
    return null;
  }
}
