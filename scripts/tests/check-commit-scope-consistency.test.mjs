import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  inferArea,
  parseCommitMessage,
  detectPollution,
} from '../check-commit-scope-consistency.mjs'

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

// ─── detectPollution 测试:R1 §25 硬违规(verify-*.mjs) ────

test('R1: staged 含 verify-*.mjs → block', () => {
  const staged = ['apps/web/verify-dangerous-command.mjs', 'apps/web/src/page.tsx']
  const result = detectPollution(staged, 'web')
  assert.equal(result.block, true)
  assert.equal(result.rule, 'R1')
  assert.equal(result.hasVerifyFiles, true)
  assert.match(result.reason, /verify-.*\.mjs/)
})

test('R1: staged 含多个 verify-*.mjs → block (c3c864131 事故场景)', () => {
  const staged = [
    'apps/web/verify-dangerous-command.mjs',
    'apps/web/verify-permission-auto-revert.mjs',
    'apps/web/verify-permission-edge-cases.mjs',
    'apps/web/verify-permission-history.mjs',
    'apps/web/verify-permission-modals.mjs',
  ]
  const result = detectPollution(staged, 'seo')
  assert.equal(result.block, true)
  assert.equal(result.rule, 'R1')
  assert.match(result.reason, /5 个 verify/)
})

test('R1: verify-*.mjs 在子目录也触发 → block', () => {
  const staged = ['apps/web/src/lib/verify-helper.mjs']
  const result = detectPollution(staged, 'web')
  assert.equal(result.block, true)
  assert.equal(result.rule, 'R1')
})

test('R1: 非 verify 开头的 .mjs 不触发 → pass', () => {
  const staged = ['apps/web/src/lib/utils.mjs', 'scripts/check-foo.mjs']
  const result = detectPollution(staged, 'web')
  assert.equal(result.block, false)
  assert.equal(result.hasVerifyFiles, false)
})

test('R1: verify-foo.ts 不触发(只检测 .mjs) → pass', () => {
  const staged = ['apps/web/verify-permission.ts']
  const result = detectPollution(staged, 'web')
  assert.equal(result.block, false)
  assert.equal(result.hasVerifyFiles, false)
})

test('R1: scripts/verify-*.mjs 不触发(§25 白名单豁免正式工具)', () => {
  // scripts/verify-*.mjs 是正式工具(有 README/CLI/help),§25 明确豁免
  const staged = ['scripts/verify-auth-shell.mjs', 'scripts/verify-i18n.mjs']
  const result = detectPollution(staged, 'scripts')
  assert.equal(result.hasVerifyFiles, false)
  assert.equal(result.block, false)
})

test('R1: scripts/verify-*.mjs + apps/web/verify-*.mjs 混合 → 仍 block (apps/ 下违规)', () => {
  const staged = ['scripts/verify-auth-shell.mjs', 'apps/web/verify-tmp.mjs']
  const result = detectPollution(staged, 'scripts')
  assert.equal(result.hasVerifyFiles, true)
  assert.equal(result.block, true)
  assert.equal(result.rule, 'R1')
  assert.match(result.reason, /apps\/web\/verify-tmp\.mjs/)
})

// ─── detectPollution 测试:R2 i18n 污染签名 ───────────────

test('R2: i18n 文件 + scope=seo → block (c3c864131 事故场景)', () => {
  const staged = [
    'packages/i18n/messages/extension/zh-CN.json',
    'packages/i18n/messages/mobile-rn/en.json',
    'apps/web/app/layout.tsx',
  ]
  const result = detectPollution(staged, 'seo')
  assert.equal(result.block, true)
  assert.equal(result.rule, 'R2')
  assert.equal(result.hasI18nFiles, true)
  assert.match(result.reason, /scope="seo"/)
})

test('R2: i18n 文件 + scope=i18n → pass (合法跨端 i18n commit)', () => {
  const staged = [
    'packages/i18n/messages/shared/zh-CN.json',
    'packages/i18n/messages/web/zh-CN.json',
    'packages/i18n/messages/extension/zh-CN.json',
    'apps/web/src/i18n/request.ts',
  ]
  const result = detectPollution(staged, 'i18n')
  assert.equal(result.block, false)
  assert.equal(result.hasI18nFiles, true)
})

test('R2: i18n 文件 + scope=null → block (无 scope 但 touch i18n 文件)', () => {
  const staged = ['packages/i18n/messages/web/zh-CN.json']
  const result = detectPollution(staged, null)
  assert.equal(result.block, true)
  assert.equal(result.rule, 'R2')
  assert.match(result.reason, /scope="null"/)
})

test('R2: i18n 文件 + scope=web → block (混入 i18n 改动)', () => {
  const staged = ['apps/web/src/page.tsx', 'packages/i18n/messages/web/zh-CN.json']
  const result = detectPollution(staged, 'web')
  assert.equal(result.block, true)
  assert.equal(result.rule, 'R2')
})

test('R2: 非 i18n messages 路径不触发(packages/i18n/其它子路径) → pass', () => {
  // 注意:R2 只检测 packages/i18n/messages/,不检测 packages/i18n/ 根级文件
  const staged = ['packages/i18n/package.json', 'packages/i18n/README.md']
  const result = detectPollution(staged, 'i18n')
  assert.equal(result.hasI18nFiles, false)
  assert.equal(result.block, false)
})

// ─── detectPollution 测试:R3 跨端污染签名 ────────────────

test('R3: 3 个 apps 子目录 + scope=seo 不在其中 → block', () => {
  const staged = [
    'apps/web/src/page.tsx',
    'apps/api/src/routes/user.ts',
    'apps/ai-service/app/main.py',
  ]
  const result = detectPollution(staged, 'seo')
  assert.equal(result.block, true)
  assert.equal(result.rule, 'R3')
  assert.equal(result.appsSubdirs.size, 3)
  assert.ok(result.appsSubdirs.has('web'))
  assert.ok(result.appsSubdirs.has('api'))
  assert.ok(result.appsSubdirs.has('ai-service'))
  assert.match(result.reason, /3 个 apps 子目录/)
})

test('R3: 3 个 apps 子目录 + scope=null → pass (无 scope 聚合 commit 合法)', () => {
  // eebf68c92 场景:chore: 技术债清理批次 — 5 subagent 并行交付
  const staged = [
    'apps/web/src/page.tsx',
    'apps/api/src/routes/user.ts',
    'apps/ai-service/app/main.py',
  ]
  const result = detectPollution(staged, null)
  assert.equal(result.block, false)
  assert.equal(result.appsSubdirs.size, 3)
})

test('R3: 3 个 apps 子目录 + scope=web 在其中 → pass (scope 匹配某端)', () => {
  const staged = [
    'apps/web/src/page.tsx',
    'apps/api/src/routes/user.ts',
    'apps/ai-service/app/main.py',
  ]
  const result = detectPollution(staged, 'web')
  assert.equal(result.block, false)
})

test('R3: 3 个 apps 子目录 + scope=security 跨切关注点 → pass (白名单)', () => {
  const staged = [
    'apps/web/src/page.tsx',
    'apps/api/src/routes/user.ts',
    'apps/ai-service/app/main.py',
  ]
  const result = detectPollution(staged, 'security')
  assert.equal(result.block, false)
})

test('R3: 3 个 apps 子目录 + scope=deps 跨切关注点 → pass (白名单)', () => {
  const staged = [
    'apps/web/package.json',
    'apps/api/package.json',
    'apps/ai-service/requirements.txt',
  ]
  const result = detectPollution(staged, 'deps')
  assert.equal(result.block, false)
})

test('R3: 2 个 apps 子目录 → pass (阈值 ≥3 未触发)', () => {
  // 832742c41 场景:chore: 技术债批次 2 (ai-service + web)
  const staged = ['apps/ai-service/app/main.py', 'apps/web/src/page.tsx']
  const result = detectPollution(staged, 'p2')
  assert.equal(result.block, false)
  assert.equal(result.appsSubdirs.size, 2)
})

test('R3: 1 个 apps 子目录 → pass (阈值 ≥3 未触发)', () => {
  // 5aa784215 场景:feat(seo) + web
  const staged = ['apps/web/src/page.tsx', 'apps/web/src/lib/utils.ts']
  const result = detectPollution(staged, 'seo')
  assert.equal(result.block, false)
})

test('R3: 4 个 apps 子目录 + scope=husky 不在其中 → block', () => {
  const staged = [
    'apps/web/src/page.tsx',
    'apps/api/src/routes/user.ts',
    'apps/extension/src/index.tsx',
    'apps/miniapp-taro/src/pages/index.tsx',
  ]
  const result = detectPollution(staged, 'husky')
  assert.equal(result.block, true)
  assert.equal(result.rule, 'R3')
  assert.equal(result.appsSubdirs.size, 4)
})

test('R3: 跨切关注点白名单 — chore scope 跳过', () => {
  const staged = [
    'apps/web/src/page.tsx',
    'apps/api/src/routes/user.ts',
    'apps/ai-service/app/main.py',
    'apps/extension/src/index.tsx',
  ]
  const result = detectPollution(staged, 'chore')
  assert.equal(result.block, false)
})

test('R3: seo 不在跨切关注点白名单(已移除) → block', () => {
  const staged = [
    'apps/web/src/page.tsx',
    'apps/api/src/routes/user.ts',
    'apps/ai-service/app/main.py',
  ]
  const result = detectPollution(staged, 'seo')
  assert.equal(result.block, true)
  assert.equal(result.rule, 'R3')
})

// ─── detectPollution 测试:规则优先级(R1 > R2 > R3) ─────

test('规则优先级: R1 + R2 同时触发 → 返回 R1 (优先级最高)', () => {
  // c3c864131 完整场景:verify + i18n + seo
  const staged = [
    'apps/web/verify-dangerous-command.mjs',
    'packages/i18n/messages/extension/zh-CN.json',
    'packages/i18n/messages/mobile-rn/en.json',
    'scripts/_i18n-scan-helpers.mjs',
  ]
  const result = detectPollution(staged, 'seo')
  assert.equal(result.block, true)
  assert.equal(result.rule, 'R1')
  assert.equal(result.hasVerifyFiles, true)
  assert.equal(result.hasI18nFiles, true)
})

test('规则优先级: R2 + R3 同时触发 → 返回 R2 (R1 不触发, R2 优先)', () => {
  // i18n 文件 + 3 端 + scope=seo
  const staged = [
    'packages/i18n/messages/web/zh-CN.json',
    'apps/web/src/page.tsx',
    'apps/api/src/routes/user.ts',
    'apps/ai-service/app/main.py',
  ]
  const result = detectPollution(staged, 'seo')
  assert.equal(result.block, true)
  assert.equal(result.rule, 'R2')
  assert.equal(result.hasI18nFiles, true)
  assert.equal(result.appsSubdirs.size, 3)
})

// ─── detectPollution 测试:历史 commit 回归验证 ──────────

test('回归: c3c864131 (feat(seo) 混入 i18n + verify) → block', () => {
  // 模拟 c3c864131 完整 staged 文件
  const staged = [
    'packages/i18n/messages/extension/zh-CN.json',
    'packages/i18n/messages/extension/en.json',
    'packages/i18n/messages/mobile-rn/zh-CN.json',
    'packages/i18n/messages/mobile-rn/en.json',
    'apps/web/verify-dangerous-command.mjs',
    'apps/web/verify-permission-auto-revert.mjs',
    'apps/web/verify-permission-edge-cases.mjs',
    'apps/web/verify-permission-history.mjs',
    'apps/web/verify-permission-modals.mjs',
    'scripts/_i18n-scan-helpers.mjs',
    'scripts/tests/scan-web-dead-i18n-keys.test.mjs',
    '.github/workflows/i18n-dead-key-audit.yml',
    'apps/web/app/layout.tsx',
    'apps/web/public/28002fe3810402b5d0fd37fbd0c6c087.txt',
  ]
  const { scope } = parseCommitMessage('feat(seo): IndexNow key 文件 + 站长平台验证 meta 占位')
  assert.equal(scope, 'seo')
  const result = detectPollution(staged, scope)
  assert.equal(result.block, true)
  // R1 优先级最高(含 verify-*.mjs)
  assert.equal(result.rule, 'R1')
})

test('回归: eebf68c92 (chore 技术债批次 + 3 apps 无 scope) → pass (无 scope 跳过 R3)', () => {
  const staged = [
    'apps/web/src/page.tsx',
    'apps/api/src/routes/user.ts',
    'apps/ai-service/app/main.py',
  ]
  const { scope } = parseCommitMessage('chore: 技术债清理批次 — 5 subagent 并行交付')
  assert.equal(scope, null)
  const result = detectPollution(staged, scope)
  assert.equal(result.block, false)
})

test('回归: 82084554e (refactor(i18n) 跨 5 端 i18n) → pass (scope=i18n 跳过 R2)', () => {
  const staged = [
    'packages/i18n/messages/shared/zh-CN.json',
    'packages/i18n/messages/web/zh-CN.json',
    'packages/i18n/messages/extension/zh-CN.json',
    'packages/i18n/messages/miniapp-taro/zh-CN.json',
    'packages/i18n/messages/mobile-rn/zh-CN.json',
  ]
  const { scope } = parseCommitMessage('refactor(i18n): P2 i18n 域去重 — 12 个跨端一致 key 提升到 shared')
  assert.equal(scope, 'i18n')
  const result = detectPollution(staged, scope)
  assert.equal(result.block, false)
})

test('回归: ee84f416d (feat(scripts) 单一领域) → pass', () => {
  const staged = [
    'scripts/check-commit-scope-consistency.mjs',
    'scripts/tests/check-commit-scope-consistency.test.mjs',
    '.husky/commit-msg',
  ]
  const { scope } = parseCommitMessage('feat(scripts): 新增 commit scope 一致性守门(防 git add -A 污染)')
  assert.equal(scope, 'scripts')
  const result = detectPollution(staged, scope)
  assert.equal(result.block, false)
})

test('回归: 5aa784215 (feat(seo) + web 单端) → pass', () => {
  const staged = ['apps/web/src/app/seo/page.tsx', 'apps/web/src/lib/seo-utils.ts']
  const { scope } = parseCommitMessage('feat(seo): 3 页面集成 JSON-LD schema')
  assert.equal(scope, 'seo')
  const result = detectPollution(staged, scope)
  assert.equal(result.block, false)
})

test('回归: f719d9a84 (feat(p2) + ai-service + api 2 端) → pass (R3 阈值未到)', () => {
  const staged = ['apps/ai-service/app/main.py', 'apps/api/src/routes/spec.ts']
  const { scope } = parseCommitMessage('feat(p2): 5 任务并行交付  news.ts TS2307 修复 + 字典化 G1/G2 收尾 + guardian warnblocking')
  assert.equal(scope, 'p2')
  const result = detectPollution(staged, scope)
  assert.equal(result.block, false)
})

test('回归: 2b22fd42e (test(api) + api 单端) → pass', () => {
  const staged = ['apps/api/src/routes/user.ts', 'apps/api/test/user.test.ts']
  const { scope } = parseCommitMessage('test(api): P2-2+P2-7 补建后端路由 + 高风险路由集成测试')
  assert.equal(scope, 'api')
  const result = detectPollution(staged, scope)
  assert.equal(result.block, false)
})

test('回归: bb53bec93 (chore(i18n) + i18n 文件) → pass (scope=i18n 跳过 R2)', () => {
  const staged = [
    'packages/i18n/messages/web/zh-CN.json',
    'apps/web/messages/zh-CN.json',
    'scripts/scan-dead-i18n-keys.mjs',
  ]
  const { scope } = parseCommitMessage('chore(i18n): 清理 web 端 17 个死 key + 扫描器增强识别属性赋值引用')
  assert.equal(scope, 'i18n')
  const result = detectPollution(staged, scope)
  assert.equal(result.block, false)
})

// ─── 边界场景测试 ────────────────────────────────────────

test('边界: 空 staged → pass', () => {
  const result = detectPollution([], 'web')
  assert.equal(result.block, false)
})

test('边界: 未知领域文件 → pass (无 apps 子目录)', () => {
  const staged = ['README.md', 'docs/index.md']
  const result = detectPollution(staged, 'docs')
  assert.equal(result.block, false)
  assert.equal(result.appsSubdirs.size, 0)
})

test('边界: scope 在 apps 子目录但跨切关注点白名单 → 跳过 R3', () => {
  // web 既在 APP_AREAS 又在 CROSS_CUTTING_SCOPES? 不,CROSS_CUTTING_SCOPES 不含 web
  // 这里测试 scope=web + 3 端 → pass (scope 在 appsSubdirs)
  const staged = [
    'apps/web/src/page.tsx',
    'apps/api/src/routes/user.ts',
    'apps/extension/src/index.tsx',
  ]
  const result = detectPollution(staged, 'web')
  assert.equal(result.block, false)
})

test('边界: verify-foo.mjs 在根目录 → block (正则匹配根级)', () => {
  const staged = ['verify-tmp.mjs']
  const result = detectPollution(staged, 'scripts')
  assert.equal(result.hasVerifyFiles, true)
  assert.equal(result.block, true)
  assert.equal(result.rule, 'R1')
})
