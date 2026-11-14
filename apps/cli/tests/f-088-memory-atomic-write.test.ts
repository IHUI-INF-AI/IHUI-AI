// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
/**
 * F-088:长期记忆 MEMORY.md 原子落盘 + 跨进程写锁 + dream 批量提交。
 *
 * 证明四件事:
 *   1) 写盘中途失败(短写 / rename EPERM)时,原 MEMORY.md 逐字节不变,不留 tmp/锁残留;
 *   2) 两个会话(两个 LongTermMemory 实例)先后追加不互相覆盖,重复条目只留一条;
 *   3) 跨进程写锁:别人持活锁时本次显式失败而不是无锁覆盖,崩溃残留的死锁会被抢占;
 *   4) dream 一次性批量写入,无条目可写时仍 clear(),写入失败时不清空短期记忆。
 *
 * 失败注入:局部 mock `node:fs` 的 writeSync/renameSync(其余能力保持真实),不碰生产代码的导出面。
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { LongTermMemory } from '../src/memory/long-term.js';
import { DreamMemory } from '../src/memory/dream.js';
import { ShortTermMemory } from '../src/memory/short-term.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边
import type * as FsModule from 'node:fs';

interface FailFlags {
  __f088RenameFail?: boolean;
  __f088ShortWrite?: boolean;
}

/** 全局开关(工厂在模块导入期就可能执行,故用函数声明避免 const 的 TDZ)。 */
function flags(): FailFlags {
  return globalThis as unknown as FailFlags;
}

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof FsModule>();
  const renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
    if ((globalThis as unknown as FailFlags).__f088RenameFail) {
      const err = new Error('EPERM: operation not permitted, rename') as NodeJS.ErrnoException;
      err.code = 'EPERM';
      throw err;
    }
    return actual.renameSync(from, to);
  }) as typeof actual.renameSync;
  // 短写注入:只落一半字节并如实返回半长 ⇒ 原子写工具必须判"写入不完整"并清掉 tmp。
  // 只对带标记的那一次正文写生效,避免把锁文件/夹具自身的写也掰断。
  const writeSync = ((...args: unknown[]): number => {
    const buffer = args[1];
    if ((globalThis as unknown as FailFlags).__f088ShortWrite && typeof buffer === 'string' && buffer.includes('F088-中途失败')) {
      const full = Buffer.from(buffer, 'utf-8');
      return actual.writeSync(args[0] as number, full.subarray(0, Math.max(1, Math.floor(full.length / 2))));
    }
    return (actual.writeSync as unknown as (...rest: unknown[]) => number)(...args);
  }) as typeof actual.writeSync;
  return { ...actual, renameSync, writeSync };
});

let scratch = '';

beforeAll(() => {
  scratch = mkScratch('f-088-memory-');
});

afterAll(() => {
  try {
    rmScratch(scratch);
  } catch (err) {
    console.warn(`[f-088] 夹具目录清理失败(忽略,不影响判定): ${String(err)}`);
  }
});

afterEach(() => {
  flags().__f088RenameFail = false;
  flags().__f088ShortWrite = false;
});

function workspace(name: string): string {
  return path.join(scratch, name);
}

function lockPathOf(memory: LongTermMemory): string {
  return path.join(path.dirname(memory.path), '.MEMORY.md.lock');
}

/** 目录里残留的 tmp / 锁文件(正常落盘后必须为空)。 */
function leftovers(dir: string): string[] {
  return fs.readdirSync(dir).filter((name) => name.includes('.tmp-') || name.endsWith('.lock'));
}

describe('F-088 MEMORY.md 原子落盘', () => {
  it('短写中断:原文件逐字节不变,不留 tmp/锁残留,失败后可正常再写', () => {
    const ws = workspace('short-write');
    const memory = new LongTermMemory(ws);
    memory.append('基线条目', '通用');
    const before = fs.readFileSync(memory.path);

    flags().__f088ShortWrite = true;
    let thrown: unknown = null;
    try {
      memory.append('F088-中途失败');
    } catch (error) {
      thrown = error;
    }
    flags().__f088ShortWrite = false;

    expect(thrown).toBeTruthy();
    expect(fs.readFileSync(memory.path).equals(before)).toBe(true);
    expect(leftovers(path.dirname(memory.path))).toEqual([]);

    memory.append('失败后的新条目', '通用');
    expect(memory.load().map((entry) => entry.text).sort()).toEqual(['失败后的新条目', '基线条目'].sort());
  });

  it('替换失败(rename EPERM):原文件不变,锁被释放,不留 tmp 残留', () => {
    const ws = workspace('rename-fail');
    const memory = new LongTermMemory(ws);
    memory.append('基线条目', '通用');
    const before = fs.readFileSync(memory.path);

    flags().__f088RenameFail = true;
    let thrown: unknown = null;
    try {
      memory.append('替换失败条目');
    } catch (error) {
      thrown = error;
    }
    flags().__f088RenameFail = false;

    expect((thrown as { code?: string })?.code).toBe('atomic_replace_failed');
    expect(fs.readFileSync(memory.path).equals(before)).toBe(true);
    expect(leftovers(path.dirname(memory.path))).toEqual([]);

    memory.append('恢复后条目', '通用');
    expect(memory.load().map((entry) => entry.text)).toContain('恢复后条目');
  });
});

describe('F-088 并发追加与去重', () => {
  it('两个会话先后追加互不覆盖,重复条目只留一条', () => {
    const ws = workspace('two-sessions');
    const sessionA = new LongTermMemory(ws);
    const sessionB = new LongTermMemory(ws);

    sessionA.append('会话A的条目', '通用');
    sessionB.append('会话B的条目', '通用');
    sessionA.append('两个会话都想记的事', '偏好');
    sessionB.append('两个会话都想记的事', '偏好');

    const texts = sessionA.load().map((entry) => entry.text);
    expect(texts.filter((text) => text === '会话A的条目')).toHaveLength(1);
    expect(texts.filter((text) => text === '会话B的条目')).toHaveLength(1);
    expect(texts.filter((text) => text === '两个会话都想记的事')).toHaveLength(1);
  });

  it('批量追加一次写盘,批内重复与文件内已有条目都跳过', () => {
    const ws = workspace('batch');
    const memory = new LongTermMemory(ws);
    memory.append('已有条目', 'dream');

    const added = memory.appendMany(['批条目1', '批条目2', '批条目1', '已有条目'], 'dream');

    expect(added).toBe(2);
    const texts = memory.load().map((entry) => entry.text);
    expect(texts.filter((text) => text === '批条目1')).toHaveLength(1);
    expect(texts.filter((text) => text === '批条目2')).toHaveLength(1);
    expect(texts.filter((text) => text === '已有条目')).toHaveLength(1);
    expect(leftovers(path.dirname(memory.path))).toEqual([]);
  });
});

describe('F-088 跨进程写锁', () => {
  it('别人持活锁时显式失败,绝不无锁覆盖', () => {
    const ws = workspace('live-lock');
    const memory = new LongTermMemory(ws);
    memory.append('基线条目', '通用');
    const before = fs.readFileSync(memory.path);

    // 模拟另一个仍活着的 CLI 会话(pid 取本进程 = 一定活着)
    fs.writeFileSync(
      lockPathOf(memory),
      JSON.stringify({ pid: process.pid, token: 'foreign-session', at: Date.now() }),
      { flag: 'wx', mode: 0o600 },
    );

    const startedAt = Date.now();
    let thrown: unknown = null;
    try {
      memory.append('被锁挡住的条目');
    } catch (error) {
      thrown = error;
    }
    const waited = Date.now() - startedAt;

    expect((thrown as Error)?.message).toMatch(/正被另一个会话写入/);
    expect(waited).toBeGreaterThanOrEqual(1_000);
    expect(fs.readFileSync(memory.path).equals(before)).toBe(true);

    fs.unlinkSync(lockPathOf(memory));
    memory.append('锁释放后的条目', '通用');
    expect(memory.load().map((entry) => entry.text)).toContain('锁释放后的条目');
  });

  it('崩溃残留的死进程锁会被抢占,不把记忆永久锁死', () => {
    const ws = workspace('stale-lock');
    const memory = new LongTermMemory(ws);
    fs.mkdirSync(path.dirname(memory.path), { recursive: true });
    fs.writeFileSync(
      lockPathOf(memory),
      JSON.stringify({ pid: 2_147_483_646, token: 'dead-session', at: Date.now() }),
      { flag: 'wx', mode: 0o600 },
    );

    memory.append('抢占后的条目', '通用');

    expect(memory.load().map((entry) => entry.text)).toEqual(['抢占后的条目']);
    expect(leftovers(path.dirname(memory.path))).toEqual([]);
  });
});

describe('F-088 dream 批量提交', () => {
  it('整批写入后清空短期记忆,重复运行不产生重复条目', async () => {
    const ws = workspace('dream-batch');
    const shortTerm = new ShortTermMemory();
    const longTerm = new LongTermMemory(ws);
    shortTerm.add('记住甲', { kind: 'fact' });
    shortTerm.add('记住乙', { kind: 'fact' });

    const first = await new DreamMemory(shortTerm, longTerm).dream();

    expect(first.consolidated).toBe(2);
    expect(shortTerm.size).toBe(0);
    expect(longTerm.load().map((entry) => entry.text).sort()).toEqual(['记住乙', '记住甲'].sort());
    expect(leftovers(path.dirname(longTerm.path))).toEqual([]);
  });

  it('没有可写条目时仍然执行 clear()', async () => {
    const ws = workspace('dream-empty');
    const shortTerm = new ShortTermMemory();
    const longTerm = new LongTermMemory(ws);
    shortTerm.add('   ', { kind: 'fact' });

    const result = await new DreamMemory(shortTerm, longTerm).dream();

    expect(result.consolidated).toBe(0);
    expect(shortTerm.size).toBe(0);
    expect(fs.existsSync(longTerm.path)).toBe(false);
  });

  it('写入失败时不清空短期记忆,原文件不被截断', async () => {
    const ws = workspace('dream-fail');
    const shortTerm = new ShortTermMemory();
    const longTerm = new LongTermMemory(ws);
    longTerm.append('已有条目', 'dream');
    const before = fs.readFileSync(longTerm.path);
    shortTerm.add('待沉淀的新条目', { kind: 'fact' });

    flags().__f088RenameFail = true;
    const result = await new DreamMemory(shortTerm, longTerm).dream();
    flags().__f088RenameFail = false;

    expect(result.consolidated).toBe(0);
    expect(shortTerm.size).toBe(1);
    expect(fs.readFileSync(longTerm.path).equals(before)).toBe(true);
    expect(leftovers(path.dirname(longTerm.path))).toEqual([]);
  });
});
