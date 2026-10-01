// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Python `str.splitlines()` 口径的行切分与「行改动统计」 —— 前端复刻后端 llm.py 的唯一实现。
 *
 * 立因(G-415 A9,2026-10-01):这份口径此前抄在
 * `apps/web/src/components/ai/progress-sections/tool-call-summary-card.tsx` 的模块体内,
 * 注释自称「复刻后端 ai-service/app/routers/llm.py calculate_added_lines 的口径」,
 * 但**没有任何东西校验它**。现读对照(同一份语料分别喂给两边、Python 侧真求值):
 * `\x1c` `\x1d` `\x1e` 三个行边界码位在 JS 侧漏抄 ⇒ `a\x1cb` Python 得 2 行、JS 得 1 行。
 * 症状是「后端没发 tool-summary、前端本地降级聚合」那一条路径上,用户看到的
 * 「改了多少行」比后端算的少,而 typecheck / lint / 其余门全都不响。
 *
 * 现在这份实现只留这一处,由 `scripts/check-line-split-parity.mjs` 逐例对真 Python
 * 求值复核 —— 「复刻」这个承诺从此是机器判的,不是散文写的。
 *
 * 口径(显式写清,不得糊成一团):
 * - 换行族:CPython `str.splitlines()` 的**全部 11 个**边界 ——
 *   `\n` `\r\n` `\r` `\v`(U+000B) `\f`(U+000C) `\x1c` `\x1d` `\x1e`
 *   `\x85`(NEL) `\u2028`(LSP) `\u2029`(PSP)。`|` 分支顺序敏感:`\r\n` 必须排在 `\r` 前,
 *   否则 CRLF 被算成两行。
 * - **末尾换行不另计一行**:`'a\n'` → 1 行(与 `'a'` 同值)。这是 Python 语义,不是本模块的偏好。
 * - **空串 → 0 行**;单独一个换行符 → 1 行(切出 `['','']` 再摘掉末尾那个空段)。
 * - 「数全部行」与「按 unified diff 前缀数改动行」是**两个不同出口**
 *   (`pyLineCount` vs `calculateAddedLines`/`calculateDeletedLines`),不得合并成
 *   一个带布尔参数的函数。
 * - 「只数非空行」这一口径在本仓**没有消费方**,因此刻意不提供 —— 加一个没人用的出口
 *   与抄第二份实现同样危险:下一个人会把它当成「已有实现」直接引用,而它从未被任何用例验过。
 *
 * 与其余四处行切分的分工(它们数的是**不同的量**,不是同一件事抄了四份,故不并):
 * - `apps/web/src/lib/hunk-diff.ts` `splitLinesWithEol` —— diff 渲染行,必须**保留行尾符**
 *   才能原样重组,且刻意只认 `\n`/`\r\n`/`\r`(渲染层把 `\v`/`\f` 当行内空白,按它们切行会
 *   把一行显示成两行)。
 * - `apps/api/src/services/diff-service.ts` `split(/\r?\n/)` —— LCS 的输入行,**保留**末尾空行
 *   (`'a\n'` → 2 行):那一行空行代表文件以换行结尾,是 LCS 判定「新增了一个换行」的依据,
 *   与这里的 Python 语义刻意相反。
 * - `apps/ai-service/app/services/agent_deliverables.py` —— before/after 的**净行数差**
 *   (`max(0, after - before)`),不看 diff 前缀,量的是"这文件变大了几行"不是"改了几行"。
 * - `apps/ai-service/app/services/mcp_server.py` `_parse_unified_diff` —— 先按 `+++ b/` 切文件
 *   再逐行计前缀,量纲与 `calculateAddedLines` 同(改动行数)但**输入是 patch 文本**而非
 *   tool_call.args,所以不是同一份代码的两抄。
 */

/** CPython `str.splitlines()` 的行边界族(11 个)。分支顺序敏感,见头注。 */
const PY_LINE_BOUNDARY =
  /\r\n|\r|\n|\u000B|\u000C|\u001C|\u001D|\u001E|\u0085|\u2028|\u2029/

/**
 * 按 Python `str.splitlines()` 的口径切行:11 个边界都算换行,末尾换行不产生额外空行。
 *
 * 与 `String.prototype.split('\n')` 的区别不是"更严谨"这种口味判断 —— 它是
 * **后端真实语义**:llm.py 走的是 Python 的 `splitlines()`。两侧不一致时,前端降级
 * 聚合出的 `linesAdded` 会与后端聚合的那一条对不上,而两者显示在同一个位置。
 */
export function pySplitLines(text: string): string[] {
  const parts = text.split(PY_LINE_BOUNDARY)
  // Python 语义:末尾换行不产生额外空行(非 splitlines 版 JS split 会留一个尾空段)
  if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop()
  return parts
}

/** 「数全部行」出口。要按 diff 前缀数改动行请用 `calculateAddedLines`/`calculateDeletedLines`。 */
export function pyLineCount(text: string): number {
  return pySplitLines(text).length
}

/** tool_call.args 的形状:后端是 `dict[str, Any]`,前端拿到的是 `Record<string, unknown>`。 */
export type ToolCallArgs = Record<string, unknown> | undefined

/**
 * 从单个 tool_call 的 args 提取新增行数 —— 与 llm.py `calculate_added_lines` 逐条同口径:
 * - `diff` 字符串:计以 `+` 开头但非 `+++` 的行(unified diff 的 added 行)
 * - `content` 字符串:整文件写入,全部算 added(write_file)
 * - `new_string` 字符串:计行数(file_edit)
 * - 其他:0
 *
 * 分支**次序**也是口径的一部分(diff → content → new_string):同一条 args 里同时有
 * `diff` 与 `content` 时取 `diff`。改次序等于改后端,必须同步 llm.py。
 */
export function calculateAddedLines(args: ToolCallArgs): number {
  if (!args) return 0
  const diff = args['diff']
  if (typeof diff === 'string' && diff) {
    return pySplitLines(diff).filter((l) => l.startsWith('+') && !l.startsWith('+++')).length
  }
  const content = args['content']
  if (typeof content === 'string' && content) return pyLineCount(content)
  const newString = args['new_string']
  if (typeof newString === 'string' && newString) return pyLineCount(newString)
  return 0
}

/**
 * 从单个 tool_call 的 args 提取删除行数 —— 与 llm.py `calculate_deleted_lines` 逐条同口径:
 * - `diff` 字符串:计以 `-` 开头但非 `---` 的行
 * - `old_string` 字符串:计行数(file_edit)
 * - `content` 整体写入无删除 → 0
 * - 其他:0
 *
 * 注意后端这一条**没有** `content` 分支(整文件覆盖不算删除),所以它与
 * `calculateAddedLines` 不是对称的 —— 看着像漏写,实际是定稿语义,不得"顺手补齐"。
 */
export function calculateDeletedLines(args: ToolCallArgs): number {
  if (!args) return 0
  const diff = args['diff']
  if (typeof diff === 'string' && diff) {
    return pySplitLines(diff).filter((l) => l.startsWith('-') && !l.startsWith('---')).length
  }
  const oldString = args['old_string']
  if (typeof oldString === 'string' && oldString) return pyLineCount(oldString)
  return 0
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
