#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * i18n 死 key 审计器 — 统一入口(2026-07-27 重构:5 端收敛为 --target 单脚本)
 *
 * 历史:原 5 份独立脚本(scan-{web,extension,miniapp-taro,mobile-rn,desktop}-dead-i18n-keys.mjs)
 *      逻辑高度相似(各端配置 + 调用 _i18n-scan-helpers.mjs 的 main()),
 *      2026-07-27 收敛为本统一入口,5 端配置内聚为 TARGETS 字典;
 *      5 个旧脚本改为 thin wrapper(spawnSync 委托本入口 --target=<端>),向后兼容。
 *
 * 用法:
 *   node scripts/scan-dead-i18n-keys.mjs                              # 默认 target=web
 *   node scripts/scan-dead-i18n-keys.mjs --target miniapp-taro        # 指定目标端
 *   node scripts/scan-dead-i18n-keys.mjs --target web --check         # 烟测模式(= --dry-run,不写报告)
 *   node scripts/scan-dead-i18n-keys.mjs --target web --dry-run       # 只打印统计
 *   node scripts/scan-dead-i18n-keys.mjs --out <path>                 # 自定义输出路径
 *   node scripts/scan-dead-i18n-keys.mjs --exit 1                     # 发现死 key 则 exit 1
 *   node scripts/scan-dead-i18n-keys.mjs --help                       # 帮助
 *
 * 支持目标端(2026-07-27 5 端收敛):
 *   - web          (默认,代码扫描含 web/miniapp-taro/cli/mobile-rn,因 web i18n 跨端共享)
 *   - extension    (代码扫描 apps/extension/{entrypoints,src,lib})
 *   - miniapp-taro (代码扫描仅 apps/miniapp-taro/src)
 *   - mobile-rn    (代码扫描仅 apps/mobile-rn/src)
 *   - cli          (Node.js CLI,代码扫描 apps/cli/src)
 *   - desktop      (Rust/Tauri 包装,无 JS 代码,messages 目录未建立,自动跳过 exit 0)
 *
 * 5 端 thin wrapper(向后兼容,委托本入口):
 *   node scripts/scan-web-dead-i18n-keys.mjs          # → --target=web
 *   node scripts/scan-extension-dead-i18n-keys.mjs    # → --target=extension
 *   node scripts/scan-miniapp-taro-dead-i18n-keys.mjs # → --target=miniapp-taro
 *   node scripts/scan-mobile-rn-dead-i18n-keys.mjs    # → --target=mobile-rn
  # cli 无 thin wrapper,直接用 --target=cli
 *   node scripts/scan-desktop-dead-i18n-keys.mjs      # → --target=desktop
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
  cli: {
    localeDir: 'packages/i18n/messages/cli',
    scanTargets: ['apps/cli/src'],
  },
  extension: {
    localeDir: 'packages/i18n/messages/extension',
    scanTargets: ['apps/extension/entrypoints', 'apps/extension/src', 'apps/extension/lib'],
  },
  desktop: {
    localeDir: 'packages/i18n/messages/desktop',
    scanTargets: [], // desktop 是 Rust/Tauri 包装,无 JS 代码可扫描;messages 目录未建立,自动跳过 exit 0
  },
}

const TODAY = new Date().toISOString().slice(0, 10)

function parseArgs(argv) {
  const args = { dryRun: false, exitOnDead: false, out: null, help: false, target: 'web' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    // --check: 烟测模式(= --dry-run),验证脚本能跑,不写报告,exit 0(除非真实错误如 messages 损坏)
    if (a === '--dry-run' || a === '--check') args.dryRun = true
    else if (a === '--exit') { args.exitOnDead = argv[++i] === '1' }
    else if (a === '--out') args.out = argv[++i]
    else if (a === '--target' || a.startsWith('--target=')) {
      // 同时支持 --target web(空格)和 --target=web(等号)两种形式
      const t = a.startsWith('--target=') ? a.slice('--target='.length) : argv[++i]
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
  console.log(`scan-dead-i18n-keys.mjs — i18n 死 key 审计器(统一入口,5 端收敛)

用法:
  node scripts/scan-dead-i18n-keys.mjs                              # 默认 target=web
  node scripts/scan-dead-i18n-keys.mjs --target miniapp-taro        # 指定目标端
  node scripts/scan-dead-i18n-keys.mjs --target web --check         # 烟测模式(= --dry-run,不写报告)
  node scripts/scan-dead-i18n-keys.mjs --target web --dry-run       # 只打印统计
  node scripts/scan-dead-i18n-keys.mjs --out <path>                 # 自定义输出路径
  node scripts/scan-dead-i18n-keys.mjs --exit 1                     # 发现死 key 则 exit 1
  node scripts/scan-dead-i18n-keys.mjs --help                       # 帮助

支持 target(5 端):
  web          (默认,代码扫描含 web/miniapp-taro/mobile-rn,因 web i18n 跨端共享)
  cli          (代码扫描 apps/cli/src)
  extension    (代码扫描 apps/extension/{entrypoints,src,lib})
  miniapp-taro (代码扫描仅 apps/miniapp-taro/src)
  mobile-rn    (代码扫描仅 apps/mobile-rn/src)
  desktop      (Rust/Tauri 包装,无 JS 代码,messages 未建立,自动跳过 exit 0)

5 端 thin wrapper(向后兼容,委托本入口 --target=<端>):
  node scripts/scan-web-dead-i18n-keys.mjs          # → --target=web
  node scripts/scan-extension-dead-i18n-keys.mjs    # → --target=extension
  node scripts/scan-miniapp-taro-dead-i18n-keys.mjs # → --target=miniapp-taro
  node scripts/scan-mobile-rn-dead-i18n-keys.mjs    # → --target=mobile-rn
  node scripts/scan-desktop-dead-i18n-keys.mjs      # → --target=desktop

输出:.trae-cn/tmp/i18n-dead-keys-${TODAY}-<target>.md(默认,web 无 target 后缀)
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
