// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 工具结果预算信封 —— 结果回灌上下文前的那道“体积闸”。
 *
 * 一句话职责:超过预算的工具结果**不得整段进上下文**,改为
 *   ① 原文落盘到项目内会话产物目录 → ② 回灌“路径 + 前 K 字符预览 + 已截断说明”的信封。
 *
 * 与压缩链的分工:
 *   - 本模块管**入口**(结果第一次进 messages 时);
 *   - `@ihui/context-compaction` 的 reclaim/摘要管**存量**(历史里的结果体)。
 *   两者靠 `isEnvelopeContent()` 这条识别通道对齐:已封装的结果不再二次封装,
 *   信封里的预览也不会被当正文再压一遍。
 *
 * W4-12 起本文件只负责编排:落盘交给 `SpillStore`,换信封交给 `SpillPolicy`;
 * 默认实现仍保持原信封契约不变。
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
import { takePreview, isEnvelopeContent } from './envelope.js';
import { recordEnvelopeRead } from './envelope-read-record.js';
import { extractPathArg, type ReadStateTracker } from './read-state.js';
import { FileSpillStore, type SpillRef, type SpillStore } from './spill-store.js';
import { BudgetSpillPolicy, type SpillPolicy, type SpillPolicyInput } from './spill-policy.js';

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
  /** 落盘引用(仅信封化时有值);带 sha256/bytes/expiresAt,W4-12 */
  spillRef?: SpillRef;
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
 * (`noteContractBudgetGap`),不允许“写了契约但静默按默认档跑”。
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
  /** 注入存储(W4-12);缺省走项目内文件实现 */
  spillStore?: SpillStore;
  /** 注入替换策略(W4-12);缺省走 BudgetSpillPolicy */
  spillPolicy?: SpillPolicy;
  /** 固定 now(测试) */
  spillNow?: number;
  /** 保存时统一 TTL(ms) */
  spillTtlMs?: number;
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
  const resultPolicy: ToolResultBudgetContract['policy'] = projected?.policy ?? 'artifact';
  const raw = typeof opts.result.output === 'string' ? opts.result.output : '';
  const redacted = redactSecrets(raw);

  if (isEnvelopeContent(redacted)) {
    recordEnvelopeRead(opts, redacted, { enveloped: true, originalChars: redacted.length });
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
    recordEnvelopeRead(opts, redacted, { enveloped: false, originalChars: redacted.length });
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
  const spillPolicy = opts.spillPolicy ?? new BudgetSpillPolicy();
  const policyInput: SpillPolicyInput = {
    text: redacted,
    budgetChars: budget.maxChars,
    previewChars: budget.previewChars,
    totalLines,
    toolName: opts.call.name,
    sourcePath,
    mode: resultPolicy,
  };
  const plan = spillPolicy.plan(policyInput);

  if (plan.kind === 'keep') {
    recordEnvelopeRead(opts, redacted, { enveloped: false, originalChars: redacted.length });
    return {
      output: redacted,
      enveloped: false,
      reason: 'within-budget',
      budget,
      budgetSource,
      originalChars: redacted.length,
    };
  }
  if (plan.kind === 'truncate') {
    // 契约明说“截掉即可”,没有产物可回捞 —— 所以既不写盘、也不给一个不存在的路径。
    return {
      output: plan.text,
      enveloped: false,
      reason: 'truncated',
      budget,
      budgetSource,
      originalChars: redacted.length,
    };
  }

  const fixedNow = opts.spillNow;
  try {
    const store =
      opts.spillStore ??
      new FileSpillStore({
        workspacePath: opts.workspacePath,
        sessionId: opts.sessionId,
        ...(fixedNow === undefined ? {} : { now: () => fixedNow }),
        ...(opts.spillTtlMs === undefined ? {} : { ttlMs: opts.spillTtlMs }),
      });
    const ref = store.saveText({
      text: redacted,
      toolName: opts.call.name,
      ...(fixedNow === undefined ? {} : { now: fixedNow }),
    });
    const envelope = spillPolicy.render(ref, policyInput);
    opts.tracker?.recordFromEnvelope(
      {
        toolName: opts.call.name,
        artifactPath: ref.locator,
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
      artifactPath: ref.locator,
      spillRef: ref,
      budget,
      budgetSource,
      originalChars: redacted.length,
    };
  } catch {
    // 落盘失败(只读盘/权限):退回原文并如实报 reason —— 绝不静默丢结果
    recordEnvelopeRead(opts, redacted, { enveloped: false, originalChars: redacted.length });
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
