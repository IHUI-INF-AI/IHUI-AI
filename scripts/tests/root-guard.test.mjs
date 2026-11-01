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

// ── ⑥ 候选面判定(2026-11-01 治部署环自锁那一格)────────────────────────
// 纪律:判据只住源脚本一份,本文件 import __test__(§22c)。
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const RG_CLI = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'root-guard.mjs')
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const git = (...a) =>
  execFileSync('git', a.flat(), {
    cwd: ROOT,
    encoding: 'utf8',
    // §12g:本机派生 git 必须显式接管 stdio(不写稳定 EBUSY),绝对路径不是豁免。
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }).trim()

test('⑥ 候选面取不到一律 unknown —— 没判成绝不读成放行', () => {
  for (const rev of ['', 'abc123', '0'.repeat(40), git('rev-list', '--max-parents=0', 'HEAD')]) {
    const r = rg.checkAgainstRev({ rev })
    assert.equal(
      r.verdict,
      'unknown',
      `rev=${String(rev).slice(0, 12)} 实得 ${r.verdict}(应为未判定)`,
    )
    assert.ok(r.why, `unknown 却没点名原因(rev=${String(rev).slice(0, 12)})`)
    assert.equal(r.targets.length, 0, 'unknown 档不得带着目标清单出场')
  }
})

test('⑥b 候选面清单形态坏(空 targets / 坏 JSON)⇒ unknown,不枚举 0 判绿', () => {
  const a = rg.checkAgainstRev({
    rev: '0'.repeat(40),
    readText: () => '{"version":1,"targets":[]}',
  })
  assert.equal(a.verdict, 'unknown')
  assert.match(a.why, /targets 必须是非空数组|形态坏/)
  const b = rg.checkAgainstRev({ rev: '0'.repeat(40), readText: () => '{ 坏' })
  assert.equal(b.verdict, 'unknown')
  assert.match(b.why, /不是合法 JSON|形态坏/)
})

test('⑥c 真面判定与清单同轮同面:pass 的充要条件是每条 actual==expected', () => {
  // 这一例刻意**不**断言某个具体 rev 一定绿 —— 那会让用例跟着他席改规则文件漂(§12e 同型)。
  // 它锁的是判据本身:结论必须逐条来自那一面,且 pass 不许建立在"没读到"上。
  const head = git('rev-parse', 'HEAD')
  const r = rg.checkAgainstRev({ rev: head })
  const manifest = rg.loadManifest(git('show', `${head}:scripts/data/root-guard-manifest.json`))
  assert.equal(r.rev, head)
  assert.equal(
    r.targets.length,
    manifest.targets.length,
    `判的目标数(${r.targets.length})与那一面的清单条数(${manifest.targets.length})不同 ⇒ 不同轮不同面`,
  )
  if (r.verdict === 'pass') {
    for (const t of r.targets) assert.equal(t.actual, t.expected, `${t.id} 哈希不一致却报 pass`)
  } else if (r.verdict === 'fail') {
    const bad = r.targets.filter((t) => t.state === 'fail')
    assert.ok(bad.length > 0, 'verdict=fail 却一条 fail 都点不出')
    for (const t of bad)
      assert.ok(t.actual && t.actual !== t.expected, `${t.id} 判 fail 却没给出该面的实际哈希`)
  } else {
    assert.ok(r.why || r.targets.some((t) => t.state === 'unknown'), 'unknown 档必须点名取不到什么')
  }
})

test('⑥d §12e 反向对照:当前面绿时,候选面读不到也不得新增红', () => {
  const run = (args) =>
    spawnSync(process.execPath, [RG_CLI, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  const plain = run(['--check'])
  if (plain.status !== 0) {
    // 当前面本来就红(他席改了规则文件没重封)⇒ 这一例的前提不成立,如实报"本轮不适用",不冒充通过
    assert.fail(
      `当前面已判红(rc=${plain.status})⇒ ⑥d 的前置"绿轮零额外开销"无从验;先重封再跑本例:${plain.stdout.split('\n')[1] ?? ''}`,
    )
  }
  const withBadCand = run(['--check', '--against-rev', 'deadbeef'])
  assert.equal(
    withBadCand.status,
    0,
    `当前面绿而候选 rev 形态坏 ⇒ 必须仍是 0(不因候选面新增红),实得 rc=${withBadCand.status}`,
  )
  assert.ok(!/候选面复核/.test(withBadCand.stderr), '当前面绿时不该出现候选面放行的任何输出')
})

test('⑥f 反向对照:候选面自己不自洽(改了规则文件却没重封清单)⇒ 绝不放行', () => {
  const head = git('rev-parse', 'HEAD')
  const good = rg.loadManifest(git('show', `${head}:scripts/data/root-guard-manifest.json`))
  const tampered = {
    ...good,
    targets: good.targets.map((t, i) => (i === 0 ? { ...t, sha256: 'f'.repeat(64) } : t)),
  }
  const r = rg.checkAgainstRev({ rev: head, readText: () => JSON.stringify(tampered) })
  assert.equal(
    r.verdict,
    'fail',
    `候选面自己不一致却读出 ${r.verdict}(这一格被放出去就是"把没重封的规则文件部署上线")`,
  )
  assert.equal(rg.decideRelease({ currentVerdict: 'fail', candidate: r }).release, false)
})

test('⑥g 放行裁决的真值表(四档,缺一档就是判据没判完)', () => {
  const passCand = { verdict: 'pass', rev: 'a'.repeat(40) }
  const failCand = { verdict: 'fail', rev: 'a'.repeat(40) }
  const unknownCand = { verdict: 'unknown', rev: '', why: '取不到' }
  const d = rg.decideRelease
  assert.equal(d({ currentVerdict: 'pass', candidate: null }).release, true, '当前面绿本就该照常放')
  assert.equal(
    d({ currentVerdict: 'pass', candidate: null }).loud,
    false,
    '绿轮不该出现跨面放行的噪声',
  )
  assert.equal(
    d({ currentVerdict: 'fail', candidate: passCand }).release,
    true,
    '当前红+候选绿 ⇒ 必须放(否则就是 44 轮自锁)',
  )
  assert.equal(
    d({ currentVerdict: 'fail', candidate: passCand }).loud,
    true,
    '放行必须大声,不能静默翻绿',
  )
  assert.equal(
    d({ currentVerdict: 'fail', candidate: failCand }).release,
    false,
    '候选面自己红 ⇒ 维持 fail-closed',
  )
  assert.equal(
    d({ currentVerdict: 'fail', candidate: unknownCand }).release,
    false,
    '候选面取不到 ⇒ 不猜(§0.3)',
  )
  assert.equal(
    d({ currentVerdict: 'fail', candidate: null }).release,
    false,
    '未要求跨面复核时维持原判',
  )
  assert.equal(
    d({ currentVerdict: 'unknown', candidate: passCand }).release,
    false,
    '当前面未判定绝不借他面翻绿',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
