// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// DBG-80 回归钉(2026-11-07):install-auto-deploy-task.cmd 的 /tr 值不得再因尾反斜杠
// 导致注册出的计划任务「Task To Run」脚本路径带尾反斜杠、pwsh 找不到文件、每 6 分钟静默失败。
// 根因:旧写法用 `\"` 嵌套转义,行尾 `\"` 在 cmd 里被解析为「字面反斜杠 + 闭合引号」。
// 修法:改用 `""`(cmd 文档明确的内嵌引号转义,`""`→`"`)。
// 本锁不调用 schtasks(本机被安全策略封禁,且注册属部署动作),只静态校验源码写法
// 在 cmd 解析语义下产出的 Task To Run 必为正确形态(无尾反斜杠、exe 与脚本各自带引号)。
//
// RP-22 回归钉(2026-11-11):同文件幂等口径必须对齐 install-auto-deploy-task.ps1
// (:22-26 头注、:52-63、:77-78)——先 /query 探在否,在则 /change 就地更新,不在才
// /create 且不带强制覆盖开关;全文件不得出现删除任务(/delete)与强制覆盖(/f)写法。
// 先拆后建(强制覆盖创建或显式删除再建)是非原子的:拆掉旧注册后写入失败,
// 机器上就不再有 IHUI-AutoDeploy。同样只做静态校验。
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

const linesOf = (src) => src.split(/\r?\n/)

test('RP-22: 全文件无删除任务(/delete)与强制覆盖(/f)写法(含注释)', () => {
  const src = readFileSync(CMD, 'utf8')
  assert.equal(/\/delete/i.test(src), false, '仍出现删除任务写法 /delete')
  for (const l of linesOf(src)) {
    // 词边界:不得放过 `/f`、`/F`、行尾 `/f`;`/fo`、`/file` 之类不误伤。
    assert.equal(/(^|\s)\/f(\s|$)/i.test(l), false, '仍出现强制覆盖开关 /f 写法: ' + l)
  }
})

test('RP-22: /query 探在否 → 在则 /change 就地更新 → 不在才走 :create 分支 /create', () => {
  const src = readFileSync(CMD, 'utf8')
  const lines = linesOf(src)
  const idxOf = (re) => lines.findIndex((l) => re.test(l))
  const q = idxOf(/^\s*schtasks\s+\/query\b/i)
  const trChange = idxOf(/^\s*schtasks\s+\/change\b.*\/tr\s/i)
  const tuneChange = idxOf(/^\s*schtasks\s+\/change\b.*\/ru\s+SYSTEM.*\/ENABLE/i)
  const lbl = idxOf(/^\s*:create\s*$/)
  const cr = idxOf(/^\s*schtasks\s+\/create\b/i)
  assert.ok(q >= 0, '缺少 /query 存在性探测步骤')
  assert.ok(trChange >= 0, '缺少 /change 就地更新命令行(/tr)步骤')
  assert.ok(tuneChange >= 0, '缺少 /change 就地更新运行身份/提权级别并启用步骤')
  assert.ok(lbl >= 0, '缺少 :create 分支标签(/create 未受存在性判断保护)')
  assert.ok(cr >= 0, '缺少 /create 创建步骤')
  assert.ok(q < trChange && trChange < tuneChange, '/query→/change 次序被破坏')
  assert.ok(q < lbl && lbl < cr, '/create 未放在 :create 分支之后(应「不在才创建」)')
  assert.match(src, /if\s+errorlevel\s+1\s+goto\s+:create/i, '/query 判不存在未路由到 :create 分支')
})

test('RP-22: /change 就地更新的 /tr 值同样满足 DBG-80 形态(与 /create 行一致)', () => {
  const src = readFileSync(CMD, 'utf8')
  const line = linesOf(src).find((l) => /^\s*schtasks\s+\/change\b/i.test(l) && /\/tr\s/.test(l))
  assert.ok(line, '找不到带 /tr 的 /change 行')
  const m = line.match(/\/tr\s+(.+)$/)
  assert.ok(m, '无法从 /change 行抽取 /tr 值')
  const taskToRun = cmdUnquote(m[1])
  assert.ok(
    taskToRun.includes('"C:\\Program Files\\PowerShell\\7\\pwsh.exe"'),
    '/change 行 pwsh.exe 路径未整体带引号: ' + taskToRun,
  )
  assert.ok(
    taskToRun.includes('"%IHUI_ROOT%\\deploy\\win\\ihui-deploy-loop.ps1"'),
    '/change 行脚本路径未整体带引号: ' + taskToRun,
  )
  assert.ok(taskToRun.endsWith('.ps1"'), '/change 行 Task To Run 不以 " 结尾: ' + taskToRun)
  assert.equal(taskToRun.includes('.ps1\\'), false, '/change 行含尾反斜杠: ' + taskToRun)
  assert.equal(taskToRun.includes('\\"'), false, '/change 行仍含 `\\"` 写法: ' + taskToRun)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
