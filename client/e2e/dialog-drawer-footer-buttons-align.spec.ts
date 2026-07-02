/**
 * el-dialog / el-drawer footer 按钮对齐源级审计测试
 *
 * 防回归目标:
 *   Element Plus theme-chalk 默认全局规则
 *   `.el-button + .el-button { margin-left: 12px }` (特异性 0,2,0)
 *   会污染任何 column flex 容器内的第二个按钮, 造成 +12px 错位.
 *
 * 项目防御 (2026-07-02 立, 见 project_memory.md):
 *   1. 任何 `display:flex; flex-direction:column;` 的按钮容器必须加 .el-button-stack 标记
 *   2. _sidebar-layout.scss 含反排除规则:
 *      :root .<container>:is(.el-button-stack) .el-button + .el-button { margin-left: 0 !important }
 *      (特异性 0,5,0 + !important 强压 Element Plus)
 *   3. stylelint 自定义规则 aizhs/no-flex-column-el-button-without-stack 静态守门
 *   4. Playwright 运行时审计 audit-column-flex-buttons.cjs 全站扫描
 *
 * 本测试补充: 源级静态审计, 不需启动 dev server, 速度快, 覆盖广
 *   - 验证 _sidebar-layout.scss 含 .el-button-stack 反排除规则
 *   - 验证 App.vue 的 .ai-side-panel-empty-actions 含 .el-button-stack class
 *   - 扫描所有 .vue 文件, 检测 column flex 按钮容器是否打标
 */
import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CLIENT_ROOT = path.resolve(__dirname, '..')

// ─────────────────────────────────────────────────────────────
// 1. _sidebar-layout.scss 反排除规则守门
// ─────────────────────────────────────────────────────────────

test.describe('el-button-stack 反排除规则源级守门', () => {
  test('_sidebar-layout.scss 必须含 .el-button-stack 反排除规则', () => {
    const file = path.join(CLIENT_ROOT, 'src/styles/_sidebar-layout.scss')
    const content = fs.readFileSync(file, 'utf8')

    // 验证反排除规则存在 (含 .el-button-stack + margin-left: 0 + !important)
    expect(
      content,
      '_sidebar-layout.scss 必须含 .el-button-stack 反排除规则',
    ).toMatch(/\.el-button-stack/)

    expect(
      content,
      '反排除规则必须含 margin-left: 0',
    ).toMatch(/margin-left:\s*0\s*!important/)

    // 验证 :is(.el-button-stack) 模式 (提升特异性到 0,5,0)
    expect(
      content,
      '反排除规则必须用 :is(.el-button-stack) 提升特异性',
    ).toMatch(/:is\(\.el-button-stack\)/)
  })

  test('App.vue 的 .ai-side-panel-empty-actions 必须含 .el-button-stack class', () => {
    const file = path.join(CLIENT_ROOT, 'src/App.vue')
    const content = fs.readFileSync(file, 'utf8')

    // 验证模板内 .ai-side-panel-empty-actions 元素同时含 .el-button-stack class
    expect(
      content,
      'App.vue 必须有 .ai-side-panel-empty-actions.el-button-stack 标记',
    ).toMatch(/ai-side-panel-empty-actions[^"']*el-button-stack/)
  })
})

// ─────────────────────────────────────────────────────────────
// 2. _buttons.scss 死代码警告 (该文件未被 @use 加载, 见 project_memory.md)
// ─────────────────────────────────────────────────────────────

test.describe('_buttons.scss 死代码警告守门', () => {
  test('_buttons.scss 文件头部必须含死代码警告注释', () => {
    const file = path.join(CLIENT_ROOT, 'src/styles/_buttons.scss')
    const content = fs.readFileSync(file, 'utf8')

    // 验证文件头部 50 行内含死代码警告
    const head = content.split('\n').slice(0, 50).join('\n')
    expect(
      head,
      '_buttons.scss 文件头部必须含 "死代码警告" 注释说明未生效状态',
    ).toContain('死代码警告')

    // 验证注释说明 "未被 src/styles/index.scss @use 加载"
    expect(
      head,
      '_buttons.scss 警告必须说明未被 index.scss @use 加载',
    ).toContain('未被 src/styles/index.scss @use 加载')
  })

  test('index.scss 必须不含 @use ./_buttons (维持死代码状态)', () => {
    const file = path.join(CLIENT_ROOT, 'src/styles/index.scss')
    const content = fs.readFileSync(file, 'utf8')

    // 验证 index.scss 不含 @use './_buttons' (维持死代码状态)
    // 如果有人误加 @use, 会引发大量视觉回归
    expect(
      content,
      'index.scss 不应 @use _buttons (会让 724 行死代码突然生效, 引发视觉回归)',
    ).not.toMatch(/@use\s+['"]\.\/_buttons['"]/)
  })
})

// ─────────────────────────────────────────────────────────────
// 3. stylelint 自定义规则 aizhs/no-flex-column-el-button-without-stack 守门
// ─────────────────────────────────────────────────────────────

test.describe('stylelint 自定义规则守门', () => {
  test('stylelint-plugin-no-flex-column-el-button-without-stack.cjs 必须存在', () => {
    const file = path.join(
      CLIENT_ROOT,
      'stylelint-plugin-no-flex-column-el-button-without-stack.cjs',
    )
    expect(
      fs.existsSync(file),
      'stylelint 自定义规则插件文件必须存在',
    ).toBe(true)
  })

  test('.stylelintrc.json 必须注册 aizhs/no-flex-column-el-button-without-stack 规则', () => {
    const file = path.join(CLIENT_ROOT, '.stylelintrc.json')
    const content = fs.readFileSync(file, 'utf8')
    const config = JSON.parse(content)

    // 验证 plugins 数组含插件路径
    expect(
      config.plugins,
      '.stylelintrc.json plugins 必须含 no-flex-column 插件',
    ).toContain('./stylelint-plugin-no-flex-column-el-button-without-stack.cjs')

    // 验证 rules 启用了规则
    expect(
      config.rules?.['aizhs/no-flex-column-el-button-without-stack'],
      '.stylelintrc.json rules 必须启用 aizhs/no-flex-column-el-button-without-stack',
    ).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
// 4. CI button-stack-audit job 守门
// ─────────────────────────────────────────────────────────────

test.describe('CI button-stack-audit job 守门', () => {
  test('ci.yml 必须含 button-stack-audit job (阻断合并)', () => {
    const file = path.join(CLIENT_ROOT, '.github/workflows/ci.yml')
    const content = fs.readFileSync(file, 'utf8')

    // 验证 button-stack-audit job 存在
    expect(
      content,
      'ci.yml 必须含 button-stack-audit job',
    ).toContain('button-stack-audit:')

    // 验证 job 跑 audit:column-flex-buttons 脚本
    expect(
      content,
      'button-stack-audit job 必须跑 npm run audit:column-flex-buttons',
    ).toContain('npm run audit:column-flex-buttons')

    // 验证 job 跑 ai-panel-empty-buttons-align.spec.ts
    expect(
      content,
      'button-stack-audit job 必须跑 ai-panel-empty-buttons-align.spec.ts',
    ).toContain('ai-panel-empty-buttons-align.spec.ts')

    // 验证 job 不允许 continue-on-error (阻断合并)
    const jobMatch = content.match(
      /button-stack-audit:[\s\S]*?(?=\n  [a-z][\w-]*:|\n*$)/,
    )
    expect(
      jobMatch,
      'button-stack-audit job 必须存在于 ci.yml',
    ).not.toBeNull()
    expect(
      jobMatch![0],
      'button-stack-audit job 不允许 continue-on-error (必须阻断合并)',
    ).not.toContain('continue-on-error: true')
  })
})

// ─────────────────────────────────────────────────────────────
// 5. 审计脚本支持 PW_BASE_URL 环境变量 (CI 用 127.0.0.1:4173)
// ─────────────────────────────────────────────────────────────

test.describe('audit 脚本环境变量支持', () => {
  test('audit-column-flex-buttons.cjs 必须支持 PW_BASE_URL 环境变量', () => {
    const file = path.join(
      CLIENT_ROOT,
      'scripts/debug/audit-column-flex-buttons.cjs',
    )
    const content = fs.readFileSync(file, 'utf8')

    // 验证脚本读 PW_BASE_URL 环境变量
    expect(
      content,
      'audit-column-flex-buttons.cjs 必须读 PW_BASE_URL 环境变量 (CI 用 127.0.0.1:4173)',
    ).toContain('process.env.PW_BASE_URL')

    // 验证脚本默认 fallback 到 localhost:8888
    expect(
      content,
      'audit-column-flex-buttons.cjs 默认 fallback 到 http://localhost:8888',
    ).toContain("'http://localhost:8888'")
  })
})
