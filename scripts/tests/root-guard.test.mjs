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
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as rg, REQUIRED_TARGET_IDS } from '../root-guard.mjs'

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
import { dirname, resolve } from 'node:path'

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
    // advisory 目标(文档面)不一致只告警(warn)、不 fail-closed,故不得拉低 verdict;
    // 只有非 warn 的目标才要求 actual==expected,否则把"文档面被改"误读成"判据漏判"。
    for (const t of r.targets)
      if (t.state !== 'warn')
        assert.equal(t.actual, t.expected, `${t.id} 哈希不一致却报 pass`)
  } else if (r.verdict === 'fail') {
    const bad = r.targets.filter((t) => t.state === 'fail')
    assert.ok(bad.length > 0, 'verdict=fail 却一条 fail 都点不出')
    for (const t of bad)
      assert.ok(t.actual && t.actual !== t.expected, `${t.id} 判 fail 却没给出该面的实际哈希`)
  } else {
    assert.ok(r.why || r.targets.some((t) => t.state === 'unknown'), 'unknown 档必须点名取不到什么')
  }
})

test('⑥d §0.3 反向对照:显式 --against-rev 解不出真值 ⇒ 未判定(rc=2),绝不冒绿', () => {
  const run = (args) =>
    spawnSync(process.execPath, [RG_CLI, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  const plain = run(['--check'])
  if (plain.status !== 0) {
    // 被审面(默认 HEAD)取不到或自锁 ⇒ 这一例的前提不成立,如实报"本轮不适用",不冒充通过
    assert.fail(
      `--check 默认面未绿(rc=${plain.status})⇒ ⑥d 的前置无从验;先确 HEAD 面自洽再跑本例:${plain.stdout.split('\n')[1] ?? ''}`,
    )
  }
  // 新语义:--against-rev 即"被审面"。给它一个解不出 40 位 sha 的劣质 rev ⇒ 取不到那一面
  // ⇒ 未判定(rc=2),而不是因"主面绿"蒙成 0(§0.3:没判成绝不读成放行)。
  const withBadFace = run(['--check', '--against-rev', 'deadbeef'])
  assert.equal(
    withBadFace.status,
    2,
    `显式劣质 rev 被当成被审面却没解成 40 位 sha ⇒ 必须 rc=2(未判定),实得 rc=${withBadFace.status}`,
  )
  assert.ok(/未判定/.test(withBadFace.stderr), '劣质 rev 应点名"未判定",不得静默')
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

/**
 * ⑤ 面一致性(2026-11-03 实测的格子,凌驾于上面四环之上)。
 *
 * `--seal` / `--unlock` 原先绑**工作树**字节哈希,而闸 `--check` 默认量 HEAD blob。共享工作树常年
 * 滞后 HEAD ⇒ "重封"这件事结构上永远追不上闸:实测部署环连冻 47 轮,封出 bf5502484c51(工作树
 * 302,612 B)而闸判 actual=a09208df9396(HEAD 315,034 B),红因文字自己写着"清单 ↔ 工作树 ↔ HEAD
 * 三面里某一面对不上(在另一枚签出/另一时刻 --seal 过)"。现在封与锁都只认被审面,工作树那份不同
 * 就逐条点名(faceNotes),不静默、也不为它封。
 */
const FACE_SHA = 'f'.repeat(64)
const writeManifest = (dir, sha = '0'.repeat(64)) => {
  const p = join(dir, 'root-guard-manifest.json')
  writeFileSync(
    p,
    JSON.stringify({ version: 1, targets: [{ id: 'x', path: 'x.mjs', mode: 'file', sha256: sha }] }),
    'utf8',
  )
  return p
}

test('⑤ 封存绑被审面:写进清单的是 HEAD 面哈希,不是工作树那份', () => {
  const dir = mkScratch('rg-face-')
  try {
    const mp = writeManifest(dir)
    const doc = rg.seal({
      reason: '复核后重封(测试)',
      manifestPath: mp,
      faceHash: () => FACE_SHA,
      readFile: () => '工作树里那份滞后内容',
      root: dir,
    })
    assert.equal(doc.targets[0].sha256, FACE_SHA, '封的必须是注入的"被审面"哈希')
    assert.equal(
      JSON.parse(readFileSync(mp, 'utf8')).targets[0].sha256,
      FACE_SHA,
      '落盘清单与返回值同形',
    )
    assert.equal(
      JSON.parse(readFileSync(mp, 'utf8')).faceNotes,
      undefined,
      '诊断文本不得进清单(清单是闸的输入)',
    )
    assert.ok(
      (doc.faceNotes ?? []).some((n) => n.includes('工作树副本')),
      `工作树与面不同必须点名,实得 ${JSON.stringify(doc.faceNotes)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('⑤ 反向:被审面取不到 ⇒ 抛错且清单一个字节都不写(未判定不封存)', () => {
  const dir = mkScratch('rg-face-nil-')
  try {
    const mp = writeManifest(dir, '1'.repeat(64))
    assert.throws(
      () =>
        rg.seal({
          reason: '测试',
          manifestPath: mp,
          faceHash: () => null,
          readFile: () => '盘上还有内容',
          root: dir,
        }),
      /未判定不封存/,
    )
    assert.equal(JSON.parse(readFileSync(mp, 'utf8')).targets[0].sha256, '1'.repeat(64), '不得被改写')
  } finally {
    rmScratch(dir)
  }
})

test('⑤ 解锁同面:记录绑被审面哈希,面取不到一律不写锁文件', () => {
  const dir = mkScratch('rg-face-unlock-')
  try {
    const up = join(dir, 'unlocks.json')
    const rec = rg.unlock({
      targetId: 'x',
      reason: '复核后临时放行(测试)',
      ttlMin: 120,
      rev: 'HEAD',
      faceHash: () => FACE_SHA,
      manifest: { targets: [{ id: 'x', path: 'x.mjs', mode: 'file', sha256: 'whatever' }] },
      unlockPath: up,
      now: Date.parse('2026-11-03T00:00:00Z'),
    })
    assert.equal(rec.sha256, FACE_SHA, '解锁记录必须绑被审面哈希')
    assert.ok(existsSync(up))
    assert.throws(
      () =>
        rg.unlock({
          targetId: 'x',
          reason: '测试',
          ttlMin: 120,
          faceHash: () => null,
          manifest: { targets: [{ id: 'x', path: 'x.mjs', mode: 'file', sha256: 'whatever' }] },
          unlockPath: join(dir, 'unlocks2.json'),
        }),
      /未判定不解锁/,
    )
    assert.equal(existsSync(join(dir, 'unlocks2.json')), false, '面取不到不得留下锁文件')
  } finally {
    rmScratch(dir)
  }
})

test('⑤ 形状锁:封与解都不再拿工作树哈希当绑定值(反向断言,防回潮)', () => {
  const src = readFileSync(new URL('../root-guard.mjs', import.meta.url), 'utf8')
  const sealBody = src.slice(src.indexOf('export function seal'), src.indexOf('export function unlock'))
  assert.ok(/faceHash = faceHashOf/.test(sealBody), 'seal 丢了 faceHash 注入出口')
  assert.ok(
    !/const h = hashTarget\(t, readFile, root\)\s*\n\s*if \(!h\.ok\) throw new Error\(`封存失败/.test(sealBody),
    'seal 又回到"按现盘哈希封存"(47 轮冻结的成因形态)',
  )
  const unlockBody = src.slice(src.indexOf('export function unlock'))
  assert.ok(/faceHash = faceHashOf/.test(unlockBody), 'unlock 丢了 faceHash 注入出口')
  assert.ok(
    !/const h = hashTarget\(t, readFile, root\)/.test(unlockBody),
    'unlock 又回到绑工作树哈希(会造出"放了锁仍然红")',
  )
})

/**
 * ⑥ 未知旗标必须当场失败(2026-11-03 本会话实踩)。写成 `--check --rev <sha>`(真名 `--against-rev`)
 * 时旧实现把它当不存在,静默判**自己那枚 HEAD** 并报绿 —— 同一时刻生产签出对同一 sha 判红。
 * 假绿比红贵得多:它会让人顺着错方向去改别的格子。失效方向固定为"多要一次定向说明"(§0.10)。
 */
test('⑥ CLI 白名单:未知旗标/缺值/游离参数一律判用法错,已知组合照常通过', () => {
  const bad = rg.parseCliArgs(['--check', '--rev', 'f'.repeat(40)])
  assert.equal(bad.ok, false, '--rev 不存在,必须被点名而不是被忽略')
  assert.ok(
    bad.unknown.includes('--rev') || bad.unknown.some((u) => u.startsWith('--rev')),
    `未知清单要含 --rev,实得 ${JSON.stringify(bad.unknown)}`,
  )
  assert.equal(rg.parseCliArgs(['--reason']).ok, false, '值旗标后面没有值 ⇒ 必须判缺值')
  assert.equal(
    rg.parseCliArgs(['--seal']).ok,
    true,
    '--seal 单独出现是合法形态(空理由由 seal() 自己拒,不靠 CLI 白名单冒充)',
  )
  assert.equal(rg.parseCliArgs(['--check', '--json']).ok, true, '合法组合不得被误拦')
  assert.equal(
    rg.parseCliArgs(['--check', '--against-rev', 'f'.repeat(40)]).ok,
    true,
    '真名旗标照常通过',
  )
  assert.equal(
    rg.parseCliArgs(['--check', '--against-rev', '--json']).ok,
    false,
    '值位上出现另一个旗标 ⇒ 判缺值,不能把 --json 当成 rev 吃掉',
  )
  assert.equal(rg.parseCliArgs(['--self-test']).ok, true, '自检档照常通过')
})

test('⑥ 形状锁:main() 必须在任何动作之前拒绝未知旗标(拒绝早于分派才可能拦住假绿)', () => {
  const src = readFileSync(new URL('../root-guard.mjs', import.meta.url), 'utf8')
  const m = src.slice(src.indexOf('function main(argv)'))
  const guardAt = m.indexOf('parseCliArgs(argv)')
  const dispatchAt = m.indexOf("has('--self-test')")
  assert.ok(guardAt > 0 && dispatchAt > 0, '找不到拒绝器或分派点')
  assert.ok(guardAt < dispatchAt, '拒绝必须排在任何 --flag 分派之前')
  assert.ok(/process\.exitCode = EXIT_UNKNOWN/.test(m.slice(0, guardAt + 900)), '用法错必须顶未判定/失败退出码')
})

/**
 * ⑦ 必备目标扩容(2026-11-04):任一 REQUIRED 目标哈希不符 ⇒ fail / exit=1。
 * 全部走内存替身(不碰真仓、不依赖任何服务):清单按必备 id 逐枚造封条 → 逐枚把其中一枚
 * 换成不同内容,只该那一枚 fail,verdict 折成 exit 1;全对则 pass/exit 0(成对反向牙)。
 */
test('⑦ 任一 REQUIRED 目标哈希不符 ⇒ fail/exit=1', () => {
  assert.ok(REQUIRED_TARGET_IDS.includes('git-guardian'), '扩容后必备集必须含 git-guardian')
  const manifest = {
    targets: REQUIRED_TARGET_IDS.map((id) => ({
      id,
      path: `${id}.mjs`,
      mode: 'file',
      sha256: rg.sha256Of('good'),
    })),
  }
  const readerFor = (badId) => (abs) => {
    const name = String(abs)
      .replace(/\\/g, '/')
      .split('/')
      .pop()
      .replace(/\.mjs$/, '')
    return name === badId ? 'bad' : 'good'
  }
  const allGood = rg.checkAll({ manifest, readFile: readerFor(null), root: '/r' })
  assert.equal(allGood.verdict, 'pass', '全对必须 pass')
  assert.equal(rg.exitCodeOf(allGood.verdict), 0)
  for (const badId of REQUIRED_TARGET_IDS) {
    const r = rg.checkAll({ manifest, readFile: readerFor(badId), root: '/r' })
    assert.equal(r.verdict, 'fail', `${badId} 哈希不符却读出 ${r.verdict}`)
    assert.equal(rg.exitCodeOf(r.verdict), 1, `${badId} 不符必须 exit=1`)
    assert.equal(r.targets.find((t) => t.id === badId)?.state, 'fail')
    assert.equal(r.targets.filter((t) => t.state === 'fail').length, 1, '只该点名不相符那一枚')
  }
})

test('⑦b 真实清单在册全部 REQUIRED 目标 id(否则该条可被静默删掉)', () => {
  const m = rg.loadManifest(
    readFileSync(join(ROOT, 'scripts/data/root-guard-manifest.json'), 'utf8'),
  )
  for (const id of REQUIRED_TARGET_IDS)
    assert.ok(m.targets.some((t) => t.id === id), `真实清单缺必备目标 ${id}`)
  assert.ok(
    m.targets.length >= REQUIRED_TARGET_IDS.length,
    `清单目标数 ${m.targets.length} 少于必备集 ${REQUIRED_TARGET_IDS.length}`,
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
