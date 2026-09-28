// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * #31 的常驻尺子:令牌"无→有"那一次,停在登录页的人必须被送出去。
 *
 * 两半各钉一件事,缺任一半都会退成本仓最高频的那型("看起来有、其实没装车"):
 *  ① 纯函数判据:六种 (hadToken, hasToken, routeName) 组合的结论 —— 含两条**反向**对照
 *     (带着令牌被 401 出口送去 Login 不得赶走;导航器没就绪不得抢跳)。
 *  ② 装车锁:`RootNavigator.tsx` 里必须真的调用 `authArrivalAction(` 并接 `navigationRef.reset`,
 *     且判据读的是**剥掉注释后的代码面** —— 否则"只在注释里提一句"就能骗过这条锁,
 *     而那正是守门 70/76/81/115 反复记过的失效形态。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { authArrivalAction } from '../src/navigation/auth-arrival'
import { maskComments } from '../../../scripts/lib/code-mask.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const NAV_FILE = path.resolve(HERE, '..', 'src', 'navigation', 'RootNavigator.tsx')

describe('authArrivalAction —— 令牌到达那一次的落点', () => {
  it('① 无→有 且停在 Login ⇒ 送回 Main', () => {
    expect(authArrivalAction({ hadToken: false, hasToken: true, routeName: 'Login' })).toBe(
      'reset-to-main',
    )
  })
  it('② 无→有 且停在 Register ⇒ 同样送回(注册即登录是同一条路径)', () => {
    expect(authArrivalAction({ hadToken: false, hasToken: true, routeName: 'Register' })).toBe(
      'reset-to-main',
    )
  })
  it('③ 本来就有令牌 ⇒ 不动(401 出口把人送去 Login 时必须留在登录页)', () => {
    expect(authArrivalAction({ hadToken: true, hasToken: true, routeName: 'Login' })).toBe('none')
  })
  it('④ 有→无(登出)⇒ 不动,交给未登录分支自己渲染', () => {
    expect(authArrivalAction({ hadToken: true, hasToken: false, routeName: 'Main' })).toBe('none')
  })
  it('⑤ 无→有但人不在登录/注册页 ⇒ 不动(不抢别的导航)', () => {
    expect(authArrivalAction({ hadToken: false, hasToken: true, routeName: 'Chat' })).toBe('none')
  })
  it('⑥ 导航器未就绪(routeName 缺失)⇒ 不动,也不猜', () => {
    expect(authArrivalAction({ hadToken: false, hasToken: true, routeName: undefined })).toBe('none')
    expect(authArrivalAction({ hadToken: false, hasToken: true, routeName: null })).toBe('none')
  })
})

describe('装车锁 —— 判据必须真被 RootNavigator 调用', () => {
  // 读工作树而非 HEAD:这条锁断言的是"本次交付把线接上了",而 HEAD 在那之前结构上不可能含它
  // (读 HEAD 会让任何新增调用点都先红一轮 —— 与本仓"判据不得替人做出『还没做』的判断"同取向)。
  const src = readFileSync(NAV_FILE, 'utf8')
  const code = maskComments(src)

  it('调用点在场:authArrivalAction( 出现在代码面而非注释里', () => {
    expect(code).toMatch(/authArrivalAction\(\s*\{/)
    expect(src).not.toBe(code) // 夹具自证:这文件确实有注释可被剥(否则"剥注释"这一步是空操作)
  })
  it('出口在场:判定为 reset-to-main 时走 navigationRef.reset 到 Main', () => {
    expect(code).toMatch(/action !== 'reset-to-main'\) return/)
    expect(code).toMatch(/navigationRef\.reset\(\{\s*index: 0, routes: \[\{ name: 'Main' \}\]/)
  })
  it('prevToken 初值取当前 token(冷启动已登录不得被判成"刚到")', () => {
    expect(code).toMatch(/useRef<string \| null>\(token\)/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
