// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * gen-ui-mirror.mjs × cross-end-landing-ledger 的镜像测试(2026-11-03 立,§22c:判据 import
 * 生产出口,本文件零复制第二支落账/读账判定)。
 *
 * 钉什么:
 *  · **整链证明**:mkScratch 独立 git 仓里造一对真漂移的壳(RN 24 档 `h-6` ↔ 小程序 `h-7`),
 *    跑生产 `main(['--apply'], {root})` ⇒ 写盘 + 账本恰好 +1 行 + `collectiblePaths` 判成
 *    collectible(取 oid 与收编侧同尺,不同尺的后果是"永远 contested");
 *  · 可续跑:同产出重放 ⇒ deduped ∧ landedSkips 判本轮已完成;登记后**上游 RN 又改一档**而
 *    待收编副本 blob 未动 ⇒ 本轮 skipLanded=1 且小程序壳一个字节都不许再改写(改写就把收编
 *    侧唯一的凭据换成第二形态);
 *  · 防事故:登记后落点被别手改一行 ⇒ contested、skipLanded 不含它;
 *  · 只读档零登记:不带 --apply ⇒ 壳文件未动 + 账本文件**都不建**;空批同理;
 *  · 账本缺失 ⇒ landedSkips 报 ledger=unjudged 且不抛,main 照旧全量写盘+登记(失效方向
 *    「多要一次」,§0.3,绝不因取不到账本而退场);
 *  · 同形锁:leg 名来自具名常量且逐字等于 parity-auto 给本器的 stage id(在册名,非自立新名);
 *    取 oid 形态与库内同尺;主流程只在写盘批调 registerLandings;既有判据/退出码/两端相等性
 *    断言一字未放宽。
 *
 * 夹具纪律:临时 git 仓一律 mkScratch(§15b,不落仓库树内 —— 守门 208);真实工作树在本文件
 * 内**只读不写**(没有任何一条路径带 --apply 打向 ROOT)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { gitRaw } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  collectiblePaths,
  readLanding,
  ledgerPathFor,
  DEFAULT_QUIET_MS,
} from '../lib/cross-end-landing-ledger.mjs'
import {
  __test__ as leg,
  CROSS_END_LEG,
  comparePair,
  pascalOf,
} from '../gen-ui-mirror.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS = join(HERE, '..')
const read = (f) => readFileSync(join(SCRIPTS, f), 'utf8')

const RN_REL = 'packages/ui-native/src/switch.tsx'
const MP_REL = `apps/miniapp-taro/src/components/${pascalOf('switch')}.tsx`
const SPEC_REL = 'packages/shared/src/ui/switch-spec.ts'
const LEDGER_REL = join('.ihui-agent', 'state', 'cross-end-landing.jsonl')
/** 静默期已过的那一刻(现在 + quiet + 1 分钟)——只喂给量算,不落任何盘。 */
const pastQuiet = () => Date.now() + DEFAULT_QUIET_MS + 60_000

const SPEC_SRC = 'export const SWITCH_TRACK_H_PX = 24\n'
const rnSrcOf = (track = "'h-6'") =>
  [
    "import { SWITCH_TRACK_H_PX } from '@ihui/shared/ui/switch-spec'",
    '',
    `const TRACK_H_CLASS: Record<number, string> = { 20: 'h-5', 24: ${track} }`,
    '',
    'export function Switch() {',
    '  return null',
    '}',
    '',
  ].join('\n')
const mpSrcOf = (track = "'h-7'") =>
  [
    "import { SWITCH_TRACK_H_PX } from '@ihui/shared/ui/switch-spec'",
    '',
    `const TRACK_H_CLASS: Record<number, string> = { 20: 'h-5', 24: ${track} }`,
    '',
    'export function SwitchMiniapp() {',
    '  return null',
    '}',
    '',
  ].join('\n')

function newRepo() {
  const dir = mkScratch('uimirror-leg-')
  gitRaw(['init', '-q'], dir)
  gitRaw(['config', 'user.email', 'fixture@ihui.local'], dir)
  gitRaw(['config', 'user.name', 'ihui-fixture'], dir)
  return dir
}

/**
 * 把夹具文件**入库**成干净态(2026-11-03 加):落档器现在带归属闸 ——
 * `git status --porcelain` 里出现的路径(含未跟踪 `??`)一律"归属未知 ⇒ 不写"。
 * 本文件的正向例要证的是"闸没把主流程挡死",所以夹具必须先干净。
 */
function commitAll(dir, msg = 'seed') {
  gitRaw(['add', '-A'], dir)
  gitRaw(['commit', '-q', '-m', msg], dir)
}

/** 一对真漂移的壳(小程序 24 档抄成 h-7);返回 root 供生产 main 注入。 */
function putPair(dir, { rn = rnSrcOf(), mp = mpSrcOf() } = {}) {
  const put = (rel, text) => {
    const abs = join(dir, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, text, 'utf8')
    return abs
  }
  put(SPEC_REL, SPEC_SRC)
  put(RN_REL, rn)
  put(MP_REL, mp)
  commitAll(dir)
  return dir
}

const cat = (dir, rel) => readFileSync(join(dir, rel), 'utf8')
const linesOf = (dir) =>
  existsSync(join(dir, LEDGER_REL))
    ? readFileSync(join(dir, LEDGER_REL), 'utf8').split('\n').filter(Boolean)
    : null

/** 捕 main() 的结论行(生产同一出口,不重打一份文案)。 */
async function capture(fn) {
  const chunks = []
  const orig = process.stdout.write
  process.stdout.write = (chunk, enc, cb) => {
    chunks.push(typeof chunk === 'string' ? chunk : String(chunk))
    if (typeof chunk === 'function') chunk()
    else if (typeof enc === 'function') enc()
    else if (typeof cb === 'function') cb()
    return true
  }
  try {
    const ret = await fn()
    return { ret, out: chunks.join('') }
  } finally {
    process.stdout.write = orig
  }
}

test('整链证明:漂移配对 --apply ⇒ 写盘 + 账本恰好 1 行 + collectiblePaths 判成 collectible', async () => {
  const dir = newRepo()
  try {
    putPair(dir)
    assert.ok(comparePair(rnSrcOf(), mpSrcOf()).drifted.includes('TRACK_H_CLASS'), '夹具本身必须真漂移')
    const { ret, out } = await capture(() => leg.main(['--apply'], { root: dir }))
    // ① 判据未动:有漂移 ⇒ exit 1(既有语义)
    assert.equal(ret, 1, `有漂移应判红(1):实得 ${ret}`)
    // ② 写盘真的发生:小程序壳的映射块被派生成 RN 形态,且结构体(JSX)没被本器改写
    const after = cat(dir, MP_REL)
    assert.ok(after.includes("24: 'h-6'"), '绑定块应已被派生成 RN 取值')
    assert.ok(after.includes('export function SwitchMiniapp()'), 'JSX 体属平台承载,不得被本器改写')
    assert.equal(comparePair(rnSrcOf(), after).issues.length, 0, '派生后两端相等性断言必须归绿')
    // ③ 账本恰好 +1 行,leg 名就是在册名
    const rd = readLanding({ root: dir })
    assert.equal(rd.ok, true)
    assert.equal(rd.lines.length, 1, `账本应恰 1 行:实得 ${rd.lines.length}`)
    assert.equal(rd.lines[0].leg, CROSS_END_LEG)
    assert.equal(rd.lines[0].path, MP_REL)
    // ④ 整链最关键的一格:登记 oid == 收编侧实测 oid ⇒ 可收编(不同尺就永远 contested)
    const col = collectiblePaths(pastQuiet(), { root: dir })
    assert.equal(col.ok, true, `collectiblePaths 取不到 ⇒ ${col.reason}`)
    assert.deepEqual(
      col.collectible.map((c) => c.path),
      [MP_REL],
      '整链:写完即判 collectible(小程序壳映射块能自动落库)'
    );
    assert.equal(col.collectible[0].leg, CROSS_END_LEG)
    assert.deepEqual([col.contested.length, col.incomplete.length, col.ignored.length], [0, 0, 0])
    // ⑤ 结论行的机读键齐备(landing= / landingPath=),且不带 landingError
    assert.match(out, /结论 landing=1\b/)
    assert.match(out, new RegExp(`landingPath=${String(ledgerPathFor(dir)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
    assert.doesNotMatch(out, /landingError=/, '登记成功不得冒 landingError')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('可续跑:同产出重放 ⇒ deduped 且 landedSkips 判本轮已完成;上游再改而副本未动 ⇒ skipLanded 不重写', async () => {
  const dir = newRepo()
  try {
    putPair(dir)
    await capture(() => leg.main(['--apply'], { root: dir }))
    const mpAfterFirst = cat(dir, MP_REL)
    // ① 同 oid 重放不得重复追写(守护 30 分钟一轮,否则账本被撑爆)
    const again = leg.registerLandings([MP_REL], { root: dir })
    assert.equal(again.appended, 0, '同键同 oid 不得重复追写')
    assert.equal(again.deduped, 1)
    assert.equal(again.landing, 1, 'dedup 也是「在册」,读数不得变 0')
    assert.equal(linesOf(dir).length, 1)
    // ② 轮首读账本 ⇒ 本轮已完成
    const sk = leg.landedSkips([MP_REL], { root: dir })
    assert.deepEqual(sk.skip, [MP_REL], '本 leg 在册 ∧ blob 未动 ⇒ 本轮已完成')
    assert.equal(sk.ledger, null)
    // ③ 副本待收编期间上游 RN 又改一档 ⇒ 判红照旧报,但**一个字节都不许再改写**
    writeFileSync(join(dir, RN_REL), rnSrcOf("'h-8'"), 'utf8')
    const { ret, out } = await capture(() => leg.main(['--apply'], { root: dir }))
    assert.equal(ret, 1, '上游改了 ⇒ 仍判红(不得因 skip 冒充绿)')
    assert.match(out, /skipLanded=1/)
    assert.equal(cat(dir, MP_REL), mpAfterFirst, '待收编副本被改写 ⇒ 收编凭据就废了')
    assert.equal(linesOf(dir).length, 1, '跳过的一轮不得往账本再添行')
    assert.deepEqual(
      collectiblePaths(pastQuiet(), { root: dir }).collectible.map((c) => c.path),
      [MP_REL],
      '副本未被改写 ⇒ 仍可收编(下一轮收编后本腿会派生新形态)'
    );
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('防事故:登记后落点被别手改一行 ⇒ contested 且 skipLanded 不含它', async () => {
  const dir = newRepo()
  try {
    putPair(dir)
    await capture(() => leg.main(['--apply'], { root: dir }))
    writeFileSync(join(dir, MP_REL), `${cat(dir, MP_REL)}\n// 别席后来加了一行\n`, 'utf8')
    const col = collectiblePaths(pastQuiet(), { root: dir })
    assert.equal(col.collectible.length, 0, 'blob 已被改动 ⇒ 一条不放')
    assert.equal(col.contested.length, 1)
    assert.equal(col.contested[0].path, MP_REL)
    assert.equal(col.contested[0].leg, CROSS_END_LEG)
    assert.deepEqual(leg.landedSkips([MP_REL], { root: dir }).skip, [])
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('只读档零登记:不带 --apply ⇒ 壳文件未动、账本文件都不建;空批同理', async () => {
  const dir = newRepo()
  try {
    putPair(dir)
    const { ret, out } = await capture(() => leg.main([], { root: dir }))
    assert.equal(ret, 1, '只读档仍要判红(不是"没红")')
    assert.equal(cat(dir, MP_REL), mpSrcOf(), '不带 --apply 结构上写不了盘')
    assert.equal(existsSync(join(dir, LEDGER_REL)), false, '只读档不得建账本')
    assert.match(out, /结论 landing=0/)
    assert.equal(leg.registerLandings([], { root: dir }).landing, 0)
    assert.equal(existsSync(join(dir, LEDGER_REL)), false, '零产出批不得建账本')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('账本缺失 ⇒ landedSkips 报 ledger=unjudged 且不抛;main 照旧全量写盘+登记(不退场)', async () => {
  const dir = newRepo()
  try {
    putPair(dir)
    assert.equal(existsSync(join(dir, LEDGER_REL)), false, '前置:账本还不存在')
    const sk = leg.landedSkips([MP_REL], { root: dir })
    assert.equal(sk.ledger, 'unjudged')
    assert.ok(String(sk.reason).includes('not-found'), `reason 必须点名取不到:实得 ${sk.reason}`)
    assert.deepEqual(sk.skip, [])
    const { ret, out } = await capture(() => leg.main(['--apply'], { root: dir }))
    assert.equal(ret, 1)
    assert.match(out, /结论 landing=1/, '账本读不到 ⇒ 多要一次,不是少做一次')
    assert.match(out, /landingPath=/)
    assert.equal(readLanding({ root: dir }).lines.length, 1)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('账本取不到时结论行点名 ledger=unjudged(不得把「没读到」写成「没有待收」)', async () => {
  const dir = newRepo()
  try {
    putPair(dir)
    // 只读档:第一轮没有账本 ⇒ 结论行必须带 ledger=unjudged
    const { out } = await capture(() => leg.main([], { root: dir }))
    assert.match(out, /ledger=unjudged/)
    assert.equal(existsSync(join(dir, LEDGER_REL)), false)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('同形锁:leg 名/取 oid 形态/写盘批调用点/机读键/判据未放宽(import 生产出口)', () => {
  const src = read('gen-ui-mirror.mjs')
  const parity = read('parity-auto.mjs')
  // ① leg 名必须是具名常量,且**逐字等于 parity-auto 给本器登记的 stage id**(在册名,非自立)。
  assert.match(src, /export const CROSS_END_LEG = '([a-z0-9-]+)'/)
  assert.equal(CROSS_END_LEG, 'ui-mirror')
  // stage id = script 之前**最近**的那一枚 id(不是文件里第一个 id:早先按正则前缀取会串到
  // 上一条登记项 'tokens-chrome',取证就是这一格把「在册名」读成了别人的名字)。
  const scriptAt = parity.indexOf("script: 'gen-ui-mirror.mjs'")
  assert.ok(scriptAt >= 0, 'parity-auto 必须仍把 gen-ui-mirror 登记为一个 stage')
  const idsBefore = [...parity.slice(0, scriptAt).matchAll(/id: '([a-z0-9-]+)'/g)]
  assert.ok(idsBefore.length > 0, 'stage 登记项必须有 id')
  const stageId = idsBefore[idsBefore.length - 1][1]
  assert.equal(stageId, CROSS_END_LEG, 'leg 名必须逐字取自在册 stage id')
  assert.ok(
    /SELF_HEALABLE[\s\S]{0,200}'ui-mirror'/.test(parity),
    '本腿必须仍在 parity-auto 的可自修集合里(否则写档档无人放行)',
  )
  // ② 取 oid 与库内 collectiblePaths(worktree 面)同一把尺(逐字同形,禁自拼裸 git/换参)。
  assert.ok(
    src.includes("gitRaw(['hash-object', '--', rel], root)"),
    '必须经 face-reader.gitRaw 的 hash-object 取 oid',
  )
  // ③ 判据只 import,不复制(§0.6 / 门 191)。
  assert.match(src, /from '\.\/lib\/cross-end-landing-ledger\.mjs'/)
  assert.doesNotMatch(src, /function appendLanding|function readLanding/, '不得在腿里重写库判据')
  // ④ 主流程的 registerLandings 调用点必须挂在「本批写了盘」的集合之后,不得无条件调用。
  //    (selfTest 里的 `registerLandings([])` 是零 IO 的纯内存探针,不属主流程调用点,单列排除。)
  const callLines = src
    .split('\n')
    .filter(
      (l) =>
        l.includes('registerLandings(') &&
        !l.includes('export function registerLandings') &&
        !l.includes('registerLandings([])'),
    )
  assert.ok(callLines.length >= 1, '主流程必须调用 registerLandings')
  for (const l of callLines)
    assert.ok(/writtenPaths/.test(l), `调用点未挂在写盘集之后:${l.trim()}`)
  // ⑤ 写出口仍只在 apply 分支:writeFileSync 只允许出现在 `if (apply) {` 之后。
  const applyAt = src.indexOf('if (apply) {')
  const writeAt = src.indexOf('writeFileSync(join(root, row.mpRel)')
  assert.ok(applyAt >= 0 && writeAt > applyAt, '写盘必须仍在 apply 分支内(旗没变宽)')
  assert.equal(
    (src.match(/writeFileSync\(join\(root, row\.mpRel\)/g) || []).length,
    1,
    '落盘出口必须仍只有一处',
  )
  // ⑥ 既有判据/退出码一字未放宽。
  assert.match(src, /if \(undetermined\) return 2|let code = undetermined \? 2 : red \? 1 : 0/)
  assert.match(src, /landingInfo\.landingError && code === 0\) code = 1/, '登记失败不得冒成功')
  assert.match(src, /结论 landing=/)
  assert.match(src, /skipLanded=/)
  assert.match(src, /landingPath=/)
  // ⑦ 落账与写盘必须问同一个 root(真实工作树只在 opts.root 缺省时才被读到;写档 root 由
  //    main 的入参贯穿,不允许写盘用 A 面、登记用 B 面)。
  assert.match(src, /registerLandings\(writtenPaths, \{ root \}\)/)
  assert.match(src, /const root = opts\.root \?\? ROOT/)
  // ⑧ 本轮不重写的前提必须是「本 leg 在册 ∧ blob 相等」两维同时成立,不许只看其一。
  assert.match(src, /pendingOid && worktreeBlobOid\(row\.mpRel, root\) === pendingOid/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
