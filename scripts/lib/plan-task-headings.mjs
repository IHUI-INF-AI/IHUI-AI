// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

 
/**
 * PROJECT_PLAN.md「已完成条目标题」的**单一提取实现**(2026-09-26 立,G-206 同族)。
 *
 * 起因(实测,不是推测):归档器与守门 13c 各写一遍标题式子,而两边的式子都锚在
 * `###` 这一层的字面形态上 —— HEAD 面 `^### .*✅` 命中 **0 次**、`^## .*✅` 命中 **71 次**,
 * 于是归档器"每次都跑、每次扫到 0 条"而账面 exit 0。这个失效型本仓已记过至少三次
 * (AGENTS §1 G-182:/^### \[x\]/ 对 `^### [x]` 0 命中,连续 11 天静默空转)。
 * **根因是判据锚在标题的字面形态上,写法一漂判据就静默失明,而且失明表现为安静。**
 *
 * 本模块把三件事收成一个实现:
 *  1. 保护集(13c A0/A4 用):§1 条目标题粒度 = `##` 与 `###` 两级,标题含 `✅` 或 `已完成` 即算。
 *  2. 搬运集(归档器用):保护集 ∩ 含 `✅`。子集关系**由构造保证** ——
 *     `isArchivableTaskHeading` 的定义第一句就是 `isCompletedTaskHeading`,
 *     所以"搬的必是被护的"不依赖注释自觉;另由 `parseCompletedTaskBlocks` 的运行时断言兜底。
 *  3. T3 形态普查(13c 元判据用):从文档实际内容反推"存在哪些已完成标题形态"(级别 × 标记),
 *     逐形态核提取式是否覆盖 —— 它不锚任何具体形态,写法再漂也会被抓到,而不是安静。
 *
 * bullet 级 `- [x]` **不是条目标题**(§1 语义里没有这一层):本模块只如实计数
 * (`countBulletCompleted`),归档器与 13c 都必须把它报出来 —— 禁止把"看不见"洗成"确信没有"。
 *
 * 本模块是纯函数库:不读盘、不碰 git、无副作用。取材面纪律(HEAD/索引/工作树)由调用方
 * (archive-completed-tasks.mjs / check-project-plan-archive.mjs)经 scripts/lib/face-reader.mjs 保证。
 */

/** 已完成标记词表:标题里出现其一即承载"已完成"语义。T3 的普查与保护集共用这一份。 */
export const COMPLETED_MARKERS = ['✅', '已完成']

/** §1 条目粒度:只有 ## 与 ### 两级标题是"任务条目"层。h1/h4+/bullet 都不算(但必须报数)。 */
export const ENTRY_HEADING_RE = /^#{2,3} /

/** 行首 ATX 标题级别(1..6);非标题返回 0。 */
export function headingLevel(line) {
  const m = /^(#{1,6}) /.exec(line)
  return m ? m[1].length : 0
}

/** 该标题行携带的已完成标记集(可能同时带 ✅ 与 已完成)。 */
export function markersInHeading(line) {
  return COMPLETED_MARKERS.filter((k) => line.includes(k))
}

/**
 * **保护集**:13c「不许无声删除」覆盖的条目标题。
 * 粒度 ##/### + 任一已完成标记。兼容旧写法 `### [x] ✅(日期)`(它同样含 ✅)。
 */
export function isCompletedTaskHeading(line) {
  return ENTRY_HEADING_RE.test(line) && markersInHeading(line).length > 0
}

/**
 * **搬运集**:归档器允许搬走的条目 = 保护集 ∩ 含 ✅。
 * 子集关系由构造保证:第一句就调用 isCompletedTaskHeading,不另写正则。
 * 无 ✅ 的「### 已完成清单」一类小节标题被保护、**永不**被搬(§1 归档机制的原文判据)。
 */
export function isArchivableTaskHeading(line) {
  return isCompletedTaskHeading(line) && line.includes('✅')
}

/** 占位注释/复活对账用的标题文本:剥级别前缀。归档器写占位与 13c 反查必须共用本式。 */
export function headingTitle(line) {
  return line.replace(/^#{2,3}\s+/, '').trim()
}

/** 条目正文里的完成日期:优先 `(` 后第一个 YYYY-MM-DD,退化到任意第一个(真实形态日期常在 ✅ 前)。 */
export function extractEntryDate(line) {
  const m = /\((\d{4}-\d{2}-\d{2})/.exec(line) || /(\d{4}-\d{2}-\d{2})/.exec(line)
  return m ? m[1] : null
}

/** 提取保护集全部标题行(13c 用)。CRLF 与 LF 必须同判(HEAD blob 是 LF、工作树常是 CRLF)。 */
export function extractCompletedTaskHeadings(content) {
  if (!content) return []
  return content.split(/\r?\n/).filter(isCompletedTaskHeading)
}

/** bullet 级已完成计数(如实报数用;不是条目标题,归档粒度不覆盖,判据不冒充覆盖)。 */
export function countBulletCompleted(content) {
  if (!content) return 0
  return content.split(/\r?\n/).filter((l) => /^\s*- \[x\]/.test(l)).length
}

/**
 * 从文档实际内容**反推**存在的"已完成标题形态":`h<级别>|<标记>` → { count, lines, sample }。
 * 这是 T3 的眼睛:它比提取式宽(任何级别),所以提取式漏掉的形态会以"普查看见、覆盖判缺"
 * 的差集现形 —— 判据不再依赖任何人记得同步正则。
 */
export function surveyCompletionShapes(content) {
  const shapes = new Map()
  if (!content) return shapes
  const lines = content.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const lvl = headingLevel(lines[i])
    if (lvl === 0) continue
    for (const marker of markersInHeading(lines[i])) {
      const key = `h${lvl}|${marker}`
      let e = shapes.get(key)
      if (!e) {
        e = { shape: key, level: lvl, marker, count: 0, lines: [], sample: lines[i] }
        shapes.set(key, e)
      }
      e.count++
      if (e.lines.length < 3) e.lines.push(i + 1)
    }
  }
  return shapes
}

/**
 * T3:元判据 —— "提取式覆盖的形态"必须是"文档里真实存在的已完成形态"的超集。
 * @param {string} content 被审面的计划文档正文
 * @param {object} [opts]
 * @param {string[]} [opts.grandfathered] 存量形态(如 'h4|✅'):只报数不判红 —— 防恒红;
 *        它不是豁免清单:形态修好(文档里不再出现)后报数自然消失,出现新形态必红。
 * @param {(line:string)=>boolean} [opts.isCovered] 覆盖判据,**默认注入本模块的保护集式**;
 *        变异对照(证明 T3 有牙)传入收窄版,不得在生产调用点传。
 * @param {number} [opts.bulletCount] 预先数好的 bullet 级计数(报告用;缺省则本函数自数)
 * @returns {{red:string[], report:string[], bulletCount:number, shapes:Map}}
 */
export function shapeCoverageVerdict(content, opts = {}) {
  const { grandfathered = [], isCovered = isCompletedTaskHeading } = opts
  const shapes = surveyCompletionShapes(content)
  const red = []
  const report = []
  for (const e of [...shapes.values()].sort((a, b) => a.shape.localeCompare(b.shape))) {
    if (isCovered(e.sample)) continue
    if (grandfathered.includes(e.shape)) {
      report.push(
        `T3 存量形态(只报数):${e.shape} ${e.count} 处不在提取式覆盖内,样例行 ${e.lines.join(',')} —— ${e.sample.slice(0, 60)}`,
      )
      continue
    }
    red.push(
      `T3 判据失明:${e.shape} 形态真实存在 ${e.count} 处(行 ${e.lines.join(',')})却被提取式漏掉 —— ` +
        `样例:${e.sample.slice(0, 60)}。要么扩 §1 粒度并在两侧同步,要么给这形态一个诚实的归宿;` +
        `禁止把"看不见"写成"没有"。`,
    )
  }
  const bulletCount =
    typeof opts.bulletCount === 'number' ? opts.bulletCount : countBulletCompleted(content)
  return { red, report, bulletCount, shapes }
}

/**
 * 解析搬运集条目块(归档器用)。与旧实现的**行为等价面**:同一份只有 `###` 级的文档,
 * 结果逐字段相同(旧式测试夹具因此不需要改语义就能过)。扩展面在级别感知:
 *  - `##` 级 ✅ 标题现在也算条目,其正文延伸到下一个 **同级别或更浅** 标题 / `---` / EOF;
 *  - 深一级的 ✅ 子标题**并入父条目正文**、不另立条目 —— 否则父子范围重叠,
 *    从后往前 splice 会互相踩行(那会把归档变成损坏文档)。
 *  - 父条目体内遇到被保护但不可搬的标题(如 `### 已完成清单`)照常**闭合父条目**:
 *    搬走一个含保护标题的块虽能被占位注释救成合规,但语义上等于顺手删了别人的小节。
 * 运行时断言:任何被搬条目的标题必须在保护集内(子集不变量的第二道锁,结构+断言双保)。
 */
export function parseCompletedTaskBlocks(content) {
  const lines = String(content ?? '').split(/\r?\n/)
  const tasks = []
  let current = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isArchivableTaskHeading(line)) {
      const lvl = headingLevel(line)
      if (current && lvl > current.level) {
        // 嵌套 ✅ 子标题:并入父条目正文(不另立条目,不闭合父条目)
        current.bodyLines.push(line)
        current.endLine = i
        continue
      }
      if (current) {
        current.endLine = i - 1
        tasks.push(current)
      }
      current = {
        startLine: i,
        endLine: i,
        level: lvl,
        title: line,
        titleText: headingTitle(line),
        date: extractEntryDate(line),
        bodyLines: [line],
      }
    } else if (current) {
      const lvl = headingLevel(line)
      // 「被保护但不可搬」的标题(含"已完成"无"✅",任何级别)一律**闭合**父条目:
      // 把它裹进父块一起搬走,语义上等于顺手删了别人名下的小节(A0 虽能被占位救成合规,
      // 但那正是"搬运集 ⊂ 保护集"这条不变量在语义层的另一半 —— 只搬带 ✅ 的)。
      const protectedButNotArchivable = isCompletedTaskHeading(line)
      if (protectedButNotArchivable || (lvl > 0 && lvl <= current.level) || /^---\s*$/.test(line)) {
        current.endLine = i - 1
        tasks.push(current)
        current = null
      } else {
        current.bodyLines.push(line)
        current.endLine = i
      }
    }
  }
  if (current) tasks.push(current)
  for (const t of tasks) {
    if (!isCompletedTaskHeading(t.title)) {
      throw new Error(`子集不变量破裂:被搬条目标题不在保护集内 —— ${JSON.stringify(t.title)}`)
    }
  }
  return tasks
}

/** §22d 兼容位:纯库无 CLI 入口,导出对象供测试直接 import(本模块全部具名导出已是公共面)。 */
export const __test__ = {
  COMPLETED_MARKERS,
  headingLevel,
  markersInHeading,
  isCompletedTaskHeading,
  isArchivableTaskHeading,
  headingTitle,
  extractEntryDate,
  extractCompletedTaskHeadings,
  countBulletCompleted,
  surveyCompletionShapes,
  shapeCoverageVerdict,
  parseCompletedTaskBlocks,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
