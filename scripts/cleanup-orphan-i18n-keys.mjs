#!/usr/bin/env node
/**
 * cleanup-orphan-i18n-keys.mjs — 清理 5 语言 i18n 文件中的孤儿 key
 * (2026-07-26 立)
 *
 * 用法:
 *   node scripts/cleanup-orphan-i18n-keys.mjs
 *   node scripts/cleanup-orphan-i18n-keys.mjs --dry-run
 *
 * 依据: scripts/audit-i18n-unused-keys.mjs 输出的 .trae-cn/tmp/web-unused-keys.json
 * 人工甄别 30 个审计误报(about.stat* / faq.* 全部)+ 27 个真孤儿(应删除)。
 *
 * 真孤儿清单(2026-07-26 第二阶段):
 *   - admin.edu.learn.records.type.label
 *   - admin.edu.learn.ranking.period.label
 *   - models.keys.statusLabels.disabled
 *   - models.billing.transactions.statusLabels.failed
 *   - models.billing.transactions.statusLabels.pending
 *   - models.billing.transactions.types.withdraw
 *   - models.channels.statusLabels.success
 *   - models.channels.statusLabels.failed
 *   - about.metaTitle
 *   - about.metaDescription
 *   - about.loading
 *   - about.valueMissionTitle / valueMissionDesc
 *   - about.valueCommunityTitle / valueCommunityDesc
 *   - about.valuePromiseTitle / valuePromiseDesc
 *   - about.valueDirectionTitle / valueDirectionDesc
 *   - about.marketingBadge / marketingHeroTitle
 *   - about.marketingFallbackSiteName / marketingFallbackDescription
 *   - about.marketingCtaTitle / marketingCtaDesc
 *   - about.marketingJoinNow / marketingViewPricing
 *
 * 审计误报保留(实际有引用,审计脚本 valueKey 字段未识别 + 模板字符串无 prefix 未识别):
 *   - about.statUsers / statAgents / statLanguages / statOpensource (4 个,AboutContent.tsx valueKey 数组)
 *   - faq.metaTitle / faq.metaDescription (2 个,page.tsx metadata 备用)
 *   - faq.q1Question ~ q12Question (12 个,FaqContent.tsx `${item.id}Question` 拼接)
 *   - faq.q1Answer ~ q12Answer (12 个,FaqContent.tsx `${item.id}Answer` 拼接)
 */
import fs from 'node:fs'
import path from 'node:path'

const I18N_DIR = path.resolve('packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']

const KEYS_TO_DELETE = [
  'admin.edu.learn.records.type.label',
  'admin.edu.learn.ranking.period.label',
  'models.keys.statusLabels.disabled',
  'models.billing.transactions.statusLabels.failed',
  'models.billing.transactions.statusLabels.pending',
  'models.billing.transactions.types.withdraw',
  'models.channels.statusLabels.success',
  'models.channels.statusLabels.failed',
  'about.metaTitle',
  'about.metaDescription',
  'about.loading',
  'about.valueMissionTitle',
  'about.valueMissionDesc',
  'about.valueCommunityTitle',
  'about.valueCommunityDesc',
  'about.valuePromiseTitle',
  'about.valuePromiseDesc',
  'about.valueDirectionTitle',
  'about.valueDirectionDesc',
  'about.marketingBadge',
  'about.marketingHeroTitle',
  'about.marketingFallbackSiteName',
  'about.marketingFallbackDescription',
  'about.marketingCtaTitle',
  'about.marketingCtaDesc',
  'about.marketingJoinNow',
  'about.marketingViewPricing',
]

function deleteKey(obj, keyPath) {
  const parts = keyPath.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur || typeof cur !== 'object' || !(parts[i] in cur)) return false
    cur = cur[parts[i]]
  }
  const last = parts[parts.length - 1]
  if (cur && typeof cur === 'object' && last in cur) {
    delete cur[last]
    return true
  }
  return false
}

function pruneEmptyParents(obj, keyPath) {
  const parts = keyPath.split('.')
  for (let i = parts.length - 1; i > 0; i--) {
    let cur = obj
    for (let j = 0; j < i; j++) {
      if (!cur || typeof cur !== 'object' || !(parts[j] in cur)) break
      cur = cur[parts[j]]
    }
    if (cur && typeof cur === 'object' && Object.keys(cur).length === 0) {
      let p = obj
      for (let j = 0; j < i - 1; j++) {
        if (!p || typeof p !== 'object' || !(parts[j] in p)) break
        p = p[parts[j]]
      }
      if (p && typeof p === 'object') {
        delete p[parts[i - 1]]
      }
    }
  }
}

const dryRun = process.argv.includes('--dry-run')

let totalDeleted = 0
for (const locale of LOCALES) {
  const filePath = path.join(I18N_DIR, `${locale}.json`)
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ 跳过(文件不存在): ${filePath}`)
    continue
  }
  const raw = fs.readFileSync(filePath, 'utf8')
  const obj = JSON.parse(raw)
  let deleted = 0
  for (const k of KEYS_TO_DELETE) {
    if (deleteKey(obj, k)) {
      deleted++
      pruneEmptyParents(obj, k)
    }
  }
  if (deleted > 0) {
    if (!dryRun) {
      fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8')
    }
    console.log(`[${locale}] 删除 ${deleted} 个孤儿 key${dryRun ? ' (dry-run)' : ''}`)
    totalDeleted += deleted
  } else {
    console.log(`[${locale}] 无需删除`)
  }
}
console.log(`\n${dryRun ? '[dry-run] ' : ''}总计删除 ${totalDeleted} 个 key (${KEYS_TO_DELETE.length} × ${LOCALES.length} = ${KEYS_TO_DELETE.length * LOCALES.length} 期望值)`)
