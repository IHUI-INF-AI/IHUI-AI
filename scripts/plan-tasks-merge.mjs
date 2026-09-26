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
 * 三条判据各自的处置:
 *  - F1 同主键两态并存 → 副本行翻勾 + 注记归并到该主键的已完成登记。
 *  - F2 自带作废声明却未落账 → 同上(作废声明本身就是"已闭环"的一手证据)。
 *  - F3 行号指针已腐烂 → 把 `存活于 L<行号>` 换成**内容锚点**`存活于同主键登记「…」`。
 *    行号在任何一次 append 后都会挪位(实测 27 处指针复核通过率 0/27),它不是证据。
 *
 * 安全阀(全部由机器核,不靠人眼):
 *  1. 改写按**行号精确 splice**,所以"面上有逐字同文的孪生行"不构成误伤 —— 真正的风险是
 *     落地时基线已挪位,由 `--emit-base` 报出 baseBlob、落地步骤对其做 CAS 身份校验来兜;
 *     孪生行数量如实报出(它正是 F1 的成因)。
 *  2. 输出必须与输入**行数相等**,且未参与改写的每一行逐字不变(多重集对账)。
 *  3. 改完立刻用同一把尺子复跑 `auditPlan`:F1/F2/F3 必须全部归零,否则拒交付。
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
import { auditPlan, compositeKeyOf } from './lib/plan-task-index.mjs'

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
  const body = line.replace(/^- \[ \]\s*/, '')
  if (body.includes(ALREADY_TAGGED)) return line
  const why = key
    ? `本行与已完成登记同题(主键 ${anchorOf(key)}),是被并发并集留下的未翻勾副本`
    : '本行正文自带作废/已完成声明,却仍挂着未勾选 ⇒ 状态与正文两相矛盾'
  return `- [x] ✅(${today}) **[${VERDICT_TAG}]** ${why} ⇒ 只落状态、不删行、不重复计账。 ${body}`
}

function rewritePointer(line, key) {
  return line.replace(/(?:逐字)?存活于\s*L\d{1,6}/g, `存活于同主键登记 ${anchorOf(key)}`)
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
    if (after === before) {
      refused.push(`L${ln} 无可施加的改写(${v.kinds.join('+')})`)
      continue
    }
    lines[ln - 1] = after
    changed.push({ line: ln, kind: v.kinds.sort().join('+'), before, after })
  }
  return { text: lines.join('\n'), changed, refused, dupTwins, before: a.counts }
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
  if (!b0.forks && !b0.voidRows && !b0.rotatedPointers) {
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
      `触发时 HEAD 现读:F1 ${b0.forks} / F2 ${b0.voidRows} / F3 ${b0.rotatedPointers} → 归并 ${r.changed.length} 行后 0 / 0 / 0。`,
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
    console.log(`✅ 自愈落地 ${commit.slice(0, 11)}:归并 ${r.changed.length} 行 → F1/F2/F3 = 0/0/0`)
    return 0
  } finally {
    rmScratch(scratch)
  }
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
    after.forks || after.voidRows || after.rotatedPointers ? '归并后未归零' : null,
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
  console.log(`判定面:${LABEL[sel.face]}  现读:F1 ${counts0.forks} 组 / F2 ${counts0.voidRows} 行 / F3 ${counts0.rotatedPointers} 处 / 未勾选 ${counts0.open}`)
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
  console.log(`\n✅ 零损失对账通过;归并后 F1/F2/F3 = ${v.after.forks}/${v.after.voidRows}/${v.after.rotatedPointers},派单口径 ${counts0.open} → ${v.after.open}`)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
