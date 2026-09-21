#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * env-backfill-model-keys.mjs — 从本机密钥目录回填项目根 .env 的模型 API key(2026-09-12 立)
 *
 * 背景:
 *   本机模型密钥维护在百度网盘同步目录 `密钥/模型/` 下,每个厂商一个 txt,内容为裸 token。
 *   新机器 / 重装 / 换目录后,根 `.env` 里这些键常为空,导致 ai-service 静默降级。
 *   手工粘贴既慢又容易粘错位,明文 key 还会进终端历史与聊天记录。
 *
 * 本脚本做四件事:
 *   1. 只读巡检:列出每个 .env 键 -> 源文件 -> 候选数量 -> 将选用的 token(脱敏)
 *   2. 消歧(可选):同一源文件里有多把 key 时,逐把发一次最小鉴权请求,选**真能用**的那把
 *   3. 精确回填:只写「值为空」的键,已有值一律跳过,**绝不覆盖**
 *   4. 自动备份:apply 前把 .env 整体复制到备份目录,失败可一键还原
 *
 * 安全约定(硬性):
 *   - 任何输出都不打印完整 key,只打印 `前6位***后2位 (len=N)` 用于人工核对
 *   - `.env` 已被 .gitignore 忽略(见 .gitignore 第 98 行的 env 忽略规则),回填后不会入库
 *   - `--verify` 的鉴权探测只打各厂商官方 `/models` 端点,不发业务请求、不落盘 token
 *
 * 用法:
 *   node scripts/env-backfill-model-keys.mjs                       # 默认 dry-run,只巡检
 *   node scripts/env-backfill-model-keys.mjs --verify              # 巡检 + 联网验活(含消歧)
 *   node scripts/env-backfill-model-keys.mjs --apply               # 实际回填(自动备份)
 *   node scripts/env-backfill-model-keys.mjs --verify --apply       # 验活后回填(推荐)
 *   node scripts/env-backfill-model-keys.mjs --key-dir "D:/xxx/密钥/模型"
 *
 * 退出码:
 *   0 = 巡检/回填完成(含"跳过"情形)
 *   1 = 前置条件不满足(密钥目录或 .env 不存在)
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 默认密钥目录(可用 --key-dir 或 IHUI_MODEL_KEY_DIR 覆盖) */
const DEFAULT_KEY_DIR = process.env.IHUI_MODEL_KEY_DIR || 'D:/BaiduSyncdisk/密钥/模型'

/** 探测超时(ms):超时视为「本机网络不可达」,不据此否定 key 本身 */
const PROBE_TIMEOUT_MS = 8000

/**
 * .env 键 -> 源文件 / 宽松格式 / 鉴权探测方式。
 *   expect  仅用于在多个裸 token 里筛掉明显不是 key 的行(如说明文字),不做严格格式断言
 *   baseEnv .env 里存 base URL 的键名(优先取运行时真值,保证与线上配置一致)
 *   base    兜底 base URL
 *   probe   'bearer'(Authorization: Bearer) | 'query'(?key=) | null(无法探测)
 */
const MAP = [
  {
    key: 'STEPFUN_API_KEY',
    vendor: 'StepFun',
    file: 'step apikey.txt',
    expect: /^[A-Za-z0-9._-]{20,}$/,
    baseEnv: 'STEPFUN_API_BASE',
    base: 'https://api.stepfun.com/v1',
    probe: 'bearer',
  },
  {
    key: 'AGNES_API_KEY',
    vendor: 'AGNES',
    file: 'agnes apikey.txt',
    expect: /^sk-[A-Za-z0-9]{20,}$/,
    baseEnv: 'AGNES_API_BASE',
    base: 'https://apihub.agnes-ai.com/v1',
    probe: 'bearer',
  },
  {
    key: 'GROQ_API_KEY',
    vendor: 'Groq',
    file: 'groq.txt',
    expect: /^gsk_[A-Za-z0-9]{30,}$/,
    baseEnv: 'GROQ_API_BASE',
    base: 'https://api.groq.com/openai/v1',
    probe: 'bearer',
  },
  {
    key: 'OPENROUTER_API_KEY',
    vendor: 'OpenRouter',
    file: 'openrouter api key.txt',
    expect: /^sk-or-v1-[a-z0-9]{40,}$/,
    baseEnv: 'OPENROUTER_API_BASE',
    base: 'https://openrouter.ai/api/v1',
    probe: 'bearer',
  },
  {
    key: 'GEMINI_API_KEY',
    vendor: 'Google Gemini',
    file: 'Google AI studio.txt',
    expect: /^(AQ\.[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,})$/,
    baseEnv: 'GEMINI_API_BASE',
    base: 'https://generativelanguage.googleapis.com/v1beta',
    probe: 'query',
  },
]

/** 解析 CLI 参数(--k v 与 --k=v 两种写法) */
function parseArgs(argv) {
  const out = { apply: false, verify: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--apply') out.apply = true
    else if (a === '--dry-run') out.apply = false
    else if (a === '--verify') out.verify = true
    else if (a === '--help' || a === '-h') out.help = true
    else if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      const name = eq === -1 ? a.slice(2) : a.slice(2, eq)
      out[name] = eq === -1 ? argv[(i += 1)] : a.slice(eq + 1)
    }
  }
  return out
}

/** 取一行中所有「裸 token」:整行即 token、长度 >= 20、无空白、非 URL、非注释 */
function tokens(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 20 && !/\s/.test(l) && !l.includes('://') && !l.startsWith('#'))
}

/** 脱敏描述:只露前 6 位与后 2 位,足够人工核对又不泄露 */
function describe(t) {
  return `${t.slice(0, 6)}***${t.slice(-2)} (len=${t.length})`
}

/** 从 .env 文本读某个键的值(仅用于取 base URL,不是密钥) */
function readEnvValue(envText, key) {
  const m = envText.match(new RegExp(`^${key}=(.*)$`, 'm'))
  return m ? m[1].trim() : ''
}

/** 从单个源文件读候选 token(先严格筛,严格为空则退回全部裸 token) */
function candidatesOf(keyDir, entry) {
  const raw = readFileSync(resolve(keyDir, entry.file), 'utf8')
  const all = tokens(raw)
  const strict = all.filter((t) => entry.expect.test(t))
  return strict.length ? strict : all
}

/** 带超时的 fetch,永不抛错,统一返回 {ok, status, note} */
async function probeToken(entry, token, base) {
  if (!entry.probe) return { ok: null, note: '该厂商无可用探测端点' }
  const url =
    entry.probe === 'query' ? `${base}/models?key=${encodeURIComponent(token)}` : `${base}/models`
  const headers = entry.probe === 'query' ? {} : { Authorization: `Bearer ${token}` }
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), PROBE_TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers, signal: ac.signal })
    return {
      ok: res.ok,
      status: res.status,
      note: res.ok ? '鉴权通过' : `HTTP ${res.status}`,
    }
  } catch (err) {
    const msg = String((err && err.cause && err.cause.code) || (err && err.name) || err)
    return { ok: null, note: `网络不可达(${msg})` }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 选出将使用的 token。
 *   单候选 -> 直接用;多候选 + --verify -> 逐把验活,取第一把通过者;
 *   多候选但无法验活/全部失败 -> 返回 null,留给人工决策(绝不瞎猜)。
 */
async function pickToken(entry, cands, base) {
  if (cands.length === 1) return { pick: cands[0], reason: '唯一候选' }
  if (!args.verify) return { pick: null, reason: `${cands.length} 个候选,需 --verify 消歧` }

  const results = []
  for (const t of cands) {
    const r = await probeToken(entry, t, base)
    results.push({ t, r })
    if (r.ok === true) {
      return {
        pick: t,
        reason: `验活通过(第 ${results.length} 把候选)`,
        probeLog: results,
      }
    }
  }
  const networkDead = results.every((x) => x.r.ok === null)
  return {
    pick: null,
    reason: networkDead ? '候选全部无法探测(本机网络不可达)' : '候选全部鉴权失败',
    probeLog: results,
  }
}

/** 解析路径:相对路径按仓库根解析,统一正斜杠便于 git-bash 下传参 */
function toAbs(p) {
  if (!p) return null
  return (isAbsolute(p) ? p : resolve(ROOT, p)).replace(/\\/g, '/')
}

const args = parseArgs(process.argv.slice(2))

if (args.help) {
  console.log(
    [
      '用法: node scripts/env-backfill-model-keys.mjs [--verify] [--apply] [选项]',
      '',
      '  --verify             联网验活每个候选 key(推荐,可自动消解同文件多 key 歧义)',
      '  --apply              实际回填(默认仅巡检 dry-run)',
      '  --key-dir <path>     密钥目录,默认 D:/BaiduSyncdisk/密钥/模型',
      '  --env <path>         .env 路径,默认 <仓库根>/.env',
      '  --backup-dir <path>  .env 备份目录,默认 <仓库根>/.ihui-agent/env-backup',
      '',
      '环境变量: IHUI_MODEL_KEY_DIR 可替代 --key-dir',
      '注: 只回填空值键,已有值一律跳过,绝不覆盖;始终不打印完整 key。',
    ].join('\n'),
  )
  process.exit(0)
}

const KEY_DIR = toAbs(args['key-dir'] || DEFAULT_KEY_DIR)
const ENV = toAbs(args.env) || `${ROOT.replace(/\\/g, '/')}/.env`
// 备份必须落在仓库内且被 .gitignore 覆盖(.ihui-agent/ 已在 .gitignore:132),
// 否则会污染项目父目录 —— 违反 AGENTS.md §15,并触发门禁 #26 父目录污染巡查。
const BACKUP_DIR = toAbs(args['backup-dir']) || `${ROOT.replace(/\\/g, '/')}/.ihui-agent/env-backup`

if (!existsSync(KEY_DIR)) {
  console.error(`❌ 密钥目录不存在: ${KEY_DIR}`)
  console.error('   请用 --key-dir <path> 指定,或设置环境变量 IHUI_MODEL_KEY_DIR。')
  process.exit(1)
}
if (!existsSync(ENV)) {
  console.error(`❌ .env 不存在: ${ENV}`)
  console.error('   请先从 .env.example 复制一份再执行回填。')
  process.exit(1)
}

const envText = readFileSync(ENV, 'utf8')

console.log(`密钥目录: ${KEY_DIR}`)
console.log(`目标 .env: ${ENV}`)
console.log(`模式: ${args.apply ? 'APPLY(实际写入,自动备份)' : 'DRY-RUN(只巡检,不写入)'}`)
console.log(`验活: ${args.verify ? 'ON(联网探测各厂商 /models)' : 'OFF'}`)
console.log('')

// ─── 一、巡检 + 消歧 ───────────────────────────────────────────
const plan = []
for (const entry of MAP) {
  if (!existsSync(resolve(KEY_DIR, entry.file))) {
    console.log(`${entry.key.padEnd(22)} 源=${entry.file}  ⏭ 源文件不存在`)
    plan.push({ entry, pick: null, reason: '源文件不存在' })
    continue
  }
  const cands = candidatesOf(KEY_DIR, entry)
  const base = readEnvValue(envText, entry.baseEnv) || entry.base
  const { pick, reason, probeLog } = await pickToken(entry, cands, base)

  const verdict = pick ? `${describe(pick)}  — ${reason}` : `(不确定:${reason})`
  console.log(`${entry.key.padEnd(22)} 源=${entry.file}  候选=${cands.length}  选用=${verdict}`)
  if (cands.length > 1 && probeLog) {
    for (const { t, r } of probeLog) {
      console.log(`    候选 ${describe(t)} → ${r.note}`)
    }
  }
  plan.push({ entry, pick, reason })
}

console.log('')
if (!args.apply) {
  console.log('✅ 巡检完成(未写入任何文件)。确认无误后加 --apply 实际回填。')
  process.exit(0)
}

// ─── 二、回填:先备份,再只替换空值键 ───────────────────────────
if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true })
const backupPath = resolve(BACKUP_DIR, `env-backup-${Date.now()}.env`)
copyFileSync(ENV, backupPath)

let out = envText
const report = []

for (const { entry, pick, reason } of plan) {
  if (!pick) {
    report.push(`${entry.key}: 跳过(${reason})`)
    continue
  }
  const re = new RegExp(`^${entry.key}=(.*)$`, 'm')
  const m = out.match(re)
  if (!m) {
    report.push(`${entry.key}: 跳过(.env 无此键,如需新增请手动添加)`)
    continue
  }
  if (m[1].trim() !== '') {
    report.push(`${entry.key}: 跳过(已有值,不覆盖)`)
    continue
  }
  out = out.replace(re, `${entry.key}=${pick}`)
  report.push(`${entry.key}: 已回填 ${describe(pick)}`)
}

if (out !== envText) writeFileSync(ENV, out)

console.log(`备份: ${backupPath.replace(/\\/g, '/')}`)
console.log(report.map((r) => `  - ${r}`).join('\n'))
console.log('')
console.log(out !== envText ? '✅ 回填完成' : '⏭ 无键需要回填')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
