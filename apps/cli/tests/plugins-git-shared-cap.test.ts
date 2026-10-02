// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-998107:git-shared 封顶 + 脱敏回归 — execGit 复用 execGitCapped 唯一出口,
 * stderr 进结果面前过 sanitizeEvidenceText 既有出口(禁止第二份脱敏)。
 */
import { describe, expect, it, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { execGit, formatGitResult } from '../src/tools/git-shared.js';

const PROBE = 'IHUI-SECRET-PROBE';

function gitInit(repoDir: string): void {
  spawnSync('git', ['init'], { cwd: repoDir, encoding: 'utf-8' });
  spawnSync('git', ['config', 'user.email', 'test@ihui.local'], { cwd: repoDir, encoding: 'utf-8' });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: repoDir, encoding: 'utf-8' });
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: repoDir, encoding: 'utf-8' });
}

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-git-shared-cap-'));
  tmpDirs.push(dir);
  gitInit(dir);
  return dir;
}

describe('git-shared 封顶出口(G-998107)', () => {
  it('正常命令走封顶出口并成功', () => {
    const cwd = makeRepo();
    fs.writeFileSync(path.join(cwd, 'a.txt'), 'a', 'utf-8');
    const r = execGit(['status', '--porcelain'], cwd);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('a.txt');
    const out = formatGitResult(r);
    expect(out.success).toBe(true);
    expect(out.error).toBeUndefined();
  });

  it('挂起的 git 在 timeoutMs 内被终止并点名 timeout(含四诊断词,不含 stderr 原文)', () => {
    const cwd = makeRepo();
    const startedAt = Date.now();
    const r = execGit(['status'], cwd, 1);
    expect(Date.now() - startedAt).toBeLessThan(30_000);
    expect(r.exitCode).toBeNull();
    expect(r.stdout).toBe('');
    expect(r.stderr).toContain('timeout');
    for (const word of ['elapsed', 'killAt', 'forceKill', 'orphaned']) {
      expect(r.stderr).toContain(word);
    }
    expect(r.stderr).not.toContain('fatal:');
    const out = formatGitResult(r);
    expect(out.success).toBe(false);
    const errText = out.error ?? '';
    expect(errText).toContain('timeout');
    for (const word of ['elapsed', 'killAt', 'forceKill', 'orphaned']) {
      expect(errText).toContain(word);
    }
  }, 60_000);

  it('超输出帽报结构化错误且不返回半截内容', () => {
    const cwd = makeRepo();
    const headMarker = 'IHUI-CAP-HEAD-MARKER-998107';
    const tailMarker = 'IHUI-CAP-TAIL-MARKER-998107';
    fs.writeFileSync(
      path.join(cwd, 'big.txt'),
      `${headMarker}\n${'x'.repeat(11 * 1024 * 1024)}\n${tailMarker}\n`,
      'utf-8',
    );
    spawnSync('git', ['add', 'big.txt'], { cwd, encoding: 'utf-8' });
    spawnSync('git', ['commit', '-m', 'big'], { cwd, encoding: 'utf-8' });
    const r = execGit(['show', 'HEAD:big.txt'], cwd);
    expect(r.exitCode).toBeNull();
    expect(r.stdout).toBe('');
    const out = formatGitResult(r);
    expect(out.success).toBe(false);
    const combined = `${out.output}\n${out.error ?? ''}`;
    expect(combined).toMatch(/maxBuffer|ENOBUFS|已作废/);
    expect(combined).not.toContain(headMarker);
    expect(combined).not.toContain(tailMarker);
  }, 120_000);

  it('stderr 含远端 URL 内嵌口令形状时 output 与 error 都不泄漏', () => {
    const cwd = makeRepo();
    fs.writeFileSync(path.join(cwd, 'a.txt'), 'a', 'utf-8');
    spawnSync('git', ['add', 'a.txt'], { cwd, encoding: 'utf-8' });
    spawnSync('git', ['commit', '-m', 'init'], { cwd, encoding: 'utf-8' });
    spawnSync('git', ['remote', 'add', 'origin', `https://u:${PROBE}@127.0.0.1:1/x.git`], {
      cwd,
      encoding: 'utf-8',
    });
    const proxyKeys = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy'];
    const saved = new Map<string, string | undefined>();
    for (const k of proxyKeys) {
      saved.set(k, process.env[k]);
      delete process.env[k];
    }
    try {
      const r = execGit(['push', '-u', 'origin', 'HEAD'], cwd, 30_000);
      expect(r.stderr).not.toContain(PROBE);
      const out = formatGitResult(r);
      expect(out.success).toBe(false);
      expect(out.output).not.toContain(PROBE);
      expect(out.error ?? '').not.toContain(PROBE);
    } finally {
      for (const [k, v] of saved) {
        if (v === undefined) {
          delete process.env[k];
        } else {
          process.env[k] = v;
        }
      }
    }
  }, 120_000);

  it('合成 stderr 含 URL 内嵌口令形状时必被盖住(不依赖 git 文案形态)', () => {
    const raw = `fatal: unable to access 'https://u:${PROBE}@127.0.0.1:1/x.git/': Failed to connect`;
    const out = formatGitResult({ stdout: '', stderr: raw, exitCode: 128 });
    expect(out.success).toBe(false);
    expect(out.output).not.toContain(PROBE);
    expect(out.error ?? '').not.toContain(PROBE);
    expect(out.output).toContain('[REDACTED_SECRET]');
  });

  it('stdout 保持原字节(SHA 等机器标识不改形)', () => {
    const sha = 'a'.repeat(40);
    const out = formatGitResult({ stdout: `commit ${sha}\n`, stderr: '', exitCode: 0 });
    expect(out.success).toBe(true);
    expect(out.output).toContain(sha);
  });

  it('源码形状锁:预算/封顶唯一出口在 git-runner,git-shared 复用、不自立第二份', () => {
    const shared = fs.readFileSync(new URL('../src/tools/git-shared.ts', import.meta.url), 'utf-8');
    const runner = fs.readFileSync(new URL('../src/plugins/git-runner.ts', import.meta.url), 'utf-8');
    // 唯一封顶出口的定义只在 git-runner(b76 wave-2 W4 搬家后的新落点)
    expect(runner).toContain('export function execGitCapped');
    // git-shared 复用唯一出口解析 + 共享层既有脱敏,不自立预算表/第二份脱敏
    expect(shared).toContain('resolveGitSpawnOptions');
    expect(shared).toContain('sanitizeEvidenceText');
    expect(shared).not.toContain("spawnSync('git'");
    expect(shared).not.toContain('spawnSync("git"');
    // 预算字面量不得回流本文件(档位表住在 git-runner)
    expect(shared).not.toContain('30_000');
    expect(shared).not.toContain('90_000');
    expect(shared).not.toContain('120_000');
    expect(shared).not.toContain('1024 * 1024');
    // 全仓唯一性:execGitCapped 的定义恰好 1 处(票面验收判据)
    const cliSrcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
    const definers: string[] = [];
    const walk = (dir: string): void => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (/\.(ts|tsx|mts|mjs|js)$/.test(ent.name)) {
          if (fs.readFileSync(p, 'utf-8').includes('export function execGitCapped')) definers.push(p);
        }
      }
    };
    walk(cliSrcRoot);
    expect(definers).toHaveLength(1);
    expect(definers[0] ?? '').toContain('git-runner.ts');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
