// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * HooksDiscovery 部分失败信封测试(L11495 / G-998082)。
 *
 * 钉三件事:
 *   1. diagnostics 的 code/severity 是封闭联合,形状对齐 PluginDiagnostic;
 *   2. 无异常时 diagnostics **缺席**(不是空数组);
 *   3. totalDiscovered 是量出来的条目总数,含被 diagnostics 记下的那部分。
 * 三态:全成功 / 部分失败(目录级 + 文件级)/ 全失败。
 */

import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// homedir 决定 user hooks 目录;每个用例把它指向各自的临时根,互不串扰
// fs 包一层可控转发:ESM 内建命名空间不可 spyOn,只能整模块 mock
const testState = vi.hoisted(() => ({
  home: '',
  statFailPath: null as string | null,
  readFailPath: null as string | null,
}));
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof os>();
  return { ...actual, homedir: () => testState.home };
});
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return {
    ...actual,
    statSync: (p: unknown, ...rest: unknown[]) => {
      if (testState.statFailPath && String(p) === testState.statFailPath) {
        throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      }
      return (actual.statSync as (...a: unknown[]) => fs.Stats)(p, ...rest);
    },
    readFileSync: (p: unknown, ...rest: unknown[]) => {
      if (testState.readFailPath && String(p) === testState.readFailPath) {
        throw Object.assign(new Error('EIO: i/o error'), { code: 'EIO' });
      }
      return (actual.readFileSync as (...a: unknown[]) => string)(p, ...rest);
    },
  };
});

import { HooksDiscovery, discoverHooksWithDiagnostics } from '../src/hooks/discovery.js';
import type { HookDiscoveryDiagnostic } from '../src/hooks/discovery.js';

let tmpRoot: string;
beforeAll(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-discovery-test-'));
});

afterEach(() => {
  testState.statFailPath = null;
  testState.readFailPath = null;
});

/** 建一个独立 home 根 + 工作区;user hooks 目录 = <home>/.ihui-agent/hooks */
function makeWorkspace(name: string): { ws: string; cliDir: string; userDir: string } {
  const home = fs.mkdtempSync(path.join(tmpRoot, name + '-')); // 每用例独立根,防目录态互相污染
  const ws = path.join(home, 'ws');
  const cliDir = path.join(ws, '.ihui-agent', 'hooks');
  fs.mkdirSync(cliDir, { recursive: true });
  testState.home = home;
  const userDir = path.join(home, '.ihui-agent', 'hooks');
  return { ws, cliDir, userDir };
}

function writeHook(dir: string, file: string, frontmatter?: string): string {
  const p = path.join(dir, file);
  const body = frontmatter ? `${frontmatter}\nconsole.log('hook');\n` : `console.log('hook');\n`;
  fs.writeFileSync(p, body, 'utf-8');
  return p;
}

const FM_ALPHA = '---\nname: Alpha\npriority: 80\n---';

describe('discoverWithDiagnostics 部分失败信封', () => {
  it('全成功:diagnostics 缺席,totalDiscovered == hooks.length', () => {
    const { ws, cliDir } = makeWorkspace('all-success');
    writeHook(cliDir, 'alpha.ts', FM_ALPHA);
    writeHook(cliDir, 'beta.js');
    // user hooks 目录不存在 = 常态(ENOENT),不算异常

    const result = new HooksDiscovery(ws).discoverWithDiagnostics();

    expect(result.hooks).toHaveLength(2);
    expect(result.totalDiscovered).toBe(2);
    expect('diagnostics' in result).toBe(false); // 无异常时缺席,不是空数组
    // 向后兼容:discover() 旧契约仍是裸数组
    expect(new HooksDiscovery(ws).discover().map((h) => h.name)).toContain('Alpha');
  });

  it('部分失败(目录级):user 目录不可读 → 一条 error 诊断,cli hooks 照常返回', () => {
    const { ws, cliDir, userDir } = makeWorkspace('dir-fail');
    writeHook(cliDir, 'good.ts', FM_ALPHA);
    // user hooks 路径被一个普通文件占位 → readdirSync 抛 ENOTDIR
    fs.mkdirSync(path.dirname(userDir), { recursive: true });
    fs.writeFileSync(userDir, 'not a dir', 'utf-8');

    const result = new HooksDiscovery(ws).discoverWithDiagnostics();

    expect(result.hooks).toHaveLength(1);
    expect(result.hooks[0]!.name).toBe('Alpha');
    expect(result.totalDiscovered).toBe(1);
    expect(result.diagnostics).toHaveLength(1);
    const d = result.diagnostics![0] as HookDiscoveryDiagnostic;
    expect(d.code).toBe('hooks-dir-unreadable');
    expect(d.severity).toBe('error');
    expect(d.file).toBe(userDir);
    expect(d.message).toMatch(/Hooks directory unreadable/);
  });

  it('部分失败(文件级):stat 失败的条目记诊断,且计入 totalDiscovered(hooks < totalDiscovered)', () => {
    const { ws, cliDir } = makeWorkspace('stat-fail');
    writeHook(cliDir, 'good.ts', FM_ALPHA);
    const brokenPath = writeHook(cliDir, 'broken.ts');
    testState.statFailPath = brokenPath;

    const result = new HooksDiscovery(ws).discoverWithDiagnostics();

    expect(result.hooks).toHaveLength(1);
    expect(result.totalDiscovered).toBe(2); // 量出来的:成功的 1 + 被诊断掉的 1
    expect(result.diagnostics).toHaveLength(1);
    const d = result.diagnostics![0] as HookDiscoveryDiagnostic;
    expect(d.code).toBe('hook-file-stat-failed');
    expect(d.severity).toBe('error');
    expect(d.file).toBe(brokenPath);
  });

  it('全失败:两目录都不可读 → hooks 空、totalDiscovered 0、两条诊断', () => {
    const { ws, cliDir, userDir } = makeWorkspace('all-fail');
    fs.rmSync(cliDir, { recursive: true }); // makeWorkspace 已建目录;换成同名普通文件使 readdir 抛 ENOTDIR
    fs.writeFileSync(cliDir, 'not a dir', 'utf-8');
    fs.mkdirSync(path.dirname(userDir), { recursive: true });
    fs.writeFileSync(userDir, 'not a dir', 'utf-8');

    const result = new HooksDiscovery(ws).discoverWithDiagnostics();

    expect(result.hooks).toHaveLength(0);
    expect(result.totalDiscovered).toBe(0);
    expect(result.diagnostics).toHaveLength(2);
    expect(result.diagnostics!.every((d) => d.code === 'hooks-dir-unreadable')).toBe(true);
    expect(result.diagnostics!.every((d) => d.severity === 'error')).toBe(true);
  });

  it('降级装载:frontmatter 读不出 → warning 诊断,hook 仍按默认值装载', () => {
    const { ws, cliDir } = makeWorkspace('fm-fail');
    writeHook(cliDir, 'good.ts', FM_ALPHA);
    const brokenPath = writeHook(cliDir, 'broken.ts');
    testState.readFailPath = brokenPath;

    const result = new HooksDiscovery(ws).discoverWithDiagnostics();

    expect(result.hooks).toHaveLength(2);
    expect(result.totalDiscovered).toBe(2);
    const broken = result.hooks.find((h) => h.filePath === brokenPath);
    expect(broken).toBeDefined();
    expect(broken!.name).toBe('broken'); // 降级为文件名 stem
    expect(broken!.enabled).toBe(true);
    expect(result.diagnostics).toHaveLength(1);
    const d = result.diagnostics![0] as HookDiscoveryDiagnostic;
    expect(d.code).toBe('hook-frontmatter-unreadable');
    expect(d.severity).toBe('warning');
  });

  it('free function discoverHooksWithDiagnostics 返回同一信封形状', () => {
    const { ws, cliDir } = makeWorkspace('free-fn');
    writeHook(cliDir, 'alpha.ts', FM_ALPHA);
    testState.home = path.join(tmpRoot, 'free-fn-no-such-home'); // user dir: ENOENT = 常态

    const result = discoverHooksWithDiagnostics();
    // free function 基于默认实例(process.cwd()),这里只钉形状,不钉数量
    expect(typeof result.totalDiscovered).toBe('number');
    expect(Array.isArray(result.hooks)).toBe(true);
    expect(result.hooks.every((h) => typeof h.filePath === 'string')).toBe(true);
    expect(ws).toBeDefined();
    expect(cliDir).toBeDefined();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
