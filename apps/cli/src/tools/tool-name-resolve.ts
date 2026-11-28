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

/** 归一化:小写 + 去掉所有非字母数字。`Git_Merge` / `git-merge` / `git.merge` 同键。
 *
 * 注意:这一层**刻意不剥命名空间**——`git.merge` 这种用点号替代下划线的写法,
 * 整串归一正好等于 `gitmerge`,剥了反而丢信息。剥包装见 `stripToolNameWrapper`。
 */
export function normalizeToolName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * 剥掉**传输层包装**(2026-11-28 扩):OpenAI 回放写成 `functions.git_merge`,
 * MCP 桥写成 `mcp__ihui__git_merge`,本地 CLI 写成 `cli.git_merge`,某些封装再挂 `_tool` 尾巴。
 * 这些都不是语义,是传输层加的;注册表里的名字都不含 `.`/`mcp__`/`_tool`,
 * 所以剥离只可能落在同一工具上。
 *
 * 分两档,是因为 `functions.foo_tool` 这种"命名空间 + 后缀"叠在一起时:
 * 只剥命名空间得到 `foo_tool`(应命中 `foo_tool`),连后缀一起剥得到 `foo`(会误命中 `foo`)。
 * 档位顺序保证先窄后宽。
 *
 * @param keepSuffix true = 只剥命名空间,保留 `_tool` 后缀
 */
export function stripToolNameWrapper(name: string, keepSuffix = false): string {
  let text = name.trim().toLowerCase();
  if (text.includes('.')) text = text.slice(text.lastIndexOf('.') + 1);
  if (text.startsWith('mcp__')) text = text.slice(text.lastIndexOf('__') + 2);
  if (!keepSuffix && text.endsWith('_tool')) text = text.slice(0, -'_tool'.length);
  return text.replace(/[^a-z0-9]/g, '');
}

/**
 * 在候选名里找与 `name` 只差格式的那一个。
 *
 * @returns 唯一命中的注册名;精确命中直接返回原名;歧义或无命中返回 undefined。
 */
export function resolveToolName(name: string, candidates: readonly string[]): string | undefined {
  if (name === '') return undefined;
  if (candidates.includes(name)) return name;
  // 先窄后宽:整串 → 只剥命名空间 → 连 `_tool` 一起剥。同档多枚才算歧义。
  const keys = Array.from(
    new Set(
      [normalizeToolName(name), stripToolNameWrapper(name, true), stripToolNameWrapper(name)].filter(
        (key) => key !== '',
      ),
    ),
  );
  for (const key of keys) {
    const hits = candidates.filter((candidate) => normalizeToolName(candidate) === key);
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return undefined;
  }
  return undefined;
}

/** 有界编辑距离:只回答「≤ max 的最近距离」,超过即返回 max+1(不做全局最优)。 */
function boundedEditDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min((prev[j - 1] ?? 0) + cost, (prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1);
      row.push(value);
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    prev = row;
  }
  const dist = prev[b.length] ?? max + 1;
  return dist > max ? max + 1 : dist;
}

/** 名字相似度打分(只用于"没找到，给你几个近名"的建议，不用于执行)。
 *
 * 2026-11-28 补错拼档:模型把 `lsp_goto_definition` 写成 `lsp_goto_efinition`、
 * `memory_recall` 写成 `memoryxrecall` 时,旧的整词/子串/词前缀三档全部 0 分 ⇒ 建议为空,
 * 模型当场没有可改对的落点。这里按归一化键的编辑距离补两档(距离 1 → 4.5,距离 2 → 3.5),
 * 只影响建议列表,**绝不**据此自动执行。
 */
function similarityScore(queryKey: string, candidate: string): number {
  const key = normalizeToolName(candidate);
  if (key === '') return 0;
  if (key === queryKey) return 5;
  const dist = boundedEditDistance(queryKey, key, 2);
  if (dist === 1) return 4.5;
  if (key.startsWith(queryKey) || queryKey.startsWith(key)) return 4;
  if (dist === 2) return 3.5;
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
  const queryKey = stripToolNameWrapper(name);
  if (queryKey === '') return [];
  return candidates
    .map((candidate) => ({ candidate, score: similarityScore(queryKey, candidate) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.localeCompare(b.candidate))
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.candidate);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
