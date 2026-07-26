#!/usr/bin/env node
/**
 * desktop 端 i18n 死 key 审计器(2026-07-26 立)
 *
 * 桌面端是 Tauri/Rust 包装,无 JS i18n 代码,messages 目录也未建立。
 * 本脚本默认情况下会自动检测并跳过(端无独立 i18n)。
 *
 * 跳过条件(messagesPath 不存在 或 scanTargets 为空)任意满足即 exit 0,
 * 不输出报告,符合 4 端独立扫描器统一契约。
 *
 * 用法:
 *   node scripts/scan-desktop-dead-i18n-keys.mjs              # 默认跳过(端无 i18n),exit 0
 *   node scripts/scan-desktop-dead-i18n-keys.mjs --dry-run    # 同上,显式声明 dry-run
 *   node scripts/scan-desktop-dead-i18n-keys.mjs --out <path> # 自定义输出路径(若 messages 存在时生效)
 *
 * 输出:.trae-cn/tmp/i18n-desktop-dead-keys-YYYY-MM-DD.md(若 messages 存在)
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
  name: 'desktop',
  messagesPath: 'packages/i18n/messages/desktop/zh-CN.json', // 当前不存在,自动跳过
  scanTargets: [], // desktop 是 Rust 包装,无 JS 代码可扫描
  outputPattern: '.trae-cn/tmp/i18n-desktop-dead-keys-{date}.md',
  dryRun: args.dryRun,
  exitOnDead: args.exitOnDead,
  out: args.out,
})
process.exit(code)
