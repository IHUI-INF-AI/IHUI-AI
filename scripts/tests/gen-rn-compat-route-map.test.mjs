// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/gen-rn-compat.mjs 的 route-map 解析腿(§22c:判据直接 import 源符号,不复制第二份)。
//
// 为什么这一格必须有锁:2026-10-27 现读,导航器里一整批屏走**具名导入**
//   `import { AIMultimodalScreen } from '../screens/AIMultimodalScreen'`
// 而 buildRouteMap 只认默认导入形态 ⇒ 这些路由名整批不在映射表里(现读 41 条 vs 应有 213 条)。
// 后果两条:① 小程序端那一跳被 rn-compat/navigation 点名"未执行"= 点了不动(运行时缺陷);
// ② 转换门的跳转面据此把页面判成"换过去会跳不动"⇒ 拒转(把解析缺陷读成功能缺口)。
// 一条正则少一种形态,同时造出运行时缺陷与假缺口 —— 而它此前**没有任何测试**能发现。
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { buildRouteMapFromText } from '../gen-rn-compat.mjs'

const RN = (n) => `apps/mobile-rn/src/screens/${n}.tsx`
const reg = (rn, miniapp) => ({ rn, miniapp })

const navWith = (imports, screens) => `
${imports}
export function RootNavigator() {
  return (
    <Stack.Navigator>
${screens}
    </Stack.Navigator>
  )
}
`
const screen = (name, comp) =>
  `      <Stack.Screen\n        name="${name}"\n        component={${comp}}\n      />`

test('R1 具名导入的屏必须进映射表(这就是当天被漏掉的那一批)', () => {
  const nav = navWith(`import { AIMultimodalScreen } from '../screens/AIMultimodalScreen'`, [
    screen('AIMultimodal', 'AIMultimodalScreen'),
  ])
  const r = buildRouteMapFromText(nav, [
    reg(RN('AIMultimodalScreen'), 'pkg-ai/ai-multimodal/index'),
  ])
  assert.equal(
    r.map.get('AIMultimodal'),
    '/pkg-ai/ai-multimodal/index',
    `实际 map:${[...r.map.entries()]}`,
  )
  assert.equal(r.unbound.length, 0, `不该有解析不到的组件:${r.unbound}`)
})

test('R2 默认导入形态照旧认(补形态不得把原形态挤掉)', () => {
  const nav = navWith(`import PointsScreen from '../screens/PointsScreen'`, [
    screen('Points', 'PointsScreen'),
  ])
  const r = buildRouteMapFromText(nav, [reg(RN('PointsScreen'), 'pkg-mirror3/points/index')])
  assert.equal(r.map.get('Points'), '/pkg-mirror3/points/index')
})

test('R3 `as` 别名取本地名(Screen 的 component 用的是别名,不是原名)', () => {
  const nav = navWith(`import { ChatRoomScreen as Chat } from '../screens/ChatRoomScreen'`, [
    screen('ChatRoom', 'Chat'),
  ])
  const r = buildRouteMapFromText(nav, [reg(RN('ChatRoomScreen'), 'pkg-user/chat-room/index')])
  assert.equal(r.map.get('ChatRoom'), '/pkg-user/chat-room/index')
})

test('R4 登记表没有这一对 ⇒ 进 unmapped 点名(不静默丢,也不猜一个像的路径)', () => {
  const nav = navWith(`import { FollowScreen } from '../screens/FollowScreen'`, [
    screen('Follow', 'FollowScreen'),
  ])
  const r = buildRouteMapFromText(nav, [])
  assert.equal(r.map.size, 0)
  assert.deepEqual(r.unmapped, ['Follow(FollowScreen)'])
})

test('R5 组件名在任何导入形态里都找不到 ⇒ 单独成桶点名(把"尺子瞎"与"确实没这屏"分开)', () => {
  const nav = navWith(`import { Known } from '../screens/KnownScreen'`, [
    screen('Main', 'MainNavigator'),
    screen('KnownRoute', 'Known'),
  ])
  const r = buildRouteMapFromText(nav, [reg(RN('KnownScreen'), 'pkg-x/known/index')])
  assert.equal(r.map.get('KnownRoute'), '/pkg-x/known/index')
  assert.deepEqual(
    r.unbound,
    ['Main(component=MainNavigator)'],
    '嵌套导航器容器不是屏,要出声而不是静默跳过',
  )
})

test('R6 一行具名导入挂多屏 ⇒ 两个本地名各自成键(真仓"重复目标路径 2 条"就是这个形态)', () => {
  const nav = navWith(`import { VipLevelScreen, TopupFailScreen } from '../screens/VipScreens'`, [
    screen('VipLevel', 'VipLevelScreen'),
    screen('TopupFail', 'TopupFailScreen'),
  ])
  const r = buildRouteMapFromText(nav, [reg(RN('VipScreens'), 'pkg-shop/vip/level')])
  assert.equal(r.map.size, 2, `两个组件名都该有条落点:${JSON.stringify([...r.map.entries()])}`)
  assert.equal(r.map.get('VipLevel'), '/pkg-shop/vip/level')
  assert.equal(r.map.get('TopupFail'), '/pkg-shop/vip/level')
  assert.deepEqual(r.unmapped, [])
})

// ── R7-R10:同 rn 被多条登记条目共用的"静默后写覆盖"必须出声(2026-10-29 现读实弹) ──
// 当天那组:登记表 home 条目把 rn 写成 AgentScreen.tsx,与真 agent 条目抢同一个键,
// new Map 后写覆盖让 home 条目胜出 ⇒ 小程序路由表把 Agent/AiMain 都指到首页镜像壳。
// 同一张表当天还有 15 组同型撞键。本族只加出声,不改语义、不判红(存量未归零前升档=恒红门)。
const collideNav = navWith(`import { ShopScreen } from '../screens/ShopScreen'`, [
  screen('Shop', 'ShopScreen'),
])
const rightEntry = {
  rn: RN('ShopScreen'),
  miniapp: 'pkg-shop/real/index',
  shared: 'packages/app/src/features/shop/ShopScreen.tsx',
}
const wrongEntry = {
  rn: RN('ShopScreen'),
  miniapp: 'pkg-shop/wrong/index',
  shared: 'packages/app/src/features/other/OtherScreen.tsx',
}

test('R7 同 rn 多条共用 ⇒ rnCollisions 逐组出声,明细带被静默丢弃那条的 shared 与 miniapp', () => {
  const r = buildRouteMapFromText(collideNav, [rightEntry, wrongEntry])
  assert.equal(
    r.map.get('Shop'),
    '/pkg-shop/wrong/index',
    '后写覆盖的既有语义原样保留(本票只加出声,不改行为)',
  )
  assert.equal(r.rnCollisions.length, 1, `应点名 1 组撞键:${JSON.stringify(r.rnCollisions)}`)
  const c = r.rnCollisions[0]
  assert.equal(c.rn, RN('ShopScreen'))
  assert.equal(c.winner, 'pkg-shop/wrong/index')
  assert.deepEqual(
    c.losers,
    [{ shared: rightEntry.shared, miniapp: rightEntry.miniapp }],
    '被丢弃方必须逐字点名到 shared 与 miniapp,否则没人能判该留哪一条',
  )
})

test('R8 反向对照:一 rn 一条目 ⇒ rnCollisions 为空数组(不得把"没读到"写成"没问题")', () => {
  const r = buildRouteMapFromText(collideNav, [rightEntry])
  assert.deepEqual(r.rnCollisions, [])
  assert.equal(r.map.get('Shop'), '/pkg-shop/real/index')
})

test('R9 行为不变锁:出声前后 map 逐字相同(不得顺手改胜出者)', () => {
  const both = buildRouteMapFromText(collideNav, [rightEntry, wrongEntry])
  const onlyWinner = buildRouteMapFromText(collideNav, [wrongEntry])
  assert.deepEqual(
    [...both.map.entries()],
    [...onlyWinner.map.entries()],
    '两条共用键的映射结果必须与"只留胜者"完全一致',
  )
})

test('R10 空输入不抛,且本文件不得长出第二份撞键判据(§22c)', () => {
  assert.deepEqual(buildRouteMapFromText(collideNav, undefined).rnCollisions, [])
  assert.deepEqual(buildRouteMapFromText(collideNav, []).rnCollisions, [])
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.ok(self.includes('rnCollisions'), '测试按返回面取撞键,而不是自己数一遍')
  // 形状锁的字面量必须拆开写:否则这条正则自己就含被禁符号名,断言恒假(自指)。
  const forbidden = 'reg' + 'ByRnSeen'
  assert.ok(
    !self.includes(forbidden),
    '本文件里出现源脚本的内部分组符号 ⇒ 有人在测试里复刻判据(§22c 禁第二份真相)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
