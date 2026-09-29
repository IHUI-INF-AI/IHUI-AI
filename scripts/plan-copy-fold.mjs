#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 台账"重复登记副本"的归并出口(§1 规矩 2:一个编号只能有一行当前状态 —— 副本翻勾并写明
 * 归并到谁,**不删行、正文一字不改**)。
 *
 * 为什么另开一把,而不是用 `plan-tasks-merge --heal`:那条出口要求剥掉状态后**正文逐字相等**,
 * 而真仓里的副本行普遍自带 `〔【归并】…〕` 声明或各自的进度注记 ⇒ 它恒拒(2026-09-29 实测:
 * 派单口径里"同题已完成副本"与"已标副本指针"合计约 1.6k 行,--heal 一条也收不掉)。
 * 判据换成主键那一维(仍走 `plan-task-index` 的同一份 `keyOfRow`/`parseTaskRows`,不在别处再抄):
 *  - `--mode f1`      :未勾行与一条**已勾行**同复合主键 ⇒ 翻勾(= F1 的正解处置)
 *  - `--mode declared`:上述 ∧ 该行自己声明是副本 ⇒ 翻勾(最保守档)
 * 两条额外收紧(比 --heal 更窄的地方):① 带租约牌 `（进行中…）` 的行**一条都不动**(替别人
 * 持有中的认领翻勾 = §16 越权);② 缺 `--apply` 只做自证并写候选到 `--out`,不落对象库。
 * 四条硬自证见 audit():行数不变 / 只动未勾且无租约的行 / 新行以 `- [x] ✅(日) `+原正文逐字开头 /
 * 未勾选必下降且逐字重复多重集不上升。任一不成立 ⇒ 抛错退出,不落盘。
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { keyOfRow, parseTaskRows } from './lib/plan-task-index.mjs'

/**
 * `--root` 是**测试通道**(镜像测试用临时 git 仓喂夹具)。生产不带 ⇒ 语义不变。
 * 为什么必须有它:本器按 `HEAD:PROJECT_PLAN.md` 取台账,没有换根通道就只能对真仓现刻做断言,
 * 而那种断言正是守门 70 那 13/14 恒红的同一型失效(测试靠 cwd 定位夹具,生产按定义忽略 cwd)。
 */
const TEST_ROOT = process.argv.find((a2) => a2.startsWith('--root='))?.slice(7) ?? ''
const ROOT = TEST_ROOT ? resolve(TEST_ROOT) : resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TICK = String.fromCodePoint(0x2705)
const SELF_DECL = /〔[^〕]*(重复登记副本|派单以那条为准|本行不再单独派单)[^〕]*〕/
const CLAIM = /（进行中/
const git = (a) => execFileSync('git', ['-c', 'safe.directory=*', '-C', ROOT, ...a], { maxBuffer: 1 << 28, windowsHide: true }).toString()

const argv = process.argv.slice(2)
const flag = (n, d) => {
  const hit = argv.find((s) => s.startsWith(`--${n}=`))
  return hit ? hit.slice(n.length + 3) : d
}
const mode = flag('mode', 'f1')
const day = flag('day', new Date().toISOString().slice(0, 10))
const out = flag('out', '')
const APPLY = argv.includes('--apply')
if (mode !== 'f1' && mode !== 'declared') {
  console.error(`❌ --mode 只认 f1|declared(现得 ${mode})⇒ 不猜`)
  process.exit(2)
}

const text = git(['show', `HEAD:${'PROJECT_PLAN.md'}`])
const orig = text.split('\n')
const lines = orig.slice()
const rows = parseTaskRows(text)
const byKey = new Map()
for (const r of rows) {
  if (!r.key) continue
  if (!byKey.has(r.key)) byKey.set(r.key, [])
  byKey.get(r.key).push(r)
}

let folded = 0
let skippedClaim = 0
const samples = []
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  if (!/^- \[ \]/.test(line)) continue
  if (CLAIM.test(line)) {
    skippedClaim++
    continue
  }
  if (mode === 'declared' && !SELF_DECL.test(line)) continue
  const k = keyOfRow(line)
  if (!k) continue
  if (!(byKey.get(k) || []).some((r) => r.state === 'done' && r.raw !== line)) continue
  const tag = mode === 'declared' ? '归并' : '归并·F1'
  const why =
    mode === 'declared'
      ? `本行自述为重复登记副本,且同主键 \`${k}\` 存在已闭环持有行`
      : `本行与一条已闭环登记同复合主键 \`${k}\``
  const note = ` ${TICK}(${day}) **[${tag}]** ${why} ⇒ 只落状态、写明归并到谁,**不删行、正文一字未改**;进度以主件那行为准(§1 规矩 2)。`
  lines[i] = `- [x] ${TICK}(${day}) ${line.slice('- [ ] '.length)}${note}`
  folded++
  if (samples.length < 8) samples.push(k)
}

function audit() {
  const next = lines.join('\n')
  const now = next.split('\n')
  if (now.length !== orig.length) throw new Error(`行数 ${orig.length}→${now.length}:本器一律不删行`)
  let changed = 0
  for (let i = 0; i < orig.length; i++) {
    if (orig[i] === now[i]) continue
    changed++
    if (!/^- \[ \]/.test(orig[i])) throw new Error(`行 ${i + 1}:动了非未勾行`)
    if (CLAIM.test(orig[i])) throw new Error(`行 ${i + 1}:动了带租约牌的认领行(§16 越权)`)
    if (mode === 'declared' && !SELF_DECL.test(orig[i])) throw new Error(`行 ${i + 1}:动了无自述声明的行`)
    const body = orig[i].slice('- [ ] '.length)
    if (!now[i].startsWith(`- [x] ${TICK}(${day}) ${body}`)) throw new Error(`行 ${i + 1}:正文不是逐字前缀`)
  }
  if (changed !== folded) throw new Error(`动了 ${changed} 行 ≠ 归并 ${folded} 行`)
  const un = (s) => (s.match(/^- \[ \]/gm) || []).length
  if (un(next) >= un(text)) throw new Error(`未勾选总数没有下降(${un(text)}→${un(next)}):无事可做或判据失效`)
  const dup = (s) => {
    const m = new Map()
    for (const l of s.split('\n')) m.set(l.trim(), (m.get(l.trim()) || 0) + 1)
    let n = 0
    for (const [, c] of m) if (c > 1) n += c - 1
    return n
  }
  if (dup(next) > dup(text)) throw new Error('逐字重复行多重集上升(造出了新副本)')
  return { b: un(text), a: un(next), d1: dup(text), d2: dup(next) }
}

const a = audit()
const next = lines.join('\n')
console.log(
  `${APPLY ? 'APPLY' : 'DRY'} mode=${mode} 归并 ${folded} 行(跳过带租约 ${skippedClaim});未勾选 ${a.b}→${a.a};逐字重复 ${a.d1}→${a.d2}`,
)
console.log(`样例主键:${samples.join(' / ')}`)
if (!APPLY) {
  if (out) {
    writeFileSync(resolve(ROOT, out), next, 'utf8')
    console.log(`候选已写 ${out}(未落对象库;落地走 scripts/object-space-land.mjs 的 blob 档)`)
  } else {
    console.log('未写候选:加 --out <相对路径> 落一份候选(仍不动 git)。')
  }
  process.exit(0)
}
if (APPLY) {
  const blob = execFileSync('git', ['-c', 'safe.directory=*', '-C', ROOT, 'hash-object', '-w', '--stdin'], {
    input: next,
    maxBuffer: 1 << 26,
    windowsHide: true,
  })
    .toString()
    .trim()
  const manifest = join(ROOT, '.ihui-agent/tmp/plan-copy-fold.blob.json')
  writeFileSync(resolve(ROOT, manifest), JSON.stringify({ files: [{ path: 'PROJECT_PLAN.md', blob }] }), 'utf8')
  console.log('blob=' + blob + '  清单=' + manifest)
  console.log(
    '落地走共享出口(本器不碰 HEAD/索引,避免与并发会话抢 CAS):LAND_PATHS=PROJECT_PLAN.md ' +
      'LAND_BLOBS=' + manifest + ' LAND_BLOB_PROOF=<上面四条自证的原文> node scripts/object-space-land.mjs',
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
