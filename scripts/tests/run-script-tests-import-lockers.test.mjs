// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/run-script-tests-import-lockers.test.mjs — 「改了巨型器物 ⇒ 锁它的测试必须入选」这一维的取证。
 *
 * 治的是这一型结构性盲区:`run-script-tests.mjs` 的 `tokensForChanged` 只按**被改文件自己的 basename**
 * 造令牌,于是"按票命名"的镜像测试(`cross-end-*-dispatch` / `hand-mirror-upgrade-dispatch` …)
 * 永远选不到 —— 器物改了、镜像红了,而红能以红形态长期入库。
 * 现读实证(提交 57c3eb1a45eb,只改 scripts/git-guardian.mjs 那一族):子串档 41 枚,
 * 而直接 import 了该器物的测试 73 枚 ⇒ 漏 39 枚。
 *
 * 七条臂(每条都是**成对**的:正向命中 + 摘掉对应腿即翻失败):
 *  ① 派生腿阳性:改 `scripts/guardian.mjs` ⇒ 按票命名、只靠 import 关系相连的那枚测试入选;
 *  ② 反证(防"恒选全部"的假修):改一枚没有任何测试 import 的脚本 ⇒ 派生腿为空、main 走未判定 exit 2;
 *  ③ 变异对照(摘掉派生腿):注入 `importTargetsOf: () => []` ⇒ ① 那枚立刻不入选;
 *  ④ 不按名字猜:同名相近但**没被 import** 的器物不得连带入选(按名推断本仓实测误判 20–70%);
 *  ⑤ 扇入上限:超限器物整条派生腿让路且**逐条点名**(不静默弃),未超限一律照选;
 *  ⑥ 读不到的测试 ⇒ unreadable 点名,绝不折成"它什么都不 import"(§0.3);
 *  ⑦ 真面(只读物证):真仓里 `scripts/git-guardian.mjs` 的派生腿含
 *     `cross-end-mirror-heal-dispatch.test.mjs`,而 basename 令牌腿**不含** —— 把"坏的那一维"
 *     与"修的那一维"钉在同一枚测试里,任何一维回潮本测试即红。
 *
 * §22c:判据只 import 源脚本的 `__test__`,本文件不复制任何映射清单。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { __test__ as rt } from '../run-script-tests.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const {
  discover,
  main,
  tokensForChanged,
  testImportTargets,
  lockTestsForChanged,
  resolveLockerFanInCap,
  DEFAULT_LOCKER_FANIN_CAP,
  ROOT,
} = rt

function writeRel(root, rel, content) {
  const p = join(root, ...rel.split('/'))
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, content, 'utf8')
  return p
}

function cleanup(dir) {
  rmScratch(dir)
  rmSync(dir, { recursive: true, force: true })
}

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

/**
 * 夹具仓:一枚"巨型器物" + 三枚测试 ——
 *   同名字族测试(git-guardian-notify 形态)、按票命名的 dispatch 测试(只有 import 关系相连)、
 *   另一枚相近器物 guardian-two 的镜像(证明映射不吃名字相似度)。
 */
function makeFixture(prefix) {
  const dir = mkScratch(prefix)
  writeRel(dir, 'scripts/guardian.mjs', 'export const TICK = 1\nexport const __test__ = { TICK }\n')
  writeRel(dir, 'scripts/guardian-two.mjs', 'export const TICK = 2\n')
  writeRel(
    dir,
    'scripts/tests/git-guardian-notify.test.mjs',
    "import { test } from 'node:test'\nimport assert from 'node:assert/strict'\nimport { __test__ as G } from '../guardian.mjs'\ntest('同名字族镜像', () => assert.equal(G.TICK, 1))\n",
  )
  writeRel(
    dir,
    'scripts/tests/cross-end-mirror-heal-dispatch.test.mjs',
    "import { test } from 'node:test'\nimport assert from 'node:assert/strict'\nimport { TICK } from '../guardian.mjs'\ntest('按票命名的调度腿镜像(basename 与器物毫无关系)', () => assert.equal(TICK, 1))\n",
  )
  writeRel(
    dir,
    'scripts/tests/hand-mirror-upgrade-dispatch.test.mjs',
    "import { test } from 'node:test'\nimport assert from 'node:assert/strict'\nimport { TICK } from '../guardian-two.mjs'\ntest('锁的是另一枚器物', () => assert.equal(TICK, 2))\n",
  )
  return dir
}

const rel = (dir, abs) =>
  abs
    .slice(dir.length + 1)
    .split('\\')
    .join('/')

test('① 派生腿阳性:改巨型器物 ⇒ 只靠 import 相连的按票命名镜像必须入选', () => {
  const dir = makeFixture('ihui-rst-lockers-')
  try {
    const r = lockTestsForChanged(['scripts/guardian.mjs'], { rootDir: dir })
    const got = r.files.map((f) => rel(dir, f))
    assert.ok(
      got.includes('scripts/tests/cross-end-mirror-heal-dispatch.test.mjs'),
      `派生腿必须选到"按票命名"的那枚,实得:${JSON.stringify(got)}`,
    )
    assert.ok(
      got.includes('scripts/tests/git-guardian-notify.test.mjs'),
      `同名字族镜像同样在列,实得:${JSON.stringify(got)}`,
    )
    assert.equal(r.capped.length, 0, `小夹具不该触发扇入上限:${JSON.stringify(r.capped)}`)
    assert.equal(r.unreadable.length, 0, `夹具测试都可读:${JSON.stringify(r.unreadable)}`)
    // 端到端:main 走 --changed 时把两腿并起来跑,按票命名那枚确实被执行且判绿(不是只进清单)。
    const run = capture(() => main(['--changed', '--paths', 'scripts/guardian.mjs'], dir))
    assert.equal(run.rc, 0, `命中且全绿必须 exit 0:\n${run.out}`)
    assert.match(run.out, /lockers=2 capped=0/, `结论行要把派生腿量出来:\n${run.out}`)
    assert.match(run.out, /import 派生锁定 2 个/, `选取行必须点名两腿各命中多少:\n${run.out}`)
  } finally {
    cleanup(dir)
  }
})

test('② 反证:没有任何测试 import 的脚本 ⇒ 派生腿为空、main 未判定(防"恒选全部"的假修)', () => {
  const dir = makeFixture('ihui-rst-lockers-none-')
  try {
    writeRel(dir, 'scripts/check-zorphan.mjs', 'export const Z = 3\n')
    const r = lockTestsForChanged(['scripts/check-zorphan.mjs'], { rootDir: dir })
    assert.deepEqual(r.files, [], '没有 importer 时派生腿必须一枚都不选')
    const run = capture(() => main(['--changed', '--paths', 'scripts/check-zorphan.mjs'], dir))
    assert.equal(run.rc, 2, `0 候选必须未判定,不得"顺手跑全套":\n${run.out}`)
    assert.ok(run.out.includes('没有任何一枚对应的镜像测试'), run.out)
    assert.ok(run.out.includes('import 派生锁定 0'), `未判定要点名两腿同为空:\n${run.out}`)
    assert.ok(!run.out.includes('✅'), run.out)
  } finally {
    cleanup(dir)
  }
})

test('③ 变异对照:摘掉派生腿(不解析 import)⇒ ① 那枚立刻选不到,可被断言抓到', () => {
  const dir = makeFixture('ihui-rst-lockers-off-')
  try {
    const noLeg = lockTestsForChanged(['scripts/guardian.mjs'], {
      rootDir: dir,
      importTargetsOf: () => [], // 把 import 解析整条摘掉 ⇒ 映射必须失效
    })
    assert.deepEqual(noLeg.files, [], '派生腿摘掉后不得仍"选中"任何测试(否则选的是别处硬编的清单)')
    // 只留 basename 令牌腿时,按票命名那枚结构上选不到 —— 这正是本票要修的缺陷形态。
    const tokens = tokensForChanged(['scripts/guardian.mjs'])
    assert.deepEqual(tokens, ['guardian'])
    const byToken = discover(dir, tokens).map((f) => rel(dir, f))
    assert.ok(
      !byToken.includes('scripts/tests/cross-end-mirror-heal-dispatch.test.mjs'),
      `子串档若已能选到它,③ 就什么都没测:\n${JSON.stringify(byToken)}`,
    )
    assert.ok(
      byToken.includes('scripts/tests/git-guardian-notify.test.mjs'),
      `子串档仍选得到同名字族(否则说明不了"只差按票命名那一格"):\n${JSON.stringify(byToken)}`,
    )
  } finally {
    cleanup(dir)
  }
})

test('④ 只认 import 目标,不按名字相似度猜', () => {
  const dir = makeFixture('ihui-rst-lockers-name-')
  try {
    const r = lockTestsForChanged(['scripts/guardian-two.mjs'], { rootDir: dir })
    const got = r.files.map((f) => rel(dir, f))
    assert.deepEqual(
      got,
      ['scripts/tests/hand-mirror-upgrade-dispatch.test.mjs'],
      `改 guardian-two 只应选到真正 import 它的那枚(同前缀的 guardian 名字族必须不被牵连):\n${JSON.stringify(got)}`,
    )
    // testImportTargets 的取数面 = 那枚测试自己的 import 说明符解析结果
    const targets = testImportTargets(
      join(dir, 'scripts', 'tests', 'cross-end-mirror-heal-dispatch.test.mjs'),
      dir,
    )
    assert.deepEqual(targets, ['scripts/guardian.mjs'], JSON.stringify(targets))
    assert.equal(
      testImportTargets(join(dir, 'scripts', 'tests', 'nope.test.mjs'), dir),
      null,
      '读不到 ⇒ null(交调用方点名),不折成空集',
    )
  } finally {
    cleanup(dir)
  }
})

test('④b 器物被删(改动面含删除)⇒ 仍要选到仍 import 它的测试(那一型必红,不能看不见)', () => {
  const dir = makeFixture('ihui-rst-lockers-deleted-')
  try {
    rmSync(join(dir, 'scripts', 'guardian.mjs'))
    const r = lockTestsForChanged(['scripts/guardian.mjs'], { rootDir: dir })
    assert.equal(
      r.files.length,
      2,
      `目标不存在也必须按测试自述的 import 关系入选(删掉出口而消费者还在 = 本仓门 253 立的型):\n${r.files}`,
    )
  } finally {
    cleanup(dir)
  }
})

test('⑤ 扇入上限:超限器物让路并逐条点名;未超限一律照选(上限只咬派生腿)', () => {
  const dir = mkScratch('ihui-rst-lockers-cap-')
  try {
    // 合成 4 枚 importer(路径不必存在:importTargetsOf 是本臂唯一注入缝)
    const testFiles = [1, 2, 3, 4].map((i) => join(dir, 'scripts', 'tests', `hub-${i}.test.mjs`))
    const targetsOf = () => ['scripts/lib/hub.mjs']
    const capped = lockTestsForChanged(['scripts/lib/hub.mjs'], {
      rootDir: dir,
      testFiles,
      importTargetsOf: targetsOf,
      cap: 3,
    })
    assert.deepEqual(capped.files, [], '超限器物不得把 4 枚"夹具工具使用者"当成锁它的测试')
    assert.deepEqual(
      capped.capped.map((c) => `${c.file}=${c.lockers}`),
      ['scripts/lib/hub.mjs=4'],
      `超限必须逐条点名器物与枚数,实得:${JSON.stringify(capped.capped)}`,
    )
    const kept = lockTestsForChanged(['scripts/lib/hub.mjs'], {
      rootDir: dir,
      testFiles,
      importTargetsOf: targetsOf,
      cap: 4,
    })
    assert.equal(kept.files.length, 4, `未超限必须全选(上限不是"少跑"的开关):\n${kept.files}`)
    assert.deepEqual(kept.capped, [])

    // 用户可见面:真夹具里 hub 被 3 枚测试当工具 import、guardian 被 2 枚当被测物件 import。
    // cap=2 ⇒ hub 让路(3>2)、guardian 照选(2 不 > 2):超限必须**点名**而不是安静少跑。
    writeRel(
      dir,
      'scripts/guardian.mjs',
      'export const TICK = 1\nexport const __test__ = { TICK }\n',
    )
    writeRel(dir, 'scripts/lib/hub.mjs', 'export const H = 1\n')
    const mkPair = (name, withGuardian) =>
      writeRel(
        dir,
        `scripts/tests/${name}.test.mjs`,
        [
          "import { test } from 'node:test'",
          "import assert from 'node:assert/strict'",
          withGuardian ? "import { TICK } from '../guardian.mjs'" : '',
          "import { H } from '../lib/hub.mjs'",
          `test('${name}', () => assert.ok(H${withGuardian ? ' + TICK' : ''}))`,
          '',
        ]
          .filter(Boolean)
          .join('\n'),
      )
    mkPair('git-guardian-notify', true)
    mkPair('cross-end-mirror-heal-dispatch', true)
    mkPair('ticket-only-hub-user', false)
    const prev = process.env.SCRIPT_TESTS_LOCKER_FANIN_CAP
    process.env.SCRIPT_TESTS_LOCKER_FANIN_CAP = '2'
    try {
      const run = capture(() =>
        main(['--changed', '--paths', 'scripts/lib/hub.mjs', 'scripts/guardian.mjs'], dir),
      )
      assert.match(run.out, /扇入超限[\s\S]*scripts\/lib\/hub\.mjs/, `超限必须点名:\n${run.out}`)
      assert.match(run.out, /lockers=2 capped=1/, `结论行要把两腿与让路量出来:\n${run.out}`)
      assert.equal(run.rc, 0, `guardian 的两枚镜像仍须跑并判绿:\n${run.out}`)
      assert.doesNotMatch(
        run.out,
        /扇入超限[^\n]*guardian/,
        '未超限的器物不得被误报成让路(点名必须是"这一枚",不能是一片)',
      )
    } finally {
      if (prev === undefined) delete process.env.SCRIPT_TESTS_LOCKER_FANIN_CAP
      else process.env.SCRIPT_TESTS_LOCKER_FANIN_CAP = prev
    }
  } finally {
    cleanup(dir)
  }
})

test('⑥ 读不到的测试 ⇒ unreadable 点名,不折成"它什么都不 import"(§0.3)', () => {
  const dir = makeFixture('ihui-rst-lockers-unread-')
  try {
    // 注入缝面:所有 importer 都"读不到" ⇒ 派生腿一枚都不选,但 4 枚都要被点名,不静默当空 import。
    const r = lockTestsForChanged(['scripts/guardian.mjs'], {
      rootDir: dir,
      importTargetsOf: () => null,
    })
    assert.equal(r.files.length, 0)
    assert.equal(r.unreadable.length, 3, `夹具里 3 枚测试都得被记成读不到:${r.unreadable}`)
    // 生产面:造一枚真读不到的条目(同名目录 ⇒ readFileSync 必抛 EISDIR),
    // 它必须被逐条点名,而不是被折成"它什么都不 import"就当没事发生。
    mkdirSync(join(dir, 'scripts', 'tests', 'zz-unreadable.test.mjs'), { recursive: true })
    const prod = lockTestsForChanged(['scripts/guardian.mjs'], { rootDir: dir })
    assert.deepEqual(
      prod.unreadable.map((f) => rel(dir, f)),
      ['scripts/tests/zz-unreadable.test.mjs'],
      `读不到必须逐条点名:${prod.unreadable}`,
    )
    assert.equal(prod.files.length, 2, '其余可读的镜像照旧入选(失效方向是点名,不是整条腿停摆)')
    const run = capture(() => main(['--changed', '--paths', 'scripts/guardian.mjs', '--list'], dir))
    assert.equal(run.rc, 0, `仍选得到镜像时照常出行:\n${run.out}`)
    assert.match(run.out, /测试读不到[^\n]*zz-unreadable\.test\.mjs/, `必须点名:\n${run.out}`)
  } finally {
    cleanup(dir)
  }
})

test('resolveLockerFanInCap:默认 200;env 可覆盖;非法值回落默认(不得变 0 把派生腿整条关掉)', () => {
  assert.equal(DEFAULT_LOCKER_FANIN_CAP, 200)
  assert.equal(resolveLockerFanInCap({}), DEFAULT_LOCKER_FANIN_CAP)
  assert.equal(resolveLockerFanInCap({ SCRIPT_TESTS_LOCKER_FANIN_CAP: '5' }), 5)
  for (const bad of ['abc', '0', '-5', '  ', 'NaN'])
    assert.equal(
      resolveLockerFanInCap({ SCRIPT_TESTS_LOCKER_FANIN_CAP: bad }),
      DEFAULT_LOCKER_FANIN_CAP,
      `非法值 ${JSON.stringify(bad)} 必须回落默认`,
    )
})

test('⑦ 真面(只读):git-guardian 的派生腿含按票命名的镜像,而 basename 令牌腿不含', () => {
  const CHANGED = 'scripts/git-guardian.mjs'
  const lock = lockTestsForChanged([CHANGED], { rootDir: ROOT })
  const relGot = lock.files.map((f) => rel(ROOT, f))
  const byToken = discover(ROOT, tokensForChanged([CHANGED])).map((f) => rel(ROOT, f))
  for (const t of [
    'scripts/tests/cross-end-mirror-heal-dispatch.test.mjs',
    'scripts/tests/cross-end-parity-drift-dispatch.test.mjs',
    'scripts/tests/cross-end-shell-sweep-dispatch.test.mjs',
    'scripts/tests/hand-mirror-upgrade-dispatch.test.mjs',
  ]) {
    assert.ok(
      relGot.includes(t),
      `改 ${CHANGED} 必须选到锁它的 ${t};派生腿实得 ${relGot.length} 枚`,
    )
    assert.ok(
      !byToken.includes(t),
      `${t} 若能被 basename 令牌选到,本票的派生腿就成了空转(取证面变了,这条必须重看)`,
    )
  }
  assert.ok(
    lock.files.length > byToken.length,
    `派生腿(${lock.files.length})必须严格大于子串档(${byToken.length}),否则本票没修到东西`,
  )
  // 真仓的 git-guardian 不是"人人搭夹具的通用工具" ⇒ 不该触发扇入上限
  assert.deepEqual(lock.capped, [], `真面派生腿被上限咬掉了:${JSON.stringify(lock.capped)}`)
})

test('--paths 档:没给输入 / 未配 --changed ⇒ 一律未判定,不得读成"没有改动"', () => {
  const dir = makeFixture('ihui-rst-lockers-cli-')
  try {
    const bare = capture(() => main(['--changed', '--paths'], dir))
    assert.equal(bare.rc, 2, bare.out)
    assert.match(bare.out, /--paths 后面一枚路径都没给/, bare.out)
    const orphan = capture(() => main(['--paths', 'scripts/guardian.mjs'], dir))
    assert.equal(orphan.rc, 2, orphan.out)
    assert.match(orphan.out, /--paths 只与 --changed 同档使用/, orphan.out)
    const outOfScope = capture(() => main(['--changed', '--paths', 'README.md'], dir))
    assert.equal(outOfScope.rc, 2, outOfScope.out)
    assert.match(outOfScope.out, /没有触及 scripts\/\*\*/, outOfScope.out)
  } finally {
    cleanup(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
