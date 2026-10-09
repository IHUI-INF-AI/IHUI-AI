// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/live-doc-edit.mjs(§22c —— 判据纯函数直接 import;端到端一律 spawn CLI 打临时仓)。
// 票面要求逐条钉死:
//  1. 零丢失判据有牙 —— "锚点命中 0 处"与"命中 2 处"两种夹具都必须拒绝(不许凭猜插);
//     "别人已在本块位置改过一行"⇒ 落地失败而不是覆盖(锚点已漂 ⇒ 0 命中那一支);
//  + 结构等值(而非重复行计数)正向证明:落地后 HEAD == 前缀 ⊕ 本块 ⊕ 后缀,逐行核对;
//  + EOF 追加模式(缺省锚点)与文末空行归一;
//  + 回读判据:本块每一条非空行必须逐字在 HEAD 里;
//  + 用法错误(缺 env / 空块 / 空锚点)⇒ exit 2。
//  2. G-321 两条判据(I0..I10,2026-09-28):**同锚点重复调用必须幂等**(锚点命中 1 不是"块没在位"的
//     证据)/ **同锚点不同内容必须仍插得进去**(成对反向锁)/ **带取号令牌的块第二次跑号不同也算同一块** /
//     **退出码分档**:内容已入库而仅索引未对齐 ⇒ 0 且点名 sha 与原因,内容没落地 ⇒ 照旧 1(两个方向各一条)。
// git 写操作只发生在 scratch-dir 临时仓内,绝不碰真仓。

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ } from '../live-doc-edit.mjs'
import { git, headBlobOf, indexBlobOf, landsLedger, writeBlob } from '../lib/bypass-git.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOOL = join(HERE, '..', 'live-doc-edit.mjs')
const GIT = resolveGitBin() || 'git'
const runOpts = { encoding: 'utf8', windowsHide: true, timeout: 60_000, maxBuffer: 64 << 20 }
const runGit = (dir, args) =>
  execFileSync(
    GIT,
    [
      '-c',
      'safe.directory=*',
      '-c',
      'user.email=t@e2e.local',
      '-c',
      'user.name=e2e',
      '-c',
      'core.autocrlf=false',
      '-C',
      dir,
      ...args,
    ],
    // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
    { ...runOpts, stdio: ['ignore', 'pipe', 'pipe'] },
  )

const norm = (s) => s.replace(/\r\n/g, '\n')

function makeDocRepo(t, docText) {
  const dir = mkScratch('lde-')
  const inputs = mkScratch('lde-in-')
  t.after(() => rmScratch(dir))
  t.after(() => rmScratch(inputs))
  runGit(dir, ['init', '-q'])
  writeFileSync(join(dir, 'DOC.md'), docText)
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'init'])
  return { dir, inputs }
}

function runLive(
  dir,
  { doc = 'DOC.md', anchorFile, blockFile, replaceFile, msg = 'docs: e2e register', extraEnv = {} } = {},
) {
  const env = { ...process.env, LIVE_ROOT: dir, LIVE_DOC: doc, LIVE_MSG: msg, ...extraEnv }
  if (replaceFile) {
    env.LIVE_REPLACE_FILE = replaceFile
    delete env.LIVE_BLOCK_FILE
  } else env.LIVE_BLOCK_FILE = blockFile
  if (anchorFile) env.LIVE_ANCHOR_FILE = anchorFile
  else delete env.LIVE_ANCHOR_FILE
  return spawnSync(process.execPath, [TOOL], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
    maxBuffer: 64 << 20,
  })
}

const DOC_BASE = ['# 标题', '段落一', '@@ANCHOR@@', '段落二', '']

// ── 取号读数:只从**同一次运行的 stdout** 里取回(不预测、不复算)────────────────────────
// 为什么不 import 工具里的 `resolveIdTokens` / `decideLease` 去"算出这一枚应该等于几":那等于用
// 被测实现自己的结论来断言它(§22c「镜像测试只复读实现,它就只是复读机」)。这里只做一件事 ——
// 把工具**自己宣布**的三行读数取回来(号段基准 / 号段租约 / 令牌取号),再断言三者互相自洽。
// 三条出口一律"取不到即红":报告版式漂了本文件必须当场喊,绝不把"没读到"折叠成"这一维不用读"
// (本仓最高频失效型就是把没判写成判过了)。
//
// 换掉字面量的理由(不是"为了变绿"):千段租约(G-916936)之后"下一个空闲号 = 该族 max+1"这个
// 前提**不再成立** —— 新占段起点由机器标识派生的偏移抬高(leaseCursor 的 claim 支),自有段内
// 连号更可以远小于占用面 max(段尾号只是租约行的主键,不是实号)。所以能钉住的只有关系:
//  ① 落地的号 == 这一次租约读数宣布的那一枚;
//  ② claim 支:号 > 当次基准的本地 max(远端参与时还要 > 远端 max)—— 这就是 G-313 的"让号"语义;
//  ③ in-lease 支:号落在自己段内且 < 段尾,并且严格大于上一次发出的号(绝不再发同一枚)。
const ID_TOKEN_SHAPE = /^[A-Z]+-?\d+$/

/** 从 `G-299` / `O4` 这类号里取出数字部分;取不出就是报告形状漂了,不当"没超标"放过。 */
function idNum(id, where = '取号读数') {
  const s = String(id)
  assert.ok(ID_TOKEN_SHAPE.test(s), `${where}:号的外形读不出数字(${JSON.stringify(s)})⇒ 族书写形状或报告版式漂了`)
  return Number(s.match(/(\d+)$/)[1])
}

/** CAS 成功行里的 `/ 令牌取号(由该次 HEAD 底稿现算)=G-299`(同族多枚以逗号分隔)。 */
function assignedIdsFrom(stdout, where) {
  const m = String(stdout).match(/令牌取号\(由该次 HEAD 底稿现算\)=([A-Z]+-?\d+(?:,[A-Z]+-?\d+)*)/)
  assert.ok(
    m,
    `${where}:本次运行的报告里没有"令牌取号"读数 ⇒ 无法证明落地用的号是这一次算出来的:\n${stdout}`,
  )
  return m[1].split(',')
}

/**
 * 租约读数行宣布"这一次该取哪一枚",并交出段界:
 *  - 自有段还有空闲 ⇒ `在自有段 A~B 内连号(本次首号=X)`   ⇒ mode=in-lease, id=X, start=A, end=B
 *  - 没有 / 段满     ⇒ `新占段 A~B(主键=段尾号,随本块落账…)` ⇒ mode=claim,  id=A(段首), start=A, end=B
 */
function leaseReadoutFrom(stdout, where) {
  const line = String(stdout).match(/号段租约:[^\n]*/)
  assert.ok(
    line,
    `${where}:本次运行的报告里没有"号段租约"读数 ⇒ 无从核对落地的号是不是租约宣布的那一枚:\n${stdout}`,
  )
  const bounds = line[0].match(/(?:在自有段|新占段) ([A-Z]+-?\d+)~([A-Z]+-?\d+)/)
  assert.ok(bounds, `${where}:租约行读不出段界 ⇒ 版式漂了:\n${line[0]}`)
  const inLease = line[0].match(/内连号\(本次首号=([A-Z]+-?\d+)\)/)
  if (inLease)
    return { mode: 'in-lease', id: inLease[1], start: bounds[1], end: bounds[2], line: line[0] }
  return { mode: 'claim', id: bounds[1], start: bounds[1], end: bounds[2], line: line[0] }
}

/**
 * 基准行:`   号段基准:G=9(本地 HEAD 该族 max=3 / 远端 refs/heads/main max=9 ⇒ 取较大,…)`。
 * 离线支写的是 `远端未参与:…` ⇒ 读不出 remoteMax,返回 **null**(含义是"这一维没参与本次取号",
 * 不是"判不出"—— 上一行那条 ⚠️ 已经把不可问的原因喊出来了,两档刻意不并桶)。
 */
function basisFrom(stdout, where) {
  const m = String(stdout).match(
    /号段基准:([A-Z]+)=(\d+)\(本地 HEAD 该族 max=(\d+)(?: \/ 远端 \S+ max=(\d+))?/,
  )
  assert.ok(
    m,
    `${where}:本次运行的报告里没有"号段基准"读数 ⇒ 无法把落地的号钉回它所依据的那份底稿:\n${stdout}`,
  )
  // 远端那一段是 `(?: … max=(\d+))` —— 外层非捕获 ⇒ 那个数字是组 **4**;按 m[5] 取会永远拿到
  // undefined,于是"远端参与了本次取号"被静默读成"远端没参与"(N4 的抬号支就此失去立票理由,
  // 而账面只有一句 remoteMax: null)。
  return {
    family: m[1],
    chosenMax: Number(m[2]),
    localMax: Number(m[3]),
    remoteMax: m[4] === undefined ? null : Number(m[4]),
  }
}

/** 一次取号运行的三行读数(号 / 租约 / 基准)一起交出,断言写在用例里,便于逐条看清钉的是哪一型。 */
function readNumbering(stdout, where) {
  const ids = assignedIdsFrom(stdout, where)
  const lease = leaseReadoutFrom(stdout, where)
  const basis = basisFrom(stdout, where)
  assert.equal(
    ids[0],
    lease.id,
    `${where}:落地的号(${ids.join(',')})与同一次运行的租约读数宣布的那一枚(${lease.id})不是同一个 ⇒ ` +
      `报告在替一个没有发生的取号背书(租约行:\n${lease.line})`,
  )
  assert.ok(
    idNum(lease.id, `${where}·租约宣布的号`) >= idNum(lease.start, `${where}·段首`) &&
      idNum(lease.id, `${where}·租约宣布的号`) < idNum(lease.end, `${where}·段尾`),
    `${where}:取到的号 ${lease.id} 不在自有段 ${lease.start}~${lease.end} 的实号空间内` +
      '(段尾号是租约行的主键、不是实号 ⇒ 取号必须严格小于段尾;落在段外就是发一枚别人也认为空闲的号)',
  )
  return { ids, id: ids[0], lease, basis }
}

/** 文档里那一行 `**<号> <题>**`(号是运行时算出的,必须转义;label 只用汉字,无元字符)。 */
function idRowRe(id, label) {
  const esc = String(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\*\\*${esc} ${label}\\*\\*`)
}

test('T1 §22c 导出面:判据纯函数必须在 __test__ 里', () => {
  for (const k of [
    'readInputs',
    'locateAnchor',
    'assemble',
    'applyReplacements',
    'resolveIdTokens',
  ])
    assert.equal(typeof __test__[k], 'function', `__test__.${k} 缺失`)
})

test('T2 locateAnchor 纯函数:0 / 1 / 2 命中三态读数正确', () => {
  const lines = DOC_BASE.slice(0, -1)
  assert.deepEqual(__test__.locateAnchor(lines, ['没有这行']), { hits: 0, idx: -1 })
  assert.deepEqual(__test__.locateAnchor(lines, ['@@ANCHOR@@']), { hits: 1, idx: 2 })
  const dup = [...lines, '@@ANCHOR@@']
  assert.equal(__test__.locateAnchor(dup, ['@@ANCHOR@@']).hits, 2)
})

test('T3 assemble 纯函数:结构等值由构造保证;锚点不唯一时不给 next', () => {
  const lines = DOC_BASE.slice(0, -1)
  const a = __test__.assemble(lines, ['X1', 'X2'], ['@@ANCHOR@@'])
  assert.equal(a.ok, true)
  assert.deepEqual(a.next, ['# 标题', '段落一', '@@ANCHOR@@', 'X1', 'X2', '段落二'])
  const eof = __test__.assemble(['L1', '', ''], ['B'], null)
  assert.equal(eof.ok, true)
  assert.deepEqual(eof.next, ['L1', '', 'B', ''])
  assert.equal(__test__.assemble(lines, ['B'], ['不存在']).ok, false)
  assert.equal(__test__.assemble([...lines, '@@ANCHOR@@'], ['B'], ['@@ANCHOR@@']).ok, false)
})

test('T4 端到端·锚点插入 happy:落地后 HEAD == 前缀 ⊕ 本块 ⊕ 后缀,逐行核对 + 主索引对齐', (t) => {
  const { dir, inputs } = makeDocRepo(t, DOC_BASE.join('\n'))
  writeFileSync(join(inputs, 'anchor.txt'), '@@ANCHOR@@\n')
  writeFileSync(join(inputs, 'block.txt'), '- 登记甲\n- 登记乙\n')
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  const r = runLive(dir, {
    anchorFile: join(inputs, 'anchor.txt'),
    blockFile: join(inputs, 'block.txt'),
  })
  assert.equal(r.status, 0, `应成功:${r.stdout}|${r.stderr}`)
  assert.match(r.stdout, /回读:本块每一条非空行都在 HEAD 里/)
  assert.match(r.stdout, /主索引已对齐 1\/1/)
  const now = norm(git(['show', 'HEAD:DOC.md'], { root: dir, raw: true })).split('\n')
  assert.deepEqual(
    now,
    ['# 标题', '段落一', '@@ANCHOR@@', '- 登记甲', '- 登记乙', '段落二', ''],
    '除本块插入位外,其余行必须逐字原位',
  )
  assert.equal(
    indexBlobOf('DOC.md', { root: dir }),
    headBlobOf('HEAD', 'DOC.md', { root: dir }),
    '主索引须对齐到新 blob(否则一次普通提交即写回旧版)',
  )
  assert.notEqual(git(['rev-parse', 'HEAD'], { root: dir }), before, 'HEAD 必须前进')
})

test('T5 零丢失判据有牙·命中 0 ⇒ 拒绝且不写盘', (t) => {
  const { dir, inputs } = makeDocRepo(t, DOC_BASE.join('\n'))
  writeFileSync(join(inputs, 'anchor.txt'), '@@NO-SUCH-ANCHOR@@\n')
  writeFileSync(join(inputs, 'block.txt'), '- X\n')
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  const r = runLive(dir, {
    anchorFile: join(inputs, 'anchor.txt'),
    blockFile: join(inputs, 'block.txt'),
  })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /找不到锚点/)
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), before)
})

test('T6 零丢失判据有牙·命中 2 ⇒ 拒绝(唯一性是生命线,不猜)', (t) => {
  const { dir, inputs } = makeDocRepo(t, ['A', '@@MID@@', 'B', '@@MID@@', 'C', ''].join('\n'))
  writeFileSync(join(inputs, 'anchor.txt'), '@@MID@@\n')
  writeFileSync(join(inputs, 'block.txt'), '- X\n')
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  const r = runLive(dir, {
    anchorFile: join(inputs, 'anchor.txt'),
    blockFile: join(inputs, 'block.txt'),
  })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /命中 2 处/)
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), before)
})

test('T7 别人已在本块位置改过一行 ⇒ 落地失败而不是覆盖(锚点已漂;先入库者赢)', (t) => {
  const { dir, inputs } = makeDocRepo(t, DOC_BASE.join('\n'))
  writeFileSync(join(inputs, 'anchor.txt'), '@@ANCHOR@@\n')
  writeFileSync(join(inputs, 'block.txt'), '- 我的登记\n')
  // 别人先落地:把锚点行本身改写了
  writeFileSync(
    join(dir, 'DOC.md'),
    ['# 标题', '段落一', '@@ANCHOR@@ ⇒ 已被人改写', '段落二', ''].join('\n'),
  )
  runGit(dir, ['add', '--', 'DOC.md'])
  runGit(dir, ['commit', '-q', '-m', 'theirs edit'])
  const theirsHead = git(['rev-parse', 'HEAD'], { root: dir })
  const r = runLive(dir, {
    anchorFile: join(inputs, 'anchor.txt'),
    blockFile: join(inputs, 'block.txt'),
  })
  assert.equal(r.status, 1, '锚点不再唯一命中 ⇒ 必须拒绝')
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), theirsHead, '不得覆盖别人的提交')
  const doc = norm(git(['show', 'HEAD:DOC.md'], { root: dir, raw: true }))
  assert.ok(!doc.includes('我的登记'), '我的块绝不允许出现在别人版本之上')
})

test('T8 EOF 追加模式(不传锚点):文末空行归一后追加,回读全行在位', (t) => {
  const { dir, inputs } = makeDocRepo(t, ['L1', '', ''].join('\n'))
  writeFileSync(join(inputs, 'block.txt'), '- 追加一\n- 追加二\n')
  const r = runLive(dir, { blockFile: join(inputs, 'block.txt') })
  assert.equal(r.status, 0, `${r.stdout}|${r.stderr}`)
  const now = norm(git(['show', 'HEAD:DOC.md'], { root: dir, raw: true }))
  assert.equal(
    now,
    ['L1', '', '- 追加一', '- 追加二', ''].join('\n'),
    '结构须为 HEAD(剥尾空行) ⊕ 空行 ⊕ 本块 ⊕ 换行',
  )
  assert.match(r.stdout, /EOF 追加/)
})

test('T9 用法错误 ⇒ exit 2 且不写盘:缺 msg / 缺 doc / 空正文块 / 空锚点文件', (t) => {
  const { dir, inputs } = makeDocRepo(t, DOC_BASE.join('\n'))
  writeFileSync(join(inputs, 'block.txt'), '')
  const r1 = runLive(dir, { blockFile: join(inputs, 'block.txt'), msg: '' })
  assert.equal(r1.status, 2)
  const r2 = runLive(dir, { blockFile: join(inputs, 'block.txt'), doc: '' })
  assert.equal(r2.status, 2)
  writeFileSync(join(inputs, 'block.txt'), '- 正常\n')
  const r3 = runLive(dir, { blockFile: join(inputs, 'block.txt') })
  assert.equal(r3.status, 0, `正常块应可落地:${r3.stdout}|${r3.stderr}`)
  const r4 = spawnSync(process.execPath, [TOOL], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      LIVE_ROOT: dir,
      LIVE_DOC: 'DOC.md',
      LIVE_BLOCK_FILE: join(inputs, 'block.txt'),
      LIVE_ANCHOR_FILE: join(inputs, 'missing-anchor.txt'),
      LIVE_MSG: 'm',
    },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
    maxBuffer: 64 << 20,
  })
  assert.equal(r4.status, 2)
  assert.match(r4.stderr, /LIVE_ANCHOR_FILE/)
})

test('T10 writeBlob 阳性对照:EOF 模式落地后的 blob 就是"结构等值"那份文本(判据与产物同源)', (t) => {
  const { dir, inputs } = makeDocRepo(t, ['L1', ''].join('\n'))
  writeFileSync(join(inputs, 'block.txt'), '- E2E\n')
  const r = runLive(dir, { blockFile: join(inputs, 'block.txt') })
  assert.equal(r.status, 0)
  const expected = writeBlob(['L1', '', '- E2E', ''].join('\n'), { root: dir })
  assert.equal(headBlobOf('HEAD', 'DOC.md', { root: dir }), expected)
})

// ── 整行改写档(台账结清用的那一档):判据与插入档同源,回读必须两头都查 ──

test('T10 applyReplacements 纯函数:恰好 1 命中才组装;0 / 2 命中与越界改动都不给 next', () => {
  const lines = ['# 标题', '- [ ] **D1 待办**:说明。', '段落二']
  const ok = __test__.applyReplacements(lines, [
    { before: '- [ ] **D1 待办**:说明。', after: '- [x] ✅(2026-09-27) **D1 待办**:说明。' },
  ])
  assert.equal(ok.ok, true)
  assert.deepEqual(ok.next, ['# 标题', '- [x] ✅(2026-09-27) **D1 待办**:说明。', '段落二'])
  assert.equal(
    __test__.applyReplacements(lines, [{ before: '- [ ] 没有这行', after: 'X' }]).ok,
    false,
  )
  assert.equal(
    __test__.applyReplacements([...lines, ...lines.slice(1)], [{ before: lines[1], after: 'X' }])
      .reason,
    'replace-multi-hit#1:2',
    '同文两行 ⇒ 无法确定改哪一行,必须交人工(不猜)',
  )
})

test('T10b 同文孪生档(all:true):N 份副本一起改,其余行逐字原位;不带 all 时同文仍拒(旧锁未松)', () => {
  const twin = '- [x] ✅(2026-09-27)（进行中@2026-09-27/qa）**86A. 证据流水**:说明。'
  const bare = twin.replace('（进行中@2026-09-27/qa）', '')
  const lines = ['# 标题', twin, '段落一', twin, '段落二', twin]
  const r = __test__.applyReplacements(lines, [{ before: twin, after: bare, all: true }])
  assert.equal(r.ok, true, '同文三份 + all ⇒ 必须落地,否则半新半旧比不改更糟')
  assert.deepEqual(r.next, ['# 标题', bare, '段落一', bare, '段落二', bare])
  assert.equal(r.hits.length, 3, '三条命中都要记账,否则 untouched-line-drift 会把它们漏判成"不该动"')
  assert.equal(r.multi.length, 1, '同文全改必须回报,让成功行里能打印命中数')
  assert.equal(r.multi[0].count, 3)
  // 反向锁:放宽只发生在显式声明 all 的项上
  assert.equal(
    __test__.applyReplacements(lines, [{ before: twin, after: bare }]).reason,
    'replace-multi-hit#1:3',
    '不带 all ⇒ 同文多行仍必须拒 ⇒ "恰好 1 次"这条旧锁不能被顺手放宽',
  )
  // 0 命中即使带 all 也拒(放宽的是"哪一份",不是"有没有这一份")
  assert.equal(
    __test__.applyReplacements(lines, [{ before: '- [ ] 没有这行', after: 'X', all: true }])
      .reason,
    'replace-not-found#1',
  )
})

test('T10c 顺序替换的自咬防护:一项 before 等于另一项 after ⇒ chain-hit 拒绝,不静默改两遍', () => {
  const lines = ['- [ ] A:说明。', '- [x] ✅(2026-09-27) B:说明。']
  const r = __test__.applyReplacements(lines, [
    { before: '- [ ] A:说明。', after: '- [x] ✅(2026-09-27) B:说明。' },
    { before: '- [x] ✅(2026-09-27) B:说明。', after: '- [x] ✅(2026-09-28) B:说明。', all: true },
  ])
  assert.equal(r.ok, false, '第二项会把第一项刚产出的行再改一遍,而声明里没有这件事')
  assert.match(String(r.reason), /^chain-hit#2<-1$/)
})
test('T11 端到端·整行改写:落地后旧形态逐条为零、其余行逐字原位、主索引对齐', (t) => {
  const src = ['# 标题', '段落一', '- [ ] **D1 待办**:说明。', '段落二', '']
  const { dir, inputs } = makeDocRepo(t, src.join('\n'))
  // 〔收口:枚 <sha>〕在 T11 里只是"改写后的行长什么样"的装饰,本用例判的是改写三不变量。
  // 但工具的 sha 可解析性判据(G-1079146)会当场把**新增**的那枚指针问一遍(`git rev-parse --verify
  // <token>^{commit}`,root = LIVE_ROOT 即本夹具仓),答"问不到"就拒落该行。旧夹具写的 `abc1234`
  // 是凭空的七位 hex,在任何仓里都不存在 ⇒ 与判据对撞。这里用**夹具仓真有的那枚 commit**(而不是
  // 该判据的应急旗 LIVE_SHA_ALLOW):判据答"可解析"⇒ 照原样落地,三条不变量一条未减,且这一写法
  // 在"有 sha 判据"与"无 sha 判据"两个面上都成立(不依赖被测工具此刻带不带那一维)。
  const realSha = norm(runGit(dir, ['rev-parse', 'HEAD'])).trim()
  assert.match(realSha, /^[0-9a-f]{7,40}$/, `夹具的 HEAD  sha 形状不对:${realSha}`)
  const after = `- [x] ✅(2026-09-27) **D1 待办**:说明。 〔收口:枚 ${realSha}〕`
  const rep = join(inputs, 'rep.json')
  writeFileSync(rep, JSON.stringify([{ before: src[2], after }]), 'utf8')
  const r = runLive(dir, { replaceFile: rep })
  assert.equal(r.status, 0, `应成功:${r.stdout}|${r.stderr}`)
  assert.match(r.stdout, /旧形态整行归零/)
  const now = norm(git(['show', 'HEAD:DOC.md'], { root: dir, raw: true })).split('\n')
  assert.deepEqual(
    now,
    ['# 标题', '段落一', after, '段落二', ''],
    '除声明行外不得有任何位移',
  )
  assert.equal(indexBlobOf('DOC.md', { root: dir }), headBlobOf('HEAD', 'DOC.md', { root: dir }))
})

test('T12 端到端·整行改写的两型拒绝:锚点已漂 ⇒ 不写盘;插入档与改写档互斥 ⇒ exit 2', (t) => {
  const src = ['# 标题', '- [ ] **D1 待办**:说明。', '']
  const { dir, inputs } = makeDocRepo(t, src.join('\n'))
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  const rep = join(inputs, 'rep.json')
  writeFileSync(
    rep,
    JSON.stringify([{ before: '- [ ] **D1 待办**:说明。(别人又追加了一句)', after: 'X' }]),
    'utf8',
  )
  const r = runLive(dir, { replaceFile: rep })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /在 HEAD 版里找不到/)
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), before, '拒绝时 HEAD 必须原地不动')
  writeFileSync(join(inputs, 'block.txt'), '- 登记甲\n')
  // 互斥档必须**同时**把两个 env 喂进去才测得到(runLive 会替调用方删掉另一个 ⇒ 测的就不是那一型了)
  const both = spawnSync(process.execPath, [TOOL], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      LIVE_ROOT: dir,
      LIVE_DOC: 'DOC.md',
      LIVE_MSG: 'docs: e2e',
      LIVE_REPLACE_FILE: rep,
      LIVE_BLOCK_FILE: join(inputs, 'block.txt'),
    },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
  })
  assert.equal(both.status, 2, '一次只做一件事:两档同时给 ⇒ 用法错,不写盘')
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), before, '互斥拒绝时 HEAD 也必须原地不动')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

test('T13 追加注记型改写(after 以 before 开头)必须判成功并做完索引对齐 —— 子串判据会误报"没生效"', (t) => {
  // 台账更正绝大多数是"原行不动、行尾追加一句〔更正(日期)…〕",此时 before 天然是 after 的前缀。
  // 旧回读用 `doc.includes(before)` ⇒ 判"旧形态仍在"而 exit 1,而主索引对齐在 exit 之后 ⇒
  // 提交已落地、索引却停在父提交 blob,别人一次不带 pathspec 的普通提交就把这次交付写回旧版。
  const src = ['# 计划', '- [ ] D9 某任务:等 owner 定权威。', '尾行']
  const { dir, inputs } = makeDocRepo(t, src.join('\n'))
  const rep = join(inputs, 'rep2.json')
  writeFileSync(
    rep,
    JSON.stringify([
      { before: src[1], after: `${src[1]} 〔更正(2026-09-27):本行应归"等人拍板"。〕` },
    ]),
    'utf8',
  )
  const r = runLive(dir, { replaceFile: rep })
  assert.equal(r.status, 0, `追加注记型必须判成功:${r.stdout}|${r.stderr}`)
  assert.match(r.stdout, /主索引已对齐 1\/1/)
  const now = norm(git(['show', 'HEAD:DOC.md'], { root: dir, raw: true })).split('\n')
  assert.equal(now[1], `${src[1]} 〔更正(2026-09-27):本行应归"等人拍板"。〕`)
  assert.equal(indexBlobOf('DOC.md', { root: dir }), headBlobOf('HEAD', 'DOC.md', { root: dir }))
})

/**
 * T14 取号令牌的纯函数面:号由**底稿**算出,不是由调用方给。
 * 三条各钉一型:① 正常递增 ② 该族一条没有 ⇒ 拒绝(不是给 "<族>-1") ③ 无令牌 ⇒ 原样通过(不改任何行)。
 */
test('T14 resolveIdTokens:号来自底稿、取不到即拒绝、无令牌不误伤', () => {
  const base = '- [ ] **G-1 甲**:x\n- [ ] **G-7 乙**:y\n- [ ]75. 章节内裸序号不占号段\n'
  const r = __test__.resolveIdTokens(
    ['- [ ]（进行中@2026-09-27/主会话）**{{NEXT_ID:G}} 新条目**:正文'],
    base,
  )
  assert.equal(r.ok, true)
  assert.match(r.lines[0], /\*\*G-8 新条目\*\*/, `实得 ${r.lines[0]}`)
  assert.equal(r.assigned, 'G-8')
  const none = __test__.resolveIdTokens(['{{NEXT_ID:Z}} 条目'], base)
  assert.equal(none.ok, false, '该族一条没有时必须拒绝,而不是发一个 Z-1')
  assert.match(String(none.reason), /no-such-family:Z/)
  const plain = __test__.resolveIdTokens(['- [ ] **G-9 无令牌**'], base)
  assert.equal(plain.assigned, null)
  assert.deepEqual(plain.lines, ['- [ ] **G-9 无令牌**'], '没有令牌就不该动任何一行')
  // 一块里两个同族令牌必须**递增**,不得都算 max+1 —— 那样本器自己就产出了它要防的那一型。
  const two = __test__.resolveIdTokens(
    ['- [ ] **{{NEXT_ID:G}} 甲件**:x', '- [ ] **{{NEXT_ID:G}} 乙件**:y'],
    base,
  )
  assert.equal(two.ok, true)
  assert.match(two.lines[0], /\*\*G-8 甲件\*\*/, `实得 ${two.lines[0]}`)
  assert.match(two.lines[1], /\*\*G-9 乙件\*\*/, `实得 ${two.lines[1]}`)
  assert.equal(two.assigned, 'G-8,G-9', `报名应列出两个号,实得 ${two.assigned}`)
  // 混族也要各自独立递增(两族共用一张游标会串号),且**按各族自己的书写形状**发号:
  // 本仓 G 族写 `G-265` 带连字符,O 族写 `O4` 不带 —— 形状印错就是给一个判据认不出来的号。
  const mixed = __test__.resolveIdTokens(
    ['{{NEXT_ID:G}} 一号', '{{NEXT_ID:O}} 二号', '{{NEXT_ID:G}} 三号'],
    `${base}- [ ] **O4 丙**:z\n`,
  )
  assert.deepEqual(
    [mixed.lines[0], mixed.lines[1], mixed.lines[2]],
    ['G-8 一号', 'O5 二号', 'G-9 三号'],
    `跨族游标与形状都必须独立,实得 ${JSON.stringify(mixed.lines)}`,
  )
})

/**
 * T15 端到端:落地后的 HEAD 行里**只剩算出来的号**,令牌本身不得入库。
 * 这一条同时是"令牌真被 CAS 用上"的装车证明 —— 纯函数测过却没人调,就是本仓反复登记的那一型。
 */
test('T15 端到端:带令牌的块落地后 HEAD 含算出的号且不含令牌', (t) => {
  const { dir, inputs } = makeDocRepo(t, '- [ ] **G-3 旧条目**:x\n@@ANCHOR@@\n')
  const blockFile = join(inputs, 'block.txt')
  writeFileSync(
    blockFile,
    '- [ ]（进行中@2026-09-27/主会话）**{{NEXT_ID:G}} 取号落地**:正文\n',
    'utf8',
  )
  const r = runLive(dir, { blockFile })
  assert.equal(r.status, 0, `落地应成功,实得 ${r.status}\n${r.stdout}\n${r.stderr}`)
  // 原断言钉 `=G-4`(= 该族 max+1)。千段租约(G-916936)之后那句前提已经不成立 —— 新占段起点
  // 还带一个由机器标识派生的偏移(G-815400,两机同 floor 时让占段分开)。所以改钉**同一次运行
  // 的三行读数自洽**:落地的号必须恰是这一次租约宣布的那一枚(readNumbering 内已断言),
  // 并且 claim 支必须站在当次底稿之上 —— 这三条一起比"等于 G-4"更强:字面量只排除了别的号,
  // 而它既没规定"号必须来自租约读数"、也没规定"号必须 > 占用面 max"。
  const run = readNumbering(r.stdout, 'T15')
  assert.equal(
    run.ids.length,
    1,
    `一块只放了一枚令牌,取号读数却给了 ${run.ids.length} 枚:${run.ids.join(',')}`,
  )
  assert.equal(run.lease.mode, 'claim', `夹具是新建的临时仓,不可能有自有段:\n${r.stdout}`)
  assert.equal(run.basis.family, 'G', `族名从报告里读出来不是 G:${JSON.stringify(run.basis)}`)
  assert.equal(
    run.basis.localMax,
    3,
    `夹具底稿只有 G-3 ⇒ 基准行的本地 max 必须是 3(不是 3 就是本用例的底稿被改动过,后面的关系断言全部失去意义):\n${r.stdout}`,
  )
  assert.ok(
    idNum(run.id, 'T15·落地的号') > run.basis.localMax,
    `新占段必须站在当次底稿之上:号 ${run.id} ≤ 本地 max ${run.basis.localMax} 就是发一枚已被占的号`,
  )
  const now = norm(runGit(dir, ['show', 'HEAD:DOC.md']))
  assert.match(now, idRowRe(run.id, '取号落地'), `HEAD 里没有同一次运行算出的那个号:\n${now}`)
  assert.doesNotMatch(now, /NEXT_ID/, '令牌本身绝不能留在文档里')
})

/** T16 改写档也要能吃令牌(让号场景就是它:把别人占了的号挪走)。 */
test('T16 整行改写档支持令牌:after 里的号由 HEAD 底稿现算', (t) => {
  const { dir, inputs } = makeDocRepo(t, '- [ ] **G-5 旧标题**:正文一句\n')
  const repl = join(inputs, 'repl.json')
  writeFileSync(
    repl,
    JSON.stringify([
      {
        before: '- [ ] **G-5 旧标题**:正文一句',
        after: '- [x] ✅(2026-09-27) **{{NEXT_ID:G}} 让号后**:正文一句',
      },
    ]),
    'utf8',
  )
  const r = runLive(dir, { replaceFile: repl })
  assert.equal(r.status, 0, `落地应成功,实得 ${r.status}\n${r.stdout}\n${r.stderr}`)
  // 同 T15:原断言钉 `G-6`(= max+1)⇒ 与千段租约漂移。改写档的语义是"after 里那枚号必须来自
  // 这一次对 HEAD 底稿的取号",所以钉三行读数的自洽 + 号 > 当次底稿 max,而不钉具体号。
  const run = readNumbering(r.stdout, 'T16')
  assert.equal(
    run.ids.length,
    1,
    `改写档只有一枚令牌,取号读数给了 ${run.ids.length} 枚:${run.ids.join(',')}`,
  )
  assert.equal(run.lease.mode, 'claim', `新建临时仓没有自有段,不该走连号支:\n${r.stdout}`)
  assert.equal(
    run.basis.localMax,
    5,
    `夹具底稿只有 G-5 ⇒ 基准行的本地 max 必须是 5(否则本用例的底稿被换过,关系断言无意义):\n${r.stdout}`,
  )
  assert.ok(
    idNum(run.id, 'T16·落地的号') > run.basis.localMax,
    `让号后的新号必须比当次底稿 max(${run.basis.localMax}) 大,实得 ${run.id}`,
  )
  const now = norm(runGit(dir, ['show', 'HEAD:DOC.md']))
  assert.match(now, idRowRe(run.id, '让号后'), `改写后的行没拿到同一次运行算出的号:\n${now}`)
  assert.doesNotMatch(now, /NEXT_ID|G-5 旧标题/, '令牌与旧形态都必须消失')
})

// ── G-313 出路②:号段基准同时看远端那一份(2026-09-28)──────────────────────────────
// 票面要求"方向必须成对",所以每一支都配了反向对照:
//  N2 远端只抬高不压低(远端大 ⇒ 跳过那段;同值 / 更小 / 缺席 ⇒ 与改动前逐字同形);
//  N3 readRemoteIdBasis 的六条出口一律"只降级、不失败、且点名原因";
//  N4 端到端走**真实 ls-remote 传输**(夹具 origin,file:// 零网络):对象不在本地 ⇒ 降级并按本地落号,
//     对象进夹具后 ⇒ 同一把尺子改判成"跳过远端那段";
//  N5 反向锁:基准计算必须在 CAS 循环**内**(提到循环外 ⇒ 本条翻红);
//  N6 形状锁:远端派生各自带数字 timeout、绝不为取号 fetch / 写 ref、不再抄第二份派生层。

const LDE_LOCAL_BASE = '- [ ] **G-3 旧条目**:x\n'
const LDE_LINE = '- [ ]（进行中@2026-09-28/工具）**{{NEXT_ID:G}} 新条目**:正文'
const TOOL_SRC = norm(readFileSync(TOOL, 'utf8'))
const fakeTransport = (over = {}) => ({
  tipSha: () => ({ ok: true, sha: 'f'.repeat(40) }),
  hasCommit: () => true,
  docContent: () => '- [ ] **G-9 远端已占**:别人那批\n',
  ...over,
})

test('N1 §22c 新增导出面:远端基准的四个出口必须在 __test__ 里(否则测试只能重抄判据)', () => {
  for (const k of ['readRemoteIdBasis', 'idTokenFamilies', 'describeIdBasis', 'remoteTarget'])
    assert.equal(typeof __test__[k], 'function', `__test__.${k} 缺失`)
  assert.equal(typeof __test__.REMOTE_ID_TRANSPORT, 'object')
  for (const k of ['tipSha', 'hasCommit', 'docContent', 'hydrate'])
    assert.equal(typeof __test__.REMOTE_ID_TRANSPORT[k], 'function', `transport.${k} 缺失`)
  assert.deepEqual(
    __test__.idTokenFamilies([LDE_LINE, '{{NEXT_ID:O}} 乙', '{{NEXT_ID:G}} 丙', '无令牌']),
    ['G', 'O'],
    '族集合由正文推得并按出现顺序去重(硬写清单必然腐烂)',
  )
  assert.deepEqual(__test__.idTokenFamilies(['一个令牌都没有']), [])
})

test('N2 方向成对:远端 max 更大 ⇒ 新号跳过远端那段;同值 / 更小 / 缺席 ⇒ 与改动前逐字同形', () => {
  const legacy = __test__.resolveIdTokens([LDE_LINE], LDE_LOCAL_BASE)
  assert.ok(legacy.lines[0].includes('**G-4 新条目**'), `改动前的形状:${legacy.lines[0]}`)

  // (a) 本票唯一真正的产出:远端那批已占 G-9 ⇒ 本地"下一个空闲号"G-4 其实早被占了 ⇒ 让到 G-10
  const raised = __test__.resolveIdTokens([LDE_LINE], LDE_LOCAL_BASE, { max: { G: 9 } })
  assert.ok(
    raised.lines[0].includes('**G-10 新条目**'),
    `远端更大时必须跳段,实得 ${raised.lines[0]}`,
  )
  assert.equal(raised.assigned, 'G-10')
  assert.deepEqual(raised.basis, [{ family: 'G', localMax: 3, remoteMax: 9, chosenMax: 9 }])

  // (c) 远端与本地同 max ⇒ 与"没有远端"逐字一致(防"新基准顺手把号抬了一位")
  assert.deepEqual(
    __test__.resolveIdTokens([LDE_LINE], LDE_LOCAL_BASE, { max: { G: 3 } }).lines,
    legacy.lines,
  )
  // 远端更小 ⇒ 绝不压低基准(远端可能是旧 tip,压回去等于把号退回别人占过的段)
  assert.deepEqual(
    __test__.resolveIdTokens([LDE_LINE], LDE_LOCAL_BASE, { max: { G: 1 } }).lines,
    legacy.lines,
  )
  // 远端缺席(降级 / 该族在远端为空 / 压根没查)⇒ 同旧行为
  for (const r of [null, undefined, { max: {}, notes: ['对象不在本地'] }])
    assert.deepEqual(__test__.resolveIdTokens([LDE_LINE], LDE_LOCAL_BASE, r).lines, legacy.lines)

  // 两族各自独立抬高(串号 = 本器自己造出撞号那一型),且形状仍按本地底稿的写法
  const twoFam = __test__.resolveIdTokens(
    ['- [ ] **{{NEXT_ID:O}} 甲**:x', LDE_LINE],
    `${LDE_LOCAL_BASE}- [ ] **O2 丙**:y\n`,
    { max: { G: 9, O: 7 } },
  )
  assert.ok(
    twoFam.lines[0].includes('**O8 甲**'),
    `O 族要按远端抬到 7 再递增,实得 ${twoFam.lines[0]}`,
  )
  assert.ok(twoFam.lines[1].includes('**G-10 新条目**'), `实得 ${twoFam.lines[1]}`)
  // 一块里两个同族令牌在抬高后的基准上仍然逐个递增
  const twoTokens = __test__.resolveIdTokens(
    ['- [ ] **{{NEXT_ID:G}} 甲**:x', '- [ ] **{{NEXT_ID:G}} 乙**:y'],
    LDE_LOCAL_BASE,
    { max: { G: 9 } },
  )
  assert.ok(
    twoTokens.lines[0].includes('**G-10 甲**') && twoTokens.lines[1].includes('**G-11 乙**'),
    `实得 ${JSON.stringify(twoTokens.lines)}`,
  )

  // "号段基准"那一行必须把三条读数一起给 —— 只印最终值就分不清远端有没有参与
  assert.ok(
    __test__
      .describeIdBasis(
        { family: 'G', localMax: 3, remoteMax: 9, chosenMax: 9 },
        { ref: 'refs/heads/main' },
      )
      .includes(
        '号段基准:G=9(本地 HEAD 该族 max=3 / 远端 refs/heads/main max=9 ⇒ 取较大,新号跳过远端那段)',
      ),
    `抬高态措辞:\n${__test__.describeIdBasis({ family: 'G', localMax: 3, remoteMax: 9, chosenMax: 9 }, { ref: 'refs/heads/main' })}`,
  )
  const degraded = __test__.describeIdBasis(
    { family: 'G', localMax: 3, remoteMax: null, chosenMax: 3 },
    { ref: 'refs/heads/main' },
  )
  assert.ok(
    degraded.includes('远端未参与') && degraded.includes('未与远端对齐'),
    `降级措辞:${degraded}`,
  )
  assert.ok(!degraded.includes('已与远端对齐'), '降级绝不得被读成已对齐')
  assert.ok(
    __test__
      .describeIdBasis({ family: 'G', localMax: 3, remoteMax: 3, chosenMax: 3 }, { ref: 'r' })
      .includes('与本地同值,与改动前同形'),
  )
})

test('N3 readRemoteIdBasis:远端问不到一律只降级不失败,且每条原因点名(把"没判"写成"判过了"是本仓最高频失效型)', () => {
  const base = { root: 'X:', doc: 'DOC.md', families: ['G'] }
  const ok = __test__.readRemoteIdBasis({ ...base, transport: fakeTransport() })
  assert.deepEqual(ok.max, { G: 9 }, 'max 必须来自**远端那份底稿**现读,不是常量')
  assert.deepEqual(ok.notes, [])
  assert.equal(ok.tipSha, 'f'.repeat(40))

  // ① ls-remote 抛(网络不可达 / 无 origin / 非 win32 拿不到 git / 超时)⇒ 降级,不抛
  const net = __test__.readRemoteIdBasis({
    ...base,
    transport: fakeTransport({
      tipSha: () => {
        throw new Error('ssh: connect to github.com port 443 timed out')
      },
    }),
  })
  assert.deepEqual(net.max, {})
  assert.match(net.notes[0], /远端不可问/)
  assert.match(net.notes[0], /timed out/, '原因必须带上 git 的那句话,不能只说"没读到"')

  // ② ls-remote 通了而该 ref 不存在 ⇒ 也是降级,不得当成"远端 max=0"
  const noref = __test__.readRemoteIdBasis({
    ...base,
    transport: fakeTransport({
      tipSha: () => ({ ok: false, reason: 'origin 上没有 refs/heads/main' }),
    }),
  })
  assert.deepEqual(noref.max, {})
  assert.match(noref.notes[0], /origin 上没有 refs\/heads\/main/)

  // ③ tip 对象不在本地 ⇒ 票面那句措辞(它**不 fetch、不写 ref**)
  const missing = __test__.readRemoteIdBasis({
    ...base,
    transport: fakeTransport({
      hasCommit: () => {
        throw new Error('fatal: Not a valid object name deadbeef^{commit}')
      },
    }),
  })
  assert.deepEqual(missing.max, {})
  assert.match(missing.notes[0], /^对象不在本地,原因:/, `实得 ${missing.notes[0]}`)
  // 降级之后取号仍然落得了地(与 resolveIdTokens 串起来的那一支)
  assert.ok(
    __test__
      .resolveIdTokens([LDE_LINE], LDE_LOCAL_BASE, missing)
      .lines[0].includes('**G-4 新条目**'),
    '远端这一维没判到 ⇒ 按本地基准发号,而不是拒绝落地',
  )

  // ④ 对象在而文档读不出(tip 里没这份文档)⇒ 另一条独立原因,不得混进"对象不在本地"
  const noDoc = __test__.readRemoteIdBasis({
    ...base,
    transport: fakeTransport({
      docContent: () => {
        throw new Error('fatal: path DOC.md does not exist')
      },
    }),
  })
  assert.match(noDoc.notes[0], /读不到 DOC\.md/)
  assert.doesNotMatch(noDoc.notes[0], /对象不在本地/)

  // ⑤ 远端可读而该族在远端一条登记行都没有 ⇒ "读到且为空",与降级分开措辞、同样不构成上界
  const emptyFam = __test__.readRemoteIdBasis({
    ...base,
    transport: fakeTransport({ docContent: () => '# 空的\n' }),
  })
  assert.deepEqual(emptyFam.max, {})
  assert.match(emptyFam.notes[0], /不构成上界/)
  assert.doesNotMatch(emptyFam.notes[0], /对象不在本地|远端不可问/)

  // ⑥ transport 没返回文本 ⇒ 判不出,不算"远端没有这一族"
  const nullContent = __test__.readRemoteIdBasis({
    ...base,
    transport: fakeTransport({ docContent: () => null }),
  })
  assert.match(nullContent.notes[0], /判不出,不算已对齐/)

  // ⑦ 没有令牌(families 空)⇒ 一次远端都不问,零副作用
  let asked = 0
  const none = __test__.readRemoteIdBasis({
    ...base,
    families: [],
    transport: {
      tipSha: () => {
        asked += 1
        return { ok: true, sha: '' }
      },
      hasCommit: () => true,
      docContent: () => '',
    },
  })
  assert.equal(asked, 0, '没有令牌就不该为取号去问远端')
  assert.deepEqual([none.max, none.notes], [{}, []])
})

test('N3b 自补救 fetch(2026-09-30 契约升级):补成功 ⇒ 远端面读齐且不打"未对齐";补失败 ⇒ 进未补齐档并点名', () => {
  const base = { root: '/r', doc: 'DOC.md', families: ['G'] }
  // (a) 阳性:对象缺失 → hydrate 成功 → hasCommit 复查通过 → 远端面读齐;notes 必须为空、过程进 info
  let hasCommitCalls = 0
  const ok = __test__.readRemoteIdBasis({
    ...base,
    transport: fakeTransport({
      hasCommit: () => {
        hasCommitCalls += 1
        if (hasCommitCalls === 1) throw new Error("fatal: Not a valid object name ffffffff")
        return true
      },
      hydrate: () => true,
    }),
  })
  assert.deepEqual(ok.max, { G: 9 }, `补 fetch 后必须读到远端面,实得 ${JSON.stringify(ok.max)}`)
  assert.deepEqual(ok.notes, [], '补齐成功不得留任何"未判到"注记(notes 会被打成未对齐 ⇒ 反向假话)')
  assert.equal(ok.remoteAheadUnfetched, false)
  assert.match(ok.info.join('\n'), /已自补救一次 fetch/, '过程注记必须在 info 里')

  // (b) 阴性:hydrate 自身失败 ⇒ 进未补齐档,首次缺失与 fetch 失败两条原因都点名
  const failed = __test__.readRemoteIdBasis({
    ...base,
    transport: fakeTransport({
      hasCommit: () => {
        throw new Error('fatal: Not a valid object name')
      },
      hydrate: () => {
        throw new Error('fatal: could not read from remote repository')
      },
    }),
  })
  assert.equal(failed.remoteAheadUnfetched, true)
  assert.match(failed.notes[0], /自补救 fetch 失败/)
  assert.match(failed.notes[0], /could not read from remote repository/)

  // (c) 阴性:fetch 跑了但对象仍不在 ⇒ 同样进未补齐档
  const still = __test__.readRemoteIdBasis({
    ...base,
    transport: fakeTransport({
      hasCommit: () => {
        throw new Error('fatal: Not a valid object name')
      },
      hydrate: () => true,
    }),
  })
  assert.equal(still.remoteAheadUnfetched, true)
  assert.match(still.notes[0], /自补救 fetch 后仍读不到/)

  // (d) 兼容:transport 没给 hydrate(旧夹具形态)⇒ 保持旧行为,直接进未补齐档,不得谎称补过
  const legacy = __test__.readRemoteIdBasis({
    ...base,
    transport: fakeTransport({
      hasCommit: () => {
        throw new Error('fatal: Not a valid object name')
      },
    }),
  })
  assert.equal(legacy.remoteAheadUnfetched, true)
  assert.match(legacy.notes[0], /对象不在本地,原因:/)
  assert.doesNotMatch(legacy.notes[0], /fetch/)
})

test('N4 端到端·真实 ls-remote(夹具 origin,file:// 零网络):自补救 fetch 抬号支与离线降级支各跑一次', (t) => {
  // A = "远端"夹具(与 B 无共同历史),B = 被测仓(origin → A)。
  // 2026-09-30 契约升级:对象不在本地不再"拒绝 + 留一条 fetch 命令给调用方"(§5b 禁手工 fetch/
  // merge/push 循环,拦住不自助只会把每个调用方逼向应急旗),而是本器自补救一次有界 fetch 后
  // 读齐远端面;仍读不到才拒绝 —— 拒绝支的真仓复现需要"ls-remote 通而 fetch 败",file:// 夹具
  // 造不出来 ⇒ 该支由 N3b 阴性例与 idBasisGate 单测(下方 G-321 区块)覆盖,这里只端到端跑到
  // 两支可达的:自补救成功(抬号)与远端完全不可问(离线降级)。
  const a = mkScratch('lde-origin-')
  t.after(() => rmScratch(a))
  runGit(a, ['init', '-q', '-b', 'main'])
  writeFileSync(join(a, 'DOC.md'), '- [ ] **G-9 远端已占**:别人那批\n')
  runGit(a, ['add', '-A'])
  runGit(a, ['commit', '-q', '-m', 'remote advance'])

  const { dir, inputs } = makeDocRepo(t, '- [ ] **G-3 旧条目**:x\n@@ANCHOR@@\n')
  runGit(dir, ['remote', 'add', 'origin', pathToFileURL(a).href])
  const blockFile = join(inputs, 'block.txt')
  writeFileSync(blockFile, `${LDE_LINE}\n`, 'utf8')

  // ── 阶段一:B 从未见过 A 那枚 commit ⇒ 自补救 fetch 后读齐远端面 ⇒ 号必须跳过远端那段 ──
  const r1 = runLive(dir, { blockFile })
  assert.equal(r1.status, 0, `自补救 fetch 后必须落得了地,实得 ${r1.status}\n${r1.stdout}\n${r1.stderr}`)
  assert.ok(r1.stdout.includes('已自补救一次 fetch'), `过程注记必须在场:\n${r1.stdout}`)
  assert.ok(
    !r1.stdout.includes('未与远端对齐'),
    `远端面已读齐 ⇒ 不得再喊"未与远端对齐"(info 混进降级行就是反向假话):\n${r1.stdout}`,
  )
  assert.ok(
    r1.stdout.includes(
      '号段基准:G=9(本地 HEAD 该族 max=3 / 远端 refs/heads/main max=9 ⇒ 取较大,新号跳过远端那段)',
    ),
    `实得:\n${r1.stdout}`,
  )
  // 原断言钉 `=G-10`(= chosenMax+1)。千段租约之后 claim 支的段首是 `floor+1+off`
  // (off 由机器标识派生,G-815400)⇒ 字面量必然漂。本用例立票的语义是**关系**,不是那个数:
  //  ① 落地的号必须恰是同一次租约读数宣布的那一枚(readNumbering 内已断言,含"号在段内且 < 段尾");
  //  ② 远端那份必须真的参与(localMax=3 / remoteMax=9 从同一行读数里核);
  //  ③ 发出来的号必须**站到远端已占那段之上** —— 这才是 G-313 要堵的那一型(对面占了 4..9),
  //     它比"等于 G-10"严格更强:≤9 的任何一枚都判红,而字面量只排除了"G-10 以外的一个具体值"。
  const run1 = readNumbering(r1.stdout, 'N4·自补救 fetch 抬号支')
  assert.equal(
    run1.ids.length,
    1,
    `一块只有一枚令牌,取号读数给了 ${run1.ids.length} 枚:${run1.ids.join(',')}`,
  )
  assert.equal(run1.lease.mode, 'claim', `B 从未见过 A 那枚 commit,不可能有自有段:\n${r1.stdout}`)
  assert.equal(run1.basis.localMax, 3, `本地底稿应只有 G-3:\n${r1.stdout}`)
  assert.equal(run1.basis.remoteMax, 9, `远端那一份没参与本次取号 ⇒ 抬号支测的是别的事:\n${r1.stdout}`)
  assert.ok(
    idNum(run1.id, 'N4·抬号支') > run1.basis.remoteMax,
    `远端已占 4..9 ⇒ 本次号必须严格大于远端 max(9),实得 ${run1.id}`,
  )
  const docNow = norm(git(['show', 'HEAD:DOC.md'], { root: dir, raw: true }))
  assert.match(docNow, idRowRe(run1.id, '新条目'), `HEAD 里必须是同一次运行算出的那个号:\n${docNow}`)
  assert.doesNotMatch(
    docNow,
    /\*\*G-4 新条目\*\*/,
    '只看本地 HEAD 会发 G-4 —— 那正是 G-313 要堵的那一型(对面已把 4..9 占掉)',
  )
  assert.ok(
    git(['for-each-ref', '--format=%(refname)'], { root: dir }).includes('refs/remotes/origin'),
    '自补救 fetch 的正面证据(opportunistic remote-tracking ref 已在;它随后被宿主清理层删掉也不影响判定 —— tip 按 SHA 读)',
  )

  // ── 阶段二:远端整个不可问(origin 指到不存在的路径)⇒ 分档①警告着按本地基准落号 ──
  runGit(dir, ['remote', 'set-url', 'origin', pathToFileURL(join(a, 'gone')).href])
  writeFileSync(blockFile, '- [ ] **{{NEXT_ID:G}} 第二条**:y\n', 'utf8')
  const r2 = runLive(dir, { blockFile })
  assert.equal(r2.status, 0, `离线档必须落得了地,实得 ${r2.status}\n${r2.stdout}\n${r2.stderr}`)
  assert.ok(
    r2.stdout.includes('号段基准未含远端(远端不可问') && r2.stdout.includes('未与远端对齐'),
    `离线那一支必须明写未对齐,不得静默:\n${r2.stdout}`,
  )
  // 原断言钉 `=G-11`。此刻占用面里已经有租约行的主键(段尾号),所以"按本地底稿落号"不再等于
  // max+1,而是**在本机自有段内往后连**——语义翻成关系:走 in-lease 支、号是同一次宣布的那一枚、
  // 且严格大于第一次发出的号(绝不再发同一枚)。注意这里刻意**不**要求号 > 基准 max:
  // 基准里那个 max 含租约行主键(段尾号),它不是实号空间(leaseCursor 注释 + 镜像 T3 钉着)。
  const run2 = readNumbering(r2.stdout, 'N4·离线降级支')
  assert.equal(run2.basis.remoteMax, null, `离线那一支的基准行不该读出远端 max:\n${r2.stdout}`)
  assert.equal(
    run2.lease.mode,
    'in-lease',
    `第一次已为本机占过段 ⇒ 第二次应在自有段内连号,实得:\n${run2.lease.line}`,
  )
  assert.ok(
    idNum(run2.id, 'N4·离线降级支') > idNum(run1.id, 'N4·抬号支'),
    `同仓第二次取号必须严格大于第一次(${run1.id}),实得 ${run2.id} ⇒ 同一枚号被发了两次就是撞主键`,
  )
  const doc2 = norm(git(['show', 'HEAD:DOC.md'], { root: dir, raw: true }))
  assert.match(
    doc2,
    idRowRe(run2.id, '第二条'),
    `第二次跑落地后 HEAD 应含它自己那一次算出的号:\n${doc2}`,
  )
})

test('N5 反向锁:号段基准(含远端那一份)必须在 CAS 循环体内重算 —— 提到循环外本条必须翻红', () => {
  const loopStart = TOOL_SRC.indexOf('for (let attempt = 1')
  const loopEnd = TOOL_SRC.indexOf("if (landed === '')")
  assert.ok(loopStart > 0, '找不到 CAS 循环起点(结构漂了,本锁失去意义)')
  assert.ok(loopEnd > loopStart, '找不到 CAS 循环终点')
  // 调用点(排除函数定义那一处)必须**全部**落在循环体内:循环外算一次 = 把远端读数烘成一次性
  const callSites = []
  const re = /readRemoteIdBasis\(\s*\{/g
  let m
  while ((m = re.exec(TOOL_SRC))) {
    const before = TOOL_SRC.slice(Math.max(0, m.index - 9), m.index)
    if (!before.endsWith('function ')) callSites.push(m.index)
  }
  assert.ok(callSites.length >= 1, '找不到 readRemoteIdBasis 的调用点(远端基准那一条没装车)')
  const outside = callSites.filter((i) => i < loopStart || i > loopEnd)
  assert.deepEqual(
    outside,
    [],
    `号段基准被提到 CAS 循环外 ${outside.length} 处:每轮必须重算(HEAD 会动,远端 tip 也会动)`,
  )
  // 旧半边同锁:每轮也必须重取本地 HEAD 底稿
  assert.ok(
    TOOL_SRC.slice(loopStart, loopEnd).includes("git(['rev-parse', 'HEAD']"),
    'CAS 循环内必须重取 HEAD',
  )
  assert.ok(
    TOOL_SRC.slice(loopStart, loopEnd).includes(
      'resolveIdTokens(targetLines, baseContent, remote',
    ),
    '取号必须吃到本轮的远端基准,而不是上一轮的(前缀锁:第三位必须是本轮 remote;第四位的租约参数属 G-916936 扩展,不得挪出循环)',
  )
})

test('N6 形状锁:远端四次派生各自带数字 timeout、fetch 只许住在 hydrate 且带 --no-tags、不抄第二份派生层', () => {
  const tStart = TOOL_SRC.indexOf('export const REMOTE_ID_TRANSPORT = {')
  const tEnd = TOOL_SRC.indexOf('export function readRemoteIdBasis')
  assert.ok(tStart > 0 && tEnd > tStart, '传输面与读取面必须相邻(切片找不到就是结构漂了)')
  const transportSrc = TOOL_SRC.slice(tStart, tEnd)
  const gitCalls = (transportSrc.match(/\bgit\(\[/g) || []).length
  const timeouts = (transportSrc.match(/timeout:/g) || []).length
  assert.equal(gitCalls, 4, `远端派生恰好四次(ls-remote / cat-file -e / fetch / show),实得 ${gitCalls}`)
  assert.equal(
    timeouts,
    gitCalls,
    '每一次远端派生都必须带 timeout(守门 80 口径;本仓实测过无超时挂 80 分钟)',
  )
  assert.match(
    transportSrc,
    /'fetch',\s*'--no-tags'/,
    '自补救 fetch 必须带 --no-tags(2026-09-30 契约升级:只为取号补对象,tag 面不得被顺带改写)',
  )
  assert.doesNotMatch(
    transportSrc,
    /'(update-ref|push|symbolic-ref)'/,
    '为号段基准去写 ref 依旧禁止(§5b:嵌套 remote-tracking ref 被宿主清理层删、update-ref 返 0 却不落盘;fetch 的 opportunistic 更新不在此列 —— tip 按 SHA 读,不依赖它)',
  )
  assert.doesNotMatch(
    TOOL_SRC,
    /\bexecFileSync\(/,
    'windowsHide 与绝对路径 git 候选只许住在 lib/bypass-git.mjs 那一份里(抄第二份必漂,守门 52 判的就是这个)',
  )
})

// ── G-321 两条判据:① 插入档幂等 ② 退出码分档(内容已落地 vs 仅索引未对齐)(2026-09-28)──────
// 票面要求"成对",所以 ① 有正反两支(重复必须幂等 / 实质不同必须仍插得进),② 也有正反两支
// (已入库未对齐 ⇒ 0 / 没落地 ⇒ 1)。既有 T1..N6 一条未删、一条未放宽。

const G321_ANCHOR = '@@ANCHOR@@'
const G321_BASE = ['# 标题', '段落一', G321_ANCHOR, '段落二', '']
const G321_BLOCK = ['- 登记甲', '- 登记乙']

/**
 * 造一把"别人的活锁、且锁龄已超上限"的现场:`alignSharedIndex` 见 `.git/index.lock` 年龄 > 120s
 * 即返回 `lockAbandoned`(它按设计**不代删别人的锁**),于是"内容已入库 / 索引未对齐"这一档可端到端复现。
 */
function plantStaleIndexLock(dir) {
  const gd = norm(runGit(dir, ['rev-parse', '--git-dir'])).trim()
  const lock = join(dir, gd, 'index.lock')
  writeFileSync(lock, '')
  const old = new Date(Date.now() - 200_000)
  utimesSync(lock, old, old)
  return lock
}

const g321Run = (dir, inputs, blockName = 'block.txt') =>
  runLive(dir, {
    anchorFile: join(inputs, 'anchor.txt'),
    blockFile: join(inputs, blockName),
  })

test('I0 §22c 新增导出面:幂等判据与退出码分档的四个出口必须在 __test__ 里(否则测试只能重抄判据)', () => {
  for (const k of [
    'compileBlockMatchers',
    'blockInPlaceCheck',
    'describeInPlace',
    'alignOutcome',
    'idBasisGate',
  ])
    assert.equal(typeof __test__[k], 'function', `__test__.${k} 缺失`)
})

test('I1 compileBlockMatchers 纯函数:无令牌 ⇒ 纯字面匹配;有令牌 ⇒ 只有编号数字段可变,其余逐字', () => {
  const base = '- [ ] **G-3 旧条目**:x\n- [ ] **O2 丙**:y\n'
  const plain = __test__.compileBlockMatchers(['- 登记甲', 'a.b*c?(d)'], base)
  assert.equal(plain.ok, true)
  assert.deepEqual(plain.families, [], '没有令牌就不该有"可变段"')
  assert.ok(plain.matchers[0].test('- 登记甲'))
  assert.ok(!plain.matchers[0].test('- 登记甲 '), '整行锚定:多一个空格就不是同一行')
  assert.ok(plain.matchers[1].test('a.b*c?(d)'), '块文本里的正则元字符必须按字面判')
  assert.ok(!plain.matchers[1].test('a.bxcc'), '元字符被当通配 ⇒ 什么都能匹配 = 判据失效')

  const tok = __test__.compileBlockMatchers(
    ['- [ ]（进行中@2026-09-28/工具）**{{NEXT_ID:G}} 幂等落地**:正文'],
    base,
  )
  assert.equal(tok.ok, true)
  assert.deepEqual(tok.families, ['G'])
  assert.ok(tok.matchers[0].test('- [ ]（进行中@2026-09-28/工具）**G-4 幂等落地**:正文'))
  assert.ok(
    tok.matchers[0].test('- [ ]（进行中@2026-09-28/工具）**G-129 幂等落地**:正文'),
    '第二次跑号必然不同(第一次的号已进底稿)⇒ 数字段必须视作可变位',
  )
  assert.ok(
    !tok.matchers[0].test('- [ ]（进行中@2026-09-28/工具）**G-4 别的标题**:正文'),
    '实质不同不得被认成同一块 —— 那是票面成对用例的第二条',
  )
  assert.ok(
    !tok.matchers[0].test('- [ ]（进行中@2026-09-28/工具）**O-4 幂等落地**:正文'),
    '族字母不可互换:换族就是另一条登记',
  )
  // 形状现取自该族自己的书写习惯(G 带连字符、O 不带),不在这里再抄一张族表
  const o = __test__.compileBlockMatchers(['- [ ] **{{NEXT_ID:O}} 甲件**:x'], base)
  assert.ok(o.matchers[0].test('- [ ] **O7 甲件**:x'))
  assert.ok(!o.matchers[0].test('- [ ] **O-7 甲件**:x'), 'O 族现读形状是 `O%d`,不该长得像 G 族')
  const nofam = __test__.compileBlockMatchers(['{{NEXT_ID:Z}} 条目'], base)
  assert.equal(nofam.ok, false)
  assert.match(String(nofam.reason), /family-shape-unreadable:Z/, '该族一条没有 ⇒ 判不出,不退化成"逐字等值再判一次"')
})

test('I2 blockInPlaceCheck 纯函数:在位/不等/太短各归一态;锚点 0 或 2 命中一律不表态;EOF 档明确不判', () => {
  const doc = ['A', '@M@', 'X1', 'X2', 'B']
  const mk = (lines) => __test__.compileBlockMatchers(lines, '').matchers
  const inPlace = __test__.blockInPlaceCheck({
    baseLines: doc,
    anchorLines: ['@M@'],
    matchers: mk(['X1', 'X2']),
  })
  assert.equal(inPlace.inPlace, true)
  assert.deepEqual([inPlace.at, inPlace.lines, inPlace.anchorAt], [2, 2, 2], '落点与锚点行号都要交出去(报告要点名)')

  const differs = __test__.blockInPlaceCheck({
    baseLines: doc,
    anchorLines: ['@M@'],
    matchers: mk(['X1', 'ZZ']),
  })
  assert.equal(differs.inPlace, false)
  assert.equal(differs.verdict, 'content-differs')
  assert.equal(differs.firstDiffAt, 4, '1-based 行号必须指向真正不等的那一行')
  assert.equal(differs.actual, 'X2')

  assert.equal(
    __test__.blockInPlaceCheck({ baseLines: doc, anchorLines: ['@M@'], matchers: mk(['X1', 'X2', 'X3', 'X4']) })
      .verdict,
    'too-short',
    '锚点后面不足 N 行 ⇒ 显然没在位(不得拿"截到的部分"当等值)',
  )
  // 锚点命中数不是幂等判据:0 / 2 命中一律**不表态**,交给 assemble 那条既有判据(两处各判必漂移)
  for (const [lines, anchor, hits] of [
    [doc, ['@NOPE@'], 0],
    [[...doc, '@M@'], ['@M@'], 2],
  ]) {
    const r = __test__.blockInPlaceCheck({ baseLines: lines, anchorLines: anchor, matchers: mk(['X1']) })
    assert.equal(r.inPlace, false)
    assert.equal(r.verdict, 'anchor-not-unique')
    assert.equal(r.hits, hits, '命中数要如实交出去,报告才知道是"漂了"还是"有歧义"')
  }
  assert.equal(
    __test__.blockInPlaceCheck({ baseLines: doc, anchorLines: null, matchers: mk(['B']) }).verdict,
    'no-anchor',
    'EOF 档不在幂等射程(头注"已知边界":N4 的既有断言依赖同一块可重复追加)',
  )
  // 令牌那一型在纯函数面上也要能认出来(端到端 I6 是同一条判据的装车证明)
  const withId = __test__.blockInPlaceCheck({
    baseLines: ['@M@', '- [ ] **G-9 幂等落地**:正文'],
    anchorLines: ['@M@'],
    matchers: __test__.compileBlockMatchers(
      ['- [ ] **{{NEXT_ID:G}} 幂等落地**:正文'],
      '- [ ] **G-3 旧**:x\n',
    ).matchers,
  })
  assert.equal(withId.inPlace, true, '同一块、只是号不同 ⇒ 必须认得出已在位')
})

test('I3 describeInPlace 把依据逐字给全:锚点、块行数、落点行号、编号位怎么判的、现读的是哪一面', () => {
  const s = __test__.describeInPlace({
    chk: { inPlace: true, at: 3, lines: 2, anchorAt: 3 },
    anchorLines: [G321_ANCHOR],
    head: 'b'.repeat(40),
    families: ['G'],
  })
  assert.ok(s.includes('本块已在位'), s)
  assert.ok(s.includes('块行数 2'), '票面要求点名块行数')
  assert.ok(s.includes(G321_ANCHOR) && s.includes('第 3 行'), '票面要求点名锚点')
  assert.ok(s.includes('第 4..5 行'), `落点行号:\n${s}`)
  assert.ok(s.includes('编号位按族形状视作可变段') && s.includes('G 族'))
  assert.ok(s.includes('不读磁盘'), '必须说清判的是被审面,不是磁盘副本')
  assert.ok(/退出码 0/.test(s), '必须把"这不是失败"写在同一行里')
  const plain = __test__.describeInPlace({
    chk: { inPlace: true, at: 0, lines: 1, anchorAt: 1 },
    anchorLines: ['@M@'],
    head: 'c'.repeat(40),
    families: [],
  })
  assert.ok(plain.includes('本块无取号令牌'), plain)
})

test('I4 端到端·同锚点重复调用 ⇒ 幂等:第二次不产生新提交、文档里仍只有一份、末行点名"已在位"', (t) => {
  const { dir, inputs } = makeDocRepo(t, G321_BASE.join('\n'))
  writeFileSync(join(inputs, 'anchor.txt'), `${G321_ANCHOR}\n`)
  writeFileSync(join(inputs, 'block.txt'), `${G321_BLOCK.join('\n')}\n`)
  const r1 = g321Run(dir, inputs)
  assert.equal(r1.status, 0, `第一次必须落地:${r1.stdout}|${r1.stderr}`)
  const h1 = git(['rev-parse', 'HEAD'], { root: dir })
  const r2 = g321Run(dir, inputs)
  assert.equal(r2.status, 0, `第二次也必须正常退出(不是失败):${r2.stdout}|${r2.stderr}`)
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), h1, '第二次绝不许产生新提交')
  assert.doesNotMatch(r2.stdout, /CAS 成功/, '第二次不该再走一次 CAS')
  assert.match(r2.stdout, /本块已在位/)
  assert.match(r2.stdout, /块行数 2/)
  assert.match(r2.stdout, new RegExp(G321_ANCHOR), '依据必须点名锚点')
  const doc = norm(git(['show', 'HEAD:DOC.md'], { root: dir, raw: true })).split('\n')
  assert.equal(doc.filter((l) => l === '- 登记甲').length, 1, '重复段落这一型必须一份都不多')
  assert.deepEqual(
    doc,
    [...G321_BASE.slice(0, 3), ...G321_BLOCK, G321_BASE[3], G321_BASE[4]],
    '文档形态须与"只跑了一次"逐字相同',
  )
})

test('I5 端到端·同锚点但内容实质不同 ⇒ 仍然插得进去(反向锁:幂等不得把工具变成"第二次永远不许跑")', (t) => {
  const { dir, inputs } = makeDocRepo(t, G321_BASE.join('\n'))
  writeFileSync(join(inputs, 'anchor.txt'), `${G321_ANCHOR}\n`)
  writeFileSync(join(inputs, 'block.txt'), `${G321_BLOCK.join('\n')}\n`)
  const r1 = g321Run(dir, inputs)
  assert.equal(r1.status, 0, `${r1.stdout}|${r1.stderr}`)
  const h1 = git(['rev-parse', 'HEAD'], { root: dir })
  const other = '- 登记丙(与甲乙无关)'
  writeFileSync(join(inputs, 'block2.txt'), `${other}\n`)
  const r2 = g321Run(dir, inputs, 'block2.txt')
  assert.equal(r2.status, 0, `不同内容必须仍插得进去:${r2.stdout}|${r2.stderr}`)
  assert.match(r2.stdout, /CAS 成功/)
  assert.doesNotMatch(r2.stdout, /本块已在位/, '这一型判成"已在位"就是把合法插入拦在门外')
  assert.notEqual(git(['rev-parse', 'HEAD'], { root: dir }), h1, 'HEAD 必须前进')
  const doc = norm(git(['show', 'HEAD:DOC.md'], { root: dir, raw: true })).split('\n')
  assert.equal(doc.filter((l) => l === other).length, 1)
  assert.equal(doc.filter((l) => l === '- 登记甲').length, 1, '已入库那一份不得被顶掉')
  assert.ok(doc.indexOf(other) < doc.indexOf('- 登记甲'), '插入位仍紧跟锚点(锚点之后第一行)')
})

test('I6 端到端·带取号令牌的块第二次跑:展开后的号不同 ⇒ 仍判"已在位",HEAD 不前进', (t) => {
  const { dir, inputs } = makeDocRepo(t, `- [ ] **G-3 旧条目**:x\n${G321_ANCHOR}\n`)
  writeFileSync(join(inputs, 'anchor.txt'), `${G321_ANCHOR}\n`)
  writeFileSync(
    join(inputs, 'block.txt'),
    '- [ ]（进行中@2026-09-28/工具）**{{NEXT_ID:G}} 幂等落地**:正文\n',
  )
  const r1 = g321Run(dir, inputs)
  assert.equal(r1.status, 0, `第一次必须落地:${r1.stdout}|${r1.stderr}`)
  const run1 = readNumbering(r1.stdout, 'I6·第一次')
  assert.equal(run1.lease.mode, 'claim', `新建临时仓没有自有段:\n${r1.stdout}`)
  assert.equal(run1.basis.localMax, 3, `夹具底稿只有 G-3 ⇒ 基准的本地 max 必须是 3:\n${r1.stdout}`)
  assert.ok(
    idNum(run1.id, 'I6·第一次') > run1.basis.localMax,
    `第一次的号必须站在当次底稿之上,实得 ${run1.id} / max ${run1.basis.localMax}`,
  )
  const h1 = git(['rev-parse', 'HEAD'], { root: dir })
  const r2 = g321Run(dir, inputs)
  assert.equal(r2.status, 0, `号不同也必须认出"已在位":${r2.stdout}|${r2.stderr}`)
  assert.match(r2.stdout, /本块已在位/)
  assert.match(r2.stdout, /编号位按族形状视作可变段\(G 族/)
  assert.doesNotMatch(r2.stdout, /令牌取号\(/, '已在位这一支不产生提交 ⇒ 不该报"取了号"')
  // "第二次展开后的号不同"是本用例的**前提**,不是结论 —— 前提必须可观察,否则 I6 就退化成
  // I4(同内容幂等)而账面仍然全绿。已在位那一支在 CAS 行之前退出,所以号只出现在租约读数的
  // `本次首号=` 上:把它取回来,才能证明这一支确实"若是落地就会发另一枚号"。
  // 原写法是拿 `=G-4` 与文档里不得出现 `G-5` 间接表达这件事;千段租约之后两个都是漂移的字面量。
  const lease2 = leaseReadoutFrom(r2.stdout, 'I6·第二次')
  assert.equal(
    lease2.mode,
    'in-lease',
    `第一次已为本机占段 ⇒ 第二次必须走自有段连号支,否则"号不同"这一前提不是本用例在测的形状:\n${lease2.line}`,
  )
  assert.notEqual(
    lease2.id,
    run1.id,
    `第二次若与第一次取同一枚号(${run1.id}),那"号不同仍认得出同一块"这一维根本没被跑到`,
  )
  assert.ok(
    idNum(lease2.id, 'I6·第二次宣布的号') > idNum(run1.id, 'I6·第一次落地的号'),
    `第二次宣布的号必须严格大于第一次落地的号(实得 ${lease2.id} vs ${run1.id})`,
  )
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), h1, '第二次绝不许产生新提交')
  const doc = norm(git(['show', 'HEAD:DOC.md'], { root: dir, raw: true }))
  assert.equal(
    (doc.match(/幂等落地/g) ?? []).length,
    1,
    '逐字等值判据在这一型上必然漏掉 ⇒ 会多出第二份',
  )
  assert.match(doc, idRowRe(run1.id, '幂等落地'), `在位的那一份必须是第一次落地的那一枚号:\n${doc}`)
  // 旧断言 `doesNotMatch(doc, /G-5/)` 只排除"下一枚恰好叫 G-5"这一种;按号钉之后**任何**一枚不同
  // 的号都被排除(租约之后下一枚根本不叫 G-5,旧字面量会把真事故读成通过)。
  const foreign = doc
    .split('\n')
    .filter((l) => l.includes('幂等落地') && !l.includes(run1.id))
  assert.deepEqual(
    foreign,
    [],
    `第二次跑若真落地,产出的是"另一枚号 + 同一题"那一行 ⇒ 凡带"幂等落地"的行都必须恰是第一次那一枚号`,
  )
})

test('I7 端到端·落地成功而索引未对齐 ⇒ 退出码 0(不冒充失败)+ 点名 sha 与原因', (t) => {
  const { dir, inputs } = makeDocRepo(t, G321_BASE.join('\n'))
  writeFileSync(join(inputs, 'anchor.txt'), `${G321_ANCHOR}\n`)
  writeFileSync(join(inputs, 'block.txt'), '- 登记甲\n')
  plantStaleIndexLock(dir)
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  const r = g321Run(dir, inputs)
  const after = git(['rev-parse', 'HEAD'], { root: dir })
  assert.equal(r.status, 0, `内容已入库这一档不得报成失败:${r.stdout}|${r.stderr}`)
  assert.notEqual(after, before, 'CAS 必须真的成功(内容已落地)')
  assert.ok(r.stdout.includes(`内容已入库 ${after}`), `必须点名 sha:\n${r.stdout}`)
  assert.match(r.stdout, /仅共享主索引未对齐/)
  assert.match(r.stdout, /锁龄超上限/, '原因必须点名,不能只说"没对齐"')
  assert.match(r.stdout, /别用重跑修它|不要重跑/, '措辞必须挡住 G-321 那一步(重跑造双份)')
  assert.doesNotMatch(r.stdout, /主索引已对齐 1\/1/, '不得把未对齐写成对齐')
  assert.doesNotMatch(r.stderr, /❌/, 'stderr 里不该出现失败标记')
  assert.notEqual(
    indexBlobOf('DOC.md', { root: dir }),
    headBlobOf('HEAD', 'DOC.md', { root: dir }),
    '阳性对照:此刻索引确实停在父提交 blob(否则本条测的是另一件事)',
  )
  const r2 = g321Run(dir, inputs)
  assert.equal(r2.status, 0, `${r2.stdout}|${r2.stderr}`)
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), after, '重跑不得造出第二份(幂等判据接住)')
})

test('I8 反向·内容没落地时同一把 stale 锁不得把失败洗成 0(锚点未命中 ⇒ 仍 exit 1、HEAD 不动)', (t) => {
  const { dir, inputs } = makeDocRepo(t, G321_BASE.join('\n'))
  writeFileSync(join(inputs, 'anchor.txt'), '@@NOPE@@\n')
  writeFileSync(join(inputs, 'block.txt'), '- 登记甲\n')
  plantStaleIndexLock(dir)
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  const r = g321Run(dir, inputs)
  assert.equal(r.status, 1, '分档只作用于"已入库之后"那一步:没落地照旧是失败')
  assert.match(r.stderr, /找不到锚点/)
  assert.doesNotMatch(r.stdout, /内容已入库/, '不得替一次没发生的落地背书')
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), before)
})

test('I9 alignOutcome 纯函数三方向:未落地 ⇒ 1 / 已入库未对齐 ⇒ 0 且点名 / 已对齐 ⇒ 旧措辞逐字不变', () => {
  const fail = __test__.alignOutcome({ landedSha: '', doc: 'DOC.md', detail: '12 次均未抢到 CAS' })
  assert.equal(fail.code, 1, '没落地绝不能被 ② 那一档顺手洗绿')
  assert.ok(fail.lines[0].startsWith('❌') && fail.lines[0].includes('12 次均未抢到 CAS'), fail.lines[0])

  const sha = 'a'.repeat(40)
  const unaligned = __test__.alignOutcome({
    landedSha: sha,
    doc: 'DOC.md',
    align: { moved: 0, already: 0, skipped: [], undetermined: [], lockAbandoned: true, failed: false },
  })
  assert.equal(unaligned.code, 0)
  const txt = unaligned.lines.join('\n')
  assert.ok(txt.includes(`内容已入库 ${sha}`), txt)
  assert.ok(txt.includes('仅共享主索引未对齐') && txt.includes('锁龄超上限'), txt)
  assert.ok(!txt.includes('❌'), '这一档不是失败 ⇒ 不得出现失败记号')
  assert.ok(!txt.includes('主索引已对齐'), '不得把未对齐写成对齐')

  const rounds = __test__.alignOutcome({
    landedSha: sha,
    doc: 'D',
    align: {
      lockAbandoned: false,
      failed: true,
      error: '轮次耗尽',
      skipped: [{ path: 'D', reason: '别人已暂存' }],
      undetermined: [],
    },
  })
  assert.equal(rounds.code, 0)
  assert.ok(rounds.lines.join('\n').includes('轮次耗尽'), 'failed 那一支的原因也要点名')
  assert.ok(rounds.lines.some((l) => l.startsWith('⚠️ 未动(归属他人):D')), '归属他人的条目不得被静默吞掉')

  const ok = __test__.alignOutcome({
    landedSha: sha,
    doc: 'DOC.md',
    align: { moved: ['DOC.md'], already: [], skipped: [], undetermined: [], lockAbandoned: false, failed: false },
  })
  assert.equal(ok.code, 0)
  assert.equal(
    ok.lines[0],
    '✅ 主索引已对齐 1/1 路径(移动 1 / 已就位 0)',
    '既有 T4/T13 钉着这一行 ⇒ 措辞漂一个字就是放宽既有断言',
  )
})

test('I10 反向锁:幂等判据必须在 CAS 循环体内、且在拼块之前现读;循环内不得出现磁盘取材', () => {
  const loopStart = TOOL_SRC.indexOf('for (let attempt = 1')
  const loopEnd = TOOL_SRC.indexOf("if (landed === '')")
  assert.ok(loopStart > 0 && loopEnd > loopStart, '找不到 CAS 循环(结构漂了,本锁失去意义)')
  const body = TOOL_SRC.slice(loopStart, loopEnd)
  // 刻意不用 `assert.match(\n …)` 的换行形态:那样第一条行恰好是 `  assert.match(`,而它在
  // 祖先 5f58242ab 里存在过 ⇒ 陈旧落地守卫会把它读成"把基线已删的行搬回来"而拒落(本仓第二次
  // 撞到同一形状,上一轮也是改写成不产生碎片的形态才落地的)。语义不变,只换写法。
  assert.ok(/blockInPlaceCheck\(\s*\{/.test(body), '幂等判据没接进 CAS 循环 = 一次也不会跑(守门 64/70/76/81/115 同型:函数在、判据对、无人调度)')
  assert.ok(/compileBlockMatchers\(block,\s*baseContent\)/.test(body), '匹配式必须由**本轮底稿**编译:烘到循环外就在别人推进 HEAD 的瞬间产出自洽却错位的尺子')
  const at = body.indexOf('blockInPlaceCheck(')
  const asm = body.indexOf('assemble(baseLines, effBlock, anchorLines)')
  assert.ok(at > 0 && asm > at, '票面 ① 要求"拼块之前"判;放到 assemble 之后就已经晚了')
  assert.doesNotMatch(
    body,
    /readFileSync\(/,
    '判据只看被审面;循环里出现 readFileSync 就是把它换成了磁盘面(共享工作树常年滞后 HEAD)',
  )
})

test('I11 畸形登记号必须被拒,且必须发生在写 blob 之前(2026-09-28 立)', () => {
  const { newMalformed, MALFORMED_ID_RE } = __test__
  assert.ok(typeof newMalformed === 'function' && MALFORMED_ID_RE, '判据未导出 = 镜像测不到它,等同于没有')
  // 真事故形态:令牌展开值已含族名,正文又手写了一个 D ⇒ DD128
  const bad = '- [ ] **DD128 AI 对话链路四竞品对标 V4 收口线 —— 唯一入口 x.md'
  assert.ok(MALFORMED_ID_RE.test(bad), '本仓真实产出过的形态判不出 ⇒ 尺子对自家形态失明')
  const g = '- [ ] **G-G-334 取号令牌被写成"字面 G- + 令牌"的畸形产物'
  assert.ok(MALFORMED_ID_RE.test(g), '另一族同型形态必须同视(判据不认具体族名,否则新增族自动漏网)')
  const ok1 = '- [ ] **D128 正常登记行'
  assert.ok(!MALFORMED_ID_RE.test(ok1), '正当形态被误判 ⇒ 每台必红,唯一结局是逼人绕开本器')
  // 装饰档(2026-09-29 补):翻勾与认领产出的就是带 ✅(日期) / （进行中@…） 的行,判据必须跟着走。
  // 这四条里前两条是"应当红",后两条是"应当绿"—— 只留前者就等于允许把正当翻勾判成畸形。
  const decBad = '- [x] ✅(2026-09-29) GG-600 带完成标记的畸形行'
  const claimBad = '- [ ]（进行中@2026-09-29/甲）DD128 带租约的畸形行'
  const decOk = '- [x] ✅(2026-09-29) G-600 带完成标记的正当行'
  const claimOk = '- [ ]（进行中@2026-09-29/甲）G-600 带租约的正当行'
  const hit = (s) => newMalformed('', s).added.length
  assert.equal(hit(decBad), 1, '带 ✅(日期) 的畸形行不得隐身(本器自己就产这一档)')
  assert.equal(hit(claimBad), 1, '带租约标记的畸形行同样不得隐身')
  assert.equal(hit(decOk), 0, '带装饰的正当行必须放过,否则翻勾一次就被自己的判据拦住')
  assert.equal(hit(claimOk), 0, '带租约的正当行必须放过')
  const BR = __test__.MALFORMED_BODY_RE
  assert.ok(BR instanceof RegExp, '装饰档判据必须导出(否则镜像只能重抄一份判据,§22c 的复读机那一型)')
  assert.ok(BR.test('GG-600 剥完装饰的正文'), '判据本体必须判得动剥装饰后的正文')
  assert.ok(!BR.test('G-600 剥完装饰的正文'), '正当号形不得被本体误判')
  const r = newMalformed('', bad + '\n' + ok1)
  assert.equal(r.added.length, 1, '应只拦新引入的那一行')
  assert.equal(r.preexisting.length, 0)
})

test('I12 存量畸形号只报数不拦:锚点必须取父提交(否则把他人的债钉成每次必红)', () => {
  const { newMalformed } = __test__
  const legacy = '- [ ] **DD100 别人历史留下的行'
  const mine = '- [ ] **D900 我这次正当新增的行'
  const r = newMalformed(legacy + '\n' + mine, legacy + '\n' + mine + '\n')
  assert.equal(r.added.length, 0, '父提交里已在的畸形行不得算成本次新增 —— 那是 §12e 恒红门的成因')
  assert.equal(r.preexisting.length, 1, '但必须报出来:存量与我刚造的不能在账面上长得一样')
})

test('I13 结构锁:判据必须在 CAS 循环内、writeBlob 之前(落地后再 exit 1 就是把已入库谎报成没落地)', () => {
  const loopStart = TOOL_SRC.indexOf('for (let attempt = 1')
  const loopEnd = TOOL_SRC.indexOf("if (landed === '')")
  const body = TOOL_SRC.slice(loopStart, loopEnd)
  assert.ok(/newMalformed\(\s*baseContent\s*,/.test(body), '未接入 CAS 循环 = 一次也不会跑(守门 64/70/76/81/115 同型)')
  const at = body.indexOf('newMalformed(')
  const wb = body.indexOf('writeBlob(')
  assert.ok(at > 0 && wb > at, '必须在写 blob 之前判:内容入库后再 exit 1 会诱导重跑,而重跑正是 G-321 要消灭的那一步')
  assert.match(body, /process\.exit\(1\)/, '拦下来必须是拒绝落地,不能只打印')
})

test('I14 取号前的远端对齐闸门:两种降级分档,只有"能补救的那一档"才拦(2026-09-29 立)', () => {
  const { idBasisGate } = __test__
  assert.equal(typeof idBasisGate, 'function', '判据未导出 ⇒ 镜像只能重抄一份,抄的那份会跟着漂绿(§22c)')
  // 一手事故:本器发出 G-592/G-593 时,远端 09-28 已占下这两个号(其一已勾)。当时那版只打一行
  // "未与远端对齐"就照落,并集收敛后当场撞出 2 组 F9,须再让一次号 —— 本条就是把那次代价钉住。
  const ahead = { remoteAheadUnfetched: true, tipSha: 'd7a9376aa9c11222de66c9a43565cd7f09257c17' }
  const g = idBasisGate({ families: ['G'], remote: ahead })
  assert.equal(g.block, true, 'tip 已问到而对象不在本地 ⇒ 必须拒(补救是一条本地 fetch,不是猜)')
  assert.match(g.reason, /对象不在本地/, '拒绝理由必须点名是哪一档,不得写成泛泛的"远端未对齐"')
  // 反向护栏三条,缺一条就等于把闸门做成"只要降级就拒"⇒ 断网机器不能登记任何新票(§12e 同型)
  assert.equal(
    idBasisGate({ families: ['G'], remote: ahead, allowUnaligned: true }).block,
    false,
    '应急档必须真能放行,否则各会话会绕过本器改用 pathspec 硬交',
  )
  assert.match(idBasisGate({ families: ['G'], remote: ahead, allowUnaligned: true }).note, /未与远端对齐/, '放行也不得静默:报告里必须仍写着没对齐')
  assert.equal(
    idBasisGate({ families: [], remote: ahead }).block,
    false,
    '本次不取号 ⇒ 纯改写落地绝不能被这条拦住',
  )
  assert.equal(
    idBasisGate({ families: ['G'], remote: { remoteAheadUnfetched: false, tipSha: 'a'.repeat(40) } }).block,
    false,
    '远端已参与(对象在本地)⇒ 与改动前逐字同形,不得新增拦阻',
  )
  assert.equal(
    idBasisGate({ families: ['G'], remote: { remoteAheadUnfetched: false, notes: ['远端不可问'] } }).block,
    false,
    '真离线(ls-remote 问不到)那一档保持放行:这里没有便宜的补救动作',
  )
  assert.equal(idBasisGate({ families: ['G'], remote: null }).block, false, '没传远端读数时不得凭空拦')
})

test('I15 装车锁:I14 那条判据必须接在 CAS 循环内、writeBlob 之前(判据在而无人调 = 提交链上一路绿灯)', () => {
  const loopStart = TOOL_SRC.indexOf('for (let attempt = 1')
  const loopEnd = TOOL_SRC.indexOf("if (landed === '')")
  assert.ok(loopStart > 0 && loopEnd > loopStart, '找不到 CAS 循环边界 ⇒ 本锁对着空气判绿')
  const body = TOOL_SRC.slice(loopStart, loopEnd)
  assert.ok(/idBasisGate\(\s*\{/.test(body), '闸门未接进 CAS 循环 ⇒ 一次也不会跑(守门 64/70/76/81/115 同型)')
  const at = body.indexOf('idBasisGate(')
  const wb = body.indexOf('writeBlob(')
  assert.ok(at > 0 && wb > at, '必须在写 blob 之前判:落地后再 exit 1 会诱导重跑,而重跑会再发一次号')
  assert.match(body.slice(at, at + 1400), /process\.exit\(1\)/, '拦下来必须是拒绝落地,不能只打印')
  assert.ok(
    body.indexOf('idBasisGate(') > body.indexOf('readRemoteIdBasis('),
    '必须先取到远端读数再判闸门,反过来判的是上一轮的读数',
  )
})

test('T14b 装饰括注行必须顶起号段基准(本票病根);行文引用不得顶起(2026-09-29 立)', () => {
  // 正向:2026-09-29 当天两次当场自伤的形态 —— 上一批由本器落地的登记行长这样:
  // `- [ ]（待派/QODER-O81）G-627 **…`。旧解析不认这个行首括注:keyOfRow 取到括注里的 O81,
  // G-627 整行不进号段 ⇒ 下一次调用打印 `号段基准:G=626` 并**重发 627**。
  const maskedBase = [
    '- [ ] **G-700 基准行**:先给该族一个已用号。',
    '- [ ]（待派/QODER-O81）G-777 **守门 149:包入口 barrel 漏 re-export 对端内 barrel 整片失明** —— 上一批由本器发出。',
  ].join('\n')
  const r = __test__.resolveIdTokens(['- [ ] {{NEXT_ID:G}} **新事** —— 题面。'], maskedBase)
  assert.equal(r.ok, true, `取号必须成功,实测 ${JSON.stringify(r)}`)
  assert.equal(r.basis[0].localMax, 777, `号段基准必须把装饰行顶进来(旧尺子只给 700 ⇒ 重发 777),实测 ${r.basis[0].localMax}`)
  assert.equal(r.assigned, 'G-778', `不得重发 777,实测 ${r.assigned}`)
  // 反向:纯行文引用(落在 48 字窗口之外)不得顶高基准 —— 否则"漏算"被掩盖成"虚涨跳号",
  // 两个方向的错在账面上都是"号变大了",只有这一对照能把它们分开。
  const proseBase = [
    '- [ ] **G-700 基准行**:唯一的已用号。',
    '- [ ] ' + '无编号题面的中文垫子'.repeat(8) + ',后文才提到 G-900 —— 只是行文引用,不得顶高开号(垫子保证引用起点 >48 字)',
  ].join('\n')
  const p = __test__.resolveIdTokens(['- [ ] {{NEXT_ID:G}} **新事** —— 题面。'], proseBase)
  assert.equal(p.ok, true)
  assert.equal(p.basis[0].localMax, 700, `散文引用不得进号段基准,实测 ${p.basis[0].localMax}`)
  assert.equal(p.assigned, 'G-701', `应紧接基准发号,实测 ${p.assigned}`)
})


// ─────────────────────────────────────────────────────────────────────────────
// G-816708(2026-10-05):旁路落地台账的那一刻,守门 71 的自愈必须真的被跑到。
// 本器每一枚提交都走 commit-tree + CAS ⇒ 钩子结构性不跑 ⇒ 挂在 .husky/post-commit 第 6 节
// 那层自愈对本器从来不会触发;而本器改的正是登记行。三条用例与 object-space-land 同构:
//  H1 正向(真门,不是桩):整行改写把编号从行上摘掉 ⇒ 同一轮里点名 + 前向恢复提交;
//  H2 反向对照:同样的调用形态但 LIVE_DOC 不是台账 ⇒ 不得多派生那一个进程(哨兵可证);
//  H3 方向锁 + 失败臂:补跑没跑成 ⇒ 落地照旧 0,但必须喊出来。
// 夹具一律 `git init -b main`:门 71 的恢复提交写 refs/heads/main(既有实现),分支名不对就只剩
// "跑而未成"那一档可测;桩只仿"有没有被派生 / 退出码 / stderr"三格传输,不仿判据(与门体桩同规)。
// ─────────────────────────────────────────────────────────────────────────────
const LDFILL = [1, 2, 3, 4].map(
  (i) => `  - **G-9001${i}0 填充行(夹具)**:与本轮判定无关、三面都在的登记行,只为把基线垫过规模闸。`,
)
const LD_A = '  - **G-900001 甲行(夹具)**:三面都在的无关登记行,用来确认现场里只有乙行被动过。'
const LD_B = '  - **G-900002 乙行(夹具)**:这一行本来在 HEAD 里,本轮整行改写把编号从行上摘掉了 ⇒ 必须被点名。'
// 改写后的形态:复选框 + 日期都在,但**行上不再有编号** —— 台账结清时最容易顺手做出的那一型丢失
const LD_B_DONE =
  '  - [x] ✅(2026-10-05) 乙行收尾:编号在这次改写里被摘掉了(这正是本器会造成的那一型丢失),正文足够长以入选登记行基线。'
const LD_PLAN = ['# 计划', '', LD_A, ...LDFILL, '', LD_B, ''].join('\n')

function makeLedgerDocRepo(t) {
  const dir = mkScratch('lde-ledger-')
  const inputs = mkScratch('lde-ledger-in-')
  t.after(() => rmScratch(dir))
  t.after(() => rmScratch(inputs))
  runGit(dir, ['init', '-q', '-b', 'main'])
  // 提交身份写进**夹具的 git config**:自愈那个子进程用裸 git 派生,不靠调用方传 -c
  runGit(dir, ['config', 'user.email', 'heal@e2e.local'])
  runGit(dir, ['config', 'user.name', 'heal-e2e'])
  runGit(dir, ['config', 'commit.gpgsign', 'false'])
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), LD_PLAN)
  runGit(dir, ['add', '--', 'PROJECT_PLAN.md'])
  runGit(dir, ['commit', '-q', '-m', 'plan: 甲乙入库'])
  return { dir, inputs }
}

function installRealGate(dir) {
  return copyScriptWithClosure(join(HERE, '..'), 'check-plan-line-loss.mjs', join(dir, 'scripts'), [
    'lib/face-reader.mjs',
  ])
}

function installHealStub(dir, { rc = 0, stderr = '' } = {}) {
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  writeFileSync(
    join(dir, 'scripts', 'check-plan-line-loss.mjs'),
    "import { writeFileSync } from 'node:fs'\n" +
      "writeFileSync(new URL('../.heal-ran', import.meta.url), JSON.stringify(process.argv.slice(2)))\n" +
      `process.stderr.write(${JSON.stringify(stderr)})\n` +
      `process.exit(${rc})\n`,
  )
  writeFileSync(join(dir, 'scripts', 'git-push-guard.mjs'), 'process.exit(0)\n')
}
const healSentinel = (dir) => join(dir, '.heal-ran')

test('H1 G-816708 正向(行为断言):落地台账的同一轮里补跑真门,点名被摘掉的登记行并建恢复提交', (t) => {
  const { dir, inputs } = makeLedgerDocRepo(t)
  installRealGate(dir)
  const rep = join(inputs, 'replace.json')
  writeFileSync(rep, JSON.stringify([{ before: LD_B, after: LD_B_DONE }]), 'utf8')
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  const r = runLive(dir, { doc: 'PROJECT_PLAN.md', replaceFile: rep })
  const out = `${r.stdout}\n${r.stderr}`
  assert.equal(r.status, 0, `改写应成功落地,实得 ${r.status}:\n${out}`)
  assert.match(out, /\[G-816708\][\s\S]{0,120}就地补跑守门 71/, '本器必须报名"这一跑是 post-commit 的替身"')
  assert.match(out, /\[分档\] 历史登记行 \d+ 条/, '补跑要的是真门,不是桩:它的读数必须可见')
  assert.match(out, /\[点名\/HEAD\][^\n]*G-900002 乙行/, '被摘掉编号的那一行必须**点名**到行,不得只报数')
  // 仓库状态是**最硬的回读**:本器一枚 + 就地恢复一枚,恰好两枚,后者父是前者
  assert.equal(
    Number(git(['rev-list', '--count', `${before}..HEAD`], { root: dir })),
    2,
    `应为"改写落地一枚 + 补跑恢复一枚",实得:\n${out}`,
  )
  const landedText = git(['show', "HEAD^:PROJECT_PLAN.md"], { root: dir, raw: true })
  assert.match(landedText, /乙行收尾/, '本次改写确实落进了 HEAD(现场成立)')
  assert.doesNotMatch(landedText, /G-900002 乙行/, '本次改写确实把那一条登记行摘没了(现场成立)')
  assert.match(
    git(['show', 'HEAD:PROJECT_PLAN.md'], { root: dir, raw: true }),
    /G-900002 乙行/,
    '恢复后的 HEAD 必须重新含那一行 —— "当场收口"而不是"报给下一个人"',
  )
  assert.equal(
    indexBlobOf('PROJECT_PLAN.md', { root: dir }),
    headBlobOf('HEAD', 'PROJECT_PLAN.md', { root: dir }),
    '主索引必须对齐到恢复后的 HEAD blob(补跑排在索引对齐之前正是为了这一格)',
  )
})

test('H2 G-816708 反向对照:同样的落地形态但 LIVE_DOC 不是台账 ⇒ 不得多派生那一个进程', (t) => {
  const { dir, inputs } = makeLedgerDocRepo(t)
  installHealStub(dir)
  runGit(dir, ['mv', '-f', 'PROJECT_PLAN.md', 'DOC.md'])
  runGit(dir, ['commit', '-q', '-m', '把同一份内容改名成非台账文档'])
  const rep = join(inputs, 'replace.json')
  writeFileSync(rep, JSON.stringify([{ before: LD_B, after: LD_B_DONE }]), 'utf8')
  const r = runLive(dir, { doc: 'DOC.md', replaceFile: rep })
  const out = `${r.stdout}\n${r.stderr}`
  assert.equal(r.status, 0, `改 DOC.md 应成功:\n${out}`)
  assert.equal(existsSync(healSentinel(dir)), false, '不含台账的落地不得派生那一个进程(哨兵被写了)')
  assert.doesNotMatch(out, /\[G-816708\]/, '没跑就不许喊"补跑过"(凭空声称一个没发生的动作)')
})

test('H3 G-816708 方向锁 + 失败臂:补跑没跑成 ⇒ 落地照旧 0,但必须喊出来', (t) => {
  const { dir, inputs } = makeLedgerDocRepo(t)
  installHealStub(dir, { rc: 1, stderr: 'boom: 门体未能判定\n' })
  const rep = join(inputs, 'replace.json')
  writeFileSync(rep, JSON.stringify([{ before: LD_B, after: LD_B_DONE }]), 'utf8')
  const r = runLive(dir, { doc: 'PROJECT_PLAN.md', replaceFile: rep })
  const out = `${r.stdout}\n${r.stderr}`
  assert.ok(existsSync(healSentinel(dir)), '摘掉补跑调用 ⇒ 这一条先红(没人写哨兵)')
  assert.equal(JSON.parse(readFileSync(healSentinel(dir), 'utf8')).join(' '), '--heal --commit', '补跑必须是提交档(与 post-commit 第 6 节同形)')
  assert.equal(r.status, 0, `替身没跑成不该把已入库的落地判红,实得 ${r.status}:\n${out}`)
  assert.match(out, /跑而未成|未派生成功/, '失败必须点名是哪一档(跑而未成 / 根本没派生)')
  assert.doesNotMatch(out, /无缺失,无需回捞/, '补跑没跑成时,"无缺失"这句话不得由任何人替它说')
})

test('H4 G-816708 触发条件单位锁:LIVE_DOC 只有逐字等于台账才成立(AGENTS/README 不触发)', () => {
  assert.equal(landsLedger(['PROJECT_PLAN.md']), true)
  assert.equal(landsLedger(['AGENTS.md']), false, 'AGENTS 也是活文档,但不是那本台账')
  assert.equal(landsLedger(['README.md']), false)
  assert.equal(landsLedger(['docs/PROJECT_PLAN.md']), false, '子目录里那份不是台账')
})

// ---------------------------------------------------------------------------
// G-1079146 登记入口取值(2026-10-08):新行里的 sha 形态指针落库前当场问一次。
// 判据一律从 `__test__` import(§22c —— 禁止在测试里抄第二份抽取/形状/放过规则);
// 端到端四臂只打在 mkScratch 临时仓上,绝不碰真仓台账。
// ---------------------------------------------------------------------------

const SHA_BAD = 'deadcafe12' // 10 位、含字母(全数字会被权威门判 ambiguous,那不是本型的样本)

/** 往临时仓落一行(锚点插入档),返回 spawnSync 结果。 */
function landLine(t, line, extraEnv = {}, anchorText = `${G321_ANCHOR}\n`) {
  const { dir, inputs } = makeDocRepo(t, G321_BASE.join('\n'))
  writeFileSync(join(inputs, 'anchor.txt'), anchorText)
  writeFileSync(join(inputs, 'block.txt'), `${line}\n`)
  return { dir, r: runLive(dir, { anchorFile: join(inputs, 'anchor.txt'), blockFile: join(inputs, 'block.txt'), extraEnv }) }
}

test('SH1 §22c 导出面:取值判据必须从 __test__ 出去(测试不得抄第二份判据)', () => {
  for (const k of [
    'judgeNewLineShas',
    'shaPassReason',
    'rewriteEntryOf',
    'parseShaAllow',
    'makeShaProber',
    'shaGateReport',
    'shaProbeCommand',
  ])
    assert.equal(typeof __test__[k], 'function', `__test__.${k} 缺失 ⇒ 判据只能被抄进测试`)
})

test('SH2 端到端臂①:新行含**可解析**短 sha ⇒ 照旧落地(exit 0)并报名取值通过', (t) => {
  const { dir, inputs } = makeDocRepo(t, G321_BASE.join('\n'))
  const sha = git(['rev-parse', '--short', 'HEAD'], { root: dir })
  writeFileSync(join(inputs, 'anchor.txt'), `${G321_ANCHOR}\n`)
  writeFileSync(join(inputs, 'block.txt'), `- 登记甲:落地 ${sha} 那枚\n`)
  // 刻意写成多行对象形态(与本文件其余 5 处 runLive 同形):单行形态与该文件某个祖先
  // (5f58242ab)里的行逐字相同,会被旁路落地器的"行级复活"判据读成"把已被删的行搬回来"而拒落。
  const r = runLive(dir, {
    anchorFile: join(inputs, 'anchor.txt'),
    blockFile: join(inputs, 'block.txt'),
  })
  assert.equal(r.status, 0, `可解析就该落:${r.stdout}|${r.stderr}`)
  assert.match(r.stdout, /✅ 取值/)
  const doc = norm(git(['show', 'HEAD:DOC.md'], { root: dir, raw: true }))
  assert.ok(doc.includes(`落地 ${sha}`), '行必须真进了 HEAD')
})

test('SH3 端到端臂②:新行含问不到的 sha 形态 token ⇒ exit 1 并打印 token/形状/判据命令/建议', (t) => {
  const { dir, r } = landLine(t, `- 登记乙:提交 \`${SHA_BAD}\` 那枚`)
  assert.equal(r.status, 1, `不解析必须拒落,实得 ${r.status}:\n${r.stdout}|${r.stderr}`)
  const out = `${r.stdout}\n${r.stderr}`
  assert.match(out, /拒绝落该行/)
  assert.match(out, new RegExp(SHA_BAD))
  assert.match(out, /git rev-parse --verify \S+\^\{commit\}/, '必须给出真跑的那条判据命令')
  assert.match(out, /建议/)
  assert.match(out, /禁止.*挑一枚|那是编造/, '不得留下"从同段挑一枚看起来对的"这条路')
  const doc = norm(git(['show', 'HEAD:DOC.md'], { root: dir, raw: true }))
  assert.ok(!doc.includes(SHA_BAD), '拒绝 ⇒ HEAD 不得被写过(不是"落了再说")')
})

test('SH4 端到端臂③:文件名 / 设备号 / 分支连字符三型 ⇒ 一律不误伤(exit 0,零探测)', (t) => {
  for (const line of [
    '- 丙:产物 apps/web/dist/6f7a8b9c.chunk.mjs 已重建,另有 dist/273.x.mjs',
    '- 丁:adb 设备 serial=d1f8e3a7b9 的读数',
    '- 戊:分支 workbuddy/main-6f7a8b9c 已并,workbuddy/main-x 是旧名',
    '- 已:远端 refs/heads/6f7a8b9c01 那条镜像',
  ]) {
    const { r } = landLine(t, line)
    assert.equal(r.status, 0, `放过形态不得拦(${line}):\n${r.stdout}|${r.stderr}`)
    assert.doesNotMatch(r.stdout, /✅ 取值/, '一条都没判时不得打印"全部可解析"(把没判写成判过了)')
  }
})

test('SH5 端到端臂④:同一行 + 带原因的 LIVE_SHA_ALLOW ⇒ 放行且打印留痕', (t) => {
  const { r } = landLine(t, `- 登记乙:提交 \`${SHA_BAD}\` 那枚`, {
    LIVE_SHA_ALLOW: `${SHA_BAD}=外部仓 revision,不在本机对象库`,
  })
  assert.equal(r.status, 0, `带原因的应急出口必须真放行:\n${r.stdout}|${r.stderr}`)
  assert.match(r.stdout, /取值放行留痕/)
  assert.match(r.stdout, /外部仓 revision/, '原因不得被吞掉(放行要可追责)')
})

test('SH6 应急出口的形状:无原因 ⇒ 不放行(照旧拦);放行只对逐字等值的那枚 token 生效', (t) => {
  const a = landLine(t, `- 登记乙:提交 \`${SHA_BAD}\` 那枚`, { LIVE_SHA_ALLOW: SHA_BAD })
  assert.equal(a.r.status, 1, `只有 token 没有原因 ⇒ 不收录,实得 ${a.r.status}`)
  const b = landLine(t, `- 登记乙:提交 \`${SHA_BAD}\` 那枚`, {
    LIVE_SHA_ALLOW: `othertoken=别的 token 的原因不该救这一枚`,
  })
  assert.equal(b.r.status, 1, `放行范围不得扩散到整档`)
})

test('SH7 只吃新行:整行改写携带的存量 sha 不重判(否则三周前的指针钉红今天的结清动作)', (t) => {
  const base = `- [ ] G-90 落地 ${SHA_BAD} 待办`
  const { dir, inputs } = makeDocRepo(t, `${base}\n`)
  const rep = join(inputs, 'replace.json')
  writeFileSync(
    rep,
    JSON.stringify([{ before: base, after: `- [x] ✅(2026-10-08) G-90 落地 ${SHA_BAD} 已完成(补 deadbeef99)` }]),
    'utf8',
  )
  const r = runLive(dir, { doc: 'DOC.md', replaceFile: rep })
  const out = `${r.stdout}\n${r.stderr}`
  assert.equal(r.status, 1, `新写进去的那枚问不到 ⇒ 仍须拦:\n${out}`)
  assert.match(out, /deadbeef99/, '拦的是新增那枚')
  assert.ok(
    !out.includes(`· token=${SHA_BAD}(形状`),
    '携带的存量那枚不得被算成本次的红(逐字等值判,不拿正则撞括号)',
  )
  assert.match(out, /携带存量 sha 1 枚/, '携带必须点名报出来,不能静默放过')
})

test('SH8 不回扫全文:文档里**别人已入库**的坏 sha 不得让本次落地失败', (t) => {
  const { dir, inputs } = makeDocRepo(t, `- 别人三周前落的:提交 \`${SHA_BAD}\`\n${G321_ANCHOR}\n`)
  writeFileSync(join(inputs, 'anchor.txt'), `${G321_ANCHOR}\n`)
  writeFileSync(join(inputs, 'block.txt'), '- 本次新增:一条不含指针的登记\n')
  // 刻意写成多行对象形态(与本文件其余 5 处 runLive 同形):单行形态与该文件某个祖先
  // (5f58242ab)里的行逐字相同,会被旁路落地器的"行级复活"判据读成"把已被删的行搬回来"而拒落。
  const r = runLive(dir, {
    anchorFile: join(inputs, 'anchor.txt'),
    blockFile: join(inputs, 'block.txt'),
  })
  assert.equal(r.status, 0, `存量不在射程:\n${r.stdout}|${r.stderr}`)
})

test('SH9 保命分支:未判定 ⇒ 放行(这一条是"恒挡台账"的最后一道,变异必读红)', () => {
  const probe = () => ({ state: 'undetermined', why: 'git 派生未拿到结论' })
  const v = __test__.judgeNewLineShas([{ text: `- 落地 ${SHA_BAD}` }], { probe })
  assert.equal(v.blocked.length, 0, '把"没判"折成"坏" = 挡死全队台账写入')
  assert.equal(v.undetermined.length, 1, '未判定必须逐条点名')
  assert.match(__test__.shaGateReport(v).map((l) => l.text).join('\n'), /未判定.*放行/s)
})

test('SH10 真 git 档的未判定:root 不是仓库 ⇒ pre-flight 不过,整档放行而非全判坏', () => {
  const notRepo = mkScratch('lde-norepo-')
  try {
    const probe = __test__.makeShaProber({ root: notRepo })
    const v = __test__.judgeNewLineShas([{ text: `- 落地 ${SHA_BAD}` }], { probe })
    assert.equal(v.blocked.length, 0, `仓库问不到时不得判红,实得 ${JSON.stringify(v.blocked)}`)
    assert.equal(v.undetermined.length, 1)
    assert.equal(probe(SHA_BAD).state, 'undetermined')
  } finally {
    rmScratch(notRepo)
  }
})

test('SH11 形状判据只有一份:门那一份判 ambiguous 的,本器不得自己判成候选', () => {
  for (const tok of ['20260926', '97fef424f841ab997b161bc4ead93cbe', '12345']) {
    const v = __test__.judgeNewLineShas([{ text: `窗口 ${tok} 的读数` }], {
      probe: () => ({ state: 'bad', status: 128 }),
    })
    assert.equal(v.probed, 0, `${tok} 应由权威门的形状档摘掉,不该派生 git`)
  }
})

test('SH12 落地文案里给出的命令 = 真跑的 args(出路不得跑不通)', () => {
  assert.equal(__test__.shaProbeCommand(SHA_BAD), `git rev-parse --verify ${SHA_BAD}^{commit}`)
})

test('SH13 形状判据只有一份(源码锁):抽取/形状必须 import 权威门,不得在工具里再抄一条 hex 正则', () => {
  const src = readFileSync(join(HERE, '..', 'live-doc-edit.mjs'), 'utf8')
  assert.match(
    src,
    /from '\.\/check-plan-sha-resolvable\.mjs'/,
    '没有从权威门 import ⇒ 两份形状判据必然漂开(§22c)',
  )
  assert.match(src, /import\s*\{[^}]*classifyShape[^}]*\extractFromLine[^}]*\}\s*from/)
  // 反向锁:工具内不得出现"自己数 hex 位"的抽取式(那正是第二份真相的形状)
  assert.doesNotMatch(
    src,
    /\/\^?\[0-9a-f\]\{7,/,
    '本器内出现 [0-9a-f]{7,…} 的自建抽取式 ⇒ 与权威门各写一遍,必然漂开',
  )
})

test('SH14 派生 git 走层(源码锁):取值那一步不得自拼 execFileSyncstdio', () => {
  const src = readFileSync(join(HERE, '..', 'live-doc-edit.mjs'), 'utf8')
  assert.match(src, /import\s*\{\s*gitRaw\s*\}\s*from '\.\/lib\/face-reader\.mjs'/)
  assert.doesNotMatch(
    src,
    /execFileSync\([\s\S]{0,40}rev-parse/,
    '自拼派生 ⇒ 丢掉层的 stdio/timeout/maxBuffer 纪律(本机不写 stdio 是稳定 EBUSY)',
  )
})

// ── DU 族:登记入口的复合主键唯一性闸 ──────────────────────────────────────
// 立因是实测(不是推测):14 天内未勾 165 → 1241 行,其中 785 行是「重复登记副本」指针行(209 族、
// 每族 4 份);而"完成的被写回未勾"这一反向假设已被否证(三张历史快照 1582/1031/1278 行 `- [x]`,
// 今日仍是未勾的 0 行)。所以膨胀的成因是**并发各抄一份**,事后判据只能标注不能删除 ⇒ 只能掐在写入时。
// 判据一律走生产出口(§22c:本文件不得再抄一份主键实现);主键取自 `lib/plan-task-index.mjs` 那一份。
import { compositeKeyOf } from '../lib/plan-task-index.mjs'

const LED = __test__
const KEY = (line) => compositeKeyOf(line)
// 题面在第一个 `.` 处截断(实测,不是设想):所以"同一件事的两份副本"必须共享 `.` 之前的题面,
// 而"两件不同的事"必须让 `.` 之前也不同 —— 造夹具时用这条,别按肉眼判断同不同题。
const ROW_700 = '- [ ] G-900700 端到端题面. 同一件事只该有一行当前状态'
const ROW_700_DUP = '- [ ] G-900700 端到端题面. 被第二席又抄了一份'
const ROW_701 = '- [ ] G-900701 另一件不相干的事. 说明'
const ROW_701_ANNOT = ROW_701 + ' 〔复测 2026-10-09:注记仍落在同一行〕'
const ROW_701_DUP = '- [ ] G-900701 另一件不相干的事. 第二席又抄了一份'
const ROW_702 = '- [ ] G-900702 第三件事. 全新登记'
const ROW_702_DUP = '- [ ] G-900702 第三件事. 换了一种措辞的第二份'
const ROW_NOCODE = '- [ ] 没有编号也没有可取题面的一件事'

test('DU-0 夹具自证:同题/异题/无编号三种形态的主键确实如断言所用', () => {
  assert.equal(KEY(ROW_700), KEY(ROW_700_DUP), '夹具没造出"同一件事的两份"')
  assert.notEqual(KEY(ROW_700), KEY(ROW_701), '夹具把两件不同的事并成了一件事')
  assert.equal(KEY(ROW_NOCODE), null)
})

test('DU-1 同主键第二次登记必判 blocked(单元)', () => {
  const v = LED.judgeNewLineDupes({ baseLines: [ROW_700], newLines: [ROW_700_DUP] })
  assert.equal(v.blocked.length, 1, `同题第二次登记必须拦住,实得 ${v.blocked.length}`)
  assert.match(v.blocked[0].existingText, /G-900700/, '必须点名已有那一行(内容锚点,不是行号)')
  assert.ok(LED.dupGateReport(v).some((l) => l.kind === 'error' && /第二次登记/.test(l.text)))
})

test('DU-2 题面不同 ⇒ 放过(不许拿"编号相邻"当同一件事)', () => {
  const v = LED.judgeNewLineDupes({ baseLines: [ROW_700], newLines: [ROW_701] })
  assert.equal(v.blocked.length, 0, '不同题面不得判重复')
  assert.equal(v.passed, 1)
})

test('DU-3 作者自认副本(带归并指针)⇒ 放过并计数', () => {
  const v = LED.judgeNewLineDupes({
    baseLines: [ROW_700],
    newLines: [ROW_700_DUP + ' 〔【归并】重复登记副本:本行与同标题登记并存〕'],
  })
  assert.equal(v.blocked.length, 0, 'F4 的产物形态不得被本闸禁掉')
  assert.equal(v.acknowledged.length, 1)
})

test('DU-4 应急出口必须逐键带原因;无原因不算', () => {
  const key = KEY(ROW_700)
  assert.equal(LED.parseDupAllow(`${key}`).size, 0, '无原因的声明不放行')
  assert.equal(LED.parseDupAllow(`${key}=确实是另一轮取证留下的第二议题`).get(key), '确实是另一轮取证留下的第二议题')
  const v = LED.judgeNewLineDupes({
    baseLines: [ROW_700],
    newLines: [ROW_700_DUP],
    allow: LED.parseDupAllow(`${key}=逐键理由`),
  })
  assert.equal(v.blocked.length, 0)
  assert.equal(v.allowed.length, 1)
  assert.ok(LED.dupGateReport(v).some((l) => /放行/.test(l.text) && /逐键理由/.test(l.text)), '放行必须打印留痕,不得静默')
})

test('DU-5 取不出主键 ⇒ 未判定并放行(把看不清判成重复会钉红正当新登记)', () => {
  const v = LED.judgeNewLineDupes({ baseLines: [ROW_700], newLines: [ROW_NOCODE, ROW_701] })
  assert.equal(v.undetermined.length, 1)
  assert.equal(v.blocked.length, 0)
  assert.ok(LED.dupGateReport(v).some((l) => l.kind === 'warn' && /未判定/.test(l.text)))
})

test('DU-6 只判多重集差:存量副本不替本次担账', () => {
  const base = [ROW_700, ROW_700, ROW_701]
  const next = [ROW_700, ROW_700, ROW_701, ROW_700]
  assert.deepEqual(LED.linesIntroducedBy(base, next), [ROW_700], '三条同文本 ⇒ 只有多出来的那一条算新增')
  const v = LED.judgeNewLineDupes({ baseLines: base, newLines: [ROW_700_DUP] })
  assert.equal(v.blocked.length, 1, '新增这一条确实撞已有待办 ⇒ 拦(存量那两条另计人工)')
  assert.equal(v.openBase, 3)
})

test('DU-7 端到端四臂(装车证明):同题插入必 rc=1 / 新题必 rc=0 / 无旗必 rc=1 / 带原因放行 rc=0', (t) => {
  const { dir, inputs } = makeDocRepo(t, ['# 标题', '', ROW_700, '', ROW_701, '', '段落', ''].join('\n'))
  // headBlobOf 返回的是 oid,不是正文 —— 要判"哪一行落没落"必须取 blob 内容,别拿 oid 做 includes
  // (那会恒不等,把"没拦住"读成"拦住了"。)
  const docAtHead = () => {
    const r = git(['show', 'HEAD:DOC.md'], { root: dir, allowFail: true })
    return r === null ? '' : String(r)
  }
  const bf = join(inputs, 'b.txt')
  const af = join(inputs, 'a.txt')
  writeFileSync(af, '段落\n')
  writeFileSync(bf, ROW_700_DUP + '\n')
  const dup = runLive(dir, { blockFile: bf, anchorFile: af })
  assert.equal(dup.status, 1, `同主键第二次登记必须拦住,rc=${dup.status} out=${String(dup.stdout + dup.stderr).slice(0, 260)}`)
  assert.match(`${dup.stdout}${dup.stderr}`, /第二次登记/, '拒绝理由必须点名这一型')
  assert.equal(docAtHead().includes('被第二席又抄了一份'), false, '拦下后一行都不许落')
  writeFileSync(bf, ROW_702 + '\n')
  const fresh = runLive(dir, { blockFile: bf, anchorFile: af })
  assert.equal(fresh.status, 0, `全新题面必须放行,rc=${fresh.status} out=${String(fresh.stdout + fresh.stderr).slice(0, 260)}`)
  assert.equal((docAtHead().match(/G-900702/g) || []).length, 1)
  // 逐字重复同一块 = G-321 的幂等档(不算新增,原样 no-op)。它与本闸互补:同一行不会因重跑而放大,
  // 所以这里断言的是"仍只有一份",而不是 rc=1 —— 拿 rc=1 当期望就是把幂等档当缺陷。
  const rerun = runLive(dir, { blockFile: bf, anchorFile: af })
  assert.equal(rerun.status, 0, `同内容重跑必须幂等放行,rc=${rerun.status} out=${String(rerun.stdout + rerun.stderr).slice(0, 260)}`)
  assert.equal((docAtHead().match(/G-900702/g) || []).length, 1, '幂等档不得把同一行插第二遍')
  writeFileSync(bf, ROW_702_DUP + '\n')
  const again = runLive(dir, { blockFile: bf, anchorFile: af })
  assert.equal(again.status, 1, '换了措辞的第二份,不带旗仍须拦(与上一臂唯一变量是措辞/旗)')
  assert.equal((docAtHead().match(/G-900702/g) || []).length, 1, '拦下后不得落该行')
  const allowed = runLive(dir, {
    blockFile: bf,
    anchorFile: af,
    extraEnv: { LIVE_LEDGER_DUP_OK: `${KEY(ROW_702)}=本轮确属第二次取证` },
  })
  assert.equal(allowed.status, 0, `逐键带原因必须放行,rc=${allowed.status} out=${String(allowed.stdout + allowed.stderr).slice(0, 260)}`)
  assert.match(`${allowed.stdout}${allowed.stderr}`, /放行留痕|声明放行/, '放行要留痕,不得静默')
  assert.equal((docAtHead().match(/G-900702/g) || []).length, 2, '放行后两份都在(本闸只拦未声明的新增,不删存量)')
})

test('DU-9 追加注记型改写(同键)不算第二次登记 —— §1 的正解不得被本闸判红', () => {
  const before = ROW_701
  const after = ROW_701 + ' 〔复测 2026-10-09:注记落在同一行上〕'
  const v = LED.judgeNewLineDupes({
    baseLines: [before],
    newLines: LED.linesIntroducedBy([before], [after]),
    removedLines: LED.linesIntroducedBy([after], [before]),
  })
  assert.equal(v.blocked.length, 0, `就地改写被判成重复登记了:净新增才是写放大(实得 ${v.blocked.length})`)
  assert.equal(v.rewritten.length, 1)
  assert.ok(LED.dupGateReport(v).some((l) => /就地改写/.test(l.text)))
})

test('DU-10 净新增仍有牙:同一枚提交里既改写已有行、又多抄一份 ⇒ 只拦多出来那一份', () => {
  const base = [ROW_701]
  const next = [ROW_701_ANNOT, ROW_701_DUP]
  const v = LED.judgeNewLineDupes({
    baseLines: base,
    newLines: LED.linesIntroducedBy(base, next),
    removedLines: LED.linesIntroducedBy(next, base),
  })
  assert.equal(v.rewritten.length, 1, '注记型改写应占掉那份额度')
  assert.equal(v.blocked.length, 1, '第二份必须拦住(放过这一型就是闸没牙)')
  assert.match(v.blocked[0].lineText, /第二席又抄了一份/, '拦的必须是真副本,不是被改写那一行')
})

test('DU-8 接线锁:主键判据只认 lib 那一份,且闸必须真挂在写盘之前', () => {
  const src = readFileSync(join(HERE, '..', 'live-doc-edit.mjs'), 'utf8')
  assert.match(
    src,
    /import\s*\{\s*compositeKeyOf\s*\}\s*from '\.\/lib\/plan-task-index\.mjs'/,
    '必须复用台账层那一份主键(两处算同一个键必漂移)',
  )
  const at = src.indexOf('judgeNewLineDupes({')
  assert.ok(at > 0, 'main 里必须真的调用本闸(函数在而无人调 = 提交链上一路绿灯)')
  const blob = src.indexOf('writeBlob(nextLines')
  assert.ok(blob > at, '闸必须在 writeBlob 之前:内容一旦 commit,再 exit 1 就是把已入库谎报成没落地')
})


