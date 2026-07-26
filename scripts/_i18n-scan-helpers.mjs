#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * i18n 死 key 审计器公共函数(2026-07-26 立)
 *
 * 抽出 scripts/scan-dead-i18n-keys.mjs 中的核心逻辑,
 * 供 4 端独立扫描脚本(extension / mobile-rn / desktop / miniapp-taro)
 * 与 web 兼容入口(scan-dead-i18n-keys.mjs)复用,避免 5 份代码复制。
 *
 * 不直接运行,仅供其他脚本 import:
 *
 *   import { main as runScan } from './_i18n-scan-helpers.mjs'
 *   const code = runScan({
 *     name: 'extension',
 *     messagesPath: 'packages/i18n/messages/extension/zh-CN.json',
 *     scanTargets: ['apps/extension/entrypoints', 'apps/extension/src'],
 *     outputPattern: '.trae-cn/tmp/i18n-extension-dead-keys-{date}.md',
 *   })
 *   process.exit(code)
 *
 * 死 key 判定:zh-CN.json 存在 + 代码无静态 t('key') 引用 + 不在任何 useTranslations/getTranslations namespace 下 = 死 key
 * 翻译不完整:5 语言任一缺该 key(不计入死 key,单列)
 * 动态 key:t(`prefix.${var}`) 模板字符串不算静态引用,会列在"动态 key 提示"段
 *
 * 跳过条件:
 *   - messagesPath 不存在(messages 目录缺失,如 desktop 端)
 *   - scanTargets 为空数组(端无 JS 代码,如 desktop 端)
 *   两种情况都直接 exit 0,不计入死 key。
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']
const EXCLUDE_DIRS = new Set([
  'node_modules', '.next', '.git', 'dist', 'build', 'coverage',
  '__tests__', 'tests', 'test', '__mocks__', 'fixtures',
])
const EXCLUDE_FILE_PATTERNS = [
  /\.test\.(ts|tsx)$/,
  /\.spec\.(ts|tsx)$/,
  /\.d\.ts$/,
  /messages\//,
]

// 静态 t('key') / t("key") - 全路径点分命名空间
// 2026-07-26 增强:支持 t('key', { args }) / t('key', count) 带参数调用形式(原正则要求引号后紧跟 `)`,导致带参数时漏报)
// 新增 `(?:,[^)]*)?` 可选组:逗号 + 非 `)` 字符序列(到第一个 `)` 前,可跨嵌套 `(`),保证向后兼容(无参数形式仍命中)
// 注:`[^)]*` 不能跨 `)`,所以 `t('a.b', { x: foo(y) })` 匹配到 `t('a.b', { x: foo(y)` 即停,捕获组 1 = 'a.b' 正确
// 2026-07-26 二次增强:识别 tt('key', fallback) 多参数调用(miniapp-taro/mobile-rn 普遍使用 const tt = (k, fb) => ... fallback wrapper)
// 原 `\bt\(` 只匹配单字母 t,导致 miniapp-taro 1230 个 tt() 调用全部漏识别,1244 死 key 中 1227 个为误判
// 2026-07-26 三次增强:scanCode 改为整文件级匹配(配合 stripComments),支持多行 tt/t 调用
// 背景:miniapp-taro 普遍存在 `tt('a.b', '默认值', {\n  n: x,\n})` 跨多行调用,按行扫描时第一行没有 `)`,
// `[^)]*\)` 整体匹配失败,导致 course.nextLesson / exam.result.rankValue / member.coupon.thresholdText /
// member.couponList.thresholdText 4 个 key 被误判为死 key。`[^)]*` 字符类天然跨行(不依赖 `.`),整文件级匹配可命中。
// 2026-07-26 四次增强:简化正则,只匹配到引号结束,不要求 `)` 闭合
// 背景:嵌套调用 `t('a.b', { title: ... || t('course.startLearning') })` 中,`[^)]*\)` 整体匹配会消费内层 `)`,
// 导致内层 key 漏识别(course.startLearning 即此种场景,在 course/detail.tsx:247)。
// 简化为只匹配 key 部分 `t('a.b'`,允许嵌套调用内层也被识别。配合 stripComments 剥离注释避免假引用。
// 注:简化后 false positive 风险低 — 字符串字面量里 `t('a.b.c')` 形式极罕见,且 i18n key 不含特殊字符。
// 历史追溯:此前所有现有测试(单参/多参/嵌套对象/同行多调用)在简化后仍 pass,行为一致。
export const STATIC_T_RE = /\b(?:t|tt)\(\s*['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)['"`]/g
// 2026-07-26 新增:tList('key') 字符串数组辅助函数识别
// 背景:miniapp-taro useI18n() 返回 tList 函数,用于读取字符串数组(appPermission.names/descs, course.ratingLabels 等),
// 普遍存在于 about/app-permission、ai/chat、ai/image、course/detail、plaza/set-need、vip/upgrade、study/publish 等页面。
// 原扫描器仅识别 t/tt,漏识别 tList,导致 16 个 key 被误判为死 key。
// 2026-07-26 四次增强(与 STATIC_T_RE 同步):简化正则,只匹配到引号结束,不要求 `)` 闭合,
// 支持嵌套调用 `tList('a.b', { x: tList('inner') })` 中内层 key 也被识别。
export const TLIST_RE = /\btList\s*\(\s*['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)['"`]/g
// 动态 t(`prefix.${var}`) - 仅提示用
export const DYNAMIC_T_RE = /\bt\(\s*['"`]([^'"`]*\$\{[^'"`]+}[^'"`]*)['"`]\s*\)/g
// useTranslations('namespace') / getTranslations('namespace') - 命名空间下所有 key 视为潜在引用(启发式)
// 2026-07-26 增强:getTranslations 是 next-intl/server 在 server component 使用的 API(等价于 useTranslations),
// subagent-D commit 5ebb17915 仅识别 useTranslations 模式,导致 server component 引用 namespace 被误判为死 key。
export const USE_T_RE = /\b(?:useTranslations|getTranslations)\s*\(\s*['"`]([a-zA-Z][a-zA-Z0-9_.\-]*)['"`]\s*\)/g
// 备用:i18n.t / getFixedT 链式调用
export const I18N_T_RE = /\b(?:i18n\.t|getFixedT|useTranslations)\s*\(\s*['"`]?[a-zA-Z-]*['"`]?\s*\)\s*\(\s*['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)['"`]/g
// JSX prop 字面量: <Xxx namespace="literal" />
export const JSX_PROP_NS_RE = /\bnamespace\s*=\s*['"`]([a-zA-Z][a-zA-Z0-9_.\-]*)['"`]/g
// TypeScript 联合类型字面量: namespace?: 'a' | 'b'
export const UNION_TYPE_NS_RE = /\bnamespace\s*\??\s*:\s*['"`]([a-zA-Z][a-zA-Z0-9_.\-]*)['"`](\s*\|\s*['"`]([a-zA-Z][a-zA-Z0-9_.\-]*)['"`])*/g
// 属性赋值全路径 i18n key:nameKey/titleKey/labelKey/descriptionKey/textKey/i18nKey/descKey: 'a.b.c'
// 2026-07-26 增强:识别 { nameKey: 'design.responsive.deviceMobilePortrait' } 等属性赋值形式的全路径 i18n key 引用
// 原扫描器仅识别 t('a.b.c') / useTranslations('ns') 模式,漏识别属性赋值形式,
// 导致 design.responsive.device* 6 个 key(在 responsive-devices.ts 中以 nameKey 属性赋值引用)被误判为死 key。
// 限定:值必须含至少 1 个点(多段全路径),避免误命中 nameKey: 'kouzi' 等单段相对引用(运行时解析,非静态全路径)。
// 2026-07-26 二次增强:PROP_KEY_RE 白名单新增 i18nKey
// 背景:miniapp-taro custom-tab-bar/index.tsx 用 `i18nKey: 'nav.community'` / `i18nKey: 'nav.profile'` 引用 tab 标签,
// 原白名单(name/title/label/description/text)漏识别 i18nKey,导致 nav.community / nav.profile 2 个 key 被误判为死 key。
// 2026-07-26 三次增强:PROP_KEY_RE 白名单新增 desc
// 背景:extension 端 MeAppsPage.tsx 用 `descKey: 'apps.favoritesDesc'` 等对象字面量赋值引用 apps.*Desc 描述文案,
// 原白名单(name/title/label/description/text/i18n)漏识别 desc,导致 extension 42 个 apps.*Desc 死 key 误判。
// 属性名白名单:name/title/label/description/text/i18n/desc + Key 后缀(常见 i18n 相关属性命名约定)
export const PROP_KEY_RE = /\b(?:name|title|label|description|text|i18n|desc)Key\s*:\s*['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)['"`]/g
// JSX prop 字面量:titleKey="a.b.c" / descKey="a.b.c"(2026-07-26 三次增强新增)
// 背景:extension 端 SidepanelApp.tsx / AIAppsPage.tsx 等通过 <XxxPage titleKey="apps.aiTitle" /> JSX prop 形式引用,
// 原 PROP_KEY_RE 只识别 `titleKey:`(对象字面量赋值,冒号),不识别 `titleKey=`(JSX prop,等号),
// 导致 extension 8 个 apps.*Title/about/contact/help/agreement/pricing 死 key 误判。
// 与 PROP_KEY_RE 区别:用 `=` 不用 `:`,且 JSX 字符串字面量只用单/双引号(模板字面量在 JSX 表达式容器 {} 内,不在此处理)。
export const JSX_PROP_KEY_RE = /\b(?:name|title|label|description|text|i18n|desc)Key\s*=\s*['"]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)['"]/g
// 跨行 t('key', 形式(2026-07-26 三次增强新增)
// 背景:STATIC_T_RE 要求 `)` 闭合,逐行扫描无法识别跨行 `t('key', {\n  args,\n})` 调用,
// 导致 extension chat.compactionNotice + mobile-rn taskDispatch.file.attached 等跨行 t() 调用引用的 key 误判为死 key。
// 此正则只要求 `t('key',`(逗号后任意,不要求 `)` 闭合),补跨行调用缺口。
// 注:与 STATIC_T_RE 部分重叠(单行带参数调用两者都匹配),但 Set 去重,无副作用。
export const STATIC_T_MULTILINE_RE = /\b(?:t|tt)\(\s*['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)['"`]\s*,/g
// 联合类型字面量:'a.b' | 'c.d'(2026-07-26 三次增强新增)
// 背景:mobile-rn LiveScreen.tsx 通过 `function statusKey(live): 'live.ongoing' | 'live.upcoming' | 'live.ended'` 联合类型字面量引用,
// 原 UNION_TYPE_NS_RE 只识别 `namespace:` 关键字,无法识别函数返回类型的联合类型字面量,导致 live.ended 误判为死 key。
// 用两个正则覆盖多个联合(3+ 段):FIRST 识别"字面量后跟 |",SECOND 识别"| 后跟字面量"。
// 误报风险:SECOND 会匹配任何 `| 'a.b'` 形式(包括 `if (x || 'a.b')` 逻辑或),但只要 'a.b' 不在 zh-CN.json 中不影响死 key 刡定。
export const UNION_TYPE_KEY_RE_FIRST = /['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)['"`]\s*\|\s*(?=['"`])/g
export const UNION_TYPE_KEY_RE_SECOND = /\|\s*['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)['"`]/g
// 对象字面量值全路径 i18n key:key: 'namespace.leaf'(2026-07-26 三次增强新增)
// 背景:mobile-rn PaymentScreen.tsx / TaskDispatchPage.tsx 通过 `const STATUS_KEY = { pending: 'payment.status.pending', ... }` 对象字面量映射引用,
// 原 PROP_KEY_RE 只识别 `xxxKey:` 白名单属性,不识别 `pending:` 等任意键名,导致 10 个 payment/taskDispatch.status.* 死 key 误判。
// 限定:值必须含至少 1 个点(多段全路径),避免误命中 `host: 'example'` 等单段非 i18n 字面量。
// 误报风险:任何 `key: 'foo.bar.baz'` 字面量都被识别为引用,但只要 'foo.bar.baz' 不在 zh-CN.json 中不影响死 key 刡定。
export const OBJECT_LITERAL_KEY_RE = /\b[a-zA-Z_][a-zA-Z0-9_]*:\s*['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)['"`]/g
// 动态前缀拼接赋值:`= \`prefix.${var}\` as const`(2026-07-26 三次增强新增)
// 背景:mobile-rn OrderScreen.tsx 通过 `const statusKey = \`order.status.${item.status}\` as const` 模板字符串拼接引用,
// 扫描器无法静态识别 `${item.status}` 的值,但前缀 `order.status` 是静态的。
// 此正则识别 `= \`prefix.${var}\`` 形式,捕获前缀 `prefix`(不含末尾点),把前缀加入 usedNamespaces,
// 使 isInUsedNamespace('order.status.pending', Set(['order.status'])) = true(因 'order.status.pending'.startsWith('order.status.'))
export const DYNAMIC_PREFIX_RE = /=>?\s*[`'"]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)*)\.?\$\{[a-zA-Z_][a-zA-Z0-9_.]*\}[^'"`]*[`'"]/g

// 2026-07-26 新增:剥离 JS/TS 注释,保持行号(把注释字符替换为等长空格)
// 用于整文件级 STATIC_T_RE / TLIST_RE 匹配前预处理,避免命中注释行内的 t('commented.out') 等假引用。
// 注:不处理字符串字面量内的 //,但实际 i18n key 路径不含 //,且即便误剥离也只产生漏报(漏识别),
// 不会产生误报(误识别),不影响死 key 判定的保守性。
function stripComments(code) {
  // 行注释 `// ...` 到行尾
  let result = code.replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
  // 块注释 `/* ... */` 跨行
  result = result.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
  return result
}

// 递归展开 JSON → 点分 key 集合(叶子值才算 key,纯命名空间不计)
export function flatten(obj, prefix = '', out = new Set()) {
  if (obj === null || obj === undefined) return out
  if (Array.isArray(obj)) {
    // 字符串数组整体算一个叶子 key(prefix)
    if (obj.length > 0 && obj.every((v) => typeof v === 'string' || typeof v === 'number')) {
      if (prefix) out.add(prefix)
    }
    return out
  }
  if (typeof obj !== 'object') { if (prefix) out.add(prefix); return out }
  const keys = Object.keys(obj)
  if (keys.length === 0) { if (prefix) out.add(prefix); return out }
  for (const k of keys) {
    const v = obj[k]
    const np = prefix ? `${prefix}.${k}` : k
    if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0) flatten(v, np, out)
    else out.add(np) // 字符串/数字/字符串数组/空对象/空数组 → 叶子
  }
  return out
}

export function loadJson(p) {
  if (!fs.existsSync(p)) throw new Error(`文件不存在: ${p}`)
  const raw = fs.readFileSync(p, 'utf8')
  try {
    return JSON.parse(raw)
  } catch (e) {
    throw new Error(`JSON 解析失败: ${p} (${e.message})`)
  }
}

export function walkDir(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkDir(full, out)
    else if (/\.(tsx|ts)$/.test(entry.name)) {
      if (EXCLUDE_FILE_PATTERNS.some((re) => re.test(full))) continue
      out.push(full)
    }
  }
  return out
}

export function scanCode(files) {
  const staticRefs = new Set()
  const usedNamespaces = new Set()
  const dynamicHits = []
  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8')
    // 2026-07-26 三次增强:整文件级匹配 STATIC_T_RE / TLIST_RE
    // 背景:miniapp-taro 普遍存在 `tt('a.b', '默认值', {\n  n: x,\n})` 跨多行调用,
    // 按行扫描时第一行没有 `)`,`[^)]*\)` 整体匹配失败,导致 4 个 key 被误判为死 key。
    // `[^)]*` 字符类天然跨行(不依赖 `.`),整文件级匹配可命中。配合 stripComments 预处理
    // 剥离注释(行注释 + 块注释,保持行号),避免命中 `// t('commented.out')` 等假引用。
    // 其他正则(I18N_T_RE / PROP_KEY_RE / USE_T_RE / JSX_PROP_NS_RE / UNION_TYPE_NS_RE / DYNAMIC_T_RE)
    // 仍按行匹配,保留行号信息用于 dynamicHits 报告。
    const codeOnly = stripComments(content)
    const lines = content.split('\n')
    let m
    STATIC_T_RE.lastIndex = 0
    while ((m = STATIC_T_RE.exec(codeOnly)) !== null) staticRefs.add(m[1])
    TLIST_RE.lastIndex = 0
    while ((m = TLIST_RE.exec(codeOnly)) !== null) staticRefs.add(m[1])
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue
      I18N_T_RE.lastIndex = 0
      while ((m = I18N_T_RE.exec(line)) !== null) staticRefs.add(m[1])
      PROP_KEY_RE.lastIndex = 0
      while ((m = PROP_KEY_RE.exec(line)) !== null) staticRefs.add(m[1])
      // 2026-07-26 三次增强:JSX prop 字面量 titleKey="a.b.c"(extension 端 apps.*Title 引用模式)
      JSX_PROP_KEY_RE.lastIndex = 0
      while ((m = JSX_PROP_KEY_RE.exec(line)) !== null) staticRefs.add(m[1])
      // 2026-07-26 三次增强:联合类型字面量 'a.b' | 'c.d'(mobile-rn live.ended 引用模式)
      // 用 FIRST/SECOND 两个正则覆盖 3+ 段联合类型,FIRST 识别"字面量后跟 |",SECOND 识别"| 后跟字面量"
      UNION_TYPE_KEY_RE_FIRST.lastIndex = 0
      while ((m = UNION_TYPE_KEY_RE_FIRST.exec(line)) !== null) staticRefs.add(m[1])
      UNION_TYPE_KEY_RE_SECOND.lastIndex = 0
      while ((m = UNION_TYPE_KEY_RE_SECOND.exec(line)) !== null) staticRefs.add(m[1])
      // 2026-07-26 三次增强:对象字面量值 key: 'namespace.leaf'(mobile-rn payment/taskDispatch.status.* 引用模式)
      OBJECT_LITERAL_KEY_RE.lastIndex = 0
      while ((m = OBJECT_LITERAL_KEY_RE.exec(line)) !== null) staticRefs.add(m[1])
      // 2026-07-26 三次增强:动态前缀拼接 `prefix.${var}`(mobile-rn order.status.* 引用模式)
      // 把前缀加入 usedNamespaces,使 isInUsedNamespace('order.status.pending', Set(['order.status'])) = true
      DYNAMIC_PREFIX_RE.lastIndex = 0
      while ((m = DYNAMIC_PREFIX_RE.exec(line)) !== null) {
        if (m[1]) usedNamespaces.add(m[1])
      }
      USE_T_RE.lastIndex = 0
      while ((m = USE_T_RE.exec(line)) !== null) usedNamespaces.add(m[1])
      JSX_PROP_NS_RE.lastIndex = 0
      while ((m = JSX_PROP_NS_RE.exec(line)) !== null) usedNamespaces.add(m[1])
      UNION_TYPE_NS_RE.lastIndex = 0
      while ((m = UNION_TYPE_NS_RE.exec(line)) !== null) {
        usedNamespaces.add(m[1])
        if (m[3]) usedNamespaces.add(m[3])
      }
      DYNAMIC_T_RE.lastIndex = 0
      while ((m = DYNAMIC_T_RE.exec(line)) !== null) {
        dynamicHits.push({ file: path.relative(ROOT, f), line: i + 1, snippet: trimmed.slice(0, 200) })
      }
    }
  }
  return { staticRefs, usedNamespaces, dynamicHits, scanned: files.length }
}

// 判定 leaf key 是否在某个 used namespace 下
export function isInUsedNamespace(key, usedNamespaces) {
  for (const ns of usedNamespaces) {
    if (key === ns || key.startsWith(ns + '.')) return true
  }
  return false
}

export function groupByNamespace(keys) {
  const groups = new Map()
  for (const k of keys) {
    const ns = k.split('.')[0]
    if (!groups.has(ns)) groups.set(ns, [])
    groups.get(ns).push(k)
  }
  return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])))
}

/**
 * 主流程入口(供 4 端脚本 + web 兼容入口调用)
 *
 * @param {Object} opts
 * @param {string} opts.name - 端名(用于日志/报告,例 'extension')
 * @param {string} opts.messagesPath - 相对 ROOT 的 zh-CN.json 路径
 * @param {string[]} [opts.scanTargets=[]] - 相对 ROOT 的代码扫描目录列表
 * @param {string} opts.outputPattern - 报告输出路径模板,可用 {date} 占位当天日期
 * @param {boolean} [opts.dryRun=false] - 只打印统计,不写报告
 * @param {boolean} [opts.exitOnDead=false] - 发现死 key 时返回 1
 * @param {string|null} [opts.out=null] - 自定义输出路径(覆盖 outputPattern)
 * @param {string} [opts.scriptName] - 日志前缀(默认 scan-{name}-dead-i18n-keys)
 * @returns {number} 0 成功,1 --exit 1 模式且发现死 key
 */
export function main(opts) {
  const {
    name,
    messagesPath,
    scanTargets = [],
    outputPattern,
    dryRun = false,
    exitOnDead = false,
    out = null,
    scriptName,
  } = opts

  const TAG = scriptName || `scan-${name}-dead-i18n-keys`
  const TODAY = new Date().toISOString().slice(0, 10)
  const ZH_CN_PATH = path.join(ROOT, messagesPath)
  const LOCALE_DIR = path.dirname(ZH_CN_PATH)
  const LOCALE_PATHS = Object.fromEntries(LOCALES.map((l) => [l, path.join(LOCALE_DIR, `${l}.json`)]))
  const SCAN_TARGETS = scanTargets.map((t) => path.join(ROOT, t))

  // 0. 跳过条件:messages 不存在(端无独立 i18n,如 desktop)
  if (!fs.existsSync(ZH_CN_PATH)) {
    console.log(`[${TAG}] 跳过:基准语言文件不存在 ${path.relative(ROOT, ZH_CN_PATH)}(端无独立 i18n)`)
    return 0
  }

  // 0b. 跳过条件:无 JS 代码扫描目标(端是纯原生包装,如 desktop)
  if (SCAN_TARGETS.length === 0) {
    console.log(`[${TAG}] 跳过:scanTargets 为空(端无 JS 代码,无法静态扫描)`)
    return 0
  }

  // 1. 加载 zh-CN.json + 其他 4 语言
  console.log(`[${TAG}] target=${name} 加载基准: ${path.relative(ROOT, ZH_CN_PATH)}`)
  const leafKeys = flatten(loadJson(ZH_CN_PATH))
  const localeData = { 'zh-CN': { keys: leafKeys } }
  for (const l of LOCALES) {
    if (l === 'zh-CN') continue
    if (!fs.existsSync(LOCALE_PATHS[l])) {
      console.warn(`[${TAG}] 警告:语言文件不存在: ${path.relative(ROOT, LOCALE_PATHS[l])}`)
      localeData[l] = { keys: new Set() }
      continue
    }
    localeData[l] = { keys: flatten(loadJson(LOCALE_PATHS[l])) }
    console.log(`[${TAG}] 加载: ${path.relative(ROOT, LOCALE_PATHS[l])} (${localeData[l].keys.size} keys)`)
  }

  // 2. 扫描代码
  const files = []
  for (const t of SCAN_TARGETS) walkDir(t, files)
  console.log(`[${TAG}] 扫描代码: ${files.length} 个文件`)
  const { staticRefs, usedNamespaces, dynamicHits } = scanCode(files)
  console.log(`[${TAG}] 静态引用 key: ${staticRefs.size} 个(去重)`)
  console.log(`[${TAG}] useTranslations/getTranslations namespace: ${usedNamespaces.size} 个`)

  // 3. 死 key
  const deadKeys = new Set()
  for (const k of leafKeys) {
    if (!staticRefs.has(k) && !isInUsedNamespace(k, usedNamespaces)) deadKeys.add(k)
  }
  // 4. 翻译不完整
  const incompleteKeys = new Set()
  for (const k of leafKeys) {
    for (const l of LOCALES) {
      if (l !== 'zh-CN' && !localeData[l].keys.has(k)) { incompleteKeys.add(k); break }
    }
  }

  // 5. 统计
  const totalLeaves = leafKeys.size
  const totalRefs = staticRefs.size
  const totalNamespaces = usedNamespaces.size
  const deadCount = deadKeys.size
  const incompleteCount = incompleteKeys.size
  const deadRatio = totalLeaves > 0 ? ((deadCount / totalLeaves) * 100).toFixed(1) : '0.0'
  const summary = {
    scannedAt: new Date().toISOString(),
    totalLeafKeys: totalLeaves,
    totalStaticRefs: totalRefs,
    totalUsedNamespaces: totalNamespaces,
    deadKeyCount: deadCount,
    deadKeyRatio: deadRatio + '%',
    incompleteKeyCount: incompleteCount,
  }

  console.log('\n=== 总览 ===')
  console.log(`  基准语言 leaf keys: ${totalLeaves}`)
  console.log(`  代码静态引用 key: ${totalRefs}`)
  console.log(`  useTranslations/getTranslations namespace: ${totalNamespaces}`)
  console.log(`  死 key: ${deadCount} (${deadRatio}%)`)
  console.log(`  翻译不完整 key: ${incompleteCount}`)
  console.log(`  动态 t(\`prefix.\${var}\`) 命中: ${dynamicHits.length} 处`)

  if (dryRun) {
    console.log(`\n[${TAG}] --dry-run:跳过报告写入`)
    if (exitOnDead && deadCount > 0) return 1
    return 0
  }

  // 6. 生成 markdown 报告
  const lines = []
  const L = (s = '') => lines.push(s)
  L(`# i18n 死 key 审计报告(${TODAY},target=${name})`)
  L()
  L(`> 自动生成 by \`scripts/${TAG}.mjs\`(2026-07-26 公共函数抽象到 _i18n-scan-helpers.mjs)`)
  L(`> target=${name},messagesPath=${messagesPath}`)
  L('## 总览')
  L(`- target:**${name}**`)
  L(`- 扫描文件:5 语言(\`${LOCALES.map((l) => path.relative(ROOT, LOCALE_PATHS[l])).join('`, `')}\`)`)
  L(`- 递归 leaf key 总数:**${totalLeaves}**`)
  L(`- 代码静态引用 key(全路径 \`t('a.b.c')\` 形式):**${totalRefs}**(去重)`)
  L(`- \`useTranslations/getTranslations('namespace')\` 命名空间:**${totalNamespaces}** 个(命名空间下所有 key 视作潜在引用,启发式)`)
  L(`- 死 key 数量:**${deadCount}**(占比 **${deadRatio}%**)`)
  L(`- 翻译不完整 key 数量:**${incompleteCount}**`)
  L(`- 动态 t(\`prefix.\${var}\`) 命中:${dynamicHits.length} 处`)
  L('## 死 key 列表(按 namespace 分组)')
  if (deadCount === 0) { L('_无死 key_ ✅') }
  else for (const [ns, keys] of groupByNamespace(deadKeys)) {
    L(`### \`${ns}.*\`  (${keys.length} 个)`)
    for (const k of keys) L(`- \`${k}\``)
  }
  L('## 翻译不完整 key 列表(5 语言中任一缺失)')
  if (incompleteCount === 0) { L('_翻译完整_ ✅') }
  else for (const [ns, keys] of groupByNamespace(incompleteKeys)) {
    L(`### \`${ns}.*\`  (${keys.length} 个)`)
    for (const k of keys) {
      const missingLangs = LOCALES.filter((l) => l !== 'zh-CN' && !localeData[l].keys.has(k))
      L(`- \`${k}\`  (缺: ${missingLangs.join(', ')})`)
    }
  }
  L('## 动态 key 提示(代码中拼接的 key,无法静态扫描)')
  if (dynamicHits.length === 0) {
    L('_未发现动态 t(`prefix.${var}`) 调用_')
  } else {
    L(`共 ${dynamicHits.length} 处动态 key 调用,这些 key 即使在 zh-CN.json 中定义也无法通过静态扫描验证,建议人工核对:`)
    const byFile = new Map()
    for (const h of dynamicHits) { if (!byFile.has(h.file)) byFile.set(h.file, []); byFile.get(h.file).push(h) }
    for (const [f, hits] of byFile) {
      L(`- \`${f}\`(${hits.length} 处)`)
      for (const h of hits.slice(0, 3)) L(`  - L${h.line}: \`${h.snippet}\``)
      if (hits.length > 3) L(`  - ... 另 ${hits.length - 3} 处`)
    }
  }
  L('## 排除项')
  L('- 目录:node_modules / .next / dist / coverage / __tests__ / tests / __mocks__ / fixtures')
  L('- 文件:`*.test.ts(x)` / `*.spec.ts(x)` / `*.d.ts`')
  L('---')
  L(`_Generated at ${summary.scannedAt}_`)

  const outPath = out
    ? path.resolve(ROOT, out)
    : path.join(ROOT, outputPattern.replace('{date}', TODAY))
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8')
  console.log(`\n[${TAG}] 报告写入: ${path.relative(ROOT, outPath)}`)

  if (exitOnDead && deadCount > 0) {
    console.error(`[${TAG}] --exit 1:发现 ${deadCount} 个死 key`)
    return 1
  }
  return 0
}
