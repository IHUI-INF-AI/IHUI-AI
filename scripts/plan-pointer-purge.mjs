#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * plan-pointer-purge.mjs —— PROJECT_PLAN.md「重复登记副本」指针行存量一次性清偿(2026-10-13 立)。
 *
 * 立因(用户原话):"我不想让它出现重复登记副本 根本不想 不要再看到 给我彻底根治!"
 * 存量实测(HEAD dba9853f1f 现读):带【归并】重复登记副本/不再单独派单 注记的登记行
 * 共 1508 行(未勾 1393 / 已勾 6 …),其中:
 *   - 682 行按复合主键或剥注记后正文,能匹配到**同面存活持有行**(外部持有行)⇒ 直接删除;
 *   - 其余(族内互为副本 / 持有行已完成 / 纯指针行 / 无主键)⇒ 分层处置,见下方四层。
 *
 * 分层处置(保守优先:少删胜过错删,每一条被删行都进归档台账可回溯):
 *   L1 外部持有行(未勾、非指针行,复合主键或剥注记正文等值)⇒ 删副本;副本带认领标记
 *      而持有行没有 ⇒ 认领标记**先转移到持有行**再删(实测 8 条,不许让认领随删除消失)。
 *   L2 族内归并:同主键/同剥注记正文的候选 ≥2 且无外部持有行 ⇒ 保留一条(优先带认领的),
 *      其余删除。
 *   L3 纯指针行:剥掉注记后正文只剩复选框/空白 ⇒ 删除(它本身不承载任务内容)。
 *   L4 剥注记保留:其余候选行只剥掉 〔【归并】…〕 注记,行本身保留 —— 它们的正文是
 *      实质内容(普查样本:TEMP 指向、Esc 层栈协议等),误删 = 丢别人的活账。
 *
 * L5/L6 真归并(2026-10-14 增,用户指令延伸:「重复登记副本一条也不许再产生」之后,
 * 自动档(plan-tasks-merge --heal)已停产指针注记与 F10 折叠 ⇒ 台账上的无注记重复行
 * 没有任何出口会再收口,必须在这里做**真删行归并** —— 折叠注记那条路已被明令封死):
 *   L5 同题折并(F10):foldTwins 点名的可折行(同题面、不同编号、未勾选),持有行 =
 *      foldTwins 自己的 keeper(位置最靠前者,与报告口径同源,不得另选 —— 另选会让
 *      删完的面上 foldTwins 照旧报 edits,与 --twins/plan-tasks-merge 打架)。
 *   L6 同主键归并(F4):findDupOpenCopies 点名的副本行,幸存者 = 它的 survivor
 *      (组内最长行 —— 同样沿用判据自己的选择,理由同上)。
 *   两条准入闸(任一不满足 ⇒ 该行**跳过并逐行点名**,绝不硬删):
 *     ① 内容承载:候选行剥掉复选框/行首编号/粗体后的正文必须被幸存行**逐字包含**
 *        —— 候选的独有正文增量(实测:G-317 约 2000 字关键发现、G-341 整张独立票)
 *        不许随删行消失;假阳折叠(题面前缀相同而正文是两件事)在这一闸上自然豁免。
 *     ② 注记移植:候选行尾的 〔…〕/（…〕 段若幸存行没有 ⇒ 先移植(追加)到幸存行行尾,
 *        让让号记录/拍板/半程交付记录活在活行上而不是只活在归档里;移植后幸存行不得
 *        命中 DUP_POINTER_RE / SELF_DEDISPATCH_RE(否则等于绕开 13d 棘轮写注记,整行跳过)。
 *   认领牌护栏:候选带 `（进行中…）` 而幸存行不带 ⇒ 走既有认领转移(与 L1 同一机制);
 *     转移不成立(幸存行也在删除集)⇒ 跳过。
 *
 * 落地:对象空间(HEAD blob → 改写 → commit-tree → CAS),从不写工作树(2026-10-13 首轮
 * 直接改工作树曾被门 203/166 整批拦下,同日改走对象空间后闭环)。
 * 台账:全部被删行原文写入 .ihui-agent/archive/plan-pointer-purge-<日期>.md(入库;
 *   文件名带日期 —— 台账是整文件重写式,**绝不复用旧日期文件名**,否则旧台账的逐字
 *   记录被覆盖,60 提交窗口内已清偿行会在门 71 全量档"复活"判丢)。
 *   2026-10-15 复发止血:名字里还要带**机器标识**(口径 = lib/plan-id-lease.mjs 的
 *   machineIdentity),且换后缀的基准 = **本机 HEAD 面 ∪ 远端那一份**(与 live-doc-edit
 *   号段基准 G-313 出路② 同一条纪律)。旧实现只问本机 HEAD:两台机站在同一前沿时
 *   "下一个后缀"必然同值,同一晚各写出一份同名台账 ⇒ add/add 冲突、跨机合并卡死。
 *   远端面取不到 ⇒ 大声降级后按本地面取名;本地面取不到 ⇒ 拒绝取名不落(§0.3)。
 *   新名必须仍命中消费方射程:门 71 ARCHIVE_FILE_RE 的 `plan-pointer-purge-` 前缀、
 *   门 13c 归档点名字符集 [A-Za-z0-9._-](投影由 ledgerMachineTag 做,不自发明标识)。
 *
 * 守恒断言(任一不成立 ⇒ 整批不落,exit 1):
 *   A1 已勾选行数不减少(只许剥注记,不许动勾选状态)。
 *   A2 未勾选行的**任务语义不缩水**:每条被删行必须满足「L1 持有行仍在面 ∧ 正文等值(剥注记后)」
 *      或「L2/L3 同族保留行仍在面」—— 由 buildPlan 的分类结果直接给出,删行集必须 ⊆ 分类集。
 *   A3 清偿后全文件 DUP_POINTER_RE 与 SELF_DEDISPATCH_RE 命中归零(用户要的"不要再看到")。
 *   A4 认领标记 `（进行中…）` 总数不减少(8 条存量全部转移,不许静默丢失)。
 *
 * 用法: node scripts/plan-pointer-purge.mjs [--dry-run|--apply] [--absorb]
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const idx = require(path.join(ROOT, 'scripts/lib/plan-task-index.mjs'))
// L5(F10) 判据单一实现 = plan-tasks-merge 的 foldTwins(持有行规则与报告口径同源)。
// 环形引用说明:plan-tasks-merge → check-plan-dup-pointer-ratchet(取 countPointerRows)
// → 本脚本 → plan-tasks-merge,两侧都只在**函数体内**用对方导出 ⇒ ESM 循环安全。
import { foldTwins } from './plan-tasks-merge.mjs'
// 台账取名的两条同源纪律(2026-10-15 跨机同名止血,详见 chooseLedgerRel 的头注):
//  ① **机器标识口径不另发明** = `lib/plan-id-lease.mjs` 的 `machineIdentity()`
//     (env `IHUI_MACHINE_ID` > 主机名 + 仓根路径指纹 ⊕ machineGuid),与千段租约取号同一把尺;
//  ② **取名基准必须含远端那一份** = 与 `live-doc-edit.mjs` 号段基准(G-313 出路②)同一条纪律,
//     只是那里量的是"号",这里量的是"归档件名"。
import { machineIdentity } from './lib/plan-id-lease.mjs'
import { baseNameOf, parseZList } from './lib/plan-id-face.mjs'
// 判据同源:门 203(台账同题多号差值棘轮)的标题指纹就是它。本脚本分族若另抄一份归一化,
// 剥注记后必然出现"门 203 看见同题、我这边没看见"的撞车 —— 首版正是这么红的。
const { extractTaskFingerprint } = require(
  path.join(ROOT, 'scripts/check-plan-task-duplicates.mjs'),
)
const {
  alignSharedIndex,
  attestBypassCommit,
  casUpdateRef,
  commitTreeWithIndex,
  git: gitRead,
  resolveHeadRef,
} = require(path.join(ROOT, 'scripts/lib/bypass-git.mjs'))

const PLAN = 'PROJECT_PLAN.md'

/**
 * 台账正文交进 HEAD 之前必须带上溯源水印载荷(AGENTS §5c:生成器写盘后紧随注入)。
 *
 * 为什么这里绕一圈磁盘:本器走对象空间、**从不写工作树**,而零宽编码只有 `watermark.mjs`
 * 那一份实现 —— 在这里再写一份 encoder 就是 §0.6 禁止的第二份真相(必然漂移)。
 * 临时件落在 `.ihui-agent/tmp/<...>`(gitignored),用完即删;`inject` 幂等,已有载荷时是 no-op。
 *
 * @returns {{ok:true, text:string}|{ok:false, why:string}} 装不上就报原因,由调用方**拒绝落地**
 *   (方向是保守的:宁可不落、下一轮重跑,也不把无水印的归档件送进 HEAD —— 那正是
 *   2026-10-16 实测到的"每一枚 purge 台账都要有人在 CI 上重新发现一次红"的成因)。
 */
function ledgerWithWatermark(ledgerRel, text) {
  const stage = path.join(
    ROOT,
    '.ihui-agent',
    'tmp',
    'plan-pointer-purge-wm',
    path.basename(ledgerRel),
  )
  try {
    mkdirSync(path.dirname(stage), { recursive: true })
    writeFileSync(stage, text, 'utf8')
    const r = spawnSync(
      process.execPath,
      [path.join(ROOT, 'scripts', 'watermark.mjs'), 'inject', stage],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, timeout: 120_000 },
    )
    if (r.status !== 0) {
      return {
        ok: false,
        why: `watermark inject 退出码 ${r.status}:${String(r.stderr || '').split('\n')[0]}`,
      }
    }
    const out = readFileSync(stage, 'utf8')
    if (!out.includes('[IHUI-AI-PROVENANCE]:')) {
      return { ok: false, why: 'inject 跑完仍无载荷标记 ⇒ 不交进 HEAD(不猜它成功了)' }
    }
    return { ok: true, text: out }
  } catch (e) {
    return { ok: false, why: String(e?.message ?? e) }
  } finally {
    try {
      rmSync(stage, { force: true })
    } catch {
      /* 临时件删不掉不影响结论(在 gitignored 区) */
    }
  }
}

// 台账文件名必须带**本次运行日期**:整文件重写式,复用旧日期 = 抹掉旧台账的逐字记录 =
// 门 71 在 60 提交窗口内把已清偿行判丢并回捞(对打循环复活)。见头注「台账」段。
// 2026-10-16 存档机制退役(机主令:完成即删):purge 台账落点随之迁出归档目录 ——
// .ihui-agent/archive/ 已整体出版本控制并整目录忽略,新台账一律落 .ihui-agent/tmp/(gitignored,
// 只作本机取证,不再入库;被删行原文凭 git 历史可查,无需入库台账)。门 71 已改为"已勾行不进
// 保护集",清偿带走的行不再触发回捞,本台账从"防回捞凭据"降级为纯本机留痕。
const LEDGER_REL = '.ihui-agent/tmp/plan-pointer-purge-2026-10-14.md'
const GIT = process.env.GIT_BIN || 'git'
/** 归档台账所在目录 —— 由 LEDGER_REL 自身推出,不另写第二份路径常量。 */
const LEDGER_DIR_REL = LEDGER_REL.slice(0, LEDGER_REL.lastIndexOf('/'))
const LS_TREE_TIMEOUT_MS = 60_000
const LS_REMOTE_TIMEOUT_MS = 30_000

const DUP_POINTER_RE = idx.DUP_POINTER_RE
const SELF_DEDISPATCH_RE = idx.SELF_DEDISPATCH_RE
const CLAIM_RE = /（进行中[^）]*）/

/** 单轮剥掉注记段(深度匹配括号对,不贪婪截断)。
 *  三种括号对都要认(存量实测形态):〔…〕 标准注记 / 【…】 与 【【…】】 变体 / （…） 圆括变体。
 *  ⚠️ 括号对只有在**内容命中归并标记**(归并|重复登记副本|不再单独派单)时才整段剥除 ——
 *  `（）` 在中文正文里到处都是,不带标记的圆括内容一律原样保留(宁漏不误)。 */
function stripBracketsOnce(text) {
  const MARKER = /归并|重复登记副本|不再单独派单|派单一律走持有行|派单以|勿照本行/
  let out = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch !== '〔' && ch !== '【' && ch !== '（') {
      out += ch
      i++
      continue
    }
    const close = ch === '〔' ? '〕' : ch === '【' ? '】' : '）'
    let depth = 0
    let j = i
    for (; j < text.length; j++) {
      if (text[j] === ch) depth++
      else if (text[j] === close) {
        depth--
        if (depth === 0) break
      }
    }
    if (depth === 0 && MARKER.test(text.slice(i, j + 1))) {
      out += ' ' // 整段注记剥掉
      i = j + 1
    } else {
      out += ch
      i++
    }
  }
  return out
}

/** 剥到不动点(嵌套 〔〕 注记实测存在,单轮剥不净)。 */
export function stripMergeNotes(text) {
  let cur = text
  for (let round = 0; round < 6; round++) {
    const next = stripBracketsOnce(cur)
    if (next === cur) break
    cur = next
  }
  // 散文里孤立残留的注记(注记剥净后仍命中判据的行)一并摘除:
  //  ① 无括号散文型:`【归并】重复登记副本:…以…为准。`(存量 184 行里的主力形态,写在行首正文里)
  //  ② `**[归并]**` 强调前缀
  //  ③ 顽固短语"本行不再单独派单"(SELF_DEDISPATCH_RE 语义)
  return cur
    .replace(/(?:【归并】)?重复登记副本[::][^【〔。]*?以[^【〔。]*为准。/g, ' ')
    .replace(/\*\*\[归并\]\*\*\s*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[,，;；]?\s*本行不再单独派单[。.]?/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trimEnd()
}

const isCandidate = (line) => DUP_POINTER_RE.test(line) || SELF_DEDISPATCH_RE.test(line)
// 行形态:标准 `- [ ]`/`- [x]` 为主;另有存量残缺行(行首缺 `- `,如 `[x] ✅(2026-10-09)…`,
// 实测 2+ 处带注记)一并纳入 —— 用户要的是"不要再看到",按行清,不按格式挑。
const ROW_RE = /^\s*(?:[-*]\s*)?\[[ xX]\]/
const isRowLine = (line) => ROW_RE.test(line)
const isCheckedRow = (line) => /^\s*(?:[-*]\s*)?\[[xX]\]/.test(line)
const isOpenRow = (line) => /^\s*(?:[-*]\s*)?\[ \]/.test(line)
// 占位注释/归档引用(`<!-- … -->`)与纯散文里的注记**不碰**:① 渲染不可见;
// ② 占位文本是门 13c A2 锚点匹配的输入,改写会让已归档条目瞬间"点名落空"判红。
const isProse = (line) => /^\s*<!--/.test(line)

/** 分类规划(纯函数,可测):返回 {deleteSet, stripSet, claimTransfers, stats} */
export function buildPlan(lines, opts = {}) {
  // absorb(2026-10-15 立,G-32 归并侧那半格):对「正文未被幸存行逐字承载」的 L5/L6 副本,
  // 不再交人工干等 —— 把候选行的**归一化正文整段**移植成幸存行行尾的承载段,承载成立后折并候选。
  // 为什么必须整段:包含性判据是 `sLine.includes(body)` 一次成连,注记被替成空格后正文里带着
  // 空格洞,只补"看起来缺的那句"永远补不平(首版实测:移植后仍拒收 17 对)。
  // 三条硬护栏:① 候选/幸存任一带租约 ⇒ 不碰(那是他人正在做的活);② 承载段含 13d 判据字面 ⇒ 不碰;
  // ③ 正文长度低于该层 minBody 下限 ⇒ 不碰(证明力不足,与不 absorb 同向)。失效方向永远是"少折一行"。
  const absorb = opts.absorb === true
  const rows = []
  lines.forEach((l, i) => {
    if (isRowLine(l) && !isProse(l)) rows.push({ i, line: l })
  })
  const candidates = rows.filter((r) => isCheckedRow(r.line) === false && isCandidate(r.line))
  const holders = rows.filter((r) => isCheckedRow(r.line) === false && !isCandidate(r.line))
  const bareOf = (l) => stripMergeNotes(stripMergeNotes(l).replace(CLAIM_RE, '')).trim()
  const claimOf = (l) => (CLAIM_RE.exec(stripMergeNotes(l)) || [null])[0]
  const keyOf = (l) => idx.compositeKeyOf(stripMergeNotes(l))
  // 分族键:**指纹优先**(与门 203 的量纲完全对齐),其次复合主键,最后剥注记正文。
  // 首版用复合主键优先是错的 —— 不同票号(G-164 / G-1106294)抄的同一段正文,
  // 复合主键把它们分成两族、各自保留一行,剥掉注记后露出同一副指纹 ⇒ 门 203 读成
  // 「同一件事的第二次登记」(实测 139 键判红)。指纹优先 ⇒ 同题族只留一行,正是
  // 门 203 的修法①「同题多号收拢」。
  const famKeyOf = (l) => {
    const bare = stripMergeNotes(l).replace(CLAIM_RE, '')
    const fp = extractTaskFingerprint(bare)
    if (fp) return `F:${fp}`
    const k = keyOf(l)
    if (k) return `K:${k}`
    return `B:${bare}`
  }

  // 持有行索引:统一按 famKey(复合主键 ∪ 指纹 ∪ 剥注记正文)—— 与门 203 的"同题"口径同源
  const holderByFam = new Map()
  for (const h of holders) {
    const fk = famKeyOf(h.line)
    if (!holderByFam.has(fk)) holderByFam.set(fk, [])
    holderByFam.get(fk).push(h)
  }

  const deleteSet = new Set()
  const stripSet = new Set() // 只剥注记保留的行
  const claimTransfers = [] // {from, to, claim}
  const stats = { L1: 0, L2: 0, L3: 0, L4: 0, checkedStripped: 0, L5: 0, L6: 0, L7: 0, absorbed: 0 }
  const reasons = new Map() // 行号 → 分类原因(给台账)

  const family = new Map() // 归并键 → 候选行集
  for (const c of candidates) {
    const k = famKeyOf(c.line)
    if (!family.has(k)) family.set(k, [])
    family.get(k).push(c)
  }

  for (const c of candidates) {
    const b = bareOf(c.line)
    const ext = holderByFam.get(famKeyOf(c.line)) || null
    const fam = family.get(famKeyOf(c.line)) || []
    const claim = claimOf(c.line)
    if (ext && ext.length > 0) {
      // L1:存在同题外部持有行 ⇒ 删副本
      deleteSet.add(c.i)
      stats.L1++
      const target = ext[0]
      if (claim && !claimOf(target.line)) {
        claimTransfers.push({ from: c.line, to: target.i, claim })
      }
      reasons.set(c.i, `L1 外部持有行 L${target.i + 1}`)
    } else if (fam.length > 1) {
      // L2 族内归并:保留一条,**优先非候选持有行**(带认领的持有行),其次带认领副本,再次首行
      const keep =
        fam.find((f) => !candidates.includes(f)) || fam.find((f) => claimOf(f.line)) || fam[0]
      if (keep.i !== c.i) {
        deleteSet.add(c.i)
        stats.L2++
        const kclaim = claimOf(keep.line)
        if (claim && !kclaim && !candidates.includes(keep))
          claimTransfers.push({ from: c.line, to: keep.i, claim })
        reasons.set(c.i, `L2 族内归并,保留 L${keep.i + 1}`)
      } else {
        stripSet.add(c.i)
        stats.L4++
      }
    } else if (b.length <= 30 && !claim) {
      // L3:剥注记后正文空/极短**且无认领标记** ⇒ 纯指针行。
      // ⚠️ 认领标记必须排除在外:带 `（进行中…）` 的行是有人在飞的活账,哪怕正文短也不许当纯指针删
      // (镜像测试 P2 抓到的第一版缺陷:短正文+认领被 L3 误吞,认领随删除消失)。
      deleteSet.add(c.i)
      stats.L3++
      reasons.set(c.i, 'L3 纯指针行(剥注记后无实质正文)')
    } else {
      // L4:实质内容,剥注记保留
      stripSet.add(c.i)
      stats.L4++
    }
  }

  // 已勾选但带注记的行:只剥注记,不动勾选(用户"不要再看到"包括这些)
  for (const r of rows) {
    if (isCheckedRow(r.line) && isCandidate(r.line)) {
      stripSet.add(r.i)
      stats.checkedStripped++
    }
  }

  // ── L5/L6 真归并(2026-10-14):无注记的 F10/F4 重复行 ──
  // 自动档(plan-tasks-merge --heal)已停产指针注记与 F10 折叠(用户指令「重复登记副本
  // 一条也不许再产生」)⇒ 台账上的无注记重复行不再有任何自动出口,在这里做真删行归并。
  // 两条准入闸(任一不满足 ⇒ 该行跳过并逐行点名,绝不硬删):① 正文被幸存行逐字承载;
  // ② 行尾独有注记段移植到幸存行,且移植后幸存行不得命中 13d 的两条判据字面。
  const transplants = [] // {to: 0-based 幸存行下标, text: 追加段}
  const skipped = [] // {i, why} 逐行点名(i=-1 = 整层未判定)
  const bodyOf = (raw) =>
    raw
      .replace(/^\s*(?:[-*]\s*)?\[\s?\]\s*/, '') // 复选框(`]`后可直接跟 `**`,实测 L7548 形态)
      .replace(/^\*\*/, '') // 行首粗体
      .replace(/^\s*[A-Za-z]{1,3}-?\d{1,8}(?:\.\d+)?\.?\s+/, '') // G-1038426. / D172(连字符可无)
      .replace(/^\s*\d{1,4}(?:\.\d+)?\.?\s+/, '') // 68. / 4. / 82.
      .trim()
  // 段提取(只认**命中注记措辞**的括号段):全角 〔〕/（） 与半角 () 都提,但必须命中下面的
  // 注记关键词才算段。⚠️ 这条过滤是拿真事故换的:G-317 那 2000 字正文整体包在全角括号里
  // (`（**等机主给值**——…）`),无过滤的提取会把正文当"注记"剥出来移植到幸存行行尾 ——
  // 内容虽守恒(移植不是丢弃),但那是把 2000 字关键发现硬塞进另一行行尾,判据在硬凑。
  // 关键词取窄(让号/原编号/拍板@/半程@/二次改派 = 让号与拍板注记的实际形态;「拍板」裸词
  // 不收 —— 正文里 `（等人拍板）` 到处都是)。没被认成段的正文留在 body 里参与包含性,
  // 包含失败 ⇒ 该行跳过交人工 —— 保守方向永远是跳过,不是硬删。
  const NOTE_WORD =
    /归并|重复登记副本|不再单独派单|派单一律走持有行|让号|原编号|拍板@|半程@|二次改派/
  const segsOf = (raw) =>
    (raw.match(/〔[^〕]*〕|（[^）]*）|\([^()]*\)/g) || []).filter((s) => NOTE_WORD.test(s))
  const tryTrueMerge = (ci, si, layer, minBody) => {
    if (deleteSet.has(ci) || stripSet.has(ci)) return // 既有层已处置
    if (si < 0 || si >= lines.length) {
      skipped.push({ i: ci, why: `${layer} 幸存行下标越界 ⇒ 跳过` })
      return
    }
    if (deleteSet.has(si) || stripSet.has(si)) {
      skipped.push({
        i: ci,
        why: `${layer} 幸存行 L${si + 1} 已被既有层处置 ⇒ 本行跳过(幸存行消失的删行 = 净丢活)`,
      })
      return
    }
    const cLine = lines[ci]
    const sLine = lines[si]
    const cClaim = claimOf(cLine)
    if (cClaim && !claimOf(sLine)) claimTransfers.push({ from: cLine, to: si, claim: cClaim })
    // 先剥注记段再算正文包含性:让号记录/拍板挂在行尾 〔…〕 里,幸存行的同类段措辞不同
    // (批② vs 批④),不剥掉它们,正文包含性永远假失败(首版实测 L7193/L10667 全军覆没)。
    const segsAll = segsOf(cLine)
    const stripped = segsAll.reduce((acc, s) => acc.replace(s, ' '), cLine)
    const body = bodyOf(stripped)
    // 吸收档(仅 --absorb):承载不成立时把候选行**归一化正文整段**挂到幸存行行尾,再由本器折并候选。
    const carried = (() => {
      if (!absorb || body.length < minBody || sLine.includes(body)) return null
      if (claimOf(cLine) || claimOf(sLine)) return null
      const seg = ` 〔副本正文并入·承载整段:${body}〕`
      if (DUP_POINTER_RE.test(sLine + seg) || SELF_DEDISPATCH_RE.test(sLine + seg)) return null
      return seg
    })()
    // 最短正文下限:L6 两行同复合主键(任务身份由键承载)取 6;L5 两行主键互异(唯一关联是
    // 题面)取 12 —— 下限之下包含性证明力不足,跳过交人工。
    if (body.length < minBody || (!sLine.includes(body) && !carried)) {
      skipped.push({
        i: ci,
        why: `${layer} 正文有幸存行 L${si + 1} 未承载的独有增量(body=${body.length} 字) ⇒ 交人工,不硬删(实测:G-317 约 2000 字关键发现、G-341 整张独立票、L10371 截断回放都是这一型)${
          absorb && body.length >= minBody ? ' [吸收档本可承载,被租约/13d 字面护栏拦下]' : ''
        }`,
      })
      return
    }
    const segs = segsAll.filter((s) => !sLine.includes(s))
    if (segs.length) {
      const appended = ' ' + segs.join(' ')
      const wouldBe = sLine + (carried || '') + appended
      if (DUP_POINTER_RE.test(wouldBe) || SELF_DEDISPATCH_RE.test(wouldBe)) {
        skipped.push({
          i: ci,
          why: `${layer} 注记移植会让幸存行 L${si + 1} 命中 13d 判据字面 ⇒ 整行跳过(不许绕棘轮写注记)`,
        })
        return
      }
      transplants.push({ to: si, text: appended })
    }
    if (carried) {
      transplants.push({ to: si, text: carried })
      stats.absorbed++
    }
    deleteSet.add(ci)
    stats[layer]++
    reasons.set(
      ci,
      `${layer} 真归并,保留 L${si + 1}${segs.length ? `(+${segs.length} 段注记移植)` : ''}${carried ? '(+正文承载段)' : ''}`,
    )
  }
  // L6(F4):findDupOpenCopies 的副本行,幸存者 = 判据自己的 survivor(组内最长行)——
  // 另选幸存者会让删完的面上 findDupOpenCopies 照旧点名新副本,债没清。
  try {
    for (const c of idx.findDupOpenCopies(idx.auditPlan(lines.join('\n')).dupOpen)) {
      tryTrueMerge(c.row.line - 1, c.survivor.line - 1, 'L6', 6)
    }
  } catch (e) {
    skipped.push({
      i: -1,
      why: `L6 判据未判定(${String(e?.message ?? e).slice(0, 80)})⇒ 本层整层跳过,不冒充通过`,
    })
  }
  // L5(F10):foldTwins 的可折行,持有行 = 判据自己的 keeperLine(位置最靠前者,同上理由)
  try {
    for (const e of foldTwins(lines).edits) {
      tryTrueMerge(e.line - 1, e.keeperLine - 1, 'L5', 12)
    }
  } catch (e) {
    skipped.push({
      i: -1,
      why: `L5 判据未判定(${String(e?.message ?? e).slice(0, 80)})⇒ 本层整层跳过,不冒充通过`,
    })
  }

  // L7(F4b,2026-10-15 立):无复合主键而**逐字等值**的未勾选孪生行。判据单源 = 门 130 用的
  // `idx.findVerbatimDupOpenRows`(不在本器复制一份,§22c)。这一层与 L5/L6 的区别是它**不需要承载段**:
  // 两行逐字相同 ⇒ 幸存行本来就装着全部内容,删多余份数是零信息差的动作。
  // 唯一护栏:任一副本带租约 ⇒ 跳过(那是他人正在做的活,哪怕文字相同也不由本器代摘)。
  try {
    const vd = idx.findVerbatimDupOpenRows(lines.join('\n'))
    for (const c of vd.copies) {
      const ci = c.row.line - 1
      if (deleteSet.has(ci) || stripSet.has(ci)) continue
      const si = c.survivor.line - 1
      // 租约:本层的两行**逐字等值**(判据就是 r.raw 全等),所以副本行上的 `（进行中@…）` 与幸存行
      // 上的必然同文 ⇒ 删副本不会摘掉任何人的认领(§1「门绝不自动摘除任何人的认领」)。
      // 不"相信构造",当场比一次:不同文 ⇒ 跳过交人工。
      if (claimOf(c.row.raw) && claimOf(c.row.raw) !== claimOf(c.survivor.raw)) {
        skipped.push({ i: ci, why: `L7 副本与幸存行认领标记不同文 ⇒ 不折(不得代摘他人认领)` })
        continue
      }
      deleteSet.add(ci)
      stats.L7++
      reasons.set(ci, `L7 逐字孪生折并,保留 L${si + 1}`)
    }
  } catch (e) {
    skipped.push({
      i: -1,
      why: `L7 判据未判定(${String(e?.message ?? e).slice(0, 80)})⇒ 本层整层跳过,不冒充通过`,
    })
  }

  return {
    deleteSet,
    stripSet,
    claimTransfers,
    transplants,
    skipped,
    stats,
    reasons,
    holders,
    candidates,
    bareOf,
    keyOf,
    famKeyOf,
  }
}

/** 构建清偿后的文档(纯函数)。 */
export function renderPurge(lines, plan) {
  const out = lines.slice()
  // 先做认领转移(写进保留的持有行;锚定行首勾选框,不重复缩进)
  for (const t of plan.claimTransfers) {
    const stripped = stripMergeNotes(out[t.to]).replace(/\s{2,}/g, ' ')
    out[t.to] = stripped.replace(/^(\s*(?:[-*]\s*)?\[ \])/, `$1${t.claim}`)
  }
  // 再做注记移植(L5/L6,2026-10-14):候选行的独有 〔…〕/（…〕 段追加到幸存行行尾 ——
  // 让号记录/拍板/半程交付记录必须活在活行上,不能只活在归档台账里。逐条以当前行文为准
  // (同一幸存行可能吃多个候选的段,依次追加)。
  for (const t of plan.transplants || []) {
    out[t.to] = (out[t.to] ?? '') + t.text
  }
  for (const i of plan.deleteSet) out[i] = null
  const result = []
  for (let i = 0; i < out.length; i++) {
    if (out[i] === null) continue
    if (plan.stripSet.has(i) && !plan.deleteSet.has(i)) {
      const line = stripMergeNotes(out[i])
      // 注记可能嵌在句中:剥掉后若形成"孤零零的勾选框"也一并删
      result.push(/^\s*-\s*\[[ xX]\]\s*$/.test(line) ? null : line)
    } else result.push(out[i])
  }
  return result.filter((l) => l !== null)
}

/** 守恒断言(返回 error 列表;空 = 通过)。
 *  A4 认领守恒按**族内不变式**断言:任何复合主键/剥注记正文族,清偿后至少保留一条
 *  带认领标记的行(若清偿前该族有认领)—— 副本上的认领随副本删除而"消失"是必然的
 *  (认领转移到持有行后被删除的副本不再计入),总数断言会误报;族级断言才是真守恒。 */
export function verifyPurge(oldLines, newLines, plan) {
  const errs = []
  const countChecked = (ls) => ls.filter((l) => isCheckedRow(l)).length
  const countOpen = (ls) => ls.filter((l) => isOpenRow(l)).length
  if (countChecked(newLines) !== countChecked(oldLines))
    errs.push(`A1 已勾选行数变化:${countChecked(oldLines)} → ${countChecked(newLines)}`)
  // A4 族内认领守恒:清偿前带认领的族,清偿后必须仍带认领(族键与分族同源:复合主键 ∪ 指纹)
  const famKeyOf = (l) => plan.famKeyOf(l)
  const oldClaims = new Set()
  for (const l of oldLines)
    if (isRowLine(l) && !isProse(l) && CLAIM_RE.test(stripMergeNotes(l))) oldClaims.add(famKeyOf(l))
  const newClaimFams = new Set()
  for (const l of newLines)
    if (isRowLine(l) && !isProse(l) && CLAIM_RE.test(stripMergeNotes(l)))
      newClaimFams.add(famKeyOf(l))
  const lostClaims = [...oldClaims].filter((k) => !newClaimFams.has(k))
  if (lostClaims.length)
    errs.push(
      `A4 族级认领守恒破坏:${lostClaims.length} 个族丢失认领标记;样例:${lostClaims.slice(0, 3).join(' | ')}`,
    )
  // A3 注记残留只数**登记行**(散文/占位注释里的引用不动,渲染不可见且受门 13c 保护)
  const residueDup = newLines.filter(
    (l) => isRowLine(l) && !isProse(l) && DUP_POINTER_RE.test(l),
  ).length
  const residueSelf = newLines.filter(
    (l) => isRowLine(l) && !isProse(l) && SELF_DEDISPATCH_RE.test(l),
  ).length
  if (residueDup || residueSelf)
    errs.push(`A3 登记行注记残留:dup=${residueDup} selfDe=${residueSelf}`)
  const openDelta = countOpen(oldLines) - countOpen(newLines)
  if (openDelta < 0) errs.push(`A2 未勾选行数反增:${countOpen(oldLines)} → ${countOpen(newLines)}`)
  // A5 真归并单调性(L5/L6,2026-10-14):结果面上的 F4 副本数与 F10 可折数都不得比清偿前多。
  // **两侧输入必须先剥注记归一化**(2026-10-14 实测修正):foldTwins 把带指针注记的行整个排除在
  // 候选之外(plan-tasks-merge.mjs:2639),而本轮 L4 恰恰在做"剥注记保留" —— 不归一化就会把
  // "本来就存在的重复第一次被看见"读成"本轮造出了重复":全量档实测 8→18 整批拒落,而新增的 13
  // 条逐条归因到 stripSet 的行与其同题兄弟(归因尺 = 注记内日期分布 + 行级归属,可复算,不留临时件)。
  // 归一化后这个维度量的才是"重复压力"本身:剥注记不改行数、删副本只让它变小、真造重复必涨。
  // 判据没有放宽:同一条 foldTwins/findDupOpenCopies 实现,只是两侧同基准(§0.3 的"同轮同面")。
  const bareFace = (ls) => ls.map((l) => (isRowLine(l) && !isProse(l) ? stripMergeNotes(l) : l))
  try {
    const bLines = bareFace(oldLines)
    const aLines = bareFace(newLines)
    const before4 = idx.findDupOpenCopies(idx.auditPlan(bLines.join('\n')).dupOpen).length
    const after4 = idx.findDupOpenCopies(idx.auditPlan(aLines.join('\n')).dupOpen).length
    if (after4 > before4)
      errs.push(`A5 F4 副本数反增:${before4} → ${after4}(注记已归一化 ⇒ 这是真造出来的重复)`)
    const before10 = foldTwins(bLines).edits.length
    const after10 = foldTwins(aLines).edits.length
    if (after10 > before10)
      errs.push(`A5 F10 可折数反增:${before10} → ${after10}(注记已归一化 ⇒ 这是真造出来的重复)`)
  } catch (e) {
    // 判据自己炸了 ≠ 通过。旧版这里 `catch {}` 静默放行 = "未判定"被读成"已判定且绿"(§0.3 禁),
    // 而本脚本的动作是整批真删行 ⇒ 未判定只能往保守方向走:不落。
    errs.push(`A5 未判定(${String(e?.message ?? e).slice(0, 120)})⇒ 整批不落,先修判据输入`)
  }
  return errs
}

/** 某 ref 下路径的**内容**(不是 oid —— headBlobOf 返回的是 oid,别混用)。 */
function readBlobContent(ref, relPath) {
  return execFileSync(GIT, ['show', `${ref}:${relPath}`], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/**
 * 台账文件名的**机器标识投影**(不是机器标识口径本身)。
 *
 * 口径住在 `lib/plan-id-lease.mjs` 的 `machineIdentity()`(env `IHUI_MACHINE_ID` > 主机名+仓根
 * 路径指纹 ⊕ machineGuid)—— 本函数只做"把那个标识投成一个文件名片段"这一件事:
 * 凡不属于 `[A-Za-z0-9._-]` 的字符一律换成 `-`,并剥掉首尾的 `-`。为什么要投影:
 *  ① 主机名可含 NTFS/git pathspec 的禁忌字符(`machineIdentity` 只把空白折成 `-`,管不到别的);
 *  ② 消费方只认这个字符集 —— 守门 13c 的归档点名字是
 *     `\.ihui-agent/archive/([A-Za-z0-9._\-]+\.md)`,名字里多出这个集合 ⇒ 占位永远点不到它,
 *     造出"写得出、没人认得"的归档件(比撞名更糟)。
 * 投影后为空 ⇒ 返回 `''`,调用方必须喊出来,不得静默按无标识取名。
 */
export function ledgerMachineTag(machineId) {
  return String(machineId ?? '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
}

/** 台账相对路径拆成 `{ dir(含尾斜杠), base(不含扩展名), ext }`;无扩展名时 ext=''。 */
function splitLedgerRel(rel) {
  const s = String(rel)
  const slash = s.lastIndexOf('/')
  const dot = s.lastIndexOf('.')
  const cut = dot > slash ? dot : s.length
  return { dir: s.slice(0, slash + 1), base: s.slice(slash + 1, cut), ext: s.slice(cut) }
}

/**
 * 把机器标识插进台账名(扩展名之前):
 * `…/plan-pointer-purge-2026-10-14.md` → `…/plan-pointer-purge-2026-10-14-<tag>.md`。
 * 标识为空 ⇒ **逐字回退原名**(与改名前口径同形;这一条由镜像测试 ①b 钉住)。
 */
export function taggedLedgerRel(ledgerRel = LEDGER_REL, tag = '') {
  const t = ledgerMachineTag(tag)
  if (!t) return String(ledgerRel)
  const { dir, base, ext } = splitLedgerRel(ledgerRel)
  return `${dir}${base}-${t}${ext}`
}

/** 第 n(1 起)轮候选名:n=1 用无序号形态,n≥2 在标识之后再追加 `-n`。 */
export function ledgerSeqRel(ledgerRel = LEDGER_REL, tag = '', n = 1) {
  const named = taggedLedgerRel(ledgerRel, tag)
  if (!(n > 1)) return named
  const { dir, base, ext } = splitLedgerRel(named)
  return `${dir}${base}-${n}${ext}`
}

/**
 * 归档台账取名的**纯函数**(不碰 git;两面清单由调用方在同一轮取好后喂进来)。
 *
 * 立因(2026-10-15 实测复发):旧实现只问**本机 HEAD** —— 两台机共享同一 origin、同一仓路径语义,
 * 站在同一个前沿时双方都看到"上一个后缀已存在、于是都取下一个",于是同一晚新建出**同名**台账
 * (`plan-pointer-purge-2026-10-14-5.md` 两侧内容完全不同)⇒ add/add 冲突 127 处、union-converge
 * 判需人工、部署环快进被挡。两道锁:
 *  ① 名字里带**机器标识** ⇒ 跨机结构上不可能同名(口径见 `ledgerMachineTag` 的头注);
 *  ② 序号基准 = **本地 HEAD 面 ∪ 远端那一份** ⇒ 同机双 checkout、或对面把同一标识报给自己时也不撞
 *     (与 `live-doc-edit.mjs` 号段基准 G-313 出路② "max(本地 HEAD, 远端那一份)" 同一条纪律)。
 *
 * 三态不并桶(§0.3):
 *  - 本地面未判定(`localFiles` 不是数组)⇒ **拒绝取名返回 null**,绝不把"没读到"当"没人占用";
 *  - 远端面未判定(`remoteFiles` 不是数组)⇒ **喊出降级**后按本地面取名(机器标识已把跨机那一维
 *    结构性隔开,仍可落地,但必须留声 —— 静默按窄面取名等于伪装成"已与远端对齐");
 *  - 全部后缀被占用 ⇒ 返回 null 拒绝落地。**绝不回退原名**:整文件重写会抹掉旧台账的逐字记录
 *    ⇒ 门 71 的归档豁免对那些行失效 ⇒ 清偿与回捞对打复活(旧实现的兜底正是这一型)。
 */
export function chooseLedgerRel({
  ledgerRel = LEDGER_REL,
  tag = '',
  localFiles = null,
  localReason = '',
  remoteFiles = null,
  remoteReason = '',
  maxSeq = 50,
  note = (m) => console.log(m),
} = {}) {
  const say = (m) => note(m)
  if (!Array.isArray(localFiles)) {
    say(
      `❌ 台账取名的本地面(HEAD:${LEDGER_DIR_REL})未判定${localReason ? `(${localReason})` : ''}` +
        ` ⇒ 本轮拒绝取名 —— "没读到"绝不写成"没人占用"(§0.3)`,
    )
    return null
  }
  const remoteKnown = Array.isArray(remoteFiles)
  const used = new Set(
    [...localFiles, ...(remoteKnown ? remoteFiles : [])].map((p) => baseNameOf(p)),
  )
  if (!ledgerMachineTag(tag))
    say(
      '⚠️ 本轮台账名不含机器标识 ⇒ 跨机同刻取名仍可能同名(检查 IHUI_MACHINE_ID / 主机名 / 仓根指纹)',
    )
  for (let n = 1; n <= maxSeq; n++) {
    const cand = ledgerSeqRel(ledgerRel, tag, n)
    if (!used.has(baseNameOf(cand))) {
      if (!remoteKnown)
        say(
          `⚠️ 台账取名基准未含远端(原因:${remoteReason || '远端问不到'})⇒ 本轮只按本地 HEAD 面取名;` +
            `机器标识 ${ledgerMachineTag(tag) || '(无)'} 仍在名字里,跨机不同名`,
        )
      return cand
    }
  }
  say(
    `❌ 前 ${maxSeq} 个后缀全部被占用 ⇒ 拒绝取名/拒绝落地(绝不整文件重写已有台账:那会抹掉旧台账的` +
      `逐字记录 ⇒ 门 71 的归档豁免失效、清偿与回捞对打复活)`,
  )
  return null
}

const firstLine = (e) =>
  String(e?.stderr ?? e?.message ?? e)
    .split(/\r?\n/)
    .find((l) => l.trim() !== '') ?? ''

/**
 * 某个面(`HEAD` / 远端 tip 的**显式 SHA**)上归档目录里真实存在的文件清单(全路径,不筛名字)。
 * 读不到 ⇒ `{files:null, reason}` —— 未判定 ≠ 没有占用。
 * 只取名、不读内容(归档目录里有 13.8 MB 的归档件,`lib/plan-id-face.mjs` 同一课)。
 */
export function listLedgerNamesOnSource(
  source,
  { root = ROOT, dir = LEDGER_DIR_REL, gitRun = gitRead } = {},
) {
  try {
    const z = gitRun(['ls-tree', '-r', '--name-only', '-z', source, '--', dir], {
      root,
      raw: true,
      timeout: LS_TREE_TIMEOUT_MS,
    })
    const all = parseZList(z)
    if (all === null) return { files: null, reason: `${source}:${dir} 清单没有输出(未判定)` }
    return { files: all, reason: '' }
  } catch (e) {
    return { files: null, reason: `${source}:${dir} 枚举失败:${firstLine(e).slice(0, 160)}` }
  }
}

/**
 * **远端那一份**台账名清单(取名基准的第二腿)。
 *
 * 三条不许漂的写法(照 `live-doc-edit.mjs` 的号段基准 G-313 出路②,把"号"换成"名"):
 *  ① 远端 tip **只认 `git ls-remote` + 显式 SHA**。`FETCH_HEAD` 是共享文件、后台部署环每 60s 也在
 *     fetch 改写它(§5b),拿它当基准就是把"别人此刻写到哪"读成"远端在哪"。
 *  ② 本函数**只读**:不 fetch、不写任何 ref。§5b 禁 agent 手写 `git push` —— 推送唯一归 post-commit
 *     的 git-push-guard 腿,取名这一层连碰都不该碰远端写面。
 *  ③ 问不到 / 对象不在本地 ⇒ `{files:null, reason}` 交调用方**大声打印**后按本地面取名;
 *     绝不静默(把"没判"写成"判过了"是本仓最高频失效型)。
 */
export function remoteLedgerFace({ root = ROOT, gitRun = gitRead } = {}) {
  const fail = (reason) => ({ files: null, source: '', reason })
  let branch = ''
  try {
    branch = gitRun(['rev-parse', '--abbrev-ref', 'HEAD'], { root, timeout: LS_TREE_TIMEOUT_MS })
  } catch (e) {
    return fail(`当前分支问不到:${firstLine(e).slice(0, 120)}`)
  }
  if (!branch || branch === 'HEAD') return fail('HEAD 处于游离状态(detached),没有同名远端分支可问')
  let remote = 'origin'
  try {
    const r = gitRun(['config', '--get', `branch.${branch}.remote`], { root, allowFail: true })
    if (r) remote = r
  } catch {
    /* 配置问不到 ⇒ 用 origin 兜底(§5b 本仓同步口径一律 origin main) */
  }
  let remoteRef = `refs/heads/${branch}`
  try {
    const m = gitRun(['config', '--get', `branch.${branch}.merge`], { root, allowFail: true })
    if (m) remoteRef = m.startsWith('refs/') ? m : `refs/heads/${m}`
  } catch {
    /* 同上兜底 */
  }
  let sha = ''
  try {
    const out = String(
      gitRun(['ls-remote', remote, remoteRef], { root, timeout: LS_REMOTE_TIMEOUT_MS }) ?? '',
    )
    const lines = out.split(/\r?\n/).filter((l) => l.trim() !== '')
    const hit = lines.find((l) => l.split('\t')[1] === remoteRef) ?? lines[0] ?? ''
    sha = String(hit.split('\t')[0] ?? '').trim()
  } catch (e) {
    return fail(`${remote} ${remoteRef} 的 ls-remote 问不到:${firstLine(e).slice(0, 120)}`)
  }
  if (!/^[0-9a-f]{40}$/.test(sha))
    return fail(`${remote} ${remoteRef} 的 ls-remote 回的不是 40 位 SHA`)
  try {
    gitRun(['cat-file', '-e', `${sha}^{tree}`], { root, timeout: LS_TREE_TIMEOUT_MS })
  } catch {
    return fail(
      `远端 tip ${sha.slice(0, 12)} 的对象不在本地对象库(本器不 fetch ⇒ 远端已用名不进基准)`,
    )
  }
  const face = listLedgerNamesOnSource(sha, { root, gitRun })
  return {
    files: face.files,
    source: `${remote}/${remoteRef.replace(/^refs\//, '')}@${sha.slice(0, 12)}`,
    reason: face.files === null ? face.reason : '',
  }
}

function main() {
  const apply = process.argv.includes('--apply')
  const absorb = process.argv.includes('--absorb')
  // ── 门 203 同源差值校验(纯函数):清偿后不得比 HEAD 面多出「同题多号」成员键。
  // 首版缺陷的实测形状:剥注记让 146 个键从"指针行(指纹 null,不进组)"变成"有指纹的行",
  // 门 203 的棘轮把它们读成这次带进来的第二次登记。分族已改为复合主键 ∪ 指纹同源,
  // 这里再放一道**同源**自校验:不许脚本自己造出门会拦的形态。
  const gate203Delta = (oldText, newText) => {
    const A = require(path.join(ROOT, 'scripts/check-plan-task-duplicates.mjs'))
    const anchor = A.findDuplicateGroups(oldText)
    const candidate = A.findDuplicateGroups(newText)
    return A.ratchetAdded(anchor, candidate)
  }

  // 面一律取 HEAD blob(对象空间落地的唯一真相面);工作树副本常年滞后,按它落地就是写回旧态(§12)
  let headText = ''
  try {
    headText = readBlobContent('HEAD', PLAN)
  } catch {
    headText = ''
  }
  if (!headText) {
    console.error('❌ 取不到 HEAD:PROJECT_PLAN.md ⇒ 无法判定,不落')
    process.exit(1)
  }
  const eol = headText.includes('\r\n') ? '\r\n' : '\n'
  const lines = headText.split(/\r?\n/)
  const plan = buildPlan(lines, { absorb })
  const { stats } = plan
  console.log(
    `分类: L1 外部持有行删除=${stats.L1} L2 族内归并删除=${stats.L2} L3 纯指针删除=${stats.L3} ` +
      `L4 剥注记保留=${stats.L4} L5 同题折并=${stats.L5} L6 同主键归并=${stats.L6} L7 逐字孪生折并=${stats.L7} ` +
      `其中吸收承载=${stats.absorbed}${absorb ? '' : '(未开 --absorb)'} ` +
      `已勾剥注记=${stats.checkedStripped} 认领转移=${plan.claimTransfers.length} ` +
      `跳过交人工=${(plan.skipped || []).length}`,
  )
  for (const s of plan.skipped || [])
    console.log(`   ⏭ ${s.i >= 0 ? `L${s.i + 1}` : '(整层)'} ${s.why}`)
  const next = renderPurge(lines, plan)
  const errs = verifyPurge(lines, next, plan)
  if (errs.length) {
    console.error('❌ 守恒断言失败,整批不落:')
    for (const e of errs) console.error(`  - ${e}`)
    process.exit(1)
  }
  // 门 203 同源自校验:清偿不得自己造出「同题多号」
  const dups = gate203Delta(headText, next.join(eol) + eol)
  if (dups.length) {
    console.error(
      `❌ 门 203 同源自校验失败:清偿后比 HEAD 多出 ${dups.length} 个同题多号成员键,拒绝落地:`,
    )
    for (const d of dups.slice(0, 12))
      console.error(`   - 指纹=${d.fingerprint} 自持号=${d.selfId} 多出=${d.extra} 份`)
    console.error('   ⇒ 分族键仍与门 203 不同源,先修 famKeyOf 的归一化,再重跑(不许为消红放宽判据)')
    process.exit(1)
  }
  const before = lines.filter((l) => l.trim() !== '').length
  const after = next.filter((l) => l.trim() !== '').length
  console.log(
    `守恒断言 5/5 通过;门 203 同源自校验 0 键;非空行 ${before} → ${after}(-${before - after})`,
  )
  if (!apply) {
    console.log('--dry-run 模式,未落地。加 --apply 走对象空间落地(从不写工作树)。')
    return 0
  }

  const MSG_TAIL =
    '落地前五条守恒断言必须全绿(A1 已勾选不缩水 ∧ A2 未勾选不反增 ∧ A3 登记行注记归零 ∧\n' +
    'A4 族级认领守恒 ∧ A5 真归并单调性 F4/F10 不反增(两侧同做注记归一化,量的才是重复压力本身)' +
    '),并过门 203 同源自校验。\n' +
    '落地方式:对象空间 + CAS,从不写工作树(共享工作树的台账副本常年滞后 HEAD,按 pathspec 写等于\n' +
    '把别人已入库的行整批写回旧态,§12 一族);被删行原文进 ' +
    LEDGER_DIR_REL +
    '/ 下的 plan-pointer-purge-* 台账(本轮实际文件名带机器标识与序号,见落地日志)。' +
    '\n' +
    '落地后交 git-push-guard 推送:旁路不跑 post-commit ⇒ 自动推送腿不触发,不推就会被下一次「活文档行级\n' +
    'union」收敛按对侧副本拉回(2026-10-14 实测 350→1699 即此型)。\n' +
    '动因:用户指令「我不想让它出现重复登记副本 根本不想 不要再看到 给我彻底根治」。'

  // 每一轮都从**当下** HEAD 面重算(不复用首轮结果):别人推进过 HEAD 就必须在新面上重算,
  // 把旧面结果硬贴上去会连带写回别人的行(§12 一族)。
  // 台账文件名防覆盖(2026-10-15 复发止血,两道锁;机理与三态分流见 chooseLedgerRel 的头注):
  //  ① 名字里插**机器标识** —— 旧实现只问本机 HEAD,两台机站在同一前沿时"下一个后缀"必然同值,
  //     于是同一晚各写出一份同名台账(实测 -5 两侧内容完全不同 ⇒ add/add 冲突 127 处、部署环被挡);
  //  ② 序号基准 = 本地 HEAD 面 ∪ **远端那一份** —— 同机双 checkout 或对面报同一标识时仍不撞。
  // 两侧名字都必须继续命中消费方射程(门 71 ARCHIVE_FILE_RE 的 `plan-pointer-purge-` 前缀、
  // 门 13c 的点名字符集 [A-Za-z0-9._-]),否则造出"写得出、没人认得"的归档件。
  const ledgerTag = ledgerMachineTag(machineIdentity(ROOT))
  const remoteLedger = remoteLedgerFace({ root: ROOT })
  const saidNotes = new Set()
  const sayOnce = (m) => {
    if (saidNotes.has(m)) return
    saidNotes.add(m)
    console.log(m)
  }
  const ledgerRelForThisRun = () => {
    const local = listLedgerNamesOnSource('HEAD', { root: ROOT })
    return chooseLedgerRel({
      tag: ledgerTag,
      localFiles: local.files,
      localReason: local.reason,
      remoteFiles: remoteLedger.files,
      remoteReason: remoteLedger.reason,
      note: sayOnce,
    })
  }
  console.log(
    `   台账取名基准:机器标识=${ledgerTag || '(未取到)'} · 本地面 HEAD:${LEDGER_DIR_REL} · ` +
      (remoteLedger.files
        ? `远端面 ${remoteLedger.source}`
        : `远端面**未判定**(${remoteLedger.reason})⇒ 只按本地面取名,跨机那一维由机器标识隔开`),
  )
  for (let attempt = 1; attempt <= 10; attempt++) {
    const head = execFileSync(GIT, ['rev-parse', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
    try {
      let freshText = ''
      try {
        freshText = readBlobContent('HEAD', PLAN)
      } catch {
        freshText = ''
      }
      if (!freshText) {
        console.log(`   第 ${attempt} 次:取不到 HEAD:PROJECT_PLAN.md,重读`)
        continue
      }
      const fEol = freshText.includes('\r\n') ? '\r\n' : '\n'
      const fLines = freshText.split(/\r?\n/)
      const fPlan = buildPlan(fLines, { absorb })
      const fNext = renderPurge(fLines, fPlan)
      const fErrs = verifyPurge(fLines, fNext, fPlan)
      if (fErrs.length) {
        console.log('❌ 重算后守恒断言未过 ⇒ 拒绝落地:' + fErrs.join(' / '))
        return 1
      }
      const fNextText = fNext.join(fEol) + fEol
      const fDups = gate203Delta(freshText, fNextText)
      if (fDups.length) {
        console.log(`❌ 重算后门 203 同源自校验失败(${fDups.length} 键)⇒ 拒绝落地`)
        return 1
      }
      const fStats = fPlan.stats
      const fSkipped = fPlan.skipped || []
      const fMsg =
        `refactor(plan): 清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并)\n\n` +
        `L1 外部持有行删除 ${fStats.L1} 行 / L2 族内归并 ${fStats.L2} 行 / L3 纯指针 ${fStats.L3} 行 / ` +
        `L4 剥注记保留 ${fStats.L4} 行 / L5 同题折并 ${fStats.L5} 行 / L6 同主键归并 ${fStats.L6} 行 / ` +
        `已勾剥注记 ${fStats.checkedStripped} 行 / 认领转移 ${fPlan.claimTransfers.length} 条 / ` +
        `注记移植 ${fPlan.transplants.length} 段 / 跳过交人工 ${fSkipped.length} 行(逐行点名见台账)。\n\n` +
        MSG_TAIL
      const fLedger =
        [
          '# plan-pointer-purge 存量清偿台账(2026-10-14)',
          '',
          '> 清偿 PROJECT_PLAN.md 重复登记存量,用户指令「彻底根治 / 一条也不许再产生」。',
          '> 本轮新增 L5(同题折并 F10)/L6(同主键归并 F4)两层真删行归并:自动档已停产指针注记与',
          '> F10 折叠(plan-tasks-merge noPointer,2026-10-14)⇒ 无注记重复行唯有此处收口。',
          '> 准入闸:① 候选正文被幸存行逐字承载;② 行尾独有注记段移植到幸存行且不命中 13d 判据字面;',
          '> ③ 认领牌走既有转移机制。不满足者逐行跳过点名(见下),绝不硬删。',
          `> 分类:L1 ${fStats.L1} / L2 ${fStats.L2} / L3 ${fStats.L3} / L4 ${fStats.L4} / L5 ${fStats.L5} / L6 ${fStats.L6} / 已勾剥注记 ${fStats.checkedStripped} / 认领转移 ${fPlan.claimTransfers.length} / 注记移植 ${fPlan.transplants.length} / 跳过 ${fSkipped.length}。`,
          '> 落地方式:对象空间(HEAD blob → 改写 → commit-tree → CAS),从不写工作树;旁路已 attestBypassCommit 留痕。',
          `> 取名基准(2026-10-15 跨机同名止血):机器标识 = ${ledgerTag || '(未取到)'};` +
            `远端面 = ${remoteLedger.files ? remoteLedger.source : `未判定(${remoteLedger.reason})⇒ 本轮只按本地 HEAD 面取名`}。`,
          '> 下列每行为被删行原文(带原行号与分类原因)。',
          '',
          ...fLines.flatMap((l, i) => {
            if (!fPlan.deleteSet.has(i)) return []
            return [`- 原 L${i + 1}(${fPlan.reasons.get(i)}):`, '', '```', l, '```', '']
          }),
          ...(fSkipped.length
            ? [
                '## 跳过交人工(逐行点名,不静默)',
                '',
                ...fSkipped.map((s) =>
                  s.i >= 0
                    ? `- L${s.i + 1}:${s.why}\n\n  \`\`\`\n  ${fLines[s.i]}\n  \`\`\`\n`
                    : `- (整层):${s.why}\n`,
                ),
              ]
            : []),
        ].join(fEol) + fEol
      // A6 台账逐字自校验:每条被删行原文必须逐字出现在台账里 —— 门 71 的归档豁免
      // (archivedCopy)就靠这份逐字记录放行,少一行 = 该行会在 60 提交窗口内被判丢并回捞。
      for (const i of fPlan.deleteSet) {
        if (!fLedger.includes(fLines[i])) {
          console.log(`❌ A6 台账逐字自校验失败:L${i + 1} 的原文不在台账里 ⇒ 拒绝落地`)
          return 1
        }
      }
      const landedLedger = ledgerRelForThisRun()
      if (!landedLedger) {
        // 取名未判定/无可用名 ⇒ 不落这一枚(保守方向 = 多要一次定向说明,绝不"多放一次跳门")。
        // 上面 chooseLedgerRel 已逐条点名原因,这里不重复展开。
        return 1
      }
      const wm = ledgerWithWatermark(landedLedger, fLedger)
      if (!wm.ok) {
        console.log(
          `❌ 台账水印装不上(${wm.why})⇒ 本枚不落地(无载荷的归档件进 HEAD = 每轮都要有人在 CI 上重新发现一次红);修好 inject 这一环再重跑本器。`,
        )
        return 1
      }
      const { commit } = commitTreeWithIndex({
        root: ROOT,
        parent: head,
        message: fMsg,
        entries: [
          { path: PLAN, text: fNextText },
          { path: landedLedger, text: wm.text },
        ],
        baseRef: 'HEAD',
      })
      const ref = (resolveHeadRef({ root: ROOT }) || 'HEAD').trim()
      if (!casUpdateRef(commit, head, { root: ROOT, ref })) {
        console.log(`   第 ${attempt} 次 CAS 未中(HEAD 被别人推进)⇒ 在新面上重算`)
        continue
      }
      const al = alignSharedIndex({ root: ROOT, paths: [PLAN, landedLedger], parentRef: head })
      console.log(
        `✅ 落地 ${commit.slice(0, 11)}(父 ${head.slice(0, 11)}) 删 ${fPlan.deleteSet.size} 行;台账=${landedLedger};` +
          `主索引 moved=${(al.moved || []).length} already=${(al.already || []).length} skipped=${(al.skipped || []).length} 未判定=${(al.undetermined || []).length}`,
      )
      if ((al.skipped || []).length || (al.undetermined || []).length) {
        console.log(
          '⚠️ 共享主索引有路径未对齐(归属他人/判不出)⇒ 逐条点名,不静默:' +
            JSON.stringify([...(al.skipped || []), ...(al.undetermined || [])]),
        )
      }
      // 旁路落地不跑钩子 ⇒ 必须留痕,否则总量统计只能把这枚读成 unknown(与"有人跳门"同形)
      const at = attestBypassCommit(commit, {
        root: ROOT,
        headBefore: head,
        source: 'plan-pointer-purge',
      })
      if (!at.ok) console.log(`⚠️ 旁路留痕未写入(${at.why})⇒ 这一枚在跳门总量台账里仍是 unknown`)
      // 落地后必须**显式推送**,否则删除守不住(2026-10-14 实测归因):本脚本走对象空间 CAS,
      // 不跑 post-commit ⇒ git-push-guard 那条自动推送腿结构性不触发 ⇒ origin 仍持有被删行;
      // 而活文档收敛的语义是「行级 union ⇒ 只增不减」,对侧那一份会在下一次 merge 把整批注记
      // 原样拉回(实测:11:48 清偿后台面注记 350 ⇒ 13:45 merge a478912984 带回 1699 ⇒ 门 13d
      // 全量档转红,而它的出路只写着"再跑 purge"⇒ 死锁环)。推送走唯一实现 git-push-guard.mjs,
      // 不手写 git push;核验 `node scripts/git-push-converge.mjs`,推漏了由门 check-push-sync 拦。
      try {
        const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'git-push-guard.mjs')], {
          cwd: ROOT,
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        })
        child.unref()
        console.log(
          '➡️ 已交 git-push-guard 推送旁路提交(不跑钩子 ⇒ 必须显式推,否则本轮删除会被下一次 union 收敛拉回)',
        )
      } catch (e) {
        console.log(
          `⚠️ 推送腿未派生(${String(e?.message ?? e).slice(0, 80)})⇒ 立刻跑 node scripts/git-push-guard.mjs,否则本轮清偿会被带回`,
        )
      }
      return 0
    } catch (e) {
      console.log(
        `   第 ${attempt} 次派生失败,重读面再来:${String(e?.message ?? e)
          .split('\n')
          .pop()
          .slice(0, 140)}`,
      )
    }
  }
  console.log('❌ 多次未抢到 CAS ⇒ 不覆盖别人的推进(这不是失败,是并发窗口太密;稍后重跑即可)')
  return 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
}

/** 供镜像测试直取(§22c:测试 import 源实现,不复制判据)。 */
export const __test__ = { ledgerWithWatermark }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
