// Wave3 落地器:把我的增量重放到远端当前尖并推送;远端在窗口内推进就整轮重来(最多 N 次)。
// 为什么不用双父合并:本枚不动 PROJECT_PLAN.md,而 merge 会把我这侧旧台账快照当"本侧独有内容",
// 触发 union-converge 的 F4/F6 needHuman 与 5 枚语言包 merge-file 冲突区(2026-10-27 实测)。
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = 'D:/IHUI-AI-wt/gap-screens'
const MY_COMMIT = process.argv[2] || '8b86987da03a2db9054a672b8076d2a5f390e137'
const MSG = path.join(ROOT, '.ihui-agent/tmp/p10-msg2.txt')
const MAX = Number(process.argv[3] || 4)
const stdio = ['ignore', 'pipe', 'pipe']
const git = (args, opts = {}) =>
  execFileSync('git', args, { cwd: ROOT, stdio, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts })

// 本枚改动面 = MY_COMMIT 相对其父的真实文件集(权威,不手拼)
const delta = git(['diff-tree', '--no-commit-id', '--name-only', '-r', MY_COMMIT])
  .split(/\r?\n/)
  .filter(Boolean)
const newOnly = git(['diff-tree', '--no-commit-id', '--name-only', '-r', '--diff-filter=A', MY_COMMIT])
  .split(/\r?\n/)
  .filter(Boolean)
const touched = delta.filter((p) => !newOnly.includes(p))
console.log(`本枚文件 ${delta.length}(其中新建 ${newOnly.length}/改既有 ${touched.length})`)
if (delta.length === 0) {
  console.error('❌ 取不到改动面 ⇒ 未判定,不落盘')
  process.exit(2)
}

// 私信并入补丁(它是我这枚对既有件的增量,重放时逐轮重打)
let plPatch = ''
if (touched.includes('packages/api-client/src/endpoints/private-letters.ts')) {
  plPatch = path.join(ROOT, '.ihui-agent/tmp/pl-live.patch')
  fs.writeFileSync(plPatch, git(['diff', `${MY_COMMIT}^`, MY_COMMIT, '--', 'packages/api-client/src/endpoints/private-letters.ts']))
}

// 提交信息取本枚自身原文(不硬编码上一批的 msg 文件,免得信息漂移)
const msgFile = path.join(ROOT, '.ihui-agent/tmp/graft-msg.txt')
fs.writeFileSync(
  msgFile,
  `${git(['show', MY_COMMIT, '--format=%B', '--no-patch']).trim()}\n\n落地口径:本枚把我的改动面重放到远端当前尖(只换父不换字节),` +
    `不用双父合并 —— 本枚不动 PROJECT_PLAN.md,而 merge 会把我这侧旧台账快照当"本侧独有内容"带进判定面,\n` +
    `实测触发 union-converge 的 F4 副本行/F6 整块重复 needHuman 与 5 枚语言包 merge-file 冲突区,并对远端既存红逐道误归到本枚。\n`,
)

for (let attempt = 1; attempt <= MAX; attempt++) {
  console.log(`\n===== 第 ${attempt}/${MAX} 轮 =====`)
  git(['fetch', 'origin', 'main'])
  const T = git(['rev-parse', 'FETCH_HEAD']).trim()
  console.log('远端当前尖 =', T.slice(0, 12))

  // 前置校验:本枚改判的路由集从提交自身的 ledger 差异取
  // (硬编码上一批的清单会把"我此前已落地的批"误判成远端改判 ⇒ 假停手)
  const readLedger = (rev) =>
    new Map(
      git(['show', `${rev}:scripts/data/web-rn-screen-map.jsonl`])
        .split(/\r?\n/)
        .filter(Boolean)
        .map((l) => {
          const r = JSON.parse(l)
          return [r.web, r]
        }),
    )
  const before = readLedger(`${MY_COMMIT}^`)
  const after = readLedger(MY_COMMIT)
  const flipped = [...after.keys()].filter((w) => before.get(w)?.status !== after.get(w).status)
  if (!flipped.length) {
    console.error('⛔ 本枚没有改判任何路由 ⇒ 停手')
    process.exit(2)
  }
  const remoteRows = [...readLedger(T).values()]
  const notePrefix = String(after.get(flipped[0])?.note || '').slice(0, 12)
  const badUpgrade = flipped.filter((w) => {
    const mine = after.get(w)
    const r = remoteRows.find((x) => x.web === w)
    if (!r) return true
    // 降账(aligned→gap)不构成"为消红补数字",允许带证据覆盖;升账必须远端仍是无人处置的 gap
    const downgrading = mine.status === 'gap' && r.status !== 'gap'
    if (downgrading) return false
    if (r.status === 'gap') return false
    return !(r.status === 'aligned' && String(r.note || '').startsWith(notePrefix))
  })
  if (badUpgrade.length) {
    console.error(`⛔ 这些路由远端已用不同依据处置过(${badUpgrade.join(', ')})⇒ 停手交人工,不覆盖别人的判定`)
    process.exit(2)
  }
  const downgrades = flipped.filter((w) => after.get(w).status === 'gap' && remoteRows.find((x) => x.web === w)?.status !== 'gap')
  console.log(`本枚改判 ${flipped.length} 条:`, flipped.join(', '))
  if (downgrades.length) console.log(`  其中降账(有证据下调账面,非消红): ${downgrades.join(', ')}`)
  // 前置校验:我的新建件在远端是否已存在(撞名就不能盲落)
  const remoteTree = new Set(git(['ls-tree', '-r', '--name-only', T]).split(/\r?\n/))
  const clash = newOnly.filter((p) => remoteTree.has(p))
  if (clash.length) {
    console.error(`⛔ 远端已有同名文件:${clash.join(', ')} ⇒ 停手交人工`)
    process.exit(2)
  }

  // 取远端版的既有件,再把我的增量重放上去
  git(['checkout', T, '--', ...touched])
  if (plPatch && fs.readFileSync(plPatch, 'utf8').trim()) {
    try {
      git(['apply', path.relative(ROOT, plPatch)])
    } catch (e) {
      console.error('⛔ 私信并入补丁打不上 ⇒ 停手:', String(e.stderr || e.message).slice(0, 200))
      process.exit(2)
    }
  }
  execFileSync(process.execPath, [path.join(ROOT, '.ihui-agent/wave1/apply-manifests.mjs'), 'wave3'], {
    cwd: ROOT,
    stdio,
    encoding: 'utf8',
  })

  // 造 graft 提交:树 = 远端树 + 我的 27 个文件字节
  const IDX = path.join(ROOT, '.ihui-agent/tmp/graft-live.idx')
  try { fs.unlinkSync(IDX) } catch {}
  git(['read-tree', T], { env: { ...process.env, GIT_INDEX_FILE: IDX } })
  git(['add', '--', ...delta], { env: { ...process.env, GIT_INDEX_FILE: IDX } })
  const TREE = git(['write-tree'], { env: { ...process.env, GIT_INDEX_FILE: IDX } }).trim()
  const NEW = git(['commit-tree', TREE, '-p', T, '-F', msgFile]).trim()
  const real = git(['diff', '--name-only', T, NEW]).split(/\r?\n/).filter(Boolean)
  console.log(`graft=${NEW.slice(0, 12)} 相对远端尖真实增量=${real.length} 件`)
  if (real.length !== delta.length) {
    console.error(`⛔ 增量件数与预期不符(${real.length} ≠ ${delta.length})⇒ 停手`)
    process.exit(2)
  }

  git(['update-ref', 'refs/heads/gap-screens', NEW])
  git(['reset', '--hard', NEW])

  try {
    git(['push', 'origin', `${NEW}:main`], { stdio: ['ignore', 'pipe', 'pipe'] })
    console.log('✅ 推送成功')
    console.log(`local=${git(['rev-parse', 'HEAD']).trim()}`)
    console.log(`remote=${git(['ls-remote', 'origin', 'main']).trim().split(/\s/)[0]}`)
    process.exit(0)
  } catch (e) {
    const msg = String((e.stderr || '') + (e.stdout || ''))
    if (/non-fast-forward|fetch first|cannot lock ref/.test(msg)) {
      console.log('↻ 远端在窗口内又推进了(non-FF 或 ref CAS 失败)⇒ 整轮重来(不强推、不 --force-with-lease)')
      continue
    }
    console.error('⛔ 推送被拒(非 non-FF),原文末 12 行:')
    console.error(msg.split(/\r?\n/).slice(-12).join('\n'))
    process.exit(1)
  }
}
console.error('❌ 达到重试上限,远端推进速度超过落地速度;本轮未落地')
process.exit(1)
