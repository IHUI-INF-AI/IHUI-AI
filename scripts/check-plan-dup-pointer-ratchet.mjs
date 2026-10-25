#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-plan-dup-pointer-ratchet.mjs —— 「重复登记防回潮」差值棘轮(2026-10-13 立;2026-10-14 扩维)。
 *
 * 立因(用户原话):"我不想让它出现重复登记副本 根本不想 不要再看到 给我彻底根治!"
 * 存量已于 2026-10-13 由 `scripts/plan-pointer-purge.mjs --apply` 一次性清偿(1074 行注记清零,
 * 台账 `.ihui-agent/archive/plan-pointer-purge-2026-10-13.md`)。本门守住清偿成果:
 *
 * 维①(2026-10-13)指针注记棘轮:
 * 判据(差值棘轮,与既有守门 130 的 F7/F8 同一条哲学):**只拦"本次提交让登记行上的指针注记
 * 变多"**,存量不担责 —— 因为与提交内容无关的恒红门只会逼人 --no-verify,连带废掉全部守门
 * (AGENTS §12e 同型)。判定面:
 *   ① 登记行(含残缺行 `- [ ]` / `[ ]`,排除 `<!-- -->` 占位注释):本次提交前后
 *      指针注记行数不得增加(判据 = DUP_POINTER_RE / SELF_DEDISPATCH_RE,来自
 *      scripts/lib/plan-task-index.mjs 单一实现,不在此再抄一份)。
 *   ② `--audit-pointers`(只读报数):当前面上登记行的注记存量,给人工体检用,不判红。
 *
 * 维②(2026-10-14)F10「同题不同编号」差值棘轮:
 * 自动档(plan-tasks-merge --heal)已停产 F10 折叠(noPointer,折叠注记与指针注记同字面);
 * purge 加了 L5 真归并层做存量收口 ⇒ 若不加这道差值,新的同题不同编号重复登记会无声累积。
 * 判据同一条哲学:--staged 面 vs HEAD 面,foldTwins 可折行数(判据单一实现 = plan-tasks-merge
 * 的 foldTwins,与报告口径同源)**只拦变多**。F4/F4b 两维**不在此重复设门** —— 守门 130 的
 * 差值维度已覆盖(plan-tasks.mjs GATE_DIMS 的 F4/F4b),再设就是同罪两罚。
 * 应急出口(须带原因,裸标记不放行):`DUP_RATCHET_ALLOW_TWIN_GROWTH=<原因>` —— 并发并集
 * 已声明的量纲放大走这里,出口打印原因留痕,不静默。
 *
 * 判据失明防护(T3 同型元判据):清偿后当前面登记行注记数必须为 0;若清偿成果被别的
 * 路径绕过本门带回(比如直接写工作树后绕钩子提交),本门**全量模式**(非差值)会点名
 * 并要求跑 `node scripts/plan-pointer-purge.mjs --apply` 重新清偿。
 *
 * 维③(2026-10-20 立)「同一行叠同一注记」重数棘轮:
 * 立因是现读到的单行 `〔同题原号 G-191〕` 被并发回灌叠 62 份、全仓 34 行 227 份 —— 维①是布尔
 * (这行有没有注记)、维②算整行副本折并,两维都看不见"同一行同一注记叠了几份"。
 * 读数 = Σ(登记行内每种注记的出现次数 − 1);`--staged` 面 vs HEAD 面**只拦变多**,
 * 全量档默认只报数、`--strict` 才问责存量(存量正被并发写带回时当场判红 = §12e 恒红门)。
 * 识别集是本维自带的 `〔…〕`(长度 8–24,另加 2026-10-22 票面修法①点名的 `〔同题原号 …〕` 与
 * `〔改号(…):原…〕` 两字族不限长),**刻意不并入 `DUP_POINTER_RE`**:那个字面一旦扩到
 * 通用括注族,维①与 T3 会把台账里合法的改号留痕(`〔改号(…):原…〕` 一族)整体算成存量判红。
 * 取证:`--self-test` 成对反证(叠两份即红 / 只有一份不红)+ 镜像测试 P9(单份⇒0 为阳性对照、
 * 三份⇒2、非登记行不计数、变多判红、折并归零判绿,外加一条形状锁断言 `DUP_POINTER_RE` 未被
 * 扩大)与 P11(两字族超窗形态:叠两份⇒计 1、单份⇒0)。
 *
 * 维④(2026-10-20 立)「严格前缀型副本对」差值棘轮:
 * 两条未勾登记行,短行**逐字**是长行的前缀 ⇒ 短行不承载独有内容,它只是同一件事被抄了一份
 * (长行随后被加注记、短行停在旧态)。这一型三把现有尺子全放过:门 203 的复合主键要编号
 * (这类行常写「未取号:同上」)、`--fold-identical-open-rows` 只认整行逐字相同、维①②管注记与整行折并。
 * 现读:加下限前 26 对、加下限后 **0 对** ⇒ 台账里其实没有真副本(今早折掉的那 2 对才是)。
 * 默认档**只报数**,`--strict` 才问责(按存量当场判红就是 §12e 禁的恒红门);
 * `--staged` 面 vs HEAD 面只拦变多。
 * 为什么做成尺子而不是手工扫一遍:活文档走 git-sync-converge 的行级 union,而 **union 不传播删除**
 * —— 同日实测到本会话折掉的行被对侧旧底稿原样换回。手工清是消耗品,判据不是。
 * 落地当场抓到的误咬(所以有 MIN_TWIN_SUBJECT):裸认领标记行 `- [ ]（进行中）`(长度 10)是所有
 * `- [ ]（进行中）xxx` 的公共前缀 ⇒ 不设"短侧剥掉行首标记与前导括注后须有实质正文"这一手,
 * 一条这样的行就凭空造出 26 个假副本对,把本维读数全污染成"有 26 处要清"。
 * 取证:镜像 P10(两行成对⇒1 阳性对照、逐字相同⇒0、无前缀关系⇒0、链式 A⊂BC⇒3、已勾行不计、
 * 裸认领标记配多条同前缀行⇒0 的**误咬反证** + 剥括注后正文够长仍读得出 1 的**阳性对照**、
 * 变多判红、折并判绿)。
 *
 * 用法:
 *   node scripts/check-plan-dup-pointer-ratchet.mjs --staged  (pre-commit, 阻塞)
 *   node scripts/check-plan-dup-pointer-ratchet.mjs           (全量审计,exit 0/1)
 *   node scripts/check-plan-dup-pointer-ratchet.mjs --audit-pointers [--json]  (只读报数,exit 0)
 *   node scripts/check-plan-dup-pointer-ratchet.mjs --self-test [--json]       (维③成对反证夹具,exit 0/1)
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { catBatch, selectFace } from './lib/face-reader.mjs'
// 维②判据单一实现。环形引用说明:plan-tasks-merge → 本门(取 countPointerRows)→ 本门 →
// plan-tasks-merge(取 foldTwins),两侧都只在**函数体内**用对方导出 ⇒ ESM 循环安全。
import { foldTwins } from './plan-tasks-merge.mjs'

const require = createRequire(import.meta.url)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = 'PROJECT_PLAN.md'
const idx = require(path.join(ROOT, 'scripts/lib/plan-task-index.mjs'))

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

const isRow = (l) => /^\s*(?:[-*]\s*)?\[[ xX]\]/.test(l) && !/^\s*<!--/.test(l)
/** 该行是否命中任一指针注记判据(实现来自 plan-task-index 单一实现)。 */
export const hitsNote = (l) => idx.DUP_POINTER_RE.test(l) || idx.SELF_DEDISPATCH_RE.test(l)
/** 一段文本里命中注记的登记行数。 */
export const countPointerRows = (text) =>
  String(text || '')
    .split(/\r?\n/)
    .filter((l) => isRow(l) && hitsNote(l)).length
/** 该段文本里命中注记的登记行(行号从 1 起,带截断原文)。 */
export const pointerRows = (text) =>
  String(text || '')
    .split(/\r?\n/)
    .map((l, i) => ({ line: i + 1, raw: l }))
    .filter((r) => isRow(r.raw) && hitsNote(r.raw))

/** 差值判定(纯函数):本次提交让注记行数增加 ⇒ 红。 */
export function ratchetVerdict(oldText, newText) {
  const before = countPointerRows(oldText)
  const after = countPointerRows(newText)
  return { before, after, delta: after - before, compliant: after <= before }
}

/** 维②读数(纯函数):一面上的 foldTwins 可折行数;判据炸了返回 null(未判定,不冒充 0)。 */
export const twinFoldCount = (text) => {
  try {
    return foldTwins(String(text || '').split(/\r?\n/)).edits.length
  } catch {
    return null
  }
}

/** 维②差值判定(纯函数):本次提交让"同题不同编号"可折重复登记变多 ⇒ 红。 */
export function twinRatchetVerdict(headText, newText) {
  const before = twinFoldCount(headText)
  const after = twinFoldCount(newText)
  if (before === null || after === null) return { before, after, grew: false, undetermined: true }
  return { before, after, grew: after > before, undetermined: false }
}

/**
 * 维③(2026-10-20 立)「同一行叠同一注记」重数棘轮。
 *
 * 立因是现读到的:一行里 `〔同题原号 G-191〕` 被并发回灌叠了 62 份,全仓 34 行共 227 份重复。
 * 前两维都看不见它 —— 维①是**布尔**(这行有没有注记),维②算的是**整行副本**。
 *
 * 识别集刻意**不并入** `idx.DUP_POINTER_RE`:那个字面一旦扩到通用括注族,维①与 T3 元判据
 * 会把台账里大量合法的改号留痕(`〔改号(2026-10-14):原G-815424〕` 等)一起算成存量,
 * 全量档当场判红 —— 而那红与任何人的本次动作无关,正是 §12e 禁的恒红门。
 * 所以本维自带识别集,只管"同一行内逐字相同的注记多出来的份数"。
 *
 * 2026-10-22 票面修法①补字族:通用窗(内文 8–24 字)对票面点名的两族有实测漏网 ——
 * 7 位原号的 `〔改号(2026-10-22):原G-1058619〕` 内文 25 字超上界、省略号形 `〔同题原号 …〕`
 * 内文 6 字低于下界(HEAD 面现读:超窗 token 28 个 / 15 行,族内叠重窗漏 12 份)。
 * 两族按票面以**不限长子模式**并入本维自带识别集;这不造恒红 —— 本维只数"逐字相同的注记
 * 多出来的份数",合法单份留痕读数恒为 0,维①与 T3 的 `DUP_POINTER_RE` 一字未动(形状锁在镜像 P9)。
 */
const NOTE_TOKEN_SRC = '〔(?:[^〔〕]{8,24}|同题原号[^〔〕]*|改号\\([^〔〕]*\\):原[^〔〕]*)〕'

/**
 * 逐字承载段的起始标记(2026-10-25 立):`〔副本正文并入·承载整段:…〕` 是折并时把旧行
 * **正文整段逐字**搬进来的载体,里面必然带着旧行的同一条注记 —— 它与本行的活注记构成
 * "同 token 两份",但那是折并的**设计形态**,不是并发回灌的叠注。旧读数因此常年非零
 * (实测 70 份里 49 份在承载段内、仅 21 份落在活文本),而清它就得改写逐字引文,等于毁掉承载凭据。
 * 判据只数**活文本**:先把承载段按括号平衡摘掉,再数其中的注记。
 */
const CARRY_SEGMENT_START = '〔副本正文并入·承载整段:'

/** 摘除 `〔副本正文并入·承载整段:…〕` 平衡段(纯函数;承载段内嵌同形括号,故按深度配平)。 */
export function stripCarrySegments(line) {
  const text = String(line || '')
  let out = ''
  let i = 0
  while (i < text.length) {
    const at = text.indexOf(CARRY_SEGMENT_START, i)
    if (at < 0) {
      out += text.slice(i)
      break
    }
    out += text.slice(i, at)
    let j = at + 1
    let depth = 1
    while (j < text.length && depth > 0) {
      const ch = text[j]
      if (ch === '〔') depth++
      else if (ch === '〕') depth--
      j++
    }
    i = j
  }
  return out
}

/** 一行内每种注记多出来的份数之和(0 = 该行无重复叠注;承载段不计)。 */
export function redundantNoteCountInLine(line) {
  const seen = new Map()
  const live = stripCarrySegments(line)
  for (const m of live.matchAll(new RegExp(NOTE_TOKEN_SRC, 'g')))
    seen.set(m[0], (seen.get(m[0]) ?? 0) + 1)
  let total = 0
  for (const n of seen.values()) if (n > 1) total += n - 1
  return total
}

/** 维③读数(纯函数):一面上所有登记行的重复叠注份数合计。 */
export function redundantNoteCount(text) {
  let total = 0
  for (const l of String(text || '').split(/\r?\n/)) {
    if (!isRow(l)) continue
    total += redundantNoteCountInLine(l)
  }
  return total
}

/** 维③差值判定(纯函数):本次提交让叠注份数变多 ⇒ 红。 */
export function noteRedundancyVerdict(headText, newText) {
  const before = redundantNoteCount(headText)
  const after = redundantNoteCount(newText)
  return { before, after, grew: after > before }
}

/**
 * 维④(2026-10-20 立)「严格前缀型副本对」读数。
 *
 * 型态:两条**未勾登记行**,短行逐字是长行的前缀 ⇒ 短行不承载任何独有内容,它只是同一件事
 * 被抄了一份(长行随后被加了注记,短行停在旧态)。这一型三把现有尺子全放过:
 * 门 203 的复合主键要编号(这类行常写「未取号:同上」)、`--fold-identical-open-rows`
 * 只认**整行逐字相同**、维①②管的是注记与整行折并。
 *
 * 为什么做成尺子而不是手工扫一遍:本仓的活文档走 `git-sync-converge` 的行级 union,
 * 而 union **不传播删除** —— 实测今天折掉的行有被对侧旧底稿原样换回的(见 92b5d876aa 之后
 * 的三轮 merge 复测)。手工清是消耗品,判据不是。
 *
 * 算法:按字典序排序后,"以 A 为前缀的串"必成连续区间 ⇒ 对每个 A 从其后扫到不再 startsWith 为止。
 * 刻意只数**对数**(不递归去重):链式(A⊂BC)报 3 对,让人一眼看见有几处要判。
 */
/**
 * 短侧"承载事项"的下限(字符)。取 24 的理由:低于这个长度的一行不可能是可派单事项,
 * 而台账里合法的裸形态(`- [ ]（进行中）`、`- [ ]（未取号:同上）`)剥完括注后长度是 0——
 * 它们是所有同前缀行的公共前缀,不设下限就会被读成几十个假副本对。
 */
const MIN_TWIN_SUBJECT = 24

export function prefixTwinPairs(text) {
  const open = []
  for (const l of String(text || '').split(/\r?\n/)) {
    const t = l.replace(/\r$/, '')
    if (/^- \[ \]/.test(t)) open.push(t)
  }
  const sorted = open.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  let pairs = 0
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]
    // 短侧必须自己承载事项:裸认领标记行(如 `- [ ]（进行中）`)剥完括注后正文为空,
    // 而它是所有 `- [ ]（进行中）xxx` 行的公共前缀 —— 不拦这一手,一条这样的行就能
    // 凭空造出几十个"副本对"(实测 HEAD 面一条长度 10 的行配到 26 条,把本维读数全部污染)。
    if (twinSubjectLen(a) < MIN_TWIN_SUBJECT) continue
    for (let j = i + 1; j < sorted.length && sorted[j].startsWith(a); j++) {
      // 只数**严格**前缀:整行逐字相同那一型有它自己的合法摘除通道
      // (`plan-tasks-merge --fold-identical-open-rows`),两处都计会让两个出口互相顶账。
      if (sorted[j].length > a.length) pairs++
    }
  }
  return pairs
}

/** 剥掉行首勾选标记与**前导**括注族(认领/未取号/不挂进行中等),剩下才是这一行承载的事项正文。 */
export function twinSubjectLen(line) {
  let s = String(line || '').replace(/^- \[ \]\s*/, '')
  let m = true
  while (m) {
    m = false
    for (const re of [/^（[^（）]*）/, /^\([^()]*\)/, /^〔[^〔〕]*〕/]) {
      if (re.test(s)) {
        s = s.replace(re, '')
        m = true
      }
    }
  }
  return s.trim().length
}

/** 维④差值判定(纯函数):本次提交让前缀型副本对变多 ⇒ 红。 */
export function prefixTwinVerdict(headText, newText) {
  const before = prefixTwinPairs(headText)
  const after = prefixTwinPairs(newText)
  return { before, after, grew: after > before }
}

/**
 * 维③ `--self-test` 成对反证(2026-10-22 票面取证要求:叠两份即红 / 只有一份不红)。
 * 与主判定共用 redundantNoteCount / noteRedundancyVerdict,不在夹具里复写判据。
 */
export function selfTestRun(asJson) {
  const row = (notes) => `- [ ] G-9 做点啥 ${notes}\n`
  const cases = [
    { name: '单份同题原号 ⇒ 不红(阳性对照)', text: row('〔同题原号 G-191〕'), want: 0 },
    { name: '同一行叠两份同题原号 ⇒ 计 1(叠两份即红)', text: row('〔同题原号 G-191〕〔同题原号 G-191〕'), want: 1 },
    { name: '单份改号 7 位原号(25 字超窗形态) ⇒ 不红', text: row('〔改号(2026-10-22):原G-1058619〕'), want: 0 },
    { name: '同一行叠两份改号 7 位原号 ⇒ 计 1(字族补入后超窗形态可识别)', text: row('〔改号(2026-10-22):原G-1058619〕〔改号(2026-10-22):原G-1058619〕'), want: 1 },
    { name: '同一行叠两份省略号形同题原号(6 字低于窗形) ⇒ 计 1', text: row('〔同题原号 …〕〔同题原号 …〕'), want: 1 },
    { name: '非登记行(散文)叠两份 ⇒ 不计', text: '随便一句正文 〔同题原号 G-191〕〔同题原号 G-191〕\n', want: 0 },
    {
      name: '承载段〔副本正文并入·承载整段:…〕内的同 token ⇒ 不计(逐字引文非活注记)',
      text: row('〔同题原号 G-191〕〔副本正文并入·承载整段:旧正文〔同题原号 G-191〕〕'),
      want: 0,
    },
    {
      name: '承载段外的真叠注仍计(承载段豁免不吞活文本)',
      text: row('〔同题原号 G-191〕〔同题原号 G-191〕〔副本正文并入·承载整段:旧正文〕'),
      want: 1,
    },
  ]
  let fail = 0
  for (const c of cases) {
    const got = redundantNoteCount(c.text)
    const ok = got === c.want
    if (!ok) fail++
    if (!asJson) console.log(`${ok ? '✅' : '❌'} ${c.name}:期望 ${c.want},实测 ${got}`)
  }
  const one = row('〔同题原号 G-191〕')
  const two = row('〔同题原号 G-191〕〔同题原号 G-191〕')
  const grew = noteRedundancyVerdict(one, two)
  const okGrew = grew.grew && grew.before === 0 && grew.after === 1
  if (!okGrew) fail++
  if (!asJson) console.log(`${okGrew ? '✅' : '❌'} 差值方向:单份面⇒叠两份面 grew=true(0→1)`)
  const shrank = noteRedundancyVerdict(two, one)
  const okShrank = !shrank.grew && shrank.after === 0
  if (!okShrank) fail++
  if (!asJson) console.log(`${okShrank ? '✅' : '❌'} 差值方向:折并回单份 grew=false(判绿)`)
  const total = cases.length + 2
  if (!asJson) console.log(`${fail ? '❌' : '✅'} 维③自检:pass ${total - fail} / fail ${fail}`)
  else console.log(JSON.stringify({ pass: total - fail, fail }))
  return fail ? 1 : 0
}

/**
 * 为什么这道门在"清偿后"全量面上判红是安全的(不是恒红门):
 * 存量已由 purge 脚本清零 ⇒ 正常流程下当前面注记数恒为 0,任何把注记写回来的提交
 * 都是"本次引入",在差值面被抓;全量面只在有人绕过钩子(直接写工作树 + `--no-verify`
 * 提交)时才红 —— 那正是这道门要拦的最后通道,不是与提交内容无关的状态。
 */
function main(argv) {
  const jsonOut = argv.includes('--json')
  const auditOnly = argv.includes('--audit-pointers')
  const staged = argv.includes('--staged')

  const specNew = staged ? `:${FILE}` : null
  let newContent = null
  if (staged) {
    try {
      const got = catBatch(ROOT, [specNew], { timeout: 60000 })
      newContent = got.get(specNew) ?? null
    } catch {
      newContent = null
    }
  } else {
    // 全量/audit:读 **HEAD blob**(真相面)。**不能读工作树** —— 本仓的批量清偿走对象空间落地
    // (commit-tree + CAS,从不写工作树),工作树副本从此滞后于 HEAD 且含其他会话在飞的编辑;
    // 按工作树判会让整个滞后窗口恒红,而那红与任何人本次动作无关 —— 正是 §12e 禁的恒红门。
    // 真相面判:清偿落地后 HEAD 注记恒为 0,任何把它带回来的动作都在差值面被抓。
    try {
      const got = catBatch(ROOT, ['HEAD:' + FILE], { timeout: 60000 })
      newContent = got.get('HEAD:' + FILE) ?? null
    } catch {
      newContent = null
    }
  }
  if (newContent === null) {
    console.error(`${C.yellow}⏭  PROJECT_PLAN.md 本版取不到,无法判定${C.reset}`)
    return 2
  }

  if (auditOnly) {
    const rows = pointerRows(newContent)
    if (jsonOut) {
      console.log(
        JSON.stringify({
          face: staged ? 'staged' : 'HEAD',
          pointerRows: rows.length,
          samples: rows.slice(0, 20).map((r) => ({ line: r.line, sample: r.raw.slice(0, 120) })),
        }),
      )
    } else {
      console.log(`${C.cyan}📊 登记行指针注记存量:${rows.length} 行${C.reset}`)
      for (const r of rows.slice(0, 30)) console.log(`  L${r.line} ${r.raw.slice(0, 120)}`)
    }
    return 0 // 只读报数,永不判红
  }

  let oldContent = ''
  if (staged) {
    try {
      const got = catBatch(ROOT, ['HEAD:' + FILE], { timeout: 60000 })
      oldContent = got.get('HEAD:' + FILE) ?? ''
    } catch {
      oldContent = ''
    }
  } else {
    // 全量:与当前面自己比(delta 恒 0),但存量必须为 0(清偿成果守住)
    oldContent = ''
  }

  const v = ratchetVerdict(oldContent, newContent)
  const residue = countPointerRows(newContent)

  if (!v.compliant) {
    console.error(
      `${C.red}❌ 重复登记副本指针棘轮:${C.reset}本次提交让登记行上的指针注记从 ${v.before} 增至 ${v.after}(+${v.delta})`,
    )
    const bad = pointerRows(newContent).slice(0, 10)
    for (const r of bad) console.error(`  ${C.red}· L${r.line} ${r.raw.slice(0, 100)}${C.reset}`)
    console.error(
      `${C.yellow}出路:${C.reset} ① 删掉这些注记,重复副本改由持有行承载(AGENTS §1 规矩:一个编号一行,新登记同主键时翻勾旧行,不得抄第二份);\n` +
        `       ② 若是工具自动生成(归并器 F4),跑 \`node scripts/plan-pointer-purge.mjs --apply\` 一次性清偿并留台账。`,
    )
    return 1
  }

  // 维③:同一行叠同一注记(2026-10-20 立)。差值档只拦新增;全量档默认只报数,--strict 才问责存量
  // —— 存量此刻可能正被并发写带回,当场判红就是与本次内容无关的恒红门(§12e)。
  const strict = argv.includes('--strict')
  const nr = staged
    ? noteRedundancyVerdict(oldContent, newContent)
    : { before: 0, after: redundantNoteCount(newContent), grew: false }
  if (staged && nr.grew) {
    console.error(
      `${C.red}❌ 叠注重数棘轮:${C.reset}本次提交让"同一登记行内逐字相同的注记"从 ${nr.before} 份增至 ${nr.after} 份(+${nr.after - nr.before})`,
    )
    console.error(
      `${C.yellow}出路:${C.reset} 同一行里同一种留痕只留一份:手工折即删重复副本、保留首次出现;整批被带回时走 \`node scripts/plan-pointer-purge.mjs --apply\`。`,
    )
    return 1
  }
  if (!staged) {
    if (nr.after > 0 && strict) {
      console.error(
        `${C.red}❌ 叠注存量:${C.reset}当前面登记行上有 ${nr.after} 份逐字相同的重复注记(--strict 问责)`,
      )
      return 1
    }
    console.log(
      `${C.cyan}📊 叠注重数:${nr.after} 份(同一行内逐字相同的注记多出来的份数;全量档默认只报数,--strict 才问责)${C.reset}`,
    )
  }

  // 维④:严格前缀型副本对(2026-10-20 立)。存量现读 34 对 ⇒ 默认档**只报数**,
  // 当场按存量判红就是 §12e 禁的恒红门;差值档只拦"本次提交让副本对变多"。
  const pt = staged
    ? prefixTwinVerdict(oldContent, newContent)
    : { before: 0, after: prefixTwinPairs(newContent), grew: false }
  if (staged && pt.grew) {
    console.error(
      `${C.red}❌ 前缀型副本棘轮:${C.reset}本次提交让"短行逐字是长行前缀"的未勾登记行从 ${pt.before} 对增至 ${pt.after} 对(+${pt.after - pt.before})`,
    )
    console.error(
      `${C.yellow}出路:${C.reset} 同一件事只留一行 —— 旧行按 §1 翻勾后摘除(完成即删两步:先翻勾入库,再删已勾行;未勾行受守门 71 保护,不可一步删净)。整行逐字相同的那种走 \`node scripts/plan-tasks-merge.mjs --fold-identical-open-rows\`。`,
    )
    return 1
  }
  if (!staged) {
    if (pt.after > 0 && strict) {
      console.error(
        `${C.red}❌ 前缀型副本存量:${C.reset}当前面未勾登记行上有 ${pt.after} 对"短行逐字是长行前缀"的重复登记(--strict 问责)`,
      )
      return 1
    }
    console.log(
      `${C.cyan}📊 前缀型副本对:${pt.after} 对(短行逐字是长行前缀的未勾登记行;全量档默认只报数,--strict 才问责)${C.reset}`,
    )
  }

  if (staged) {
    console.log(
      `${C.green}✅ 指针棘轮:${C.reset}本次提交未新增指针注记(${v.before} → ${v.after};当前面存量 ${residue} 行只报数)`,
    )
    // ── 维② F10「同题不同编号」差值棘轮(2026-10-14)──
    const tv = twinRatchetVerdict(oldContent, newContent)
    if (tv.undetermined) {
      console.log(
        `${C.yellow}⏭ F10 差值未判定(foldTwins 判据异常)${C.reset} —— 不冒充通过也不冒红,点名即走`,
      )
    } else if (tv.grew) {
      const allow = process.env.DUP_RATCHET_ALLOW_TWIN_GROWTH
      if (allow && allow.trim()) {
        console.log(
          `${C.yellow}⚠️ F10 差值棘轮经应急出口放行(带原因留痕,不静默):${C.reset}${allow.trim()}(${tv.before} → ${tv.after})`,
        )
      } else {
        console.error(
          `${C.red}❌ F10 同题不同编号差值棘轮:${C.reset}本次提交让可折的"同题不同编号"重复登记从 ${tv.before} 增至 ${tv.after}(+${tv.after - tv.before})`,
        )
        console.error(
          `${C.yellow}出路:${C.reset} ① 同一件事只登记一行(同题不同号也算重复;新登记前先按题面搜一遍);\n` +
            `       ② 存量收口跑 \`node scripts/plan-pointer-purge.mjs\`(dry-run 看分层处置,--apply 走对象空间落地);\n` +
            `       ③ 确属并发并集已声明的量纲放大 ⇒ 带原因重试:DUP_RATCHET_ALLOW_TWIN_GROWTH=<原因>(裸标记不放行)`,
        )
        return 1
      }
    } else {
      console.log(
        `${C.green}✅ F10 差值:${C.reset}同题不同编号可折重复登记 ${tv.before} → ${tv.after}(不增;F4/F4b 维归守门 130,不在此重复设门)`,
      )
    }
  } else {
    // 全量模式:存量必须为 0(清偿成果守住);不为 0 红 —— 它必然是绕过钩子或写盘路径带回的
    if (residue > 0) {
      console.error(
        `${C.red}❌ 指针存量:${C.reset}登记行上的指针注记存量为 ${residue} 行(清偿成果被带回,应为 0)`,
      )
      const bad = pointerRows(newContent).slice(0, 10)
      for (const r of bad) console.error(`  ${C.red}· L${r.line} ${r.raw.slice(0, 100)}${C.reset}`)
      console.error(
        `${C.yellow}出路:${C.reset}跑 \`node scripts/plan-pointer-purge.mjs --apply\` 重新清偿(台账会自动记录)。`,
      )
      return 1
    }
    console.log(`${C.green}✅ 指针棘轮:${C.reset}当前面登记行指针注记 0 行(清偿成果守住)`)
    // 全量档对维②只报数(差值档在 --staged;存量 3 行是 purge 逐行点名豁免的真独有内容行,
    // 当场判红就是与任何提交无关的恒红门,§12e)
    const twinFull = twinFoldCount(newContent)
    if (twinFull !== null)
      console.log(
        `${C.cyan}📊 F10 同题不同编号可折重复登记存量:${twinFull} 行(只报数;收口跑 plan-pointer-purge --apply)${C.reset}`,
      )
  }
  return 0
}

const isDirectRun =
  process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href
if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    process.exitCode = selfTestRun(argv.includes('--json'))
  } else {
    const { error } = selectFace({ staged: argv.includes('--staged'), def: 'worktree' })
    if (error && !argv.includes('--audit-pointers')) {
      console.error(`❌ 无法判定: ${error}`)
      process.exitCode = 2
    } else {
      process.exitCode = main(argv)
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
