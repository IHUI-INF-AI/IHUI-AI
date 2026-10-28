// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `root-guard.mjs` 镜像测试(§22c:判据 import 源脚本 __test__,本文件零复制判据)。
 * 钉四环:① 规范化哈希(CRLF/BOM 不制造伪漂移);② 段抽取止于下一二级标题、缺锚点返回 null;
 * ③ 判定三态(改动判红 / 绑定新哈希的人工解锁放行 / 解锁后再改重判红 / 取不到判未判定);
 * ④ 清单形状锁 + 退出码映射。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __test__ as rg } from '../root-guard.mjs'

const MD = '# t\n\n## 0. 全局铁律(先读,跨节通用)\nA\nB\n\n## 1. 其它\nC\n'

test('① 规范化:CRLF 与 BOM 不制造伪漂移', () => {
  assert.equal(rg.sha256Of('a\r\nb'), rg.sha256Of('a\nb'))
  assert.equal(rg.sha256Of('\ufeffa'), rg.sha256Of('a'))
  assert.equal(rg.sha256Of('a\n\n\n'), rg.sha256Of('a\n'))
})

test('② 段抽取:止于下一个二级标题,缺锚点返回 null', () => {
  assert.equal(rg.extractSection(MD), '## 0. 全局铁律(先读,跨节通用)\nA\nB\n')
  assert.equal(rg.extractSection('## 1. x\n'), null)
})

test('③ 判定三态 + 解锁绑定新哈希', () => {
  const manifest = {
    targets: [
      { id: 'f', path: 'f.mjs', mode: 'file', sha256: rg.sha256Of('good') },
      {
        id: 's',
        path: 'AGENTS.md',
        mode: 'section',
        start: '## 0. 全局铁律',
        sha256: rg.sha256Of(rg.extractSection(MD)),
      },
    ],
  }
  const read = (files) => (p) => {
    const k = String(p).replace(/\\/g, '/').split('/').pop()
    if (!(k in files)) throw new Error('ENOENT')
    return files[k]
  }
  assert.equal(
    rg.checkAll({ manifest, readFile: read({ 'f.mjs': 'good', 'AGENTS.md': MD }), root: '/r' })
      .verdict,
    'pass',
  )
  const drift = rg.checkAll({
    manifest,
    readFile: read({ 'f.mjs': 'bad', 'AGENTS.md': MD }),
    root: '/r',
  })
  assert.equal(drift.verdict, 'fail')
  const unlocks = [
    {
      id: 'f',
      sha256: rg.sha256Of('bad'),
      reason: 'reviewed',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  ]
  const unlocked = rg.checkAll({
    manifest,
    readFile: read({ 'f.mjs': 'bad', 'AGENTS.md': MD }),
    root: '/r',
    unlocks,
  })
  assert.equal(unlocked.verdict, 'pass')
  assert.equal(unlocked.targets[0].state, 'unlocked')
  const again = rg.checkAll({
    manifest,
    readFile: read({ 'f.mjs': 'bad2', 'AGENTS.md': MD }),
    root: '/r',
    unlocks,
  })
  assert.equal(again.verdict, 'fail')
  const gone = rg.checkAll({
    manifest,
    readFile: () => {
      throw new Error('ENOENT')
    },
    root: '/r',
  })
  assert.equal(gone.verdict, 'unknown')
})

test('③b 过期解锁不放行', () => {
  const unlocks = [
    {
      id: 'f',
      sha256: 'x'.repeat(64),
      reason: 'old',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    },
  ]
  assert.equal(rg.activeUnlocks(JSON.stringify({ records: unlocks })).length, 0)
})

test('④ 清单形状锁与退出码映射', () => {
  assert.throws(() => rg.loadManifest('{"targets":[]}'), /非空数组/)
  assert.throws(
    () =>
      rg.loadManifest(
        JSON.stringify({ targets: [{ id: 'a', path: 'p', mode: 'file', sha256: 'short' }] }),
      ),
    /sha256/,
  )
  assert.throws(
    () =>
      rg.loadManifest(
        JSON.stringify({
          targets: [{ id: 'a', path: 'p', mode: 'weird', sha256: 'a'.repeat(64) }],
        }),
      ),
    /mode/,
  )
  assert.equal(rg.exitCodeOf('pass'), 0)
  assert.equal(rg.exitCodeOf('fail'), 1)
  assert.equal(rg.exitCodeOf('unknown'), 2)
})

// —— ⑤ 差面判读(2026-10-29 立:两次 40+ 分钟 fail-closed 都不是"有人改规则",
//    而是清单/工作树/HEAD 三面对不上;旧输出只给两个哈希,读的人只能猜)——
const H = { exp: 'e'.repeat(64), act: 'a'.repeat(64), other: 'o'.repeat(64) }

test('⑤ 工作树==HEAD 而清单绑别份 ⇒ 点名"清单与已入库内容对不上"', () => {
  const s = rg.faceDiagnosis({ expected: H.exp, actual: H.act, head: H.act })
  assert.match(s, /清单与\*\*已入库内容\*\*对不上/)
  assert.match(s, /同枚提交并推送/)
})

test('⑤b 清单==HEAD 而工作树不同 ⇒ 点名"滞后的在飞副本"', () => {
  const s = rg.faceDiagnosis({ expected: H.exp, actual: H.act, head: H.exp })
  assert.match(s, /只有工作树副本不同/)
  assert.match(s, /不要\*\*为它再封一次清单/)
})

test('⑤c 两格判据不得同形(否则等于没判)', () => {
  const a = rg.faceDiagnosis({ expected: H.exp, actual: H.act, head: H.act })
  const b = rg.faceDiagnosis({ expected: H.exp, actual: H.act, head: H.exp })
  assert.notEqual(a, b)
})

test('⑤d HEAD 取不到 ⇒ 显式未判定,不冒充处置建议', () => {
  for (const head of [null, undefined])
    assert.match(rg.faceDiagnosis({ expected: H.exp, actual: H.act, head }), /未判定/)
})

test('⑤e 三面互不相同 ⇒ 交人工,不选边', () => {
  const s = rg.faceDiagnosis({ expected: H.exp, actual: H.act, head: H.other })
  assert.match(s, /三面互不相同/)
})
