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
 *  LIVE_BLOCK_FILE   必填,正文块内容文件的绝对路径
 *  LIVE_ANCHOR_FILE  可选,锚点行(可多行)所在文件的绝对路径;缺省 = EOF 追加(对齐 append-eof 的行为)
 *  LIVE_MSG          必填,提交信息
 *  LIVE_ROOT         测试/换仓通道:仓库根(缺省 = 本脚本所在仓根)
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

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
const MAX_CAS_ATTEMPTS = 12

const norm = (s) => s.replace(/\r\n/g, '\n')

/** 读 env + 输入文件并判用法;不合法 ⇒ {error}(调用方折 exit 2)。 */
export function readInputs(env = process.env) {
  const doc = env.LIVE_DOC ?? ''
  const blockFile = env.LIVE_BLOCK_FILE ?? ''
  const anchorFile = env.LIVE_ANCHOR_FILE ?? ''
  const msg = env.LIVE_MSG ?? ''
  const root = env.LIVE_ROOT ? resolve(env.LIVE_ROOT) : REPO_ROOT
  if (!doc || !blockFile || !msg) return { error: '缺 LIVE_DOC / LIVE_BLOCK_FILE / LIVE_MSG ⇒ 拒绝执行' }
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

async function main() {
  const inputs = readInputs()
  if (inputs.error) {
    console.error(`❌ ${inputs.error}`)
    process.exit(2)
  }
  const { root, doc, msg, block, anchorLines } = inputs
  const mode = anchorLines ? '锚点插入' : 'EOF 追加'

  let landed = ''
  let parentSha = ''
  let rejectReason = ''
  let baseCount = 0
  let nextCount = 0
  for (let attempt = 1; attempt <= MAX_CAS_ATTEMPTS; attempt++) {
    const head = git(['rev-parse', 'HEAD'], { root })
    if (headBlobOf(head, doc, { root }) === ABSENT) {
      console.error(`❌ 目标文档 ${doc} 不在 HEAD 里(${mode})⇒ 不猜,拒绝落地`)
      process.exit(1)
    }
    const baseLines = norm(git(['show', `${head}:${doc}`], { root, raw: true })).split('\n')
    baseCount = baseLines.length
    const built = assemble(baseLines, block, anchorLines)
    if (!built.ok) {
      rejectReason = built.reason || '结构等值不成立'
      // not-found / multi-hit 与"内容已漂移后重试"无关的形态也会随 HEAD 移动而变;一律当场拒绝,不重试猜测
      console.error(
        built.reason === 'not-found'
          ? `❌ HEAD 版里找不到锚点(锚点文案已漂或本块已在位)⇒ 不猜,拒绝写盘`
          : built.reason && String(built.reason).startsWith('multi-hit')
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
      console.log(`✅ 第 ${attempt} 次 CAS 成功 HEAD=${commit}(${mode}) ${doc} 行数 ${baseCount} → ${nextCount}`)
      break
    }
    console.log(`⚠️ 第 ${attempt} 次 CAS 失败(别人先推进了 HEAD),重取 HEAD 底稿重试`)
  }
  if (landed === '') {
    console.error(`❌ ${MAX_CAS_ATTEMPTS} 次均未抢到 CAS${rejectReason ? `(最后一轮拒绝原因:${rejectReason})` : ''}`)
    process.exit(1)
  }

  // 回读证明:本块每一条非空行都必须逐字出现在 HEAD 版里
  const now = norm(git(['show', `${landed}:${doc}`], { root, raw: true }))
  const missing = block.filter((l) => l.trim() !== '' && !now.includes(l))
  if (missing.length > 0) {
    console.error(`❌ 回读有 ${missing.length} 行不在 HEAD 里:\n  ${missing.slice(0, 4).join('\n  ')}`)
    process.exit(1)
  }
  console.log('✅ 回读:本块每一条非空行都在 HEAD 里')

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

export const __test__ = { readInputs, locateAnchor, assemble }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
