// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// DBG-80 回归钉(2026-11-07):install-auto-deploy-task.cmd 的 /tr 值不得再因尾反斜杠
// 导致注册出的计划任务「Task To Run」脚本路径带尾反斜杠、pwsh 找不到文件、每 6 分钟静默失败。
// 根因:旧写法用 `\"` 嵌套转义,行尾 `\"` 在 cmd 里被解析为「字面反斜杠 + 闭合引号」。
// 修法:改用 `""`(cmd 文档明确的内嵌引号转义,`""`→`"`)。
// 本锁不调用 schtasks(本机被安全策略封禁,且注册属部署动作),只静态校验源码写法
// 在 cmd 解析语义下产出的 Task To Run 必为正确形态(无尾反斜杠、exe 与脚本各自带引号)。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const CMD = fileURLToPath(new URL('../../deploy/win/install-auto-deploy-task.cmd', import.meta.url))

// 模拟 cmd 对内嵌引号的处理:外层引号已去除后,`""` → `"`(Microsoft 文档行为)。
// 本仓修复后 /tr 值只含 `""` 对,不含 `\"`,故该替换即等价的 cmd 解析结果。
function cmdUnquote(inner) {
  let s = inner
  if (s.startsWith('"')) s = s.slice(1)
  if (s.endsWith('"')) s = s.slice(0, -1)
  return s.split('""').join('"')
}

// 从 .cmd 行抽取 /tr 值:取 `/tr ` 与 ` /sc MINUTE` 之间的整段(cmd 无外层引号包裹,
// 各路径各自用 `""` 转义,schtasks 自行拼接,同 install-auto-deploy-task.ps1 标杆)。
function extractTrValue(src) {
  const line = src
    .split('\n')
    .find((l) => /schtasks\s+\/create/.test(l) && /\/tr\s/.test(l))
  assert.ok(line, '找不到 schtasks /create /tr 行')
  const m = line.match(/\/tr\s+([\s\S]+?)\s+\/sc\s+MINUTE/)
  assert.ok(m, '无法从 /tr 行抽取 /tr 与 /sc 之间的值')
  return cmdUnquote(m[1])
}

test('修复后 /tr 解析出的 Task To Run 形态正确(无尾反斜杠、两段路径各自带引号)', () => {
  const src = readFileSync(CMD, 'utf8')
  const taskToRun = extractTrValue(src)
  // exe 路径必须整体带引号(否则含空格会被 schtasks 误拆成 <Command>)
  assert.ok(
    taskToRun.includes('"C:\\Program Files\\PowerShell\\7\\pwsh.exe"'),
    'pwsh.exe 路径未整体带引号: ' + taskToRun,
  )
  // 脚本路径必须整体带引号,且结尾是 `"` 不是 `\`
  assert.ok(
    taskToRun.includes('"%IHUI_ROOT%\\deploy\\win\\ihui-deploy-loop.ps1"'),
    '脚本路径未整体带引号: ' + taskToRun,
  )
  assert.ok(taskToRun.endsWith('.ps1"'), 'Task To Run 不以 " 结尾(尾反斜杠?): ' + taskToRun)
  assert.equal(
    taskToRun.includes('.ps1\\'),
    false,
    'Task To Run 含尾反斜杠(注册后会找不到文件): ' + taskToRun,
  )
  // 不得残留 `\"` 这种会触发尾反斜杠的写法
  assert.equal(taskToRun.includes('\\"'), false, '仍含 `\\"` 写法: ' + taskToRun)
})

test('红臂:旧写法 `\\"` 会被本锁判为缺陷(证明锁能抓住回归)', () => {
  // 旧 bug 形态:`/tr "\"C:\...\pwsh.exe\" ... -File \"%IHUI_ROOT%\...\ihui-deploy-loop.ps1\""`
  const broken = '"\\"C:\\Program Files\\PowerShell\\7\\pwsh.exe\\" -NoProfile -ExecutionPolicy Bypass -File \\"%IHUI_ROOT%\\deploy\\win\\ihui-deploy-loop.ps1\\""'
  const parsed = cmdUnquote(broken) // 旧式无 `""`,`\"` 原样保留
  assert.equal(parsed.endsWith('.ps1"'), false, '红臂失效:旧写法竟被当成合格')
  assert.ok(parsed.includes('.ps1\\"'), '红臂失效:旧写法未呈现尾反斜杠形态')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
