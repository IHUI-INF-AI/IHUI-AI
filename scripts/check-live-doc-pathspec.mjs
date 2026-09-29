#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 活文档「按旧副本提交会写回他人已入库行」对账(2026-09-29 立)
 *
 * ── 立因(不是假想,是本仓反复自伤的那一型)────────────────────────────────
 * `AGENTS.md` §12 有一条规矩:「提交活文档前必须做工作树 ⊇ HEAD 行级对账」。理由写得很直白 ——
 * `README.md` / `AGENTS.md` / `PROJECT_PLAN.md` 是多会话共写的文件,它们的**磁盘副本在这台机上
 * 常年滞后 HEAD**(本会话实测:计划文档工作树副本比 HEAD 少 3544 行 lost + 253 行 stale),而
 * `safe-commit.mjs` 第④步与 `git commit -- <path>` 取的都是**工作树字节**。于是"我只加 4 行"的
 * 一次规范提交,会把别人已经入库的登记行整批写回旧形态;`git status` 只显一个 `M`、diff 行数、
 * typecheck、守门 71 全都看不出来。实测在案:同一枚旁路落地(`c99b163ee5`)本该只加 4 行,实际
 * 把别人按守门 KR 合法删除的 25 行写回、并删掉 HEAD 里 3 行活内容,而链上 181 道门全绿。
 * **这条规矩此前只有散文、没有尺子** —— 而散文在本仓的失效形态永远是安静(守门 70/76/81 同族)。
 *
 * ── 判什么(只有一条)──────────────────────────────────────────────────
 * 对每一份"本次要被改掉"的活文档:**要被提交进去的那一份内容,必须逐字含住 HEAD 已有的每一条
 * 非空行**;含不住的按 `lost / superseded / stale` 三态分档,**只有 `lost` 参与判红**。
 * 三态判据的唯一实现是 `scripts/lib/live-doc-classify.mjs`(2026-09-29 从 `merge-live-doc.mjs`
 * 原样搬出,对外符号名与行为一字未动)。**本门不得自带第二份"什么算丢了"** —— 归并器和这道门问
 * 的是同一个问题,两处各算一遍必然漂开,而漂开的两个方向账面都是绿的:归并器判 lost 而行不插回,
 * 或门判 stale 而归并器把旧行插回(§22c 同一条理由)。镜像测试 T2 是一条源码形状锁。
 * 为什么不判 `superseded`/`stale`:前者是"有人把这行就地改写了"(正当编辑),后者是"副本停在更旧
 * 的前缀"(要人工取 HEAD 形态,`--apply` 反而会造出新旧并存)。把这两档判红就是逼人绕门。
 *
 * ── 三面取材(本仓现行口径,同 70/77/83/98/101/103/118)─────────────────
 *   缺省(全量/人工审计)= 判 **HEAD blob vs 它的父提交**,只报数不判红;`--strict` 才问责。
 *     为什么全量档刻意不判红:它判的是**已入库的历史**,与当前提交无关,挂 blocking 就是一台
 *     恒红门(§12e)—— 唯一结局是各会话 `--no-verify`,连带链上全部守门对该提交作废。
 *   `--staged`(提交链)= 判**索引 blob vs HEAD blob**,且**只判索引≠HEAD 的那几份文档**。
 *     索引==HEAD 的文档不参与判定、也**不计数为通过**(与本次提交无关的门不得替别人挡路,
 *     同守门 135 的回退口径);一份都不在提交面上时结论行明写"本轮无活文档在提交面上"。
 *   `--worktree` = 人工取证档(判磁盘副本 vs HEAD)。这一档在本机上**几乎必然大量红** ——
 *     磁盘滞后是常态而不是罪证,所以它只供人查,提交链绝不传它。
 *   两面旗同给 ⇒ **exit 2 判死**;任一面取不到(路径不存在 / 非 blob / git 失败 / 无父提交时
 *   的全量档如实说明)⇒ **exit 2「无法判定」并点名原因,绝不记绿也不冒红**;清单与正文
 *   **同面同轮**(一次 `catBatch` 读满,不混面)。
 *   ⚠️ 枚举到 0 份活文档 ⇒ exit 2 判死,不记通过(空扫与"都没违规"同形是本仓最贵的假绿)。
 *
 * ── 归档豁免(唯一一条"合法丢行"的通道)─────────────────────────────────
 * `AGENTS.md` §1 的归档两步走**本来就搬行**:条目正文搬进 `.ihui-agent/archive/PROJECT_PLAN_*.md`
 * 并在原位留占位。所以某行在提交份里不见了、但原文**逐字存在于归档面** ⇒ 不算丢。
 * 归档面按**被审判的那一面**取(`git ls-tree` / `git ls-files -s`,不 readdirSync 磁盘 ——
 * 守门 13c 的 A1/A2 立的正是"盘上有而面上没有不构成凭据");归档面整体取不到时,受影响的行
 * 计入「未判定」并点名,**绝不静默放过**。
 *
 * ── 修复出口(红字里会打印,只有这一条)────────────────────────────────
 *   `node scripts/merge-live-doc.mjs --file <该文档> --apply`
 * 它按锚点把 `lost` 段插回,并**如实区分** `superseded`(不插回)与 `stale`(不插回但要人工取
 * HEAD 形态)。本门刻意**不给行内豁免**:这一型没有"合法丢行"的写法 —— 真要删行,正解是归档
 * (§1 两步走)或合并之后显式 `git rm`,而不是把旧副本交上去。
 *
 * ── 读取预算(必须存在的第三条档,以及它为什么不是放宽判据)──────────────
 * `classifyMissing` 对每一条"缺失行"都要扫一遍"候选独有行"做相似度比较,是**乘性**成本。
 * 本机磁盘副本的实测规模(3544 lost + 3000 量级独有行)已接近分钟级,而提交链那一档的
 * `lost` 数量是十几行量级。所以本门给乘性那一维设一条**换算出来的**上限
 * (`MISSING_CLASSIFY_CAP`,依据写在常量旁),超上限 ⇒ 该文档计「未判定」并点名原因,
 * **不静默通过也不判红**。这与"跳过判定"的区别是本仓反复写的那一条:没判必须响。
 *
 * 用法:node scripts/check-live-doc-pathspec.mjs [--staged|--worktree|--strict|--json|--self-test]
 * 退出码:0 通过或只报数 / 1 检出 lost(仅 `--staged` 缺省判红、`--strict` 让全量档也判红)/
 *         2 无法判定(取材失败、两面旗同给、枚举到 0 份活文档、自检之外的脚本异常)
 *
 * 定级史(编号一律以 `scripts/guardian-runner.mjs` 现值为准,本文不钉死):本枚把它与注册条目、
 * AGENTS/README 点名**压进同一枚提交** —— 先注册后补脚本会让 HEAD 出现一条指向不存在脚本的注册,
 * 而守门 89 的 R1/R2/R4 对这一格结构上失明(它的候选集按"脚本在不在被审面"枚举),任何干净检出上
 * 这道门会以"脚本找不到"失败并挡住整批门。这是 README 表格门立项当夜撞到的事故,照它的前车办。
 */
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { classifyMissing } from './lib/live-doc-classify.mjs'
import { maskComments } from './lib/code-mask.mjs'

const SELF_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(dirname(SELF_DIR))

/** 三份多会话共写的活文档。判"哪些算登记行"的是 lib,不是这份清单 —— 清单只定射程。 */
const LIVE_DOCS = ['PROJECT_PLAN.md', 'AGENTS.md', 'README.md']
/** 归档面(§1 两步走的落点),按被审面枚举,不 readdirSync。 */
const ARCHIVE_DIR = '.ihui-agent/archive'
/** 归档件正文总读取预算:超过就不读全(归档目录实测随并发增长,读全会让一次判定吃掉分钟级 IO)。 */
const ARCHIVE_BUDGET_BYTES = 24 * 1024 * 1024

/**
 * 乘性成本档:某份文档有 N 条缺失行、M 条候选独有行时,lib 的比较量是 N×M。
 * 现测口径(2026-09-29,本机):`--staged` 那一档的 N 是十位数量级(索引与 HEAD 只差几行),
 * 而 `--worktree` 那一档的 N 是 3544 行 —— 后者本来就只供人工查。上限取 **600**:比提交链档
 * 可能出现的量高一个数量级(所以不会把真红挡在门外),又远低于把单轮判定拖到分钟级的量。
 * 超上限 ⇒ 判「未判定」并打印 N 与上限,**不是**判通过,也**不是**判红。
 */
const MISSING_CLASSIFY_CAP = 600

const trim = (l) => String(l ?? '').trim()

/**
 * 归档件清单(按被审面)。全量/`--worktree` 档判 HEAD 树,`--staged` 档判索引 ——
 * 与正文同面同轮,这样"同一枚提交里既归档又删行"才不会被读成丢行(§1 两步走)。
 */
function archiveList({ root, face }) {
  const args =
    face === 'staged'
      ? ['ls-files', '-s', '--', ARCHIVE_DIR]
      : ['ls-tree', '-r', '--name-only', 'HEAD', '--', ARCHIVE_DIR]
  const out = gitRaw(args, root, { timeout: 60000 })
  return (
    String(out ?? '')
      .split(/\r?\n/)
      // `ls-files -s` 的形态是 `<mode> <sha> <stage>\t<路径>`;末尾那个空行**没有制表符**,
      // 直接 `split('\t')[1].trim()` 会拿到 undefined 并抛 TypeError —— 而本函数一旦抛,调用方
      // 只能把"我没读到归档面"如实报成未判定(实测就把一次干净的 --staged 判成 rc=2)。
      // 所以这里先筛"确实带制表符的行",再取路径;空行与畸形行一律丢弃,不猜。
      .map((l) => {
        const s = String(l ?? '')
        if (!s.trim()) return ''
        if (face !== 'staged') return s.trim()
        const i = s.indexOf('\t')
        return i < 0 ? '' : s.slice(i + 1).trim()
      })
      .filter((p) => p && p.startsWith(`${ARCHIVE_DIR}/`))
  )
}

/** 归档件正文里的行集合(用于逐字豁免)。任何一步取不到都返回 `{ok:false, reason}` 而不是一行没有。 */
function archiveLineSet({ root, face, need }) {
  if (!need) return { ok: true, set: new Set(), files: 0, note: '' }
  let files = []
  try {
    files = archiveList({ root, face })
  } catch (e) {
    return { ok: false, set: new Set(), files: 0, reason: `归档面枚举失败:${oneLine(e)}` }
  }
  if (!files.length)
    return {
      ok: false,
      set: new Set(),
      files: 0,
      reason: `归档面枚举到 0 个文件(${ARCHIVE_DIR}/)⇒ 不构成豁免凭据`,
    }
  const specs = files.map((p) => `${face === 'staged' ? ':' : 'HEAD:'}${p}`)
  let texts
  try {
    texts = catBatch(root, specs, { maxBuffer: ARCHIVE_BUDGET_BYTES })
  } catch (e) {
    return { ok: false, set: new Set(), files, reason: `归档件正文批量读取失败:${oneLine(e)}` }
  }
  const set = new Set()
  for (const t of texts.values()) for (const l of String(t ?? '').split(/\r?\n/)) set.add(trim(l))
  return { ok: true, set, files: files.length }
}

/** 惰性归档面:只有"真的有缺失行要复核"时才付这 20MB 的读取成本(本仓实测一次全量读约 40s)。 */
function lazyArchive({ root, face }) {
  let cached = null
  return (need) => {
    if (!need) return { ok: true, set: new Set(), files: 0, note: '本轮没有缺失行需要归档面复核' }
    if (!cached) cached = archiveLineSet({ root, face, need: true })
    return cached
  }
}

/** HEAD 面用 `<rev>:<path>`,索引面用 `:<path>`。 */
const faceSpec = (face) => (face === 'staged' ? ':' : 'HEAD:')
const oneLine = (e) =>
  String(e?.message ?? e ?? '')
    .split(/\r?\n/)[0]
    .slice(0, 160)

/**
 * 单份文档的判定。返回三态计数 + 逐条站点 + 未判定原因;`参与判定=false` 表示这一档根本不该
 * 由它说话(提交链上索引==HEAD ⇒ 本次没改它),调用方**不得**把它算成通过。
 */
function judgeDoc({ doc, baseText, candText, archive, face }) {
  const out = {
    doc,
    inScope: false,
    absent: false,
    lost: [],
    superseded: 0,
    stale: [],
    archivedExempt: 0,
    undetermined: [],
    baseLines: 0,
    candLines: 0,
  }
  /**
   * "这一档里两份都取不到"与"取到了但内容不同"是两件事,必须分开:
   *  - 基准与候选**都**没有 ⇒ 该文档压根不在这座仓里(夹具仓、只检出了部分路径的检出、
   *    别的 checkout)⇒ 判 `absent` 并跳过,**不记通过也不记未判定** —— 把"这座仓没有计划文档"
   *    报成未判定,等于让每一次在子集仓里的运行都变成 rc=2 的死锁;
   *  - 只有候选没有 ⇒ 可能是整文件被 `git rm`,也可能是取不到 ⇒ **未判定**(不猜成红,也不洗成绿);
   *  - 只有基准没有候选 ⇒ 同上。
   */
  if (baseText === null && candText === null) {
    out.absent = true
    return out
  }
  if (baseText === null || candText === null) {
    out.undetermined.push(
      `${doc}:取不到${baseText === null ? '基准' : '候选'}正文(面=${face})⇒ 未判定,不记通过`,
    )
    return out
  }
  // CRLF/LF:HEAD blob 常是 LF 而工作树常是 CRLF,不剥 `\r` 会把同一条标题读成"删除"(13c 踩过)。
  const base = String(baseText).replace(/\r\n/g, '\n').split('\n')
  const cand = String(candText).replace(/\r\n/g, '\n').split('\n')
  out.baseLines = base.length
  out.candLines = cand.length
  out.inScope = String(baseText) !== String(candText)
  if (!out.inScope) return out

  const candSet = new Set(cand.map(trim).filter(Boolean))
  const missing = base.filter((l) => trim(l) && !candSet.has(trim(l)))
  // 归档豁免先做减法:§1 的搬行不是丢行。归档面取不到时,这些行整批判「未判定」而不是"没豁免所以红"。
  // `archive` 允许是**函数**(生产路径给惰性的:没有缺失行就不去读那 20MB),也允许是直接的对象(自检)。
  const getArchive = typeof archive === 'function' ? archive : () => archive
  let afterArchive = missing
  if (missing.length) {
    const ar = getArchive(true)
    if (!ar.ok) {
      out.undetermined.push(
        `${doc}:${missing.length} 条缺失行需要归档面复核,而归档面取不到(${ar.reason})⇒ 未判定`,
      )
      return out
    }
    afterArchive = missing.filter((l) => {
      const hit = ar.set.has(trim(l))
      if (hit) out.archivedExempt += 1
      return !hit
    })
  }
  if (afterArchive.length > MISSING_CLASSIFY_CAP) {
    out.undetermined.push(
      `${doc}:待分类的缺失行 ${afterArchive.length} 条 > 乘性成本上限 ${MISSING_CLASSIFY_CAP} ⇒ 未判定(` +
        `这一档出现在 ${face} 面;提交链那档的量级是十位行,不会走到这里)`,
    )
    return out
  }
  const verdict = classifyMissing(base, cand)
  for (const [line, kind] of verdict) {
    if (!afterArchive.some((l) => trim(l) === line)) continue
    if (kind === 'lost') out.lost.push(line)
    else if (kind === 'stale') out.stale.push(line)
    else out.superseded += 1
  }
  return out
}

/**
 * 每档的"基准 rev / 候选取材"表。**这张表是本门唯一的取材口径**,不得在别处再抄一份:
 *  - head    :基准 `HEAD^` ⊦ 候选 `HEAD` ⇒ "最新一枚已入库提交有没有写回旧态"(旁路落地的那一型)
 *  - staged  :基准 `HEAD`  ⊦ 候选**索引**  ⇒ "这次要提交进去的是哪一份"(提交链那一档)
 *  - worktree:基准 `HEAD`  ⊦ 候选**磁盘**  ⇒ 仅人工取证(磁盘常年滞后,这一档几乎必红)
 * 取不到的一侧一律 null ⇒ 由 judgeDoc 落成「未判定」,不回落另一个面(回落就是把"没判"写成"判过了")。
 */
const FACE_PLAN = {
  head: { baseRev: 'HEAD^', cand: 'git', candSpec: (d) => `HEAD:${d}` },
  staged: { baseRev: 'HEAD', cand: 'git', candSpec: (d) => `:${d}` },
  worktree: { baseRev: 'HEAD', cand: 'disk', candSpec: () => null },
}

/**
 * 主判定。`strict` 只改"全量档要不要问责",不改判据本身。
 */
export function run({ root = REPO_ROOT, face = 'head', strict = false } = {}) {
  const res = {
    face,
    docs: [],
    skipped: [],
    absent: [],
    undetermined: [],
    lostTotal: 0,
    red: false,
    participating: 0,
  }
  const plan = FACE_PLAN[face]
  if (!plan) {
    res.undetermined.push(`未知判定面 ${face}`)
    return res
  }
  // 一次 catBatch 把「基准 ⊕ 候选 ⊕ 归档」同面同轮读满。混面取数会产出自洽而错位的尺子。
  const specs = []
  for (const d of LIVE_DOCS) {
    specs.push(`${plan.baseRev}:${d}`)
    if (plan.cand === 'git') specs.push(plan.candSpec(d))
  }
  let texts
  try {
    texts = catBatch(root, specs)
  } catch (e) {
    res.undetermined.push(`正文批量读取失败:${oneLine(e)}`)
    return res
  }
  const get = (s) => (texts.has(s) ? texts.get(s) : null)
  const candOf = (d) => {
    if (plan.cand === 'git') return get(plan.candSpec(d))
    try {
      return readWorktreeFile(root, d)
    } catch (e) {
      return null
    }
  }
  // 归档面**只在真有缺失行要复核时**才读(见 lazyArchive):健康仓库两档都是零缺失,
  // 不该每次付 51 个归档件 / 约 20MB。取不到的原因由各文档逐条点名,不在这里代判。
  const archive = lazyArchive({ root, face: face === 'worktree' ? 'head' : face })

  for (const d of LIVE_DOCS) {
    const r = judgeDoc({
      doc: d,
      baseText: get(`${plan.baseRev}:${d}`),
      candText: candOf(d),
      archive,
      face,
    })
    res.docs.push(r)
    if (r.absent) {
      res.absent.push(d)
      continue
    }
    if (!r.inScope && r.undetermined.length === 0) res.skipped.push(d)
    else res.participating += 1
    for (const u of r.undetermined) res.undetermined.push(u)
    res.lostTotal += r.lost.length
  }
  res.red = res.lostTotal > 0 && (face === 'staged' || strict)
  return res
}

function report(res, { json }) {
  if (json) {
    console.log(JSON.stringify(res, null, 2))
    return res.red ? 1 : res.undetermined.length ? 2 : 0
  }
  const label = {
    head: 'HEAD^→HEAD(全量审计)',
    staged: '索引 vs HEAD(提交链)',
    worktree: '磁盘 vs HEAD(仅人工)',
  }[res.face]
  console.log(`活文档写回对账 · 判定面=${label}`)
  for (const d of res.docs) {
    if (d.absent) {
      console.log(`  ${d.doc}:该仓的两侧都没有这份文档 ⇒ 跳过(既不记通过,也不算未判定)`)
      continue
    }
    const state = d.undetermined.length
      ? '未判定'
      : !d.inScope
        ? '本次未改动它(不记通过也不记红)'
        : d.lost.length
          ? `❌ 丢 ${d.lost.length} 条已入库行`
          : '✅ 逐字含住基准面'
    console.log(`  ${d.doc}:基准 ${d.baseLines} 行 / 候选 ${d.candLines} 行 · ${state}`)
    for (const l of d.lost.slice(0, 8)) console.log(`     - ${l.slice(0, 120)}`)
    if (d.lost.length > 8) console.log(`     … 另 ${d.lost.length - 8} 行`)
    if (d.stale.length) {
      console.log(
        `     ⚠️ 工作副本停在旧形态 ${d.stale.length} 行(不判红,但提交会把它们退回旧态;要人工取 HEAD 形态)`,
      )
      for (const l of d.stale.slice(0, 4)) console.log(`       · ${l.slice(0, 110)}`)
    }
    if (d.superseded) console.log(`     ↻ 被就地改写取代 ${d.superseded} 行(正当编辑,不插回不判红)`)
    if (d.archivedExempt)
      console.log(`     ⌂ 随 §1 两步走归档搬走 ${d.archivedExempt} 行(不构成丢行)`)
  }
  for (const u of res.undetermined) console.log(`  ❔ 未判定:${u}`)
  const tail =
    `结论:参与判定 ${res.participating} 份 / 未改动跳过 ${res.skipped.length} 份 / 不在本仓 ${res.absent.length} 份 · ` +
    `lost ${res.lostTotal} · 未判定 ${res.undetermined.length}` +
    (res.red
      ? ' ⇒ 判红'
      : res.lostTotal && res.face !== 'staged'
        ? ' ⇒ 只报数(全量档;问责跑 --strict)'
        : '')
  console.log(tail)
  // 三份全都不在这座仓里 ⇒ **判死**。这与"三份都没被改动"是两件事:后者是合法的 exit 0
  // (本次提交与活文档无关),前者是尺子根本没落到被审对象上 —— 而"枚举到 0"读起来和
  // "扫过了、没问题"一模一样,是本仓最贵的那一类假绿(守门 70/77/118 同一课)。
  if (res.absent.length === res.docs.length && res.docs.length > 0) {
    console.error('❌ 枚举到 0 份在仓的活文档 ⇒ 判死(空扫与"都没违规"同形,不得记通过)')
    return 2
  }
  if (res.red)
    console.log(
      '  修复出口(唯一一条):`node scripts/merge-live-doc.mjs --file <该文档> --apply` —— 它只补 lost,' +
        '不补 stale(那条要人工取 HEAD 形态)。禁止用"改判据/加豁免"消红:这一型没有合法丢行的写法,' +
        '真要删行走 §1 归档两步走或合并之后显式 `git rm`。',
    )
  return res.red ? 1 : res.undetermined.length ? 2 : 0
}

/**
 * 构造面自检(零副作用)。每条 `cond` 都是**已求值的布尔** —— 本仓有大量自检把函数当条件传进
 * 登记器,`!!(() => {})` 恒真 ⇒ 打印"N/N 通过"而一条都没判过(守门 150 票㉛ 实测 8 条同型)。
 */
export function selfTest() {
  const rows = []
  const t = (name, cond) => {
    if (typeof cond === 'function') {
      rows.push({ name, ok: false, why: 'cond 是函数 ⇒ 断言从未求值(应写成 (() => {...})())' })
      return
    }
    rows.push({ name, ok: !!cond, why: '' })
    console.log(`${!!cond ? '✓' : '✗'} ${name}`)
  }
  const base = [
    '# 头',
    '- **闸门甲**(7):旧口径把 merge 与 cherry-pick 一起整轮放行,取证 8 例',
    '- 无关行',
  ].join('\n')

  t(
    '① 逐字含住 ⇒ 参与判定且 lost 0',
    (() => {
      const r = judgeDoc({
        doc: 'X.md',
        baseText: base,
        candText: base + '\n- 新加的一行,足够长到不会与任何旧行混淆,这是一条纯新增登记行的正文',
        archive: { ok: true, set: new Set() },
        face: 'staged',
      })
      return r.inScope && r.lost.length === 0
    })(),
  )

  t(
    '② 整行消失且无归档凭据 ⇒ 判 lost(本门的存在理由)',
    (() => {
      const r = judgeDoc({
        doc: 'X.md',
        baseText: base,
        candText: '# 头\n- 无关行\n- 另一行足够长以避开相似度误判,它跟闸门甲没有任何共同词元内容',
        archive: { ok: true, set: new Set() },
        face: 'staged',
      })
      return r.lost.length === 1
    })(),
  )

  t(
    '③ 同一行在归档面逐字存在 ⇒ 计归档豁免,不算丢(§1 两步走)',
    (() => {
      const moved = trim(base.split('\n')[1])
      const r = judgeDoc({
        doc: 'X.md',
        baseText: base,
        candText: '# 头\n- 无关行\n- 另一行足够长以避开相似度误判,它跟闸门甲没有任何共同词元内容',
        archive: { ok: true, set: new Set([moved]) },
        face: 'staged',
      })
      return r.lost.length === 0 && r.archivedExempt === 1
    })(),
  )

  t(
    '④ 反向对照:归档面取不到时,缺失行判"未判定"而不是判红也不是判绿',
    (() => {
      const r = judgeDoc({
        doc: 'X.md',
        baseText: base,
        candText: '# 头\n- 无关行\n- 另一行足够长以避开相似度误判,它跟闸门甲没有任何共同词元内容',
        archive: { ok: false, set: new Set(), files: 0, reason: '测试注入' },
        face: 'staged',
      })
      return r.lost.length === 0 && r.undetermined.length === 1
    })(),
  )

  t(
    '⑤ 索引==HEAD 的文档不参与判定,也不被记成通过',
    (() => {
      const r = judgeDoc({
        doc: 'X.md',
        baseText: base,
        candText: base,
        archive: { ok: true, set: new Set() },
        face: 'staged',
      })
      return r.inScope === false && r.lost.length === 0 && r.undetermined.length === 0
    })(),
  )

  t(
    '⑥ 工作副本停在旧形态(基准侧翻勾+追加注记)⇒ 判 stale,不判 lost 也不判红',
    (() => {
      const newer =
        '- [x] ✅(2026-09-25) 计划任务 `IHUI-C-Drive AutoMaintain` 仍未注册(注册 = 影响全机的删除动作,须用户授权); 〔追加一条取证注记把这行拉长〕'
      const older =
        '- [ ] 计划任务 `IHUI-C-Drive AutoMaintain` 仍未注册(注册 = 影响全机的删除动作,须用户授权);'
      const r = judgeDoc({
        doc: 'X.md',
        baseText: [
          '# 头',
          newer,
          '- 另一行完全无关的长登记行正文,用于让候选独有集合非空,避免把整份文档读成空',
        ].join('\n'),
        candText: [
          '# 头',
          older,
          '- 另一行完全无关的长登记行正文,用于让候选独有集合非空,避免把整份文档读成空',
        ].join('\n'),
        archive: { ok: true, set: new Set() },
        face: 'staged',
      })
      // 这一对夹具逐字取自 lib 自检的 ⑰(§22c:判据的对象是"某文件的真实形态"时,夹具必须取自
      // 那个文件或它的同族真行,自造形状只会让自检变成复读机)。第一版我自造了带 `**粗体**` 锚点
      // 的一对,结果 anchor 通道先把它判成 superseded ⇒ ⑥ 红,而红的正是我这条新写的断言。
      return r.lost.length === 0 && r.stale.length === 1
    })(),
  )

  t(
    '⑦ CRLF:同一行只差换行形态时不得读成删除',
    (() => {
      const r = judgeDoc({
        doc: 'X.md',
        baseText: base,
        candText: base.split('\n').join('\r\n'),
        archive: { ok: true, set: new Set() },
        face: 'staged',
      })
      return r.lost.length === 0 && r.inScope === true
    })(),
  )

  t(
    '⑧ 取不到正文 ⇒ 未判定(不得静默放过)',
    (() => {
      const r = judgeDoc({
        doc: 'X.md',
        baseText: null,
        candText: base,
        archive: { ok: true, set: new Set() },
        face: 'staged',
      })
      return r.undetermined.length === 1 && r.lost.length === 0
    })(),
  )

  t(
    '⑨ 超乘性上限 ⇒ 未判定并点名数量,既不冒红也不记绿',
    (() => {
      const many = [
        '# 头',
        ...Array.from(
          { length: MISSING_CLASSIFY_CAP + 5 },
          (_, i) =>
            `- **闸${i}** 这是一条足够长的缺失登记行正文,用来把数量推过乘性成本上限档位设置`,
        ),
      ].join('\n')
      const r = judgeDoc({
        doc: 'X.md',
        baseText: many,
        candText: '# 头\n- 只有一行,其余全部不在候选面里出现,这一行也足够长以便避开短行过滤',
        archive: { ok: true, set: new Set() },
        face: 'staged',
      })
      return r.lost.length === 0 && r.undetermined.length === 1 && /未判定/.test(r.undetermined[0])
    })(),
  )

  t(
    '⑩ 全量档(head)有 lost 也只报数,提交链档(staged)才判红 —— 定级方向锁',
    (() => {
      const a = { face: 'head', lostTotal: 3, participating: 1, undetermined: [] }
      const b = { face: 'staged', lostTotal: 3, participating: 1, undetermined: [] }
      const mk = (o) => o.lostTotal > 0 && (o.face === 'staged' || false)
      return mk(a) === false && mk(b) === true
    })(),
  )

  t(
    '⑪ 三态判据只有 lib 那一份:归并器里不得再出现第二份 classifyMissing',
    (() => {
      /**
       * 这一条读**磁盘那份**,不是 HEAD 那份 —— 它证的是"我这工作树里只有一份实现"。
       * 用 HEAD 面会把自检变成"落地之后才可能绿"的锁(而落地前它必须能跑),那是把取证工具
       * 做成一台自我否证的机器。HEAD 面同一把锁的去处是镜像测试 T2,两边各管各的时机。
       *
       * 必须先遮注释再匹配(本枚实测踩到):`merge-live-doc.mjs` 的头注里**逐字写着**
       * "本文件里不得再出现 `function classifyMissing(`" —— 那是这条锁的说明书,而按字面匹配
       * 会让说明书本身判红。这是本仓记过的那一型:**说明性文字也会带执行性字符**
       * (门 103 的 `stripJsonc`、门 131 的"门把解释自己的散文判成违规"同族)。
       * 遮罩只用 `lib/code-mask.mjs` 那一份实现,不得在门里再写一份剥注释逻辑。
       */
      const raw = String(readWorktreeFile(REPO_ROOT, 'scripts/merge-live-doc.mjs') ?? '')
      const own = maskComments(raw)
      return (
        raw.length > 0 &&
        raw.includes('./lib/live-doc-classify.mjs') &&
        !/function classifyMissing\(/.test(own) &&
        !/function anchorKey\(/.test(own)
      )
    })(),
  )

  const bad = rows.filter((r) => !r.ok)
  console.log(`—— 自检 ${rows.length - bad.length}/${rows.length} 通过${bad.length ? ' ✗' : ' ✅'}`)
  for (const r of bad) console.log(`   ✗ ${r.name}:${r.why}`)
  return bad.length ? 1 : 0
}

function main(argv) {
  const has = (f) => argv.includes(f)
  if (has('--self-test')) return selfTest()
  const picked = selectFace({ staged: has('--staged'), worktree: has('--worktree'), def: 'head' })
  if (picked.error) {
    console.error(`❌ ${picked.error} ⇒ 无法判定`)
    return 2
  }
  const res = run({ root: REPO_ROOT, face: picked.face, strict: has('--strict') })
  if (!res.docs.length) {
    console.error('❌ 枚举到 0 份活文档 ⇒ 判死(空扫与"都没违规"同形,不得记通过)')
    return 2
  }
  return report(res, { json: has('--json') })
}

import { pathToFileURL } from 'node:url'
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error(`❌ 脚本自身异常:${oneLine(e)}`)
    process.exitCode = 2
  }
}

export const __test__ = { run, judgeDoc, selfTest, LIVE_DOCS, MISSING_CLASSIFY_CAP, archiveList }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
