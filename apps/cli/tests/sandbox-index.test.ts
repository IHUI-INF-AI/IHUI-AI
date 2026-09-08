// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  appendSandboxAuditLog,
  isPathAllowedWithRealpath,
  runSandboxed,
  runSandboxedAsync,
} from '../src/sandbox/index.js';

const CWD = path.resolve(os.tmpdir(), 'sandbox-test-cwd');

beforeAll(() => {
  fs.mkdirSync(path.join(CWD, 'src'), { recursive: true });
  fs.writeFileSync(path.join(CWD, 'src', 'a.txt'), 'ok');
});

afterAll(() => {
  fs.rmSync(CWD, { recursive: true, force: true });
});

describe('isPathAllowedWithRealpath(symlink 逃逸防护)', () => {
  const identity = (p: string) => p;

  it('cwd 内路径放行', () => {
    expect(isPathAllowedWithRealpath('src/a.txt', CWD, [], identity)).toBe(true);
  });

  it('白名单外路径拒绝', () => {
    const outside = path.resolve(os.tmpdir(), 'sandbox-outside');
    expect(isPathAllowedWithRealpath(outside, CWD, [], identity)).toBe(false);
  });

  it('symlink 形式路径在白名单内、真实路径逃逸 → 拒绝(核心防护)', () => {
    // 形式路径 src/link/secret 在 cwd 内;真实路径指向外部 → 必须拒绝
    const fakeRealpath = (p: string) =>
      p.includes('link') ? path.resolve(os.tmpdir(), 'outside-secret') : p;
    expect(isPathAllowedWithRealpath('src/link/secret', CWD, [], fakeRealpath)).toBe(false);
  });

  it('真实路径解析失败(不存在)按形式路径放行', () => {
    const throwingRealpath = (p: string) => {
      if (p.includes('not-yet-exist')) throw new Error('ENOENT');
      return p;
    };
    expect(
      isPathAllowedWithRealpath('src/not-yet-exist.txt', CWD, [], throwingRealpath),
    ).toBe(true);
  });

  it('白名单内路径的真实路径仍需落白名单', () => {
    // allowedPaths 显式含 /data,但真实路径解析到 /etc → 拒绝
    // 分隔符无关替换(Windows path.resolve 产生反斜杠,必须同样命中)
    const fakeRealpath = (p: string) => p.replace('data', 'etc');
    expect(
      isPathAllowedWithRealpath('/data/x', CWD, ['/data'], fakeRealpath),
    ).toBe(false);
  });

  it('真实 symlink 端到端(本机可建 symlink 时)', () => {
    const outside = path.resolve(os.tmpdir(), 'sandbox-outside-real');
    const link = path.join(CWD, 'src', 'link');
    try {
      fs.mkdirSync(outside, { recursive: true });
      fs.writeFileSync(path.join(outside, 'secret.txt'), 'secret');
      try {
        fs.symlinkSync(outside, link, 'dir');
      } catch {
        // Windows 非 admin/无开发者模式时 symlink 创建失败 → 跳过(注入测试已覆盖逻辑)
        return;
      }
      expect(isPathAllowedWithRealpath('src/link/secret.txt', CWD, [], fs.realpathSync)).toBe(false);
      expect(isPathAllowedWithRealpath('src/a.txt', CWD, [], fs.realpathSync)).toBe(true);
    } finally {
      try { fs.rmSync(link, { force: true }); } catch { /* ignore */ }
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });
});

describe('runSandboxedAsync(超时树杀)', () => {
  it('超时触发且 Promise 以 timedOut 结束', async () => {
    const handle = runSandboxedAsync('node -e "setTimeout(()=>{},30000)"', {
      cwd: CWD,
      timeoutMs: 800,
    });
    const result = await handle.result;
    expect(result.timedOut).toBe(true);
    expect(result.blocked).toBe(false);
  }, 15_000);

  it('命令白名单拦截(异步路径)', async () => {
    const handle = runSandboxedAsync('curl http://example.com', {
      cwd: CWD,
      commandAllowlist: ['node', 'git'],
    });
    const result = await handle.result;
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toContain('command_not_allowed');
  }, 10_000);
});

describe('appendSandboxAuditLog(jsonl 审计)', () => {
  it('未设置 env 时静默跳过不抛错', () => {
    const prev = process.env.IHUI_SANDBOX_AUDIT_LOG;
    delete process.env.IHUI_SANDBOX_AUDIT_LOG;
    expect(() =>
      appendSandboxAuditLog({
        timestamp: new Date().toISOString(),
        command: 'x',
        cwd: CWD,
        exitCode: 0,
        timedOut: false,
        truncated: false,
        blocked: false,
        durationMs: 1,
      }),
    ).not.toThrow();
    if (prev !== undefined) process.env.IHUI_SANDBOX_AUDIT_LOG = prev;
  });

  it('同步执行写入 jsonl(含执行与拦截两类记录)', async () => {
    const logFile = path.join(os.tmpdir(), `sandbox-audit-${Date.now()}.jsonl`);
    process.env.IHUI_SANDBOX_AUDIT_LOG = logFile;
    try {
      runSandboxed('echo audit-test-ok', { cwd: CWD, commandAllowlist: ['echo'] });
      runSandboxed('curl http://example.com', { cwd: CWD, commandAllowlist: ['echo'] });
      // 等待可能的异步审计落盘
      await new Promise((r) => setTimeout(r, 300));
      const lines = fs.readFileSync(logFile, 'utf-8').trim().split('\n');
      expect(lines.length).toBe(2);
      const records = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
      expect(records[0]!.blocked).toBe(false);
      expect(String(records[0]!.command)).toContain('audit-test-ok');
      expect(records[1]!.blocked).toBe(true);
      expect(String(records[1]!.blockReason)).toContain('command_not_allowed');
      expect(typeof records[0]!.durationMs).toBe('number');
    } finally {
      delete process.env.IHUI_SANDBOX_AUDIT_LOG;
      fs.rmSync(logFile, { force: true });
    }
  }, 15_000);
});

// 防止未使用导入告警(vi 在某些配置下未直接使用)
void vi;
