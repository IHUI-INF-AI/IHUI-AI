// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 品牌邮件通道对账回归测试(守门 81)—— §22c 镜像测试:直接 import 源函数,禁止复制实现
//
// 成因:邮件"版式模板"只存在于 apps/api/src/services/email-templates.ts,但 ops 侧曾存在
// 绕过模板的自发通道(PowerShell 自拼 Send-MailMessage 纯文本 + Resend payload 只有 text)。
// 这类代码"能发出去、typecheck/lint 全绿",用户收到的邮件却没有样式 —— 与守门 72/78 同族,
// "本地全绿也发现不了"。本测试钉住:①判据纯函数的正反成对语义;②真仓当前不变量
// (存量已冻结在基线,新增通道必红);③**装车证明** —— guardian-runner 必须真的注册了
// 这道门(§22c「造好没装车」教训,78/79/80 同款)。
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as gate } from '../check-brand-email-channel.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')

test('__test__ 出口齐备(§22c 锚点:PS 语句抽取器 / html 判据 / 豁免识别缺一不可)', () => {
  for (const fn of [
    'extractSendMailStatements',
    'findResendEndpointHits',
    'sendContextHasHtmlField',
    'isExemptAt',
    'judgeText',
    'applyBaseline',
    'audit',
  ]) {
    assert.equal(typeof gate[fn], 'function', `缺少导出 ${fn}`)
  }
})

test('R1 正反成对:Send-MailMessage 缺 -BodyAsHtml 判红,补上判绿;续行合并正确', () => {
  const s = (t) => gate.judgeText('deploy/x.ps1', t).violations.filter((v) => v.rule === 'R1')
  assert.equal(s('Send-MailMessage -SmtpServer $h -Body $text').length, 1, '无 -BodyAsHtml 应判红')
  assert.equal(s('Send-MailMessage -SmtpServer $h -BodyAsHtml -Body $text').length, 0, '补 -BodyAsHtml 应判绿')
  assert.equal(
    s('Send-MailMessage -SmtpServer $h `\n    -BodyAsHtml -Body $text').length,
    0,
    '-BodyAsHtml 在反引号续行上同样判绿(抽取器必须合并语句)',
  )
  const stmts = gate.extractSendMailStatements([
    'Send-MailMessage -SmtpServer $h `',
    '    -Body $text',
  ])
  assert.equal(stmts.length, 1)
  assert.equal(stmts[0].endLine, 2, '续行语句必须覆盖到第 2 行')
})

test('R2 正反成对:Resend 上下文无 html 判红;html 形态与豁免标记判绿;窗口外孤立 html 不赦', () => {
  const s = (rel, t) => gate.judgeText(rel, t).violations.filter((v) => v.rule === 'R2')
  const bad = [
    "$payload = @{ from = 'a@b.c'; subject = $s; text = $t } | ConvertTo-Json",
    "Invoke-RestMethod -Uri 'https://api.resend.com/emails' -Method Post -Body $payload",
  ].join('\n')
  assert.equal(s('deploy/x.ps1', bad).length, 1, 'payload 只有 text 应判红')
  assert.equal(s('deploy/x.ps1', bad.replace('text = $t', 'text = $t; html = $h')).length, 0, "PS `html =` 形态应判绿")
  assert.equal(
    s('x.mjs', "fetch('https://api.resend.com/emails', { body: JSON.stringify({ text: t, html: h }) })").length,
    0,
    'JS `html:` 形态应判绿',
  )
  assert.equal(
    s(
      'x.mjs',
      ["const r = await post({", "  host: 'api.resend.com',", "  path: '/emails',", '  body,', '})'].join('\n'),
    ).length,
    1,
    'host+path 分行形态(真实缺陷形态)必须可见并判红',
  )
  const far = [
    ...Array.from({ length: 40 }, (_, k) => `const v${k} = ${k}`),
    "fetch('https://api.resend.com/emails', { body: JSON.stringify({ text: t }) })",
  ].join('\n')
  assert.equal(s('x.mjs', far).length, 1, '窗口外孤立的 html 不构成豁免 —— 本夹具无 html,仍应判红')
  assert.equal(
    s('deploy/x.ps1', bad.replace("Invoke-RestMethod", "# brand-mail-exempt: 确属有意纯文本\nInvoke-RestMethod")).length,
    0,
    '紧邻上行 brand-mail-exempt 标记应豁免',
  )
})

test('R3 正反成对:ops 邮件绕过品牌层判红;email-templates / notify-deploy-failure 引用判绿;注释不判', () => {
  const s = (rel, t) => gate.judgeText(rel, t).violations.filter((v) => v.rule === 'R3')
  assert.equal(s('deploy/n.mjs', "import n from 'nodemailer'\ntransporter.sendMail(msg)").length, 1)
  assert.equal(
    s('deploy/n.mjs', "import '../apps/api/src/services/email-templates'\ntransporter.sendMail(msg)").length,
    0,
    'import 模板层即视为接上品牌',
  )
  assert.equal(s('deploy/n.mjs', "spawn('notify-deploy-failure.ts')\ntransporter.sendMail(msg)").length, 0)
  assert.equal(s('scripts/doc.mjs', '// 曾用 createTransport,已迁移').length, 0, '注释行不计发信动作(宁漏不误报)')
})

test('范围与自豁免:deploy/scripts(+workflows yml)在范围;scripts/tests、apps/、非脚本扩展名不在;本门自身豁免', () => {
  assert.ok(gate.isScannedPath('deploy/win/a.ps1'))
  assert.ok(gate.isScannedPath('scripts/b.mjs'))
  assert.ok(gate.isScannedPath('.github/workflows/c.yml'))
  assert.ok(!gate.isScannedPath('scripts/tests/d.mjs'))
  assert.ok(!gate.isScannedPath('apps/api/src/services/e.ts'))
  assert.ok(!gate.isScannedPath('deploy/win/f.log'))
  const r = gate.judgeText(
    'scripts/check-brand-email-channel.mjs',
    'Send-MailMessage -Body $text\nfetch("https://api.resend.com/emails")',
  )
  assert.equal(r.violations.length, 0, '自豁免:本门源码含字面量不得自判红')
  assert.equal(r.stats.selfExempt, 1, '自豁免必须如实计数,不静默')
})

test('真仓不变量:全量审计判绿(一切存量红均已冻结在基线,新增通道必红)', () => {
  assert.ok(
    existsSync(join(REPO, 'scripts', 'brand-email-channel-baseline.json')),
    '基线文件必须存在 —— 缺失时本门按空基线判定,存量红会全体复现',
  )
  const res = gate.audit(REPO)
  assert.equal(res.code, 0, `检出未基线化违规:${JSON.stringify(res.violations)}`)
  assert.ok(res.stats.judged > 0, '一个在范围文件都没判定 = 判据空转,必须红')
})

test('装车证明:guardian-runner 已注册守门 81 且为 blocking(编号必须出现恰好一次)', () => {
  const runner = readFileSync(join(REPO, 'scripts', 'guardian-runner.mjs'), 'utf8')
  const occ = runner.match(/id:\s*'81'/g) || []
  assert.equal(occ.length, 1, `id '81' 在 runner 中出现 ${occ.length} 次 —— 同日多会话撞号即注册失效`)
  const block = runner.match(/id:\s*'81',[\s\S]{0,2500}?\n {2}\},/)
  assert.ok(block, '未找到守门 81 注册块 —— 脚本存在但没接上守门链等于没有闸')
  assert.match(block[0], /script:\s*'check-brand-email-channel\.mjs'/)
  assert.match(block[0], /mode:\s*'blocking'/)
  assert.match(block[0], /skipEnv:\s*'HUSKY_SKIP_BRAND_MAIL_GUARD'/)
})

test('自检入口可用(--self-test 退出码 0)', () => {
  const out = execFileSync(
    process.execPath,
    [join(REPO, 'scripts', 'check-brand-email-channel.mjs'), '--self-test'],
    { encoding: 'utf8', windowsHide: true, timeout: 120_000 },
  )
  assert.match(out, /self-test 全部通过\(\d+ 例/)
  assert.doesNotMatch(out, /❌ \d+ /, '自检存在失败用例')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
