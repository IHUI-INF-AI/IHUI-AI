// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 记忆写入触发策略 — 判断「这一轮对话是否值得沉淀为长期记忆」。
 *
 * 设计约束:
 *   - 纯启发式:只读 signals,不发网络、不读盘、不依赖时钟,便于在退出钩子里无副作用调用。
 *   - 只会「建议写」,不直接写盘:真正的落盘仍由 dream/退出钩子异步完成,避免会话热路径同步 IO。
 *   - 负例优先:寒暄、纯查询、工具失败但未修复这类轮次不应污染长期记忆。
 */

export const MEMORY_TRIGGER_KINDS = [
  'decision',
  'correction',
  'convention',
  'root-cause',
  'preference',
  'explicit-remember',
] as const;

export type MemoryTriggerKind = (typeof MEMORY_TRIGGER_KINDS)[number];

export interface MemoryToolCall {
  name: string;
  ok: boolean;
}

export interface MemoryTurnSignals {
  userText: string;
  assistantText: string;
  toolCalls: MemoryToolCall[];
  filesChanged: string[];
  /** 用户是否明确纠正了上一轮(由上层对话回路判定,缺省时回落到文本启发式) */
  userCorrected?: boolean;
  /** 用户是否明确要求「记住」(由上层显式指令解析判定) */
  explicitRemember?: boolean;
  /** 会话内轮次序号,从 1 开始 */
  turnOrdinal: number;
}

export interface MemoryWriteDecision {
  shouldWrite: boolean;
  triggers: MemoryTriggerKind[];
  reason: string;
}

export interface MemoryTriggerThresholds {
  minFilesChanged?: number;
  minTextLength?: number;
}

/**
 * 最少改动文件数:2。
 * 理由:单文件修复大多是局部笔误,重复遇到时直接重跑即可;跨 ≥2 个文件的改动才更可能
 * 携带「项目结构/接口约定」这类可复用信息,值得占用长期记忆预算。
 */
export const DEFAULT_MIN_FILES_CHANGED = 2;

/**
 * 最短文本长度:24 字符。
 * 理由:短于 24 字的轮次绝大多数是寒暄、确认、单句查询(「你好」「在哪」「继续」),
 * 信息密度不足以形成可复用记忆;达到这个长度才像一个完整的决策/约定/根因陈述。
 * 偏好、纠错、明确要求记住属于强信号,不受此门槛限制。
 */
export const DEFAULT_MIN_TEXT_LENGTH = 24;

/** 决策落定:明确结论(选了哪个方案、按什么做),而不是还在比较 */
const DECISION_PATTERN =
  /决定|确定采用|方案(定为|确定为)|就按|采用方案|选型|最终选用|decided|going with|settle on/;

/** 用户纠错:否定上一轮并给出正确做法 */
const CORRECTION_PATTERN = /不对|不是这样|错了|搞错|应该是|应当|纠正|改回|我说的是|should be|that'?s wrong/;

/** 项目约定:跨轮次必须遵守的规则 */
const CONVENTION_PATTERN = /约定|规范|统一(用|使用|采用)|一律|必须|禁止|不准|always use|never use|convention/;

/** 可复用根因:失败之后定位原因并修复 */
const ROOT_CAUSE_PATTERN = /根因|原因(是|在于)|修复|解决|fixed|root cause|resolved/;

/** 用户偏好:稳定的个人倾向 */
const PREFERENCE_PATTERN = /我喜欢|我更喜欢|我偏好|我的习惯|习惯用|prefer|i like|i'd rather|i prefer/;

/** 明确要求记住:用户直接下达的记忆指令 */
const EXPLICIT_PATTERN = /记住|记下|记一下|别忘了|请记得|以后都|remember (this|that)|note (this|that) down/;

/** 工具失败后是否出现过成功调用(失败→修复的最简证据链) */
function hasSuccessAfterFailure(calls: readonly MemoryToolCall[]): boolean {
  let failed = false;
  for (const call of calls) {
    if (!call.ok) {
      failed = true;
      continue;
    }
    if (failed) return true;
  }
  return false;
}

/**
 * 评估一轮对话的记忆写入触发。
 *
 * 触发类别固定按 MEMORY_TRIGGER_KINDS 声明顺序输出,保证同一 signals 得到同一结果。
 */
export function evaluateMemoryWriteTriggers(
  signals: MemoryTurnSignals,
  thresholds: MemoryTriggerThresholds = {},
): MemoryWriteDecision {
  const minFilesChanged = thresholds.minFilesChanged ?? DEFAULT_MIN_FILES_CHANGED;
  const minTextLength = thresholds.minTextLength ?? DEFAULT_MIN_TEXT_LENGTH;

  const userText = signals.userText.normalize('NFKC');
  const userLower = userText.toLowerCase();
  const combined = `${signals.userText}\n${signals.assistantText}`.normalize('NFKC');
  const combinedLower = combined.toLowerCase();
  const textLength = combined.replace(/\s+/g, ' ').trim().length;

  const fileCount = new Set(signals.filesChanged.map((file) => file.trim()).filter(Boolean)).size;
  const hasFailure = signals.toolCalls.some((call) => !call.ok);
  const repaired = hasSuccessAfterFailure(signals.toolCalls);

  // 弱信号需要足够长的文本支撑;强信号(偏好/纠错/明确记住)跳过长度门槛。
  const weakAllowed = textLength >= minTextLength;

  const triggers: MemoryTriggerKind[] = [];

  if (weakAllowed && DECISION_PATTERN.test(combinedLower)) triggers.push('decision');
  if (signals.userCorrected === true || CORRECTION_PATTERN.test(userLower)) triggers.push('correction');
  if (weakAllowed && CONVENTION_PATTERN.test(combinedLower)) triggers.push('convention');
  if (weakAllowed && repaired && fileCount >= minFilesChanged && ROOT_CAUSE_PATTERN.test(combinedLower)) {
    triggers.push('root-cause');
  }
  if (PREFERENCE_PATTERN.test(userLower)) triggers.push('preference');
  if (signals.explicitRemember === true || EXPLICIT_PATTERN.test(userLower)) triggers.push('explicit-remember');

  if (triggers.length > 0) {
    return {
      shouldWrite: true,
      triggers,
      reason: `命中写入触发: ${triggers.join(',')}${triggers.length > 1 ? '(多信号叠加)' : ''}`,
    };
  }

  if (textLength < minTextLength) {
    return {
      shouldWrite: false,
      triggers,
      reason: `未命中:去掉空白后仅 ${textLength} 字,低于 ${minTextLength} 字门槛(疑似寒暄/确认)`,
    };
  }
  if (hasFailure && !repaired) {
    return {
      shouldWrite: false,
      triggers,
      reason: '未命中:工具调用失败后没有成功调用,失败未修复的轮次不沉淀',
    };
  }
  return {
    shouldWrite: false,
    triggers,
    reason: '未命中:没有决策/纠错/约定/根因/偏好/记忆指令,寒暄或纯查询不写',
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
