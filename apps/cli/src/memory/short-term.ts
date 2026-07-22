/**
 * ShortTermMemory — 当前 session 临时记忆,Map 存储,maxItems 100(LRU 淘汰最旧)。
 * 平台独占:仅 cli(W2-1 四层记忆第 1 层,对标 OpenClaw Mem working memory)。
 * 生命周期:进程内,不持久化;dream() 周期沉淀到 LongTermMemory 后清空。
 */
import * as crypto from 'node:crypto';

export interface ShortTermEntry {
  id: string;
  text: string;
  ts: number;
  metadata?: Record<string, unknown>;
}

export class ShortTermMemory {
  private readonly items = new Map<string, ShortTermEntry>();
  private readonly order: string[] = [];
  private readonly maxItems: number;

  constructor(maxItems = 100) {
    this.maxItems = maxItems;
  }

  /** 追加一条临时记忆,返回条目(含生成的 id)。超过 maxItems 淘汰最旧。 */
  add(text: string, metadata?: Record<string, unknown>): ShortTermEntry {
    const entry: ShortTermEntry = {
      id: crypto.randomUUID(),
      text,
      ts: Date.now(),
      metadata,
    };
    this.items.set(entry.id, entry);
    this.order.push(entry.id);
    this.evict();
    return entry;
  }

  /** 按 id 取单条,不存在返回 undefined。 */
  get(id: string): ShortTermEntry | undefined {
    return this.items.get(id);
  }

  /** 清空全部临时记忆。 */
  clear(): void {
    this.items.clear();
    this.order.length = 0;
  }

  /** 按写入顺序返回全部条目。 */
  all(): ShortTermEntry[] {
    const out: ShortTermEntry[] = [];
    for (const id of this.order) {
      const e = this.items.get(id);
      if (e) out.push(e);
    }
    return out;
  }

  /** 当前条目数。 */
  get size(): number {
    return this.items.size;
  }

  private evict(): void {
    while (this.items.size > this.maxItems) {
      const oldest = this.order.shift();
      if (oldest === undefined) break;
      this.items.delete(oldest);
    }
  }
}
