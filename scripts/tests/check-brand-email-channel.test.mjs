// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 品牌邮件通道对账回归测试(守门 81)—— §22c 镜像测试:直接 import 源函数,禁止复制判据实现
//
// 成因:邮件"版式模板"只存在于 apps/api/src/services/email-templates.ts,但 ops 侧曾存在
// 绕过模板的自发通道(PowerShell 自拼 Send-MailMessage 纯文本 + Resend payload 只有 text)。
// 这类代码"能发出去、typecheck/lint 全绿",用户收到的邮件却没有样式 —— 与守门 72/78 同族,
// "本地全绿也发现不了"。本测试钉住:①判据纯函数的正反成对语义;②真仓当前不变量
// (存量已冻结在基线,新增通道必红);③**装车证明** —— guardian-runner 必须真的注册了
// 这道门(§22c「造好没装车」教训,78/79/80 同款)。
// 2026-09-24 R4(告警接收面)追加的成因:Alertmanager 原生 email_configs 发的是 Go 模板排版的
// 无版式纯文本,渲染器结构上已封死,但"跑渲染"是人工动作 ⇒ 改 .tmpl 提交时全链零红。本测试同时
// 钉死 ④R4 与渲染器**同一个 bridge 出口常量**(不许两处真相)、⑤R4 面真的读到 monitoring/alertmanager/**
// (用注释字面量计数反证"扫不到所以恒绿",守门 52 教训)、⑥面不放宽成全仓 yml。
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as gate } from '../check-brand-email-channel.mjs'
// 渲染器是 bridge-only 结构的既有判据方:本门 R4 与它必须**同一个 bridge 出口值**。
// §22d 的 isDirectRun 守卫保证 import 它不触发任何 CLI 副作用(不读文件、不派生 git)。
import { __test__ as amRenderer } from '../render-alertmanager-config.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')

test('__test__ 出口齐备(§22c 锚点:PS 语句抽取器 / html 判据 / 版式手抄判据 / AM 接收面判据 / 豁免识别缺一不可)', () => {
  for (const fn of [
    'extractSendMailStatements',
    'findResendEndpointHits',
    'sendContextHasHtmlField',
    'findLayoutCopyHits',
    'scanAlertmanagerSurface',
    'isAlertmanagerSurfacePath',
    'isBrandExitScript',
    'isExemptAt',
    'judgeText',
    'applyBaseline',
    'audit',
  ]) {
    assert.equal(typeof gate[fn], 'function', `缺少导出 ${fn}`)
  }
  assert.equal(typeof gate.BRAND_EXIT_REL, 'string', 'carve 路径必须可被测试钉死,不得只在实现里硬写')
  assert.equal(typeof gate.BRIDGE_URL, 'string', 'R4 的 bridge 出口必须是导出的常量,不得在判据里硬写')
})

test('R4 与渲染器同源:bridge 出口 URL 两处必须逐字等值(漂移就是"提交绿、跑渲染红"的成因)', () => {
  assert.equal(gate.BRIDGE_URL, amRenderer.BRIDGE_URL, '本门 BRIDGE_URL 必须等于 render-alertmanager-config.mjs 的 BRIDGE_URL')
  assert.equal(amRenderer.BRIDGE_URL, 'http://127.0.0.1:9096/alert', '渲染器侧常量若被改动,须同批改本门并跑一次渲染校验')
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

test('扩面对账(2026-09-24):monitoring/** 与 .cjs/.mts、apps/api/scripts/** 真进面;证据式不扩的面仍在面外', () => {
  // 进面:infra 告警邮件正文的实际出口 + 它恰好是 .cjs(旧口径"目录不在 + 扩展名不在"双重不可见)
  assert.ok(gate.isScannedPath('monitoring/alertbridge/alert-webhook-bridge.cjs'))
  assert.ok(gate.isScannedPath('monitoring/x.cjs'))
  assert.ok(gate.isScannedPath('scripts/x.cjs'), '.cjs 必须整体纳入,不能只进某个目录')
  assert.ok(gate.isScannedPath('apps/api/scripts/send-weekly.mts'))
  // 面外(实测过的假阳来源,写死防"顺手扩")
  assert.ok(!gate.isScannedPath('packages/api-client/src/endpoints/mail.ts'), 'api-client 的 sendMail 是 POST 自家后端,判它红=造假阳')
  assert.ok(!gate.isScannedPath('apps/api/src/routes/system.ts'), '管理员 SMTP 试测端点不在 ops 面内')
  assert.ok(!gate.isScannedPath('deploy/scripts/backup-db.sh'), '27 个 .sh/.py 零发信 token,无证据不扩')
  assert.ok(!gate.isScannedPath('monitoring/alertbridge/README.md'))
})

test('发信动作认派生名:bridge 自己的腿函数叫 sendMailLeg(旧 sendMail\\b 判不到)', () => {
  const v = gate.judgeText('monitoring/alertbridge/z.cjs', 'async function sendMailLeg(to) {}\nmodule.exports = sendMailLeg')
    .violations
  assert.ok(v.some((x) => x.rule === 'R3'), 'sendMailLeg 必须计为发信动作,否则扩了面也恒报 0')
})

test('R3b 自拼 HTML 正文/手抄品牌版式:正例判红,四类反例判绿(三段与门缺一不可)', () => {
  const r3 = (rel, t) => gate.judgeText(rel, t).violations.filter((v) => v.rule === 'R3')
  // 正例:接了品牌出口,却自带一份机械风版式 —— R3a 放过的那一型,只有 R3b 看得见
  const HOT = [
    "import { spawnSync } from 'node:child_process'",
    "const subject = '智汇通报'",
    'const head = \'<table role="presentation" width="600" bgcolor="#0A0A0C">\'',
    '  + \'<td style="font-family:Consolas,monospace;letter-spacing:3px;color:#B4FF00;">IHUI</td></table>\'',
    "spawnSync('node', ['apps/api/scripts/notify-deploy-failure.ts', '--message', head])",
  ].join('\n')
  assert.equal(r3('monitoring/alertbridge/x.cjs', HOT).length, 1, '自带版式必须判红,即使它调了唯一出口')
  // 反例 1:同样 HTML,但无邮件语境(页面/报告生成)
  assert.equal(
    r3(
      'scripts/gen-report.mjs',
      [
        'const page = \'<table width="600" bgcolor="#0A0A0C">\'',
        '  + \'<td style="font-family:Consolas,monospace;letter-spacing:3px;color:#B4FF00;">IHUI</td></table>\'',
        "writeFileSync('report.html', page)",
      ].join('\n'),
    ).length,
    0,
    '无邮件语境的 HTML 生成不得判(否则三条守门脚本的夹具全成假阳)',
  )
  // 反例 2:标记与样式指纹相距 > 窗口
  assert.equal(
    r3(
      'scripts/far.mjs',
      [
        "const subject = 'x'",
        "const t = '<table>'",
        ...Array.from({ length: 16 }, (_, k) => `const v${k} = ${k}`),
        "const css = 'letter-spacing:3px'",
      ].join('\n'),
    ).length,
    0,
    '距离超限即非同一段版式 —— 窗口判据必须真在生效',
  )
  // 反例 3:只有样式指纹(守门脚本正则夹具形态)
  assert.equal(
    r3('scripts/check-radius.mjs', "const subject = 'x'\nconst css = 'border-radius:6px;font-family:Consolas'").length,
    0,
    '无邮件版式标记不判',
  )
  // 反例 4:整段版式在注释里
  assert.equal(r3('scripts/doc.mjs', `// ${HOT.split('\n')[3]}\nconst subject = 'x'`).length, 0, '注释行不计(宁漏不误报)')
  // findLayoutCopyHits 直接可验(§22c:不得在测试里复制判据实现)
  const hits = gate.findLayoutCopyHits(HOT.split('\n'), 'js')
  assert.equal(hits.length, 1)
  assert.equal(hits[0].line, 3, '命中行必须是版式标记起始行,供人一眼定位')
})

// ══ R4 告警接收面(Alertmanager)正反成对 ══
// 立项起因:AM 原生 email_configs 发的是 Go 模板的无版式纯文本(正是用户投诉"邮件没有样式"那一型),
// 结构上渲染器 assertBridgeOnlySurface 已封死,但**跑渲染是人工动作** —— 有人往 .tmpl 加回一段
// email_configs 直接 commit 时全链零红。本组测试钉死"改了提交就红",且证明面不是空转。
const AM_CLEAN_TMPL = [
  'global:',
  '  resolve_timeout: 5m',
  '',
  'route:',
  "  receiver: 'default-webhook'",
  '',
  'receivers:',
  "  - name: 'default-webhook'",
  '    webhook_configs:',
  "      - url: 'http://127.0.0.1:9096/alert'",
  '        send_resolved: true',
].join('\n')
const AM_TMPL_REL = 'monitoring/alertmanager/alertmanager.yml.tmpl'
const r4Of = (rel, text) => gate.judgeText(rel, text).violations.filter((v) => v.rule === 'R4')

test('R4a 正反:干净 bridge-only 模板判绿;加回 email_configs 或 global 下 smtp_* 判红并点名行', () => {
  assert.equal(r4Of(AM_TMPL_REL, AM_CLEAN_TMPL).length, 0, '干净模板必须判绿(真仓现状的同构样本)')
  const bad = r4Of(AM_TMPL_REL, AM_CLEAN_TMPL + "\n  - name: 'mail'\n    email_configs:\n      - to: 'ops@example.com'\n")
  assert.equal(bad.length, 1, 'receiver 底下加回 email_configs 必须判红')
  assert.equal(bad[0].line, 13, '点名行必须落在 email_configs 那一行')
  assert.match(bad[0].reason, /R4a/)
  const smtp = r4Of(AM_TMPL_REL, AM_CLEAN_TMPL.replace('  resolve_timeout: 5m', '  resolve_timeout: 5m\n  smtp_smarthost: smtp.example.net:587'))
  assert.equal(smtp.length, 1, 'global 下 smtp_* 是同一张原生邮件面,必须同样判红')
  // 反向对照:文件名换成非 AM 语境即不吃 R4(证明判据挂在语境上,不是"见 yml 就扫")
  assert.equal(r4Of('monitoring/prometheus/prometheus.yml', AM_CLEAN_TMPL + '\n    email_configs:\n').length, 0)
})

test('R4b 正反:IM 中转 receiver 改名(feishu-copy)仍判红,且认 host/回调路径特征而非只认名字', () => {
  const byName = r4Of(AM_TMPL_REL, AM_CLEAN_TMPL + "\n  - name: 'feishu-copy'\n")
  assert.equal(byName.filter((v) => /R4b/.test(v.reason)).length, 1, '改名 feishu-copy 仍是 slug 命中')
  const byHost = r4Of(
    AM_TMPL_REL,
    AM_CLEAN_TMPL + "\n  - name: 'alert-bot-copy'\n    webhook_configs:\n      - url: 'https://oapi.dingtalk.com/robot/send'\n",
  )
  assert.equal(byHost.filter((v) => /R4b/.test(v.reason)).length, 1, 'receiver 名字干净但 url 是钉钉回调域名 ⇒ 必红')
  assert.equal(byHost.filter((v) => /R4c/.test(v.reason)).length, 1, '同一条 url 也必须是"非 bridge 出口"(两条子判据各自成立)')
  // 反向:普通 slug 词出现在非 name/url 位置(如注释、matchers 标签值)不判
  assert.equal(r4Of(AM_TMPL_REL, AM_CLEAN_TMPL + "\n  # wechat 中转已摘除\n").length, 0)
})

test('R4c 取向:url 换 host 但端口仍 9096(localhost)⇒ 判红,与渲染器同判据(不引第二份真相)', () => {
  const v = r4Of(AM_TMPL_REL, AM_CLEAN_TMPL.replace('http://127.0.0.1:9096/alert', 'http://localhost:9096/alert'))
  assert.equal(v.length, 1, 'bridge 按部署约定只绑 127.0.0.1,且渲染器判的是字面等值 —— 两道门取向必须一致')
  assert.match(v[0].reason, new RegExp(gate.BRIDGE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('R4 注释行:整行 YAML 注释不计红,但被禁字面量如实计数(废弃桩 alertmanager.yml 即此形态)', () => {
  const st = gate.newStats()
  const text = ['# 历史旁路:email_configs / smtp_smarthost 不可再加回', '# dingtalk / feishu receiver 已摘除', AM_CLEAN_TMPL].join('\n')
  const res = gate.judgeText(AM_TMPL_REL, text, st)
  assert.equal(res.violations.length, 0, '注释行不判红(与既有"注释行不计"取向一致)')
  assert.ok(st.amCommentLiterals >= 4, `注释内被禁字面量必须如实计数,实得 ${st.amCommentLiterals}`)
})

test('R4 豁免只有既有两种姿势:行内 brand-mail-exempt 与基线棘轮,不新增白名单目录', () => {
  const hot = AM_CLEAN_TMPL + "\n  - name: 'mail'\n    # brand-mail-exempt: 演练\n    email_configs:\n"
  assert.equal(r4Of(AM_TMPL_REL, hot).length, 0, '紧邻上行标记可豁免(与 R1-R3 同一识别函数)')
  const v = [{ path: AM_TMPL_REL, rule: 'R4', line: 12, snippet: '' }]
  const st = gate.newStats()
  assert.equal(gate.applyBaseline(v, { [`${AM_TMPL_REL}#R4`]: 1 }, st).length, 0, '基线棘轮的 key 形态对 R4 同样生效')
  assert.equal(st.baselineTolerated, 1)
})

test('R4 面:只认 Alertmanager 语境,三种配置类扩展名都进;其余 yml/yaml 一律不进(未全仓扫)', () => {
  assert.ok(gate.isScannedPath(AM_TMPL_REL))
  assert.ok(gate.isScannedPath('monitoring/alertmanager/alertmanager.yml'))
  assert.ok(gate.isAlertmanagerSurfacePath('monitoring/alertmanager/noise-rules.yml'))
  assert.ok(gate.isAlertmanagerSurfacePath('deploy/prod-bundle/alertmanager.yml'), '文件名形态的 AM 主配置在别的目录也受管')
  // 面外:这些是全仓 yml 假阳的实际来源,写死防"顺手放宽成 *.yml"
  assert.ok(!gate.isScannedPath('monitoring/prometheus/prometheus.yml'), 'monitoring 内的非 AM 目录不得因 R4 进面')
  assert.ok(!gate.isScannedPath('monitoring/loki/loki-config.yml'))
  assert.ok(!gate.isScannedPath('docker-compose.yml'), 'compose 里历史注释就写着 dingtalk-webhook/feishu-webhook')
  assert.ok(!gate.isScannedPath('.github/workflows/ci.yml.bak'))
  // workflows/*.yml 本就在面内(判 R1-R3),但 R4 对它不生效
  assert.ok(gate.isScannedPath('.github/workflows/ci.yml'))
  assert.equal(r4Of('.github/workflows/ci.yml', "jobs:\n  a:\n    runs-on: ubuntu-latest\n    email_configs:\n").length, 0)
})

test('品牌出口 carve 精准到单一路径:出口不判 R2/R3 且如实计数,同目录邻居照判', () => {
  const MTS = ["const url = 'https://api.resend.com/emails'", "await fetch(url, { body: JSON.stringify({ text }) })"].join('\n')
  assert.equal(gate.BRAND_EXIT_REL, 'apps/api/scripts/notify-deploy-failure.ts', 'carve 路径钉死:它是本门推荐的唯一出口')
  const exitHit = gate.judgeText(gate.BRAND_EXIT_REL, MTS)
  assert.equal(exitHit.violations.length, 0, '出口自身就是品牌层,判它"绕过品牌层"是语义倒置')
  assert.equal(exitHit.stats.brandExitSkipped, 1, '跳过必须留痕,不得静默')
  const out = gate.judgeText('apps/api/scripts/notify-deploy-failureX.ts', MTS)
  assert.ok(out.violations.some((v) => v.rule === 'R2'), '路径改一个字即判红 —— carve 不是一整目录')
  assert.ok(gate.isBrandExitScript('apps\\api\\scripts\\notify-deploy-failure.ts'), '反斜杠路径须归一')
})

test('装车证明(2026-09-24 补齐):runner 里 81 的 stagedTriggers 必须含 monitoring/ 与 apps/api/scripts/', () => {
  // 判据扫到了这两个面,触发清单却没跟上 = 只改 bridge 的提交在 pre-commit 根本不唤起本门。
  // 这类"半装车"是守门 70/76 的同型事故,故用镜像测试钉死,而不是留在源码注释里等人看。
  const runner = readFileSync(join(REPO, 'scripts', 'guardian-runner.mjs'), 'utf8')
  const block = /id:\s*'81'[\s\S]{0,1400}/.exec(runner)?.[0] ?? ''
  assert.ok(block, 'runner 里必须能找到 id 81 条目')
  assert.match(
    block,
    /stagedTriggers:\s*\[[^\]]*'monitoring\/'[^\]]*'apps\/api\/scripts\/'[^\]]*\]/,
    '只扫面不触发 = 半装车;扩面必须与触发清单同步',
  )
})

test('真仓不变量:全量审计判绿,且扩面真的在生效(不是又一道看不见东西的判据)', () => {
  assert.ok(
    existsSync(join(REPO, 'scripts', 'brand-email-channel-baseline.json')),
    '基线文件必须存在 —— 缺失时本门按空基线判定,存量红会全体复现',
  )
  const base = JSON.parse(readFileSync(join(REPO, 'scripts', 'brand-email-channel-baseline.json'), 'utf8'))
  assert.deepEqual(Object.keys(base.counts || {}), [], '基线必须为空:非空即有新通道绕版式(表内自述:改接品牌层,不得回写本表)')
  const res = gate.audit(REPO)
  assert.equal(res.code, 0, `检出未基线化违规:${JSON.stringify(res.violations)}`)
  assert.ok(res.stats.judged > 0, '一个在范围文件都没判定 = 判据空转,必须红')
  // 改前(HEAD 版跑真仓,同一取材面)实测 431;R4 三面(+alertmanager.yml / .yml.tmpl / noise-rules.yml)= 434。
  // 下限留 430 容并行会话增删脚本;R4 面是否**真在生效**由下一行的 amCommentLiterals 钉死,不靠行数自证。
  assert.ok(res.stats.judged >= 430, `判定文件数 ${res.stats.judged} < 430 ⇒ 扩面被写回/失效`)
  assert.equal(res.stats.brandExitSkipped, 1, '品牌出口未被判定 ⇒ apps/api/scripts/** 没进面(扩面回归)')
  // 反"扫不到所以恒绿"(守门 52 教训):废弃桩 alertmanager.yml 通篇注释,内含 2 处 smtp_ 字面量。
  // 这个计数只有在 R4 面真的读到那三份文件时才可能 >0 ⇒ 面被摘掉当场暴露。
  assert.ok(
    res.stats.amCommentLiterals >= 2,
    `AM 注释字面量计数 ${res.stats.amCommentLiterals} < 2 ⇒ R4 面空转(monitoring/alertmanager/** 没被读到)`,
  )
  // 真仓现状:线上模板逐字判绿(它一旦被加回旁路面,这条与提交时的门会同时红)
  const tmpl = readFileSync(join(REPO, 'monitoring', 'alertmanager', 'alertmanager.yml.tmpl'), 'utf8')
  assert.equal(r4Of(AM_TMPL_REL, tmpl).length, 0, '真仓 alertmanager.yml.tmpl 当前必须是 bridge-only 干净形态')
  // 注入对照(不碰真文件):同一份真模板加回一行 email_configs ⇒ 必红且点名
  const injected = tmpl.replace("    webhook_configs:\n", "    webhook_configs:\n    email_configs:\n")
  assert.notEqual(injected, tmpl, '注入锚点失效:模板里找不到 webhook_configs 行')
  assert.ok(r4Of(AM_TMPL_REL, injected).some((v) => /R4a/.test(v.reason)), '真模板注入 email_configs 后判据必须可见')
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
  const n = Number((out.match(/self-test 全部通过\((\d+) 例/) || [])[1] || 0)
  assert.ok(n >= 61, `自检例数 ${n} < 61 ⇒ 扩面/R4 判据用例被写回(2026-09-24 起 30 → 46 → 61 含 R4)`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
