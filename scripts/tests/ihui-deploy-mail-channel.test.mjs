// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 部署告警邮件通道回归测试(deploy/win/ihui-deploy.ps1 的静态判据)。
//
// 成因:Send-EmailNotify 曾在 PowerShell 里自己拼传输层 —— SMTP 分支 `Send-MailMessage -Body $text`
// 没有 -BodyAsHtml、Resend 分支 payload 只有 `text` 没有 `html`,两条路都只能发纯文本,
// 本机部署环失败时用户永远收不到仓库里那套「智汇通报」版式(带版式的
// apps/api/scripts/notify-deploy-failure.ts 当时只挂在 blue-green-deploy.yml,本地零调用方)。
// 根治是把发信整体交给该 TS 脚本,版式单点于 email-templates.ts。
//
// 本测试是「装车证明」:防止以后有人图省事把 Send-MailMessage / Invoke-RestMethod 直发代码
// 再粘回 ps1(那会静默地把品牌版式重新变成纯文本,且没有任何运行时错误提示)。
// 与 apps/api/tests/o6-deploy-script-invariants.test.ts 同一动机:被测对象是生产部署脚本,
// 真跑会重启线上服务,故把可判定的结构约束落成静态断言。
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEPLOY_PS1 = resolve(HERE, '../../deploy/win/ihui-deploy.ps1')
const src = readFileSync(DEPLOY_PS1, 'utf8')

/** 取 `function <name> { ... }` 的大括号配对正文(与 o6 同法,脚本内无孤立花括号)。 */
function fnBody(source, name) {
  const start = source.indexOf(`function ${name}`)
  assert.notEqual(start, -1, `未找到 function ${name}(改名或删除会使本护栏失明)`)
  const open = source.indexOf('{', start)
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) return source.slice(open + 1, i)
    }
  }
  throw new Error(`function ${name} 的花括号未闭合`)
}

/** 去掉整行注释:负面断言必须只看代码,否则会被解释"为什么不能这么写"的注释自己打红。 */
function codeOnly(text) {
  return text
    .split(/\r?\n/)
    .filter((l) => !/^\s*#/.test(l))
    .join('\n')
}

/** 品牌邮件通道整块:顶部 4 个 $Brand* 变量 + 4 个函数(与探针驱动同一取法)。 */
function brandMailRegion(source) {
  const vars = [...source.matchAll(/^\$Brand\w+\s*=.*$/gm)].map((m) => m[0]).join('\n')
  assert.ok(vars.includes('$BrandNotifyScript'), '缺少 $BrandNotifyScript 路径变量(必须集中在顶部)')
  const fns = ['Resolve-NodeExe', 'Protect-NotifyOutput', 'Invoke-BrandMail', 'Send-EmailNotify']
    .map((n) => `function ${n} {${fnBody(source, n)}}`)
    .join('\n')
  return `${vars}\n${fns}`
}

test('① ps1 侧不留任何自拼传输层(Send-MailMessage / api.resend.com 必须 0 命中)', () => {
  const forbidden = [
    ['Send-MailMessage(PS 侧自发 SMTP,发不出 HTML)', /\bSend-MailMessage\b/],
    ['api.resend.com(PS 侧自发 Resend,payload 无 html 字段)', /api\.resend\.com/],
    ['-BodyAsHtml(版式只可能在 TS 侧单点决定)', /-BodyAsHtml/],
    ['Get-SmtpConfig(随直发代码一并删除,不得复活)', /Get-SmtpConfig/],
    ['Get-ResendApiKey(同上,密钥由 TS 侧回读 .env)', /Get-ResendApiKey\b/],
    ['ps1 直接读 RESEND_API_KEY', /RESEND_API_KEY\s*=/],
    ['ps1 直接读 SMTP_PASS', /SMTP_PASS/],
  ]
  for (const [label, re] of forbidden) {
    const hit = src.split(/\r?\n/).find((line) => re.test(line) && !/^\s*#/.test(line))
    assert.equal(hit, undefined, `部署脚本仍出现 ${label}:${hit && hit.trim()}`)
  }
})

test('② 发信一律经 notify-deploy-failure.ts,并按冻结契约传参', () => {
  const region = brandMailRegion(src)
  const body = fnBody(src, 'Invoke-BrandMail')
  // 脚本与 tsx 入口是顶部 $Brand* 变量(集中一处,便于换机核对),不在函数体内
  assert.match(region, /apps\\+api\\+scripts\\+notify-deploy-failure\.ts/, '未指向品牌通知脚本')
  assert.match(region, /apps\\+api\\+node_modules\\+tsx\\+dist\\+cli\.mjs/, '未指向 tsx 入口(pnpm/npx 在服务上下文不可靠)')
  for (const flag of ['--to', '--title', '--severity', '--source', '--message-file', '--strict']) {
    assert.ok(body.includes(`'${flag}'`), `契约参数 ${flag} 未以字面量传给脚本(改写成变量会让契约漂移无人知)`)
  }
  assert.match(body, /'--severity',\s*'critical'/, 'severity 未钉为 critical')
  assert.match(body, /'--source',\s*'ihui-deployloop'/, 'source 未钉为 ihui-deployloop')
  // 必须用调用操作符 + $LASTEXITCODE 判定(契约:exit 0=成功,失败/未配置 exit 1)
  assert.match(body, /&\s+\$node\s+@argv/, '未用 & 直接执行 node(经 pnpm/npx 会在服务上下文哑火)')
  assert.match(body, /\$LASTEXITCODE/, '未读 $LASTEXITCODE ⇒ 无法按契约判定成败')
  assert.match(body, /2>&1/, '未捕获 stderr(契约把错误写在 stderr)')
})

test('③ message-file 必须无 BOM UTF-8 落盘(禁止 Set-Content -Encoding utf8)', () => {
  const body = fnBody(src, 'Invoke-BrandMail')
  const code = codeOnly(body)
  assert.match(code, /WriteAllText/, '未用 [System.IO.File]::WriteAllText 写正文')
  assert.match(code, /UTF8Encoding\]::new\(\$false\)/, '未显式传 UTF8Encoding($false) ⇒ 会写出带 BOM 的 UTF-8')
  assert.ok(!/Set-Content/i.test(code), 'message-file 用了 Set-Content(5.1 下写带 BOM 的 UTF-8,BOM 会进正文首行)')
  // 正文落点与命名(契约:<repoRoot>/.ihui-agent/tmp/deploy-notify/<yyyyMMdd-HHmmss-fff>.txt)
  const region = brandMailRegion(src)
  assert.match(region, /\.ihui-agent\\+tmp\\+deploy-notify/, 'message-file 目录不在 .ihui-agent/tmp/deploy-notify(§15 项目内路径)')
  assert.match(body, /yyyyMMdd-HHmmss-fff/, '文件名未用契约的 yyyyMMdd-HHmmss-fff 时间戳')
  assert.match(body, /Remove-Item[^\n]*\$msgFile/, '用完未删除 message-file(会在项目内堆积)')
})

test('④ 降级链路在位:品牌失败后走 --plain,两条都失败才返回 $false', () => {
  const send = fnBody(src, 'Send-EmailNotify')
  assert.match(send, /param\(\[string\]\$subject,\[string\]\$text\)/, 'Send-EmailNotify 签名变了(调用点与运维日志解读依赖它)')
  const calls = [...send.matchAll(/Invoke-BrandMail\b[^\n]*/g)].map((m) => m[0])
  assert.equal(calls.length, 2, `应恰好两次调用 Invoke-BrandMail(品牌 + 降级),实际 ${calls.length}`)
  assert.ok(!/Invoke-BrandMail[^\n]*-Plain/.test(calls[0]), '第一次调用不得就带 -Plain(那等于放弃品牌版式)')
  assert.ok(/Invoke-BrandMail[^\n]*-Plain/.test(calls[1]), '第二次调用必须走 -Plain 降级')
  assert.match(send, /return\s+\$true/, '成功路径未返回 $true')
  assert.match(send, /return\s+\$false/, '两条通道都失败时未返回 $false')
  const brand = fnBody(src, 'Invoke-BrandMail')
  assert.match(brand, /\[降级纯文本\]/, '降级正文首行未标注 [降级纯文本]')
  // 调用点仍然接得住:Fail 钩子链未断(装车证明)
  assert.match(fnBody(src, 'Invoke-FailNotify'), /Send-EmailNotify\s+-subject/, 'Invoke-FailNotify 不再调 Send-EmailNotify ⇒ 邮件兜底成死代码')
})

test('⑤ 邮件是唯一到人通道:无当日计数闸、按签名去重、失败必留未送达标记', () => {
  const fail = fnBody(src, 'Invoke-FailNotify')
  // 旧"每日 N 封"计数闸随第三方推送腿一并摘除(配额是他方硬限才需要的自保;自有 SMTP 不设总量封顶)
  for (const dead of ['sctCount', 'emailCount', '$SctStateFile', 'SCT_']) {
    assert.ok(!fail.includes(dead), `Invoke-FailNotify 仍引用计数/推送时代变量 ${dead}(应当只有签名去重)`)
  }
  // 同签名重发窗口必须仍在(去重≠封顶:窗口压的是"重复",不是"新故障")
  assert.match(fail, /FailAlertRepeatHours/, '签名重发周期丢失 ⇒ 同一条持续故障会被静默压掉')
  // 失败必响:Send-EmailNotify 返回 false 时写 UNDELIVERED 标记
  assert.match(fnBody(src, 'Invoke-FailNotify'), /mailOk/, '未回读 Send-EmailNotify 结论 ⇒ 唯一通道失败无人知')
  assert.match(src, /\$AlertUndelFile/, '未送达标记文件常量丢失(参照 check-credential-health 的 UNDEL 机制)')
  // 全文件零推送时代残留:环境变量、端点、旧状态文件名一律不得复活
  for (const [label, re] of [
    ['SERVERCHAN_SENDKEY(第三方推送凭据环境变量)', /SERVERCHAN_SENDKEY/],
    ['sctapi 端点', /sctapi/],
    ['Get-SctSendKey / Send-SctNotify(推送函数)', /\b(Get-SctSendKey|Send-SctNotify)\b/],
    ['.sct-notify-state.json(旧状态文件)', /\.sct-notify-state/],
  ]) {
    const hit = src.split(/\r?\n/).find((line) => re.test(line))
    assert.equal(hit, undefined, `部署脚本残留 ${label}:${hit && hit.trim()}`)
  }
})

test('⑥ node 解析必须有绝对路径兜底且不经 pnpm/npx;路径从脚本自身位置推导', () => {
  const region = brandMailRegion(src)
  const resolver = fnBody(src, 'Resolve-NodeExe')
  // 判据只看代码行:本函数的注释里就写着"不用 pnpm/npx",按整段文本匹配会自打脸
  const resolverCode = codeOnly(resolver)
  assert.match(resolverCode, /Get-Command\s+node\.exe/, '未先尝试 Get-Command node.exe')
  assert.ok(/node\.exe/.test(resolverCode.slice(resolverCode.indexOf('foreach'))), 'Get-Command 落空后没有绝对路径兜底(NSSM/LocalSystem 的 PATH 常无 node)')
  assert.ok(!/\b(pnpm|npx)\b/.test(resolverCode), '解析 node 不得依赖 pnpm/npx(服务上下文 PATH 不可靠)')
  assert.match(region, /Split-Path\s+-Parent[\s\S]{0,80}\$PSScriptRoot/, '仓库根未由 $PSScriptRoot 推导(§15 禁止硬编码盘符)')
  assert.ok(!/[A-Za-z]:[\\/]+IHUI-AI/.test(region), '品牌邮件通道块内出现硬编码仓库绝对路径')
  // 失败信息一律脱敏后入日志
  assert.match(fnBody(src, 'Protect-NotifyOutput'), /api\[_-\]\?key/, '日志未过滤 key/token 类字样(意外泄密防线)')
  assert.match(fnBody(src, 'Protect-NotifyOutput'), /\[已脱敏\]/, '命中凭据字样的行未替换为 [已脱敏]')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
