// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守护「lint-staged stdio 三针盯针」派发点的镜像测试(§22c:import 源模块 __test__,零复制判据)。
//
// 立因(票面现读):三针由 `scripts/lib/patch-lint-staged-stdio.mjs` 写进 node_modules,postinstall 不重打、
// 也没有任何调度器盯 ⇒ 一次 `pnpm install` 就把 G-53/G-63 刚消解的 lint-staged 死法放回原状,而失效方向是安静的
// (钩子照跑,下次提交才以 errno 面目复现)。盯针门 `scripts/check-lint-staged-stdio-pin.mjs` 早在,但
// `grep -c check-lint-staged-stdio-pin scripts/guardian-runner.mjs scripts/git-guardian.mjs` 现读 0/0 ——
// 尺子在、判据对、账面全绿,而它无人调度(§0.9 造好没装车 = 没有)。
//
// 本测试钉两件事:
//   (a) 接线锁:2026-09-29 曾有提交把 git-guardian.mjs 整份写回旧基线、净删 1552 行,把已装好的巡检派发点连带抹掉
//       而账面全绿 ⇒ 函数存在、被调用(定义 1 + 调用 ≥1)、挂在 `!CHECK_ONLY` 真正会执行的分支、daemon tick 同挂;
//   (b) 三档行为:green 只写日志 / gap 逐条点名 + 到人(身份常量)/ 未判定只写日志不喊人 ——
//       把"没判"写成"判过了"是本仓最高频失效型,反过来"判出缺口却不喊人"也一样。
// 全部构造输入 + 假 runner + 假 notify ⇒ 零真派生、零真邮件、零活仓库副作用。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as G } from '../git-guardian.mjs'
import { parsePinCheckLine, verdictOf, gapDetail } from '../lib/lint-staged-pin-audit.mjs'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const NOW = 1_700_000_000_000
const MIN = 60_000
const GREEN_LINE = 'PIN-CHECK-RESULT state=green pins=3 script=G:\\IHUI-AI\\scripts\\lib\\patch-lint-staged-stdio.mjs'
const GAP_LINE =
  'PIN-CHECK-RESULT state=gap missing=execGit.js:replace-nodeOptions,getSpawnedTask.js:inject-tinyExecOptions script=G:\\IHUI-AI\\scripts\\lib\\patch-lint-staged-stdio.mjs'
const UNDET_LINE =
  'PIN-CHECK-RESULT state=undetermined reason=读不到 lint-staged 安装副本(node_modules 不在 / 依赖没装 / 版本目录漂移)——未判定,不记绿也不冒红 script=G:\\IHUI-AI\\scripts\\lib\\patch-lint-staged-stdio.mjs'

/** 读守护源码:交付面 = 工作树(本次改动尚未入库),取不到再退 HEAD(两面都取不到 ⇒ 测试自己红)。 */
function guardianSource() {
  return readFileSync(join(REPO_ROOT, 'scripts', 'git-guardian.mjs'), 'utf8')
}

function libSource() {
  return readFileSync(join(REPO_ROOT, 'scripts', 'lib', 'lint-staged-pin-audit.mjs'), 'utf8')
}

function harness(call, extra = {}) {
  const dir = mkScratch('gg-lint-staged-pin-')
  const logs = []
  const mails = []
  let calls = 0
  return {
    dir,
    logs,
    mails,
    get calls() {
      return calls
    },
    run(over = {}) {
      return G.auditLintStagedPins({
        now: NOW,
        intervalMs: 0,
        tickFile: join(dir, 'tick.json'),
        logger: (m) => logs.push(String(m)),
        notify: (title, desp, opts) => {
          mails.push({ title, desp, opts })
          return { sent: true }
        },
        runner: () => {
          calls++
          return call
        },
        ...extra,
        ...over,
      })
    },
  }
}

test('(a1)接线锁:函数存在且被调用(定义 1 + 调用 ≥1),并挂在 !CHECK_ONLY 分支', () => {
  const src = guardianSource()
  const defs = src.match(/export function auditLintStagedPins\(/g) || []
  assert.equal(defs.length, 1, `定义必须恰好一处,实得 ${defs.length}`)
  const all = src.match(/auditLintStagedPins\(/g) || []
  assert.ok(all.length >= 2, `函数名至少出现 2 次(定义 1 + 调用 1),实得 ${all.length} —— 摘掉调用行即本测试翻红`)
  const mainHook = /^ {4}if \(!CHECK_ONLY\) auditLintStagedPins\(\)$/m
  assert.ok(mainHook.test(src), 'main() 挂点必须是 `if (!CHECK_ONLY) auditLintStagedPins()` —— 挂进 CHECK_ONLY 早退分支等于永不执行')
  const opsIdx = src.indexOf('if (!CHECK_ONLY) auditOpsPatrol()')
  const mineIdx = src.indexOf('if (!CHECK_ONLY) auditLintStagedPins()')
  assert.ok(opsIdx > -1 && mineIdx > opsIdx, '挂点必须与 auditOpsPatrol 同段(顺序:元运维巡检之后)')
  assert.ok(/^ {8}auditLintStagedPins\(\)$/m.test(src), 'daemon tick 那条腿也必须挂上(本机实际载体是 nssm 跑 --daemon)')
  assert.ok(/^const PIN_TICK = join\(WORKTREE, '\.ihui-agent', 'state', 'lint-staged-pin-tick\.json'\)$/m.test(src), '节流戳必须是常量路径')
  assert.ok(/export const __test__ = \{[\s\S]*?\n {2}auditLintStagedPins,/m.test(src), '派发点必须经 __test__ 暴露给镜像测试')
})

test('(a2)接线锁:spawn 目标含 check-lint-staged-stdio-pin.mjs,且派生进程三件套齐备', () => {
  const src = libSource()
  assert.ok(src.includes("'check-lint-staged-stdio-pin.mjs'"), '尺子落点必须逐字点名(摘掉即无尺可派)')
  assert.ok(/execFileSync\(process\.execPath, \[script\]/.test(src), '必须以 process.execPath 派生、不吃 shell')
  assert.ok(/windowsHide: true/.test(src), '§5b:漏 windowsHide 在计划任务/守护下必弹控制台窗')
  assert.ok(/timeout: timeoutMs/.test(src), '守门 80:热路径派生一律带上限')
  assert.ok(/stdio: \['ignore', 'pipe', 'pipe'\]/.test(src), '§12g:派生进程必须显式接管 stdio')
  assert.ok(guardianSource().includes("from './lib/lint-staged-pin-audit.mjs'"), '守护必须 import 该实现(而不是另抄一份)')
})

test('(b1)green ⇒ 只写一行健康日志,绝不喊人', () => {
  const h = harness({ status: 0, stdout: `${GREEN_LINE}\n`, stderr: '' })
  try {
    const r = h.run()
    assert.equal(r.verdict, 'green')
    assert.equal(r.pins, 3)
    assert.equal(h.mails.length, 0, '三针齐却发信 = 判据被写死')
    assert.ok(h.logs.some((l) => l.includes('✅') && l.includes('三针齐')), '绿也必须报名(不得静默成"没跑")')
  } finally {
    rmScratch(h.dir)
  }
})

test('(b2)gap ⇒ 逐条点名 + 到人,身份常量不带计数', () => {
  const h = harness({ status: 1, stdout: `${GAP_LINE}\n`, stderr: '' })
  try {
    const r = h.run()
    assert.equal(r.verdict, 'gap')
    assert.equal(r.missing, 2)
    assert.equal(h.mails.length, 1, `判出缺口必须到人,实寄 ${h.mails.length}`)
    const m = h.mails[0]
    assert.equal(m.title, 'lint-staged stdio 三针缺口')
    assert.doesNotMatch(m.title, /\d/, '身份里不得出现数字(每轮换身份 = 去重永不命中)')
    assert.ok(m.desp.includes('execGit.js:replace-nodeOptions'), '正文必须逐条点名缺哪一针')
    assert.ok(m.desp.includes('getSpawnedTask.js:inject-tinyExecOptions'), '正文必须逐条点名缺哪一针')
    assert.ok(m.desp.includes('node scripts/lib/patch-lint-staged-stdio.mjs'), '出路必须给能动手的那一下(§5e-1)')
    assert.equal(m.opts?.dedupKey, 'lint-staged-stdio-pin-gap', '必须给稳定 dedupKey')
    assert.ok(h.logs.some((l) => l.includes('❌')))
  } finally {
    rmScratch(h.dir)
  }
})

test('(b3)未判定 ⇒ 只写日志点名原因,绝不喊人', () => {
  const h = harness({ status: 2, stdout: `${UNDET_LINE}\n`, stderr: '' })
  try {
    const r = h.run()
    assert.equal(r.verdict, 'undetermined')
    assert.equal(h.mails.length, 0, '未判定不得喊人(§12e:与提交内容无关的恒响只会废掉通道)')
    assert.ok(h.logs.some((l) => l.includes('未判定')), '未判定必须报名,不得静默')
    assert.ok(h.logs.some((l) => l.includes('node_modules')), '原因必须点到面上(哪一档没判出来)')
  } finally {
    rmScratch(h.dir)
  }
})

test('(b4)矛盾态/无收尾行:读数与 rc 打架一律未判定;rc=1 但收尾行丢了仍报缺口', () => {
  const h1 = harness({ status: 0, stdout: `${GAP_LINE}\n`, stderr: '' })
  const h2 = harness({ status: 1, stdout: '', stderr: 'boom' })
  const h3 = harness({ status: 0, stdout: '', stderr: '' })
  try {
    assert.equal(h1.run().verdict, 'undetermined', 'rc=0 却报缺口 ⇒ 矛盾,不得读成绿')
    assert.equal(h1.mails.length, 0)
    assert.equal(h2.run().verdict, 'gap', 'rc=1 是尺子明说缺口(不是"没判")⇒ 必须报缺口')
    assert.equal(h2.mails.length, 1)
    assert.ok(h2.mails[0].desp.includes('点位清单没取到'), '点名清单取不到时正文必须写明退化形态')
    assert.equal(h3.run().verdict, 'undetermined', 'rc=0 但无任何收尾行 ⇒ 未判定,不得记绿')
    assert.equal(h3.mails.length, 0)
  } finally {
    rmScratch(h1.dir)
    rmScratch(h2.dir)
    rmScratch(h3.dir)
  }
})

test('(b5)节流:未到窗口绝不派生;尺子不在位 ⇒ ran:false 且不记为已巡检', () => {
  const h = harness({ status: 0, stdout: `${GREEN_LINE}\n`, stderr: '' })
  try {
    const first = h.run({ intervalMs: 45 * MIN })
    assert.equal(first.verdict, 'green')
    assert.equal(h.calls, 1)
    const second = h.run({ intervalMs: 45 * MIN })
    assert.deepEqual(second, { ran: false, why: '未到节流窗口' }, '一个窗口内不得重复派生')
    assert.equal(h.calls, 1, '未到窗口绝不 spawn(节流是节奏不是封量)')
    const noScript = h.run({ intervalMs: 0, scriptPath: join(h.dir, 'nope.mjs') })
    assert.deepEqual(noScript, { ran: false, why: '尺子不在位' })
    assert.equal(h.logs.some((l) => l.includes('不记为已巡检')), true, '跳过必须留一行,不得静默')
  } finally {
    rmScratch(h.dir)
  }
})

test('(b6)纯函数单源:解析/裁决/正文都从 lib 取,三档映射与尺子退出码一一对应', () => {
  assert.deepEqual(parsePinCheckLine(GREEN_LINE), { state: 'green', pins: 3, missing: [], reason: '' })
  assert.equal(parsePinCheckLine('随便一行'), null)
  const gap = parsePinCheckLine(GAP_LINE)
  assert.deepEqual(gap.missing, ['execGit.js:replace-nodeOptions', 'getSpawnedTask.js:inject-tinyExecOptions'])
  assert.ok(parsePinCheckLine(UNDET_LINE).reason.includes('未判定'))
  assert.equal(verdictOf({ rc: 0, parsed: { state: 'green' } }), 'green')
  assert.equal(verdictOf({ rc: 1, parsed: { state: 'gap', missing: [] } }), 'gap')
  assert.equal(verdictOf({ rc: 2, parsed: { state: 'undetermined' } }), 'undetermined')
  assert.equal(verdictOf({ rc: 0, parsed: null }), 'undetermined')
  assert.ok(gapDetail({ rc: 1, missing: [] }).includes('点位清单没取到'))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
