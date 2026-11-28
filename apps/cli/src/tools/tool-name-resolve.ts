// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具名解析 —— 只消**格式差异**，不做**语义映射**。
 *
 * 立因:模型发来的工具名并不总是注册表里的那一串。真实观测到的形态有
 * `GitMerge`(驼峰)、`git-merge`(连字符)、`readFile`、`git_merge `(尾随空格)——
 * 这些和注册名是同一个工具，只是拼写形态不同。旧实现 `getTool(call.name)` 精确
 * 匹配，差一个大小写就回 `未知工具`，白烧一整轮。
 *
 * 边界(必须钉住):
 *   ① 精确名永远优先;归一化只在精确失败后兜底。
 *   ② 归一化后命中多枚 ⇒ 判**歧义**，返回 undefined —— 猜一个执行比报错更坏。
 *   ③ 不做跨词映射(Read→read_file、Bash→run_command 一律不认):那是语义猜测，
 *      猜错会执行模型没要的工具。这类近名只给**建议**，由模型自己重发。
 */

/** 归一化:小写 + 去掉所有非字母数字。`Git_Merge` / `git-merge` / `git merge` 同键。 */
export function normalizeToolName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * 在候选名里找与 `name` 只差格式的那一个。
 *
 * @returns 唯一命中的注册名;精确命中直接返回原名;歧义或无命中返回 undefined。
 */
export function resolveToolName(name: string, candidates: readonly string[]): string | undefined {
  if (name === '') return undefined;
  if (candidates.includes(name)) return name;
  const key = normalizeToolName(name);
  if (key === '') return undefined;
  const hits = candidates.filter((candidate) => normalizeToolName(candidate) === key);
  // 归一化后仍可能撞车(如 foo_bar 与 foobar):多枚即歧义,不替模型选。
  return hits.length === 1 ? hits[0] : undefined;
}

/** 名字相似度打分(只用于"没找到，给你几个近名"的建议，不用于执行)。 */
function similarityScore(queryKey: string, candidate: string): number {
  const key = normalizeToolName(candidate);
  if (key === '') return 0;
  if (key === queryKey) return 5;
  if (key.startsWith(queryKey) || queryKey.startsWith(key)) return 4;
  if (key.includes(queryKey) || queryKey.includes(key)) return 3;
  // 词级前缀:query "read" vs candidate "read_file" 已由上面覆盖;
  // 这里兜 "file" vs "write_file" 这类整词命中。
  const tokens = candidate.toLowerCase().split(/[_\-.]/).filter((token) => token.length > 0);
  return tokens.some((token) => token.startsWith(queryKey)) ? 2 : 0;
}

/** 未知工具时给模型的可执行建议(最多 `limit` 个，按相似度降序、同分按名字升序)。 */
export function suggestToolNames(
  name: string,
  candidates: readonly string[],
  limit = 3,
): string[] {
  const queryKey = normalizeToolName(name);
  if (queryKey === '') return [];
  return candidates
    .map((candidate) => ({ candidate, score: similarityScore(queryKey, candidate) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.localeCompare(b.candidate))
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.candidate);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
