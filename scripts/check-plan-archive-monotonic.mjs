// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * PROJECT_PLAN.md 归档单调性守门(2026-10-23 立,guardian-runner 新增项,blocking)
 *
 * 立因(2026-10-23 22:0x 实测事故):工作区台账被旧快照回插 29+/16- —— 4 条**已归档**(✅ 含日期)
 * 的完成票被展开回"未勾活行"(D17 / G-807 / 僵尸实例 / G-8160 失败共享事实),另有多条旧副本
 * 重复插入,且整批已被 `git add` 进暂存区,下一次收编就会写进历史。既有门 71(登记行防丢)与
 * 229(跨枚滞留的已勾行)**都守"丢行/留存"这一侧**,对"已完成票复活成待办"零覆盖 —— 因为
 * 复活出来的行在文本上完全合法:一条未勾的、格式正确的、编号真实的登记行。
 *
 * 判据(只用**本次新增行**裁决,存量只报数 —— §12e:与任何提交都无关的红只会逼人 --no-verify,
 * 一次绕过等于全部守门对该提交作废):
 *   设 head = HEAD:PROJECT_PLAN.md, cand = 被审面。
 *   add = cand 条目行 − head 条目行(逐字差);del = head 条目行 − cand 条目行。
 *   逐条裁决 add 中的**未勾**行:
 *     0) 若 del 里有一行与本行**剥注记后正文逐字相同** ⇒ 放行(改写/搬移/注记调整;回插事故
 *        的新增行对应的 HEAD 行仍在,不会进 del,故这一条不会放过事故型)。
 *     R1) 本行标记 ∈ head 归档注释里的标记集 ⇒ 红(**复活已完成的票**)。
 *     R2) 本行标记 ∈ head 未勾行的标记集,且剥注记后正文与那条 HEAD 行逐字相同 ⇒ 红(**重复回插**)。
 *     无编号行:取剥注记后正文前 16 字作弱指纹,命中 head 归档注释正文 ⇒ 红(R1 同型)。
 *   其余放行:全新标记(新票)、正文改写、翻勾/归档/删除。
 *
 * 归档注释形态(现读 HEAD):`<!-- 已归档(2026-10-08:✅(2026-10-07) G-807 ... -->`,单行。
 *
 * 用法:
 *   node scripts/check-plan-archive-monotonic.mjs --staged          # pre-commit:审索引 blob
 *   node scripts/check-plan-archive-monotonic.mjs --worktree        # 收编前自检/审计:审磁盘
 *   node scripts/check-plan-archive-monotonic.mjs --candidate-file <path> # 审计指定副本
 *   node scripts/check-plan-archive-monotonic.mjs --self-test       # 判据自证(内存样例,零 git 依赖)
 * 退出码:0 通过 / 1 检出复活或重复回插 / 2 被审面取不到(无法判定,不认绿)
 * 紧急跳过(不推荐):HUSKY_SKIP_PLAN_ARCHIVE_MONOTONIC=1 git commit ...
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { gitRaw } from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = 'PROJECT_PLAN.md'

/** 状态注记的**窄口径**剥离表:只删已知的状态括注,不碰正文与别的括注(§0.3 不猜)。 */
const NOTE_RE =
  /（(?:进行中@[^）]*|认领已释放@[^）]*|进度[^）]*|登记@[^）]*|半程@[^）]*|压缩@[^）]*|拍板@[^）]*|注@[^）]*|结清@[^）]*|让号@[^）]*|认领@[^）]*|未取号[^）]*|承[^）]*)）/g

function isEntry(row) {
  return row.startsWith('- [ ]') || row.startsWith('- [x]')
}
function isOpen(row) {
  return row.startsWith('- [ ]')
}
/** 剥复选框/状态注记/markdown 装饰后的正文 —— R2 与放行 0 的共同尺子。 */
function bodyOf(row) {
  return row
    .replace(/^-\s*\[[ x]\]\s*/, '')
    .replace(NOTE_RE, '')
    .replace(/[`*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
/** 任务标记:行首 32 字内的编号(G-/D/O/P/W/守门/第N步)。取不到返回 null(不猜)。 */
const MARK_PATTERNS = [
  /\bG-(\d{1,4})\b/,
  /(?:^|[^A-Za-z0-9])D(\d{1,4})(?![0-9])/,
  /(?:^|[^A-Za-z0-9])O(\d{1,4})(?![0-9])/,
  /(?:^|[^A-Za-z0-9])P(\d{1,4})(?![0-9])/,
  /(?:^|[^A-Za-z0-9])W(\d{1,4})(?![0-9])/,
  /守门\s*(\d{1,3})/,
  /第\s*(\d{1,2})\s*步/,
]
function markOf(row) {
  const head = bodyOf(row).slice(0, 32)
  for (const re of MARK_PATTERNS) {
    const m = head.match(re)
    if (m) return m[0].replace(/\s+/g, '')
  }
  return null
}
/** 无编号行的弱指纹(前 16 字);不足 8 字不给指纹(短行不判)。 */
function weakKey(row) {
  const b = bodyOf(row)
  return b.length >= 8 ? b.slice(0, 16) : null
}
/** 归档注释里的正文(去 `<!-- 已归档(日期:` 前缀与 `-->` 后缀)。 */
function archiveBody(row) {
  if (!row.startsWith('<!--')) return null
  if (!/已归档\s*\(/.test(row)) return null
  return row
    .replace(/^<!--\s*/, '')
    .replace(/\s*-->\s*$/, '')
    .replace(/^已归档\([^:]*:\s*/, '')
    .replace(/^✅\([^)]*\)\s*/, '')
}

/**
 * 纯判定(零 I/O):给 head 与 cand 两面的全文,返回 { hits, stats }。
 * 这是唯一判据实现 —— 入口与 --self-test 都只调它(禁止两处各抄一份)。
 */
export function analyze(headText, candText) {
  const head = headText.split('\n')
  const cand = candText.split('\n')
  // 多重集计数:同一条目行在文件里出现两次也是一条事实(逐字孪生回插正是这种形态),
  // 用 Set 会把它抹平 —— 2026-10-23 自测第三例实测。
  const countOf = (rows) => {
    const m = new Map()
    for (const r of rows) if (isEntry(r)) m.set(r, (m.get(r) || 0) + 1)
    return m
  }
  const headCount = countOf(head)
  const candCount = countOf(cand)
  const add = []
  for (const [row, n] of candCount) for (let i = n - (headCount.get(row) || 0); i > 0; i--) add.push(row)
  const del = []
  for (const [row, n] of headCount) for (let i = n - (candCount.get(row) || 0); i > 0; i--) del.push(row)

  // HEAD 侧三张索引
  const archivedMarks = new Set()
  const archivedText = []
  const openMarks = new Map()
  const openBodies = new Set()
  for (const row of head) {
    const ab = archiveBody(row)
    if (ab !== null) {
      archivedText.push(ab)
      const m = markOf(ab)
      if (m) archivedMarks.add(m)
      continue
    }
    if (!isEntry(row)) continue
    if (isOpen(row)) {
      const m = markOf(row)
      if (m && !openMarks.has(m)) openMarks.set(m, row)
      openBodies.add(bodyOf(row))
    }
  }
  const delBodies = new Set(del.map(bodyOf))

  const hits = []
  let passedRewrite = 0
  let passedNew = 0
  for (const row of add) {
    if (!isOpen(row)) continue // 新增已勾行不管(门 229 的射程)
    const body = bodyOf(row)
    // 0) 改写/搬移:HEAD 那一行被删掉了 ⇒ 不是回插
    if (delBodies.has(body)) {
      passedRewrite++
      continue
    }
    const m = markOf(row)
    if (m && archivedMarks.has(m)) {
      hits.push({ kind: 'R1 复活已归档票', mark: m, row })
      continue
    }
    if (m && openMarks.has(m) && bodyOf(openMarks.get(m)) === body) {
      hits.push({ kind: 'R2 重复回插(同标记逐字孪生)', mark: m, row })
      continue
    }
    const wk = weakKey(row)
    if (!m && wk && archivedText.some((t) => t.includes(wk))) {
      hits.push({ kind: 'R1 复活已归档票(无编号票按正文指纹)', mark: wk, row })
      continue
    }
    passedNew++
  }
  return {
    hits,
    stats: {
      addOpen: add.filter(isOpen).length,
      delEntry: del.length,
      passedNew,
      passedRewrite,
      archived: archivedText.length,
      openInHead: openBodies.size,
    },
  }
}

function readFace(argv) {
  const staged = argv.includes('--staged')
  const worktree = argv.includes('--worktree')
  const ci = argv.indexOf('--candidate-file')
  if (staged && worktree) return { error: '两面旗同给(--staged / --worktree)' }
  if (ci >= 0) {
    const p = argv[ci + 1]
    if (!p) return { error: '--candidate-file 缺路径' }
    return { cand: readFileSync(p, 'utf8'), label: 'file:' + p }
  }
  let cand
  try {
    cand = staged
      ? gitRaw(['show', ':' + FILE], ROOT)
      : readFileSync(path.join(ROOT, FILE), 'utf8')
  } catch (e) {
    return { error: '被审面取不到: ' + String(e?.message || e).split('\n')[0] }
  }
  return { cand, label: staged ? '索引 blob' : '工作树' }
}

function render(hits, stats) {
  const lines = []
  for (const h of hits) {
    lines.push('  ❌ ' + h.kind + ' [标记 ' + h.mark + ']')
    lines.push('     ' + h.row.slice(0, 140))
  }
  lines.push(
    '  读数:新增未勾条目 ' +
      stats.addOpen +
      ' · 删除条目 ' +
      stats.delEntry +
      ' · 放行(全新) ' +
      stats.passedNew +
      ' · 放行(改写/搬移) ' +
      stats.passedRewrite +
      ' · HEAD 归档注释 ' +
      stats.archived,
  )
  return lines.join('\n')
}

// ─── 自证:四型样例,内存文本,零 git 依赖 ───────────────────────────────
function selfTest() {
  const head = [
    '# 计划',
    '<!-- 已归档(2026-10-08:✅(2026-10-07) G-807 恢复器用例不稳定,完整内容在归档件) -->',
    '<!-- 已归档(2026-10-07:✅(2026-09-28) P1 新登记(接上条,解阻前置已明确):僵尸实例修复。可选方向三条) -->',
    '- [ ] G-100 甲票正文很长很长足够二十字以上用于判据样例',
    '- [ ] D200 乙票正文很长很长足够二十字以上用于判据样例,带（进行中@2026-10-23/seat-a）租约',
    '- [x] G-101 已完成但尚未归档的一行样例正文很长很长',
  ].join('\n')
  const cases = [
    {
      name: '复活已归档票(G-807)⇒ 必红',
      cand: head + '\n- [ ] G-807 恢复器用例不稳定,完整内容在归档件',
      want: 1,
      kind: 'R1',
    },
    {
      name: '复活无编号归档票(僵尸实例)⇒ 必红',
      cand: head + '\n- [ ] P1 新登记(接上条,解阻前置已明确):僵尸实例修复。可选方向三条,前置未满足',
      want: 1,
      kind: 'R1',
    },
    {
      name: '全新票(G-999)⇒ 必绿',
      cand: head + '\n- [ ] G-999 全新票正文很长很长足够二十字以上用于判据样例',
      want: 0,
    },
    {
      name: '改写/搬移(删旧行 + 新增改写版)⇒ 必绿',
      cand: head.replace('- [ ] G-100 甲票正文很长很长足够二十字以上用于判据样例', '') +
        '\n- [ ] G-100 甲票正文很长很长足够二十字以上用于判据样例,追加了进展注记',
      want: 0,
    },
    {
      name: '重复回插(D200 逐字孪生,HEAD 原行仍在)⇒ 必红',
      cand: head + '\n- [ ] D200 乙票正文很长很长足够二十字以上用于判据样例,带（进行中@2026-10-23/seat-a）租约',
      want: 1,
      kind: 'R2',
    },
    {
      name: '摘注记(删带注行 + 加无注行)⇒ 必绿(改写族)',
      cand: head.replace('带（进行中@2026-10-23/seat-a）租约', '租约') +
        '\n- [ ] D200 乙票正文很长很长足够二十字以上用于判据样例,租约',
      want: 0,
    },
    {
      name: '翻勾 + 归档 + 删行 ⇒ 必绿',
      cand: head
        .replace('- [ ] G-100 甲票正文很长很长足够二十字以上用于判据样例', '')
        .replace('- [x] G-101 已完成但尚未归档的一行样例正文很长很长', '') +
        '\n<!-- 已归档(2026-10-23:✅(2026-10-23) G-100 G-101 已结清) -->',
      want: 0,
    },
  ]
  let bad = 0
  for (const c of cases) {
    const r = analyze(head, c.cand)
    const ok = r.hits.length === c.want && (!c.kind || r.hits.every((h) => h.kind.startsWith(c.kind)))
    if (!ok) bad++
    console.log((ok ? '  ✅ ' : '  ❌ ') + c.name + ' (hits=' + r.hits.length + ' 期望 ' + c.want + ')')
    if (!ok) console.log(render(r.hits, r.stats))
  }
  // 反向锁:同一文本两面 ⇒ 零新增、零命中
  const same = analyze(head, head)
  if (same.hits.length !== 0 || same.stats.addOpen !== 0 || same.stats.delEntry !== 0) {
    bad++
    console.log('  ❌ HEAD=候选时不得有任何新增/删除/命中')
  } else {
    console.log('  ✅ HEAD=候选时零新增零命中(反向锁)')
  }
  console.log(bad === 0 ? 'SELF-TEST OK(' + (cases.length + 1) + '/' + (cases.length + 1) + ')' : 'SELF-TEST FAILED(' + bad + ' 例)')
  return bad === 0 ? 0 : 1
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return process.exit(selfTest())
  if (argv.includes('--help') || argv.length === 0) {
    console.log('用法:--staged | --worktree | --candidate-file <path> | --self-test')
    return process.exit(0)
  }
  let head
  try {
    head = gitRaw(['show', 'HEAD:' + FILE], ROOT)
  } catch (e) {
    console.error('无法判定:HEAD 面取不到 ' + String(e?.message || e).split('\n')[0])
    return process.exit(2)
  }
  const f = readFace(argv)
  if (f.error) {
    console.error('无法判定:' + f.error)
    return process.exit(2)
  }
  if (f.cand === head) {
    console.log('归档单调性:零改动(' + f.label + ' 与 HEAD 逐字相同)')
    return process.exit(0)
  }
  const { hits, stats } = analyze(head, f.cand)
  if (hits.length === 0) {
    console.log('归档单调性:通过(' + f.label + ')')
    console.log(render(hits, stats))
    return process.exit(0)
  }
  console.error('🈲 归档单调性守门:检出 ' + hits.length + ' 条倒退(' + f.label + ')')
  console.error(render(hits, stats))
  console.error('')
  console.error('  成因几乎总是"按旧快照整文件写回":HEAD 里已归档(✅)的票被展开回未勾活行,')
  console.error('  或同一条登记行被再插一份。正解是从 HEAD 取现版重放本轮改动,不是 --no-verify:')
  console.error('    1) 取现版:git show HEAD:PROJECT_PLAN.md > <临时文件>')
  console.error('    2) 用 scripts/live-doc-edit.mjs 定向改写(带 CAS)重放你要写的行')
  console.error('    3) 复核:node scripts/check-plan-archive-monotonic.mjs --worktree')
  console.error('  紧急跳过(不推荐):HUSKY_SKIP_PLAN_ARCHIVE_MONOTONIC=1 git commit ...')
  return process.exit(1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exit(main())
}
