// @ihui-seat S-E2E 2026-11-01
// 守门 250 缺口分档层(§22c 镜像测试):正例 / 反向例成对。
// 反向例 = 把该档判据回退成"什么都收",对应用例必红。
// node --test scripts/tests/e2e-gap-tier.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'

import { __test__ as L } from '../lib/e2e-coverage-gap.mjs'

const { classifyGapTier, countByTier, isDataOnlyModule, isFrameworkEntry, GAP_TIERS } = L

const tier = (p, text) => classifyGapTier({ path: p, text })

test('①data-only 正例:纯常量/配置表(无函数无分支)', () => {
  assert.equal(isDataOnlyModule("export const LIMITS = {\n  body: 1024,\n  url: 'x',\n}\n"), true)
  assert.equal(isDataOnlyModule("import type { A } from './a'\nexport type T = A | null\nexport const TABS = ['a', 'b'] as const\n"), true)
  assert.equal(tier('apps/api/src/constants.ts', "export const A = 1\nexport const B = { c: 2 }\n"), 'data-only')
})

test('①data-only 反向例:带箭头函数/分支/JSX/类 ⇒ 落 must-test', () => {
  assert.equal(isDataOnlyModule('export const f = (x: number) => x * 2\n'), false)
  assert.equal(isDataOnlyModule('export const A = n > 1 ? 1 : 2\n'), false)
  assert.equal(isDataOnlyModule('export const C = () => <div />\n'), false)
  assert.equal(isDataOnlyModule('export class K { a = 1 }\n'), false)
  assert.equal(tier('apps/web/src/lib/x.ts', 'export function run() { return 1 }\n'), 'must-test')
})

test('②framework-entry 正例:App Router 约定名的入口', () => {
  for (const b of ['page', 'layout', 'route', 'loading', 'error', 'not-found']) {
    assert.equal(isFrameworkEntry(`apps/web/app/(main)/x/${b}.tsx`), true, b)
  }
  assert.equal(isFrameworkEntry('apps/web/app/sitemap.ts'), true)
})

test('②framework-entry 反向例:同名但不在 app/ 下 / 非约定名 ⇒ 不是入口', () => {
  assert.equal(isFrameworkEntry('apps/web/src/page.tsx'), false)
  assert.equal(isFrameworkEntry('apps/web/app/(main)/x/PageClient.tsx'), false)
  assert.equal(isFrameworkEntry('apps/api/src/routes/route.tsx'), false)
  assert.equal(tier('apps/web/src/components/Page.tsx', 'export default function Page() { return <div /> }\n'), 'must-test')
})

test('③framework-thin 正例:只有装配/转发的壳(无 hook 无分支无自有函数)', () => {
  const shell = "import { X } from './X'\nexport default X\n"
  assert.equal(tier('apps/web/app/(main)/a/page.tsx', shell), 'framework-thin')
  const jsxShim = "import X from './X'\nexport default () => <X />\n"
  assert.equal(tier('apps/web/app/(main)/a/page.tsx', jsxShim), 'framework-thin')
})

test('③framework-thin 反向例:出现 hook / 控制流 / await / fetch / 自有函数 ⇒ behavior', () => {
  const hook = "import { useState } from 'react'\nexport default function P() { const [a] = useState(0); return <p>{a}</p> }\n"
  assert.equal(tier('apps/web/app/(main)/a/page.tsx', hook), 'framework-behavior')
  const branch = "export default function P({ n }) { if (n > 1) return null; return <p /> }\n"
  assert.equal(tier('apps/web/app/(main)/a/page.tsx', branch), 'framework-behavior')
  const io = "export default async function P() { const r = await fetch('/x'); return <p>{r.status}</p> }\n"
  assert.equal(tier('apps/web/app/(main)/a/page.tsx', io), 'framework-behavior')
  // 无 function 声明(箭头组件)时,唯一能挡下的就是行为标记本身 —— 这条是该判据的活口
  const arrowHook = "import { useState } from 'react'\nexport default () => { const [a] = useState(0); return <p>{a}</p> }\n"
  assert.equal(tier('apps/web/app/(main)/a/page.tsx', arrowHook), 'framework-behavior')
  const arrowBranch = 'export default ({ n }) => (n > 1 ? <b /> : <i />)\n'
  assert.equal(tier('apps/web/app/(main)/a/page.tsx', arrowBranch), 'framework-behavior')
  const arrowInJsx = "export default function P({ xs }) { return <ul>{xs.map((x) => <li>{x}</li>)}</ul> }\n"
  assert.equal(tier('apps/web/app/(main)/a/page.tsx', arrowInJsx), 'framework-behavior')
})

test('④unknown 反向例:取不到正文不落任何"可免测"档', () => {
  assert.equal(classifyGapTier({ path: 'apps/web/src/a/x.ts' }), 'unknown')
  assert.equal(classifyGapTier({}), 'unknown')
  // 空正文不是 unknown:空文件在分类器里判"空模块"根本进不了缺口,能到这里的空正文一律从严
  assert.equal(classifyGapTier({ path: 'apps/web/src/a/x.ts', text: '' }), 'must-test')
})

test('⑤分档口径稳定:countByTier 恒出满表且合计 = 输入长', () => {
  const rows = countByTier([
    { tier: 'must-test' },
    { tier: 'must-test' },
    { tier: 'data-only' },
    { tier: '瞎写' },
  ])
  assert.equal(rows.length, GAP_TIERS.length)
  assert.equal(rows.reduce((s, [, n]) => s + n, 0), 4)
  assert.equal(rows.find(([t]) => t === 'must-test')[1], 2)
  assert.equal(rows.find(([t]) => t === 'unknown')[1], 1)
})
