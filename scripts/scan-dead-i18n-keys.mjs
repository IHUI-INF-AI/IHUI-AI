#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * i18n 死 key 审计器 — web 兼容入口(2026-07-26 重构,2026-07-26 抽出公共函数到 _i18n-scan-helpers.mjs)
 *
 * 历史:本脚本是 web 端 baseline,2026-07-26 扩展支持 4 端(--target 切换);
 *      2026-07-26 进一步抽出公共逻辑到 _i18n-scan-helpers.mjs,4 端独立脚本
 *      (scan-extension-dead-i18n-keys.mjs 等)直接调用 helper,本入口保留
 *      --target 兼容(供旧调用方/测试用,推荐 4 端独立脚本)。
 *
 * 用法:
 *   node scripts/scan-dead-i18n-keys.mjs                              # 默认 target=web
 *   node scripts/scan-dead-i18n-keys.mjs --target miniapp-taro        # 指定目标端
 *   node scripts/scan-dead-i18n-keys.mjs --target web --dry-run       # 只打印统计
 *   node scripts/scan-dead-i18n-keys.mjs --out <path>                 # 自定义输出路径
 *   node scripts/scan-dead-i18n-keys.mjs --exit 1                     # 发现死 key 则 exit 1
 *   node scripts/scan-dead-i18n-keys.mjs --help                       # 帮助
 *
 * 支持目标端(2026-07-26 扩展,原仅 web):
 *   - web          (默认,代码扫描含 web/miniapp-taro/cli/mobile-rn,因 web i18n 跨端共享)
 *   - miniapp-taro (代码扫描仅 apps/miniapp-taro/src)
 *   - mobile-rn    (代码扫描仅 apps/mobile-rn/src)
 *   - extension    (代码扫描 apps/extension/{entrypoints,src,lib})
 *
 * 4 端独立脚本(2026-07-26 新增,推荐):
 *   node scripts/scan-extension-dead-i18n-keys.mjs
 *   node scripts/scan-mobile-rn-dead-i18n-keys.mjs
 *   node scripts/scan-desktop-dead-i18n-keys.mjs
 *   node scripts/scan-miniapp-taro-dead-i18n-keys.mjs
 *
 * 死 key 判定 / 翻译完整性 / 动态 key:见 _i18n-scan-helpers.mjs 注释
 */
import { main as runScan } from './_i18n-scan-helpers.mjs'

const TARGETS = {
  web: {
    localeDir: 'packages/i18n/messages/web',
    scanTargets: [
      'apps/web/src',
      'apps/web/app', // Next.js 15 App Router(2026-07-26 漏扫 bug 修复)
      'apps/miniapp-taro/src',
      'apps/cli/src',
      'apps/mobile-rn/src', // React Native 端,2026-07-26 mobile-rn 子任务补扫(与 web 共享部分 leaf key)
    ],
  },
  'miniapp-taro': {
    localeDir: 'packages/i18n/messages/miniapp-taro',
    scanTargets: ['apps/miniapp-taro/src'],
  },
  'mobile-rn': {
    localeDir: 'packages/i18n/messages/mobile-rn',
    scanTargets: ['apps/mobile-rn/src'],
  },
  extension: {
    localeDir: 'packages/i18n/messages/extension',
    scanTargets: ['apps/extension/entrypoints', 'apps/extension/src', 'apps/extension/lib'],
  },
}

const TODAY = new Date().toISOString().slice(0, 10)

function parseArgs(argv) {
  const args = { dryRun: false, exitOnDead: false, out: null, help: false, target: 'web' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') args.dryRun = true
    else if (a === '--exit') { args.exitOnDead = argv[++i] === '1' }
    else if (a === '--out') args.out = argv[++i]
    else if (a === '--target') {
      const t = argv[++i]
      if (!TARGETS[t]) {
        console.error(`[scan-dead-i18n-keys] 错误:未知 target '${t}',支持: ${Object.keys(TARGETS).join(', ')}`)
        process.exit(1)
      }
      args.target = t
    }
    else if (a === '--help' || a === '-h') args.help = true
  }
  return args
}

function printHelp() {
  console.log(`scan-dead-i18n-keys.mjs — i18n 死 key 审计器(web 兼容入口)

用法:
  node scripts/scan-dead-i18n-keys.mjs                              # 默认 target=web
  node scripts/scan-dead-i18n-keys.mjs --target miniapp-taro        # 指定目标端
  node scripts/scan-dead-i18n-keys.mjs --target web --dry-run       # 只打印统计
  node scripts/scan-dead-i18n-keys.mjs --out <path>                 # 自定义输出路径
  node scripts/scan-dead-i18n-keys.mjs --exit 1                     # 发现死 key 则 exit 1
  node scripts/scan-dead-i18n-keys.mjs --help                       # 帮助

支持 target:
  web          (默认,代码扫描含 web/miniapp-taro/cli/mobile-rn,因 web i18n 跨端共享)
  miniapp-taro (代码扫描仅 apps/miniapp-taro/src)
  mobile-rn    (代码扫描仅 apps/mobile-rn/src)
  extension    (代码扫描 apps/extension/{entrypoints,src,lib})

4 端独立脚本(2026-07-26 新增,推荐):
  node scripts/scan-extension-dead-i18n-keys.mjs
  node scripts/scan-mobile-rn-dead-i18n-keys.mjs
  node scripts/scan-desktop-dead-i18n-keys.mjs
  node scripts/scan-miniapp-taro-dead-i18n-keys.mjs

输出:.trae-cn/tmp/i18n-dead-keys-${TODAY}-<target>.md(默认)
排除:node_modules / .next / dist / __tests__ / *.test.ts(x) / *.spec.ts(x) / .d.ts
`)
}

const args = parseArgs(process.argv.slice(2))
if (args.help) { printHelp(); process.exit(0) }

const targetCfg = TARGETS[args.target]
const outputPattern = args.target === 'web'
  ? `.trae-cn/tmp/i18n-dead-keys-${TODAY}.md`
  : `.trae-cn/tmp/i18n-dead-keys-${TODAY}-${args.target}.md`

const code = runScan({
  name: args.target,
  messagesPath: `${targetCfg.localeDir}/zh-CN.json`,
  scanTargets: targetCfg.scanTargets,
  outputPattern,
  dryRun: args.dryRun,
  exitOnDead: args.exitOnDead,
  out: args.out,
  scriptName: 'scan-dead-i18n-keys',
})
process.exit(code)
