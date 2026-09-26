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
 *  - F3 行号指针已腐烂 → 把 `存活于 L<行号>` 换成**内容锚点**`存活于同主键登记「…」`。
 *    行号在任何一次 append 后都会挪位(实测 27 处指针复核通过率 0/27),它不是证据。
 *  - F4 同一件事多条待办 → **不动勾选**(两件事都还没做完),只给副本行加一句
 *    `〔【归并】重复登记副本…派单以那条为准〕`。索引层认这句字面把它逐出派单口径,
 *    于是"173 条未勾选"与"真待办 97 条"这两个数从此分开。
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
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */

import { execFileSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, catBatch, gitRaw, selectFace } from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { DUP_POINTER_RE, auditPlan, compositeKeyOf } from './lib/plan-task-index.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLAN_REL = 'PROJECT_PLAN.md'
const VERDICT_TAG = '归并'
/** 幂等判据必须认**自己的标记形态**,不能认裸词:HEAD 里有一整批上一轮留下的
 *  `- [ ] **本行是并发 union 归并留下的裸副本**…` 行,正文天然含"归并"二字却**根本没落账**
 *  (勾还是空的)。按裸词判"已处理"会把这 6 行判成"无可施加的改写"——恰好把本工具要修的
 *  那一型当成已完成。 */
const ALREADY_TAGGED = `**[${VERDICT_TAG}]**`
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

/** 内容锚点:主键是"编号 + 标题前缀",而标题前缀常以同一编号开头(`D99复合主键正例`)
 *  ⇒ 拼锚点时把重复的编号剥掉,否则读起来是「D99 · D99复合主键正例」这种自复制。 */
const anchorOf = (key) => {
  const [id, rest = ''] = String(key).split('#')
  return `「${id}${rest && !rest.startsWith(id) ? ' · ' + rest : ''}」`
}

function rewriteFork(line, key, today) {
  if (/^- \[x\]/.test(line)) return line
  let body = line.replace(/^- \[ \]\s*/, '')
  if (body.includes(ALREADY_TAGGED)) return line
  /**
   * 翻勾必须同时摘牌 —— AGENTS §1 写的是"完成后改 `[x] ✅(日期)` 并删除 `（进行中）`",
   * 而这里过去只翻勾不摘牌,于是产出的行**同时**是 `[x]` 又挂着 `（进行中@…）`。
   * 守门 109 的 CL3 正是判这一型 ⇒ 归并工具每跑一次就往 HEAD 里种几颗红点,
   * 而 PROJECT_PLAN.md 是 `stagedTriggers` 文件:谁下一次提交计划文档都被这台恒红门拦住,
   * 唯一出路是 `--no-verify`(连带废掉全部守门 —— §12e 那条本仓最高反面教训)。
   * 两道机制互咬时,修的是**生产者**,不是把 6 行手抹掉。
   */
  body = body.replace(/（进行中(?:@[^）]*)?）\s*/g, '')
  const why = key
    ? `本行与已完成登记同题(主键 ${anchorOf(key)}),是被并发并集留下的未翻勾副本`
    : '本行正文自带作废/已完成声明,却仍挂着未勾选 ⇒ 状态与正文两相矛盾'
  return `- [x] ✅(${today}) **[${VERDICT_TAG}]** ${why} ⇒ 只落状态、不删行、不重复计账。 ${body}`
}

function rewritePointer(line, key) {
  return line.replace(/(?:逐字)?存活于\s*L\d{1,6}(?:\s*的同编号登记)?/g, `存活于同主键登记 ${anchorOf(key)}`)
}

/**
 * F4 副本行的改写:**不动勾选状态**(两件事都还没做完),只在行尾追加一句出处说明。
 * 说明里的固定字面必须能被 `DUP_POINTER_RE` 认得 ⇒ 派单口径当场不再把它算一条活;
 * 且重复跑归并不会再加第二句(幂等)。**删行是禁的**:§1「禁止无声删除」+ 门 71 防丢面。
 */
function rewriteDup(line, survivorLine, today) {
  if (DUP_POINTER_RE.test(line)) return line
  return `${line} 〔【归并】重复登记副本(${today}):同主键的另一条登记在 L${survivorLine},派单以那条为准,本行不再单独派单。〕`
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
  for (const p of a.rotated) note(p.line, 'F3', compositeKeyOf(lines[p.line - 1] ?? '') ?? '')
  // F4:同主键的多条未勾选 —— 幸存者由索引层判定,其余各加一句副本指针(不动勾选、不删行)
  for (const c of a.dupCopies) note(c.row.line, 'F4', c.key)
  const survivorOf = new Map(a.dupCopies.map((c) => [c.row.line, c.survivor.line]))
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
    if (v.kinds.includes('F4') && /^- \[ \]/.test(after)) after = rewriteDup(after, survivorOf.get(ln), today)
    if (after === before) {
      refused.push(`L${ln} 无可施加的改写(${v.kinds.join('+')})`)
      continue
    }
    lines[ln - 1] = after
    changed.push({ line: ln, kind: v.kinds.sort().join('+'), before, after })
  }
  return { text: lines.join('\n'), changed, refused, dupTwins, before: a.counts }
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
    ['F3', (c) => c.rotatedPointers],
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
  // F4 与 F1/F2/F3 平级:副本行也是"状态与正文不符"的一种,早退判据漏看它 = 修复出口永不触发
  if (!b0.forks && !b0.voidRows && !b0.rotatedPointers && !b0.dupOpenCopies) {
    console.log('✅ 自愈:HEAD 无状态分叉,不动任何东西')
    return 0
  }
  const r = buildMerge(src, new Date().toISOString().slice(0, 10))
  const bad = healStopReasons(src, r.text, r.changed, r.refused.length)
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
  writeFileSync(tmp, r.text, 'utf8')
  writeFileSync(
    msgFile,
    [
      'fix(plan): 自愈被回写的任务状态副本(守门 130 的 post-commit 层)',
      '',
      `触发时 HEAD 现读:F1 ${b0.forks} / F2 ${b0.voidRows} / F3 ${b0.rotatedPointers} / F4 ${b0.dupOpenCopies} → 归并 ${r.changed.length} 行后 0 / 0 / 0 / 0。`,
      `行数 ${src.split('\n').length} → ${r.text.split('\n').length}(一行不删一行不加),未参与改写的 ${src.split('\n').length - r.changed.length} 行逐字不变。`,
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
    console.log(`✅ 自愈落地 ${commit.slice(0, 11)}:归并 ${r.changed.length} 行 → F1/F2/F3/F4 = 0/0/0/0`)
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

/** 自愈的"该不该停手"判据 —— 抽成纯函数,否则这一层最要紧的安全断言只能在真仓上验一次。 */
export function healStopReasons(srcText, merged, changed, refusedCount) {
  const a0 = String(srcText).split('\n')
  const a1 = String(merged).split('\n')
  const touched = new Set(changed.map((c) => c.line))
  const after = auditPlan(merged).counts
  return [
    refusedCount ? `拒写 ${refusedCount} 项` : null,
    a0.length !== a1.length ? `行数不等 ${a0.length}→${a1.length}` : null,
    a0.some((l, i) => !touched.has(i + 1) && l !== a1[i]) ? '有未登记行被改动' : null,
    after.forks || after.voidRows || after.rotatedPointers || after.dupOpenCopies
      ? '归并后未归零'
      : null,
  ].filter(Boolean)
}

/** 零损失对账:行数相等 ∧ 未被改写的行逐字不变(多重集),外加"三条判据必须归零"。 */
export function verifyMerge(original, merged, changed) {
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
  const after = auditPlan(merged)
  if (after.counts.forks) problems.push(`F1 未归零:${after.counts.forks} 组`)
  if (after.counts.voidRows) problems.push(`F2 未归零:${after.counts.voidRows} 行`)
  if (after.counts.rotatedPointers) problems.push(`F3 未归零:${after.counts.rotatedPointers} 处`)
  if (after.counts.dupOpenCopies)
    problems.push(`F4 未归零:${after.counts.dupOpenCopies} 行同题待办副本仍挂着`)
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
    '- [ ] **D96 指针**:本行正题逐字存活于 L1 的同编号登记。',
    '- [ ] **D98 真待办**:谁都没做过,不得被动。',
  ].join('\n')
  const r = buildMerge(src, '2026-09-26')
  ok(r.changed.length === 3, `应改 3 行,实测 ${r.changed.length}`)
  ok(r.refused.length === 0, `不应拒写,实测 ${JSON.stringify(r.refused)}`)
  const v = verifyMerge(src, r.text, r.changed)
  ok(v.problems.length === 0, `零损失与归零断言应全过:${JSON.stringify(v.problems)}`)
  ok(v.after.claimable === 2, `归并后真待办应是 D96(只腐烂指针,事项本身没做完)+ D98 两条,实测 ${v.after.claimable}`)
  const line4 = r.text.split('\n')[3]
  ok(!/存活于\s*L\d/.test(line4) && line4.includes('同主键登记'), 'F3 必须换成内容锚点')
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
  console.log(`\n自检:${pass} 通过 / ${fail} 失败`)
  return fail ? 1 : 0
}

function main() {
  const argv = process.argv.slice(2)
  const has = (f) => argv.includes(f)
  if (has('--self-test')) return selfTest()
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
  console.log(`判定面:${LABEL[sel.face]}  现读:F1 ${counts0.forks} 组 / F2 ${counts0.voidRows} 行 / F3 ${counts0.rotatedPointers} 处 / F4 ${counts0.dupOpenCopies} 副本 / 未勾选 ${counts0.open}`)
  console.log(`拟改写 ${r.changed.length} 行(${r.changed.map((c) => c.kind).sort().join(',')})`)
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
  console.log(`\n✅ 零损失对账通过;归并后 F1/F2/F3/F4 = ${v.after.forks}/${v.after.voidRows}/${v.after.rotatedPointers}/${v.after.dupOpenCopies},派单口径 ${counts0.open} → ${v.after.open}`)
  const out = argv[argv.indexOf('--write-to') + 1]
  if (has('--write-to') && out && !out.includes(PLAN_REL)) {
    writeFileSync(out, r.text, 'utf8')
    console.log(`候选文本已写到 ${out}(没有碰 ${PLAN_REL};落地由主会话按活文档规矩走对象空间)`)
  } else if (has('--write-to')) {
    console.log('❌ --write-to 必须给一个不是 PROJECT_PLAN.md 的路径(本工具不允许直接写文档本体)')
    return 1
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
export const __test__ = { rewriteFork, anchorOf }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
