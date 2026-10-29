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
import { __test__ as GEN } from '../gen-rn-compat.mjs'

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

/**
 * N1–N5:生成腿的水印注入 + 原子落盘(g33-s11 @2026-10-29 立)。
 *
 * 立因是现读:`node scripts/gen-rn-compat.mjs --write` 只要走到"重写 route-map.generated.ts"
 * 那一支就**必挂** —— `✓ 图标无变化` 照打,紧跟 `❌ 水印注入失败(…):Command failed: <命令本身>`
 * 并 exit 2(连撞两轮可复现;取证夹具 `.ihui-agent/tmp/g33/s11/repro-watermark.mjs`)。
 * 根因不在水印仪:共享工作区里这枚刚被写过的文件在头几百毫秒被并发会话/守护轮持有句柄,
 * 谁 open 谁拿 `UNKNOWN: unknown error`(errno -4094),而**隔 2 秒再注即成功** ⇒ 瞬时争用。
 * 旧实现一次不成就退、还把原因截成命令本身(§12f),于是门 251 的修复出口成了跑不通的出路(§0.8)。
 * 失败分支一律走源脚本自己的注入面(`opts.spawn/sleep/die`,与 `lib/atomic-write.mjs` 的
 * `fs`/`sleep` 同一条纪律),载荷完好性用 watermark.mjs 的生产实现判,本测试零复制判据(§22c)。
 */
const gen = await import('../gen-rn-compat.mjs')
const wm = await import('../watermark.mjs')
const inject = gen.__test__.injectWatermark
const NO_PAYLOAD = '// 生成件正文夹具(无载荷)\nexport const X = 1\n'
// injectText 的回给是 {text, action}(不是裸字符串)——拿错形态就是把 undefined 喂给载荷判据,
// 表现为 "text.match is not a function" 的异步炸裂,而不是一句"夹具坏了"。
const WITH_PAYLOAD = wm.__test__.injectText(NO_PAYLOAD, { rel: 'probe.ts' }).text
assert.ok(wm.__test__.payloadIntact(WITH_PAYLOAD), '夹具前置:injectText 造出的载荷必须可解码')
const unknownErr = (abs) => {
  const e = new Error(`UNKNOWN: unknown error, open '${abs}'`)
  e.code = 'UNKNOWN'
  return e
}
/**
 * 打靶全程不落盘(内容住在 `disk` 里,由 `opts.read` 供给):本仓 `.ihui-agent/tmp` 有并发清理轮,
 * 实测探针件会在写后毫秒级被抹掉 ⇒ 用例红的是环境而不是判据(ENOENT)。注入面三件
 * (`spawn`/`read`/`sleep`/`die`)都走源脚本自己的 opts,生产路径一行不改。
 */
const harness = (spawn, startText = NO_PAYLOAD) => {
  const disk = { text: startText }
  const state = { calls: 0, sleeps: [], died: null, disk }
  try {
    inject('apps/miniapp-taro/src/rn-compat/route-map.generated.ts', {
      spawn: (abs) => {
        state.calls++
        return spawn(abs, state.calls, disk)
      },
      read: () => disk.text,
      sleep: (ms) => state.sleeps.push(ms),
      die: (message) => {
        const err = new Error(message)
        err.g33Died = true
        state.died = err
        throw err
      },
    })
  } catch (err) {
    // die 的哨兵在这里收口(生产是 process.exit,永不返回);别的异常一律原样抛
    if (!err?.g33Died) throw err
  }
  return state
}

test('N1 命令返回 0 且回读到完好载荷 ⇒ 静默返回、只打一轮', () => {
  const state = harness(() => undefined, WITH_PAYLOAD)
  assert.equal(state.calls, 1, '成功路径不得多打一轮')
  assert.equal(state.died, null, '成功不许叫 die')
  assert.deepEqual(state.sleeps, [], '成功不该退避')
})

test('N2 前两轮 UNKNOWN 争用、第三轮注上 ⇒ 必须退避后成功(旧写法在这里直接 exit 2)', () => {
  const state = harness((abs, call, disk) => {
    if (call <= 2) throw unknownErr(abs)
    disk.text = WITH_PAYLOAD
  })
  assert.equal(state.calls, 3, '必须打到第三轮(证明重试真在射程里,不是侥幸)')
  assert.deepEqual(state.sleeps, [1500, 3000], '按轮次线性退避(实测 2 秒即过)')
  assert.equal(state.died, null)
})

test('N3 四轮全失败 ⇒ 走 die 且把子进程 stderr 与 errno 原样点名(旧写法只念命令本身)', () => {
  const state = harness((abs) => {
    const e = unknownErr(abs)
    e.stderr = '[watermark:inject] 写入被打断:句柄未释放\n'
    throw e
  })
  assert.equal(state.calls, 4, '重试上限 4 轮')
  assert.deepEqual(state.sleeps, [1500, 3000, 4500], '每轮之间都要退避')
  const msg = state.died?.message ?? ''
  assert.ok(state.died?.g33Died, '失败必须走 die(生产即 console.error + exit 2)')
  assert.ok(msg.includes('写入被打断:句柄未释放'), `未把子进程 stderr 带出来:${msg}`)
  assert.ok(msg.includes('errno=UNKNOWN'), `未点名 errno:${msg}`)
  assert.ok(msg.includes('已试 4 轮'), `未报重试轮数:${msg}`)
})

test('N4 反向牙:命令返回 0 但盘上回读不到载荷 ⇒ 按未注入拒收,绝不记成功', () => {
  const state = harness((abs, call, disk) => {
    disk.text = NO_PAYLOAD // 命令"绿"了,载荷却没复位
  })
  assert.equal(state.calls, 4, '回读不过就要把轮数打满后表态')
  assert.ok((state.died?.message ?? '').includes('回读不到完好载荷'), '必须点名"未注入"这一型(§13)')
})

test('N5 形状锁:--write 段落盘一律走 atomicWriteFileSync,且两处写完都紧随注入', () => {
  const src = readFileSync(fileURLToPath(new URL('../gen-rn-compat.mjs', import.meta.url)), 'utf8')
  const body = src.slice(src.indexOf('  if (write) {'))
  assert.ok(body.length > 40 && body.startsWith('  if (write) {'), '锚点腐烂 ⇒ 本锁空转,先修锚')
  assert.ok(
    !/^\s*writeFileSync\(/m.test(body),
    '--write 段里出现裸 writeFileSync ⇒ 又回到"覆盖已被持有的目标"(本轮实测 errno -4094 的落点)',
  )
  assert.equal(
    (body.match(/atomicWriteFileSync\(/g) || []).length,
    2,
    '图标与路由映射两处正文必须各走一次原子替换出口',
  )
  assert.equal(
    (body.match(/injectWatermark\(/g) || []).length,
    2,
    '两处正文写完都必须紧随注入(§5c:漏注 = 下一次提交链红在没人写过那行的地方)',
  )
})

// ── C 组:幂等判据 routeMapCovers ──────────────────────────────────────────────
// 立因(2026-10-30 实测的"绿灯即缺陷"):登记表面回正了 CourseMain / NewsCategory / Assistant
// 三条的 miniapp 指向,键名一条没变;旧判据只比键名集合 ⇒ `--write` 自报「✓ 路由映射无变化
// (盘上已覆盖现读 257 条)」并拒绝写盘,生成物与登记面长期背离。`--write` 是门 251 C3 点名的
// 修复出口,出口安静不干活即 AGENTS §0.8 禁止的"文档写了跑不通的出路"。
const PRETTY_MAP = `export const RN_ROUTE_MAP: Record<string, string> = {
  A: '/x/index',
  B: '/pkg-learn/course/list',
}
`

test('C1 键在册且指向逐字相等 ⇒ 判"已覆盖"(prettier 后的裸键单引号形态)', () => {
  const entries = [
    ['A', '/x/index'],
    ['B', '/pkg-learn/course/list'],
  ]
  assert.equal(GEN.routeMapCovers(entries, PRETTY_MAP), true)
})

test('C2 反向牙(本轮真事):同键不同值必须判"有变化",否则改指向永远落不了盘', () => {
  const entries = [
    ['A', '/x/index'],
    ['B', '/pkg-mirror/course/index'],
  ]
  assert.equal(
    GEN.routeMapCovers(entries, PRETTY_MAP),
    false,
    '只比键名的旧判据在这里返回 true ⇒ 生成器自述"无变化"却不写盘',
  )
})

test('C3 现读键在盘上不存在 ⇒ 判"有变化"(补新页这一型不能被当成已覆盖)', () => {
  const entries = [['NewScreen', '/pkg-new/index']]
  assert.equal(GEN.routeMapCovers(entries, PRETTY_MAP), false)
})

test('C4 盘上读不到任何映射 ⇒ 判"有变化",绝不把"读不到"写成"已覆盖"(§0.3)', () => {
  const entries = [['A', '/x/index']]
  assert.equal(GEN.routeMapCovers(entries, ''), false, '空文件')
  assert.equal(GEN.routeMapCovers(entries, '// 没有表体的一行\n'), false, '无 map 形态')
})

test('C5 自生成自识别闭环:renderRouteMap 的产物喂回判据必须为真(双引号形态)', () => {
  const map = new Map([
    ['Assistant', '/pkg-ai/agent-dialogue/index'],
    ['CourseMain', '/pkg-learn/course/list'],
  ])
  const rendered = GEN.renderRouteMap(map)
  assert.equal(
    GEN.routeMapCovers([...map.entries()], rendered),
    true,
    '渲染器与幂等判据必须认同一种形态,否则每轮都"有变化"、改动面被无意义重写长期占用',
  )
})

test('C6 形状锁:源脚本里不得再长出"只比键名"的第二份幂等判据(§22c)', () => {
  const src = readFileSync(fileURLToPath(new URL('../gen-rn-compat.mjs', import.meta.url)), 'utf8')
  assert.ok(
    !/routeKeysNew\.every/.test(src),
    '旧判据(逐键名 includes)被搬回来了 ⇒ 值漂移重新变成看不见的缺陷',
  )
  assert.ok(
    /const routesAlreadyCovered = routeMapCovers\(/.test(src),
    'main() 必须走 routeMapCovers 这一个出口,不许在调用点另写一份',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
