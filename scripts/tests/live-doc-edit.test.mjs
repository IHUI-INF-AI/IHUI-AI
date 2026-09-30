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
import { mkdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ } from '../live-doc-edit.mjs'
import { git, headBlobOf, indexBlobOf, writeBlob } from '../lib/bypass-git.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
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
    runOpts,
  )

const norm = (s) => s.replace(/\r\n/g, '\n')

function makeDocRepo(t, docText, { reachableRemote = false } = {}) {
  const dir = mkScratch('lde-')
  const inputs = mkScratch('lde-in-')
  t.after(() => rmScratch(dir))
  t.after(() => rmScratch(inputs))
  runGit(dir, ['init', '-q'])
  writeFileSync(join(dir, 'DOC.md'), docText)
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'init'])
  // 2026-09-30 起取号器对"远端问不到"是 **fail-closed**(拒发号),所以凡是要走**默认路径**落地的
  // 端到端夹具都必须有一把够得着的 origin(file:// 零网络)。够不着的那一支由 N8 专门测,不在此处。
  if (reachableRemote) plantOrigin(t, dir)
  return { dir, inputs }
}

/** 给夹具仓配一把 file:// 的 origin(裸仓 + push 当前 HEAD ⇒ ls-remote 问得到、对象也问得到)。 */
function plantOrigin(t, dir) {
  const o = mkScratch('lde-origin-')
  t.after(() => rmScratch(o))
  runGit(o, ['init', '-q', '--bare', '-b', 'main'])
  runGit(dir, ['push', '-q', o, 'HEAD:refs/heads/main'])
  runGit(dir, ['remote', 'add', 'origin', pathToFileURL(o).href])
  return o
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
    env,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
    maxBuffer: 64 << 20,
  })
}

const DOC_BASE = ['# 标题', '段落一', '@@ANCHOR@@', '段落二', '']

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
  const rep = join(inputs, 'rep.json')
  writeFileSync(
    rep,
    JSON.stringify([
      { before: src[2], after: '- [x] ✅(2026-09-27) **D1 待办**:说明。 〔收口:枚 abc1234〕' },
    ]),
    'utf8',
  )
  const r = runLive(dir, { replaceFile: rep })
  assert.equal(r.status, 0, `应成功:${r.stdout}|${r.stderr}`)
  assert.match(r.stdout, /旧形态整行归零/)
  const now = norm(git(['show', 'HEAD:DOC.md'], { root: dir, raw: true })).split('\n')
  assert.deepEqual(
    now,
    [
      '# 标题',
      '段落一',
      '- [x] ✅(2026-09-27) **D1 待办**:说明。 〔收口:枚 abc1234〕',
      '段落二',
      '',
    ],
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
  const { dir, inputs } = makeDocRepo(t, '- [ ] **G-3 旧条目**:x\n@@ANCHOR@@\n', {
    reachableRemote: true,
  })
  const blockFile = join(inputs, 'block.txt')
  writeFileSync(
    blockFile,
    '- [ ]（进行中@2026-09-27/主会话）**{{NEXT_ID:G}} 取号落地**:正文\n',
    'utf8',
  )
  const r = runLive(dir, { blockFile })
  assert.equal(r.status, 0, `落地应成功,实得 ${r.status}\n${r.stdout}\n${r.stderr}`)
  assert.match(r.stdout, /令牌取号\(由该次 HEAD 底稿现算\)=G-4/, `输出没报名取到的号:\n${r.stdout}`)
  // 正例必须把"号是从哪些面上算出来的"逐条点名(只给一个 max 就分不清问过没问过对面)
  assert.match(
    r.stdout,
    /占用面来源:本地 DOC\.md ⊕ \d+ 份本地归档件@/,
    `没点名本地占用面来源:\n${r.stdout}`,
  )
  assert.match(
    r.stdout,
    /⊕ 远端 origin refs\/heads\/main@[0-9a-f]{9} 的 DOC\.md ⊕ \d+ 份对面归档件/,
    `没点名远端那一维(实时 tip 必须进报告):\n${r.stdout}`,
  )
  assert.match(
    r.stdout,
    /号段基准:G=3\(本地 HEAD 该族 max=3 \/ 远端 refs\/heads\/main max=3 ⇒ 与本地同值,与改动前同形\)/,
    `够得着远端时必须现读并印出远端 max:\n${r.stdout}`,
  )
  const now = norm(runGit(dir, ['show', 'HEAD:DOC.md']))
  assert.match(now, /\*\*G-4 取号落地\*\*/, `HEAD 里没有算出的号:\n${now}`)
  assert.doesNotMatch(now, /NEXT_ID/, '令牌本身绝不能留在文档里')
})

/** T16 改写档也要能吃令牌(让号场景就是它:把别人占了的号挪走)。 */
test('T16 整行改写档支持令牌:after 里的号由 HEAD 底稿现算', (t) => {
  const { dir, inputs } = makeDocRepo(t, '- [ ] **G-5 旧标题**:正文一句\n', {
    reachableRemote: true,
  })
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
  const now = norm(runGit(dir, ['show', 'HEAD:DOC.md']))
  assert.match(now, /\*\*G-6 让号后\*\*/, `改写后的行没拿到算出的号:\n${now}`)
  assert.doesNotMatch(now, /NEXT_ID|G-5 旧标题/, '令牌与旧形态都必须消失')
})

// ── G-313 出路②:号段基准同时看远端那一份(2026-09-28 立;2026-09-30 机主拍板改 fail-closed)──
// 票面要求"方向必须成对",所以每一支都配了反向对照:
//  N2 远端只抬高不压低(远端大 ⇒ 跳过那段;同值 / 更小 / 缺席 ⇒ 与改动前逐字同形);
//  N3 readRemoteIdBasis 的出口分三档失败旗标(unaskable / 对象未取回 / 对面底稿读不出),
//     **任一为真 = 远端这一维没问清**,而"没问清"由 I14 那道闸拒绝发号;
//  N4 端到端走**真实 ls-remote + 真实 fetch 传输**(夹具 origin,file:// 零网络):对面 tip 的对象
//     不在本地 ⇒ 本器自己 `fetch --no-tags origin <sha>` 取回,然后跳过远端那一段;
//  N4b 号躺在**对面归档件**里(旧版看不见的那一维)⇒ 占用面必须含对面归档件,新号必须避开;
//  N5 反向锁:基准计算必须在 CAS 循环**内**(提到循环外 ⇒ 本条翻红);
//  N6 形状锁:远端派生各自带数字 timeout、fetch 只许 `--no-tags` + 显式 sha、绝不写 ref、
//     不再抄第二份派生层;
//  N7 合并占用面(本地 ⊕ 远端)上候选已被占 ⇒ 跳过并**点名那个候选号**(静默改号 = 别人按旧号派工);
//  N8 端到端反向(关键):远端做成不可达(只经 env 注入,**不改仓库 remote 配置**)⇒ exit 1 +
//     `取号未判定：远端不可达/对象未取回` + HEAD 一分不动;成对三支 = 应急开关能落且喊"未对齐" /
//     幂等命中那一支**不**被挡住(闸门排在幂等判据之后)。

const LDE_LOCAL_BASE = '- [ ] **G-3 旧条目**:x\n'
const LDE_LINE = '- [ ]（进行中@2026-09-28/工具）**{{NEXT_ID:G}} 新条目**:正文'
const TOOL_SRC = norm(readFileSync(TOOL, 'utf8'))
const fakeTransport = (over = {}) => ({
  tipSha: () => ({ ok: true, sha: 'f'.repeat(40) }),
  hasCommit: () => true,
  fetchCommit: () => true,
  docContent: () => '- [ ] **G-9 远端已占**:别人那批\n',
  ...over,
})
/**
 * 对面那一份**归档件面**的夹具:默认"该 tip 上没有归档件"⇒ 远端面 = 对面台账本身。
 * 需要模拟"号在对面归档件里"时用 fakeFaceWith 造一份带归档件的。
 */
const fakeFace = ({ root, source, doc, ledgerText } = {}) => ({
  ok: true,
  source,
  doc,
  ledgerText,
  text: ledgerText,
  archiveFiles: [],
  undetermined: [],
  notes: [],
})
const fakeFaceWith = (bodies) => ({ root, source, doc, ledgerText }) => ({
  ok: true,
  source,
  doc,
  ledgerText,
  text: [ledgerText, ...bodies].join('\n'),
  archiveFiles: bodies.map((b, i) => ({ path: `.ihui-agent/archive/PROJECT_PLAN_t${i}.md`, bytes: b.length })),
  undetermined: [],
  notes: [],
})
const rd = (over = {}) =>
  __test__.readRemoteIdBasis({ root: 'X:', doc: 'DOC.md', families: ['G'], faceCollector: fakeFace, ...over })

test('N1 §22c 新增导出面:远端基准的出口必须在 __test__ 里(否则测试只能重抄判据)', () => {
  for (const k of [
    'readRemoteIdBasis',
    'idTokenFamilies',
    'describeIdBasis',
    'remoteTarget',
    'occupiedSetFor',
    'numOfId',
  ])
    assert.equal(typeof __test__[k], 'function', `__test__.${k} 缺失`)
  assert.equal(typeof __test__.REMOTE_ID_TRANSPORT, 'object')
  for (const k of ['tipSha', 'hasCommit', 'fetchCommit', 'docContent'])
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
  // 2026-09-30 新档:问过对面、对面这一族零行 ⇒ 既不是降级也不是"未对齐"(拦它就是恒红门)
  const askedEmpty = __test__.describeIdBasis(
    { family: 'G', localMax: 3, remoteMax: null, chosenMax: 3 },
    { ref: 'refs/heads/main', consulted: true },
  )
  assert.ok(
    askedEmpty.includes('该族零行') && askedEmpty.includes('不是降级'),
    `问过而零行的措辞必须与降级分开,实得:${askedEmpty}`,
  )
  assert.ok(
    !askedEmpty.includes('未与远端对齐'),
    `读过对面且该族为空,不得写成未对齐:${askedEmpty}`,
  )
  assert.ok(
    __test__
      .describeIdBasis({ family: 'G', localMax: 3, remoteMax: 3, chosenMax: 3 }, { ref: 'r' })
      .includes('与本地同值,与改动前同形'),
  )
})

test('N3 readRemoteIdBasis:远端问不到 ⇒ 三档失败旗标 + consulted=false(函数本身不抛,拒由闸门做)', () => {
  // 2026-09-30 机主拍板:旧标题"远端问不到一律只降级不失败"里那句"降级照发号"被翻成
  // "降级 = 未判定 = 由 I14 那道闸拒绝发号"。翻转的是**授权边界**,不是把断言放宽:
  // 本条现在既查旗标,也查"旗标必须被闸门吃掉"(见文件末尾 I14 的三档全拦)。
  const ok = rd({ transport: fakeTransport() })
  assert.deepEqual(ok.max, { G: 9 }, 'max 必须来自**远端那一份面**现读,不是常量')
  assert.deepEqual(ok.occupied, { G: [9] }, '对面已占的号段数字必须交出去(合并面复核要用)')
  assert.deepEqual(ok.notes, [])
  assert.deepEqual(ok.undetermined, [])
  assert.equal(ok.consulted, true, '问到了 ⇒ consulted 必须为真(否则闸门会误拦)')
  assert.equal(ok.tipSha, 'f'.repeat(40))

  // ① ls-remote 抛(网络不可达 / 无 origin / 非 win32 拿不到 git / 超时)⇒ unaskable
  const net = rd({
    transport: fakeTransport({
      tipSha: () => {
        throw new Error('ssh: connect to github.com port 443 timed out')
      },
    }),
  })
  assert.deepEqual(net.max, {})
  assert.equal(net.unaskable, true)
  assert.equal(net.consulted, false)
  assert.match(net.undetermined[0], /远端不可达/)
  assert.match(net.undetermined[0], /timed out/, '原因必须带上 git 的那句话,不能只说"没读到"')

  // ② ls-remote 通了而该 ref 不存在 ⇒ 同样算不可达,不得当成"远端 max=0"
  const noref = rd({
    transport: fakeTransport({
      tipSha: () => ({ ok: false, reason: 'origin 上没有 refs/heads/main' }),
    }),
  })
  assert.deepEqual(noref.max, {})
  assert.equal(noref.unaskable, true)
  assert.match(noref.undetermined[0], /origin 上没有 refs\/heads\/main/)

  // ③ tip 对象不在本地 ⇒ **先 fetch 一次**(--no-tags + 显式 sha),取回来就必须问得出
  let fetched = []
  let probes = 0
  const fetchedOk = rd({
    transport: fakeTransport({
      hasCommit: ({ sha }) => {
        probes += 1
        if (fetched.length === 0) throw new Error('fatal: Not a valid object name deadbeef')
        return true
      },
      fetchCommit: ({ remote, sha }) => {
        fetched.push([remote, sha])
        return true
      },
    }),
  })
  assert.deepEqual(
    fetched,
    [['origin', 'f'.repeat(40)]],
    '顺序必须是 cat-file → fetch → cat-file,且只 fetch 一次(目标是刚问到的那枚 tip)',
  )
  assert.ok(
    probes >= 2,
    `fetch 之后必须**再探一次**(只 fetch 不再探 = 把"fetch 成功"当成"对象可用"),实得 ${probes} 次`,
  )
  assert.equal(fetchedOk.remoteAheadUnfetched, false, 'fetch 取回了就不能再挂"未取回"')
  assert.equal(fetchedOk.fetchedNow, true, '报告里要能看出本次为读对面底稿 fetch 过对象')
  assert.deepEqual(fetchedOk.max, { G: 9 })
  assert.equal(fetchedOk.consulted, true)

  // ③b fetch 也没把对象取回 ⇒ remoteAheadUnfetched(这一档与①分开:对面确实在推进)
  const missing = rd({
    transport: fakeTransport({
      hasCommit: () => {
        throw new Error('fatal: Not a valid object name deadbeef')
      },
      fetchCommit: () => {
        throw new Error('fatal: remote error: want <sha> ... Server does not allow request for unadvertised object')
      },
    }),
  })
  assert.deepEqual(missing.max, {})
  assert.equal(missing.remoteAheadUnfetched, true)
  assert.equal(missing.consulted, false)
  assert.match(missing.undetermined[0], /^对象未取回/)
  assert.match(missing.undetermined[0], /unadvertised object/, 'git 原话必须带出来(否则读的人无法判是不是策略问题)')
  // **发号计算本身**仍然算得出 G-4(纯函数只管取号),拒的是"要不要落" —— 由闸门做,不做在两处。
  assert.ok(
    __test__.resolveIdTokens([LDE_LINE], LDE_LOCAL_BASE, missing).lines[0].includes('**G-4 新条目**'),
  )
  assert.equal(
    __test__.idBasisGate({ families: ['G'], remote: missing }).block,
    true,
    '对象未取回 ⇒ 这一维没问清,必须拒(旧版在这一档只警告着落号,那正是 G-916432/G-916433 同号的形状)',
  )
  // transport 连 fetch 通道都没给 ⇒ 也算未取回,不许悄悄当成"没有远端"
  const noFetchChannel = rd({
    transport: {
      ...fakeTransport({
        hasCommit: () => {
          throw new Error('fatal: Not a valid object name deadbeef')
        },
      }),
      fetchCommit: undefined,
    },
  })
  assert.equal(noFetchChannel.remoteAheadUnfetched, true, '没有取对象通道 ⇒ 只能判未判定')
  assert.match(noFetchChannel.undetermined[0], /没有取对象通道/)

  // ④ 对象在而文档读不出(tip 里没这份文档)⇒ 另一条独立原因,不得混进"对象未取回"
  const noDoc = rd({
    transport: fakeTransport({
      docContent: () => {
        throw new Error('fatal: path DOC.md does not exist')
      },
    }),
  })
  assert.equal(noDoc.docUnreadable, true)
  assert.match(noDoc.undetermined[0], /读不到 DOC\.md/)
  assert.doesNotMatch(noDoc.undetermined[0], /对象未取回/)

  // ④b 对面归档件面取不全 ⇒ 同一档(只看对面台账会把号发进对面归档件里)
  const halfFace = rd({
    transport: fakeTransport(),
    faceCollector: () => ({ ok: false, undetermined: ['归档件 X 取不到'], text: '', archiveFiles: [] }),
  })
  assert.equal(halfFace.docUnreadable, true)
  assert.match(halfFace.undetermined[0], /占用面取不全.*归档件 X 取不到/)

  // ⑤ 远端可读而该族在远端一条登记行都没有 ⇒ "读到且为空",与降级分开措辞、同样不构成上界
  const emptyFam = rd({ transport: fakeTransport({ docContent: () => '# 空的\n' }) })
  assert.deepEqual(emptyFam.max, {})
  assert.match(emptyFam.notes[0], /不构成上界/)
  assert.deepEqual(emptyFam.undetermined, [], '"读到了而该族为空"不是降级 ⇒ 不许进 undetermined 桶')
  assert.equal(emptyFam.consulted, true, '问过而对面零行 ⇒ 这一维算问清了(拦它就是恒红门)')
  assert.doesNotMatch(emptyFam.notes[0], /对象未取回|远端不可达/)

  // ⑥ transport 没返回文本 ⇒ 判不出,不算"远端没有这一族"
  const nullContent = rd({ transport: fakeTransport({ docContent: () => null }) })
  assert.equal(nullContent.docUnreadable, true)
  assert.match(nullContent.undetermined[0], /判不出,不算已对齐/)

  // ⑦ 没有令牌(families 空)⇒ 一次远端都不问,零副作用
  let asked = 0
  const none = rd({
    families: [],
    transport: {
      tipSha: () => {
        asked += 1
        return { ok: true, sha: '' }
      },
      hasCommit: () => true,
      fetchCommit: () => true,
      docContent: () => '',
    },
  })
  assert.equal(asked, 0, '没有令牌就不该为取号去问远端')
  assert.deepEqual([none.max, none.notes], [{}, []])
  assert.equal(none.consulted, false)
  assert.equal(
    __test__.idBasisGate({ families: [], remote: none }).block,
    false,
    '纯改写落地(零令牌)不受本闸影响 —— 否则挡的不是撞号,是每一次结清',
  )
})

test('N4 端到端·真实 ls-remote + 真实 fetch(夹具 origin,file:// 零网络):对面在推进就必须跳过那段', (t) => {
  // A = "远端"夹具(与 B 无共同历史),B = 被测仓(origin → A)。
  // 所有写操作只发生在两把 scratch 仓里;真仓 refs、真仓网络一个字都没被碰(见 N6 的形状锁)。
  const a = mkScratch('lde-origin-')
  t.after(() => rmScratch(a))
  runGit(a, ['init', '-q', '-b', 'main'])
  writeFileSync(join(a, 'DOC.md'), '- [ ] **G-9 远端已占**:别人那批\n')
  runGit(a, ['add', '-A'])
  runGit(a, ['commit', '-q', '-m', 'remote advance'])
  const aTip = runGit(a, ['rev-parse', 'HEAD']).trim()

  const { dir, inputs } = makeDocRepo(t, '- [ ] **G-3 旧条目**:x\n@@ANCHOR@@\n')
  runGit(dir, ['remote', 'add', 'origin', pathToFileURL(a).href])
  const blockFile = join(inputs, 'block.txt')
  writeFileSync(blockFile, `${LDE_LINE}\n`, 'utf8')
  // 前置:B 从未见过 A 那枚 commit(否则本条测的就不是"取对象"那一步)
  assert.throws(() => runGit(dir, ['cat-file', '-e', `${aTip}^{commit}`]))

  // ── 阶段一:tip 问得到、对象不在本地 ⇒ 本器自己 `fetch --no-tags origin <sha>` 取对象,然后按对面基准发号 ──
  // 2026-09-29 这一支是"警告一句然后按本地发号"(当天真发出两枚与远端同号的登记);
  // 2026-09-30 机主拍板后改成:先取对象再判,取不到才拒(拒的那一支在 N8)。
  const r1 = runLive(dir, { blockFile })
  assert.equal(r1.status, 0, `远端可达(取到对象)⇒ 必须按对面基准发号,实得 ${r1.status}\n${r1.stdout}\n${r1.stderr}`)
  assert.ok(
    r1.stdout.includes(
      '号段基准:G=9(本地 HEAD 该族 max=3 / 远端 refs/heads/main max=9 ⇒ 取较大,新号跳过远端那段)',
    ),
    `实得:\n${r1.stdout}`,
  )
  assert.match(r1.stdout, /令牌取号\(由该次 HEAD 底稿现算\)=G-10/)
  assert.ok(
    r1.stdout.includes('本次为读对面底稿 fetch 过对象,未写任何 ref'),
    `报告必须写明本次 fetch 过(否则读的人不知道对象从哪来):\n${r1.stdout}`,
  )
  assert.ok(
    !r1.stdout.includes('号段基准未含远端'),
    `对象已取回却仍报未判定 ⇒ 远端那一维压根没读到:\n${r1.stdout}`,
  )
  const docNow = norm(git(['show', 'HEAD:DOC.md'], { root: dir, raw: true }))
  assert.match(docNow, /\*\*G-10 新条目\*\*/, `HEAD 里必须是跳过远端段后的号:\n${docNow}`)
  assert.doesNotMatch(
    docNow,
    /\*\*G-4 新条目\*\*/,
    '只看本地 HEAD 会产出 G-4 —— 那正是 G-313 要堵的那一型(对面已把 4..9 占掉)',
  )
  // fetch 只准取对象:不得留下 remote-tracking ref,也不得动工作区(§5b + §12)
  assert.ok(
    !git(['for-each-ref', '--format=%(refname)'], { root: dir }).includes('refs/remotes/origin'),
    '为取号做的 fetch 不得留下任何 remote-tracking ref(§5b:嵌套 ref 会被宿主清理层删、update-ref 假成功)',
  )
  // 本器是**对象空间**落地:HEAD 前进,工作区那份副本一个字也不写(写盘归 merge-live-doc / 对齐层)。
  // 这一句同时是"为什么需要 check-live-doc-pathspec"的现场证据:工作区此刻就是旧态。
  assert.ok(
    !readFileSync(join(dir, 'DOC.md'), 'utf8').includes('G-10'),
    '取号落地绝不该改写工作区文件',
  )
  // 对面那枚对象确实进了本地库(这就是"问过远端"的物质证据)
  assert.equal(runGit(dir, ['cat-file', '-t', aTip]).trim(), 'commit')
})

test('N4b 端到端·号在**对面归档件**里(旧版看不见那一维)⇒ 新号必须跳过它,且报告点名对面归档件份数', (t) => {
  // 现场:A 仓把 G-4 整块**归档**进 .ihui-agent/archive/(A 的台账里 G 族零成员),
  // B 仓(origin→A)台账只有 G-3 ⇒ 只看对面台账会发 G-4,与 A 归档里那条同号。
  // 2026-09-30 起占用面含**对面归档件** ⇒ 必须发到 G-5(旧版在这一型上必错,这一条就是它的反证)。
  const a = mkScratch('lde-arch-origin-')
  const b = mkScratch('lde-arch-local-')
  const bin = mkScratch('lde-arch-in-')
  t.after(() => {
    rmScratch(a)
    rmScratch(b)
    rmScratch(bin)
  })
  for (const d of [a, b]) {
    runGit(d, ['init', '-q', '-b', 'main'])
    runGit(d, ['config', 'user.email', 't@e2e.local'])
    runGit(d, ['config', 'user.name', 'e2e'])
    runGit(d, ['config', 'core.autocrlf', 'false'])
  }
  writeFileSync(join(a, 'PROJECT_PLAN.md'), '# 台账\n@@ANCHOR@@\n- [ ] **G-1 别族无关行**:x\n')
  mkdirSync(join(a, '.ihui-agent', 'archive'), { recursive: true })
  writeFileSync(
    join(a, '.ihui-agent', 'archive', 'PROJECT_PLAN_2026-09-29_auto-archive.md'),
    '- [x] **G-4 已被对面归档**:完成于昨天\n',
  )
  runGit(a, ['add', '-A'])
  runGit(a, ['commit', '-q', '-m', '对面把 G-4 归档'])
  writeFileSync(join(b, 'PROJECT_PLAN.md'), '# 台账\n@@ANCHOR@@\n- [ ] **G-3 旧条目**:x\n')
  writeFileSync(join(bin, 'block.txt'), '- [ ] **{{NEXT_ID:G}} 新任务**:正文\n')
  writeFileSync(join(bin, 'anchor.txt'), '@@ANCHOR@@\n')
  runGit(b, ['add', '-A'])
  runGit(b, ['commit', '-q', '-m', 'init'])
  runGit(b, ['remote', 'add', 'origin', pathToFileURL(a).href])
  // 前置:B 这一侧从头到尾没有 G-4(既不在台账也不在归档件)
  assert.doesNotMatch(runGit(b, ['show', 'HEAD:PROJECT_PLAN.md']), /G-4/)

  const r = runLive(b, {
    doc: 'PROJECT_PLAN.md',
    blockFile: join(bin, 'block.txt'),
    anchorFile: join(bin, 'anchor.txt'),
  })
  assert.equal(r.status, 0, `实得 ${r.status}\n${r.stdout}\n${r.stderr}`)
  assert.match(
    r.stdout,
    /占用面来源:本地 PROJECT_PLAN\.md ⊕ 0 份本地归档件@\w+ ⊕ 远端 origin refs\/heads\/main@\w{9} 的 PROJECT_PLAN\.md ⊕ 1 份对面归档件/,
    `报告必须点名"对面那一份归档件"也在占用面里:\n${r.stdout}`,
  )
  assert.match(
    r.stdout,
    /号段基准:G=4\(本地 HEAD 该族 max=3 \/ 远端 refs\/heads\/main max=4 ⇒ 取较大,新号跳过远端那段\)/,
    `对面的号必须来自对面**归档件**里的 G-4:\n${r.stdout}`,
  )
  assert.match(r.stdout, /令牌取号\(由该次 HEAD 底稿现算\)=G-5/)
  const doc = norm(git(['show', 'HEAD:PROJECT_PLAN.md'], { root: b, raw: true }))
  assert.match(doc, /\*\*G-5 新任务\*\*/, `HEAD 里必须是避开对面归档件后的号:\n${doc}`)
  assert.doesNotMatch(doc, /\*\*G-4 新任务\*\*/, '只看对面台账会发 G-4 —— 那正是对面归档件里已经躺着的那一枚')
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
      'resolveIdTokens(targetLines, baseContent, remote)',
    ),
    '取号必须吃到本轮的远端基准,而不是上一轮的',
  )
})

test('N6 形状锁:远端四次派生各自带数字 timeout、fetch 只许 --no-tags+显式 sha、绝不写 ref、不抄第二份派生层', () => {
  const tStart = TOOL_SRC.indexOf('export const REMOTE_ID_TRANSPORT = {')
  const tEnd = TOOL_SRC.indexOf('export function readRemoteIdBasis')
  assert.ok(tStart > 0 && tEnd > tStart, '传输面与读取面必须相邻(切片找不到就是结构漂了)')
  const transportSrc = TOOL_SRC.slice(tStart, tEnd)
  const gitCalls = (transportSrc.match(/\bgit\(\[/g) || []).length
  const timeouts = (transportSrc.match(/timeout:/g) || []).length
  assert.equal(
    gitCalls,
    4,
    `远端读取恰好四次派生(ls-remote / cat-file -t / fetch --no-tags / show),实得 ${gitCalls}`,
  )
  assert.equal(
    timeouts,
    gitCalls,
    '每一次远端派生都必须带 timeout(守门 80 口径;本仓实测过无超时挂 80 分钟)',
  )
  // 2026-09-30 翻转的那半条:为读对面底稿**允许** fetch,但只允许那一种形状 ——
  // `--no-tags` + 显式 sha(取对象、不写 tag ref)。漏掉 --no-tags 会往 refs/tags/** 里灌东西,
  // 而本仓的清理层删 ref 后 update-ref 会"返回 0 却不落盘"(§5b),那是更难查的第二型。
  const fetchArgs = [...transportSrc.matchAll(/git\(\[('fetch'[^\]]*)\]/g)].map((m) => m[1])
  assert.equal(fetchArgs.length, 1, `远端那一维只许一次 fetch,实得 ${fetchArgs.length}`)
  assert.ok(
    /'--no-tags'/.test(fetchArgs[0]),
    `fetch 必须显式带 --no-tags(且只取显式 sha),实得 git([${fetchArgs[0]}])`,
  )
  assert.doesNotMatch(
    fetchArgs[0],
    /refs\/(heads|remotes|tags)\//,
    'fetch 的参数里不得出现任何 ref 路径(那是"写 ref"的前戏)',
  )
  assert.doesNotMatch(
    transportSrc,
    /'(update-ref|push|symbolic-ref|clone|remote)'/,
    '为号段基准去写 ref 会撞上 §5b:嵌套 remote-tracking ref 被宿主清理层删、update-ref 返 0 却不落盘',
  )
  assert.doesNotMatch(
    TOOL_SRC,
    /\bexecFileSync\(/,
    'windowsHide 与绝对路径 git 候选只许住在 lib/bypass-git.mjs 那一份里(抄第二份必漂,守门 52 判的就是这个)',
  )
})

// ── N7/N8(2026-09-30 机主拍板 D1 的两条新锁):合并面复核 + 远端不可达必须拒 ──────────
test('N7 合并占用面(本地 ⊕ 远端)上候选已被占 ⇒ 跳过并点名那个候选号,绝不静默改号', () => {
  // 场景:本地面 max=3,对面台账 max 也是 3(所以"抬高"这一维看不出问题),
  // 但对面**归档件**里躺着 G-4 —— 只看台账 max 的旧版会正好发出 G-4,和对面归档里那条同号。
  const remote = {
    max: { G: 3 },
    occupied: { G: [1, 2, 3, 4] },
    tipSha: 'a'.repeat(40),
    ref: 'refs/heads/main',
    consulted: true,
    undetermined: [],
  }
  const r = __test__.resolveIdTokens([LDE_LINE], LDE_LOCAL_BASE, remote)
  assert.ok(r.lines[0].includes('**G-5 新条目**'), `被占的 G-4 必须跳过去,实得 ${r.lines[0]}`)
  assert.equal(r.assigned, 'G-5')
  assert.deepEqual(
    r.taken,
    [{ family: 'G', candidate: 'G-4' }],
    `必须点名被占的候选号(静默改号 = 别人继续按 G-4 派工),实得 ${JSON.stringify(r.taken)}`,
  )
  // 反向对照:合并面上没被占的候选不得无故跳号(否则每次落地都白抬一位,号段腐烂)
  const clean = __test__.resolveIdTokens([LDE_LINE], LDE_LOCAL_BASE, {
    ...remote,
    occupied: { G: [1, 2, 3] },
  })
  assert.deepEqual([clean.assigned, clean.taken], ['G-4', []], '没占就不许改号')
  // 一块里两个同族令牌:第一个把被占的 G-4 跳掉、实发 G-5,第二个必须接着 G-6(点名只点真被占的那个)
  const two = __test__.resolveIdTokens(
    ['- [ ] **{{NEXT_ID:G}} 甲**:x', '- [ ] **{{NEXT_ID:G}} 乙**:y'],
    LDE_LOCAL_BASE,
    { ...remote, max: { G: 1 }, occupied: { G: [4] } },
  )
  assert.ok(
    two.lines[0].includes('**G-5 甲**') && two.lines[1].includes('**G-6 乙**'),
    `远端更小绝不压低基准(3 仍是本地 max),但被占的 4 必须跳过,实得 ${JSON.stringify(two.lines)}`,
  )
  assert.deepEqual(two.taken, [{ family: 'G', candidate: 'G-4' }], `实得 ${JSON.stringify(two.taken)}`)
  // occupiedSetFor:两面并集,数字取自 usedIdsOfPrefix 交出的 ids(本器不另写一份"什么算一个号")
  assert.deepEqual(
    [...__test__.occupiedSetFor('G', { ids: ['G-1', 'G-3'] }, { occupied: { G: [3, 4, 9] } })].sort(
      (a, b) => a - b,
    ),
    [1, 3, 4, 9],
  )
})

test('N8 端到端反向(关键):远端做成不可达 ⇒ 拒绝发号、exit 非零、HEAD 一分不动;应急开关才落并喊未对齐', (t) => {
  // 反向那一支**只经 env 注入**(`LIVE_ID_REMOTE` 指向一个不存在的 remote 名),仓库 remote 配置一字未改。
  const { dir, inputs } = makeDocRepo(t, '- [ ] **G-3 旧条目**:x\n@@ANCHOR@@\n')
  writeFileSync(join(inputs, 'anchor.txt'), '@@ANCHOR@@\n')
  const blockFile = join(inputs, 'block.txt')
  writeFileSync(blockFile, `${LDE_LINE}\n`, 'utf8')
  const unreachable = { LIVE_ID_REMOTE: '__no_such_remote__' }
  const headBefore = git(['rev-parse', 'HEAD'], { root: dir })

  // ① 默认路径 fail-closed:远端不可达 ⇒ 未判定 ⇒ 拒
  const r1 = runLive(dir, { blockFile, anchorFile: join(inputs, 'anchor.txt'), extraEnv: unreachable })
  assert.equal(r1.status, 1, `远端不可达必须拒发号,实得 ${r1.status}\n${r1.stdout}\n${r1.stderr}`)
  assert.match(r1.stderr, /取号未判定：远端不可达\/对象未取回/, `必须打印票面那句,实得:\n${r1.stderr}`)
  assert.match(r1.stderr, /__no_such_remote__/, '拒绝理由必须点名是哪一个 remote(否则无从补救)')
  assert.match(r1.stderr, /git fetch --no-tags __no_such_remote__ refs\/heads\/main/, '必须给出一手可执行的出路')
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), headBefore, '被拒那一支绝不许产生提交')
  assert.doesNotMatch(
    norm(git(['show', 'HEAD:DOC.md'], { root: dir, raw: true })),
    /G-4/,
    '拒绝落地而号却进了库 ⇒ 就是把"没落地"谎报成"已落地"(G-321 那一型)',
  )
  // 未判定那一维必须留在 stdout 上(报告读得见),而不是被 stderr 的一句"失败"吞掉
  assert.match(r1.stdout, /号段基准:G=3\(本地 HEAD 该族 max=3 \/ 远端未参与.*未与远端对齐\)/s)

  // ② 应急档必须真的可用,而且用了必大声
  const r2 = runLive(dir, {
    blockFile,
    anchorFile: join(inputs, 'anchor.txt'),
    extraEnv: { ...unreachable, IHUI_PLAN_ID_ALLOW_UNALIGNED: '1' },
  })
  assert.equal(r2.status, 0, `应急放行那一支必须落得了地,实得 ${r2.status}\n${r2.stdout}\n${r2.stderr}`)
  assert.match(r2.stdout, /已按 IHUI_PLAN_ID_ALLOW_UNALIGNED 应急放行/)
  assert.match(r2.stdout, /未与远端对齐/)
  assert.match(r2.stdout, /令牌取号\(由该次 HEAD 底稿现算\)=G-4/)

  // ③ 成对反向:闸门只挡**发号**,不挡"读一遍发现已经在位"的幂等命中
  const r3 = runLive(dir, { blockFile, anchorFile: join(inputs, 'anchor.txt'), extraEnv: unreachable })
  assert.equal(r3.status, 0, `已在位那一支不该被"远端不可达"挡住,实得 ${r3.status}\n${r3.stdout}\n${r3.stderr}`)
  assert.match(r3.stdout, /本块已在位/)
  assert.doesNotMatch(r3.stdout, /令牌取号\(/, '已在位不产生提交 ⇒ 不该报"取了号"')
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), r2.stdout.match(/HEAD=([0-9a-f]{40})/)[1])
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
  const { dir, inputs } = makeDocRepo(t, `- [ ] **G-3 旧条目**:x\n${G321_ANCHOR}\n`, {
    reachableRemote: true,
  })
  writeFileSync(join(inputs, 'anchor.txt'), `${G321_ANCHOR}\n`)
  writeFileSync(
    join(inputs, 'block.txt'),
    '- [ ]（进行中@2026-09-28/工具）**{{NEXT_ID:G}} 幂等落地**:正文\n',
  )
  const r1 = g321Run(dir, inputs)
  assert.equal(r1.status, 0, `第一次必须落地:${r1.stdout}|${r1.stderr}`)
  assert.match(r1.stdout, /令牌取号\(由该次 HEAD 底稿现算\)=G-4/)
  const h1 = git(['rev-parse', 'HEAD'], { root: dir })
  const r2 = g321Run(dir, inputs)
  assert.equal(r2.status, 0, `号不同也必须认出"已在位":${r2.stdout}|${r2.stderr}`)
  assert.match(r2.stdout, /本块已在位/)
  assert.match(r2.stdout, /编号位按族形状视作可变段\(G 族/)
  assert.doesNotMatch(r2.stdout, /令牌取号\(/, '已在位这一支不产生提交 ⇒ 不该报"取了号"')
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), h1, '第二次绝不许产生新提交')
  const doc = norm(git(['show', 'HEAD:DOC.md'], { root: dir, raw: true }))
  assert.equal((doc.match(/幂等落地/g) ?? []).length, 1, '逐字等值判据在这一型上必然漏掉 ⇒ 会多出 G-5 那一份')
  assert.doesNotMatch(doc, /G-5/, '第二次跑若真落地就会产出 G-5 重复段')
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

test('I14 取号前的远端对齐闸门:三档失败**全拦**(2026-09-30 机主拍板 fail-closed),只有问过与不取号才放', () => {
  const { idBasisGate } = __test__
  assert.equal(typeof idBasisGate, 'function', '判据未导出 ⇒ 镜像只能重抄一份,抄的那份会跟着漂绿(§22c)')
  // 一手事故链:① 2026-09-29 发出 G-592/G-593 与远端 09-28 的登记同号(当时只警告一句照落,并集收敛后
  // 当场撞出 2 组 F9);② 2026-09-30 又发出 G-916432/G-916433 两枚同号 —— 机主据此把"远端问不到"从
  // **降级档**改判成**拒绝档**:取号器绝不允许在"没问清谁占了号"的情况下发一个号出去。
  const tip = 'd7a9376aa9c11222de66c9a43565cd7f09257c17'
  const tiers = [
    ['远端不可达', { unaskable: true, tipSha: '' }],
    ['对象未取回', { remoteAheadUnfetched: true, tipSha: tip }],
    ['对面底稿读不出', { docUnreadable: true, tipSha: tip }],
    ['零读数(连 tip 都没问到)', { tipSha: '' }],
  ]
  for (const [name, remote] of tiers) {
    const g = idBasisGate({ families: ['G'], remote: { ...remote, undetermined: [name] } })
    assert.equal(g.block, true, `${name} ⇒ 必须拒(旧版在这一档只警告着落号,那就是同号的成因)`)
    assert.match(
      g.reason,
      /取号未判定：远端不可达\/对象未取回/,
      `${name} 的拒绝理由必须带票面那句,实得 ${g.reason}`,
    )
    assert.match(g.reason, new RegExp(name.replace(/[()（）]/g, '.')), `拒绝理由必须点名是哪一档,实得 ${g.reason}`)
    const passed = idBasisGate({
      families: ['G'],
      remote: { ...remote, undetermined: [name] },
      allowUnaligned: true,
    })
    assert.equal(passed.block, false, `${name} 档的应急出口必须真能放行,否则会话改用 pathspec 硬交`)
    assert.match(passed.note, /IHUI_PLAN_ID_ALLOW_UNALIGNED/, `${name}:放行必须点名是哪一个开关放行的`)
    assert.match(passed.note, /未与远端对齐/, `${name}:放行也不得静默,报告里必须仍写着没对齐`)
  }
  // 反向护栏:两条"该放"的必须放,缺一条就等于把闸门做成恒红(§12e:恒红门的唯一结局是 --no-verify)
  assert.equal(
    idBasisGate({ families: [], remote: { unaskable: true, tipSha: '' } }).block,
    false,
    '本次不取号 ⇒ 纯改写落地绝不能被这条拦住(否则每一次结清都要一个应急开关)',
  )
  assert.equal(
    idBasisGate({
      families: ['G'],
      remote: { tipSha: tip, consulted: true, undetermined: [], notes: ['G 族在远端零行 ⇒ 不构成上界'] },
    }).block,
    false,
    '问过对面、对面这一族零行 ⇒ 是"判过且无抬升",不是降级,不许拦',
  )
  assert.equal(
    idBasisGate({ families: ['G'], remote: { tipSha: tip, consulted: true } }).block,
    false,
    '远端已参与(对象在本地、底稿读到了)⇒ 与改动前逐字同形,不得新增拦阻',
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
  // 2026-09-30 新增两条方向锁(都是"判据在但接错位置"那一型,光看单测抓不到):
  //  ① 幂等命中(本块已在位 ⇒ exit 0)**不发号**,所以它必须在闸门之前 —— 接反了会让"重跑一次看
  //     是否在位"在离线机器上被拒,那等于把用户往 pathspec 硬交那边推(§12e 恒红门同一条)。
  assert.ok(
    body.indexOf('if (chk.inPlace)') > 0 && body.indexOf('idBasisGate(') > body.indexOf('if (chk.inPlace)'),
    '闸门必须排在幂等判据之后:已在位那一支一个字也不写,不该要求远端可达(N8 ③ 是它的端到端对照)',
  )
  //  ② 合并面跳号必须**报名**:resolveIdTokens 交出 taken 列表而循环体里把它打印出来,
  //     静默改号 = 别人继续按旧号派工(与"报数不报名"同禁)。
  assert.match(
    body.slice(0, at),
    /候选号[\s\S]{0,200}已被占住/,
    'tok.taken 必须逐条打印出被占的候选号(只在函数里返回而无人印 = 判据在而无人调)',
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
