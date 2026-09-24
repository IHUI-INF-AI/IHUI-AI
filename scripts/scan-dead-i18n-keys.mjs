#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


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
 *
 * 契约键出口:scripts/i18n-contract-keys.json(跨端词包契约键 / 被测试钉住的形状键)。
 * 静态扫描只能看见"本端有没有人取这个词",看不见"这个词是不是契约的一部分";
 * 没有这个出口,唯一的出路就是把 --target all 缩回单端 —— 那等于把其余四端的红点重新藏起来。
 * 逐条依据必须能在 HEAD 里核验(文件存在 / 行号在范围内 / 该行含被引用的标识符),不成立即判红。
 */
import {
  main as runScan,
  loadContractFile,
  unknownContractTargets,
  CONTRACT_FILE_REL,
} from './_i18n-scan-helpers.mjs'

const TARGETS = {
  web: {
    localeDir: 'packages/i18n/messages/web',
    scanTargets: [
      'apps/web/src',
      'apps/web/app', // Next.js 15 App Router(2026-07-26 漏扫 bug 修复)
      'apps/miniapp-taro/src',
      'apps/mobile-rn/src', // React Native 端,2026-07-26 mobile-rn 子任务补扫(与 web 共享部分 leaf key)
      'packages/app/src', // @ihui/rn-app 共享屏,web/mobile-rn/miniapp-taro 共用 messages/web(2026-08-20 修假阳性 bug: 此前漏扫导致 865 误报)
    ],
  },
  'miniapp-taro': {
    localeDir: 'packages/i18n/messages/miniapp-taro',
    // packages/shared/src = @ihui/shared 的 useLoginForm/useRegisterForm 被 miniapp-taro
    // login/register 页消费,其内部 setError('auth.xxx') 返回的 key 由本端 t() 渲染,
    // 2026-09-12 修复跨包引用漏检(auth.ssoFailed 等误判为死 key的同类模式)
    scanTargets: ['apps/miniapp-taro/src', 'packages/shared/src'],
  },
  'mobile-rn': {
    localeDir: 'packages/i18n/messages/mobile-rn',
    // packages/app = @ihui/rn-app 共享屏,由 mobile-rn wrapper 传入本端 t 消费其 key
    // packages/shared/src = @ihui/shared 的 useLoginForm/useRegisterForm 被 mobile-rn
    // LoginScreen/RegisterScreen 消费(2026-09-12 修复跨包引用漏检:
    // setError('auth.ssoFailed') 的 key 在 shared 包内,原 scanTargets 不含它,被误判为死 key)
    scanTargets: ['apps/mobile-rn/src', 'packages/app/src', 'packages/shared/src'],
  },
  cli: {
    localeDir: 'packages/i18n/messages/cli',
    // 2026-09-24 补 `packages/shared/src/chat`:与上面 extension 同一先例同形 —— cli 的等待语只是
    // `apps/cli/src/commands/waiting-text.ts` 把取词函数 t 注入进 shared 的
    // `resolveWaitingText()`,真正拼键(`waiting.<象限>.<阶段>.<下标>` 与 `waiting.vividTail`)
    // 发生在 packages/shared/src/chat/waiting-pool.ts;端 scanTargets 不含它 ⇒ 76 枚 waiting.* 恒被判死。
    // 窄口径:只加 chat,不加 packages/app(照 extension 那条实测教训)。
    scanTargets: ['apps/cli/src', 'packages/shared/src/chat'],
  },
  extension: {
    localeDir: 'packages/i18n/messages/extension',
    // 2026-09-23 补 `packages/shared/src/chat`:该目录下的等待语池(waiting-pool.ts)与权限档词表
    // (permission-tier.ts)按"跨端共享"设计被 extension 真实消费(MessageContent.tsx:682-683 等),
    // 但端 scanTargets 不含它 ⇒ 76 枚 waiting.* + 10 枚 permissionTier.mode.* 恒被判死。
    // 与 2026-09-12 给 taro / mobile-rn 加 `packages/shared/src` 的同一先例同形(窄口径:只加 chat,
    // 不加 packages/app —— taro 票实测会把别端专属键倒灌成本端假 wire)。
    scanTargets: ['apps/extension/entrypoints', 'apps/extension/src', 'apps/extension/lib', 'packages/shared/src/chat'],
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
      // 'all' 是本轮补的:CI 与 check:all 原先只跑 web 一端 ⇒ 其余四端的红点无人执行
      // (实测 cli 的 76 枚 waiting.* 幻影死键恒红数日无人在意,正因没有一道入口跑它)。
      if (t !== 'all' && !TARGETS[t]) {
        console.error(`[scan-dead-i18n-keys] 错误:未知 target '${t}',支持: all, ${Object.keys(TARGETS).join(', ')}`)
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
  node scripts/scan-dead-i18n-keys.mjs --target all --exit 1        # 一次跑完所有有 JS 扫描面的端(推荐入口)
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

输出:.ihui-agent/tmp/i18n-dead-keys-${TODAY}-<target>.md(默认,web 无 target 后缀)
排除:node_modules / .next / dist / __tests__ / *.test.ts(x) / *.spec.ts(x) / .d.ts
契约键:${CONTRACT_FILE_REL}(按 target → key → { reason, evidence[] } 登记,依据逐条按 HEAD 核验)
`)
}

const args = parseArgs(process.argv.slice(2))
if (args.help) { printHelp(); process.exit(0) }

// 契约声明的 target 名必须真存在:拼错的端名不会被任何一次判定读到,
// 等于把一枚没有读者的豁免永久留在清单里(与守门 90「豁免项若已不存在同样算红」同取向)。
const contractFile = loadContractFile(process.cwd())
const bogusContractTargets = unknownContractTargets(contractFile.raw, Object.keys(TARGETS))
if (bogusContractTargets.length > 0) {
  console.error(
    `[scan-dead-i18n-keys] ❌ ${CONTRACT_FILE_REL} 登记了未知 target:${bogusContractTargets.join(', ')}` +
      `(可用:${Object.keys(TARGETS).join(', ')})`,
  )
  process.exit(1)
}

const names =
  args.target === 'all'
    ? Object.keys(TARGETS).filter((n) => TARGETS[n].scanTargets.length > 0)
    : [args.target]

if (args.target === 'all' && args.out) {
  console.log('[scan-dead-i18n-keys] --target all 下忽略 --out(各端各写自己的报告,否则会互相覆盖)')
}
const skipped = Object.keys(TARGETS).filter((n) => TARGETS[n].scanTargets.length === 0)
let worst = 0
const verdicts = []
for (const n of names) {
  const targetCfg = TARGETS[n]
  const outputPattern =
    n === 'web'
      ? `.ihui-agent/tmp/i18n-dead-keys-${TODAY}.md`
      : `.ihui-agent/tmp/i18n-dead-keys-${TODAY}-${n}.md`
  const code = runScan({
    name: n,
    messagesPath: `${targetCfg.localeDir}/zh-CN.json`,
    scanTargets: targetCfg.scanTargets,
    outputPattern,
    dryRun: args.dryRun,
    exitOnDead: args.exitOnDead,
    out: args.target === 'all' ? null : args.out,
    scriptName: 'scan-dead-i18n-keys',
  })
  verdicts.push(`${n}=${code === 0 ? 'ok' : `exit ${code}`}`)
  // 取最大值而不是"最后一次不等就覆盖":否则前一端 exit 1、后端 exit 0 会把红点吞成绿。
  worst = Math.max(worst, code)
}
if (args.target === 'all') {
  // 结论必须逐端可见:只报一个总 exit 会让"某一端根本没被扫"看起来像全绿
  console.log(`[scan-dead-i18n-keys] all → ${verdicts.join(' ')}`)
  if (skipped.length) console.log(`[scan-dead-i18n-keys] 无 JS 扫描面,未计入:${skipped.join(', ')}`)
}
process.exit(worst)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
