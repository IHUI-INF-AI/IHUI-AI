// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具输出预算表 —— "哪个工具最多允许往上下文里回灌多少字符"的唯一声明处。
 *
 * 存在理由:一次 `git diff` 或一条命令输出可能有几百 KB,整段进上下文会
 * ① 立刻吃掉大半窗口、② 让压缩器为"一段早就没用的原始输出"反复花摘要调用。
 * 预算超限的结果**不得整段进上下文**,改由 result-envelope 落盘 + 回灌信封。
 *
 * 为什么是一张表而不是给每个 Tool 加字段:
 *   - `src/tools/index.ts` 的 `Tool` 接口是多会话共享文件,加工具字段会牵动
 *     全部工具模块与 hub 适配层;本表把"预算"这件事收在结果回灌边界上,
 *     工具侧要声明就调 `declareToolOutputBudget()`(注册期调用,无耦合)。
 *   - 默认档必须存在:未知工具(MCP / 插件)同样可能吐出巨型结果,
 *     "没登记 = 不限"等于没有这道约束。
 */

/** 单个工具的输出预算 */
export interface ToolOutputBudget {
  /** 允许直接进上下文的最大字符数;超过即落盘 + 改回灌信封 */
  maxChars: number;
  /** 信封里保留的预览字符数(前 K 字符) */
  previewChars: number;
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

/** 预算表快照(诊断 / 测试用,按工具名排序) */
export function listToolOutputBudgets(): Array<{ toolName: string; budget: ToolOutputBudget }> {
  return [...BUDGETS.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([toolName, budget]) => ({ toolName, budget: { ...budget } }));
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
