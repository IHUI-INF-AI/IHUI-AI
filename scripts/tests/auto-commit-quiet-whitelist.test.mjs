// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 收编器「路径白名单」镜像测试(§22c:直接 import 生产判据,不复制一份)。
 *
 * 立因:2026-11-02 枚 ef1c716616「chore: 收编停留≥3分钟的未提交改动」把 7 件实质回退与
 * 3 个半成品测试自动送进主干 —— 旧收编器除 .env/二进制外**全收**,唯一判据只是"停笔 3 分钟"。
 * 收窄后只允许文档与派生产物,`apps/**`/`packages/**` 业务代码与测试、AGENTS.md/PROJECT_PLAN.md
 * 一律不收编;无法判定归属的路径 fail-safe 落"不收编"。
 *
 * 本测试锁三件事:①白名单正反例;②fail-safe 方向;③判据真的接进主流程(§0.9 造好没装车=没有)。
 * 另含一条反向例:把判定替换成"全收编"必须让"只收编 README"的断言红。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as auto } from '../auto-commit-quiet.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** 用户要求的现场形状:一个 apps/api 业务文件 + 一个 README + 一个 packages 测试。 */
const MIXED_BATCH = [
  'apps/api/src/routes/relay-account.ts',
  'README.md',
  'packages/app/src/host/ports.test.ts',
]

/** 规则文件也必须在白名单外。 */
const RULE_FILES = ['AGENTS.md', 'PROJECT_PLAN.md']

/** 明确属于派生产物、必须允许收编的路径。 */
const DERIVED = [
  '.doc-autoupdate/last-sha',
  'apps/web/src/lib/ui-routes.generated.ts',
  'apps/miniapp-taro/src/i18n/generated/zh-cn-pack.gen.ts',
  'apps/mobile-rn/src/i18n/generated/remote-locales.gen.ts',
  'apps/miniapp-taro/src/assets/remote-locales/en.b64.txt',
  'scripts/data/root-guard-manifest.json',
  'README.en.md',
  'README.ja.md',
  'README.ko.md',
]

/** 反向例用的断言封装:期望只收编 README,其余原封不动。 */
function assertOnlyReadme(paths, predicate) {
  const { collected, held } = auto.partitionCollectible(paths, predicate)
  assert.deepEqual(collected, ['README.md'])
  assert.deepEqual(held, paths.filter((p) => p !== 'README.md'))
}

test('白名单:README 收编,apps/api 业务文件与 packages 测试不收编', () => {
  assertOnlyReadme(MIXED_BATCH)
  // 逐条点名,避免"结果对了但判据走错门"
  assert.equal(auto.isCollectible('README.md'), true)
  assert.equal(auto.isCollectible('apps/api/src/routes/relay-account.ts'), false)
  assert.equal(auto.isCollectible('packages/app/src/host/ports.test.ts'), false)
})

test('白名单:规则文件(AGENTS.md / PROJECT_PLAN.md)不收编', () => {
  const { collected } = auto.partitionCollectible(RULE_FILES)
  assert.deepEqual(collected, [])
})

test('白名单:派生产物逐条允许收编', () => {
  for (const p of DERIVED) assert.equal(auto.isCollectible(p), true, `${p} 应允许收编`)
})

test('白名单:apps/packages 下的普通业务代码与测试一律不收编', () => {
  const business = [
    'apps/web/src/components/settings/predictive-edit-card.tsx',
    'apps/api/tests/subagents-id-ownership.test.ts',
    'apps/mobile-rn/src/host/host-toast.ts',
    'packages/app/src/features/vip-benefit/vip-benefit-tier-catalog.ts',
    'packages/types/src/app-host-ports.ts',
    'scripts/check-plan-claims-vs-head.mjs',
    'docs/some-page.md',
  ]
  for (const p of business) assert.equal(auto.isCollectible(p), false, `${p} 不应收编`)
})

test('fail-safe:无法判定归属的路径一律不收编', () => {
  const unknown = ['', 'tmp/whatever', 'apps', 'README', 'scripts/data/other.json', 'a.generated.ts.bak']
  for (const p of unknown) assert.equal(auto.isCollectible(p), false, `${JSON.stringify(p)} 不应收编`)
})

test('Windows 反斜杠形态同判', () => {
  assert.equal(auto.isCollectible('apps\\miniapp-taro\\src\\i18n\\generated\\zh-cn-pack.gen.ts'), true)
  assert.equal(auto.isCollectible('apps\\api\\src\\routes\\relay-account.ts'), false)
})

test('反向例:把白名单判定改成"全收编" ⇒ 上述断言必红', () => {
  // 模拟"白名单失效"的最小改动:predicate 恒真。
  assert.throws(() => assertOnlyReadme(MIXED_BATCH, () => true))
  assert.throws(() => {
    const { collected } = auto.partitionCollectible(RULE_FILES, () => true)
    assert.deepEqual(collected, [])
  })
  assert.throws(() => {
    const { collected } = auto.partitionCollectible(
      ['apps/api/tests/subagents-id-ownership.test.ts'],
      () => true,
    )
    assert.deepEqual(collected, [])
  })
})

test('装车锁:main() 真的用 isCollectible 过滤候选(造好没装车=没有)', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'auto-commit-quiet.mjs'), 'utf8')
  assert.match(src, /rawChanges\.filter\(\(c\) => isCollectible\(c\.path\)\)/, '主流程必须按白名单过滤候选')
  assert.match(src, /const held = rawChanges\.filter\(\(c\) => !isCollectible\(c\.path\)\)/, '白名单外必须单独留档并记日志')
  // 白名单判定不得退化为恒真
  assert.match(src, /return COLLECT_WHITELIST\.some\(\(re\) => re\.test\(p\)\)/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
