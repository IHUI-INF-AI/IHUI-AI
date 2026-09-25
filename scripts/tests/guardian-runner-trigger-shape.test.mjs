// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门注册表形状回归:stagedTriggers 写错形状会**崩掉整个 guardian-runner**,
// 而崩掉的表现不是"某道门红",是"pre-commit 拿不到任何汇总 ⇒ 各会话一律 --no-verify 兜底
// ⇒ 全部门对全队同时失效"(§12e 那一型的加重版:红门还会喊,崩了只剩一句"提前退出")。
// 2026-09-25 由本会话的提交实测踩到:HEAD 里三道门把它写成字符串。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const src = () => readFileSync(join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')

test('每一条 stagedTriggers 声明都必须是数组(字符串会让 stagedPathsTouch 抛 TypeError)', () => {
  const s = src()
  const bad = []
  for (const m of s.matchAll(/stagedTriggers:\s*([^\n]*)/g)) {
    const val = m[1].trim()
    if (!val.startsWith('[')) bad.push(val.slice(0, 60))
  }
  assert.deepEqual(bad, [], `这些 stagedTriggers 不是数组:${bad.join(' | ')}`)
  // 反向锁:确实有门在用它,否则本断言会因为"一条都没有"而空转成绿
  assert.ok(
    /stagedTriggers:\s*\[/.test(s),
    'runner 里一条数组形态的 stagedTriggers 都没有 ⇒ 本测试失去意义,判据面被改了',
  )
})

test('stagedTriggers 的消费侧必须过归一化,且形状不认时判"要跑"而不是抛/跳过', () => {
  const s = src()
  assert.match(
    s,
    /function normalizeTriggers\(/,
    '归一化出口被删了 —— 旧写法 prefixes.some(...) 会在新门写错形状时当场崩',
  )
  // 判序:normalizeTriggers 返回 null 时必须 return true(恒跑),不得 return false(静默跳过)
  assert.match(
    s,
    /if \(list === null \|\| list\.length === 0\) return true/,
    '形状不认必须"宁跑不跳";判成跳过等于给写错形状的门开永久免检',
  )
  // 打印侧同样不得假设数组(同一处崩过两次:判据侧修了、日志行还是 .join)
  assert.ok(
    !/check\.stagedTriggers\.join\(/.test(s),
    '日志行直接对 check.stagedTriggers 调 .join ⇒ 字符串形态在跳过路径上照样崩',
  )
})

test('真仓暂存面必须能跑完一轮而不崩(端到端装车证明)', async () => {
  const { execFileSync } = await import('node:child_process')
  // 用一份**受控的暂存清单**驱动 runner:含 scripts/ 与 packages/ 前缀,恰好覆盖三道曾崩的门
  // 的触发面。runner 以 --staged 跑,任何 TypeError 都会以非零/异常形态暴露。
  let out = ''
  let code = 0
  try {
    out = execFileSync(process.execPath, [join(ROOT, 'scripts', 'guardian-runner.mjs'), '--staged'], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 900000,
      maxBuffer: 1 << 26,
      env: { ...process.env, GUARDIAN_ONLY: '' },
    })
  } catch (e) {
    out = String(e.stdout || '') + String(e.stderr || '')
    code = typeof e.status === 'number' ? e.status : -1
  }
  assert.ok(
    !/prefixes\.some is not a function|TypeError:.*is not a function/.test(out),
    `runner 仍因形状崩掉(exit ${code}):\n${out.slice(-400)}`,
  )
  // 门确实跑了(有汇总行),而不是"提前退出 ⇒ 归因未计算"
  assert.match(
    out,
    /通过|失败|跳过/,
    `runner 没产出守门汇总(exit ${code}),这正是把提交推去 --no-verify 的那个形态:\n${out.slice(-400)}`,
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
