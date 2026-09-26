// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { frameSystemReminder } from './utils/prompt-boundary.js';
import { injectReminderSection, recordInjectionSkipped, renderInjectionNotice } from './utils/prompt-injection-registry.js';

/**
 * P1-2 Reminders 系统提醒自动注入。
 *
 * 灵感来源:参考行业 Agent 框架的 reminders 设计(task_completion / skill_discovery / lsp_diagnostics)。
 * 问题:LLM 在长任务中可能"迷失方向"——不知道上下文快满了 / 迭代预算快用完了 / 连续失败需要换方案。
 * 参考行业 Agent 框架在工具执行后自动向 prompt 注入 system reminders,让 LLM 被动接收关键状态信息。
 *
 * 简化策略(做减法):
 *   - 不实现 LSP 自动诊断(代价大,LLM 可主动调 diagnostics 工具)
 *   - 不实现技能发现提醒(启动时已注入 system prompt)
 *   - 不实现 background task 完成提醒(需 background task 完成回调,代价大)
 *   - 实现 3 项高价值 reminder:context budget / iteration progress / tool failure pattern(已有)
 *
 * 注入点:runToolLoop 每轮迭代的工具结果 push 后,把 reminder 追加到 resultParts。
 * 语义:reminder 作为 user 消息的一部分,LLM 下一轮会看到。
 */

export interface ReminderContext {
  /** 当前迭代轮次(1-based) */
  iterations: number;
  /** 最大迭代轮次 */
  maxIterations: number;
  /** 累计 prompt tokens */
  totalPromptTokens: number;
  /** 累计 completion tokens */
  totalCompletionTokens: number;
  /** 上下文窗口大小(tokens) */
  contextLimit: number;
  /** 已注入过的 reminder 类型(避免重复注入,跨迭代持久化) */
  injected: Set<string>;
}

/** 70% 阈值提醒(与 88% 强制压缩互补,跨端统一阈值) */
const CONTEXT_BUDGET_THRESHOLD = 0.7;
/** 每 5 轮迭代提醒一次进度 */
const ITERATION_PROGRESS_INTERVAL = 5;

/**
 * 生成系统提醒。返回应追加到当前轮 resultParts 的 reminder 字符串数组。
 * 副作用:会把已注入的 reminder 类型加入 ctx.injected(避免下一轮重复注入)。
 *
 * 产出必须经 `frameSystemReminder`(唯一出口):裸 `[系统提醒]` 前缀是纯文本,
 * 工具输出里出现同样字样时模型无从分辨是谁在说话,所以提醒必须是**带 kind 的结构块**。
 */
export function generateReminders(ctx: ReminderContext): string[] {
  const reminders: string[] = [];

  // 1. context budget reminder(70% 阈值,只注入一次)
  const totalTokens = ctx.totalPromptTokens + ctx.totalCompletionTokens;
  if (
    !ctx.injected.has('context_budget')
    && ctx.contextLimit > 0
    && totalTokens >= ctx.contextLimit * CONTEXT_BUDGET_THRESHOLD
  ) {
    const pct = Math.round((totalTokens / ctx.contextLimit) * 100);
    reminders.push(
      injectReminderSection(
        'reminder_context_budget',
        frameSystemReminder(
          'context_budget',
          `上下文窗口已用 ${pct}%(tokens ${totalTokens}/${ctx.contextLimit})。建议尽快收尾,或用 /compact 手动压缩。达 88% 将自动压缩。`,
        ),
      ),
    );
    ctx.injected.add('context_budget');
  } else {
    recordInjectionSkipped(
      'reminder_context_budget',
      ctx.injected.has('context_budget') ? '本会话已注入过' : '未达阈值',
    );
  }

  // 2. iteration progress reminder(每 5 轮提醒,最后一轮不提醒)
  if (
    ctx.iterations > 0
    && ctx.iterations < ctx.maxIterations
    && ctx.iterations % ITERATION_PROGRESS_INTERVAL === 0
  ) {
    const remaining = ctx.maxIterations - ctx.iterations;
    reminders.push(
      injectReminderSection(
        'reminder_iteration_progress',
        frameSystemReminder(
          'iteration_progress',
          `已完成 ${ctx.iterations}/${ctx.maxIterations} 轮迭代(剩余 ${remaining} 轮)。请评估当前进度,若接近目标请加快收尾,若卡住请考虑换方案。`,
        ),
      ),
    );
  } else {
    recordInjectionSkipped('reminder_iteration_progress', '未到进度档位');
  }

  // 未注入必须可见:本轮任何登记项落空都留一行计数 —— 没有它,"提示变短了"只对读代码的人成立
  // (与 §5e「失败必须响」、守门 77「绝不静默成看起来全绿」是同一条禁令)。
  const notice = renderInjectionNotice();
  if (notice !== '') reminders.push(notice);

  return reminders.filter((line) => line !== '');
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
