// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具结果预算信封 —— 结果回灌上下文前的那道"体积闸"。
 *
 * 一句话职责:超过预算的工具结果**不得整段进上下文**,改为
 *   ① 原文落盘到项目内会话产物目录 → ② 回灌"路径 + 前 K 字符预览 + 已截断说明"的信封。
 *
 * 与压缩链的分工:
 *   - 本模块管**入口**(结果第一次进 messages 时);
 *   - `@ihui/context-compaction` 的 reclaim/摘要管**存量**(历史里的结果体)。
 *   两者靠 `isEnvelopeContent()` 这条识别通道对齐:已封装的结果不再二次封装,
 *   信封里的预览也不会被当正文再压一遍(reclaim 只改写它认得的工具结果正文,
 *   而本模块产出的信封已是最短形态 —— 重建提醒时按 `parseEnvelope()` 回捞,不重生成)。
 *
 * 平台特有:仅 CLI 结果回灌边界使用(依赖 workspacePath 与本地磁盘),不下沉 packages/。
 */

import { redactSecrets } from '../../redact.js';
import type { ToolResultBudgetContract } from '@ihui/types';
import {
  resolveToolOutputBudget,
  hasDeclaredToolBudget,
  projectContractResultBudget,
  noteContractBudgetGap,
  type BudgetSource,
  type ToolOutputBudget,
} from './budgets.js';
import { takePreview, isEnvelopeContent, buildEnvelope, parseEnvelope } from './envelope.js';
import { writeToolArtifact } from './artifact-store.js';
import { extractPathArg, type ReadStateTracker } from './read-state.js';

export * from './budgets.js';
export * from './envelope.js';
export * from './artifact-store.js';
export * from './read-state.js';

/** 本次施加的结果类别(如实报数,不静默) */
export type EnvelopeReason =
  | 'applied'
  | 'within-budget'
  | 'already-enveloped'
  | 'empty-output'
  | 'persist-failed'
  /** 契约声明 `policy:'truncate'`:超限只留预览、不落盘(没有产物指针可回捞,这是有意区别) */
  | 'truncated';

export interface EnvelopeOutcome {
  /** 应当回灌的结果正文(未超限时 === 原正文) */
  output: string;
  enveloped: boolean;
  reason: EnvelopeReason;
  /** 产物文件相对路径(仅信封化时有值) */
  artifactPath?: string;
  budget: ToolOutputBudget;
  /** 预算来自哪一面 —— 契约没生效时必须能从读数里看出来,而不是靠人猜 */
  budgetSource: BudgetSource;
  originalChars: number;
}

export interface EnvelopeCallShape {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface EnvelopeResultShape {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * 对一次工具结果施加输出预算。
 *
 * 三条判序(顺序即语义,不可调换):
 *   1. 已是信封 → 原样返回(幂等:重放/恢复的历史不得二次封装);
 *   2. 未超预算 → 原样返回;
 *   3. 超限 → 落盘 + 生成信封;落盘失败时**退回原文**并如实标 'persist-failed'
 *      (结果不能凭空丢掉,否则模型只会重复执行同一工具)。
 *   3'. 契约声明 `policy:'truncate'` → 只截不存(标 'truncated'),不伪造产物指针。
 *
 * 预算取源:`opts.budget`(显式覆盖) > 工具声明的 `contract.resultBudget` > 登记表 > 默认档。
 * 三者来源由 `budgetSource` 如实带回,并且**契约里运行时没实现的字段会被点名记账**
 * (`noteContractBudgetGap`),不允许"写了契约但静默按默认档跑"。
 *
 * 落盘前先 `redactSecrets`:产物文件虽然落在 gitignore 目录里,
 * 但仍是磁盘上的明文副本,不得把凭据原样写出去。
 */
export function envelopeToolResult(opts: {
  call: EnvelopeCallShape;
  result: EnvelopeResultShape;
  workspacePath: string;
  sessionId?: string;
  turn?: number;
  tracker?: ReadStateTracker;
  /** 覆盖预算(测试/调优用) */
  budget?: ToolOutputBudget;
  /** 工具声明的结果预算(`Tool.contract?.resultBudget`),A13 的声明面 */
  resultBudget?: ToolResultBudgetContract | null;
}): EnvelopeOutcome {
  const projected = opts.budget === undefined ? projectContractResultBudget(opts.resultBudget) : null;
  if (projected && projected.unimplemented.length > 0) {
    noteContractBudgetGap(opts.call.name, projected.unimplemented);
  }
  const budgetSource: BudgetSource =
    opts.budget !== undefined
      ? 'override'
      : projected
        ? 'contract'
        : hasDeclaredToolBudget(opts.call.name)
          ? 'table'
          : 'default';
  const budget = opts.budget ?? projected?.budget ?? resolveToolOutputBudget(opts.call.name);
  const policy: ToolResultBudgetContract['policy'] = projected?.policy ?? 'artifact';
  const raw = typeof opts.result.output === 'string' ? opts.result.output : '';
  const redacted = redactSecrets(raw);

  if (isEnvelopeContent(redacted)) {
    recordRead(opts, redacted, { enveloped: true, originalChars: redacted.length });
    return {
      output: redacted,
      enveloped: false,
      reason: 'already-enveloped',
      budget,
      budgetSource,
      originalChars: redacted.length,
    };
  }
  if (redacted.length === 0) {
    return { output: redacted, enveloped: false, reason: 'empty-output', budget, budgetSource, originalChars: 0 };
  }
  if (redacted.length <= budget.maxChars) {
    recordRead(opts, redacted, { enveloped: false, originalChars: redacted.length });
    return {
      output: redacted,
      enveloped: false,
      reason: 'within-budget',
      budget,
      budgetSource,
      originalChars: redacted.length,
    };
  }

  const totalLines = redacted.split('\n').length;
  const preview = takePreview(redacted, budget.previewChars);
  const sourcePath = extractPathArg(opts.call.arguments);

  if (policy === 'truncate') {
    // 契约明说"截掉即可",没有产物可回捞 —— 所以既不写盘、也不给一个不存在的路径。
    const text = `${preview}\n\n[…输出已按工具契约截断:原 ${redacted.length} 字符 / ${totalLines} 行,预算 ${budget.maxChars} 字符。需要完整内容请改用带 offset/limit 的分块读取。]`;
    return { output: text, enveloped: false, reason: 'truncated', budget, budgetSource, originalChars: redacted.length };
  }

  try {
    const artifact = writeToolArtifact({
      workspacePath: opts.workspacePath,
      sessionId: opts.sessionId,
      toolName: opts.call.name,
      content: redacted,
    });
    const envelope = buildEnvelope({
      toolName: opts.call.name,
      artifact,
      totalLines,
      budgetChars: budget.maxChars,
      preview,
      sourcePath,
    });
    opts.tracker?.recordFromEnvelope(
      {
        toolName: opts.call.name,
        artifactPath: artifact.relativePath,
        sourcePath,
        totalChars: redacted.length,
        totalLines,
        budgetChars: budget.maxChars,
        previewChars: preview.length,
        preview,
      },
      opts.turn ?? 0,
    );
    return {
      output: envelope,
      enveloped: true,
      reason: 'applied',
      artifactPath: artifact.relativePath,
      budget,
      budgetSource,
      originalChars: redacted.length,
    };
  } catch {
    // 落盘失败(只读盘/权限):退回原文并如实报 reason —— 绝不静默丢结果
    recordRead(opts, redacted, { enveloped: false, originalChars: redacted.length });
    return {
      output: redacted,
      enveloped: false,
      reason: 'persist-failed',
      budget,
      budgetSource,
      originalChars: redacted.length,
    };
  }
}

/**
 * 统一记账入口:无论是否信封化,"这个工具读过这个路径"都要留在跟踪器里,
 * 否则压缩后重建提醒时会漏掉只以正文形态存在过的那些文件。
 */
function recordRead(
  opts: Parameters<typeof envelopeToolResult>[0],
  text: string,
  meta: { enveloped: boolean; originalChars: number },
): void {
  if (!opts.tracker) return;
  const envelope = meta.enveloped ? parseEnvelope(text) : null;
  if (envelope) {
    // 已封装过的结果(重放 / 恢复):按信封里的结构化字段记账,不再重新生成信封
    opts.tracker.recordFromEnvelope(envelope, opts.turn ?? 0);
    return;
  }
  opts.tracker.recordToolCall({
    toolName: opts.call.name,
    args: opts.call.arguments,
    output: text.slice(0, 400),
    turn: opts.turn ?? 0,
    enveloped: false,
    originalChars: meta.originalChars,
    originalLines: text.split('\n').length,
  });
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
