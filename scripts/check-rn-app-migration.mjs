#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * mobile-rn screen 迁移完整性守门 (blocking,2026-07-29 立)
 *
 * 触发背景:
 *   P3-3.3 "独立 screen 实现清零" 目标完成,153 个 .tsx 中 151 个迁移到 @ihui/rn-app
 *   共享层,仅 2 个豁免(DebugScreen/DevEnterScreen)。但当前依赖手动扫描,
 *   后续新增 screen 若漏迁移到共享层,会导致 mobile-rn 独立实现回升、维护成本系数恶化。
 *
 * 检测逻辑:
 *   扫描 apps/mobile-rn/src/screens/*.tsx,对每个文件检查是否 import from '@ihui/rn-app'。
 *   未导入且不在白名单的 → blocking 阻塞 commit。
 *
 * 白名单(豁免屏,允许独立实现):
 *   - DebugScreen.tsx        — 开发调试屏(清缓存/清存储/复制日志)
 *   - DevEnterScreen.tsx     — 开发者入驻申请表单(RN 端独占,字段稳定)
 *   - profileMenuData.ts     — 数据文件(非 screen 组件)
 *   - profileContentTypes.ts — 数据文件(非 screen 组件,导出 ProfileScreen 4 Tab 内容类型定义)
 *   - SharedDemoScreen.tsx   — 共享组件集成验证页(本身用于展示 @ihui/rn-app 组件)
 *
 * CLI 用法:
 *   node scripts/check-rn-app-migration.mjs [--staged] [--help]
 *
 *   --staged   仅检查 staged 的 mobile-rn screen 文件(pre-commit 模式)
 *   --help     打印帮助
 *
 * 退出码:
 *   0 — 所有非豁免 screen 已迁移到 @ihui/rn-app(或无 staged 文件)
 *   1 — 发现未迁移且不在白名单的 screen(阻塞 commit)
 *
 * 集成位置: guardian-runner.mjs pre-commit 第 39 项(blocking)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = process.cwd()
const SCREENS_DIR = join(ROOT, 'apps', 'mobile-rn', 'src', 'screens')

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

/**
 * 白名单:允许独立实现的 RN 独占 screen 文件名。
 * 新增登记需在此处附理由注释,严格审批。
 */
const WHITELIST = new Set([
  'DebugScreen.tsx', // 开发调试屏:平台信息展示 + 清缓存/清存储/复制日志,RN 端独占工具
  'DevEnterScreen.tsx', // 开发者入驻申请表单:RN 端独占,字段稳定,无跨端需求
  'SharedDemoScreen.tsx', // 共享组件集成验证页:本身用于展示 @ihui/rn-app 组件
  'profileMenuData.ts', // 数据文件:非 screen 组件,导出菜单配置数组
  'profileContentTypes.ts', // 数据文件:非 screen 组件,导出 ProfileScreen 4 Tab 内容类型定义
  // ── RN 独占 screen(无跨端需求,深度依赖 RN 特定 API/组件) ──
  'AiAssistantN8nScreen.tsx', // N8n 工作流 AI 助手:streamChat SSE + VoiceInput + ModelConfigDialog + Drawer 历史对话,RN 端独占流式对话交互
  'CourseScreen.tsx', // 课程 Tab 页:CourseCarousel/PopularCourses 等 RN 专属组件 + getStudyStatistics 数据流,Web/Miniapp 有独立实现
  'PlazaScreen.tsx', // AI 需求广场:双列卡片 + 状态 chips + 悬浮发布按钮 + Drawer 侧滑,RN 端独占交互模式
  'SquareScreen.tsx', // AI 资讯页:FlatList 资讯流 + SingleTypeBar 分类 + 返回顶部 + Drawer,RN 端独占资讯阅读体验
  'StudyIndexScreen.tsx', // AI 视频页:三态切换(index/model/study) + TipBanner 滚动 + ModelList 预览 + FloatingActionButton,RN 端独占视频浏览
  'StudyPublishScreen.tsx', // 课程发布页:expo-image-picker 选图/选视频 + VideoPlayer 预览 + 双态表单(group/video),RN 端独占发布能力
])

/** 检查文件内容是否 import from '@ihui/rn-app' */
function hasRnAppImport(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8')
    // 匹配 import { ... } from '@ihui/rn-app' 或 import ... from '@ihui/rn-app'
    // 允许单引号/双引号,允许 @ihui/rn-app 后跟 /xxx 子路径(子路径也算迁移)
    return /from\s+['"]@ihui\/rn-app(\/[^'"]+)?['"]/.test(content)
  } catch {
    // 文件读取失败(可能已删除),视为已迁移避免误报
    return true
  }
}

/** 获取 screens 目录下所有 .tsx/.ts 文件名 */
function listScreenFiles() {
  try {
    const stat = statSync(SCREENS_DIR)
    if (!stat.isDirectory()) return []
    return readdirSync(SCREENS_DIR).filter(
      (f) => f.endsWith('.tsx') || f.endsWith('.ts'),
    )
  } catch {
    // screens 目录不存在(可能未初始化),跳过
    return []
  }
}

/** 获取 staged 中 apps/mobile-rn/src/screens/ 下的文件名 */
function getStagedScreenFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      encoding: 'utf8',
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return output
      .split('\n')
      .filter(Boolean)
      .map((f) => f.replace(/\\/g, '/'))
      .filter((f) => f.startsWith('apps/mobile-rn/src/screens/'))
      .map((f) => f.split('/').pop())
  } catch {
    return []
  }
}

function main() {
  const cliArgs = process.argv.slice(2)
  const stagedOnly = cliArgs.includes('--staged')
  const showHelp = cliArgs.includes('--help') || cliArgs.includes('-h')

  if (showHelp) {
    console.log(`
check-rn-app-migration.mjs — mobile-rn screen 迁移完整性守门

用法:
  node scripts/check-rn-app-migration.mjs [--staged] [--help]

选项:
  --staged   仅检查 staged 的 mobile-rn screen 文件(pre-commit 模式)
  --help     打印此帮助

检测逻辑:
  扫描 apps/mobile-rn/src/screens/*.tsx,检查是否 import from '@ihui/rn-app'。
  未导入且不在白名单的 → exit 1 阻塞 commit。

白名单(${WHITELIST.size} 项):
  ${Array.from(WHITELIST).map((f) => `  - ${f}`).join('\n')}

退出码:
  0 — 所有非豁免 screen 已迁移(或无 staged 文件)
  1 — 发现未迁移且不在白名单的 screen

集成位置: guardian-runner.mjs pre-commit 第 39 项(blocking)
`)
    process.exit(0)
  }

  // 决定扫描范围:staged 模式只查 staged 文件,全量模式查整个 screens 目录
  let filesToCheck
  if (stagedOnly) {
    filesToCheck = getStagedScreenFiles()
    if (filesToCheck.length === 0) {
      console.log(`${C.dim}⏭  mobile-rn 迁移守门(无 staged screen 文件,跳过)${C.reset}`)
      process.exit(0)
    }
  } else {
    filesToCheck = listScreenFiles()
    if (filesToCheck.length === 0) {
      console.log(`${C.dim}⏭  mobile-rn 迁移守门(screens 目录为空或不存在,跳过)${C.reset}`)
      process.exit(0)
    }
  }

  const violations = []
  for (const fileName of filesToCheck) {
    // 白名单跳过
    if (WHITELIST.has(fileName)) continue
    const fullPath = join(SCREENS_DIR, fileName)
    if (!hasRnAppImport(fullPath)) {
      violations.push(fileName)
    }
  }

  if (violations.length === 0) {
    const scope = stagedOnly ? `staged ${filesToCheck.length} 个` : `全量 ${filesToCheck.length} 个`
    console.log(
      `${C.green}✓ mobile-rn 迁移守门(${scope} screen 文件均已 import @ihui/rn-app)${C.reset}`,
    )
    process.exit(0)
  }

  // 发现违规
  console.log('')
  console.log(
    `${C.red}${C.bold}❌ mobile-rn 迁移守门:发现 ${violations.length} 个未迁移 screen${C.reset}`,
  )
  console.log(
    `${C.dim}依据: P3-3.3 "独立 screen 实现清零" 目标 + AGENTS.md §9 多端同步开发强制规则${C.reset}`,
  )
  console.log('')
  console.log(`${C.red}未迁移文件(未 import from '@ihui/rn-app',也不在白名单):${C.reset}`)
  violations.forEach((f) => console.log(`  ${C.red}- ${f}${C.reset}`))
  console.log('')
  console.log(`${C.bold}当前白名单(${WHITELIST.size} 项,允许独立实现):${C.reset}`)
  Array.from(WHITELIST).forEach((f) => console.log(`  ${C.dim}- ${f}${C.reset}`))
  console.log('')
  console.log(`${C.bold}修复建议(二选一):${C.reset}`)
  console.log(
    `  ${C.magenta}A.${C.reset} ${C.dim}迁移该 screen 到共享层:${C.reset}`,
  )
  console.log(`    ${C.cyan}1. 在 packages/app/src/features/<feature>/<Name>Screen.tsx 创建共享组件${C.reset}`)
  console.log(`    ${C.cyan}2. 在 packages/app/src/index.ts 导出该组件${C.reset}`)
  console.log(`    ${C.cyan}3. 在 packages/types/src/app.ts 定义 ScreenProps 类型契约${C.reset}`)
  console.log(`    ${C.cyan}4. 改造 apps/mobile-rn/src/screens/<Name>Screen.tsx 为 wrapper(保留 hooks/API/导航,UI 注入共享组件)${C.reset}`)
  console.log(`    ${C.cyan}5. 补充 packages/i18n/messages/shared/*.json 5 语言 i18n keys${C.reset}`)
  console.log(`    ${C.cyan}6. 验证 pnpm --filter @ihui/mobile-rn typecheck && pnpm --filter @ihui/rn-app typecheck 全绿${C.reset}`)
  console.log(
    `  ${C.magenta}B.${C.reset} ${C.dim}若确属 RN 端独占(无跨端需求),在 scripts/check-rn-app-migration.mjs WHITELIST 中登记并附理由注释${C.reset}`,
  )
  console.log(`    ${C.cyan}注意: 白名单需严格审批,新增豁免会拉高维护成本系数${C.reset}`)
  console.log('')
  console.log(`${C.dim}参考: 已迁移 151 个 screen 共享组件位于 packages/app/src/features/${C.reset}`)
  console.log(`${C.dim}      wrapper 模式参考 apps/mobile-rn/src/screens/PaymentScreen.tsx${C.reset}`)
  console.log('')
  process.exit(1)
}

main()
