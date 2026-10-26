// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 埋点覆盖面判据层的镜像取证(2026-10-26 立;§22c:判据 import 源脚本 `__test__`,本文件零复算)。
 *
 * 钉的都是会让"覆盖数"说谎的形态:端前缀判错 ⇒ 整端读 0;动态段不配对 ⇒ 每个详情页都被
 * 报成"清单外";分包 root 不拼接 ⇒ 小程序上百页全成假缺口;观测面缺失被读成"全覆盖"。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as T } from '../lib/analytics-coverage.mjs'

test('四档端按前缀归一,裸路径归 web', () => {
  assert.equal(T.endOfUrl('/rn/Home'), 'rn')
  assert.equal(T.endOfUrl('/mp/pages/index/index'), 'mp')
  assert.equal(T.endOfUrl('/ex/sidepanel/chat'), 'ex')
  assert.equal(T.endOfUrl('/admin/bi-dashboard'), 'web')
  assert.equal(T.endOfUrl(null), 'web')
})

test('剥 query/hash 与端前缀;尾斜杠不算第二个页面', () => {
  assert.equal(T.normalizeObservedKey('/rn/Home'), 'Home')
  assert.equal(T.normalizeObservedKey('/mp/pages/chat/index/'), 'pages/chat/index')
  assert.equal(T.normalizeObservedKey('/admin/x?a=1#z'), '/admin/x')
  assert.equal(T.normalizeObservedKey('/'), '/')
})

test('web 路由:路由组不进 URL、动态段转 :slug、非 page 文件不算页面', () => {
  assert.equal(T.webRouteFromFilePath('(main)/admin/bi-dashboard/page.tsx'), '/admin/bi-dashboard')
  assert.equal(T.webRouteFromFilePath('(marketing)/about/page.tsx'), '/about')
  assert.equal(T.webRouteFromFilePath('ai-world/edit/[id]/page.tsx'), '/ai-world/edit/:id')
  assert.equal(T.webRouteFromFilePath('agents/[...slug]/page.tsx'), '/agents/slug')
  assert.equal(T.webRouteFromFilePath('page.tsx'), '/')
  assert.equal(T.webRouteFromFilePath('(main)/layout.tsx'), null)
})

test('小程序:主包 pages 原样,分包必须拼 root', () => {
  const text = `export default defineAppConfig({
  pages: ['pages/index/index', 'pages/user/index'],
  subPackages: [{ root: 'pkg-ai', pages: ['chat/index', 'skills/list'] }],
})`
  assert.deepEqual(T.miniappPagesFromConfig(text), [
    'pages/index/index',
    'pages/user/index',
    'pkg-ai/chat/index',
    'pkg-ai/skills/list',
  ])
})

test('RN 屏名去重;插件清单含 popup/sidepanel 根,通配路由不进清单', () => {
  assert.deepEqual(
    T.rnScreensFromSource('<Stack.Screen name="Home" /><Stack.Screen name="Home" />'),
    ['Home'],
  )
  const ex = T.extensionRoutesFromSource(
    '<Route path="chat" /><Route path="agents/:id" /><Route path="*" />',
  )
  assert.ok(ex.includes('popup'))
  assert.ok(ex.includes('sidepanel'))
  assert.ok(ex.includes('sidepanel/chat'))
  assert.ok(ex.includes('sidepanel/agents/:id'))
  assert.equal(
    ex.some((k) => k.includes('*')),
    false,
  )
})

test('web 动态段配任意非空实段;段数不同或题面不同不配', () => {
  assert.equal(T.webRouteMatches('/ai-world/edit/:id', '/ai-world/edit/ab5a0687'), true)
  assert.equal(T.webRouteMatches('/ai-world/edit/:id', '/ai-world/items/ab5a0687'), false)
  assert.equal(T.webRouteMatches('/ai-world/edit/:id', '/ai-world/edit'), false)
})

test('零访问与清单外两向都能点名;命中项不得出现在任一集合里', () => {
  const report = T.buildCoverage(
    {
      web: ['/', '/about', '/post/:id'],
      rn: ['Home', 'Chat'],
      mp: ['pages/a/index'],
      ex: ['popup'],
    },
    ['/', '/post/123', '/rn/Home', '/mp/pages/a/index', '/mp/pages/gone/index'],
  )
  assert.equal(report.web.seen, 2)
  assert.deepEqual(report.web.zeroVisit, ['/about'])
  assert.equal(report.rn.seen, 1)
  assert.deepEqual(report.rn.zeroVisit, ['Chat'])
  assert.equal(report.mp.seen, 1)
  assert.deepEqual(report.mp.unexpected, ['pages/gone/index'])
  assert.equal(report.ex.seen, 0)
  assert.deepEqual(report.ex.zeroVisit, ['popup'])
})

test('观测面为空数组时不得把"没人访问"读成"全覆盖"', () => {
  const report = T.buildCoverage({ web: ['/', '/about'], rn: [], mp: [], ex: [] }, [])
  assert.equal(report.web.seen, 0)
  assert.deepEqual(report.web.zeroVisit, ['/', '/about'])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
