/**
 * 守门脚本: AI 世界自建侧栏布局硬约束 (2026-07-06 立, 升级 2026-07-06 v2)
 *
 * 背景:
 *   用户反馈 2 个 UI 问题:
 *     (1) "AI 世界的这个侧边栏怎么没有在右侧工作区左侧显示呢, 现在都挡住了 AI 对话框"
 *         - AiWorld.vue 通过 Teleport to body 渲染自建分类侧栏, 不在 .ai-side-panel 子树内,
 *           无法通过 CSS 变量继承获取 .ai-side-panel 的 --ai-panel-width,
 *           用 left: var(--sidebar-width) 时与 AI 面板重叠, 挡住 AI 对话框.
 *         - App.vue 把 --ai-panel-width 设到 .ai-side-panel 元素上, 作用域太窄, fixed 定位的
 *           AiWorld 侧栏读不到这个值.
 *     (2) "这个侧边栏的选中后的容器怎么有点偏右了呢 没有居中"
 *         - 旧实现用 `margin: 1px 4px` 给所有 nav-item 加左右 4px 边距, 但 nav-inner 是
 *           flex column 容器, 4px margin-right 在 content overflow 时被裁剪/忽略,
 *           导致所有矩形实际 R = inner R + 4px (向右溢出 4px). 选中态因无 padding-left
 *           缩进 (左 12px vs 子项 20px), 文字靠左, 蓝色背景矩形"过宽", 视觉上偏右.
 *         - AiWorld.vue 自身 scoped style 也定义了 .ai-world-page__nav-parent/item (无 margin),
 *           browser button 默认 2px margin 覆盖了我的 _sidebar-layout.scss 修复.
 *
 * 修复 (3 部分):
 *     (A) useAiPanel.ts 新增 watch(width) → documentElement.style.setProperty('--ai-panel-width', ...)
 *         把 --ai-panel-width 同步写入 :root, fixed 定位可继承.
 *         _sidebar-layout.scss 新增规则
 *           body:has(.app-layout):has(.ai-side-panel.is-open) .ai-world-page__nav {
 *             left: calc(var(--sidebar-current-width, var(--sidebar-width)) + var(--ai-panel-width, 400px));
 *           }
 *         关闭态保持 left: var(--sidebar-current-width), 紧贴全局边栏.
 *     (B) nav-inner 加 `padding: 0 4px` 缓冲; 所有 nav-item/parent 改 `margin: 1px 0`,
 *         矩形宽度 = inner_content_width, L=4, R=inner R, 在 inner 内完美居中.
 *         AiWorld.vue scoped style 也显式加 `margin: 1px 0`, 避免 browser button 默认
 *         2px margin 覆盖.
 *     (C) 独立折叠态 (2026-07-06 v3): 新增 useAiWorldNav composable 管理 isCollapsed 状态,
 *         同步到 body.ai-world-nav-collapsed class, _sidebar-layout.scss 用此 class
 *         切换 width 200→60 / 隐藏 nav-inner / 折叠按钮居中.
 *     (D) 全局 sidebar 同步 (2026-07-06 v4): AiWorld 侧栏 left 用
 *         var(--sidebar-current-width), 但原变量只在 .app-sidebar 元素上,
 *         Teleport 到 body 的 AiWorld 侧栏读不到. 在 useSidebar.ts 加
 *         watch → documentElement.style.setProperty('--sidebar-current-width', ...)
 *         把变量同步到 :root, 让 AiWorld 侧栏 left 跟随全局 sidebar 折叠 (60/136/拖拽值).
 *
 * 守门规则 (25 条):
 *   ── A 部分: AI 面板开启时侧栏右移到工作区左侧 (5 条) ──
 *   1. useAiPanel.ts 必须有 `document.documentElement.style.setProperty('--ai-panel-width'`
 *   2. _sidebar-layout.scss 必须含 `body:has(.app-layout):has(.ai-side-panel.is-open) .ai-world-page__nav`
 *   3. 该规则块必须含 `left: calc(var(--sidebar-current-width` (右移到工作区左侧, 跟随全局 sidebar 折叠)
 *   4. 该规则块必须含 `var(--ai-panel-width` (引用 useAiPanel 注入的宽度)
 *   5. useAiPanel.ts 同步 :root 时必须使用 'immediate: true'
 *   ── B 部分: 选中态矩形完美居中 (3 条) ──
 *   6. _sidebar-layout.scss 中 .ai-world-page__nav-inner 必须含 `padding: 0 4px` 缓冲
 *   7. _sidebar-layout.scss 中 .ai-world-page__nav-item/--sub/.ai-world-page__nav-parent 水平 margin 必须为 0
 *   8. AiWorld.vue scoped style 中 .ai-world-page__nav-parent 和 .ai-world-page__nav-item 必须显式 `margin: 1px 0`
 *   ── C 部分: 侧栏卡片化 + 弃用 primary 蓝高亮 (4 条) ──
 *   9. _sidebar-layout.scss 中所有 nav-item/--sub/parent --active 块不能使用 primary 蓝
 *   10. _sidebar-layout.scss 中 .ai-world-page__nav 块必须含 position: fixed + border-radius + box-shadow
 *   11. _sidebar-layout.scss 必须有 html.dark body:has(.app-layout) .ai-world-page__nav 暗色覆盖块
 *   12. AiWorld.vue scoped style 中不能定义 background-color: var(--el-color-primary)
 *   ── D 部分: 独立折叠态 (2026-07-06 v3 新增, 6 条) ──
 *   13. useAiWorldNav.ts 必须存在 (独立折叠状态管理 composable)
 *   14. AiWorld.vue 必须 import useAiWorldNav 并解构出 isCollapsed/toggle
 *   15. _sidebar-layout.scss 必须有 body.ai-world-nav-collapsed:has(.app-layout) 折叠态 width 切换规则 (200→60)
 *   16. _sidebar-layout.scss 必须有折叠态下 nav-inner 隐藏规则 (display: none)
 *   17. _sidebar-layout.scss 必须有 .ai-world-page__nav-collapse-btn 折叠按钮样式 (position: absolute, 24x24)
 *   18. _sidebar-layout.scss 的 :root 必须定义 --ai-world-nav-width CSS 变量 (默认 200px)
 *   ── E 部分: 全局 sidebar 宽度同步到 :root (2026-07-06 v4 新增, 3 条) ──
 *   19. useSidebar.ts 必须把 --sidebar-current-width 同步写入 documentElement (:root)
 *       (否则 AiWorld 侧栏用 var(--sidebar-current-width) 取不到值, 不跟随全局 sidebar 折叠)
 *   20. useSidebar.ts 同步 :root 时必须用 watch([isCollapsed, width], ...) (isCollapsed 单独不够,
 *       用户拖拽改变 width 时也要同步)
 *   21. _sidebar-layout.scss 的 .ai-world-page__nav left 必须用 var(--sidebar-current-width, var(--sidebar-width, 136px))
 *       而非 var(--sidebar-width) (后者写死 136px, 全局 sidebar 折叠时侧栏不左移)
 *   ── F 部分: 折叠态图标栏 (2026-07-06 v5 新增, 4 条) ──
 *   22. _sidebar-layout.scss 必须有 .ai-world-page__nav-collapsed 容器 (折叠态显示的图标栏)
 *   23. _sidebar-layout.scss 必须有 .ai-world-page__nav-collapsed-item 样式 (36x36 圆角图标按钮)
 *   24. AiWorld.vue 必须 import 至少 Picture/Briefcase/VideoCamera/Monitor/Microphone
 *       (Element Plus 图标, 折叠态图标栏才能区分 section)
 *   25. AiWorld.vue 模板必须有 .ai-world-page__nav-collapsed 节点 (v-show=aiNavCollapsed)
 *       (否则 SCSS 规则 22/23 没有对应 DOM, 折叠态仍只显示 chevron 按钮)
 *
 * 用法:
 *   - 检查暂存文件:  node scripts/check-ai-world-sidebar-layout.mjs
 *   - 检查整个项目:  node scripts/check-ai-world-sidebar-layout.mjs --all
 *   - 检查指定文件:  node scripts/check-ai-world-sidebar-layout.mjs file1 file2
 *
 * 退出码: 0 通过, 1 发现违规
 *
 * 性能: <50ms (pre-commit 友好)
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

// 关键文件 (绝对路径)
const USE_AI_PANEL_TS = path.join(rootDir, 'src', 'composables', 'useAiPanel.ts')
const USE_AI_WORLD_NAV_TS = path.join(rootDir, 'src', 'composables', 'useAiWorldNav.ts')
const SIDEBAR_LAYOUT_SCSS = path.join(rootDir, 'src', 'styles', '_sidebar-layout.scss')
const AIWORLD_VUE = path.join(rootDir, 'src', 'views', 'AiWorld.vue')

const TARGET_FILES = [USE_AI_PANEL_TS, USE_AI_WORLD_NAV_TS, SIDEBAR_LAYOUT_SCSS, AIWORLD_VUE]

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      cwd: rootDir,
      encoding: 'utf-8',
    })
    return output
      .split(/\r?\n/)
      .filter(Boolean)
      .map((f) => path.resolve(rootDir, f))
  } catch {
    return []
  }
}

/**
 * 抓取 CSS/SCSS 块 (从 { 到匹配的 }, 支持嵌套 {}).
 * 跳过字符串字面量 ('', "", ``) 和注释 (//, /* ... *​/).
 */
function extractBlock(text, startPattern) {
  const startMatch = text.match(startPattern)
  if (!startMatch) return null
  const openBraceIdx = text.indexOf('{', startMatch.index)
  if (openBraceIdx === -1) return null
  let depth = 0
  let inString = null
  let inComment = null
  for (let i = openBraceIdx; i < text.length; i++) {
    const c = text[i]
    const next = text[i + 1]
    if (inComment === '//') {
      if (c === '\n') inComment = null
      continue
    }
    if (inComment === '/*') {
      if (c === '*' && next === '/') { inComment = null; i++ }
      continue
    }
    if (inString) {
      if (c === '\\') { i++; continue }
      if (c === inString) inString = null
      continue
    }
    if (c === '/' && next === '/') { inComment = '//'; i++; continue }
    if (c === '/' && next === '*') { inComment = '/*'; i++; continue }
    if (c === '"' || c === "'" || c === '`') { inString = c; continue }
    if (c === '{') depth++
    if (c === '}') {
      depth--
      if (depth === 0) return text.slice(openBraceIdx, i + 1)
    }
  }
  return null
}

function main() {
  let files
  if (process.argv.includes('--all')) {
    files = TARGET_FILES.map((f) => path.resolve(f))
  } else if (process.argv.length > 2 && !process.argv[2].startsWith('-')) {
    files = process.argv.slice(2).map((f) => path.resolve(f))
  } else {
    const staged = getStagedFiles()
    files = TARGET_FILES.filter((f) => staged.includes(f))
  }

  if (files.length === 0) {
    console.log('✓ [ai-world-sidebar-layout] 无相关文件在暂存区, 跳过')
    process.exit(0)
  }

  const violations = []
  const checkedFiles = []

  // --- 规则 1: useAiPanel.ts 必须把 --ai-panel-width 同步写入 documentElement ---
  // 必须从"有效代码"中检测: 先 strip 注释 + strip `if (false` 包裹的代码块, 避免反向测试时
  // 把规则代码注释掉后还能蒙混过关 (false negative).
  if (files.includes(USE_AI_PANEL_TS) && fs.existsSync(USE_AI_PANEL_TS)) {
    const text = fs.readFileSync(USE_AI_PANEL_TS, 'utf-8')
    checkedFiles.push(USE_AI_PANEL_TS)
    // 1) strip /* ... */ 多行注释
    const noComment = text.replace(/\/\*[\s\S]*?\*\//g, '')
    // 2) strip // 单行注释
    const noComment2 = noComment.replace(/^\s*\/\/.*$/gm, '')
    // 3) strip `if (false ...) { ... }` 包裹的死代码块 (反向测试时会把代码包进去)
    // 简单方法: 把 if (false ... ) { ... } 整段匹配去掉, 支持嵌套 {}
    const stripped = (() => {
      let s = noComment2
      let changed = true
      while (changed) {
        changed = false
        const re = /if\s*\(\s*false[^)]*\)\s*\{/g
        let m
        const ranges = []
        while ((m = re.exec(s)) !== null) {
          // 从 m.index 找到匹配的 }
          let depth = 0
          for (let i = m.index; i < s.length; i++) {
            if (s[i] === '{') depth++
            else if (s[i] === '}') {
              depth--
              if (depth === 0) {
                ranges.push([m.index, i + 1])
                break
              }
            }
          }
        }
        if (ranges.length) {
          changed = true
          // 从后往前替换避免索引错位
          for (let i = ranges.length - 1; i >= 0; i--) {
            s = s.slice(0, ranges[i][0]) + ' '.repeat(ranges[i][1] - ranges[i][0]) + s.slice(ranges[i][1])
          }
        }
      }
      return s
    })()
    if (
      !/document\.documentElement\.style\.setProperty\(\s*['"]--ai-panel-width['"]/.test(stripped)
    ) {
      violations.push({
        file: path.relative(rootDir, USE_AI_PANEL_TS),
        rule: 'useAiPanel.ts 必须把 --ai-panel-width 同步写入 documentElement (:root), 否则 AiWorld 侧栏 (Teleport to body) 读不到 AI 面板宽度',
        fix: '在 useAiPanel.ts 添加 watch(width, (w) => { document.documentElement.style.setProperty("--ai-panel-width", w + "px") }, { immediate: true }), 让 fixed 定位的侧栏能通过 var(--ai-panel-width) 继承.',
      })
    }

    // --- 规则 5: 必须用 immediate: true 同步 :root (首屏渲染不跳变) ---
    // 同样从 stripped 中找 watch 块, 确保未在 if (false) 内被禁用
    const watchBlockMatch = stripped.match(
      /watch\s*\(\s*width[\s\S]{0,200}?--ai-panel-width[\s\S]{0,500}?\}\s*\)/,
    )
    if (
      watchBlockMatch &&
      !new RegExp(/watch\s*\(\s*width[\s\S]{0,200}?--ai-panel-width[\s\S]{0,500}?\}\s*,\s*\{\s*immediate:\s*true/).test(stripped)
    ) {
      violations.push({
        file: path.relative(rootDir, USE_AI_PANEL_TS),
        rule: 'useAiPanel.ts watch(width, ...) 同步 --ai-panel-width 时缺 immediate: true (首屏渲染前 CSS 变量未设置, 侧栏位置会跳变)',
        fix: '在 watch 选项加 { immediate: true }, 让 useAiPanel 模块加载时立即把当前 width 写入 :root.',
      })
    }
  }

  // --- 规则 2-4: _sidebar-layout.scss 必须有 AI 面板开启时侧栏右移规则 ---
  if (files.includes(SIDEBAR_LAYOUT_SCSS) && fs.existsSync(SIDEBAR_LAYOUT_SCSS)) {
    const text = fs.readFileSync(SIDEBAR_LAYOUT_SCSS, 'utf-8')
    checkedFiles.push(SIDEBAR_LAYOUT_SCSS)

    const rulePattern =
      /body:has\(\.app-layout\):has\(\.ai-side-panel\.is-open\)\s+\.ai-world-page__nav\s*\{/
    const ruleBlock = extractBlock(text, rulePattern)

    if (!ruleBlock) {
      violations.push({
        file: path.relative(rootDir, SIDEBAR_LAYOUT_SCSS),
        rule: '_sidebar-layout.scss 缺 AI 面板开启时侧栏右移规则 (用户反馈"侧边栏挡住 AI 对话框")',
        fix: '添加规则: body:has(.app-layout):has(.ai-side-panel.is-open) .ai-world-page__nav { left: calc(var(--sidebar-width, 116px) + var(--ai-panel-width, 400px)); } 让 AiWorld 侧栏在 AI 面板开启时紧贴工作区左侧.',
      })
    } else {
      // 规则 3: 块内必须含 left: calc(var(--sidebar-current-width 表达式 (跟全局 sidebar 折叠同步)
      if (!/left:\s*calc\(\s*var\(--sidebar-current-width/.test(ruleBlock)) {
        violations.push({
          file: path.relative(rootDir, SIDEBAR_LAYOUT_SCSS),
          rule: 'AI 面板开启时 .ai-world-page__nav 规则缺 `left: calc(var(--sidebar-current-width...))` 表达式 (未跟随全局 sidebar 折叠)',
          fix: '在 body:has(.app-layout):has(.ai-side-panel.is-open) .ai-world-page__nav 块内加 `left: calc(var(--sidebar-current-width, var(--sidebar-width, 136px)) + var(--ai-panel-width, 400px));` 让侧栏跟随全局 sidebar 折叠状态.',
        })
      }

      // 规则 4: 块内必须含 var(--ai-panel-width 引用
      if (!/var\(--ai-panel-width/.test(ruleBlock)) {
        violations.push({
          file: path.relative(rootDir, SIDEBAR_LAYOUT_SCSS),
          rule: 'AI 面板开启时 .ai-world-page__nav 规则缺 `var(--ai-panel-width)` 引用 (useAiPanel 同步到 :root 的宽度)',
          fix: '在 left calc 表达式中加 `+ var(--ai-panel-width, 400px)`, 让侧栏跟随面板宽度动态调整.',
        })
      }
    }

    // --- 规则 6: .ai-world-page__nav-inner 必须含 `padding: 0 4px` 缓冲 ---
    // 防止选中态矩形向右溢出 nav-inner 4px (用户反馈"偏右 / 没居中")
    const innerBlock = extractBlock(
      text,
      /body:has\(\.app-layout\)\s+\.ai-world-page__nav\s+\.ai-world-page__nav-inner\s*\{/,
    )
    if (innerBlock) {
      if (!/padding:\s*0(?:px)?\s+4px/i.test(innerBlock)) {
        violations.push({
          file: path.relative(rootDir, SIDEBAR_LAYOUT_SCSS),
          rule: 'B 部分: .ai-world-page__nav-inner 缺 `padding: 0 4px` 水平缓冲 (用户反馈"选中态偏右 / 没居中")',
          fix: '在 body:has(.app-layout) .ai-world-page__nav .ai-world-page__nav-inner 块内加 `padding: 0 4px;` 提供左右 4px 缓冲, 让 nav-item 矩形在 inner 内完美居中.',
        })
      }
    }

    // --- 规则 7: 所有 nav-item/--sub/.ai-world-page__nav-parent 水平 margin 必须为 0 ---
    // 必须用 `margin: 1px 0` (上下 1px, 左右 0), 不能是 `margin: 1px 4px` (会让矩形向右溢出 4px)
    const navSelectors = [
      /\.ai-world-page__nav-item\s*\{/,
      /\.ai-world-page__nav-item--sub\s*\{/,
      /\.ai-world-page__nav-parent\s*\{/,
    ]
    for (const sel of navSelectors) {
      const block = extractBlock(text, sel)
      if (block) {
        // strip 注释
        const clean = block.replace(/\/\*[\s\S]*?\*\//g, '')
        if (/margin:\s*1px\s+4px/i.test(clean)) {
          const name = sel.source.match(/__nav[\w-]+/)[0]
          violations.push({
            file: path.relative(rootDir, SIDEBAR_LAYOUT_SCSS),
            rule: `B 部分: .${name} 水平 margin 仍为 4px (用户反馈"选中态偏右 / 没居中"根因)`,
            fix: `将 .${name} 块的 \`margin: 1px 4px\` 改为 \`margin: 1px 0\`, 左右边距改由 nav-inner padding: 0 4px 提供, 避免 flex column 中 margin-right 4px 被裁剪导致矩形向右溢出.`,
          })
        }
      }
    }
  }

  // --- 规则 8: AiWorld.vue scoped style 中 .ai-world-page__nav-parent/item 必须显式 `margin: 1px 0` ---
  // 防止 browser button 默认 2px margin 覆盖 _sidebar-layout.scss 修复
  if (files.includes(AIWORLD_VUE) && fs.existsSync(AIWORLD_VUE)) {
    const text = fs.readFileSync(AIWORLD_VUE, 'utf-8')
    checkedFiles.push(AIWORLD_VUE)
    // 用 extractBlock 抓嵌套块 (支持 &:hover { } 等嵌套)
    const parentBlock = extractBlock(text, /\.ai-world-page__nav-parent\s*\{/)
    if (parentBlock) {
      if (!/margin:\s*1px\s+0/i.test(parentBlock)) {
        violations.push({
          file: path.relative(rootDir, AIWORLD_VUE),
          rule: 'B 部分: AiWorld.vue scoped .ai-world-page__nav-parent 缺显式 `margin: 1px 0` (browser button 默认 2px margin 会覆盖 _sidebar-layout.scss 修复)',
          fix: '在 .ai-world-page__nav-parent { ... } 块内加 `margin: 1px 0;`, 显式声明水平 margin 为 0, 避免视觉偏右.',
        })
      }
    }
    const itemBlock = extractBlock(text, /\.ai-world-page__nav-item\s*\{/)
    if (itemBlock) {
      if (!/margin:\s*1px\s+0/i.test(itemBlock)) {
        violations.push({
          file: path.relative(rootDir, AIWORLD_VUE),
          rule: 'B 部分: AiWorld.vue scoped .ai-world-page__nav-item 缺显式 `margin: 1px 0` (browser button 默认 2px margin 会覆盖 _sidebar-layout.scss 修复)',
          fix: '在 .ai-world-page__nav-item { ... } 块内加 `margin: 1px 0;`, 显式声明水平 margin 为 0.',
        })
      }
    }
  }

  // --- 规则 9: _sidebar-layout.scss 中 .ai-world-page__nav --active 不能用 primary 蓝 ---
  // 防止退回突兀的 el-color-primary-light-9 蓝高亮 (用户反馈"显得很突兀")
  if (files.includes(SIDEBAR_LAYOUT_SCSS) && fs.existsSync(SIDEBAR_LAYOUT_SCSS)) {
    const text = fs.readFileSync(SIDEBAR_LAYOUT_SCSS, 'utf-8')
    checkedFiles.push(SIDEBAR_LAYOUT_SCSS)

    // 找所有 ai-world-page__nav-item--active / nav-item--sub.--active / nav-parent--active 块
    const activeSelectors = [
      /\.ai-world-page__nav-item--active\s*\{/,
      /\.ai-world-page__nav-item--sub\.ai-world-page__nav-item--active\s*\{/,
      /\.ai-world-page__nav-parent--active\s*\{/,
    ]
    for (const sel of activeSelectors) {
      const block = extractBlock(text, sel)
      if (block) {
        const clean = block.replace(/\/\*[\s\S]*?\*\//g, '')
        if (/background-color:\s*(var\(--el-color-primary-light-?\d+\)|var\(--el-color-primary\)|var\(--color-primary-light-?\d+\))/i.test(clean)) {
          const name = sel.source.match(/__nav[\w.-]+/)[0]
          violations.push({
            file: path.relative(rootDir, SIDEBAR_LAYOUT_SCSS),
            rule: `C 部分: .${name} 选中态仍在用 primary 蓝高亮 (用户反馈"显得很突兀", 应该用 --app-sidebar-color-new-chat 浅灰底)`,
            fix: `将 .${name} 块内的 \`background-color: var(--el-color-primary-light-9)\` 改为 \`background-color: var(--app-sidebar-color-new-chat)\` (亮色 #dbdbdb / 暗色 #1f1f1f, 与 sidebar 5 档色阶同源, 视觉不突兀).`,
          })
        }
      }
    }

    // 规则 10: .ai-world-page__nav 本体必须 position: fixed + 卡片化样式 (background + border + border-radius)
    // 防止清理 scoped style 时误删 position: fixed (Teleport 后必须 fixed 才能脱离文档流)
    const navBlock = extractBlock(text, /body:has\(\.app-layout\)\s+\.ai-world-page__nav\s*\{/)
    if (navBlock) {
      if (!/position:\s*fixed/i.test(navBlock)) {
        violations.push({
          file: path.relative(rootDir, SIDEBAR_LAYOUT_SCSS),
          rule: 'C 部分: .ai-world-page__nav 缺 `position: fixed` (Teleport 到 body 后必须 fixed 才能脱离文档流固定于视口)',
          fix: '在 body:has(.app-layout) .ai-world-page__nav 块内加 `position: fixed;`',
        })
      }
      if (!/border-radius:\s*(12px|var\(--global-border-radius)/i.test(navBlock)) {
        violations.push({
          file: path.relative(rootDir, SIDEBAR_LAYOUT_SCSS),
          rule: 'C 部分: .ai-world-page__nav 缺 `border-radius: 12px` 卡片化 (用户反馈"显得很突兀"应改为浮起卡片)',
          fix: '在 body:has(.app-layout) .ai-world-page__nav 块内加 `border-radius: 12px;` 表达卡片浮起.',
        })
      }
      if (!/box-shadow:/i.test(navBlock)) {
        violations.push({
          file: path.relative(rootDir, SIDEBAR_LAYOUT_SCSS),
          rule: 'C 部分: .ai-world-page__nav 缺 `box-shadow` 微投影 (亮色模式应有微投影, 暗色无)',
          fix: '在 body:has(.app-layout) .ai-world-page__nav 块内加 `box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.03);` (暗色模式 html.dark 块覆盖为 box-shadow: none).',
        })
      }
    }

    // 规则 11: html.dark 暗色块必须存在且设置 #141416 背景 (防止退回 #f7f8fa 同色)
    if (!/html\.dark\s+body:has\(\.app-layout\)\s+\.ai-world-page__nav\s*\{[\s\S]*?#141416/i.test(text)) {
      violations.push({
        file: path.relative(rootDir, SIDEBAR_LAYOUT_SCSS),
        rule: 'C 部分: 暗色 .ai-world-page__nav 必须有 #141416 背景覆盖 (跟 sidebar #080808 拉开 14 单位表达"浮起")',
        fix: '添加规则: html.dark body:has(.app-layout) .ai-world-page__nav { background-color: #141416; border-color: #2a2a2a; box-shadow: none; }',
      })
    }
  }

  // --- 规则 12: AiWorld.vue scoped style 不应再定义 nav-item/--sub/parent 的 background-color (应交给全局) ---
  // 防止以后又有人在 scoped 中塞回蓝高亮
  if (files.includes(AIWORLD_VUE) && fs.existsSync(AIWORLD_VUE)) {
    const text = fs.readFileSync(AIWORLD_VUE, 'utf-8')
    checkedFiles.push(AIWORLD_VUE)

    // 只看 scoped 块 (<style lang="scss" scoped>...</style>), 不看 <style lang="scss"> (Teleport 全局)
    const scopedMatch = text.match(/<style\s+lang="scss"\s+scoped>([\s\S]*?)<\/style>/)
    if (scopedMatch) {
      const scopedText = scopedMatch[1]
      // strip 注释
      const clean = scopedText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      if (/background-color:\s*var\(--el-color-primary/i.test(clean)) {
        violations.push({
          file: path.relative(rootDir, AIWORLD_VUE),
          rule: 'C 部分: AiWorld.vue scoped style 中有 primary 蓝背景, 跟全局选中态 token 冲突',
          fix: '移除 scoped style 中所有 `background-color: var(--el-color-primary-light-9)` 改用全局 `--app-sidebar-color-new-chat`.',
        })
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // D 部分: 独立折叠态 (2026-07-06 v3 新增, 6 条规则)
  // 用户反馈"这个侧边栏你没有设计收起状态啊" → 引入 useAiWorldNav composable +
  //   body.ai-world-nav-collapsed class + _sidebar-layout.scss 折叠态规则.
  // ═══════════════════════════════════════════════════════════════════════════

  // --- 规则 13: useAiWorldNav.ts 必须存在 (管理独立折叠状态的 composable) ---
  if (files.includes(USE_AI_WORLD_NAV_TS) && fs.existsSync(USE_AI_WORLD_NAV_TS)) {
    checkedFiles.push(USE_AI_WORLD_NAV_TS)
    const text = fs.readFileSync(USE_AI_WORLD_NAV_TS, 'utf-8')
    const clean = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    // 必须 export useAiWorldNav 函数, 必须有 isCollapsed ref + toggle 方法
    if (!/export\s+function\s+useAiWorldNav/i.test(clean)) {
      violations.push({
        file: path.relative(rootDir, USE_AI_WORLD_NAV_TS),
        rule: 'D 部分: useAiWorldNav.ts 必须 export function useAiWorldNav (独立折叠状态 composable)',
        fix: '在 useAiWorldNav.ts 添加 `export function useAiWorldNav() { ... }`, 内部管理 isCollapsed ref + toggle/setCollapsed 方法.',
      })
    }
    if (!/classList\.(add|remove)\(\s*['"]ai-world-nav-collapsed['"]/i.test(clean)) {
      violations.push({
        file: path.relative(rootDir, USE_AI_WORLD_NAV_TS),
        rule: 'D 部分: useAiWorldNav.ts 必须同步 body.ai-world-nav-collapsed class (供 _sidebar-layout.scss 用 :has 选择器切换样式)',
        fix: '在 toggle/setCollapsed 中调用 `document.body.classList.add/remove("ai-world-nav-collapsed")` 同步状态到 DOM.',
      })
    }
  } else if (files.includes(USE_AI_WORLD_NAV_TS)) {
    violations.push({
      file: path.relative(rootDir, USE_AI_WORLD_NAV_TS),
      rule: 'D 部分: useAiWorldNav.ts 文件不存在 (AiWorld 侧栏独立折叠状态管理 composable 缺失)',
      fix: '创建 client/src/composables/useAiWorldNav.ts, 参考现有 useSidebar.ts 模式 (模块级单例 ref + localStorage 持久化 + body class 同步).',
    })
  }

  // --- 规则 14: AiWorld.vue 必须 import useAiWorldNav 并在 template 绑定折叠状态 ---
  if (files.includes(AIWORLD_VUE) && fs.existsSync(AIWORLD_VUE)) {
    const text = fs.readFileSync(AIWORLD_VUE, 'utf-8')
    if (!/import\s*\{[^}]*useAiWorldNav[^}]*\}\s*from\s*['"]@\/composables\/useAiWorldNav['"]/i.test(text)) {
      violations.push({
        file: path.relative(rootDir, AIWORLD_VUE),
        rule: 'D 部分: AiWorld.vue 未 import useAiWorldNav (无法管理独立折叠状态)',
        fix: '在 <script setup> 顶部加 `import { useAiWorldNav } from "@/composables/useAiWorldNav"`.',
      })
    }
    if (!/useAiWorldNav\s*\(\s*\)/.test(text)) {
      violations.push({
        file: path.relative(rootDir, AIWORLD_VUE),
        rule: 'D 部分: AiWorld.vue 未调用 useAiWorldNav() 获取状态',
        fix: '在 script setup 中调用 `const { isCollapsed: aiNavCollapsed, toggle: toggleAiNav } = useAiWorldNav()`.',
      })
    }
  }

  // --- 规则 15-18: _sidebar-layout.scss 必须有完整折叠态样式 ---
  if (files.includes(SIDEBAR_LAYOUT_SCSS) && fs.existsSync(SIDEBAR_LAYOUT_SCSS)) {
    const text = fs.readFileSync(SIDEBAR_LAYOUT_SCSS, 'utf-8')

    // 规则 15: 折叠态 width 切换规则 (200→60)
    const collapseWidthBlock = extractBlock(
      text,
      /body\.ai-world-nav-collapsed:has\(\.app-layout\)\s+\.ai-world-page__nav\s*\{/,
    )
    if (!collapseWidthBlock) {
      violations.push({
        file: path.relative(rootDir, SIDEBAR_LAYOUT_SCSS),
        rule: 'D 部分: 缺 AiWorld 侧栏独立折叠规则 body.ai-world-nav-collapsed:has(.app-layout) .ai-world-page__nav (用户反馈"没有设计收起状态")',
        fix: '添加规则: body.ai-world-nav-collapsed:has(.app-layout) .ai-world-page__nav { --ai-world-nav-width: 60px; width: 60px; }, 配合 useAiWorldNav 切换 body class.',
      })
    } else if (!/width:\s*60px/i.test(collapseWidthBlock)) {
      violations.push({
        file: path.relative(rootDir, SIDEBAR_LAYOUT_SCSS),
        rule: 'D 部分: 折叠态规则缺 `width: 60px` (跟全局 sidebar 折叠态同宽)',
        fix: '在 body.ai-world-nav-collapsed:has(.app-layout) .ai-world-page__nav 块内加 `width: 60px;`.',
      })
    }

    // 规则 16: 折叠态下 nav-inner 隐藏
    const innerHiddenBlock = extractBlock(
      text,
      /body\.ai-world-nav-collapsed:has\(\.app-layout\)\s+\.ai-world-page__nav\s+\.ai-world-page__nav-inner\s*\{/,
    )
    if (!innerHiddenBlock) {
      violations.push({
        file: path.relative(rootDir, SIDEBAR_LAYOUT_SCSS),
        rule: 'D 部分: 折叠态缺 nav-inner 隐藏规则 (菜单项在 60px 侧栏里会溢出)',
        fix: '添加规则: body.ai-world-nav-collapsed:has(.app-layout) .ai-world-page__nav .ai-world-page__nav-inner { display: none; }',
      })
    } else if (!/display:\s*none/i.test(innerHiddenBlock)) {
      violations.push({
        file: path.relative(rootDir, SIDEBAR_LAYOUT_SCSS),
        rule: 'D 部分: nav-inner 折叠态规则缺 `display: none`',
        fix: '在 body.ai-world-nav-collapsed:has(.app-layout) .ai-world-page__nav .ai-world-page__nav-inner 块内加 `display: none;`.',
      })
    }

    // 规则 17: 折叠按钮样式 (position: absolute + 24x24)
    const collapseBtnBlock = extractBlock(
      text,
      /body:has\(\.app-layout\)\s+\.ai-world-page__nav\s+\.ai-world-page__nav-collapse-btn\s*\{/,
    )
    if (!collapseBtnBlock) {
      violations.push({
        file: path.relative(rootDir, SIDEBAR_LAYOUT_SCSS),
        rule: 'D 部分: 缺折叠按钮样式 body:has(.app-layout) .ai-world-page__nav .ai-world-page__nav-collapse-btn (按钮无视觉位置)',
        fix: '添加规则: body:has(.app-layout) .ai-world-page__nav .ai-world-page__nav-collapse-btn { position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; ... }',
      })
    } else {
      if (!/position:\s*absolute/i.test(collapseBtnBlock)) {
        violations.push({
          file: path.relative(rootDir, SIDEBAR_LAYOUT_SCSS),
          rule: 'D 部分: 折叠按钮缺 `position: absolute` (无法脱离 flex 布局定位到右上角)',
          fix: '在 .ai-world-page__nav-collapse-btn 块内加 `position: absolute;`.',
        })
      }
      if (!/width:\s*24px/i.test(collapseBtnBlock) || !/height:\s*24px/i.test(collapseBtnBlock)) {
        violations.push({
          file: path.relative(rootDir, SIDEBAR_LAYOUT_SCSS),
          rule: 'D 部分: 折叠按钮缺 `width: 24px; height: 24px;` 方形尺寸 (跟全局 Sidebar.vue 折叠按钮风格一致)',
          fix: '在 .ai-world-page__nav-collapse-btn 块内加 `width: 24px; height: 24px;`.',
        })
      }
    }

    // 规则 18: :root 必须定义 --ai-world-nav-width 变量 (默认 200px)
    const rootBlock = extractBlock(text, /:root\s*\{/)
    if (!rootBlock || !/--ai-world-nav-width:\s*200px/i.test(rootBlock)) {
      violations.push({
        file: path.relative(rootDir, SIDEBAR_LAYOUT_SCSS),
        rule: 'D 部分: :root 缺 `--ai-world-nav-width: 200px` 变量 (折叠态切换的 token 源)',
        fix: '在 :root 块内加 `--ai-world-nav-width: 200px; --ai-world-nav-collapsed-width: 60px;`, 让 .ai-world-page__nav width 用 var(--ai-world-nav-width, 200px) 引用.',
      })
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // E 部分: 全局 sidebar 宽度同步到 :root (2026-07-06 v4 新增, 3 条规则)
  // 修复"AiWorld 侧栏不跟随全局 sidebar 折叠"用户反馈
  // ═══════════════════════════════════════════════════════════════════════════

  const USE_SIDEBAR_TS = path.join(rootDir, 'src', 'composables', 'useSidebar.ts')

  // --- 规则 19: useSidebar.ts 必须把 --sidebar-current-width 同步到 :root ---
  // strip 注释 + 死代码 (同 useAiPanel 检测)
  if (fs.existsSync(USE_SIDEBAR_TS)) {
    const text = fs.readFileSync(USE_SIDEBAR_TS, 'utf-8')
    checkedFiles.push(USE_SIDEBAR_TS)
    const noComment = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const stripped = (() => {
      let s = noComment
      let changed = true
      while (changed) {
        changed = false
        const re = /if\s*\(\s*false[^)]*\)\s*\{/g
        let m
        const ranges = []
        while ((m = re.exec(s)) !== null) {
          let depth = 0
          for (let i = m.index; i < s.length; i++) {
            if (s[i] === '{') depth++
            else if (s[i] === '}') {
              depth--
              if (depth === 0) {
                ranges.push([m.index, i + 1])
                break
              }
            }
          }
        }
        if (ranges.length) {
          changed = true
          for (let i = ranges.length - 1; i >= 0; i--) {
            s = s.slice(0, ranges[i][0]) + ' '.repeat(ranges[i][1] - ranges[i][0]) + s.slice(ranges[i][1])
          }
        }
      }
      return s
    })()

    if (
      !/document\.documentElement\.style\.setProperty\(\s*['"]--sidebar-current-width['"]/.test(stripped)
    ) {
      violations.push({
        file: path.relative(rootDir, USE_SIDEBAR_TS),
        rule: 'E 部分: useSidebar.ts 必须把 --sidebar-current-width 同步写入 documentElement (:root), 否则 AiWorld 侧栏 (Teleport to body) 用 var(--sidebar-current-width) 取不到值',
        fix: '在 useSidebar.ts 添加 watch([isCollapsed, width], (collapsed, w) => { const current = collapsed ? 60 : w; document.documentElement.style.setProperty("--sidebar-current-width", current + "px") }, { immediate: true }), 让 fixed 定位的 AiWorld 侧栏能通过 var(--sidebar-current-width) 自动跟随全局 sidebar 折叠/拖拽.',
      })
    }

    // --- 规则 20: 同步 :root 时 watch 必须包含 width (用户拖拽) ---
    const watchSidebarCurrentWidth = stripped.match(
      /watch\s*\(\s*\[\s*isCollapsed\s*,\s*width\s*\][\s\S]{0,500}?--sidebar-current-width[\s\S]{0,500}?\}\s*,\s*\{[\s\S]{0,200}?\}\s*\)/,
    )
    if (
      watchSidebarCurrentWidth &&
      !new RegExp(/watch\s*\(\s*\[\s*isCollapsed\s*,\s*width\s*\][\s\S]{0,500}?--sidebar-current-width[\s\S]{0,500}?\}\s*,\s*\{\s*immediate:\s*true/).test(stripped)
    ) {
      violations.push({
        file: path.relative(rootDir, USE_SIDEBAR_TS),
        rule: 'E 部分: useSidebar.ts 同步 --sidebar-current-width 时缺 immediate: true (首屏渲染前 CSS 变量未设置, 侧栏位置会跳变)',
        fix: '在 watch 选项加 { immediate: true }, 让 useSidebar 模块加载时立即把当前 width 写入 :root.',
      })
    }
  }

  // --- 规则 21: _sidebar-layout.scss 的 .ai-world-page__nav left 必须用 var(--sidebar-current-width) ---
  if (files.includes(SIDEBAR_LAYOUT_SCSS) && fs.existsSync(SIDEBAR_LAYOUT_SCSS)) {
    const text = fs.readFileSync(SIDEBAR_LAYOUT_SCSS, 'utf-8')
    const navBlock = extractBlock(text, /body:has\(\.app-layout\)\s+\.ai-world-page__nav\s*\{/)
    if (navBlock) {
      const clean = navBlock.replace(/\/\*[\s\S]*?\*\//g, '')
      if (!/left:\s*var\(--sidebar-current-width/.test(clean)) {
        violations.push({
          file: path.relative(rootDir, SIDEBAR_LAYOUT_SCSS),
          rule: 'E 部分: .ai-world-page__nav left 缺 `var(--sidebar-current-width)` 引用 (用户反馈"AiWorld 侧栏不跟随全局折叠", 写死 --sidebar-width 不会响应全局折叠/拖拽)',
          fix: '在 body:has(.app-layout) .ai-world-page__nav 块内把 `left: var(--sidebar-width, 136px);` 改为 `left: var(--sidebar-current-width, var(--sidebar-width, 136px));`. 配合 useSidebar.ts 同步 :root 即可让 AiWorld 侧栏跟随全局 sidebar 折叠/拖拽.',
        })
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // F 部分: 折叠态图标栏 (2026-07-06 v5 新增, 4 条规则)
  // 修复"折叠态太空, 只有一个按钮"用户反馈 — 强制要求 VS Code 风格图标栏
  // ═══════════════════════════════════════════════════════════════════════════

  if (files.includes(SIDEBAR_LAYOUT_SCSS) && fs.existsSync(SIDEBAR_LAYOUT_SCSS)) {
    const scssText = fs.readFileSync(SIDEBAR_LAYOUT_SCSS, 'utf-8')

    // --- 规则 22: .ai-world-page__nav-collapsed 容器必须存在 (折叠态显示的图标栏) ---
    const collapsedBlock = extractBlock(
      scssText,
      /\.ai-world-page__nav-collapsed\s*\{/
    )
    if (!collapsedBlock) {
      violations.push({
        file: path.relative(rootDir, SIDEBAR_LAYOUT_SCSS),
        rule: 'F 部分: 缺 `.ai-world-page__nav-collapsed` 容器样式 (用户反馈"折叠态太空, 没设计", 必须有 VS Code 风格图标栏)',
        fix: '添加规则: .ai-world-page__nav-collapsed { display: none; } 默认隐藏; body.ai-world-nav-collapsed:has(.app-layout) .ai-world-page__nav .ai-world-page__nav-collapsed { display: flex; flex-direction: column; align-items: center; padding: 8px 0 12px; gap: 4px; }.',
      })
    }

    // --- 规则 23: .ai-world-page__nav-collapsed-item 必须有 36x36 圆角按钮样式 ---
    const collapsedItemBlock = extractBlock(
      scssText,
      /\.ai-world-page__nav-collapsed-item\s*\{/
    )
    if (!collapsedItemBlock) {
      violations.push({
        file: path.relative(rootDir, SIDEBAR_LAYOUT_SCSS),
        rule: 'F 部分: 缺 `.ai-world-page__nav-collapsed-item` 图标按钮样式 (折叠态必须有可点击的 section 图标按钮)',
        fix: '添加规则: .ai-world-page__nav-collapsed-item { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border: none; border-radius: 8px; background: transparent; color: var(--el-text-color-secondary); cursor: pointer; } 并配 .is-active 态 + hover 态.',
      })
    } else {
      if (!/width:\s*36px/i.test(collapsedItemBlock) || !/height:\s*36px/i.test(collapsedItemBlock)) {
        violations.push({
          file: path.relative(rootDir, SIDEBAR_LAYOUT_SCSS),
          rule: 'F 部分: .ai-world-page__nav-collapsed-item 缺 `width: 36px; height: 36px;` (图标按钮方形尺寸)',
          fix: '在 .ai-world-page__nav-collapsed-item 块内加 `width: 36px; height: 36px;`.',
        })
      }
    }
  }

  // --- 规则 24: AiWorld.vue 必须 import 至少 1 个 Element Plus section 图标 ---
  // 防止折叠态图标栏渲染空 (getSectionIcon 全 fallback 到 Cpu 但失去分类辨识度)
  if (files.includes(AIWORLD_VUE) && fs.existsSync(AIWORLD_VUE)) {
    const vueText = fs.readFileSync(AIWORLD_VUE, 'utf-8')
    checkedFiles.push(AIWORLD_VUE)
    const iconImportPattern = /from\s+['"]@element-plus\/icons-vue['"]/
    const requiredIcons = ['Picture', 'Briefcase', 'VideoCamera', 'Monitor', 'Microphone']
    if (!iconImportPattern.test(vueText)) {
      violations.push({
        file: path.relative(rootDir, AIWORLD_VUE),
        rule: 'F 部分: AiWorld.vue 缺 `@element-plus/icons-vue` import (折叠态图标栏无图标可显示)',
        fix: '添加 import { Picture, Briefcase, VideoCamera, Monitor, Microphone, ChatDotRound, EditPen, Cpu } from "@element-plus/icons-vue", 并在 SECTION_ICON_MAP 中映射 section title → 图标.',
      })
    } else {
      const importBlockMatch = vueText.match(/import\s*\{([^}]+)\}\s*from\s*['"]@element-plus\/icons-vue['"]/s)
      if (importBlockMatch) {
        const importNames = importBlockMatch[1]
        const missing = requiredIcons.filter((n) => !new RegExp(`\\b${n}\\b`).test(importNames))
        if (missing.length > 0) {
          violations.push({
            file: path.relative(rootDir, AIWORLD_VUE),
            rule: `F 部分: AiWorld.vue @element-plus/icons-vue import 缺 ${missing.join(', ')} (折叠态图标栏需要这些图标区分 section)`,
            fix: `在 @element-plus/icons-vue 的 import 中加 ${missing.map((m) => `'${m}'`).join(', ')}.`,
          })
        }
      }
    }

    // --- 规则 25: AiWorld.vue 模板必须有 .ai-world-page__nav-collapsed 节点 ---
    if (!/class="ai-world-page__nav-collapsed"/.test(vueText)) {
      violations.push({
        file: path.relative(rootDir, AIWORLD_VUE),
        rule: 'F 部分: AiWorld.vue 模板缺 `.ai-world-page__nav-collapsed` 节点 (折叠态图标栏)',
        fix: '在 aside 元素内 (nav-inner 之后) 添加 `<div v-show="aiNavCollapsed" class="ai-world-page__nav-collapsed">`, 内含 .ai-world-page__nav-collapsed-logo 和 .ai-world-page__nav-collapsed-list.',
      })
    }
  }

  console.log(`[ai-world-sidebar-layout] 检查 ${checkedFiles.length} 个文件`)
  if (violations.length === 0) {
    console.log('✓ [ai-world-sidebar-layout] 全部通过')
    process.exit(0)
  }

  console.error(`✗ [ai-world-sidebar-layout] ${violations.length} 项违规:`)
  for (const v of violations) {
    console.error(`  - [${v.rule}]`)
    console.error(`    file: ${v.file}`)
    console.error(`    fix:  ${v.fix}`)
  }
  process.exit(1)
}

main()
