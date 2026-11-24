// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * @file check-staged-artifacts.test.mjs 判据单测
 * @description 钉住 scripts/check-staged-artifacts.mjs 的判据单元(不跑 git,只测纯函数):
 *   - 真 0:真实源码/文档/配置一律放行
 *   - 真违规:生成物目录、一次性实验目录、日志/副本名、根目录媒体与错位源文件必须命中
 *   - 画像分桶:源码/文档/配置/其他 不得串桶
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __test__ } from '../check-staged-artifacts.mjs'

const { judgePath, bucketOf, judgeStaged, parseNameStatus, parseArgs, isArtifactDirExempt } = __test__

test('真实代码改动一律放行', () => {
  const allowed = [
    'apps/api/src/services/relay-account-pool-service.ts',
    'apps/web/app/(main)/admin/finance-ai/page.tsx',
    'packages/database/drizzle/20261112000001_api_subscriptions_order_no_uniq.sql',
    'scripts/check-staged-artifacts.mjs',
    'packages/i18n/messages/web/zh-CN.json',
    'README.md',
    'vitest.config.ts',
    'next.config.mjs',
  ]
  for (const file of allowed) assert.equal(judgePath(file), null, `${file} 不应被判为生成物`)
})

test('生成物目录必须命中', () => {
  assert.match(judgePath('.archify/verify/server.log') ?? '', /\.archify/)
  assert.match(judgePath('.agent_tmp/todo.txt') ?? '', /\.agent_tmp/)
  assert.match(judgePath('archify-work/out.html') ?? '', /archify-work/)
  assert.match(judgePath('packages/database/drizzle-copy/0000_init.sql') ?? '', /drizzle-copy/)
  assert.match(judgePath('experiments/_itmp_0072b3c7/x.json') ?? '', /_itmp/)
  assert.match(judgePath('experiments/iso-0371+372/x.json') ?? '', /iso-/)
})

test('连接器目录覆盖面板源码精确豁免 coverage 生成物判定(2026-11-24)', () => {
  // 业务代码目录:按完整前缀放行,源码与测试文件均不得被误判
  const business = [
    'apps/web/src/components/connectors/coverage/coverage-panel.tsx',
    'apps/web/src/components/connectors/coverage/__tests__/coverage-panel.test.tsx',
    'apps/web/src/components/connectors/coverage/types.ts',
  ]
  for (const file of business) {
    assert.equal(isArtifactDirExempt(file.replace(/\\/g, '/')), true, `${file} 应命中业务豁免前缀`)
    assert.equal(judgePath(file), null, `${file} 不应被判为生成物`)
  }

  // 反向:测试覆盖率产物与其他 coverage 目录仍必须拦(豁免不得泛化)
  assert.match(judgePath('apps/web/coverage/index.html') ?? '', /coverage/)
  assert.match(judgePath('coverage/lcov-report/index.html') ?? '', /coverage/)
  assert.match(judgePath('apps/api/src/coverage/snapshot.json') ?? '', /coverage/)
  // 边界:前缀必须以 '/' 收口,"coverage-evil" 不得蹭豁免
  assert.equal(
    isArtifactDirExempt('apps/web/src/components/connectors/coverage-evil/x.ts'),
    false
  )
  assert.equal(
    isArtifactDirExempt('apps/web/src/components/connectors/coverageX/x.ts'),
    false
  )

  // 豁免目录内若真出现生成物形态(日志/实验目录),仍按原判据拦,不得整目录免检
  assert.match(
    judgePath('apps/web/src/components/connectors/coverage/_itmp_debug/x.ts') ?? '',
    /一次性实验目录/
  )
  assert.match(
    judgePath('apps/web/src/components/connectors/coverage/build.log') ?? '',
    /日志/
  )
})

test('一次性产物名必须命中', () => {
  assert.match(judgePath('.commit-msg.txt') ?? '', /提交信息草稿/)
  assert.match(judgePath('apps/cli/agent.keep.ts') ?? '', /兼容分析抓包副本/)
  assert.match(judgePath('apps/api/tmp-diag.log') ?? '', /日志/)
})

test('根目录媒体与错位源文件必须命中,配置文件豁免', () => {
  assert.match(judgePath('archify-final.png') ?? '', /媒体/)
  assert.match(judgePath('capability.ts') ?? '', /错位源文件/)
  assert.equal(judgePath('eslint.config.js'), null)
})

test('提交画像分桶不串桶', () => {
  assert.equal(bucketOf('apps/api/src/a.ts'), '源码')
  assert.equal(bucketOf('docs/README.md'), '文档')
  assert.equal(bucketOf('packages/i18n/messages/web/ja.json'), '配置')
  assert.equal(bucketOf('Makefile'), '其他')
})

test('judgeStaged 同时给出违规面与画像', () => {
  const { violations, buckets, total } = judgeStaged([
    { status: 'A', file: 'apps/api/src/a.ts' },
    { status: 'M', file: 'README.md' },
    { status: 'A', file: '.archify/verify/snapshot-backfill/x.json' },
  ])
  assert.equal(total, 3)
  assert.equal(violations.length, 1)
  assert.equal(violations[0].file, '.archify/verify/snapshot-backfill/x.json')
  assert.equal(buckets.源码, 1)
  assert.equal(buckets.文档, 1)
})

test('parseNameStatus 解析新增/修改/重命名,重命名取新路径', () => {
  const out = [
    'A\tapps/api/src/a.ts',
    'M\tREADME.md',
    'R100\told/place.ts\tapps/web/app/page.tsx',
    '',
  ].join('\n')
  assert.deepEqual(parseNameStatus(out), [
    { status: 'A', file: 'apps/api/src/a.ts' },
    { status: 'M', file: 'README.md' },
    { status: 'R', file: 'apps/web/app/page.tsx' },
  ])
})

test('parseArgs 支持 --rev 可重复,缺参/未知参数不静默忽略', () => {
  assert.deepEqual(parseArgs([]), { revs: [], reportOnly: false, quiet: false })
  assert.deepEqual(parseArgs(['--rev', 'a..b', '--rev', 'c..d', '--report', '--quiet']), {
    revs: ['a..b', 'c..d'],
    reportOnly: true,
    quiet: true,
  })
  assert.throws(() => parseArgs(['--rev']), /--rev 缺少/)
  assert.throws(() => parseArgs(['--bogus']), /未知参数/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
