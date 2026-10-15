// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-322「带值旗标吞掉紧邻旗标」CLI 端到端探针(2026-10-15 收口批)。
// 判据本体单源在 scripts/lib/flag-value.mjs(其语义档见 flag-value.test.mjs);
// 本文件只做端到端:各站 CLI 喂三支坏值,断言**各自**非零退出且输出点名实得 token。
// 正例(默认档行为逐字不变)由各站既有套件锁 —— 本文件不重复。
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..', '..')
const S = (name) => resolve(ROOT, 'scripts', name)

/** 三支坏值:args = 实际喂给 CLI 的参数;expect = 必须出现在输出里的实得 token 文案。 */
const BAD_ARMS = [
  { args: ['--root', '--staged'], expect: '"--staged"' },
  { args: ['--root'], expect: '(其后没有任何参数)' },
  { args: ['--root', ''], expect: '""' },
]

/** 三支坏值各自:rc 非零 + 输出点名 `--root 需要一个目录参数` + 点名实得 token。 */
function assertBadRoot(script) {
  for (const { args, expect } of BAD_ARMS) {
    const r = spawnSync(process.execPath, [script, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
    })
    assert.notEqual(r.status, 0, `${script} ${JSON.stringify(args)} 不得静默通过(普查 B 档那一型)`)
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    assert.match(out, /--root 需要一个目录参数/, `${script} 必须点名用法:${out.slice(0, 200)}`)
    assert.match(
      out,
      new RegExp(expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `${script} 必须点名实得 token(三态分开,只测一支会留洞):${out.slice(0, 200)}`,
    )
    assert.doesNotMatch(out, /ERR_INVALID_ARG_TYPE|at ModuleJob/, `${script} 不得以裸栈当用法错出口:${out.slice(0, 200)}`)
  }
}

test('G-322 收口批:六站三支坏值各自大声拒绝', () => {
  assertBadRoot(S('check-principal-consumed.mjs'))
  assertBadRoot(S('check-scratch-root-no-nesting.mjs'))
  assertBadRoot(S('check-workspace-hygiene.mjs'))
  assertBadRoot(S('scan-hardcoded-zh.mjs'))
  assertBadRoot(S('plan-tasks.mjs'))
})

test('G-322 收口批:module-context 的 --face/--policy 漏值与空串各自拒绝', () => {
  const script = S('module-context.mjs')
  // `--face/--policy --staged`(值被下一旗标顶掉)在更早的"未知开关"检查就已大声拒绝(既有 A 形态),
  // 这里只锁本票要修的另外两支:结尾无值 / 空串 —— 旧写法这两支都静默落默认档还报 ✅。
  for (const flag of ['--face', '--policy']) {
    for (const args of [[flag], [flag, '']]) {
      const r = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
      assert.notEqual(r.status, 0, `module-context ${JSON.stringify(args)} 不得静默落默认档`)
      const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
      assert.match(out, new RegExp(`${flag} 需要一个值`.replace(/-/g, '\\-')), out.slice(0, 200))
    }
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
