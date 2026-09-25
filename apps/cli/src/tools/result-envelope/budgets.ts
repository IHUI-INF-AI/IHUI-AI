// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具输出预算 —— "哪个工具最多允许往上下文里回灌多少字符"。
 *
 * 存在理由:一次 `git diff` 或一条命令输出可能有几百 KB,整段进上下文会
 * ① 立刻吃掉大半窗口、② 让压缩器为"一段早就没用的原始输出"反复花摘要调用。
 * 预算超限的结果**不得整段进上下文**,改由 result-envelope 落盘 + 回灌信封。
 *
 * 取源顺序(2026-09-26 接上契约面,见 `projectContractResultBudget`):
 *   工具**声明了** `contract.resultBudget` → 由契约投影(**声明面**在这里);
 *   未声明 → 本表的登记值;表里也没有 → 默认档。
 *   同一个键两处都有值时以声明为准,否则"写在工具旁边的预算"永远比不过远处一张表,
 *   那是本仓反复登记过的第二真相形态。
 *   (本节此前写的"为什么是一张表而不是给每个 Tool 加字段"已随 `ToolContractMount` 落地
 *    而失效:挂载位现在是契约的一部分,新工具由守门 `check-tool-contract-declared.mjs`
 *    要求声明 `resultBudget` 组,所以契约侧才是长期形态,本表退为**存量默认档**。)
 * 默认档必须存在:未知工具(MCP / 插件)同样可能吐出巨型结果,"没登记 = 不限"等于没有这道约束。
 */

import type { ToolResultBudgetContract } from '@ihui/types';

/** 单个工具的输出预算 */
export interface ToolOutputBudget {
  /** 允许直接进上下文的最大字符数;超过即落盘 + 改回灌信封 */
  maxChars: number;
  /** 信封里保留的预览字符数(前 K 字符) */
  previewChars: number;
}

/**
 * 契约按 **UTF-8 字节** 声明,而信封这一侧全程按 **字符** 计量(预览切字符、超限比长度、
 * `redactSecrets` 也是字符级)。这条换算是两边唯一的量纲桥,所以钉成具名常量而不是一处 `* 0.25`。
 *
 * 取 3 是保守档:CJK 在 UTF-8 下正好 3 字节/字,而本仓工具输出是中文正文与代码混排。
 * 除数取小了会把预算放宽(3 字节字符会换算出偏大的字符上限 ⇒ 灌进上下文的内容超出契约),
 * 取大了只会更早信封化。**方向上宁可少灌,不可打满窗口。**
 */
export const CONTRACT_BYTES_PER_CHAR = 3;

/** 预算最终从哪儿来 —— 如实标出来,免得"契约没生效"表现为静默走默认档。 */
export type BudgetSource = 'override' | 'contract' | 'table' | 'default';

export interface ProjectedContractBudget {
  budget: ToolOutputBudget;
  /** 契约声明的处置档(信封据此分支) */
  policy: ToolResultBudgetContract['policy'];
  /** 契约声明了、但运行时**没有**实现的部分 —— 逐条点名,绝不静默忽略 */
  unimplemented: string[];
}

/**
 * 默认档:24K 字符 ≈ 6K token(按 4 char/token 估)。
 * 取值依据:窗口 128K 时约占 4.7%,单次超限不至于把窗口打满,
 * 又足够容纳一次正常的 `git diff` / 测试输出,不至于把小结果信封化。
 */
export const DEFAULT_TOOL_OUTPUT_BUDGET: ToolOutputBudget = {
  maxChars: 24_000,
  previewChars: 1_200,
};

/** 预览上限:信封本身要小,否则"为了省上下文反而占更多上下文" */
const MAX_PREVIEW_CHARS = 4_000;

/**
 * 已登记的工具预算(工具名 → 预算)。
 * 只对"体积方差极大"的工具偏离默认档,其余走 DEFAULT_TOOL_OUTPUT_BUDGET。
 */
const BUDGETS = new Map<string, ToolOutputBudget>();

/** 登记/覆盖某工具的输出预算(幂等:同名后写覆盖前写) */
export function declareToolOutputBudget(toolName: string, budget: ToolOutputBudget): void {
  if (!toolName) return;
  const preview = Math.max(0, Math.min(MAX_PREVIEW_CHARS, Math.floor(budget.previewChars)));
  BUDGETS.set(toolName, { maxChars: Math.max(0, Math.floor(budget.maxChars)), previewChars: preview });
}

/** 取某工具的输出预算:已登记 → 登记值;未登记 → 默认档 */
export function resolveToolOutputBudget(toolName: string): ToolOutputBudget {
  return BUDGETS.get(toolName) ?? DEFAULT_TOOL_OUTPUT_BUDGET;
}

/** 该工具在登记表里有没有条目 —— 预算来源标注('table' vs 'default')靠它区分,不靠比默认档等值 */
export function hasDeclaredToolBudget(toolName: string): boolean {
  return BUDGETS.has(toolName);
}

/** 预算表快照(诊断 / 测试用,按工具名排序) */
export function listToolOutputBudgets(): Array<{ toolName: string; budget: ToolOutputBudget }> {
  return [...BUDGETS.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([toolName, budget]) => ({ toolName, budget: { ...budget } }));
}

// ==================== 契约投影(H5:ToolResultBudgetContract 的唯一消费出口)====================

/**
 * 把工具声明的 `resultBudget` 投影成信封用的预算。
 *
 * 只投影运行时真能兑现的字段:
 *   `policy: 'inline'`   → 不限(不信封化)。这是契约明确表达的"整段进上下文"的意愿。
 *   `policy: 'truncate'` → 超限只留预览、不落盘(见 `envelopeToolResult` 的 truncate 分支)。
 *   `policy: 'artifact'` → 超限落盘 + 回灌"路径 + 预览"信封(既有默认形态)。
 *   `providerVisibleLimitBytes` → `maxChars`;`preview.bytes` → `previewChars`(按上面量纲常量)。
 *
 * 判不出来的形态一律**沿用默认档 + 记一条缺口**,不猜、不静默。
 * `inlineLimitBytes`(内联展示阈值)归 UI 侧,不在这条回灌路径上,刻意不投影。
 */
export function projectContractResultBudget(
  rb: ToolResultBudgetContract | null | undefined,
): ProjectedContractBudget | null {
  if (!rb || typeof rb !== 'object') return null;
  const unimplemented: string[] = [];
  if (rb.preview && rb.preview.from === 'tail') {
    // 信封的预览通道只有头部切片:回"尾部预览"就是替契约做了它没要求的取舍。
    unimplemented.push('preview.from=tail');
  }
  if (rb.artifactRetention) unimplemented.push(`artifactRetention=${rb.artifactRetention}`);

  const policy = rb.policy;
  if (policy === 'inline') {
    return {
      budget: { maxChars: Number.POSITIVE_INFINITY, previewChars: 0 },
      policy,
      unimplemented,
    };
  }
  if (policy !== 'truncate' && policy !== 'artifact') {
    // 不认识的处置档:不替它决定"当 truncate 还是当 artifact"—— 那两种后果相反。
    return {
      budget: { ...DEFAULT_TOOL_OUTPUT_BUDGET },
      policy: 'artifact',
      unimplemented: [...unimplemented, `policy=${String(policy)}`],
    };
  }
  const limitBytes = rb.providerVisibleLimitBytes;
  if (typeof limitBytes !== 'number' || !Number.isFinite(limitBytes) || limitBytes < 0) {
    return {
      budget: { ...DEFAULT_TOOL_OUTPUT_BUDGET },
      policy,
      unimplemented: [...unimplemented, 'providerVisibleLimitBytes'],
    };
  }
  const previewBytes = rb.preview?.bytes;
  const previewChars =
    typeof previewBytes === 'number' && Number.isFinite(previewBytes) && previewBytes >= 0
      ? Math.max(0, Math.min(MAX_PREVIEW_CHARS, Math.floor(previewBytes / CONTRACT_BYTES_PER_CHAR)))
      : DEFAULT_TOOL_OUTPUT_BUDGET.previewChars;
  return {
    budget: { maxChars: Math.floor(limitBytes / CONTRACT_BYTES_PER_CHAR), previewChars },
    policy,
    unimplemented,
  };
}

// ==================== 未实现项台账 ====================

const contractBudgetGaps = new Map<string, string[]>();
const announcedGaps = new Set<string>();

/** 记一次"契约声明了运行时没有的字段"。每个 工具+缺口 组合只喊一行,但账始终在。 */
export function noteContractBudgetGap(toolName: string, gaps: string[]): void {
  if (gaps.length === 0) return;
  const key = toolName || '<anonymous>';
  const merged = new Set([...(contractBudgetGaps.get(key) ?? []), ...gaps]);
  contractBudgetGaps.set(key, [...merged].sort());
  for (const g of gaps) {
    const uk = `${key}::${g}`;
    if (announcedGaps.has(uk)) continue;
    announcedGaps.add(uk);
    console.warn(`[IHUI CLI] 工具 ${key} 的 resultBudget 声明了运行时未实现的 ${g},该项按未声明处理(每组合只报一次)`);
  }
}

export function listContractBudgetGaps(): Array<{ tool: string; gaps: string[] }> {
  return [...contractBudgetGaps.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([tool, gaps]) => ({ tool, gaps: [...gaps] }));
}

export function resetContractBudgetGaps(): void {
  contractBudgetGaps.clear();
  announcedGaps.clear();
}

// ==================== 内置登记 ====================

// 命令执行/终端读取:输出可以是任意大小(build/test 日志尤甚),给到默认档即可。
declareToolOutputBudget('run_command', { maxChars: 20_000, previewChars: 1_600 });
declareToolOutputBudget('run_tests', { maxChars: 20_000, previewChars: 2_400 });
declareToolOutputBudget('terminal_read', { maxChars: 20_000, previewChars: 1_600 });
declareToolOutputBudget('get_command_output', { maxChars: 20_000, previewChars: 1_600 });
// 整文件读取:超限说明文件本身巨大,预览要给足"定位用"的首屏,同时把提示指向分块读。
declareToolOutputBudget('read_file', { maxChars: 24_000, previewChars: 2_000 });
// 搜索类:命中列表的**尾部**通常比开头更有信息量,但预算仍按默认档收紧。
declareToolOutputBudget('grep', { maxChars: 16_000, previewChars: 1_200 });
declareToolOutputBudget('glob', { maxChars: 16_000, previewChars: 1_200 });
declareToolOutputBudget('list_dir', { maxChars: 16_000, previewChars: 1_200 });
// 网页/搜索/浏览器快照:正文与结构标记混排,预览留够才认得出是什么页。
declareToolOutputBudget('fetch_url', { maxChars: 20_000, previewChars: 1_600 });
declareToolOutputBudget('web_search', { maxChars: 20_000, previewChars: 1_600 });
declareToolOutputBudget('browser_snapshot', { maxChars: 20_000, previewChars: 2_000 });
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
