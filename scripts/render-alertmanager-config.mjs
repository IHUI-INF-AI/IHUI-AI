#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/render-alertmanager-config.mjs
/**
 * Alertmanager 配置渲染器:monitoring/alertmanager/alertmanager.yml.tmpl → 可直接加载的 yml。
 *
 * 为什么需要它(不是"顺手加个工具"):Alertmanager **不展开环境变量**。本机 0.34.0 实测
 * (带阳性对照,取证记录见 alertmanager.yml.tmpl 头部注释):
 *   - `repeat_interval: '${'$'}{X}'` + 环境里 X=4h → 启动报 not a valid duration string;
 *   - 同样格式写字面量 4h → 正常加载;
 *   - 塞一个不存在的键 smtp_bogus_key_zzz → 严格解析直接拒(所以"没报错"才等于"支持")。
 * ⇒ 旧 alertmanager.yml 里那组 smtp.example.com / '<your-smtp-password>' 占位符从来就不可能被
 *   Alertmanager 自己换成真值。它的注释写着"需通过环境变量注入",但注入机制此前并不存在。
 *
 * 变量来源优先级:进程环境 > --set K=V > --env-file(默认 <root>/.env)。
 * compose 的 `environment:` 段**不是**注入通道(上面那条对 AM 的结论同样适用于容器里的 AM),
 * 它只决定"容器挂载哪份文件",所以 docker-compose.yml 挂的是本脚本的渲染产物。
 *
 * 三条硬护栏(都是本仓"本地全绿也发现不了"那一类):
 *   H1 缺凭据 fail-closed:主机 / 账号 / 授权码 / 收件人任一取不到就 exit 1,不产出半截配置。
 *   H2 输出路径必须已被 git 忽略:渲染产物含真实授权码,写进任何被跟踪路径
 *      = 下一次提交就把凭据入库。故 --out 先 `git check-ignore` 验证,取不到答案按不安全处理。
 *   H3 未登记的变量一律拒绝:模板里出现 VAR_SPEC 没登记的 ${VAR} → exit 1;某个 ${VAR} 取不到
 *      值 → 抛错;渲染产物里 global 的值仍以 "${ 开头 → 抛错("没渲染出去")。
 *      刻意**不**做"全文扫一遍还有没有 ${"的检查 —— 授权码可以合法含 `$`,那种写法会把
 *      一个真能用的密码判成坏配置(本仓守门的一致取向:宁漏不误报)。
 *      (否则又是一份"看着像配置、其实永远发不出信"的死文件。)
 *
 * 退出码:0 成功 / 1 判定失败(缺凭据、路径不安全、残留占位符、TLS 不自洽)/ 2 脚本自身异常。
 * 用法自解释:node scripts/render-alertmanager-config.mjs --help
 * 镜像测试:node --test scripts/tests/render-alertmanager-config.test.mjs
 */
/* eslint-disable no-console -- CLI 渲染工具,诊断信息就是它的主要输出 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveGitBin } from './lib/gitdir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const TEMPLATE_REL = 'monitoring/alertmanager/alertmanager.yml.tmpl'
/** 默认渲染产物:含真实授权码,必须保持被 git 忽略(见 .gitignore 的 alertmanager.rendered.yml)。 */
export const DEFAULT_OUT_REL = 'monitoring/alertmanager/alertmanager.rendered.yml'

/**
 * 模板变量登记表 —— 静态测试拿它核对"模板里每个 ${VAR} 都能找到来源"。
 * sources 是**真实环境变量名**,按优先级从高到低(与 resolveVars 的取值顺序一一对应);
 * derived 标记"通常不用人填、由渲染器算出来"的项,它的兜底来源写在注释里。
 * 首选项一律在根 `.env.example` 有声明行 —— 静态测试就是拿这一点做对账的。
 */
export const VAR_SPEC = {
  // 首选 ALERT_SMTP_SMARTHOST(host:port 一把给);不给则由 SMTP_HOST + SMTP_PORT 组装
  ALERT_SMTP_SMARTHOST: { sources: ['ALERT_SMTP_SMARTHOST', 'SMTP_HOST', 'SMTP_PORT'], secret: false },
  // 首选 ALERT_SMTP_ACCOUNT;不给则 SMTP_FROM → SMTP_USER。SMTP_FROM == SMTP_USER 是本机现状。
  ALERT_SMTP_ACCOUNT: { sources: ['ALERT_SMTP_ACCOUNT', 'SMTP_FROM', 'SMTP_USER'], secret: false },
  // 整行授权指令:给了 ALERT_SMTP_PASSWORD_FILE 就出 smtp_auth_password_file(密钥不进渲染产物),
  // 否则出 smtp_auth_password: <内联>。两种形态都由这一个占位符承载,所以 secret: true。
  ALERT_SMTP_PASSWORD_DIRECTIVE: { sources: ['ALERT_SMTP_PASSWORD_FILE', 'ALERT_SMTP_PASSWORD', 'SMTP_PASS'], secret: true },
  // 留空 = 由 smarthost 的端口推导(requireTlsFromPort);显式给值时仍会做自洽校验。
  ALERT_SMTP_REQUIRE_TLS: { sources: ['ALERT_SMTP_REQUIRE_TLS'], secret: false, derived: 'port' },
  // 留空回落到业务侧同一份收件人配置 ALERT_EMAIL_TO。
  ALERT_SMTP_TO: { sources: ['ALERT_SMTP_TO', 'ALERT_EMAIL_TO'], secret: false },
}

/** 极简 dotenv 解析:只认 KEY=VALUE,忽略注释/空行,去掉包裹引号。 */
export function parseDotenv(text) {
  const out = {}
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    let value = line.slice(eq + 1).trim()
    if (value.length >= 2 && /^(['"]).*\1$/.test(value)) value = value.slice(1, -1)
    out[key] = value
  }
  return out
}

/** 按 sources 优先级取第一个非空值,返回 { key, value }(取不到返回 null)。 */
export function pickSource(env, sources) {
  for (const key of sources) {
    const v = env[key]
    if (typeof v === 'string' && v.trim() !== '') return { key, value: v.trim() }
  }
  return null
}

/**
 * 端口 → smtp_require_tls。这是"两组值必须自洽"的**唯一**推导处:
 * 587 / 25 = STARTTLS ⇒ true;465 = 隐式 TLS ⇒ false;认不出的端口直接拒绝,不猜。
 * 模板里那个 ${ALERT_SMTP_REQUIRE_TLS} 就靠它,不允许在配置文件里写死布尔字面量。
 */
export function requireTlsFromPort(port) {
  const n = Number(port)
  if (!Number.isInteger(n) || n <= 0 || n > 65535) {
    throw new Error(`SMTP 端口不是合法数字:${JSON.stringify(port)}`)
  }
  if (n === 465) return false
  if (n === 587 || n === 25) return true
  throw new Error(
    `未知 SMTP 端口 ${n},无法判定 TLS 形态。587/25=STARTTLS(require_tls: true)、465=隐式 TLS(false),` +
      `两组值配反的后果(不发起 STARTTLS / 对隐式 TLS 端口再 STARTTLS)是连不上而不是报错在脸上。` +
      `确认语义后再把它加进本函数的表,不要靠猜。`,
  )
}

/** 事后自洽校验:smarthost 的端口与 require_tls 必须仍是同一套语义。 */
export function assertTlsCoherent(smarthost, requireTls) {
  const m = /:([0-9]+)$/.exec(String(smarthost).trim())
  if (!m) throw new Error(`smtp_smarthost 必须是 host:port 形态,收到:${JSON.stringify(smarthost)}`)
  const expected = requireTlsFromPort(m[1])
  if (Boolean(requireTls) !== expected) {
    throw new Error(
      `TLS 形态与端口不自洽:${smarthost}(端口 ${m[1]})应对应 smtp_require_tls=${expected},实际 ${requireTls}`,
    )
  }
  return true
}

/** 脱敏:与 §5d 同一口径(前 6 后 2 + 长度),任何情况下不外泄完整值。 */
export function maskSecret(value) {
  const s = String(value ?? '')
  if (s.length === 0) return '<EMPTY>'
  if (s.length <= 8) return `${s.slice(0, 1)}***${s.slice(-1)} (len=${s.length})`
  return `${s.slice(0, 6)}***${s.slice(-2)} (len=${s.length})`
}

/** 解析全部模板变量值;缺必需项时抛错,并指名"该补哪个键"。 */
export function resolveVars(env) {
  const missing = []

  const directSmarthost = env.ALERT_SMTP_SMARTHOST && String(env.ALERT_SMTP_SMARTHOST).trim()
  const host = env.SMTP_HOST && String(env.SMTP_HOST).trim()
  const port = env.SMTP_PORT && String(env.SMTP_PORT).trim()
  let smarthost = directSmarthost
  if (!smarthost) {
    if (!host || !port) {
      missing.push('ALERT_SMTP_SMARTHOST(或直接给 SMTP_HOST + SMTP_PORT)')
    } else {
      smarthost = `${host}:${port}`
    }
  }

  const account = pickSource(env, ['ALERT_SMTP_ACCOUNT', 'SMTP_FROM', 'SMTP_USER'])
  if (!account) missing.push('ALERT_SMTP_ACCOUNT(或 SMTP_FROM / SMTP_USER)')
  const passwordFile = String(env.ALERT_SMTP_PASSWORD_FILE ?? '').trim()
  const password = pickSource(env, ['ALERT_SMTP_PASSWORD', 'SMTP_PASS'])
  if (!passwordFile && !password) missing.push('ALERT_SMTP_PASSWORD(或 SMTP_PASS;或改用 ALERT_SMTP_PASSWORD_FILE 指向密钥文件)')
  const to = pickSource(env, ['ALERT_SMTP_TO', 'ALERT_EMAIL_TO'])
  if (!to) missing.push('ALERT_SMTP_TO(或 ALERT_EMAIL_TO)')

  if (missing.length) {
    throw new Error(
      `缺少必需的 SMTP 变量:\n  - ${missing.join('\n  - ')}\n` +
        `(用 --env-file <path> 指向存放它们的 .env。真实凭据只在 .env 里,不入仓。)`,
    )
  }

  // QQ 中继要求 From 的邮箱段 == 登录账号,否则 550。模板用一个占位符喂两处已从结构上保证相等;
  // 这里再兜一道:显式 ALERT_SMTP_ACCOUNT 与 SMTP_USER 同时给且不一致 → 拒绝,不交给中继去拒信。
  if (env.ALERT_SMTP_ACCOUNT && env.SMTP_USER && env.ALERT_SMTP_ACCOUNT.trim() !== env.SMTP_USER.trim()) {
    throw new Error(
      `ALERT_SMTP_ACCOUNT(${env.ALERT_SMTP_ACCOUNT.trim()})与 SMTP_USER(${env.SMTP_USER.trim()})不同源。` +
        `QQ 中继要求 From == 登录账号,否则 550;删掉其中一个,别指望中继放行。`,
    )
  }

  const portInSmarthost = /:([0-9]+)$/.exec(String(smarthost))?.[1]
  const requireTls = env.ALERT_SMTP_REQUIRE_TLS
    ? /^(1|true|yes)$/i.test(String(env.ALERT_SMTP_REQUIRE_TLS).trim())
    : requireTlsFromPort(portInSmarthost ?? '')

  assertTlsCoherent(smarthost, requireTls)

  // 授权指令两种形态:
  //   给了 ALERT_SMTP_PASSWORD_FILE → 出 smtp_auth_password_file(真实授权码不进渲染产物)
  //   否则                          → 出 smtp_auth_password: <内联>(渲染产物本身即密钥载体)
  // 首选前者:0.34.0 实测支持 smtp_auth_password_file(而 smtp_auth_username_file 会被严格
  // 解析拒掉,即"只有密码有原生 secret 文件通道"),所以密码可以是零落盘的。
  const passwordDirective = passwordFile
    ? `smtp_auth_password_file: ${yamlSingleQuote(passwordFile)}`
    : `smtp_auth_password: ${yamlSingleQuote(password.value)}`

  return {
    values: {
      ALERT_SMTP_SMARTHOST: smarthost,
      ALERT_SMTP_ACCOUNT: account.value,
      ALERT_SMTP_PASSWORD_DIRECTIVE: passwordDirective,
      ALERT_SMTP_REQUIRE_TLS: requireTls ? 'true' : 'false',
      ALERT_SMTP_TO: to.value,
    },
    sources: {
      ALERT_SMTP_SMARTHOST: directSmarthost ? 'ALERT_SMTP_SMARTHOST' : 'SMTP_HOST+SMTP_PORT',
      ALERT_SMTP_ACCOUNT: account.key,
      ALERT_SMTP_PASSWORD_DIRECTIVE: passwordFile ? 'ALERT_SMTP_PASSWORD_FILE' : password.key,
      ALERT_SMTP_REQUIRE_TLS: env.ALERT_SMTP_REQUIRE_TLS ? 'ALERT_SMTP_REQUIRE_TLS' : 'derived-from-port',
      ALERT_SMTP_TO: to.key,
    },
    passwordMode: passwordFile ? 'file' : 'inline',
  }
}

/** YAML 单引号标量:内部单引号按 YAML 规则翻倍;拒绝换行(凭据里出现换行=配置源已坏)。 */
function yamlSingleQuote(v) {
  const s = String(v)
  if (/[\r\n]/.test(s)) throw new Error('值里含换行,拒绝写入配置(来源文件疑似被截断/拼接错误)')
  return `'${s.replace(/'/g, "''")}'`
}

/**
 * 把整行注释(YAML `#` 开头,含缩进)的内容替换成等长空格,行号与列位不变。
 * 为什么要这一步:本文件是"讲占位符的模板",注释里必然出现 '${X}' 这种**教学用的**字面量。
 * 不剔掉它们,"模板用了未登记的变量"与"渲染后仍残留占位符"两条判据都会假红。
 * 只处理整行注释,不碰行尾注释 —— 行尾 `#` 可能在引号字符串里(如邮件标题),误伤更糟。
 */
export function blankOutCommentLines(text) {
  return String(text)
    .split('\n')
    .map((line) => (line.trimStart().startsWith('#') ? ' '.repeat(line.length) : line))
    .join('\n')
}

/** 模板/产物里出现的所有 ${VAR} 名(整行注释不计;Go 模板的 {{ }} 也不在此列)。 */
export function findPlaceholders(text) {
  return [...blankOutCommentLines(text).matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map((m) => m[1])
}

/** 渲染后残留的 ${VAR}(去重)。用于对**模板**做"有没有未登记变量"的对账。 */
export function findUnresolved(text) {
  return [...new Set(findPlaceholders(text))]
}

/**
 * 替换;纯函数,不落盘,注释行原样保留。
 * 注意:这里**不**对渲染产物再做一次"还有没有 ${"的检查 —— 授权码是可以合法含 `$` 的,
 * 那种写法会把一个真能用的密码判成坏配置。"没渲染"的特征改由 assertRenderedSurface 用
 * "值以 ${ 开头"来识别(只在"整个值就是未替换占位符"时成立,不误伤含 $ 的真值)。
 */
export function renderTemplate(tmplText, values) {
  const lines = String(tmplText).split('\n')
  return lines
    .map((line) => {
      if (line.trimStart().startsWith('#')) return line
      return line.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (whole, name) => {
        if (!(name in values)) throw new Error(`模板变量 \${${name}} 没有来源(VAR_SPEC 未登记)`)
        return values[name]
      })
    })
    .join('\n')
}

/**
 * 渲染产物的面校验(对"最终要被 Alertmanager 加载的那份文本"负责,而不是对模板负责):
 * ① SMTP 五项齐全;② smarthost 端口与 require_tls 自洽;③ from == auth_username 同源;
 * ④ 无未替换占位符;⑤ 授权码不是空串。
 */
export function assertRenderedSurface(renderedText) {
  const text = String(renderedText)
  const read = (key) => {
    const m = new RegExp(`^\\s*${key}:\\s*(.*)$`, 'm').exec(text)
    if (!m) return null
    return m[1].trim().replace(/^'(.*)'$/s, '$1').replace(/''/g, "'")
  }
  for (const key of ['smtp_smarthost', 'smtp_from', 'smtp_auth_username', 'smtp_require_tls']) {
    const v = read(key)
    if (v === null) throw new Error(`渲染产物缺少 global.${key}`)
    if (v.startsWith('${')) throw new Error(`global.${key} 的值仍是未替换占位符:${v}`)
  }
  const fileMode = read('smtp_auth_password_file') !== null
  if (!fileMode && read('smtp_auth_password') === null) {
    throw new Error('渲染产物既无 smtp_auth_password 也无 smtp_auth_password_file ⇒ 中继必 535 鉴权失败')
  }
  const smarthost = read('smtp_smarthost')
  const requireTls = read('smtp_require_tls') === 'true'
  assertTlsCoherent(smarthost, requireTls)
  if (read('smtp_from') !== read('smtp_auth_username')) {
    throw new Error(`smtp_from(${read('smtp_from')}) 与 smtp_auth_username(${read('smtp_auth_username')}) 不同源 ⇒ QQ 中继会 550`)
  }
  if (!fileMode && read('smtp_auth_password') === '') throw new Error('smtp_auth_password 为空 ⇒ 中继必 535 鉴权失败')
  return {
    smarthost,
    requireTls,
    from: read('smtp_from'),
    passwordMode: fileMode ? 'file' : 'inline',
    to: (/- to:\s*'([^']*)'/.exec(text) || [])[1] ?? null,
  }
}

/** 输出路径是否被 git 忽略(H2)。git 取不到答案时返回 null,调用方按不安全处理。 */
export function isGitIgnored(absPath, { cwd = ROOT } = {}) {
  try {
    execFileSync(resolveGitBin(), ['-c', 'safe.directory=*', 'check-ignore', '-q', absPath], {
      cwd,
      windowsHide: true, // 守门 52
      timeout: 5000, // 守门 80:git 只读调用必须带超时
      stdio: 'ignore',
    })
    return true // exit 0 = 被忽略
  } catch (err) {
    if (err?.status === 1) return false // exit 1 = 明确未被忽略
    return null // 其它 = git 本身没跑成
  }
}

/**
 * 写出路径的安全性判定。**仓库外是"构造上安全"**,与"是否被 gitignore"无关:
 * `git add` 永远碰不到仓库外的绝对路径,所以凭据落在那儿不可能被提交;而仓库内即便被忽略,
 * 仍有 `git add -f` / .gitignore 被改行 两条入库路径。旧实现只问 check-ignore ⇒ 反而把
 * 本机唯一在跑的那个实例(配置在仓库外的运行副本)挡在门外,只能靠 --force 绕过。
 */
export function outputPathSafety(absPath) {
  const rel = relative(ROOT, absPath)
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) {
    const ignored = isGitIgnored(absPath)
    if (ignored === null) return 'unknown'
    return ignored ? 'ignored' : 'tracked'
  }
  return 'outside-repo'
}

/** 把渲染文本里的授权码换成脱敏形态,用于安全地贴证据。 */
export function maskRenderedSecrets(text) {
  return String(text).replace(/^(\s*smtp_auth_password:\s*)(\S.*?)\s*$/m, (whole, head, val) => {
    const bare = val.replace(/^['"]|['"]$/g, '')
    return `${head}'${maskSecret(bare)}'`
  })
}

function parseArgs(argv) {
  const opts = { out: null, envFiles: [], sets: {}, check: false, force: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out') opts.out = argv[++i]
    else if (a === '--env-file') opts.envFiles.push(argv[++i])
    else if (a === '--set') {
      const kv = String(argv[++i] ?? '')
      const eq = kv.indexOf('=')
      if (eq > 0) opts.sets[kv.slice(0, eq)] = kv.slice(eq + 1)
    } else if (a === '--check') opts.check = true
    else if (a === '--force') opts.force = true
    else if (a === '--help' || a === '-h') opts.help = true
    else if (a.startsWith('--')) throw new Error(`未知选项 ${a}(拼错一个字母就让 --out 悄悄写成默认路径,所以这里拒绝静默忽略)`)
  }
  return opts
}

function usage() {
  console.log(
    `用法: node scripts/render-alertmanager-config.mjs [选项]
  --out <path>       渲染产物路径(默认 ${DEFAULT_OUT_REL};必须先被 git 忽略 —— 产物含授权码)
  --env-file <path>  追加一个 dotenv 来源(可重复;默认 <root>/.env)
  --set K=V          直接覆盖某个变量(可重复;演练时用 --set ALERT_SMTP_TO=你自己)
  --check            只在内存里渲染 + 自检,不落盘
  --force            跳过 H2(输出未被 git 忽略)的拒绝 —— 不建议,那等于把凭据写进入库路径
  --help             本帮助`,
  )
}

export function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv)
  if (opts.help) {
    usage()
    return 0
  }
  const tmplPath = resolve(ROOT, TEMPLATE_REL)
  if (!existsSync(tmplPath)) {
    console.error(`✗ 模板不存在:${tmplPath}`)
    return 2
  }
  const tmplText = readFileSync(tmplPath, 'utf8')

  // 变量池:默认 <root>/.env → 追加 --env-file → --set → 进程环境(最高)
  const env = {}
  for (const f of opts.envFiles.length ? opts.envFiles : ['.env']) {
    const abs = isAbsolute(f) ? f : resolve(ROOT, f)
    if (!existsSync(abs)) {
      console.error(`✗ --env-file 指向的文件不存在:${abs}`)
      return 2
    }
    Object.assign(env, parseDotenv(readFileSync(abs, 'utf8')))
  }
  Object.assign(env, opts.sets, process.env)

  const undeclared = [...new Set(findPlaceholders(tmplText).filter((n) => !(n in VAR_SPEC)))]
  if (undeclared.length) {
    console.error(`✗ 模板用了 VAR_SPEC 未登记的变量:${undeclared.join(', ')} ⇒ 静态测试会同时报这一条`)
    return 1
  }

  let resolved
  try {
    resolved = resolveVars(env)
  } catch (e) {
    console.error(`✗ ${e.message}`)
    return 1
  }

  let rendered
  let surface
  try {
    rendered = renderTemplate(tmplText, resolved.values)
    surface = assertRenderedSurface(rendered)
  } catch (e) {
    console.error(`✗ ${e.message}`)
    return 1
  }

  // 证据:渲染后 global 段,授权码已脱敏
  const globalBlock = /^global:[\s\S]*?(?=\n\S)/m.exec(rendered)?.[0] ?? ''
  console.log(maskRenderedSecrets(globalBlock))
  console.log(`  # 取值来源: ${Object.entries(resolved.sources).map(([k, v]) => `${k}←${v}`).join(', ')}`)
  console.log(`  # 授权码形态: ${surface.passwordMode}(file = 密钥不进渲染产物;inline = 渲染产物本身含密钥,须保持被 git 忽略)`)

  if (opts.check) {
    console.log('✓ --check:渲染 + global 面校验 + TLS 自洽 + 无残留占位符,全通过(未落盘)')
    return 0
  }

  const outAbs = opts.out ? (isAbsolute(opts.out) ? opts.out : resolve(ROOT, opts.out)) : resolve(ROOT, DEFAULT_OUT_REL)
  if (!opts.force) {
    const safety = outputPathSafety(outAbs)
    if (safety === 'unknown') {
      console.error('✗ 取不到 git check-ignore 结论 → 按"未确认安全"处理,拒绝写出。确需写出用 --force。')
      return 1
    }
    if (safety === 'tracked') {
      console.error(
        `✗ 输出路径 ${outAbs} **没有**被 git 忽略。渲染产物含真实授权码,写进去下一次提交就是凭据入库。\n` +
          `  换一个被忽略的路径(默认 ${DEFAULT_OUT_REL} 已在 .gitignore),或先补 .gitignore 再写。`,
      )
      return 1
    }
  }
  mkdirSync(dirname(outAbs), { recursive: true })
  writeFileSync(outAbs, rendered, { encoding: 'utf8', mode: 0o600 })
  console.log(`✓ 已写出 ${outAbs}(0600,${rendered.split(/\r?\n/).length} 行)`)
  return 0
}

// ── §22c 出口:测试直接 import,不复制判据 ─────────────────────────────────────
export const __test__ = {
  VAR_SPEC,
  TEMPLATE_REL,
  DEFAULT_OUT_REL,
  parseDotenv,
  pickSource,
  requireTlsFromPort,
  assertTlsCoherent,
  resolveVars,
  findPlaceholders,
  findUnresolved,
  renderTemplate,
  assertRenderedSurface,
  maskSecret,
  maskRenderedSecrets,
  isGitIgnored,
  outputPathSafety,
  isGitIgnored,
}

// ── §22d isDirectRun 守卫:被 import 时绝不触发 CLI 副作用 ──────────────────────
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    process.exit(main() ?? 0)
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2) // §22d 约定:2 = 脚本自身异常,1 = 业务失败
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
