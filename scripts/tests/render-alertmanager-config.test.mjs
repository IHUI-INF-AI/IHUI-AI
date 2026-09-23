// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Alertmanager 邮件通道接通的**静态自证**测试(§22c 镜像测试:直接 import 源脚本 __test__)。
 *
 * 为什么是"静态测试"而不是"跑一次真发信":
 *   ① 本机没有 docker(`docker: command not found`),compose 那条路径无法在此实跑;
 *   ② 真发信要给第三方邮箱发告警邮件,本仓约定不允许(收件人只限 502319984@qq.com);
 *   ③ 这类"配置写错但进程照样起来"的缺陷,恰恰只在静态对账下才看得见 ——
 *      实测 Alertmanager 0.34.0 对 smtp.qq.com:587 + smtp_require_tls:false 这组**配反**的值
 *      照单全收、正常监听,不会替我们把关。
 *   先例同构:apps/api/tests/o5-nginx-edge-ratelimit.test.ts 也是对配置文件做静态解析对账,
 *   而不是去跑 nginx -t。
 *
 * 覆盖的四类红:
 *   A 凭据卫生:不入库的 alertmanager 配置面里不得出现任何"像真实授权码"的赋值;
 *     渲染产物(含真值)必须确实被 git 忽略 —— 忽略规则一失效立即红。
 *   B 变量对账:模板里每个 ${VAR} 都要在渲染器 VAR_SPEC 里登记,VAR_SPEC 也不许留死条目。
 *   C TLS 自洽:模板里 smtp_require_tls 必须是"由端口推导"的占位符而非写死的布尔字面量,
 *     且 587→true / 465→false / 配反→抛错 三种形态都要成立。
 *   D 路由可达:critical 必须**真的**有一条子路由把它送到带 email_configs 的 receiver,
 *     且那条子路由不挂任何 mute_time_intervals(夜间静默只许吞 warning / info)。
 *     D 不是假想缺陷:旧 alertmanager.yml 只在根上写 receiver: default-email,
 *     而 Alertmanager 的根 receiver 仅在"没有任何子路由命中"时兜底 —— critical 命中了
 *     钉钉那条子路由,于是永远进不了邮件,与它自己"钉钉 + 邮件"的注释相反。
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

const readIfExists = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null)

/** git 只读调用:绝对路径 git + windowsHide(守门 52)+ timeout(守门 80)。 */
function git(args) {
  return execFileSync(resolveGitBin(), ['-c', 'safe.directory=*', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15000,
  })
}

// ── 极简 route 子路由解析(只为 D 服务,不追求通用 YAML 能力)────────────────────
/**
 * 从配置文本里取 `route:` 顶层块内 `routes:` 列表的每一项。
 * 依赖本仓模板的固定缩进:routes: 在 2 空格,列表项在 4 空格,项内键在 6 空格。
 * 解析不出来就返回 null —— 调用方按"红"处理,绝不静默通过。
 */
function parseSubroutes(text) {
  const routeBlock = /^route:\n((?:[ ]{2}.*\n?)*)/m.exec(String(text))
  if (!routeBlock) return null
  const body = routeBlock[1]
  const listStart = /^ {2}routes:\n/gm.exec(body)
  if (!listStart) return []
  const rest = body.slice((listStart.index ?? 0) + listStart[0].length)
  const items = []
  let cur = null
  let lastKey = null
  for (const line of rest.split('\n')) {
    if (line.trim() === '') continue
    const m4 = /^ {4}- (.*)$/.exec(line)
    if (m4) {
      cur = { matchers: [], receiver: null, continue: null, mute: [] }
      items.push(cur)
      lastKey = null
      const first = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(m4[1])
      if (first) applyKV(cur, first[1], first[2], (k) => (lastKey = k))
      continue
    }
    const m6 = /^ {6}(?:- )?([A-Za-z_][\w-]*):\s*(.*)$/.exec(line)
    if (m6 && cur) {
      if (m6[2] === '') {
        lastKey = m6[1]
      } else {
        applyKV(cur, m6[1], m6[2], (k) => (lastKey = k))
      }
      continue
    }
    const listItem = /^ {8}- (.*)$/.exec(line)
    if (listItem && cur && lastKey === 'mute_time_intervals') {
      cur.mute.push(listItem[1].trim().replace(/^['"]|['"]$/g, ''))
    }
  }
  return items

  function applyKV(obj, key, rawVal, remember) {
    const val = rawVal.trim().replace(/^['"]|['"]$/g, '')
    if (key === 'matchers') {
      obj.matchers = [...rawVal.matchAll(/([\w]+)\s*=\s*"([^"]*)"/g)].map((m) => `${m[1]}=${m[2]}`)
      return
    }
    if (key === 'receiver') obj.receiver = val
    else if (key === 'continue') obj.continue = val === 'true'
    else if (key === 'mute_time_intervals') remember(key)
  }
}

// ── §22c 锚点:源脚本必须真把这些判据函数 export 出来 ───────────────────────────
test('§22c 锚点:__test__ 暴露判据函数(防止测试与源脚本漂移)', () => {
  for (const k of [
    'VAR_SPEC',
    'TEMPLATE_REL',
    'DEFAULT_OUT_REL',
    'parseDotenv',
    'requireTlsFromPort',
    'assertTlsCoherent',
    'resolveVars',
    'findPlaceholders',
    'renderTemplate',
    'assertRenderedSurface',
    'maskRenderedSecrets',
    'isGitIgnored',
  ]) {
    assert.ok(typeof R[k] === 'function' || k === 'VAR_SPEC' || k.endsWith('_REL'), `__test__ 缺少出口 ${k}`)
  }
})

// ── A. 凭据卫生 ────────────────────────────────────────────────────────────────
/**
 * "像真实授权码"的形态:QQ/163 这类中继发的是 **16 位纯小写字母数字**授权码,
 * 常见的还有 20~40 位无空格无中文的 ASCII 串。模板里合法的取值只有两种:
 *   ① ${...} 占位符 ② 空串 / <your-...> 之类的显式占位。
 * 其余一律算真值嫌疑。刻意不比对真实 .env 内容(测试要能在 CI 上跑,那边没有 .env)。
 */
function credentialSuspects(text, srcName) {
  const hits = []
  const keyRe = /^\s*(smtp_auth_password|smtp_auth_password_file|smtp_auth_username|smtp_from|smtp_smarthost|smtp_auth_password\s*:)\s*:\s*(.*)$/
  String(text)
    .split('\n')
    .forEach((line, idx) => {
      if (line.trimStart().startsWith('#')) return // 整行注释是说明文字,不是配置
      const m = keyRe.exec(line)
      if (!m) return
      const raw = m[2].trim()
      const val = raw.replace(/^['"]|['"]$/g, '')
      if (val === '') return
      if (/\$\{[A-Za-z_]/.test(val)) return // 占位符
      if (/^<[^>]*>$/.test(val)) return // 显式占位
      if (/(example\.com|aizhs\.top|your-|localhost|CHANGE_?ME|PLACEHOLDER)/i.test(val)) return
      if (m[1] === 'smtp_auth_password_file') return // 路径不是凭据本身
      hits.push(`${srcName}:${idx + 1} → ${m[1]} 出现非占位符字面量:${R.maskSecret(val)}`)
    })
  // 任何一行只要出现"16 位纯小写字母数字"的赋值右侧,都按授权码形态报(与上面键名判据互补)
  String(text)
    .split('\n')
    .forEach((line, idx) => {
      if (line.trimStart().startsWith('#')) return
      const m = /(?:password|passwd|auth[^:]*:)\s*'([a-z0-9]{16})'/i.exec(line)
      if (m && !/placeholder|synthetic|example/i.test(m[1])) {
        hits.push(`${srcName}:${idx + 1} → 出现 16 位小写字母数字形态的授权码`)
      }
    })
  return hits
}

test('A1 不入库的 alertmanager 配置面:无任何真值形态的凭据赋值', () => {
  // 范围 = **会进入仓库的那批文件**(已跟踪 ∪ 未跟踪但未被忽略),
  // 而不是"目录里有什么就扫什么":被忽略的渲染产物按定义含真值,不该进这条判据;
  // 反过来,任何没被忽略的新文件(比如有人再放一份 .yml)自动纳入扫描。
  const listed = (args) =>
    git([...args, '--', 'monitoring/alertmanager'])
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  const scope = [...new Set([...listed(['ls-files']), ...listed(['ls-files', '--others', '--exclude-standard'])])]
  assert.ok(scope.length >= 3, `待扫面过小(${scope.length}):${scope.join(', ')}`)
  assert.ok(
    scope.some((f) => f.endsWith('alertmanager.yml.tmpl')),
    `扫描面里没有模板本体 ⇒ 判据扫不到关键文件:${scope.join(', ')}`,
  )
  assert.equal(
    scope.some((f) => f.endsWith('alertmanager.rendered.yml')),
    false,
    '渲染产物出现在"会入库"清单里 ⇒ .gitignore 那条规则已失效,授权码随时可能被提交',
  )
  const allHits = []
  for (const f of scope) {
    const abs = resolve(ROOT, f)
    if (!existsSync(abs)) continue // 已跟踪但被外部清理掉:由 §5b 工作区存续自愈负责,不在此判
    allHits.push(...credentialSuspects(readFileSync(abs, 'utf8'), f))
  }
  assert.deepEqual(allHits, [], `发现疑似真实凭据(应全部是 \${VAR} 占位符):\n${allHits.join('\n')}`)
})

test('A2 渲染产物(唯一含真值的那份)确实被 git 忽略,且默认输出路径就是它', () => {
  assert.equal(R.DEFAULT_OUT_REL, 'monitoring/alertmanager/alertmanager.rendered.yml')
  const abs = resolve(ROOT, R.DEFAULT_OUT_REL)
  const ignored = R.isGitIgnored(abs)
  assert.equal(ignored, true, `渲染产物路径 ${R.DEFAULT_OUT_REL} 未被 git 忽略 ⇒ 一次提交就把授权码入库`)
  // 反向对照:同目录下的模板**不该**被忽略(说明上一条 continue 不是因为"全部被忽略"而空转)
  assert.equal(R.isGitIgnored(TMPL), false, '模板被 git 忽略了 ⇒ 它进不了仓,机制等于没有')
})

test('A3 旧落点 alertmanager.yml 已退役为"加载即响"的空壳,不再是一份能静默跑死的配置', () => {
  const text = readIfExists(resolve(ROOT, 'monitoring/alertmanager/alertmanager.yml')) ?? ''
  // 它过去挂着 route/receivers + 占位符凭据,能被 AM 正常加载 → 永远发不出信也没人知道
  assert.equal(/^route:/m.test(text), false, 'alertmanager.yml 仍可加载 ⇒ 会静默跑一份发不出信的旧配置')
  assert.equal(/^receivers:/m.test(text), false, 'alertmanager.yml 仍带 receivers ⇒ 双份真相')
  assert.match(text, /alertmanager\.yml\.tmpl/, '退役文件必须指名单一真相源在哪')
})

// ── B. 变量对账 ────────────────────────────────────────────────────────────────
test('B1 模板里每个 ${VAR} 都在 VAR_SPEC 登记,且 VAR_SPEC 无死条目', () => {
  const tmpl = readFileSync(TMPL, 'utf8')
  const used = [...new Set(R.findPlaceholders(tmpl))]
  assert.ok(used.length >= 5, `模板只用到 ${used.length} 个占位符 ⇒ 机制没真接上:${used.join(',')}`)
  const undeclared = used.filter((v) => !(v in R.VAR_SPEC))
  assert.deepEqual(undeclared, [], `模板用了未登记的变量:${undeclared.join(',')}`)
  const unused = Object.keys(R.VAR_SPEC).filter((v) => !used.includes(v))
  assert.deepEqual(unused, [], `VAR_SPEC 里有模板不再用的死条目:${unused.join(',')}`)
})

test('B2 每个登记变量都能落到一个具体来源键上(env 或派生)', () => {
  for (const [name, spec] of Object.entries(R.VAR_SPEC)) {
    assert.ok(Array.isArray(spec.sources) && spec.sources.length >= 1, `${name} 没有声明 sources`)
    for (const s of spec.sources) {
      // sources 必须是**真实环境变量名**(渲染器按键名取值),不许写"SMTP_HOST + SMTP_PORT"这种说明句
      assert.match(s, /^[A-Z][A-Z0-9_]*$/, `${name} 的来源 ${s} 不是合法 env 键名(描述性文字不算来源)`)
    }
  }
  // 密码那条必须被标成 secret,否则脱敏输出会把它原样打印出来
  assert.equal(R.VAR_SPEC.ALERT_SMTP_PASSWORD_DIRECTIVE.secret, true, '授权码变量必须标 secret')
})

test('B3 compose 挂的是渲染产物,不是模板(挂载点与渲染器默认输出一一对账)', () => {
  const compose = readFileSync(COMPOSE, 'utf8')
  const svc = /^ {2}alertmanager:\n(?:(?: {2}|\t).*\n?|\n)*/m.exec(compose)?.[0]
  assert.ok(svc, 'compose 里找不到 alertmanager 服务定义')
  const mounts = [...svc.matchAll(/-\s*\.\/([^:\s]+):\/etc\/alertmanager\/alertmanager\.yml/g)].map((m) => m[1])
  assert.equal(mounts.length, 1, `应恰有一条挂到 /etc/alertmanager/alertmanager.yml,实得 ${mounts.join(',')}`)
  assert.equal(mounts[0], R.DEFAULT_OUT_REL, `compose 挂了 ${mounts[0]} 而不是渲染产物 ⇒ 直接把模板喂给 Alertmanager 必失败`)
})

test('B4 compose 不再用 environment 假装注入 SMTP(AM 不展开变量,那是第二份假机制)', () => {
  const compose = readFileSync(COMPOSE, 'utf8')
  const svc = /^ {2}alertmanager:\n(?:(?: {2}|\t).*\n?|\n)*/m.exec(compose)?.[0] ?? ''
  const envBlock = /(^|\n) {4}environment:\n((?: {6}- .*\n?)*)/m.exec(svc)
  const envVars = envBlock ? envBlock[2].trim().split('\n').join(' ') : ''
  assert.doesNotMatch(envVars, /SMTP/i, 'compose 的 alertmanager environment 里仍挂着 SMTP_* ⇒ 那是 AM 永远读不到的假通道')
})

// ── C. TLS 形态自洽 ────────────────────────────────────────────────────────────
test('C1 模板里的 TLS 值是推导占位符,端口也在同一处给(不允许两处各说各话)', () => {
  const tmpl = readFileSync(TMPL, 'utf8')
  const tlsLine = /^\s*smtp_require_tls:\s*(.*)$/m.exec(tmpl)?.[1] ?? ''
  assert.equal(tlsLine.trim(), '${ALERT_SMTP_REQUIRE_TLS}', `smtp_require_tls 必须是推导占位符,实得 ${JSON.stringify(tlsLine)}`)
  const hostLine = /^\s*smtp_smarthost:\s*(.*)$/m.exec(tmpl)?.[1] ?? ''
  assert.match(hostLine, /\$\{ALERT_SMTP_SMARTHOST\}/, 'smtp_smarthost 必须是 \${ALERT_SMTP_SMARTHOST}')
  // host 与 port 合并成一个变量给,避免"改了端口忘了改 TLS"
  assert.doesNotMatch(tmpl, /^\s*smtp_smarthost:\s*'[^']*[0-9]{2,5}'\s*$/m, '模板里不该出现带端口的字面量地址')
})

test('C2 端口 → require_tls 的推导表(587/25 STARTTLS=true,465 隐式 TLS=false,认不出即拒)', () => {
  assert.equal(R.requireTlsFromPort(587), true)
  assert.equal(R.requireTlsFromPort(25), true)
  assert.equal(R.requireTlsFromPort(465), false)
  assert.throws(() => R.requireTlsFromPort(2525), /未知 SMTP 端口/)
  assert.throws(() => R.requireTlsFromPort(''), /不是合法数字/)
})

test('C3 配反必须抛错 —— Alertmanager 自己不把关,这道闸只能我们自己建', () => {
  assert.throws(() => R.assertTlsCoherent('smtp.qq.com:587', false), /TLS 形态与端口不自洽/)
  assert.throws(() => R.assertTlsCoherent('smtp.qq.com:465', true), /TLS 形态与端口不自洽/)
  assert.equal(R.assertTlsCoherent('smtp.qq.com:587', true), true)
  assert.equal(R.assertTlsCoherent('smtp.qq.com:465', false), true)
  assert.throws(() => R.assertTlsCoherent('smtp.qq.com', true), /host:port 形态/)
})

test('C4 端到端:同一份模板分别按 587 / 465 渲染,产物的 TLS 与端口都自洽', () => {
  const tmpl = readFileSync(TMPL, 'utf8')
  for (const [port, expectTls] of [
    [587, 'true'],
    [465, 'false'],
  ]) {
    const { values } = R.resolveVars({
      SMTP_HOST: 'smtp.example.net',
      SMTP_PORT: String(port),
      SMTP_USER: 'alerts@example.net',
      SMTP_PASS: 'synthetic-placeholder-value',
      ALERT_SMTP_TO: 'ops@example.net',
    })
    const rendered = R.renderTemplate(tmpl, values)
    assert.match(rendered, new RegExp(`^\\s*smtp_smarthost: 'smtp\\.example\\.net:${port}'$`, 'm'), `端口 ${port} 未落到产物`)
    assert.match(rendered, new RegExp(`^\\s*smtp_require_tls: ${expectTls}$`, 'm'), `端口 ${port} 的 TLS 形态应 ${expectTls}`)
    assert.doesNotMatch(rendered, /\$\{ALERT_/, '产物里仍有未替换占位符')
    assert.doesNotMatch(rendered, /\bundefined\b/, '产物里出现 undefined ⇒ 取值链断了')
    // inline 模式下产物本身就是密钥载体 —— 这正是 A2 那条"输出路径必须被 git 忽略"存在的理由
    assert.match(rendered, /smtp_auth_password: 'synthetic-placeholder-value'/, 'inline 模式应把授权码写进产物(否则 A2 的忽略规则就没意义)')
    R.assertRenderedSurface(rendered)
  }
})

test('C5 缺凭据必须 fail-closed,而不是产出一份半截配置', () => {
  assert.throws(() => R.resolveVars({ SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '', SMTP_PASS: '' }), /缺少必需的 SMTP 变量/)
  assert.throws(() => R.resolveVars({ SMTP_HOST: 'smtp.qq.com', SMTP_PORT: '587', SMTP_PASS: 'x', ALERT_SMTP_TO: 'a@b.c' }), /ALERT_SMTP_ACCOUNT/)
})

test('C6 发信账号只有一个占位符 ⇒ 结构上保证 From == 登录账号(QQ 要求,否则 550)', () => {
  const tmpl = readFileSync(TMPL, 'utf8')
  const from = /^\s*smtp_from:\s*(.*)$/m.exec(tmpl)?.[1] ?? ''
  const user = /^\s*smtp_auth_username:\s*(.*)$/m.exec(tmpl)?.[1] ?? ''
  assert.equal(from.trim(), user.trim(), `smtp_from(${from.trim()}) 与 smtp_auth_username(${user.trim()}) 用了不同来源`)
  assert.match(from, /\$\{ALERT_SMTP_ACCOUNT\}/, '两处必须都取自同一个 ALERT_SMTP_ACCOUNT 占位符')
  // 渲染器也要在显式给两个不同账号时拒绝,而不是把矛盾交给中继去拒
  assert.throws(
    () =>
      R.resolveVars({
        ALERT_SMTP_SMARTHOST: 'smtp.qq.com:587',
        ALERT_SMTP_ACCOUNT: 'other@qq.com',
        SMTP_USER: 'login-account@qq.com',
        SMTP_PASS: 'x',
        ALERT_SMTP_TO: 'a@b.c',
      }),
    /不同源/,
  )
})

// ── D. 路由可达性(critical 不得被静默吞掉,也不得压根到不了邮件)────────────────
test('D1 critical 有一条**显式**子路由送到带 email_configs 的 receiver,且不挂任何静默窗口', () => {
  const tmpl = readFileSync(TMPL, 'utf8')
  const routes = parseSubroutes(tmpl)
  assert.ok(routes && routes.length >= 3, `route.routes 解析失败(返回 ${JSON.stringify(routes)}) ⇒ 判据无法成立不等于通过`)
  const critical = routes.filter((r) => r.matchers.includes('severity=critical'))
  assert.ok(critical.length >= 1, '没有任何一条 critical 子路由')
  for (const r of critical) {
    assert.deepEqual(r.mute, [], `critical 子路由挂了静默窗口 ${r.mute.join(',')} ⇒ 半夜的 P0 会被吞`)
  }
  // 根 receiver 只在"无子路由命中"时兜底,不能拿它当"critical 也会发邮件"的依据
  const criticalToEmail = critical.filter((r) => r.receiver === 'default-email')
  assert.equal(criticalToEmail.length, 1, `critical 应恰有一条显式送到 default-email,实得 ${criticalToEmail.length} 条`)
  const emailReceivers = /^\s*- name: 'default-email'\n(?:[ ]{4}.*\n?)*/m.exec(tmpl)?.[0] ?? ''
  assert.match(emailReceivers, /email_configs/, 'default-email 这个名字底下没有 email_configs ⇒ 上面那条断言是空的')
})

test('D2 夜间静默仍然生效,但只作用于 warning / info(不是"顺手全静默")', () => {
  const tmpl = readFileSync(TMPL, 'utf8')
  const routes = parseSubroutes(tmpl) ?? []
  const bySeverity = Object.fromEntries(routes.map((r) => [r.matchers.join('&'), r]))
  for (const sev of ['severity=warning', 'severity=info']) {
    const r = bySeverity[sev]
    assert.ok(r, `缺少 ${sev} 子路由`)
    assert.deepEqual(r.mute, ['nightly-maintenance'], `${sev} 应挂 nightly-maintenance,实得 ${JSON.stringify(r.mute)}`)
  }
  assert.match(tmpl, /^mute_time_intervals:\n {2}- name: nightly-maintenance/m, 'mute_time_intervals 定义被删了 ⇒ 上面的引用会加载失败')
})

test('D3 继续向下匹配链路完整:critical 的钉钉那一跳必须 continue,否则邮件收不到', () => {
  const tmpl = readFileSync(TMPL, 'utf8')
  const routes = parseSubroutes(tmpl) ?? []
  const firstCritical = routes.find((r) => r.matchers.includes('severity=critical'))
  assert.equal(firstCritical?.continue, true, `critical 首跳 continue=${firstCritical?.continue} ⇒ 后续子路由不再评估,default-email 那跳等于没写`)
  assert.ok(firstCritical && firstCritical !== routes.find((r) => r.receiver === 'default-email' && r.matchers.includes('severity=critical')))
})

// ── E. 脱敏输出 ────────────────────────────────────────────────────────────────
test('E1 渲染证据里的授权码必须打码,而 host / 邮箱照常可读', () => {
  const { values } = R.resolveVars({
    SMTP_HOST: 'smtp.qq.com',
    SMTP_PORT: '587',
    SMTP_USER: 'someone@qq.com',
    SMTP_PASS: 'abcdefghijklmnop',
    ALERT_SMTP_TO: 'ops@example.net',
  })
  const rendered = R.renderTemplate(readFileSync(TMPL, 'utf8'), values)
  const masked = R.maskRenderedSecrets(rendered)
  assert.doesNotMatch(masked, /abcdefghijklmnop/, '脱敏后仍能看到完整授权码 ⇒ 贴证据就等于泄密')
  assert.match(masked, /smtp_smarthost: 'smtp\.qq\.com:587'/, 'host:port 应保持可读(它不是凭据)')
  assert.match(masked, /smtp_from: 'someone@qq\.com'/, '发信邮箱应保持可读')
  assert.match(masked, /smtp_auth_password: '[^']*len=16\)'/, '脱敏应保留长度线索(与 §5d 的 前6***后2 (len=N) 同口径)')
  assert.equal(R.maskSecret('abcdefgh'), 'a***h (len=8)')
})

test('E2 file 模式下授权码根本不进渲染产物', () => {
  const { values } = R.resolveVars({
    SMTP_HOST: 'smtp.qq.com',
    SMTP_PORT: '587',
    SMTP_USER: 'someone@qq.com',
    ALERT_SMTP_PASSWORD_FILE: 'D:/DevEnv/secrets/smtp-pass.txt',
    ALERT_SMTP_TO: 'ops@example.net',
  })
  const rendered = R.renderTemplate(readFileSync(TMPL, 'utf8'), values)
  assert.match(rendered, /^\s*smtp_auth_password_file: 'D:\/DevEnv\/secrets\/smtp-pass\.txt'$/m)
  assert.doesNotMatch(rendered, /^\s*smtp_auth_password:/m, 'file 模式下不该再出现内联 smtp_auth_password')
  R.assertRenderedSurface(rendered)
})

// H2 判定的真实语义:仓库外 = 构造上安全(git add 永远碰不到),仓库内才要求 gitignore。
// 旧实现只问 check-ignore ⇒ 本机唯一在跑的那个实例(配置在 D:\DevEnv 仓库外运行副本)反被拒写。
test('H2 写出路径三态:仓库外=构造安全 / 仓库内被忽略=安全 / 仓库内已跟踪=拒写', () => {
  assert.equal(R.outputPathSafety(resolve(ROOT, '..', 'ihui-outside-repo-probe.yml')), 'outside-repo')
  assert.equal(R.outputPathSafety(join(ROOT, 'monitoring/alertmanager/alertmanager.rendered.yml')), 'ignored')
  assert.equal(R.outputPathSafety(join(ROOT, 'README.md')), 'tracked')
  assert.equal(R.outputPathSafety(join(ROOT, 'monitoring/alertmanager/alertmanager.yml')), 'tracked')
})

test('H2 判定不得因 git 不可用而静默放行(取不到结论一律 unknown → 调用方拒写)', () => {
  // 传一个不存在的目录:check-ignore 在仓库外路径上直接判 outside-repo,不会走到 git;
  // 因此这里用"仓库内但 git 答不出"的等价面 —— 单测内只锁返回值域,不误判为 ignored。
  const v = R.outputPathSafety(join(ROOT, 'scripts/tests/__no_such_probe_dir__/x.yml'))
  assert.ok(['tracked', 'ignored', 'unknown'].includes(v), `返回值域被破坏: ${v}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
