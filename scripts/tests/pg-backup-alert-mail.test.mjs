// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 备份 runner 的"失败必须到人"接线锁(2026-09-29 立,AGENTS §5e)。
//
// 立因是实测而非假想:`deploy/win/ihui-pg-backup.ps1` 此前 `grep mail|smtp|resend|notify|
// webhook|Invoke-WebRequest` **0 命中** —— 失败出口只有 Write-Host + exit 1,所以一轮备份
// 失败是否有人知道,取决于"有没有别的看护恰好去翻日志"(09-24/09-25 两次断链都是人肉发现的)。
// 本文件钉的不是"有一份发信函数",而是**每一个失败出口都真走到了唯一出口上**:
// 判据按行扫 `exit 1`,要求每个 exit 点上方 12 行内有一次 `Send-FailureAlert` ——
// 新增一条 exit 分支而忘记寄信,正是这类通道最常烂掉的方式(与守门 64/70/81/105/115 同族:
// 机制在位 ≠ 有人在调用)。§5e 的另外三条硬约束同样逐字锁住:不得自拼 SMTP/Resend、
// 多行中文正文必须走 --message-file、**绝不传 --env-file**(tsx v4 会劫持它)。
//
// 运行:`node --test scripts/tests/pg-backup-alert-mail.test.mjs`(也在 `pnpm test:scripts` 全量面内)
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const REL = join('deploy', 'win', 'ihui-pg-backup.ps1')
const SRC = readFileSync(join(REPO, REL), 'utf8')
const LINES = SRC.split(/\r?\n/)

// 判据扫的是**会被执行的那一份**,不是注释。本文件的 §5e 说明块按名字点名了被禁写法
// (`--env-file` / `Invoke-WebRequest`),整文件 `.includes()` 会把"写下这条禁令"当成"犯了这条禁令"。
// 只剥整行注释(PowerShell 里 `#` 起头即整行不执行 ⇒ 剥掉的行不可能跑),
// 代码里的 `exit 1`、`$argv += '--env-file'` 这类真形态一个字符都不会被放过。
// <# … #> 块注释也一并剥(本文件目前不用,但不能给禁写法留藏身处)。
const WITHOUT_COMMENTS = SRC.replace(/<#[\s\S]*?#>/g, ' ')
  .split(/\r?\n/)
  .filter((l) => !/^\s*#/.test(l))
  .join('\n')

/** 被禁的第二条传输层写法:出现在**可执行代码**里即意味着有人在脚本里自拼发信(§5e 唯一出口) */
const BANNED_TRANSPORT = [
  'Send-MailMessage',
  'api.resend.com',
  'createTransport',
  'Invoke-RestMethod',
  'Invoke-WebRequest',
]

test('唯一出口在位:经 tsx 调 notify-deploy-failure.ts,且不传 --env-file', () => {
  assert.ok(
    SRC.includes('apps\\api\\scripts\\notify-deploy-failure.ts'),
    '未引用运维邮件唯一出口 ⇒ 失败仍然只是日志行',
  )
  assert.ok(SRC.includes('apps\\api\\node_modules\\tsx\\dist\\cli.mjs'), '未走 apps/api 的 tsx 入口')
  assert.ok(SRC.includes("'--message-file'"), '多行中文正文必须走 --message-file')
  assert.ok(SRC.includes("'--alert-id'"), '去重必须按身份,不能按计数/时间戳')
  assert.ok(
    !WITHOUT_COMMENTS.includes('--env-file'),
    '绝不得传 --env-file:tsx v4 会劫持它,路径不存在时 node 直接 exit 9',
  )
  // 反向护栏:剥注释不能把出口本身也剥掉(否则上面的 includes 靠注释蒙过去就没了意义)
  assert.ok(
    WITHOUT_COMMENTS.includes("'--message-file'") && WITHOUT_COMMENTS.includes("'--alert-id'"),
    '去注释后的代码里看不到发信参数 ⇒ 出口只写在注释里,根本没被调用',
  )
  for (const banned of BANNED_TRANSPORT) {
    assert.ok(
      !WITHOUT_COMMENTS.includes(banned),
      `可执行代码里出现自拼传输层的写法:${banned}(§5e 唯一出口)`,
    )
  }
})

test('message 文件按无 BOM UTF-8 写(BOM 会排在正文第一个字符前)', () => {
  assert.ok(
    /\[System\.IO\.File\]::WriteAllText\(\$msgFile,\s*\$text,\s*\[System\.Text\.UTF8Encoding\]::new\(\$false\)\)/.test(
      SRC,
    ),
    '写正文必须显式无 BOM,不得靠读取方兜底',
  )
})

test('node 由绝对路径候选解析(服务身份读机器级 PATH,里面有死路径)', () => {
  assert.ok(SRC.includes('function Resolve-NodeExe'), '丢了 Resolve-NodeExe 就会在服务里静默落空')
  assert.ok(SRC.includes('$node = Resolve-NodeExe'), '发信前必须解析 node')
  assert.ok(/&\s+\$node\s+@argv/.test(SRC), '派生必须用解析出来的绝对路径,不能写裸 node')
  // 兜底全落空必须喊出来,不得 `if (Get-Command …) { … }` 无 else 静默降级
  assert.ok(
    /if \(-not \$node\)[\s\S]{0,220}\[ERROR\]/.test(SRC),
    'node 取不到时必须写一条 ERROR,而不是悄悄不发',
  )
})

test('每一个 exit 1 失败出口都先寄信(新增分支忘了寄 = 本条红)', () => {
  const sites = []
  for (let i = 0; i < LINES.length; i += 1) {
    if (!/^\s*exit 1\s*$/.test(LINES[i])) continue
    const from = Math.max(0, i - 12)
    const window = LINES.slice(from, i + 1).join('\n')
    if (!window.includes('Send-FailureAlert')) {
      sites.push({ line: i + 1, text: LINES[i].trim() })
    }
  }
  assert.deepEqual(sites, [], '这些 exit 1 前面 12 行内没有 Send-FailureAlert ⇒ 失败不会到人')
  // 反向护栏:一条都没有 = 本文件不再有失败出口,那同样不对(备份脚本必有失败路径)
  const anyExit = LINES.filter((l) => /^\s*exit 1\s*$/.test(l)).length
  assert.ok(anyExit >= 3, `只找到 ${anyExit} 个 exit 1 出口 —— 判据失去对象,先查是不是失败路径被删了`)
})

test('未送达必须留痕,且只在真正投递成功时清除', () => {
  assert.ok(SRC.includes('pg-backup-alert-UNDELIVERED.json'), '未送达标记文件不在 ⇒ 失败又变回安静')
  assert.ok(/function Write-AlertUndeliveredMark/.test(SRC), '缺留痕函数')
  assert.ok(/function Clear-AlertUndeliveredMark/.test(SRC), '缺清除出口')
  // 清除只允许发生在"投递成功"分支之后(备份本轮成功 ≠ 人已看到那条告警)
  // 两种合法形态:裸调用,以及包在 `-AlertDryRun` 门里(--dry-run 没有真投递,不清别人的标记)
  const CLEAR_CALL =
    /^\s*(?:if \(-not \$AlertDryRun\) \{ )?Clear-AlertUndeliveredMark(?: \})?\s*$/
  const clearSites = LINES.map((l, i) => ({ l, i })).filter(({ l }) => CLEAR_CALL.test(l))
  assert.ok(clearSites.length >= 1, 'Clear-AlertUndeliveredMark 没被任何分支调用 ⇒ 标记只增不清')
  // 定义行不算调用点(防止判据被 `function Clear-…` 自己满足)
  assert.ok(
    !clearSites.some(({ l }) => /^\s*function /.test(l)),
    '清除调用点里混进了定义行 ⇒ 本条判据形同虚设',
  )
  for (const { i } of clearSites) {
    const above = LINES.slice(Math.max(0, i - 14), i).join('\n')
    assert.match(above, /Invoke-BrandAlertMail/, '清除必须跟在投递成功的判定之后,不得在别处清')
    assert.doesNotMatch(above, /未送达|Write-AlertUndeliveredMark/, '未送达分支上不得清标记')
  }
})

test('异常终止也有出口:trap 补寄一次并保持退出码 1', () => {
  assert.ok(/^trap \{/m.test(SRC), '脚本级 trap 不见了 ⇒ 未预料的崩溃又只剩一行日志')
  const trapAt = LINES.findIndex((l) => /^trap \{/.test(l))
  assert.ok(trapAt >= 0)
  const body = LINES.slice(trapAt, trapAt + 14).join('\n')
  assert.ok(body.includes('Send-FailureAlert'), 'trap 未接告警出口')
  assert.ok(body.includes('exit 1'), 'trap 改变了退出码语义(原本就是非零失败)')
})

test('在册库清单含 keycloak(与 alert-check-service 的监控面同一批库)', () => {
  const line = /\$backupDatabases\s*=\s*@\(([^)]*)\)/.exec(SRC)
  assert.ok(line, '$backupDatabases 那一行不见了 ⇒ 节拍审计与本锁都失去清单')
  assert.ok(/'keycloak'|"keycloak"/.test(line[1]), 'runner 不再备 keycloak ⇒ 监控面也要同步收,先查哪边对')
})

test('默认行为未被改:发信失败不改备份结论、不改退出码', () => {
  // Send-FailureAlert 内部对派发器失败只写日志 + 留痕,不 throw / 不 exit
  const at = LINES.findIndex((l) => /^function Send-FailureAlert/.test(l))
  assert.ok(at >= 0, '找不到 Send-FailureAlert 定义')
  let depth = 0
  const body = []
  for (let i = at; i < LINES.length; i += 1) {
    depth += (LINES[i].match(/\{/g) ?? []).length - (LINES[i].match(/\}/g) ?? []).length
    body.push(LINES[i])
    if (i > at && depth <= 0) break
  }
  const text = body.join('\n')
  assert.ok(!/^\s*exit /m.test(text), '告警入口内不得 exit —— 通知失败不能盖掉备份本身的退出码')
  assert.ok(!/throw /.test(text), '告警入口内不得 throw —— 否则备份失败原因被通知路径的异常顶掉')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
