// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 41（单分支开发）的 §22c 镜像测试。
 *
 * 为什么必须有它（不是补格式）：2026-09-28 该门新增了两类**豁免**判据（在飞窗口内的 PR 分支、
 * `backup/` 与 `ihui-backup/` 备份引用）。豁免类判据最大的风险从来不是"漏放一个违规"，而是
 * ①豁免静默生效（读报告的人以为这一族无人看守）、②有人为消红把当前那几条分支名抄进白名单
 * （名单必然腐烂，AGENTS §4 对 `RN_ONLY_BRAND_KEYS` 记过同型）、③接线本身被并发旧基线写回
 * （"门存在、判据对、无人调度"是本仓最高频失效型）。这三条 `--self-test` 结构上抓不到，
 * 因为自检只证明"函数会给答案"，不证明"有人在提交链上问它"。
 *
 * 判据一律 `import` 门体导出的 `__test__`，**禁止**在本文件复制第二份实现（AGENTS §22c）。
 * 断言不依赖仓库当下的分支状态 —— 分支集合是机器态，把它当恒定前提会让本测试在别人开 PR 时
 * 随机翻红（AGENTS §12e"与改动无关的恒红门"同型）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ } from '../check-single-branch.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const GATE_SRC = readFileSync(join(HERE, '..', 'check-single-branch.mjs'), 'utf8')
const RUNNER_SRC = readFileSync(join(HERE, '..', 'guardian-runner.mjs'), 'utf8')

const { branchTipTimes, inFlightExempt, mirrorRemoteSet, nonLocalExempt } = __test__
const HOUR = 3600000
const NOW = 1_800_000_000_000

/**
 * 从注册表里按**大括号配对**取出本门那一条注册项 —— 不能取"脚本名前后各 N 字符"，
 * 那样会跨进邻门的条目（守门 136 的 T2 记过同型：别人有 blocking 就算我有）。
 * @returns {string|null} 取不到返回 null，由调用方判"未装车"，绝不静默当成通过。
 */
function entryOf(source, scriptName) {
  const at = source.indexOf(`script: '${scriptName}'`)
  if (at < 0) return null
  const open = source.lastIndexOf('{', at)
  if (open < 0) return null
  let depth = 0
  for (let i = open; i < source.length; i++) {
    const ch = source[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return source.slice(open, i + 1)
    }
  }
  return null
}

test('T1 装车证明：守门 41 在注册表里是 blocking，且本门编号在 runner 中恰好出现一次', () => {
  const entry = entryOf(RUNNER_SRC, 'check-single-branch.mjs')
  assert.ok(entry, '注册表里取不到 check-single-branch.mjs ⇒ 门没接进提交链（不是"通过"）')
  assert.match(entry, /mode:\s*'blocking'/, '本门定级被改动：它必须是 blocking（§9b 的拦截力就在这）')
  const ids = [...RUNNER_SRC.matchAll(/^\s*id:\s*'41',/gm)].length
  assert.equal(ids, 1, `id '41' 在 runner 中出现 ${ids} 次（撞号会串 skipEnv 与失败归属）`)
})

test('T2 反向锁：应急跳过通道不得是文档幻觉 —— 声明了 skipEnv 就必须真被门读取', () => {
  const entry = entryOf(RUNNER_SRC, 'check-single-branch.mjs')
  assert.ok(entry, '前置同 T1')
  const m = entry.match(/skipEnv:\s*'([^']+)'/)
  if (!m) {
    // 没有 skipEnv = 本门刻意不给应急出口。此时门体与注释都不得声称有那条出路。
    assert.doesNotMatch(
      GATE_SRC,
      /HUSKY_SKIP_[A-Z_]*BRANCH[A-Z_]*/,
      'runner 未声明 skipEnv，而门体里出现了同类环境变量名 ⇒ 有人写了跑不通的出路',
    )
    return
  }
  assert.ok(
    GATE_SRC.includes(m[1]),
    `runner 声明 skipEnv=${m[1]} 而门体从不读它 ⇒ 假出路（守门 46/11c/50 同型事故）`,
  )
})

test('T3 形状锁：两条豁免判据必须由门体导出，供本文件与自测共用一份实现', () => {
  assert.ok(
    typeof branchTipTimes === 'function' && typeof inFlightExempt === 'function',
    '豁免逻辑若不再经 __test__ 导出，镜像测试就只能复制一份判据 —— 复制的那份必然跟着漂（§22c）',
  )
  assert.match(GATE_SRC, /export const __test__ = \{[^}]*inFlightExempt[^}]*\}/, '__test__ 丢了 inFlightExempt')
  assert.equal(inFlightExempt('backup/x', new Map(), NOW, 48), 'backup', '导出对象里的必须是那一份实现')
})

test('T4 在飞窗口边界：窗口内豁免、超窗必判（豁免不得变成永久放行）', () => {
  const tips = branchTipTimes(
    [
      `fresh ${Math.floor((NOW - 5 * HOUR) / 1000)}`,
      `edge ${Math.floor((NOW - 48 * HOUR) / 1000)}`,
      `over ${Math.floor((NOW - 49 * HOUR) / 1000)}`,
    ].join('\n'),
  )
  assert.equal(inFlightExempt('fresh', tips, NOW, 48), 'in-flight')
  assert.equal(inFlightExempt('edge', tips, NOW, 48), 'in-flight', '恰好等于窗口应按"仍在飞"（实现用 <=）')
  assert.equal(inFlightExempt('over', tips, NOW, 48), null, '超窗必须回到原判据 —— 这条红就是本门存在的理由')
})

test('T5 origin/ 镜像与本地同名分支同视（否则只豁免了一半）', () => {
  const tips = branchTipTimes(`ci-fix/x ${Math.floor((NOW - 3 * HOUR) / 1000)}`)
  assert.equal(inFlightExempt('ci-fix/x', tips, NOW, 48), 'in-flight')
  // 表里只记了本地那份时，origin 那份取不到时刻 ⇒ 不豁免（宁误拦，不静默放行）
  assert.equal(inFlightExempt('origin/ci-fix/x', tips, NOW, 48), null)
  const both = branchTipTimes(
    [`ci-fix/y ${Math.floor((NOW - 3 * HOUR) / 1000)}`, `origin/ci-fix/y ${Math.floor((NOW - 3 * HOUR) / 1000)}`].join('\n'),
  )
  assert.equal(inFlightExempt('origin/ci-fix/y', both, NOW, 48), 'in-flight')
})

test('T6 备份引用永不判红且不看时刻（§5b 禁删备份 / §22 要求双留，门不得喊人删它们）', () => {
  const ancient = branchTipTimes('backup/ancient 1700000000')
  assert.equal(inFlightExempt('backup/ancient', ancient, NOW, 0), 'backup', '窗口收到 0 也不得把备份引用判红')
  assert.equal(inFlightExempt('origin/ihui-backup/main-x', new Map(), NOW, 48), 'backup')
  assert.equal(inFlightExempt('feature/other', new Map([['feature/other', 1700000000]]), NOW, 48), null)
})

test('T7 取不到时刻一律不豁免（失效方向必须是"多拦"，绝不是"多放"）', () => {
  const tips = branchTipTimes(`listed ${Math.floor((NOW - 1 * HOUR) / 1000)}`)
  assert.equal(inFlightExempt('never-listed', tips, NOW, 48), null)
  assert.equal(inFlightExempt('listed', tips, Number.NaN, 48), null, 'nowMs 不是有限数 ⇒ 不豁免')
  assert.equal(inFlightExempt('listed', new Map(), NOW, 48), null, '整表取不到 ⇒ 在飞豁免必须整体失效')
})

test('T8 时刻表解析：坏行跳过不猜（一次坏行不得把别的分支的豁免顶掉）', () => {
  const tips = branchTipTimes(
    [
      `good ${Math.floor((NOW - 2 * HOUR) / 1000)}`,
      'garbage-line',
      '',
      'broken not-a-number',
      `  padded ${Math.floor((NOW - 2 * HOUR) / 1000)}  `,
    ].join('\n'),
  )
  assert.equal(tips.size, 2)
  assert.ok(tips.has('good') && tips.has('padded'))
  assert.equal(branchTipTimes(null).size, 0, 'null/undefined 输入必须得空表，而不是抛')
})

test('T9 报名锁：两类豁免都必须逐条点名，静默豁免等于没有这一维', () => {
  const printed = (GATE_SRC.match(/不判但如实报数/g) || []).length
  assert.ok(printed >= 3, `门体只在结论里打印了 ${printed} 处"不判但如实报数"（应含镜像/幻影/在飞/备份各档）`)
  assert.match(GATE_SRC, /exempt\['in-flight'\]\.length/, '在飞豁免没有报名分支 ⇒ 有人会把"绿"读成"没有旁支"')
  assert.match(GATE_SRC, /exempt\.backup\.length/, '备份豁免没有报名分支 ⇒ 同上')
  assert.match(GATE_SRC, /提交时刻取不到/, '取不到时刻必须喊出来，不得静默降级成"没有旁支"')
})

test('T10 反白名单锁：豁免必须由"前缀 + 提交时刻"算出，不得抄当前那几条分支名', () => {
  for (const banned of ['ci-green-sweep', 'star-thank-autoclose', 'nightly-single-tracker', 'api-n8n-ownership']) {
    assert.ok(!GATE_SRC.includes(banned), `门体里出现了具体分支名 ${banned} ⇒ 有人用白名单消红，名单必然腐烂`)
  }
  assert.match(GATE_SRC, /BACKUP_REF_PREFIXES\s*=\s*\[[^\]]*'backup\/'/, '备份豁免应按键名前缀判')
})

test('T11 在飞窗口取值：环境变量坏值不得变成 Infinity 或负数（那等于关掉判据）', () => {
  assert.match(GATE_SRC, /IHUI_SINGLE_BRANCH_GRACE_HOURS/, '窗口必须可调（CI 与本地节奏不同）')
  assert.match(GATE_SRC, /GRACE_HOURS_DEFAULT\s*=\s*48/, '缺省值写在源码里，文档不得另抄一份')
  assert.match(GATE_SRC, /Number\.isFinite\(n\)\s*&&\s*n\s*>=\s*0/, '坏值必须回落默认，而不是让 `--grace=abc` 变成永不判红')
})

test('T12 既有豁免族不得被新判据吞掉：goal 分支仍要 STATE.md 标注才合法', () => {
  assert.match(GATE_SRC, /isActiveGoalBranch/, 'goal/ 豁免通道被摘 ⇒ 正在跑 /goal 的会话会被本门顶红')
  assert.match(GATE_SRC, /goal-runtime\/STATE\.md/, 'goal 豁免的凭据是那份 STATE.md，不是前缀本身')
  assert.ok(
    typeof mirrorRemoteSet === 'function' && typeof nonLocalExempt === 'function',
    '镜像远端/幻影引用两类既有豁免的判据必须仍可测（§22c）',
  )
})

test('T13 反向锁：self-test 的登记函数必须对"函数形态用例"求值（恒绿断言比没有断言更糟）', () => {
  // 2026-09-28 实测过的失效形态：`const t = (name, ok) => cases.push([name, !!ok])` 而 13 条用例
  // 全部传 `() => …` ⇒ `!!fn` 恒真 ⇒ self-test 一路报"13/13 通过"，而它连一条都没判过。
  // 该形态下的 grace 除数单位错（48h 实际 ~5.5 年，反向对照永不触发）就是被它掩盖的。
  assert.doesNotMatch(
    GATE_SRC,
    /const t = \(name, ok\) => cases\.push\(\[name, !!ok\]\)/,
    'self-test 退化成"收函数就报绿"—— 这一整维看守当场失效且毫无声响',
  )
  assert.match(GATE_SRC, /typeof ok === 'function' \? Boolean\(ok\(\)\)/, '登记函数必须真的求值用例')
  assert.equal(selfTestReturnsZero(), 0, 'self-test 现读必须真通过（返回码非 0 = 有用例真红）')
})

/** 跑门自带的 self-test，只取其返回码（它自己打印到 stdout，本测试不转述内容）。 */
function selfTestReturnsZero() {
  const r = spawnSync(process.execPath, [join(HERE, '..', 'check-single-branch.mjs'), '--self-test'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
  })
  return r.status === 0 ? 0 : 1
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
