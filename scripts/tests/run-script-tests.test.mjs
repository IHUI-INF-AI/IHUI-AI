// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/run-script-tests.test.mjs — 全量镜像测试入口自身的取证。
 *
 * 钉的是它的**反假绿**职责(一个"跑测试的人"如果自己在假绿,比没有更危险):
 *  ① 发现 0 个文件 ⇒ 必须判红(目录漂移不等于"全过");
 *  ② TAP 计数缺失 ⇒ 必须按失败计(runner 崩了不等于测试过了);
 *  ③ 切片不得丢文件(Windows argv 长度上限下的 ENAMETOOLONG 静默少跑)。
 * 全部在 mkScratch 隔离目录里端到端取证,不往真仓 scripts/tests/ 丢临时文件(§25)。
 *
 * `--changed` 那一档(2026-10-29 立)由下面 ⑥–⑩ 钉:正向命中计数 + 三条"枚举到 0 ⇒ 未
 * 判定 exit 2"的臂(基点取不到 / 基点全 0 / 改动面没有 scripts/** / 有改动但对上 0 枚测试),
 * 外加"同一夹具不带 --changed 确实判绿"的变异对照 —— 按 §0.3,没有反向用例的档等于没锁。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { __test__ as rt } from '../run-script-tests.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const { discover, buildChunks, parseTap, main, changedScriptsPaths, tokensForChanged } = rt

const PASS_TAP = ['# Subtest: a', 'ok 1 - a', '# tests 3', '# pass 3', '# fail 0', '# skip 1'].join(
  '\n',
)
const RED_TAP = ['not ok 1 - 某门判据回归', '# tests 2', '# pass 1', '# fail 1'].join('\n')

/**
 * 夹具仓的 git 派生:显式 stdio(§12g),落点在 mkScratch(仓外 git 面,守门 208 唯一批准形态)。
 * 失败必须当场点名 —— 否则"三面取不到"会把 --changed 的判定臂顶成 exit 2,用例就成了空判据。
 */
function gitAt(dir, args) {
  const r = spawnSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd: dir,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(
    r.status,
    0,
    `夹具 git ${args.join(' ')} 失败:${String(r.stderr ?? r.error?.message ?? '').slice(0, 200)}`,
  )
  return r
}

/** 按正斜杠相对路径写夹具文件(顺带建齐父目录)。 */
function writeRel(root, rel, content) {
  const p = join(root, ...rel.split('/'))
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, content, 'utf8')
  return p
}

/** 带 HEAD 基线的空夹具仓:三路清单与 `base..HEAD` 区间面都要 HEAD 可问。 */
function makeRepo(prefix) {
  const dir = mkScratch(prefix)
  gitAt(dir, ['init', '-q', '-b', 'main'])
  gitAt(dir, ['config', 'user.email', 'fixture@local.test'])
  gitAt(dir, ['config', 'user.name', 'fixture'])
  gitAt(dir, ['commit', '-q', '--allow-empty', '-m', 'base'])
  return dir
}

/** main() 没有 io 注入缝:结论行走 console.log ⇒ 取证把 stdout 收进数组(与同仓 runReport 同形)。 */
function capture(fn) {
  const orig = console.log
  const lines = []
  console.log = (...a) => lines.push(a.join(' '))
  try {
    return { rc: fn(), out: lines.join('\n') }
  } finally {
    console.log = orig
  }
}

function cleanup(dir) {
  rmScratch(dir)
  rmSync(dir, { recursive: true, force: true })
}

test('parseTap:正常汇总取到计数,并把 not ok 名字提出来', () => {
  const p = parseTap(PASS_TAP)
  assert.equal(p.parsed, true)
  assert.deepEqual([p.tests, p.pass, p.fail, p.skipped], [3, 3, 0, 1])
  assert.deepEqual(p.notOk, [])
  const r = parseTap(RED_TAP)
  assert.equal(r.fail, 1)
  // notOk 的形状是 {name, why} 对象(2026-10-21 现读 collectFailures:why 带"为什么红"的截断摘要,
  // main 汇总直接消费它)。旧断言写的是裸串 —— 那意味着这面镜像与出口形状漂开后没人跑它,
  // 恰是本 runner 自己被"写了没人跑"打中的实证,形状锁必须钉住。
  assert.deepEqual(
    r.notOk.map((x) => x.name),
    ['某门判据回归'],
  )
  assert.equal(typeof r.notOk[0].why, 'string', 'why 缺失 ⇒ main 的失败汇总没有"为什么",只有名字')
})

test('parseTap(反假绿核心):只有崩溃残迹、没有计数 ⇒ parsed:false,不得当成 0 失败', () => {
  for (const raw of ['', 'node:internal/modules/cjs/loader:255\nboom', '# tests 0', undefined]) {
    const p = parseTap(raw)
    assert.equal(p.parsed, false, `输入 ${JSON.stringify(raw)} 必须算"未真正运行"`)
  }
  // 只有 fail 没有 pass 也算取到结论(不能因为缺一个键就判"没跑")
  assert.equal(parseTap('# fail 0').parsed, true)
})

test('buildChunks:任何 limit 下都不得丢文件(ENAMETOOLONG 型静默少跑的正面判据)', () => {
  const files = Array.from(
    { length: 40 },
    (_, i) => `scripts/tests/x${String(i).padStart(2, '0')}.test.mjs`,
  )
  for (const limit of [6000, 200, 60]) {
    const chunks = buildChunks(files, limit)
    assert.deepEqual(chunks.flat(), files, `limit=${limit} 时丢/重排了文件`)
  }
  assert.equal(buildChunks(files, 6000, true).length, files.length, '--serial 必须一片一个')
  assert.equal(buildChunks([], 6000).length, 0)
  // 变异对照:正常 limit 下确实切成多片(否则上面的"不丢文件"是空判据)
  assert.ok(buildChunks(files, 200).length > 1, 'limit=200 必须切片,否则本用例什么都没测')
})

test('discover:只认 *.test.mjs、排序稳定,目录不存在=空集', () => {
  const dir = mkScratch('ihui-rst-')
  try {
    mkdirSync(join(dir, 'scripts', 'tests'), { recursive: true })
    for (const n of ['b.test.mjs', 'a.test.mjs', 'helper.mjs', 'c.test.ts']) {
      writeFileSync(join(dir, 'scripts', 'tests', n), 'export {}\n', 'utf8')
    }
    const found = discover(dir).map((f) => f.split(/[\\/]/).pop())
    assert.deepEqual(found, ['a.test.mjs', 'b.test.mjs'], '.test.ts 与 helper.mjs 不得入列')
    assert.deepEqual(discover(dir, ['zzz']), [], '过滤后为空必须真是空集')
    assert.deepEqual(discover(join(dir, 'nope')), [], '目录不存在 ⇒ 空集(交给 main 判红)')
    // deploy\tests 从 2026-10-21 起并入发现面(此前这批部署链行为测试没有任何 runner 跑,
    // 里面躺着一枚红了很久没人看见的断言)。反证:没有该目录时不得因此报错或漏另一目录。
    mkdirSync(join(dir, 'deploy', 'tests'), { recursive: true })
    writeFileSync(join(dir, 'deploy', 'tests', 'z-deploy.test.mjs'), 'export {}\n', 'utf8')
    const found2 = discover(dir).map((f) => f.split(/[\\/]/).pop())
    // 排序按**全路径**做:deploy\tests 在字母序上排在 scripts\tests 前面,所以它的条目整体在前。
    assert.deepEqual(found2, ['z-deploy.test.mjs', 'a.test.mjs', 'b.test.mjs'], 'deploy\\tests 必须并入发现面且全量排序稳定')
    assert.deepEqual(discover(join(dir, 'nope')), [], '两个目录都不存在仍 ⇒ 空集')
  } finally {
    rmScratch(dir)
  }
})

test('main(端到端):隔离目录 0 个测试 ⇒ 判红;放一个真测试 ⇒ 判绿', () => {
  const dir = mkScratch('ihui-rst-main-')
  try {
    mkdirSync(join(dir, 'scripts', 'tests'), { recursive: true })
    assert.equal(main([], dir), 1, '一个测试都没发现时必须 exit 1,不得静默变绿')
    assert.equal(main(['--', 'nosuch'], dir), 1, '过滤后为空同样必须 exit 1')
    writeFileSync(
      join(dir, 'scripts', 'tests', 'sample.test.mjs'),
      "import { test } from 'node:test'\ntest('sample ok', () => {})\n",
      'utf8',
    )
    assert.equal(main([], dir), 0, '有一个真通过的测试 ⇒ 0')
    // 再放一个必红的:整体必须判红,且不得因"有一片绿"而被抵掉
    writeFileSync(
      join(dir, 'scripts', 'tests', 'bad.test.mjs'),
      "import { test } from 'node:test'\nimport assert from 'node:assert/strict'\ntest('sample bad', () => assert.equal(1, 2))\n",
      'utf8',
    )
    assert.equal(main([], dir), 1, '任一片红必须整体红')
  } finally {
    rmScratch(dir)
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--changed(正向):改动面的 scripts/** 对上镜像测试 ⇒ 选中该测试、结论行计数正确、exit 0', () => {
  const dir = makeRepo('ihui-rst-chg-')
  try {
    // 现场形态 = 有人新写了一枚判据 + 它的镜像测试(两枚都还没入库 ⇒ 走 untracked 那一路)
    writeRel(dir, 'scripts/check-demo.mjs', 'export const X = 1\n')
    writeRel(
      dir,
      'scripts/tests/check-demo.test.mjs',
      "import { test } from 'node:test'\ntest('demo ok', () => {})\n",
    )
    const face = changedScriptsPaths(dir)
    assert.equal(face.error, null, `本地三面必须取到:${face.error}`)
    assert.deepEqual(
      face.sources,
      ['staged', 'worktree', 'untracked'],
      '三路清单一路都不能少:少一路就有一格改动结构性看不见',
    )
    assert.deepEqual(face.paths, ['scripts/check-demo.mjs', 'scripts/tests/check-demo.test.mjs'])
    // 令牌由改动面推出(复用 `-- <子串>` 那把尺,§0.6):两枚路径折成同一枚令牌
    assert.deepEqual(tokensForChanged(face.paths), ['check-demo'])
    const run = capture(() => main(['--changed'], dir))
    assert.equal(run.rc, 0, `命中测试且全绿时必须 exit 0,实际输出:\n${run.out}`)
    assert.ok(
      run.out.includes('SCRIPT-TESTS-CHANGED files=2 suites=1 pass=1 fail=0'),
      `结论计数行必须现算改动面枚数与选中套数,实际输出:\n${run.out}`,
    )
    assert.ok(run.out.includes('改动面对应的镜像测试绿'), run.out)
  } finally {
    cleanup(dir)
  }
})

test('--changed(未判定之一):基点取不到 / 基点全 0 ⇒ exit 2 点名区间面,不得糊成"没有改动"', () => {
  const dir = makeRepo('ihui-rst-chg-base-')
  try {
    // 夹具仓工作树是净的 ⇒ 本地三面 0 路径。此时"区间取不到"与"真没改动"极易被读成同一件事,
    // 所以断言的不只是 exit 2,还有**点名的是哪条臂**(§0.3:未判定必须说清为什么没判)。
    const zero = capture(() => main(['--changed', '--base', '0'.repeat(40)], dir))
    assert.equal(zero.rc, 2, `全 0 基点(push 事件的新建分支/强推)必须未判定:\n${zero.out}`)
    assert.ok(zero.out.includes('未判定'), zero.out)
    assert.ok(zero.out.includes('区间基点是全 0'), `必须点名基点形态:\n${zero.out}`)
    assert.ok(!zero.out.includes('没有触及'), '不得把"取不到区间"降级成"没有改动"那一档')

    const dead = capture(() => main(['--changed', '--base', 'no-such-base-ref'], dir))
    assert.equal(dead.rc, 2, `基点解析不出来必须未判定:\n${dead.out}`)
    assert.ok(dead.out.includes('区间面取不到'), dead.out)
    assert.ok(!dead.out.includes('没有触及'), dead.out)

    for (const r of [zero, dead]) {
      assert.ok(!r.out.includes('✅'), `未判定档绝不冒绿:\n${r.out}`)
      assert.ok(
        !r.out.includes('SCRIPT-TESTS-CHANGED'),
        `未判定档不得输出结论计数行(那会被读成"判过了"):\n${r.out}`,
      )
    }
    // 正向对照:基点给得对时区间面确实并入(不报错)⇒ 上面两条不是因为"恒报错"才过
    const good = changedScriptsPaths(dir, 'HEAD')
    assert.equal(good.error, null, `HEAD..HEAD 是合法区间(只是没差异):${good.error}`)
  } finally {
    cleanup(dir)
  }
})

test('--changed(未判定之二):改动面里一个 scripts/** 都没有 ⇒ 同样未判定 exit 2,不判绿', () => {
  const dir = makeRepo('ihui-rst-chg-scope-')
  try {
    writeRel(dir, 'docs/note.md', '# note\n')
    writeRel(dir, 'deploy/run.sh', 'echo hi\n')
    const face = changedScriptsPaths(dir)
    assert.equal(face.error, null, face.error)
    assert.deepEqual(face.paths, [], `射程只认 ${rt.CHANGED_SCOPE}**,其余路径不得算"有改动"`)
    const run = capture(() => main(['--changed'], dir))
    assert.equal(run.rc, 2, `枚举到 0 个候选判死不记绿:\n${run.out}`)
    assert.ok(run.out.includes('未判定'), run.out)
    assert.ok(run.out.includes(`没有触及 ${rt.CHANGED_SCOPE}`), `必须点名射程:\n${run.out}`)
    assert.ok(!run.out.includes('✅'), run.out)
    assert.ok(!run.out.includes('SCRIPT-TESTS-CHANGED'), run.out)
    // 反向锁:同一夹具补一枚 scripts/** 改动 ⇒ 立刻离开"0 改动"那一档(换成"对上 0 枚测试")
    writeRel(dir, 'scripts/check-scope-probe.mjs', 'export const Y = 2\n')
    const run2 = capture(() => main(['--changed'], dir))
    assert.equal(run2.rc, 2, run2.out)
    assert.ok(run2.out.includes('没有任何一枚对应的镜像测试'), `换了臂必须换点名:\n${run2.out}`)
  } finally {
    cleanup(dir)
  }
})

test('--changed(未判定之三/反向锁):有 scripts/** 改动却对上 0 枚测试 ⇒ 未判定,而全量档同一夹具判绿', () => {
  const dir = makeRepo('ihui-rst-chg-nomatch-')
  try {
    // 目录里放一枚与改动**无关且已入库**的测试(不带 --changed 时它会被跑并判绿)。必须提交进
    // 基线:留在未跟踪态它就进了改动面,而 `x.test.mjs` 的令牌按源码口径会命中自己那一格
    // (tokensForChanged 刻意这么设计),于是"对上 0 枚"这一档根本构造不出来。
    writeRel(
      dir,
      'scripts/tests/unrelated.test.mjs',
      "import { test } from 'node:test'\ntest('unrelated ok', () => {})\n",
    )
    gitAt(dir, ['add', '-A'])
    gitAt(dir, ['commit', '-q', '-m', 'baseline test suite'])
    // 基线提交之后才落下"没有测试的那一枚改动" ⇒ 它单独构成改动面
    writeRel(dir, 'scripts/check-zorphan.mjs', 'export const Z = 3\n')
    const preface = changedScriptsPaths(dir)
    assert.equal(preface.error, null, preface.error)
    assert.deepEqual(
      preface.paths,
      ['scripts/check-zorphan.mjs'],
      '夹具必须真是"只改了一枚没有测试的判据"',
    )
    const run = capture(() => main(['--changed'], dir))
    assert.equal(run.rc, 2, `"没匹配到测试"绝不得返回成功态:\n${run.out}`)
    assert.ok(run.out.includes('未判定'), run.out)
    assert.ok(run.out.includes('枚举到 0 个候选'), run.out)
    assert.ok(run.out.includes('scripts/check-zorphan.mjs'), '未判定要点名是哪枚改动没有测试')
    assert.ok(!run.out.includes('✅'), run.out)
    assert.ok(!run.out.includes('SCRIPT-TESTS-CHANGED'), run.out)
    // 变异对照:同一夹具的全量档确实绿 ⇒ 上面那个 2 是这一档的判据在拦,不是夹具/环境坏了
    const base = capture(() => main([], dir))
    assert.equal(base.rc, 0, `全量档对照必须判绿:\n${base.out}`)
  } finally {
    cleanup(dir)
  }
})

test('--changed(与手抄子串是 AND 收窄,收窄到 0 仍走未判定而不是判红)', () => {
  const dir = makeRepo('ihui-rst-chg-and-')
  try {
    writeRel(dir, 'scripts/check-demo.mjs', 'export const X = 1\n')
    writeRel(
      dir,
      'scripts/tests/check-demo.test.mjs',
      "import { test } from 'node:test'\ntest('demo ok', () => {})\n",
    )
    // 子串与改动面交得上 ⇒ 照旧跑并判绿(AND 而非并集:子串只能把面收窄)
    const hit = capture(() => main(['--changed', '--', 'check-demo'], dir))
    assert.equal(hit.rc, 0, hit.out)
    // 子串把面收窄到空 ⇒ 这一档的出口是"未判定 exit 2",不是全量档那句"过滤后为空 exit 1"
    const miss = capture(() => main(['--changed', '--', 'nosuchtoken'], dir))
    assert.equal(miss.rc, 2, `收窄到 0 枚必须未判定:\n${miss.out}`)
    assert.ok(miss.out.includes('没有任何一枚对应的镜像测试'), miss.out)
    const plain = capture(() => main(['--', 'nosuchtoken'], dir))
    assert.equal(plain.rc, 1, '非 --changed 档的"过滤后为空"仍是判红 1(两档出口不同形)')
  } finally {
    cleanup(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
