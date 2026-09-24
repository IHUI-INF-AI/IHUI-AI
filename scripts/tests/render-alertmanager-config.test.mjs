// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Alertmanager 告警出口"唯一化"的**静态自证**测试(§22c 镜像测试:直接 import 源脚本 __test__)。
 *
 * 判据取向:本文件对的是"结构对账",可以硬(与运行链解耦,零网络、零凭据、零子进程投递)。
 * 覆盖的五类红(任务书 ①-⑤ 的正反成对):
 *   F 单通道结构:产物里出现原生邮件面 / IM 中转旁路(receiver 名不匹配如 feishu-copy 也认,
 *     host/路径签名同样命中)/ route 或 webhook 不落 9096 / 占位符重现 ⇒ assertBridgeOnlySurface 抛错;
 *     收敛后的真模板 ⇒ 通过。红绿两侧都必须端到端跑 CLI(--check / --out 拒写)证明。
 *   B 键集合对账:渲染器源码读的键与 .env.example 声明的 ALERT_SMTP_* 双向对账 ——
 *     读一个不存在的键即红,留一个没人读的死登记也即红(AM 侧 SMTP 注入已整体删除,两侧都应为空)。
 *   A 载体卫生:渲染产物(第二份真相)必须仍被 git 忽略;旧落点 alertmanager.yml 保持
 *     "缺 route/receivers 即加载报错"的废弃桩语义。
 *   D 调度语义:critical 不挂静默、warning/info 挂夜间窗口、聚合/重复参数原样保留 ——
 *     收敛 receiver 不得顺手改节流。
 *   G 字面残留:模板**含注释**都不许再出现邮件/IM 通道字面量(与提交前人工 grep 同判据)。
 *
 * 运行:node --test scripts/tests/render-alertmanager-config.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as R } from '../render-alertmanager-config.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TMPL = join(ROOT, 'monitoring/alertmanager/alertmanager.yml.tmpl')
const COMPOSE = join(ROOT, 'docker-compose.yml')
const RENDERER_SRC = join(ROOT, 'scripts/render-alertmanager-config.mjs')
const ENV_EXAMPLE = join(ROOT, '.env.example')

const tmplText = readFileSync(TMPL, 'utf8')
const rendererSource = readFileSync(RENDERER_SRC, 'utf8')
const envExampleText = readFileSync(ENV_EXAMPLE, 'utf8')

/** git 只读调用:绝对路径 git + windowsHide(守门 52)+ timeout(守门 80)。 */
function git(args) {
  return execFileSync(resolveGitBin(), ['-c', 'safe.directory=*', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15000,
  })
}

/** 跑一次真 CLI(独立 node 进程,证明"红/绿"不止活在函数层)。 */
function runCliExit(args) {
  try {
    const stdout = execFileSync(process.execPath, [RENDERER_SRC, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, stdout, stderr: '' }
  } catch (err) {
    return { code: err.status, stdout: String(err.stdout ?? ''), stderr: String(err.stderr ?? '') }
  }
}

// ── §22c 锚点:源脚本必须真把这些判据函数 export 出来 ───────────────────────────
test('§22c 锚点:__test__ 暴露判据函数(防止测试与源脚本漂移)', () => {
  for (const k of ['TEMPLATE_REL', 'DEFAULT_OUT_REL', 'BRIDGE_URL', 'BRIDGE_RECEIVER', 'parseDotenv', 'blankOutCommentLines', 'findPlaceholders', 'parseSubroutes', 'assertBridgeOnlySurface', 'collectRendererEnvReads', 'reconcileEnvKeys', 'isGitIgnored', 'outputPathSafety', 'parseArgs']) {
    assert.ok(k in R, `__test__ 缺少出口 ${k}`)
  }
  assert.equal(R.BRIDGE_URL, 'http://127.0.0.1:9096/alert', 'bridge 出口常量与本任务书不一致')
})

// ── F. 单通道结构自校验(核心正反对照)────────────────────────────────────────────
test('F0 反例基线:收敛后的真模板判绿,且结构逐项对得上', () => {
  const s = R.assertBridgeOnlySurface(tmplText)
  assert.equal(s.receiver, 'default-webhook')
  assert.equal(s.url, R.BRIDGE_URL)
  assert.deepEqual(s.declared, ['default-webhook'], 'receivers 必须恰有唯一 default-webhook')
  assert.deepEqual(s.receiverRefs, ['default-webhook'])
  assert.deepEqual(s.urls, [R.BRIDGE_URL])
  assert.ok(s.subrouteCount >= 3, `子路由应 ≥3(critical/warning/info),实得 ${s.subrouteCount}`)
})

test('F1 正例①:receiver 底下加回 email_configs ⇒ 判红并点名原生邮件面', () => {
  const bad = tmplText.replace(
    "  - name: 'default-webhook'\n",
    "  - name: 'default-webhook'\n    email_configs:\n      - to: 'ops@example.com'\n",
  )
  assert.notEqual(bad, tmplText, '夹具没挂上(模板结构变了,判据失去对象)')
  assert.throws(() => R.assertBridgeOnlySurface(bad), /原生邮件通道/)
})

test('F1b 正例①变体:global 里加回 smtp_* 段 ⇒ 同一道判据判红', () => {
  const bad = tmplText.replace('global:\n', 'global:\n  smtp_smarthost: smtp.example.net:587\n  smtp_from: ops@example.net\n')
  assert.throws(() => R.assertBridgeOnlySurface(bad), /原生邮件通道/)
})

test('F3 正例③:route 的 webhook 不落 9096 ⇒ 判红(换端口与换 host 都要认)', () => {
  for (const other of ['http://127.0.0.1:9999/alert', 'http://bridge.internal:9096/alert']) {
    const bad = tmplText.replaceAll(R.BRIDGE_URL, other)
    assert.throws(() => R.assertBridgeOnlySurface(bad), new RegExp(`不指向 bridge|旁路`), `url=${other} 应判红`)
  }
  // 反向对照:根 receiver 改指一个不存在的旁路 ⇒ 判红(内联 `- receiver:` 形态同样要认,故用内联写法)
  const badRef = tmplText.replace("route:\n  receiver: 'default-webhook'", "route:\n  - receiver: 'legacy-side-door'")
  assert.throws(() => R.assertBridgeOnlySurface(badRef), /旁路 receiver/)
})

test('F4 正例④:IM receiver 名字不匹配(feishu-copy)也判红;host/路径签名同判', () => {
  // 名字形态:自造一个不叫 feishu 的克隆 receiver(旧事故里 receiver 名与旁路一一对应)
  const named = tmplText.replace(
    "  - name: 'default-webhook'\n    webhook_configs:",
    "  - name: 'alert-bot-copy'\n    webhook_configs:\n      - url: 'https://oapi.dingtalk.com/robot/send'\n        send_resolved: true\n  - name: 'default-webhook'\n    webhook_configs:",
  )
  assert.notEqual(named, tmplText, '夹具没挂上')
  assert.throws(() => R.assertBridgeOnlySurface(named), /IM 中转旁路|不指向 bridge/)
  // host 特征形态:receiver 名完全干净,只有 url 泄露飞书域名
  // (replaceAll:头注释里也出现 bridge url 原文,单点 replace 会先命中注释、剥注释后等于没改 —— 夹具自身的坑)
  const hosty = tmplText.replaceAll(R.BRIDGE_URL, 'https://open.feishu.cn/open-apis/bot/v2/hook/xxx')
  assert.throws(() => R.assertBridgeOnlySurface(hosty), /IM 中转旁路/)
  // 任务书点名的"名字不匹配"字面例:receiver 名 feishu-copy(host 保持 bridge,证明名字特征独立命中)
  const feishuCopy = tmplText.replaceAll(R.BRIDGE_RECEIVER, 'feishu-copy')
  assert.throws(() => R.assertBridgeOnlySurface(feishuCopy), /IM 中转旁路/)
})

test('F5 占位符重现 ⇒ 判红(收敛后不存在任何合法模板变量)', () => {
  const bad = tmplText.replace("  resolve_timeout: 5m\n", "  resolve_timeout: 5m\n  bogus_target: '${SOME_INJECTED_VAR}'\n")
  assert.throws(() => R.assertBridgeOnlySurface(bad), /占位符/)
  assert.deepEqual(R.findPlaceholders(tmplText), [], '真模板不该再有任何非注释占位符')
})

test('F6 端到端装车:真模板跑 --check 必 exit 0;--out 指到已跟踪路径必 exit 1 且一个字节都不写', () => {
  const ok = runCliExit(['--check'])
  assert.equal(ok.code, 0, `--check 应 exit 0,实得 ${ok.code}:${ok.stderr}`)
  assert.match(ok.stdout, /bridge-only 结构自校验通过/, `--check 未打印通过结论:\n${ok.stdout}`)
  assert.match(ok.stdout, /receivers 唯一/, `通过结论必须点名单通道结构:\n${ok.stdout}`)

  const before = readFileSync(join(ROOT, 'README.md'), 'utf8')
  const bad = runCliExit(['--out', join(ROOT, 'README.md')])
  assert.equal(bad.code, 1, `--out 到已跟踪路径应 exit 1,实得 ${bad.code}`)
  assert.match(bad.stderr, /git 忽略/, `拒写理由必须点名"第二份真相"防护:${bad.stderr}`)
  assert.equal(readFileSync(join(ROOT, 'README.md'), 'utf8'), before, 'H2 拒写却在写盘前动了被跟踪文件')
})

test('F7 --env-file / --set 已随 SMTP 注入通道删除:传入必须显式拒绝而不是静默忽略', () => {
  assert.throws(() => R.parseArgs(['--env-file', 'x.env']), /未知选项/)
  assert.throws(() => R.parseArgs(['--set', 'A=B']), /未知选项/)
  assert.throws(() => R.parseArgs(['--chekc']), /未知选项/)
})

// ── B. 键集合对账(读不存在的键即红;死登记同样即红)─────────────────────────────
test('B1 对账机制本身:合成两侧各造一处漂移,两个方向都必须红', () => {
  // 方向①"读一个不存在的键":渲染器读 ALERT_SMTP_GHOST,.env.example 没登记 → undeclaredReads 点名
  const ghost = R.reconcileEnvKeys('const v = env.ALERT_SMTP_GHOST\n', 'ALERT_EMAIL_TO=\n')
  assert.deepEqual(ghost.undeclaredReads, ['ALERT_SMTP_GHOST'], '渲染器读了 .env.example 里不存在的键却没判红 ⇒ 对账失效')
  assert.deepEqual(ghost.staleDeclarations, [])
  // 方向②"留一个没人读的死登记":渲染器零读取,.env.example 仍挂着 ALERT_SMTP_ZOMBIE → staleDeclarations 点名
  const zombie = R.reconcileEnvKeys('const v = 1\n', 'ALERT_SMTP_ZOMBIE=\nALERT_EMAIL_TO=\n')
  assert.deepEqual(zombie.undeclaredReads, [])
  assert.deepEqual(zombie.staleDeclarations, ['ALERT_SMTP_ZOMBIE'], '.env.example 留着没人读的 ALERT_SMTP_* 死登记却没判红 ⇒ 死配置复活')
  // 绿侧对照:读=登记 且键属业务侧(ALERT_EMAIL_TO 归 apps/api,不在 AM 死登记判据内)
  const live = R.reconcileEnvKeys('const v = env.ALERT_LIVE_KEY\n', 'ALERT_LIVE_KEY=\nALERT_EMAIL_TO=\n')
  assert.deepEqual(live.undeclaredReads, [])
  assert.deepEqual(live.staleDeclarations, [])
})

test('B2 现网对账:渲染器零 env 读取,.env.example 零 ALERT_SMTP_* 登记(两侧同时为空)', () => {
  const { reads, undeclaredReads, staleDeclarations } = R.reconcileEnvKeys(rendererSource, envExampleText)
  assert.deepEqual(reads, [], `渲染器仍在读环境变量:${reads.join(',')} —— SMTP 注入通道已删,任何 ALERT_* 读取都是死配置`)
  assert.deepEqual(undeclaredReads, [])
  assert.deepEqual(staleDeclarations, [], `.env.example 仍登记 ALERT_SMTP_*:${staleDeclarations.join(',')} —— 没有读取者的配置项必须删净`)
  // 业务侧收件人键与 AM 面无关,必须**不被**顺手删(它由 apps/api 的派发器读取)
  assert.match(envExampleText, /^ALERT_EMAIL_TO=/m, 'ALERT_EMAIL_TO 被误删:apps/api 的告警邮件收件人唯一登记处')
  // 更强的"零读取"面:整个渲染器源码(剥注释后)不允许出现 process.env
  const code = rendererSource
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
    .join('\n')
  assert.doesNotMatch(code, /process\.env/, '渲染器出现 process.env ⇒ 通道收口被重新打开')
})

test('B3 compose 挂的是渲染产物,不是模板(挂载点与渲染器默认输出一一对账)', () => {
  const compose = readFileSync(COMPOSE, 'utf8')
  const svc = /^ {2}alertmanager:\n(?:(?: {2}|\t).*\n?|\n)*/m.exec(compose)?.[0]
  assert.ok(svc, 'compose 里找不到 alertmanager 服务定义')
  const mounts = [...svc.matchAll(/-\s*\.\/([^:\s]+):\/etc\/alertmanager\/alertmanager\.yml/g)].map((m) => m[1])
  assert.equal(mounts.length, 1, `应恰有一条挂到 /etc/alertmanager/alertmanager.yml,实得 ${mounts.join(',')}`)
  assert.equal(mounts[0], R.DEFAULT_OUT_REL, `compose 挂了 ${mounts[0]} 而不是渲染产物 ⇒ 直接把模板喂给 Alertmanager 必失败`)
})

// ── A. 载体卫生 ────────────────────────────────────────────────────────────────
test('A1 渲染产物(第二份真相)确实被 git 忽略,且默认输出路径就是它;模板本体不被忽略', () => {
  assert.equal(R.DEFAULT_OUT_REL, 'monitoring/alertmanager/alertmanager.rendered.yml')
  const abs = resolve(ROOT, R.DEFAULT_OUT_REL)
  assert.equal(R.isGitIgnored(abs), true, `渲染产物路径 ${R.DEFAULT_OUT_REL} 未被 git 忽略 ⇒ 生成物入库成为漂移的第二份真相`)
  assert.equal(R.isGitIgnored(TMPL), false, '模板被 git 忽略了 ⇒ 单一真相源进不了仓,机制等于没有')
})

test('A2 写出路径三态:仓库外=构造安全 / 仓库内被忽略=安全 / 仓库内已跟踪=拒写(unknown 按不安全)', () => {
  assert.equal(R.outputPathSafety(resolve(ROOT, '..', 'ihui-outside-repo-probe.yml')), 'outside-repo')
  assert.equal(R.outputPathSafety(join(ROOT, 'monitoring/alertmanager/alertmanager.rendered.yml')), 'ignored')
  assert.equal(R.outputPathSafety(join(ROOT, 'README.md')), 'tracked')
  assert.equal(R.outputPathSafety(join(ROOT, 'monitoring/alertmanager/alertmanager.yml')), 'tracked')
  const v = R.outputPathSafety(join(ROOT, 'scripts/tests/__no_such_probe_dir__/x.yml'))
  assert.ok(['tracked', 'ignored', 'unknown'].includes(v), `返回值域被破坏: ${v}`)
})

test('A3 旧落点 alertmanager.yml 保持"加载即响"的废弃桩语义(不得被动回收成可用配置)', () => {
  const p = resolve(ROOT, 'monitoring/alertmanager/alertmanager.yml')
  const text = existsSync(p) ? readFileSync(p, 'utf8') : ''
  assert.match(text, /alertmanager\.yml\.tmpl/, '退役文件必须指名单一真相源在哪')
  assert.equal(/^route:/m.test(text), false, 'alertmanager.yml 重新可加载 ⇒ 会静默跑一份发不出告警的旧配置')
  assert.equal(/^receivers:/m.test(text), false, 'alertmanager.yml 仍带 receivers ⇒ 双份真相')
})

test('A4 旧事故面清零:模板**含注释**也不得再出现邮件/IM 通道字面量(与人工 grep 同判据)', () => {
  const hits = [...tmplText.matchAll(/email_configs|dingtalk|feishu|wechat|smtp_/gi)].map((m) => m[0].toLowerCase())
  assert.deepEqual([...new Set(hits)], [], `模板残留通道字面量(注释里也不许留):${[...new Set(hits)].join(', ')}`)
})

test('A5 入库面对账:alertmanager 目录里"会入库"的文件不含渲染产物,且模板本体确在清单内', () => {
  // 范围 = 已跟踪 ∪ 未跟踪但未被忽略;渲染产物按定义被忽略,出现在这里即 .gitignore 那条失效
  const listed = (args) =>
    git([...args, '--', 'monitoring/alertmanager'])
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  const scope = [...new Set([...listed(['ls-files']), ...listed(['ls-files', '--others', '--exclude-standard'])])]
  assert.ok(
    scope.some((f) => f.endsWith('alertmanager.yml.tmpl')),
    `扫描面里没有模板本体 ⇒ 机制扫不到单一真相源:${scope.join(', ')}`,
  )
  assert.equal(
    scope.some((f) => f.endsWith('alertmanager.rendered.yml')),
    false,
    '渲染产物出现在"会入库"清单里 ⇒ .gitignore 那条规则已失效,第二份真相随时可能提交',
  )
  const unexpected = scope.filter((f) => !/(\.tmpl|alertmanager\.yml|noise-rules\.yml)$/.test(f))
  assert.deepEqual(unexpected, [], `目录里出现了未登记的入库文件:${unexpected.join(', ')}`)
})

// ── D. 调度语义(收敛 receiver 不得顺手改节流/静默)──────────────────────────────
test('D1 critical 子路由不挂任何静默窗口(半夜的 P0 不许被吞)', () => {
  const routes = R.parseSubroutes(tmplText)
  assert.ok(routes && routes.length >= 3, `route.routes 解析失败(返回 ${JSON.stringify(routes)}) ⇒ 判据无法成立不等于通过`)
  const critical = routes.filter((r) => r.matchers.includes('severity=critical'))
  assert.equal(critical.length, 1, `critical 应恰有一条子路由,实得 ${critical.length}`)
  assert.deepEqual(critical[0].mute, [], `critical 挂了静默 ${critical[0].mute.join(',')} ⇒ 自保链断`)
})

test('D2 warning / info 仍挂夜间维护窗口,mute_time_intervals 定义未被顺手删', () => {
  const routes = R.parseSubroutes(tmplText) ?? []
  const bySeverity = Object.fromEntries(routes.map((r) => [r.matchers.join('&'), r]))
  for (const sev of ['severity=warning', 'severity=info']) {
    const r = bySeverity[sev]
    assert.ok(r, `缺少 ${sev} 子路由`)
    assert.deepEqual(r.mute, ['nightly-maintenance'], `${sev} 应挂 nightly-maintenance,实得 ${JSON.stringify(r.mute)}`)
  }
  assert.match(tmplText, /^mute_time_intervals:\n {2}- name: nightly-maintenance/m, 'mute_time_intervals 定义被删 ⇒ 上面的引用会加载失败')
})

test('D3 既有调度参数原样保留(30s/5m/4h + group_by),级联抑制规则未随 receiver 收敛丢失', () => {
  assert.match(tmplText, /^ {2}group_wait: 30s$/m)
  assert.match(tmplText, /^ {2}group_interval: 5m$/m)
  assert.match(tmplText, /^ {2}repeat_interval: 4h$/m)
  assert.match(tmplText, /^ {2}group_by: \['alertname', 'service'\]$/m)
  for (const pair of [
    ['alertname="ApiDown"', 'alertname="ApiHighErrorRate"'],
    ['alertname="ApiDown"', 'alertname="ApiSlowResponse"'],
    ['alertname="AiServiceDown"', 'alertname="LlmProviderUnhealthy"'],
  ]) {
    assert.ok(tmplText.includes(pair[0]) && tmplText.includes(pair[1]), `inhibit 规则对丢失:${pair.join(' → ')}`)
  }
  assert.ok(tmplText.includes('severity="critical"'), 'critical→warning 的总抑制规则丢失')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
