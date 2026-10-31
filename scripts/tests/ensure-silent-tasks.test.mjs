// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 幽灵任务判据的构造面测试(2026-10-30):计划任务 action 指向的本地脚本已删除。
 * 只测纯函数(不触 PowerShell/真计划任务),判据与分词三态在构造面即可证。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __test__ as st } from '../ensure-silent-tasks.mjs'

test('① 引号分词:带空格的路径完整成 token', () => {
  assert.deepEqual(st.tokenizeCommand('wscript.exe "G:\\IHUI-AI\\scripts\\a b.vbs"'), [
    'wscript.exe',
    'G:\\IHUI-AI\\scripts\\a b.vbs',
  ])
  assert.deepEqual(st.tokenizeCommand('  node   --check  '), ['node', '--check'])
})

test('② 只认本地绝对路径 + 脚本/可执行扩展名', () => {
  assert.deepEqual(st.localTargetsOf('node "G:\\x\\y.mjs" --flag'), ['G:\\x\\y.mjs'])
  assert.deepEqual(st.localTargetsOf('"%SystemRoot%\\System32\\wscript.exe" z.vbs'), [])
  assert.deepEqual(st.localTargetsOf('node relative.mjs'), [])
  assert.deepEqual(st.localTargetsOf('node "\\\\server\\share\\a.ps1"'), [
    '\\\\server\\share\\a.ps1',
  ])
})

test('③ 目标缺失:注入 exists 构造三态', () => {
  const exists = (p) => p === 'G:\\ok.mjs'
  assert.deepEqual(st.missingTargetsOf('node "G:\\ok.mjs" "G:\\gone.ps1"', exists), [
    'G:\\gone.ps1',
  ])
  assert.deepEqual(st.missingTargetsOf('node "G:\\ok.mjs"', exists), [])
  assert.deepEqual(st.missingTargetsOf('node relative.mjs', exists), [])
})

test('④ 幽灵任务:IHUI 任务目标已删 ⇒ 违规;非 IHUI / 已禁用 ⇒ 不判', () => {
  const tasks = [
    {
      name: 'IHUI-Worktree-Reap',
      state: 'Running',
      actions: [{ exe: 'wscript.exe', args: '"G:\\gone.vbs"' }],
    },
    { name: 'IHUI-Healthy', state: 'Ready', actions: [{ exe: 'node.exe', args: '"G:\\ok.mjs"' }] },
    {
      name: 'IHUI-Disabled',
      state: 'Disabled',
      actions: [{ exe: 'wscript.exe', args: '"G:\\gone.vbs"' }],
    },
    {
      name: 'Other-Ghost',
      state: 'Ready',
      actions: [{ exe: 'wscript.exe', args: '"G:\\gone.vbs"' }],
    },
  ]
  const exists = (p) => p === 'G:\\ok.mjs'
  const v = st.findOrphanTaskViolations(tasks, exists)
  assert.equal(v.length, 1)
  assert.equal(v[0].name, 'IHUI-Worktree-Reap')
  assert.equal(v[0].kind, 'task-orphan')
  assert.match(v[0].detail, /gone\.vbs/)
  assert.deepEqual(
    st.findOrphanTaskViolations(tasks, () => true),
    [],
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
