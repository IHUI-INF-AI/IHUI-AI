// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DreamMemory — 梦境周期沉淀,离线时整合短期记忆到长期记忆。
 * 平台独占:仅 cli(W2-1 四层记忆第 4 层)。
 *
 * 与旧实现的区别:不再「逐条搬运」,而是先经 distillMemoryEntries 归一化合并 + 按预算裁剪,
 * 再把蒸馏后的代表条目写入 LongTermMemory(分类 'dream'),最后清空短期记忆。
 * 失败语义不变:try/catch 包住整个沉淀,失败只记日志、不影响会话结束;此时不清空短期记忆。
 */
import type { ShortTermMemory } from './short-term.js';
import type { LongTermMemory } from './long-term.js';
import { distillMemoryEntries, type DistillEntry } from './distill.js';

export interface DreamResult {
  /** 本次沉淀的条目数(蒸馏后实际写入条数) */
  consolidated: number;
  /** 耗时(ms) */
  durationMs: number;
}

/** 从短期记忆条目的 metadata 读取蒸馏用的 kind/source,缺省回落到 'dream'/'session'。 */
function metadataString(metadata: Record<string, unknown> | undefined, key: string, fallback: string): string {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

/** 蒸馏文本按 `- ` 条目行落盘(忽略 `## <kind>` 段标题,分类统一由 dream 写入)。 */
function distilledEntryLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
    .filter((line) => line !== '');
}

export class DreamMemory {
  constructor(
    private readonly shortTerm: ShortTermMemory,
    private readonly longTerm: LongTermMemory,
  ) {}

  /** 触发梦境整合:短期记忆 → 蒸馏 → 长期记忆(分类 'dream'),完成后清空短期记忆。 */
  async dream(): Promise<DreamResult> {
    const start = Date.now();
    const items = this.shortTerm.all();
    if (items.length === 0) return { consolidated: 0, durationMs: Date.now() - start };

    try {
      const entries: DistillEntry[] = items.map((item) => ({
        text: item.text,
        source: metadataString(item.metadata, 'source', 'session'),
        createdAt: item.ts,
        kind: metadataString(item.metadata, 'kind', 'dream'),
      }));
      const result = await distillMemoryEntries(entries);
      for (const line of distilledEntryLines(result.text)) {
        this.longTerm.append(line, 'dream');
      }
      this.shortTerm.clear();
      return { consolidated: result.kept, durationMs: Date.now() - start };
    } catch (error) {
      // 沉淀失败只记日志:会话结束流程不能因为记忆整理失败而被打断;短期记忆保持原样。
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[memory-dream] 蒸馏沉淀失败,本次不写入长期记忆: ${message}`);
      return { consolidated: 0, durationMs: Date.now() - start };
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
