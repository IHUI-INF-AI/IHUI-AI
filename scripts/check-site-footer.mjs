#!/usr/bin/env node
/**
 * check-site-footer.mjs — SiteFooter 关键 class + namespace 守门
 *
 * 触发背景(2026-07-30 立,真实回退事故):
 * 多次 commit 后 SiteFooter 被回退到 v8 4 分组状态(丢 INTERNATIONAL_MODELS/CHINESE_MODELS 拆分),
 * 本守门脚本防止 v10/v11 关键改动再被回退。
 *
 * 守门项:
 * 1. SiteFooter.tsx 关键 className 不能变(py-2 md:py-3 / h-7 w-7 / h-16 w-16 / h-5 w-5 / lg:grid-cols-5)
 * 2. ECOSYSTEM_GROUPS 必须是 5 分组(含 internationalModels / chineseModels)
 * 3. 必须 import INTERNATIONAL_MODELS / CHINESE_MODELS
 * 4. 单一 useTranslations('footer') 命名空间,禁止 tRoutes() / 其他 namespace
 * 5. footer-data.ts 必须导出 INTERNATIONAL_MODELS / CHINESE_MODELS
 * 6. 5 个 i18n 文件 footer 命名空间必须包含 internationalModels / chineseModels / agreementSubtitle / contactSubtitle
 *
 * 用法:
 *   node scripts/check-site-footer.mjs          # 单次守门
 *   pnpm footer:guard                          # package.json 集成
 *
 * 退出码: 0=通过, 1=失败
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const errors = []
const warnings = []

function check(label, cond, hint) {
  if (cond) {
    console.log(`  \u2713 ${label}`)
  } else {
    errors.push(`${label}${hint ? ' — ' + hint : ''}`)
    console.log(`  \u2717 ${label}${hint ? ' — ' + hint : ''}`)
  }
}

function warn(label, hint) {
  warnings.push(`${label}${hint ? ' — ' + hint : ''}`)
  console.log(`  \u26a0 ${label}${hint ? ' — ' + hint : ''}`)
}

// 1. SiteFooter.tsx 关键 class 守门
const sfPath = resolve(ROOT, 'apps/web/src/components/marketing/SiteFooter.tsx')
if (!existsSync(sfPath)) {
  errors.push(`SiteFooter.tsx 不存在: ${sfPath}`)
} else {
  console.log('\n[1/6] SiteFooter.tsx 关键 class 守门')
  const sf = readFileSync(sfPath, 'utf8')
  check('py-2 md:py-3 padding(v10 拉高)', /py-2[^\n]*md:py-3/.test(sf), 'v10 footer 高度 ~140px 关键')
  check('h-7 w-7 icon box', /h-7 w-7/.test(sf), 'icon 容器尺寸')
  check('h-16 w-16 QR box', /h-16 w-16/.test(sf), 'QR 码容器尺寸')
  check('h-5 w-5 ICP icon', /h-5 w-5 object-contain/.test(sf), '备案图标尺寸')
  check('lg:grid-cols-5 生态合作 5 列', /lg:grid-cols-5/.test(sf), '5 类分组 1 行布局')
  check('useTranslations(\'footer\') 单一命名空间', /useTranslations\(['"]footer['"]\)/.test(sf))
  check('无 tRoutes() 残留(跨 namespace 拼接)', !/tRoutes\(/.test(sf), 'SiteFooter 不应跨 namespace')
  check('ECOSYSTEM_GROUPS 含 5 项', (sf.match(/titleKey:/g) ?? []).length >= 5, '5 个分组')
  check(
    'ECOSYSTEM_GROUPS 含 internationalModels',
    /titleKey:\s*['"]internationalModels['"]/.test(sf)
  )
  check('ECOSYSTEM_GROUPS 含 chineseModels', /titleKey:\s*['"]chineseModels['"]/.test(sf))
  check('import INTERNATIONAL_MODELS', /INTERNATIONAL_MODELS/.test(sf))
  check('import CHINESE_MODELS', /CHINESE_MODELS/.test(sf))
}

// 2. footer-data.ts 导出守门
const fdPath = resolve(ROOT, 'apps/web/src/components/marketing/footer-data.ts')
if (!existsSync(fdPath)) {
  errors.push(`footer-data.ts 不存在: ${fdPath}`)
} else {
  console.log('\n[2/6] footer-data.ts 导出守门')
  const fd = readFileSync(fdPath, 'utf8')
  check('export const INTERNATIONAL_MODELS', /export const INTERNATIONAL_MODELS/.test(fd))
  check('export const CHINESE_MODELS', /export const CHINESE_MODELS/.test(fd))
  check('MODELS 数组保留(BrandMarquee 依赖)', /export const MODELS/.test(fd))
  // 数国际/国产模型组里 nameKey 出现次数(应各 4 个)
  // 用 [\s\S]*? 跨行匹配 + 平衡数组结束符]
  const intlIdx = fd.indexOf('INTERNATIONAL_MODELS')
  const cnIdx = fd.indexOf('CHINESE_MODELS')
  const intlEnd = intlIdx >= 0 ? fd.indexOf('\n]', intlIdx) : -1
  const intlBlock = intlIdx >= 0 && intlEnd >= 0 ? fd.slice(intlIdx, intlEnd) : ''
  const intlCount = (intlBlock.match(/nameKey:/g) ?? []).length
  check(`INTERNATIONAL_MODELS 含 4 个模型(实际 ${intlCount})`, intlCount === 4)

  const cnEnd = cnIdx >= 0 ? fd.indexOf('\n]', cnIdx) : -1
  const cnBlock = cnIdx >= 0 && cnEnd >= 0 ? fd.slice(cnIdx, cnEnd) : ''
  const cnCount = (cnBlock.match(/nameKey:/g) ?? []).length
  check(`CHINESE_MODELS 含 4 个模型(实际 ${cnCount})`, cnCount === 4)
}

// 3-6. 5 个语言 i18n 守门
const i18nFiles = [
  { lang: 'zh-CN', file: 'packages/i18n/messages/web/zh-CN.json' },
  { lang: 'en', file: 'packages/i18n/messages/web/en.json' },
  { lang: 'zh-TW', file: 'packages/i18n/messages/web/zh-TW.json' },
  { lang: 'ko', file: 'packages/i18n/messages/web/ko.json' },
  { lang: 'ja', file: 'packages/i18n/messages/web/ja.json' },
]

console.log('\n[3-6/6] 5 语言 footer 命名空间关键 key 守门')
const requiredKeys = [
  'internationalModels',
  'chineseModels',
  'agreementSubtitle',
  'contactSubtitle',
  'userAgreement',
  'privacyPolicy',
  'aboutUs',
  'contactUs',
  'companyName',
  'icp',
  'copyright',
]
for (const { lang, file } of i18nFiles) {
  const fp = resolve(ROOT, file)
  if (!existsSync(fp)) {
    errors.push(`${lang} 文件不存在: ${file}`)
    continue
  }
  const json = JSON.parse(readFileSync(fp, 'utf8'))
  const footer = json.footer
  if (!footer) {
    errors.push(`${lang} 缺 footer 命名空间`)
    continue
  }
  for (const key of requiredKeys) {
    const val = footer[key]
    if (val === undefined) {
      errors.push(`${lang} footer.${key} 缺失`)
    } else if (typeof val === 'string' && val.trim() === '') {
      errors.push(`${lang} footer.${key} 为空字符串`)
    } else if (val === null) {
      errors.push(`${lang} footer.${key} 为 null`)
    }
  }
  // 嵌套 key 守门
  for (const k of ['claude', 'gpt', 'gemini', 'deepseek', 'qwen', 'doubao', 'llama', 'mistral']) {
    if (!footer.modelItems?.[k] || String(footer.modelItems[k]).trim() === '') {
      errors.push(`${lang} footer.modelItems.${k} 缺失或为空`)
    }
  }
  for (const k of ['mongodb', 'mysql', 'postgresql', 'redis', 'sqlite']) {
    if (!footer.databases?.[k] || String(footer.databases[k]).trim() === '') {
      errors.push(`${lang} footer.databases.${k} 缺失或为空`)
    }
  }
  if (errors.length === 0 || errors.every((e) => !e.startsWith(lang + ' '))) {
    console.log(`  \u2713 ${lang} 全部 ${requiredKeys.length + 13} 个 key 完整`)
  }
}

// 输出汇总
console.log('\n========================================')
if (errors.length === 0) {
  console.log(`\u2705 SiteFooter 守门全部通过(警告 ${warnings.length} 条)`)
  process.exit(0)
} else {
  console.log(`\u274c SiteFooter 守门失败: ${errors.length} 个错误`)
  for (const e of errors) console.log(`   - ${e}`)
  if (warnings.length > 0) {
    console.log(`\n警告 ${warnings.length} 条:`)
    for (const w of warnings) console.log(`   - ${w}`)
  }
  console.log('\n修复提示:')
  console.log('  1. 检查 SiteFooter.tsx 是否被回退到 v8 4 分组状态')
  console.log('  2. 确认 footer-data.ts 导出 INTERNATIONAL_MODELS / CHINESE_MODELS')
  console.log('  3. 5 语言文件 footer 命名空间必须包含 internationalModels / chineseModels / agreementSubtitle / contactSubtitle')
  process.exit(1)
}
