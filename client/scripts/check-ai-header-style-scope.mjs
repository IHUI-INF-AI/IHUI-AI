#!/usr/bin/env node
/**
 * AI 浮窗标题栏样式 scope 失配防回归轻量级守门 (pre-commit 用, 2026-07-03 立)
 *
 * 目的: 防止有人把子组件内部元素样式（.header-left/.header-right/.mode-tag 等）
 *       写回 _header.scss（被 AIChat.vue scoped 块 @use 引入后选择器失配 → 样式永不生效）。
 *       本脚本在 pre-commit 阶段跑 (< 100ms), 与 e2e 守门互补:
 *
 * 与 e2e/ai-header-style-scope.spec.ts 的关系:
 *   - 本脚本: 轻量级文本检查 (pre-commit 阶段, < 100ms)
 *   - e2e 测试: 完整源码级 + 浏览器级断言 (CI 阶段, 24 用例)
 *   两者并存: pre-commit 拦截 + CI 兜底
 *
 * 检查项:
 *   1. chatheaderbar.vue 有 <style scoped lang="scss"> 块
 *   2. _header.scss 不含子组件内部元素的 CSS 规则（.header-right { 等）
 *   3. AIChat.vue 不含 @keyframes typing {（已迁移至子组件）
 *   4. AIChat.vue .quick-tool-item 用 var(--global-border-radius-sm)
 *
 * 用法:
 *   node scripts/check-ai-header-style-scope.mjs          # 全量检查
 *   node scripts/check-ai-header-style-scope.mjs --staged # 仅 staged 文件触发
 *
 * 退出码:
 *   0 - 通过
 *   1 - 发现回归 (含具体文件:行号)
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '..')

const onlyStaged = process.argv.includes('--staged')

// 目标文件
const FILES = {
  chatHeaderBar: path.join(clientRoot, 'src/components/ai/chat-parts/chatheaderbar.vue'),
  headerScss: path.join(clientRoot, 'src/styles/ai-chat/_header.scss'),
  aiChatVue: path.join(clientRoot, 'src/components/ai/AIChat.vue'),
}

// staged 模式下只检查 git staged 的文件
function isStaged(filePath) {
  if (!onlyStaged) return true
  try {
    const rel = path.relative(clientRoot, filePath).replace(/\\/g, '/')
    const result = execSync('git diff --cached --name-only', { cwd: clientRoot, encoding: 'utf8' })
    return result.split('\n').some((line) => line.trim() === rel)
  } catch {
    return true // fallback: 检查全部
  }
}

let errors = []

function check(file, label, fn) {
  if (!fs.existsSync(file)) {
    errors.push(`[缺失] ${label}: ${path.relative(clientRoot, file)} 不存在`)
    return
  }
  const content = fs.readFileSync(file, 'utf8')
  fn(content, (msg) => errors.push(`${label}: ${msg}`))
}

// 1. chatheaderbar.vue 必须有 <style scoped lang="scss">
check(FILES.chatHeaderBar, 'chatheaderbar.vue', (content, err) => {
  if (!/<style\s+scoped\s+lang="scss">/.test(content)) {
    err('缺少 <style scoped lang="scss"> 块（子组件内部元素样式必须在自己的 scoped 块内）')
  }
  // .header-right 必须有 gap: 8px
  if (!/\.header-right\s*\{[^}]*gap:\s*8px/.test(content)) {
    err('.header-right 规则块缺少 gap: 8px')
  }
})

// 2. _header.scss 不含子组件内部元素的 CSS 规则
check(FILES.headerScss, '_header.scss', (content, err) => {
  const removedSelectors = [
    [/\.\s*header-right\s*\{/, '.header-right'],
    [/\.\s*header-left\s*\{/, '.header-left'],
    [/\.\s*header-center\s*\{/, '.header-center'],
    [/\.\s*typing-indicator\s*\{/, '.typing-indicator'],
    [/\.\s*minimized-model-info\s*\{/, '.minimized-model-info'],
  ]
  for (const [re, name] of removedSelectors) {
    const m = content.match(re)
    if (m) {
      const lines = content.substring(0, m.index).split('\n')
      err(`第 ${lines.length} 行含子组件内部元素 CSS 规则 ${name}（已迁移至 chatheaderbar.vue，禁止写回）`)
    }
  }
})

// 3. AIChat.vue 不含 @keyframes typing {
check(FILES.aiChatVue, 'AIChat.vue', (content, err) => {
  const m = content.match(/@keyframes\s+typing\s*\{/)
  if (m) {
    const lines = content.substring(0, m.index).split('\n')
    err(`第 ${lines.length} 行含 @keyframes typing {（已迁移至 chatheaderbar.vue，禁止写回）`)
  }
  // .quick-tool-item 必须用 var(--global-border-radius-sm)
  if (!/\.quick-tool-item\s*\{[^}]*border-radius:\s*var\(--global-border-radius-sm\)/.test(content)) {
    err('.quick-tool-item 规则块缺少 border-radius: var(--global-border-radius-sm)')
  }
  // 禁止 :deep(.dialog-header .header-right) 临时修复
  if (/:deep\(\.dialog-header\s+\.header-right\)/.test(content)) {
    err('含 :deep(.dialog-header .header-right) 临时修复（已通过样式迁移根治，禁止写回）')
  }
})

// 输出结果
if (errors.length > 0) {
  console.error('❌ AI 浮窗标题栏样式 scope 失配检查失败:')
  for (const e of errors) {
    console.error(`  - ${e}`)
  }
  console.error('')
  console.error('修复指南:')
  console.error('  子组件内部元素样式（.header-left/.header-right/.mode-tag 等）必须写在')
  console.error('  chatheaderbar.vue 的 <style scoped lang="scss"> 块内，禁止写回 _header.scss')
  console.error('  根因：_header.scss 被 AIChat.vue scoped 块 @use 引入后，选择器加 [data-v-xxx] 后缀，')
  console.error('  但子组件内部元素不接收父 scope attr → 选择器失配 → 样式永不生效')
  process.exit(1)
} else {
  console.log('✅ AI 浮窗标题栏样式 scope 检查通过')
  process.exit(0)
}
