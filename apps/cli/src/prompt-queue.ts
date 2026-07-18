/**
 * Prompt Queue — REPL 提示词排队执行。
 *
 * 灵感来源:参考行业 Agent 框架的 prompt queue 设计(Claude Code / Cursor 的 "Run after current")。
 * 简化策略(做减法):
 *   - 继承 EventEmitter,关键操作发事件(便于 UI 联动 + 测试)
 *   - FIFO 顺序,每项有唯一 id(便于 cancel 单条)
 *   - 状态机:pending → running → completed/cancelled
 *   - 不引入 uuid 依赖,用自增计数器 + 时间戳生成 id
 *   - 持久化:可选 saveToDisk/loadFromDisk,把 pending 项写入 ~/.ihui/state/prompt-queue.json,
 *     跨 session 恢复未执行 prompt(running/completed/cancelled 不持久化)
 *
 * 使用方式:
 *   const q = new PromptQueue();
 *   q.enqueue('refactor this');  // 入队
 *   const next = q.dequeue();    // 出队(返回 prompt 字符串)
 *   q.complete(id);              // 标记完成
 *   q.on('enqueued', (item) => { ... });
 *
 * 持久化:
 *   await q.saveToDisk();        // 把 pending 项写入文件(用户退出 REPL 时调用)
 *   await q.loadFromDisk();      // 启动时加载未执行 prompt
 */

import { EventEmitter } from 'node:events';
import { promises as fs, existsSync } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/** 队列项状态 */
export type PromptQueueItemStatus = 'pending' | 'running' | 'completed' | 'cancelled';

/** 队列项 */
export interface PromptQueueItem {
  /** 唯一 id(自增 + 时间戳,便于 cancel 单条) */
  id: string;
  /** 提示词文本 */
  prompt: string;
  /** 状态 */
  status: PromptQueueItemStatus;
  /** 入队时间戳(ms) */
  enqueuedAt: number;
  /** 开始执行时间戳(ms) */
  startedAt?: number;
  /** 完成时间戳(ms) */
  completedAt?: number;
}

/** 持久化文件结构(只存 pending 项,跨 session 恢复) */
interface PersistFile {
  version: 1;
  savedAt: number;
  counter: number;
  pending: PromptQueueItem[];
}

/** 默认持久化路径:~/.ihui/state/prompt-queue.json */
export function getDefaultPersistPath(): string {
  return path.join(os.homedir(), '.ihui', 'state', 'prompt-queue.json');
}

/**
 * PromptQueue — 提示词排队执行队列。
 *
 * 行为契约:
 * - FIFO 顺序:enqueue 入队尾,dequeue 从队首出
 * - dequeue 只返回 pending 项(跳过已 cancelled 的)
 * - complete/cancel 通过 id 查找项并更新状态
 * - snapshot 返回只读视图(不暴露内部数组)
 * - 所有变更发事件,便于 UI 联动
 * - 持久化:saveToDisk 只保存 pending 项(包括 counter 以保持 id 单调)
 *          loadFromDisk 合并 pending 项到当前队列(去重 by id)
 */
export class PromptQueue extends EventEmitter {
  private items: PromptQueueItem[] = [];
  private counter = 0;

  /** 生成唯一 id(自增 + 时间戳) */
  private nextId(): string {
    this.counter += 1;
    return `q-${Date.now().toString(36)}-${this.counter.toString(36)}`;
  }

  /** 入队提示词,返回新队列项 */
  enqueue(prompt: string): PromptQueueItem {
    const trimmed = prompt.trim();
    if (!trimmed) {
      throw new Error('prompt 不能为空');
    }
    const item: PromptQueueItem = {
      id: this.nextId(),
      prompt: trimmed,
      status: 'pending',
      enqueuedAt: Date.now(),
    };
    this.items.push(item);
    this.emit('enqueued', item);
    return item;
  }

  /** 出队下一 pending 项(标记为 running),无则返回 undefined */
  dequeue(): PromptQueueItem | undefined {
    const next = this.items.find((it) => it.status === 'pending');
    if (!next) return undefined;
    next.status = 'running';
    next.startedAt = Date.now();
    this.emit('dequeued', next);
    return next;
  }

  /** 标记指定 id 的项为 completed */
  complete(id: string): void {
    const item = this.items.find((it) => it.id === id);
    if (!item) return;
    item.status = 'completed';
    item.completedAt = Date.now();
    this.emit('completed', item);
  }

  /** 取消指定 id 的项(若为 running 则不影响,只取消 pending);不传 id 则取消所有 pending */
  cancel(id?: string): void {
    if (id) {
      const item = this.items.find((it) => it.id === id);
      if (!item) return;
      // running/completed 不可取消(已开始或已完成的不能撤销)
      if (item.status !== 'pending') return;
      item.status = 'cancelled';
      item.completedAt = Date.now();
      this.emit('cancelled', item);
    } else {
      // 取消所有 pending
      let cancelledCount = 0;
      for (const it of this.items) {
        if (it.status === 'pending') {
          it.status = 'cancelled';
          it.completedAt = Date.now();
          cancelledCount += 1;
        }
      }
      if (cancelledCount > 0) {
        this.emit('cancelled', { all: true });
      }
    }
  }

  /** 返回所有队列项的浅拷贝(只读视图) */
  snapshot(): PromptQueueItem[] {
    return this.items.map((it) => ({ ...it }));
  }

  /** 当前 pending 项数量 */
  size(): number {
    return this.items.filter((it) => it.status === 'pending').length;
  }

  /** 清空所有项(无论状态),emit cleared 事件 */
  clear(): void {
    if (this.items.length === 0) return;
    this.items = [];
    this.emit('cleared');
  }

  /**
   * 保存 pending 项到磁盘(跨 session 持久化)。
   *
   * 行为契约:
   * - 只保存 status === 'pending' 的项(running/completed/cancelled 不持久化)
   * - 保存 counter 以保证重启后 id 单调
   * - 写入失败不抛错(只 log warn,REPL 退出不应阻塞)
   * - 文件用原子写入:先写 .tmp 再 rename(防止中途崩溃导致文件损坏)
   * - 空队列也会写入(清空旧文件)
   *
   * @param persistPath 持久化文件路径(默认 ~/.ihui/state/prompt-queue.json)
   */
  async saveToDisk(persistPath: string = getDefaultPersistPath()): Promise<void> {
    const pendingItems = this.items.filter((it) => it.status === 'pending');
    const payload: PersistFile = {
      version: 1,
      savedAt: Date.now(),
      counter: this.counter,
      pending: pendingItems.map((it) => ({ ...it })),
    };
    try {
      const dir = path.dirname(persistPath);
      await fs.mkdir(dir, { recursive: true });
      // 原子写入:先写 .tmp 再 rename
      const tmpPath = `${persistPath}.tmp`;
      await fs.writeFile(tmpPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
      await fs.rename(tmpPath, persistPath);
    } catch {
      // 写入失败静默(REPL 退出不应阻塞)
    }
  }

  /**
   * 从磁盘加载 pending 项(跨 session 恢复)。
   *
   * 行为契约:
   * - 文件不存在时 no-op(返回 0)
   * - 文件格式错误时 no-op + 删除损坏文件
   * - 已存在的 id 不重复加载(去重 by id)
   * - 加载后 counter 取 max(当前 counter, 文件 counter)
   * - 加载的 pending 项保持 pending 状态(不入 running)
   * - 返回加载的项数量(用于 UI 提示)
   *
   * @param persistPath 持久化文件路径(默认 ~/.ihui/state/prompt-queue.json)
   * @returns 加载的项数量
   */
  async loadFromDisk(persistPath: string = getDefaultPersistPath()): Promise<number> {
    if (!existsSync(persistPath)) return 0;
    let parsed: PersistFile;
    try {
      const raw = await fs.readFile(persistPath, 'utf-8');
      parsed = JSON.parse(raw) as PersistFile;
    } catch {
      // JSON 解析失败:文件损坏,删除后返回 0
      await fs.unlink(persistPath).catch(() => {});
      return 0;
    }
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.pending)) {
      // 结构不符合:删除后返回 0
      await fs.unlink(persistPath).catch(() => {});
      return 0;
    }
    // 去重加载:跳过当前已存在的 id
    const existingIds = new Set(this.items.map((it) => it.id));
    let loaded = 0;
    for (const item of parsed.pending) {
      if (!item || typeof item.id !== 'string' || typeof item.prompt !== 'string') continue;
      if (existingIds.has(item.id)) continue;
      // 重置为 pending 状态(即使原状态可能被篡改)
      const restored: PromptQueueItem = {
        id: item.id,
        prompt: item.prompt,
        status: 'pending',
        enqueuedAt: typeof item.enqueuedAt === 'number' ? item.enqueuedAt : Date.now(),
      };
      this.items.push(restored);
      this.emit('enqueued', restored);
      loaded += 1;
    }
    // counter 取 max 保证后续 id 单调
    if (typeof parsed.counter === 'number' && parsed.counter > this.counter) {
      this.counter = parsed.counter;
    }
    return loaded;
  }

  /**
   * 清理持久化文件(用户主动 clear 时调用)。
   * 文件不存在时不抛错。
   */
  async clearDisk(persistPath: string = getDefaultPersistPath()): Promise<void> {
    try {
      if (existsSync(persistPath)) {
        await fs.unlink(persistPath);
      }
    } catch {
      // 删除失败静默
    }
  }
}
