#!/usr/bin/env node
/**
 * mobile-rn 端 i18n 死 key 审计器(2026-07-26 立)
 *
 * 扫描 apps/mobile-rn/src 中 .ts/.tsx 静态 t('key') / useTranslations 引用,
 * 与 packages/i18n/messages/mobile-rn/zh-CN.json leaf key 对照,找出未引用的死 key。
 *
 * 用法:
 *   node scripts/scan-mobile-rn-dead-i18n-keys.mjs              # 默认扫描 + 写报告
 *   node scripts/scan-mobile-rn-dead-i18n-keys.mjs --dry-run    # 只打印统计,不写报告
 *   node scripts/scan-mobile-rn-dead-i18n-keys.mjs --out <path> # 自定义输出路径
 *   node scripts/scan-mobile-rn-dead-i18n-keys.mjs --exit 1    # 发现死 key 则 exit 1
 *
 * 输出:.trae-cn/tmp/i18n-mobile-rn-dead-keys-YYYY-MM-DD.md
 * 排除:node_modules / .next / dist / __tests__ / tests / *.test.ts(x) / *.spec.ts(x) / .d.ts
 *
 * 公共逻辑:scripts/_i18n-scan-helpers.mjs
 */
import { main as runScan } from './_i18n-scan-helpers.mjs'

function parseArgs(argv) {
  const args = { dryRun: false, exitOnDead: false, out: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') args.dryRun = true
    else if (a === '--exit') { args.exitOnDead = argv[++i] === '1' }
    else if (a === '--out') args.out = argv[++i]
  }
  return args
}

const args = parseArgs(process.argv.slice(2))
const code = runScan({
  name: 'mobile-rn',
  messagesPath: 'packages/i18n/messages/mobile-rn/zh-CN.json',
  scanTargets: ['apps/mobile-rn/src'],
  outputPattern: '.trae-cn/tmp/i18n-mobile-rn-dead-keys-{date}.md',
  dryRun: args.dryRun,
  exitOnDead: args.exitOnDead,
  out: args.out,
})
process.exit(code)
