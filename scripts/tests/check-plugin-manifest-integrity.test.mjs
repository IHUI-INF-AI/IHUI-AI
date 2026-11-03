// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:判据一律 import 门体的 `__test__`(AGENTS §22c),本文件不复制任何判据常量。
// 立的因:G-21 半腿 —— 已装插件面的逐文件完整性台账(`InstallRecord.fileDigests`)↔ 盘上现状对账。
// 重点锁死的一条:老记录(没有该字段)**既不判 ok 也不判 drift** —— 把"升级前本来没台账"
// 说成"被篡改"或说成"已核对",两边都是假结论。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as gate } from '../check-plugin-manifest-integrity.mjs'

const {
  LEDGER_FIELD,
  resolvePluginsRoot,
  readRegistry,
  usableRecordName,
  ledgerOf,
  walkInstallRoot,
  judgeRecord,
  reconcile,
  driftKeyOf,
  parseBaseline,
  applyRatchet,
  loadBaseline,
  main,
  fixture,
} = gate
const { digestOf, writeFixtureRoot, fakeFsa } = fixture

const sha = (body) => digestOf({ x: body })[0].sha256
const joinOf = (...parts) => join(...parts)
const mkdirOf = (p) => mkdirSync(p, { recursive: true })
const writeOf = (p, text) => writeFileSync(p, text)

/** 一面之内的逐文件快照(路径 → 内容):P12 用它证明对账器纯只读。 */
function snapshot(root) {
  const out = {}
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, ent.name)
      const rel = relative(root, abs).split(sep).join('/')
      const st = statSync(abs)
      if (st.isDirectory()) walk(abs)
      else out[rel] = { bytes: st.size, mtimeMs: st.mtimeMs }
    }
  }
  walk(root)
  return out
}

test('P1 台账与盘上一致 ⇒ verdict=ok,记录逐条点名而不并桶', () => {
  const scratch = mkScratch('plugin-integrity-P1-')
  try {
    const files = { 'plugin.json': 'p', 'lib/a.js': 'A' }
    const root = writeFixtureRoot(scratch + '/ok', { p1: files }, [
      { name: 'p1', [LEDGER_FIELD]: digestOf(files) },
    ])
    const r = reconcile(readRegistry(root).records, root)
    assert.equal(r.verdict, 'ok')
    assert.equal(r.counts.ok, 1)
    assert.equal(r.counts.drift, 0)
    assert.equal(r.counts.unjudged, 0)
    assert.deepEqual(r.driftItems, [])
  } finally {
    rmScratch(scratch)
  }
})

test('P2 老记录(无 fileDigests 键)⇒ unjudged + pending,既不 ok 也不 drift', () => {
  const scratch = mkScratch('plugin-integrity-P2-')
  try {
    // 盘上一切正常,唯一区别 = 这条记录是接线之前写的
    const root = writeFixtureRoot(scratch + '/legacy', { p1: { 'plugin.json': 'x' } }, [
      { name: 'p1', sourceType: 'local', installedAt: '2026-01-01T00:00:00.000Z' },
    ])
    const r = reconcile(readRegistry(root).records, root)
    assert.equal(r.judged[0].state, 'unjudged', '老记录绝不判成 ok')
    assert.equal(r.judged[0].pending, true)
    assert.equal(r.judged[0].reason, 'ledger-field-absent')
    assert.equal(r.verdict, 'unjudged', '整面绝不因"没台账"记绿')
    assert.equal(r.counts.drift, 0, '老记录也绝不判成 drift(那等于说升级前被篡改)')
    assert.equal(r.counts.ok, 0)
    assert.deepEqual(r.driftItems, [])
    // 字段显式为 null 与字段缺席同判(都是"没有台账",不是"台账为空")
    assert.equal(ledgerOf({ name: 'p1', [LEDGER_FIELD]: null }).reason, 'ledger-field-absent')
    assert.equal(ledgerOf({ name: 'p1' }).pending, true)
  } finally {
    rmScratch(scratch)
  }
})

test('P3 drift 三子类分开点名:同一面三类同时命中时三个计数各自成立', () => {
  const scratch = mkScratch('plugin-integrity-P3-')
  try {
    const ledgerFiles = { 'plugin.json': 'A', 'lib/gone.js': 'G', 'lib/keep.js': 'K' }
    const root = writeFixtureRoot(
      scratch + '/three',
      { p1: { 'plugin.json': 'B', 'lib/keep.js': 'K', 'lib/extra.js': 'E' } },
      [{ name: 'p1', [LEDGER_FIELD]: digestOf(ledgerFiles) }],
    )
    const r = reconcile(readRegistry(root).records, root)
    const j = r.judged[0]
    assert.equal(r.verdict, 'drift')
    assert.deepEqual(
      { mismatch: j.counts.mismatch, missing: j.counts.missing, unlisted: j.counts.unlisted },
      { mismatch: 1, missing: 1, unlisted: 1 },
      '三类不得并成一个"漂移数"',
    )
    assert.deepEqual(
      j.mismatch.map((m) => m.path),
      ['plugin.json'],
    )
    assert.equal(j.mismatch[0].changed, true)
    assert.deepEqual(j.missing, ['lib/gone.js'])
    assert.deepEqual(j.unlisted, ['lib/extra.js'])
    // 漂移身份键含类别维 ⇒ 同一路径的两种命运不会互相顶掉
    const keys = new Set(r.driftItems)
    assert.equal(keys.size, 3)
    assert.ok(keys.has(driftKeyOf('p1', 'mismatch', 'plugin.json')))
  } finally {
    rmScratch(scratch)
  }
})

test('P4 记录说装着、目录整个没了 ⇒ drift/missing 全量(不是 unjudged)', () => {
  const scratch = mkScratch('plugin-integrity-P4-')
  try {
    const root = writeFixtureRoot(scratch + '/gone', {}, [
      { name: 'p1', [LEDGER_FIELD]: digestOf({ 'plugin.json': 'x', 'lib/a.js': 'A' }) },
    ])
    const j = reconcile(readRegistry(root).records, root).judged[0]
    assert.equal(j.state, 'drift')
    assert.equal(j.reason, 'install-dir-absent')
    assert.deepEqual(j.missing, ['lib/a.js', 'plugin.json'])
    assert.equal(j.counts.mismatch, 0)
  } finally {
    rmScratch(scratch)
  }
})

test('P5 档形不对(安装路径躺着文件)⇒ unjudged,绝不冒 drift/ok', () => {
  const scratch = mkScratch('plugin-integrity-P5-')
  try {
    const root = writeFixtureRoot(joinOf(scratch, 'notdir'), {}, [
      { name: 'p1', [LEDGER_FIELD]: digestOf({ 'plugin.json': 'abc' }) },
    ])
    writeOf(joinOf(root, 'p1'), 'not a directory')
    const r = reconcile(readRegistry(root).records, root)
    assert.equal(r.judged[0].state, 'unjudged')
    assert.equal(r.judged[0].reason, 'install-dir-not-directory')
    assert.equal(r.verdict, 'unjudged')
    assert.equal(r.counts.drift, 0)
  } finally {
    rmScratch(scratch)
  }
})

test('P6 台账形状坏 / 越根路径 ⇒ unjudged(坏行不冒充 drift 也不冒充 ok)', () => {
  const bad = [
    [{ path: '../../../../etc/passwd', sha256: sha('x'), bytes: 1 }],
    [{ path: 'C:/Windows/win.ini', sha256: sha('x'), bytes: 1 }],
    [{ path: './plugin.json', sha256: sha('x'), bytes: 1 }],
    [{ path: 'a.js', sha256: 'not-hex', bytes: 1 }],
    [{ path: 'a.js', sha256: sha('x') }],
    [{ sha256: sha('x'), bytes: 1 }],
    [],
  ]
  for (const value of bad) {
    const v = ledgerOf({ name: 'p1', [LEDGER_FIELD]: value })
    assert.equal(v.ok, false, `该形态必须判坏:${JSON.stringify(value)}`)
    assert.equal(v.reason, 'ledger-entry-malformed')
    assert.equal(v.pending, undefined, '形状坏不是"老记录",不得挂 pending')
  }
  // 好形态:嵌套 POSIX 路径与反斜杠形态都归一成 POSIX 相对形
  const okView = ledgerOf({
    name: 'p1',
    [LEDGER_FIELD]: [{ path: 'lib/deep/a.js', sha256: sha('A'), bytes: 1 }],
  })
  assert.equal(okView.ok, true)
  assert.deepEqual(okView.entries, [{ path: 'lib/deep/a.js', sha256: sha('A'), bytes: 1 }])
})

test('P7 记录名含穿越形态 ⇒ 逐条 unjudged,且不参与"多出未登记"计数', () => {
  const scratch = mkScratch('plugin-integrity-P7-')
  try {
    const root = writeFixtureRoot(scratch + '/names', { p1: { 'plugin.json': 'x' } }, [])
    const r = reconcile(
      [
        { name: '../evil', [LEDGER_FIELD]: digestOf({ 'a.js': 'A' }) },
        { name: '', [LEDGER_FIELD]: digestOf({ 'a.js': 'A' }) },
        { name: 'a/b', [LEDGER_FIELD]: digestOf({ 'a.js': 'A' }) },
      ],
      root,
    )
    assert.equal(r.counts.unjudged, 3)
    assert.equal(r.counts.drift, 0)
    assert.equal(r.counts.unlisted, 0, '名字不可用的记录不得被算成"多出未登记文件"')
    assert.equal(r.verdict, 'unjudged')
    assert.equal(r.judged[0].reason, 'record-name-unpathable')
    assert.equal(r.judged[1].reason, 'record-name-unusable')
    for (const bad of ['.', '..', 'a\u0000b']) assert.equal(usableRecordName(bad).ok, false)
    assert.equal(usableRecordName('well-formed-name').ok, true)
  } finally {
    rmScratch(scratch)
  }
})

test('P8 台账整面取不到 ⇒ 四种 reason 各自点名;枚举到 0 条不记绿', () => {
  const scratch = mkScratch('plugin-integrity-P8-')
  try {
    const emptyRoot = joinOf(scratch, 'no-registry')
    mkdirOf(emptyRoot)
    assert.equal(readRegistry(emptyRoot).reason, 'registry-unreadable')
    const badRoot = joinOf(scratch, 'bad-json')
    mkdirOf(badRoot)
    writeOf(joinOf(badRoot, 'registry.json'), '{ not json')
    assert.equal(readRegistry(badRoot).reason, 'registry-json-invalid')
    const noArr = joinOf(scratch, 'no-records')
    mkdirOf(noArr)
    writeOf(joinOf(noArr, 'registry.json'), '{"version":1}')
    assert.equal(readRegistry(noArr).reason, 'registry-records-missing')
    const r0 = reconcile([], emptyRoot)
    assert.equal(r0.verdict, 'unjudged', '0 条记录 = 没判,不是绿')
    assert.equal(r0.reason, 'no-install-records')
  } finally {
    rmScratch(scratch)
  }
})

test('P9 链接判据(注入缝,跨平台确定):不跟随、不点货;登记路径上是链接 ⇒ unjudged', () => {
  const pluginsRoot = joinOf('G:', 'fake', 'installed-plugins')
  const rootAbs = joinOf(pluginsRoot, 'p1')
  const ledger = [{ path: 'plugin.json', sha256: sha('x'), bytes: 1 }]

  const a = fakeFsa(rootAbs, {
    entries: [
      { path: 'plugin.json', kind: 'file', body: 'x' },
      { path: 'evil-link.txt', kind: 'symlink' },
    ],
  })
  const ja = judgeRecord({ name: 'p1', [LEDGER_FIELD]: ledger }, pluginsRoot, a)
  assert.equal(ja.state, 'drift')
  assert.deepEqual(ja.unlisted, ['evil-link.txt'])
  assert.deepEqual(ja.unlistedSymlinks, ['evil-link.txt'])
  assert.equal(ja.counts.mismatch, 0)
  assert.ok(!a.reads.includes('evil-link.txt'), '链接本体被读了 = 跟随了,判据失效')
  assert.ok(a.reads.includes('plugin.json'), '常规文件必须被读到(防"整面没读却报一致")')

  const b = fakeFsa(rootAbs, { entries: [{ path: 'plugin.json', kind: 'symlink' }] })
  const jb = judgeRecord({ name: 'p1', [LEDGER_FIELD]: ledger }, pluginsRoot, b)
  assert.equal(jb.state, 'unjudged')
  assert.equal(jb.reason, 'registered-path-is-symlink')
  assert.equal(b.reads.length, 0)

  const c = fakeFsa(rootAbs, {
    entries: [
      { path: 'sub', kind: 'dir' },
      { path: 'sub/x.js', kind: 'file', body: 'X' },
    ],
    escape: ['sub'],
  })
  const jc = judgeRecord(
    { name: 'p1', [LEDGER_FIELD]: digestOf({ 'sub/x.js': 'X' }) },
    pluginsRoot,
    c,
  )
  assert.equal(jc.state, 'unjudged')
  assert.equal(jc.reason, 'install-dir-unreadable')
  assert.equal(jc.errno, 'junction-escape')
})

test('P10 差值棘轮:基线全覆盖 ⇒ new=0;基线少一枚 ⇒ new=1;不给基线 ⇒ new=null', () => {
  const scratch = mkScratch('plugin-integrity-P10-')
  try {
    const root = writeFixtureRoot(
      scratch + '/ratchet',
      { p1: { 'plugin.json': 'changed', 'evil.js': 'e' } },
      [{ name: 'p1', [LEDGER_FIELD]: digestOf({ 'plugin.json': 'orig' }) }],
    )
    const r = reconcile(readRegistry(root).records, root)
    const items = r.driftItems
    assert.equal(items.length, 2)
    const all = applyRatchet(r, parseBaseline(JSON.stringify({ version: 1, driftKeys: items })))
    assert.equal(all.mode, 'judged')
    assert.equal(all.new, 0)
    assert.equal(all.stock, 2)
    const one = applyRatchet(
      r,
      parseBaseline(JSON.stringify({ version: 1, driftKeys: items.slice(1) })),
    )
    assert.equal(one.new, 1)
    assert.equal(one.stock, 1)
    const none = applyRatchet(r, null)
    assert.equal(none.mode, 'absent')
    assert.equal(none.new, null, '不给基线时不得拿 0 冒充"没有新增"')
    for (const badText of ['{oops', '{"version":1}', '{"driftKeys":[1]}']) {
      assert.equal(parseBaseline(badText).ok, false)
      assert.equal(applyRatchet(r, parseBaseline(badText)).mode, 'unjudged')
    }
    assert.equal(loadBaseline(scratch + '/no-such-file.json').ok, false)
  } finally {
    rmScratch(scratch)
  }
})

test('P11 装机根取值序与写侧 paths.ts 同源:IHUI_HOME > HOME > USERPROFILE,--plugins-root 覆盖', () => {
  const scratch = mkScratch('plugin-integrity-P11-')
  try {
    assert.equal(
      resolvePluginsRoot({ IHUI_HOME: scratch + '/iH', HOME: scratch + '/h' }).root,
      joinOf(scratch, 'iH', '.ihui', 'installed-plugins'),
    )
    assert.equal(
      resolvePluginsRoot({ HOME: scratch + '/h', USERPROFILE: scratch + '/u' }).root,
      joinOf(scratch, 'h', '.ihui', 'installed-plugins'),
    )
    assert.equal(
      resolvePluginsRoot({ USERPROFILE: scratch + '/u' }).root,
      joinOf(scratch, 'u', '.ihui', 'installed-plugins'),
    )
    const ov = resolvePluginsRoot({}, scratch + '/given')
    assert.equal(ov.source, '--plugins-root')
  } finally {
    rmScratch(scratch)
  }
})

test('P12 只读性:跑完整 CLI 一轮,装机根面一个字节都没被改动', () => {
  const scratch = mkScratch('plugin-integrity-P12-')
  try {
    const files = { 'plugin.json': 'A' }
    const root = writeFixtureRoot(scratch + '/readonly', { p1: files }, [
      { name: 'p1', [LEDGER_FIELD]: digestOf({ 'plugin.json': 'B' }) },
    ])
    const before = snapshot(root)
    const rc = main(['--plugins-root', root])
    assert.equal(rc, 1, '盘上与台账不等 ⇒ drift(退出码 1)')
    assert.deepEqual(snapshot(root), before, '对账器必须纯只读:不得新增/删除/改写任何文件')
    // --print-baseline 也只打到 stdout,不落盘
    const rc2 = main(['--plugins-root', root, '--print-baseline'])
    assert.equal(rc2, 1)
    assert.deepEqual(snapshot(root), before, '--print-baseline 也不得写盘')
  } finally {
    rmScratch(scratch)
  }
})

test('P13 未知参数不静默忽略 ⇒ 未判定(§0.3);--staged 被接受且判序同全量档', () => {
  const scratch = mkScratch('plugin-integrity-P13-')
  try {
    const root = writeFixtureRoot(scratch + '/args', { p1: { 'plugin.json': 'x' } }, [
      { name: 'p1', [LEDGER_FIELD]: digestOf({ 'plugin.json': 'x' }) },
    ])
    assert.equal(main(['--plugins-root', root, '--nonsense']), 2, '未知参数 ⇒ 未判定,不冒充判过')
    assert.equal(main(['--plugins-root', root]), 0)
    assert.equal(
      main(['--plugins-root', root, '--staged']),
      0,
      '--staged 与全量档同一把尺(判机器装机态,无仓内取材面)',
    )
    assert.equal(
      main(['--plugins-root', root, '--name', 'nope']),
      2,
      '点名一个不存在的记录 ⇒ 未判定',
    )
  } finally {
    rmScratch(scratch)
  }
})

test('P14 walkInstallRoot 永不返回"部分清单":熔断/读不动一律整面 unjudged', () => {
  const rootAbs = 'G:/fake/installed-plugins/p1'
  const entries = [{ path: 'plugin.json', kind: 'file', body: 'x' }]
  const boom = fakeFsa(rootAbs, { entries })
  boom.readdirSync = () => {
    throw Object.assign(new Error('EACCES'), { code: 'EACCES' })
  }
  const w = walkInstallRoot(rootAbs, boom)
  assert.equal(w.ok, false)
  assert.equal(w.reason, 'install-dir-unreadable')
  assert.equal(w.errno, 'EACCES')
  assert.equal(w.files, undefined, '读不动时不得带回任何"已读到的"残档冒充枚举完成')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
