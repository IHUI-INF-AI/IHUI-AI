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
 *     **这一半住在 `scripts/tests/auth-arrival-navigation-wiring.test.mjs`**(2026-09-28 挪):
 *     它要用全仓唯一那份遮罩实现 `scripts/lib/code-mask.mjs`,而架构契约的门 103 判"端 import
 *     根工具层"为向上依赖(D2 只比 rank,补 `requires` 也消不掉)。把锁挪到不反向的那一层
 *     才是合规出路 —— 抄一份遮罩进端内会造出第二份真相,登记例外等于给架构表开口子。
 */
import { describe, it, expect } from 'vitest'

import { authArrivalAction } from '../src/navigation/auth-arrival'

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
    expect(authArrivalAction({ hadToken: false, hasToken: true, routeName: undefined })).toBe(
      'none',
    )
    expect(authArrivalAction({ hadToken: false, hasToken: true, routeName: null })).toBe('none')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
