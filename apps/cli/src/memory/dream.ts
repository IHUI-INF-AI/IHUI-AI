/**
 * DreamMemory — 梦境周期沉淀,离线时整合短期记忆到长期记忆。
 * 平台独占:仅 cli(W2-1 四层记忆第 4 层,对标 OpenClaw Mem dream/consolidate)。
 * dream() 把 ShortTermMemory 全部条目写入 LongTermMemory(分类 'dream'),然后清空短期记忆。
 */
import type { ShortTermMemory } from './short-term.js';
import type { LongTermMemory } from './long-term.js';

export interface DreamResult {
  /** 本次沉淀的条目数 */
  consolidated: number;
  /** 耗时(ms) */
  durationMs: number;
}

export class DreamMemory {
  constructor(
    private readonly shortTerm: ShortTermMemory,
    private readonly longTerm: LongTermMemory,
  ) {}

  /** 触发梦境整合:短期 → 长期(分类 'dream'),完成后清空短期记忆。 */
  async dream(): Promise<DreamResult> {
    const start = Date.now();
    const items = this.shortTerm.all();
    let count = 0;
    for (const item of items) {
      this.longTerm.append(item.text, 'dream');
      count++;
    }
    this.shortTerm.clear();
    return { consolidated: count, durationMs: Date.now() - start };
  }
}
