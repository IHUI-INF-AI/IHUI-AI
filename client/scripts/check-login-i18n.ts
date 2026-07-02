/**
 * 登录页 i18n 验收脚本
 * 1. 验证 5 语言 (zh-CN / en / zh-TW / ja / ko) login.json 全部加载
 * 2. 验证 zh-CN 基准的每个键在所有语言都存在且非空
 * 3. 检测键名裸露 (值 == 键名) 与占位符 (Coming Soon 类英文)
 * 4. 检测替换字符 (U+FFFD) 与乱码中韩日字符混入键名
 * 5. 输出覆盖率报告 + 缺失项, 失败时 exit 1 (供 CI 使用)
 *
 * 区别于 check-i18n.ts (全局覆盖率):
 *   - 严格模式: login 页面键必须 100% 覆盖, 不允许缺失
 *   - 检测项更细致: 替换字符、键名裸露、占位符、混合中韩日键名
 *   - 键路径: 报告扁平化路径 (e.g. thirdParty.comingSoon) 便于定位
 */

import fs from 'node:fs'
import path from 'node:path'

const LOCALES = ['zh-CN', 'en', 'zh-TW', 'ja', 'ko'] as const
const LOCALES_DIR = path.join(process.cwd(), 'src', 'locales', 'modules')

/** 已知"未翻译"占位符 (英文键名直接当值, 视为 bug) */
const PLACEHOLDER_FALLBACKS = new Set([
  'comingSoon', 'Go Login', 'Go Register', 'Has Account',
  'switchPlatform', 'loggingIn', 'retry', 'securityTip',
  'emailLogin', 'phoneLogin', 'accountLogin', 'feishu',
  'otherMethods', 'quickLogin', 'selectPreferred',
  'securityNotice1', 'securityNotice2', 'securityNotice3',
  'Logging Successful', 'Logging Failed',
])
// 注意: 'Login Successful' 是英文 'loginSuccess' 键的合法翻译, 不算占位符
// 'Login Failed' 同理

/**
 * 已知机器翻译伪词 (2026-07-02 立)
 * 这些词是机器翻译"用户"时的典型错误 (생각=想, 사용=用, 게=棋/东西)
 * 以及其他明显的机翻痕迹. 命中即视为 bug.
 */
const MT_GARBAGE_PATTERNS: { locale: string; pattern: RegExp; desc: string }[] = [
  // ko: "생각사용게" = "想+用+东西" = 机器翻译 "用户" 的错误结果
  { locale: 'ko', pattern: /생각사용/g, desc: '机器翻译伪词 (생각사용게 → 사용자)' },
  // ko: "가사용성" = "可+用性" 的错误拼接
  { locale: 'ko', pattern: /가사용성/g, desc: '机器翻译伪词 (가사용성 → 가용성)' },
  // ko: "요청입력" = "请输入" 的错误拼接 (요청=请求, 입력=输入)
  { locale: 'ko', pattern: /요청입력/g, desc: '机器翻译伪词 (요청입력 → 을(를) 입력하세요)' },
  // ko: "간주의됩니다" = "간주(视为) + 의(的) + 됩니다(了)" 多余的 의
  { locale: 'ko', pattern: /간주의됩니다/g, desc: '机器翻译伪词 (간주의됩니다 → 간주됩니다)' },
  // ja: 未来如发现类似问题可在此追加
]

interface LocaleReport {
  locale: string
  totalKeys: number
  missingKeys: string[]
  emptyKeys: string[]
  placeholderKeys: string[]
  replacementCharKeys: string[]
  dirtyKeyNames: string[]
  mtGarbageKeys: string[]
}

function readJSON(p: string): Record<string, unknown> | null {
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {
    return null
  }
}

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flattenKeys(v as Record<string, unknown>, key))
    } else {
      out.push(key)
    }
  }
  return out
}

function flattenValues(obj: Record<string, unknown>, prefix = ''): [string, string][] {
  const out: [string, string][] = []
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flattenValues(v as Record<string, unknown>, key))
    } else {
      out.push([key, String(v ?? '')])
    }
  }
  return out
}

function isDirtyKeyName(k: string): boolean {
  // 混合汉字/假名/谚文作为键名 (典型脏数据)
  return /[一-鿿]/.test(k) || /[ぁ-ん]/.test(k) || /[ァ-ヴー]/.test(k) ||
    /[ㄱ-ㅎ가-힣]/.test(k) || k.includes('핵심') || k.includes('전화') || k.includes('이메일')
}

function checkLocale(locale: string, baseline: Set<string>, baselineData: Record<string, unknown>): LocaleReport {
  const fp = path.join(LOCALES_DIR, locale, 'login.json')
  const data = readJSON(fp)
  if (!data) {
    return {
      locale, totalKeys: 0,
      missingKeys: [...baseline],
      emptyKeys: [], placeholderKeys: [], replacementCharKeys: [],
      dirtyKeyNames: [],
    }
  }

  const dataKeys = new Set(flattenKeys(data))
  const values = flattenValues(data)

  // 缺失: 基准有但当前 locale 没有
  const missingKeys: string[] = []
  for (const k of baseline) {
    if (!dataKeys.has(k)) missingKeys.push(k)
  }

  // 空值
  const emptyKeys = values.filter(([, v]) => v === '' || v === 'null' || v === 'undefined').map(([k]) => k)

  // 占位符: 值与 PLACEHOLDER_FALLBACKS 集合匹配
  const placeholderKeys = values.filter(([, v]) => PLACEHOLDER_FALLBACKS.has(v)).map(([k]) => k)

  // 替换字符 (U+FFFD)
  const replacementCharKeys = values.filter(([, v]) => v.includes('\uFFFD')).map(([k]) => k)

  // 脏键名
  const dirtyKeyNames = Object.keys(data).filter(isDirtyKeyName)

  // 机器翻译伪词 (仅检查对应 locale 的模式)
  const mtGarbageKeys: string[] = []
  for (const { locale: loc, pattern, desc: _desc } of MT_GARBAGE_PATTERNS) {
    if (loc !== locale) continue
    for (const [k, v] of values) {
      if (pattern.test(v)) {
        mtGarbageKeys.push(`${k} (${_desc})`)
      }
    }
  }

  return {
    locale,
    totalKeys: dataKeys.size,
    missingKeys,
    emptyKeys,
    placeholderKeys,
    replacementCharKeys,
    dirtyKeyNames,
    mtGarbageKeys,
  }
}

function main(): void {
  console.log('\n🔐 登录页 i18n 验收')
  console.log('━'.repeat(60))
  console.log(`基准语言: zh-CN (登录页必须 100% 覆盖)`)
  console.log(`验证语言: ${LOCALES.join(', ')}`)
  console.log()

  // 1. 加载 zh-CN 基准
  const baselineFp = path.join(LOCALES_DIR, 'zh-CN', 'login.json')
  const baselineData = readJSON(baselineFp)
  if (!baselineData) {
    console.error(`❌ 基准文件缺失: ${baselineFp}`)
    process.exit(2)
  }
  const baselineKeys = new Set(flattenKeys(baselineData))
  console.log(`📋 基准键数: ${baselineKeys.size}`)
  console.log()

  // 2. 验证每种语言
  const reports: LocaleReport[] = []
  for (const loc of LOCALES) {
    reports.push(checkLocale(loc, baselineKeys, baselineData))
  }

  // 3. 输出报告
  let totalIssues = 0
  for (const r of reports) {
    const issues =
      r.missingKeys.length +
      r.emptyKeys.length +
      r.placeholderKeys.length +
      r.replacementCharKeys.length +
      r.dirtyKeyNames.length +
      r.mtGarbageKeys.length
    const icon = issues === 0 ? '✅' : '❌'
    totalIssues += issues
    console.log(`${icon} ${r.locale.padEnd(8)} 键数 ${r.totalKeys}/${baselineKeys.size}  `
      + `缺失 ${r.missingKeys.length}  `
      + `空值 ${r.emptyKeys.length}  `
      + `占位 ${r.placeholderKeys.length}  `
      + `乱码 ${r.replacementCharKeys.length}  `
      + `脏键名 ${r.dirtyKeyNames.length}  `
      + `机翻 ${r.mtGarbageKeys.length}`)
    if (r.missingKeys.length && r.missingKeys.length <= 5) {
      console.log(`       缺失: ${r.missingKeys.join(', ')}`)
    } else if (r.missingKeys.length > 5) {
      console.log(`       缺失: ${r.missingKeys.slice(0, 3).join(', ')}... (共 ${r.missingKeys.length} 个)`)
    }
    if (r.placeholderKeys.length) {
      console.log(`       占位: ${r.placeholderKeys.slice(0, 3).join(', ')}${r.placeholderKeys.length > 3 ? '...' : ''}`)
    }
    if (r.dirtyKeyNames.length) {
      console.log(`       脏键名: ${r.dirtyKeyNames.join(', ')}`)
    }
    if (r.mtGarbageKeys.length) {
      console.log(`       机翻: ${r.mtGarbageKeys.slice(0, 3).join(', ')}${r.mtGarbageKeys.length > 3 ? '...' : ''}`)
    }
  }

  console.log('\n' + '━'.repeat(60))
  if (totalIssues === 0) {
    console.log('✅ 登录页 i18n 验收通过 (5 语言 × 100% 覆盖)')
    process.exit(0)
  } else {
    console.log(`❌ 登录页 i18n 验收失败, 共 ${totalIssues} 项问题`)
    process.exit(1)
  }
}

main()
