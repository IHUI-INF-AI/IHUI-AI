#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * plan-tasks-merge.mjs —— 把"同一件事的多份状态"归并成一份(守门 130 的**修法出口**,2026-09-26 立)
 *
 * 为什么必须有这一把:门只说"红了",不修就等于把红留给下一个人(§12e 同型)。
 * 而本仓对活文档的规矩是**禁止删除**(§1 已完成条目只能搬走;门 71 防登记行丢),
 * 所以归并的唯一安全形态是:**把副本行的行首翻成已完成,并就地写明它与哪一条同题** ——
 * 一行不删、一行不加,只改行内状态与注记。
 *
 * 四条判据各自的处置:
 *  - F1 同主键两态并存 → 副本行翻勾 + 注记归并到该主键的已完成登记。
 *  - F2 自带作废声明却未落账 → 同上(作废声明本身就是"已闭环"的一手证据)。
 *  - F3 行号指针已腐烂 → 把行号换成**内容锚点**。判据是一张**族表**(`POINTER_FAMILIES`),
 *    修复出口必须与它同集(`POINTER_REPAIRS`,镜像测试钉死):旧版判据只认 `存活于 L<行号>`
 *    一种措辞,而本工具自己产出的 `另一条登记在 L<行号>` 有 244 条不认(HEAD 面 `存活于` 现读 0 条),
 *    于是 F3 一路报 0、指针全在烂 —— 行号在任何一次 append 后都会挪位(实测复核通过率 0/27)。
 *  - F4 同一件事多条待办 → **不动勾选**(两件事都还没做完),只给副本行加一句
 *    `〔【归并】重复登记副本…派单以那条为准〕`。索引层认这句字面把它逐出派单口径,
 *    于是"173 条未勾选"与"真待办 97 条"这两个数从此分开。**新指针一律写内容锚点,不写行号。**
 *  - F10 同一件事被**并发取号**登记成几条**不同编号**(F1/F4 按"编号+题面逐字等值"配主键 ⇒
 *    对这一型全盲,它会永久钉着守门 130 红) → 出口是 `foldTwins`:留一条持有行,其余折成
 *    "摘掉主键位置上的编号 + 只写持有行**题面**指针"的副本档 —— 同样**一行不删、不增、不翻勾、
 *    正文逐字保留**。摘号是这一型独有的必需步骤:不摘号则派单口径照旧算它一条活。
 *    模式:`--fold-twins`(报告) / `--fold-twins --commit`(单独落地) / `--heal --commit`
 *    (与 F1/F2/F3/F4 同一枚提交里一起落)。判据与散文见 `foldTwins` 头注。
 *
 * 安全阀(全部由机器核,不靠人眼):
 *  1. 改写按**行号精确 splice**,所以"面上有逐字同文的孪生行"不构成误伤 —— 真正的风险是
 *     落地时基线已挪位,由 `--emit-base` 报出 baseBlob、落地步骤对其做 CAS 身份校验来兜;
 *     孪生行数量如实报出(它正是 F1 的成因)。
 *  2. 输出必须与输入**行数相等**,且未参与改写的每一行逐字不变(多重集对账)。
 *  3. 改完立刻用同一把尺子复跑 `auditPlan`:F1/F2/F3/F4 必须全部归零,否则拒交付。
 *  4. 幂等只认自己的标记形态 `**[归并]**`,不认裸词"归并"(HEAD 里那批未落账的
 *     "union 归并裸副本"行正文天然含该词 —— 按裸词判会恰好漏掉本工具要修的那一型)。
 *  5. 默认只出报告;`--write-to` 只往**指定路径**落候选文本,绝不碰 PROJECT_PLAN.md。
 *     取值判据(同族口径见枚 `380431ffc`):**紧邻的下一个 token 必须存在且不以 `-` 开头**才算
 *     本旗标的值 —— 否则 `--write-to --staged` 会在当前工作目录写出一个名叫 `--staged` 的文件
 *     (§28 禁止形态)而期望路径没被写,归并器还会自认为"已写到"。无效值 ⇒ 大声拒绝 + 非零退出,
 *     **不回落到任何默认路径**。
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */

import { execFileSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, catBatch, gitRaw, selectFace } from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import {
  DUP_POINTER_RE,
  POINTER_FAMILIES,
  POINTER_NO_AUTO_REPAIR,
  auditPlan,
  countMergeNotes,
  compositeKeyOf,
  keyOfRow,
  parseTaskRows,
  titleOf,
} from './lib/plan-task-index.mjs'
// 折叠形态的**反判据**取自守门 71 自己那一份实现(不另抄):`headIdOf` 判"行首名额"还在不在,
// `lostMarkers` 判"折叠会不会被防丢层读成整行消失"。见 foldTwins 头注 ① —— 那是两维互咬的接缝。
import { TASK_ID_PATTERN, headIdOf, lostMarkers } from './check-plan-line-loss.mjs'
// 翻勾注记的形态与"剥注记后正文逐字相等"的成对判据,生产侧与看守侧(守门 71)共用这一份实现
// (G-307:两层自愈互咬的根因之一就是"注记长什么样"在两边各写一遍)。
import { buildForkedLine, forkPreserved, anchorOf } from './lib/plan-merge-annotation.mjs'
import { alignSharedIndex, casUpdateRef, commitTreeWithIndex } from './lib/bypass-git.mjs'
// 落地要按**调用方给的 root** 问 HEAD(未勾单行档的端到端取证跑在临时仓里,而上面那三个出口
// 都收 root 参数)。单独一条 import 语句不是笔误:镜像测试 R4 把上一行逐字钉成"落地只走
// bypass-git 那一份 plumbing"的装车证明,把 `git` 塞进那一行会让那条锁静默失效。
import { git as bypassGit } from './lib/bypass-git.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLAN_REL = 'PROJECT_PLAN.md'
const LABEL = { head: 'HEAD blob', staged: '索引 blob', worktree: '工作树(逃生舱)' }

function readPlan(root, face) {
  if (face === 'worktree') {
    const got = catBatch(root, [`HEAD:${PLAN_REL}`], { maxBuffer: 1 << 28 }).get(`HEAD:${PLAN_REL}`)
    if (got === null || got === undefined) throw new Undetermined('取不到 HEAD 版 PROJECT_PLAN.md')
    return got
  }
  const spec = face === 'staged' ? `:${PLAN_REL}` : `HEAD:${PLAN_REL}`
  const text = catBatch(root, [spec], { maxBuffer: 1 << 28 }).get(spec)
  if (text === null || text === undefined) throw new Undetermined(`${LABEL[face]} 取不到 ${PLAN_REL}`)
  return text
}

/**
 * 内容锚点出口已上移到 `scripts/lib/plan-merge-annotation.mjs`(2026-09-28 G-307)——
 * 注记句子由该层生成,锚点形状若在这里再抄一份,剥注记的那一侧迟早对不上。
 */
/**
 * F1/F2 翻勾:**正文逐字保留在行首**,注记一律追加在行尾(G-307 修法 (a))。
 * 旧形态把注记**前置**在正文之前(`- [x] ✅(日期) **[归并]** …。 <正文>`),于是守门 71 的
 * "行首编号"判活路径看不见被翻勾的那一行 —— 防丢层把合法翻勾读成"整行消失",回捞未勾原行,
 * F1 又红,再翻勾…… 两小时 24 枚"恢复型"提交就是这么来的(3/3 复现,登记为 G-307)。
 * 形态、幂等与"剥注记后正文相等"的判据都住在唯一实现层,本函数只是它的薄调用点。
 */
function rewriteFork(line, key, today) {
  return buildForkedLine(line, key, today)
}

/**
 * F3 的修复出口。措辞按"族"给,一条正则不能同时改两种措辞(改窄了就漏一族,改宽了会把
 * "逐字相同"的行写成"同主键"这种假话 —— 判据的取值必须与它修的那一族同形)。
 * `POINTER_REPAIRS` 的键集必须与 lib 的 `POINTER_FAMILIES` **同集**,由镜像测试钉死:
 * 判据能看见而出口修不了,等于把红永久留给下一个人。
 */
const POINTER_REPAIRS = {
  alive: (key) => (_m) =>
    `存活于同主键登记 ${key ? anchorOf(key) : '(与本行正文逐字相同,可按正文检索)'}`,
  dup: (key) => (m) => {
    const prefix = String(m).startsWith('逐字相同') ? '逐字相同的另一条登记' : '同主键的另一条登记'
    return `${prefix} ${key ? anchorOf(key) : '(与本行正文逐字相同,可按正文检索)'}`
  },
}

function rewritePointer(line, key) {
  let out = line
  for (const fam of POINTER_FAMILIES) {
    const rule = POINTER_REPAIRS[fam.id]
    if (!rule) {
      // 登记过"无自动出口"的族必须**原样留着**:它指向的行已不可推断,替它编一个锚点比留着
      // 一个腐烂行号更危险 —— 账面会看起来"已修",而内容变成一条看起来很对的错指针。
      if (!POINTER_NO_AUTO_REPAIR[fam.id])
        throw new Error(
          `判据族 ${fam.id} 既无改写规则、也未登记无自动出口 ⇒ 红永久留给下一个人,先补一处再来`,
        )
      continue
    }
    out = out.replace(new RegExp(fam.source, 'g'), rule(key))
  }
  return out
}

/**
 * F4 / F4b 副本行的改写:**不动勾选状态**(两件事都还没做完),只在行尾追加一句出处说明。
 * 说明里的固定字面必须能被 `DUP_POINTER_RE` 认得 ⇒ 派单口径当场不再把它算一条活;
 * 且重复跑归并不会再加第二句(幂等)。**删行是禁的**:§1「禁止无声删除」+ 门 71 防丢面。
 * 措辞按有没有主键分两档:F4b 的孪生行**本来就没有编号**,写"同主键"就是一句核验不了的假话。
 * **绝不写行号**(2026-09-28 改):上一版这里写 `另一条登记在 L<行号>`,而 §1 明文"证据指针禁止写
 * 行号 —— 行号在任何一次 append 后都会挪位";更糟的是那批指针措辞 F3 当时根本不认,于是 HEAD 上
 * 244 条指针全成了无人看守的死指针。现在只写内容锚点:有编号就写"同主键「编号 · 标题」",
 * 没编号就写"与本行正文逐字相同,可按正文检索" —— 后者天然可核验(逐字相同是定义),且不随 append 挪位。
 */
function rewriteDup(line, key, today) {
  if (DUP_POINTER_RE.test(line)) return line
  const ref = key
    ? `同主键的另一条登记 ${anchorOf(key)}`
    : '逐字相同的另一条登记(与本行正文逐字相同,可按正文检索)'
  return `${line} 〔【归并】重复登记副本(${today}):${ref},派单以那条为准,本行不再单独派单。〕`
}

/**
 * @returns {{ text:string, changed:Array<{line:number,kind:string,before:string,after:string}>,
 *             refused:string[], dupTwins:string[], before:object }}
 */
export function buildMerge(content, today) {
  const a = auditPlan(content)
  const lines = content.split('\n')
  const dupTwins = []
  const plan = new Map()
  const note = (ln, kind, key) => {
    if (!plan.has(ln)) plan.set(ln, { kinds: [], key })
    plan.get(ln).kinds.push(kind)
    if (!plan.get(ln).key) plan.get(ln).key = key
  }
  for (const f of a.forks) for (const r of f.open) note(r.line, 'F1', f.key)
  for (const r of a.voidRows) note(r.line, 'F2', compositeKeyOf(r.raw) ?? '')
  // 只把**能换成真锚点**的指针纳入改写计划;其余属"看得见但猜不出"的一半(目标行已不是条目行
  // 或根本不存在 ⇒ 作者当时指的是哪一条无从推断),由报告点名交人工。
  for (const p of a.rotated) if (p.autoFixable) note(p.line, 'F3', compositeKeyOf(lines[p.line - 1] ?? '') ?? '')
  // F4:同主键的多条未勾选 —— 幸存者由索引层判定,其余各加一句副本指针(不动勾选、不删行)
  for (const c of a.dupCopies) note(c.row.line, 'F4', c.key)
  // F4b:逐字相同但**没有编号**的孪生行 —— 同一条出口(只加指针、不动勾选、不删行),
  // 措辞按有无主键分档,因为对没有主键的行说"同主键"是一句无法核验的假话。
  for (const c of a.verbatimDups.copies) note(c.row.line, 'F4', c.key)
  const changed = []
  const refused = []
  for (const [ln, v] of [...plan.entries()].sort((x, y) => x[0] - y[0])) {
    const before = lines[ln - 1]
    if (before === undefined) {
      refused.push(`L${ln} 越界`)
      continue
    }
    // 改写**按行号精确 splice**,所以"面上有同文行"不构成误伤风险(风险在别处:
    // 落地时基线已挪位 ⇒ 由 main 输出 baseBlob、落地步骤做 CAS 身份校验来兜)。
    // 但同文行的数量必须如实报出来 —— 它正是 F1 的成因,归并后孪生行会各自带上注记而变得可辨。
    const twins = content.split('\n').filter((l) => l === before).length
    if (twins > 1) dupTwins.push(`L${ln} 有 ${twins} 条逐字同文的孪生行`)
    let after = before
    if (v.kinds.includes('F3')) after = rewritePointer(after, v.key)
    if ((v.kinds.includes('F1') || v.kinds.includes('F2')) && /^- \[ \]/.test(after)) after = rewriteFork(after, v.key, today)
    // F4 放最后:一行只可能被标一次;F4 与 F1 结构上互斥(dupCopies 只收"全未勾选"的组)
    if (v.kinds.includes('F4') && /^- \[ \]/.test(after)) after = rewriteDup(after, v.key, today)
    if (after === before) {
      refused.push(`L${ln} 无可施加的改写(${v.kinds.join('+')})`)
      continue
    }
    lines[ln - 1] = after
    changed.push({ line: ln, kind: v.kinds.sort().join('+'), before, after })
  }
  return { text: lines.join('\n'), changed, refused, dupTwins, before: a.counts }
}

/**
 * 只读诊断:找出"**每一行都带着副本指针**"的主键族 —— 这些族对派单口径完全隐形。
 *
 * 为什么这一型存在:F4 的语义是"只给副本加指针、幸存者不动",而 `findDupOpenCopies` 选幸存者
 * 是按组内顺序算的,**不看那一行自己是不是已经带了历史指针**。于是当幸存者本身早在上一轮(或
 * 被旧版 `rewriteDup` 写行号锚那一版)标了 `【归并】重复登记副本` 时,归并器照样"成功"给其余行
 * 加指针,`dupOpenCopies` 归零、验收链过、账面全绿 —— 而这一族已经没有任何一行能进 `--open`。
 *
 * 实测(2026-09-28,HEAD 面):19 个族 / 101 条未勾选行全带互指指针,`plan-tasks.mjs --open` 零命中。
 * 典型一站:`D18 Agent SDK 对外开放(G-23)` 两行,指针分别写"另一条登记在 L258x"和"在 L6xxx",
 * 而 §1 早已判定行号指针不可复核(F3 现读 300 处、可自动收口 0)⇒ 两边都指向不存在的东西。
 *
 * **本函数只读、只报数,不改一行**;改一行是 `--restore-terminals` 那一档的职责(同档内成对存在,
 * 免得诊断与修复分两处、诊断红了没人修 —— 本仓"判据只说红了不修"记过多次)。
 *
 * ⚠ 本函数初版在这里写过一段**错的**理由,现在是推翻它的地方:它说"把加指针前先验终端性接进
 * `rewriteDup` 会让归并后 `dupOpenCopies` 不归零,而那是落地验收链的硬判据 ⇒ 单改生产者侧等于
 * 让归并器自我拒绝"。这条推理错在**没先读 F4 自己的判据**:`findDupOpenCopies` 第一步就是
 * `g.open.filter((r) => !DUP_POINTER_RE.test(r.raw))`,全指族在它眼里恒为 0 条副本 ——
 * 所以恢复一行代表不会顶起 F4,验收链也无需放宽(实际落地的是差值护栏
 * `pointerVisibilityRegression`:只拦"本次把本来看得见的那族弄没了代表",不追存量,免造恒红闸)。
 * 一句话:**"改 A 会撞 B 那条断言"必须先去看 B 怎么算的,不能照着断言的名字推。**
 *
 * 口径边界(如实登记,不得当成"扫全了"):
 *  - 主键优先取 `compositeKeyOf`(与派单口径同一把尺子);**给不出主键的行不跳过**,改按
 *    "剥掉归并注记后的正文"兜底分组 —— 这一族的锚点语义本来就是 F4b 那句"与本行正文逐字相同",
 *    所以它同样可核验、同样会隐形。跳过无主键行等于对台账里最大的一批隐形族(实测
 *    `D18`、`47.`、`82.` 与 12 行"真机走查"孪生全是这一型)失明,而报告看起来一切正常
 *    —— 第一版就犯了这个错:真仓只报 3 族 / 5 行,独立口径同一面数到 19 族 / 101 行。
 *  - 未勾选行按行首 `[-*+] [ ]` 认;台账里若有缩进形态的登记行,这一版看不见它(实测面内
 *    行首口径与 `parseTaskRows` 口径同为 688 行,故本轮无差;将来漂了要回来补)。
 *
 * @returns {{families:number, rows:number, groups:Array<{key:string,lines:{line:number,text:string}[]}>}}
 */
export function auditPointerTerminals(content) {
  const lines = String(content ?? '').split(/\r?\n/)
  const by = new Map()
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (!/^[-*+] \[ \]/.test(raw)) continue
    let key = null
    try {
      key = compositeKeyOf(raw)
    } catch {
      key = null
    }
    // 兜底键:剥掉归并注记再去空白,取正文前缀。必须与 F4b 的锚点语义同形,否则同一件事在
    // 派单侧按正文判、在这里按"看不见"判,读数就会替人做出"没有债"的判断。
    // 兜底键:先剥机器注记**再**取主键。本函数初版不剥,而今天 F10 折出的 97 行把注记写在
    // **编号之前** ⇒ `compositeKeyOf` 恒 null ⇒ 97 个**不同任务**被并成"1 族 / 97 行隐形"
    // 这样一个假族,而按题面逐条查持有行实测是 97/97 全在(活一件没丢)。
    // 更要命的是假族让第二层"按编号找代表"整层失明(id=null 时不查),读数会把真隐形
    // 和判不出混成一个数。剥完仍给不出主键的行才落 TXT 兜底,兜底键同样用剥后的正文。
    const bare = stripMergeNotes(raw).text
    let bareKey = null
    try {
      bareKey = compositeKeyOf(bare)
    } catch {
      bareKey = null
    }
    const k = key || bareKey || 'TXT:' + bare.replace(/〔【归并】[^〕]*〕/g, '').replace(/\s+/g, '').slice(0, 60)
    if (!by.has(k)) by.set(k, [])
    by.get(k).push({ line: i + 1, text: raw })
  }
  // 第三层索引:同一**题面**在面上有没有未注记代表 —— 这一层不是加固,是纠错。
  // F10 `--fold-twins` 的成组判据是「题面逐字相等而编号互异」,它折副本时留的持有行
  // **编号本来就和被折行不同**,所以只按编号找代表会把 97 条"活还在"的折叠产物
  // 全数判成隐形(实测:按编号判隐形 55 族 / 91 行,而逐条查持有行是 97/97 全在)。
  // 判据必须与生产它的折叠同源,否则两台尺子对着同一件事各报各的数(本仓最高频失效型)。
  const titleTerminal = new Map()
  /** 面上**未注记**待办行的题面集合。折叠行声明的持有行要查这张表,而不是查"同编号"——
   *  F10 的成组判据就是「同题而编号互异」,所以按编号找代表对这一族必然失败。 */
  const liveTitles = new Set()
  /** **已完成行**也算代表(第三层,不是加固而是纠错)。
   *  不这么定的后果很具体:一族里 A(未注记)被 `--heal` 翻勾成 `[x]`,B 带副本指针 ——
   *  翻勾后 A 不再是"未勾选行",按"只有活行才算代表"的口径这一族立刻变成隐形,
   *  于是本档新加的差值护栏会把一次**正当的翻勾**判成"把活账弄隐形"而拒绝落地
   *  —— 一台拦正当动作的闸与恒红门同罪(§12e)。而这件活并没有丢:它就在同键的已完成行里。 */
  const doneKeys = new Set()
  const doneTitles = new Set()
  for (const raw of lines) {
    if (!/^[-*+]\s\[[xX]\]/.test(raw)) continue
    const dk = compositeKeyOf(raw)
    if (dk) doneKeys.add(dk.split('#')[0])
    const dt = titleOf(stripMergeNotes(raw).text)
    if (dt) doneTitles.add(dt)
  }
  const bareTitleOf = (line) => {
    const bare = stripMergeNotes(line).text
    const t = titleOf(bare)
    return t || bare.replace(/^[-*+]\s\[[ xX]\]\s*/, '').trim().slice(0, 24)
  }
  for (const rs of by.values()) {
    for (const r of rs) {
      const t = bareTitleOf(r.text)
      if (!t) continue
      if (!titleTerminal.has(t)) titleTerminal.set(t, false)
      if (!DUP_POINTER_RE.test(r.text)) titleTerminal.set(t, true)
    }
  }
  const groups = []
  // 第二层索引:同一**编号**在别的主键形态下有没有终端代表。
  // 为什么必须有这一层:`compositeKeyOf` 的键是"编号 + 标题前缀逐字等值",而台账里同一件事
  // 常挂着多种标题写法(实测 `D18` 三条:L1503/L6632 是短标题 + 归并指针、L1504 是长标题正文版)。
  // 按主键判,L1503/L6632 这一族"无终端";按编号判,这件活由 L1504 代表、**并没有隐形**。
  // 只报第一层就会把 F9 撞号的副产物写成"活账消失",派单人会去修一件不存在的事
  // (本仓对"读数误导派单"的代价记过多次,包括照过期数字派单那一型)。
  const idLines = new Map()
  for (const [k, rs] of by) {
    const id = k.startsWith('TXT:') ? null : k.split('#')[0]
    if (!id) continue
    if (!idLines.has(id)) idLines.set(id, [])
    idLines.get(id).push(...rs)
  }
  /** 折叠行的持有行**不与它同编号**(F10 的成组判据就是"同题而编号互异"),所以按编号找
   *  代表对这一族必然失败。本函数初版就是这样把 97 行"活其实还在"的折叠产物报成真隐形;
   *  再改用自制题面去救,又被 `**` 包差异打掉(实测 titleOf 一侧带 `**` 一侧不带)⇒ 两层都判不出。
   *  正解是问折叠**自己声明**的那句话:尾注 `持有行题面「X」` 里的 X 就是它承诺的出口,
   *  拿 X 去未注记行的题面集合里查 —— 判据必须与生产它的折叠同源,不得由旁观者另算一遍相似度。 */
  const foldedKeeperOf = (line) => {
    // 刻意**不锚行尾**:F10 折完之后,同一行还可能被 F4 再追加一枚 `〔…〕` 副本指针,
    // 那句尾注就不在末尾了(实测 `G-368` 一族两行正是这一型)。尾注是本档自己写的机器散文,
    // 在里面找 `持有行题面「X」)` 不存在误吃作者正文的风险 —— 锚在末尾才是多余的严格。
    const m = /持有行题面「([\s\S]*?)」\)/.exec(String(line))
    return m ? m[1] : null
  }
  for (const [key, rs] of by) {
    if (rs.some((r) => !DUP_POINTER_RE.test(r.text))) continue // 有终端代表 ⇒ 这件活仍可被看见,不计
    const id = key.startsWith('TXT:') ? null : key.split('#')[0]
    const pool = id ? idLines.get(id) || rs : rs
    const byId = !pool.some((r) => !DUP_POINTER_RE.test(r.text))
    const t0 = bareTitleOf(rs[0].text)
    // 判不出代表一律算隐形:`titleTerminal.get(t0) === true` 而不是 `!== false` —— 后者会把
    // "这张表根本没登记过这个题面"读成"有代表",即把没判写成判过了(本仓最高频失效型)。
    const declared = foldedKeeperOf(rs[0].text)
    const byDeclared = declared ? liveTitles.has(declared) || doneTitles.has(declared) : false
    const byTitle = byDeclared || (t0 ? titleTerminal.get(t0) === true : false)
    // 已完成行那一层是**纠错**,不是加固:一族里唯一的未注记行被 `--heal` 翻勾之后,
    // 剩下的副本全带指针 ⇒ 按"只有活行才算代表"的口径这一族立刻变成"隐形"。但那件活没丢,
    // 它就在同键/同题面的已完成行里,对派单不可见是**正确**的。少了这一层,本档新加的
    // 差值护栏会把每一次正当翻勾拦成"把活账弄隐形"—— 一台拦正当动作的闸与恒红门同罪(§12e)。
    const byDone = (id ? doneKeys.has(id) : false) || (!!t0 && doneTitles.has(t0))
    groups.push({
      key,
      id,
      lines: rs,
      hidden: byId && !byTitle && !byDone,
      rescuedBy: !byId
        ? '编号'
        : byDone
          ? '已完成行'
          : byDeclared
            ? '折叠声明的持有行'
            : byTitle
              ? '题面'
              : null,
    })
  }
  groups.sort((a, b) => Number(b.hidden) - Number(a.hidden) || b.lines.length - a.lines.length || String(a.key).localeCompare(String(b.key)))
  const hiddenCount = groups.filter((g) => g.hidden).length
  return {
    families: groups.length,
    rows: groups.reduce((n, g) => n + g.lines.length, 0),
    hiddenFamilies: hiddenCount,
    hiddenRows: groups.filter((g) => g.hidden).reduce((n, g) => n + g.lines.length, 0),
    groups,
  }
}


/**
 * 机器写的归并注记里,**开括号紧贴标记**的那一族才有结构边界,才允许剥。
 *
 * 实测(2026-09-28,HEAD 面 749 处):`〔…〕` 641 处与 `（…）` 97 处都是"左括号 + 标记"起头;
 * 另有 10 处**裸形态**(`**[归并]** 【归并】… L<行号>(枚 <sha>)重复…。本行不进派单口径…`)
 * 根本没有闭括号。对裸形态"剥到行尾"等于拿结构缺失当授权去吃作者正文 ⇒ 一律拒绝并报名。
 */
const NOTE_OPENER = ['〔', '（']
const NOTE_CLOSER = ['〕', '）']
const MERGE_NOTE_NEEDLE = '【归并】重复登记副本'

/** 从 `start` 处的左括号起按**同种括号**深度配平找闭符;找不到闭符返回 null(不猜行尾)。 */
function balancedNoteSpan(line, start, openCh, closeCh) {
  let depth = 0
  for (let i = start; i < line.length; i++) {
    const c = line[i]
    if (c === openCh) depth++
    else if (c === closeCh) {
      depth--
      if (depth === 0) return { start, end: i + 1 }
    }
  }
  return null
}

/**
 * 剥掉一行里所有"开括号紧贴标记"的注记段,**迭代到不动点**(实测同一行两处注记有 2 处)。
 *
 * 为什么不能用一条 `[^〕]*〕` 正则:HEAD 面上有 3 行的注记之后紧跟**作者自己**写的
 * `〔进展@2026-09-28/主会话:…〕`,非贪婪或贪婪都会把它一起吃掉或留半截残迹 —— 深度配平是
 * 唯一能同时不吃作者正文、不剩残迹的走法。
 *
 * @returns {{text:string, removed:string[], refused:boolean}} `refused=true` 表示这行还有
 *   剥不掉的标记(裸形态或未闭合),调用方**不得**把它当"已剥净"。
 */
export function stripMergeNotes(line) {
  let cur = String(line ?? '')
  const removed = []
  for (let guard = 0; guard < 8; guard++) {
    const hit = cur.indexOf(MERGE_NOTE_NEEDLE)
    if (hit < 0) return { text: cur, removed, refused: false }
    const oi = hit - 1
    const kind = oi >= 0 ? NOTE_OPENER.indexOf(cur[oi]) : -1
    if (kind < 0) return { text: cur, removed, refused: true }
    const span = balancedNoteSpan(cur, oi, NOTE_OPENER[kind], NOTE_CLOSER[kind])
    if (!span) return { text: cur, removed, refused: true }
    removed.push(cur.slice(span.start, span.end))
    cur = cur.slice(0, span.start) + cur.slice(span.end)
  }
  return { text: cur, removed, refused: cur.includes(MERGE_NOTE_NEEDLE) }
}

/**
 * 恢复出口的单行动作:把这一行上的机器归并注记剥掉,让它重新进派单口径。
 *
 * 两条路分开走,各有**既有**反判据,不得在此另写一份:
 *  · F10 折叠形态(注记在编号之前 + 尾注记着原编号)⇒ 用 `stripTwinFold`,它连尾注一起还原,
 *    并且折叠档自己的准入判据就是"剥掉注记后逐字等于底稿",可逆性已被钉死;
 *  · 其余带外层括号的 `〔…〕` 形态 ⇒ 用 `stripMergeNotes`(深度配平)。
 * 裸形态(`**[归并]** 【归并】… L<行号>(枚 …)重复…。本行不进派单口径…`)没有闭符,
 * 按行尾剥会吃掉作者正文 ⇒ **一律拒绝并报名**,不许猜边界。
 *
 * @returns {{text?:string, removed?:string[], via?:string, refuse?:string}}
 */
export function restoreMergeNote(line) {
  const src = String(line ?? '')
  if (!DUP_POINTER_RE.test(src)) return { refuse: '这一行本来就不带副本指针(不该动)' }
  if (isTwinFolded(src)) {
    const t = stripTwinFold(src)
    if (t === src) return { refuse: '折叠形态剥不出底稿(形状与 buildTwinFold 不同形)' }
    if (DUP_POINTER_RE.test(t)) return { refuse: '剥完仍带副本指针(此行还叠着另一族注记)' }
    return { text: t, removed: [src.slice(t.length)], via: 'stripTwinFold' }
  }
  const st = stripMergeNotes(src)
  if (st.refused) return { refuse: '注记没有结构边界(裸形态或闭符缺失)⇒ 不许按行尾剥' }
  if (!st.removed.length) return { refuse: '没剥掉任何东西(标记不在任何左括号之后)' }
  if (DUP_POINTER_RE.test(st.text)) return { refuse: '剥完仍带副本指针(同行叠了两族注记且至少一族不可剥)' }
  if (st.text.trim() === '') return { refuse: '剥完只剩空行 —— 这行的正文全在注记里,交人工' }
  // 注记写在行尾时,它前面那个分隔空格是本工具写下的,剥完必须一起收掉:
  // 留一个行尾空格就不是"逐字回到底稿",而是"回到底稿加一个尾巴"。
  // 只在**注记确实贴到行尾**时收(实测 738 处全是这种形态),夹在正文中间的不动那一个空格。
  const last = st.removed[st.removed.length - 1]
  const wasAtEnd = src.endsWith(last)
  return {
    text: wasAtEnd ? st.text.replace(/[ \t　]+$/, '') : st.text,
    removed: st.removed,
    via: 'stripMergeNotes',
  }
}

/**
 * 纯函数:输入整档,输出"该恢复哪些行、哪些族拒绝、拒绝理由"。
 *
 * 选行规则 = **位置最靠前**的可剥行。刻意与 `foldTwins` 的持有行同规则,不得在此改用"正文最长":
 * 长度会随别人往同一行追加取证而变化,两台尺子对同一族选出不同代表,就等于同一件事有两个权威行
 * (本仓"两处算同一件事必漂移"记过最多次)。幂等性由"恢复后该族必有终端"保证,与选谁无关。
 *
 * 拒绝而不猜的每一条都点名给人工,因为恢复动作的失败方向必须是"少恢复一行",
 * 绝不是"多剥掉一段作者正文"。
 *
 * @returns {{text:string, edits:Array, refused:Array<{key:string,lines:number[],reason:string}>,
 *            hiddenBefore:number, hiddenRowsBefore:number}}
 */
export function buildRestoreTerminals(content, today = new Date().toISOString().slice(0, 10)) {
  const audit = auditPointerTerminals(content)
  const lines = String(content ?? '').split('\n')
  // 撞号预检(F9 那一维)。为什么不能只查"未带指针的行":恢复动作把原编号领回来,
  // 而同一编号此刻可能由**另一族带指针的行**以不同标题挂着 —— 那正是 F9 定义的撞号,
  // 只查活行会漏,恢复就等于原地新建一个撞号组。判等一律用 `compositeKeyOf`(与 F9 同源),
  // 不自写标题字符串比较 —— 折叠行与未折叠行的 titleOf 会差一层 `**`,按字符串比会大面积误拒。
  const keyIndex = new Map() // 编号 -> [{line, key}]
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (!/^[-*+]\s\[([ xX])\]/.test(raw)) continue
    const ck = compositeKeyOf(stripMergeNotes(raw).text)
    if (!ck) continue
    const id = ck.split('#')[0]
    if (!keyIndex.has(id)) keyIndex.set(id, [])
    keyIndex.get(id).push({ line: i + 1, key: ck })
  }
  // F9 互咬预检(逐候选行算,不是批后兜底)。
  // `findIdCollisions` 的输入是 **未剥注记** 的 `titleOf(raw)`,所以同一族里"一行剥了注记、
  // 另一行还带着"就会给同一编号产生两个标题 ⇒ 守门 130 的 F9 差值棘轮当场判红。
  // 那是**判据比的是原始题面**造成的,不是台账新债:活其实只有一件。
  // 本档不许为了变绿去改那道门的判据(那属 lib 持有人),也不许整批拒落(一条畸形题面
  // 不该按住 33 族),所以在这里**逐行**躲开:凡"剥完会让该编号的标题种数变多"的候选,
  // 拒绝并点名,把该族留给 F9 的题面取源修好之后再收。
  const f9Titles = new Map() // 编号 -> Map(原始题面 -> 行数)
  for (const r of parseTaskRows(content)) {
    if (!r.key) continue
    const id = String(r.key).split('#')[0]
    const t = titleOf(r.raw)
    if (!t) continue
    // 刻意**不**调 titleIsDegenerate:F9 用它,而它当前不在 lib 的导出面上(那道门还在别人手里,
    // 不该由本档替别人加导出)。少这一层只让本判据更保守 —— 保守的方向是"少恢复一行并点名",
    // 绝不是"多剥一段作者正文",所以不对称是安全的。等 F9 的题面取源改成剥注记后,这一格应撤。
    if (!f9Titles.has(id)) f9Titles.set(id, new Map())
    const m = f9Titles.get(id)
    m.set(t, (m.get(t) || 0) + 1)
  }
  const f9WouldGrow = (id, beforeLine, afterLine) => {
    const m = f9Titles.get(id)
    if (!m) return false
    const bt = titleOf(beforeLine)
    const at = titleOf(afterLine)
    if (bt === at) return false
    const distinct = (map, minus, plus) => {
      const s = new Set()
      for (const [t, n] of map) {
        const left = n - (t === minus ? 1 : 0)
        if (left > 0) s.add(t)
      }
      if (plus) s.add(plus)
      return s.size
    }
    return distinct(m, bt, null) < distinct(m, bt, at)
  }
  const edits = []
  const refused = []
  for (const g of audit.groups) {
    if (!g.hidden) continue
    let picked = null
    for (const r of g.lines) {
      const one = restoreMergeNote(r.text)
      if (one.text === undefined) continue
      picked = { r, one }
      break
    }
    if (!picked) {
      refused.push({
        key: g.key,
        lines: g.lines.map((r) => r.line),
        reason: '族内每一行的注记都没有可剥的结构边界 ⇒ 交人工(不许按行尾猜)',
      })
      continue
    }
    const afterKey = compositeKeyOf(picked.one.text)
    if (afterKey) {
      const id = afterKey.split('#')[0]
      const familyLines = new Set(g.lines.map((r) => r.line))
      const clash = (keyIndex.get(id) || []).filter((x) => !familyLines.has(x.line) && x.key !== afterKey)
      if (clash.length) {
        refused.push({
          key: g.key,
          lines: g.lines.map((r) => r.line),
          reason: `恢复会把编号 ${id} 领回来,而同编号在 L${clash[0].line} 挂的是另一件事「${clash[0].key.slice(id.length + 1, id.length + 46)}」⇒ 会原地造出 F9 撞号组,整族交人工`,
        })
        continue
      }
      if (f9WouldGrow(id, picked.r.text, picked.one.text)) {
        refused.push({
          key: g.key,
          lines: g.lines.map((r) => r.line),
          reason: `恢复会让守门 130 的 F9 多一组(它比的是未剥注记的 titleOf,同一编号于是出现"带注记/不带注记"两个题面)⇒ 解阻前置:F9 的题面取源改为剥注记后取值,归 lib 持有人,本档不代改判据`,
        })
        continue
      }
    }
    edits.push({
      line: picked.r.line,
      before: picked.r.text,
      after: picked.one.text,
      via: picked.one.via,
      key: g.key,
      today,
    })
  }
  const out = [...lines]
  for (const e of edits) out[e.line - 1] = e.after
  return {
    text: out.join('\n'),
    edits,
    refused,
    hiddenBefore: audit.hiddenFamilies,
    hiddenRowsBefore: audit.hiddenRows,
  }
}

/**
 * 恢复档的零损失与"确实把判据修好了"双重对账。
 *
 * 为什么必须有第二条(反隐形闭合断言):剥注记这个动作可以做得"每行都对而整档没变好"
 * —— 例如选错了行、或剥完仍被别的族判隐形。只判逐行可逆性就会把"跑过一次"当成"修好了"
 * (本仓对这一型的记述已经几十次)。
 */
export function verifyRestoreTerminals(srcText, outText, edits) {
  const problems = []
  const a = String(srcText).split('\n')
  const b = String(outText).split('\n')
  if (a.length !== b.length) problems.push(`行数不等 ${a.length}→${b.length}(恢复只许改行内内容)`)
  const touched = new Set(edits.map((e) => e.line))
  for (let i = 0; i < a.length; i++) {
    if (!touched.has(i + 1) && a[i] !== b[i]) {
      problems.push(`L${i + 1} 未登记却被改动 ⇒ 结构等值不成立,整批不落`)
      break
    }
  }
  for (const e of edits) {
    if (a[e.line - 1] !== e.before) problems.push(`L${e.line} 底稿与声明的 before 不等 ⇒ 行号已挪位,整批不落`)
    if (b[e.line - 1] !== e.after) problems.push(`L${e.line} 产物没落到声明的位置`)
    if (!DUP_POINTER_RE.test(e.before)) problems.push(`L${e.line} 底稿本来不带副本指针`)
    if (DUP_POINTER_RE.test(e.after)) problems.push(`L${e.line} 恢复后仍带副本指针 ⇒ 这一行还是进不了派单`)
    // 只许"减去注记",不许加字:after 必须是 before 的**保序子序列**
    let i = 0
    for (const ch of e.after) {
      i = e.before.indexOf(ch, i)
      if (i < 0) {
        problems.push(`L${e.line} 恢复后的正文不是底稿的子序列(恢复动作只许删注记,不许写字)`)
        break
      }
      i++
    }
  }
  // 反互咬:剥掉的注记里可能带着「G-261」这样的编号,守门 71 若读成"登记行消失"就会回捞原行
  const lost = lostMarkers(String(srcText), String(outText))
  if (lost.length)
    problems.push(
      `恢复后被守门 71 判为消失的登记行 ${lost.length} 处(${lost.slice(0, 3).map((l) => String(l.marker ?? l).slice(0, 24)).join(' / ')})⇒ 会与回捞层互咬,拒落`,
    )
  // 反隐形闭合:每一条 edits 所在族必须真的不再隐形
  const after = auditPointerTerminals(String(outText))
  const stillHidden = new Set()
  for (const g of after.groups.filter((x) => x.hidden)) for (const r of g.lines) stillHidden.add(r.line)
  const notRescued = edits.filter((e) => stillHidden.has(e.line))
  if (notRescued.length)
    problems.push(`${notRescued.length} 行恢复后所在族仍被判隐形(首条 L${notRescued[0].line})⇒ 出口不闭合,整批不落`)
  if (after.hiddenFamilies >= auditPointerTerminals(String(srcText)).hiddenFamilies && edits.length)
    problems.push(`隐形族没有减少(${auditPointerTerminals(String(srcText)).hiddenFamilies}→${after.hiddenFamilies})⇒ 本枚等于没修`)
  // F 维一律不得变差(这把尺子不许替别的维度制造红点)
  const c0 = auditPlan(srcText).counts
  const c1 = auditPlan(outText).counts
  for (const [k, get] of [
    ['F1', (c) => c.forks],
    ['F2', (c) => c.voidRows],
    ['F3', (c) => c.rotatedAuto],
    ['F4', (c) => c.dupOpenCopies],
    ['F4b', (c) => c.verbatimDupCopies],
    ['F6', (c) => c.dupBlocks],
    // F9 是"同一编号挂两个不同标题"—— 恢复把原编号领回来时最容易原地造出来,
    // 所以既在选行时逐族预检,也在批后按同一把尺子(碰撞组数)兜一遍。
    ['F9', (c) => c.collisionGroups],
  ]) {
    if (get(c1) > get(c0)) problems.push(`${k} 由 ${get(c0)} 涨到 ${get(c1)}`)
  }
  return { problems, hiddenAfter: after.hiddenFamilies, hiddenRowsAfter: after.hiddenRows, counts: c1 }
}

/**
 * 恢复档的落地:临时索引 + commit-tree + CAS(与折叠档同一套 plumbing,绝不碰共享工作树)。
 * 默认档只出报告 —— 恢复是活文档上"把一行交回派单"的动作,必须人看过名单再落。
 */
export function restoreTerminalsAndLand(maxAttempts = 8) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const spec = `HEAD:${PLAN_REL}`
    const src = catBatch(ROOT, [spec], { maxBuffer: 1 << 28 }).get(spec)
    if (src === null || src === undefined) {
      console.log('恢复档未判定 —— HEAD 取不到 PROJECT_PLAN.md(不记为已修)')
      return 2
    }
    const r = buildRestoreTerminals(src)
    if (!r.edits.length) {
      console.log(
        `✅ 恢复档:HEAD 无可自动恢复的隐形族${r.refused.length ? `(拒绝 ${r.refused.length} 族,逐条点名见 --restore-terminals 报告)` : ''},不动任何东西${attempt > 1 ? ` (第 ${attempt} 轮)` : ''}`,
      )
      return 0
    }
    const v = verifyRestoreTerminals(src, r.text, r.edits)
    if (v.problems.length) {
      console.log('❌ 恢复档停手(现场保留,交人工):')
      for (const p of v.problems.slice(0, 10)) console.log('   ' + p)
      return 1
    }
    const parent = gitIn(null, ['rev-parse', 'HEAD'])
    const msg = [
      'fix(plan): 恢复被"每行都带副本指针"遮住的待办登记(隐形族自动出口)',
      '',
      `触发时 HEAD 现读:隐形族 ${r.hiddenBefore} 族 / ${r.hiddenRowsBefore} 行 ⇒ 本枚给其中 ${r.edits.length} 族各恢复一行代表,隐形面降到 ${v.hiddenAfter} 族 / ${v.hiddenRowsAfter} 行。`,
      `拒绝 ${r.refused.length} 族(注记没有结构边界 ⇒ 按行尾剥会吃作者正文;或恢复会把已被别人持有的编号领回来 ⇒ 撞号),一律交人工、不猜。`,
      '动作只有"删掉机器写的归并注记"一种:勾选状态一字不动、不删行、不并抄,恢复后的正文必须是底稿的保序子序列。',
      `可逆性由各自那把既有尺子把住:F10 折叠形态走 stripTwinFold(折叠档准入判据就是"剥注记后逐字回底稿"),其余走深度配平的 stripMergeNotes。`,
      '零损失判据(任一不过即整批不落):行数不变 ∧ 未登记行逐字不变 ∧ 产物落在声明位置 ∧ 恢复后该行不再带副本指针 ∧ 守门 71 lostMarkers=0 ∧ 所在族真的不再隐形 ∧ F1/F2/F3/F4/F4b/F6 无一上涨。',
      '为什么必须有这个出口:派单口径按"有没有副本指针"筛行,而 F4 的幸存者选择先看有没有指针 ⇒ 一族全部带指针时这件活对派单彻底隐形,账面却全绿。',
    ].join('\n')
    let landed
    try {
      landed = commitTreeWithIndex({
        root: ROOT,
        parent,
        baseRef: parent,
        message: msg,
        entries: [{ path: PLAN_REL, text: r.text }],
      })
    } catch (e) {
      console.log(`❌ 恢复档停手 —— 候选树建不出来:${String(e?.message ?? e).slice(0, 160)}`)
      return 1
    }
    if (!casUpdateRef(landed.commit, parent, { root: ROOT })) {
      console.log(`↻ 第 ${attempt} 次 CAS 失败(HEAD 被并发推进),整轮按新 HEAD 现取重算行号再来`)
      continue
    }
    const landedSpec = `${landed.commit}:${PLAN_REL}`
    const landedText = catBatch(ROOT, [landedSpec], { maxBuffer: 1 << 28 }).get(landedSpec)
    if (landedText === null || landedText === undefined) {
      console.log(`❌ 落地后回读不到 ${landed.commit.slice(0, 11)} 的台账 ⇒ 不记为已修,回退`)
      casUpdateRef(parent, landed.commit, { root: ROOT })
      return 1
    }
    const recheck = verifyRestoreTerminals(src, landedText, r.edits)
    if (recheck.problems.length) {
      console.log(`❌ 落地后复验不过(${recheck.problems[0]}),回退到 ${parent.slice(0, 11)}`)
      casUpdateRef(parent, landed.commit, { root: ROOT })
      return 1
    }
    const align = alignSharedIndex({ root: ROOT, paths: [PLAN_REL], parentRef: parent })
    const nOf = (x) => (Array.isArray(x) ? x.length : Number(x) || 0)
    console.log(
      `✅ 恢复档落地 ${landed.commit.slice(0, 11)}:恢复 ${r.edits.length} 行代表,隐形族 ${r.hiddenBefore}→${recheck.hiddenAfter}(行 ${r.hiddenRowsBefore}→${recheck.hiddenRowsAfter});` +
        `落地面现读 F1 ${recheck.counts.forks} / F4 ${recheck.counts.dupOpenCopies} / 未勾选 ${recheck.counts.open};` +
        `拒绝 ${r.refused.length} 族交人工;共享索引 移动 ${nOf(align.moved)} / 已就位 ${nOf(align.already)}` +
        `${nOf(align.skipped) ? ` / 归属他人未动 ${align.skipped.map((s) => s.path).join(',')}` : ''}` +
        `${align.lockAbandoned || align.failed ? '(共享索引未对齐 ⇒ 必须复跑,否则下一次普通提交会写回旧版)' : ''}`,
    )
    return 0
  }
  console.log(`❌ ${maxAttempts} 轮都没抢到 CAS,放弃`)
  return 1
}

// ── 块级重复的收口出口(F6)────────────────────────────────────────────
/**
 * 删掉"逐字相同的第 2..N 份",保留每一份的第一次出现。
 *
 * 为什么这一型**可以**机器动而 F4 的漂移副本不行:两份逐字相同 ⇒ 删掉的那一份**不含任何**
 * 幸存份没有的字节,零损失可按行值直接证明(见 verifyBlockDedupe);而漂移副本两份正文不同,
 * 自动折一半就是有损,只能交人判哪份作数。
 *
 * 为什么行级归并(F1–F4 那套"翻勾 + 注记")对它无效:那一套的动作是**改行内状态、一行不删**,
 * 而整块重复要消除的恰恰是"多出来的那些行" —— 用改状态的方式永远消不掉块。
 */
export function buildBlockDedupe(content) {
  const { verbatim } = auditPlan(content).dupBlocks
  const lines = String(content).split('\n')
  const drop = new Set()
  const removed = []
  for (const b of verbatim) {
    for (const start of b.lines.slice(1)) {
      for (let k = 0; k < b.len; k++) {
        const ln = start + k
        if (drop.has(ln)) {
          // 两个重复块在行号上重叠 ⇒ 判据算错了(run 扫描结构上不可能,出现即停手交人工)
          throw new Undetermined(`块级收口判据自相矛盾:L${ln} 同时落在两个待删块里`)
        }
        drop.add(ln)
      }
      removed.push({ first: b.first, at: start, len: b.len })
    }
  }
  const out = lines.filter((_, i) => !drop.has(i + 1))
  return { text: out.join('\n'), removed, deletedCount: drop.size }
}

/** 块级收口的零损失断言 —— 四条同时成立才允许落地,任一不成立即整批停手。 */
export function verifyBlockDedupe(srcText, outText, deletedCount) {
  const problems = []
  const a = String(srcText).split('\n')
  const b = String(outText).split('\n')
  if (a.length - b.length !== deletedCount)
    problems.push(`行数差 ${a.length - b.length} 与待删数 ${deletedCount} 不等`)
  const countOf = (arr) => {
    const m = new Map()
    for (const l of arr) m.set(l, (m.get(l) ?? 0) + 1)
    return m
  }
  const ca = countOf(a)
  const cb = countOf(b)
  // 每个被删值都必须在输出里仍有一份逐字相同的幸存行 —— 这是"删的是副本、不是唯一副本"的证明
  for (const [line, n] of ca) {
    const m = cb.get(line) ?? 0
    if (m === 0 && n > 0) problems.push(`值「${line.slice(0, 40)}…」在输出里一份都不剩`)
    if (m > n) problems.push(`值「${line.slice(0, 40)}…」反而变多 ${n}→${m}`)
  }
  const before = auditPlan(srcText).counts
  const after = auditPlan(outText).counts
  for (const [k, get] of [
    ['F1', (c) => c.forks],
    ['F2', (c) => c.voidRows],
    ['F3', (c) => c.rotatedAuto],
    ['F4', (c) => c.dupOpenCopies],
    ['F6', (c) => c.dupBlocks],
  ]) {
    if (get(after) > get(before)) problems.push(`${k} 由 ${get(before)} 涨到 ${get(after)}`)
  }
  if (deletedCount > 0 && after.dupBlocks >= before.dupBlocks)
    problems.push(`删了 ${deletedCount} 行而块数没降(${before.dupBlocks}→${after.dupBlocks})—— 判据或实现有一边是错的`)
  if (after.mergeNotes < before.mergeNotes)
    problems.push(`归并落账注记由 ${before.mergeNotes} 掉到 ${after.mergeNotes}(不得随块一起丢)`)
  return problems
}


// ── 单行等值副本档(G-336,2026-09-28 立)───────────────────────────
/**
 * F6 的块级判据门槛是 **≥3 行且每行 ≥40 字符的连续块逐字相同**(阈值本身是对的:低于它
 * 台账里天然成对的短行会成百地冒出来,噪声淹信号)。于是"同一件事被写成两份、每份都是单行"
 * 恰好落在缝里,而 F1/F2/F4 也不计它 —— 四条判据里"待办副本"要求未勾形态,两份都已 `[x]` ⇒ 账面全 0。
 *
 * 这一档只补那一种形态,判据苛刻到四条件同时成立才动手:
 *  ① 行首是**已完成**形态 `- [x]`(未勾行的两份是"两件待办",不是副本,机器无权折);
 *  ② 整行长度 ≥40 字符(短行噪声阈,与 F6 同一取向);
 *  ③ 两份以上**逐字节相同**(有任何一字不同就是"漂移副本",自动折半即有损 ⇒ 交人工);
 *  ④ 是顶层行(不以空白缩进开头)—— 缩进行属于某个块的续行,归 F6 那条尺子管。
 * 只删第 2..N 份,保留首次出现;落地前后都跑一次同一把尺子,归并注记与 F 维一律不得变差。
 */
const ROW_MIN_LEN = 40
const ROW_DONE_RE = /^- \[x\]/
/** 单批拟删行数上限:超过它 ⇒ 拒落并给出"逐批 --match"的出路(与归档器的大批量阀门同一取向)。 */
const ROW_MASS_LIMIT = 25

/** @returns {Array<{line:string, copies:number, at:number[]}>} 按首次出现行号排序 */
export function findRowTwins(content) {
  const lines = String(content).split('\n')
  const seen = new Map()
  lines.forEach((l, i) => {
    if (!ROW_DONE_RE.test(l)) return
    if (l.length < ROW_MIN_LEN) return
    if (!seen.has(l)) seen.set(l, [])
    seen.get(l).push(i + 1)
  })
  const groups = []
  for (const [line, at] of seen) if (at.length > 1) groups.push({ line, copies: at.length, at })
  return groups.sort((a, b) => a.at[0] - b.at[0])
}

export function buildRowDedupe(content, match = null) {
  const groups = findRowTwins(content).filter((g) => !match || g.line.includes(match))
  const drop = new Set()
  const removed = []
  for (const g of groups) {
    for (const ln of g.at.slice(1)) {
      if (drop.has(ln)) throw new Undetermined(`单行副本判据自相矛盾:L${ln} 被两组同时认领`)
      drop.add(ln)
      removed.push({ line: g.line, at: ln })
    }
  }
  const out = String(content).split('\n').filter((_, i) => !drop.has(i + 1))
  return { text: out.join('\n'), removed, deletedCount: drop.size, groups }
}

/**
 * 幂等判据的"本轮范围"取集合出口 —— **只有一份**。分块档传 Set,也允许传数组(取证时手搭夹具更省事),
 * 但两者都必须走这里:一处用 `has`、另一处用 `includes` 就会在"整行文本 vs 子串"上漂开,
 * 而漂开的表现不是报错,是"某一组被算进范围却没被真删而账面判绿"。
 * 集合成员是**整行原文**(不是锚点子串)—— 与 findXxxTwins 产物的 `g.line` 同一物,不做归一。
 */
function scopeSetOf(scopeLines) {
  if (scopeLines instanceof Set) return scopeLines
  if (Array.isArray(scopeLines)) return new Set(scopeLines)
  throw new Undetermined('scopeLines 必须是 Set 或整行文本数组(收到别的东西就是调用方写错了,不猜)')
}

/**
 * 单行副本档的零损失断言 —— 五条同时成立才允许落地。
 * 与块级档**同源但不等值**:块级要证"F6 必降",这里要证"这一档自己清干净了(幂等)"。
 *
 * 已完成档与未勾选档**共用下面那一份核**(本仓"两处算同一件事必漂移"记过最多次,
 * 而这两处产出的是同一个词——"零损失")。两档唯一的差别是"什么算等值副本"的取组函数,
 * 它由调用方喂进来;把断言抄第二份,就等于允许两档在不同日子给出相反的零损失结论。
 * 各档独有的更强断言走 `extra` 参数,不得塞回公共核里(公共核必须两档都能过)。
 */
export function verifyRowDedupe(srcText, outText, deletedCount, match = null) {
  return verifyRowDedupeCore(srcText, outText, deletedCount, match, findRowTwins)
}

export function verifyRowDedupeCore(srcText, outText, deletedCount, match, findTwins, scopeLines = null) {
  const problems = []
  const a = String(srcText).split('\n')
  const b = String(outText).split('\n')
  if (a.length - b.length !== deletedCount)
    problems.push(`行数差 ${a.length - b.length} 与待删数 ${deletedCount} 不等`)
  // ① 输出必须是输入的顺序子序列(只允许"删",不允许"改"或"换序")
  let i = 0
  for (const line of b) {
    while (i < a.length && a[i] !== line) i++
    if (i >= a.length) {
      problems.push(`输出里有一行在输入里按序找不到(≠ 纯删除):「${line.slice(0, 40)}…」`)
      break
    }
    i++
  }
  // ② 每个被删值都必须在输出里仍有一份逐字相同的幸存行;任何值都不得变多;
  //    且**不得出现输入里没有的新行**(子序列判据漏得掉"末尾新加一行"以外的插行形态,
  //    这条把它补成双向对账 —— 只断"不删"会造出重复行而账面全绿,本仓实测过 1543 行那一型)。
  const countOf = (arr) => {
    const m = new Map()
    for (const l of arr) m.set(l, (m.get(l) ?? 0) + 1)
    return m
  }
  const ca = countOf(a)
  const cb = countOf(b)
  for (const [line, n] of ca) {
    const m = cb.get(line) ?? 0
    if (m === 0 && n > 0) problems.push(`值「${line.slice(0, 40)}…」在输出里一份都不剩`)
    if (m > n) problems.push(`值「${line.slice(0, 40)}…」反而变多 ${n}→${m}`)
  }
  for (const [line, m] of cb) {
    if (!ca.has(line)) problems.push(`产物里出现输入中不存在的行(= 新增,本档只许删):「${line.slice(0, 40)}…」`)
  }
  // ③ F1–F4 + F6 无一上涨(这把尺子不许替别的维度制造红点)
  const before = auditPlan(srcText).counts
  const after = auditPlan(outText).counts
  for (const [k, get] of [
    ['F1', (c) => c.forks],
    ['F2', (c) => c.voidRows],
    ['F3', (c) => c.rotatedAuto],
    ['F4', (c) => c.dupOpenCopies],
    ['F6', (c) => c.dupBlocks],
  ]) {
    if (get(after) > get(before)) problems.push(`${k} 由 ${get(before)} 涨到 ${get(after)}`)
  }
  // ④ 归并落账注记不得随副本一起丢 —— 判的是"**种类**是否整类消失",不是"份数有没有变少"。
  //    本档删的正是逐字相同的孪生**指针行**,按份数比等于禁止本档存在:2026-09-29 真仓
  //    `--dedupe-rows` 一跑就报"253 掉到 244"(那 9 条同文指针就是它自己要清的东西)⇒
  //    判据与它要修的那一型互咬,结果不是"少清一点",而是这一维在真账面上**永远落不了地**。
  //    "每个被删值都有同文幸存份"已由 ② 逐行证明,这里只补一条更弱的:注记文本不得整类不见。
  const distinct = (arr) => Array.from(new Set(arr)).join('\n')
  const kindsBefore = countMergeNotes(distinct(a))
  const kindsAfter = countMergeNotes(distinct(b))
  if (kindsAfter < kindsBefore)
    problems.push(`归并落账注记的种类由 ${kindsBefore} 掉到 ${kindsAfter}(不得整类消失;份数变少不算,那正是本档在做的事)`)
  // ⑤ 幂等:做完之后**本档范围内**的等值副本必须清零(带 --match 时只核该子集),
  //    否则要么没删净、要么判据自己错了。取组函数由调用方喂进来,不在这里二次判档。
  //
  //    `scopeLines` 是分块档专用的**第三种子集口径**:调用方把"本轮真的选中并删除的那些组的整行
  //    文本"交进来,幂等只在**这个集合**上判。为什么必须换口径而不是换阈值:分块之后必然还有
  //    没轮到的组留在面上,按"本档清零"判就是一台**每次分块都恒拒**的尺子 —— 它拦不住任何
  //    错误(没选中的组本来就不该在本轮消失),只保证分块这条路一步都走不通。
  //    它**不放宽任何一条对已选组的判据**:被选中的组若没删净,set 里那一条照样还在 findTwins
  //    的产物里 ⇒ 当场红。放宽的只有"本轮没认领的组算不算未清",而那一条由 ①②③④⑥⑦⑧
  //    七条共同兜住(它们判的是"没被选中的行必须逐字活着",与幂等是两个问题)。
  //    没给 scopeLines 时走原来的 match 语义,**逐字不变**(已完成档与旧调用方的结论不得因本
  //    参数存在而改变 —— 那是同一把尺子的两个使用者,不是两个判据)。
  const left = scopeLines
    ? findTwins(outText).filter((g) => scopeSetOf(scopeLines).has(g.line))
    : findTwins(outText).filter((g) => !match || g.line.includes(match))
  if (deletedCount > 0 && left.length > 0)
    problems.push(`删了 ${deletedCount} 行而仍有 ${left.length} 组等值副本未清 ⇒ 不闭合,交人工`)
  return problems
}

/**
 * 单行副本档的落地:临时索引 + commit-tree + CAS(全部走 lib/bypass-git 那一份 plumbing)。
 * `match` 是**内容锚点**(整行子串),用于"只清我这一组"的定向执行;每次 CAS 尝试都按当次 HEAD
 * 现读重算行号,绝不复用上一次的位置(§12 那型:行号在 append 后必挪位)。
 */
export function rowsDedupeAndLand(match = null, maxAttempts = 8) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const spec = `HEAD:${PLAN_REL}`
    const src = catBatch(ROOT, [spec], { maxBuffer: 1 << 28 }).get(spec)
    if (src === null || src === undefined) {
      console.log('单行副本档未判定 —— HEAD 取不到 PROJECT_PLAN.md(不记为已修)')
      return 2
    }
    const groups = findRowTwins(src).filter((g) => !match || g.line.includes(match))
    if (!groups.length) {
      console.log(
        `✅ 无${match ? `匹配的` : '逐字相同的已完成单行'}副本(本档=0),不动任何东西${attempt > 1 ? ` (第 ${attempt} 轮)` : ''}`,
      )
      return 0
    }
    let r
    try {
      r = buildRowDedupe(src, match)
    } catch (e) {
      console.log(`❌ 单行副本档停手 —— ${e instanceof Undetermined ? e.message : String(e?.message ?? e)}`)
      return 1
    }
    const problems = verifyRowDedupe(src, r.text, r.deletedCount, match)
    if (problems.length) {
      console.log('❌ 单行副本档停手(现场保留,交人工):')
      for (const p of problems.slice(0, 10)) console.log('   ' + p)
      return 1
    }
    const parent = gitIn(null, ['rev-parse', 'HEAD'])
    const msg = [
      'fix(plan): 收口被逐字重复的已完成单行登记(G-336 单行副本档的第一次真实执行)',
      '',
      `触发时 HEAD 现读:${groups.length} 组等值副本 / 共 ${groups.reduce((s, g) => s + g.copies, 0)} 份` +
        `${match ? `;本次按内容锚点定向执行(锚点=整行子串,不含行号)` : ';本次为全档清理'}。`,
      `删去第 2..N 份共 ${r.deletedCount} 行,保留每组首次出现;非等值(漂移)副本一份未动 —— 自动折半即有损,那型交人工。`,
      `行数 ${src.split('\n').length} → ${r.text.split('\n').length}。`,
      '零损失判据(五条,任一不过即整批不落):行数差=待删数 ∧ 输出是输入的顺序子序列 ∧ 每个被删值仍有幸存份且无任何值变多 ∧ F1/F2/F3/F4/F6 无一上涨 ∧ 归并落账注记不降 ∧ 本档清零(幂等)。',
      '判据门槛:行首为已完成形态 `- [x]` ∧ 整行 ≥40 字符 ∧ 顶层行 ∧ 逐字节相同 —— 四条同时成立才算副本。',
    ].join('\n')
    let landed
    try {
      landed = commitTreeWithIndex({
        root: ROOT,
        parent,
        baseRef: parent,
        message: msg,
        entries: [{ path: PLAN_REL, text: r.text }],
      })
    } catch (e) {
      console.log(`❌ 单行副本档停手 —— 候选树建不出来:${String(e?.message ?? e).slice(0, 160)}`)
      return 1
    }
    if (!casUpdateRef(landed.commit, parent, { root: ROOT })) {
      console.log(`↻ 第 ${attempt} 次 CAS 失败(HEAD 被并发推进),整轮按新 HEAD 重算副本位置再来`)
      continue
    }
    const landedSpec = `${landed.commit}:${PLAN_REL}`
    const landedText = catBatch(ROOT, [landedSpec], { maxBuffer: 1 << 28 }).get(landedSpec)
    if (landedText === null || landedText === undefined) {
      console.log(`❌ 落地后回读不到 ${landed.commit.slice(0, 11)} 的台账 ⇒ 不记为已修,回退`)
      casUpdateRef(parent, landed.commit, { root: ROOT })
      return 1
    }
    const after = auditPlan(landedText).counts
    const leftAfter = findRowTwins(landedText).filter((g) => !match || g.line.includes(match))
    if (leftAfter.length > 0) {
      console.log(`❌ 落地后回读仍有 ${leftAfter.length} 组等值副本,回退到 ${parent.slice(0, 11)}`)
      casUpdateRef(parent, landed.commit, { root: ROOT })
      return 1
    }
    const align = alignSharedIndex({ root: ROOT, paths: [PLAN_REL], parentRef: parent })
    // alignSharedIndex 正常路径返回**数组**、等锁超上限那条返回 0 ⇒ 归一成计数再打印,
    // 否则同一条日志会在两种形态间跳(把"没对齐"读成"对齐了 0 个")。
    const nOf = (v) => (Array.isArray(v) ? v.length : Number(v) || 0)
    console.log(
      `✅ 单行副本档落地 ${landed.commit.slice(0, 11)}:删 ${r.deletedCount} 行(保留首次出现),F1–F4/F6 ${[
        after.forks,
        after.voidRows,
        after.rotatedAuto,
        after.dupOpenCopies,
        after.dupBlocks,
      ].join('/')} 未涨;共享索引 移动 ${nOf(align.moved)} / 已就位 ${nOf(align.already)}` +
        `${nOf(align.skipped) ? ` / 归属他人未动 ${align.skipped.map((s) => s.path).join(',')}` : ''}` +
        `${nOf(align.undetermined) ? ` / 未判定 ${nOf(align.undetermined)}` : ''}` +
        `${align.lockAbandoned || align.failed ? '(共享索引未对齐 ⇒ 必须复跑一次,否则下一次普通提交会写回旧版)' : ''}`,
    )
    return 0
  }
  console.log(`❌ ${maxAttempts} 轮都没抢到 CAS,放弃`)
  return 1
}

// ── 未勾单行等值副本档(G-741,2026-09-29 立)─────────────────────────
/** 未勾选行的行首形态(与已完成档的 `ROW_DONE_RE` 同位、同窄度,只差这一个字符)。 */
const ROW_OPEN_RE = /^- \[ \]/

/**
 * 已完成那一族已由 `--dedupe-rows` 收口,但**未勾选**的逐字孪生行到今天仍然没有任何出口。
 *
 * 为什么现有四条判据与两块档都不响(现读 HEAD 面,2026-09-29):
 *  - F1 要"一勾一未勾"两态并存;两份同态 ⇒ 不响。
 *  - F4 按"编号 + 题面"配主键,它的处置出口是**给副本行加一句"重复登记副本"指针、一行不删**
 *    (§1 禁止无声删除);加完指针之后两份都带同一句指针 ⇒ 行仍在那儿。
 *  - F4b 刻意排除带指针的行,也排除有主键的行 ⇒ 这一族两头都不计。
 *  - F6 只认"≥3 行且每行 ≥40 字符的连续块" ⇒ 单行结构上看不见。
 *  - 守门 71 防"丢行",从不防"重行"。
 * 后果不是难看,是**功能被卡死**:台账里任何按该行内容定位的自动动作(
 * `scripts/live-doc-edit.mjs`、自建锚点脚本)都按"锚点命中≠1 不猜"拒绝插入 ——
 * 派单口径已经把它们逐出 claimable(现读 dupPointerRows 1725 / claimable 490),
 * 而"这一行有两份"这件事永久无人可清。真仓现读:顶层 ≥40 字符的未勾选逐字孪生 **220 组 /
 * 可删份数 1148**,其中 6 组带租约 `（进行中@…）`。
 *
 * 判据比已完成档**更窄一档**,五条件同时成立才动手:
 *  ① 行首 `- [ ]`(未勾选);
 *  ② 整行 ≥40 字符(与 F6/已完成档同一噪声阈);
 *  ③ 顶层行(不以空白缩进开头)—— 缩进续行归 F6 那把尺子;
 *  ④ 两份以上**逐字节相同**(含行尾空白/BOM/CRLF:差一个字就是漂移副本,机器折半即有损 ⇒
 *     一份不动并逐条点名交人工);
 *  ⑤ **该行已带 `【归并】重复登记副本` 指针**。
 *
 * 第⑤条是本档全部安全论据的落点,也是"复用尺子、不另写一份什么算重复"的实现方式:
 * 尺子(auditPlan 的 claimable 排除)早已把带该指针的行算作**同一条活的副本**,所以删掉第 2..N 份
 * 不改活数 —— 这一点不靠注释承诺,由 `verifyOpenRowDedupe` 的"派单口径活数一枚不少"当场反证。
 * **没带指针**的逐字孪生则是 F4/F4b 的当次活账,那一族的出口是 `--heal` 加注记(一行不删);
 * 本档若去删它,等于替人做出"这条待办没人要了"的判断 ⇒ 一律点名、一份不删(见 findOpenRowRefusals)。
 *
 * 幸存者取**首次出现**(与已完成档同形;两份逐字节相同 ⇒ 保留哪一份不影响内容)。
 */
export function findOpenRowTwins(content) {
  const lines = String(content).split('\n')
  const seen = new Map()
  lines.forEach((l, i) => {
    if (!ROW_OPEN_RE.test(l)) return
    if (l.length < ROW_MIN_LEN) return
    if (!DUP_POINTER_RE.test(l)) return
    if (!seen.has(l)) seen.set(l, [])
    seen.get(l).push(i + 1)
  })
  const groups = []
  for (const [line, at] of seen) if (at.length > 1) groups.push({ line, copies: at.length, at })
  return groups.sort((a, b) => a.at[0] - b.at[0])
}

/**
 * 本档**刻意不删**的两族,一律报名(判据失效的表现永远是安静,所以三态必须点名到行)。
 *  - `noPointer`:未勾选 + 顶层 + ≥40 + 逐字相同,但没带指针 ⇒ 交 `--heal`(F4/F4b 加注记)。
 *  - `drifted` :同复合主键下 ≥2 条未勾选而正文已漂开 ⇒ 交人工。取组一律喂**尺子自己的**
 *    `auditPlan().dupOpen`(findForks 的产物),本档不重写"什么算同题"—— 重写的那一份迟早与
 *    判据漂开,而漂开的表现是"这一族没人看见"而不是"报错"。
 * @returns {{noPointer:Array<{line:string,copies:number,at:number[]}>,drifted:Array<{key:string,copies:number,at:number[]}>}}
 */
export function findOpenRowRefusals(content) {
  const lines = String(content).split('\n')
  const seen = new Map()
  lines.forEach((l, i) => {
    if (!ROW_OPEN_RE.test(l)) return
    if (l.length < ROW_MIN_LEN) return
    if (DUP_POINTER_RE.test(l)) return
    if (!seen.has(l)) seen.set(l, [])
    seen.get(l).push(i + 1)
  })
  const noPointer = []
  for (const [line, at] of seen) if (at.length > 1) noPointer.push({ line, copies: at.length, at })
  noPointer.sort((a, b) => a.at[0] - b.at[0])
  const drifted = []
  for (const g of auditPlan(content).dupOpen) {
    const texts = new Set(g.open.map((r) => r.raw))
    if (texts.size > 1) drifted.push({ key: g.key, copies: g.open.length, at: g.open.map((r) => r.line) })
  }
  return { noPointer, drifted }
}

/**
 * 分块贪心的**唯一**实现(2026-09-29 分块档立)。取组函数已按首次出现行号升序排好,
 * 所以这里只做两件事:**按序整组装填到装不下就另起一块**、**单组超上限的整组挪出去报名**。
 *
 * 三条不可漂的写法,每条都有实测理由:
 *  ① **组不切半**。`cost = g.at.length - 1` 必须整组计入或整组不计。切一半会让"每个被删值都有
 *     同文幸存份"那条断言失去意义(它证的是"这一族还剩一份",而不是"这一族还剩几份"),
 *     而失去意义的判据比没有判据更糟 —— 它会替被切的那一半发合格证。
 *  ② **单组超上限 ⇒ 跳过它继续装后面的组,并逐条报名**(2026-09-29 由"停手"改成这一套,理由是量出来的:
 *     真仓 215 组里有一组 cost=37 > 上限且排在首次出现序很前,纯前缀贪心下**它和它后面的 1102 行
 *     永远进不了任何块** —— 于是"分块"这项能力对全档 96% 的账一条都不生效,而账面看起来合规)。
 *     跳过不是放过:每一组都进 `oversized` 清单,报告与拒批量分支逐条点名它,出路仍是
 *     `--match` 定向清它或人工 `--allow-mass` 整批放行 —— **永不静默**。
 *     块内与块间顺序仍按首次出现升序,所以"保留每组首次出现"那条判据不受装填策略影响。
 *  ③ `maxRows` 为 null ⇒ 一整块装全部,与分块之前的行为**逐字等值**(不是"近似等值":
 *     同一输入跑两遍产物字符串必须全等,由镜像测试钉住)。
 *
 * @param {Array<{line:string,copies:number,at:number[]}>} groups 已按首次出现升序
 * @param {number|null} maxRows 单块拟删行数上限;null = 不分块
 * @returns {{chunks:Array<{groups:Array,rows:number}>,oversized:Array<{line:string,copies:number,cost:number}>,totalRows:number,remainingRows:number}}
 *   `remainingRows` = **进不了任何块**的行数(即全部 oversized 组的可删份数之和);
 *   `oversized` = 单组 cost 就超上限的那些组,逐条报名 —— 它们不是"被放过",是"这条路装不下,
 *   必须换 `--match` 或人工 `--allow-mass`"。清单为空才叫"全档都能被块覆盖"。
 */
export function planOpenRowChunks(groups, maxRows = null) {
  const list = Array.isArray(groups) ? groups.slice() : []
  const costOf = (g) => g.at.length - 1
  const totalRows = list.reduce((s, g) => s + costOf(g), 0)
  if (maxRows === null || maxRows === undefined) {
    return {
      chunks: list.length ? [{ groups: list, rows: totalRows }] : [],
      oversized: [],
      totalRows,
      remainingRows: 0,
    }
  }
  const oversized = []
  const fit = []
  for (const g of list) {
    if (costOf(g) > maxRows) oversized.push({ line: g.line, copies: g.copies, cost: costOf(g) })
    else fit.push(g)
  }
  const chunks = []
  let cur = null
  for (const g of fit) {
    if (!cur || cur.rows + costOf(g) > maxRows) {
      cur = { groups: [], rows: 0 }
      chunks.push(cur)
    }
    cur.groups.push(g)
    cur.rows += costOf(g)
  }
  return {
    chunks,
    oversized,
    totalRows,
    remainingRows: oversized.reduce((s, o) => s + o.cost, 0),
  }
}

/**
 * 只删第 2..N 份;`match` 是内容锚点(整行子串,不认行号),不命中的组一份不动。
 * `maxRows` 给定时**只取第一个块**(见 planOpenRowChunks);返回的 `groups` 仍是"锚点命中的全部组"
 * (既有调用方与镜像按它判锚点命中数,语义不得动),实际纳入的部分在 `selectedGroups` 里。
 */
export function buildOpenRowDedupe(content, match = null, maxRows = null) {
  const groups = findOpenRowTwins(content).filter((g) => !match || g.line.includes(match))
  const plan = planOpenRowChunks(groups, maxRows)
  const selectedGroups = plan.chunks.length ? plan.chunks[0].groups : []
  const selectedLines = new Set(selectedGroups.map((g) => g.line))
  const drop = new Set()
  const removed = []
  for (const g of selectedGroups) {
    for (const ln of g.at.slice(1)) {
      if (drop.has(ln)) throw new Undetermined(`未勾单行副本判据自相矛盾:L${ln} 被两组同时认领`)
      drop.add(ln)
      removed.push({ line: g.line, at: ln })
    }
  }
  const out = String(content).split('\n').filter((_, i) => !drop.has(i + 1))
  return {
    text: out.join('\n'),
    removed,
    droppedLines: drop,
    deletedCount: drop.size,
    groups,
    selectedGroups,
    selectedLines,
    plan,
  }
}

/**
 * 未勾档的零损失断言 = 已完成档那**一份**核(顺序子序列 / 幸存份在位 / 无新增行 / 无值变多 /
 * F1–F4+F6 不涨、注记种类不整类消失 / 本档幂等清零)+ 本档独有的三条更强断言:
 *  ⑥ 派单口径活数**必须一枚不少** —— 这是"删的是副本而不是一条真待办"的唯一机器证据;
 *  ⑦ 未勾选行数减量必须与声明删除数吻合(删的全是 `- [ ]` 行,不许顺手吃掉别的形态);
 *  ⑧ 不越界:没带指针的等值孪生必须一份不少地留着(那一族的出口是 --heal,不是本档)。
 * `droppedLines` 给定时再补一条最硬的:产物必须逐行等于"原文件减去声明的那几行"。
 * `scopeLines`(分块档)只把**第⑤条幂等**收窄到"本轮认领的那些组",其余七条一字不动 ——
 * 它们判的恰好是"本轮没认领的行必须逐字活着",与分块方向一致,不存在"顺手放宽"的余地。
 */
export function verifyOpenRowDedupe(srcText, outText, deletedCount, match = null, droppedLines = null, scopeLines = null) {
  const problems = verifyRowDedupeCore(srcText, outText, deletedCount, match, findOpenRowTwins, scopeLines)
  if (droppedLines) {
    const expect = String(srcText)
      .split('\n')
      .filter((_, i) => !droppedLines.has(i + 1))
    const got = String(outText).split('\n')
    if (expect.length !== got.length || expect.some((l, idx) => l !== got[idx]))
      problems.push('产物 ≠「原文件减去声明的那几行」—— 除被删的重复行外必须逐行等值')
  }
  const before = auditPlan(srcText).counts
  const after = auditPlan(outText).counts
  if (after.claimable !== before.claimable)
    problems.push(
      `派单口径活数由 ${before.claimable} 变到 ${after.claimable} ⇒ 删掉的不是"副本"而是一条真待办(或反向造出一条),整批不落`,
    )
  if (after.open !== before.open - deletedCount)
    problems.push(`未勾选行由 ${before.open} 到 ${after.open},与声明删除数 ${deletedCount} 不吻合`)
  const r0 = findOpenRowRefusals(srcText).noPointer
  const r1 = findOpenRowRefusals(outText).noPointer
  if (r0.length !== r1.length)
    problems.push(
      `未带指针的等值孪生由 ${r0.length} 组变成 ${r1.length} 组 —— 那一族的出口是 --heal 加注记,本档不得碰`,
    )
  return problems
}

/**
 * 未勾档落地的**单轮**出口(一轮 = 至多一枚提交)。返回结构化结论而不是裸退出码:
 * 外层轮次循环需要知道"这一轮是没活干、还是被阀门拒了、还是判据没过",三者处置动作不同
 * (前者正常收尾、后两者必须停下并把原因原样带出去 —— 把失败收敛成"跑完了"就是造合格证)。
 *
 * 底稿**一律取被审面上的 HEAD blob**(经 face-reader 的 catBatch,绝不 readFileSync
 * 工作树当判定输入),写盘只走 `lib/bypass-git.mjs` 已有的三个出口 —— 同一套 plumbing 在本仓被手写
 * 过 6 份并互相漂开,其中一份把"重复行计数"当零损失判据,一次也没落地成功。
 *
 * `--staged` 面**允许出报告、拒绝落地**(rc 2 并说明理由):索引里的 PROJECT_PLAN.md 含别人 staged 的
 * 内容,把它连我的删除一起交出去就是 §12 的污染型。这一格宁可不做,不可代交。
 *
 * 每次 CAS 尝试都按**当次 HEAD** 重算组与行号(并发会话一天推进几十枚提交,行号必挪位),
 * 落地后回读复核"本轮认领的组清零 ∧ 活数未变",任一条不符即 CAS 回退到 parent,不留半落地现场。
 *
 * @returns {{kind:'landed'|'empty'|'refused'|'failed'|'undetermined',deletedCount:number,
 *   sha:string|null,remainingGroups:number,remainingRows:number,reason?:string}}
 */
function openRowsDedupeOnce(match = null, maxAttempts = 8, opts = {}) {
  const root = opts.root ?? ROOT
  const allowMass = !!opts.allowMass
  const maxRows = opts.maxRows ?? null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const spec = `HEAD:${PLAN_REL}`
    const src = catBatch(root, [spec], { maxBuffer: 1 << 28 }).get(spec)
    if (src === null || src === undefined) {
      console.log('未勾单行副本档未判定 —— 被审面取不到 PROJECT_PLAN.md(不记为已修)')
      return { kind: 'undetermined', deletedCount: 0, sha: null, remainingGroups: 0, remainingRows: 0 }
    }
    const groups = findOpenRowTwins(src).filter((g) => !match || g.line.includes(match))
    if (!groups.length) {
      console.log(
        `✅ 无"已写明重复登记副本"的未勾选等值单行副本(本档=0),不动任何东西${attempt > 1 ? ` (第 ${attempt} 轮)` : ''}`,
      )
      return { kind: 'empty', deletedCount: 0, sha: null, remainingGroups: 0, remainingRows: 0 }
    }
    let r
    try {
      r = buildOpenRowDedupe(src, match, maxRows)
    } catch (e) {
      console.log(`❌ 未勾单行副本档停手 —— ${e instanceof Undetermined ? e.message : String(e?.message ?? e)}`)
      return { kind: 'failed', deletedCount: 0, sha: null, remainingGroups: groups.length, remainingRows: 0 }
    }
    // 分块一个组都没选中 ⇒ **所有**组都单组超上限(装不下任何组)。组不得切半,所以这不是
    // "再多跑几轮"能解决的:它必须换出口(--match 定向清某一组,或 --allow-mass 人工放行整批)。
    // 注意这一分支**不等于**"跳过超上限组后无事可做"——那种情况 planOpenRowChunks 已把装得下的
    // 组装进块里了,只有"没有一组装得下"才会走到这里,此时喊停才是对的(不落就是不落,
    // 不造"跑了但没东西可跑"的假动作)。
    if (maxRows !== null && r.selectedGroups.length === 0) {
      const ov = r.plan.oversized
      const first = ov[0]
      console.log(
        `❌ 分块停手:${ov.length} 组**每一组**单组就要删 > --max-rows ${maxRows},而组**不得切半** ⇒ 没有任何块装得下它们。\n` +
          `   本轮认领 0 组 / 0 行,一分未落。\n` +
          `   出路二选一:① \`--dedupe-open-rows --match "<该行的一段原文>" --max-rows ${first ? first.cost : 'N'}\` 定向清某一组;` +
          `② 人工复核后加 --allow-mass 整批放行(它会原样写进落地提交信息)。\n` +
          `   超上限的组(最多点名 5 条):${
            ov
              .slice(0, 5)
              .map((o) => `${o.copies} 份/需删 ${o.cost} 行/「${String(o.line).slice(0, 44)}…」`)
              .join(' ; ') || '(取不到)'
          }`,
      )
      return {
        kind: 'refused',
        deletedCount: 0,
        sha: null,
        remainingGroups: groups.length,
        remainingRows: r.plan.remainingRows,
      }
    }
    if (r.deletedCount > ROW_MASS_LIMIT && !allowMass) {
      console.log(
        `❌ 拒批量:本次拟删 ${r.deletedCount} 行 > 单批上限 ${ROW_MASS_LIMIT} 行 —— 活文档上一次删几百行没人复核得动。\n` +
          `   分块做法:\`--dedupe-open-rows --max-rows ${ROW_MASS_LIMIT} [--rounds N]\` 自动按 ≤${ROW_MASS_LIMIT} 行/组完整切块,每块一枚可 revert 的提交;\n` +
          `   逐批做法:\`--dedupe-open-rows --match "<该行的一段原文>"\` 看清范围,确认断言后加 --commit;确要整档放开再显式加 --allow-mass。`,
      )
      return { kind: 'refused', deletedCount: 0, sha: null, remainingGroups: groups.length, remainingRows: 0 }
    }
    const scope = maxRows === null ? null : r.selectedLines
    const problems = verifyOpenRowDedupe(src, r.text, r.deletedCount, match, r.droppedLines, scope)
    if (problems.length) {
      console.log('❌ 未勾单行副本档停手(现场保留,交人工):')
      for (const p of problems.slice(0, 10)) console.log('   ' + p)
      return { kind: 'failed', deletedCount: 0, sha: null, remainingGroups: groups.length, remainingRows: 0 }
    }
    const c0 = auditPlan(src).counts
    const parent = bypassGit(['rev-parse', 'HEAD'], { root })
    const msg = [
      'fix(plan): 收口被逐字重复的未勾选单行登记(G-741 未勾单行档)',
      '',
      `触发时被审面 HEAD 现读:${groups.length} 组等值副本 / 共 ${groups.reduce((s, g) => s + g.copies, 0)} 份` +
        `${match ? ';本次按内容锚点定向执行(锚点=整行子串,不含行号)' : ';本次为全档清理'}${allowMass ? ';--allow-mass 已由人工放行' : ''}。`,
      maxRows === null
        ? '本次不分块(一次一整批),零损失断言按"本档清零"判。'
        : `本次为**分块落地**:单块上限 ${maxRows} 行,本轮取 ${r.selectedGroups.length} 组共 ${r.deletedCount} 行(按首次出现升序、组不切半);` +
          `幂等只在本轮认领的 ${r.selectedGroups.length} 组上判,其余 ${groups.length - r.selectedGroups.length} 组留给后续块 —— ` +
          `分块不降低任何一条断言,只改变"一次落多少";这一枚提交是本块的唯一审计单位,可单独 git revert。`,
      `删去第 2..N 份共 ${r.deletedCount} 行,保留每组首次出现(两份逐字节相同 ⇒ 保留哪一份不改内容)。`,
      '只折**已写明「【归并】重复登记副本」指针**的未勾选行:尺子的派单口径早已把带该指针的行算作同一条活的副本,所以本档不改活数(落地前后各跑一次同一把尺子当场反证)。',
      '刻意不删并逐条点名的两族:① 未带指针的逐字等值孪生(出口是 --heal 加注记,一行不删);② 同主键而正文已漂开的副本(机器折半即有损,交人工)。',
      `零损失判据(八条,任一不过即整批不落):行数差=待删数 ∧ 输出是输入的顺序子序列 ∧ 每个被删值仍有同文幸存份 ∧ 无任何值变多 ∧ 产物不含新增行 ∧ 除声明删除行外逐行等值 ∧ F1/F2/F3/F4/F6 无一上涨且归并注记种类不整类消失 ∧ 派单口径活数不变 ∧ 未带指针的等值孪生组数不变 ∧ 本轮认领的组清零(幂等,分块时按本轮范围判)。`,
      `行数 ${src.split('\n').length} → ${r.text.split('\n').length};claimable ${c0.claimable} → 由落地后回读复核。`,
    ].join('\n')
    let landed
    try {
      landed = commitTreeWithIndex({
        root,
        parent,
        baseRef: parent,
        message: msg,
        entries: [{ path: PLAN_REL, text: r.text }],
      })
    } catch (e) {
      console.log(`❌ 未勾单行副本档停手 —— 候选树建不出来:${String(e?.message ?? e).slice(0, 160)}`)
      return { kind: 'failed', deletedCount: 0, sha: null, remainingGroups: groups.length, remainingRows: 0 }
    }
    if (!casUpdateRef(landed.commit, parent, { root })) {
      console.log(`↻ 第 ${attempt} 次 CAS 失败(HEAD 被并发推进),整轮按新 HEAD 重算副本位置再来`)
      continue
    }
    const landedSpec = `${landed.commit}:${PLAN_REL}`
    const landedText = catBatch(root, [landedSpec], { maxBuffer: 1 << 28 }).get(landedSpec)
    if (landedText === null || landedText === undefined) {
      console.log(`❌ 落地后回读不到 ${landed.commit.slice(0, 11)} 的台账 ⇒ 不记为已修,回退`)
      casUpdateRef(parent, landed.commit, { root })
      return { kind: 'failed', deletedCount: 0, sha: null, remainingGroups: 0, remainingRows: 0 }
    }
    const leftAll = findOpenRowTwins(landedText)
    const leftAfter = scope ? leftAll.filter((g) => scope.has(g.line)) : leftAll.filter((g) => !match || g.line.includes(match))
    const after = auditPlan(landedText).counts
    if (leftAfter.length > 0 || after.claimable !== c0.claimable) {
      console.log(
        `❌ 落地后回读不闭合(本轮认领的组残留 ${leftAfter.length} 组 / 活数 ${c0.claimable}→${after.claimable}),回退到 ${parent.slice(0, 11)}`,
      )
      casUpdateRef(parent, landed.commit, { root })
      return { kind: 'failed', deletedCount: 0, sha: null, remainingGroups: 0, remainingRows: 0 }
    }
    const align = alignSharedIndex({ root, paths: [PLAN_REL], parentRef: parent })
    const nOf = (v) => (Array.isArray(v) ? v.length : Number(v) || 0)
    const restGroups = leftAll.filter((g) => !scope || !scope.has(g.line))
    const restRows = restGroups.reduce((s, g) => s + g.at.length - 1, 0)
    console.log(
      `✅ 未勾单行副本档落地 ${landed.commit.slice(0, 11)}:删 ${r.deletedCount} 行(保留首次出现)${
        maxRows === null ? '' : `,本轮取 ${r.selectedGroups.length} 组`
      },` +
        `claimable ${c0.claimable} 未变,F1–F4/F6 ${[after.forks, after.voidRows, after.rotatedAuto, after.dupOpenCopies, after.dupBlocks].join('/')} 未涨` +
        `${maxRows === null ? '' : `;当次 HEAD 现算仍剩 ${restGroups.length} 组 / ${restRows} 行`}` +
        `;共享索引 移动 ${nOf(align.moved)} / 已就位 ${nOf(align.already)}` +
        `${nOf(align.skipped) ? ` / 归属他人未动 ${align.skipped.map((s) => s.path).join(',')}` : ''}` +
        `${nOf(align.undetermined) ? ` / 未判定 ${nOf(align.undetermined)}` : ''}` +
        `${align.lockAbandoned || align.failed ? '(共享索引未对齐 ⇒ 必须复跑一次,否则下一次普通提交会写回旧版)' : ''}`,
    )
    return {
      kind: 'landed',
      deletedCount: r.deletedCount,
      sha: landed.commit,
      remainingGroups: restGroups.length,
      remainingRows: restRows,
    }
  }
  console.log(`❌ ${maxAttempts} 轮都没抢到 CAS,放弃`)
  return { kind: 'failed', deletedCount: 0, sha: null, remainingGroups: 0, remainingRows: 0 }
}

/**
 * 外层的**轮次循环**。每一轮都重新按当次 HEAD 现算载荷,绝不复用上一轮的组/行号 ——
 * 这台机的 HEAD 一天推进几十枚,行号在任何一次 append 后都会挪位(§1 规矩 3:证据指针禁止写行号)。
 *
 * 退出码规则(三条,不得并桶):
 *  ① 真的落过地且没有中途失败 ⇒ 0;
 *  ② 一分文未落而报 empty(本就没有可删的副本)⇒ 0(没活干不是失败,但也不是"修好了");
 *  ③ 失败**原样传播**退出码:拒批量 / 断言不过 / CAS 抢不到 ⇒ 1,被审面取不到 ⇒ 2
 *     (把 2 收敛成 1 就是把"没判"写成"判过了",本仓最高频失效型)。
 *
 * 中途失败即停,**不回滚已落的块**:每块都是独立、可单独 `git revert` 的前向提交,
 * 把它们集体撤掉反而制造"什么都没发生"的假象 —— 台账要的是能指出第几块停在哪里。
 */
export function openRowsDedupeAndLand(match = null, maxAttempts = 8, opts = {}) {
  const rounds = Math.max(1, Math.floor(Number(opts.rounds) || 1))
  const maxRows = opts.maxRows ?? null
  let landedCount = 0
  let totalDeleted = 0
  let lastSha = null
  let lastRemaining = null
  for (let round = 1; round <= rounds; round++) {
    if (rounds > 1)
      console.log(
        `── 第 ${round}/${rounds} 轮${maxRows === null ? '' : `(单块上限 ${maxRows} 行,按当次 HEAD 现算,不复用上一轮载荷)`}`,
      )
    const res = openRowsDedupeOnce(match, maxAttempts, opts)
    if (res.kind === 'landed') {
      landedCount++
      totalDeleted += res.deletedCount
      lastSha = res.sha
      lastRemaining = { groups: res.remainingGroups, rows: res.remainingRows }
      continue
    }
    if (res.kind === 'empty') return 0
    if (res.kind === 'undetermined') return 2
    // refused / failed:已落的块保留(每块独立可 revert),这里只把原因原样带出去
    console.log(
      `⏹ 停在第 ${round} 轮(原因见上一行)${
        landedCount ? `:此前已落 ${landedCount} 枚提交 / 共删 ${totalDeleted} 行,均保留,可逐枚 git revert` : ':一分未落'
      }`,
    )
    return 1
  }
  if (landedCount === 0) return 0
  const tail =
    lastRemaining && lastRemaining.groups > 0
      ? `当次面上仍剩 ${lastRemaining.groups} 组 / ${lastRemaining.rows} 行 —— 轮数用完不是"已清完",加大 --rounds 再跑一次`
      : '台账本轮认领的组已全部清零'
  console.log(
    `✅ 分块档共落 ${landedCount} 枚提交 / 删 ${totalDeleted} 行,末枚 ${String(lastSha).slice(0, 11)};${tail}` +
      `(每块单独一枚提交,任一块都可单独 git revert —— 这是这条路径的唯一审计单位)`,
  )
  return 0
}

// ── 同题不同编号的孪生登记折叠档(F10,2026-09-28 立)─────────────────
/**
 * 这一型与 F1/F4 的**唯一**差别就是"编号":并发取号抢同一个号、或改派工具重排过编号之后,
 * 同一件事的几份登记各自带着**不同**的编号 ⇒ `compositeKeyOf` 互不相等 ⇒ 现有归并器
 * (按"编号 + 标题前缀逐字等值"配主键)结构上看不见它。于是这些行永久留在待办清单里,
 * 并把台账门(守门 130)钉成"干净 HEAD 上也红" —— §12f:与提交内容无关的恒红门,唯一结局是
 * 各会话跳钩子、连带链上全部检查对每次提交作废,所以修它优先于任何新增工作。
 * 立项现读(HEAD 面 2026-09-28,同一把尺子 parseTaskRows × titleOf × keyOfRow):
 * 同题而编号互异的族 33 组,**全部**落在 F1/F4 的盲区里,其中未勾选行 23 条可折。
 *
 * 动作与 F4 同族(只改行内注记、不删行、不动勾选、不并抄),但**必须多做一步**:
 * 把编号从**主键位置**摘掉。只加指针不摘号 ⇒ composite 仍在 ⇒ 派单口径照旧算它一条活
 * —— F4 的产物正是那个形态,所以它只能治"同编号"那一型,治不了这一型。
 *
 * 三条不可漂的写法,每条都有实测理由(不是审美):
 *  ① 注记必须包在**全角括号**里、且其内部不得出现 `）` 与 `)`。
 *     为什么不用 `〔〕`(F4 与归并落账注记用的那对):守门 71 的 `checkboxBody` 只按
 *     `[（(][^）)]*[）)]` 剥状态装饰 —— 写成 `〔〕` 它剥不掉 ⇒ 该行"行首名额"消失 ⇒
 *     防丢层把合法折叠读成整行消失 ⇒ post-commit 回捞**未折叠**的原行 ⇒ 折叠被原地复活,
 *     正是 G-307 记过的"两层自愈互咬"(实测两小时 24 枚恢复型提交)。
 *     用全角括号则门 71 剥得掉(防丢面不受任何影响)。至于"这一行不再算一条活待办",**不靠隐形**:
 *     索引层 2026-09-29 修好装饰档漏算之后,折叠行的行首号必然被 `keyOfRow` 看见 —— 逐出派单口径的
 *     是 `DUP_POINTER_RE`(`findDupOpenCopies` 用的同一份过滤),不是窗口的盲区。
 *     这条不对称是本档全部机制的落点,由 `verifyTwinFold` 里的 `headIdOf` 等值 +
 *     `lostMarkers` 为空两条断言当场把住 —— 不是靠注释承诺。
 *  ② 指针文字里**绝不写行号**(§1 规矩 3),也**绝不把持有行的编号写进注记**:编号一旦落在
 *     `KEY_MAX_OFFSET` 窗口内,就会被 `keyOfRow` 取成这一行的**新**主键 —— 今天真犯过一次,
 *     后果是"折掉一条副本反而新增一次撞号"。所以注记只写持有行的**题面**(titleOf 的产物,
 *     题面本身已被 stripOwnKey 剥掉自己的编号),而"原编号"这一沿革放在**行尾**(窗口之外)。
 *  ③ 折叠产物一律喂**真尺子**:折后主键要么取不到、要么必须仍是本行行首那个号(不得被注记内的他人号
 *     顶位),且产物必须含 `DUP_POINTER_RE` 认得的副本指针;两条任一不成立 ⇒ **不折这一行**、点名交人工。
 *     判不出就是判不出 —— 不把"没判"写成"判过了"(本仓最高频失效型)。旧写法要求 `keyOfRow(after)`
 *     恒为 null,那是把机制盖在尺子的盲区上;盲区已于 2026-09-29 被修掉,判据随之换成可证的那一条。
 */
/** 组内行数上限:超过它就不猜持有行(噪声或真事故都得人来判),与"机器折半即有损"同一条纪律。 */
const TWIN_GROUP_MAX = 8
/** 复选框前缀(含其后原有空白)—— 折叠必须把它连同空白一起原样留住,否则"逐字保留"不成立。 */
const CHECKBOX_LEAD_RE = /^(\s*[-*]\s\[[ xX]\]\s*)/
/** 本档写进去的注记体(行首、全角括号包裹、内部无闭括号)。 */
const TWIN_NOTE_RE = /^（【归并】重复登记副本·同题不同编号·\d{4}-\d{2}-\d{2}·[^）)]*）/
/** 注记体 + 复选框前缀一起匹配,替换成捕获组即"只剥本档注记"。 */
const TWIN_FOLDED_RE = /^(\s*[-*]\s\[[ xX]\]\s*)（【归并】重复登记副本·同题不同编号·\d{4}-\d{2}-\d{2}·[^）)]*）/
/**
 * 行尾沿革(原编号 + 持有行题面),刻意留在 KEY_MAX_OFFSET 窗口之外。
 * 题面那一段**必须**用贪婪 `.*` 收在行尾的 `」)` 上,不能用 `[^」]*`:台账里的标题本身常带
 * 「…」(HEAD 面实测 19 条里有 4 条如此,例:题面「桌面端「启动后先进托盘」…」),非贪婪会把
 * 剥取停在标题内部那个 `」` 上 ⇒ 剥完不等于底稿 ⇒ 可逆判据把合法折叠误拒、那一族永久留在待办。
 * 而 `;持有行题面「` 这一段就是天然哨兵:旧的一次性折叠形态 ` (原编号 G-316)` 后面没有它,
 * 不会被误当成哨兵起点(真撞上"正文里本来就有这句"的那一行,过剥 ⇒ 判不可逆 ⇒ 拒落,方向是安全的)。
 */
const TWIN_TAIL_RE = / \(原编号 [^();]+;持有行题面「.*」\)$/
const TWIN_ID_RE = new RegExp(TASK_ID_PATTERN)

/** 注记正文:固定散文(不含任何编号、行号、闭括号),日期由调用方给。 */
export function twinFoldNote(today) {
  return `（【归并】重复登记副本·同题不同编号·${today}·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）`
}

/**
 * 把一条同题副本折成"摘号 + 指针"形态。给不出编号或给不出持有行题面 ⇒ 返回 null(调用方记未判定)。
 * 幂等由 `DUP_POINTER_RE` 在调用点挡住(本函数不自己判重复)。
 */
export function buildTwinFold(line, keeperLine, today) {
  const m = CHECKBOX_LEAD_RE.exec(line)
  if (!m) return null
  const key = keyOfRow(line)
  const anchor = titleOf(keeperLine)
  if (!key || !anchor) return null
  return `${m[1]}${twinFoldNote(today)}${line.slice(m[1].length)} (原编号 ${key};持有行题面「${anchor}」)`
}

/** 剥掉**本档**写的注记与沿革,还原底稿 —— 折叠必须可逆,不可逆就等于在改别人的登记。 */
export function stripTwinFold(line) {
  return String(line).replace(TWIN_FOLDED_RE, '$1').replace(TWIN_TAIL_RE, '')
}

/** 这行是不是本档折出来的形态(注记 + 沿革都在位才算)。 */
export function isTwinFolded(line) {
  return TWIN_FOLDED_RE.test(line) && TWIN_TAIL_RE.test(line)
}

const STATE_TOKEN_RE = /^\s*[-*]\s\[[ xX]\]/

/**
 * 行首注记区(复选框之后、正文之前的那一段全角括注)里是否混进了任务编号形态。
 * 一条实现,两处调用(`twinFoldRejectReason` 拒折 / `verifyTwinFold` 落地前复核)—— 注记里写持有行
 * 编号这一型当年真犯过:"折掉一条副本反而给账面新增一次撞号"。
 * 判的是**形状卫生**而不是尺子会不会取到它:索引层 2026-09-29 补认装饰档之后,括注里的引用不再顶位,
 * 但指针里的编号会随持有行改名而腐烂成查不到的死指针(§1 规矩 3 同一条理由),所以照旧拒。
 */
function strayIdInLeadDecoration(line) {
  const m = /^\s*[-*]\s\[[ xX]\]\s*(（[^）]*）)/.exec(String(line ?? ''))
  if (!m) return []
  const re = new RegExp(TWIN_ID_RE.source, 'g')
  return [...m[1].matchAll(re)].map((x) => x[0])
}

/**
 * 一条折叠产物的**准入判据**(全用真尺子,不抄编号正则)。返回拒绝理由或 null。
 * 顺序有意:先查最便宜也最要命的"摘号有没有成",再查可逆性、勾选、行首名额、注记洁净。
 */
export function twinFoldRejectReason(beforeLine, afterLine) {
  if (afterLine === null || afterLine === undefined) return '构造失败(拿不到本行编号或持有行题面)'
  const k = keyOfRow(afterLine)
  const kBefore = keyOfRow(beforeLine)
  /**
   * 旧判据是 `keyOfRow(afterLine) === null` —— 那身"隐形"靠的是索引层把编号推出 48 字窗口的**缺陷**
   * (`lib/plan-task-index.mjs` 于 2026-09-29 修掉:同一机制当天让 39 个已用号看起来空闲,并因此重发过号)。
   * 把机制建在尺子的盲区上,尺子修好那天这一维就静默停摆,而账面只看见"折不动"。
   * 现改为可证的那一条:折叠**不得改变本行身份** —— 折后主键要么取不到,必须仍等于折前那一个。
   * (刻意不拿门 71 的 `headIdOf` 当右半边:它对 `**G-12. 题面**` 这种粗体形态返回 null,
   * 拿它比会把自己的夹具判成"改了身份";`headIdOf` 等值那一判仍在下面,管的是防丢层互咬。)
   * "不再算一条活待办"另由 `DUP_POINTER_RE`(索引层派单口径逐出指针族的同一份判据)在 verifyTwinFold 把关。
   */
  if (k !== null && k !== kBefore)
    return `折叠后主键为 ${k},而本行折前主键是 ${String(kBefore)} ⇒ 这一折给这行改了身份,不折`
  const stray = strayIdInLeadDecoration(afterLine)
  if (stray.length)
    return `注记区在本行主键之前出现了别的任务编号 ${stray.slice(0, 2).join(',')} ⇒ 会被尺子读成本行主键(撞号),不折`
  // 注记内容的三条判据排在可逆性**之前**:poison 构造(把持有行编号写进注记)必须被点名成
  // "注记里有编号形态 ⇒ 会被尺子读成本行主键",而不是被后面那条更泛的"剥不回底稿"顶掉 ——
  // 一名判据的失败原因会被下一个原因冒充,而读报告的人会以为防的是别的事(本仓"三态不得并桶"同族)。
  const note = TWIN_NOTE_RE.exec(afterLine.replace(CHECKBOX_LEAD_RE, ''))?.[0] ?? ''
  if (!note) return '注记形状不合本档构造(内部出现了闭括号?)'
  if (TWIN_ID_RE.test(note)) return `注记里出现了任务编号形态 ⇒ 会被尺子读成本行主键(实得 ${k})`
  if (/\bL\d{1,6}\b/.test(note)) return '注记里出现了行号(§1 规矩 3 禁止证据指针写行号)'
  if (stripTwinFold(afterLine) !== beforeLine) return '剥掉本档注记后不等于底稿(折叠不可逆)'
  const bs = STATE_TOKEN_RE.exec(beforeLine)?.[0]
  const as = STATE_TOKEN_RE.exec(afterLine)?.[0]
  if (bs !== as) return `勾选状态被改了(${JSON.stringify(bs)}→${JSON.stringify(as)})—— 翻勾是 --heal 那一维的职责`
  // 门 71 的"行首名额"必须原样保住,否则防丢层会把这行读成消失并回捞未折叠原行(互咬)。
  if (headIdOf(beforeLine) !== headIdOf(afterLine))
    return `行首编号被门 71 读成变了(${String(headIdOf(beforeLine))}→${String(headIdOf(afterLine))})⇒ 会与回捞层互咬`
  return null
}

/**
 * 纯函数:输入计划文档的行数组,输出"该折哪些行、留哪一行当持有行、哪些判不出"。
 *
 * 成组判据(刻意与 F1/F4 不同源、也不与它们混进同一个函数):**题面逐字相等而编号互异**。
 * 编号相同那一型是 composite 相等 ⇒ 现有 `--heal` 那一维(翻勾 / 加 F4 指针)负责,这里一律跳过。
 *
 * 持有行规则(确定性 + 幂等,理由写在这里而不是藏在代码里):
 *  · 只在**未勾选**行里选 —— 已完成行由 F1(翻勾)与归档器负责,本档碰它就两维互咬;
 *  · 已带 `【归并】重复登记副本` 指针的行既不当持有行、也不再折(它就是"已折过"的形状),
 *    所以"若该组已有折好的副本 ⇒ 以现存持有行为准"天然成立;
 *  · 剩下的候选取**文件里位置最靠前**的那一行。用位置而不是用"看起来更完整":长度会随别人
 *    往同一行追加取证而变化,拿它选持有者会让持有人在两次运行之间换人 ⇒ 不幂等。
 *  跑第二遍 ⇒ 被折的行已无主键、不再进组 ⇒ 候选只剩持有行一行 ⇒ edits 为空,幂等。
 *
 * @returns {{edits:Array<{line:number,before:string,after:string,title:string,keeperLine:number}>,
 *            groups:Array<object>, undetermined:string[], refused:Array<{line:number,title:string,reason:string}>}}
 */
export function foldTwins(lines, today = new Date().toISOString().slice(0, 10)) {
  const content = Array.isArray(lines) ? lines.join('\n') : String(lines ?? '')
  const edits = []
  const groups = []
  const undetermined = []
  const refused = []
  const byTitle = new Map()
  for (const r of parseTaskRows(content)) {
    if (!r.key) continue // 已经没有主键的行不参与(无号可摘,也不是"同题不同编号")
    const t = titleOf(r.raw)
    if (!t || t.length < 4) continue // 与 compositeKeyOf 同一条题面闸:给不出实质题面就不配判"同题"
    if (!byTitle.has(t)) byTitle.set(t, [])
    byTitle.get(t).push(r)
  }
  for (const [t, rows] of byTitle) {
    const keys = new Set(rows.map((r) => r.key))
    if (keys.size < 2) continue // 编号互异这一条不成立 ⇒ 不是本档的地盘(F1/F4 各管自己那一型)
    const open = rows.filter((r) => r.state === 'open')
    const doneMembers = rows.length - open.length
    if (rows.length > TWIN_GROUP_MAX) {
      undetermined.push(`题面「${t}」组内 ${rows.length} 行 > 上限 ${TWIN_GROUP_MAX} ⇒ 不猜持有行,交人工`)
      continue
    }
    if (!open.length) {
      // 全组都是已完成:那是归档器与 F1 的面,本档一行都不碰(只点名,不判通过也不判红)
      undetermined.push(`题面「${t}」的 ${doneMembers} 行全部已完成 ⇒ 本档不动勾选,交归档器/F1 那一维`)
      continue
    }
    const candidates = open.filter((r) => !DUP_POINTER_RE.test(r.raw))
    if (!candidates.length) {
      undetermined.push(`题面「${t}」的 ${open.length} 条未勾选行都带归并指针 ⇒ 没有可认定的持有行,交人工`)
      continue
    }
    if (candidates.length < 2) {
      groups.push({
        title: t,
        keeper: { line: candidates[0].line, key: candidates[0].key },
        folded: [],
        openMembers: open.length,
        doneMembers,
      })
      continue
    }
    const keeper = candidates[0]
    const folded = []
    for (const r of candidates.slice(1)) {
      const after = buildTwinFold(r.raw, keeper.raw, today)
      const why = twinFoldRejectReason(r.raw, after)
      if (why) {
        undetermined.push(`题面「${t}」的 L${r.line} 不折:${why}`)
        refused.push({ line: r.line, title: t, reason: why })
        continue
      }
      edits.push({ line: r.line, before: r.raw, after, title: t, keeperLine: keeper.line })
      folded.push({ line: r.line, key: r.key })
    }
    groups.push({
      title: t,
      keeper: { line: keeper.line, key: keeper.key },
      folded,
      openMembers: open.length,
      doneMembers,
    })
  }
  edits.sort((a, b) => a.line - b.line)
  groups.sort((a, b) => a.keeper.line - b.keeper.line)
  return { edits, groups, undetermined, refused }
}

/**
 * 把 foldTwins 的产物落到内容上(行内改写,一行不增不删)。
 * 入参不是字符串 ⇒ 抛错而不是 `String(undefined)='undefined'`:后者会"成功地"折出一份
 * 单行假文档,而调用链只看得到"没报错"(本仓最高频失效型:把取不到当成判过)。
 */
export function applyTwinFolds(content, today) {
  if (typeof content !== 'string') throw new TypeError(`applyTwinFolds 需要整档文本,实得 ${typeof content}`)
  const lines = content.split('\n')
  const { edits, groups, undetermined, refused } = foldTwins(lines, today)
  for (const e of edits) lines[e.line - 1] = e.after
  return { text: lines.join('\n'), edits, groups, undetermined, refused }
}

/**
 * 折叠档的零损失断言 —— 六条同时成立才允许落地,任一不成立即整批停手:
 * ① 行数相等 ② 未声明的行逐字不变(= 新内容 == 前缀 ⊕ 本行 ⊕ 后缀的结构等值)
 * ③ 每处改动都落在声明的 before/after 上 ④ 剥掉本档注记后逐字回到底稿(可逆)
 * ⑤ 折完主键不得变成别人的号(取不到 或 仍是本行行首号)∧ 产物必须含 `DUP_POINTER_RE` 认得的副本指针。
 * ⑥ 折叠不被守门 71 读成消失 ∧ 幂等闭合 ∧ F1/F2/F3/F4/F4b/F6 不涨、注记不降。
 * ④⑤⑥ 是这一档**特有**的三条:它们防的就是"本档把自己造出的行交给另一把尺子去回捞"。
 */
export function verifyTwinFold(srcText, outText, edits, refused = []) {
  const problems = []
  if (typeof srcText !== 'string' || typeof outText !== 'string')
    return {
      problems: [`折叠档的零损失断言未判定 —— 入参不是整档文本(src=${typeof srcText} out=${typeof outText}),不把"没内容"当成"通过"`],
      before: null,
      after: null,
    }
  const a = srcText.split('\n')
  const b = outText.split('\n')
  if (a.length !== b.length) problems.push(`行数不等 ${a.length}→${b.length}(本档只许改行内内容)`)
  const touched = new Set(edits.map((e) => e.line))
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (!touched.has(i + 1) && a[i] !== b[i]) {
      problems.push(`L${i + 1} 未登记却被改动 —— 结构等值(新内容 == 前缀 ⊕ 本行 ⊕ 后缀)不成立`)
      break
    }
  }
  for (const e of edits) {
    if (a[e.line - 1] !== e.before)
      problems.push(`L${e.line} 底稿与声明的 before 不等 ⇒ 行号在本次落地前已挪位,整批不落`)
    if (b[e.line - 1] !== e.after) problems.push(`L${e.line} 产物没落到声明的位置`)
    if (stripTwinFold(b[e.line - 1] ?? '') !== e.before)
      problems.push(`L${e.line} 剥掉本档注记后不等于底稿(不可逆的折叠不许落地)`)
    const kAfter = keyOfRow(b[e.line - 1] ?? '')
    const kBeforeRow = keyOfRow(e.before)
    if (kAfter !== null && kAfter !== kBeforeRow)
      problems.push(`L${e.line} 折叠后主键为 ${kAfter},而折前主键是 ${String(kBeforeRow)} ⇒ 折叠给这行改了身份,整批不落`)
    if (!DUP_POINTER_RE.test(b[e.line - 1] ?? ''))
      problems.push(`L${e.line} 产物不含【归并】重复登记副本指针 ⇒ 派单口径不会逐出它,这一折只是换个地方挂账`)
    const stray = strayIdInLeadDecoration(b[e.line - 1] ?? '')
    if (stray.length)
      problems.push(`L${e.line} 注记区在本行主键之前出现别的任务编号 ${stray.slice(0, 2).join(',')} ⇒ 会被尺子读成本行主键,整批不落`)
  }
  /**
   * 反互咬断言(本档的命门):折叠后的整档**不得**在守门 71 眼里丢任何一条登记行。
   * 它红 = 本档的注记形状让防丢层读成"整行消失" = post-commit 会回捞未折叠原行 =
   * G-307 那型循环。这条必须在落地那一刻把住,而不是留给下一个人去发现。
   */
  const lost = lostMarkers(String(srcText), String(outText))
  if (lost.length)
    problems.push(
      `折叠后被守门 71 判为消失的登记行 ${lost.length} 处(${lost
        .slice(0, 3)
        .map((l) => String(l.marker ?? l).slice(0, 24))
        .join(' / ')})⇒ 会与回捞层互咬,拒落`,
    )
  // 幂等/闭合:除了**本轮已点名不折**的那几行,不得还有可折对象;有的话就是判据自己不算数
  const refusedLines = new Set(refused.map((r) => r.line))
  const left = foldTwins(b).edits.filter((e) => !refusedLines.has(e.line))
  if (left.length) problems.push(`折完仍有 ${left.length} 行可折 ⇒ 不闭合(幂等失败),交人工`)
  // F 维一律不得变差(这把尺子不许替别的维度制造红点)
  const before = auditPlan(srcText).counts
  const after = auditPlan(outText).counts
  for (const [k, get] of [
    ['F1', (c) => c.forks],
    ['F2', (c) => c.voidRows],
    ['F3', (c) => c.rotatedAuto],
    ['F4', (c) => c.dupOpenCopies],
    ['F4b', (c) => c.verbatimDupCopies],
    ['F6', (c) => c.dupBlocks],
  ]) {
    if (get(after) > get(before)) problems.push(`${k} 由 ${get(before)} 涨到 ${get(after)}`)
  }
  if (after.mergeNotes < before.mergeNotes)
    problems.push(`归并落账注记由 ${before.mergeNotes} 掉到 ${after.mergeNotes}(不得随折叠一起丢)`)
  /**
   * ⑦(2026-09-29 补,由本会话一次真实自伤逼出):折叠**不得**让一个族失去"当前状态行"。
   * 枚 `b3f73e2b37e` 之后现读:5 个族的非指针行数为 0(同一锚点在 `b3f73e2b37e^` 还有 1 条),
   * 也就是活账全部被折成"重复登记副本"指针 ⇒ 派单口径看不见它,而账面 F1/F2/F4/F6 全绿、
   * 前六条零损失断言一条都不红 —— **这套断言只证"没删内容",没证"还有主人"**。
   * 判据只认结构位:被折过的每个题面,产物里必须仍存在一条未勾选且 `titleOf` 能取回该题面的行
   * (指针行的题面会被全角括号闸切成空串,所以它不可能冒充持有行)。
   */
  {
    const touchedTitles = new Set(edits.map((e) => e.title).filter(Boolean))
    const keeperless = []
    for (const t of touchedTitles) {
      /**
       * 持有行的认法(2026-09-29 改):旧写法只靠 `titleOf(l) === t` —— 其前提是"指针行的题面
       * 会被全角括号闸切成空,所以不可能冒充持有行"。索引层补认装饰档之后那个前提**不再成立**
       * (括注被剥掉 ⇒ 指针行也取回题面 ⇒ 全族折成指针时这条断言静默通过,活账无人认领)。
       * 现按结构位认:未勾选 ∧ 题面相符 ∧ 不带副本指针 ∧ 未被本档折过 —— 四条都是可见事实。
       */
      if (
        !b.some(
          (l) => /^\s*-\s\[ \]/.test(l) && titleOf(l) === t && !DUP_POINTER_RE.test(l) && !isTwinFolded(l),
        )
      )
        keeperless.push(t)
    }
    if (keeperless.length)
      problems.push(
        `折叠后有 ${keeperless.length} 族失去当前状态行(全族只剩指针 ⇒ 活账无人认领、派单口径永不可见)⇒ 拒落:${keeperless
          .slice(0, 3)
          .join(' / ')}`,
      )
  }
  return { problems, before, after }
}

/** 折叠档的落地:临时索引 + commit-tree + CAS(走 lib/bypass-git 那一份 plumbing,绝不碰共享工作树)。 */
export function twinFoldAndLand(maxAttempts = 8) {
  const today = new Date().toISOString().slice(0, 10)
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const spec = `HEAD:${PLAN_REL}`
    const src = catBatch(ROOT, [spec], { maxBuffer: 1 << 28 }).get(spec)
    if (src === null || src === undefined) {
      console.log('折叠档未判定 —— HEAD 取不到 PROJECT_PLAN.md(不记为已修)')
      return 2
    }
    const f = applyTwinFolds(src, today)
    if (!f.edits.length) {
      console.log(
        `✅ 折叠档:HEAD 无可折的同题不同编号待办行${f.undetermined.length ? `(判不出 ${f.undetermined.length} 条,逐条点名见报告)` : ''},不动任何东西${attempt > 1 ? ` (第 ${attempt} 轮)` : ''}`,
      )
      return 0
    }
    const { problems, after } = verifyTwinFold(src, f.text, f.edits, f.refused)
    if (problems.length) {
      console.log('❌ 折叠档停手(现场保留,交人工):')
      for (const p of problems.slice(0, 10)) console.log('   ' + p)
      return 1
    }
    const parent = gitIn(null, ['rev-parse', 'HEAD'])
    const msg = [
      'fix(plan): 折叠"同题不同编号"的孪生待办登记(F10 折叠档)',
      '',
      `触发时 HEAD 现读:${f.groups.length} 族同题而编号互异的登记,折掉其中 ${f.edits.length} 行(每族留位置最靠前的未完成行当持有行)。`,
      `判不出 ${f.undetermined.length} 条(全已完成族 / 组内超上限 / 摘号后尺子仍取得到主键 —— 一律交人工,不猜)。`,
      '折叠形态:正文逐字保留、勾选状态一字不动、只在复选框后插一句全角括号注记 + 行尾留 (原编号 …;持有行题面「…」)。',
      '摘号是必须的:F1/F4 的主键是"编号+标题逐字等值",而这一族编号互异 ⇒ 现有归并器全盲;不摘号则派单口径照算一条活。',
      '零损失判据(六条,任一不过即整批不落):行数不变 ∧ 新内容 == 前缀⊕本行⊕后缀 ∧ 剥注记后逐字回到底稿 ∧ 守门 71 lostMarkers=0 ∧ 折完无残留(幂等) ∧ F1/F2/F3/F4/F4b/F6 无一上涨、归并注记不降。',
      `落地面现读:F1 ${after.forks} / F2 ${after.voidRows} / F3(可自动收口) ${after.rotatedAuto} / F4 ${after.dupOpenCopies} / F4b ${after.verbatimDupCopies}。`,
    ].join('\n')
    let landed
    try {
      landed = commitTreeWithIndex({
        root: ROOT,
        parent,
        baseRef: parent,
        message: msg,
        entries: [{ path: PLAN_REL, text: f.text }],
      })
    } catch (e) {
      console.log(`❌ 折叠档停手 —— 候选树建不出来:${String(e?.message ?? e).slice(0, 160)}`)
      return 1
    }
    if (!casUpdateRef(landed.commit, parent, { root: ROOT })) {
      console.log(`↻ 第 ${attempt} 次 CAS 失败(HEAD 被并发推进),整轮按新 HEAD 现取重算折叠位置再来`)
      continue
    }
    const landedSpec = `${landed.commit}:${PLAN_REL}`
    const landedText = catBatch(ROOT, [landedSpec], { maxBuffer: 1 << 28 }).get(landedSpec)
    if (landedText === null || landedText === undefined) {
      console.log(`❌ 落地后回读不到 ${landed.commit.slice(0, 11)} 的台账 ⇒ 不记为已修,回退`)
      casUpdateRef(parent, landed.commit, { root: ROOT })
      return 1
    }
    const recheck = verifyTwinFold(src, landedText, f.edits, f.refused)
    if (recheck.problems.length) {
      console.log(`❌ 落地后复验不过(${recheck.problems[0]}),回退到 ${parent.slice(0, 11)}`)
      casUpdateRef(parent, landed.commit, { root: ROOT })
      return 1
    }
    const align = alignSharedIndex({ root: ROOT, paths: [PLAN_REL], parentRef: parent })
    const nOf = (v) => (Array.isArray(v) ? v.length : Number(v) || 0)
    console.log(
      `✅ 折叠档落地 ${landed.commit.slice(0, 11)}:折 ${f.edits.length} 行(持有行 ${f.groups.length} 族保持原样),` +
        `落地面现读 F1 ${recheck.after.forks} / F2 ${recheck.after.voidRows} / F4 ${recheck.after.dupOpenCopies} / 未勾选 ${recheck.after.open};` +
        `共享索引 移动 ${nOf(align.moved)} / 已就位 ${nOf(align.already)}` +
        `${nOf(align.skipped) ? ` / 归属他人未动 ${align.skipped.map((s) => s.path).join(',')}` : ''}` +
        `${nOf(align.undetermined) ? ` / 未判定 ${nOf(align.undetermined)}` : ''}` +
        `${align.lockAbandoned || align.failed ? '(共享索引未对齐 ⇒ 必须复跑一次,否则下一次普通提交会写回旧版)' : ''}`,
    )
    return 0
  }
  console.log(`❌ ${maxAttempts} 轮都没抢到 CAS,放弃`)
  return 1
}

// ── 自愈层(挂 post-commit)──────────────────────────────────────────
/**
 * 对**当时**的 HEAD 重算归并,并落地一枚前向修复提交。
 *
 * 为什么不能只有提交链上那道门:并发会话 routinely 用 `--no-verify`,pre-commit 会被一起跳过;
 * 而"按内存里那份旧计划文档整文件提交"会把刚归并好的行**原样复活**。本票第一次落地(118 行)
 * 就在同一小时内被这样一次回写吞掉 —— 108 行 `[归并]` 从 HEAD 全部消失。
 * 只判不修 = 把红留给下一个人(§12e 同型),所以修必须长在 post-commit 上。
 *
 * 防自伤四条:① 结论一律按当次 HEAD 现读,行号绝不复用;② 零损失对账 + 三条归零断言任一不过
 * 就整批停手(宁可留着喊人,也不写一版没验证过的内容);③ 提交走临时索引 + commit-tree + CAS,
 * 钩子不跑 ⇒ 结构上不会递归,但仍按 §1 惯例带 `IHUI_PLAN_STATE_HEAL_COMMIT` 供钩子侧判读;
 * ④ CAS 输了就放弃(下一次提交会再试),绝不重抢别人的 HEAD。
 */
function gitIn(idx, args) {
  return execFileSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: idx ? { ...process.env, GIT_INDEX_FILE: idx } : process.env,
    windowsHide: true,
    timeout: 60000,
    maxBuffer: 1 << 28,
  }).trim()
}

export function healAndLand() {
  const stamp = Date.now()
  const head = gitIn(null, ['rev-parse', 'HEAD'])
  const spec = `HEAD:${PLAN_REL}`
  const src = catBatch(ROOT, [spec], { maxBuffer: 1 << 28 }).get(spec)
  if (src === null || src === undefined) {
    console.log('自愈未判定 —— HEAD 取不到 PROJECT_PLAN.md(不记为已修)')
    return 2
  }
  const b0 = auditPlan(src).counts
  // F4 / F4b 与 F1/F2/F3 平级:副本行也是"状态与正文不符"的一种,早退判据漏看它 = 修复出口永不触发。
  // (2026-09-27 实测这一格:F4b 判据与归并出口都写好了,而早退只看 F4 ⇒ 报告"拟改写 15 行"、
  //  落地档回一句"无状态分叉"就什么都不做 —— 判据有牙而无人调度,正是本仓最高频的失效型。)
  // F10(同题不同编号的孪生副本)与上面五条**平级**挂在同一枚落地里,理由与那一格逐字相同:
  // 它结构上不在 composite 键里(编号互异),F1–F4b 一条都不计它,早退若不看它 = 这一族永不开工。
  const today = new Date().toISOString().slice(0, 10)
  const tw0 = foldTwins(src.split('\n'), today)
  const twinOpen = tw0.edits.length
  // 整条判据留在一行里:T10 的源码锁就是钉这一行的(把 F10 拆成多行会让那条锁无声失效)
  if (!b0.forks && !b0.voidRows && !b0.rotatedAuto && !b0.dupOpenCopies && !b0.verbatimDupCopies && !twinOpen) {
    console.log('✅ 自愈:HEAD 无状态分叉(也没有可折的同题不同编号孪生副本),不动任何东西')
    return 0
  }
  const r = buildMerge(src, today)
  /**
   * 折叠维跑在**归并结果之上**这一层:`buildMerge` 只改行内内容、一行不增不删 ⇒ 两维共用同一套
   * 行号坐标,合到一枚提交、一次 CAS 里落地。两维刻意互不干涉:F10 只插注记、绝不碰复选框,
   * 翻勾永远归 F1/F2;`[...r.changed, ...折叠]` 一起交给零损失对账,所以"多改一行"瞒不住。
   */
  const f = applyTwinFolds(r.text, today)
  const bad = healStopReasons(
    src,
    f.text,
    [...r.changed, ...f.edits.map((e) => ({ ...e, kind: 'F10折叠' }))],
    r.refused.length + f.refused.length,
  )
  bad.push(...verifyTwinFold(r.text, f.text, f.edits, f.refused).problems)
  if (bad.length) {
    console.log(`❌ 自愈停手:${bad.join(' / ')} —— 现场保留,交人工`)
    return 1
  }
  // 临时件一律走 mkScratch(工作树同盘的 DevEnv/Temp/ihui-scratch):写死 `.ihui-agent/tmp/`
  // 在**没有该目录的检出**上直接 ENOENT —— 独立仓端到端证明就是这么抓出来的。
  const scratch = mkScratch(`plan-state-heal-${stamp}`)
  const tmp = path.join(scratch, 'pp.md')
  const msgFile = path.join(scratch, 'msg.txt')
  const idx = path.join(scratch, 'index')
  writeFileSync(tmp, f.text, 'utf8')
  writeFileSync(
    msgFile,
    [
      'fix(plan): 自愈被回写的任务状态副本(守门 130 的 post-commit 层)',
      '',
      `触发时 HEAD 现读:F1 ${b0.forks} / F2 ${b0.voidRows} / F3(可自动收口) ${b0.rotatedAuto} / F3(无出口,交人工) ${b0.rotatedNoExit} / F4 ${b0.dupOpenCopies} → 归并 ${r.changed.length} 行后 0 / 0 / 0 / 0。`,
      `另:F10「同题不同编号」孪生副本现读 ${tw0.groups.length + tw0.undetermined.length} 族可议(成组 ${tw0.groups.length} / 判不出 ${tw0.undetermined.length})⇒ 本枚折掉 ${f.edits.length} 行,每族只留位置最靠前的未完成行当持有行;判不出一律不折、交人工(${f.undetermined.length} 条逐条点名见 --fold-twins 报告)。`,

      `行数 ${src.split('\n').length} → ${f.text.split('\n').length}(一行不删一行不加),未参与改写的 ${src.split('\n').length - r.changed.length - f.edits.length} 行逐字不变。`,
      '成因与修法同源:scripts/plan-tasks-merge.mjs 按当次 HEAD 重算行号(绝不用旧行号)。',
      '复活路径是"按内存里旧计划文档整文件提交 + --no-verify 跳过 pre-commit",所以这一层必须挂 post-commit。',
    ].join('\n'),
    'utf8',
  )
  try {
    gitIn(idx, ['read-tree', head])
    const blob = gitIn(idx, ['hash-object', '-w', tmp])
    gitIn(idx, ['update-index', '--add', '--cacheinfo', `100644,${blob},${PLAN_REL}`])
    const tree = gitIn(idx, ['write-tree'])
    const commit = gitIn(idx, ['commit-tree', tree, '-p', head, '-F', msgFile])
    gitIn(null, ['update-ref', 'HEAD', commit, head])
    if (gitIn(null, ['rev-parse', 'HEAD']) !== commit) {
      console.log('❌ CAS 失败(HEAD 被并发抢进),本次自愈放弃 —— 下一次提交会再试')
      return 1
    }
    const t0 = Date.now()
    while (existsSync(path.join(ROOT, '.git', 'index.lock'))) {
      if (Date.now() - t0 > 120000) {
        console.log('❌ 等锁超时:共享索引未对齐,必须复跑(否则下一次普通提交会写回旧版)')
        return 1
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400)
    }
    gitIn(null, ['update-index', '--add', '--cacheinfo', `100644,${blob},${PLAN_REL}`])
    // 结论文句里的数字必须**回读落地的那枚提交**再说,不得写死 "0/0/0/0":
    // 那是一句"我修好了"的承诺,而承诺的兑现与否结构上不在这个调用面上(本仓最贵的失效型)。
    const landedText = gitIn(null, ['show', `${commit}:${PLAN_REL}`], { encoding: 'utf8' })
    const after = auditPlan(landedText).counts
    const twinLeft = foldTwins(landedText.split('\n')).edits.length
    console.log(
      `✅ 自愈落地 ${commit.slice(0, 11)}:归并 ${r.changed.length} 行 + 折叠 ${f.edits.length} 行 → 落地面现读 F1 ${after.forks} / F2 ${after.voidRows} / F3(可自动收口) ${after.rotatedAuto} / F3(无出口) ${after.rotatedNoExit} / F4 ${after.dupOpenCopies} / F4b ${after.verbatimDupCopies}(副本指针行合计 ${after.dupPointerRows})/ F10 可折残留 ${twinLeft}`,
    )
    if (after.forks + after.voidRows + after.rotatedAuto + after.dupOpenCopies + after.verbatimDupCopies > 0) {
      console.log('   ⚠️ 落地面仍有未归并项 —— 上面就是现读数字,不得当"已清零"引用。')
      return 1
    }
    if (twinLeft > 0) {
      console.log(`   ⚠️ 落地面仍有 ${twinLeft} 行可折 —— 折叠维没闭合,不得当"已清零"引用。`)
      return 1
    }

    return 0
  } finally {
    rmScratch(scratch)
  }
}

/**
 * 块级重复(F6)的收口落地。与 healAndLand 同一条安全骨架,但**每次 CAS 前重新现读 HEAD
 * 重新算块** —— 行号在任何一次 append 后都会挪位(§1 规矩 3 的同一条理由),复用旧行号
 * 就等于按一张过期地图删行。CAS 输了就整轮重算,绝不拿上一轮的行号再试一次。
 */
export function dedupeAndLand(maxAttempts = 8) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const head = gitIn(null, ['rev-parse', 'HEAD'])
    const spec = `HEAD:${PLAN_REL}`
    const src = catBatch(ROOT, [spec], { maxBuffer: 1 << 28 }).get(spec)
    if (src === null || src === undefined) {
      console.log('块级收口未判定 —— HEAD 取不到 PROJECT_PLAN.md(不记为已修)')
      return 2
    }
    const b0 = auditPlan(src).counts
    if (!b0.dupBlocks) {
      console.log(`✅ 块级收口:HEAD 无逐字重复的整块登记(F6=0),不动任何东西${attempt > 1 ? ` (第 ${attempt} 轮)` : ''}`)
      return 0
    }
    let r
    try {
      r = buildBlockDedupe(src)
    } catch (e) {
      console.log(`❌ 块级收口停手 —— ${e instanceof Undetermined ? e.message : String(e?.message ?? e)}`)
      return 1
    }
    const problems = verifyBlockDedupe(src, r.text, r.deletedCount)
    if (problems.length) {
      console.log(`❌ 块级收口停手(现场保留,交人工):`)
      for (const p of problems.slice(0, 10)) console.log('   ' + p)
      return 1
    }
    const scratch = mkScratch(`plan-block-dedupe-${Date.now()}`)
    const tmp = path.join(scratch, 'pp.md')
    const msgFile = path.join(scratch, 'msg.txt')
    const idx = path.join(scratch, 'index')
    writeFileSync(tmp, r.text, 'utf8')
    writeFileSync(
      msgFile,
      [
        'fix(plan): 收口被整块重复的登记(F6 块级判据的修复出口)',
        '',
        `触发时 HEAD 现读:F6 ${b0.dupBlocks} 块 / 共 ${b0.dupBlockCopies} 份 / 漂移 ${b0.dupBlockDrifted} 块。`,
        `删去第 2..N 份(逐字相同的那几份)共 ${r.deletedCount} 行,保留每一份的首次出现;漂移副本一份未动(自动折半即有损,交人工判)。`,
        `行数 ${src.split('\n').length} → ${r.text.split('\n').length}。`,
        '零损失判据:每个被删行值在输出里仍有一份逐字相同的幸存行 ∧ 行多重集只减不增 ∧ F1/F2/F3/F4/F6 无一上涨 ∧ 归并落账注记不降。',
        '成因:行级判据(F1–F4)量纲是一行,整块被并发 union 追加两遍时每一行都"只是又一个孪生行",一路通过。',
      ].join('\n'),
      'utf8',
    )
    try {
      gitIn(idx, ['read-tree', head])
      const blob = gitIn(idx, ['hash-object', '-w', tmp])
      gitIn(idx, ['update-index', '--add', '--cacheinfo', `100644,${blob},${PLAN_REL}`])
      const tree = gitIn(idx, ['write-tree'])
      const commit = gitIn(idx, ['commit-tree', tree, '-p', head, '-F', msgFile])
      try {
        gitIn(null, ['update-ref', 'HEAD', commit, head])
      } catch {
        console.log(`↻ 第 ${attempt} 次 CAS 失败(HEAD 被并发推进),整轮重算块位置再来`)
        continue
      }
      if (gitIn(null, ['rev-parse', 'HEAD']) !== commit) {
        console.log(`↻ 第 ${attempt} 次 CAS 未胜出,重算再来`)
        continue
      }
      const after = auditPlan(gitIn(null, ['show', `${commit}:${PLAN_REL}`], { encoding: 'utf8' })).counts
      if (after.dupBlocks >= b0.dupBlocks) {
        console.log(`❌ 落地后回读块数没降(${b0.dupBlocks}→${after.dupBlocks}),回退`)
        gitIn(null, ['update-ref', 'HEAD', head, commit])
        return 1
      }
      const t0 = Date.now()
      while (existsSync(path.join(ROOT, '.git', 'index.lock'))) {
        if (Date.now() - t0 > 120000) {
          console.log('❌ 等锁超时:共享索引未对齐,必须复跑(否则下一次普通提交会写回旧版)')
          return 1
        }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400)
      }
      gitIn(null, ['update-index', '--add', '--cacheinfo', `100644,${blob},${PLAN_REL}`])
      console.log(
        `✅ 块级收口落地 ${commit.slice(0, 11)}:F6 ${b0.dupBlocks}→${after.dupBlocks},删 ${r.deletedCount} 行(逐字相同的第 2..N 份),漂移 ${b0.dupBlockDrifted} 块原样留给人工`,
      )
      return 0
    } finally {
      rmScratch(scratch)
    }
  }
  console.log(`❌ ${maxAttempts} 轮都没抢到 CAS,放弃`)
  return 1
}

/**
 * 「加指针不得把活账弄隐形」的差值判据 —— 两处落地闸(`healStopReasons` 与 `verifyMerge`)
 * 共用这一份实现,不得各写一遍(两处算同一件事必漂移,本仓记过多次)。
 *
 * 为什么是**差值**而不是绝对零:`--heal` 与 `--dedupe-blocks` 每次都会往副本行上写指针,
 * 而存量里本来就有 45 族/58 行是全指形态;按绝对零判就是一台与本次改动无关的恒红闸,
 * 唯一结局是每次归并都被迫停手(§12e 同型)。只拦"这次把本来还看得见的那族弄没了代表"。
 *
 * 为什么不判 `dupOpenCopies`:那一维**本来就看不见这一型** —— `findDupOpenCopies` 先按
 * `DUP_POINTER_RE` 滤掉带指针的行,全指族在它眼里是"0 条待办副本"。把这条记成"F4=0 就安全"
 * 是本函数初版写下的错话(它据此断言"单改生产者侧会让归并器自我拒绝"),现予以推翻。
 */
export function pointerVisibilityRegression(srcText, merged) {
  const b = auditPointerTerminals(String(srcText ?? ''))
  const a = auditPointerTerminals(String(merged ?? ''))
  if (a.hiddenFamilies <= b.hiddenFamilies && a.hiddenRows <= b.hiddenRows) return null
  return `隐形族由 ${b.hiddenFamilies} 族/${b.hiddenRows} 行 变为 ${a.hiddenFamilies} 族/${a.hiddenRows} 行 —— 给一族加指针前必须留下一行不带指针的代表,否则这件活从 --open 口径整族消失`
}

/** 自愈的"该不该停手"判据 —— 抽成纯函数,否则这一层最要紧的安全断言只能在真仓上验一次。 */
export function healStopReasons(srcText, merged, changed, refusedCount) {
  // 与 verifyMerge 同一处理:F1+F3 那一型里 F3 的锚点替换是本工具授权的改写,先折回 before,
  // 再交给下面那条一字未动的逐字判据(否则归并对这一型永久停手,那条 F1 再也修不掉)。
  changed = normalizeForkedBefore(changed)
  const a0 = String(srcText).split('\n')
  const a1 = String(merged).split('\n')
  const touched = new Set(changed.map((c) => c.line))
  const after = auditPlan(merged).counts
  /**
   * F10 折叠维的闭合断言写在**这里**,不在调用方的自觉里:谁都能忘记调 verifyTwinFold,
   * 而"忘记调"在账面上一律表现为绿。算得出可折行 ⇒ 本枚没把这一维做完 ⇒ 停手。
   * (被 `twinFoldRejectReason` 点名拒折的行不进 edits,所以"该交人工的"不会被这条读成"未闭合"。)
   */
  const twinLeft = foldTwins(String(merged).split('\n')).edits.length

  // G-307(a) 落地闸(healAndLand 走的是这一支,不是 verifyMerge):任何 F1/F2 翻勾若没有
  // "剥复选框/装饰/租约/注记后正文逐字相等",整批停手 —— 截断正文的实现进不了 HEAD。
  const bodyBroken = changed.some(
    (c) =>
      /(?:^|\+)F[12](?:\+|$)/.test(c.kind) &&
      /^\s*[-*]\s\[ \]/.test(c.before) &&
      !forkPreserved(c.before, c.after),
  )
  return [
    refusedCount ? `拒写 ${refusedCount} 项` : null,
    a0.length !== a1.length ? `行数不等 ${a0.length}→${a1.length}` : null,
    a0.some((l, i) => !touched.has(i + 1) && l !== a1[i]) ? '有未登记行被改动' : null,
    bodyBroken ? '有翻勾行未逐字保留正文(剥注记后必须相等)' : null,
    twinLeft ? `折叠维未闭合:折完仍有 ${twinLeft} 行"同题不同编号"可折` : null,
    after.forks || after.voidRows || after.rotatedAuto || after.dupOpenCopies
      ? '归并后未归零'
      : null,
    pointerVisibilityRegression(srcText, merged),
  ].filter(Boolean)
}

/**
 * F1+F3 落在**同一行**时,F3 那句「腐烂行号 → 内容锚点」的替换是本工具自己授权的改写,
 * 它动的是行内指针短语,不是正文。两侧能力合并后才出现这一型(任何一侧单独跑都测不到):
 * 逐字判据若拿「指针未修之前」的整行去比,会把自家刚写的合法锚点读成「正文被改」,
 * 于是归并对这一型永久停手 —— 停手是安全的,但那条 F1 就再也修不掉。
 * 这里只把 before 先过一遍同一份 rewritePointer(键的推导与 buildMerge 里 F3 那一支逐字相同),
 * 再交给下面的判据:判据本体一字未动 —— 截断、整行替换、装饰乱改仍然一处也躲不过。
 */
function normalizeForkedBefore(changed) {
  if (!Array.isArray(changed)) return changed
  return changed.map((c) =>
    /(?:^|\+)F3(?:\+|$)/.test(c.kind ?? '') && /(?:^|\+)F[12](?:\+|$)/.test(c.kind ?? '')
      ? { ...c, before: rewritePointer(c.before, compositeKeyOf(c.before) ?? '') }
      : c,
  )
}

/** 零损失对账:行数相等 ∧ 未被改写的行逐字不变(多重集),外加"三条判据必须归零"。 */
export function verifyMerge(original, merged, changed) {
  changed = normalizeForkedBefore(changed)
  const problems = []
  const o = original.split('\n')
  const m = merged.split('\n')
  if (o.length !== m.length) problems.push(`行数不等:${o.length} → ${m.length}`)
  const touched = new Set(changed.map((c) => c.line))
  let untouchedDiff = 0
  o.forEach((l, i) => {
    if (!touched.has(i + 1) && l !== m[i]) untouchedDiff++
  })
  if (untouchedDiff) problems.push(`${untouchedDiff} 行未参与改写却被改动`)
  const lost = o.filter((l, i) => !touched.has(i + 1) && !m.includes(l)).length
  if (lost) problems.push(`${lost} 行在输出里找不到`)
  /**
   * G-307(a):每一条 F1/F2 翻勾都必须通过"剥复选框/装饰/租约/本层注记后正文逐字相等"。
   * 这不是自检里的装饰 —— 它是落地闸:实现若退回"用注记文案整行替换"或截断正文,
   * `healAndLand` 当场停手,坏形态进不了 HEAD,守门 71 的回捞层也就不会被喂出循环。
   */
  for (const c of changed) {
    if (/(?:^|\+)F[12](?:\+|$)/.test(c.kind) && /^\s*[-*]\s\[ \]/.test(c.before) && !forkPreserved(c.before, c.after))
      problems.push(
        `行 ${c.line}(${c.kind})翻勾把正文改了:剥掉复选框与本工具注记后两侧必须逐字相等(截断/整行替换都不许落地)`,
      )
  }
  const after = auditPlan(merged)
  if (after.counts.forks) problems.push(`F1 未归零:${after.counts.forks} 组`)
  if (after.counts.voidRows) problems.push(`F2 未归零:${after.counts.voidRows} 行`)
  if (after.counts.rotatedAuto) problems.push(`F3(可自动收口)未归零:${after.counts.rotatedAuto} 处`)
  if (after.counts.dupOpenCopies)
    problems.push(`F4 未归零:${after.counts.dupOpenCopies} 行同题待办副本仍挂着`)
  const ptrProblem = pointerVisibilityRegression(original, merged)
  if (ptrProblem) problems.push(ptrProblem)
  return { problems, after: after.counts }
}

function selfTest() {
  let pass = 0
  let fail = 0
  const ok = (c, n) => (c ? pass++ : ((fail++), console.log(`  ❌ ${n}`)))
  const src = [
    '- [x] ✅(2026-09-20) **D99 复合主键正例**:说明文字。',
    '- [ ] **D99 复合主键正例**:旧副本。',
    '- [ ] **D97 作废声明**:〔本行判:已完成,勿照本行派单〕。',
    // F3 两型各一条,合起来才钉得住新语义:
    //  ①可自动收口 —— 指针指向的行与本行**同复合主键**,换成"同主键登记「本行键」"是真话;
    //  ②无自动出口 —— 指向的是**另一条主键**(作者当时指谁已不可推断),动它就是编造证据。
    '- [x] ✅(2026-09-20) **D96 指针**:同题的另一份登记。',
    '- [ ] **D96 指针**:本行正题逐字存活于 L4 的同编号登记。',
    '- [ ] **D95 指针无出口**:本行正题存活于 L1 的同编号登记。',
    '- [ ] **D98 真待办**:谁都没做过,不得被动。',
  ].join('\n')
  const r = buildMerge(src, '2026-09-26')
  // 3 = F1(D99 旧副本)+ F2(D97)+ D96 那一行。注意 D96 **同时**命中 F1 与 F3(它与已勾那份同复合主键,
  // 而指针又指向同主键的行)—— 一行只可能被改一次,所以这里不能按"判据条数"数,只能按行号数。
  ok(r.changed.length === 3, `应改 3 行(F1 + F2 + D96 那行),实测 ${r.changed.length}`)
  ok(r.refused.length === 0, `不应拒写,实测 ${JSON.stringify(r.refused)}`)
  const v = verifyMerge(src, r.text, r.changed)
  ok(v.problems.length === 0, `零损失与归零断言应全过:${JSON.stringify(v.problems)}`)
  ok(
    v.after.rotatedAuto === 0 && v.after.rotatedNoExit === 1,
    `可自动收口那一族必须归零、无出口那一族必须留着交人工,实测 auto=${v.after.rotatedAuto} noExit=${v.after.rotatedNoExit}`,
  )
  ok(
    v.after.claimable === 2,
    `归并后真待办应是 D95(无出口指针,事项本身没做完)+ D98 两条,实测 ${v.after.claimable}`,
  )
  const line5 = r.text.split('\n')[4]
  ok(!/存活于\s*L\d/.test(line5) && line5.includes('同主键登记'), 'F3(可收口)必须换成内容锚点')
  const line6 = r.text.split('\n')[5]
  ok(
    /存活于\s*L1\b/.test(line6),
    'F3(无出口)不得被自动改写 —— 把猜出来的锚点写进台账比留个腐烂行号更危险',
  )
  // 反向对照:未参与改写的行被偷偷动一下,零损失断言必须炸
  const sabotage = r.text.replace('- [ ] **D98 真待办**:谁都没做过,不得被动。', '- [ ] **D98 真待办**:被偷偷改了。')
  ok(verifyMerge(src, sabotage, r.changed).problems.length > 0, '破坏未登记行时断言必须炸(不得静默通过)')
  // 自愈层的"该不该停手" —— 纯函数,三条各一对
  ok(healStopReasons(src, r.text, r.changed, 0).length === 0, '正当归并结果不得停手')
  ok(
    healStopReasons(src, `${r.text}\n多塞一行`, r.changed, 0).join().includes('行数不等'),
    '多塞一行必须停手',
  )
  ok(
    healStopReasons(src, src, r.changed, 0).join().includes('未归零'),
    '什么都不改(分叉仍在)必须停手 —— 否则自愈会变成"跑过一次就算修好"',
  )
  ok(healStopReasons(src, r.text, r.changed, 2).join().includes('拒写'), '有拒写项必须停手')
  /**
   * G-307(a) 成对判据:翻勾前后,剥掉复选框与本工具追加的注记之后,两侧正文必须逐字相等。
   * 正向 = 现行后置式与 legacy 前置式都判"保住了";反向 = "整行替换/截断"的实现必须被炸出来
   * (两代形态都过同一条 forkPreserved,看守侧与生产侧共用 lib 里那一份剥取实现)。
   */
  const G0 = '- [ ] G-307 一条待办:这段正文在翻勾后必须一字不差地活着。'
  const G0F = rewriteFork(G0, 'G-307#一条待办', '2026-09-28')
  ok(/^- \[x\] ✅\(2026-09-28\) G-307 一条待办/.test(G0F), `新形态必须把正文留在行首、注记追加行尾:${G0F.slice(0, 60)}`)
  ok(forkPreserved(G0, G0F), '正当翻勾必须判"正文逐字保留"')
  ok(
    forkPreserved(
      G0,
      '- [x] ✅(2026-09-27) **[归并]** 本行与已完成登记同题(主键 「G-307 · 一条待办」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 G-307 一条待办:这段正文在翻勾后必须一字不差地活着。',
    ),
    'legacy 前置式(HEAD 存量形态)剥注记后同样必须逐字相等',
  )
  // 反向对照:"用注记文案整行替换"(循环肇因里被怀疑的形态)必须让本判据红
  ok(
    !forkPreserved(
      G0,
      '- [x] ✅(2026-09-28) **[归并]** 本行与已完成登记同题(主键 「G-307 · 一条待办」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 G-307 一条待办:这段正文被',
    ),
    '把正文截断的实现必须被 forkPreserved 抓住(变异对照,不得恒真)',
  )
  {
    // 两条落地闸(healStopReasons 与 verifyMerge)必须各自拦住"截断正文"的产物 ——
    // 只装一道,等于另一道将来可以随便漂(§12"两处算同一件事必漂移"同一条理由)。
    const trunc = [...r.changed]
    const first = trunc.findIndex((c) => /(?:^|\+)F[12](?:\+|$)/.test(c.kind) && /^\s*- \[ \]/.test(c.before))
    trunc[first] = { ...trunc[first], after: trunc[first].after.slice(0, 20) }
    const txt = r.text.split('\n')
    txt[trunc[first].line - 1] = trunc[first].after
    ok(
      healStopReasons(src, txt.join('\n'), trunc, 0).some((x) => x.includes('逐字保留')),
      'healStopReasons 必须拦下截断正文的那一行(自愈落地档)',
    )
    ok(
      verifyMerge(src, txt.join('\n'), trunc).problems.some((x) => x.includes('逐字相等')),
      'verifyMerge 对同一形态也必须点名(报告档,两闸不得只装一个)',
    )
  }
  /**
   * F6 块级收口:四条各钉一个方向。缺任何一条,这一型就会退化成
   * "要么删不掉,要么把唯一份删掉"—— 后者比前者贵得多(§1 禁止无声删除)。
   */
  const LP = (s) => s + '　'.repeat(Math.max(0, 46 - [...s].length))
  const BLK = [
    LP('- 块行一:整块登记被并发 union 追加两遍时,行级判据看不见,因为每行只是又一个孪生行'),
    LP('- 块行二:第二行,长度必须过块级阈值;阈值以下(短行/2 行块)天然成对,纳入只剩噪声'),
    LP('- 块行三:第三行,三行合成 F6 的量纲 —— 块,而不是行'),
  ].join('\n')
  const dupDoc = `## 甲段\n${BLK}\n## 乙段\n${BLK}\n\n尾行不是 bullet,否则会把上一个 run 续成四行`
  const oneDoc = `## 甲段\n${BLK}\n\n尾行不是 bullet`
  const bd = buildBlockDedupe(dupDoc)
  ok(bd.deletedCount === 3, `两份逐字相同的块应删 3 行,实测 ${bd.deletedCount}`)
  ok(verifyBlockDedupe(dupDoc, bd.text, bd.deletedCount).length === 0, `块级零损失断言应全过:${JSON.stringify(verifyBlockDedupe(dupDoc, bd.text, bd.deletedCount))}`)
  ok(auditPlan(bd.text).counts.dupBlocks === 0, `收口后 F6 应为 0,实测 ${auditPlan(bd.text).counts.dupBlocks}`)
  ok(auditPlan(dupDoc).counts.dupBlocks === 1 && auditPlan(oneDoc).counts.dupBlocks === 0, '块级判据本身要能数出这一型')
  ok(buildBlockDedupe(oneDoc).deletedCount === 0, '只有一份时一行都不许删(幂等 + 不误伤唯一副本)')
  // 漂移副本(首行同而正文不同)结构性不可自动折半:必须原样留着交人工
  const driftDoc = `## 甲段\n${BLK}\n## 乙段\n${[BLK.split('\n')[0], LP('- 块行二:被人工改过的第二行,与上面那份不再逐字相等'), BLK.split('\n')[2]].join('\n')}\n\n尾行不是 bullet`
  ok(auditPlan(driftDoc).counts.dupBlocks === 0, '漂移不该算逐字重复(算了就等于允许机器折半)')
  ok(auditPlan(driftDoc).counts.dupBlockDrifted === 1, `漂移应单独计 1,实测 ${auditPlan(driftDoc).counts.dupBlockDrifted}`)
  ok(buildBlockDedupe(driftDoc).deletedCount === 0, '漂移副本一份都不许自动删')
  // 反向对照:假装"幸存份也没了" —— 断言必须炸,否则它等于没有
  ok(
    verifyBlockDedupe(dupDoc, oneDoc, 3).length > 0,
    '删完却把唯一幸存份也一起删掉的输出必须判失败',
  )
  // ── F4:同一件事两条待办 ⇒ 只给副本加指针,**绝不允许翻勾**(两件事都没做完) ──
  const f4src = [
    '- [ ] **D92 同一件事**:较长的那条登记,承载了更多上下文说明。',
    '- [ ] **D92 同一件事**:短的那条。',
    '- [ ] **D90 无关任务**:不该被本票碰到。',
  ].join('\n')
  const f4 = buildMerge(f4src, '2026-09-26')
  ok(f4.changed.length === 1, `F4 应只改副本那一行,实测 ${f4.changed.length}`)
  ok(f4.changed[0].kind === 'F4', `F4 归并的行必须只挂 F4 判据,实测 ${f4.changed[0].kind}`)
  ok(!/^- \[x\]/m.test(f4.text.split('\n')[1]), 'F4 不得把没做完的事翻成已完成(与 F1 的处置相反)')
  ok(/【归并】重复登记副本/.test(f4.text), '必须写下索引层认得的副本指针字面')
  ok(verifyMerge(f4src, f4.text, f4.changed).after.dupOpenCopies === 0, 'F4 归并后必须归零')
  const f4again = buildMerge(f4.text, '2026-09-26')
  ok(f4again.changed.length === 0, `第二次跑不得再改同一行(幂等),实测又改 ${f4again.changed.length} 行`)
  ok(
    healStopReasons(f4src, f4src, f4.changed, 0).join().includes('未归零'),
    'F4 未归零时自愈必须停手 —— 否则"跑过一次"会被当成"修好了"',
  )
  /**
   * 隐形族诊断必须**成对**有牙:全族互指要点名(不点名等于没有这个出口),有终端代表不得点名
   * (乱点名会让读数变成"每一族都是债",那与没有读数一样不能用来派单)。
   * 夹具的两行都带指针 —— 就是 HEAD 面实测 19 族 / 101 行的形态本身。
   */
  const ptrDead = [
    '- [ ] **G-9. 甲事** 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记,派单以那条为准,本行不再单独派单。〕',
    '- [ ] **G-9. 甲事** 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记,派单以那条为准,本行不再单独派单。〕',
  ].join('\n')
  const tDead = auditPointerTerminals(ptrDead)
  ok(
    tDead.families === 1 && tDead.rows === 2,
    `全族互指必须被点名为无终端,实测 ${tDead.families} 族 / ${tDead.rows} 行 —— 若为 0,说明 compositeKeyOf 对这一形态给不出键且兜底键也没接住,本诊断对它失明`,
  )
  ok(tDead.hiddenFamilies === 1, `同编号也没有任何代表 ⇒ 必须算"真隐形",实测 hiddenFamilies=${tDead.hiddenFamilies}`)
  const tAlive = auditPointerTerminals(
    ['- [ ] **G-9. 甲事**', '- [ ] **G-9. 甲事** 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记〕'].join('\n'),
  )
  ok(tAlive.families === 0, `族内有一行不带指针就不算无终端,实测报了 ${tAlive.families} 族(误伤)`)
  /**
   * 第三臂钉"不把撞号副产物报成债"。真仓形态:`D18` 挂着两种标题写法(短标题+指针 / 长正文版),
   * 按主键判前者"无终端",按编号判这件活由长正文那行代表、**没有隐形**。
   * 少了这一臂,读数就会把 F9 撞号的副产物写成"活账消失",派单人去修一件不存在的事。
   */
  const tSplit = auditPointerTerminals(
    [
      '- [ ] D18 甲题 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记,派单以那条为准。〕',
      '- [ ] D18 甲题 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记,派单以那条为准。〕',
      '- [ ] D18 甲题的长正文版(同编号、另一种标题写法,自己不带指针)',
    ].join('\n'),
  )
  ok(
    tSplit.families >= 1 && tSplit.hiddenFamilies === 0,
    `同编号另有代表时不得计为真隐形,实测 families=${tSplit.families} hiddenFamilies=${tSplit.hiddenFamilies}`,
  )
  ok(auditPointerTerminals('').families === 0 && auditPointerTerminals(null).families === 0, '空面不得凭空造出债')
  /**
   * 恢复档成对断言(R1–R7)。这一族判据若只测"剥得掉",会漏掉它仅有的两个危险失败方向:
   * 多吃作者正文、以及把已被别人占用的编号领回来(原地造 F9 撞号)。
   * 另有一条 R5b/R8 是**接线锁**:护栏函数写在文件里而两处落地闸没调它,提交链上就等于没有。
   */
  const NOTE = ' 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记,派单以那条为准,本行不再单独派单。〕'
  // 夹具必须用**真仓题面形态**(编号后带句点),因为守门 130 的 F9 比的正是未剥注记的 titleOf:
  // 写成无句点的 `G-501 甲题` 会让"恢复一行"给同一编号造出两个题面 ⇒ 本档的 F9 互咬预检正当拒落。
  // 第一版就那么写,那条红是夹具造的,不是仓库的债(真仓 38 族跑同一判据:因 F9 被拒的是 0 族)。
  const RST_LINE = '- [ ] G-501. 甲题:一件待做的事。'
  const rstSrc = [`${RST_LINE}${NOTE}`, `${RST_LINE}${NOTE}`].join('\n')
  const rst1 = buildRestoreTerminals(rstSrc, '2026-09-28')
  ok(rst1.edits.length === 1, `全指族必须恰好恢复一行代表(不是两行、不是零行),实测 ${rst1.edits.length}`)
  ok(
    rst1.edits.length === 1 && rst1.edits[0].after === RST_LINE,
    `恢复后应逐字回到裸登记形态,实测 ${rst1.edits[0] ? JSON.stringify(rst1.edits[0].after) : '无 edits'}`,
  )
  const v1 = verifyRestoreTerminals(rstSrc, rst1.text, rst1.edits)
  ok(v1.problems.length === 0, `正当恢复不得报问题,实测 ${v1.problems[0] ?? '无'}`)
  ok(v1.hiddenAfter === 0, `恢复后该族不得再被判隐形,实测 ${v1.hiddenAfter}`)
  // R1 反向:恢复动作若顺手写了新字,"保序子序列"判据必须炸(只判"剥没剥掉"拦不住加字)
  const bad = rst1.edits.map((e) => ({ ...e, after: `${e.after}X` }))
  const badLines = rstSrc.split('\n')
  badLines[bad[0].line - 1] = bad[0].after
  ok(
    verifyRestoreTerminals(rstSrc, badLines.join('\n'), bad).problems.some((p) => p.includes('子序列')),
    '恢复后的正文不是底稿子序列时必须拦下',
  )
  // R2:裸形态(无闭符)整族拒绝并点名 —— 按行尾剥会吃掉作者正文
  const bareLine = '- [ ] **[归并]** 【归并】重复登记副本:本行与同标题登记 L9 重复。本行不进派单口径,活账以主行为准。'
  const rst2 = buildRestoreTerminals([bareLine, bareLine].join('\n'), '2026-09-28')
  ok(
    rst2.edits.length === 0 && rst2.refused.length === 1 && rst2.refused[0].reason.includes('结构边界'),
    `裸形态必须拒绝并报名,实测 edits=${rst2.edits.length} refused=${rst2.refused.length}`,
  )
  // R3:同编号在别处挂着另一件事 ⇒ 恢复会原地造出 F9 撞号,必须拒
  const clashSrc = [`- [ ] G-502 丁题${NOTE}`, `- [ ] G-502 丁题${NOTE}`, `- [ ] G-502 卯题${NOTE}`].join('\n')
  const rst3 = buildRestoreTerminals(clashSrc, '2026-09-28')
  ok(
    rst3.edits.length === 0 && rst3.refused.length >= 1 && rst3.refused.some((f) => f.reason.includes('撞号')),
    `恢复会把别人正占着的编号领回来时必须拒,实测 edits=${rst3.edits.length} refused=${JSON.stringify(rst3.refused.map((f) => f.reason.slice(0, 18)))}`,
  )
  // R4:折叠孤立行(持有行已不在面上)必须由 stripTwinFold 还原,连尾注一起剥回底稿
  const pre4 = '- [ ] **G-503. 折叠题**:第一份登记。'
  const foldLine = buildTwinFold(pre4, '- [ ] **G-504. 别的题**:与它无关。', '2026-09-28')
  const rst4 = buildRestoreTerminals(foldLine, '2026-09-28')
  ok(
    rst4.edits.length === 1 && rst4.edits[0].via === 'stripTwinFold' && rst4.edits[0].after === pre4,
    `折叠产物必须逐字还原成底稿(尾注原编号一并剥掉),实测 ${JSON.stringify(rst4.edits[0] ?? rst4.refused[0])}`,
  )
  // R9:题面没有句点边界的族,恢复会让同一编号出现"带注记 / 不带注记"两个 titleOf ⇒
  // 守门 130 的 F9 差值棘轮会当场判红。本档不许为变绿去改那道门的判据(lib 持有人职权),
  // 也不许整批按住,所以**逐族**拒绝并写明解阻前置 —— 这条断言钉的就是"它真的拒"。
  const f9Line = `- [ ] G-509 无句点题面${NOTE}`
  const rst9 = buildRestoreTerminals([f9Line, f9Line].join('\n'), '2026-09-28')
  ok(
    rst9.edits.length === 0 && rst9.refused.length === 1 && rst9.refused[0].reason.includes('F9'),
    `与 F9 互咬的那一型必须被拒并点名解阻前置,实测 edits=${rst9.edits.length} refused=${JSON.stringify(rst9.refused.map((f) => f.reason.slice(0, 12)))}`,
  )
  // R5:差值护栏必须点名"把一族唯一的代表也标上指针"的合并
  const gSrc = [`- [ ] G-505 戊题`, `- [ ] G-505 戊题${NOTE}`].join('\n')
  const gHide = [`- [ ] G-505 戊题${NOTE}`, `- [ ] G-505 戊题${NOTE}`].join('\n')
  ok((pointerVisibilityRegression(gSrc, gHide) ?? '').includes('隐形族'), '抹掉唯一代表的合并必须被差值护栏点名')
  // R6:留了代表的正常归并不得被点名(拦正当动作的闸与恒红门同罪)
  ok(
    pointerVisibilityRegression(gSrc, gSrc) === null && pointerVisibilityRegression(gSrc, `${gSrc}\n- [ ] 新行`) === null,
    '没有把任何族弄隐形的改动不得被护栏拦',
  )
  // R7:一族里唯一的活行被正当翻勾 ⇒ 必须靠"已完成行也算代表"认下来,否则 --heal 每次翻勾都停手
  ok(
    pointerVisibilityRegression('- [ ] G-506 己题', '- [x] ✅(2026-09-28) G-506 己题') === null,
    '翻勾成已完成不得被读成"把活账弄隐形"',
  )
  // R5b/R8 接线锁(行为式,不读源码):两处落地闸必须真的调了这条护栏
  ok(
    healStopReasons(gSrc, gHide, [{ line: 1, kind: 'F4', before: '- [ ] G-505 戊题', after: `- [ ] G-505 戊题${NOTE}` }], 0)
      .join()
      .includes('隐形族'),
    '自愈停手判据必须挂上差值护栏 —— 函数在而无人调,提交链上等于没有',
  )
  ok(
    verifyMerge(gSrc, gHide, [{ line: 1, kind: 'F4', before: '- [ ] G-505 戊题', after: `- [ ] G-505 戊题${NOTE}` }]).problems.some((p) =>
      p.includes('隐形族'),
    ),
    '零损失对账链也必须挂上差值护栏(与 healStopReasons 同一份实现)',
  )
  /**
   * F10 折叠档 —— 成对断言(单向断言等于没有):
   *  (a) 同题 + 编号互异 ⇒ 恰好折掉后到的一条,持有行一字不动;
   *  (b) 第二遍 ⇒ 零改动(幂等是本票的全部价值,不钉住就等于没做);
   *  (c) 同题而编号相同 ⇒ **不是**本档地盘(那是 F1/F4 那一维);
   *  (d) 已有归并指针的那一族 ⇒ 不重复折;
   *  (e) 摘号必须用**真尺子**核,并配一条"把 G-999 写进注记"的正对照 —— 少了正对照,
   *      `keyOfRow(after) === null` 就只是一句同义反复(今天真犯过这个错:指针里写了持有行的
   *      编号且落在前 48 字符内 ⇒ 折一条副本反而多造一次撞号)。
   */
  const twinSrc = [
    '- [ ] **G-11. 同一件事**:第一份登记。',
    '- [ ] **G-12. 同一件事**:并发取号抢到的另一个号,同一件事。',
    '- [ ] **G-13. 别的事**:与上面两行无关。',
  ].join('\n')
  const twLines = twinSrc.split('\n')
  const tw1 = applyTwinFolds(twinSrc, '2026-09-28')
  ok(tw1.edits.length === 1, `同题两号应恰好折 1 行,实测 ${tw1.edits.length}`)
  ok(tw1.edits[0]?.line === 2, `持有行必须是位置最靠前的 L1,折的是 L2,实测 ${JSON.stringify(tw1.edits.map((e) => e.line))}`)
  ok(tw1.text.split('\n')[0] === twLines[0], '持有行必须逐字不动(一行都不许被顺手改)')
  ok(tw1.text.split('\n')[2] === twLines[2], '不相关行必须逐字不动')
  ok(
    !!tw1.edits[0] &&
      (keyOfRow(tw1.edits[0].after) === null ||
        keyOfRow(tw1.edits[0].after) === keyOfRow(twLines[1])) &&
      DUP_POINTER_RE.test(tw1.edits[0].after),
    `摘号未生效:折后主键实得 ${tw1.edits[0] && keyOfRow(tw1.edits[0].after)}(折前主键 ${keyOfRow(twLines[1])})、指针在场=${
      tw1.edits[0] ? DUP_POINTER_RE.test(tw1.edits[0].after) : false
    } —— 主键不得被换成别人的号,且必须被派单口径的指针族逐出`,
  )
  ok(!!tw1.edits[0] && stripTwinFold(tw1.edits[0].after) === twLines[1], '剥掉本档注记后必须逐字回到底稿')
  ok(!!tw1.edits[0] && /^- \[ \]/.test(tw1.edits[0].after), '本档不得翻勾')
  ok(
    !!tw1.edits[0] && headIdOf(tw1.edits[0].after) === headIdOf(twLines[1]),
    `门 71 的"行首名额"必须原样保住,实得 ${headIdOf(tw1.edits[0] && tw1.edits[0].after)}`,
  )
  ok(
    !!tw1.edits[0] && lostMarkers(twinSrc, tw1.text).length === 0,
    `折叠不得被防丢层读成消失,实测 ${lostMarkers(twinSrc, tw1.text).length} 处`,
  )
  ok(verifyTwinFold(twinSrc, tw1.text, tw1.edits, tw1.refused).problems.length === 0, `正当折叠的零损失断言应全过:${JSON.stringify(verifyTwinFold(twinSrc, tw1.text, tw1.edits, tw1.refused).problems)}`)
  const tw2 = applyTwinFolds(tw1.text, '2026-09-28')
  ok(tw2.edits.length === 0 && tw2.text === tw1.text, `幂等:第二遍必须零改动,实测 ${tw2.edits.length} 行`)
  ok(
    healStopReasons(twinSrc, tw1.text, tw1.edits.map((e) => ({ ...e, kind: 'F10折叠' })), 0).length === 0,
    `正当折叠不该被自愈档停手:${JSON.stringify(healStopReasons(twinSrc, tw1.text, tw1.edits.map((e) => ({ ...e, kind: 'F10折叠' })), 0))}`,
  )
  ok(
    healStopReasons(twinSrc, twinSrc, tw1.edits.map((e) => ({ ...e, kind: 'F10折叠' })), 0).join().includes('折叠维未闭合'),
    '一行都不折(孪生仍在)必须被闭合断言停手 —— 否则"跑过一次"又会被当成"修好了"',
  )
  ok(
    foldTwins(['- [ ] **G-11. 同一件事**:甲。', '- [ ] **G-11. 同一件事**:乙。']).edits.length === 0,
    '编号相同那一型归 F1/F4,本档不得插手(混维就会有两套翻勾判据互咬)',
  )
  const ptrOwned = [
    '- [ ] **G-11. 同一件事**:甲。',
    '- [ ] **G-12. 同一件事** 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记,派单以那条为准。〕',
  ].join('\n')
  const twPtr = foldTwins(ptrOwned.split('\n'), '2026-09-28')
  ok(twPtr.edits.length === 0, `已带归并指针的一族不得再折,实测折了 ${twPtr.edits.length} 行`)
  /** 正对照:注记里出现 `G-<数字>` 且落在主键窗口内 ⇒ 尺子**必须**取得到键,否则上面的 null 断言是同义反复。 */
  const poisoned = twLines[1].replace(/^- \[ \] /, '- [ ] （【归并】副本·持有行 G-999）')
  ok(keyOfRow(poisoned) !== null, '正对照失效:把编号写进注记前 48 字符,真尺子竟取不到主键 ⇒ 这条断言没有牙')
  /**
   * ⑦ 的两条成对用例(2026-09-29,由本会话一次真实自伤立):
   *  正向 —— 正常折叠(折副本、留持有行)必须**没有**"失去当前状态行"这一红;
   *  反向 —— 把产物里的持有行也换成指针行(正是枚 b3f73e2b37e 落出来的形状),第七断言必须点名。
   *  少了正向,这条锁会退化成"只要折叠就红";少了反向,它可以在什么都不防的状态下恒绿。
   */
  {
    const src = [
      '- [ ] **G-701. 一件活账**:甲。',
      '- [ ] **G-702. 一件活账**:乙。',
      '- [ ] **G-703. 一件活账**:丙。',
    ].join('\n')
    const tw = foldTwins(src.split('\n'), '2026-09-29')
    const landed = [...src.split('\n')]
    for (const e of tw.edits) landed[e.line - 1] = e.after
    const ok7 = verifyTwinFold(src, landed.join('\n'), tw.edits, tw.refused)
    ok(
      tw.edits.length === 2 && ok7.problems.length === 0,
      `正向对照红:折 2 留 1 的正常折叠被第七断言误判,实测 edits=${tw.edits.length} problems=${JSON.stringify(ok7.problems)}`,
    )
    const broken = landed.map((l) => (/^- \[ \]/.test(l) ? l.replace(/^- \[ \] /, '- [ ] （【归并】重复登记副本·同题不同编号·2026-09-29·摘号留指针）') : l))
    const bad7 = verifyTwinFold(src, broken.join('\n'), tw.edits, tw.refused)
    ok(
      bad7.problems.some((p) => p.includes('失去当前状态行')),
      `反向对照失效:全族折成指针时第七断言没喊红,实测 ${JSON.stringify(bad7.problems.slice(0, 2))}`,
    )
  }
  ok(
    (twinFoldRejectReason(twLines[1], poisoned) || '').includes('主键'),
    `编号写进注记必须被拒折判据点名,实得:${twinFoldRejectReason(twLines[1], poisoned)}`,
  )
  const numbered = twLines[1].replace(/^- \[ \] /, '- [ ] （【归并】副本·见 L1234）')
  ok(
    twinFoldRejectReason(twLines[1], numbered) !== null,
    '行号写进注记也要被点名拒折(§1 规矩 3;拒因是"取到主键"还是"不可逆"都算拦住,但不能放行)',
  )
  ok(
    buildTwinFold('- [x] ✅(2026-09-20) **G-12. 同一件事**:乙。', twLines[0], '2026-09-28').includes('[x]'),
    '已完成行若被显式构造,复选框必须原样带过去(选持有行时本档不选它)',
  )
  ok(
    foldTwins(['- [ ] **G-1. 题**:甲。', '- [ ] **G-2. 题**:乙。']).undetermined.length === 0,
    '两行一族不构成"可疑超上限",不该记未判定',
  )
  ok(
    foldTwins(Array.from({ length: TWIN_GROUP_MAX + 1 }, (_, i) => `- [ ] **G-${10 + i}. 超上限族**:同一件事第 ${i} 份。`)).undetermined
      .join()
      .includes('上限'),
    '组内行数超上限必须点名交人工,不得猜持有行',
  )
  ok(
    foldTwins(['- [x] ✅(2026-09-20) **G-1. 全族已完成**:甲。', '- [x] ✅(2026-09-21) **G-2. 全族已完成**:乙。']).undetermined
      .join()
      .includes('已完成'),
    '全组已勾选 ⇒ 本档不动勾选,点名交 F1/归档器那一维(不得记为"已修")',
  )
  ok(
    foldTwins([]).edits.length === 0 && foldTwins(null).edits.length === 0,
    '空面不得凭空造出折叠',
  )
  /**
   * 未勾单行等值副本档(G-741)。成对写:每条"该删的必须删得动"都配一条"不该碰的一份都不许动",
   * 再给四条零损失断言各配一条"故意做坏必须拒" —— 只判坏的会退化成永拒,只判好的等于没判。
   */
  const O_TWIN =
    '- [ ] **G-741 单行档自检夹具**:〔【归并】重复登记副本 2026-09-28·派单以另一条为准〕正文逐字相同,长度足够越过 40 字符噪声阈。'
  const O_NOPTR =
    '- [ ] **G-742 未带指针的等值孪生**:两份逐字相同,但本档不得碰 —— 那一族的出口是 --heal 加注记,一行不删才对。'
  const O_DRA =
    '- [ ] **G-743 同主键漂移**:第一段正文,长度足够越过噪声阈以便证明它不是被长度筛掉的而是被逐字不同筛掉的。'
  const O_DRB =
    '- [ ] **G-743 同主键漂移**:第二段正文,与甲同复合主键而正文不同 ⇒ 机器折半即有损,必须点名交人工才对。'
  const O_SHORT = '- [ ] G-744 短〔【归并】重复登记副本〕'
  const O_IND =
    '  - [ ] G-745 缩进未勾副本〔【归并】重复登记副本〕长度足够越过噪声阈,所以它不是被长度筛掉的而是被顶层判据筛掉的。'
  const oSrc = ['# 台账', '', O_TWIN, O_TWIN, O_TWIN, O_NOPTR, O_NOPTR, O_SHORT, O_SHORT, O_DRA, O_DRB, O_IND, O_IND, ''].join(
    '\n',
  )
  const oT = findOpenRowTwins(oSrc)
  ok(oT.length === 1 && oT[0].copies === 3, `未勾档应只命中 1 组×3 份(带指针+顶层+≥40+逐字同),实得 ${JSON.stringify(oT.map((g) => g.copies))}`)
  const oRef = findOpenRowRefusals(oSrc)
  ok(oRef.noPointer.length === 1, `未带指针的等值孪生必须被点名而不被删:实得 ${oRef.noPointer.length} 组`)
  ok(oRef.drifted.length === 1, `同主键而正文已漂开必须被点名交人工:实得 ${oRef.drifted.length} 组`)
  const oR = buildOpenRowDedupe(oSrc)
  ok(oR.deletedCount === 2, `三份等值副本只删第 2..N 份 ⇒ 应删 2,实得 ${oR.deletedCount}`)
  ok(oR.text.split('\n').filter((l) => l === O_TWIN).length === 1, '必须留一份原件幸存')
  ok(oR.text.includes(O_NOPTR) && oR.text.includes(O_DRB), '刻意不删的两族必须逐字留在产物里')
  ok(verifyOpenRowDedupe(oSrc, oR.text, oR.deletedCount, null, oR.droppedLines).length === 0, '纯删除必须过全部零损失断言')
  ok(buildOpenRowDedupe(oR.text).deletedCount === 0, '第二次必须报"无可归并"(幂等)')
  // 四条"故意做坏必须拒":漏保留行 / 多删一行 / 新增行 / 行数差不等
  const oLost = oR.text.split('\n').filter((l) => l !== O_TWIN).join('\n')
  ok(verifyOpenRowDedupe(oSrc, oLost, oR.deletedCount, null, oR.droppedLines).some((p) => p.includes('一份都不剩')), '漏保留行必须被拒')
  const oExtra = oR.text.replace(O_DRB + '\n', '')
  ok(
    verifyOpenRowDedupe(oSrc, oExtra, oR.deletedCount, null, new Set([4, 5])).some((p) => p.includes('活数') || p.includes('逐行等值')),
    '多删一行(吃掉一条真待办)必须被拒',
  )
  ok(
    verifyOpenRowDedupe(oSrc, `${oR.text}\n- [ ] 凭空新增的一行待办(长度足够越过噪声阈以便证明不是被长度筛掉的)`, oR.deletedCount, null, oR.droppedLines).some((p) =>
      p.includes('新增'),
    ),
    '产物含新增行必须被拒(只断"不删"会造出重复行而账面全绿)',
  )
  ok(
    verifyOpenRowDedupe(oSrc, oR.text, oR.deletedCount + 1, null, oR.droppedLines).some((p) => p.includes('行数差')),
    '行数减少量必须等于声明删除量',
  )
  /**
   * 分块 + 轮次(2026-09-29 立)。这一族的全部风险是"为了跑得动而把判据放宽",所以断言成对:
   * 块必须**按组完整**取(切半会让第②条"幸存份在位"失去意义)、幂等只允许在"本轮认领的组"上换口径
   * (不降任何一条别的判据)、maxRows=null 必须与旧行为**逐字等值**(防止我为了分块偷偷改选取顺序)。
   */
  const C_A =
    '- [ ] **G-750 四份一组的夹具**:〔【归并】重复登记副本 2026-09-29·派单以另一条为准〕四份逐字相同,cost=3,长度越过噪声阈。'
  const C_B =
    '- [ ] **G-751 两份一组的夹具**:〔【归并】重复登记副本 2026-09-29·派单以另一条为准〕两份逐字相同,cost=1,长度同样越过噪声阈。'
  const cSrc = ['# 台账', '', C_A, C_A, C_A, C_A, C_B, C_B, ''].join('\n')
  const cGroups = findOpenRowTwins(cSrc)
  ok(cGroups.length === 2 && cGroups[0].copies === 4 && cGroups[1].copies === 2, `夹具必须恰好两组(4 份 + 2 份),实得 ${JSON.stringify(cGroups.map((g) => g.copies))}`)
  // (a) 块不切组:maxRows=3 ⇒ 第一组整组(cost 3)进块,第二组(cost 1)装不进 ⇒ 整组保留
  const c3 = buildOpenRowDedupe(cSrc, null, 3)
  ok(c3.deletedCount === 3, `maxRows=3 应取满第一组的 3 行而一组不落第二组,实得 ${c3.deletedCount}`)
  ok(c3.selectedGroups.length === 1 && c3.selectedGroups[0].line === C_A, '块里只许有整组:第一组完整入块')
  ok(c3.text.split('\n').filter((l) => l === C_A).length === 1, '第一组必须留首次出现那一份(幸存份在位)')
  ok(c3.text.split('\n').filter((l) => l === C_B).length === 2, '第二组必须整份原样保留 —— 切半等于让"幸存份在位"失去意义')
  ok(
    verifyOpenRowDedupe(cSrc, c3.text, c3.deletedCount, null, c3.droppedLines, c3.selectedLines).length === 0,
    '分块后仍有未轮到的组 ⇒ 幂等不得误拒(这是 scopeLines 存在的唯一理由,不放宽其余七条)',
  )
  ok(
    verifyOpenRowDedupe(cSrc, c3.text, c3.deletedCount, null, c3.droppedLines, new Set([C_B])).some((p) => p.includes('不闭合')),
    '反向对照:scopeLines 传错(不含已选组)⇒ 必红 —— 只有正向那条的"放宽"无从证明它是放宽了范围而不是关了判据',
  )
  // (b) 单组超上限 ⇒ 跳过它**但后面的组照样装填**,且超上限那组必须逐条报名(不得静默)
  const c2 = buildOpenRowDedupe(cSrc, null, 2)
  ok(
    c2.selectedGroups.length === 1 && c2.selectedGroups[0].line === C_B && c2.deletedCount === 1,
    `上限 2 时 cost=3 的首组整组跳过、cost=1 的次组必须仍被装上(旧"前缀停手"口径会把这 1 行也判成无路可走),` +
      `实得 选中 ${c2.selectedGroups.length} 组 / ${c2.deletedCount} 行`,
  )
  ok(
    c2.plan.oversized.length === 1 && c2.plan.oversized[0].copies === 4 && c2.plan.oversized[0].cost === 3,
    '超上限的组必须报名到"几份/几行",而不是从账面上消失',
  )
  ok(c2.plan.remainingRows === 3, `跳过的那组留 3 行无路可装,实得 ${c2.plan.remainingRows}`)
  ok(
    c2.text.split('\n').filter((l) => l === C_A).length === 4,
    '被跳过的组一份都不许动(它是"换出口"的对象,不是本轮的对象)',
  )
  // (c) 投影轮数与 build 同源:同一面、同一上限,块数与行数必须互洽
  const cProj = planOpenRowChunks(cGroups, 3)
  ok(cProj.chunks.length === 2 && cProj.chunks.map((x) => x.rows).join(',') === '3,1', `投影应给 2 块(3 行 + 1 行),实得 ${JSON.stringify(cProj.chunks.map((x) => x.rows))}`)
  ok(cProj.totalRows === 4 && cProj.remainingRows === 0, '全组都能进块时 remainingRows 必须为 0')
  ok(planOpenRowChunks(cGroups, null).chunks.length === 1, 'maxRows=null ⇒ 一整块装全部(与分块前逐字同义)')
  // (d) null 与旧行为逐字等值 + 确定性:同一输入两跑产物必须字节全等
  ok(buildOpenRowDedupe(oSrc, null, null).text === oR.text, 'maxRows=null 的产物必须与不带该参数逐字等值')
  ok(buildOpenRowDedupe(oSrc, null, 9999).text === oR.text, '上限大到一个块装得下全部 ⇒ 产物必须与不分块逐字等值')
  ok(
    buildOpenRowDedupe(cSrc, null, 3).text === c3.text,
    '同一输入重复跑必须给出同一块(选取顺序不许带随机性,否则落地与报告对不上)',
  )
  ok(
    planOpenRowChunks([], 5).chunks.length === 0 && planOpenRowChunks([], 5).oversized.length === 0,
    '空组集必须给出"0 块 + 无堵塞",不得凭空造块(空扫判绿是本仓最高频失效型)',
  )
  // (e) 整数取值判据成对:合法值必放行、四类非法值必拒且带回实得
  ok(parsePositiveInt('25').ok === true && parsePositiveInt('25').value === 25, '合法整数必须放行')
  ok(parsePositiveInt('0').ok === false, '0 不构成一块/一轮(它必须由 empty 报出,不能由旗标伪装)')
  ok(parsePositiveInt('-5').ok === false, '负数必须拒')
  ok(parsePositiveInt('25.9').ok === false, '小数不是整数块大小 —— parseInt 会把它读成 25,那叫静默改语义')
  ok(parsePositiveInt('1e3').ok === false, '科学计数法不是块大小(Number 会读成 1000)')
  ok(parsePositiveInt('abc').ok === false && parsePositiveInt(null).ok === false, '非数字与缺值必须拒')
  // (f) 旗标成套性:白名单、值旗标表、inspectArgs 三处必须同时认识 --max-rows/--rounds
  for (const f of ['--max-rows', '--rounds', '--help']) {
    ok(KNOWN_FLAGS.includes(f), `${f} 未进 KNOWN_FLAGS ⇒ inspectArgs 会把整条命令拒掉`)
  }
  for (const f of ['--max-rows', '--rounds']) {
    ok(VALUE_FLAGS.includes(f), `${f} 未进 VALUE_FLAGS ⇒ 它的值会被当未知位置参数拒掉(白名单认识、值不认识=自相矛盾)`)
  }
  ok(inspectArgs(['--dedupe-open-rows', '--max-rows', '25', '--rounds', '60', '--commit']).unknown.length === 0, '分块档的完整命令行必须被 inspectArgs 放行')
  ok(inspectArgs(['--dedupe-open-rows', '--max-rows']).unknown.length === 0, '裸 --max-rows 缺值是 flagValue 的地面,不是 inspectArgs 的 —— 本判据不得顺手把它当未知参数')
  ok(inspectArgs(['--dedupe-open-rows', '25']).unknown.includes('25'), '没有被值旗标领着的裸位置参数必须拒(它多半是漏写旗标的 25)')
  /**
   * 带值旗标的取值判据(枚 380431ffc 同族口径)。成对,单向断言等于没有:
   * 只判"坏的必被拒"会让它退化成"永远拒",而 (b) 那一臂证明合法路径照写。
   */
  ok(flagValue(['--write-to', '--staged'], '--write-to').valid === false, '紧跟的 - 旗标不得被当成本旗标的值')
  ok(flagValue(['--write-to'], '--write-to').valid === false, '其后没有参数不得被当成有值')
  ok(flagValue(['--write-to', ''], '--write-to').valid === false, '空串不是路径')
  ok(flagValue(['--write-to', 'out/cand.md'], '--write-to').value === 'out/cand.md', '合法路径必须放行(否则本校验变成永拒)')
  ok(flagValue(['--all'], '--write-to').present === false, '旗标缺席时不得判成"值为空"')
  console.log(`\n自检:${pass} 通过 / ${fail} 失败`)
  return fail ? 1 : 0
}

/**
 * 带值旗标的取值判据 —— 口径照抄同族已修的两处(枚 `380431ffc`),不另发明:
 * **值必须存在且不以 `-` 开头,才算这个旗标的值**。
 *
 * 为什么"存在"不够:`--staged` 这类 token 是真值、还"含路径形状",能过掉任何只看真假/形状的
 * 旧校验 ⇒ `writeFileSync('--staged')` 在**当前工作目录**写出一个名叫 `--staged` 的文件
 * (§28 禁止形态,`git status` 之外几乎无判据会喊),而期望路径**没被写**。对本工具来说第二层
 * 更贵:归并器自认为写完了 —— 活文档候选文本落到错地方、台账没更新,账面却报"已归并 N 条",
 * 同一个分叉下一次还会被重新"修"一遍(本仓"判据失效的表现永远是安静"那一型)。
 *
 * 返回 {present, valid, value, token}:token 把**真实收到的东西**原样带回去,拒绝时必须点名它
 * (调用方漏写值与被别的旗标顶上,是两种不同的修法,不能合成一句"参数错")。
 */
export function flagValue(list, flag) {
  if (!Array.isArray(list) || !list.includes(flag)) return { present: false, valid: false, value: null, token: null }
  const raw = list[list.indexOf(flag) + 1]
  const token = typeof raw === 'string' ? raw : null
  const valid = token !== null && token !== '' && !token.startsWith('-')
  return { present: true, valid, value: valid ? token : null, token }
}

/**
 * 带值旗标的整数取值判据 —— `--max-rows` / `--rounds` 共用**这一份**。
 *
 * 为什么不复用 `Number(x)` 那一套:`Number('25abc')` 是 NaN、`Number('1e3')` 是 1000、
 * `parseInt('25.9')` 是 25,三种都会让"我给了个奇怪的值"静默变成一个**看起来合理**的块大小。
 * 本函数只认非负整数字面量,其余一律 `{ok:false, reason}` 并把**原样实得**带回报告 ——
 * 拒绝时必须点名收到的是什么,否则调用方分不清"漏写值"与"写了个错值"。
 * `≥1` 是硬下界:0 行的块不存在,0 轮等于什么都没做,而"什么都没做"必须由 empty 报出来,
 * 不能由一个旗标伪装成"跑完了"。
 */
export function parsePositiveInt(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return { ok: false, reason: `需要一个整数值(实得 ${JSON.stringify(raw)})` }
  const t = raw.trim()
  if (!/^\d+$/.test(t)) return { ok: false, reason: `不是非负整数字面量(实得 ${JSON.stringify(raw)})` }
  const v = Number(t)
  if (!Number.isInteger(v) || v < 1) return { ok: false, reason: `必须是 ≥1 的整数(实得 ${JSON.stringify(raw)})` }
  return { ok: true, value: v }
}

/**
 * 旗标白名单校验(2026-09-28 立,由一次真实的" phantom 出口"事故逼出)。
 *
 * 旧形态只判 `argv.includes(已知旗标)`,**不认识的 token 一律被静默忽略**,于是
 * `node scripts/plan-tasks-merge.mjs --dedupe-done-twins`(一个从未实现过的出口)会直接
 * 落进默认报告档,末行打出「✅ 零损失对账通过…派单口径 403 → 403」—— 读的人有充分理由
 * 以为那个操作真跑了。本会话就据此把那条命令写进了台账,直到现读才发现 F10 根本不在 HEAD。
 * 这与本仓已修过的 `i18n-apply --help` 进写盘模式同族:**未知参数降级成"无参"就是造合格证**。
 *
 * 因此:不认识的旗标、以及不该出现在那个位置的位置参数 ⇒ **拒绝并非零退出(2)并原样点名**,
 * 绝不回落到任何一档。`--write-to`/`--match`/`--max-rows`/`--rounds` 的紧邻值与一枚
 * `YYYY-MM-DD` 日期是仅有的合法位置参数 —— 合法值旗标只有 `VALUE_FLAGS` 这一份名单:
 * 白名单与"谁能吃位置参数"分两处写,迟早出现"旗标认识、值被当成未知位置参数"的自相矛盾
 * (实测 `--max-rows 25` 若只加进 KNOWN_FLAGS 而没进值旗标表,inspectArgs 会把 `25` 判成
 * 未知位置参数并拒掉整条命令 —— 一道拒绝误用的判据把自己的合法用法拒了,方向比漏判更糟)。
 */
export const KNOWN_FLAGS = [
  '--self-test',
  '--help',
  '--heal',
  '--commit',
  '--dedupe-blocks',
  '--dedupe-rows',
  '--dedupe-open-rows',
  '--fold-twins',
  '--audit-pointers',
  '--restore-terminals',
  '--json',
  '--match',
  '--max-rows',
  '--rounds',
  '--allow-mass',
  '--staged',
  '--worktree',
  '--all',
  '--write-to',
]

/** 吃"紧邻下一个 token 作为值"的旗标 —— inspectArgs 与各处 flagValue 共用这一份名单。 */
export const VALUE_FLAGS = ['--write-to', '--match', '--max-rows', '--rounds']

/** @returns {{unknown:string[], notes:string[]}} unknown 非空即必须拒绝执行 */
export function inspectArgs(list) {
  const unknown = []
  const notes = []
  for (let i = 0; i < list.length; i++) {
    const t = list[i]
    if (typeof t !== 'string' || t === '') continue
    if (t.startsWith('-')) {
      if (!KNOWN_FLAGS.includes(t)) unknown.push(t)
      continue
    }
    // 位置参数只允许两类形态:值旗标的紧邻值,与一枚日期
    if (VALUE_FLAGS.includes(list[i - 1])) continue
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) continue
    unknown.push(t)
    notes.push(`位置参数 ${JSON.stringify(t)} 既不是 ${VALUE_FLAGS.join('/')} 的值也不是 YYYY-MM-DD 日期`)
  }
  return { unknown, notes }
}

/**
 * `--help` 出口(2026-09-29 立)。此前本脚本没有 --help:`inspectArgs` 把它当未知参数拒掉,
 * 顺带打出 `可用旗标:${KNOWN_FLAGS.join(' ')}` —— 那是**一份没有解释的名单**,读的人知道有
 * `--max-rows` 这个 token,却不知道它吃什么值、与 `ROW_MASS_LIMIT` 是什么关系,而这条命令
 * 动的是 13900 行活文档。名单会随并发会话腐烂(新旗标进不来、旧旗标删不掉),所以帮助文本
 * 必须**从 KNOWN_FLAGS/VALUE_FLAGS 派生**而不是另抄一份旗标清单。
 */
function printHelp() {
  console.log(
    [
      'plan-tasks-merge.mjs —— PROJECT_PLAN.md 任务台账的归并/清偿出口(守门 130 的修法侧)',
      '',
      '常用档(默认一律只出报告,加 --commit 才走对象空间落地:临时索引 + commit-tree + CAS,**绝不碰共享工作树**):',
      '  --heal                F1/F2/F3/F4 归并落账(只改行内状态与注记,一行不删)',
      '  --dedupe-blocks       连续 ≥3 行的逐字相同登记块,只删第 2..N 份(F6)',
      '  --dedupe-rows         已完成(- [x])的逐字相同单行,只删第 2..N 份',
      '  --dedupe-open-rows    未勾选(- [ ])且已带「【归并】重复登记副本」指针的逐字相同单行(八条零损失断言)',
      '  --fold-twins          F10 同题不同编号的孪生登记折叠(摘主键位编号 + 只写题面指针)',
      '  --audit-pointers      只读:点名"全族都带副本指针 ⇒ 对派单口径隐形"的主键族',
      '  --restore-terminals   为隐形主键族恢复一行终端代表(只报名,/commit 才落)',
      '',
      '取值旗标(紧邻的下一个 token 必须是值,且不以 - 开头;值无效 ⇒ 拒绝执行,不回落到默认):',
      '  --match "<整行子串>"      内容锚点定向执行(不认行号 —— 行号在任何一次 append 后都会挪位)',
      '  --max-rows <N>            分块单块拟删行数上限:N 必须是 ≥1 的整数;N > 25(ROW_MASS_LIMIT)且未带',
      '                            --allow-mass ⇒ 判死(把上限调到阀门之上等于用"设上限"绕过阀门)。',
      '                            组**不得切半**,贪心按首次出现升序取到装不下即停;每组各落一枚可单独 git revert 的提交。',
      '  --rounds <N>              轮次循环上限:N 必须是 ≥1 的整数。带 --max-rows 而未给 ⇒ 按本轮面的块投影',
      '                            自动给一个"够跑完"的数并写明最多几轮(HEAD 会被并发推进,块数只在该面上成立)。',
      '  --write-to <path>         把候选文本写到指定路径(禁止指向 PROJECT_PLAN.md 本体)',
      '',
      '其他旗标:--commit 才落地 · --allow-mass 人工放行大批量(会原样写进提交信息) ·',
      '  --staged/--worktree 换判定面(落地一律只认 HEAD blob;--staged 只许出报告,§12 污染型)',
      '  --all 全列报名 · --json 机器可读 · --self-test 判据自检 · --help 本文',
      '',
      '退出码:0 = 通过/无事可做 · 1 = 断言不过或拒批量(现场保留) · 2 = 无法判定或参数不成立(不出具合格证)',
    ].join('\n'),
  )
  return 0
}

function main() {
  const argv = process.argv.slice(2)
  const has = (f) => argv.includes(f)
  const { unknown, notes } = inspectArgs(argv)
  if (unknown.length) {
    console.log(
      `❌ 未识别的参数:${unknown.map((u) => JSON.stringify(u)).join(' ')} —— 本工具**不会**把它当"无参"降级执行,` +
        `因为静默忽略会对着一个从未存在的出口打出"✅ 通过"那样格式的结论。\n` +
        `   可用旗标:${KNOWN_FLAGS.join(' ')};位置参数只接受一枚日期(YYYY-MM-DD)或 --write-to 的路径值。\n` +
        (notes.length ? `   另:${notes.join(';')}\n` : ''),
    )
    return 2
  }
  if (has('--self-test')) return selfTest()
  if (has('--help')) return printHelp()
  /**
   * 只读诊断:点名"全族都带副本指针 ⇒ 对派单口径隐形"的主键族。
   * 刻意**不改一行、不判红**(退出码恒 0):存量 19 族若当场 blocking,就是一台与任何提交都无关的
   * 恒红门,唯一结局是逼人 `--no-verify` 连带废掉全部守门(§12e)。问责走人读输出与 `--json`。
   */
  if (has('--audit-pointers')) {
    const selP = selectFace({ staged: has('--staged'), worktree: has('--worktree'), def: 'head' })
    if (selP.error) {
      console.log(`⚠️ 无法判定 —— ${selP.error}`)
      return 2
    }
    let srcP
    try {
      srcP = readPlan(ROOT, selP.face)
    } catch (e) {
      console.log(`⚠️ 无法判定 —— ${e instanceof Undetermined ? e.message : String(e?.message ?? e)}`)
      return 2
    }
    const tP = auditPointerTerminals(srcP)
    if (has('--json')) {
      console.log(JSON.stringify({ face: LABEL[selP.face], families: tP.families, rows: tP.rows, groups: tP.groups }, null, 2))
      return 0
    }
    console.log(
      `判定面:${LABEL[selP.face]}  ★ 主键族内无终端代表 = ${tP.families} 族 / ${tP.rows} 行;` +
        `其中**按编号也找不到任何代表**(真隐形)= ${tP.hiddenFamilies} 族 / ${tP.hiddenRows} 行 —— 只报数,本命令不改任何一行`,
    )
    for (const g of tP.groups.slice(0, has('--all') ? 99999 : 12)) {
      console.log(
        `   [${g.hidden ? '真隐形' : '该编号另有代表(撞号副产物,不计债)'}] ${String(g.key).slice(0, 52)} —— ${g.lines.length} 行: L${g.lines.map((x) => x.line).join(', L')}`,
      )
    }
    if (tP.families > 12 && !has('--all')) console.log(`   …另 ${tP.families - 12} 族(--all 全列)`)
    console.log(
      '   出口:`node scripts/plan-tasks-merge.mjs --restore-terminals`(默认只报名,--commit 才落)' +
        '—— 每族恢复一行代表;注记没有结构边界的族与"恢复会撞号"的族一律拒绝并点名,交人工。',
    )
    console.log(
      '   ⚠ 本函数初版在这里写过"修法必须同笔两处:① rewriteDup 加指针前先问本判据;② 验收链从「F4=0」升级为「F4=0 ∨ 各有终端」" —— 第②条是**错的**,' +
        '已推翻并记在 pointerVisibilityRegression 的头注里:F4 先按 DUP_POINTER_RE 滤掉带指针的行,全指族在它眼里恒为 0,所以恢复一行代表既不会顶起 F4,也不需要放宽验收。',
    )
    return 0
  }
  /**
   * 隐形活账的恢复档。三档语义与 --fold-twins / --dedupe-blocks 同形:
   *  ① 不带 --commit ⇒ 报告档,一行不改;② 带 --commit ⇒ 对象空间落地(临时索引 + commit-tree
   *     + CAS,绝不碰共享工作树);③ 判不出/会撞号 ⇒ 拒绝并逐族点名,不并入"通过"。
   * 刻意**不**挂 post-commit 自动档:它把一行交回派单口径 = 改变"谁该被派活",
   * 与删行同属活文档上最危险的动作,必须有人看过名单(G-336 立的那条规矩)。
   */
  if (has('--restore-terminals')) {
    const selR = selectFace({ staged: has('--staged'), worktree: has('--worktree'), def: 'head' })
    if (selR.error) {
      console.log(`⚠️ 无法判定 —— ${selR.error}`)
      return 2
    }
    let srcR
    try {
      srcR = readPlan(ROOT, selR.face)
    } catch (e) {
      console.log(`⚠️ 无法判定 —— ${e instanceof Undetermined ? e.message : String(e?.message ?? e)}`)
      return 2
    }
    const rR = buildRestoreTerminals(srcR)
    const vR = rR.edits.length ? verifyRestoreTerminals(srcR, rR.text, rR.edits) : null
    if (has('--json')) {
      console.log(
        JSON.stringify(
          {
            face: LABEL[selR.face],
            hiddenBefore: rR.hiddenBefore,
            hiddenRowsBefore: rR.hiddenRowsBefore,
            edits: rR.edits.map((e) => ({ line: e.line, key: e.key, via: e.via, after: e.after.slice(0, 120) })),
            refused: rR.refused,
            problems: vR ? vR.problems : [],
            hiddenAfter: vR ? vR.hiddenAfter : null,
          },
          null,
          2,
        ),
      )
      return vR && vR.problems.length ? 1 : 0
    }
    console.log(
      `判定面:${LABEL[selR.face]}  隐形族 ${rR.hiddenBefore} 族 / ${rR.hiddenRowsBefore} 行 ⇒ 本档可自动恢复 ${rR.edits.length} 行代表,拒绝 ${rR.refused.length} 族(不猜)`,
    )
    for (const e of rR.edits.slice(0, has('--all') ? 99999 : 12))
      console.log(`   ↺ L${e.line}(${e.via}) ${String(e.key).slice(0, 46)} ⇒ ${e.after.slice(0, 96)}`)
    if (rR.edits.length > 12 && !has('--all')) console.log(`   …另 ${rR.edits.length - 12} 行(--all 全列)`)
    for (const f of rR.refused.slice(0, has('--all') ? 99999 : 12))
      console.log(`   ✋ L${f.lines.join(',L')} ${String(f.key).slice(0, 40)} —— ${f.reason}`)
    if (rR.refused.length > 12 && !has('--all')) console.log(`   …另 ${rR.refused.length - 12} 族`)
    if (vR && vR.problems.length) {
      console.log('❌ 零损失对账不通过,整批不落:')
      for (const p of vR.problems.slice(0, 8)) console.log('   ' + p)
      return 1
    }
    if (vR) console.log(`✅ 零损失对账通过;恢复后隐形族 ${rR.hiddenBefore} → ${vR.hiddenAfter}(行 ${rR.hiddenRowsBefore} → ${vR.hiddenRowsAfter})`)
    if (!has('--commit')) {
      console.log('ℹ️ 未加 --commit:只出报告,一行未改。确认名单后再跑 --restore-terminals --commit')
      return 0
    }
    return restoreTerminalsAndLand()
  }
  /**
   * F10 折叠档(同题不同编号的孪生登记)。三档语义与 --dedupe-blocks 同形:
   *  ① 不带 --commit ⇒ **报告档**,一行不改;② 带 --commit ⇒ 走对象空间落地(临时索引 +
   *     commit-tree + CAS,不碰共享工作树);③ 判不出一律交人工,不并入"通过"。
   * 它刻意**不**挂 post-commit 自动跑的独立入口 —— 这一维已经由 `--heal --commit` 在同一枚
   * 提交里调度;这里的 --fold-twins --commit 是给人工复核与"只有孪生、没有分叉"那次收口用的。
   */
  if (has('--fold-twins')) {
    const selT = selectFace({ staged: has('--staged'), worktree: has('--worktree'), def: 'head' })
    if (selT.error) {
      console.log(`⚠️ 无法判定 —— ${selT.error}`)
      return 2
    }
    let srcT
    try {
      srcT = readPlan(ROOT, selT.face)
    } catch (e) {
      console.log(`⚠️ 无法判定 —— ${e instanceof Undetermined ? e.message : String(e?.message ?? e)}`)
      return 2
    }
    const dayT = argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? new Date().toISOString().slice(0, 10)
    const fT = applyTwinFolds(srcT, dayT)
    const vT = verifyTwinFold(srcT, fT.text, fT.edits, fT.refused)
    if (has('--json')) {
      console.log(
        JSON.stringify(
          { face: LABEL[selT.face], day: dayT, edits: fT.edits, groups: fT.groups, undetermined: fT.undetermined, problems: vT.problems },
          null,
          2,
        ),
      )
      return vT.problems.length ? 1 : 0
    }
    console.log(
      `判定面:${LABEL[selT.face]}  F10 同题不同编号:成组 ${fT.groups.length} 族(持有行保持原样)/ ` +
        `拟折 ${fT.edits.length} 行 / 判不出 ${fT.undetermined.length} 条 —— 三态分开数,"判不出"不计入通过`,
    )
    for (const e of fT.edits.slice(0, has('--all') ? 99999 : 10)) {
      console.log(`  - 折 L${e.line}(持有行 L${e.keeperLine},题面「${e.title.slice(0, 40)}」)`)
    }
    if (fT.edits.length > 10 && !has('--all')) console.log(`    …另 ${fT.edits.length - 10} 行(--all 全列)`)
    if (fT.undetermined.length) {
      console.log(`  ⚠️ 判不出 ${fT.undetermined.length} 条(不折、不记绿,逐条点名):`)
      for (const u of fT.undetermined.slice(0, has('--all') ? 99999 : 10)) console.log('     · ' + u)
      if (fT.undetermined.length > 10 && !has('--all')) console.log(`     …另 ${fT.undetermined.length - 10} 条`)
    }
    if (!fT.edits.length && !fT.undetermined.length && !fT.groups.length)
      console.log('  ✅ 本面没有"同题而编号互异"的登记族(F10 = 0 成员,不是"判不出")')
    if (vT.problems.length) {
      console.log('❌ 零损失断言未过,拒交付:')
      for (const p of vT.problems.slice(0, 10)) console.log('   ' + p)
      return 1
    }
    if (fT.edits.length)
      console.log(
        '✅ 零损失断言六条全过(行数不变 / 未登记行逐字不变 / 剥注记回底稿 / 主键仍是本行行首号且带副本指针 / 守门 71 判不到消失 / 折完无残留)',
      )
    if (!has('--commit')) {
      console.log('ℹ️ 未加 --commit:只出报告,一行未改。确认后再跑 --fold-twins --commit')
      return 0
    }
    return twinFoldAndLand()
  }
  if (has('--heal') && has('--commit')) return healAndLand()
  if (has('--heal')) {
    console.log('ℹ️ --heal 需与 --commit 同给才动手(单独的 --heal 只出报告,不写任何内容)')
  }
  /**
   * F6 块级收口。与 --heal 同一条"只判不修就是把手交给下一个人"的理由,但它**不在**
   * post-commit 自动跑:删行是活文档上最危险的动作,自动档只做改行内状态那一类;
   * 块级收口必须由显式一次人工触发,并且当场打印零损失断言的四条结论。
   */
  if (has('--dedupe-blocks')) {
    const sel0 = selectFace({ staged: has('--staged'), worktree: has('--worktree'), def: 'head' })
    if (sel0.error) {
      console.log(`⚠️ 无法判定 —— ${sel0.error}`)
      return 2
    }
    let src0
    try {
      src0 = readPlan(ROOT, sel0.face)
    } catch (e) {
      console.log(`⚠️ 无法判定 —— ${e instanceof Undetermined ? e.message : String(e?.message ?? e)}`)
      return 2
    }
    const c0 = auditPlan(src0).counts
    if (!c0.dupBlocks) {
      console.log(`✅ 无逐字重复的整块登记(F6=0);漂移 ${c0.dupBlockDrifted} 块按设计不自动动`)
      return 0
    }
    const d0 = buildBlockDedupe(src0)
    const p0 = verifyBlockDedupe(src0, d0.text, d0.deletedCount)
    console.log(
      `判定面:${LABEL[sel0.face]}  F6 ${c0.dupBlocks} 块 / ${c0.dupBlockCopies} 份 → 拟删第 2..N 份共 ${d0.deletedCount} 行;漂移 ${c0.dupBlockDrifted} 块不自动动`,
    )
    for (const b of d0.removed.slice(0, has('--all') ? 9999 : 10)) {
      console.log(`  - 删 L${b.at} 起的 ${b.len} 行: ${b.first.slice(0, 60)}`)
    }
    if (p0.length) {
      console.log('❌ 零损失断言未过,拒交付:')
      for (const x of p0) console.log('   ' + x)
      return 1
    }
    console.log('✅ 零损失断言四条全过(幸存份仍在 / 多重集只减不增 / F1–F4+F6 无一上涨 / 注记不降)')
    if (!has('--commit')) {
      console.log('ℹ️ 未加 --commit:只出报告,一行未删。确认后再跑 --dedupe-blocks --commit')
      return 0
    }
    return dedupeAndLand()
  }
  /**
   * 单行等值副本档(G-336)。与 --dedupe-blocks 同样**不进 post-commit 自动档**:
   * 删行是活文档上最危险的动作,自动档只做改行内状态那一类。
   * 它存在的理由就是块级门槛(≥3 行)结构上看不见"同一件事被抄成两份单行"这一型,
   * 而 F1/F2/F4 也不计它(那三条要的是未勾形态,两份都已勾 ⇒ 账面全 0 而账是错的)。
   */
  if (has('--dedupe-rows')) {
    const mv = flagValue(argv, '--match')
    if (mv.present && !mv.valid) {
      console.log(
        `❌ --match 需要一个非旗标值(实得 ${JSON.stringify(mv.token)})—— 不接受"给了旗标却没给值",` +
          `因为把 --match 空值静默当成"不带锚点"会退化成全档清理,那比多删更危险的方向反了。`,
      )
      return 2
    }
    const match = mv.value
    const selR = selectFace({ staged: has('--staged'), worktree: has('--worktree'), def: 'head' })
    if (selR.error) {
      console.log(`⚠️ 无法判定 —— ${selR.error}`)
      return 2
    }
    let srcR
    try {
      srcR = readPlan(ROOT, selR.face)
    } catch (e) {
      console.log(`⚠️ 无法判定 —— ${e instanceof Undetermined ? e.message : String(e?.message ?? e)}`)
      return 2
    }
    const all = findRowTwins(srcR)
    const groups = all.filter((g) => !match || g.line.includes(match))
    console.log(
      `判定面:${LABEL[selR.face]}  等值副本全档 ${all.length} 组 / 共 ${all.reduce((s, g) => s + g.copies, 0)} 份` +
        (match ? `;本次锚点命中 ${groups.length} 组` : ''),
    )
    if (!groups.length) {
      console.log(
        match ? `ℹ️ 锚点没命中任何等值副本 ⇒ 一行未删(锚点是内容子串,不认行号;不命中不等于"没有副本")` : `✅ 无逐字相同的已完成单行副本(本档=0)`,
      )
      return 0
    }
    let rR
    try {
      rR = buildRowDedupe(srcR, match)
    } catch (e) {
      console.log(`❌ 单行副本档停手 —— ${e instanceof Undetermined ? e.message : String(e?.message ?? e)}`)
      return 1
    }
    for (const g of groups.slice(0, has('--all') ? 9999 : 10)) {
      console.log(`  - ${g.copies} 份 @ L${g.at.join(',L')}: ${g.line.slice(0, 60)}`)
    }
    const pR = verifyRowDedupe(srcR, rR.text, rR.deletedCount, match)
    if (pR.length) {
      console.log('❌ 零损失断言未过,拒交付:')
      for (const x of pR) console.log('   ' + x)
      return 1
    }
    console.log(
      `拟删第 2..N 份共 ${rR.deletedCount} 行;✅ 零损失断言五条全过(顺序子序列 / 幸存份在位 / 无值变多 / F1–F4+F6 不涨、注记不降 / 本档幂等清零)`,
    )
    // 大批量阀门:与归档器同一取向 —— 异常量只可能是判据漂了或积压一次放开,
    // 一次几百行的活文档删除没人复核得动,而"断言全绿"在这种量级上证明不了人看得过来。
    if (rR.deletedCount > ROW_MASS_LIMIT && !has('--allow-mass')) {
      console.log(
        `❌ 拒批量:本次拟删 ${rR.deletedCount} 行 > 单批上限 ${ROW_MASS_LIMIT} 行 —— 这不是错误,是"必须由人一次一批放行"。\n` +
          `   逐批做法:先跑 \`--dedupe-rows --match "<该行的一段原文>"\` 看清范围,确认五条断言与打印的组数后加 --commit;\n` +
          `   确要一次放开整个等值副本集,再显式加 --allow-mass(它会原样出现在落地提交信息里)。`,
      )
      return 1
    }
    if (!has('--commit')) {
      console.log('ℹ️ 未加 --commit:只出报告,一行未删。确认后再跑 --dedupe-rows --commit')
      return 0
    }
    return rowsDedupeAndLand(match)
  }
  /**
   * 未勾单行等值副本档(G-741)。与 `--dedupe-rows` / `--dedupe-blocks` 同样**绝不进 post-commit 自动档**:
   * 删行是活文档上最危险的动作,自动档只做"改行内状态"那一类(--heal 的翻勾/加注记)。
   * 它补的是那一档的第①条门槛(行首必须是 `- [x]`)留下的整格:真仓 HEAD 现读 220 组 / 1148 份
   * 带指针的未勾选逐字孪生,派单口径已排除、锚点唯一性却永久坏掉。
   *
   * ── 分块 + 轮次(2026-09-29 立,`--max-rows` / `--rounds`)──
   * 本档有一道大批量阀门 `ROW_MASS_LIMIT = 25`:一次拟删超过 25 行就拒批量。设计意图不变 ——
   * 活文档上一次删几百行没人复核得动。清 1143 行若只能靠人工逐批,那是约 46 次调用,而**46 次
   * 人工调用本身才是最大的错误源**(这台机 HEAD 一天推进几十枚,每次都得重新定位行号 —— §1 早已
   * 判过"证据指针禁止写行号")。所以这里把"分批"做成机器动作,而不是把它留给人:
   *  ① **分块不降低任何一条断言**,只改变"一次落多少"。八条零损失断言逐块照跑;唯一换口径的是
   *     第⑤条幂等 —— 它从"本档全部清零"改成"**本轮认领的组**清零",因为分块之后必然还有没轮到的
   *     组留在面上,按原口径判就是一台每次分块都恒拒的尺子(它拦不住任何错误,只保证这条路走不通)。
   *     被选中的组若没删净,set 里那条照样还在 ⇒ 当场红。①②③④⑥⑦⑧ 七条一字未动,而它们判的恰好
   *     是"本轮没认领的行必须逐字活着",与分块方向一致 —— 所以这不是把判据削短。
   *  ② **每块单独一枚提交,可单独 `git revert`**。这是这条路径的唯一审计单位:第 7 块出问题,
   *     撤的是第 7 块,不是把前 6 块一起抹掉(那等于制造"什么都没发生"的假象)。
   *  ③ **任一块断言不过就停在那里,不留半落地现场**:块内仍是"建树→CAS→回读复核",复核不过即回退
   *     该块;已落的前几块保留(它们是独立前向提交),退出码原样传播(拒批量=1、无法判定=2)。
   *  ④ 组**不得切半**(cost 整组计或整组不计),贪心按首次出现升序取到装不下即停。真仓实测这一条
   *     不是抽象要求:有一组 cost=37 > 25 且排在序里很前面 —— 纯贪心前缀下它和后面的组永远进不了
   *     任何块。工具必须**报名堵住的那一组并喊停**,不得静默跳过它继续清后面的(那会把语义偷换成
   *     另一套,"一轮清 1107 行"与"一轮清 42 行"两种答案都自称遵守分块)。出路是 `--match` 定向
   *     或人工 `--allow-mass`。
   */
  if (has('--dedupe-open-rows')) {
    const mv = flagValue(argv, '--match')
    if (mv.present && !mv.valid) {
      console.log(
        `❌ --match 需要一个非旗标值(实得 ${JSON.stringify(mv.token)})—— 把空值静默当"不带锚点"会退化成全档清理,方向反了。`,
      )
      return 2
    }
    const match = mv.value
    // 分块两旗:取值判据与 --match 同形(缺失/被别的旗标顶上 = 大声拒绝,绝不回落到默认值)。
    const mxR = flagValue(argv, '--max-rows')
    if (mxR.present && !mxR.valid) {
      console.log(
        `❌ --max-rows 需要一个非旗标整数值(实得 ${JSON.stringify(mxR.token)})—— 把空值当"不分块"会一次删上千行,方向反了。`,
      )
      return 2
    }
    let maxRows = null
    if (mxR.present) {
      const p = parsePositiveInt(mxR.value)
      if (!p.ok) {
        console.log(`❌ --max-rows ${p.reason}(0 行/负数/非整数字面量都不构成"块",本档拒绝执行)`)
        return 2
      }
      maxRows = p.value
      // 方向不许反:--max-rows 是"必须分块"这句话的具体化,把它调到超过阀门又不带 --allow-mass,
      // 读起来像"我设了个上限"而实际是"我绕过了上限"。判死并说明出路。
      if (maxRows > ROW_MASS_LIMIT && !has('--allow-mass')) {
        console.log(
          `❌ --max-rows ${maxRows} > 单批上限 ${ROW_MASS_LIMIT} 且没带 --allow-mass —— 这条上限就是"必须分块"的意思,\n` +
            `   把它调到阀门之上等于用"设上限"的名义绕过上限,本档拒绝执行(不是"自动收敛到 ${ROW_MASS_LIMIT}",那会替你改变块大小)。\n` +
            `   要整档放行请用 --allow-mass(它会原样写进落地提交信息);要按块清就用 --max-rows ${ROW_MASS_LIMIT}。`,
        )
        return 2
      }
    }
    const rdR = flagValue(argv, '--rounds')
    if (rdR.present && !rdR.valid) {
      console.log(
        `❌ --rounds 需要一个非旗标整数值(实得 ${JSON.stringify(rdR.token)})—— 把它当"缺省 1 轮"会只清一块而账面读起来像跑完了。`,
      )
      return 2
    }
    let roundsArg = null
    if (rdR.present) {
      const p = parsePositiveInt(rdR.value)
      if (!p.ok) {
        console.log(`❌ --rounds ${p.reason}(0 轮等于什么都没做,而"什么都没做"必须用 empty 报,不能用一个旗标报)`)
        return 2
      }
      roundsArg = p.value
    }
    const selO = selectFace({ staged: has('--staged'), worktree: has('--worktree'), def: 'head' })
    if (selO.error) {
      console.log(`⚠️ 无法判定 —— ${selO.error}`)
      return 2
    }
    let srcO
    try {
      srcO = readPlan(ROOT, selO.face)
    } catch (e) {
      console.log(`⚠️ 无法判定 —— ${e instanceof Undetermined ? e.message : String(e?.message ?? e)}`)
      return 2
    }
    const allO = findOpenRowTwins(srcO)
    const groupsO = allO.filter((g) => !match || g.line.includes(match))
    const refO = findOpenRowRefusals(srcO)
    const cO = auditPlan(srcO).counts
    console.log(
      `判定面:${LABEL[selO.face]}  未勾等值副本(已带「重复登记副本」指针)全档 ${allO.length} 组 / 共 ${allO.reduce((s, g) => s + g.copies, 0)} 份` +
        (match ? `;本次锚点命中 ${groupsO.length} 组` : ''),
    )
    // readPlan 的 'worktree' 档沿用既有实现(它取的是 HEAD blob),本档不偷偷修正也不假装看见工作树:
    // 报出来,免得读的人把一个 HEAD 面的结论当成"我这一棵树上的现场"。
    if (selO.face === 'worktree')
      console.log('   ⚠️ 上面那个面的正文实际取自 HEAD blob(readPlan 既有形态,与本档无关)—— 要看工作树请另跑')
    // 三态必须报名,不得只报数 —— 拿到计数的人无法判断哪一族该走 --heal、哪一族该人工裁。
    console.log(
      `刻意不删的两族:① 未带指针的逐字等值孪生 ${refO.noPointer.length} 组(出口是 --heal 加注记,一行不删)` +
        ` ② 同主键而正文已漂开 ${refO.drifted.length} 组(机器折半即有损,交人工)`,
    )
    console.log(
      `尺子现读:F4 dupOpen ${cO.dupOpenGroups} 组 / 副本 ${cO.dupOpenCopies} 份 · F4b 无主键逐字孪生 ${cO.verbatimDupGroups} 组 / ${cO.verbatimDupCopies} 份` +
        ` · 已标副本行 ${cO.dupPointerRows} · 派单口径 claimable ${cO.claimable}(本档落地前后必须同值)`,
    )
    for (const g of refO.noPointer.slice(0, has('--all') ? 9999 : 5))
      console.log(`  · 交 --heal:${g.copies} 份 @ L${g.at.join(',L')}: ${g.line.slice(0, 60)}`)
    for (const d of refO.drifted.slice(0, has('--all') ? 9999 : 5))
      console.log(`  · 交人工(同主键漂移):${d.copies} 份 @ L${d.at.join(',L')} 键「${String(d.key).slice(0, 40)}」`)
    if (!groupsO.length) {
      console.log(
        match
          ? `ℹ️ 锚点没命中任何"带指针的未勾等值副本" ⇒ 一行未删(锚点是内容子串,不认行号;不命中不等于"没有副本")`
          : `✅ 无带指针的未勾选等值单行副本(本档=0),不动任何东西`,
      )
      return 0
    }
    const totalRemovableO = groupsO.reduce((s, g) => s + g.at.length - 1, 0)
    // 轮数投影与 build 用**同一份**贪心实现(planOpenRowChunks)—— 报告与落地算出两套块,
    // 就是"预计 N 轮跑完"与"实际第 2 轮就停"各说各话,而这种报告正是人决定要不要放行的依据。
    const projO = planOpenRowChunks(groupsO, maxRows)
    let rO
    try {
      rO = buildOpenRowDedupe(srcO, match, maxRows)
    } catch (e) {
      console.log(`❌ 未勾单行副本档停手 —— ${e instanceof Undetermined ? e.message : String(e?.message ?? e)}`)
      return 1
    }
    if (maxRows !== null) {
      const ovO = projO.oversized
      console.log(
        `分块口径:单块上限 ${maxRows} 行(按组完整取,组已按首次出现升序 ⇒ **绝不切半**;` +
          `单组就超上限的整组跳过并逐条报名,不静默)\n` +
          `  还剩多少行可删:${totalRemovableO} 行 / ${groupsO.length} 组(本面现读)\n` +
          `  本轮会取:${rO.selectedGroups.length} 组,共 ${rO.deletedCount} 行\n` +
          `  预计轮数:${projO.chunks.length} 轮${
            projO.chunks.length ? `(各块行数 ${projO.chunks.slice(0, 12).map((c) => c.rows).join(', ')}${projO.chunks.length > 12 ? ', …' : ''})` : '(0 轮)'
          }${
            ovO.length
              ? ` —— ⚠️ ${ovO.length} 组**单组**就要删 > 上限 ${maxRows} 行,它们进不了任何块(合计 ${projO.remainingRows} 行):\n` +
                ovO
                  .slice(0, 5)
                  .map((o) => `     · 需删 ${o.cost} 行 / ${o.copies} 份,正文起「${String(o.line).slice(0, 60)}…」`)
                  .join('\n') +
                `${ovO.length > 5 ? `     · 另 ${ovO.length - 5} 组未列出(跑 --json 取全量)\n` : '\n'}     出路:--match 定向清它们,或人工复核后 --allow-mass 整批放行;多跑几轮不解决这一部分。\n`
              : ''
          }`,
      )
    }
    for (const g of (maxRows === null ? groupsO : rO.selectedGroups).slice(0, has('--all') ? 9999 : 10))
      console.log(`  - ${g.copies} 份 @ L${g.at.join(',L')}: ${g.line.slice(0, 60)}`)
    const pO = verifyOpenRowDedupe(srcO, rO.text, rO.deletedCount, match, rO.droppedLines, maxRows === null ? null : rO.selectedLines)
    if (pO.length) {
      console.log('❌ 零损失断言未过,拒交付:')
      for (const x of pO) console.log('   ' + x)
      return 1
    }
    console.log(
      `拟删第 2..N 份共 ${rO.deletedCount} 行;✅ 零损失断言全过(纯删除 / 幸存份在位 / 无新增行 / F1–F4+F6 不涨、注记种类不整类消失 / 派单口径活数不变=${cO.claimable} / 未带指针组数不变 / ${
        maxRows === null ? '幂等清零' : `幂等按本轮认领的 ${rO.selectedGroups.length} 组判(分块不降低其余七条)`
      })`,
    )
    if (rO.deletedCount > ROW_MASS_LIMIT && !has('--allow-mass')) {
      console.log(
        `❌ 拒批量:本次拟删 ${rO.deletedCount} 行 > 单批上限 ${ROW_MASS_LIMIT} 行 —— 这不是错误,是"必须由人一次一批放行"。\n` +
          `   分块做法:\`--dedupe-open-rows --max-rows ${ROW_MASS_LIMIT} [--rounds N]\` 自动按 ≤${ROW_MASS_LIMIT} 行/组完整切块,每块一枚可 revert 的提交;\n` +
          `   逐批做法:\`--dedupe-open-rows --match "<该行的一段原文>"\` 确认该批断言后加 --commit;确要整档放开再显式加 --allow-mass(它会原样写进落地提交信息)。`,
      )
      return 1
    }
    // 带 --max-rows 而没带 --rounds ⇒ 默认给一个"够跑完"的数(按本轮面的块投影),并写清最多跑几轮。
    // 刻意不写"跑到干净为止":HEAD 会被并发推进,块数只在该面上成立;真正的停止条件是 empty。
    const rounds = roundsArg ?? (maxRows === null ? 1 : Math.max(1, projO.chunks.length))
    if (maxRows !== null)
      console.log(
        `落地节奏:${rounds} 轮 × 每轮 ≤${maxRows} 行${roundsArg === null ? '(轮数由本轮面块投影自动给出;要指定请 --rounds N)' : '(--rounds 由人工指定)'}` +
          ` —— 每块单独一枚提交,可逐块 git revert;任一块断言不过即停在那里,不回滚已落的块。`,
      )
    if (selO.face !== 'head') {
      console.log(
        `❌ 本档只从 **HEAD 面**落地(当前判定面=${LABEL[selO.face]}):索引里的 PROJECT_PLAN.md 含别人 staged 的内容,` +
          `把它的正文连我的删除一起交出去就是 §12 的污染型。\n` +
          `   报告已按该面出完;要落地请去掉 --staged/--worktree(底稿取 HEAD blob,删的仍是同一批逐字副本)。`,
      )
      return 2
    }
    if (!has('--commit')) {
      console.log('ℹ️ 未加 --commit:只出报告,一行未删。确认后再跑 --dedupe-open-rows --commit')
      return 0
    }
    return openRowsDedupeAndLand(match, 8, {
      root: ROOT,
      allowMass: has('--allow-mass'),
      maxRows,
      rounds,
    })
  }
  const sel = selectFace({ staged: has('--staged'), worktree: has('--worktree'), def: 'head' })
  if (sel.error) {
    console.log(`⚠️ 无法判定 —— ${sel.error}`)
    return 2
  }
  let src
  let counts0
  try {
    src = readPlan(ROOT, sel.face)
    counts0 = auditPlan(src).counts
  } catch (e) {
    console.log(`⚠️ 无法判定 —— ${e instanceof Undetermined ? e.message : String(e?.message ?? e).split('\n')[0]}`)
    return 2
  }
  const today = (argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? new Date().toISOString().slice(0, 10))
  const r = buildMerge(src, today)
  const v = verifyMerge(src, r.text, r.changed)
  const baseBlob = gitRaw(["rev-parse", sel.face === "staged" ? `:${PLAN_REL}` : `HEAD:${PLAN_REL}`], ROOT)
  console.log(`baseBlob=${baseBlob} —— 落地时必须对这一枚做 CAS:它一挪,行号就不再指向我审过的内容`)
  console.log(`判定面:${LABEL[sel.face]}  现读:F1 ${counts0.forks} 组 / F2 ${counts0.voidRows} 行 / F3 ${counts0.rotatedPointers} 处(其中可自动收口 ${counts0.rotatedAuto}、无出口交人工 ${counts0.rotatedNoExit})/ F4 ${counts0.dupOpenCopies} 副本 / 未勾选 ${counts0.open}`)
  console.log(`拟改写 ${r.changed.length} 行(${r.changed.map((c) => c.kind).sort().join(',')})`)
  // F10 的现读必须与 F1–F4 同屏报出:它不在 composite 键里,默认档不报就等于"没有这一型"。
  const twR = foldTwins(src.split('\n'), today)
  console.log(
    `F10 同题不同编号的孪生登记:成组 ${twR.groups.length} 族 / 拟折 ${twR.edits.length} 行 / 判不出 ${twR.undetermined.length} 条` +
      `(判不出不计入通过;逐条点名见 --fold-twins)`,
  )
  for (const c of r.changed.slice(0, has('--all') ? 9999 : 8)) {
    console.log(`\n  L${c.line} [${c.kind}]`)
    console.log(`    - ${c.before.slice(0, 140)}`)
    console.log(`    + ${c.after.slice(0, 140)}`)
  }
  if (r.changed.length > 8 && !has('--all')) console.log(`\n  …另 ${r.changed.length - 8} 行(--all 全列)`)
  if (r.refused.length) {
    console.log(`\n❌ 拒写项 ${r.refused.length} 条(宁可不写也不猜):`)
    for (const x of r.refused.slice(0, 10)) console.log('   ' + x)
    return 1
  }
  if (v.problems.length) {
    console.log('\n❌ 交付校验不通过:')
    for (const p of v.problems) console.log('   ' + p)
    return 1
  }
  console.log(`\n✅ 零损失对账通过;归并后 F1/F2/F3(可自动收口)/F4 = ${v.after.forks}/${v.after.voidRows}/${v.after.rotatedAuto}/${v.after.dupOpenCopies};F3 无出口仍 ${v.after.rotatedNoExit} 处(点名交人工,不并入归零判据),派单口径 ${counts0.open} → ${v.after.open}`)
  // 拒绝链三格,顺序即严格度:① 值不成其为值(缺失/以 - 开头)② 值是文档本体 ③ 才允许写盘。
  // ①②都**大声拒绝并非零退出**,不得静默忽略旗标、更不得回落到任何默认路径去写别处
  // (落错地方比不落更糟 —— 那正是本格要修的缺陷本身)。
  const wt = flagValue(argv, '--write-to')
  if (wt.present && !wt.valid) {
    console.log(
      `❌ --write-to 没有收到有效路径 —— 紧邻的 token 实得:${wt.token === null ? '(其后没有任何参数)' : JSON.stringify(wt.token)}` +
        `。以 - 开头的 token 是**别的旗标**,不构成本旗标的值;本工具不回落到默认路径,拒绝写出。`,
    )
    return 1
  }
  if (wt.present && wt.value.includes(PLAN_REL)) {
    console.log('❌ --write-to 必须给一个不是 PROJECT_PLAN.md 的路径(本工具不允许直接写文档本体)')
    return 1
  }
  if (wt.present) {
    writeFileSync(wt.value, r.text, 'utf8')
    console.log(`候选文本已写到 ${wt.value}(没有碰 ${PLAN_REL};落地由主会话按活文档规矩走对象空间)`)
  }
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const code = main()
    if (code !== 0) process.exit(code)
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}`)
    process.exit(2)
  }
}

/** §22c:镜像测试直接 import 判据函数,不得复制一份实现 */
export const __test__ = {
  rewriteFork,
  rewritePointer,
  rewriteDup,
  anchorOf,
  POINTER_REPAIRS,
  /**
   * F10 折叠档的构造与判据一并交出(§22c):镜像测试若自己抄一份"注记长什么样",
   * 它就会跟着生产侧一起漂绿 —— 今天这套东西最贵的失效型正是"两份实现各说各话"。
   */
  foldTwins,
  buildTwinFold,
  stripTwinFold,
  isTwinFolded,
  twinFoldRejectReason,
  verifyTwinFold,
  TWIN_NOTE_RE,
  TWIN_TAIL_RE,
  CHECKBOX_LEAD_RE,
  TWIN_GROUP_MAX,
  /** 测试直接 import 这一份判据(§22c:镜像测试不得再抄一份源判据,抄了就跟着一起漂绿) */
  flagValue,
  /** 分块档的贪心与整数取值判据 —— 镜像测试必须用**同一份**实现算块,不得自己再贪心一遍 */
  planOpenRowChunks,
  parsePositiveInt,
  VALUE_FLAGS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
