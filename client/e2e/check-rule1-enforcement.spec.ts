/**
 * RULE 1「先问再做」五层硬约束浏览器/源码级守门测试 (2026-07-06 立)
 *
 * 守门目标:
 *   - 第一层: commit-msg 守门脚本 check-rule1-commit-msg.mjs 存在
 *   - 第三层: PR 模板 .github/pull_request_template.md 存在 + 5 项 RULE 1 关键字齐全
 *   - 第四层: AGENTS.md 第 28 章 RULE 1 章节含五层防回归硬约束关键词
 *   - 第五层: e2e/agents-md-sections.spec.ts 同步 RULE 1 章节
 *
 * 验证项（纯源码级, 不需要浏览器启动）:
 *   1) check-rule1-commit-msg.mjs 文件存在
 *   2) check-rule1-pr-template.mjs 文件存在
 *   3) .github/pull_request_template.md 文件存在
 *   4) PR 模板 5 项 RULE 1 关键字齐全 (范围/模式/token/守门/验证)
 *   5) PR 模板 ≥ 5 个 checkbox
 *   6) PR 模板含 RULE 1 章节引用
 *   7) PR 模板含截图验证区段
 *   8) AGENTS.md 第 28 章含 "check-rule1-commit-msg" 关键字
 *   9) AGENTS.md 第 28 章含 "check-rule1-pr-template" 关键字
 *  10) AGENTS.md 第 28 章含 ".github/pull_request_template.md" 关键字
 *  11) DESIGN.md 附录 B 含 5 层 RULE 1 硬约束描述
 *  12) .husky/commit-msg 文件存在
 *  13) .git/hooks/commit-msg 文件存在
 *  14) package.json 含 check:rule1:commit-msg 脚本
 *  15) package.json 含 check:rule1:pr-template 脚本
 *  16) package.json simple-git-hooks.commit-msg 配置存在
 *  17) package.json simple-git-hooks.pre-push 含 check:rule1:pr-template
 *
 * CI 入口: npx playwright test check-rule1-enforcement.spec.ts
 */
import { test, expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const PROJECT_ROOT = join(ROOT, '..')

const CHECK_RULE1_COMMIT_MSG = join(ROOT, 'scripts', 'check-rule1-commit-msg.mjs')
const CHECK_RULE1_PR_TEMPLATE = join(ROOT, 'scripts', 'check-rule1-pr-template.mjs')
const PR_TEMPLATE = join(PROJECT_ROOT, '.github', 'pull_request_template.md')
const AGENTS_MD = join(PROJECT_ROOT, 'AGENTS.md')
const DESIGN_MD = join(PROJECT_ROOT, 'DESIGN.md')
const HUSKY_COMMIT_MSG = join(PROJECT_ROOT, '.husky', 'commit-msg')
const GIT_HOOKS_COMMIT_MSG = join(PROJECT_ROOT, '.git', 'hooks', 'commit-msg')
const PACKAGE_JSON = join(ROOT, 'package.json')

test.describe('RULE 1「先问再做」五层硬约束守门 (2026-07-06 立)', () => {
  // ===================================================================
  // 第一层: commit-msg 守门脚本存在性
  // ===================================================================
  test('1/17 源码级: check-rule1-commit-msg.mjs 文件存在 (第一层 commit-msg 守门)', () => {
    expect(
      existsSync(CHECK_RULE1_COMMIT_MSG),
      `commit-msg 守门脚本不存在: ${CHECK_RULE1_COMMIT_MSG}\n` +
        `AGENTS.md 第 28 章要求: 任何 UI 改动 commit 必须含 RULE1: 前缀 + 5 项方向锁定关键词。\n` +
        `此脚本由 .husky/commit-msg 调用, 是 RULE 1 真正"硬约束"的起点。`
    ).toBe(true)
  })

  // ===================================================================
  // 第三层: PR 模板守门脚本存在性
  // ===================================================================
  test('2/17 源码级: check-rule1-pr-template.mjs 文件存在 (第三层 PR 模板守门)', () => {
    expect(
      existsSync(CHECK_RULE1_PR_TEMPLATE),
      `PR 模板守门脚本不存在: ${CHECK_RULE1_PR_TEMPLATE}\n` +
        `AGENTS.md 第 28 章第三层要求: GitHub PR 必填 5 项 RULE 1 checkbox + 截图区。`
    ).toBe(true)
  })

  // ===================================================================
  // 第三层: PR 模板文件存在
  // ===================================================================
  test('3/17 源码级: .github/pull_request_template.md 文件存在', () => {
    expect(
      existsSync(PR_TEMPLATE),
      `PR 模板不存在: ${PR_TEMPLATE}\n` +
        `无 PR 模板 → RULE 1 第三层失守, 任何 PR 都可以不勾选 5 项 checkbox。\n` +
        `修复: 从 git 历史找回 / 重新创建 (含 5 项 RULE 1 checkbox + 截图区)。`
    ).toBe(true)
  })

  // ===================================================================
  // 第三层: PR 模板 5 项 RULE 1 关键字齐全
  // ===================================================================
  test('4/17 源码级: PR 模板 5 项 RULE 1 关键字齐全 (范围/模式/token/守门/验证)', () => {
    const content = readFileSync(PR_TEMPLATE, 'utf8')
    const required = ['改动范围', '模式', 'token', '守门', '验证']
    const missing = required.filter((kw) => !content.includes(kw))
    expect(
      missing.length,
      `PR 模板缺失 5 项 RULE 1 关键字: ${missing.join(', ')}\n` +
        `AGENTS.md 第 28 章硬约束: 5 项方向锁定必须在 PR 模板中作为必填 checkbox。\n` +
        `修复: 在 .github/pull_request_template.md 补齐缺失关键字。`
    ).toBe(0)
  })

  // ===================================================================
  // 第三层: PR 模板 ≥ 5 个 checkbox
  // ===================================================================
  test('5/17 源码级: PR 模板 ≥ 5 个 checkbox (RULE 1 必填 + 截图/录屏区等)', () => {
    const content = readFileSync(PR_TEMPLATE, 'utf8')
    const checkboxes = content.match(/^\s*-\s*\[\s*[xX ]\s*\]\s+/gm) || []
    expect(
      checkboxes.length,
      `PR 模板 checkbox 数量 = ${checkboxes.length}, 期望 ≥ 5。\n` +
        `5 项 RULE 1 checkbox 是最低要求, 实际模板通常含 30+ 个 (含截图/录屏/回归清单)。`
    ).toBeGreaterThanOrEqual(5)
  })

  // ===================================================================
  // 第三层: PR 模板含 RULE 1 章节引用
  // ===================================================================
  test('6/17 源码级: PR 模板含 RULE 1 章节引用 (可追溯到 AGENTS.md 第 28 章)', () => {
    const content = readFileSync(PR_TEMPLATE, 'utf8')
    expect(
      content.includes('RULE 1') || content.includes('RULE1'),
      `PR 模板未引用 RULE 1, 开发者无法追溯到 AGENTS.md 第 28 章。\n` +
        `修复: 在 PR 模板头部或 description 中显式说明 "本 PR 遵循 RULE 1 (AGENTS.md 第 28 章)"。`
    ).toBe(true)
  })

  // ===================================================================
  // 第三层: PR 模板含截图验证区段
  // ===================================================================
  test('7/17 源码级: PR 模板含"截图验证"区段 (UI 改动必填)', () => {
    const content = readFileSync(PR_TEMPLATE, 'utf8')
    expect(
      content.includes('截图') || content.includes('screenshot'),
      `PR 模板未含"截图验证"区段, UI 改动可能无截图即 merge。\n` +
        `AGENTS.md 强约束: 涉及 UI 必须附浅色 + 暗色 + 视觉对比 3 套截图。`
    ).toBe(true)
  })

  // ===================================================================
  // 第四层: AGENTS.md 第 28 章含 commit-msg 守门关键字
  // ===================================================================
  test('8/17 源码级: AGENTS.md 第 28 章含 "check-rule1-commit-msg" 关键字 (第一层证据)', () => {
    const content = readFileSync(AGENTS_MD, 'utf8')
    expect(
      content.includes('check-rule1-commit-msg'),
      `AGENTS.md 第 28 章未提及 check-rule1-commit-msg.mjs, 第一层 commit-msg 守门无文字证据。\n` +
        `修复: 在第 28 章"五层防回归"第一层加入 "client/scripts/check-rule1-commit-msg.mjs" 关键字。`
    ).toBe(true)
  })

  // ===================================================================
  // 第四层: AGENTS.md 第 28 章含 PR 模板守门关键字
  // ===================================================================
  test('9/17 源码级: AGENTS.md 第 28 章含 "check-rule1-pr-template" 关键字 (第三层证据)', () => {
    const content = readFileSync(AGENTS_MD, 'utf8')
    expect(
      content.includes('check-rule1-pr-template'),
      `AGENTS.md 第 28 章未提及 check-rule1-pr-template.mjs, 第三层 PR 模板守门无文字证据。\n` +
        `修复: 在第 28 章"五层防回归"第三层加入 "client/scripts/check-rule1-pr-template.mjs" 关键字。`
    ).toBe(true)
  })

  // ===================================================================
  // 第四层: AGENTS.md 第 28 章含 PR 模板文件路径
  // ===================================================================
  test('10/17 源码级: AGENTS.md 第 28 章含 ".github/pull_request_template.md" 文件路径', () => {
    const content = readFileSync(AGENTS_MD, 'utf8')
    expect(
      content.includes('.github/pull_request_template.md') || content.includes('pull_request_template'),
      `AGENTS.md 第 28 章未引用 PR 模板文件路径, 开发者无法找到模板位置。\n` +
        `修复: 在第 28 章明确写 ".github/pull_request_template.md"。`
    ).toBe(true)
  })

  // ===================================================================
  // 第四层: DESIGN.md 附录 B 含 5 层 RULE 1 硬约束
  // ===================================================================
  test('11/17 源码级: DESIGN.md 附录 B 含 5 层 RULE 1 硬约束描述', () => {
    const content = readFileSync(DESIGN_MD, 'utf8')
    expect(
      content.includes('commit-msg 钩子') && content.includes('PR 模板'),
      `DESIGN.md 附录 B 未含 5 层 RULE 1 描述 (commit-msg 钩子 + PR 模板等关键层)。\n` +
        `修复: 在 DESIGN.md 附录 B 补齐 B.1-B.5 五层结构。`
    ).toBe(true)
  })

  // ===================================================================
  // 第一层: .husky/commit-msg 存在
  // ===================================================================
  test('12/17 源码级: .husky/commit-msg 钩子存在 (第一层 commit-msg 入口)', () => {
    expect(
      existsSync(HUSKY_COMMIT_MSG),
      `.husky/commit-msg 不存在: ${HUSKY_COMMIT_MSG}\n` +
        `无 commit-msg 钩子 = RULE 1 第一层失守。\n` +
        `修复: 创建 .husky/commit-msg 调用 check-rule1-commit-msg.mjs。`
    ).toBe(true)
  })

  // ===================================================================
  // 第一层: .git/hooks/commit-msg 同步
  // ===================================================================
  test('13/17 源码级: .git/hooks/commit-msg 钩子存在 (git 实际查找的目标)', () => {
    expect(
      existsSync(GIT_HOOKS_COMMIT_MSG),
      `.git/hooks/commit-msg 不存在: ${GIT_HOOKS_COMMIT_MSG}\n` +
        `即使 .husky/commit-msg 存在, git 实际查找的是 .git/hooks/commit-msg。\n` +
        `修复: cp .husky/commit-msg .git/hooks/commit-msg (或用 simple-git-hooks)。`
    ).toBe(true)
  })

  // ===================================================================
  // package.json 含 check:rule1:commit-msg 脚本
  // ===================================================================
  test('14/17 源码级: package.json 含 check:rule1:commit-msg 脚本', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'))
    expect(
      pkg.scripts['check:rule1:commit-msg'],
      `package.json scripts 缺 check:rule1:commit-msg, 开发者无法手动触发 commit-msg 守门。\n` +
        `修复: 在 package.json scripts 添加 "check:rule1:commit-msg": "node scripts/check-rule1-commit-msg.mjs"。`
    ).toBeDefined()
  })

  // ===================================================================
  // package.json 含 check:rule1:pr-template 脚本
  // ===================================================================
  test('15/17 源码级: package.json 含 check:rule1:pr-template 脚本', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'))
    expect(
      pkg.scripts['check:rule1:pr-template'],
      `package.json scripts 缺 check:rule1:pr-template, 开发者无法手动触发 PR 模板守门。\n` +
        `修复: 在 package.json scripts 添加 "check:rule1:pr-template": "node scripts/check-rule1-pr-template.mjs"。`
    ).toBeDefined()
  })

  // ===================================================================
  // simple-git-hooks commit-msg 配置
  // ===================================================================
  test('16/17 源码级: package.json simple-git-hooks.commit-msg 配置存在', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'))
    expect(
      pkg['simple-git-hooks']?.['commit-msg'],
      `package.json simple-git-hooks.commit-msg 配置缺失, simple-git-hooks 不会自动安装 commit-msg 钩子。\n` +
        `修复: 在 simple-git-hooks 添加 "commit-msg": "cd client && node scripts/check-rule1-commit-msg.mjs \\"\\${1}\\""。`
    ).toBeDefined()
    expect(
      pkg['simple-git-hooks']['commit-msg'].includes('check-rule1-commit-msg.mjs'),
      `simple-git-hooks.commit-msg 未调用 check-rule1-commit-msg.mjs。\n` +
        `实际值: ${pkg['simple-git-hooks']['commit-msg']}`
    ).toBe(true)
  })

  // ===================================================================
  // simple-git-hooks pre-push 含 check:rule1:pr-template
  // ===================================================================
  test('17/17 源码级: package.json simple-git-hooks.pre-push 含 check:rule1:pr-template', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'))
    const prePush = pkg['simple-git-hooks']?.['pre-push'] || ''
    expect(
      prePush.includes('check:rule1:pr-template'),
      `simple-git-hooks.pre-push 未含 check:rule1:pr-template, PR 模板守门不在 pre-push 阶段运行。\n` +
        `实际值: ${prePush}`
    ).toBe(true)
  })
})
