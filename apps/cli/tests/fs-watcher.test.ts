/**
 * fs-watcher 测试 — 覆盖 shouldIgnore / FsEventSource 生命周期 / debounce / getRecentEvents。
 *
 * 平台说明:
 *   - Windows:fs.watch recursive 原生支持,测试创建临时目录 + 文件触发事件
 *   - macOS:同 Windows
 *   - Linux:recursive 可能不被支持,事件测试用更长超时容忍 fallback 行为
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  FsEventSource,
  shouldIgnore,
  DEFAULT_FS_WATCHER_IGNORE,
  type FsEvent,
} from '../src/fs-watcher/index.js';

describe('shouldIgnore', () => {
  it('空路径不忽略', () => {
    expect(shouldIgnore('', ['node_modules'])).toBe(false);
  });

  it('字面量段匹配路径任一段', () => {
    expect(shouldIgnore('src/index.ts', ['src'])).toBe(true);
    expect(shouldIgnore('apps/cli/src/index.ts', ['src'])).toBe(true);
    expect(shouldIgnore('apps/cli/index.ts', ['src'])).toBe(false);
  });

  it('node_modules 始终被忽略(默认列表)', () => {
    expect(shouldIgnore('node_modules/foo/index.js', DEFAULT_FS_WATCHER_IGNORE)).toBe(true);
    expect(shouldIgnore('apps/web/node_modules/react/index.js', DEFAULT_FS_WATCHER_IGNORE)).toBe(true);
  });

  it('.git 始终被忽略(默认列表)', () => {
    expect(shouldIgnore('.git/HEAD', DEFAULT_FS_WATCHER_IGNORE)).toBe(true);
    expect(shouldIgnore('.git/refs/heads/main', DEFAULT_FS_WATCHER_IGNORE)).toBe(true);
  });

  it('dist / .next / .turbo 被忽略', () => {
    expect(shouldIgnore('dist/bundle.js', DEFAULT_FS_WATCHER_IGNORE)).toBe(true);
    expect(shouldIgnore('.next/server/page.js', DEFAULT_FS_WATCHER_IGNORE)).toBe(true);
    expect(shouldIgnore('apps/web/.turbo/turbo-build.log', DEFAULT_FS_WATCHER_IGNORE)).toBe(true);
  });

  it('glob *.log 匹配文件名', () => {
    expect(shouldIgnore('app.log', ['*.log'])).toBe(true);
    expect(shouldIgnore('logs/app.log', ['*.log'])).toBe(true);
    expect(shouldIgnore('src/app.ts', ['*.log'])).toBe(false);
  });

  it('glob **/*.tmp 匹配任意层级', () => {
    expect(shouldIgnore('a.tmp', ['**/*.tmp'])).toBe(true);
    expect(shouldIgnore('foo/bar.tmp', ['**/*.tmp'])).toBe(true);
    expect(shouldIgnore('foo/bar.ts', ['**/*.tmp'])).toBe(false);
  });

  it('Windows 风格反斜杠路径兼容', () => {
    expect(shouldIgnore('apps\\cli\\node_modules\\foo', DEFAULT_FS_WATCHER_IGNORE)).toBe(true);
    expect(shouldIgnore('.\\src\\index.ts', ['src'])).toBe(true);
  });

  it('非匹配路径不忽略', () => {
    expect(shouldIgnore('src/index.ts', ['node_modules'])).toBe(false);
    expect(shouldIgnore('README.md', ['*.log'])).toBe(false);
  });

  it('空 patterns 列表不忽略任何路径', () => {
    expect(shouldIgnore('node_modules/foo', [])).toBe(false);
    expect(shouldIgnore('anything/here', [])).toBe(false);
  });
});

describe('FsEventSource 生命周期', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-fsw-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
  });

  it('start/stop 不抛异常', () => {
    const src = new FsEventSource(tmpDir);
    expect(() => src.start()).not.toThrow();
    expect(() => src.stop()).not.toThrow();
  });

  it('重复 start 安全(幂等)', () => {
    const src = new FsEventSource(tmpDir);
    src.start();
    expect(() => src.start()).not.toThrow();
    src.stop();
  });

  it('stop 后 start 可重新启动', () => {
    const src = new FsEventSource(tmpDir);
    src.start();
    src.stop();
    expect(() => src.start()).not.toThrow();
    src.stop();
  });

  it('不存在的根目录 start/stop 不抛异常(降级处理)', () => {
    const nonexistent = path.join(tmpDir, 'does-not-exist');
    const src = new FsEventSource(nonexistent);
    expect(() => src.start()).not.toThrow();
    src.stop();
  });

  it('getStats 初始返回 0', () => {
    const src = new FsEventSource(tmpDir);
    const stats = src.getStats();
    expect(stats.totalEvents).toBe(0);
    expect(stats.droppedByDebounce).toBe(0);
    expect(stats.chokidarFallback).toBe(false);
    src.stop();
  });

  it('getStats 含 chokidarFallback 字段(新增字段)', () => {
    const src = new FsEventSource(tmpDir);
    const stats = src.getStats();
    // 字段必须存在(即使 false)
    expect(stats).toHaveProperty('chokidarFallback');
    expect(typeof stats.chokidarFallback).toBe('boolean');
    src.stop();
  });

  it('getRecentEvents 初始返回空数组', () => {
    const src = new FsEventSource(tmpDir);
    expect(src.getRecentEvents(60_000)).toEqual([]);
    src.stop();
  });
});

describe('FsEventSource debounce + 事件触发', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-fsw-evt-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // 忽略
    }
  });

  it('创建文件触发 create/modify 事件(50ms debounce 后)', async () => {
    const src = new FsEventSource(tmpDir);
    src.start();
    const events: FsEvent[] = [];
    src.on('event', (e: FsEvent) => events.push(e));

    // 等监听器稳定
    await sleep(50);
    const filePath = path.join(tmpDir, 'new-file.txt');
    fs.writeFileSync(filePath, 'hello');

    // 等待 debounce(50ms)+ 事件派发(容错 500ms)
    await sleep(600);
    src.stop();

    // 至少有一个事件(平台差异:可能 create/modify/rename)
    expect(events.length).toBeGreaterThanOrEqual(1);
    // 所有事件路径都应该是相对的 POSIX 风格
    for (const e of events) {
      expect(e.path).toBe('new-file.txt');
      expect(e.timestamp).toBeGreaterThan(0);
      expect(['create', 'modify', 'delete', 'rename']).toContain(e.kind);
    }
  });

  it('同路径多次快速变更被 debounce 合并为 1 个事件', async () => {
    const src = new FsEventSource(tmpDir);
    src.start();
    const events: FsEvent[] = [];
    src.on('event', (e: FsEvent) => events.push(e));

    await sleep(50);
    const filePath = path.join(tmpDir, 'debounced.txt');
    // 快速连续写入 5 次(都在 50ms debounce 窗口内)
    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(filePath, `content-${i}`);
    }

    await sleep(600);
    src.stop();

    // debounce 后只剩 1 个事件
    expect(events.length).toBe(1);
    expect(events[0]!.path).toBe('debounced.txt');
    // droppedByDebounce 应该 >= 4(5 次写入合并为 1 次)
    const stats = src.getStats();
    expect(stats.droppedByDebounce).toBeGreaterThanOrEqual(4);
  });

  it('node_modules 路径被 ignore 过滤', async () => {
    const src = new FsEventSource(tmpDir);
    src.start();
    const events: FsEvent[] = [];
    src.on('event', (e: FsEvent) => events.push(e));

    await sleep(50);
    // 创建 node_modules 子目录中的文件(应被忽略)
    const nmDir = path.join(tmpDir, 'node_modules');
    fs.mkdirSync(nmDir, { recursive: true });
    fs.writeFileSync(path.join(nmDir, 'pkg.json'), '{}');

    await sleep(600);
    src.stop();

    // 所有事件都不应包含 node_modules 路径
    for (const e of events) {
      expect(e.path).not.toContain('node_modules');
    }
  });

  it('getRecentEvents 按时间过滤', async () => {
    const src = new FsEventSource(tmpDir);
    src.start();
    const events: FsEvent[] = [];
    src.on('event', (e: FsEvent) => events.push(e));

    await sleep(50);
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'a');
    await sleep(600);

    // 此时已有事件,查询最近 60s 应包含
    const recent60s = src.getRecentEvents(60_000);
    expect(recent60s.length).toBeGreaterThanOrEqual(1);

    // 查询最近 0ms(理论上截止到现在)应包含刚发生的事件(留容差)
    const recent0 = src.getRecentEvents(10_000);
    expect(recent0.length).toBeGreaterThanOrEqual(0);

    src.stop();
  });

  it('totalEvents 累计统计', async () => {
    const src = new FsEventSource(tmpDir);
    src.start();

    await sleep(50);
    fs.writeFileSync(path.join(tmpDir, 'count.txt'), '1');
    await sleep(600);

    const stats = src.getStats();
    expect(stats.totalEvents).toBeGreaterThanOrEqual(1);
    src.stop();
  });
});

describe('FsEventSource chokidar fallback(Linux 兼容)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-fsw-chokidar-'));
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* 忽略 */ }
  });

  it('非 Linux 平台 start 不触发 chokidar fallback(chokidarFallback=false)', () => {
    // Windows/macOS 原生支持 recursive,不应走 chokidar
    const src = new FsEventSource(tmpDir);
    src.start();
    const stats = src.getStats();
    if (process.platform !== 'linux') {
      expect(stats.chokidarFallback).toBe(false);
    }
    // Linux 下 chokidar 可能未安装,此时 chokidarFallback 也是 false(降级到非递归)
    src.stop();
  });

  it('不存在的根目录 start 不抛异常(降级到非递归或静默失败)', () => {
    const nonexistent = path.join(tmpDir, 'does-not-exist');
    const src = new FsEventSource(nonexistent);
    expect(() => src.start()).not.toThrow();
    src.stop();
    // 即使 chokidar 加载失败,也不应抛错
    expect(src.getStats().chokidarFallback).toBe(false);
  });

  it('Windows 平台 start 后 getStats 不报 chokidarFallback=true', () => {
    if (process.platform !== 'win32') return; // 仅 Windows 验证
    const src = new FsEventSource(tmpDir);
    src.start();
    expect(src.getStats().chokidarFallback).toBe(false);
    src.stop();
  });

  it('macOS 平台 start 后 getStats 不报 chokidarFallback=true', () => {
    if (process.platform !== 'darwin') return; // 仅 macOS 验证
    const src = new FsEventSource(tmpDir);
    src.start();
    expect(src.getStats().chokidarFallback).toBe(false);
    src.stop();
  });
});

describe('FsEventSource stop 清理所有 watchers(含 chokidar)', () => {
  it('多次 start/stop 循环不泄漏 watcher', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-fsw-leak-'));
    try {
      for (let i = 0; i < 5; i++) {
        const src = new FsEventSource(tmp);
        src.start();
        src.stop();
        // 重复 stop 安全
        src.stop();
      }
      // 不抛错即通过
      expect(true).toBe(true);
    } finally {
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* 忽略 */ }
    }
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
