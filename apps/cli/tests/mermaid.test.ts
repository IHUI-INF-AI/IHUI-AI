import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { EventEmitter } from 'node:events';
import {
  MmdcCliEngine,
  MermaidApiEngine,
  renderMermaid,
  extractMermaidBlocks,
  writeMermaidToWorkspace,
  getDefaultCache,
  MermaidRenderCache,
  type MermaidEngine,
} from '../src/mermaid/index.js';

// mock spawn(避免真实调用 mmdc)
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

import { spawn } from 'node:child_process';

// mock 的 ChildProcess 类型(简化)
interface MockChildProcess extends EventEmitter {
  stderr: EventEmitter;
  stdout: EventEmitter;
  stdin: { write: () => void; end: () => void };
  kill: (signal?: string) => void;
  pid: number;
}

function createMockProc(): MockChildProcess {
  const proc = new EventEmitter() as MockChildProcess;
  proc.stderr = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stdin = { write: () => true, end: () => undefined };
  proc.kill = vi.fn();
  proc.pid = 12345;
  return proc;
}

describe('mermaid 渲染模块', () => {
  let tmpDir: string;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-mermaid-test-'));
    originalFetch = global.fetch;
    vi.clearAllMocks();
    // 清空全局缓存(防止测试间互相污染)
    getDefaultCache().clear();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('MmdcCliEngine', () => {
    it('成功调用 mmdc 并读取 output.png 返回 Buffer', async () => {
      const engine = new MmdcCliEngine(30_000);
      const proc = createMockProc();
      vi.mocked(spawn).mockReturnValue(proc as never);

      // 拦截 spawn 调用,异步模拟 mmdc 写入输出文件
      const renderPromise = engine.render('graph TD\n  A --> B');
      // 等待 fs.writeFile 完成后,模拟 mmdc 写入输出 + 退出 0
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          // 检查 .mmd 输入文件是否已写入(说明 fs.writeFile 完成)
          const calls = vi.mocked(spawn).mock.calls;
          if (calls.length > 0) {
            const args = calls[0]?.[1] as string[];
            const inputPath = args[args.indexOf('-i') + 1];
            const outputPath = args[args.indexOf('-o') + 1];
            if (fs.existsSync(inputPath)) {
              clearInterval(checkInterval);
              // 模拟 mmdc 写入输出文件
              fs.writeFileSync(outputPath, Buffer.from('fake-png-data'));
              proc.emit('close', 0);
              resolve();
            }
          }
        }, 5);
      });

      const buffer = await renderPromise;
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.toString()).toBe('fake-png-data');
      // 验证 spawn 调用参数
      expect(spawn).toHaveBeenCalledWith('mmdc', expect.arrayContaining(['-t', 'dark', '-b', 'transparent']), expect.anything());
    });

    it('mmdc 退出码非零时 reject', async () => {
      const engine = new MmdcCliEngine(30_000);
      const proc = createMockProc();
      vi.mocked(spawn).mockReturnValue(proc as never);

      const renderPromise = engine.render('invalid');
      // 触发 close 事件 with exit code 1
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          const calls = vi.mocked(spawn).mock.calls;
          if (calls.length > 0) {
            const args = calls[0]?.[1] as string[];
            const inputPath = args[args.indexOf('-i') + 1];
            if (fs.existsSync(inputPath)) {
              clearInterval(checkInterval);
              proc.stderr.emit('data', Buffer.from('render error'));
              proc.emit('close', 1);
              resolve();
            }
          }
        }, 5);
      });

      await expect(renderPromise).rejects.toThrow(/mmdc 渲染失败/);
    });

    it('mmdc spawn error 事件触发 reject', async () => {
      const engine = new MmdcCliEngine(30_000);
      const proc = createMockProc();
      vi.mocked(spawn).mockReturnValue(proc as never);

      const renderPromise = engine.render('graph TD\n  A --> B');
      // 立即触发 error 事件
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          const calls = vi.mocked(spawn).mock.calls;
          if (calls.length > 0) {
            clearInterval(checkInterval);
            proc.emit('error', new Error('ENOENT'));
            resolve();
          }
        }, 5);
      });

      await expect(renderPromise).rejects.toThrow(/mmdc 启动失败/);
    });

    it('mmdc 超时触发 SIGTERM 并 reject', async () => {
      // 使用很短的超时(50ms)以快速触发
      const engine = new MmdcCliEngine(50);
      const proc = createMockProc();
      vi.mocked(spawn).mockReturnValue(proc as never);

      // 不主动触发 close,等待超时
      const renderPromise = engine.render('graph TD\n  A --> B');
      // 等待 fs.writeFile 完成,但 mmdc 不退出
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          const calls = vi.mocked(spawn).mock.calls;
          if (calls.length > 0) {
            const args = calls[0]?.[1] as string[];
            const inputPath = args[args.indexOf('-i') + 1];
            if (fs.existsSync(inputPath)) {
              clearInterval(checkInterval);
              resolve();
            }
          }
        }, 5);
      });

      await expect(renderPromise).rejects.toThrow(/mmdc 渲染超时/);
      expect(proc.kill).toHaveBeenCalled();
    });
  });

  describe('MermaidApiEngine', () => {
    it('成功调用 mermaid.ink 并返回 SVG Buffer', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => new TextEncoder().encode('<svg>...</svg>').buffer,
      });
      const engine = new MermaidApiEngine(mockFetch as unknown as typeof fetch);
      const buffer = await engine.render('graph TD\n  A --> B');
      expect(buffer.length).toBeGreaterThan(0);
      // 验证 fetch 调用包含 base64 编码的源码
      const callUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(callUrl).toMatch(/^https:\/\/mermaid\.ink\/svg\//);
      // base64 部分应解码为源码
      const base64Part = callUrl.replace('https://mermaid.ink/svg/', '');
      const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');
      expect(decoded).toBe('graph TD\n  A --> B');
    });

    it('API 返回非 ok 时抛错', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      const engine = new MermaidApiEngine(mockFetch as unknown as typeof fetch);
      await expect(engine.render('invalid')).rejects.toThrow(/mermaid\.ink 返回 500/);
    });

    it('网络错误抛 mermaid.ink 请求失败', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('network down'));
      const engine = new MermaidApiEngine(mockFetch as unknown as typeof fetch);
      await expect(engine.render('graph TD')).rejects.toThrow(/mermaid\.ink 请求失败/);
    });

    it('自定义 apiUrl 透传到 fetch URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => new TextEncoder().encode('<svg/>').buffer,
      });
      const engine = new MermaidApiEngine(mockFetch as unknown as typeof fetch, 'https://custom.mermaid.local');
      await engine.render('graph TD');
      const callUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(callUrl).toMatch(/^https:\/\/custom\.mermaid\.local\/svg\//);
    });
  });

  describe('renderMermaid (fallback 链)', () => {
    it('第一个引擎成功时直接返回', async () => {
      const engine1: MermaidEngine = {
        name: 'engine-1',
        render: vi.fn().mockResolvedValue(Buffer.from('result-1')),
      };
      const engine2: MermaidEngine = {
        name: 'engine-2',
        render: vi.fn().mockResolvedValue(Buffer.from('result-2')),
      };
      const result = await renderMermaid('graph TD', [engine1, engine2]);
      expect(result.engine).toBe('engine-1');
      expect(result.buffer.toString()).toBe('result-1');
      expect(engine2.render).not.toHaveBeenCalled();
    });

    it('第一个引擎失败时 fallback 到第二个', async () => {
      const engine1: MermaidEngine = {
        name: 'engine-1',
        render: vi.fn().mockRejectedValue(new Error('engine-1 error')),
      };
      const engine2: MermaidEngine = {
        name: 'engine-2',
        render: vi.fn().mockResolvedValue(Buffer.from('result-2')),
      };
      const result = await renderMermaid('graph TD', [engine1, engine2]);
      expect(result.engine).toBe('engine-2');
      expect(result.buffer.toString()).toBe('result-2');
      expect(engine1.render).toHaveBeenCalled();
      expect(engine2.render).toHaveBeenCalled();
    });

    it('所有引擎失败时抛错(包含所有引擎的错误)', async () => {
      const engine1: MermaidEngine = {
        name: 'engine-1',
        render: vi.fn().mockRejectedValue(new Error('err-1')),
      };
      const engine2: MermaidEngine = {
        name: 'engine-2',
        render: vi.fn().mockRejectedValue(new Error('err-2')),
      };
      await expect(renderMermaid('graph TD', [engine1, engine2]))
        .rejects.toThrow(/所有 mermaid 引擎渲染失败/);
      try {
        await renderMermaid('graph TD', [engine1, engine2]);
      } catch (err) {
        const msg = (err as Error).message;
        expect(msg).toContain('[engine-1] err-1');
        expect(msg).toContain('[engine-2] err-2');
      }
    });

    it('MIME 类型按引擎名称推断(mermaid-ink → svg,mmdc-cli → png)', async () => {
      const inkEngine: MermaidEngine = {
        name: 'mermaid-ink',
        render: vi.fn().mockResolvedValue(Buffer.from('<svg/>')),
      };
      const result = await renderMermaid('graph TD-ink', [inkEngine]);
      expect(result.mimeType).toBe('image/svg+xml');

      const mmdcEngine: MermaidEngine = {
        name: 'mmdc-cli',
        render: vi.fn().mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
      };
      const result2 = await renderMermaid('graph TD-mmdc', [mmdcEngine]);
      expect(result2.mimeType).toBe('image/png');
    });
  });

  describe('MermaidRenderCache(LRU 渲染缓存)', () => {
    it('首次渲染未命中缓存(cached=false),二次命中(cached=true)', async () => {
      const engine: MermaidEngine = {
        name: 'test-engine',
        render: vi.fn().mockResolvedValue(Buffer.from('result-1')),
      };
      const result1 = await renderMermaid('cache-test-source', [engine]);
      expect(result1.cached).toBe(false);
      expect(engine.render).toHaveBeenCalledTimes(1);

      const result2 = await renderMermaid('cache-test-source', [engine]);
      expect(result2.cached).toBe(true);
      // 命中缓存后,引擎不应再次被调用
      expect(engine.render).toHaveBeenCalledTimes(1);
      expect(result2.buffer.toString()).toBe('result-1');
    });

    it('不同 source 不命中缓存(分别渲染)', async () => {
      const engine: MermaidEngine = {
        name: 'test-engine',
        render: vi.fn()
          .mockResolvedValueOnce(Buffer.from('r1'))
          .mockResolvedValueOnce(Buffer.from('r2')),
      };
      const r1 = await renderMermaid('source-A', [engine]);
      const r2 = await renderMermaid('source-B', [engine]);
      expect(r1.cached).toBe(false);
      expect(r2.cached).toBe(false);
      expect(r1.buffer.toString()).toBe('r1');
      expect(r2.buffer.toString()).toBe('r2');
    });

    it('传 cache=null 禁用缓存(每次都调引擎)', async () => {
      const engine: MermaidEngine = {
        name: 'test-engine',
        render: vi.fn().mockResolvedValue(Buffer.from('r')),
      };
      await renderMermaid('no-cache-source', [engine], null);
      await renderMermaid('no-cache-source', [engine], null);
      expect(engine.render).toHaveBeenCalledTimes(2);
    });

    it('LRU 淘汰:超 maxSize 时移除最早条目', () => {
      const cache = new MermaidRenderCache(2, 60_000);
      cache.set('s1', Buffer.from('1'), 'image/png', 'e');
      cache.set('s2', Buffer.from('2'), 'image/png', 'e');
      expect(cache.size()).toBe(2);
      // 第 3 个触发淘汰:s1 被移除(LRU)
      cache.set('s3', Buffer.from('3'), 'image/png', 'e');
      expect(cache.size()).toBe(2);
      expect(cache.get('s1')).toBeNull();
      expect(cache.get('s2')).not.toBeNull();
      expect(cache.get('s3')).not.toBeNull();
    });

    it('LRU 更新:get 后该条目变为最新(不被淘汰)', () => {
      const cache = new MermaidRenderCache(2, 60_000);
      cache.set('s1', Buffer.from('1'), 'image/png', 'e');
      cache.set('s2', Buffer.from('2'), 'image/png', 'e');
      // 访问 s1 → s1 变最新,s2 变最老
      cache.get('s1');
      // 新增 s3 → s2(最老)被淘汰
      cache.set('s3', Buffer.from('3'), 'image/png', 'e');
      expect(cache.get('s1')).not.toBeNull();
      expect(cache.get('s2')).toBeNull();
      expect(cache.get('s3')).not.toBeNull();
    });

    it('TTL 过期:超过 ttlMs 后 get 返回 null', async () => {
      const cache = new MermaidRenderCache(10, 50); // 50ms TTL
      cache.set('s1', Buffer.from('1'), 'image/png', 'e');
      expect(cache.get('s1')).not.toBeNull();
      await new Promise((r) => setTimeout(r, 60));
      expect(cache.get('s1')).toBeNull();
    });

    it('clear 清空所有条目', () => {
      const cache = new MermaidRenderCache();
      cache.set('s1', Buffer.from('1'), 'image/png', 'e');
      cache.set('s2', Buffer.from('2'), 'image/png', 'e');
      expect(cache.size()).toBe(2);
      cache.clear();
      expect(cache.size()).toBe(0);
    });
  });

  describe('extractMermaidBlocks', () => {
    it('提取单个 mermaid 代码块', () => {
      const text = '```mermaid\ngraph TD\n  A --> B\n```\n完成';
      const blocks = extractMermaidBlocks(text);
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toBe('graph TD\n  A --> B');
    });

    it('提取多个 mermaid 代码块', () => {
      const text = '```mermaid\ngraph TD\n  A --> B\n```\n中间文本\n```mermaid\nsequenceDiagram\n  A->>B: 嗨\n```';
      const blocks = extractMermaidBlocks(text);
      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toContain('graph TD');
      expect(blocks[1]).toContain('sequenceDiagram');
    });

    it('无 mermaid 代码块时返回空数组', () => {
      expect(extractMermaidBlocks('hello world')).toEqual([]);
      expect(extractMermaidBlocks('```js\nconsole.log("hi")\n```')).toEqual([]);
    });

    it('忽略空 mermaid 代码块', () => {
      const text = '```mermaid\n\n```';
      const blocks = extractMermaidBlocks(text);
      expect(blocks).toEqual([]);
    });

    it('不匹配未闭合的代码块', () => {
      const text = '```mermaid\ngraph TD\n  A --> B';
      const blocks = extractMermaidBlocks(text);
      expect(blocks).toEqual([]);
    });
  });

  describe('writeMermaidToWorkspace', () => {
    it('写入 PNG 文件到 .ihui/mermaid/ 目录', async () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      const filePath = await writeMermaidToWorkspace(tmpDir, buffer, 'image/png');
      expect(filePath).toMatch(/[\\/]\.ihui[\\/]mermaid[\\/]mermaid-.*\.png$/);
      expect(fs.existsSync(filePath)).toBe(true);
      const written = fs.readFileSync(filePath);
      expect(written).toEqual(buffer);
    });

    it('写入 SVG 文件(扩展名 .svg)', async () => {
      const buffer = Buffer.from('<svg>...</svg>');
      const filePath = await writeMermaidToWorkspace(tmpDir, buffer, 'image/svg+xml');
      expect(filePath).toMatch(/\.svg$/);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('目录不存在时自动创建', async () => {
      const nested = path.join(tmpDir, 'deep', 'nested');
      const filePath = await writeMermaidToWorkspace(nested, Buffer.from('x'), 'image/png');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });
});
