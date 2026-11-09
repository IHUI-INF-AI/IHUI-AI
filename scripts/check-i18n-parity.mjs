// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * i18n 键集 parity 守门(2026-11-04 修复两个失效缺陷)。
 *
 * 缺陷史(逐行实测,不是推测):
 *  1) 旧版第 8 行把目录硬编码成 `packages/i18n/messages/mobile-rn`,全脚本不解析 --target。
 *     于是 `--target=miniapp-taro` / `--target=shared` 打印的都是 mobile-rn 的读数 ——
 *     同名汇报里"miniapp-taro 6225 keys、缺失 0"实际从未量过 miniapp-taro。
 *  2) 旧版把缺失/多余只拼进 report 打印,全文没有 process.exit / process.exitCode,
 *     所以无论漂移多少都 exit 0;8 端认证把它登记为 warnOnly:false 也照样绿。
 *
 * 修复口径:
 *  - `--target=<端>`:受支持端**从 packages/i18n/messages/ 目录实测枚举**(listTargets),
 *    与 check-i18n-messages-exist.mjs:69 ENDPOINTS、check-i18n-keys.mjs:106 TARGET_CONFIG
 *    逐字一致(现读 7 个:shared / web / miniapp-taro / mobile-rn / cli / extension / api)。
 *    未登记/拼错的端 ⇒ exit 2,点名可用清单,且不读任何语言包(与 check-i18n-keys G-304 同口径)。
 *  - 未给 --target ⇒ **全量跑全部端**(理由见 runCheck 内注),不再静默读 mobile-rn。
 *  - 缺失 / 多余 key 均判红(exit 1):既有门同口径 —— check-i18n-keys.mjs:1745 的
 *    shouldBlock 同时收 base-only(缺失)与 lang-only(多余)两个方向;
 *    check-cli-i18n-parity.mjs:82-88 对键数不一致也 exit 1。缺失绝不降级为 warn。
 *  - 判定面取不到(根目录 / 基准语言 / JSON 解析失败)⇒ exit 2(未判定),不冒充 0。
 *  - `--root <dir>`:自测/审计缝,语义与 check-i18n-messages-exist.mjs 同名旗标一致。
 *  - `--self-test`:造夹具跑门,钉住「缺 key ⇒ 1 且点名 / 全齐 ⇒ 0 / 未知 target ⇒ 2」。
 *
 * 用法:
 *   node scripts/check-i18n-parity.mjs                       # 全部端
 *   node scripts/check-i18n-parity.mjs --target=mobile-rn     # 单端
 *   node scripts/check-i18n-parity.mjs --target mobile-rn     # 单端(空格形态)
 *   node scripts/check-i18n-parity.mjs --self-test
 * 退出码:0 = 所有被测端键集一致;1 = 存在缺失/多余 key;2 = 未判定(坏 target / 取不到判定面)。
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { requireFlagValue } from './lib/flag-value.mjs'

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..')
const MESSAGES_REL = path.join('packages', 'i18n', 'messages')
const BASE_LANG = 'en'
const REQUIRED_LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']
// 既有登记序(check-i18n-messages-exist.mjs:69 ENDPOINTS)—— 只决定输出顺序;
// "是否受支持"仍由目录实测枚举决定(listTargets),不在这里抄一份"端名单"。
const KNOWN_TARGET_ORDER = ['shared', 'web', 'miniapp-taro', 'mobile-rn', 'cli', 'extension', 'api']

export function getAllKeys(obj, prefix = '') {
  const keys = []
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return keys
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys
}

/**
 * 端名单唯一来源 = 语言包目录实测枚举。
 * 只认"目录里至少有一份 .json"的目录 —— 空目录不是端;点了名的空目录 ⇒ 未判定(exit 2)。
 */
export function listTargets(messagesRoot) {
  if (!fs.existsSync(messagesRoot)) {
    return { targets: [], error: `语言包根目录不存在:${messagesRoot}` }
  }
  const found = fs
    .readdirSync(messagesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => {
      try {
        return fs.readdirSync(path.join(messagesRoot, name)).some((f) => f.endsWith('.json'))
      } catch {
        return false
      }
    })
  const ordered = KNOWN_TARGET_ORDER.filter((t) => found.includes(t))
  const rest = found.filter((t) => !KNOWN_TARGET_ORDER.includes(t)).sort()
  return { targets: [...ordered, ...rest], error: null }
}

/**
 * 单端判定。返回结构化结果(供 CLI 汇总与镜像测试直测,避免测试另抄一遍检测逻辑)。
 * code: 0 一致 / 1 缺失或多余 key / 2 无法判定。
 */
export function checkTarget(target, { messagesRoot }) {
  const dir = path.join(messagesRoot, target)
  const out = {
    target,
    code: 0,
    languages: [],
    keyCounts: {},
    missing: [],
    extra: [],
    missingLocales: [],
    notes: [],
  }
  if (!fs.existsSync(dir)) {
    out.code = 2
    out.notes.push(`语言包目录不存在:${dir}`)
    return out
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
  out.languages = files.map((f) => f.slice(0, -5))
  out.missingLocales = REQUIRED_LOCALES.filter((l) => !out.languages.includes(l))

  const keySets = new Map()
  for (const file of files) {
    const locale = file.slice(0, -5)
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
      const keys = getAllKeys(data).sort()
      keySets.set(locale, keys)
      out.keyCounts[locale] = keys.length
    } catch (e) {
      // 读坏/解析失败 = 判定面取不到 ⇒ 未判定,不按"该语言很干净"跳过。
      out.code = 2
      out.notes.push(`${target}/${file} 无法解析:${String(e?.message ?? e).slice(0, 160)}`)
    }
  }

  const baseKeys = keySets.get(BASE_LANG)
  if (!baseKeys) {
    out.code = 2
    out.notes.push(`缺少基准语言 ${BASE_LANG}.json(没有可比的一侧 ⇒ 未判定)`)
    return out
  }
  const baseSet = new Set(baseKeys)
  for (const [locale, keys] of keySets) {
    if (locale === BASE_LANG) continue
    const langSet = new Set(keys)
    const missing = baseKeys.filter((k) => !langSet.has(k))
    const extra = keys.filter((k) => !baseSet.has(k))
    if (missing.length > 0) out.missing.push({ locale, keys: missing })
    if (extra.length > 0) out.extra.push({ locale, keys: extra })
  }

  // 解析失败优先保持 2;只有"判定跑成了"才允许落成 1。
  if (out.code !== 2) {
    if (out.missingLocales.length > 0 || out.missing.length > 0 || out.extra.length > 0)
      out.code = 1
  }
  return out
}

/** 汇总行:每端「语言数 / 每语言 key 数 / 缺失 / 多余 / rc」。 */
export function summarize(result) {
  const keyCols =
    result.languages.map((l) => `${l}=${result.keyCounts[l] ?? '?'}`).join(', ') || '(无语言包)'
  const missingTotal = result.missing.reduce((s, x) => s + x.keys.length, 0)
  const extraTotal = result.extra.reduce((s, x) => s + x.keys.length, 0)
  return `[${result.target}] languages=${result.languages.length} keys: ${keyCols} | 缺失=${missingTotal} 多余=${extraTotal} rc=${result.code}`
}

/** 明细行:缺失/多余逐键点名(夹具证明与人工排查都读这一段)。 */
export function detailLines(result) {
  const lines = [`\n=== ${result.target} ===`]
  lines.push(`语言文件 ${result.languages.length} 个: ${result.languages.join(', ') || '(无)'}`)
  for (const locale of result.languages)
    lines.push(`  ${locale}: ${result.keyCounts[locale] ?? '?'} keys`)
  if (result.missingLocales.length > 0) {
    lines.push(`缺失语言文件: ${result.missingLocales.join(', ')}`)
  }
  for (const locale of result.languages) {
    if (locale === BASE_LANG) continue
    const m = result.missing.find((x) => x.locale === locale)
    const e = result.extra.find((x) => x.locale === locale)
    if (m) {
      lines.push(`${locale} 缺失 ${m.keys.length} 个 keys:`)
      for (const k of m.keys) lines.push(`  - ${k}`)
    }
    if (e) {
      lines.push(`${locale} 多余 ${e.keys.length} 个 keys:`)
      for (const k of e.keys) lines.push(`  + ${k}`)
    }
  }
  for (const n of result.notes) lines.push(`⚠️ ${n}`)
  return lines
}

/**
 * 跑一道判定并汇总。
 * 未给 target 时**全量跑全部端**:既有调用方(run-8end-consistency-cert.mjs:50 与多份文档)
 * 都按裸命令调用;把裸调用改成 exit 2 会把"假绿"换成"认证链装不上车",同样不是修复。
 * 全量跑比旧行为严格更强 —— 旧行为只读 mobile-rn,现在每端都读,任一端漂移即 exit 1,
 * 且结构上不存在"静默收窄射程"那一支。
 */
export function runCheck({ root = REPO_ROOT, target = null } = {}) {
  const messagesRoot = path.join(root, MESSAGES_REL)
  const listed = listTargets(messagesRoot)
  if (listed.error) {
    return { code: 2, lines: [`[i18n-parity] ❌ ${listed.error} ⇒ 未判定`], results: [] }
  }
  if (listed.targets.length === 0) {
    return {
      code: 2,
      lines: ['[i18n-parity] ❌ 枚举到 0 个语言包端 ⇒ 未判定(不按"全部一致"处理)'],
      results: [],
    }
  }
  let targets = listed.targets
  if (target) {
    if (!listed.targets.includes(target)) {
      return {
        code: 2,
        lines: [
          `[i18n-parity] ❌ --target=${JSON.stringify(target)} 不是受支持的端,拒绝执行(未读任何语言包、未做任何判定)。`,
          `   可用目标(须与 ${MESSAGES_REL}/ 下目录名逐字相同): ${listed.targets.join(' / ')}`,
          '   拼写陷阱:连字符不是下划线、大小写敏感。',
          '   为什么不再容忍:此前未解析 --target,点名别的端看到的都是 mobile-rn 的读数。',
        ],
        results: [],
      }
    }
    targets = [target]
  }

  const results = targets.map((t) => checkTarget(t, { messagesRoot }))
  const lines = ['[i18n-parity] 汇总:']
  for (const r of results) lines.push(`  ${summarize(r)}`)
  for (const r of results) lines.push(...detailLines(r))

  // 有"未判定"⇒ 2(无论是否同时有红);否则有漂移 ⇒ 1;否则 0。
  const code = results.some((r) => r.code === 2) ? 2 : results.some((r) => r.code === 1) ? 1 : 0
  return { code, lines, results }
}

function writeReport(root, lines) {
  // 报告写入 tmp/(白名单目录),避免污染根目录触发根目录整洁守门[44]
  const tmpDir = path.join(root, 'tmp')
  fs.mkdirSync(tmpDir, { recursive: true })
  const reportPath = path.join(tmpDir, 'i18n-parity-report.txt')
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8')
  return reportPath
}

function parseArgs(argv) {
  const out = { selfTest: false, root: REPO_ROOT, target: null, error: null }
  if (argv.includes('--self-test')) return { ...out, selfTest: true }

  // --root 两种形态都收(与 check-i18n-messages-exist.mjs 同口径):`--root <dir>` / `--root=<dir>`。
  // 旧写法只认空格形态,于是自测/审计时手写 `--root=<夹具>` 会被静默忽略、落回真实仓库。
  const rootEqForm = argv.find((a) => a.startsWith('--root='))
  if (rootEqForm !== undefined) {
    const value = rootEqForm.slice('--root='.length)
    if (!value) return { ...out, error: '--root= 需要一个目录 —— 空值不得静默退回真实仓库' }
    out.root = path.resolve(value)
  } else {
    const rootFlag = requireFlagValue(argv, '--root', { noun: '目录', fallback: REPO_ROOT })
    if (rootFlag.error) return { ...out, error: rootFlag.error }
    out.root = path.resolve(rootFlag.value)
  }

  // 两种形态都收:--target=<端>(既有门/汇报的常见写法)与 --target <端>。
  const eqForm = argv.find((a) => a.startsWith('--target='))
  if (eqForm !== undefined) {
    const value = eqForm.slice('--target='.length)
    if (!value) return { ...out, error: '--target= 需要一个端名 —— 空值不得按"未点名"处理' }
    out.target = value
    return out
  }
  if (argv.includes('--target')) {
    const f = requireFlagValue(argv, '--target', { noun: '端名' })
    if (f.error) return { ...out, error: f.error }
    out.target = f.value
  }
  return out
}

function writeLocale(root, target, locale, data) {
  const dir = path.join(root, MESSAGES_REL, target)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${locale}.json`), JSON.stringify(data, null, 2), 'utf8')
}

/**
 * 回归自测:夹具建在临时目录,经真实子进程跑门,断言的是**进程退出码**而非函数返回值。
 * 钉四件事:①缺 key ⇒ 1 且点名;②全齐 ⇒ 0;③未知 target ⇒ 2;④多余 key ⇒ 1(既有门同口径)。
 */
export function runSelfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-i18n-parity-selftest-'))
  const spawnGate = (args) =>
    spawnSync(process.execPath, [SCRIPT_PATH, '--root', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
  try {
    const full = { greeting: 'hello', nested: { a: 'A', b: 'B' } }
    for (const locale of REQUIRED_LOCALES) writeLocale(root, 'clean', locale, full)
    for (const locale of REQUIRED_LOCALES) {
      writeLocale(
        root,
        'missing',
        locale,
        locale === 'zh-CN' ? { greeting: '你好', nested: { a: 'A' } } : full,
      )
    }
    for (const locale of REQUIRED_LOCALES) {
      writeLocale(root, 'extra', locale, locale === 'zh-CN' ? { ...full, onlyZh: '仅中文' } : full)
    }

    const missing = spawnGate(['--target=missing'])
    const clean = spawnGate(['--target=clean'])
    const unknown = spawnGate(['--target=nosuch'])
    const extra = spawnGate(['--target=extra'])
    const out = (r) => `${r.stdout || ''}${r.stderr || ''}`

    const checks = [
      ['① 缺 key ⇒ exit 1 且点名缺失键', missing.status === 1 && out(missing).includes('nested.b')],
      ['② 键集全齐 ⇒ exit 0', clean.status === 0],
      [
        '③ --target 不存在 ⇒ exit 2(不冒充 0)',
        unknown.status === 2 && out(unknown).includes('不是受支持的端'),
      ],
      ['④ 多余 key ⇒ exit 1(与既有门同口径)', extra.status === 1 && out(extra).includes('onlyZh')],
    ]

    let failed = 0
    for (const [name, pass] of checks) {
      console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`)
      if (!pass) failed += 1
    }
    if (failed > 0) {
      console.error(`[i18n-parity --self-test] ❌ ${failed}/${checks.length} 项未通过`)
      return 1
    }
    console.log(`[i18n-parity --self-test] ✅ ${checks.length}/${checks.length} 项通过`)
    return 0
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

function main() {
  const parsed = parseArgs(process.argv.slice(2))
  if (parsed.selfTest) process.exit(runSelfTest())
  if (parsed.error) {
    console.error(`[i18n-parity] ❌ ${parsed.error}`)
    process.exit(2)
  }
  const result = runCheck({ root: parsed.root, target: parsed.target })
  const reportPath = writeReport(parsed.root, result.lines)
  console.log(result.lines.join('\n'))
  console.log(`\n报告已生成: ${path.relative(parsed.root, reportPath)}`)
  if (result.code === 2) {
    console.error('[i18n-parity] ❌ 未判定(exit 2),不按通过处理')
    process.exit(2)
  }
  if (result.code === 1) {
    console.error('[i18n-parity] ❌ 键集漂移(exit 1):缺失/多余 key 见上方明细')
    process.exit(1)
  }
  console.log('[i18n-parity] ✅ 所有被测端键集一致')
  process.exit(0)
}

// §22d:CLI 直接执行才跑主流程;镜像测试 import 判据函数时不得有副作用
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()

// §22c:判据单元经 __test__ 暴露给镜像测试,测试不得另抄一遍检测逻辑
export const __test__ = {
  MESSAGES_REL,
  BASE_LANG,
  REQUIRED_LOCALES,
  KNOWN_TARGET_ORDER,
  getAllKeys,
  listTargets,
  checkTarget,
  summarize,
  detailLines,
  runCheck,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
