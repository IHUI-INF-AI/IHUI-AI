// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/e2e-autofill.test.mjs — 测试缺口自动补测器的镜像测试(§22c)。
 *
 * 被测对象是**生产判据本身**(import `__test__`,不在本文件复算)。输入全是构造面:
 * 不派生 git、不碰工作树判定面、不用 os.tmpdir()(夹具走 mkScratch)。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { __test__, loadMap } from '../e2e-autofill.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const {
  isAuditedSource,
  isTestFile,
  isE2eSpec,
  appOf,
  routeSlugOf,
  stemOf,
  tokensOf,
  suggestedSpecOf,
  caseNameOf,
  safeSpecPath,
  indexTests,
  testCoversModule,
  diffGaps,
  selectEmitTarget,
  skeletonFor,
  writeSkeleton,
  parseArgs,
  main,
} = __test__

const MAP = loadMap()
const ROUTE = 'apps/web/app/(main)/admin/users/page.tsx'

describe('e2e-autofill 映射基线(单一真相源)', () => {
  it('基线自带三根 + 四族配方,脚本内不另抄清单', () => {
    assert.deepEqual(MAP.audit.roots, ['apps/web/app', 'apps/web/src', 'apps/api/src'])
    assert.deepEqual(
      MAP.recipes.map((r) => r.id),
      ['web-route', 'web-unit', 'api-unit-collected', 'api-unit-other'],
    )
    assert.equal(MAP.version, 1)
  })

  it('显式映射表是对象;坏形态由 loadMap 判未判定(构造面)', () => {
    assert.equal(typeof (MAP.mappings ?? {}), 'object')
    assert.equal(Array.isArray(MAP.mappings ?? {}), false)
  })
})

describe('e2e-autofill 扫描面(只 apps/web、apps/api,忽略噪音/测试/样板)', () => {
  it('正常源文件在审;测试文件/噪音/barrel/类型声明不在审', () => {
    assert.equal(isAuditedSource('apps/web/src/lib/foo.ts', MAP), true)
    assert.equal(isAuditedSource('apps/web/src/lib/foo.test.ts', MAP), false)
    assert.equal(isAuditedSource('apps/web/src/node_modules/x.ts', MAP), false)
    assert.equal(isAuditedSource('apps/web/.next/x.ts', MAP), false)
    assert.equal(isAuditedSource('apps/api/src/lib/index.ts', MAP), false)
    assert.equal(isAuditedSource('apps/api/src/db/types.d.ts', MAP), false)
    assert.equal(isAuditedSource('apps/mobile-rn/src/foo.ts', MAP), false)
  })

  it('测试文件识别覆盖 spec/test/node-test 三族', () => {
    assert.equal(isTestFile('apps/web/e2e/foo.spec.ts', MAP), true)
    assert.equal(isTestFile('apps/web/src/__tests__/foo.test.ts', MAP), true)
    assert.equal(isTestFile('apps/web/src/__tests__/foo.node-test.mjs', MAP), true)
    assert.equal(isTestFile('apps/web/src/foo.ts', MAP), false)
    assert.equal(isE2eSpec('apps/web/e2e/foo.spec.ts', MAP), true)
    assert.equal(isE2eSpec('apps/web/src/__tests__/foo.spec.ts', MAP), false)
    assert.equal(appOf('apps/api/src/x.ts'), 'api')
    assert.equal(appOf('packages/ui/src/x.ts'), null)
  })
})

describe('e2e-autofill 建议 spec 落点(必须被现有 vitest/playwright 配置识别)', () => {
  it('web 路由 → apps/web/e2e/<slug>.spec.ts', () => {
    assert.equal(routeSlugOf(ROUTE), 'admin-users')
    assert.equal(routeSlugOf('apps/web/app/page.tsx'), 'home')
    assert.equal(suggestedSpecOf(ROUTE, MAP), 'apps/web/e2e/admin-users.spec.ts')
  })

  it('web 代码 → 模块旁 __tests__;tsx 用 .test.tsx', () => {
    assert.equal(
      suggestedSpecOf('apps/web/src/lib/foo.ts', MAP),
      'apps/web/src/lib/__tests__/foo.test.ts',
    )
    assert.equal(
      suggestedSpecOf('apps/web/src/components/Bar.tsx', MAP),
      'apps/web/src/components/__tests__/Bar.test.tsx',
    )
  })

  it('api 四目录 → src/<area>/__tests__;其它目录 → tests/<area>/(vitest include 认)', () => {
    assert.equal(
      suggestedSpecOf('apps/api/src/routes/foo.ts', MAP),
      'apps/api/src/routes/__tests__/foo.test.ts',
    )
    assert.equal(
      suggestedSpecOf('apps/api/src/services/foo.ts', MAP),
      'apps/api/src/services/__tests__/foo.test.ts',
    )
    assert.equal(suggestedSpecOf('apps/api/src/lib/foo.ts', MAP), 'apps/api/tests/lib/foo.test.ts')
  })

  it('用例名带模块 key(机器可读清单的一部分)', () => {
    assert.equal(caseNameOf('apps/web/src/lib/foo.ts', MAP), 'foo 冒烟')
    assert.equal(stemOf('apps/web/src/lib/foo.node-test.mjs'), 'foo')
    assert.deepEqual(tokensOf('agentPlanApi'), ['agent', 'plan', 'api'])
  })
})

describe('e2e-autofill 覆盖判据(同包 + 同族 + key token 齐全)', () => {
  it('路由只认 e2e:同名覆盖、泛化不覆盖', () => {
    assert.equal(testCoversModule(ROUTE, 'apps/web/e2e/admin-users.spec.ts', MAP), true)
    assert.equal(testCoversModule(ROUTE, 'apps/web/e2e/admin-users-flow.spec.ts', MAP), true)
    assert.equal(testCoversModule(ROUTE, 'apps/web/e2e/admin.spec.ts', MAP), false)
    assert.equal(testCoversModule(ROUTE, 'apps/web/e2e/users.spec.ts', MAP), false)
  })

  it('代码模块只认单测:e2e 不算,跨包不算', () => {
    assert.equal(
      testCoversModule('apps/web/src/lib/foo.ts', 'apps/web/e2e/foo.spec.ts', MAP),
      false,
    )
    assert.equal(
      testCoversModule('apps/web/src/lib/foo.ts', 'apps/web/src/lib/__tests__/foo.test.ts', MAP),
      true,
    )
    assert.equal(
      testCoversModule('apps/web/src/lib/foo.ts', 'apps/api/src/lib/__tests__/foo.test.ts', MAP),
      false,
    )
  })

  it('显式映射优先于命名;映射到不存在的测试不能假装覆盖', () => {
    const mapped = {
      ...MAP,
      mappings: { 'apps/api/src/routes/foo.ts': ['apps/api/src/routes/__tests__/feature.test.ts'] },
    }
    assert.equal(
      testCoversModule(
        'apps/api/src/routes/foo.ts',
        'apps/api/src/routes/__tests__/feature.test.ts',
        mapped,
      ),
      true,
    )
    assert.equal(
      testCoversModule(
        'apps/api/src/routes/foo.ts',
        'apps/api/src/routes/__tests__/feature.test.ts',
        MAP,
      ),
      false,
    )
  })

  it('测试索引对 node_modules 免疫', () => {
    const index = indexTests(
      ['apps/web/node_modules/x/x.test.ts', 'apps/web/src/__tests__/ok.test.ts'],
      MAP,
    )
    assert.deepEqual(
      index.map((t) => t.rel),
      ['apps/web/src/__tests__/ok.test.ts'],
    )
  })
})

describe('e2e-autofill 棘轮(§0.2:只拦新增,存量只报数)', () => {
  it('新模块无测试 ⇒ 新缺口;存量同形态 ⇒ 只报数;测试被删 ⇒ 回潮算新缺口', () => {
    const diff = diffGaps({
      faceModules: ['apps/web/src/a.ts', 'apps/web/src/b.ts', 'apps/web/src/c.ts'],
      baseModules: ['apps/web/src/a.ts', 'apps/web/src/c.ts'],
      faceTests: [],
      baseTests: ['apps/web/src/__tests__/c.test.ts'],
      map: MAP,
    })
    assert.equal(
      diff.newGaps.some((g) => g.module === 'apps/web/src/b.ts'),
      true,
    )
    assert.equal(
      diff.stockGaps.some((g) => g.module === 'apps/web/src/a.ts'),
      true,
    )
    assert.equal(
      diff.newGaps.some((g) => g.module === 'apps/web/src/a.ts'),
      false,
    )
    assert.equal(
      diff.newGaps.some((g) => g.module === 'apps/web/src/c.ts'),
      true,
    )
  })

  it('新模块已带测试 ⇒ 不是缺口(反向对照:门不是一律判红)', () => {
    const diff = diffGaps({
      faceModules: ['apps/web/src/d.ts'],
      baseModules: [],
      faceTests: ['apps/web/src/__tests__/d.test.ts'],
      baseTests: [],
      map: MAP,
    })
    assert.equal(diff.gaps.length, 0)
  })

  it('缺口清单带机器可读四要素(模块/落点/用例名/框架)', () => {
    const diff = diffGaps({
      faceModules: [ROUTE],
      baseModules: [],
      faceTests: [],
      baseTests: [],
      map: MAP,
    })
    assert.deepEqual(diff.newGaps[0], {
      module: ROUTE,
      kind: 'route',
      framework: 'playwright',
      spec: 'apps/web/e2e/admin-users.spec.ts',
      caseName: 'admin-users 冒烟',
      isNew: true,
    })
  })
})

describe('e2e-autofill 骨架与写盘(默认 dry-run,已存在拒绝覆盖)', () => {
  it('骨架可被现有配置识别且不立刻造红', () => {
    const pw = skeletonFor({
      module: ROUTE,
      caseName: 'admin-users 冒烟',
      framework: 'playwright',
    })
    assert.match(pw, /from '@playwright\/test'/)
    assert.match(pw, /test\.skip\(/)
    const vi = skeletonFor({
      module: 'apps/api/src/routes/foo.ts',
      caseName: 'foo 冒烟',
      framework: 'vitest',
    })
    assert.match(vi, /from 'vitest'/)
    assert.match(vi, /it\.todo\(/)
  })

  it('写入走 wx:首次落盘成功,同名第二次拒绝覆盖', () => {
    const dir = mkScratch('e2e-autofill')
    try {
      const spec = 'apps/web/e2e/new.spec.ts'
      const text = skeletonFor({ module: ROUTE, caseName: 'x 冒烟', framework: 'playwright' })
      assert.deepEqual(writeSkeleton(dir, spec, text), { written: true })
      assert.equal(readFileSync(join(dir, spec), 'utf8'), text)
      const second = writeSkeleton(dir, spec, text)
      assert.equal(second.written, false)
      assert.match(second.reason, /已存在/)
    } finally {
      rmScratch(dir)
    }
  })

  it('spec 落点越界一律拒绝', () => {
    assert.equal(safeSpecPath('apps/web/e2e/x.spec.ts', MAP), 'apps/web/e2e/x.spec.ts')
    assert.equal(safeSpecPath('../x.test.ts', MAP), null)
    assert.equal(safeSpecPath('/abs/x.test.ts', MAP), null)
    assert.equal(safeSpecPath('apps/mobile-rn/x.test.ts', MAP), null)
    assert.equal(safeSpecPath('apps/web/src/x.ts', MAP), null)
  })

  it('--emit 目标必须来自缺口清单;同 spec 多模块必须点名', () => {
    const gaps = [
      { module: 'apps/web/app/x/page.tsx', spec: 'apps/web/e2e/x.spec.ts' },
      { module: 'apps/web/app/x/layout.tsx', spec: 'apps/web/e2e/x.spec.ts' },
    ]
    assert.equal(selectEmitTarget({ specRel: 'apps/web/e2e/x.spec.ts', gaps }).ok, false)
    assert.equal(
      selectEmitTarget({
        specRel: 'apps/web/e2e/x.spec.ts',
        moduleRel: 'apps/web/app/x/layout.tsx',
        gaps,
      }).ok,
      true,
    )
    assert.equal(selectEmitTarget({ specRel: 'apps/web/e2e/nope.spec.ts', gaps }).ok, false)
    assert.equal(selectEmitTarget({ specRel: '', gaps }).ok, false)
  })
})

describe('e2e-autofill CLI 参数与退出码三态', () => {
  it('默认 check/head;--staged 切索引面', () => {
    const def = parseArgs([])
    assert.equal(def.mode, 'check')
    assert.equal(def.face, 'head')
    assert.equal(def.error, null)
    assert.equal(parseArgs(['--staged']).face, 'staged')
    assert.equal(parseArgs(['--check', '--staged']).mode, 'check')
  })

  it('--emit 必须带显式 spec;默认 dry-run', () => {
    const emit = parseArgs(['--emit', 'apps/web/e2e/x.spec.ts'])
    assert.equal(emit.mode, 'emit')
    assert.equal(emit.spec, 'apps/web/e2e/x.spec.ts')
    assert.equal(emit.write, false)
    assert.equal(parseArgs(['--emit', 'x', '--write']).write, true)
    assert.equal(Boolean(parseArgs(['--emit']).error), true)
  })

  it('未判定三态:互斥模式/未知参数/不支持的面/--write 走单', () => {
    assert.equal(Boolean(parseArgs(['--check', '--propose']).error), true)
    assert.equal(Boolean(parseArgs(['--worktree']).error), true)
    assert.equal(Boolean(parseArgs(['--nope']).error), true)
    assert.equal(Boolean(parseArgs(['--write']).error), true)
    assert.equal(Boolean(parseArgs(['--module', 'x']).error), true)
    assert.equal(Boolean(parseArgs(['stray']).error), true)
  })

  it('main 对参数错误直接 exit 2(不派生 git、不记绿)', async () => {
    assert.equal(await main(['--emit']), 2)
    assert.equal(await main(['--worktree']), 2)
    assert.equal(await main(['--check', '--propose']), 2)
    assert.equal(await main(['--emit', 'apps/web/e2e/not-a-gap.spec.ts']), 2)
  })

  it('自检入口是纯构造面且全绿', async () => {
    assert.equal(await main(['--self-test']), 0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
