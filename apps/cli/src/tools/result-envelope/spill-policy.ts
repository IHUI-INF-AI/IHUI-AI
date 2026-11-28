// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 替换策略(W4-12)—— 只决定“留原文 / 只截断 / 落盘换信封”,不碰磁盘。
 *
 * `SpillStore` 负责存,`SpillPolicy` 负责换;两者拆开后,换一种存储实现不必改信封格式,
 * 换一种信封格式也不必改存储。默认实现 `BudgetSpillPolicy` 保持现有结果信封契约不变。
 */

import { buildEnvelope, takePreview } from './envelope.js';
import type { SpillRef } from './spill-store.js';

export interface SpillPolicyInput {
  text: string;
  budgetChars: number;
  previewChars: number;
  totalLines: number;
  toolName: string;
  sourcePath?: string | null;
  /** `artifact`/`inline` = 落盘换信封;`truncate` = 契约要求只截断 */
  mode: 'artifact' | 'inline' | 'truncate';
}

export type SpillPlan =
  | { kind: 'keep' }
  | { kind: 'truncate'; text: string }
  | { kind: 'spill' };

export interface SpillPolicy {
  plan(input: SpillPolicyInput): SpillPlan;
  render(ref: SpillRef, input: SpillPolicyInput): string;
}

/** 默认策略:未超预算保留;契约 truncate 只截;其余落盘后回信封。 */
export class BudgetSpillPolicy implements SpillPolicy {
  plan(input: SpillPolicyInput): SpillPlan {
    if (input.text.length <= input.budgetChars) return { kind: 'keep' };
    if (input.mode === 'truncate') {
      const preview = takePreview(input.text, input.previewChars);
      return {
        kind: 'truncate',
        text: `${preview}\n\n[…输出已按工具契约截断:原 ${input.text.length} 字符 / ${input.totalLines} 行,预算 ${input.budgetChars} 字符。需要完整内容请改用带 offset/limit 的分块读取。]`,
      };
    }
    return { kind: 'spill' };
  }

  render(ref: SpillRef, input: SpillPolicyInput): string {
    return buildEnvelope({
      toolName: input.toolName,
      artifact: { relativePath: ref.locator, chars: ref.chars },
      totalLines: input.totalLines,
      budgetChars: input.budgetChars,
      preview: takePreview(input.text, input.previewChars),
      sourcePath: input.sourcePath,
      ...(ref.expiresAt === undefined ? {} : { expiresAt: ref.expiresAt }),
    });
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
