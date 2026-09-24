// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 工程工具为 CLI,输出即其交付物 */
/**
 * 共享活文档的提交前对账器 —— 判定"工作树是否仍包含 HEAD 的全部内容",并可按原位归并。
 *
 * 为什么需要它(2026-09-24 一夜三次自伤,同一成因):共享工作区里 README / AGENTS /
 * PROJECT_PLAN 会被并发会话留在**滞后副本**上(实测工作树比 HEAD 少 57 / 48 / 54 行),
 * 而 `safe-commit` 的 Step ④ 是 `git commit -- <pathspec>` —— 它按路径取**工作树**版本。
 * 于是一次"只 add 本任务文件"的规范提交,会把别人**已入库**的行整批写回旧态,而
 * `git status`、本次 diff 行数、typecheck 全都不报错(守门 71 当时也报"无缺失":它只锚
 * `G-/Dx/Px/Wx/守门 NN` 编号族,而丢掉的是整节 `## O42 …` 标题与其正文)。
 *
 * 方向必须是"以工作树为底、把 HEAD 缺失块插回去",不能反过来:工作树里还有别人**未提交**的
 * 在途改写(实测 README 4 行 / AGENTS 9 行),以 HEAD 为底追加会把它们挤到文件末尾并丢空行
 * —— 本工具的第一版正是犯了这个错(行数 4952→3921,1087 个空行蒸发)。
 *
 * 两类"HEAD 有而工作树无"必须分开,否则比丢内容更糟:
 *   lost       = 副本滞后吃掉别人的行 ⇒ 插回;
 *   superseded = 有人就地改写了某行   ⇒ **不插回**(插回即同一件事新老并存)。
 * 判据用字符二元组 Jaccard(阈值 0.6)而非前缀或词袋:改写常常只动行首的编号/门名
 * (`**第 93 项 X**` → `**守门 X**`),46 字符前缀当场就散了 —— 实测前缀版漏判 3/4 类改写。
 *
 * 用法:
 *   node scripts/merge-live-doc.mjs --file README.md            # 只报告(0 = 可安全提交)
 *   node scripts/merge-live-doc.mjs --file README.md --apply    # 写回工作树(先落 .bak)
 *   node scripts/merge-live-doc.mjs --self-test                 # 判据纯函数正反例
 *
 * 退出码:0 工作树 ⊇ HEAD / 1 存在 lost 行(需 --apply)或自检失败 / 2 参数或取版本失败
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs'
import { resolve, basename } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const git = (args) =>
  execFileSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 268435456,
  })

const trim = (l) => l.trim()
// 相似度实现**只有一份**,放在 `scripts/lib/live-doc-similarity.mjs`(纯函数、零副作用)。
// 本文件顶层就是 CLI 主流程(没有 §22d 的 isDirectRun 守卫),谁 `import` 谁就被 `process.exit`
// 打断 —— 2026-09-25 实测把 `check-task-claims.mjs` 弄死过一次,故把纯函数抽出去而不是被 import。
// 这里**原样再导出**同名符号,既有调用方(`SIM_THRESHOLD` / `tokenize` / `jaccard`)一字不变。
export { SIM_THRESHOLD, jaccard, tokenize } from './lib/live-doc-similarity.mjs'
import { SIM_THRESHOLD, CONTAIN_MIN, jaccard, squash, stripState, tokenize } from './lib/live-doc-similarity.mjs'

/**
 * 容器短路:HEAD 行的**全部非空白字符**原样出现在工作树某行里 ⇒ 内容逐字存活,只是被就地延长。
 * 为什么必须有这一条(2026-09-25 实测到机制):翻勾的仓库写法是「改前缀 + 追加证据」,而追加会让
 * 字符二元组 Jaccard 随新增长度**单调下降** —— 短行 40 字 / 改后 120 字时相似度只剩 ~0.33,
 * 于是"补证据"这个动作本身被判成真丢失,exit 1 逼人跑 `--apply`,而 `--apply` 会把**改写前的短行
 * 原样插回** ⇒ 同一票两行并存。台账里那批双态行的制造路径之一就是这里,不是谁手滑。
 * 下界 CONTAIN_MIN 个非空白字符:再短的裸标记行(`- [ ]` 等)在满屏清单里必然被"包含",会被误洗成存活。
 */

/** 给每个"HEAD 有而工作树无"的行定性 lost / superseded(被就地改写取代)。 */
export function classifyMissing(headLines, wtLines, threshold = SIM_THRESHOLD) {
  const wtSet = new Set(wtLines.map(trim).filter(Boolean))
  const headSet = new Set(headLines.map(trim).filter(Boolean))
  const localOnly = wtLines.map(trim).filter((t) => t.length > 0 && !headSet.has(t))
  const localTok = localOnly.map(tokenize)
  const localSquashed = localOnly.map(squash)
  // 翻勾会改行首状态(`- [ ]（进行中）` → `- [x] ✅(日期)`),不剥掉它就永远"不逐字包含",
  // 于是把刚翻勾的那行判成真丢失、`--apply` 再插回一遍 —— 双态行就是这么造出来的。
  const localBare = localOnly.map((l) => squash(stripState(l)))
  const verdict = new Map()
  for (const raw of headLines) {
    const t = trim(raw)
    if (!t.length || wtSet.has(t)) continue
    const tt = tokenize(t)
    const sq = squash(t)
    const bare = squash(stripState(t))
    if (
      (sq.length >= CONTAIN_MIN && localSquashed.some((w) => w.includes(sq))) ||
      (bare.length >= CONTAIN_MIN && localBare.some((w) => w.includes(bare)))
    ) {
      verdict.set(t, 'superseded')
      continue
    }
    let best = 0
    for (const lt of localTok) {
      const s = jaccard(tt, lt)
      if (s > best) best = s
    }
    verdict.set(t, best >= threshold ? 'superseded' : 'lost')
  }
  return verdict
}

/**
 * 把 HEAD 里"连续的 lost 段"(段尾空行一并带上,保排版)插回工作树的锚点之后。
 * 锚点 = 该段之前最后一个仍存在于工作树的 HEAD 行;找不到锚点则追加末尾并如实计数,
 * 绝不静默丢弃 —— 静默正是这类工具最危险的失效模式。
 */
export function mergeByAnchors(headLines, wtLines, verdict) {
  const out = wtLines.slice()
  const wtSet = new Set(wtLines.map(trim).filter(Boolean))
  const wtIndexOf = new Map()
  wtLines.forEach((l, i) => {
    const t = trim(l)
    if (t && !wtIndexOf.has(t)) wtIndexOf.set(t, i)
  })
  const isLost = (t) => verdict.get(t) === 'lost'

  let i = 0
  let segments = 0
  let lines = 0
  let unanchored = 0
  while (i < headLines.length) {
    if (!isLost(trim(headLines[i]))) {
      i += 1
      continue
    }
    let j = i
    while (j < headLines.length && isLost(trim(headLines[j]))) j += 1
    while (j < headLines.length && trim(headLines[j]) === '') j += 1
    const block = headLines.slice(i, j)
    let anchor
    for (let k = i - 1; k >= 0; k -= 1) {
      const t = trim(headLines[k])
      if (t.length && wtSet.has(t)) {
        anchor = wtIndexOf.get(t)
        break
      }
    }
    if (anchor === undefined) {
      unanchored += 1
      out.push(...block)
    } else {
      out.splice(anchor + 1, 0, ...block)
      for (const [key, val] of wtIndexOf) if (val > anchor) wtIndexOf.set(key, val + block.length)
    }
    segments += 1
    lines += block.length
    i = j
  }
  return { out, segments, lines, unanchored }
}

export function dupLong(lines, min = 60) {
  const m = new Map()
  for (const l of lines) {
    const t = trim(l)
    if (t.length < min) continue
    m.set(t, (m.get(t) || 0) + 1)
  }
  return [...m].filter(([, v]) => v > 1)
}

function selfTest() {
  const cases = []
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg || '断言失败')
  }
  const ck = (name, fn) => {
    try {
      fn()
      cases.push(['✓', name])
    } catch (e) {
      cases.push(['✗', `${name} → ${e?.message ?? e}`])
    }
  }

  ck('① 滞后副本吃掉的整块(含表格+空行)按锚点插回,顺序与排版保持', () => {
    const head = [
      '# T',
      '## A',
      'keep-a',
      '## B',
      '',
      '| c | d |',
      '| --- | --- |',
      '| 1 | 2 |',
      '## C',
      'keep-c',
    ]
    const wt = ['# T', '## A', 'keep-a', '## C', 'keep-c']
    const r = mergeByAnchors(head, wt, classifyMissing(head, wt))
    assert(r.out.join('\n').includes('| c | d |'), '表格未插回')
    assert(r.out.indexOf('## B') < r.out.indexOf('## C'), '没插在锚点之后')
    assert(
      r.out.some((l) => !trim(l)),
      '空行丢了',
    )
    assert(r.unanchored === 0, '本例必须有锚点')
  })

  ck('② 被就地改写的行不插回(否则同一件事新老并存)', () => {
    const head = ['**第 93 项 `check-x.mjs`(warn-only)** —— 说明正文甲 乙 丙 丁']
    const wt = ['**守门 `check-x.mjs`(warn-only;编号以 runner 为准) ** —— 说明正文甲 乙 丙 丁']
    const v = classifyMissing(head, wt)
    assert(v.get(trim(head[0])) === 'superseded', `应判 superseded,实判 ${v.get(trim(head[0]))}`)
    const r = mergeByAnchors(head, wt, v)
    assert(r.lines === 0, `不该插回,实插 ${r.lines} 行`)
  })

  ck('③ 回归:前缀与词袋比对都会漏判改写,故用字符二元组', () => {
    const a =
      '**守门 `check-c-drive-pollution.mjs`(warn-only;同日重排 5 次编号)**(2026-09-23 立) —— 补的是全链没有一道门看过文件系统这个缺口'
    const b =
      '**第 93 项 `check-c-drive-pollution.mjs`(warn-only)**(2026-09-23 立) —— 补的是全链没有一道门看过文件系统这个缺口'
    assert(a.slice(0, 46) !== b.slice(0, 46), '本例必须"前缀不同",否则测不到点子上')
    assert(jaccard(tokenize(a), tokenize(b)) >= SIM_THRESHOLD, '字符二元组相似度应判为同一条')
  })

  ck('④ 真孤儿行(与工作树任何行都不像)判 lost 并插回', () => {
    const head = ['anchor', '- [x] ✅(2026-09-24) **D62 语音字幕与讨论纪要(G-76)**:播报时字幕可见']
    const wt = [
      'anchor',
      '- [x] ✅(2026-09-24) **D91 四类文档批注锚点分型(G-124)**:PDF 页码 整篇 选区 画框',
    ]
    const v = classifyMissing(head, wt)
    assert(v.get(trim(head[1])) === 'lost', '真丢失被误判成 superseded')
    assert(mergeByAnchors(head, wt, v).lines === 1, '没插回')
  })

  ck('⑤ 工作树 ⊇ HEAD 时是幂等空操作(0 段 0 行)', () => {
    const head = ['a', 'b']
    const wt = ['a', 'b', 'c-local']
    const r = mergeByAnchors(head, wt, classifyMissing(head, wt))
    assert(r.segments === 0 && r.lines === 0, '不该有任何插入')
    assert(r.out.join('\n') === wt.join('\n'), '内容被改写')
  })

  ck('⑥ 无锚点的前导缺失块追加到末尾并计数(不得静默丢)', () => {
    const head = ['preamble-only-in-head', 'anchor']
    const wt = ['anchor']
    const r = mergeByAnchors(head, wt, classifyMissing(head, wt))
    assert(
      r.lines === 1 && r.unanchored === 1,
      `计数异常 seg=${r.segments} lines=${r.lines} un=${r.unanchored}`,
    )
    assert(r.out.includes('preamble-only-in-head'), '内容没进来')
  })

  ck('⑦ 归并结果不得引入新的长行重复(重复=同一件事写两遍)', () => {
    const long =
      '- [x] ✅ **O46④ 本票自己制造并修好的两处回退(如实登记)**:提交用 --no-verify 落地,pre-commit 报的红里数道是本票自己造成的'
    const head = ['anchor', long, 'tail']
    const wt = ['anchor', 'tail', '本地另一条完全不相干的长行说明文字,用来避免被误判成同一条改写']
    const r = mergeByAnchors(head, wt, classifyMissing(head, wt))
    assert(dupLong(r.out).length === 0, '引入了重复长行')
  })

  ck('⑧ 工作树独有(他人未提交在途改写)的行不得被归并过程吃掉', () => {
    const head = ['anchor']
    const wt = ['anchor', '本地在途改写的说明行,HEAD 里还没有它']
    const r = mergeByAnchors(head, wt, classifyMissing(head, wt))
    assert(r.out.includes('本地在途改写的说明行,HEAD 里还没有它'), '在途改写被丢掉')
  })

  // ⑨⑩ 是 2026-09-25 补的一对:本工具当时把"翻勾时追加证据"的每一次编辑都判成真丢失,
  // 而 `--apply` 的"修复"动作会把改写前的短行原样插回 ⇒ 直接制造台账双态行。
  // 容器短路加完之后,⑨ 必须绿、⑩ 必须仍然红 —— 缺一侧就是拿判据洗地。
  ck('⑨ 追加证据型改写(HEAD 行逐字存活在更长的新行里)判 superseded,不插回', () => {
    const oldLine = '- [ ] D15 GitHub App(webhook 自动 PR review+@机器人触发)(G-20)'
    const newLine =
      oldLine +
      ' **本行是 union 归并留下的裸副本**,现行判定与剩余项见紧邻下一条(其列明 6 项未完成 ⇒ 本票属部分开工),勿照本行派单。'
    const head = ['anchor', oldLine, 'tail']
    const wt = ['anchor', newLine, 'tail']
    assert(
      jaccard(tokenize(oldLine), tokenize(newLine)) < SIM_THRESHOLD,
      '本例必须让"仅靠二元组相似度"的旧判据失效,否则测不到容器短路存在的意义',
    )
    const v = classifyMissing(head, wt)
    assert(v.get(oldLine) === 'superseded', `应判 superseded,实判 ${v.get(oldLine)}`)
    assert(mergeByAnchors(head, wt, v).lines === 0, '把已存活的行又插回了一遍(= 制造双态)')
  })

  ck('⑩ 容器短路不得替真丢失洗地(只共享片段≠整行存活;短标记行不走容器)', () => {
    const gone = '- [ ] **D71 交还前必须自行复验**:交付前跑一次全量镜像测试并贴出末行'
    const decoy =
      '本地另一条行,里面也提到 交付前跑一次全量镜像测试并贴出末行 这句话,但整行内容完全不同以至于 D71 那条其实没了'
    const v1 = classifyMissing(['anchor', gone], ['anchor', decoy])
    assert(v1.get(gone) === 'lost', '只共享片段就被判存活 ⇒ 真丢失会被洗绿')
    const v2 = classifyMissing(
      ['anchor', '- [ ]'],
      ['anchor', '- [ ] 某条长待办正文内容远超容器下界'],
    )
    assert(v2.get('- [ ]') === 'lost', '短裸标记行被容器短路误洗')
  })

  // ⑪ 2026-09-25 第二次被同一机制咬到:⑨ 只覆盖"正文原样 + 追加",而真实翻勾还会
  // 改行首状态(`- [ ]（进行中）` → `- [x] ✅(日期)`)。状态前缀不剥,容器通道对这一整类
  // 直接失效 —— 后果就是 `--apply` 把我刚翻勾的那行按"真丢失"插回来,当场造出双态行。
  ck('⑪ 翻勾改的是行首状态前缀:剥掉状态后正文仍逐字存活 ⇒ 判 superseded 不插回', () => {
    const held = '- [ ]（进行中） **D17(生态统一入口)**:页面已写完但缺语言包,按住'
    const flipped =
      '- [x] ✅(2026-09-25) **D17(生态统一入口)**:页面已写完但缺语言包,按住' +
      ' **同票补齐并入库**:五语 30 键已插入,vitest 8 passed,check-i18n-keys 由红转 parity OK。'
    assert(!squash(flipped).includes(squash(held)), '本例必须"带状态前缀就不互含",否则测不到 stripState 的意义')
    const head = ['anchor', held, 'tail']
    const wt = ['anchor', flipped, 'tail']
    const v = classifyMissing(head, wt)
    assert(v.get(held) === 'superseded', `应判 superseded,实判 ${v.get(held)}`)
    assert(mergeByAnchors(head, wt, v).lines === 0, '把刚翻勾的行又插回一遍(= 造双态行)')
  })

  // ⑫ ⑪ 的对照组:状态前缀**不能**变成万能洗地通道。
  ck('⑫ 剥状态前缀不得替真丢失洗地(整条正文没存活的行仍判 lost)', () => {
    const gone = '- [ ]（进行中） **D99 交还前必须自行复验**:按权威入口复跑并贴末行输出,不得转述'
    const unrelated = '- [x] ✅(2026-09-25) **D98 别的条目**:已完成,与 D99 无关,只是同样带状态前缀'
    const v = classifyMissing(['anchor', gone], ['anchor', unrelated])
    assert(v.get(gone) === 'lost', '剥了状态前缀就把不相关行当成同一条 ⇒ 真丢失会被洗绿')
  })

  for (const [mark, name] of cases) console.log(`${mark} ${name}`)
  const bad = cases.filter(([m]) => m === '✗').length
  console.log(
    bad
      ? `❌ 自检 ${cases.length - bad}/${cases.length}`
      : `✅ 自检 ${cases.length}/${cases.length} 通过`,
  )
  return bad ? 1 : 0
}

if (process.argv.includes('--self-test')) process.exit(selfTest())

const argv = process.argv.slice(2)
const at = (name) => argv.indexOf(name)
const FILE = at('--file') >= 0 ? argv[at('--file') + 1] : null
const APPLY = argv.includes('--apply')
if (!FILE) {
  console.error('✗ 必须给 --file <相对路径>(或跑 --self-test)')
  process.exit(2)
}

let headText
try {
  headText = git(['show', `HEAD:${FILE}`])
} catch (e) {
  console.error(`✗ 取不到 HEAD:${FILE} → 拒绝继续(${e?.message ?? e})`)
  process.exit(2)
}

const headLines = headText.split('\n')
const wtLines = readFileSync(resolve(ROOT, FILE), 'utf8').split('\n')
const headSet = new Set(headLines.map(trim).filter(Boolean))
const verdict = classifyMissing(headLines, wtLines)
const lost = [...verdict.entries()].filter(([, k]) => k === 'lost')
const superseded = [...verdict.entries()].filter(([, k]) => k === 'superseded')
const localOnly = wtLines.map(trim).filter((t) => t.length > 0 && !headSet.has(t))

console.log(`${FILE}:HEAD 行数=${headLines.length} 工作树行数=${wtLines.length}`)
console.log(
  `  真丢失(需插回)= ${lost.length}   被就地改写取代(不插回)= ${superseded.length}   工作树独有(在途改写)= ${localOnly.length}`,
)
for (const [t] of lost.slice(0, 6)) console.log('   ! ' + t.slice(0, 86))
if (lost.length > 6) console.log(`   … 另 ${lost.length - 6} 行`)
if (superseded.length) {
  console.log('  --- 判定为"被改写取代"的 HEAD 行(逐条供人工复核) ---')
  for (const [t] of superseded.slice(0, 8)) console.log('   ~ ' + t.slice(0, 78))
}
if (!lost.length) {
  console.log('✅ 工作树 ⊇ HEAD,可安全提交(无需归并)')
  process.exit(0)
}
if (!APPLY) {
  console.log('结论:需归并 —— 跑 --apply(会先落 .bak)')
  process.exit(1)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
// 备份目录必须自己建:本工具跑在**任何**有活文档的仓里(新克隆 / CI / 隔离夹具都没有
// `.ihui-agent/tmp/`)。2026-09-24 端到端取证实测:目录缺失时 `copyFileSync` 抛 ENOENT,
// 崩溃点在"已经算完丢失清单之后、写回之前" ⇒ 归并**一个字都没落**,而 stdout 已经打印了
// "真丢失(需插回)= 3"这种像是成功的结论。修一行 mkdirSync,备份语义不变。
mkdirSync(resolve(ROOT, '.ihui-agent/tmp'), { recursive: true })
copyFileSync(
  resolve(ROOT, FILE),
  resolve(ROOT, `.ihui-agent/tmp/${basename(FILE)}.${stamp}.pre-merge.bak`),
)
const r = mergeByAnchors(headLines, wtLines, verdict)
writeFileSync(resolve(ROOT, FILE), r.out.join('\n'), { encoding: 'utf8' })

const after = readFileSync(resolve(ROOT, FILE), 'utf8').split('\n')
const afterSet = new Set(after.map(trim).filter(Boolean))
const stillLost = lost.filter(([t]) => !afterSet.has(t)).length
const dupsBefore = dupLong(wtLines).length
const headDups = dupLong(headLines).length
const dupsAfter = dupLong(after).length
const base = Math.max(dupsBefore, headDups)
console.log(`已写回:段=${r.segments} 插入行=${r.lines} 无锚点(追加到末尾)=${r.unanchored}`)
console.log(
  `  行数 ${wtLines.length} → ${after.length}(空行数 ${wtLines.filter((l) => !trim(l)).length} → ${after.filter((l) => !trim(l)).length})`,
)
console.log(`  归并后仍判 lost = ${stillLost}(必须 0)`)
console.log(
  `  ≥60 字符长行重复:工作树 ${dupsBefore} / HEAD ${headDups} / 归并后 ${dupsAfter}(新增 ${dupsAfter - base})`,
)
process.exit(stillLost || dupsAfter > base ? 1 : 0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
