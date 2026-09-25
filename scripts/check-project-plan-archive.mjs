#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * PROJECT_PLAN.md 已完成任务条目防误删守门(2026-07-20 立,commit 守门第 13c 项)
 *
 * 背景:
 *   - PROJECT_PLAN.md 是项目唯一任务计划文档(AGENTS.md 第 1 节)。
 *   - 历史上"CLI 配置导入"任务条目被归档精简操作**两次误删**(commit 15a50b53 第一次补回,
 *     后续归档再次删除,commit c0ac97c 第二次补回)。
 *   - 根因:check-project-plan-size.mjs 只守"体积上限",不守"已完成任务条目不能直接删除"。
 *   - 归档精简本意是把冗余任务条目移到 .ihui-agent/archive/,但实际操作时容易"整段删除"
 *     而非"替换为一行 HTML 注释占位",导致任务历史断档。
 *
 * 守门策略:
 *   - 检测 PROJECT_PLAN.md 是否被修改(staged 模式对比 HEAD 与 index,非 staged 对比 HEAD 与 working tree)
 *   - 提取所有"### XXX(已完成 ✅ ...)"标题行,找出被删除的
 *   - 若有已完成任务条目被删除,且本次 diff 无"<!-- 已归档"占位注释,则阻塞 commit
 *   - 合规操作:把完整任务条目移动到 .ihui-agent/archive/,并在原位置留归档占位注释
 *
 * 用法:
 *   node scripts/check-project-plan-archive.mjs --staged   (pre-commit, 阻塞)
 *   node scripts/check-project-plan-archive.mjs            (手动扫描, exit 0/1)
 *
 * 退出码:
 *   0 = 通过(无已完成任务条目被误删,或本次未修改 PROJECT_PLAN.md,或检测到归档占位注释)
 *   1 = 阻塞(检测到已完成任务条目被直接删除且无归档注释)
 */
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

/** ROOT 由脚本自身位置推导(§15);旧写法 `process.cwd()` 让门在任意目录下换基准。 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = 'PROJECT_PLAN.md'
const ARCHIVE_DIR = '.ihui-agent/archive'
/** 归档锚点文件的形状:只有 PROJECT_PLAN_*.md 才是"完整内容在 archive"的承诺载体。 */
const ANCHOR_RE = /^PROJECT_PLAN_.*\.md$/

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

/**
 * 提取 PROJECT_PLAN.md 中所有"已完成"任务条目的标题行。
 * 匹配规则: `### ` 开头 + 含 `(已完成` 或 ` ✅` 标记
 * @param {string} content
 * @returns {string[]} 已完成任务条目标题(完整行)
 */
function extractCompletedTaskHeadings(content) {
  if (!content) return []
  return content
    // HEAD blob 是 LF、本机 worktree 是 CRLF(§26/gitattributes 归一化只在写库时发生)。
    // 不剥 \r 的话同一标题在两侧字符串不等,全量模式会把"21 条已完成"整批误报成被删除。
    .split(/\r?\n/)
    .filter((line) => line.startsWith('### '))
    .filter((line) => line.includes('已完成') || line.includes('✅'))
}

/**
 * 检查 diff 文本中是否有"已归档"占位注释
 * @param {string} diffText
 * @returns {boolean}
 */
function hasArchivePlaceholder(diffText) {
  if (!diffText) return false
  return /<!--\s*已归档/.test(diffText)
}

/**
 * 「上一版 / 本版」这一对计划文档内容,一律经取材层取,不混读磁盘:
 *   --staged   : HEAD blob → **索引** blob(这枚提交真正带走的是索引那一份)
 *   全量(缺省): HEAD^ blob → HEAD blob(审计"最后一枚提交有没有直接删已完成条目")
 *   --worktree : HEAD blob → 磁盘(人工逃生舱;并行会话的半编辑态不得当门禁)
 * 本版取不到 ⇒ `{newContent:null}`;上一版取不到 ⇒ 按"首次创建"处理并如实写进 note。
 */
export function planPair(root, face) {
  const oldSpec = face === 'staged' ? `HEAD:${FILE}` : face === 'head' ? `HEAD^:${FILE}` : `HEAD:${FILE}`
  const newSpec = face === 'staged' ? `:${FILE}` : face === 'head' ? `HEAD:${FILE}` : null
  const specs = [oldSpec, newSpec].filter(Boolean)
  let got
  try {
    got = catBatch(root, specs, { timeout: 60000 })
  } catch (e) {
    return { oldContent: null, newContent: null, note: `取材层不可用:${e?.message ?? e}` }
  }
  const pick = (spec) => (spec === null ? readWorktreeFile(root, FILE) : (got.get(spec) ?? null))
  let oldContent = pick(oldSpec)
  const newContent = pick(newSpec)
  let note = ''
  if (oldContent === null && newContent !== null) {
    // HEAD^ 不存在(浅克隆 / 仓库首枚提交)⇒ 无"上一版"可比,按首次创建处理并喊出来,不静默当绿
    note = `上一版 ${oldSpec} 取不到(浅克隆或首枚提交)⇒ 按"首次创建"处理`
    oldContent = ''
  }
  return { oldContent, newContent, note }
}

function main(face) {
  if (!existsSync(path.join(ROOT, FILE)) && face === 'worktree') {
    console.log(`${C.dim}⏭  PROJECT_PLAN.md 不存在,跳过归档守门${C.reset}`)
    process.exit(0)
  }

  let oldContent = ''
  let newContent = ''
  let note = ''

  // 「上一版 / 本版」一律经取材层取,两面对同一轮不混读磁盘(见 planPair 的口径说明)。
  const pair = planPair(ROOT, face)
  oldContent = pair.oldContent
  newContent = pair.newContent
  note = pair.note

  // 整面取不到(非 git 环境 / git 不可用)⇒ **无法判定**,既不冒红也不记绿(与守门 94/101 同口径)。
  if (oldContent === null && newContent === null) {
    console.error(`❌ 无法判定:${note || '两个面都取不到 PROJECT_PLAN.md'}`)
    process.exit(2)
  }
  // 本版取不到 ⇒ 本次没有可审的内容(未跟踪该文件 / 非 git 环境),如实跳过而非冒绿。
  if (newContent === null) {
    console.log(`${C.dim}⏭  PROJECT_PLAN.md 本版取不到,跳过归档守门:${note || '未判定'}${C.reset}`)
    process.exit(0)
  }

  /**
   * A0「已完成条目被直接删除」的判定(纯函数,见 deletionVerdict)。
   * 归档占位不再看 diff,而看"本版比上一版**新增**了占位行" —— 与取材面同形,
   * 免得盘上随后改对就算合规(旧写法用 `git diff` 文本,工作树一脏就跟着变)。
   */
  const del = deletionVerdict(oldContent, newContent)
  const anchors = anchorVerdict(readAnchorInputs(ROOT, face))

  if (del.deletedHeadings.length === 0 && anchors.red.length === 0) {
    console.log(
      `${C.green}✅ PROJECT_PLAN.md 归档守门通过${C.reset} ${C.dim}(无已完成任务条目被删除;归档锚点齐备${anchors.baseline.length ? `;另有 ${anchors.baseline.length} 项已登记的缺失存量只报数` : ''})${C.reset}`,
    )
    for (const b of anchors.baseline)
      console.log(`${C.dim}   报数(已登记缺失):${b}${C.reset}`)
    process.exit(0)
  }

  if (del.deletedHeadings.length > 0 && !del.addedPlaceholders) {
    // 阻塞:有已完成任务条目被删除,但无归档占位注释
    console.error(
      `${C.red}❌ PROJECT_PLAN.md 归档守门失败${C.reset} ${C.bold}— 检测到已完成任务条目被直接删除${C.reset}`,
    )
    console.error('')
    console.error(
      `${C.yellow}被删除的已完成任务条目(${del.deletedHeadings.length} 个):${C.reset}`,
    )
    del.deletedHeadings.forEach((h) => {
      console.error(`  ${C.red}- ${h.replace(/^###\s+/, '')}${C.reset}`)
    })
    console.error('')
    console.error(`${C.yellow}问题:${C.reset}`)
    console.error(
      `  已完成任务条目是项目历史记录,${C.bold}不可直接删除${C.reset},必须按以下方式归档:`,
    )
    console.error('')
    console.error(`${C.cyan}正确操作:${C.reset}`)
    console.error(
      `  1. 把完整任务条目(### 标题 + 内容)移动到 ${C.cyan}.ihui-agent/archive/PROJECT_PLAN_YYYY-MM-DD.md${C.reset}`,
    )
    console.error(
      `  2. 在 PROJECT_PLAN.md 原位置保留一行归档占位注释(HTML 注释形式,不影响渲染):`,
    )
    console.error(
      `     ${C.dim}<!-- 已归档(YYYY-MM-DD):XXX 任务,完整内容在 .ihui-agent/archive/PROJECT_PLAN_*.md -->${C.reset}`,
    )
    console.error(
      `  3. 或直接在归档占位注释区追加任务名(参考文件末尾已有的归档注释块)`,
    )
    console.error('')
    console.error(
      `${C.yellow}背景:${C.reset} 历史上 CLI 配置导入任务条目被两次误删(commit 15a50b53 / c0ac97c 反复补回),`,
    )
    console.error(
      `        本守门脚本(commit 守门第 13c 项)从机制上杜绝此类事故再次发生。`,
    )
    console.error('')
  }

  if (anchors.red.length > 0) {
    console.error(
      `${C.red}❌ 归档锚点完整性失败${C.reset} ${C.bold}— §1 承诺的"完整内容在 .ihui-agent/archive/"有 ${anchors.red.length} 处落空${C.reset}`,
    )
    for (const r of anchors.red) console.error(`  ${C.red}· ${r}${C.reset}`)
    console.error(
      `${C.yellow}出路:${C.reset} ① 把缺失的归档文件补回并 **git add**(未跟踪的本机副本不算锚点,G-183/G-184 同一条纪律);` +
        `\n       ② 或改写占位注释,指向一个真在审面里的归档文件;` +
        `\n       ③ 已登记的存量见上"报数"行 —— 那类行**从清单里删掉但问题仍在**会立刻判红,**修好了仍留在清单里**同样判红(清单腐烂)。`,
    )
    console.error('')
  }

  if (del.deletedHeadings.length === 0 && anchors.red.length === 0) process.exit(0)
  process.exit(1)
}

/**
 * A0:已完成条目标题被删,而本版没有**新增**归档占位行 ⇒ 判红。
 * 单独抽成纯函数是为了能取证:旧实现拿 `git diff` 的文本判"有没有占位",
 * 于是工作树一脏(别人也在改这文件)结论就跟着变 —— 同一件事在两个面上给出两种答案。
 */
export function deletionVerdict(oldContent, newContent) {
  const oldHeadings = extractCompletedTaskHeadings(oldContent)
  const newHeadings = extractCompletedTaskHeadings(newContent)
  const deletedHeadings = oldHeadings.filter((h) => !newHeadings.includes(h))
  const oldPh = new Set(placeholderLines(oldContent))
  const addedPlaceholders = placeholderLines(newContent).filter((l) => !oldPh.has(l))
  return { deletedHeadings, addedPlaceholders, compliant: deletedHeadings.length === 0 || addedPlaceholders.length > 0 }
}

function placeholderLines(content) {
  if (!content) return []
  return content.split(/\r?\n/).filter((l) => /<!--\s*已归档/.test(l))
}

/**
 * 已登记的"归档锚点缺失"存量。每修好一项就必须从这里删一行 —— 留着会被判"清单腐烂"红,
 * 反过来删了却还没修也会红(见 anchorVerdict 两侧的对照)。它不是豁免清单,是待偿台账。
 */
export const LOST_ANCHOR_LEDGER = [
  'PROJECT_PLAN_2026-07-20_pre-permission-runtime.md',
  'PROJECT_PLAN_2026-07-20_publish-task-archive.md',
  'PROJECT_PLAN_2026-07-26_auto-archive.md',
  'PROJECT_PLAN_2026-08-03_auto-archive.md',
  'PROJECT_PLAN_2026-08-15_auto-archive.md',
  'PROJECT_PLAN_2026-09-12_archive.md',
  'PROJECT_PLAN_2026-09-23_bulk-archive.md',
  'PROJECT_PLAN_archive_2026-08-20.md',
]

/**
 * A1/A2 的判定(纯函数,输入全部来自被审面):
 *  **A1** 盘上有 `PROJECT_PLAN_*.md` 而审面里没有 ⇒ 红。这正是 G-184 关掉的洞的另一半:
 *       归档内容只存在于本机一块磁盘时,既撑不起"完整内容在 archive"的承诺,也随时会随磁盘没。
 *  **A2** 占位注释点名的具体文件不在审面里 ⇒ 红;若该名字在 `LOST_ANCHOR_LEDGER` 里则只报数。
 *       写成通配(`PROJECT_PLAN_*.md`)的占位不参与 A2 —— 它没有点名,判不了。
 * ⚠️ A2 的归属判据必须看 **faceFiles(该目录在审面上的全部文件)**而不是只看 `PROJECT_PLAN_*`:
 *    归档目录里也放非该形状的锚点件(实测 `orphan-capabilities-equivalence-2026-09-24.md` 已跟踪),
 *    拿形状过滤后的清单去判点名 ⇒ 把"已入库"读成"落空",本门第一次自跑就是这么红给自己看的。
 */
export function anchorVerdict({ diskAnchors, faceFiles, planText, ledger = LOST_ANCHOR_LEDGER }) {
  const red = []
  const baseline = []
  const onFace = new Set(faceFiles)
  for (const f of diskAnchors) {
    if (!ANCHOR_RE.test(f)) continue
    if (!onFace.has(f)) red.push(`A1 归档锚点只在本机、未进版本控制:.ihui-agent/archive/${f}`)
  }
  const named = new Set(
    [...String(planText || '').matchAll(/\.ihui-agent[\\/]archive[\\/]([A-Za-z0-9._\-]+\.md)/g)].map((m) => m[1]),
  )
  for (const f of [...named].sort()) {
    if (onFace.has(f)) {
      if (ledger.includes(f)) red.push(`A2 台账腐烂:${f} 已回到审面,仍挂在 LOST_ANCHOR_LEDGER 里`)
      continue
    }
    if (ledger.includes(f)) {
      baseline.push(`A2 占位点名的归档文件不在审面:${f}(已登记存量,只报数)`)
      continue
    }
    red.push(`A2 占位点名的归档文件不在审面:${f} —— 补回文件或改写占位,不得只删台账行`)
  }
  return { red, baseline }
}

/** 从被审面读三件套:盘上文件名、审面上的文件名(全集,不按形状筛)、计划文档正文。 */
function readAnchorInputs(root, face) {
  const args =
    face === 'staged'
      ? ['ls-files', '-z', '--', ARCHIVE_DIR]
      : ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ARCHIVE_DIR]
  let faceRaw = ''
  try {
    faceRaw = gitRaw(args, root, { timeout: 60000 })
  } catch {
    faceRaw = ''
  }
  const faceFiles = faceRaw
    .split('\0')
    .filter(Boolean)
    .map((p) => p.split('/').pop())
  const planSpec = face === 'staged' ? `:${FILE}` : `HEAD:${FILE}`
  let planText = catBatch(root, [planSpec], { timeout: 60000 }).get(planSpec) ?? ''
  if (face === 'worktree') planText = readWorktreeFile(root, FILE) ?? planText
  let diskAnchors = []
  try {
    diskAnchors = existsSync(path.join(root, ARCHIVE_DIR)) ? readdirSync(path.join(root, ARCHIVE_DIR)) : []
  } catch {
    diskAnchors = []
  }
  return { diskAnchors, faceFiles, planText }
}

/** 取证自检:三条判据各有正反例,且**不碰真仓磁盘**(盘上清单是机器态,只能构造)。 */
export function selfTest() {
  const results = []
  const t = (name, fn) => {
    try {
      const ok = fn()
      results.push([ok ? '✅' : '❌', name, ok ? '' : '判据未成立'])
      return ok
    } catch (e) {
      results.push(['💥', name, String(e && e.message)])
      return false
    }
  }
  t('A0 删条目且未新增占位 ⇒ 红', () => {
    const a = '### X(已完成 ✅ 2026-01-01)\n正文\n'
    return deletionVerdict(a, '').deletedHeadings.length === 1 && !deletionVerdict(a, '').compliant
  })
  t('A0 删条目同时新增占位行 ⇒ 合规', () => {
    const a = '### X(已完成 ✅ 2026-01-01)\n'
    const b = '<!-- 已归档(2026-01-02):X,完整内容在 .ihui-agent/archive/PROJECT_PLAN_2026-01-02.md -->\n'
    const v = deletionVerdict(a, b)
    return v.deletedHeadings.length === 1 && v.compliant
  })
  t('A0 占位在上一版就有 ⇒ 不算"本次新增"(不得被旧占位长期救活)', () => {
    const ph = '<!-- 已归档(2026-01-02):X,完整内容在 .ihui-agent/archive/Y.md -->\n'
    const v = deletionVerdict(`### X(已完成 ✅)\n${ph}`, ph)
    return v.addedPlaceholders.length === 0 && !v.compliant
  })
  t('A1 盘上有、审面没有 ⇒ 红;两边都有 ⇒ 绿', () => {
    const f = 'PROJECT_PLAN_2099-01-01_auto-archive.md'
    const r1 = anchorVerdict({ diskAnchors: [f], faceFiles: [], planText: '', ledger: [] })
    const r2 = anchorVerdict({ diskAnchors: [f], faceFiles: [f], planText: '', ledger: [] })
    return r1.red.some((x) => x.startsWith('A1')) && r2.red.length === 0
  })
  t('A1 非 PROJECT_PLAN_* 的文件(审计件等)不判红', () => {
    const r = anchorVerdict({ diskAnchors: ['notes.txt'], faceFiles: [], planText: '', ledger: [] })
    return r.red.length === 0
  })
  t('A2 占位点名的文件不在审面、且未登记 ⇒ 红', () => {
    const plan = 'x <!-- 已归档(2026-01-01):A,完整内容在 .ihui-agent/archive/PROJECT_PLAN_2026-01-01.md --> y'
    const r = anchorVerdict({ diskAnchors: [], faceFiles: [], planText: plan, ledger: [] })
    return r.red.some((x) => x.startsWith('A2'))
  })
  t('A2 同一文件在台账里 ⇒ 只报数不判红', () => {
    const plan = '<!-- 已归档(2026-01-01):A,完整内容在 .ihui-agent/archive/PROJECT_PLAN_2026-01-01.md -->'
    const r = anchorVerdict({
      diskAnchors: [],
      faceFiles: [],
      planText: plan,
      
      ledger: ['PROJECT_PLAN_2026-01-01.md'],
    })
    return r.red.length === 0 && r.baseline.length === 1
  })
  t('A2 反向:台账里的行已经修好仍在清单 ⇒ 判"清单腐烂"红(删台账行必须与修好同步)', () => {
    const f = 'PROJECT_PLAN_2026-01-01.md'
    const r = anchorVerdict({
      diskAnchors: [f],
      faceFiles: [f],
      planText: `<!-- 已归档(2026-01-01):A,完整内容在 .ihui-agent/archive/${f} -->`,
      
      ledger: [f],
    })
    return r.red.some((x) => x.includes('腐烂'))
  })
  t('A2 通配形态占位不参与判据(它没点名)', () => {
    const r = anchorVerdict({
      diskAnchors: [],
      faceFiles: [],
      planText: '<!-- 已归档(2026-01-01):A,完整内容在 .ihui-agent/archive/PROJECT_PLAN_*.md -->',
      
      ledger: [],
    })
    return r.red.length === 0 && r.baseline.length === 0
  })
  t('CRLF 与 LF 的同一条标题不得被读成"删除"(旧写法在此整批误报)', () => {
    const h = '### X(已完成 ✅ 2026-07-01)'
    return deletionVerdict(`${h}\r\n`, `${h}\n`).deletedHeadings.length === 0
  })
  const pad = Math.max(...results.map((r) => r[1].length))
  for (const [m, n, why] of results) console.log(`${m} ${n}${why ? ` —— ${why}` : ''}`.padEnd(pad + 6, ' '))
  const bad = results.filter((r) => r[0] !== '✅').length
  console.log(`\nself-test: ${results.length - bad}/${results.length} 通过`)
  return bad === 0 ? 0 : 1
}

const isDirectRun =
  process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href

if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(selfTest())
  const { face, error } = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (error) {
    console.error(`❌ 无法判定: ${error}`)
    process.exit(2)
  }
  main(face)
}

/** §22c:镜像测试一律 import,不得复制判据 */
export const __test__ = {
  extractCompletedTaskHeadings,
  hasArchivePlaceholder,
  deletionVerdict,
  anchorVerdict,
  planPair,
  LOST_ANCHOR_LEDGER,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
