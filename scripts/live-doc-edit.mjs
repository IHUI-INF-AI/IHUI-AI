// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 *                    且替换后"除这些行以外逐行等值、总行数不变" ⇒ 才准落盘。
 *  LIVE_MSG          必填,提交信息
 *  LIVE_ROOT         测试/换仓通道:仓库根(缺省 = 本脚本所在仓根)
 *  取号令牌(两种模式都可用,只在正文里出现):`{{NEXT_ID:G}}` 会在**每次 CAS 尝试**里由当下
 *  HEAD 底稿现算成 `G-<下一个空闲号>`(判据住在 lib/plan-task-index.mjs 的 nextTaskIdNumber,
 *  本器不另写一份)。为什么必须在这里算而不是由人先查:2026-09-27 一天内两次同号事故,
 *  "提交前查一次占用"挡不住别人事后取同一个号(与守门编号撞号同族)。该族一条登记行都没有
 *  ⇒ exit 2 拒绝落地,绝不给 "<族>-1"。
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
import { nextTaskIdNumber } from './lib/plan-task-index.mjs'

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

export function resolveIdTokens(lines, baseContent) {
  const families = new Set()
  for (const l of lines) for (const m of String(l).matchAll(ID_TOKEN_RE)) families.add(m[1].toUpperCase())
  if (families.size === 0) return { ok: true, lines, assigned: null }
  const map = new Map()
  for (const f of families) {
    const n = nextTaskIdNumber(baseContent, f)
    if (n === null) return { ok: false, reason: `no-such-family:${f}` }
    map.set(f, n)
  }
  return {
    ok: true,
    lines: lines.map((l) =>
      String(l).replace(ID_TOKEN_RE, (_, raw) => `${raw.toUpperCase()}-${map.get(raw.toUpperCase())}`),
    ),
    assigned: [...map.entries()].map(([f, n]) => `${f}-${n}`).join(','),
  }
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
    return { error: '改写档(LIVE_REPLACE_FILE)与插入档(LIVE_BLOCK_FILE / LIVE_ANCHOR_FILE)互斥 ⇒ 一次只做一件事' }
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
      if (p.before === p.after) return { error: `第 ${i + 1} 项 before == after ⇒ 无事可做,剔除后再跑` }
    }
    if (!resolveHeadRef({ root })) return { error: `${root} 不是可用仓库(HEAD 不可解析或 detached)⇒ 无法判定,不落` }
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
  if (block.length === 0 || block.every((l) => l.trim() === '')) return { error: '待插入正文块为空,拒绝执行' }
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
  if (!resolveHeadRef({ root })) return { error: `${root} 不是可用仓库(HEAD 不可解析或 detached)⇒ 无法判定,不落` }
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
    if (hits !== 1) return { ok: false, reason: hits === 0 ? 'not-found' : `multi-hit:${hits}`, next: null }
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
 * 整行改写档:每项 `before` 必须**恰好命中 1 次**,替换后总行数不变、且除被改的那几行以外逐行等值。
 * 两条自证各防一型:命中数防"锚点文案已漂 / 有歧义"(0 与 >1 都不猜);逐位等值防"替换式顺手把
 * 别的行顶掉"(与插入档的结构等值是同一条禁令,不是新发明)。
 */
export function applyReplacements(baseLines, pairs) {
  const next = baseLines.slice()
  const hits = new Set()
  for (const [i, p] of pairs.entries()) {
    const idxs = []
    for (let k = 0; k < next.length; k++) if (next[k] === p.before) idxs.push(k)
    if (idxs.length !== 1)
      return {
        ok: false,
        reason: idxs.length === 0 ? `replace-not-found#${i + 1}` : `replace-multi-hit#${i + 1}:${idxs.length}`,
        next: null,
      }
    next[idxs[0]] = p.after
    hits.add(idxs[0])
  }
  if (next.length !== baseLines.length) return { ok: false, reason: 'line-count-changed', next: null }
  for (let k = 0; k < baseLines.length; k++)
    if (!hits.has(k) && next[k] !== baseLines[k])
      return { ok: false, reason: `untouched-line-drift@${k + 1}`, next: null }
  return { ok: true, next, hits: [...hits] }
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
    const tok = resolveIdTokens(replacements ? replacements.map((p) => p.after) : block, baseContent)
    if (!tok.ok) {
      console.error(
        `❌ 令牌取号判不出(${tok.reason})⇒ 拒绝落地:该族在这份 HEAD 底稿里一条登记行都没有,` +
          `给 "<族>-1" 就是把"没查到"写成"这是空闲号"`,
      )
      process.exit(2)
    }
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
          : String(built.reason || '').startsWith('replace-not-found')
            ? `❌ 第 ${String(built.reason).replace('replace-not-found#', '')} 项的 before 在 HEAD 版里找不到(该行已被别人改写或本来不逐字等值)⇒ 不猜,拒绝写盘`
            : String(built.reason || '').startsWith('replace-multi-hit')
              ? `❌ 第 ${String(built.reason).replace('replace-multi-hit#', '').replace(/:.*/, '')} 项的 before 命中 ${String(built.reason).split(':').pop()} 次 ⇒ 无法确定改哪一行,交人工`
              : String(built.reason || '').startsWith('untouched-line-drift') || built.reason === 'line-count-changed'
                ? `❌ 改写动了声明之外的行(或改变了总行数)⇒ 这不是"整行替换",拒绝写盘`
                : String(built.reason || '').startsWith('multi-hit')
                  ? `❌ 锚点在 HEAD 版里命中 ${String(built.reason).slice(10)} 处 ⇒ 不猜,拒绝写盘`
                  : `❌ 新内容不等于"HEAD ⊕ 本块插入/追加"⇒ 拒绝写盘`,
      )
      process.exit(1)
    }
    nextCount = built.next.length
    const blob = writeBlob(built.next.join('\n'), { root })
    const { commit } = commitTreeWithIndex({ root, parent: head, message: msg, entries: [{ path: doc, blob }], baseRef: head })
    if (casUpdateRef(commit, head, { root })) {
      landed = commit
      parentSha = head
    console.log(
      `✅ 第 ${attempt} 次 CAS 成功 HEAD=${commit}(${mode}) ${doc} 行数 ${baseCount} → ${nextCount}` +
        (assigned === null ? '' : ` / 令牌取号(由该次 HEAD 底稿现算)=${assigned}`),
    )
      break
    }
    console.log(`⚠️ 第 ${attempt} 次 CAS 失败(别人先推进了 HEAD),重取 HEAD 底稿重试`)
  }
  if (landed === '') {
    console.error(`❌ ${MAX_CAS_ATTEMPTS} 次均未抢到 CAS${rejectReason ? `(最后一轮拒绝原因:${rejectReason})` : ''}`)
    process.exit(1)
  }

  // 回读证明:插入档要求"本块每一条非空行都在 HEAD 里";改写档要求"每一条 after 都在、
  // 且每一条 before 都不在了"—— 后半句才是"改成了"的证据,只查前半句等于什么都没判。
  const now = norm(git(['show', `${landed}:${doc}`], { root, raw: true }))
  const missing = effReplacements
    ? effReplacements.filter((p) => !now.includes(p.after)).map((p) => p.after)
    : effBlock.filter((l) => l.trim() !== '' && !now.includes(l))
  if (missing.length > 0) {
    console.error(`❌ 回读有 ${missing.length} 行不在 HEAD 里:\n  ${missing.slice(0, 4).join('\n  ')}`)
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
    console.log(`✅ 回读:${replacements.length} 行已改成新形态(旧形态整行归零;追加注记型的原文字成为新行前缀,属正当)`)
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
  console.log(`✅ 主索引已对齐 ${align.moved.length + align.already.length}/1 路径(移动 ${align.moved.length} / 已就位 ${align.already.length})`)
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
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
