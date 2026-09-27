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
// git 写操作只发生在 scratch-dir 临时仓内,绝不碰真仓。

import { execFileSync, spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
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
  execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e.local', '-c', 'user.name=e2e', '-c', 'core.autocrlf=false', '-C', dir, ...args], runOpts)

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

function runLive(dir, { doc = 'DOC.md', anchorFile, blockFile, replaceFile, msg = 'docs: e2e register' } = {}) {
  const env = { ...process.env, LIVE_ROOT: dir, LIVE_DOC: doc, LIVE_MSG: msg }
  if (replaceFile) {
    env.LIVE_REPLACE_FILE = replaceFile
    delete env.LIVE_BLOCK_FILE
  } else env.LIVE_BLOCK_FILE = blockFile
  if (anchorFile) env.LIVE_ANCHOR_FILE = anchorFile
  else delete env.LIVE_ANCHOR_FILE
  return spawnSync(process.execPath, [TOOL], { env, encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 64 << 20 })
}

const DOC_BASE = ['# 标题', '段落一', '@@ANCHOR@@', '段落二', '']

test('T1 §22c 导出面:判据纯函数必须在 __test__ 里', () => {
  for (const k of ['readInputs', 'locateAnchor', 'assemble', 'applyReplacements'])
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
  const r = runLive(dir, { anchorFile: join(inputs, 'anchor.txt'), blockFile: join(inputs, 'block.txt') })
  assert.equal(r.status, 0, `应成功:${r.stdout}|${r.stderr}`)
  assert.match(r.stdout, /回读:本块每一条非空行都在 HEAD 里/)
  assert.match(r.stdout, /主索引已对齐 1\/1/)
  const now = norm(git(['show', 'HEAD:DOC.md'], { root: dir, raw: true })).split('\n')
  assert.deepEqual(now, ['# 标题', '段落一', '@@ANCHOR@@', '- 登记甲', '- 登记乙', '段落二', ''], '除本块插入位外,其余行必须逐字原位')
  assert.equal(indexBlobOf('DOC.md', { root: dir }), headBlobOf('HEAD', 'DOC.md', { root: dir }), '主索引须对齐到新 blob(否则一次普通提交即写回旧版)')
  assert.notEqual(git(['rev-parse', 'HEAD'], { root: dir }), before, 'HEAD 必须前进')
})

test('T5 零丢失判据有牙·命中 0 ⇒ 拒绝且不写盘', (t) => {
  const { dir, inputs } = makeDocRepo(t, DOC_BASE.join('\n'))
  writeFileSync(join(inputs, 'anchor.txt'), '@@NO-SUCH-ANCHOR@@\n')
  writeFileSync(join(inputs, 'block.txt'), '- X\n')
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  const r = runLive(dir, { anchorFile: join(inputs, 'anchor.txt'), blockFile: join(inputs, 'block.txt') })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /找不到锚点/)
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), before)
})

test('T6 零丢失判据有牙·命中 2 ⇒ 拒绝(唯一性是生命线,不猜)', (t) => {
  const { dir, inputs } = makeDocRepo(t, ['A', '@@MID@@', 'B', '@@MID@@', 'C', ''].join('\n'))
  writeFileSync(join(inputs, 'anchor.txt'), '@@MID@@\n')
  writeFileSync(join(inputs, 'block.txt'), '- X\n')
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  const r = runLive(dir, { anchorFile: join(inputs, 'anchor.txt'), blockFile: join(inputs, 'block.txt') })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /命中 2 处/)
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), before)
})

test('T7 别人已在本块位置改过一行 ⇒ 落地失败而不是覆盖(锚点已漂;先入库者赢)', (t) => {
  const { dir, inputs } = makeDocRepo(t, DOC_BASE.join('\n'))
  writeFileSync(join(inputs, 'anchor.txt'), '@@ANCHOR@@\n')
  writeFileSync(join(inputs, 'block.txt'), '- 我的登记\n')
  // 别人先落地:把锚点行本身改写了
  writeFileSync(join(dir, 'DOC.md'), ['# 标题', '段落一', '@@ANCHOR@@ ⇒ 已被人改写', '段落二', ''].join('\n'))
  runGit(dir, ['add', '--', 'DOC.md'])
  runGit(dir, ['commit', '-q', '-m', 'theirs edit'])
  const theirsHead = git(['rev-parse', 'HEAD'], { root: dir })
  const r = runLive(dir, { anchorFile: join(inputs, 'anchor.txt'), blockFile: join(inputs, 'block.txt') })
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
  assert.equal(now, ['L1', '', '- 追加一', '- 追加二', ''].join('\n'), '结构须为 HEAD(剥尾空行) ⊕ 空行 ⊕ 本块 ⊕ 换行')
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
    env: { ...process.env, LIVE_ROOT: dir, LIVE_DOC: 'DOC.md', LIVE_BLOCK_FILE: join(inputs, 'block.txt'), LIVE_ANCHOR_FILE: join(inputs, 'missing-anchor.txt'), LIVE_MSG: 'm' },
    encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 64 << 20,
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
  const ok = __test__.applyReplacements(lines, [{ before: '- [ ] **D1 待办**:说明。', after: '- [x] ✅(2026-09-27) **D1 待办**:说明。' }])
  assert.equal(ok.ok, true)
  assert.deepEqual(ok.next, ['# 标题', '- [x] ✅(2026-09-27) **D1 待办**:说明。', '段落二'])
  assert.equal(__test__.applyReplacements(lines, [{ before: '- [ ] 没有这行', after: 'X' }]).ok, false)
  assert.equal(
    __test__.applyReplacements([...lines, ...lines.slice(1)], [{ before: lines[1], after: 'X' }]).reason,
    'replace-multi-hit#1:2',
    '同文两行 ⇒ 无法确定改哪一行,必须交人工(不猜)',
  )
})

test('T11 端到端·整行改写:落地后旧形态逐条为零、其余行逐字原位、主索引对齐', (t) => {
  const src = ['# 标题', '段落一', '- [ ] **D1 待办**:说明。', '段落二', '']
  const { dir, inputs } = makeDocRepo(t, src.join('\n'))
  const rep = join(inputs, 'rep.json')
  writeFileSync(rep, JSON.stringify([{ before: src[2], after: '- [x] ✅(2026-09-27) **D1 待办**:说明。 〔收口:枚 abc1234〕' }]), 'utf8')
  const r = runLive(dir, { replaceFile: rep })
  assert.equal(r.status, 0, `应成功:${r.stdout}|${r.stderr}`)
  assert.match(r.stdout, /旧形态整行归零/)
  const now = norm(git(['show', 'HEAD:DOC.md'], { root: dir, raw: true })).split('\n')
  assert.deepEqual(now, ['# 标题', '段落一', '- [x] ✅(2026-09-27) **D1 待办**:说明。 〔收口:枚 abc1234〕', '段落二', ''], '除声明行外不得有任何位移')
  assert.equal(indexBlobOf('DOC.md', { root: dir }), headBlobOf('HEAD', 'DOC.md', { root: dir }))
})

test('T12 端到端·整行改写的两型拒绝:锚点已漂 ⇒ 不写盘;插入档与改写档互斥 ⇒ exit 2', (t) => {
  const src = ['# 标题', '- [ ] **D1 待办**:说明。', '']
  const { dir, inputs } = makeDocRepo(t, src.join('\n'))
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  const rep = join(inputs, 'rep.json')
  writeFileSync(rep, JSON.stringify([{ before: '- [ ] **D1 待办**:说明。(别人又追加了一句)', after: 'X' }]), 'utf8')
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
  writeFileSync(rep, JSON.stringify([{ before: src[1], after: `${src[1]} 〔更正(2026-09-27):本行应归"等人拍板"。〕` }]), 'utf8')
  const r = runLive(dir, { replaceFile: rep })
  assert.equal(r.status, 0, `追加注记型必须判成功:${r.stdout}|${r.stderr}`)
  assert.match(r.stdout, /主索引已对齐 1\/1/)
  const now = norm(git(['show', 'HEAD:DOC.md'], { root: dir, raw: true })).split('\n')
  assert.equal(now[1], `${src[1]} 〔更正(2026-09-27):本行应归"等人拍板"。〕`)
  assert.equal(indexBlobOf('DOC.md', { root: dir }), headBlobOf('HEAD', 'DOC.md', { root: dir }))
})
