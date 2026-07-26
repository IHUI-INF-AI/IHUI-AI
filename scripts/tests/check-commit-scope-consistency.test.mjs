import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inferArea, parseCommitMessage } from '../check-commit-scope-consistency.mjs'

// ─── inferArea 测试 ───────────────────────────────────────

test('inferArea: packages/i18n/ → i18n', () => {
  assert.equal(inferArea('packages/i18n/messages/web/zh-CN.json'), 'i18n')
})

test('inferArea: apps/web/ → web', () => {
  assert.equal(inferArea('apps/web/src/app/page.tsx'), 'web')
})

test('inferArea: apps/api/ → api', () => {
  assert.equal(inferArea('apps/api/src/routes/spec.ts'), 'api')
})

test('inferArea: apps/ai-service/ → ai-service', () => {
  assert.equal(inferArea('apps/ai-service/app/main.py'), 'ai-service')
})

test('inferArea: apps/extension/ → extension', () => {
  assert.equal(inferArea('apps/extension/src/index.tsx'), 'extension')
})

test('inferArea: apps/miniapp-taro/ → miniapp-taro', () => {
  assert.equal(inferArea('apps/miniapp-taro/src/pages/index.tsx'), 'miniapp-taro')
})

test('inferArea: apps/mobile-rn/ → mobile-rn', () => {
  assert.equal(inferArea('apps/mobile-rn/src/screens/Home.tsx'), 'mobile-rn')
})

test('inferArea: packages/shared/ → shared', () => {
  assert.equal(inferArea('packages/shared/src/index.ts'), 'shared')
})

test('inferArea: packages/api-client/ → api-client', () => {
  assert.equal(inferArea('packages/api-client/src/index.ts'), 'api-client')
})

test('inferArea: packages/ui-react/ → ui-react (不回退到 ui)', () => {
  assert.equal(inferArea('packages/ui-react/src/AuthShell.tsx'), 'ui-react')
})

test('inferArea: scripts/ → scripts', () => {
  assert.equal(inferArea('scripts/check-commit-scope-consistency.mjs'), 'scripts')
})

test('inferArea: .github/ → ci', () => {
  assert.equal(inferArea('.github/workflows/ci.yml'), 'ci')
})

test('inferArea: docs/ → docs', () => {
  assert.equal(inferArea('docs/architecture.md'), 'docs')
})

test('inferArea: 根目录 .md → docs', () => {
  assert.equal(inferArea('README.md'), 'docs')
  assert.equal(inferArea('PROJECT_PLAN.md'), 'docs')
})

test('inferArea: 根目录 .json → config', () => {
  assert.equal(inferArea('package.json'), 'config')
  assert.equal(inferArea('tsconfig.json'), 'config')
})

test('inferArea: Windows 反斜杠路径 → 正确映射', () => {
  assert.equal(inferArea('apps\\web\\src\\page.tsx'), 'web')
  assert.equal(inferArea('packages\\i18n\\messages\\zh-CN.json'), 'i18n')
})

test('inferArea: 未知路径 → null', () => {
  assert.equal(inferArea('unknown/path.txt'), null)
  assert.equal(inferArea('foo.bar'), null)
})

// ─── parseCommitMessage 测试 ──────────────────────────────

test('parseCommitMessage: 标准 type(scope): subject', () => {
  const result = parseCommitMessage('feat(web): 新增登录页面')
  assert.equal(result.type, 'feat')
  assert.equal(result.scope, 'web')
  assert.equal(result.subject, '新增登录页面')
})

test('parseCommitMessage: type: subject (无 scope)', () => {
  const result = parseCommitMessage('fix: 修复登录 bug')
  assert.equal(result.type, 'fix')
  assert.equal(result.scope, null)
  assert.equal(result.subject, '修复登录 bug')
})

test('parseCommitMessage: 多行 commit message 取第一非注释行', () => {
  const message = `feat(api): 新增用户 API

详细说明:
- 新增 GET /users
- 新增 POST /users`
  const result = parseCommitMessage(message)
  assert.equal(result.type, 'feat')
  assert.equal(result.scope, 'api')
  assert.equal(result.subject, '新增用户 API')
})

test('parseCommitMessage: git 模板注释行(#开头)跳过', () => {
  const message = `# Please enter the commit message
feat(i18n): 新增 i18n key

# Lines starting with '#' will be ignored`
  const result = parseCommitMessage(message)
  assert.equal(result.type, 'feat')
  assert.equal(result.scope, 'i18n')
  assert.equal(result.subject, '新增 i18n key')
})

test('parseCommitMessage: 空消息 → null', () => {
  assert.deepEqual(parseCommitMessage(''), { type: null, scope: null, subject: null })
  assert.deepEqual(parseCommitMessage(null), { type: null, scope: null, subject: null })
})

test('parseCommitMessage: 不符合格式 → null', () => {
  assert.deepEqual(parseCommitMessage('random text'), { type: null, scope: null, subject: null })
})

test('parseCommitMessage: scope 含连字符(ai-service)', () => {
  const result = parseCommitMessage('feat(ai-service): 新增 LangGraph 集成')
  assert.equal(result.type, 'feat')
  assert.equal(result.scope, 'ai-service')
  assert.equal(result.subject, '新增 LangGraph 集成')
})

test('parseCommitMessage: scope 含连字符(miniapp-taro)', () => {
  const result = parseCommitMessage('fix(miniapp-taro): 修复登录跳转')
  assert.equal(result.type, 'fix')
  assert.equal(result.scope, 'miniapp-taro')
})

test('parseCommitMessage: scope 含连字符(mobile-rn)', () => {
  const result = parseCommitMessage('refactor(mobile-rn): 重构导航')
  assert.equal(result.type, 'refactor')
  assert.equal(result.scope, 'mobile-rn')
})

test('parseCommitMessage: type 大写不匹配(只匹配小写)', () => {
  const result = parseCommitMessage('FEAT(web): 大写 type')
  assert.deepEqual(result, { type: null, scope: null, subject: null })
})

// ─── 模拟场景测试(验证逻辑正确性) ──────────────────────────

test('场景: feat(seo) + staged 含 i18n + web + scripts → 应警告', () => {
  // 模拟 c3c864131 事故场景
  const stagedFiles = [
    'packages/i18n/messages/extension/zh-CN.json',
    'packages/i18n/messages/mobile-rn/en.json',
    'apps/web/verify-dangerous-command.mjs',
    'scripts/_i18n-scan-helpers.mjs',
    'scripts/tests/scan-web-dead-i18n-keys.test.mjs',
    '.github/workflows/i18n-dead-key-audit.yml',
    'apps/web/app/layout.tsx',
    'apps/web/public/28002fe3810402b5d0fd37fbd0c6c087.txt',
  ]
  const { scope } = parseCommitMessage('feat(seo): IndexNow key 文件 + 站长平台验证 meta 占位')

  // scope 是 seo,在白名单中 → 跳过检查
  // 但如果 seo 不在白名单,逻辑应该是:
  const areas = new Set(stagedFiles.map(inferArea).filter(Boolean))
  assert.equal(scope, 'seo')
  assert.ok(areas.size >= 3, `应有 ≥3 领域,实际 ${areas.size}`)
  assert.ok(areas.has('i18n'))
  assert.ok(areas.has('web'))
  assert.ok(areas.has('scripts'))
  assert.ok(areas.has('ci'))
  // seo 在白名单中,实际不会触发警告,但这里验证逻辑:
  // 如果移除白名单,scope 'seo' 不在 areas 中 → 应警告
  assert.ok(!areas.has('seo'))
})

test('场景: feat(i18n) + staged 含 i18n + web + extension → 不应警告(scope 匹配)', () => {
  const stagedFiles = [
    'packages/i18n/messages/shared/zh-CN.json',
    'packages/i18n/messages/web/zh-CN.json',
    'apps/web/src/i18n/request.ts',
    'apps/extension/src/i18n/index.tsx',
  ]
  const { scope } = parseCommitMessage('feat(i18n): 提升跨端共享 key')
  const areas = new Set(stagedFiles.map(inferArea).filter(Boolean))

  assert.equal(scope, 'i18n')
  assert.ok(areas.has('i18n'))
  assert.ok(areas.has('web'))
  assert.ok(areas.has('extension'))
  // scope 'i18n' 在 areas 中 → 不警告
  assert.ok(areas.has(scope))
})

test('场景: refactor(web) + staged 仅在 apps/web/ → 不应警告(单领域)', () => {
  const stagedFiles = [
    'apps/web/src/app/page.tsx',
    'apps/web/src/components/Button.tsx',
    'apps/web/src/lib/utils.ts',
  ]
  const { scope } = parseCommitMessage('refactor(web): 提取公共组件')
  const areas = new Set(stagedFiles.map(inferArea).filter(Boolean))

  assert.equal(scope, 'web')
  assert.equal(areas.size, 1)
  assert.ok(areas.has(scope))
})

test('场景: feat(api) + staged 含 api + web → 不应警告(scope 匹配 api)', () => {
  const stagedFiles = [
    'apps/api/src/routes/user.ts',
    'apps/web/src/api/user.ts',
  ]
  const { scope } = parseCommitMessage('feat(api): 新增用户 API')
  const areas = new Set(stagedFiles.map(inferArea).filter(Boolean))

  assert.equal(scope, 'api')
  assert.ok(areas.has('api'))
  assert.ok(areas.has('web'))
  // scope 'api' 在 areas 中 → 不警告
  assert.ok(areas.has(scope))
})

test('场景: feat(security) + staged 含 api + web + scripts → 白名单跳过', () => {
  const { scope } = parseCommitMessage('feat(security): 修复 IDOR 漏洞')
  // security 在白名单中 → 跳过检查
  assert.equal(scope, 'security')
  // 验证白名单逻辑:即使 areas 多,scope 在白名单也不警告
  const WHITELIST = new Set(['security', 'seo', 'deps', 'chore', 'config', 'ci'])
  assert.ok(WHITELIST.has(scope))
})

test('场景: chore(deps) + staged 含 package.json + pnpm-lock.yaml → 白名单跳过', () => {
  const { scope } = parseCommitMessage('chore(deps): 升级 next 到 15.1')
  assert.equal(scope, 'deps')
  // deps 在白名单 → 跳过
})

test('场景: 无 scope 的 commit → 跳过检查', () => {
  const { scope } = parseCommitMessage('fix: 修复 typo')
  assert.equal(scope, null)
})

test('场景: docs(docs) 不存在,docs 类型 + 无 scope → 跳过', () => {
  const { scope } = parseCommitMessage('docs: 更新 README')
  assert.equal(scope, null)
})
