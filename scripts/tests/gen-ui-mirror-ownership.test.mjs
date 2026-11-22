// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * gen-ui-mirror.mjs 的**归属闸**镜像测试(2026-11-03 立)。
 *
 * 为什么必须有这道闸(机主要求"全部自动化"的前置条件):本器即将挂守护周期腿,而它唯一的写盘
 * 出口是小程序壳。多会话共享工作区里,自动腿写他席正在编辑的文件 = 覆盖别人的未提交工作
 * (AGENTS.md §12 / §16 的明令事故型)。归属判据单源 = `scripts/lib/git-paths.mjs`
 * (`ownershipGate` = `ownershipDirtyPathsDetailed` + `isCleanOwned`),与三枚 lander、
 * fix-rn-color-literals 共用同一份 —— 本文件也只 import 生产出口,零复制判据(§22c / 门 191)。
 *
 * 钉什么:
 *  ① 正向:落点干净(已入库)⇒ 照旧写盘 + 账本恰好 1 行(证明闸没把主流程挡死);
 *  ② 反向:**他席在飞**的真实形态(索引 == HEAD、工作树被第三方改过 ⇒ porcelain ` M`)
 *     ⇒ 该路径不写盘、不进账本,且临时仓的 porcelain 面与工作树副本**逐字节不变**
 *     (断言"副作用没发生",不是只看返回值);
 *  ③ 取不到输入(根根本不是 git 仓)⇒ 一条都不写、结论行标 `ownership=unjudged` 并**逐条点名**;
 *  ④ 阳性对照:同一夹具里同时放"干净路径"与"他席路径"⇒ 只写了前者、账本只有前者
 *     (只测否定等于没测);
 *  ⑤ 形状锁:判据从库 import、本器不得再出现第二份 porcelain 解析、闸必须排在写盘出口之前,
 *     红/绿/未判定三档计数与退出码判序一字未动。
 *
 * 夹具纪律:临时 git 仓一律 mkScratch(§15b,不落仓库树内 —— 守门 208);真实工作树在本文件内
 * **只读不写**(没有任何一条路径带 --apply 打向 ROOT)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { gitRaw } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { readLanding, isRowComplete } from '../lib/cross-end-landing-ledger.mjs'
import { ownershipGate } from '../lib/git-paths.mjs'
import { __test__ as leg, CROSS_END_LEG, comparePair, pascalOf } from '../gen-ui-mirror.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'gen-ui-mirror.mjs')
const SRC = readFileSync(SCRIPT, 'utf8')

const SWITCH_RN = 'packages/ui-native/src/switch.tsx'
const SWITCH_MP = `apps/miniapp-taro/src/components/${pascalOf('switch')}.tsx`
const AVATAR_RN = 'packages/ui-native/src/avatar.tsx'
const AVATAR_MP = `apps/miniapp-taro/src/components/${pascalOf('avatar')}.tsx`
const LEDGER_REL = join('.ihui-agent', 'state', 'cross-end-landing.jsonl')

const rnOf = (slug, spec, cls) =>
  [
    `import { ${spec} } from '@ihui/shared/ui/${slug}-spec'`,
    '',
    `const ${cls}: Record<number, string> = { 20: 'h-5', 24: 'h-6' }`,
    '',
    'export function X() {',
    '  return null',
    '}',
    '',
  ].join('\n')
const mpOf = (slug, spec, cls, wrong) =>
  [
    `import { ${spec} } from '@ihui/shared/ui/${slug}-spec'`,
    '',
    `const ${cls}: Record<number, string> = { 20: 'h-5', 24: ${wrong} }`,
    '',
    `export function ${pascalOf(slug)}Mini() {`,
    '  return null',
    '}',
    '',
  ].join('\n')

function newRepo() {
  const dir = mkScratch('uimirror-own-')
  gitRaw(['init', '-q'], dir)
  gitRaw(['config', 'user.email', 'fixture@ihui.local'], dir)
  gitRaw(['config', 'user.name', 'ihui-fixture'], dir)
  return dir
}
function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
  return abs
}
function commitAll(dir, msg = 'seed') {
  gitRaw(['add', '-A'], dir)
  gitRaw(['commit', '-q', '-m', msg], dir)
}
const cat = (dir, rel) => readFileSync(join(dir, rel), 'utf8')
/** 临时仓的 porcelain 面(逐字节):用它当"有没有多出一次写动作"的现场快照。 */
const porcelain = (dir) => String(gitRaw(['status', '--porcelain', '-z'], dir))

/**
 * 一对**真漂移**的 switch 夹具(小程序 24 档抄成 h-7 ⇒ comparePair 判 drifted)。
 * `opts.peer` = 把落点做成"他席在飞"形态:先入库,再由第三方在工作树里加一行(索引 == HEAD)。
 */
function putSwitchPair(dir, { peer = false } = {}) {
  put(dir, 'packages/shared/src/ui/switch-spec.ts', 'export const SWITCH_TRACK_H_PX = 24\n')
  put(dir, SWITCH_RN, rnOf('switch', 'SWITCH_TRACK_H_PX', 'TRACK_H_CLASS'))
  put(dir, SWITCH_MP, mpOf('switch', 'SWITCH_TRACK_H_PX', 'TRACK_H_CLASS', "'h-7'"))
  commitAll(dir)
  if (peer) writeFileSync(join(dir, SWITCH_MP), `${cat(dir, SWITCH_MP)}// 他席正在改这一枚\n`, 'utf8')
  return dir
}

/** 干净 switch + 他席 avatar,同一夹具(阳性对照用)。 */
function putBoth(dir) {
  putSwitchPair(dir)
  put(dir, 'packages/shared/src/ui/avatar-spec.ts', 'export const AVATAR_SIZE_PX = 24\n')
  put(dir, AVATAR_RN, rnOf('avatar', 'AVATAR_SIZE_PX', 'AVATAR_SIZE_CLASS'))
  put(dir, AVATAR_MP, mpOf('avatar', 'AVATAR_SIZE_PX', 'AVATAR_SIZE_CLASS', "'h-7'"))
  commitAll(dir)
  // 只有 avatar 被他席改动(switch 保持干净入库态)
  writeFileSync(join(dir, AVATAR_MP), `${cat(dir, AVATAR_MP)}// 他席正在改这一枚\n`, 'utf8')
  return dir
}

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

// ── ① 正向:干净落点 ⇒ 闸放行,写盘 + 账本登记一条不少 ──────────────────────────
test('正向:落点干净(已入库)⇒ 照旧写盘 + 账本恰 1 行 + held=0(闸没把主流程挡死)', async () => {
  const dir = newRepo()
  try {
    putSwitchPair(dir)
    assert.ok(
      comparePair(
        rnOf('switch', 'SWITCH_TRACK_H_PX', 'TRACK_H_CLASS'),
        mpOf('switch', 'SWITCH_TRACK_H_PX', 'TRACK_H_CLASS', "'h-7'"),
      ).drifted.includes('TRACK_H_CLASS'),
      '夹具前提:必须真漂移',
    )
    const { ret, out } = await capture(() => leg.main(['--apply'], { root: dir }))
    assert.equal(ret, 1, '有漂移仍判红(既有语义)')
    assert.match(out, / held=0\b/, '干净落点不得被闸拦下')
    assert.doesNotMatch(out, /ownership=unjudged/)
    assert.ok(cat(dir, SWITCH_MP).includes("24: 'h-6'"), '写盘必须真的发生')
    const rd = readLanding({ root: dir })
    assert.equal(rd.ok, true)
    assert.equal(rd.lines.length, 1, `账本应恰 1 行:实得 ${rd.lines.length}`)
    assert.equal(rd.lines[0].path, SWITCH_MP)
    assert.equal(rd.lines[0].leg, CROSS_END_LEG)
    assert.ok(isRowComplete(rd.lines[0]))
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

// ── ② 反向:他席在飞 ⇒ 不写盘、不进账本、现场逐字节不变 ─────────────────────────
test('反向:落点被他席改动(索引==HEAD、工作树更新)⇒ 不写盘、不进账本、逐字节不变', async () => {
  const dir = newRepo()
  try {
    putSwitchPair(dir, { peer: true })
    const mpBefore = cat(dir, SWITCH_MP)
    const porcelainBefore = porcelain(dir)
    assert.ok(porcelainBefore.includes(SWITCH_MP), '夹具前提:他席在飞必须真的出现在 porcelain 里( M 形态)')
    assert.match(String(gitRaw(['diff', '--name-only'], dir)).split('\n')[0], /.+/, '夹具前提:是"工作树改了但没暂存",不是 staged 形态')
    const { ret, out } = await capture(() => leg.main(['--apply'], { root: dir }))
    assert.equal(ret, 1, '漂移照旧判红(闸不改变判据,只改变写不写)')
    assert.match(out, / held=1\b/, '被拦的一枚必须进 held 计数')
    assert.match(out, new RegExp(`🔒 归属未明.*${SWITCH_MP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '必须逐条点名是哪一枚')
    // 副作用没发生:落点字节 + 整个 porcelain 面都与他席那份逐字节相同
    assert.equal(cat(dir, SWITCH_MP), mpBefore, '他席那份被改写 = 本闸要根治的事故')
    assert.equal(porcelain(dir), porcelainBefore, '临时仓的 git 现场不得多一个字(没暂存、没新增改动)')
    assert.equal(existsSync(join(dir, LEDGER_REL)), false, '没写盘就没有产出 ⇒ 一行都不许登记')
    assert.match(out, /结论 landing=0/)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

// ── ③ 取不到输入 ⇒ 视同未通过:一条都不写,并点名 ───────────────────────────────
test('取不到输入(根不是 git 仓)⇒ 一条都不写 + held 点名带原因 + ownership=unjudged', async () => {
  const dir = mkScratch('uimirror-nogit-')
  try {
    put(dir, 'packages/shared/src/ui/switch-spec.ts', 'export const SWITCH_TRACK_H_PX = 24\n')
    put(dir, SWITCH_RN, rnOf('switch', 'SWITCH_TRACK_H_PX', 'TRACK_H_CLASS'))
    put(dir, SWITCH_MP, mpOf('switch', 'SWITCH_TRACK_H_PX', 'TRACK_H_CLASS', "'h-7'"))
    const before = cat(dir, SWITCH_MP)
    const g = ownershipGate({ root: dir })
    assert.equal(g.ok, false, '夹具前提:脏集必须真的取不到')
    assert.ok(typeof g.reason === 'string' && g.reason.length > 0, '取不到必须带原因')
    const { out } = await capture(() => leg.main(['--apply'], { root: dir }))
    assert.match(out, / held=1\b/)
    assert.match(out, /ownership=unjudged/, '不得把"没读到"写成"没有待写的"')
    assert.match(out, /归属集取不到/, '点名文案要带上"取不到"这个真实成因')
    assert.equal(cat(dir, SWITCH_MP), before, '取不到 ⇒ 不写(失效方向恒为少写一次)')
    assert.equal(existsSync(join(dir, LEDGER_REL)), false, '不写 ⇒ 不登记')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

// ── ④ 阳性对照:同一夹具里只写干净那一枚 ────────────────────────────────────────
test('阳性对照:干净 switch 被写、他席 avatar 一字节未动,账本只有前者(只测否定等于没测)', async () => {
  const dir = newRepo()
  try {
    putBoth(dir)
    const avatarBefore = cat(dir, AVATAR_MP)
    const { out } = await capture(() => leg.main(['--apply'], { root: dir }))
    assert.ok(cat(dir, SWITCH_MP).includes("24: 'h-6'"), '干净那枚必须真的被派生(否则整例只是"什么都没发生")')
    assert.equal(cat(dir, AVATAR_MP), avatarBefore, '他席那枚不得被动')
    assert.match(out, / held=1\b/)
    assert.ok(out.includes(AVATAR_MP) && !out.includes(`已写回 ${AVATAR_MP}`), 'held 点名要认得出是 avatar')
    const rd = readLanding({ root: dir })
    assert.equal(rd.ok, true)
    assert.deepEqual(rd.lines.map((l) => l.path), [SWITCH_MP], '账本里只能有真写了盘的那一枚')
    assert.equal(rd.lines.length, 1)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

// ── ⑤ 形状锁:判据 import 库出口,闸排在写盘之前,既有判据一字未放宽 ────────────
test('形状锁:归属判据只 import(零第二份实现)、闸排在写盘出口之前、判据与退出码未放宽', () => {
  // ① 判据单源:import 库出口,本器内不得再出现 porcelain 取值/解析(§0.6 / 门 191)
  assert.match(SRC, /from '\.\/lib\/git-paths\.mjs'/, '必须 import 库里的归属判据出口')
  assert.doesNotMatch(SRC, /'status',\s*'--porcelain'/, '不得在本器里自拼 status --porcelain(第二份取值必然漂)')
  assert.doesNotMatch(SRC, /function ownershipGate|function isCleanOwned/, '闸的实现只能住在库里')
  // ② 闸排在写盘之前,且写出口仍只有一处(旗没变宽、面没换成别人)
  const gateAt = SRC.indexOf('ownership.blocked(row.mpRel)')
  const writeAt = SRC.indexOf('writeFileSync(join(root, row.mpRel)')
  assert.ok(gateAt > 0 && writeAt > gateAt, `闸必须在写盘之前:gate=${gateAt} write=${writeAt}`)
  assert.equal((SRC.match(/writeFileSync\(join\(root, row\.mpRel\)/g) || []).length, 1, '落盘出口必须仍只有一处')
  // ③ 续跑(skipLanded)仍排在闸之前:待收编副本的凭据不能被闸换成第二形态
  assert.ok(SRC.indexOf('skipLanded.push(row.mpRel)') < gateAt, '已登记待收编那一档必须先于归属闸判定')
  // ④ 既有判据 / 退出码 / 机读键一字未放宽
  assert.match(SRC, /let code = undetermined \? 2 : red \? 1 : 0/, '红/绿/未判定三档判序不得因闸而变')
  assert.match(SRC, /配对 \$\{green \+ red\} · ✅一致 \$\{green\} · 🔴漂移 \$\{red\}/, '计数面仍含被拦的两枚')
  assert.match(SRC, / held=\$\{held\.length\}/, '结论行必须有机读键 held=')
  assert.match(SRC, /ownership\.ok \? '' : ' ownership=unjudged'/, '取不到必须如实标 ownership=unjudged')
  // ⑤ 闸与 main 用同一个 root(真实工作树只在 opts.root 缺省时才被读到)
  assert.match(SRC, /ownershipGate\(\{ root \}\)/, '闸必须问本轮同一个 root')
  assert.equal(ownershipGate({ root: join(HERE, '..', '..', '__no_such_root__') }).ok, false, '根不存在 ⇒ 脏集取不到 ⇒ 未通过(不是"干净")')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
