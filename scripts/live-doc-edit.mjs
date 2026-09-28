// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 活文档编辑器(锚点插入 / EOF 追加,对象空间落地;常驻工具,不在提交链。2026-09-27 立,工程工具收口票)。
 *
 * 为什么在仓里:本会话手写了两份同形器(insert-live-doc.mjs / append-eof.mjs)且都躺在
 * .ihui-agent/tmp/ 不受版本控制。它们防的那一型是本仓 §12 记过一夜三次的事故:活文档
 * (PROJECT_PLAN / AGENTS / README)的工作树副本常年滞后 HEAD,按 pathspec 交工作树 = 把别人
 * 已入库的行整批写回旧态。所以底稿每次尝试都从**当下 HEAD** 现取,判据是**结构等值**
 * (new == HEAD 的前缀 ⊕ 本块 ⊕ 后缀),禁止用"重复行计数"那种启发式 —— 台账里本来就有大量
 * 逐字相同的短行(`- [ ]` 条目、`  },`、空行),启发式会把合法复用误判成"凭空多出"(wire-gate 就死在这上面,
 * 整块一次没落地成功过)。锚点命中数必须**恰好 1**:0 处 = 锚点文案已漂或本块已在位,>1 处 = 有歧义,
 * 两种都拒绝凭猜插。
 *
 * CLI 契约(env 驱动):
 *  LIVE_DOC          必填,仓库相对路径(须在 HEAD 里存在)
 *  LIVE_BLOCK_FILE   插入模式必填,正文块内容文件的绝对路径
 *  LIVE_ANCHOR_FILE  可选,锚点行(可多行)所在文件的绝对路径;缺省 = EOF 追加(对齐 append-eof 的行为)
 *  LIVE_REPLACE_FILE 改写模式(与上面三者互斥):JSON 数组 `[{before, after}]`,每项是一条**整行**
 *                    逐字替换。为什么需要这一档:台账结清的动作是"把某一行从 `- [ ]` 改成
 *                    `- [x] ✅(日期) …`并补证据",插入模式做不到,而按 pathspec 交工作树等于
 *                    把别人已入库的行整批写回旧态(§12 一夜三次自伤)。判据与插入档同源:
 *                    `before` 在 HEAD 版必须**恰好命中 1 次**(0 = 文案已漂,>1 = 有歧义,都不猜),
 *                    除非该项显式带 `all: true` —— 那表示"这份文本在台账里有 N 个逐字相同的孪生副本,
 *                    每一条都要施加同一个改写"(2026-09-28 立:摘过期认领牌/翻勾归并注记对 16/27 行会因
 *                    同文副本被拒,而半新半旧比不改更糟)。`all` 只放宽"命中 N 次",**0 次仍拒**;
 *                    任一 `before` 等于另一项的 `after` 一律拒(顺序替换会把自己刚改出的行再改一遍);
 *                    命中数在成功行里逐条打印,不留静默。
 *                    且替换后"除这些行以外逐行等值、总行数不变" ⇒ 才准落盘。
 *  LIVE_MSG          必填,提交信息
 *  LIVE_ROOT         测试/换仓通道:仓库根(缺省 = 本脚本所在仓根)
 *  取号令牌(两种模式都可用,只在正文里出现):`{{NEXT_ID:G}}` 会在**每次 CAS 尝试**里由当下
 *  HEAD 底稿**按出现顺序逐个递增**地现算成 `G-<下一个空闲号>`(max+1、max+2…;判据住在
 *  lib/plan-task-index.mjs 的 usedIdsOfPrefix,本器不另写一份"什么算一个编号",行首裸编号不占号段
 *  那条口径也不重抄)。为什么必须在这里算而不是由人先查:2026-09-27 一天内撞了**两次**同号,
 *  "提交前查一次占用"挡不住别人事后取同一个号(与守门编号撞号同族)。为什么必须**递增**而不是
 *  每个令牌都算 max+1:一次登记两件事是常态,那样本器自己就会产出它要防的那一型。
 *  该族一条登记行都没有 ⇒ exit 2 拒绝落地,绝不给 "<族>-1"。
 *
 *  号段基准(G-313 出路②,2026-09-28 加):基准 = **max(本地 HEAD 底稿该族 max, 远端那一份该族
 *  max)**。只问 `git ls-remote` + 本机对象库;远端 tip 的对象**本地没有就不 fetch、不写任何 ref**,
 *  如实打印"号段基准未含远端(对象不在本地,原因:…)"后按本地基准落盘。远端**只抬高、不压低**,
 *  所以远端与本地同 max(或远端问不到)时取号与改动前逐字同形。降级一律喊出来,不得静默。
 * 退出码:0 = 已落地且回读证明本块每一条非空行都在 HEAD 里(索引对齐未尽只点名不判红);
 *        1 = 业务拒绝(锚点命中 0 或 >1 / 结构等值不成立 / 文档不在 HEAD / CAS 12 次未抢到 / 回读缺行 / 索引锁龄超上限);
 *        2 = 用法或环境错(缺必填 env / 锚点或正文块为空 / 根不可当仓库问)。
 *
 * ⚠️ 头注不写"已接 pre-commit/CI"字样(守门 89 R1/R2 判"声称已接线而零命中")。
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  ABSENT,
  alignSharedIndex,
  casUpdateRef,
  commitTreeWithIndex,
  git,
  headBlobOf,
  resolveHeadRef,
  sameLines,
  writeBlob,
} from './lib/bypass-git.mjs'
import { usedIdsOfPrefix } from './lib/plan-task-index.mjs'

/**
 * 令牌 `{{NEXT_ID:G}}` ⇒ 落成 `G-<下一个空闲号>`。
 *
 * 为什么住在落盘那一刻而不是由人来查:2026-09-27 一天内撞了**两次**同号 ——
 * 一次是我与另一路各登记了一个 `G-262`,另一次是我刚将 `G-266` 落库,同一时刻别人也在按
 * "我查到的空闲号"登记。"提交前查一次占用"在高并发仓里构不成证据(守门 93/103 的编号事故同一课),
 * 唯一可靠的是**把取号放进 CAS 循环里**:每次尝试都从当下 HEAD 重算,撞了就重取底稿再来。
 * 该族一条登记行都没有 ⇒ 判不出(返回 error),不给 "<族>-1" —— 空扫与"真没用过"同形(见 lib 同条注释)。
 */
const ID_TOKEN_RE = /\{\{NEXT_ID:([A-Za-z]+)\}\}/g

/**
 * 号段基准的两条来源:本地 HEAD 底稿 + **远端那一份底稿**(G-313 出路②,2026-09-28 立)。
 *
 * 为什么"每次重试重取本地 HEAD"仍不够(G-313 票面,主会话亲历):本会话两行确实由令牌在 23:50Z
 * 那次 CAS 里按当次 HEAD 现算成 `G-302`/`G-303`(当时该族 max=301),撞号来自**另一侧** —— 那批
 * 作者时刻更早、正文里**手填** `G-300..G-309`,却在本会话之后才并入 HEAD ⇒ 同一号段被两批各自认领。
 * "并发批次带着旧底稿并入"这一型里,本地 HEAD 与远端可以各差一批(本仓 `origin` 常年被后台 worker
 * 推进),只看本地那一份结构上看不见对面那批号。
 *
 * 三条不许漂的写法:
 *  ① 远端 tip 只经 `git ls-remote <remote> <ref>` 问(远端真值唯一来源);判据仍只有一份 ——
 *     远端那份底稿的该族 max 也走 `usedIdsOfPrefix`,不另写"什么算一个号"。
 *  ② 该 tip 的对象**本地没有 ⇒ 不 fetch、不写任何 ref**,直接降级到本地基准并**点名原因**。
 *     AGENTS §5b 实测:本仓嵌套 remote-tracking ref(`refs/remotes/**`)会被宿主清理层删掉,而
 *     `git update-ref` 对嵌套 ref **返回 0 却不落盘** —— 为一个号段基准去动 refs 是拿仓库存续性换便利。
 *  ③ 任何一步问不到都**只降级、不失败**(取号必须仍然落得了地),但降级必须喊出来:把"没判"写成
 *     "判过了"是本仓最高频失效型,静默降级就等于伪装成"已与远端对齐"。
 *  远端只用来**抬高**基准,永不用来压低 ⇒ 远端与本地同 max 时取号与改动前逐字同形(镜像 N2/N3 钉住)。
 */
const LS_REMOTE_TIMEOUT_MS = 20_000
const REMOTE_READ_TIMEOUT_MS = 30_000

/** 远端与 ref 可换(`LIVE_ID_REMOTE` / `LIVE_ID_REMOTE_REF`),缺省 origin/main —— 现读,不在模块期烘死。 */
function remoteTarget() {
  return {
    remote: process.env.LIVE_ID_REMOTE || 'origin',
    ref: process.env.LIVE_ID_REMOTE_REF || 'refs/heads/main',
  }
}

const oneLine = (e) =>
  String(e?.message ?? e)
    .split(/\r?\n/)[0]
    .slice(0, 200)

/**
 * 远端读取的传输面(唯一一处派生)。三个 git 调用各自带数字 `timeout`(本仓实测过无超时挂 80 分钟),
 * `windowsHide` 与绝对路径 git 候选由 `lib/bypass-git.mjs` 的 `git()` 负责 —— 它复用的解析链与
 * `lib/face-reader.mjs` 的 `gitBinary` 同出一份(`lib/gitdir.mjs` 的 `resolveGitBin`),**不再抄第三份候选表**。
 */
export const REMOTE_ID_TRANSPORT = {
  tipSha({ root, remote = remoteTarget().remote, ref = remoteTarget().ref } = {}) {
    const out = git(['ls-remote', remote, ref], { root, timeout: LS_REMOTE_TIMEOUT_MS })
    const sha = String(out ?? '')
      .trim()
      .split(/\s+/)[0]
    if (!sha) return { ok: false, reason: `${remote} 上没有 ${ref}` }
    return { ok: true, sha, remote, ref }
  },
  /** 该 commit 对象本机是否已有;没有就抛(**绝不为取号去 fetch、绝不写任何 ref**)。 */
  hasCommit({ root, sha }) {
    git(['cat-file', '-e', `${sha}^{commit}`], { root, timeout: REMOTE_READ_TIMEOUT_MS })
    return true
  },
  docContent({ root, sha, doc }) {
    return git(['show', `${sha}:${doc}`], { root, raw: true, timeout: REMOTE_READ_TIMEOUT_MS })
  },
}

/**
 * 现读远端那一份底稿的号段基准。返回 `{ max:{族:远端该族 max}, notes:[降级原因], tipSha, remote, ref }`。
 * 每条 notes 都对应"远端这一维没判到",调用方必须逐条打印 —— 只印 max 不印 notes,就是把"没判"
 * 写成"判过了"的那一型。测试经 `transport` 注入构造值,不真发网络(生产缺省走真 ls-remote)。
 */
export function readRemoteIdBasis({ root, doc, families, transport = REMOTE_ID_TRANSPORT } = {}) {
  const { remote, ref } = remoteTarget()
  const out = { max: {}, notes: [], tipSha: '', remote, ref }
  if (!Array.isArray(families) || families.length === 0) return out
  let tip
  try {
    tip = transport.tipSha({ root, remote, ref })
  } catch (e) {
    out.notes.push(`远端不可问(${remote} ${ref}),原因:${oneLine(e)}`)
    return out
  }
  if (!tip || tip.ok !== true || !tip.sha) {
    out.notes.push(`远端不可问(${remote} ${ref}),原因:${tip?.reason ?? 'tipSha 没给出结论'}`)
    return out
  }
  out.tipSha = tip.sha
  try {
    transport.hasCommit({ root, sha: tip.sha })
  } catch (e) {
    out.notes.push(`对象不在本地,原因:${oneLine(e)}`)
    return out
  }
  let content
  try {
    content = transport.docContent({ root, sha: tip.sha, doc })
  } catch (e) {
    out.notes.push(`远端 tip ${tip.sha.slice(0, 8)} 里读不到 ${doc},原因:${oneLine(e)}`)
    return out
  }
  if (typeof content !== 'string') {
    out.notes.push(
      `远端 tip ${tip.sha.slice(0, 8)} 里读不到 ${doc},原因:transport 没返回文本(判不出,不算已对齐)`,
    )
    return out
  }
  for (const f of families) {
    const used = usedIdsOfPrefix(content, f)
    if (used === null) {
      out.notes.push(
        `${f} 族在远端那份 ${doc} 里一条登记行都没有 ⇒ 不构成上界(读到了而这一族为空,不是降级)`,
      )
      continue
    }
    out.max[f] = used.max
  }
  return out
}

/** 正文里出现了哪些取号族(按出现顺序去重)—— 族集合由正文推得,不在别处硬写清单。 */
export function idTokenFamilies(lines) {
  const found = []
  for (const l of lines)
    for (const m of String(l).matchAll(ID_TOKEN_RE)) {
      const f = m[1].toUpperCase()
      if (!found.includes(f)) found.push(f)
    }
  return found
}

/**
 * "号段基准"那一行的唯一措辞出口:三条读数(本地 max / 远端 max / 采用的基准)一起给 ——
 * 只印最终值就分不清"远端把这一段顶开了"与"远端压根没参与",而后者必须读成**未与远端对齐**。
 */
export function describeIdBasis(b, remote) {
  const head = `   号段基准:${b.family}=${b.chosenMax}(本地 HEAD 该族 max=${b.localMax}`
  if (b.remoteMax === null) return `${head} / 远端未参与:原因见上一行 ⇒ 未与远端对齐)`
  const rel = b.remoteMax > b.localMax ? '⇒ 取较大,新号跳过远端那段' : '⇒ 与本地同值,与改动前同形'
  return `${head} / 远端 ${remote?.ref ?? '?'} max=${b.remoteMax} ${rel})`
}

/**
 * 第三参 `remote` 缺省 null ⇒ 只看本地底稿,与改动前逐字同形;传入时远端**只能抬高**游标
 * (`max(本地, 远端)`),永不压低 —— 所以镜像 N2 的"同 max"那一条要求行为与旧版完全一致。
 */
export function resolveIdTokens(lines, baseContent, remote = null) {
  const families = idTokenFamilies(lines)
  if (families.length === 0) return { ok: true, lines, assigned: null, basis: [] }
  const cursor = new Map()
  const template = new Map()
  const basis = []
  for (const f of families) {
    const used = usedIdsOfPrefix(baseContent, f)
    if (used === null) return { ok: false, reason: `no-such-family:${f}` }
    const remoteMax = Number.isFinite(remote?.max?.[f]) ? remote.max[f] : null
    const chosenMax = remoteMax !== null && remoteMax > used.max ? remoteMax : used.max
    cursor.set(f, chosenMax)
    template.set(f, used.template)
    // 三条读数一起交出:报告里"号段基准"那一行必须能说清号是从哪一侧算出来的,
    // 只印最终值就分不清"远端把这一段顶开了"与"远端压根没参与"。
    basis.push({ family: f, localMax: used.max, remoteMax, chosenMax })
  }
  const got = []
  // **逐个令牌递增取号**:一条块里登记两件事是常态,若两个令牌都算成 max+1,本器就会自己
  // 造出它要防的那一型(同号不同标题)。按出现顺序发号,且号只在本次调用内递增。
  const out = lines.map((l) =>
    String(l).replace(ID_TOKEN_RE, (_, raw) => {
      const f = raw.toUpperCase()
      const next = cursor.get(f) + 1
      cursor.set(f, next)
      const id = template.get(f).replace('%d', String(next))
      got.push(id)
      return id
    }),
  )
  return { ok: true, lines: out, assigned: [...new Set(got)].join(','), basis }
}

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
const MAX_CAS_ATTEMPTS = 12

const norm = (s) => s.replace(/\r\n/g, '\n')

/** 读 env + 输入文件并判用法;不合法 ⇒ {error}(调用方折 exit 2)。 */
export function readInputs(env = process.env) {
  const doc = env.LIVE_DOC ?? ''
  const blockFile = env.LIVE_BLOCK_FILE ?? ''
  const anchorFile = env.LIVE_ANCHOR_FILE ?? ''
  const replaceFile = env.LIVE_REPLACE_FILE ?? ''
  const msg = env.LIVE_MSG ?? ''
  const root = env.LIVE_ROOT ? resolve(env.LIVE_ROOT) : REPO_ROOT
  if (!doc || !msg) return { error: '缺 LIVE_DOC / LIVE_MSG ⇒ 拒绝执行' }
  if (replaceFile !== '' && (blockFile !== '' || anchorFile !== ''))
    return {
      error:
        '改写档(LIVE_REPLACE_FILE)与插入档(LIVE_BLOCK_FILE / LIVE_ANCHOR_FILE)互斥 ⇒ 一次只做一件事',
    }
  if (replaceFile !== '') {
    let pairs
    try {
      pairs = JSON.parse(readFileSync(replaceFile, 'utf8'))
    } catch (e) {
      return { error: `读不到/解析不了 LIVE_REPLACE_FILE(${replaceFile}):${e?.message ?? e}` }
    }
    if (!Array.isArray(pairs) || pairs.length === 0)
      return { error: 'LIVE_REPLACE_FILE 必须是非空数组 [{before, after}]' }
    for (const [i, p] of pairs.entries()) {
      if (typeof p?.before !== 'string' || typeof p?.after !== 'string')
        return { error: `第 ${i + 1} 项缺 before/after 或不是字符串 ⇒ 拒绝执行` }
      if (p.before.includes('\n') || p.after.includes('\n'))
        return { error: `第 ${i + 1} 项含换行 ⇒ 本档只作**整行**替换(多行请拆成多项)` }
      if (p.before === p.after)
        return { error: `第 ${i + 1} 项 before == after ⇒ 无事可做,剔除后再跑` }
      if ('all' in p && p.all !== true)
        return { error: `第 ${i + 1} 项的 all 只允许写 true(缺省=恰好命中 1 次;放宽成任意真值就等于没有这条锁)` }
    }
    if (!resolveHeadRef({ root }))
      return { error: `${root} 不是可用仓库(HEAD 不可解析或 detached)⇒ 无法判定,不落` }
    return { root, doc, msg, block: null, anchorLines: null, replacements: pairs }
  }
  if (!blockFile) return { error: '缺 LIVE_BLOCK_FILE(或改用 LIVE_REPLACE_FILE 走整行改写档)' }
  let block
  try {
    block = norm(readFileSync(blockFile, 'utf8'))
      .replace(/^\n+/, '')
      .replace(/\n+$/, '')
      .split('\n')
  } catch (e) {
    return { error: `读不到 LIVE_BLOCK_FILE(${blockFile}):${e?.message ?? e}` }
  }
  if (block.length === 0 || block.every((l) => l.trim() === ''))
    return { error: '待插入正文块为空,拒绝执行' }
  let anchorLines = null
  if (anchorFile !== '') {
    let anchor
    try {
      anchor = norm(readFileSync(anchorFile, 'utf8')).replace(/\n+$/, '')
    } catch (e) {
      return { error: `读不到 LIVE_ANCHOR_FILE(${anchorFile}):${e?.message ?? e}` }
    }
    if (anchor === '') return { error: '锚点文件为空 ⇒ EOF 追加请干脆不传 LIVE_ANCHOR_FILE' }
    anchorLines = anchor.split('\n')
  }
  if (!resolveHeadRef({ root }))
    return { error: `${root} 不是可用仓库(HEAD 不可解析或 detached)⇒ 无法判定,不落` }
  return { root, doc, msg, block, anchorLines }
}

/** 锚点命中数与末位命中起点(恰好 1 才可继续;0 / >1 一律交调用方拒绝)。 */
export function locateAnchor(baseLines, anchorLines) {
  let hits = 0
  let idx = -1
  for (let i = 0; i + anchorLines.length <= baseLines.length; i++) {
    if (baseLines[i] === anchorLines[0] && anchorLines.every((l, k) => baseLines[i + k] === l)) {
      hits += 1
      idx = i
    }
  }
  return { hits, idx }
}

/**
 * 组装 + 结构等值自证(唯一的零损失判据,禁止换成重复行计数):
 *  anchor 模式:next == base[0..insertAt) ⊕ block ⊕ base[insertAt..)
 *  eof    模式:next == base(剥尾部空行) ⊕ [''] ⊕ block ⊕ ['']
 * 返回 { ok, next, insertAt, blockLen } —— ok=false 表示组装后前后缀不再逐字相等(内部错位)。
 */
export function assemble(baseLinesIn, block, anchorLines) {
  const baseLines = baseLinesIn.slice()
  if (anchorLines) {
    const { hits, idx } = locateAnchor(baseLines, anchorLines)
    if (hits !== 1)
      return { ok: false, reason: hits === 0 ? 'not-found' : `multi-hit:${hits}`, next: null }
    const insertAt = idx + anchorLines.length
    const next = [...baseLines.slice(0, insertAt), ...block, ...baseLines.slice(insertAt)]
    const tailOk = sameLines(next.slice(insertAt + block.length), baseLines.slice(insertAt))
    const headOk = sameLines(next.slice(0, insertAt), baseLines.slice(0, insertAt))
    return { ok: headOk && tailOk, next, insertAt, blockLen: block.length }
  }
  while (baseLines.length > 0 && baseLines[baseLines.length - 1].trim() === '') baseLines.pop()
  const next = [...baseLines, '', ...block, '']
  const headOk = sameLines(next.slice(0, baseLines.length), baseLines)
  return { ok: headOk, next, insertAt: baseLines.length, blockLen: block.length }
}

/**
 * 整行改写档:默认每项 `before` 必须**恰好命中 1 次**;带 `all: true` 的那项允许命中 N 次并**全部**替换
 * (0 次仍然拒 —— "文案已漂"与"有歧义"是两件事,只有前者在任何档下都不可猜)。
 * 为什么需要 `all`(2026-09-28 由活文档清账逼出):台账里有一批**逐字相同的孪生登记行**(同一句话被并发
 * 并集复制成 2..10 份),要施加的改写对每一份都完全相同(摘掉过期认领牌 / 翻勾归并注记)。此时"改哪一份"
 * 语义上没有区别,而按"必须命中 1 次"就会 16/27 行落不了地,只能留成半新半旧的两个面孔 —— 那比不改更糟。
 * 三条护栏:① `all` 必须显式声明,缺省仍是恰好 1 次(旧的"不猜"语义一字未松);② 任一 `before` 不得等于
 * 另一项的 `after`(逐项顺序替换,否则前一项的产物会被后一项再改一遍,而声明里没这件事);③ 命中数如实
 * 打印并计入 `hits`,所以"除被改的行以外逐行等值 + 总行数不变"这条结构等值照旧全覆盖。
 * 两条自证各防一型:命中数防"锚点文案已漂"(0 一律拒);逐位等值防"替换式顺手把别的行顶掉"。
 */
export function applyReplacements(baseLines, pairs) {
  const next = baseLines.slice()
  const hits = new Set()
  for (const [i, p] of pairs.entries()) {
    for (const [j, q] of pairs.entries()) {
      if (i === j) continue
      if (p.before === q.after) return { ok: false, reason: `chain-hit#${i + 1}<-${j + 1}`, next: null }
    }
  }
  const multi = []
  for (const [i, p] of pairs.entries()) {
    const idxs = []
    for (let k = 0; k < next.length; k++) if (next[k] === p.before) idxs.push(k)
    if (idxs.length === 0) return { ok: false, reason: `replace-not-found#${i + 1}`, next: null }
    if (idxs.length !== 1 && !p.all)
      return { ok: false, reason: `replace-multi-hit#${i + 1}:${idxs.length}`, next: null }
    if (idxs.length > 1) multi.push({ item: i + 1, count: idxs.length })
    for (const at of idxs) {
      next[at] = p.after
      hits.add(at)
    }
  }
  if (next.length !== baseLines.length)
    return { ok: false, reason: 'line-count-changed', next: null }
  for (let k = 0; k < baseLines.length; k++)
    if (!hits.has(k) && next[k] !== baseLines[k])
      return { ok: false, reason: `untouched-line-drift@${k + 1}`, next: null }
  return { ok: true, next, hits: [...hits], multi }
}

async function main() {
  const inputs = readInputs()
  if (inputs.error) {
    console.error(`❌ ${inputs.error}`)
    process.exit(2)
  }
  const { root, doc, msg, block, anchorLines, replacements } = inputs
  const mode = replacements ? '整行改写' : anchorLines ? '锚点插入' : 'EOF 追加'

  let landed = ''
  let parentSha = ''
  let rejectReason = ''
  let baseCount = 0
  let nextCount = 0
  // 每次尝试都可能重算令牌 ⇒ 生效版本必须活到循环外给回读用
  let effBlock = block
  let effReplacements = replacements
  let assigned = null
  for (let attempt = 1; attempt <= MAX_CAS_ATTEMPTS; attempt++) {
    const head = git(['rev-parse', 'HEAD'], { root })
    if (headBlobOf(head, doc, { root }) === ABSENT) {
      console.error(`❌ 目标文档 ${doc} 不在 HEAD 里(${mode})⇒ 不猜,拒绝落地`)
      process.exit(1)
    }
    const baseLines = norm(git(['show', `${head}:${doc}`], { root, raw: true })).split('\n')
    baseCount = baseLines.length
    // 令牌**在每次尝试里重算**:别人先推进了 HEAD,下一轮算出的空闲号自然跟着变 ——
    // 这正是把取号放进 CAS 的意义(提交前"查一次占用"在高并发仓里不构成证据)。
    const baseContent = baseLines.join('\n')
    const targetLines = replacements ? replacements.map((p) => p.after) : block
    const families = idTokenFamilies(targetLines)
    // 号段基准**也在每次尝试里重算**:HEAD 会动,远端 tip 也会动(origin 常年被后台 worker 推进)。
    // 提到循环外就等于把"远端那一份"烘成一次性读数 —— 镜像测试 N5 用源码锁钉住这一型。
    const remote = families.length ? readRemoteIdBasis({ root, doc, families }) : null
    const tok = resolveIdTokens(targetLines, baseContent, remote)
    if (!tok.ok) {
      console.error(
        `❌ 令牌取号判不出(${tok.reason})⇒ 拒绝落地:该族在这份 HEAD 底稿里一条登记行都没有,` +
          `给 "<族>-1" 就是把"没查到"写成"这是空闲号"`,
      )
      process.exit(2)
    }
    // 降级必须逐条喊出来(远端这一维没判到 ≠ 已与远端对齐);顺序在基准行之前,便于"见上一行"指代。
    for (const n of remote?.notes ?? [])
      console.log(`⚠️ 号段基准未含远端(${n})⇒ 仍按本地 HEAD 底稿落号,**未与远端对齐**`)
    for (const b of tok.basis ?? []) console.log(describeIdBasis(b, remote))
    if (tok.assigned) assigned = tok.assigned
    effBlock = tok.assigned && !replacements ? tok.lines : block
    effReplacements =
      tok.assigned && replacements
        ? replacements.map((p, i) => ({ ...p, after: tok.lines[i] }))
        : replacements
    const built = effReplacements
      ? applyReplacements(baseLines, effReplacements)
      : assemble(baseLines, effBlock, anchorLines)
    if (!built.ok) {
      rejectReason = built.reason || '结构等值不成立'
      // not-found / multi-hit 与"内容已漂移后重试"无关的形态也会随 HEAD 移动而变;一律当场拒绝,不重试猜测
      console.error(
        built.reason === 'not-found'
          ? `❌ HEAD 版里找不到锚点(锚点文案已漂或本块已在位)⇒ 不猜,拒绝写盘`
          : String(built.reason || '').startsWith('chain-hit')
            ? `❌ 第 ${String(built.reason).replace('chain-hit#', '').split('<')[0]} 项的 before 等于另一项的 after ⇒ 逐项顺序替换会把前一项刚改出的行再改一遍,而声明里没有这件事,拒绝写盘(${built.reason})`
            : String(built.reason || '').startsWith('replace-not-found')
              ? `❌ 第 ${String(built.reason).replace('replace-not-found#', '')} 项的 before 在 HEAD 版里找不到(该行已被别人改写或本来不逐字等值)⇒ 不猜,拒绝写盘`
            : String(built.reason || '').startsWith('replace-multi-hit')
              ? `❌ 第 ${String(built.reason).replace('replace-multi-hit#', '').replace(/:.*/, '')} 项的 before 命中 ${String(built.reason).split(':').pop()} 次 ⇒ 无法确定改哪一行,交人工`
              : String(built.reason || '').startsWith('untouched-line-drift') ||
                  built.reason === 'line-count-changed'
                ? `❌ 改写动了声明之外的行(或改变了总行数)⇒ 这不是"整行替换",拒绝写盘`
                : String(built.reason || '').startsWith('multi-hit')
                  ? `❌ 锚点在 HEAD 版里命中 ${String(built.reason).slice(10)} 处 ⇒ 不猜,拒绝写盘`
                  : `❌ 新内容不等于"HEAD ⊕ 本块插入/追加"⇒ 拒绝写盘`,
      )
      process.exit(1)
    }
    nextCount = built.next.length
    const blob = writeBlob(built.next.join('\n'), { root })
    const { commit } = commitTreeWithIndex({
      root,
      parent: head,
      message: msg,
      entries: [{ path: doc, blob }],
      baseRef: head,
    })
    if (casUpdateRef(commit, head, { root })) {
      landed = commit
      parentSha = head
      console.log(
        `✅ 第 ${attempt} 次 CAS 成功 HEAD=${commit}(${mode}) ${doc} 行数 ${baseCount} → ${nextCount}` +
          (assigned === null ? '' : ` / 令牌取号(由该次 HEAD 底稿现算)=${assigned}`),
      )
      // 同文全改必须点名:命中 1 次与命中 9 次在"总行数不变"这条断言上完全同形,不印出来就等于
      // 让"顺手多改了别人那份"没有证人(与"失效方向必须是多要一次说明"同一条禁令)。
      if (built.multi && built.multi.length)
        console.log(
          `   声明为 all 的项共 ${built.multi.length} 项,逐条命中数:` +
            built.multi.map((m) => `第${m.item}项×${m.count}`).join(' ') +
            `(合计改写 ${built.hits.length} 行)`,
        )
      break
    }
    console.log(`⚠️ 第 ${attempt} 次 CAS 失败(别人先推进了 HEAD),重取 HEAD 底稿重试`)
  }
  if (landed === '') {
    console.error(
      `❌ ${MAX_CAS_ATTEMPTS} 次均未抢到 CAS${rejectReason ? `(最后一轮拒绝原因:${rejectReason})` : ''}`,
    )
    process.exit(1)
  }

  // 回读证明:插入档要求"本块每一条非空行都在 HEAD 里";改写档要求"每一条 after 都在、
  // 且每一条 before 都不在了"—— 后半句才是"改成了"的证据,只查前半句等于什么都没判。
  const now = norm(git(['show', `${landed}:${doc}`], { root, raw: true }))
  const missing = effReplacements
    ? effReplacements.filter((p) => !now.includes(p.after)).map((p) => p.after)
    : effBlock.filter((l) => l.trim() !== '' && !now.includes(l))
  if (missing.length > 0) {
    console.error(
      `❌ 回读有 ${missing.length} 行不在 HEAD 里:\n  ${missing.slice(0, 4).join('\n  ')}`,
    )
    process.exit(1)
  }
  if (replacements) {
    // 旧形态必须按**整行等值**归零,而不是按子串归零:改写档有两种形态 —— 翻勾(前缀变了)和
    // 追加注记(原行文字成为新行的前缀)。用 `doc.includes(before)` 判第二种会**误报"没生效"**,
    // 而误报的代价不只是难看:本函数在这句之后才做主索引对齐,判错的 exit 1 会把对齐整段跳过,
    // 于是共享索引停在父提交 blob ⇒ 别人一次不带 pathspec 的普通提交就把这次交付写回旧版(§12d 第三层)。
    const nowLines = now.split('\n')
    const stale = replacements.filter((p) => nowLines.includes(p.before))
    if (stale.length > 0) {
      console.error(`❌ 回读仍有 ${stale.length} 行的旧形态整行在位 ⇒ 改写没有真生效,不记为成功`)
      process.exit(1)
    }
    console.log(
      `✅ 回读:${replacements.length} 行已改成新形态(旧形态整行归零;追加注记型的原文字成为新行前缀,属正当)`,
    )
  } else console.log('✅ 回读:本块每一条非空行都在 HEAD 里')

  const align = alignSharedIndex({ root, paths: [doc], parentRef: parentSha })
  if (align.lockAbandoned) {
    console.error('❌ .git/index.lock 锁龄超上限:不代删别人的锁,请人工确认持有者后重跑')
    process.exit(1)
  }
  if (align.failed) {
    console.error(`❌ 索引对齐未完成:${align.error ?? '轮次耗尽'}`)
    process.exit(1)
  }
  console.log(
    `✅ 主索引已对齐 ${align.moved.length + align.already.length}/1 路径(移动 ${align.moved.length} / 已就位 ${align.already.length})`,
  )
  for (const s of align.skipped) console.log(`⚠️ 未动(归属他人):${s.path}(${s.reason})`)
  for (const u of align.undetermined) console.log(`⚠️ 未判定:${u.path}(${u.reason})`)
  process.exit(0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  readInputs,
  locateAnchor,
  assemble,
  applyReplacements,
  resolveIdTokens,
  readRemoteIdBasis,
  idTokenFamilies,
  describeIdBasis,
  remoteTarget,
  REMOTE_ID_TRANSPORT,
}
