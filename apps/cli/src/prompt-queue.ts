/**
 * Prompt Queue — REPL 提示词排队执行。
 *
 * 灵感来源:参考行业 Agent 框架的 prompt queue 设计(Claude Code / Cursor 的 "Run after current")。
 * 简化策略(做减法):
 *   - 继承 EventEmitter,关键操作发事件(便于 UI 联动 + 测试)
 *   - FIFO 顺序,每项有唯一 id(便于 cancel 单条)
 *   - 状态机:pending → running → completed/cancelled
 *   - 不引入 uuid 依赖,用自增计数器 + 时间戳生成 id
 *   - 不持久化(只在当前 REPL session 内存中,退出即丢)
 *
 * 使用方式:
 *   const q = new PromptQueue();
 *   q.enqueue('refactor this');  // 入队
 *   const next = q.dequeue();    // 出队(返回 prompt 字符串)
 *   q.complete(id);              // 标记完成
 *   q.on('enqueued', (item) => { ... });
 */

import { EventEmitter } from 'node:events';

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

/**
 * PromptQueue — 提示词排队执行队列。
 *
 * 行为契约:
 * - FIFO 顺序:enqueue 入队尾,dequeue 从队首出
 * - dequeue 只返回 pending 项(跳过已 cancelled 的)
 * - complete/cancel 通过 id 查找项并更新状态
 * - snapshot 返回只读视图(不暴露内部数组)
 * - 所有变更发事件,便于 UI 联动
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
}
