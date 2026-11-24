// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * fix-rn-color-literals.mjs 的**归属闸**镜像测试(2026-11-03 立)。
 *
 * 为什么必须有这道闸(机主要求"全部自动化"的前置条件):--apply 原先**不校验路径归属**,
 * 而 `land-*-style-tiers` 那一族是有这道闸的。多会话共享工作区里,自动腿写他席正在编辑的文件
 * = 覆盖别人的未提交工作(AGENTS.md §12 / §16 明令的事故型)。判据单源 =
 * `scripts/lib/git-paths.mjs`(`ownershipGate` = `ownershipDirtyPathsDetailed` + `isCleanOwned`),
 * 本文件只 import 生产出口,零复制判据(§22c / 门 191)。
 *
 * 钉什么:
 *  ① 正向:落点干净(已入库)⇒ ownershipPlan 放行 → 真写盘 → 批末登记 1 条 →
 *     collectiblePaths 判成 collectible(证明闸没把主流程挡死,也没换掉落点账本那一层);
 *  ② 反向:**他席在飞**的真实形态(索引 == HEAD、工作树被第三方改过 ⇒ porcelain ` M`)⇒ 该路径
 *     进 held 并被逐条点名、不进 writable ⇒ 落盘腿结构上跑不到它 ⇒ 文件字节与临时仓 porcelain 面
 *     **逐字节不变**、账本一行都不登记(断言"副作用没发生",不是只看返回值);
 *  ③ 取不到输入(根不是 git 仓)⇒ plan.ok=false ⇒ 一条都不写 + 点名带原因;
 *  ④ 阳性对照:同一夹具同时放"干净路径"与"他席路径"⇒ 只写了前者、账本只有前者
 *     (只测否定等于没测);
 *  ⑤ 形状锁:裁决腿零写盘(函数体内不得出现任何写动作)、主循环只遍历 plan.writable、
 *     --check / --emit-blobs / HEAD 面判据与 colorsAgree 前置一字未动。
 *
 * 夹具纪律:临时 git 仓一律 mkScratch(§15b,不落仓库树内 —— 守门 208);真实工作树在本文件内
 * **只读不写**(写档一律打向 mkScratch 根)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { gitRaw } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { collectiblePaths, readLanding } from '../lib/cross-end-landing-ledger.mjs'
import { __test__ as leg, LEG_NAME } from '../fix-rn-color-literals.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'fix-rn-color-literals.mjs')
const SRC = readFileSync(SCRIPT, 'utf8')

const { ownershipPlan, applyRewriteToWorktree, buildIndex, registerLanding, blobOidOf } = leg

const CLEAN_REL = 'packages/app/src/screens/ColorClean.tsx'
const PEER_REL = 'packages/app/src/screens/ColorPeer.tsx'
const LEDGER_REL = join('.ihui-agent', 'state', 'cross-end-landing.jsonl')

/** 档表夹具(与器物 self-test T0 同一形态:明暗同值 ⇒ S2 命中、可静态取用)。 */
const RN_FIXTURE = `export const rnTokens = { brand: { DEFAULT: '#000000' } }
export const rnLightTokens = { brand: { DEFAULT: '#000000' } }
export const rnDarkTokens = { brand: { DEFAULT: '#FFFFFF' } }
`
const CSS_FIXTURE = `@theme {
  --color-black-50: rgba(0,0,0,0.5);
}
`
/** 一枚带"对象位色值字面量 + 具名 import"的壳(生产 sitesOf/rewriteFile 的射程形态)。 */
const demoSrc = () =>
  `import { rnLightTokens as tokens } from '@ihui/design-tokens'
const styles = StyleSheet.create({ scrim: { backgroundColor: 'rgba(0,0,0,0.5)' } })
`

const idx = () => buildIndex(RN_FIXTURE, CSS_FIXTURE).byNorm
function newRepo() {
  const dir = mkScratch('fixrn-own-')
  gitRaw(['init', '-q'], dir)
  gitRaw(['config', 'user.email', 'fixture@ihui.local'], dir)
  gitRaw(['config', 'user.name', 'ihui-fixture'], dir)
  return dir
}
function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text)
  return abs
}
function commitAll(dir, msg = 'seed') {
  gitRaw(['add', '-A'], dir)
  gitRaw(['commit', '-q', '-m', msg], dir)
}
const cat = (dir, rel) => readFileSync(join(dir, rel), 'utf8')
/** 临时仓 porcelain 面(逐字节):"有没有多出一次写动作"的现场快照。 */
const porcelain = (dir) => String(gitRaw(['status', '--porcelain', '-z'], dir))

/** 铺两枚候选并入库;`peer` = 只把 PEER_REL 做成"他席在飞"(工作树被第三方加了一行)。 */
function putBoth(dir, { peer = true } = {}) {
  put(dir, CLEAN_REL, demoSrc())
  put(dir, PEER_REL, demoSrc())
  commitAll(dir)
  if (peer) writeFileSync(join(dir, PEER_REL), `${cat(dir, PEER_REL)}// 他席正在改这一枚\n`)
  return dir
}

// ── ① 正向 ───────────────────────────────────────────────────────────────────────
test('正向:落点干净(已入库)⇒ 闸放行 → 真写盘 → 批末登记 1 条 → collectiblePaths 认账', () => {
  const dir = newRepo()
  try {
    putBoth(dir, { peer: false })
    const plan = ownershipPlan([CLEAN_REL], { root: dir, landedSet: new Set() })
    assert.equal(plan.ok, true, `脏集必须取得到:${String(plan.reason)}`)
    assert.deepEqual(plan.held, [], '干净落点不得被闸拦下')
    assert.deepEqual(plan.writable, [CLEAN_REL])
    const w = applyRewriteToWorktree(CLEAN_REL, { root: dir, idxForRewrite: idx(), headCount: 1 })
    assert.equal(w.action, 'written', `写盘腿必须真的跑到:实得 ${JSON.stringify(w)}`)
    const after = cat(dir, CLEAN_REL)
    assert.ok(after.includes('rnCssLight.black50'), '字面量应已换成源档取用')
    assert.ok(/import \{[^}]*rnCssLight[^}]*\} from '@ihui\/design-tokens'/.test(after), 'import 追加的名字必须在位')
    const reg = registerLanding([CLEAN_REL], { root: dir })
    assert.equal(reg.ok, true)
    assert.equal(reg.landing, 1, '写完才实测 oid ⇒ 落点账本登记层照旧')
    const col = collectiblePaths(Date.now() + 7 * 60_000, { root: dir })
    assert.equal(col.ok, true, `collectiblePaths 取不到 ⇒ ${col.reason}`)
    assert.deepEqual(col.collectible.map((c) => c.path), [CLEAN_REL], '整链:登记的 oid 与收编侧同一把尺')
    assert.equal(col.collectible[0].leg, LEG_NAME)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

// ── ② 反向:他席在飞 ─────────────────────────────────────────────────────────────
test('反向:他席在飞(索引==HEAD、工作树更新)⇒ 不写盘、不进账本、现场逐字节不变', () => {
  const dir = newRepo()
  try {
    putBoth(dir)
    const before = cat(dir, PEER_REL)
    const sceneBefore = porcelain(dir)
    assert.ok(sceneBefore.includes(PEER_REL), '夹具前提:他席那份必须真出现在 porcelain 里')
    assert.equal(
      String(gitRaw(['diff', '--cached', '--name-only'], dir)).trim(),
      '',
      '夹具前提:那是"别人改的",不是本器暂存过的形态(索引 == HEAD)',
    )
    const plan = ownershipPlan([PEER_REL], { root: dir, landedSet: new Set() })
    assert.equal(plan.ok, true, '脏集取得到 ⇒ 走"真脏"那一档,不是未判定')
    assert.deepEqual(plan.writable, [], '被拦的一枚绝不能进 writable(写盘腿结构上跑不到它)')
    assert.equal(plan.held.length, 1)
    assert.equal(plan.held[0], PEER_REL, 'held 必须点名到具体文件,不是只报总数')
    // 主循环的形态:只对 writable 落笔、只对写了盘的批次登记
    const landedBatch = []
    for (const rel of plan.writable) {
      applyRewriteToWorktree(rel, { root: dir, idxForRewrite: idx(), headCount: 1 })
      landedBatch.push(rel)
    }
    const reg = registerLanding(landedBatch, { root: dir })
    assert.equal(reg.landing, 0)
    assert.equal(cat(dir, PEER_REL), before, '他席那份被改写 = 本闸要根治的事故')
    assert.equal(porcelain(dir), sceneBefore, '临时仓 git 现场不得多一个字(没暂存、没新增改动)')
    assert.equal(existsSync(join(dir, LEDGER_REL)), false, '没写盘就没有产出 ⇒ 一行都不许登记')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

// ── ③ 取不到输入 ─────────────────────────────────────────────────────────────────
test('取不到输入(根不是 git 仓)⇒ 视同未通过:一条都不写 + 点名带原因', () => {
  const dir = mkScratch('fixrn-nogit-')
  try {
    put(dir, CLEAN_REL, demoSrc())
    put(dir, PEER_REL, demoSrc())
    const beforeClean = cat(dir, CLEAN_REL)
    const beforePeer = cat(dir, PEER_REL)
    const plan = ownershipPlan([CLEAN_REL, PEER_REL], { root: dir, landedSet: new Set() })
    assert.equal(plan.ok, false, '夹具前提:脏集必须真的取不到')
    assert.ok(typeof plan.reason === 'string' && plan.reason.includes('取不到'), `原因必须点名:实得 ${String(plan.reason)}`)
    assert.deepEqual(plan.writable, [], '取不到 ⇒ 一律未通过(失效方向恒为"少写一次",绝不覆盖他席)')
    assert.equal(plan.held.length, 2, '两条都得点名')
    for (const [i, rel] of [CLEAN_REL, PEER_REL].entries())
      assert.ok(plan.held[i].startsWith(rel) && plan.held[i].includes('归属集取不到'), `点名要带成因:实得 ${plan.held[i]}`)
    assert.equal(cat(dir, CLEAN_REL), beforeClean)
    assert.equal(cat(dir, PEER_REL), beforePeer)
    assert.equal(existsSync(join(dir, LEDGER_REL)), false, '不写 ⇒ 不登记')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

// ── ④ 阳性对照 ───────────────────────────────────────────────────────────────────
test('阳性对照:同一夹具里只写干净那一枚,他席那枚逐字节未动、账本只有前者', () => {
  const dir = newRepo()
  try {
    putBoth(dir)
    const peerBefore = cat(dir, PEER_REL)
    const plan = ownershipPlan([CLEAN_REL, PEER_REL], { root: dir, landedSet: new Set() })
    assert.deepEqual(plan.writable, [CLEAN_REL], '只放行干净那一枚')
    assert.deepEqual(plan.held, [PEER_REL], '只拦他席那一枚')
    assert.equal(plan.skipLanded, 0)
    const landedBatch = []
    for (const rel of plan.writable) {
      const w = applyRewriteToWorktree(rel, { root: dir, idxForRewrite: idx(), headCount: 1 })
      assert.equal(w.ok, true)
      landedBatch.push(rel)
    }
    registerLanding(landedBatch, { root: dir })
    assert.ok(cat(dir, CLEAN_REL).includes('rnCssLight.black50'), '正向对照:干净那枚确实被写了')
    assert.equal(cat(dir, PEER_REL), peerBefore, '他席那枚一个字节都不许动')
    const rd = readLanding({ root: dir })
    assert.equal(rd.ok, true)
    assert.deepEqual(rd.lines.map((l) => l.path), [CLEAN_REL], '账本里只能有真写了盘的那一枚')
    assert.equal(rd.lines[0].blobOid, blobOidOf(CLEAN_REL, { root: dir }), '登记的必须是写完盘后实测的 hash')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

// ── ⑤ 形状锁 ─────────────────────────────────────────────────────────────────────
test('形状锁:裁决腿零写盘、主循环只遍历 plan.writable、只读档与 --check/--emit-blobs 未被放宽', () => {
  // ① 判据单源:import 库出口,本器不得再出现第二份 porcelain 取值/解析
  assert.match(SRC, /from '\.\/lib\/git-paths\.mjs'/, '必须 import 库里的归属判据出口')
  assert.doesNotMatch(SRC, /'status',\s*'--porcelain'/, '不得在本器里自拼 status --porcelain')
  assert.doesNotMatch(SRC, /function ownershipGate|function isCleanOwned/, '闸的实现只能住在库里')
  // ② 裁决腿必须零副作用:函数体内不许出现任何写盘/登记/派生动作
  const planBody = /export function ownershipPlan\([\s\S]*?\n\}/.exec(SRC)?.[0] ?? ''
  assert.ok(planBody, 'ownershipPlan 必须已导出')
  for (const forbidden of ['writeFileSync', 'appendLanding', 'registerLanding', 'execFileSync', 'watermark'])
    assert.ok(!planBody.includes(forbidden), `裁决腿不得出现 ${forbidden}(纯裁决才可被夹具证明)`)
  // ③ 主循环只对 writable 落笔;写盘 + 水印 inject + landedBatch.push 三件事的顺序锁仍在
  assert.match(SRC, /for \(const rel of plan\.writable\) \{/, '主循环必须只遍历过了闸的那一桶')
  assert.ok(!/for \(const \[rel, list\] of perFileSafe\) \{/.test(SRC.slice(SRC.indexOf('const plan = ownershipPlan'))), '闸后不得再有无差别遍历候选的写盘循环')
  const w = SRC.indexOf('writeFileSync(p, r.src')
  const inj = SRC.indexOf("'inject', p")
  const push = SRC.indexOf('landedBatch.push(rel)')
  assert.ok(w > 0 && inj > 0 && push > 0, `三个锚点都必须存在:write=${w} inject=${inj} push=${push}`)
  assert.ok(push > inj && push > w, 'landedBatch.push 必须排在 writeFileSync 与 watermark inject 之后')
  // ④ 新增机读键:held= / ownership=unjudged 都得进结论行(只读档给预演读数)
  assert.match(SRC, /held=\$\{held\.length\}/, '--apply 结论行必须有 held=')
  assert.match(SRC, /held=\$\{previewHeld\}/, '只读档结论行必须有 held=(预演)')
  assert.match(SRC, /plan\.ok \? '' : ' ownership=unjudged'/, '取不到必须如实标 ownership=unjudged')
  // ⑤ 既有判据一字未动:colorsAgree 前置仍在 rewriteFile 里、--check 档不碰闸、emit-blobs 不写工作树
  assert.match(SRC, /if \(!tok93\.colorsAgree\(s\.raw, s\.value\)\) return \{ ok: false/, '可证等价仍是硬前置')
  const planAt = SRC.lastIndexOf('/**', SRC.indexOf('export function ownershipPlan'))
  const runCheckBody = SRC.slice(SRC.indexOf('function runCheck'), planAt)
  assert.ok(runCheckBody.length > 200, '切片必须真落在 runCheck 与闸的文档注释之前(锚点漂了就是断言失效)')
  assert.ok(!runCheckBody.includes('ownership'), '--check/--staged 档不得被闸改变判序(只读档一律不动)')
  const emitBody = SRC.slice(SRC.indexOf("if (argv.includes('--emit-blobs'))"), SRC.indexOf('let changed = 0'))
  assert.ok(emitBody.length > 0 && !emitBody.includes('ownership'), '--emit-blobs 交的是 HEAD 面 blob,结构上不该过工作树归属闸')
  assert.ok(SRC.includes("join(ROOT, 'scripts/watermark.mjs')"), '水印注入出口仍在(§5c)')
  assert.equal(typeof ownershipPlan, 'function', '__test__ 必须交出生产出口(§22c)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
