// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/lib/conflict-marker-triples.mjs —— Git 冲突标记「配对判据 + 剥三行」的**唯一实现**。
 *
 * 为什么要有这一层(2026-09-28 立,由 `scripts/union-converge.mjs` 的一处死循环逼出):
 * 「成对标记」这件事现在有**三个**消费者:
 *   ① 守门 `check-no-conflict-markers.mjs`(判红 —— 成对标记进 HEAD 就是事故);
 *   ② `scripts/archive-completed-tasks.mjs`(搬运前问一句"这块里还有没解的标记吗");
 *   ③ `scripts/union-converge.mjs`(活文档并集出口 —— 见下面那条死循环)。
 * 一份判据三处各写一遍必漂,是本仓记过最多次的失败型(守门 131/135/144 各把 `code-mask` 收过一次性)。
 *
 * ③ 那一格的形状(实测两次,2026-09-28 同日):活文档里存在成对的 `<<<<<<< ours` / `=======` /
 * `>>>>>>> theirs` 三行 ⇒ 守门 79 在 `--rev HEAD` 上判红 ⇒ 有人手工把三行删掉并前向提交;
 * 而下一枚并集合并把"对侧那一版仍带着这三行"的内容按行 union 补回来(删除不随合并传播是本工具的
 * 既定设计),红就原地复活。**手工清偿在这条链路上是徒劳的** —— 必须在并集出口把三行滤掉。
 *
 * 判序与边界(照此理解,别放宽也别收紧):
 *  - **只剥成套的三行**:`^<<<<<<< ` 开头行 + 其后第一个逐字等于 `=======` 的行 + 再其后第一个
 *    `^>>>>>>> ` 结尾行。中间的**内容行一律保留** —— 这就是"合并结果保留双方内容",与行并集的
 *    语义一致(并集本来就把两侧内容都收下,只是把 git 写给机器看的分节线也一起并了进来)。
 *  - **单独一行 `=======` 永远不剥**:它在 Markdown setext 标题下划线、表格分隔、ASCII 示意图里
 *    都是合法内容(守门 79 的 P2 就是为此强制成对)。
 *  - **只找到开头、找不到结尾 ⇒ 不猜**:整份内容原样返回,并把该路径点名成"需人工"。
 *    历史上"选边删标记"正是把两侧内容之一静默丢掉的成因;这一型宁可停手。
 *    嵌套(未闭合又遇 `<<<<<<< `)按同一规矩归入"需人工"。
 *  - **成对但中间没有 `=======`** 同样不剥、判"需人工" —— 它不是上面那一种三行形态,
 *    少剥/多剥一行都会改变内容(守门 79 对它判红,但对"该删哪几行"没有给我可辩护的答案)。
 *  - **SEARCH/REPLACE 补丁格式**是合法内容(`apps/cli/src/tools/file-edit.ts` 的 patch 语法与之同形),
 *    由 `findMarkerPairs` 归进 `exempt` 而不是 `pairs` ⇒ 本函数一律不动它。
 *  - **孤立 `>>>>>>> `(无开头)只报名、不阻断**:真仓 HEAD 面上就有一处这样的合法内容
 *    (`apps/cli/tests/file-edit.test.ts` 的夹具尾巴)。守门 79 对它不计红,本函数若因此拒绝落地,
 *    就是一台与任何内容都无关的恒红门(AGENTS §12e/§12f 同型),所以只逐条报名。
 *
 * 全程纯函数:不派生 git、不读盘 —— 被审内容由调用方取(守门 118 的取材面纪律)。
 */

export const OPEN_RE = /^<<<<<<< /
export const SEP_RE = /^=======$/
export const END_RE = /^>>>>>>> /
/**
 * E1 合法豁免:SEARCH/REPLACE 补丁格式与 git 标记的字形**完全同形** —— 标记后面跟的也是
 * "标签"(HEAD / 分支 / sha),语法上无法区分,只能按标签白名单放行。
 * 依据不是猜的:本仓 CLI 的 patch 解析器就定义在 `apps/cli/src/tools/file-edit.ts` 的
 * `SEARCH_REPLACE_REGEX`(匹配 `<<<<<<< SEARCH\n…\n=======\n…\n>>>>>>> REPLACE`),且
 * `apps/cli/tests/file-edit.test.ts` 有按行首原样书写的夹具 —— 不放行会让判据对合法测试内容恒红。
 * 放宽仅限**两端标签都精确等于 SEARCH / REPLACE** 的这一对;`<<<<<<< HEAD` 配 `>>>>>>> REPLACE`
 * 这类混搭一律不豁免(真 merge 不会有 SEARCH 端)。
 */
export const PATCH_OPEN = /^<<<<<<< SEARCH$/
export const PATCH_CLOSE = /^>>>>>>> REPLACE\b/

export function isPatchFormatPair(openText, closeText) {
  return PATCH_OPEN.test(String(openText ?? '')) && PATCH_CLOSE.test(String(closeText ?? ''))
}

/**
 * 核心配对判据(行号 1 基)。`sepLine` 是该对内部**第一条**整行 `=======`,可能为 null;
 * 嵌套按"前一个进未配对、以后者重新开对"处理,不会漏掉后一对。
 */
export function findMarkerPairs(text) {
  const lines = String(text ?? '').split(/\r?\n/)
  const pairs = []
  const exempt = []
  const unpairedStarts = []
  const unpairedEnds = []
  let open = null
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const no = i + 1
    if (OPEN_RE.test(line)) {
      if (open) unpairedStarts.push(open)
      open = { line: no, text: line, sepLine: null }
      continue
    }
    if (END_RE.test(line)) {
      if (open) {
        const pair = {
          startLine: open.line,
          startText: open.text,
          sepLine: open.sepLine,
          endLine: no,
          endText: line,
        }
        if (isPatchFormatPair(open.text, line)) exempt.push(pair)
        else pairs.push(pair)
        open = null
      } else {
        unpairedEnds.push({ line: no, text: line })
      }
      continue
    }
    if (open && open.sepLine === null && SEP_RE.test(line)) open.sepLine = no
  }
  if (open) unpairedStarts.push(open)
  return { pairs, unpairedStarts, unpairedEnds, exempt }
}

/**
 * 从文本里剥掉**成套**的冲突标记三行,保留两侧内容行。
 *
 * 返回:
 *   text        剥完的结果(manual 非空时**逐字等于输入** —— 宁可不剥,绝不猜)
 *   stripped    剥掉的三行组数
 *   removed     被剥行的多重集 `行文本 → 条数`(调用方的"零丢失断言"要按它放宽期望重数)
 *   manual      非空 ⇒ 这一份内容里有本函数**不敢**剥的形态,必须交人工(逐条报名)
 *   orphanEnds  孤立 `>>>>>>> `(只报名不阻断;非空不影响 stripped)
 *   exempt      被认作 SEARCH/REPLACE 合法补丁格式的对数(一律不动)
 */
export function stripMarkerTriples(text) {
  const src = String(text ?? '')
  const { pairs, unpairedStarts, unpairedEnds, exempt } = findMarkerPairs(src)
  const lines = src.split('\n')
  const manual = []
  for (const u of unpairedStarts)
    manual.push(`第 ${u.line} 行只有开头 ${JSON.stringify(u.text.slice(0, 40))},找不到配对的 >>>>>>> 结尾 ⇒ 不剥`)
  for (const p of pairs)
    if (!p.sepLine)
      manual.push(
        `第 ${p.startLine}–${p.endLine} 行成对但中间没有整行 ======= ⇒ 不是可辩护的三行形态,不剥`,
      )
  const empty = { text: src, stripped: 0, removed: new Map(), manual, orphanEnds: unpairedEnds, exempt: exempt.length }
  if (manual.length > 0) return empty
  if (pairs.length === 0) return empty
  // pairs 由 findMarkerPairs 顺序产出,天然不重叠(一对收口后才重新开对)。
  const drop = new Set()
  const removed = new Map()
  for (const p of pairs) {
    for (const n of [p.startLine, p.sepLine, p.endLine]) {
      if (n === null || n === undefined || drop.has(n)) continue
      drop.add(n)
      const l = lines[n - 1]
      removed.set(l, (removed.get(l) || 0) + 1)
    }
  }
  const kept = lines.filter((_, i) => !drop.has(i + 1))
  return {
    text: kept.join('\n'),
    stripped: pairs.length,
    removed,
    manual,
    orphanEnds: unpairedEnds,
    exempt: exempt.length,
  }
}

/** 供 §22c 镜像测试与调用方使用的导出锚点。 */
export const __test__ = {
  OPEN_RE,
  SEP_RE,
  END_RE,
  PATCH_OPEN,
  PATCH_CLOSE,
  isPatchFormatPair,
  findMarkerPairs,
  stripMarkerTriples,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
