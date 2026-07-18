/**
 * PromptQueue 模块测试 — 验证 REPL 提示词排队执行。
 *
 * 测试范围:
 *   1. enqueue:入队 + 唯一 id + 事件触发 + 空 prompt 抛错
 *   2. dequeue:FIFO 顺序 + 标记 running + 无 pending 返回 undefined
 *   3. complete:标记完成 + 事件触发 + 不存在的 id 无副作用
 *   4. cancel:单条取消 + 全部取消 + running/completed 不可取消
 *   5. snapshot:只读视图 + 修改不影响内部状态
 *   6. size:只计 pending 项
 *   7. clear:清空所有 + 事件触发 + 空队列不触发
 *   8. 事件:enqueued/dequeued/completed/cancelled/cleared
 *   9. 状态机:pending → running → completed/cancelled
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { PromptQueue, type PromptQueueItem } from '../src/prompt-queue.js';

describe('PromptQueue', () => {
  describe('enqueue', () => {
    it('入队返回 PromptQueueItem(含 id + prompt + status=pending)', () => {
      const q = new PromptQueue();
      const item = q.enqueue('refactor this');
      expect(item.id).toBeTruthy();
      expect(item.id).toMatch(/^q-/);
      expect(item.prompt).toBe('refactor this');
      expect(item.status).toBe('pending');
      expect(item.enqueuedAt).toBeGreaterThan(0);
    });

    it('空 prompt 抛错', () => {
      const q = new PromptQueue();
      expect(() => q.enqueue('')).toThrow('prompt 不能为空');
      expect(() => q.enqueue('   ')).toThrow('prompt 不能为空');
      expect(() => q.enqueue('\t\n')).toThrow('prompt 不能为空');
    });

    it('prompt 被 trim(前后空白去除)', () => {
      const q = new PromptQueue();
      const item = q.enqueue('  hello world  ');
      expect(item.prompt).toBe('hello world');
    });

    it('多次 enqueue 生成不同 id', () => {
      const q = new PromptQueue();
      const ids = new Set<string>();
      for (let i = 0; i < 10; i++) {
        ids.add(q.enqueue(`prompt-${i}`).id);
      }
      expect(ids.size).toBe(10);
    });

    it('emit enqueued 事件', () => {
      const q = new PromptQueue();
      const handler = vi.fn();
      q.on('enqueued', handler);
      const item = q.enqueue('test');
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(item);
    });
  });

  describe('dequeue', () => {
    it('FIFO 顺序:先入先出', () => {
      const q = new PromptQueue();
      q.enqueue('first');
      q.enqueue('second');
      q.enqueue('third');
      expect(q.dequeue()?.prompt).toBe('first');
      expect(q.dequeue()?.prompt).toBe('second');
      expect(q.dequeue()?.prompt).toBe('third');
    });

    it('dequeue 标记为 running', () => {
      const q = new PromptQueue();
      q.enqueue('test');
      const item = q.dequeue();
      expect(item?.status).toBe('running');
      expect(item?.startedAt).toBeGreaterThan(0);
    });

    it('无 pending 时返回 undefined', () => {
      const q = new PromptQueue();
      expect(q.dequeue()).toBeUndefined();
    });

    it('已 dequeue 的项不再被 dequeue(跳过 running)', () => {
      const q = new PromptQueue();
      q.enqueue('a');
      q.enqueue('b');
      const first = q.dequeue();
      expect(first?.prompt).toBe('a');
      // 此时 a=running, b=pending
      const second = q.dequeue();
      expect(second?.prompt).toBe('b');
      // 都 running 了,无 pending
      expect(q.dequeue()).toBeUndefined();
    });

    it('emit dequeued 事件', () => {
      const q = new PromptQueue();
      const handler = vi.fn();
      q.on('dequeued', handler);
      q.enqueue('test');
      const item = q.dequeue();
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(item);
    });
  });

  describe('complete', () => {
    it('标记指定 id 为 completed', () => {
      const q = new PromptQueue();
      const item = q.enqueue('test');
      q.dequeue(); // 标记为 running
      q.complete(item.id);
      const snapshot = q.snapshot();
      expect(snapshot[0]!.status).toBe('completed');
      expect(snapshot[0]!.completedAt).toBeGreaterThan(0);
    });

    it('不存在的 id 无副作用(不抛错)', () => {
      const q = new PromptQueue();
      expect(() => q.complete('nonexistent')).not.toThrow();
    });

    it('emit completed 事件', () => {
      const q = new PromptQueue();
      const handler = vi.fn();
      q.on('completed', handler);
      const item = q.enqueue('test');
      q.dequeue();
      q.complete(item.id);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: item.id, status: 'completed' }));
    });
  });

  describe('cancel', () => {
    it('取消指定 pending 项', () => {
      const q = new PromptQueue();
      const item = q.enqueue('test');
      q.cancel(item.id);
      expect(q.snapshot()[0]!.status).toBe('cancelled');
      expect(q.snapshot()[0]!.completedAt).toBeGreaterThan(0);
    });

    it('取消不存在的 id 无副作用', () => {
      const q = new PromptQueue();
      expect(() => q.cancel('nonexistent')).not.toThrow();
    });

    it('running 项不可取消(无副作用)', () => {
      const q = new PromptQueue();
      const item = q.enqueue('test');
      q.dequeue(); // running
      q.cancel(item.id);
      // 仍为 running,不变 cancelled
      expect(q.snapshot()[0]!.status).toBe('running');
    });

    it('completed 项不可取消', () => {
      const q = new PromptQueue();
      const item = q.enqueue('test');
      q.dequeue();
      q.complete(item.id);
      q.cancel(item.id);
      // 仍为 completed
      expect(q.snapshot()[0]!.status).toBe('completed');
    });

    it('不传 id 时取消所有 pending', () => {
      const q = new PromptQueue();
      q.enqueue('a');
      q.enqueue('b');
      q.enqueue('c');
      // 取消一个 + dequeue 一个
      const items = q.snapshot();
      q.cancel(items[0]!.id);
      q.dequeue(); // 第二个变 running
      // 现在状态:cancelled, running, pending
      q.cancel(); // 取消所有 pending(只影响第三个)
      const snap = q.snapshot();
      expect(snap[0]!.status).toBe('cancelled');
      expect(snap[1]!.status).toBe('running');
      expect(snap[2]!.status).toBe('cancelled');
    });

    it('不传 id 时无 pending 不 emit 事件', () => {
      const q = new PromptQueue();
      const handler = vi.fn();
      q.on('cancelled', handler);
      q.enqueue('a');
      q.dequeue(); // running,无 pending
      q.cancel();
      expect(handler).not.toHaveBeenCalled();
    });

    it('取消指定 id 时 emit cancelled 事件(单项)', () => {
      const q = new PromptQueue();
      const handler = vi.fn();
      q.on('cancelled', handler);
      const item = q.enqueue('test');
      q.cancel(item.id);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: item.id, status: 'cancelled' }));
    });

    it('取消所有 pending 时 emit cancelled 事件({all: true})', () => {
      const q = new PromptQueue();
      const handler = vi.fn();
      q.on('cancelled', handler);
      q.enqueue('a');
      q.enqueue('b');
      q.cancel();
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ all: true });
    });
  });

  describe('snapshot', () => {
    it('返回所有项的浅拷贝', () => {
      const q = new PromptQueue();
      q.enqueue('a');
      q.enqueue('b');
      const snap = q.snapshot();
      expect(snap).toHaveLength(2);
      expect(snap[0]!.prompt).toBe('a');
      expect(snap[1]!.prompt).toBe('b');
    });

    it('修改 snapshot 不影响内部状态(只读视图)', () => {
      const q = new PromptQueue();
      const item = q.enqueue('original');
      const snap = q.snapshot();
      snap[0]!.prompt = 'modified';
      snap[0]!.status = 'completed';
      // 内部不变
      expect(q.snapshot()[0]!.prompt).toBe('original');
      expect(q.snapshot()[0]!.status).toBe('pending');
      // 原始 item 引用也不变
      expect(item.prompt).toBe('original');
      expect(item.status).toBe('pending');
    });

    it('空队列返回空数组', () => {
      const q = new PromptQueue();
      expect(q.snapshot()).toEqual([]);
    });
  });

  describe('size', () => {
    it('返回 pending 项数量', () => {
      const q = new PromptQueue();
      expect(q.size()).toBe(0);
      q.enqueue('a');
      q.enqueue('b');
      expect(q.size()).toBe(2);
    });

    it('dequeue 后 size 减少', () => {
      const q = new PromptQueue();
      q.enqueue('a');
      q.enqueue('b');
      q.dequeue();
      expect(q.size()).toBe(1);
    });

    it('cancel 后 size 减少', () => {
      const q = new PromptQueue();
      q.enqueue('a');
      q.enqueue('b');
      q.cancel();
      expect(q.size()).toBe(0);
    });

    it('completed 项不计入 size', () => {
      const q = new PromptQueue();
      const item = q.enqueue('a');
      q.enqueue('b');
      q.dequeue();
      q.complete(item.id);
      // a=completed, b=pending
      expect(q.size()).toBe(1);
    });
  });

  describe('clear', () => {
    it('清空所有项(无论状态)', () => {
      const q = new PromptQueue();
      q.enqueue('a');
      q.enqueue('b');
      q.dequeue(); // a=running
      q.clear();
      expect(q.snapshot()).toEqual([]);
      expect(q.size()).toBe(0);
    });

    it('emit cleared 事件', () => {
      const q = new PromptQueue();
      const handler = vi.fn();
      q.on('cleared', handler);
      q.enqueue('a');
      q.clear();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('空队列 clear 不 emit 事件', () => {
      const q = new PromptQueue();
      const handler = vi.fn();
      q.on('cleared', handler);
      q.clear();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('状态机', () => {
    it('pending → running → completed', () => {
      const q = new PromptQueue();
      const item = q.enqueue('test');
      expect(item.status).toBe('pending');

      const dequeued = q.dequeue();
      expect(dequeued?.status).toBe('running');

      q.complete(item.id);
      expect(q.snapshot()[0]!.status).toBe('completed');
    });

    it('pending → cancelled', () => {
      const q = new PromptQueue();
      const item = q.enqueue('test');
      expect(item.status).toBe('pending');

      q.cancel(item.id);
      expect(q.snapshot()[0]!.status).toBe('cancelled');
    });

    it('running 不可回退到 pending', () => {
      const q = new PromptQueue();
      q.enqueue('test');
      q.dequeue(); // running
      // 无方法能把 running 变回 pending
      expect(q.size()).toBe(0); // size 只计 pending
    });
  });

  describe('综合场景', () => {
    it('多步工作流:入队 3 个 → 取消 1 个 → 顺序执行 2 个', () => {
      const q = new PromptQueue();
      q.enqueue('task-a');
      q.enqueue('task-b');
      q.enqueue('task-c');
      expect(q.size()).toBe(3);

      // 取消 task-b
      const snap = q.snapshot();
      const taskB = snap.find((it) => it.prompt === 'task-b')!;
      q.cancel(taskB.id);
      expect(q.size()).toBe(2);

      // 顺序执行剩余 2 个
      const first = q.dequeue();
      expect(first?.prompt).toBe('task-a');
      q.complete(first!.id);

      const second = q.dequeue();
      expect(second?.prompt).toBe('task-c');
      q.complete(second!.id);

      // 无 pending 了
      expect(q.size()).toBe(0);
      expect(q.dequeue()).toBeUndefined();
    });

    it('事件流验证:完整生命周期', () => {
      const q = new PromptQueue();
      const events: string[] = [];
      q.on('enqueued', () => events.push('enqueued'));
      q.on('dequeued', () => events.push('dequeued'));
      q.on('completed', () => events.push('completed'));
      q.on('cancelled', () => events.push('cancelled'));
      q.on('cleared', () => events.push('cleared'));

      const item = q.enqueue('test');
      q.dequeue();
      q.complete(item.id);

      expect(events).toEqual(['enqueued', 'dequeued', 'completed']);
    });

    it('EventEmitter 类型安全:on/off/removeListener', () => {
      const q = new PromptQueue();
      const handler = (item: PromptQueueItem) => { void item; };
      q.on('enqueued', handler);
      q.off('enqueued', handler);
      q.addListener('enqueued', handler);
      q.removeListener('enqueued', handler);
      // 不抛错即通过
      expect(true).toBe(true);
    });
  });

  describe('跨 session 持久化(saveToDisk / loadFromDisk)', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-pq-persist-'));
    });

    afterEach(() => {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* 忽略 */ }
    });

    it('saveToDisk 写入文件,loadFromDisk 恢复 pending 项', async () => {
      const persistPath = path.join(tmpDir, 'prompt-queue.json');
      const q1 = new PromptQueue();
      q1.enqueue('task A');
      q1.enqueue('task B');
      q1.enqueue('task C');
      // 标记一条为 running(不应被持久化)
      const runningItem = q1.dequeue();
      expect(runningItem?.prompt).toBe('task A');
      // 标记一条为 completed(不应被持久化)
      const next = q1.dequeue();
      q1.complete(next!.id);

      await q1.saveToDisk(persistPath);

      // 新队列从磁盘加载
      const q2 = new PromptQueue();
      const loadedCount = await q2.loadFromDisk(persistPath);
      expect(loadedCount).toBe(1); // 只剩 task C (pending)
      const snapshot = q2.snapshot();
      expect(snapshot).toHaveLength(1);
      expect(snapshot[0]!.prompt).toBe('task C');
      expect(snapshot[0]!.status).toBe('pending');
    });

    it('saveToDisk 空队列写入空 pending 数组', async () => {
      const persistPath = path.join(tmpDir, 'empty.json');
      const q = new PromptQueue();
      await q.saveToDisk(persistPath);
      expect(fs.existsSync(persistPath)).toBe(true);
      const raw = fs.readFileSync(persistPath, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.pending).toEqual([]);
    });

    it('loadFromDisk 文件不存在时返回 0(不抛错)', async () => {
      const q = new PromptQueue();
      const count = await q.loadFromDisk(path.join(tmpDir, 'nonexistent.json'));
      expect(count).toBe(0);
    });

    it('loadFromDisk 损坏文件时删除并返回 0', async () => {
      const persistPath = path.join(tmpDir, 'corrupt.json');
      fs.writeFileSync(persistPath, '{not valid json', 'utf-8');
      const q = new PromptQueue();
      const count = await q.loadFromDisk(persistPath);
      expect(count).toBe(0);
      // 损坏文件应被删除
      expect(fs.existsSync(persistPath)).toBe(false);
    });

    it('loadFromDisk 去重:已存在的 id 不重复加载', async () => {
      const persistPath = path.join(tmpDir, 'dedup.json');
      const q1 = new PromptQueue();
      const item = q1.enqueue('task A');
      await q1.saveToDisk(persistPath);

      // q2 已有同 id 的项(模拟)
      const q2 = new PromptQueue();
      // 手动注入相同 id(测试去重逻辑)
      (q2 as unknown as { items: PromptQueueItem[] }).items.push({
        ...item,
        status: 'completed', // 已完成,但 id 相同
      });
      const loaded = await q2.loadFromDisk(persistPath);
      expect(loaded).toBe(0); // 已存在 id,跳过
    });

    it('loadFromDisk 后 counter 取 max(保证 id 单调)', async () => {
      const persistPath = path.join(tmpDir, 'counter.json');
      const q1 = new PromptQueue();
      // 入队 5 次(counter=5)
      for (let i = 0; i < 5; i++) q1.enqueue(`task-${i}`);
      await q1.saveToDisk(persistPath);

      const q2 = new PromptQueue();
      await q2.loadFromDisk(persistPath);
      // 入队新项,id 应基于 counter=5 继续递增
      const newItem = q2.enqueue('new-task');
      // 解析 id 中的 counter 部分(q-xxx-5 后应为 q-xxx-6)
      const parts = newItem.id.split('-');
      const counter = parseInt(parts[parts.length - 1]!, 36);
      expect(counter).toBeGreaterThanOrEqual(6);
    });

    it('clearDisk 删除持久化文件', async () => {
      const persistPath = path.join(tmpDir, 'clear.json');
      const q = new PromptQueue();
      q.enqueue('task');
      await q.saveToDisk(persistPath);
      expect(fs.existsSync(persistPath)).toBe(true);
      await q.clearDisk(persistPath);
      expect(fs.existsSync(persistPath)).toBe(false);
    });

    it('clearDisk 文件不存在时不抛错', async () => {
      const q = new PromptQueue();
      await expect(q.clearDisk(path.join(tmpDir, 'never-existed.json'))).resolves.toBeUndefined();
    });

    it('saveToDisk 写入失败不抛错(只 log warn)', async () => {
      // 用一个不可能的路径触发写入失败
      const impossiblePath = path.join('/nonexistent-root', 'no-perm', 'prompt-queue.json');
      const q = new PromptQueue();
      q.enqueue('task');
      await expect(q.saveToDisk(impossiblePath)).resolves.toBeUndefined();
    });

    it('持久化文件结构正确(version + savedAt + counter + pending)', async () => {
      const persistPath = path.join(tmpDir, 'structure.json');
      const q = new PromptQueue();
      q.enqueue('task A');
      await q.saveToDisk(persistPath);
      const raw = fs.readFileSync(persistPath, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.version).toBe(1);
      expect(typeof parsed.savedAt).toBe('number');
      expect(typeof parsed.counter).toBe('number');
      expect(Array.isArray(parsed.pending)).toBe(true);
      expect(parsed.pending[0].prompt).toBe('task A');
      expect(parsed.pending[0].status).toBe('pending');
    });
  });
});
