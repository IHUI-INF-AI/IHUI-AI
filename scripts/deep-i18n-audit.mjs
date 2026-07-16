#!/usr/bin/env node
/**
 * 4 语言 i18n 文件深度规则审校脚本。
 *
 * 审校规则:
 *   1. zh-TW 繁简混淆深度扫描 (opencc 字形 + 27 条 TW 用词映射)
 *   2. ja 垃圾占位深度扫描 (单假名/无意义片段/纯标点)
 *   3. ko 乱码/拼写深度扫描 (CJK 汉字/日文假名混入,排除 en 本身含 CJK 的情况)
 *   4. 4 语言一致性检查 (高频 key 长度异常 + 跨语言复制粘贴)
 *   5. 术语统一性 (token/model/prompt 等技术术语在各语言内翻译一致)
 *
 * 用法:
 *   node scripts/deep-i18n-audit.mjs          # 全量审校,有问题 exit 1
 *   node scripts/deep-i18n-audit.mjs --quiet  # 仅输出汇总,不打印明细
 *   node scripts/deep-i18n-audit.mjs --report # 同时写出 JSON 报告到 .trae-cn/goal-runtime/
 *
 * 不修改 apps/web/messages/en.json (英文为源语言)。
 * 不修改 JSON 结构 (仅输出问题清单,由 fix-* 脚本修复)。
 */
import fs from 'node:fs'
import path from 'node:path'
import * as OpenCC from 'opencc-js'

const ROOT = process.cwd()
const MSG_DIR = path.join(ROOT, 'apps/web/messages')
const WEB_DIR = path.join(ROOT, 'apps/web')
const EXCLUDE_DIRS = new Set(['messages', '.next', 'node_modules', '.git'])

const args = new Set(process.argv.slice(2))
const QUIET = args.has('--quiet')
const REPORT = args.has('--report')

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

// ============================================================
// 加载与展开
// ============================================================
function loadLang(lang) {
  return JSON.parse(fs.readFileSync(path.join(MSG_DIR, `${lang}.json`), 'utf8'))
}

function flatten(obj, prefix = '') {
  const map = new Map()
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [pp, vv] of flatten(v, p)) map.set(pp, vv)
    } else {
      map.set(p, v)
    }
  }
  return map
}

const enFlat = flatten(loadLang('en'))
const zhCNFlat = flatten(loadLang('zh-CN'))
const zhTWFlat = flatten(loadLang('zh-TW'))
const jaFlat = flatten(loadLang('ja'))
const koFlat = flatten(loadLang('ko'))

// ============================================================
// 高频 key 统计 (来自源码 useTranslations/getTranslations 调用)
// ============================================================
function collectSourceFiles(dir, result = []) {
  if (!fs.existsSync(dir)) return result
  for (const entry of fs.readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue
    const full = path.join(dir, entry)
    const st = fs.statSync(full)
    if (st.isDirectory()) collectSourceFiles(full, result)
    else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) result.push(full)
  }
  return result
}

function countKeyUsage() {
  const counts = new Map()
  const files = collectSourceFiles(WEB_DIR)
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8')
    const re =
      /(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*['"]([^'"]+)['"]\s*\)/g
    const pairs = []
    let m
    while ((m = re.exec(src)) !== null) pairs.push({ v: m[1], ns: m[2] })
    for (const { v, ns } of pairs) {
      const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const er = new RegExp(`\\b${escaped}\\(\\s*['"]([^'"]+)['"]`, 'g')
      let m2
      while ((m2 = er.exec(src)) !== null) {
        const k = `${ns}.${m2[1]}`
        counts.set(k, (counts.get(k) || 0) + 1)
      }
    }
  }
  return counts
}

const usageCounts = countKeyUsage()
const HIGH_FREQ_THRESHOLD = 10
const highFreqKeys = new Set(
  [...usageCounts.entries()].filter(([, c]) => c >= HIGH_FREQ_THRESHOLD).map(([k]) => k),
)

// ============================================================
// 通用工具
// ============================================================
const _BRANDS = new Set([
  'iOS', 'Apple', 'GitHub', 'Grok', 'Stripe', 'USDC', 'Android', 'APK',
  'OpenAI', 'Google', 'Microsoft', 'Twitter', 'Facebook', 'Instagram',
  'YouTube', 'WhatsApp', 'Telegram', 'Discord', 'Slack', 'GitLab',
])

const _KNOWN_ABBREVIATIONS = new Set([
  'OK', 'ID', 'API', 'URL', 'HTTP', 'HTTPS', 'JSON', 'XML', 'HTML', 'CSS',
  'JS', 'TS', 'UI', 'UX', 'AI', 'ML', 'PR', 'SSO', 'MCP', 'LLM', 'GPT',
  'SDK', 'CDN', 'DNS', 'SSL', 'TLS', 'CSV', 'PDF', 'PNG', 'JPG', 'JPEG',
  'GIF', 'SVG', 'MP4', 'MP3', 'JWT', 'OAuth', 'REST', 'SQL', 'VIP', 'SMS',
  'QR', 'NFC', 'GPS', 'GPU', 'CPU', 'RAM', 'SSD', 'HDD', 'USB', 'HDMI',
  'LCD', 'LED', 'OLED',
])

// ============================================================
// 规则 1: zh-TW 繁简混淆 + TW 用词深度扫描
// ============================================================

// 27 条 TW 用词映射 (任务描述列出)
const TW_VOCAB = [
  ['用戶', '使用者'],
  ['搜索', '搜尋'],
  ['導出', '匯出'],
  ['保存', '儲存'],
  ['數據', '資料'],
  ['視頻', '影片'],
  ['軟件', '軟體'],
  ['博客', '部落格'],
  ['默認', '預設'],
  ['屏幕', '螢幕'],
  ['鼠標', '滑鼠'],
  ['硬盤', '硬碟'],
  ['域名', '網域'],
  ['帶寬', '頻寬'],
  ['客服', '客戶服務'],
  ['登錄', '登入'],
  ['注冊', '註冊'],
  ['點擊', '點選'],
  ['鏈接', '連結'],
  ['訪問', '造訪'],
  ['內存', '記憶體'],
  ['光盤', '光碟'],
  ['打印', '列印'],
  ['共享', '共用'],
  ['數字', '數位'],
  ['網絡', '網路'],
  ['程序', '程式'],
  ['代碼', '程式碼'],
  ['鏈結', '連結'],
]

// 用 opencc 'cn' -> 'tw' 检测残留简体字 (字形级)
const simpConverter = OpenCC.Converter({ from: 'cn', to: 'tw' })

function auditZhTW() {
  const issues = []
  for (const [key, value] of zhTWFlat) {
    if (typeof value !== 'string' || !value) continue
    if (!/[\u4e00-\u9fff]/.test(value)) continue
    const enV = enFlat.get(key) || ''
    const enHasCJK = typeof enV === 'string' && /[\u4e00-\u9fff]/.test(enV)

    // 1a. 字形级简体残留 (跳过 en 也含 CJK 的情况,因品牌名等)
    const converted = simpConverter(value)
    if (converted !== value) {
      // 但若 en 也含相同 CJK,跳过 (品牌名)
      // 检查 en 中是否包含相同的简体字
      if (!enHasCJK) {
        issues.push({
          rule: 'zh-TW-simp-char',
          lang: 'zh-TW',
          key,
          current: value,
          suggested: converted,
          en: enV,
          reason: `包含简体字形字符(应转为繁体字形)`,
        })
        continue
      }
      // 即使 en 含 CJK, 若 value 含明确简体字也修复 (e.g., en=智谱清言, tw=智譜清言 也算改进)
      issues.push({
        rule: 'zh-TW-simp-char',
        lang: 'zh-TW',
        key,
        current: value,
        suggested: converted,
        en: enV,
        reason: `包含简体字形字符(应转为繁体字形)`,
      })
      continue
    }
    // 1b. 用词级 (大陆用词 -> TW 用词) — 跳过 en 也含相同大陆词的情况
    for (const [mainland, tw] of TW_VOCAB) {
      if (value.includes(mainland)) {
        // 若 en 也含相同字符 (品牌名), 跳过
        if (enV.includes(mainland)) continue
        const suggested = value.split(mainland).join(tw)
        issues.push({
          rule: 'zh-TW-vocab',
          lang: 'zh-TW',
          key,
          current: value,
          suggested,
          en: enV,
          reason: `大陆用词「${mainland}」→ TW 用词「${tw}」`,
        })
        break
      }
    }
  }
  return issues
}

// ============================================================
// 规则 2: ja 垃圾占位深度扫描 (refined, 使用 en 作为参考)
// ============================================================

// 合法的单 CJK 字符 (长度 1 时,若 en 也很短可接受)
const LEGIT_SINGLE_CJK_JA = new Set([
  '月', '年', '日', '時', '分', '秒', '前', '後', '上', '下', '左', '右',
  '中', '高', '低', '強', '弱', '速', '遅', '近', '遠', '大', '小', '多', '少',
  '新', '旧', '良', '悪', '可', '否', '有', '無', '出', '入', '開', '閉',
  '男', '女', '私', '本', '冊', '個', '件', '回', '度', '遍', '足', '枚', '丁',
  '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '百', '千', '万',
  '黒', '白', '赤', '青', '金', '銀', '玉', '王', '長', '短', '広', '狭',
  '主', '従', '優', '劣', '安', '危', '早', '晩', '朝', '夕', '昼', '夜',
])

const _HIRAGANA_RE = /[\u3040-\u309F]/
const _KATAKANA_RE = /[\u30A0-\u30FF]/
const SINGLE_HIRAGANA_RE = /^[ぁ-ゖ]$/ // 单个平假名
const SINGLE_KATAKANA_RE = /^[ァ-ヴー]$/ // 单个片假名
const PUNCT_ONLY_RE = /^[、。・…！？!?.,:;·/()「」『』（）／\\-]+$/
const PARTICLE_ONLY_RE = /^[のしきたてにはがをでも][、。.]?$/
const TWO_PARTICLES_RE = /^[をにがはの][をにがはの]$/

// 合法的整词结尾 は (如问候语)
const LEGIT_HA_ENDINGS = new Set([
  'こんにちは', 'こんばんは', 'おはよう', 'ありがとうございます',
  'ありがとうございました', 'いただきます', 'いってきます', 'いってらっしゃい',
  'おめでとうございます', 'お願いします', 'ください',
])

// 合法的单平假名翻译 (en 短词 → 单假名助词是完整翻译, 非占位)
// key: lowercase en, value: Set of 合法 ja 值
const LEGIT_SINGLE_HIRAGANA_BY_EN = {
  and: new Set(['と', 'や']),
  to: new Set(['へ', 'に']),
  or: new Set(['か']),
  of: new Set(['の']),
  in: new Set(['に']),
  at: new Set(['で', 'に']),
  by: new Set(['で']),
  as: new Set(['と']),
}

function auditJa() {
  const issues = []
  for (const [key, value] of jaFlat) {
    if (typeof value !== 'string' || !value) continue
    const t = value.trim()
    if (!t) continue
    // 跳过纯 ASCII (品牌/数字/缩写)
    if (!/[\u3040-\u30FF\u4e00-\u9fff]/.test(t)) continue
    const enV = enFlat.get(key) || ''
    const enLen = typeof enV === 'string' ? enV.length : 0

    // 跳过合法问候语
    if (LEGIT_HA_ENDINGS.has(t)) continue

    // 2a. 单字符非 ASCII 值
    if (t.length === 1) {
      // 合法单 CJK 字符 (当 en 也很短)
      if (LEGIT_SINGLE_CJK_JA.has(t) && enLen <= 8) continue
      // 单平假名 = 破碎
      if (SINGLE_HIRAGANA_RE.test(t)) {
        // 例外: en 短词 → 单假名助词是完整翻译 (如 and→と, to→へ)
        const enLow = typeof enV === 'string' ? enV.trim().toLowerCase() : ''
        if (enLow && LEGIT_SINGLE_HIRAGANA_BY_EN[enLow] && LEGIT_SINGLE_HIRAGANA_BY_EN[enLow].has(t)) continue
        issues.push({
          rule: 'ja-single-hiragana',
          lang: 'ja',
          key,
          current: value,
          suggested: '',
          en: enV,
          reason: `日文值为单平假名「${t}」(无实义占位)`,
        })
        continue
      }
      // 单片假名 = 破碎
      if (SINGLE_KATAKANA_RE.test(t)) {
        issues.push({
          rule: 'ja-single-katakana',
          lang: 'ja',
          key,
          current: value,
          suggested: '',
          en: enV,
          reason: `日文值为单片假名「${t}」(无实义占位)`,
        })
        continue
      }
      // 单标点
      if (PUNCT_ONLY_RE.test(t)) {
        issues.push({
          rule: 'ja-punct-only',
          lang: 'ja',
          key,
          current: value,
          suggested: '',
          en: enV,
          reason: `日文值为单标点「${t}」(无实义占位)`,
        })
        continue
      }
      // 其他单 CJK — 若 en 较长,可疑
      if (enLen > 8 && /[\u4e00-\u9fff]/.test(t)) {
        issues.push({
          rule: 'ja-single-cjk-long-en',
          lang: 'ja',
          key,
          current: value,
          suggested: '',
          en: enV,
          reason: `日文值为单 CJK「${t}」但 en 较长 (${enLen} 字符)`,
        })
        continue
      }
    }

    // 2b. 纯标点 (长度 ≤ 3)
    if (PUNCT_ONLY_RE.test(t) && t.length <= 3) {
      issues.push({
        rule: 'ja-punct-only',
        lang: 'ja',
        key,
        current: value,
        suggested: '',
        en: enV,
        reason: `日文值仅由标点构成 (无实义占位)`,
      })
      continue
    }

    // 2c. 仅由助词构成
    if (PARTICLE_ONLY_RE.test(t)) {
      issues.push({
        rule: 'ja-particle-only',
        lang: 'ja',
        key,
        current: value,
        suggested: '',
        en: enV,
        reason: `日文值仅由助词「${t}」构成 (无实义占位)`,
      })
      continue
    }

    // 2d. 2 字符均为助词 (破碎)
    if (TWO_PARTICLES_RE.test(t)) {
      issues.push({
        rule: 'ja-two-particles',
        lang: 'ja',
        key,
        current: value,
        suggested: '',
        en: enV,
        reason: `日文值为 2 助词组合「${t}」(无实义占位)`,
      })
      continue
    }

    // 2e. 破碎片段: 以助词开头 + 长度 < 6 + en 较长
    if (/^[をにがはの、。]/.test(t) && t.length < 6 && enLen > 5) {
      issues.push({
        rule: 'ja-fragment-start',
        lang: 'ja',
        key,
        current: value,
        suggested: '',
        en: enV,
        reason: `日文值以助词开头且长度 ${t.length} < 6 (疑似破碎片段)`,
      })
      continue
    }

    // 2f. 截断结尾 (助词结尾 + ja 明显短于 en)
    const trimmedT = t.replace(/[。.!?]?$/, '')
    if (/[をにがは]$/m.test(trimmedT) && t.length < enLen * 0.6 && enLen > 8) {
      issues.push({
        rule: 'ja-truncated-particle-end',
        lang: 'ja',
        key,
        current: value,
        suggested: '',
        en: enV,
        reason: `日文值以助词结尾且长度 ${t.length} < en (${enLen}) × 0.6 (疑似截断)`,
      })
      continue
    }

    // 2g. 多个孤立助词被标点分隔 (明显破碎)
    if (/[をにがはの]、[をにがはの]/.test(t)) {
      issues.push({
        rule: 'ja-multi-particle-fragment',
        lang: 'ja',
        key,
        current: value,
        suggested: '',
        en: enV,
        reason: `日文值含「助词、助词」结构 (疑似破碎片段)`,
      })
      continue
    }
  }
  return issues
}

// ============================================================
// 规则 3: ko 乱码/拼写深度扫描 (跳过 en 本身含 CJK 的情况)
// ============================================================

const CJK_CHAR_RE = /[\u4e00-\u9fff]/
const KANA_RE = /[\u3040-\u30FF]/
const _HANGUL_RE = /[\uAC00-\uD7A3]/

function auditKo() {
  const issues = []
  for (const [key, value] of koFlat) {
    if (typeof value !== 'string' || !value) continue
    const t = value.trim()
    if (!t) continue
    const enV = enFlat.get(key) || ''
    const enHasCJK = typeof enV === 'string' && CJK_CHAR_RE.test(enV)
    const enHasKana = typeof enV === 'string' && KANA_RE.test(enV)

    // 3a. 混入中文字符 (排除 en 本身含 CJK 的情况)
    if (CJK_CHAR_RE.test(t) && !enHasCJK) {
      issues.push({
        rule: 'ko-cjk-contamination',
        lang: 'ko',
        key,
        current: value,
        suggested: '',
        en: enV,
        reason: `韩文值中混入中文字符 (en 无 CJK)`,
      })
      continue
    }
    // 3b. 混入日文假名 (排除 en 本身含假名的情况)
    if (KANA_RE.test(t) && !enHasKana) {
      issues.push({
        rule: 'ko-kana-contamination',
        lang: 'ko',
        key,
        current: value,
        suggested: '',
        en: enV,
        reason: `韩文值中混入日文假名 (en 无假名)`,
      })
      continue
    }
  }
  return issues
}

// ============================================================
// 规则 4: 4 语言一致性检查 (高频 key 长度异常 + 跨语言复制粘贴)
// ============================================================

function auditConsistency() {
  const issues = []
  const allKeys = new Set([
    ...enFlat.keys(),
    ...zhCNFlat.keys(),
    ...zhTWFlat.keys(),
    ...jaFlat.keys(),
    ...koFlat.keys(),
  ])

  for (const key of allKeys) {
    const en = enFlat.get(key)
    const zhCN = zhCNFlat.get(key)
    const zhTW = zhTWFlat.get(key)
    const ja = jaFlat.get(key)
    const ko = koFlat.get(key)

    if (typeof en !== 'string') continue
    const enLen = en.length
    if (enLen < 4) continue

    const values = { 'zh-CN': zhCN, 'zh-TW': zhTW, ja, ko }
    const langs = Object.keys(values)

    // 4a. zh-CN 与 zh-TW 完全相同 且 zh-TW 含简体字 (字形未转换) — 真正的未繁体化
    if (
      typeof zhCN === 'string' && typeof zhTW === 'string' &&
      zhCN === zhTW && zhCN.length > 4 &&
      /[\u4e00-\u9fff]/.test(zhCN) &&
      simpConverter(zhTW) !== zhTW // zh-TW 含可被 opencc 转换的简体字
    ) {
      issues.push({
        rule: 'consistency-zh-duplicate',
        lang: 'zh-CN/zh-TW',
        key,
        current: zhCN,
        suggested: simpConverter(zhTW),
        en,
        reason: `zh-CN 与 zh-TW 值完全相同且 zh-TW 含简体字 (未做繁体化)`,
      })
    }

    // 4b. 高频 key: 某语言值明显过短 (仅 flag 空值或单字符非合法值)
    if (highFreqKeys.has(key) || (usageCounts.get(key) || 0) >= 5) {
      for (const lang of langs) {
        const v = values[lang]
        if (typeof v !== 'string' || !v) continue
        if (!/[\u3040-\u30FF\u4e00-\u9fff\uAC00-\uD7A3]/.test(v)) continue // 仅 ASCII 跳过
        const vLen = v.length
        // 仅 flag 长度 0 或 1 (且非合法单 CJK)
        if (vLen < 2) {
          if (lang === 'ja' && vLen === 1 && LEGIT_SINGLE_CJK_JA.has(v)) continue
          issues.push({
            rule: 'consistency-too-short',
            lang,
            key,
            current: v,
            suggested: '',
            en,
            reason: `高频 key 在 ${lang} 中值长度 ${vLen} (空或单字符)`,
          })
        }
      }
    }
  }
  return issues
}

// ============================================================
// 规则 5: 术语统一性 (各语言内技术术语翻译一致)
// ============================================================

const TERM_MAP = {
  token: {
    ja: ['トークン', 'token', 'Token'],
    ko: ['토큰', 'token', 'Token'],
    'zh-TW': ['權杖', '代幣', 'token', 'Token', '令牌'],
  },
  Token: {
    ja: ['トークン', 'token', 'Token'],
    ko: ['토큰', 'token', 'Token'],
    'zh-TW': ['權杖', '代幣', 'token', 'Token', '令牌'],
  },
  model: {
    ja: ['モデル', 'model', 'Model'],
    ko: ['모델', 'model', 'Model'],
    'zh-TW': ['模型', 'model', 'Model'],
  },
  prompt: {
    ja: ['プロンプト', 'prompt', 'Prompt'],
    ko: ['프롬프트', 'prompt', 'Prompt'],
    'zh-TW': ['提示詞', 'prompt', 'Prompt', '提示'],
  },
}

function auditTerms() {
  const issues = []
  for (const [key, enValue] of enFlat) {
    if (typeof enValue !== 'string') continue
    for (const [term, langMap] of Object.entries(TERM_MAP)) {
      const termRe = new RegExp(`\\b${term}\\b`, 'i')
      if (!termRe.test(enValue)) continue

      for (const [lang, allowed] of Object.entries(langMap)) {
        const v = { 'zh-TW': zhTWFlat.get(key), ja: jaFlat.get(key), ko: koFlat.get(key) }[lang]
        if (typeof v !== 'string' || !v) continue
        const containsAllowed = allowed.some((a) => v.includes(a))
        if (!containsAllowed) {
          if (v.length < 3) continue
          if (/^[A-Za-z0-9 ._\-/]+$/.test(v)) continue
          if (lang === 'ja' && !/[\u3040-\u30FF\u4e00-\u9fff]/.test(v)) continue
          if (lang === 'ko' && !/[\uAC00-\uD7A3]/.test(v)) continue
          if (lang === 'zh-TW' && !/[\u4e00-\u9fff]/.test(v)) continue
          issues.push({
            rule: 'term-inconsistency',
            lang,
            key,
            current: v,
            suggested: allowed[0],
            en: enValue,
            reason: `术语 "${term}" 在 ${lang} 中可能用了非统一翻译 (建议: ${allowed[0]})`,
          })
        }
      }
    }
  }
  return issues
}

// ============================================================
// 主流程
// ============================================================

const allIssues = [
  ...auditZhTW(),
  ...auditJa(),
  ...auditKo(),
  ...auditConsistency(),
  ...auditTerms(),
]

// 去重 (同一 key + lang + rule 只报告一次)
const seen = new Set()
const deduped = []
for (const issue of allIssues) {
  const sig = `${issue.rule}|${issue.lang}|${issue.key}`
  if (seen.has(sig)) continue
  seen.add(sig)
  deduped.push(issue)
}

const byRule = new Map()
for (const it of deduped) {
  const r = it.rule
  if (!byRule.has(r)) byRule.set(r, [])
  byRule.get(r).push(it)
}

const ruleNames = {
  'zh-TW-simp-char': '规则1a: zh-TW 简体字形残留',
  'zh-TW-vocab': '规则1b: zh-TW 大陆用词(应换 TW 用词)',
  'ja-single-hiragana': '规则2a: ja 单平假名(占位)',
  'ja-single-katakana': '规则2b: ja 单片假名(占位)',
  'ja-punct-only': '规则2c: ja 纯标点(占位)',
  'ja-single-cjk-long-en': '规则2d: ja 单 CJK 但 en 较长',
  'ja-particle-only': '规则2e: ja 仅助词(占位)',
  'ja-two-particles': '规则2f: ja 2 助词组合(占位)',
  'ja-fragment-start': '规则2g: ja 以助词开头(破碎)',
  'ja-truncated-particle-end': '规则2h: ja 截断结尾(以助词结尾+明显短于 en)',
  'ja-multi-particle-fragment': '规则2i: ja 多助词片段(破碎)',
  'ko-cjk-contamination': '规则3a: ko 混入中文字符(en 无 CJK)',
  'ko-kana-contamination': '规则3b: ko 混入日文假名(en 无假名)',
  'consistency-zh-duplicate': '规则4a: zh-CN/zh-TW 完全相同(疑似未繁体化)',
  'consistency-too-short': '规则4b: 高频 key 翻译明显过短',
  'term-inconsistency': '规则5: 术语翻译不统一',
}

console.log(`${C.cyan}[deep-i18n-audit] 4 语言 i18n 深度审校${C.reset}`)
console.log(`${C.dim}  扫描范围: en ${enFlat.size} 键 / zh-CN ${zhCNFlat.size} 键 / zh-TW ${zhTWFlat.size} 键 / ja ${jaFlat.size} 键 / ko ${koFlat.size} 键${C.reset}`)
console.log(`${C.dim}  高频 key (使用次数 ≥ ${HIGH_FREQ_THRESHOLD}): ${highFreqKeys.size} 个${C.reset}`)
console.log('')

if (deduped.length === 0) {
  console.log(`${C.green}[deep-i18n-audit] ✅ 通过 — 0 个问题${C.reset}`)
  if (REPORT) writeReport([])
  process.exit(0)
}

console.log(`${C.yellow}发现问题汇总: ${deduped.length} 个${C.reset}`)
for (const [rule, items] of [...byRule.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${C.yellow}${ruleNames[rule] || rule}: ${items.length} 个${C.reset}`)
}
console.log('')

if (!QUIET) {
  for (const [rule, items] of [...byRule.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`${C.magenta}=== ${ruleNames[rule] || rule} ===${C.reset}`)
    for (const it of items.slice(0, 100)) {
      console.log(`${C.cyan}[${it.lang}]${C.reset} ${it.key}`)
      console.log(`  当前: ${it.current}`)
      console.log(`  EN源: ${C.dim}${it.en || ''}${C.reset}`)
      if (it.suggested) console.log(`  建议: ${C.green}${it.suggested}${C.reset}`)
      console.log(`  原因: ${C.dim}${it.reason}${C.reset}`)
    }
    if (items.length > 100) {
      console.log(`${C.dim}  ... 还有 ${items.length - 100} 个 (用 --report 查看完整清单)${C.reset}`)
    }
    console.log('')
  }
}

if (REPORT) writeReport(deduped)

console.log(`${C.red}[deep-i18n-audit] 发现 ${deduped.length} 个问题,需修复${C.reset}`)
process.exit(1)

function writeReport(items) {
  const reportDir = path.join(ROOT, '.trae-cn/goal-runtime')
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true })
  const reportPath = path.join(reportDir, 'deep-i18n-audit-report.json')
  fs.writeFileSync(
    reportPath,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      totalIssues: items.length,
      byRule: Object.fromEntries(
        [...byRule.entries()].map(([r, xs]) => [r, xs.length]),
      ),
      issues: items,
    }, null, 2),
    'utf8',
  )
  console.log(`${C.dim}报告已写出: ${reportPath}${C.reset}`)
}
