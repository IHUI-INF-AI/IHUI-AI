#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * 守门脚本批量执行器。
 *
 * 接收配置数组,单进程顺序执行所有检查,输出汇总。
 * 将 pre-commit 中 38 个独立 `node scripts/xxx.mjs` 调用合并为单进程批量执行,
 * 降低 commit 耗时,提供统一汇总输出。
 *
 * CLI 用法:
 *   node scripts/guardian-runner.mjs [--staged] [--timing] [--help]
 *
 *   --staged  传递 --staged 给所有脚本(pre-commit 模式)
 *   --timing  打印每个检查的耗时
 *   --help    打印帮助和检查清单
 *
 * 检查模式:
 *   blocking  失败 → 立即 exit(1),阻塞 commit
 *   warn      失败 → 打印警告,继续执行(不阻塞 commit)
 *   info      始终继续,只打印信息
 */
import { execSync } from 'node:child_process'

// === 颜色 ===
const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

// === 检查配置(38 项,顺序与原 pre-commit 一致) ===

const checks = [
  // --- blocking (24 项) ---
  {
    id: '1',
    label: '🔐 API key 泄露',
    script: 'check-api-key-leak.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '2',
    label: '🌐 i18n 键完整性',
    script: 'check-i18n-keys.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '2b',
    label: '🔍 zh-TW 简体字残留',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['zh-TW'],
    mode: 'blocking',
  },
  {
    id: '2c',
    label: '🔍 ko.json 中文残留',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['ko'],
    mode: 'blocking',
  },
  {
    id: '2e',
    label: '🔍 en.json 破碎英文',
    script: 'check-i18n-broken-en.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '2f-web',
    label: '🌐 i18n AI 翻译流水线(blocking)',
    script: 'i18n-diff.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 zh-CN.json 有改动但 i18n pending 非空,请先跑翻译流水线:',
      '     1. node scripts/i18n-diff.mjs          (检测差异,生成 pending 清单)',
      '     2. AI agent 翻译 → .trae-cn/tmp/i18n-translations.json',
      '     3. node scripts/i18n-apply.mjs         (应用翻译)',
      '     4. node scripts/check-i18n-keys.mjs    (验证 parity)',
      '     5. git add apps/web/messages/{en,ja,ko,zh-TW}.json 重新 commit',
      '',
    ].join('\n'),
  },
  {
    id: '2f-miniapp-taro',
    label: '🌐 [miniapp-taro] i18n AI 翻译流水线(blocking)',
    script: 'i18n-diff.mjs',
    args: ['--target=miniapp-taro'],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 miniapp-taro zh-CN.ts 有改动但 i18n pending 非空,请先跑翻译流水线:',
      '     1. node scripts/i18n-diff.mjs --target=miniapp-taro  (检测差异,生成 pending 清单)',
      '     2. AI agent 翻译 → .trae-cn/tmp/i18n-translations.json',
      '     3. node scripts/i18n-apply.mjs --target=miniapp-taro  (应用翻译)',
      '     4. node scripts/i18n-diff.mjs --target=miniapp-taro   (复验 parity,应无 pending)',
      '     5. git add apps/miniapp-taro/src/i18n/{en,ja,ko,zh-TW}.ts 重新 commit',
      '',
    ].join('\n'),
  },
  {
    id: '3',
    label: '🗄️ schema drift',
    script: 'check-db-schema-drift.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '4',
    label: '📦 packages 陈旧 dist',
    script: 'check-stale-dist.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '4b',
    label: '🔤 dist UTF-8 BOM',
    script: 'check-dist-encoding.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '4c',
    label: '🔤 api-client UTF-8 完整性',
    script: 'check-api-client-utf8.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '6',
    label: '🛡️ skipResponseSanitization',
    script: 'check-sanitizer-bypass.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '7',
    label: '📦 依赖碎片化',
    script: 'check-dedupe.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '8',
    label: '🔗 前端↔后端路由一致性',
    script: 'check-api-routes.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '11',
    label: '⭕ 容器圆角违规',
    script: 'check-rounded-full.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '12',
    label: '📋 交付报告一致性',
    script: 'check-delivery-report-consistency.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '13c',
    label: '🗂️  PROJECT_PLAN.md 已完成任务防误删',
    script: 'check-project-plan-archive.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '15',
    label: '📊 迁移完整性(7 大类 29 子项)',
    script: 'check-api-migration-completeness.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '17',
    label: '🎨 CSS 颜色 token 嵌套',
    script: 'check-input-border-var.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '18',
    label: '🖱️  原生 title tooltip 违规',
    script: 'check-native-title-tooltip.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '20',
    label: '🎯 Tailwind class 冲突',
    script: 'check-tailwind-class-conflict.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '24a',
    label: '📏 侧边栏宽度一致性',
    script: 'check-sidebar-width-consistency.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '25',
    label: '🧹 项目外路径违规(blocking)',
    script: 'check-workspace-hygiene.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '26',
    label: '🛡️  项目父目录污染巡查(blocking)',
    script: 'check-parent-pollution.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '27',
    label: '🛡️  z-index 层叠防护(防 TRAE 注入 + 遮罩 fade-in 回归)',
    script: 'check-z-index-guard.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '28',
    label: '🛡️  全屏遮罩 z-index 层级(防 fixed inset-0 + z-50 复发)',
    script: 'check-overlay-zindex.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 fixed inset-0 全屏遮罩用了 z-50/z-40/z-30 等低数字 Tailwind 类(值 < 100),',
      '     低于 AISidePanel 的 z-sticky=990,会被压在下面 = AI 面板露在遮罩之上。',
      '     修复:把 z-50 改为 z-modal(=2000, 引用 --z-modal CSS 变量)。',
      '     透明点击捕获层(无 bg-black)不在本守门范围。',
      '',
    ].join('\n'),
  },
  {
    id: '29',
    label: '🚀 Push 同步兜底(防"commit 后忘记 push"复发,AGENTS.md §21 第三道防线)',
    script: 'check-push-sync.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 本地有未 push 的 commit,本次 commit 已阻止。',
      '     post-commit 钩子(git-push-guard.mjs)本应自动 push,但可能因以下原因失败:',
      '       - HUSKY_SKIP_PUSH=1 跳过 / push 网络失败 / 凭据失效',
      '       - agent 用 --no-verify 跳过所有钩子',
      '       - pre-push typecheck 阻塞 / RunCommand 工具失联',
      '',
      '  修复方法(任选其一):',
      '     ① 自动 push: node scripts/git-push-guard.mjs',
      '     ② 手动 push: git push origin main',
      '     ③ 紧急跳过(不推荐): HUSKY_SKIP_PUSH_SYNC=1 git commit ...',
      '',
    ].join('\n'),
  },
  {
    id: '30',
    label: '🛡️ i18n 文件完整性(防 prettier 截断事故复发)',
    script: 'validate-i18n-integrity.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 staged 的 i18n JSON 文件行数异常减少(>50% 且 >100 行),',
      '     通常是 lint-staged 的 prettier --write 解析大 JSON 失败导致截断事故。',
      '     修复:git restore --staged --worktree <file> 后重新编辑/格式化。',
      '',
    ].join('\n'),
  },

  // --- warn (11 项) ---
  {
    id: '2d',
    label: '🔍 ja.json 中文残留(warn-only)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['ja'],
    mode: 'warn',
  },
  {
    id: '2f-ext',
    label: '🌐 [extension] i18n 键完整性(warn-only)',
    script: 'check-i18n-keys.mjs',
    args: ['--target=extension'],
    mode: 'warn',
  },
  {
    id: '2f-shared',
    label: '🌐 [shared] i18n 键完整性(blocking,零变更验证通过)',
    script: 'check-i18n-keys.mjs',
    args: ['--target=shared'],
    mode: 'blocking',
  },
  {
    id: '2g-ext',
    label: '🔍 [extension] zh-TW 简体字残留(warn-only)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['zh-TW', '--target=extension'],
    mode: 'warn',
  },
  {
    id: '2h-ext',
    label: '🔍 [extension] ko.json 中文残留(warn-only)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['ko', '--target=extension'],
    mode: 'warn',
  },
  {
    id: '2i-ext',
    label: '🔍 [extension] en.json 破碎英文(warn-only)',
    script: 'check-i18n-broken-en.mjs',
    args: ['--target=extension'],
    mode: 'warn',
  },
  {
    id: '9',
    label: '🔍 safeParse 静默忽略(warn-only)',
    script: 'check-safe-parse.mjs',
    args: [],
    mode: 'warn',
  },
  {
    id: '13b',
    label: '📐 PROJECT_PLAN.md 体积(warn-only)',
    script: 'check-project-plan-size.mjs',
    args: [],
    mode: 'warn',
  },
  {
    id: '19',
    label: '⚠️  staged 污染预警(warn-only)',
    script: 'check-staged-pollution.mjs',
    args: [],
    mode: 'warn',
  },
  {
    id: '21',
    label: '🌐 多端同步开发守门(warn-only)',
    script: 'check-multi-end-sync.mjs',
    args: [],
    mode: 'warn',
  },
  {
    id: '22',
    label: '📖 README 同步守门(warn-only)',
    script: 'check-readme-sync.mjs',
    args: [],
    mode: 'warn',
  },
  {
    id: '24b',
    label: '🔌 端口注册表守门(warn-only)',
    script: 'check-port-registry.mjs',
    args: [],
    mode: 'warn',
  },

  // --- info (2 项) ---
  {
    id: '10',
    label: '📋 OpenAPI spec(informational)',
    script: 'openapi-check.mjs',
    args: [],
    mode: 'info',
  },
  {
    id: '23',
    label: '📋 staged 文件清单(info)',
    script: 'check-staged-files.mjs',
    args: [],
    mode: 'info',
  },
]

// === CLI 解析 ===

const cliArgs = process.argv.slice(2)
const passStaged = cliArgs.includes('--staged')
const showTiming = cliArgs.includes('--timing')
const showHelp = cliArgs.includes('--help') || cliArgs.includes('-h')

// === Help ===

if (showHelp) {
  const blocking = checks.filter((c) => c.mode === 'blocking')
  const warn = checks.filter((c) => c.mode === 'warn')
  const info = checks.filter((c) => c.mode === 'info')
  console.log(`
guardian-runner.mjs — 守门脚本批量执行器

用法:
  node scripts/guardian-runner.mjs [--staged] [--timing] [--help]

选项:
  --staged   传递 --staged 给所有脚本(pre-commit 模式)
  --timing   打印每个检查的耗时
  --help     打印此帮助

检查清单(${checks.length} 项):
  blocking (${blocking.length} 项): ${blocking.map((c) => c.id).join(', ')}
  warn     (${warn.length} 项): ${warn.map((c) => c.id).join(', ')}
  info     (${info.length} 项): ${info.map((c) => c.id).join(', ')}

执行逻辑:
  blocking 失败 → 立即 exit(1),阻塞 commit
  warn     失败 → 打印警告,继续执行
  info     →    始终继续,只打印信息
`)
  process.exit(0)
}

// === 执行 ===

let passed = 0
let warned = 0
let failed = 0
const startTime = Date.now()

for (const check of checks) {
  const cmdArgs = [...check.args]
  if (passStaged) cmdArgs.push('--staged')
  const cmd = `node scripts/${check.script}${cmdArgs.length > 0 ? ' ' + cmdArgs.join(' ') : ''}`

  console.log(`[${check.id}] ${check.label}...`)
  const checkStart = Date.now()

  try {
    execSync(cmd, { stdio: 'inherit', cwd: process.cwd() })
    passed++
    if (showTiming) {
      console.log(`  ${C.dim}⏱  ${Date.now() - checkStart}ms${C.reset}`)
    }
  } catch {
    const elapsed = Date.now() - checkStart
    if (check.mode === 'blocking') {
      failed++
      if (check.onFailHint) {
        console.log(check.onFailHint)
      }
      console.error(`${C.red}❌ [${check.id}] ${check.label} 失败,提交已阻止${C.reset}`)
      // 打印汇总后退出
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
      console.error('')
      console.error(`${C.bold}🛡️ 守门脚本批量检查汇总${C.reset}`)
      console.error(`  总检查数: ${passed + warned + failed + (checks.length - passed - warned - failed)}`)
      console.error(`  ${C.green}通过: ${passed}${C.reset}`)
      console.error(`  ${C.yellow}警告: ${warned}${C.reset}`)
      console.error(`  ${C.red}失败: ${failed}${C.reset}`)
      console.error(`  总耗时: ${totalTime}s`)
      process.exit(1)
    } else if (check.mode === 'warn') {
      warned++
      console.warn(`${C.yellow}⚠️ [${check.id}] ${check.label} 失败 (warn-only,不阻塞 commit)${C.reset}`)
      if (showTiming) {
        console.log(`  ${C.dim}⏱  ${elapsed}ms${C.reset}`)
      }
    } else {
      // info 模式:失败不计数,视为通过
      passed++
      if (showTiming) {
        console.log(`  ${C.dim}⏱  ${elapsed}ms${C.reset}`)
      }
    }
  }
}

// === 汇总 ===

const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
console.log('')
console.log(`${C.bold}🛡️ 守门脚本批量检查汇总${C.reset}`)
console.log(`  总检查数: ${checks.length}`)
console.log(`  ${C.green}通过: ${passed}${C.reset}`)
console.log(`  ${C.yellow}警告: ${warned}${C.reset}`)
console.log(`  ${C.red}失败: ${failed}${C.reset}`)
console.log(`  总耗时: ${totalTime}s`)

process.exit(0)
