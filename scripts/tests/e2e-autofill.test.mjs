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
  isTestFile,
  appOf,
  routeSlugOf,
  stemOf,
  tokensOf,
  suggestedSpecOf,
  caseNameOf,
  safeSpecPath,
  gapReportFromGate,
  singleSource,
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

describe('e2e-autofill 受审面判据 = 门 250 判据层(§0.6 单源,本器不再自算)', () => {
  it('正常源文件算模块;测试文件/纯类型/barrel/夹具目录不算;取不到正文算未判定', () => {
    const cf = (path, text) => singleSource.classifyFile({ path, text })
    assert.equal(cf('apps/web/src/lib/foo.ts', 'export const a = 1\n').kind, 'module')
    assert.equal(cf('apps/web/src/lib/foo.test.ts', 'export const a = 1\n').kind, 'test')
    assert.equal(cf('apps/api/src/lib/index.ts', "export * from './a'\n").kind, 'skipped')
    assert.equal(cf('apps/api/src/db/types.d.ts', 'export type A = 1\n').kind, 'skipped')
    assert.equal(cf('apps/api/tests/fixtures/helper.ts', 'export const a = 1\n').kind, 'skipped')
    // §0.3:取不到正文 ⇒ 判不出(既不记绿也不冒红),旧尺"按路径就当它是模块"已废
    assert.equal(cf('apps/web/src/lib/foo.ts', undefined).kind, 'undetermined')
  })

  it('本器不再持有第二把尺:旧覆盖判据函数已从导出面消失,入口转引门 250', () => {
    for (const gone of [
      'isAuditedSource',
      'isE2eSpec',
      'isNoisePath',
      'indexTests',
      'coversWithIndex',
      'testCoversModule',
      'diffGaps',
    ]) {
      assert.equal(__test__[gone], undefined, `${gone} 不应再被导出`)
    }
    assert.equal(typeof singleSource.findTestlessModules, 'function')
    assert.equal(typeof singleSource.evaluateFace, 'function')
    const src = readFileSync(join(import.meta.dirname, '..', 'e2e-autofill.mjs'), 'utf8')
    assert.match(src, /from '\.\/lib\/e2e-coverage-gap\.mjs'/)
    assert.match(src, /from '\.\/check-e2e-coverage-gap\.mjs'/)
    assert.match(src, /GATE_WIRING\.evaluateFace/)
  })

  it('测试文件识别覆盖 spec/test/node-test 三族(只服务 --emit 落点安全)', () => {
    assert.equal(isTestFile('apps/web/e2e/foo.spec.ts', MAP), true)
    assert.equal(isTestFile('apps/web/src/__tests__/foo.test.ts', MAP), true)
    assert.equal(isTestFile('apps/web/src/__tests__/foo.node-test.mjs', MAP), true)
    assert.equal(isTestFile('apps/web/src/foo.ts', MAP), false)
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

describe('e2e-autofill 覆盖判据(唯一实现 = 门 250 判据层,构造面)', () => {
  const GROOTS = ['apps/web/app', 'apps/web/src', 'apps/api/src']
  const SRC = (path) => ({ path, text: 'export const a = 1\n' })
  const gapPaths = (files, tests) =>
    singleSource
      .findTestlessModules({ files, testFiles: tests, roots: GROOTS })
      .gaps.map((g) => g.path)

  it('同目录/邻 __tests__ 同名 ⇒ 覆盖;无测试 ⇒ 缺口', () => {
    assert.deepEqual(
      gapPaths([SRC('apps/web/src/lib/foo.ts')], ['apps/web/src/lib/foo.test.ts']),
      [],
    )
    assert.deepEqual(
      gapPaths([SRC('apps/web/src/lib/foo.ts')], ['apps/web/src/lib/__tests__/foo.test.ts']),
      [],
    )
    assert.deepEqual(gapPaths([SRC('apps/web/src/lib/foo.ts')], []), ['apps/web/src/lib/foo.ts'])
  })

  it('跨包同名不冒充;e2e spec 不覆盖 web 代码模块(层不同族)', () => {
    assert.equal(
      gapPaths([SRC('apps/web/src/lib/foo.ts')], ['apps/api/src/lib/__tests__/foo.test.ts']).length,
      1,
    )
    assert.equal(gapPaths([SRC('apps/web/src/lib/foo.ts')], ['apps/web/e2e/foo.spec.ts']).length, 1)
  })

  it('路由页判据=同目录/__tests__ 同名测试;e2e spec 不覆盖单源判据(登记与本器 web-route 配方的矛盾)', () => {
    assert.deepEqual(
      gapPaths([SRC(ROUTE)], ['apps/web/app/(main)/admin/users/__tests__/page.test.ts']),
      [],
    )
    // 配方 `web-route` 建议落点是 apps/web/e2e/<slug>.spec.ts,而门 250 判据层里 `e2e` 属
    // NON_SOURCE_DIR_SEGMENTS ⇒ 按该落点补的 spec **不会**让缺口消解。这条不是本席能改的
    // (改判据层 = 动 immutable 面 + 需提交信息留痕),按实测登记成交给后手的残余。
    assert.deepEqual(gapPaths([SRC(ROUTE)], ['apps/web/e2e/admin-users.spec.ts']), [ROUTE])
    assert.deepEqual(gapPaths([SRC(ROUTE)], ['apps/web/e2e/admin.spec.ts']), [ROUTE])
  })

  it('射程外的文件不入判据(outOfScope 计数,不静默当缺口)', () => {
    const r = singleSource.findTestlessModules({
      files: [SRC('packages/shared/src/widget.ts'), SRC('apps/web/src/lib/foo.ts')],
      testFiles: [],
      roots: GROOTS,
    })
    assert.equal(r.outOfScope, 1)
    assert.deepEqual(
      r.gaps.map((g) => g.path),
      ['apps/web/src/lib/foo.ts'],
    )
  })

  it('取不到正文 ⇒ 未判定点名,不当"没有缺口"(§0.3)', () => {
    const r = singleSource.findTestlessModules({
      files: [{ path: 'apps/web/src/lib/foo.ts' }],
      testFiles: [],
      roots: GROOTS,
    })
    assert.equal(r.undetermined.length, 1)
    assert.equal(r.undetermined[0].blocks, true)
  })
})

describe('e2e-autofill 棘轮(§0.2:只拦新增,存量只报数;判定与取材走门 250)', () => {
  const GROOTS = ['apps/web/app', 'apps/web/src', 'apps/api/src', 'packages/shared/src']
  const SCOPE = {
    roots: GROOTS.map((root) => ({ root, reason: '镜像测试构造射程', reviewBy: '2099-01-01' })),
    note: '',
  }
  const face = (paths) => ({
    gaps: paths.map((path) => ({ path, root: path.slice(0, path.lastIndexOf('/')) })),
    covered: [],
    skipped: [],
    undetermined: [],
    emptyRoots: [],
    roots: GROOTS,
    scanned: paths.length,
    modules: paths.length,
    gapCount: paths.length,
  })
  const base = (gapPaths, coveredPaths) => ({
    gaps: gapPaths.map((path) => ({ path, root: path.slice(0, path.lastIndexOf('/')) })),
    covered: coveredPaths.map((path) => ({ path, test: `${path}.test.ts` })),
    skipped: [],
    undetermined: [],
    emptyRoots: [],
    roots: GROOTS,
    scanned: gapPaths.length + coveredPaths.length,
    modules: gapPaths.length + coveredPaths.length,
    gapCount: gapPaths.length,
  })
  const run = (faceResult, baseResult) =>
    gapReportFromGate({
      map: MAP,
      scope: SCOPE,
      baseRev: 'HEAD^',
      listBaseFiles: () => [],
      evaluate: (_root, _f, _roots, opts) => (opts?.rev ? baseResult : faceResult),
    })

  it('新模块无测试 ⇒ 新缺口;存量同形态 ⇒ 只报数;测试被删 ⇒ 回潮算新缺口', () => {
    const rep = run(
      face(['apps/web/src/a.ts', 'apps/web/src/b.ts', 'apps/web/src/c.ts']),
      base(['apps/web/src/a.ts'], ['apps/web/src/c.ts']),
    )
    assert.ok(rep.newGaps.some((g) => g.module === 'apps/web/src/b.ts'))
    assert.ok(rep.stockGaps.some((g) => g.module === 'apps/web/src/a.ts'))
    assert.ok(!rep.newGaps.some((g) => g.module === 'apps/web/src/a.ts'))
    assert.ok(rep.newGaps.some((g) => g.module === 'apps/web/src/c.ts'))
  })

  it('反向对照:面上无缺口 ⇒ gaps/newGaps 皆 0(门不是一律判红)', () => {
    const rep = run(face([]), base([], []))
    assert.equal(rep.gaps.length, 0)
    assert.equal(rep.newGaps.length, 0)
    assert.equal(rep.stockGaps.length, 0)
  })

  it('缺口清单带机器可读四要素(模块/落点/用例名/框架),且逐条按 module 升序', () => {
    const rep = run(face([ROUTE]), base([], []))
    assert.deepEqual(rep.newGaps[0], {
      module: ROUTE,
      kind: 'route',
      framework: 'playwright',
      spec: 'apps/web/e2e/admin-users.spec.ts',
      caseName: 'admin-users 冒烟',
      isNew: true,
    })
  })

  it('无配方的缺口点名报数(noRecipeCount),不静默吞掉门尺与本器清单的差额', () => {
    const rep = run(face(['apps/web/src/a.ts', 'packages/shared/src/widget.ts']), base([], []))
    assert.equal(rep.gaps.length, 1)
    assert.equal(rep.noRecipeCount, 1)
    assert.equal(rep.faceResult.gapCount, rep.gaps.length + rep.noRecipeCount)
  })

  it('基底 rev 拿不到清单出口 ⇒ 抛未判定,不拿本侧清单冒充基底(§0.3/§0.10)', () => {
    assert.throws(
      () =>
        gapReportFromGate({
          map: MAP,
          scope: SCOPE,
          baseRev: 'HEAD^',
          evaluate: (_r, _f, _rs, opts) => (opts?.rev ? face([]) : face([])),
        }),
      /listBaseFiles/,
    )
  })

  it('射程清单解析出 0 条 root ⇒ 抛未判定(枚举到 0 判死)', () => {
    assert.throws(
      () =>
        gapReportFromGate({
          map: MAP,
          scope: { roots: [], note: '' },
          evaluate: () => face([]),
        }),
      /0 条 root/,
    )
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
