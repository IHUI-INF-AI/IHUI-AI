#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 渲染工具,诊断信息就是它的主要输出 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveGitBin } from './lib/gitdir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const TEMPLATE_REL = 'monitoring/alertmanager/alertmanager.yml.tmpl'
/** 默认渲染产物。不含凭据,但仍不入库:生成物进仓 = 第二份真相(模板改了产物忘重刷不可见)。 */
export const DEFAULT_OUT_REL = 'monitoring/alertmanager/alertmanager.rendered.yml'

/** 基础设施告警到人的唯一出口:Alertmanager → 本 bridge → 品牌邮件(notify-deploy-failure.ts)。 */
export const BRIDGE_URL = 'http://127.0.0.1:9096/alert'
/** 收敛后模板里允许存在的**唯一** receiver 名。 */
export const BRIDGE_RECEIVER = 'default-webhook'

/** IM 中转旁路的特征:三家国内 IM 群机器人的英文 slug / 官方域名 / 回调路径形态。 */
const IM_SIGNATURE_RE = /(dingtalk|feishu|wechat|wecom|qyapi\.|oapi\.|open\.feishu)/gi

const SURFACE_RULE =
  '基础设施告警到人只有 bridge → 品牌邮件一条路(AGENTS.md §5e;版式唯一真相源 apps/api/src/services/email-templates.ts,' +
  '由守门 81 check-brand-email-channel.mjs 硬拦绕过形态)。AM 原生邮件发无版式纯文本,IM 中转腿属已摘除的第三方推送面 —— 两条都不许回到本配置里。'

/** 极简 dotenv 解析保留原因:仅测试对账 .env.example 时复用;渲染器自身不读任何环境变量。 */
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

/**
 * 把整行注释(YAML `#` 开头,含缩进)替换成等长空格,行号与列位不变。
 * 结构判据一律跑在剥注释后的正文上:模板头注释要**讲解**被禁的形态,不剥会自我误伤。
 */
export function blankOutCommentLines(text) {
  return String(text)
    .split('\n')
    .map((line) => (line.trimStart().startsWith('#') ? ' '.repeat(line.length) : line))
    .join('\n')
}

/** 正文里出现的所有 ${VAR} 名(整行注释不计)。收敛后合法答案恒为"空"。 */
export function findPlaceholders(text) {
  return [...blankOutCommentLines(text).matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map((m) => m[1])
}

/**
 * 从配置文本里取 route.routes 子路由列表(为结构判据与调度语义对账服务)。
 * 依赖本仓模板的固定缩进:routes: 在 2 空格,列表项在 4 空格,项内键在 6 空格。
 * 解析不出来返回 null —— 调用方按"红"处理,绝不静默通过。
 */
export function parseSubroutes(text) {
  const body = blankOutCommentLines(text)
  const routeBlock = /^route:\n((?:[ ]{2}.*\n?)*)/m.exec(body)
  if (!routeBlock) return null
  const block = routeBlock[1]
  const listStart = /^ {2}routes:\n/gm.exec(block)
  if (!listStart) return []
  const rest = block.slice((listStart.index ?? 0) + listStart[0].length)
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

/** receivers: 顶层块内声明的所有 `- name:` 值(逐行走:取 receivers: 之后、下一个顶格键之前的段)。 */
function declaredReceiverNames(body) {
  const out = []
  let inBlock = false
  for (const line of String(body).split('\n')) {
    if (/^receivers:/.test(line)) {
      inBlock = true
      continue
    }
    if (!inBlock) continue
    if (/^\S/.test(line)) break
    const m = /^\s*-?\s*name:\s*'?([^'"\s]+)'?/.exec(line)
    if (m) out.push(m[1])
  }
  return out
}

/**
 * 结构自校验:对"最终会被 Alertmanager 加载的那份文本"负责。
 * 命中任一即抛错(exit 1 的判据来源):
 *   ① 原生邮件面:email_configs / smtp_*(AM 自带邮件 = 无版式纯文本,绕过品牌层);
 *   ② IM 旁路面:dingtalk / feishu / wechat 一类的接收器名、host、路径签名;
 *   ③ 出口面:route 及全部子 route 的 receiver 引用、receivers 声明、webhook url
 *      必须且只能是 default-webhook → 127.0.0.1:9096/alert;
 *   ④ 占位符面:收敛后不存在任何合法模板变量,${VAR} 重现 = 凭据注入通道回潮。
 * 判据不锚定行首;整行注释先剥除,故头注释里"讲解被禁形态"不触雷。
 */
export function assertBridgeOnlySurface(text) {
  const body = blankOutCommentLines(text)
  const violations = []

  const placeholders = [...new Set(findPlaceholders(body))]
  if (placeholders.length) {
    violations.push(`产物重新出现占位符 \${${placeholders.join('}、${')}}:收敛后不存在任何合法模板变量(曾经的注入对象只有 SMTP 凭据)`)
  }
  if (/email_configs/.test(body) || /smtp_/i.test(body)) {
    violations.push('出现 Alertmanager 原生邮件通道配置(email_configs / smtp_*):发的是无版式纯文本,正是绕过品牌层的那条路')
  }
  const imHits = [...new Set([...body.matchAll(IM_SIGNATURE_RE)].map((m) => m[1].toLowerCase()))]
  if (imHits.length) {
    violations.push(`出现 IM 中转旁路特征:${imHits.join(', ')}(接收器名或 host/路径形态一律算,名字改成 feishu-copy 之类也照样命中)`)
  }

  const receiverRefs = [...body.matchAll(/^\s*(?:- )?receiver:\s*'?([^'"\s]+)'?/gm)].map((m) => m[1])
  if (receiverRefs.length === 0) {
    violations.push('找不到任何 receiver 引用 ⇒ route 结构解析失败,判红而不是默认放行')
  }
  for (const r of new Set(receiverRefs)) {
    if (r !== BRIDGE_RECEIVER) violations.push(`route 引用了旁路 receiver:${r}`)
  }
  const declared = declaredReceiverNames(body)
  if (declared.length !== 1 || declared[0] !== BRIDGE_RECEIVER) {
    violations.push(`receivers 必须恰有 1 个(${BRIDGE_RECEIVER}),实得 [${declared.join(', ')}]`)
  }
  const urls = [...body.matchAll(/^\s*(?:- )?url:\s*'?([^'"\s]+)'?/gm)].map((m) => m[1])
  if (urls.length === 0) {
    violations.push(`没有任何 webhook url ⇒ route 最终落不到 bridge(${BRIDGE_URL})`)
  }
  for (const u of new Set(urls)) {
    if (u !== BRIDGE_URL) violations.push(`webhook url 不指向 bridge:${u}(唯一合法出口是 ${BRIDGE_URL})`)
  }

  const subroutes = parseSubroutes(body)
  if (subroutes === null) {
    violations.push('route 块解析失败(返回 null)⇒ 判据无法成立不等于通过')
  } else {
    for (const r of subroutes) {
      if (r.receiver !== BRIDGE_RECEIVER) violations.push(`子路由(matchers: ${r.matchers.join(',') || '∅'})指向旁路 receiver:${r.receiver}`)
      if (r.continue === true) violations.push(`子路由(matchers: ${r.matchers.join(',')})带 continue: true —— 单通道下多跳分发是被禁形态`)
    }
  }

  if (violations.length) {
    throw new Error(`bridge-only 结构自校验失败:\n  - ${violations.join('\n  - ')}\n  ${SURFACE_RULE}`)
  }
  return { receiver: BRIDGE_RECEIVER, url: BRIDGE_URL, receiverRefs: [...new Set(receiverRefs)], declared, urls: [...new Set(urls)], subrouteCount: subroutes.length }
}

/**
 * 渲染器源码里读到的 ALERT_* 环境变量名。取材先剥注释(整行 // 与 JSDoc 块),
 * 否则"讲解某个死键"的注释文字会被当成读取,对账门自己咬自己。
 * 认三种形态:env.X / process.env.X / 'X' 字符串登记(VAR_SPEC sources 一类)。
 */
export function collectRendererEnvReads(rendererSource) {
  const src = String(rendererSource)
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
    .join('\n')
  const keys = new Set()
  for (const m of src.matchAll(/\b(?:process\.env\.|env\.)(ALERT_[A-Z0-9_]*)/g)) keys.add(m[1])
  for (const m of src.matchAll(/['"](ALERT_[A-Z0-9_]*)['"]/g)) keys.add(m[1])
  return [...keys].sort()
}

/**
 * 键集合三方对账(渲染器源码 ↔ 根 .env.example)。返回 { undeclaredReads, staleDeclarations }:
 *   - undeclaredReads:渲染器读了、但 .env.example 从未声明的键 ⇒ "读一个不存在的键"(死读取,渲染必拿空值);
 *   - staleDeclarations:渲染器不再读、但仍以 AM 邮件通道键前缀占着 .env.example 的键
 *     ⇒ "写了不生效还让人以为生效"。现网合法答案:两个都是空集。任何一侧单改都立即红。
 */
export function reconcileEnvKeys(rendererSource, envExampleText) {
  const reads = new Set(collectRendererEnvReads(rendererSource))
  const declared = new Set(Object.keys(parseDotenv(envExampleText)))
  const undeclaredReads = [...reads].filter((k) => !declared.has(k))
  const staleDeclarations = [...declared].filter((k) => /^ALERT_SMTP_/.test(k) && !reads.has(k)).sort()
  return { reads: [...reads].sort(), undeclaredReads, staleDeclarations }
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
 * 写出路径的安全性判定。产物已不含凭据,但仓库内仍要求"被忽略":
 * `git add -f` / .gitignore 被改行两条路径都能把生成物写进版本树,而双份真相必然漂移。
 * 仓库外(如本机运行副本目录)构造上不可能入库,放行。
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

export function parseArgs(argv) {
  const opts = { out: null, check: false, force: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out') opts.out = argv[++i]
    else if (a === '--check') opts.check = true
    else if (a === '--force') opts.force = true
    else if (a === '--help' || a === '-h') opts.help = true
    else throw new Error(`未知选项 ${a}(拼错一个字母就让 --out 悄悄落到默认路径,所以这里拒绝静默忽略;--env-file / --set 已随 SMTP 注入通道一并删除 —— 渲染器不再读任何环境变量)`)
  }
  return opts
}

function usage() {
  console.log(
    `用法: node scripts/render-alertmanager-config.mjs [选项]
  --out <path>   落盘路径(默认 ${DEFAULT_OUT_REL};仓库内必须先被 git 忽略,防生成物入库成第二份真相)
  --check        只做 bridge-only 结构自校验,不落盘
  --force        跳过"仓库内未忽略"的拒绝 —— 不建议,那等于把生成物放进入库路径
  --help         本帮助

本渲染器不读任何环境变量:模板零占位符,SMTP 凭据注入通道已随 AM 原生邮件面整体删除。
${SURFACE_RULE}`,
  )
}

export function main(argv = process.argv.slice(2)) {
  let opts
  try {
    opts = parseArgs(argv)
  } catch (e) {
    console.error(`✗ ${e.message}`)
    return 2
  }
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

  let summary
  try {
    summary = assertBridgeOnlySurface(tmplText)
  } catch (e) {
    console.error(`✗ ${e.message}`)
    return 1
  }
  console.log(`✓ 结构:receivers 唯一 = ${summary.receiver};route 根与 ${summary.subrouteCount} 条子路由全部落 ${summary.url}`)
  console.log('  # 零占位符 / 无原生邮件面 / 无 IM 中转特征')

  if (opts.check) {
    console.log('✓ --check:bridge-only 结构自校验通过(未落盘)')
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
        `✗ 输出路径 ${outAbs} **没有**被 git 忽略。生成物入库就是第二份真相(模板改了、产物忘重刷不可见)。\n` +
          `  换一个被忽略的路径(默认 ${DEFAULT_OUT_REL} 已在 .gitignore),或写到仓库外的运行副本目录。`,
      )
      return 1
    }
  }
  mkdirSync(dirname(outAbs), { recursive: true })
  writeFileSync(outAbs, tmplText, { encoding: 'utf8' })
  console.log(`✓ 已写出 ${outAbs}(${tmplText.split(/\r?\n/).length} 行)`)
  return 0
}

// ── §22c 出口:测试直接 import,不复制判据 ─────────────────────────────────────
export const __test__ = {
  TEMPLATE_REL,
  DEFAULT_OUT_REL,
  BRIDGE_URL,
  BRIDGE_RECEIVER,
  SURFACE_RULE,
  parseDotenv,
  blankOutCommentLines,
  findPlaceholders,
  parseSubroutes,
  assertBridgeOnlySurface,
  collectRendererEnvReads,
  reconcileEnvKeys,
  isGitIgnored,
  outputPathSafety,
  parseArgs,
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
