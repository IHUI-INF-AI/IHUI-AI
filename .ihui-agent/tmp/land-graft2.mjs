// 落地器 v2:对每个触及文件做**逐路径三方合并**(base=我父提交, ours=远端当前尖, theirs=我的提交),
// 不再假设"改既有件都能由 manifest 再生" —— v1 对手写源文件 checkout 远端版,把自己的编辑冲掉了
// (实测 graft 相对远端只差 1 件,被件数断言逮住)。
// 台账(JSONL)按主键 web 逐行三方:远端没动 ⇒ 取我的;我没动 ⇒ 取远端;两边都动 ⇒ 停手。
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = 'D:/IHUI-AI-wt/gap-screens'
const MY_COMMIT = process.argv[2]
const MAX = Number(process.argv[3] || 6)
if (!MY_COMMIT) {
  console.error('用法: node land-graft2.mjs <本地提交 sha> [重试次数]')
  process.exit(2)
}
const BASE = `${MY_COMMIT}^`
const stdio = ['ignore', 'pipe', 'pipe']
const git = (args, opts = {}) =>
  execFileSync('git', args, { cwd: ROOT, stdio, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts })
const blob = (rev, p) => {
  try {
    return git(['show', `${rev}:${p}`])
  } catch {
    return null
  }
}

const delta = git(['diff-tree', '--no-commit-id', '--name-only', '-r', MY_COMMIT]).split(/\r?\n/).filter(Boolean)
if (!delta.length) {
  console.error('❌ 取不到本枚改动面 ⇒ 未判定')
  process.exit(2)
}
const JSONL = /\.jsonl$/
const newOnly = git(['diff-tree', '--no-commit-id', '--name-only', '-r', '--diff-filter=A', MY_COMMIT]).split(/\r?\n/).filter(Boolean)
console.log(`本枚 ${delta.length} 件(新建 ${newOnly.length}/改既有 ${delta.length - newOnly.length})`)

// 台账改判集合的前置校验(只允许降账覆盖别人判定,禁止升账覆盖)
const readLedgerText = (rev) => blob(rev, 'scripts/data/web-rn-screen-map.jsonl')
const parse = (t) => new Map(String(t).split(/\r?\n/).filter(Boolean).map((l) => { const r = JSON.parse(l); return [r.web, r] }))
let flipped = []
if (delta.includes('scripts/data/web-rn-screen-map.jsonl')) {
  const b = parse(readLedgerText(BASE))
  const a = parse(readLedgerText(MY_COMMIT))
  flipped = [...a.keys()].filter((w) => b.get(w)?.status !== a.get(w).status)
}

for (let attempt = 1; attempt <= MAX; attempt++) {
  console.log(`\n===== 第 ${attempt}/${MAX} 轮 =====`)
  git(['fetch', 'origin', 'main'])
  const T = git(['rev-parse', 'FETCH_HEAD']).trim()
  console.log('远端当前尖 =', T.slice(0, 12))

  if (flipped.length) {
    const base = parse(readLedgerText(BASE))
    const mine = parse(readLedgerText(MY_COMMIT))
    const remote = parse(readLedgerText(T))
    const bad = flipped.filter((w) => {
      const m = mine.get(w); const r = remote.get(w); const b = base.get(w)
      if (!r) return true
      if (m.status === 'gap' && r.status !== 'gap') return false // 降账
      if (r.status === 'gap' && (b?.status ?? 'gap') === 'gap') return false // 远端仍未处置
      return !(r.status === m.status && String(r.note || '') === String(m.note || ''))
    })
    if (bad.length) {
      console.error(`⛔ 远端已用不同依据处置(${bad.join(', ')})⇒ 停手交人工`)
      process.exit(2)
    }
  }
  const remoteTree = new Set(git(['ls-tree', '-r', '--name-only', T]).split(/\r?\n/))
  const clash = newOnly.filter((p) => remoteTree.has(p) && blob(T, p) !== blob(MY_COMMIT, p))
  if (clash.length) {
    console.error(`⛔ 远端已有同名但不同内容的文件:${clash.join(', ')} ⇒ 停手`)
    process.exit(2)
  }

  const IDX = path.join(ROOT, '.ihui-agent/tmp/graft2.idx')
  try { fs.unlinkSync(IDX) } catch {}
  git(['read-tree', T], { env: { ...process.env, GIT_INDEX_FILE: IDX } })
  const conflicts = []
  for (const p of delta) {
    const rb = blob(T, p)
    const base = blob(BASE, p)
    const my = blob(MY_COMMIT, p)
    if (rb === my) continue // 远端已同内容
    if (rb === base || rb === null) {
      // 远端自基底以来没动(或这是我新建的)⇒ 直接取我的版本
      if (my === null) { conflicts.push(`${p}: 我的提交里没有该文件`); continue }
      fs.writeFileSync(path.join(ROOT, p), my)
      continue
    }
    if (!JSONL.test(p)) {
      conflicts.push(`${p}: 远端与本地同文件都被改过(非 JSONL,无法逐行三方) ⇒ 需人工判`)
      continue
    }
    // JSONL:按主键三方
    const kb = new Map(String(base || '').split(/\r?\n/).filter(Boolean).map((l) => { const r = JSON.parse(l); return [r.web, l] }))
    const kr = new Map(String(rb).split(/\r?\n/).filter(Boolean).map((l) => { const r = JSON.parse(l); return [r.web, l] }))
    const km = new Map(my.split(/\r?\n/).filter(Boolean).map((l) => { const r = JSON.parse(l); return [r.web, l] }))
    const order = [...km.keys()]
    const outLines = []
    let bad = 0
    for (const k of order.concat([...kr.keys()].filter((x) => !km.has(x)))) {
      const b0 = kb.get(k); const r0 = kr.get(k); const m0 = km.get(k)
      if (m0 === undefined) { if (r0 !== undefined) outLines.push(r0); continue }
      if (r0 === b0) outLines.push(m0)
      else if (m0 === b0) outLines.push(r0)
      else { bad++; outLines.push(r0) }
    }
    if (bad) conflicts.push(`${p}: ${bad} 个主键两侧同改 ⇒ 已取远端,需人工复核`)
    else fs.writeFileSync(path.join(ROOT, p), outLines.join('\n') + '\n')
  }
  if (conflicts.length) {
    console.error('⛔ 需人工判:')
    for (const c of conflicts) console.error('   · ' + c)
    process.exit(2)
  }
  git(['add', '--', ...delta], { env: { ...process.env, GIT_INDEX_FILE: IDX } })
  const TREE = git(['write-tree'], { env: { ...process.env, GIT_INDEX_FILE: IDX } }).trim()
  const msgFile = path.join(ROOT, '.ihui-agent/tmp/graft2-msg.txt')
  fs.writeFileSync(msgFile, git(['show', MY_COMMIT, '--format=%B', '--no-patch']).trim() + `\n\n落地口径:graft 重放(只换父不换字节,基线 ${T.slice(0, 12)}),逐路径三方合并;不用双父 merge(会把本侧旧台账快照带进判定面)。\n`)
  const NEW = git(['commit-tree', TREE, '-p', T, '-F', msgFile]).trim()
  const real = git(['diff', '--name-only', T, NEW]).split(/\r?\n/).filter(Boolean)
  console.log(`graft=${NEW.slice(0, 12)} 相对远端真实增量=${real.length}/${delta.length} 件`)
  if (real.length !== delta.length) {
    console.error('⛔ 增量件数不符 ⇒ 停手(不推半份)')
    process.exit(2)
  }
  git(['update-ref', 'refs/heads/gap-screens', NEW])
  git(['reset', '--hard', NEW])
  try {
    git(['push', 'origin', `${NEW}:main`])
    console.log('✅ 推送成功')
    console.log(`local=${git(['rev-parse', 'HEAD']).trim()}`)
    console.log(`remote=${git(['ls-remote', 'origin', 'main']).trim().split(/\s/)[0]}`)
    process.exit(0)
  } catch (e) {
    const msg = String((e.stderr || '') + (e.stdout || ''))
    if (/non-fast-forward|fetch first|cannot lock ref/.test(msg)) {
      console.log('↻ 远端又推进 ⇒ 整轮重来')
      continue
    }
    console.error('⛔ 推送失败(非竞态),末 14 行:')
    console.error(msg.split(/\r?\n/).slice(-14).join('\n'))
    process.exit(1)
  }
}
console.error('❌ 达到重试上限')
process.exit(1)
