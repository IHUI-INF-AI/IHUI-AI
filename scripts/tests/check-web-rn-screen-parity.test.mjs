// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// check-web-rn-screen-parity.mjs 的「门户承载识别」镜像测试(§22c:判据 import 源脚本 __test__)。
//
// 立因:门户表除了静态 `path: '/x'` 条目,还住着详情 URL 组装出口
// (`buildWebMemoryDetailUrl` ⇒ `${webBase}/memory/${encodeURIComponent(id)}`)。那条出口就是 web
// 侧 `/memory/[id]` 的承载体,而尺子原先只按静态 path 判 ⇒ 台账里这条明明有承载的行被读成
// "RN 零承载"的 gap,自动收敛腿也结构性打不到它。本文件钉的是**形状解析**本身:
// 阳性对照喂构造面(不依赖真仓现状),反向对照证明不猜。
import assert from 'node:assert/strict'
import test from 'node:test'

import { __test__ as RULER } from '../check-web-rn-screen-parity.mjs'

const shapes = (txt) => RULER.portalRouteShapesFrom(txt).map((r) => r.route)

test('P1 阳性对照:详情 URL 组装模板折成参数路由形状', () => {
  const txt = 'export const f = (webBase, id) => `${webBase}/memory/${encodeURIComponent(id)}`'
  assert.deepEqual(shapes(txt), ['memory/[id]'])
})

test('P2 静态 path 条目不重复计入派生集(派生只认模板)', () => {
  assert.deepEqual(shapes("const e = { path: '/rules' }"), [])
})

test('P3 首段即插值的模板不猜形状(拿不到路径就不能算承载)', () => {
  assert.deepEqual(shapes('const u = (b, p) => `${b}${p.path}`'), [])
})

test('P4 api/ 前缀是传输口不是页面承载', () => {
  assert.deepEqual(shapes('const u = (b, id) => `${b}/api/things/${id}`'), [])
})

test('P5 无插值的纯静态模板不产参数路由(它已在 path: 清单里)', () => {
  assert.deepEqual(shapes('const u = (b) => `${b}/feature-center`'), [])
})

test('P6 查询串与锚点剥掉后按路径形状归一', () => {
  assert.deepEqual(
    shapes('const u = (webBase, id) => `${webBase}/memory/${encodeURIComponent(id)}?from=app#top`'),
    ['memory/[id]'],
  )
})

test('P7 真 HEAD 面:派生集确实含 memory/[id],且静态面仍数得出上百条', () => {
  const p = RULER.collectPortalRoutes('HEAD')
  assert.notEqual(p.set, null, '门户表取不到 ⇒ 应给 null(未判定),不该冒充判过')
  assert.ok(p.rows.some((r) => r.derived && r.route === 'memory/[id]'))
  assert.ok(p.rows.filter((r) => !r.derived).length > 100)
})

test('P8 假 rev 不等于"取不到":面 token 不在册时读的是工作树(测试别拿它当未判定阳性对照)', () => {
  // 实测:faceRead('nope-rev-x') 不报 null 而是回落盘上内容 ⇒ 若把"传个不存在的面"当成
  // 未判定用例的输入,读出来的其实是工作树,会得到与 HEAD 面不同的结论(§0.4 的同面同轮)。
  const p = RULER.collectPortalRoutes('nope-rev-x')
  assert.equal(p.unreadable, false)
  assert.ok(p.set instanceof Set && p.set.size > 0)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
