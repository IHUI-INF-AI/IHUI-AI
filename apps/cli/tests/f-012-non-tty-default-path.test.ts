// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
/**
 * F-012 回归:无 prompt 的默认路径必须尊重"非交互"档,不许进 REPL。
 *
 * 缺陷:默认命令的 else 分支只看 maybeRunFullScreen,随后无条件 startREPL ⇒
 * readline 挂在 process.stdin 上。`ihui --json`(或 CI 里 stdin 一直开着的 `ihui`)
 * 会把 banner/ANSI 写进管道并永久等待输入,CI 挂死。
 *
 * 修法:无 prompt 且 `--json`/stdout 非 TTY(resolveJsonMode)或 stdin 非 TTY ⇒
 * stderr 打用法、退 2(用法缺失档),不进 REPL。TTY 交互与显式 prompt 不受影响。
 *
 * 这里钉的是行为而非实现:子进程 stdin 是**管道且全程不写、不关**——
 * 修前它永远不会退出,修后应在启动后自行退出。冷启动(tsx 编译整个导入图)
 * 本机实测 2.3~3.7s,与 `--version` 基线同量级,故硬超时给 15s;判据是
 * "stdin 一直开着也会自己退出",而不是把机器速度钉在 2s 上。
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import * as os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CLI_DIR = path.join(__dirname, '..');
const CLI = path.join(CLI_DIR, 'src', 'index.ts');
// 跨平台启动:Windows 下不能直调 .bin/tsx 的 shell 包装,统一用 node 跑 tsx CLI。
const tsxCli = path.join(CLI_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs');

const CHILD_TIMEOUT_MS = 15_000;
const TEST_TIMEOUT_MS = 60_000;

interface RunResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  elapsedMs: number;
}

/** 跑一次真实 CLI:stdin 是管道且不写不关(复现"CI 里 stdin 一直开着")。 */
function runCli(args: string[], home: string): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(process.execPath, [tsxCli, CLI, ...args], {
      cwd: CLI_DIR,
      // 隔离 HOME:否则首次运行引导会往真实 ~/.ihui 落配置(非 TTY 下它会静默生成)。
      env: { ...process.env, HOME: home, USERPROFILE: home },
      // stdin 必须是 pipe,且全程不 end():修前 readline 就卡在这里。
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.setEncoding('utf-8');
    child.stderr?.setEncoding('utf-8');
    child.stdout?.on('data', (chunk: string) => (stdout += chunk));
    child.stderr?.on('data', (chunk: string) => (stderr += chunk));
    const killer = setTimeout(() => child.kill('SIGKILL'), CHILD_TIMEOUT_MS);
    child.on('error', (err) => {
      clearTimeout(killer);
      reject(err);
    });
    // close 而非 exit:等 stdio 全部读完,stderr 文案才不会漏。
    child.on('close', (code, signal) => {
      clearTimeout(killer);
      resolve({ code, signal, stdout, stderr, elapsedMs: Date.now() - startedAt });
    });
  });
}

describe('F-012 无 prompt + 非交互档:打用法退出,不进 REPL', () => {
  let home = '';

  beforeAll(() => {
    home = mkdtempSync(path.join(os.tmpdir(), 'f012-'));
  });

  afterAll(() => {
    rmSync(home, { recursive: true, force: true });
  });

  it('`ihui --json`(管道 stdin)退 2,stderr 含用法,stdout 无 REPL banner/ANSI', async () => {
    const r = await runCli(['--json'], home);

    expect(r.signal).toBeNull(); // 不是被超时 SIGKILL 掉的
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('Usage: ihui');
    expect(r.stderr).toContain('--json');
    // 没进 REPL:品牌 banner 与 readline 提示都不该出现
    expect(r.stdout).not.toContain('█');
    expect(r.stdout).not.toMatch(/\u001b\[/);
    expect(r.elapsedMs).toBeLessThan(CHILD_TIMEOUT_MS);
  }, TEST_TIMEOUT_MS);

  it('裸 `ihui`(管道 stdin,无 prompt)同样退 2 并打用法', async () => {
    const r = await runCli([], home);

    expect(r.signal).toBeNull();
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('Usage: ihui');
    expect(r.stdout).not.toContain('█');
  }, TEST_TIMEOUT_MS);

  it('`--help` 仍是正常用法输出,退 0(守卫不误伤)', async () => {
    const r = await runCli(['--help'], home);

    expect(r.signal).toBeNull();
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('Usage: ihui');
    expect(r.stdout).toContain('--version');
  }, TEST_TIMEOUT_MS);
});
