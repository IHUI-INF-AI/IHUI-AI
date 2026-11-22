#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * i18n-add-keys.mjs — 向语言包**新增基准键**的写入器物(2026-11-22 立)。
 *
 * 立因:`i18n-apply.mjs` 只把「已存在的 zh-CN 基准键」翻译到其余语言,它写不了
 * `zh-CN` 自己缺的键;而现实里一批功能(域入口页 hrHub/eduHub/…、侧栏
 * nav.hrGroup 等)从上线起就没有任何语言写过词条 —— 页面直接回显
 * `nav.hrGroup` 这类裸键(`next-intl` 缺键走 getMessageFallback,不抛不报)。
 * 缺的这一层只能"先造基准键",造完再由 i18n-diff / i18n-apply 追平其余语言。
 *
 * 为什么不复用 `JSON.parse → stringify(null, 2)`(i18n-apply 的写法):
 * 消息目录里同时存在 pretty 文件(zh-CN/en/zh-TW)与**单行紧凑**文件(ja/ko)。
 * 整文件重序列化会把 ja/ko 的 90 万字符全部改写成多行 ⇒ 一次补 50 个键换来
 * 两份语言包的整文件 diff,blame 全废、review 不可能。本器物**按原文插入**,
 * 不同形态各写各的形态,新增行数 = 新增键数。
 *
 * 输入载荷(UTF-8 JSON):
 *   {
 *     "target": "web",                       // 端名,须与 packages/i18n/messages/ 下目录逐字相同
 *     "keys": {
 *       "nav.hrGroup": { "zh-CN": "人事部", "en": "HR", "zh-TW": "人事部", "ja": "人事部", "ko": "인사부" },
 *       "hrHub.title": { ... }
 *     }
 *   }
 *   - 键名用点分路径。末段之前的部分是命名空间,末段是键。
 *   - 五种语言必须齐全(缺一门即 exit 2,不写任何文件)。
 *
 * 用法:
 *   node scripts/i18n-add-keys.mjs --keys <payload.json> [--target=web] [--apply]
 *   node scripts/i18n-add-keys.mjs --keys <payload.json> --dry-run
 *
 * 退出码(三态,AGENTS §0.3):
 *   0 = 全部键已在目标位置存在(幂等,不需写) 或 已成功写入
 *   1 = 存在冲突(同名键在别处已存在 / 目标节点不是对象 / 插入点定位失败)
 *   2 = 未判定(载荷读不到、端名未知、语言不齐、参数不识别)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const LOCALES = ['zh-CN', 'en', 'zh-TW', 'ja', 'ko']

const argv = process.argv.slice(2)
const getArg = (name) => {
  const i = argv.findIndex((a) => a === name || a.startsWith(`${name}=`))
  if (i < 0) return undefined
  const a = argv[i]
  return a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[i + 1]
}
const KNOWN = new Set(['--keys', '--target', '--apply', '--dry-run'])
const VALUE_ARGS = new Set(['--keys', '--target'])
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  const head = a.split('=')[0]
  if (!KNOWN.has(head)) {
    console.error(
      `❌ 未识别的参数: ${JSON.stringify(a)}(可用: --keys <file> --target=web --apply --dry-run)`,
    )
    process.exit(2)
  }
  // 值形式的参数会消费下一个 token,那个 token 不是参数名
  if (VALUE_ARGS.has(head) && !a.includes('=')) i++
}

const keysPath = getArg('--keys')
if (!keysPath) {
  console.error('❌ 缺少 --keys <payload.json>')
  process.exit(2)
}
let payload
try {
  payload = JSON.parse(fs.readFileSync(keysPath, 'utf8'))
} catch (e) {
  console.error(`❌ 载荷读不到或不是合法 JSON: ${keysPath} — ${e.message}`)
  process.exit(2)
}

const target = getArg('--target') ?? payload.target ?? 'web'
const dir = path.join(REPO_ROOT, 'packages', 'i18n', 'messages', target)
if (!fs.existsSync(dir)) {
  console.error(`❌ 端名 ${JSON.stringify(target)} 的语言包目录不存在: ${dir}`)
  process.exit(2)
}
if (!payload.keys || typeof payload.keys !== 'object') {
  console.error('❌ 载荷缺少 keys 对象')
  process.exit(2)
}

const entries = Object.entries(payload.keys)
if (!entries.length) {
  console.log('[i18n-add-keys] 载荷为空,无需写入')
  process.exit(0)
}
for (const [key, rec] of entries) {
  for (const l of LOCALES) {
    if (typeof rec?.[l] !== 'string' || !rec[l]) {
      console.error(`❌ 键 ${key} 缺语言 ${l}(五语言必须齐备)`)
      process.exit(2)
    }
  }
}

/** 从 start 起算的括号深度(跳过字符串内容) */
function depthAt(text, pos) {
  let depth = 0,
    inStr = false,
    esc = false
  for (let i = 0; i < pos; i++) {
    const ch = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') {
      inStr = true
      continue
    }
    if (ch === '{' || ch === '[') depth++
    else if (ch === '}' || ch === ']') depth--
  }
  return depth
}

/** 从 open 花括号找到配对的 close(跳过字符串) */
function matchBrace(text, open) {
  let depth = 0,
    inStr = false,
    esc = false
  for (let i = open; i < text.length; i++) {
    const ch = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') {
      inStr = true
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** 在 [from, to] 范围内找**直接子级**名为 key 的对象,返回 { open, close }
 *
 * ⚠️ 2026-11-22 修:原来的判据是 `depthAt(open) === depthAt(from) + 1`,这只对**根对象**成立
 * (from=0 时 depthAt=0)。嵌套层里 from = 父的 open+1,父的 `{` 已计入深度,直接子级的 `{`
 * 恰好等于 depthAt(from) 而不是 +1 —— 少算一层的结果是"既有命名空间找不到"⇒ 又在父节点末尾
 * 造了一个同名块 ⇒ JSON last-wins 把原有内容整块遮蔽(实测 zh-CN 一次补键丢掉 1001 条键,
 * elementPack 的 backgroundTask/feedbackSurvey 全没了)。因此改为**由调用方显式给期望深度**。
 */
function findChildObject(text, from, to, key, expectedDepth) {
  const targetDepth = expectedDepth ?? depthAt(text, from) + 1
  const pat = new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:\\s*\\{`, 'g')
  pat.lastIndex = from
  let m
  while ((m = pat.exec(text)) && m.index < to) {
    const open = text.indexOf('{', m.index)
    if (depthAt(text, open) === targetDepth) {
      const close = matchBrace(text, open)
      if (close > 0 && close <= to) return { open, close }
    }
  }
  return null
}

/** 在 [from, to] 范围内找直接子级名为 key 的**字符串**值(用于冲突检测) */
function findChildString(text, from, to, key, expectedDepth) {
  const targetDepth = expectedDepth ?? depthAt(text, from) + 1
  const pat = new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:\\s*"`, 'g')
  pat.lastIndex = from
  let m
  while ((m = pat.exec(text)) && m.index < to) {
    const quote = text.indexOf('"', m.index + m[0].length - 1)
    if (depthAt(text, quote) === targetDepth) return true
  }
  return false
}

/** 生成一段嵌套对象字面量(pretty 或 compact) */
function nestedJson(pretty, indent, segs, value) {
  const [head, ...rest] = segs
  if (rest.length === 0) {
    return pretty
      ? `${indent}${JSON.stringify(head)}: ${JSON.stringify(value)}`
      : `${JSON.stringify(head)}:${JSON.stringify(value)}`
  }
  const inner = nestedJson(pretty, pretty ? `${indent}  ` : indent, rest, value)
  return pretty
    ? `${indent}${JSON.stringify(head)}: {\n${inner}\n${indent}}`
    : `${JSON.stringify(head)}:{${inner}}`
}

/** 在对象的 close 花括号前插入一段内容(自动补逗号) */
function insertAtObjectEnd(text, range, pretty, body) {
  const isEmpty = text.slice(range.open + 1, range.close).trim() === ''
  const sep = isEmpty ? '' : ','
  const lead = pretty ? '\n' : ''
  return text.slice(0, range.close) + sep + lead + body + text.slice(range.close)
}

const report = { written: 0, already: 0, created: 0, failed: [] }

/** 叶键数(对象里的字符串值个数;语言包不含数组)。用于"补键不得让任何既有键消失"的自证。 */
function countLeaves(node) {
  let n = 0
  for (const v of Object.values(node ?? {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) n += countLeaves(v)
    else n++
  }
  return n
}
/** 先算出每份文件的新正文,全部能 JSON.parse 通过才落盘(自证:一次写坏会烤进五份语言包) */
const pending = []

for (const locale of LOCALES) {
  const file = path.join(dir, `${locale}.json`)
  if (!fs.existsSync(file)) {
    report.failed.push(`${locale}: 文件不存在 ${file}`)
    continue
  }
  let text = fs.readFileSync(file, 'utf8')
  const textBefore = text
  let localWritten = 0
  const pretty = text.includes('\n')

  for (const [fullKey, rec] of entries) {
    const segs = fullKey.split('.')
    const value = rec[locale]
    // 逐段下钻到命名空间;缺任何一段就在最近的已存在父节点末尾把整条路径造出来
    // 根对象(open=-1)的闭合位置是文件里最后一个 `}`,插在它**之前**,不能追加到文件尾
    let range = { open: -1, close: text.lastIndexOf('}') }
    let missingAt = -1
    for (let i = 0; i < segs.length - 1; i++) {
      // 直接子级的期望深度:根对象(from=0)是 1;嵌套层等于 depthAt(父 open+1)(父的 `{` 已计入)
      const expected = range.open < 0 ? 1 : depthAt(text, range.open + 1)
      const next = findChildObject(text, range.open + 1, range.close, segs[i], expected)
      if (!next) {
        missingAt = i
        break
      }
      range = next
    }

    if (missingAt >= 0) {
      const lineStart = text.lastIndexOf('\n', range.open) + 1
      const lead = pretty ? (text.slice(lineStart, range.open).match(/^[ \t]*/)?.[0] ?? '') : ''
      const indent = pretty ? `${lead}  ` : ''
      const body = nestedJson(pretty, indent, segs.slice(missingAt), value)
      text = insertAtObjectEnd(text, range, pretty, body)
      report.written++
      localWritten++
      report.created++
      continue
    }

    const leaf = segs[segs.length - 1]
    const leafDepth = range.open < 0 ? 1 : depthAt(text, range.open + 1)
    if (
      findChildString(text, range.open + 1, range.close, leaf, leafDepth) ||
      findChildObject(text, range.open + 1, range.close, leaf, leafDepth)
    ) {
      report.already++
      continue
    }
    const lineStart = text.lastIndexOf('\n', range.open) + 1
    const lead = pretty ? (text.slice(lineStart, range.open).match(/^[ \t]*/)?.[0] ?? '') : ''
    const indent = pretty ? `${lead}  ` : ''
    text = insertAtObjectEnd(text, range, pretty, nestedJson(pretty, indent, [leaf], value))
    report.written++
    localWritten++
  }

  {
    try {
      JSON.parse(text)
    } catch (e) {
      report.failed.push(`${locale}: 写入后 JSON 不可解析 — ${e.message}`)
      process.exitCode = 1
      continue
    }
    // 键数守恒(2026-11-22 加,由真实事故逼出来的):补键只允许"加叶子"。
    // 之前嵌套层深度算错 ⇒ 找不到既有命名空间 ⇒ 造重名块 ⇒ JSON last-wins 静默遮蔽,
    // 一次补键让 zh-CN 丢掉 1001 条既有键而 JSON.parse 一切正常。这条断言就是那个盲区的探测器。
    const beforeCount = countLeaves(JSON.parse(textBefore))
    const afterCount = countLeaves(JSON.parse(text))
    if (afterCount !== beforeCount + localWritten) {
      report.failed.push(
        `${locale}: 键数不守恒(前 ${beforeCount} + 新增 ${localWritten} ≠ 后 ${afterCount})` +
          ` —— 疑似插到重名块旁并遮蔽既有内容,拒绝落盘`,
      )
      process.exitCode = 1
      continue
    }
    pending.push({ file, text })
  }
}

if (argv.includes('--apply') && !process.exitCode) {
  for (const p of pending) fs.writeFileSync(p.file, p.text, 'utf8')
}

const mode = argv.includes('--apply') ? 'APPLIED' : 'DRY-RUN'
console.log(
  `[i18n-add-keys] ${mode}  written=${report.written}  already=${report.already}  failed=${report.failed.length}`,
)
for (const f of report.failed) console.log(`  ✗ ${f}`)
if (report.failed.length) process.exit(1)
if (!argv.includes('--apply')) console.log('  (未加 --apply,仅预演,未写盘)')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
