#!/usr/bin/env node
/**
 * DESIGN.md 品牌设计契约守门 (2026-07-06 立)
 *
 * 目的: 保证项目根 DESIGN.md 存在且内容完整, 9 节结构齐全, 关键 token 值未被篡改,
 *       RULE 1「先问再做」+ Agent Prompt Guide 12 条硬指令存在。
 *
 * DESIGN.md 是全项目 UI 的「品牌设计契约」(Brand Design Contract), 遵循 Open Design
 * DESIGN.md 9 节规范 (awesome-claude-design schema)。整合了 project_memory.md 中散落
 * 的全部 UI 硬约束。详见 AGENTS.md 第 28 章「RULE 1 先问再做硬约束」。
 *
 * 用法:
 *   node scripts/check-design-md.mjs          # 全量检查 (默认)
 *   node scripts/check-design-md.mjs --staged # 仅当 DESIGN.md 在 staged 时才检查
 *   node scripts/check-design-md.mjs --all    # 同全量 (显式)
 *
 * 退出码:
 *   0 - 通过
 *   1 - DESIGN.md 缺失/章节不全/token 篡改/RULE 1 缺失/硬指令缺失
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(clientRoot, '..')
const designMdPath = path.join(projectRoot, 'DESIGN.md')

// --- 模式解析 ---
const args = process.argv.slice(2)
const stagedOnly = args.includes('--staged')
const allMode = args.includes('--all') || !stagedOnly

// --- staged 模式: 仅当 DESIGN.md 在 staged 时才检查 ---
function isStaged(filePath) {
  try {
    const rel = path.relative(projectRoot, filePath).replace(/\\/g, '/')
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: projectRoot,
      encoding: 'utf8',
    })
    return out.split('\n').map((l) => l.trim()).filter(Boolean).includes(rel)
  } catch {
    return false
  }
}

if (stagedOnly && !isStaged(designMdPath)) {
  console.log('[SKIP] DESIGN.md 未在 staged, 跳过 check-design-md')
  process.exit(0)
}

// --- 读取 DESIGN.md ---
if (!fs.existsSync(designMdPath)) {
  console.error(`[FAIL] DESIGN.md 不存在于项目根: ${designMdPath}`)
  console.error('       DESIGN.md 是品牌设计契约, 不可删除。详见 AGENTS.md 第 28 章。')
  process.exit(1)
}

const content = fs.readFileSync(designMdPath, 'utf8')
const errors = []

// --- 规则 1: 9 节标题齐全 ---
const REQUIRED_SECTIONS = [
  '## 1. Visual Theme & Atmosphere',
  '## 2. Color Palette & Roles',
  '## 3. Typography Rules',
  '## 4. Component Stylings',
  '## 5. Layout Principles',
  '## 6. Depth & Elevation',
  "## 7. Do's and Don'ts",
  '## 8. Responsive Behavior',
  '## 9. Agent Prompt Guide',
]

for (const section of REQUIRED_SECTIONS) {
  if (!content.includes(section)) {
    errors.push(`缺失章节: "${section}"`)
  }
}

// --- 规则 2: 关键 token 值未被篡改 (与 SCSS token 定义一致) ---
// 这些值必须与 _global-tokens.scss + _dark-mode-global.scss 保持一致
// 2026-07-06 移除 v27 #2e2e2e 期望 (项目实际仍是 v26 #171717, 详见 project_memory.md
// 侧边栏 v26 设计硬约束, AGENTS.md 第 24 章全局描边色统一硬约束)
const REQUIRED_TOKEN_VALUES = [
  { value: '#e9e9e9', desc: '浅色模式 v26 描边色 (--app-sidebar-border)' },
  { value: '#171717', desc: '暗色模式 v26 描边色 (--app-sidebar-border, 与 page bg #1a1a1a 差值仅 3 已知问题)' },
  { value: '8px', desc: '全站唯一圆角 (--global-border-radius)' },
  { value: '#e5eaf3', desc: '暗色模式主文字色 (--el-text-color-primary)' },
  { value: '#0d0d0d', desc: '暗色模式主背景 (--el-bg-color)' },
  { value: '#1a1a1a', desc: '暗色模式 hover 背景 (--el-bg-color-hover)' },
  { value: '#e6e8ed', desc: 'AI 浮窗浅色描边' },
  { value: '#3a3b3d', desc: 'AI 浮窗暗色描边' },
  { value: '#f7f8fa', desc: '浅色模式容器背景 (--el-bg-color)' },
  { value: 'HarmonyOS Sans SC', desc: '全站唯一中文字体' },
]

for (const { value, desc } of REQUIRED_TOKEN_VALUES) {
  if (!content.includes(value)) {
    errors.push(`关键 token 值缺失/被篡改: "${value}" (${desc})`)
  }
}

// --- 规则 3: RULE 1 章节存在 + 5 项方向锁定 ---
if (!content.includes('RULE 1')) {
  errors.push('缺失 RULE 1「先问再做」章节')
}
const RULE1_LOCK_ITEMS = [
  '改动范围',
  '模式',
  '影响的 token',
  '守门规则',
  '验证方式',
]
for (const item of RULE1_LOCK_ITEMS) {
  if (!content.includes(item)) {
    errors.push(`RULE 1 方向锁定缺失: "${item}"`)
  }
}

// --- 规则 4: Agent Prompt Guide 12 条硬指令关键词 ---
const HARD_INSTRUCTION_KEYWORDS = [
  '不要发明调色板外的色值',
  '暗色模式文字必须为浅色',
  '圆角必须用 token',
  '描边必须用 token',
  '禁止 box-shadow',
  '完全重启 dev server',
  '截图验证',
  'coreModules',
  '暗色模式是强制项',
  'authStore.isLoggedIn',
  '修改 token 后必须同步',
  '守门脚本反向测试',
]
let missingInstructions = 0
for (const kw of HARD_INSTRUCTION_KEYWORDS) {
  if (!content.includes(kw)) {
    errors.push(`Agent Prompt Guide 硬指令缺失: "${kw}"`)
    missingInstructions++
  }
}

// --- 规则 5: 反模式关键约束存在 (Do's and Don'ts) ---
const DONT_KEYWORDS = [
  '禁止胶囊圆角',
  '禁止纯黑边框',
  '禁止输入框蓝色发光边框',
  'v-if="true"',
  '禁止 chevron 箭头',
]
for (const kw of DONT_KEYWORDS) {
  if (!content.includes(kw)) {
    errors.push(`Do's and Don'ts 反模式缺失: "${kw}"`)
  }
}

// --- 规则 6: Open Design 兼容性声明 ---
if (!content.includes('Open Design')) {
  errors.push('缺失 Open Design 兼容性声明')
}

// --- 输出 ---
if (errors.length > 0) {
  console.error(`[FAIL] DESIGN.md 守门失败, ${errors.length} 项问题:`)
  for (const e of errors) {
    console.error(`  - ${e}`)
  }
  console.error('')
  console.error('DESIGN.md 是品牌设计契约, 修改时必须同步:')
  console.error('  - SCSS token 定义: _global-tokens.scss + _dark-mode-global.scss')
  console.error('  - AGENTS.md 第 28 章 RULE 1')
  console.error('  - project_memory.md')
  process.exit(1)
}

console.log(
  `[OK] DESIGN.md 品牌设计契约: 9 节齐全, ${REQUIRED_TOKEN_VALUES.length} 项关键 token 值一致, ` +
    `RULE 1 + ${HARD_INSTRUCTION_KEYWORDS.length} 条硬指令 + ${DONT_KEYWORDS.length} 项反模式齐`
)
