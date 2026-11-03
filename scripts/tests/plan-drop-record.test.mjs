// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:`live-doc-edit.mjs` 整行改写档的**结清留痕自动腿**(2026-10-26 立)。
// 判据/写口都住 `scripts/lib/plan-drop-record.mjs`,本文件一律从 `__test__` 取(§22c:禁止在测试里
// 复制第二份判据)。票面五条逐条钉死:
//  ① 未勾→已勾 ⇒ 两形态各入账一次且逐字等值;
//  ② 同形态重跑 ⇒ 不重复追加(幂等);
//  ③ 纯注记改写 ⇒ 零入账;
//  ④ 落地失败 / HEAD 未推进 ⇒ 零入账;
//  ⑤ 台账取不到 ⇒ 大声未判定(exit 2),不静默跳过。
// 另锁三条:留痕必须排在落地成功之后(T7 断言"内容已在 HEAD 才入账")、只在这条形状上写、真账零污染。
// git 写操作只发生在 scratch-dir 临时仓内;真仓 `.ihui-agent/state/plan-row-drop.jsonl` 只读计数。

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as drop } from '../lib/plan-drop-record.mjs'
import { __test__ as live } from '../live-doc-edit.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOOL = join(HERE, '..', 'live-doc-edit.mjs')
const REPO = join(HERE, '..', '..')
const REAL_LEDGER = join(REPO, '.ihui-agent', 'state', 'plan-row-drop.jsonl')
const GIT = resolveGitBin() || 'git'
const runOpts = { encoding: 'utf8', windowsHide: true, timeout: 60_000, maxBuffer: 64 << 20 }

const runGit = (dir, args) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e.local', '-c', 'user.name=e2e', '-C', dir, ...args], {
    ...runOpts,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
const norm = (s) => s.replace(/\r\n/g, '\n')

const ledgerLinesOf = (n) =>
  existsSync(n) ? readFileSync(n, 'utf8').split('\n').filter((l) => l.trim() !== '') : []
const realLedgerCount = () => ledgerLinesOf(REAL_LEDGER).length
const entriesOf = (dir) =>
  ledgerLinesOf(join(dir, '.ihui-agent', 'state', 'plan-row-drop.jsonl'))
    .map((l) => JSON.parse(l))
    .filter((e) => e.kind === drop.DROP_KIND)

const FLIP_BEFORE = '- [ ] **D1 待办**:说明。'
const FLIP_AFTER = '- [x] ✅(2026-10-26) **D1 待办**:说明。'

function makeRepo(t) {
  const dir = mkScratch('droprec-')
  const inputs = mkScratch('droprec-in-')
  t.after(() => rmScratch(dir))
  t.after(() => rmScratch(inputs))
  runGit(dir, ['init', '-q'])
  writeFileSync(join(dir, 'DOC.md'), ['# 标题', '段落一', FLIP_BEFORE, '段落二', ''].join('\n'))
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'init'])
  return { dir, inputs }
}

function runLive(dir, replaceFile, extraEnv = {}) {
  return spawnSync(process.execPath, [TOOL], {
    stdio: ['ignore', 'pipe', 'pipe'],
    // D6/D7 覆盖的是「翻勾后两形态入账」那条旧路径,显式走回退开关;
    // 默认(结清即删只入未勾一条)由 D8 单独覆盖。extraEnv 在后 ⇒ 可覆盖本缺省。
    env: {
      ...process.env,
      LIVE_ROOT: dir,
      LIVE_DOC: 'DOC.md',
      LIVE_MSG: 'docs: e2e flip',
      LIVE_REPLACE_FILE: replaceFile,
      LIVE_KEEP_CLOSED_ROW: '1',
      ...extraEnv,
    },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
    maxBuffer: 64 << 20,
  })
}

const writePairs = (inputs, pairs, name = 'rep.json') => {
  const p = join(inputs, name)
  writeFileSync(p, JSON.stringify(pairs), 'utf8')
  return p
}

// ── 判据层(零 git、零写盘)──────────────────────────────────────────────────────────

test('D0 §22c 接线:留痕判据只许从 lib 出去,本器转出的是同一个函数引用', () => {
  assert.equal(typeof live.recordFlipDrops, 'function')
  assert.equal(live.recordFlipDrops, drop.recordFlipDrops, '本器不得再包一份第二实现')
  assert.equal(typeof live.planDropSelfTestCases, 'function')
  const names = live.planDropSelfTestCases().map((c) => c.name)
  for (const key of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'])
    assert.ok(names.some((n) => n.startsWith(key)), `--self-test 缺 ${key}`)
})

test('D1 ①两形态各入账一次且逐字等值(正例)+ 纯注记/翻回未勾不挑取(反例)', () => {
  const { flips, other } = drop.flipPairsOf([
    { before: FLIP_BEFORE, after: FLIP_AFTER },
    { before: FLIP_BEFORE, after: `${FLIP_BEFORE}〔追加注记〕` },
    { before: FLIP_AFTER, after: FLIP_BEFORE },
    { before: '| 表格 | 行 |', after: '| 表格 | 行2 |' },
  ])
  assert.equal(flips.length, 1)
  assert.equal(other.length, 3)
  const { entries, skipped } = drop.planDropEntries({ flips, ledgerText: '', at: 'T', file: 'DOC.md' })
  assert.equal(skipped.length, 0)
  assert.equal(entries.length, 2)
  assert.equal(entries[0].rowBefore, FLIP_BEFORE, '未勾整行必须逐字入账')
  assert.equal(entries[0].form, 'open')
  assert.equal(entries[1].rowBefore, FLIP_AFTER, '已勾整行必须逐字入账')
  assert.equal(entries[1].form, 'closed')
  assert.equal(entries[0].kind, drop.DROP_KIND, '族名沿用既有 closed-row-reclose-open-form')
  assert.equal(entries[0].seat, drop.DROP_SEAT_DEFAULT)
})

test('D2 ②幂等:同形态已在账(逐字命中)⇒ 零新增;只差一个字符 ⇒ 仍入账(逐字,不是相似)', () => {
  const ledger = JSON.stringify({ at: 'T0', seat: 's', file: 'DOC.md', kind: drop.DROP_KIND, rowBefore: FLIP_BEFORE }) + '\n'
  const same = drop.planDropEntries({ flips: [{ before: FLIP_BEFORE, after: FLIP_AFTER }], ledgerText: ledger, at: 'T', file: 'DOC.md' })
  assert.equal(same.entries.length, 1, 'open 已在册 ⇒ 只补 closed 一条')
  assert.equal(same.entries[0].rowBefore, FLIP_AFTER)
  const diff = drop.planDropEntries({
    flips: [{ before: `${FLIP_BEFORE} `, after: FLIP_AFTER }],
    ledgerText: ledger,
    at: 'T',
    file: 'DOC.md',
  })
  assert.equal(diff.entries.length, 2, '末位多一个空格就是另一行(台账按整行逐字认)')
})

test('D3 ④凭据是"HEAD 有没有被推进":未推进/取不到 ⇒ 零入账且 unjudged', () => {
  const pairs = [{ before: FLIP_BEFORE, after: FLIP_AFTER }]
  const written = []
  const base = { root: '.', doc: 'DOC.md', pairs, io: { append: (p, s) => written.push(s), read: () => '', mkdir: () => {} } }
  const notAdvanced = drop.recordFlipDrops({ ...base, landed: 'a'.repeat(40), parent: 'a'.repeat(40), head: 'a'.repeat(40), ancestor: true })
  assert.equal(notAdvanced.written, 0)
  assert.equal(notAdvanced.unjudged, true)
  const noHead = drop.recordFlipDrops({ ...base, landed: 'a'.repeat(40), parent: 'b'.repeat(40), head: null, ancestor: null })
  assert.equal(noHead.written, 0)
  assert.equal(noHead.unjudged, true)
  const noAncestor = drop.recordFlipDrops({ ...base, landed: 'a'.repeat(40), parent: 'b'.repeat(40), head: 'c'.repeat(40), ancestor: null })
  assert.equal(noAncestor.written, 0)
  assert.equal(noAncestor.unjudged, true)
  assert.equal(written.length, 0, '三种未判定都不得写一个字节')
  const ok = drop.recordFlipDrops({ ...base, landed: 'a'.repeat(40), parent: 'b'.repeat(40), head: 'a'.repeat(40), ancestor: true })
  assert.equal(ok.written, 2, '成对反例:凭据齐 ⇒ 两形态入账')
})

test('D4 ③纯注记改写 ⇒ 零入账(且不读台账、不看 HEAD)', () => {
  const r = drop.recordFlipDrops({
    root: '.',
    doc: 'DOC.md',
    pairs: [{ before: FLIP_BEFORE, after: `${FLIP_BEFORE}〔追加一句注记〕` }],
    landed: 'a'.repeat(40),
    parent: 'b'.repeat(40),
    head: 'a'.repeat(40),
    ancestor: true,
    io: { read: () => { throw new Error('不该被调用') }, append: () => { throw new Error('不该被调用') }, mkdir: () => {} },
  })
  assert.equal(r.written, 0)
  assert.equal(r.ok, true)
  assert.equal(r.unjudged, false)
  assert.equal(r.lines[0].level, 'info')
})

test('D5 ⑤台账写不进/读不到 ⇒ unjudged + 大声点名(绝不静默跳过)', () => {
  const pairs = [{ before: FLIP_BEFORE, after: FLIP_AFTER }]
  const common = { root: '.', doc: 'DOC.md', pairs, landed: 'a'.repeat(40), parent: 'b'.repeat(40), head: 'a'.repeat(40), ancestor: true }
  const noWrite = drop.recordFlipDrops({ ...common, io: { read: () => '', append: () => { throw new Error('EACCES') }, mkdir: () => {} } })
  assert.equal(noWrite.unjudged, true)
  assert.equal(noWrite.written, 0)
  assert.ok(noWrite.lines.some((l) => l.level === 'error' && l.text.includes('未判定')))
  const noRead = drop.recordFlipDrops({
    ...common,
    io: { read: () => { throw new Error('EISDIR: 台账位是个目录') }, append: () => { throw new Error('不该被调用') }, mkdir: () => {} },
  })
  assert.equal(noRead.unjudged, true)
  assert.equal(noRead.written, 0)
})

// ── 端到端(真器 + LIVE_ROOT 换仓;真账只读计数)──────────────────────────────────────

test('D6 ①端到端:翻勾落地后两形态逐字入账;真账行数 before == after(零污染)', (t) => {
  const realBefore = realLedgerCount()
  const { dir, inputs } = makeRepo(t)
  const rep = writePairs(inputs, [{ before: FLIP_BEFORE, after: FLIP_AFTER }])
  const r = runLive(dir, rep)
  assert.equal(r.status, 0, `应成功:${r.stdout}|${r.stderr}`)
  assert.match(r.stdout, /CAS 成功/)
  assert.match(r.stdout, /结清留痕 2 条已入账/)
  // 位置断言:入账那一刻内容已在 HEAD(留痕排在落地成功之后)。落盘走对象空间 ⇒ 读 HEAD 面,不读工作树。
  const now = norm(runGit(dir, ['show', 'HEAD:DOC.md']))
  assert.ok(now.includes(FLIP_AFTER), '内容必须已落地')
  const es = entriesOf(dir)
  assert.equal(es.length, 2)
  assert.deepEqual(
    es.map((e) => e.rowBefore).sort(),
    [FLIP_AFTER, FLIP_BEFORE].sort(),
    '两形态各入账一次且逐字等值',
  )
  for (const e of es) {
    assert.equal(e.file, 'DOC.md')
    assert.equal(e.kind, drop.DROP_KIND)
    assert.equal(typeof e.at, 'string')
    assert.equal(e.seat, drop.DROP_SEAT_DEFAULT)
  }
  assert.equal(realLedgerCount(), realBefore, 'LIVE_ROOT 换仓 ⇒ 真账一个字节都不许动')
})

test('D7 ②端到端幂等:open 形态已在账 ⇒ 只追 closed 一条,且重跑不改已落地内容', (t) => {
  const realBefore = realLedgerCount()
  const { dir, inputs } = makeRepo(t)
  mkdirSync(join(dir, '.ihui-agent', 'state'), { recursive: true })
  writeFileSync(
    join(dir, '.ihui-agent', 'state', 'plan-row-drop.jsonl'),
    JSON.stringify({ at: '2026-10-26T00:00:00.000Z', seat: 'chair', file: 'DOC.md', kind: drop.DROP_KIND, rowBefore: FLIP_BEFORE }) + '\n',
    'utf8',
  )
  const rep = writePairs(inputs, [{ before: FLIP_BEFORE, after: FLIP_AFTER }])
  const r = runLive(dir, rep)
  assert.equal(r.status, 0, `应成功:${r.stdout}|${r.stderr}`)
  const es = entriesOf(dir)
  assert.equal(es.length, 2, '原来 1 条 + 只补 closed 1 条')
  assert.equal(es.filter((e) => e.rowBefore === FLIP_BEFORE).length, 1, '不重复追加')
  assert.equal(es.filter((e) => e.rowBefore === FLIP_AFTER).length, 1)
  // 重跑同一声明:before 已不在 HEAD ⇒ 工具拒落(0 命中),台账不再增长
  const r2 = runLive(dir, rep)
  assert.equal(r2.status, 1, '重跑必须被 replace-not-found 拦住')
  assert.equal(entriesOf(dir).length, 2)
  assert.equal(realLedgerCount(), realBefore)
})

test('D8 ④端到端:落地失败(before 不在 HEAD)⇒ 零入账,且不产生台账文件', (t) => {
  const realBefore = realLedgerCount()
  const { dir, inputs } = makeRepo(t)
  const headBefore = norm(runGit(dir, ['rev-parse', 'HEAD'])).trim()
  const rep = writePairs(inputs, [{ before: '- [ ] **不存在**:行。', after: FLIP_AFTER }])
  const r = runLive(dir, rep)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /在 HEAD 版里找不到/)
  assert.equal(norm(runGit(dir, ['rev-parse', 'HEAD'])).trim(), headBefore, '拒绝时 HEAD 必须原地不动')
  assert.equal(existsSync(join(dir, '.ihui-agent', 'state', 'plan-row-drop.jsonl')), false, '零入账')
  assert.equal(realLedgerCount(), realBefore)
})

test('D9 ③端到端:纯注记改写 ⇒ 零入账(该形状不在留痕射程)', (t) => {
  const { dir, inputs } = makeRepo(t)
  const rep = writePairs(inputs, [{ before: FLIP_BEFORE, after: `${FLIP_BEFORE}〔追加一句注记〕` }])
  const r = runLive(dir, rep)
  assert.equal(r.status, 0, `应成功:${r.stdout}|${r.stderr}`)
  assert.match(r.stdout, /零入账/)
  assert.equal(existsSync(join(dir, '.ihui-agent', 'state', 'plan-row-drop.jsonl')), false)
})

test('D10 ⑤端到端:台账取不到 ⇒ 大声未判定 + exit 2,内容仍已落地(不谎报没落地)', (t) => {
  const realBefore = realLedgerCount()
  const { dir, inputs } = makeRepo(t)
  // 台账位被一个**目录**占住 ⇒ 读它必 EISDIR(不是 ENOENT,故不是"新建仓空集")
  mkdirSync(join(dir, '.ihui-agent', 'state', 'plan-row-drop.jsonl'), { recursive: true })
  const headBefore = norm(runGit(dir, ['rev-parse', 'HEAD'])).trim()
  const rep = writePairs(inputs, [{ before: FLIP_BEFORE, after: FLIP_AFTER }])
  const r = runLive(dir, rep)
  assert.equal(r.status, 2, `未判定必须非零:${r.stdout}|${r.stderr}`)
  assert.match(r.stderr, /结清留痕未判定/)
  assert.match(r.stderr, /内容已落地/)
  assert.match(r.stdout, /CAS 成功/)
  assert.notEqual(norm(runGit(dir, ['rev-parse', 'HEAD'])).trim(), headBefore, '内容确实已落地')
  assert.equal(realLedgerCount(), realBefore)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


test('D8 默认结清即删(2026-10-28):只入未勾一条,该行整行消失(两形态路径由 D6/D7 走回退开关覆盖)', (t) => {
  const { dir, inputs } = makeRepo(t)
  const rep = writePairs(inputs, [{ before: FLIP_BEFORE, after: FLIP_AFTER }])
  const r = runLive(dir, rep, { LIVE_KEEP_CLOSED_ROW: '' })
  assert.equal(r.status, 0, '应成功:' + r.stdout + '|' + r.stderr)
  assert.match(r.stdout, /结清即删:1 项/, '必须出声说明这一项被转成删除档')
  const now = norm(runGit(dir, ['show', 'HEAD:DOC.md']))
  assert.ok(!now.includes(FLIP_AFTER), '面上不得出现已勾形态(否则又会变成跨枚滞留)')
  assert.ok(!now.includes(FLIP_BEFORE), '原未勾行也必须删除')
  const es = entriesOf(dir)
  assert.equal(es.length, 1, '只入未勾一条')
  assert.equal(es[0].rowBefore, FLIP_BEFORE)
  assert.equal(es[0].form, 'dropped', '结清即删的终态是"删掉",不是"翻勾前的旧形态"')
})

test('D11 删除档必须把形态标成 dropped(不得与翻勾前像的 open 同值)—— 2026-10-29 实测:同值时复洁器的题面指纹通道拿不到它,而守门 71 插回的是它自己采集的另一份字节形态 ⇒ 逐字通道对不上 ⇒ 摘一次回一次', () => {
  const rows = drop.rowsToRecordOf(
    [{ before: '- [ ] Z-9 翻勾票', after: '- [x] ✅(2026-10-29) Z-9 翻勾票' }],
    [{ before: '- [ ] Z-8 删除票' }],
  )
  const flip = rows.filter((r) => r.rowBefore.includes('翻勾票'))
  const dpr = rows.filter((r) => r.rowBefore.includes('删除票'))
  assert.equal(flip.length, 2, '翻勾仍是两形态(open + closed)')
  assert.deepEqual(
    flip.map((r) => r.form),
    ['open', 'closed'],
  )
  assert.equal(dpr.length, 1, '删除档只入被删那一条')
  assert.equal(
    dpr[0].form,
    'dropped',
    '被删的行不能标成 open —— 那与"翻勾前的旧形态"在账面上不可区分',
  )
})
