// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
 * Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
 *
 * check-ref-move-loss.mjs —— 「HEAD 被搬到别人链上时,原来那枚有没有掉出祖先线」的守夜人。
 *
 * 为什么要它(2026-11-17 现读事故):
 *   `casUpdateRef` 只保「原子性」,不保「祖先性」——它拒非快进,但只对**走它**的写入者有效。
 *   另有几条通道(`git update-ref <ref> <new>` 两参形态、node fs 直写松散 ref、`git branch -f`、
 *   人工 reset)结构上绕过它,把 main 搬到一条不含本席刚落地那枚的链上,于是那枚提交从 main
 *   上"消失",内容还在对象库里但没人再看得到它。这不是慢,是**静默丢提交**。
 *
 * 本器做的事只有一件,而且只做这一件:
 *   1. 记住上一轮看到的 HEAD(`.ihui-agent/state/ref-move-watch.json`);
 *   2. 本轮再读 HEAD,若「旧 HEAD 是新 HEAD 的祖先」⇒ 正常推进,只更新记号;
 *   3. 若不是祖先 ⇒ 判定"位移丢了提交":**立刻**在旧 HEAD 上打 `preserve/refmove-<短sha>-<时刻>`
 *      分支(让被丢的提交永远可达,§22 删除安全规则),并向 `.ihui-agent/state/ref-move-loss.jsonl`
 *      逐条记账(旧/新 sha、丢失枚数、丢失清单前 20 条、处置结果)。
 *
 * 三态(§0.3 不记绿也不冒红):
 *   0 = 推进且无丢失 / 1 = 检出丢失并已保全(此时"红"是事实,不是本器故障) / 2 = 未判定(取不到输入)
 *
 * 用法:
 *   node scripts/check-ref-move-loss.mjs            # 巡检 + 保全(默认;供定时任务/守卫轮调用)
 *   node scripts/check-ref-move-loss.mjs --check    # 只判不保全(只读)
 *   node scripts/check-ref-move-loss.mjs --reset    # 把记号对齐到当前 HEAD(人工确认过现场后用)
 *   node scripts/check-ref-move-loss.mjs --self-test
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const STATE_DIR = path.join(ROOT, '.ihui-agent', 'state')
const STATE_FILE = path.join(STATE_DIR, 'ref-move-watch.json')
const LEDGER_FILE = path.join(STATE_DIR, 'ref-move-loss.jsonl')
/** 自记账本(ASCII JSON,UTF-8 显式写):不依赖任何 shell 重定向,免得码页把中文写坏 */
const RUN_LOG = path.join(STATE_DIR, 'ref-move-watch.log')

function note(obj) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true })
    fs.appendFileSync(RUN_LOG, `${JSON.stringify({ ts: new Date().toISOString(), ...obj })}\n`, 'utf8')
  } catch {
    /* 记账失败不影响判定 */
  }
}

/** 只读 git,失败返回 null(不抛) */
function git(args, { root = ROOT } = {}) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

/** 0=后代 1=不是后代 null=未判定 */
export function isAncestor(oldSha, newSha, { root = ROOT } = {}) {
  if (!oldSha || !newSha) return null
  const r = git(['merge-base', '--is-ancestor', oldSha, newSha], { root })
  if (r === null) {
    // execFileSync 非 0 会抛 ⇒ 用 --is-ancestor 的退出码区分:这里改用 execFileSync 捕获退出码
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', oldSha, newSha], { cwd: root, windowsHide: true, stdio: ['ignore', 'ignore', 'ignore'] })
      return 0
    } catch (e) {
      const code = typeof e?.status === 'number' ? e.status : null
      if (code === 1) return 1
      return null
    }
  }
  return 0
}

/** 纯判据:给定前像与现像,判"这次位移有没有丢提交" */
export function judgeRefMove({ prevHead, curHead, ancestor }) {
  if (!prevHead) return { status: 'no-prior', lost: false }
  if (!curHead) return { status: 'unjudged', lost: null, why: '读不到当前 HEAD' }
  if (prevHead === curHead) return { status: 'still', lost: false }
  if (ancestor === 0) return { status: 'forward', lost: false }
  if (ancestor === 1) return { status: 'lost', lost: true }
  return { status: 'unjudged', lost: null, why: '祖先关系问不到(对象缺失或半恢复仓)' }
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  } catch {
    return null
  }
}

function writeState(head) {
  fs.mkdirSync(STATE_DIR, { recursive: true })
  fs.writeFileSync(STATE_FILE, `${JSON.stringify({ head, ts: new Date().toISOString() }, null, 2)}\n`, 'utf8')
}

/**
 * 归因:这次位移是不是「从旧基线重建」造成的 —— 判据只看结构(新头部是不是旧头部的孩子),
 * 不猜写入者。它给出的是**可追责的事实**(新链的父是谁),不是指控。
 */
export function attributeMove({ prevHead, curHead, parentOf }) {
  if (!prevHead || !curHead) return { staleBase: null, why: '输入不全' }
  const curParent = parentOf(curHead)
  if (!curParent) return { staleBase: null, curParent: null, why: '读不到新头部的父' }
  if (curParent === prevHead) return { staleBase: false, curParent }
  return { staleBase: true, curParent, why: '新头部的父不是旧头部 ⇒ 落地基线落后于主线' }
}

/**
 * 自动回补(2026-11-18):被丢的提交仍在对象库里 —— 只要它与当前头部**无冲突**,
 * 就用「合并提交」把它接回 main(`commit-tree` + `update-ref <new> <expected-old>`)。
 * 这是真正让主线自愈的那一步;有冲突/超量/被 CAS 拒绝时**一律不硬做**,
 * 只留 preserve 分支 + 告警(失效方向永远是"多留一份",§0.10)。
 */
export function tryRestore({ curHead, droppedShas, root = ROOT, attest = true }) {
  if (process.env.IHUI_REF_MOVE_NO_RESTORE === '1') return { ok: false, why: 'kill-switch(IHUI_REF_MOVE_NO_RESTORE=1)' }
  if (!droppedShas.length) return { ok: false, why: '无丢失' }
  if (droppedShas.length > 5) return { ok: false, why: `丢失 ${droppedShas.length} 枚 > 5,交人工(不自动合并)` }
  const run = (args, { throwOn = true } = {}) => {
    try {
      const out = execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
      return { ok: true, out }
    } catch (e) {
      if (throwOn) return { ok: false, out: String(e?.stdout || '').trim(), code: e?.status }
      throw e
    }
  }
  let base = curHead
  const applied = []
  for (const sha of droppedShas) {
    const merged = run(['merge-tree', '--write-tree', base, sha])
    if (!merged.ok) return { ok: false, why: `合并冲突,未回补:${sha.slice(0, 11)}`, applied }
    const tree = merged.out.split(/\r?\n/)[0].trim()
    if (!/^[0-9a-f]{40}|[0-9a-f]{64}$/.test(tree)) return { ok: false, why: 'merge-tree 没给出树对象(未判定)', applied }
    const msg = `chore(ref-restore): 守夜人自动回补被位移丢弃的提交 ${sha.slice(0, 11)}\n\n原提交仍挂在 preserve 分支,本枚仅把它接回 main 的祖先线。`
    const made = run(['commit-tree', tree, '-p', base, '-p', sha, '-m', msg])
    if (!made.ok) return { ok: false, why: 'commit-tree 失败', applied }
    base = made.out.trim()
    applied.push(sha)
  }
  const cas = run(['update-ref', 'refs/heads/main', base, curHead])
  if (!cas.ok) return { ok: false, why: 'CAS 被拒(别人又推进了 main),不硬写', applied }
  if (attest) {
    try {
      fs.appendFileSync(
        path.join(STATE_DIR, 'safe-commit-attestation.jsonl'),
        `${JSON.stringify({ ts: new Date().toISOString(), kind: 'bypass-landing', gatesRun: false, ranFullBatch: false, reason: '守夜人自动回补(commit-tree + CAS,仅无冲突档)', paths: ['refs/heads/main'] })}\n`,
        'utf8',
      )
    } catch {
      /* 记账失败不影响已完成的恢复 */
    }
  }
  return { ok: true, newHead: base, applied }
}

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function main(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith('--')))
  if (flags.has('--self-test')) return selfTest()

  const curHead = git(['rev-parse', 'HEAD'])
  if (!curHead) {
    console.log('[ref-move-loss] 未判定:读不到 HEAD')
    return 2
  }
  if (flags.has('--reset')) {
    writeState(curHead)
    note({ status: 'reset', curHead })
    console.log(`[ref-move-loss] 记号已对齐到 ${curHead.slice(0, 11)}`)
    return 0
  }

  const st = readState()
  const prevHead = st?.head ?? null
  const ancestor = prevHead && prevHead !== curHead ? isAncestor(prevHead, curHead) : null
  const verdict = judgeRefMove({ prevHead, curHead, ancestor })

  if (verdict.status === 'no-prior') {
    writeState(curHead)
    note({ status: 'no-prior', curHead })
    console.log(`[ref-move-loss] 首次建档:${curHead.slice(0, 11)}(无前像可比,如实报"未判过"而非绿)`)
    return 0
  }
  if (verdict.status === 'still') {
    note({ status: 'still', curHead })
    console.log(`[ref-move-loss] 未位移:${curHead.slice(0, 11)}`)
    return 0
  }
  if (verdict.status === 'unjudged') {
    note({ status: 'unjudged', prevHead, curHead, why: verdict.why })
    console.log(`[ref-move-loss] 未判定:${verdict.why}(前像 ${String(prevHead).slice(0, 11)} → 现像 ${curHead.slice(0, 11)})`)
    return 2
  }
  if (verdict.status === 'forward') {
    writeState(curHead)
    note({ status: 'forward', prevHead, curHead })
    console.log(`[ref-move-loss] 正常推进:${prevHead.slice(0, 11)} → ${curHead.slice(0, 11)}(旧 HEAD 仍是祖先,零丢失)`)
    return 0
  }

  // ---- 丢失档:旧 HEAD 掉出祖先线 ----
  const dropped = git(['log', '--format=%H %s', '--max-count=20', `${curHead}..${prevHead}`]) ?? ''
  const droppedLines = dropped.split(/\r?\n/).filter(Boolean)
  const countRaw = git(['rev-list', '--count', `${curHead}..${prevHead}`])
  const droppedCount = countRaw === null ? droppedLines.length : Number(countRaw)

  const branch = `preserve/refmove-${prevHead.slice(0, 11)}-${stamp()}`
  let preserved = false
  let preserveError = ''
  if (!flags.has('--check')) {
    const made = git(['branch', branch, prevHead])
    preserved = made !== null
    if (!preserved) preserveError = 'git branch 失败(见 §22:不得先删后想)'
  }

  // 归因 + 自动回补(先保全再回补:保全在前,回补失败也不会丢)
  const attribution = attributeMove({
    prevHead,
    curHead,
    parentOf: (sha) => {
      const p = git(['rev-parse', `${sha}^`])
      return p && p !== sha ? p : null
    },
  })
  const droppedShas = (git(['rev-list', '--reverse', `${curHead}..${prevHead}`]) ?? '').split(/\r?\n/).filter(Boolean)
  const restore = flags.has('--check') ? { ok: false, why: '--check 档只判不补' } : tryRestore({ curHead, droppedShas })

  const record = {
    detectedAt: new Date().toISOString(),
    prevHead,
    curHead,
    droppedCount,
    droppedSample: droppedLines.slice(0, 20),
    preserved,
    preserveBranch: preserved ? branch : null,
    preserveError: preserveError || null,
    attribution,
    restore: { ok: !!restore.ok, why: restore.why || null, newHead: restore.newHead || null, applied: restore.applied || [] },
  }
  if (!flags.has('--check')) {
    fs.mkdirSync(STATE_DIR, { recursive: true })
    fs.appendFileSync(LEDGER_FILE, `${JSON.stringify(record)}\n`, 'utf8')
    // 回补成功 ⇒ 记号对齐到回补后的头部,否则下一轮会把自愈当成新的位移(自锁)
    writeState(restore.ok ? restore.newHead : curHead)
  }
  note({
    status: 'lost',
    prevHead,
    curHead,
    droppedCount,
    preserved,
    preserveBranch: preserved ? branch : null,
    restored: !!restore.ok,
    restoredHead: restore.newHead || null,
    staleBase: attribution?.staleBase ?? null,
  })

  console.log(
    `❌ [ref-move-loss] HEAD 被搬到不含前像的链上:${prevHead.slice(0, 11)} → ${curHead.slice(0, 11)},` +
      `被丢 ${droppedCount} 枚`,
  )
  for (const l of droppedLines.slice(0, 6)) console.log(`    ${l}`)
  if (droppedCount > 6) console.log(`    …(共 ${droppedCount} 枚,明细取前 20 条)`)
  console.log(
    preserved
      ? `🔒 已保全:被丢的提交现在挂在分支 ${branch}(内容永久可达,§22 删除安全规则)`
      : flags.has('--check')
        ? 'ℹ️ --check 档:只判不保全(--apply/默认档才会落 preserve 分支)'
        : `❌ 保全失败:${preserveError} —— 事务仍可达于 ${prevHead.slice(0, 11)},请人工先打分支再继续`,
  )
  if (attribution?.staleBase) {
    console.log(`🔎 归因:新头部的父 ${String(attribution.curParent).slice(0, 11)} 不是旧头部 ⇒ 落地基线落后于主线(结构事实,不猜写入者)`)
  }
  console.log(
    restore.ok
      ? `🧵 已自动回补:${restore.applied.length} 枚接回 main(CAS 推进),新头部 ${restore.newHead.slice(0, 11)}`
      : `ℹ️ 未自动回补:${restore.why || '无原因'}`,
  )
  return 1
}

function selfTest() {
  let fail = 0
  const eq = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want)
    if (!ok) {
      fail += 1
      console.log(`  ✗ ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)
    } else console.log(`  ✓ ${name}`)
  }
  eq('无前像', judgeRefMove({ prevHead: null, curHead: 'b', ancestor: null }).status, 'no-prior')
  eq('原地不动', judgeRefMove({ prevHead: 'a', curHead: 'a', ancestor: null }).status, 'still')
  eq('正常推进', judgeRefMove({ prevHead: 'a', curHead: 'b', ancestor: 0 }).status, 'forward')
  eq('位移丢提交', judgeRefMove({ prevHead: 'a', curHead: 'b', ancestor: 1 }).status, 'lost')
  eq('祖先问不到 ⇒ 未判定', judgeRefMove({ prevHead: 'a', curHead: 'b', ancestor: null }).status, 'unjudged')
  eq(
    '归因:父=旧头 ⇒ 非落后基线',
    attributeMove({ prevHead: 'a', curHead: 'b', parentOf: () => 'a' }).staleBase,
    false,
  )
  eq(
    '归因:父≠旧头 ⇒ 落后基线',
    attributeMove({ prevHead: 'a', curHead: 'b', parentOf: () => 'x' }).staleBase,
    true,
  )
  eq(
    '归因:读不到父 ⇒ 未判定',
    attributeMove({ prevHead: 'a', curHead: 'b', parentOf: () => null }).staleBase,
    null,
  )
  console.log(fail === 0 ? '✅ self-test 8/8' : `❌ self-test ${8 - fail}/8`)
  return fail === 0 ? 0 : 1
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
if (invokedDirectly) process.exit(main(process.argv.slice(2)))
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
