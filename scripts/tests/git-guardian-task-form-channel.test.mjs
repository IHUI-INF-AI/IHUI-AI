// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 计划任务形态通道回归锁(2026-10-25 立)。
 *
 * 病灶:本机安全策略把 `schtasks.exe` 列入黑名单,而 `taskForm()` 挂在每 2 分钟一 tick 的
 * 守护巡检上 —— 在那里 spawn 它,失败形态不是一条可读报错,而是把守护一起带走。
 * 换主通道(Get-ScheduledTask)不是跳门:读的是同一份任务存储,形态判据仍是
 * `lib/schtasks-form.mjs` 那**一份**。本档锁三件事:
 *   ① 默认档**不得**碰 schtasks.exe(守卫必须排在 spawn 之前);
 *   ② 两通道共用同一份形态判据(通道分支里出现第二份形态字面量,就是漂移的开始);
 *   ③ "查法失效"(cmdlet 不在位)不得被读成"任务不存在"(查法失效与产物为空必须分家)。
 * 外加一条可读判据:被测模块若是陈旧工作树副本(缺 `__test__` 字段),本档报"副本陈旧",
 * 而不是让一条 TypeError 冒充"判据失败"。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { __test__ as G } from '../git-guardian.mjs'

const SRC = readFileSync(fileURLToPath(new URL('../git-guardian.mjs', import.meta.url)), 'utf8')
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const FORMS = new Set(['ok', 'ok-vbs', 'missing', 'drift', 'unknown'])

/** 取函数体(按大括号配平,与 git-guardian-drift-align.test.mjs 同一手法) */
function fnBody(src, name) {
  const start = src.indexOf(`function ${name}(`)
  assert.ok(start >= 0, `源文件里找不到 ${name}()`)
  const open = src.indexOf('{', start)
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1)
  }
  assert.fail(`${name}() 花括号未配平`)
}

test('T0 被测模块必须是同代副本:缺 __test__ 字段 ⇒ 报"副本陈旧",不抛 TypeError', () => {
  assert.equal(
    typeof G.taskForm,
    'function',
    '被测 scripts/git-guardian.mjs 缺 __test__.taskForm —— 这是陈旧工作树副本(不等于 HEAD),先与 HEAD 对齐再跑;别把它读成判据失败',
  )
})

test('T1 默认档不得 spawn schtasks.exe:守卫必须拦在第一次 spawn 之前', () => {
  const body = fnBody(SRC, 'taskForm')
  const guard = body.indexOf("if (!ALLOW_SCHTASKS_EXE) return 'unknown'")
  const spawn = body.indexOf("execFileSync('schtasks.exe'")
  assert.ok(guard > 0, 'taskForm 缺 IHUI_ALLOW_SCHTASKS_EXE 守卫 ⇒ 黑名单机器上每 2 分钟 spawn 一次 schtasks.exe')
  assert.ok(spawn > guard, `守卫必须拦在 spawn 之前(guard@${guard}, spawn@${spawn})`)
})

test('T2 两通道共用一份形态判据:taskForm 只委托,不自带第二份真相', () => {
  const body = fnBody(SRC, 'taskForm')
  assert.equal(
    (body.match(/judgeTaskForm\(/g) || []).length,
    2,
    '主通道与兜底通道都必须委托 lib/schtasks-form.mjs 那唯一一份判据',
  )
  assert.doesNotMatch(body, /InteractiveToken|'S4U'/, '通道分支里出现形态关键字 ⇒ 第二份真相(与 lib 必漂移)')
})

test('T3 cmdlet 不在位不得被读成"任务不存在":__MISSING__ 只许出现在 Get-Command 之后', () => {
  const body = fnBody(SRC, 'psTaskProbe')
  const hasCmd = body.indexOf('Get-Command Get-ScheduledTask')
  const missing = body.indexOf('__MISSING__')
  assert.ok(hasCmd > 0, 'psTaskProbe 未判 cmdlet 是否在位 ⇒ 查法失效会被读成产物为空')
  assert.ok(missing > hasCmd, '`__MISSING__` 必须只出现在 cmdlet 在位的分支(查法失效 ≠ 任务不存在)')
})

test('T4 端到面:taskForm 真跑一轮,拿到允许档且不把宿主带走', () => {
  const r = spawnSync(process.execPath, ['-e', "import('./scripts/git-guardian.mjs').then((m) => console.log(m.__test__.taskForm()))"], {
    encoding: 'utf8',
    cwd: ROOT,
    windowsHide: true,
    timeout: 120_000,
  })
  const err = String(r.stderr || '').replace(/\r?\n/g, ' ').slice(0, 300)
  assert.equal(r.status, 0, `taskForm 子进程非零退出 ⇒ 通道把宿主带走了(status=${r.status} signal=${r.signal} stderr=${err})`)
  const form = String(r.stdout || '').trim()
  assert.ok(FORMS.has(form), `形态读数不在判定档内:${JSON.stringify(form)} —— ${err}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
