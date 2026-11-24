// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 幽灵任务判据的构造面测试(2026-10-30):计划任务 action 指向的本地脚本已删除。
 * 只测纯函数(不触 PowerShell/真计划任务),判据与分词三态在构造面即可证。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

// 接线形状锁(本仓反复踩过「判据在、工具在、没人调度」= 没有):锚点禁地这一型必须真的接在
// audit() 的任务循环里,而且必须排在 LogonType 豁免之前、同时问 Execute 与参数。
// 今天的一手病形态就是「任务 action 面看着正常、第三方捆绑 node 藏在参数里」,
// 只判 a.exe 的写法对这种形态整型失明。
test('锚点禁地判据已接进 audit(),且排在 S4U 豁免之前、两半都问', () => {
  const src = readFileSync(new URL('../ensure-silent-tasks.mjs', import.meta.url), 'utf8')
  assert.match(
    src,
    /import \{ findThirdPartyNodeToken \} from '\.\/lib\/task-node-anchor\.mjs'/,
    '锚点判据必须 import 单源,不得在巡检器里另写一份目录清单(§0.6)',
  )
  const body = src.slice(src.indexOf('export function audit'))
  const at = body.indexOf('findThirdPartyNodeToken(')
  assert.ok(at > 0, 'audit() 内必须调用 findThirdPartyNodeToken')
  const s4uSkip = body.indexOf('if (/s4u|password|serviceaccount|group/i.test(t.logon)) continue')
  assert.ok(s4uSkip > 0, '基准行没找到 ⇒ 本锁的排序断言失效,请同步改测试')
  assert.ok(at < s4uSkip, '锚点检查不得排在 S4U 豁免之后:S4U 任务同样会被捆绑 node 拖停')
  assert.match(
    body,
    /findThirdPartyNodeToken\(\s*a\.exe\s*\)\s*\|\|\s*findThirdPartyNodeToken\(\s*a\.args/,
    'Execute 与参数必须都问(病藏在参数里)',
  )
})

// 包装器改的是任务的 action,而 action 与 principal 在同一次 Set-ScheduledTask 里交付。
// 本机实测过这一型的代价:守护任务被 watchdog 重装成 S4U 之后又被包回 wscript,现读主体
// 变回 Interactive —— 自愈把「无桌面所以结构性不可能弹窗」这一根治改回了「靠 SW_HIDE 逐点传参」。
// 所以「保留主体」不能再是注释里的承诺:必须取→带→读回比对,不一致就判失败。
test('包装器可证地保留运行主体:取→带→读回比对,漂移即判失败', () => {
  const src = readFileSync(new URL('../ensure-silent-tasks.mjs', import.meta.url), 'utf8')
  const start = src.indexOf('function replaceActionWithWrapper')
  const fn = src.slice(start, src.indexOf('export function audit', start))
  assert.ok(start > 0 && fn.length > 0, '包装器函数体必须取得到(本锁的基准已漂)')
  assert.match(fn, /\$before = \(Get-ScheduledTask[^\n]*\)\.Principal/, '必须先取回原主体')
  assert.match(fn, /-Action \$a -Principal \$before/, '回写必须显式带上原主体,不能只交 action')
  assert.match(fn, /LOGON_BEFORE=/, '必须把前后主体都打出来(结论要能被日志核对)')
  assert.match(fn, /if \(m\[1\] !== m\[2\]\)/, '主体不一致必须走失败分支')
  assert.doesNotMatch(
    fn,
    /-Action \$a \| Out-Null/,
    '旧形态(只给 -Action、不回读主体)必须已消失:它会静默把 S4U 改回 Interactive',
  )
  assert.doesNotMatch(fn, /const ok = \/OK\/\.test\(out\)/, '裸 /OK/ 成功判据必须已换成形状+比对')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
