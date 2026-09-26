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
import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

/**
 * ROOT 由脚本自身位置推导(§15);旧写法 `process.cwd()` 让门在任意目录下换基准。
 * ⚠️ 因此镜像测试**不能**靠 `cwd` 把门指到临时夹具(守门 70 同型:13 例里 11 例在扫真仓)。
 * 夹具用 `--root <dir>` 这条显式测试通道(生产一律不带,语义不变)。
 */
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

/**
 * 返回退出码,而不是在函数体内 `process.exit()`:管道(spawnSync / 钩子)下 stdout/stderr 是
 * **异步**写,exit 会把还没 flush 的消息截掉 —— 实测本门的红在镜像测试里输出**整块为空**。
 * 一道"不知道自己拦了什么"的 blocking 门比没有门更危险。
 */
function main(face, root = ROOT) {
  if (!existsSync(path.join(root, FILE)) && face === 'worktree') {
    console.log(`${C.dim}⏭  PROJECT_PLAN.md 不存在,跳过归档守门${C.reset}`)
    return 0
  }

  let oldContent = ''
  let newContent = ''
  let note = ''

  // 「上一版 / 本版」一律经取材层取,两面对同一轮不混读磁盘(见 planPair 的口径说明)。
  const pair = planPair(root, face)
  oldContent = pair.oldContent
  newContent = pair.newContent
  note = pair.note

  // 整面取不到(非 git 环境 / git 不可用)⇒ **无法判定**,既不冒红也不记绿(与守门 94/101 同口径)。
  if (oldContent === null && newContent === null) {
    console.error(`❌ 无法判定:${note || '两个面都取不到 PROJECT_PLAN.md'}`)
    return 2
  }
  // 本版取不到 ⇒ 本次没有可审的内容(未跟踪该文件 / 非 git 环境),如实跳过而非冒绿。
  if (newContent === null) {
    console.log(`${C.dim}⏭  PROJECT_PLAN.md 本版取不到,跳过归档守门:${note || '未判定'}${C.reset}`)
    return 0
  }

  /**
   * A0「已完成条目被直接删除」的判定(纯函数,见 deletionVerdict)。
   * 归档占位不再看 diff,而看"本版比上一版**新增**了占位行" —— 与取材面同形,
   * 免得盘上随后改对就算合规(旧写法用 `git diff` 文本,工作树一脏就跟着变)。
   */
  const del = deletionVerdict(oldContent, newContent)
  const res = resurrectionVerdict(oldContent, newContent)
  const inputs = readAnchorInputs(root, face)
  const anchors = anchorVerdict(inputs)
  // A3 取不到正文的归档件 ⇒ 如实报数,绝不静默当成"那一层没问题"(判据失明不是通过)。
  const undet = inputs.archiveUndetermined
    ? `;A3 另有 ${inputs.archiveUndetermined} 份归档件正文取不到,那一层未判定`
    : ''

  if (del.compliant && res.compliant && anchors.red.length === 0) {
    console.log(
      `${C.green}✅ PROJECT_PLAN.md 归档守门通过${C.reset} ${C.dim}(无已完成任务条目被删除;归档锚点齐备${res.preexisting ? `;另有 ${res.preexisting} 条上一版即存在的复活存量只报数` : ''}${anchors.baseline.length ? `;另有 ${anchors.baseline.length} 项已登记的缺失存量只报数` : ''}${undet})${C.reset}`,
    )
    for (const b of anchors.baseline)
      console.log(`${C.dim}   报数(已登记缺失):${b}${C.reset}`)
    for (const r of res.resurrected)
      console.log(`${C.dim}   报数(复活存量,本次未追账):${r}${C.reset}`)
    return 0
  }

  if (!del.compliant) {
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

  if (res.introduced.length > 0) {
    console.error(
      `${C.red}❌ 已完成任务条目被**复活**${C.reset} ${C.bold}— 归档占位还在,条目正文又回到了计划文档(${res.introduced.length} 条,本次引入)${C.reset}`,
    )
    for (const r of res.introduced) console.error(`  ${C.red}· ${r}${C.reset}`)
    console.error(
      `${C.yellow}成因(2026-09-26 实测):${C.reset} 并发会话拿**滞后的工作树副本**提交,经行并集把已归档条目按回来 —— ` +
        `行并集表示不了"删除",所以它不报冲突、不进 diff 报告,A0 也只看反方向。`,
    )
    console.error(
      `${C.yellow}出路:${C.reset} ① 以当次 HEAD 为底重跑归档器(node scripts/archive-completed-tasks.mjs --all),把复活条目再搬走;` +
        `\n       ② 或先把自己的工作树副本对齐 HEAD 再提交(node scripts/heal-worktree-tracked.mjs --dry-run 看差集)。`,
    )
    console.error('')
  }

  return del.compliant && res.compliant && anchors.red.length === 0 ? 0 : 1
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
 * 归档器写占位时用的那段标题(`archive-completed-tasks.mjs`:`titleText.slice(0, 60)`)。
 * 两处必须同形 —— 这里算得比它宽,A4 就把"已归档"的正常状态误判成复活;算得比它窄,
 * 复活就检不出来。
 */
function archivedTitleOf(headingLine) {
  return headingLine.replace(/^###\s+/, '').trim().slice(0, 60)
}

/**
 * 占位注释里点名的条目标题集。
 *
 * 刻意用"最后一个 `,完整内容在`"切分而不是非贪婪正则:标题里本来就带中文逗号
 * (`O36 追加(同日):对账门 5 枚红点…`),正则会在第一个逗号处断掉。
 */
function placeholderTitles(content) {
  const out = new Set()
  for (const line of placeholderLines(content)) {
    const start = line.indexOf('):')
    const end = line.lastIndexOf(',完整内容在')
    if (start < 0 || end < 0 || end <= start) continue
    out.add(line.slice(start + 2, end).trim())
  }
  return out
}

/**
 * A4:已完成条目被并发 union 复活 —— **占位在、条目也回来了**。
 *
 * 为什么需要它(2026-09-26 一天内实测三次):归档提交落地后,别的会话拿着**滞后的工作树副本**
 * 经 `union-converge` 的行并集(每行重数 = max(本侧,对侧))把整批条目按回计划文档。
 * 行并集在数学上表示不了"删除",所以那 479 行必然回来,而 A0 只管反方向
 * (删条目不留占位) —— 复活这件事过去**零判据**,谁都不知道自己刚把已归档的东西塞回来了。
 *
 * 判红条件刻意收窄成"本次引入":上一版就存在的复活只报数,不追账。
 * 否则任何人提交任何无关内容都会被别人留下的状态钉红 ⇒ 全队 `--no-verify`
 * ⇒ 全部守门作废(§12e 那一型,本仓写过多次:恒红门的代价从来不是"少做一件事")。
 */
export function resurrectionVerdict(oldContent, newContent) {
  const phNew = placeholderTitles(newContent)
  const phOld = placeholderTitles(oldContent)
  const resurrected = [
    ...new Set(
      extractCompletedTaskHeadings(newContent)
        .map(archivedTitleOf)
        .filter((t) => t !== '' && phNew.has(t)),
    ),
  ]
  const oldResurrected = new Set(
    extractCompletedTaskHeadings(oldContent)
      .map(archivedTitleOf)
      .filter((t) => t !== '' && phOld.has(t)),
  )
  const introduced = resurrected.filter((t) => !oldResurrected.has(t))
  return {
    resurrected,
    introduced,
    preexisting: resurrected.length - introduced.length,
    compliant: introduced.length === 0,
  }
}

/**
 * 已登记的"归档锚点缺失"存量。每修好一项就必须从这里删一行 —— 留着会被判"清单腐烂"红,
 * 反过来删了却还没修也会红(见 anchorVerdict 两侧的对照)。它不是豁免清单,是待偿台账。
 *
 * 2026-09-25 G-191:原 8 项中 4 项已按**逐字证据**从计划文档历史版本找回并入库
 * (判据 = 该正文逐字存在于所引提交的父版本;每条保留 `recovered from <sha>` 出处注释),
 * 故按本台账自己的规矩删那 4 行(文件已回到审面却仍挂着 = 清单腐烂红)。
 * 另 2 条(`2026-07-26` 组内 L3774/L3778)确认**找不回**:它们的占位是在 `3a5b737bf8` 里凭空
 * 新增的纯 `+` 行,按裸标题 `git log -S` 证明条目从未存在过 ⇒ 从别处"补"就是编造,不当干。
 *
 * 2026-09-25 G-192:下面 `NEVER_EXISTED` 那 8 项是 **A3**(归档件内部点名)上线时一次性登记的存量。
 * 取证方式与第一批不同 —— 不是"内容找不回",而是**该路径从未作为文件存在过**:
 * `git log --all -- <各种前缀>/<name>` 对 8 个名字全部 0 命中(含 `.trae-cn/archive/` 这一族)。
 * 同一批里 4 个真存在过的(`2026-07-22_archive` / `2026-07-23_archive{,_v3,_v4}`)已按 blob 逐字节
 * 取回入库,所以这 8 项是"占位被写过、文件没被写过"的那一类,**结构上找不回**,只能如实报数。
 */
const NEVER_EXISTED = [
  'PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md',
  'PROJECT_PLAN_2026-07-22_sdk-multi-language.md',
  'PROJECT_PLAN_2026-07-23_archive_v2.md',
  'PROJECT_PLAN_2026-07-23_archive_v5.md',
  'PROJECT_PLAN_2026-07-23_archive_v6.md',
  'PROJECT_PLAN_2026-07-23_archive_v7.md',
  'PROJECT_PLAN_2026-07-24_audit-chain-cleanup.md',
  'PROJECT_PLAN_2026-08-19_auto-archive.md',
]

export const LOST_ANCHOR_LEDGER = [
  'PROJECT_PLAN_2026-07-20_pre-permission-runtime.md',
  'PROJECT_PLAN_2026-07-20_publish-task-archive.md',
  // PROJECT_PLAN_2026-09-23_bulk-archive.md 已于 d0beedb1b 入库 ⇒ 本行按上面的"清单腐烂"规矩删除,
  // 不得因为它"曾经缺失"就留着(留着就是替一条已成立的承诺继续喊未兑现)。
  'PROJECT_PLAN_archive_2026-08-20.md',
  ...NEVER_EXISTED,
]

/**
 * A1/A2/A3 的判定(纯函数,输入全部来自被审面):
 *  **A1** 盘上有 `PROJECT_PLAN_*.md` 而审面里没有 ⇒ 红。这正是 G-184 关掉的洞的另一半:
 *       归档内容只存在于本机一块磁盘时,既撑不起"完整内容在 archive"的承诺,也随时会随磁盘没。
 *  **A2** 计划文档里的占位点名的具体文件不在审面里 ⇒ 红;若该名字在 `LOST_ANCHOR_LEDGER` 里则只报数。
 *       写成通配(`PROJECT_PLAN_*.md`)的占位不参与 A2 —— 它没有点名,判不了。
 *  **A3**(G-192 新增)**归档件自己内部**的占位同样点名(元归档:归档文件里再写"完整内容在
 *       archive/<另一个文件>")。只看计划文档的 A2 对这一层是盲的 —— 实测 `2026-09-12` 那份
 *       元归档里嵌着 218 条占位,其中 12 个点名对象从未入库。判据、豁免与腐烂规矩与 A2 同形,
 *       只是**同一个文件不重复计债**(已被 A1/A2 点名的,这里跳过)。
 * ⚠️ A2/A3 的归属判据必须看 **faceFiles(该目录在审面上的全部文件)**而不是只看 `PROJECT_PLAN_*`:
 *    归档目录里也放非该形状的锚点件(实测 `orphan-capabilities-equivalence-2026-09-24.md` 已跟踪),
 *    拿形状过滤后的清单去判点名 ⇒ 把"已入库"读成"落空",本门第一次自跑就是这么红给自己看的。
 */
export function anchorVerdict({ diskAnchors, faceFiles, planText, archiveText = '', ledger = LOST_ANCHOR_LEDGER }) {
  const red = []
  const baseline = []
  const onFace = new Set(faceFiles)
  const diskOnly = new Set()
  for (const f of diskAnchors) {
    if (!ANCHOR_RE.test(f)) continue
    if (!onFace.has(f)) {
      red.push(`A1 归档锚点只在本机、未进版本控制:.ihui-agent/archive/${f}`)
      diskOnly.add(f)
    }
  }
  const named = (text) =>
    new Set(
      [...String(text || '').matchAll(/\.ihui-agent[\\/]archive[\\/]([A-Za-z0-9._\-]+\.md)/g)].map((m) => m[1]),
    )
  const fromPlan = named(planText)
  const seen = new Set(diskOnly)
  const scan = (set, tag, hint) => {
    for (const f of [...set].sort()) {
      if (seen.has(f)) continue
      seen.add(f)
      if (onFace.has(f)) {
        if (ledger.includes(f)) red.push(`${tag} 台账腐烂:${f} 已回到审面,仍挂在 LOST_ANCHOR_LEDGER 里`)
        continue
      }
      if (ledger.includes(f)) {
        baseline.push(`${tag} 占位点名的归档文件不在审面:${f}(已登记存量,只报数)`)
        continue
      }
      red.push(`${tag} 占位点名的归档文件不在审面:${f} —— ${hint}`)
    }
  }
  scan(fromPlan, 'A2', '补回文件或改写占位,不得只删台账行')
  // A3 只扫 A2 没见过的名字:归档件正文里点名的对象
  scan(named(archiveText), 'A3', '归档件内部的占位点名了不存在的锚点(元归档层),补回或改写占位')
  return { red, baseline }
}

/** 从被审面读四件套:盘上文件名、审面上的文件名(全集)、计划文档正文、归档件正文合流(A3 用)。 */
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
  const facePaths = faceRaw.split('\0').filter(Boolean)
  const planSpec = face === 'staged' ? `:${FILE}` : `HEAD:${FILE}`
  let planText = catBatch(root, [planSpec], { timeout: 60000 }).get(planSpec) ?? ''
  if (face === 'worktree') planText = readWorktreeFile(root, FILE) ?? planText
  // A3 的取材面**必须与被审面同一个**:归档清单来自索引/HEAD,正文也就从同一个面取。
  // 单个 blob 取不到 ⇒ 跳过并如实计数,不因此判红(面与内容分叉时,宁可少判一层)。
  let archiveText = ''
  let archiveUndetermined = 0
  const anchorPaths = facePaths.filter((p) => ANCHOR_RE.test(p.split('/').pop()))
  if (anchorPaths.length) {
    const specs = anchorPaths.map((p) => (face === 'staged' ? `:${p}` : `HEAD:${p}`))
    let blobs
    try {
      blobs = catBatch(root, specs, { timeout: 60000 })
    } catch {
      blobs = new Map()
    }
    for (const spec of specs) {
      const src = blobs.get(spec)
      if (typeof src === 'string') archiveText += src
      else archiveUndetermined++
    }
  }
  let diskAnchors = []
  try {
    diskAnchors = existsSync(path.join(root, ARCHIVE_DIR)) ? readdirSync(path.join(root, ARCHIVE_DIR)) : []
  } catch {
    diskAnchors = []
  }
  return { diskAnchors, faceFiles, planText, archiveText, archiveUndetermined }
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
  // ===== A4「已完成条目被 union 复活」===== 2026-09-26 立,起因是当天三次实测:
  // 归档提交落地后,并发会话的**滞后工作树副本**经 union-converge 的行并集(max(本侧,对侧))
  // 把整批条目按回计划文档 —— 占位在、条目也回来了。A0 只挡"删条目不留占位",
  // 反方向(条目回来)过去**零判据**,所以谁都不知道自己把已归档的东西复活了。
  const PH_X = '<!-- 已归档(2026-01-02):X(已完成 ✅),完整内容在 .ihui-agent/archive/Y.md -->'
  t('A4 占位与同一条目并存 ⇒ 识别为复活(不是"凡有占位即红")', () => {
    const face = `### X(已完成 ✅)\n正文\n${PH_X}\n`
    const r = resurrectionVerdict('', face)
    return r.resurrected.length === 1 && r.introduced.length === 1
  })
  t('A4 归档完成态(占位在、条目不在)⇒ 复活集必须为 0', () => {
    const r = resurrectionVerdict('', `${PH_X}\n`)
    return r.resurrected.length === 0 && r.introduced.length === 0 && r.compliant
  })
  t('A4 上一版已复活 ⇒ 本次不追账(只报数),否则就是一台与任何提交无关的恒红门', () => {
    const bad = `### X(已完成 ✅)\n${PH_X}\n`
    const r = resurrectionVerdict(bad, bad)
    return r.resurrected.length === 1 && r.introduced.length === 0 && r.compliant
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
  t('A1 与 A2 不得把同一个文件数成两处落空(盘上未入库又被占位点名)', () => {
    const f = 'PROJECT_PLAN_2099-01-02_auto-archive.md'
    const r = anchorVerdict({
      diskAnchors: [f],
      faceFiles: [],
      planText: `<!-- 已归档(2099-01-02):A,完整内容在 .ihui-agent/archive/${f} -->`,
      ledger: [],
    })
    return r.red.length === 1 && r.red[0].startsWith('A1')
  })
  t('A3 归档件内部的占位点名不存在的锚点 ⇒ 红(A2 只看计划文档,这一层原本无人看守)', () => {
    const f = 'PROJECT_PLAN_2099-03-01_archive.md'
    const r = anchorVerdict({
      diskAnchors: [],
      faceFiles: ['PROJECT_PLAN_2099-02-99_archive.md'],
      planText: '# 计划文档里没有这句指针',
      archiveText: `<!-- 已归档:Z,完整内容在 .ihui-agent/archive/${f} -->`,
      ledger: [],
    })
    return r.red.length === 1 && r.red[0].startsWith('A3') && r.red[0].includes(f)
  })
  t('A3 名字已在台账 ⇒ 只报数;已入库 ⇒ 绿(与 A2 同一条三段规矩)', () => {
    const f = 'PROJECT_PLAN_2099-03-02_archive.md'
    const miss = anchorVerdict({
      diskAnchors: [],
      faceFiles: [],
      planText: '',
      archiveText: `.ihui-agent/archive/${f}`,
      ledger: [f],
    })
    const present = anchorVerdict({
      diskAnchors: [f],
      faceFiles: [f],
      planText: '',
      archiveText: `.ihui-agent/archive/${f}`,
      ledger: [],
    })
    return miss.red.length === 0 && miss.baseline.length === 1 && present.red.length === 0 && present.baseline.length === 0
  })
  t('A3 已入库却仍挂台账 ⇒ 判清单腐烂,且标签必须是 A3(归因不能串到 A2 头上)', () => {
    const f = 'PROJECT_PLAN_2099-03-03_archive.md'
    const r = anchorVerdict({
      diskAnchors: [f],
      faceFiles: [f],
      planText: '',
      archiveText: `.ihui-agent/archive/${f}`,
      ledger: [f],
    })
    return r.red.length === 1 && r.red[0].startsWith('A3 台账腐烂')
  })
  t('A2 与 A3 点到同一个名字 ⇒ 只计一次(A2 先,不重复背债)', () => {
    const f = 'PROJECT_PLAN_2099-03-04_archive.md'
    const r = anchorVerdict({
      diskAnchors: [],
      faceFiles: [],
      planText: `.ihui-agent/archive/${f}`,
      archiveText: `.ihui-agent/archive/${f}`,
      ledger: [],
    })
    return r.red.length === 1 && r.red[0].startsWith('A2')
  })
  t('A3 台账腐烂与缺失必须能同时成立在不同名字上(集合不互相吞)', () => {
    const gone = 'PROJECT_PLAN_2099-03-05_archive.md'
    const rot = 'PROJECT_PLAN_2099-03-06_archive.md'
    const r = anchorVerdict({
      diskAnchors: [rot],
      faceFiles: [rot],
      planText: '',
      archiveText: `.ihui-agent/archive/${gone} .ihui-agent/archive/${rot}`,
      ledger: [gone, rot],
    })
    return r.red.length === 1 && r.red[0].includes(rot) && r.baseline.length === 1 && r.baseline[0].includes(gone)
  })
  t('A0 合规判据由 length 决定,不是由数组真值决定(空数组是**真值**)', () => {
    const v = deletionVerdict('### X(已完成 ✅)\n', '# plan\n')
    return (
      v.deletedHeadings.length === 1 &&
      v.addedPlaceholders.length === 0 &&
      v.compliant === false &&
      // 陷阱本体:`!v.addedPlaceholders` 恒为 false ⇒ 判"不合规"却一个字都不打印。
      // main() 曾就是这么写的,镜像测试端到端才暴露(见本文件尾部的说明)。
      Boolean(v.addedPlaceholders) === true
    )
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
  // 一律 process.exitCode 而非 process.exit() —— 见 main() 上方关于管道 flush 的说明。
  if (argv.includes('--self-test')) {
    process.exitCode = selfTest()
  } else {
    /**
     * `--root <dir>` = 显式**测试/人工夹具**通道(守门 70 同型:脚本按自身位置定 ROOT 之后,
     * `cwd` 就不再能把门指到别处;靠 cwd 的旧镜像测试因此全数在扫真仓而不自知)。
     * 生产调用一律不带本旗,语义与不带时逐字相同。目录缺失 ⇒ exit 2,不冒红也不冒绿。
     */
    const ri = argv.indexOf('--root')
    const argRoot = ri === -1 ? null : argv[ri + 1]
    if (ri !== -1 && (!argRoot || argRoot.startsWith('--') || !existsSync(argRoot))) {
      console.error(`❌ 无法判定:--root 需要一个存在的目录(实得 ${JSON.stringify(argRoot ?? null)})`)
      process.exitCode = 2
    } else {
      const { face, error } = selectFace({
        staged: argv.includes('--staged'),
        worktree: argv.includes('--worktree'),
        def: 'head',
      })
      if (error) {
        console.error(`❌ 无法判定: ${error}`)
        process.exitCode = 2
      } else {
        process.exitCode = main(face, argRoot ? path.resolve(argRoot) : ROOT)
      }
    }
  }
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
