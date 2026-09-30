// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 172(check-skip-env-promise)§22c 镜像测试。
 *
 * 与门体 `--self-test`(65 例,构造面全判据)的分工:镜像**不重写判据**,只从
 * `__test__` 导入核心函数,钉住四件 self-test 够不着的事:
 *   ① 判据对**真仓 HEAD 面**有效(阳性对照:真实文档面提得出承诺名);
 *   ② 判据对构造 fake 有牙(不许把"没存量"写成"没判据");
 *   ③ 形状锁:门体声称的接线状态与 runner 注册块**同面一致** —— 门说已接线而 runner
 *      里没有注册块(或反之)都是"台账替没发生的事发合格证"那一型;
 *   ④ 消费面排除域与差值棘轮的退出码契约。
 * 跑法:`node --test scripts/tests/check-skip-env-promise.test.mjs`(仓库根)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { catBatch } from '../lib/face-reader.mjs'
import { __test__ } from '../check-skip-env-promise.mjs'

const {
  sentenceWindow, roleOfClause, findReads, extractOccurrences, evaluate,
  faceFromArgv, isConsumerFile, maskFace, DOC_FILES,
} = __test__

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const js = (rel, text) => ({ rel, text })

test('W 窗口与角色:子句切分 + 承诺/禁令/两可/判不出 四档不并桶', () => {
  const long = '前文一大段——**禁止**把嵌套 ref 寄托在松散文件上;**禁止**用 HUSKY_SKIP_A=1 绕过 30a —— 先跑 healing。'
  const w = sentenceWindow(long, long.indexOf('HUSKY_SKIP_A'))
  assert.ok(w.text.length < long.length && w.text.includes('HUSKY_SKIP_A'))
  assert.equal(roleOfClause('紧急跳过 HUSKY_SKIP_X=1'), 'promise')
  assert.equal(roleOfClause('禁止设置 HUSKY_SKIP_X=1'), 'denied')
  assert.equal(roleOfClause('禁止用 HUSKY_SKIP_X=1 绕过'), 'ambiguous')
  assert.equal(roleOfClause('HUSKY_SKIP_X 关的是整块'), 'none')
})

test('R 读点语法族:JS / runner skipEnv / shell / PowerShell 各一,注释里的照抄语法不算', () => {
  assert.equal(findReads('HUSKY_SKIP_X', [js('scripts/a.mjs', 'if (process.env.HUSKY_SKIP_X === "1") x()')]).length, 1)
  assert.equal(findReads('HUSKY_SKIP_X', [js('scripts/guardian-runner.mjs', "  skipEnv: 'HUSKY_SKIP_X',")]).length, 1)
  assert.equal(findReads('HUSKY_SKIP_X', [{ rel: 'deploy/a.sh', text: '[ "${HUSKY_SKIP_X}" = "1" ]' }]).length, 1)
  assert.equal(findReads('HUSKY_SKIP_X', [{ rel: 'deploy/a.ps1', text: 'if ($env:HUSKY_SKIP_X -eq "1") { }' }]).length, 1)
  // 反向锁:注释里照抄读点语法不算读点(变异自证打的就是这一条)
  assert.equal(findReads('HUSKY_SKIP_X', [js('scripts/a.mjs', '// 写 process.env.HUSKY_SKIP_X 即可跳过')]).length, 0)
  // 遮罩唯一实现:findReads 内只经 maskFace 一处
  assert.equal(String(findReads).split('maskFace(').length - 1, 1)
})

test('F 消费面:tests/夹具与归档排除,.husky 根下无扩展名钩子计入', () => {
  assert.equal(isConsumerFile('scripts/tests/x.mjs'), false)
  assert.equal(isConsumerFile('apps/web/__tests__/a.js'), false)
  assert.equal(isConsumerFile('.ihui-agent/archive/a.mjs'), false)
  assert.equal(isConsumerFile('scripts/README.md'), false)
  assert.equal(isConsumerFile('.husky/post-commit'), true)
})

test('E 判据有牙(构造面):承诺零读点 ⇒ fake;--strict exit 1;基线含它 ⇒ 只点名 exit 0;0 承诺判死', () => {
  const doc = '- 紧急跳过 `HUSKY_SKIP_FAKE_PROBE=1` 即可'
  const wiredFace = [js('scripts/w.mjs', 'process.env.HUSKY_SKIP_FAKE_PROBE')]
  const fakeRun = evaluate({ docs: [{ rel: 'AGENTS.md', text: doc }], faces: [], face: 'head', strict: true })
  assert.equal(fakeRun.counts.fake, 1)
  assert.equal(fakeRun.exit, 1)
  const wiredRun = evaluate({ docs: [{ rel: 'AGENTS.md', text: doc }], faces: wiredFace, face: 'head', strict: true })
  assert.equal(wiredRun.counts.wired, 1)
  assert.equal(wiredRun.exit, 0)
  const ratchet = evaluate({
    docs: [{ rel: 'AGENTS.md', text: doc }], faces: [], face: 'staged',
    baselineFake: new Set(['HUSKY_SKIP_FAKE_PROBE']),
  })
  assert.equal(ratchet.newlyFake.length, 0)
  assert.equal(ratchet.exit, 0)
  const empty = evaluate({ docs: [{ rel: 'AGENTS.md', text: '# 本文件不写任何跳门变量' }], faces: [], face: 'head' })
  assert.equal(empty.exit, 2)
})

test('P 真仓 HEAD 阳性对照:真实文档面提得出承诺名(提不出 = 判据瞎,不是没存量)', () => {
  const specs = DOC_FILES.map((f) => `HEAD:${f}`)
  const docs = catBatch(ROOT, specs)
  let occs = 0
  const names = new Set()
  for (const rel of DOC_FILES) {
    const text = docs.get(`HEAD:${rel}`)
    assert.equal(typeof text, 'string', `${rel} 在 HEAD 面取不到`)
    for (const o of extractOccurrences(text, rel)) {
      occs++
      names.add(o.name)
    }
  }
  assert.ok(occs > 20, `真仓承诺出现点仅 ${occs},提取器对真仓失明`)
  assert.ok(names.size > 10, `真仓去重承诺名仅 ${names.size},提取器对真仓失明`)
})

test('S 形状锁:门体接线声明与 runner 注册块必须同面一致(HEAD)', () => {
  const [runner, gate] = [...catBatch(ROOT, ['HEAD:scripts/guardian-runner.mjs', 'HEAD:scripts/check-skip-env-promise.mjs']).values()]
  assert.equal(typeof runner, 'string', 'guardian-runner.mjs 在 HEAD 面取不到')
  assert.equal(typeof gate, 'string', 'check-skip-env-promise.mjs 在 HEAD 面取不到')
  const claimedWired = /已接线\(2026-09-30\)/.test(gate)
  const registered = runner.includes("script: 'check-skip-env-promise.mjs'")
  assert.ok(
    claimedWired === registered,
    claimedWired
      ? '门体声称已接线而 runner 无注册块 ⇒ 台账替没发生的事发合格证'
      : '门体声称尚未接线而 runner 已注册 ⇒ 台账倒退,接线被隐藏',
  )
  if (registered) {
    assert.ok(runner.includes("skipEnv: 'HUSKY_SKIP_SKIP_ENV_PROMISE'"), '注册块缺自身应急变量(它同时是 skipEnv 语法的合法读点)')
  }
})

test('F2 两面旗同给 ⇒ 判死(exit 2),不得挑一面的绿', () => {
  assert.equal(faceFromArgv(['--staged', '--worktree']).face, null)
  assert.ok(faceFromArgv(['--staged', '--worktree']).error)
  assert.equal(maskFace('deploy/a.sh', 'echo hi # $HUSKY_SKIP_X').includes('HUSKY_SKIP_X'), false, '脚本行尾注释必须被遮')
})
