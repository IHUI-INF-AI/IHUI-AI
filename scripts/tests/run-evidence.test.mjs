// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
/**
 * 镜像测试:scripts/run-evidence.mjs(取证包装器)。
 *
 * 为什么不复制判据(§22c):`judgeEvidence` / `exitCodeForVerdict` 直接从源文件 import。
 * 一旦测试里抄一份,源实现改了而测试仍绿 ⇒ 测试从防线变成缺陷的掩体(本仓记过多次)。
 *
 * 为什么这个文件必须存在:该工具文件名不以 `check|scan|guard` 开头 ⇒ 守门 89 的候选集
 * **结构上看不见它**(同 `scripts/c-disk-breakdown.mjs` 那一格的处置),所以它的不变量
 * 只能由"自己的自检 + 本镜像"两道钉住。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const TOOL = resolve(ROOT, 'scripts', 'run-evidence.mjs')
const gate = await import(`file://${TOOL}`)

test('T1 __test__ 必须把判定纯函数 export 出来(§22c:镜像不许拿第二份真相跑断言)', () => {
  const t = gate.__test__
  assert.equal(typeof t, 'object', '源文件必须 export const __test__')
  assert.equal(typeof t.judgeEvidence, 'function', '__test__ 缺 judgeEvidence')
  assert.equal(typeof t.exitCodeForVerdict, 'function', '__test__ 缺 exitCodeForVerdict')
  assert.equal(typeof t.RC_MARK, 'string', '__test__ 缺 RC_MARK')
  // 测试文件内不得出现第二份**判定实现**(声明式正则;写函数名字符串会匹配到断言自己那行)
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.ok(!/^(?:export\s+)?function\s+judgeEvidence\s*\(/m.test(self), '镜像里出现了第二份 judgeEvidence 实现')
})

test('T2 三态各自成立,且"没跑到"与"跑失败"不可能混为一谈', () => {
  const { judgeEvidence: j, exitCodeForVerdict: e, RC_MARK: M, KILLED_MARK: K } = gate.__test__
  assert.deepEqual(
    [j(`${M}0`).kind, j(`${M}1`).kind, j('半截 stdout').kind, j(`${K}: SIGTERM`).kind, j('').kind],
    ['complete', 'complete', 'truncated', 'killed', 'missing'],
  )
  // 关键不等式:RC=1 与 截断,退出码必须不同(1 vs 3) —— 否则本工具失去意义
  assert.equal(e(j(`${M}1`)), 1, '业务失败应给 1')
  assert.equal(e(j('半截 stdout')), 3, '截断必须给 3,不得给 0/1')
  assert.equal(e(j(`${M}0`)), 0)
})

test('T3 阳性对照:半截证据绝不得被读成通过(把判据改成恒 complete 时本条必红)', () => {
  const { judgeEvidence: j, exitCodeForVerdict: e, RC_MARK: M } = gate.__test__
  const truncated = j(`#EVIDENCE-CMD: x\n#EVIDENCE-START: t\n只有一行`)
  assert.notEqual(truncated.kind, 'complete')
  assert.notEqual(e(truncated), 0)
  assert.notEqual(e(truncated), 1, '截断不得与业务失败同码 —— 那正是本次要根治的混淆')
  // 反向:有标记但内容坏了,也不得猜成 0
  assert.equal(e(j(`${M}yes`)), 3, 'RC 内容非整数必须判 malformed→3,不得猜')
})

test('T4 CRLF 与多条标记:Windows 取证件不得因换行/续写被误判', () => {
  const { judgeEvidence: j, RC_MARK: M } = gate.__test__
  assert.equal(j(`x\r\n${M}0\r\n`).kind, 'complete')
  assert.equal(j(`${M}1\nagain\n${M}0`).rc, 0, '重试续写时以最后一条为准')
})

test('T5 该工具刻意不接提交链 —— 注册表里不得出现它(它是取证出口,不是判据)', () => {
  const runner = readFileSync(resolve(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  assert.ok(
    !runner.includes('run-evidence.mjs'),
    'run-evidence 被当成守门接进提交链 ⇒ 每次提交都被"取证包装器"判红,正是本仓恒红门那型',
  )
})

test('T6 端到端装车证明:CLI 真跑 --self-test 必须 17 条全绿且 rc=0', () => {
  const out = execFileSync(
    process.execPath,
    [TOOL, '--self-test'],
    { encoding: 'utf8', cwd: ROOT, windowsHide: true, timeout: 300_000, maxBuffer: 32 << 20 },
  )
  const m = /run-evidence --self-test:(\d+)\/(\d+) 通过/.exec(out)
  assert.ok(m, `自检末行没出现,输出尾部:${out.slice(-160)}`)
  assert.equal(m[1], m[2], '自检有未通过项')
  assert.ok(Number(m[2]) >= 15, `自检条数回落到 ${m[2]},低于本工具的最少判据集`)
  assert.ok(!/❌/.test(out), '自检输出里出现红叉')
})

test('T7 被包装命令的 RC 会原样传给调用方(0/非 0 两臂)', () => {
  const okFile = resolve(ROOT, '.ihui-agent', 'tmp', 'mirror-run-ok.txt')
  const badFile = resolve(ROOT, '.ihui-agent', 'tmp', 'mirror-run-bad.txt')
  try {
    execFileSync(
      process.execPath,
      [TOOL, okFile, '--', process.execPath, '-e', 'process.exit(0)'],
      { cwd: ROOT, windowsHide: true, timeout: 120_000, stdio: 'ignore' },
    )
    const txt = readFileSync(okFile, 'utf8')
    assert.ok(/#EVIDENCE-RC=0/.test(txt), '成功臂没落 RC 行')
    let threw = null
    try {
      execFileSync(
        process.execPath,
        [TOOL, badFile, '--', process.execPath, '-e', 'process.exit(5)'],
        { cwd: ROOT, windowsHide: true, timeout: 120_000, stdio: 'ignore' },
      )
    } catch (e) {
      threw = e.status
    }
    assert.equal(threw, 1, '被包装命令失败时本工具必须非 0(把真实失败传出去,不能吞)')
    assert.ok(/#EVIDENCE-RC=5/.test(readFileSync(badFile, 'utf8')), '证据里必须留下真实 RC=5')
  } finally {
    for (const f of [okFile, badFile]) {
      try {
        rmSync(f, { force: true })
      } catch {
        /* 清不掉由 T8 那条统一判 */
      }
    }
  }
})

test('T8 证据件由工具自己清理:自检跑完不得在 tmp 留残留取证件', () => {
  execFileSync(process.execPath, [TOOL, '--self-test'], {
    cwd: ROOT,
    windowsHide: true,
    timeout: 300_000,
    stdio: 'ignore',
  })
  const left = ['evidence-selftest-ok.txt', 'evidence-selftest-fail.txt', 'evidence-selftest-killed.txt'].filter((f) =>
    existsSync(resolve(ROOT, '.ihui-agent', 'tmp', f)),
  )
  assert.deepEqual(left, [], '自检留下取证件 ⇒ 会被下一个人误当成本轮证据')
})
