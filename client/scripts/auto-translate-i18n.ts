/**
 * AI 自动翻译 i18n 脚本
 *
 * 功能:
 *   扫描 4 个目标语言 (en, zh-TW, ja, ko) 的翻译文件, 识别三类待翻译项:
 *     1. [ZH:xxx] 占位符 (由 fill-partial-i18n.ts 写入的占位)
 *     2. 值=键名 (value 等于 key 末段, 即未翻译的兜底值)
 *     3. 残留中文 (值中包含中文字符)
 *   以 zh-CN 对应原文为翻译源, 批量调用 AI API 翻译后写回 JSON.
 *
 * 安全:
 *   - 翻译前自动备份到 client/scripts/reports/auto-translate-backup-{timestamp}/
 *   - 写入后验证 JSON 有效性, 失败回滚该文件
 *   - --dry-run 预览模式 (不调用 API, 不写入)
 *   - 批次间延迟 1 秒, HTTP timeout=30 秒
 *   - 单 key 翻译失败跳过并记录, 不中断整体流程
 *
 * 环境变量:
 *   I18N_AI_API_KEY     API 密钥 (必填, dry-run 除外)
 *   I18N_AI_BASE_URL    API 基础 URL (默认 https://api.deepseek.com/v1)
 *   I18N_AI_MODEL       模型名 (默认 deepseek-chat)
 *   I18N_AI_BATCH_SIZE  批次大小 (默认 30)
 *   I18N_AI_DRY_RUN     设为 "true" 则只预览
 *
 * 用法:
 *   npx tsx scripts/auto-translate-i18n.ts            # 正式翻译
 *   npx tsx scripts/auto-translate-i18n.ts --dry-run  # 预览
 *   npx tsx scripts/auto-translate-i18n.ts --dry-run --report=out.txt  # 预览并写报告文件
 *   npx tsx scripts/auto-translate-i18n.ts --mock --limit=10 --modules=common  # mock 试运行
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const LOCALES_DIR = path.join(ROOT, 'src', 'locales', 'modules')
const REPORTS_DIR = path.join(ROOT, 'scripts', 'reports')

const SOURCE_LOCALE = 'zh-CN' as const
const TARGET_LOCALES = ['zh-TW', 'en', 'ja', 'ko'] as const
type TargetLocale = (typeof TARGET_LOCALES)[number]

const LANGUAGE_NAMES: Record<TargetLocale, string> = {
  en: 'English',
  'zh-TW': 'Traditional Chinese',
  ja: 'Japanese',
  ko: 'Korean',
}

const HTTP_TIMEOUT_MS = 30_000
const BATCH_DELAY_MS = 1_000

// ============ 配置 ============
const args = process.argv.slice(2)
const dryRunFlag = args.includes('--dry-run') || process.env.I18N_AI_DRY_RUN === 'true'
// 2026-06-26 新增: --report=path 模式: 把 dry-run 详细报告写入文件, 便于在没有 TTY 的环境 (CI/子进程) 抓取结果
// 解决: PowerShell 重定向 + tsx 输出 buffer 在某些场景丢失问题
const reportArg = args.find((a) => a.startsWith('--report='))
const reportPath = reportArg ? reportArg.slice('--report='.length) : ''
// 2026-06-26 新增: 小批量试运行参数
// --limit=N          限制单次翻译项数 (含 placeholder/chinese-residue/key-equals), 用于试运行
// --modules=mod1,mod2  只翻译指定 module (逗号分隔), module 名为文件名去 .json
// --locales=zh-TW,en   只翻译指定语言 (默认全部 4 语言)
// --mock              用本地 mock AI 响应 (不调用真实 API), 走完完整备份/写回/验证流程
const limitArg = args.find((a) => a.startsWith('--limit='))
const limitN = limitArg ? Math.max(1, parseInt(limitArg.slice('--limit='.length), 10) || 0) : 0
const modulesArg = args.find((a) => a.startsWith('--modules='))
const modulesFilter = modulesArg
  ? new Set(modulesArg.slice('--modules='.length).split(',').map((s) => s.trim()).filter(Boolean))
  : null
const localesArg = args.find((a) => a.startsWith('--locales='))
const localesFilter = localesArg
  ? new Set(localesArg.slice('--locales='.length).split(',').map((s) => s.trim()).filter(Boolean) as TargetLocale[])
  : null
const mockFlag = args.includes('--mock') || process.env.I18N_AI_MOCK === 'true'

const API_KEY = process.env.I18N_AI_API_KEY || ''
const BASE_URL = process.env.I18N_AI_BASE_URL || 'https://api.deepseek.com/v1'
const MODEL = process.env.I18N_AI_MODEL || 'deepseek-chat'
const BATCH_SIZE = Math.max(5, Math.min(50, Number(process.env.I18N_AI_BATCH_SIZE) || 30))

// 自定义日志: 同时输出到 console 和可选的 report 文件
const reportLines: string[] = []
function log(msg: string = ''): void {
  console.log(msg)
  if (reportPath) reportLines.push(msg)
}

// ============ 工具函数 ============
function readJSON<T = unknown>(p: string): T | null {
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as T
  } catch {
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** 中文/日韩汉字统一表意文字范围 (含扩展 A 常见) */
const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/

interface TranslateItem {
  locale: TargetLocale
  filePath: string
  module: string
  keyPath: string // 文件内点分路径, 例如 "common.errors.actionFailed"
  sourceText: string // zh-CN 原文 (作为翻译源)
  type: 'placeholder' | 'key-equals' | 'chinese-residue'
}

interface TranslateResult {
  translated: number
  failed: number
  skipped: number
  filesWritten: number
  failedKeys: Array<{ locale: TargetLocale; module: string; keyPath: string; reason: string }>
}

/** 按点分路径读取嵌套对象的叶子值 */
function getNested(obj: unknown, keyPath: string): unknown {
  const parts = keyPath.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

/** 按点分路径设置嵌套对象的叶子值 */
function setNested(obj: Record<string, unknown>, keyPath: string, value: unknown): void {
  const parts = keyPath.split('.')
  let cur: Record<string, unknown> = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {}
    cur = cur[p] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]] = value
}

/** 遍历对象所有叶子字符串节点, 回调 (keyPath, value) */
function walkLeaves(obj: unknown, prefix: string, cb: (keyPath: string, value: string) => void): void {
  if (!obj || typeof obj !== 'object') return
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const curPath = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') {
      cb(curPath, v)
    } else if (v && typeof v === 'object') {
      walkLeaves(v, curPath, cb)
    }
  }
}

/** 判断是否为 [ZH:xxx] 占位符, 返回提取的原文 (无则 null) */
function extractPlaceholder(value: string): string | null {
  const m = value.match(/^\[ZH:([\s\S]*)\]$/)
  return m ? m[1] : null
}

/** 判断 value 是否等于 key 末段 (未翻译兜底) */
function isValueEqualsKeyLastSegment(value: string, keyPath: string): boolean {
  const last = keyPath.split('.').pop() || ''
  if (!last) return false
  return value.trim().toLowerCase() === last.trim().toLowerCase()
}

// ============ 备份 ============
const backedUpFiles = new Set<string>()
let backupDir = ''

function ensureBackup(filePath: string, locale: TargetLocale): void {
  if (backedUpFiles.has(filePath)) return
  const rel = path.relative(LOCALES_DIR, filePath) // e.g. "en/common.json"
  const dest = path.join(backupDir, rel)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(filePath, dest)
  backedUpFiles.add(filePath)
}

// ============ AI 翻译 ============
function buildPrompt(sourceMap: Record<string, string>, targetLanguage: string): string {
  return [
    '你是一个专业翻译。请将以下 JSON 的值从简体中文翻译为 ' + targetLanguage + '。',
    '保留所有 {placeholder} 格式的占位符不变。',
    '保留所有 HTML 标签不变。',
    '只返回翻译后的 JSON，不要其他内容。',
    '',
    '源文（简体中文）:',
    JSON.stringify(sourceMap),
  ].join('\n')
}

/** 清理 AI 返回内容中的 markdown 代码块包裹 */
function stripCodeFence(text: string): string {
  let t = text.trim()
  // 去除 ```json ... ``` 或 ``` ... ```
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fence) t = fence[1].trim()
  return t
}

// 2026-06-26 新增: mock AI 实现 - 构造可识别的伪翻译结果
// 翻译规则:
//   en:  [zh-TW-ja-ko-MOCK] <原文>
//   ja:  <原文> [MOCK-JA]
//   ko:  [MOCK-KO] <原文>
//   zh-TW: 簡體<原文>繁體
// 这样可以一眼看出是 mock 翻译, 不会污染真实数据
function mockAI(sourceMap: Record<string, string>, targetLanguage: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, src] of Object.entries(sourceMap)) {
    let translated = ''
    if (targetLanguage === 'English') {
      translated = `[MOCK-EN] ${src}`
    } else if (targetLanguage === 'Japanese') {
      translated = `${src} [MOCK-JA]`
    } else if (targetLanguage === 'Korean') {
      translated = `[MOCK-KO] ${src}`
    } else if (targetLanguage === 'Traditional Chinese') {
      // 简体转繁体 (mock 简化: 加繁體标记)
      translated = `繁體${src}`
    } else {
      translated = `[MOCK-${targetLanguage}] ${src}`
    }
    out[k] = translated
  }
  return out
}

async function callAI(sourceMap: Record<string, string>, targetLanguage: string): Promise<Record<string, string>> {
  // 2026-06-26 新增: mock 模式 - 不调用真实 API, 直接构造"伪翻译"结果
  // 用途: 在没有 API key 或想验证完整流程时, 走通 备份->翻译->写回->验证 全链路
  if (mockFlag) {
    return mockAI(sourceMap, targetLanguage)
  }
  const prompt = buildPrompt(sourceMap, targetLanguage)
  const url = BASE_URL.replace(/\/$/, '') + '/chat/completions'
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: 'You are a professional translator. Return ONLY valid JSON, no explanation.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`AI API HTTP ${res.status}: ${errText.slice(0, 300)}`)
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('AI 返回内容为空')

  const cleaned = stripCodeFence(content)
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('AI 返回内容不是有效 JSON: ' + cleaned.slice(0, 200))
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI 返回内容不是 JSON 对象')
  }
  return parsed as Record<string, string>
}

// ============ 主流程 ============
async function main(): Promise<void> {
  log('🌐 AI 自动翻译 i18n 脚本')
  const modeDesc = dryRunFlag
    ? '🔓 dry-run (预览, 不写入)'
    : mockFlag
      ? '🧪 mock (本地伪翻译, 走通备份/写回/验证全流程)'
      : '✍️ 正式翻译'
  log(`   模式: ${modeDesc}`)
  log(`   模型: ${MODEL}  批次: ${BATCH_SIZE}  Base: ${BASE_URL}`)
  log('')

  // dry-run / mock 不需要 API key
  if (!dryRunFlag && !mockFlag && !API_KEY) {
    console.error('❌ 未配置 I18N_AI_API_KEY, 无法正式翻译.')
    console.error('   请在 .env.local 中设置, 或使用 --dry-run 预览, 或使用 --mock 走通流程.')
    process.exit(1)
  }

  // 1. 加载 zh-CN 源 (合并所有 module 为一个 map, 用于查找原文)
  log('📚 加载 zh-CN 原文...')
  const zhCnDir = path.join(LOCALES_DIR, SOURCE_LOCALE)
  const zhSourceByModule: Record<string, Record<string, unknown>> = {}
  if (fs.existsSync(zhCnDir)) {
    for (const f of fs.readdirSync(zhCnDir)) {
      if (!f.endsWith('.json')) continue
      const mod = f.replace(/\.json$/, '')
      const obj = readJSON<Record<string, unknown>>(path.join(zhCnDir, f))
      if (obj) zhSourceByModule[mod] = obj
    }
  }
  log(`   zh-CN 共 ${Object.keys(zhSourceByModule).length} 个 module`)

  // 2. 扫描 4 个目标语言, 收集待翻译项
  log('🔎 扫描目标语言待翻译项...')
  const items: TranslateItem[] = []
  let filesScanned = 0

  // 应用 --locales / --modules 过滤
  const targetLocales = (localesFilter
    ? TARGET_LOCALES.filter((l) => localesFilter.has(l))
    : TARGET_LOCALES) as readonly TargetLocale[]
  if (targetLocales.length === 0) {
    log(`\n❌ --locales 过滤后无有效语言 (输入: ${Array.from(localesFilter || []).join(',')})`)
    process.exit(1)
  }
  if (localesFilter) log(`   --locales 过滤: ${targetLocales.join(', ')}`)
  if (modulesFilter) log(`   --modules 过滤: ${Array.from(modulesFilter).join(', ')}`)
  if (limitN) log(`   --limit 限制: 前 ${limitN} 项`)

  for (const locale of targetLocales) {
    const dir = path.join(LOCALES_DIR, locale)
    if (!fs.existsSync(dir)) {
      log(`   ⚠️ ${locale} 目录不存在, 跳过`)
      continue
    }
    let localeFiles = 0
    let localeItems = 0
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue
      const module = f.replace(/\.json$/, '')
      // 应用 --modules 过滤
      if (modulesFilter && !modulesFilter.has(module)) continue
      filesScanned++
      localeFiles++
      const filePath = path.join(dir, f)
      const targetObj = readJSON<Record<string, unknown>>(filePath)
      if (!targetObj || typeof targetObj !== 'object') continue
      const zhObj = zhSourceByModule[module]

      walkLeaves(targetObj, '', (keyPath, value) => {
        // 应用 --limit 限制 (只对前 N 项有效)
        if (limitN && items.length >= limitN) return
        // 类型 1: [ZH:xxx] 占位符
        const ph = extractPlaceholder(value)
        if (ph !== null) {
          const src = (zhObj ? getNested(zhObj, keyPath) : undefined)
          const sourceText = typeof src === 'string' && src ? src : ph
          items.push({ locale, filePath, module, keyPath, sourceText, type: 'placeholder' })
          localeItems++
          return
        }
        // 类型 2: 残留中文
        if (CJK_RE.test(value)) {
          const src = (zhObj ? getNested(zhObj, keyPath) : undefined)
          const sourceText = typeof src === 'string' && src ? src : value
          items.push({ locale, filePath, module, keyPath, sourceText, type: 'chinese-residue' })
          localeItems++
          return
        }
        // 类型 3: 值=键名末段 (且 zh-CN 原文不等于该末段, 避免误判)
        if (isValueEqualsKeyLastSegment(value, keyPath)) {
          const src = zhObj ? getNested(zhObj, keyPath) : undefined
          const zhSrcStr = typeof src === 'string' ? src : ''
          if (zhSrcStr && zhSrcStr.trim().toLowerCase() !== value.trim().toLowerCase()) {
            items.push({ locale, filePath, module, keyPath, sourceText: zhSrcStr, type: 'key-equals' })
            localeItems++
          }
        }
      })
    }
    log(`   ${locale.padEnd(8)} ${String(localeFiles).padStart(3)} 文件, ${localeItems} 待翻译项`)
  }

  log(`\n📊 扫描完成: ${filesScanned} 文件, 共 ${items.length} 个待翻译项`)

  // 按类型统计
  const byType: Record<string, number> = {}
  for (const it of items) byType[it.type] = (byType[it.type] || 0) + 1
  log(`   占位符 [ZH:]: ${byType['placeholder'] || 0}`)
  log(`   值=键名:     ${byType['key-equals'] || 0}`)
  log(`   残留中文:    ${byType['chinese-residue'] || 0}`)

  if (items.length === 0) {
    log('\n✅ 无待翻译项, 退出.')
    if (reportPath) {
      fs.writeFileSync(reportPath, reportLines.join('\n') + '\n', 'utf-8')
    }
    return
  }

  // dry-run: 到此为止, 不调用 API
  if (dryRunFlag) {
    log('\n🔓 dry-run 模式: 不调用 API, 不写入文件.')
    // 输出前 10 个样例
    log('\n样例 (前 10 项):')
    items.slice(0, 10).forEach((it, i) => {
      log(`   ${i + 1}. [${it.locale}] ${it.module}.${it.keyPath}  (${it.type})`)
      log(`      源: ${it.sourceText.slice(0, 80)}`)
    })
    log(`\n📌 正式翻译请配置 I18N_AI_API_KEY 后运行: npm run i18n:auto-translate`)
    if (reportPath) {
      fs.writeFileSync(reportPath, reportLines.join('\n') + '\n', 'utf-8')
      log(`\n📄 报告已写入: ${reportPath}`)
    }
    return
  }

  // 3. 正式翻译: 准备备份目录
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  backupDir = path.join(REPORTS_DIR, `auto-translate-backup-${ts}`)
  fs.mkdirSync(backupDir, { recursive: true })
  log(`\n💾 备份目录: ${path.relative(ROOT, backupDir)}`)

  // 4. 按 locale 分组, 每组按 BATCH_SIZE 切批翻译
  const result: TranslateResult = {
    translated: 0,
    failed: 0,
    skipped: 0,
    filesWritten: 0,
    failedKeys: [],
  }

  // 收集每个文件的待写回翻译 (keyPath -> translatedText)
  // 文件级别聚合, 最后一次性写回 (减少 IO, 且便于回滚)
  const fileTranslations: Map<string, Map<string, string>> = new Map()
  for (const it of items) {
    if (!fileTranslations.has(it.filePath)) fileTranslations.set(it.filePath, new Map())
  }

  for (const locale of targetLocales) {
    const localeItems = items.filter((it) => it.locale === locale)
    if (localeItems.length === 0) continue
    const targetLanguage = LANGUAGE_NAMES[locale]
    log(`\n🌐 翻译 ${locale} -> ${targetLanguage}  (${localeItems.length} 项)`)

    const batches: TranslateItem[][] = []
    for (let i = 0; i < localeItems.length; i += BATCH_SIZE) {
      batches.push(localeItems.slice(i, i + BATCH_SIZE))
    }

    for (let bi = 0; bi < batches.length; bi++) {
      const batch = batches[bi]
      const sourceMap: Record<string, string> = {}
      batch.forEach((it, idx) => {
        sourceMap[`k${idx}`] = it.sourceText
      })

      const tag = `[${locale} batch ${bi + 1}/${batches.length}]`
      try {
        const translatedMap = await callAI(sourceMap, targetLanguage)

        // 把翻译结果写回 fileTranslations
        let batchOk = 0
        let batchSkip = 0
        for (let i = 0; i < batch.length; i++) {
          const it = batch[i]
          const translated = translatedMap[`k${i}`]
          if (typeof translated !== 'string' || translated.trim() === '') {
            result.skipped++
            batchSkip++
            result.failedKeys.push({ locale, module: it.module, keyPath: it.keyPath, reason: 'AI 未返回该项' })
            continue
          }
          // 若翻译结果与原文完全相同且原文含中文, 视为可能未翻译, 跳过
          if (translated === it.sourceText && CJK_RE.test(it.sourceText)) {
            result.skipped++
            batchSkip++
            result.failedKeys.push({ locale, module: it.module, keyPath: it.keyPath, reason: '翻译结果与原文相同' })
            continue
          }
          const fmap = fileTranslations.get(it.filePath)!
          fmap.set(it.keyPath, translated)
          result.translated++
          batchOk++
        }
        log(`   ${tag} ✅ 成功 ${batchOk} 跳过 ${batchSkip}`)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`   ${tag} ❌ 批次失败: ${msg}`)
        result.failed += batch.length
        for (const it of batch) {
          result.failedKeys.push({ locale, module: it.module, keyPath: it.keyPath, reason: msg })
        }
      }

      // 批次间延迟 (最后一批除外)
      if (bi < batches.length - 1) await sleep(BATCH_DELAY_MS)
    }
  }

  // 5. 写回文件 (逐文件: 备份 -> 应用翻译 -> 验证 -> 写入; 失败回滚)
  log('\n📝 写回文件...')
  for (const [filePath, fmap] of fileTranslations) {
    if (fmap.size === 0) continue
    const original = readJSON<Record<string, unknown>>(filePath)
    if (!original) {
      console.error(`   ⚠️ 读取失败, 跳过: ${path.relative(ROOT, filePath)}`)
      continue
    }
    // 备份
    const rel = path.relative(LOCALES_DIR, filePath)
    const locale = rel.split(path.sep)[0] as TargetLocale
    ensureBackup(filePath, locale)

    // 应用翻译到副本
    const updated: Record<string, unknown> = JSON.parse(JSON.stringify(original))
    for (const [keyPath, translated] of fmap) {
      setNested(updated, keyPath, translated)
    }

    // 验证: 序列化后能否再解析
    const serialized = JSON.stringify(updated, null, 2) + '\n'
    try {
      JSON.parse(serialized)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`   ❌ JSON 验证失败, 回滚: ${path.relative(ROOT, filePath)} (${msg})`)
      result.failedKeys.push({ locale, module: path.basename(filePath, '.json'), keyPath: '(file)', reason: 'JSON 验证失败已回滚' })
      continue
    }

    // 写入
    fs.writeFileSync(filePath, serialized, 'utf-8')
    result.filesWritten++
    log(`   ✅ ${path.relative(ROOT, filePath)}  (+${fmap.size} keys)`)
  }

  // 6. 报告
  log('\n' + '='.repeat(50))
  log('📋 翻译报告')
  log('='.repeat(50))
  log(`   扫描文件:     ${filesScanned}`)
  log(`   待翻译项:     ${items.length}`)
  log(`   成功翻译:     ${result.translated}`)
  log(`   跳过 (可疑):  ${result.skipped}`)
  log(`   失败 (批次):  ${result.failed}`)
  log(`   写回文件:     ${result.filesWritten}`)
  log(`   备份目录:     ${backupDir ? path.relative(ROOT, backupDir) : '(无)'}`)

  if (result.failedKeys.length > 0) {
    const logPath = path.join(REPORTS_DIR, `auto-translate-failed-${ts}.json`)
    fs.writeFileSync(logPath, JSON.stringify(result.failedKeys, null, 2) + '\n', 'utf-8')
    log(`   失败明细:     ${path.relative(ROOT, logPath)} (${result.failedKeys.length} 条)`)
  }

  log('\n✅ 完成. 下一步:')
  log('   1. npm run check:i18n:chinese  (检查是否还有残留中文)')
  log('   2. npm run check:i18n:keys -- --all  (验证 key 覆盖度)')
  log('   3. 如需回滚, 从备份目录恢复')

  if (reportPath) {
    fs.writeFileSync(reportPath, reportLines.join('\n') + '\n', 'utf-8')
    log(`\n📄 报告已写入: ${reportPath}`)
  }
}

main().catch((e) => {
  console.error('❌ 脚本异常:', e)
  process.exit(1)
})
