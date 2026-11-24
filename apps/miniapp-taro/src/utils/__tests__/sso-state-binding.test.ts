// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全强化第 24 批:小程序 SSO 回传的 state 绑定 + 裸码容错关闭。
 *
 * 病灶:登录态回传走 web-view postMessage(`{type, sso_code}`),而 web-view 承载的是
 * **任意**能进业务域的页面;提取器此前还容错"不带 type 的裸 `{sso_code}`"。
 * 于是任何被承载的页面都能投一枚自己的授权码,小程序拿到就换票 —— 登录态被换成
 * 攻击者账户。修法:发起前生成随机 state 存本地并随 URL 发出,web 授权页原样透传,
 * 这里按同一份 state 比对;严格模式下不再接受不带 type 的裸形态。
 *
 * 用例:
 *  A 严格模式:{type, sso_code, state} 且 state 相符 ⇒ 通过
 *  B 严格模式:state 不符 ⇒ 拒绝
 *  C 严格模式:缺 state / 裸 `{sso_code}` / type 不对 ⇒ 拒绝(容错关闭)
 *  D 严格模式:字符串形态的 URL 里带 sso_code+state ⇒ 比对生效
 *  E 非严格(不传 expectedState)⇒ 保持旧行为(未接入的调用方不被打断)
 *  F 嵌套数组/JSON 串的容错仍在(只收紧"认码条件",不破坏解包能力)
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@tarojs/taro', () => ({
  getStorageSync: vi.fn(() => ''),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  showToast: vi.fn(),
  getRandomValues: vi.fn(async () => ({ randomValues: new Uint8Array(16).buffer })),
}))

import { extractSsoCodeFromWebviewMessages, SSO_WEBVIEW_MESSAGE_TYPE } from '../sso'

// 用生产常量而不是手抄字面量:消息类型改名时,测试跟着改一处即可(抄一份必然漂移)
const TYPE = SSO_WEBVIEW_MESSAGE_TYPE
const STATE = 'st-abc'

describe('严格模式(expectedState 传入)', () => {
  it('A 相符 ⇒ 取到码', () => {
    const data = [{ type: TYPE, sso_code: 'code-1', state: STATE }]
    expect(extractSsoCodeFromWebviewMessages(data, STATE)).toBe('code-1')
  })

  it('B state 不符 ⇒ 拒绝', () => {
    const data = [{ type: TYPE, sso_code: 'evil', state: 'st-other' }]
    expect(extractSsoCodeFromWebviewMessages(data, STATE)).toBe('')
  })

  it('C 缺 state / 裸形态 / type 不对 ⇒ 全部拒绝', () => {
    expect(extractSsoCodeFromWebviewMessages([{ type: TYPE, sso_code: 'x' }], STATE)).toBe('')
    // 裸 {sso_code}(不带 type)—— 这正是"任何被承载页面都能投码"的入口,严格模式下关死
    expect(extractSsoCodeFromWebviewMessages([{ sso_code: 'x', state: STATE }], STATE)).toBe('')
    expect(
      extractSsoCodeFromWebviewMessages([{ type: 'other', sso_code: 'x', state: STATE }], STATE),
    ).toBe('')
  })

  it('D 字符串 URL 形态也按 state 比对', () => {
    expect(
      extractSsoCodeFromWebviewMessages(
        'ihui-miniapp://sso/callback?sso_code=ok&state=' + STATE,
        STATE,
      ),
    ).toBe('ok')
    expect(
      extractSsoCodeFromWebviewMessages('ihui-miniapp://sso/callback?sso_code=bad&state=nope', STATE),
    ).toBe('')
  })
})

describe('非严格模式(向后兼容)', () => {
  it('E 不传 expectedState ⇒ 裸形态仍可取(未接入的调用方行为不变)', () => {
    expect(extractSsoCodeFromWebviewMessages([{ sso_code: 'legacy' }])).toBe('legacy')
  })

  it('F 嵌套容器与 JSON 串的解包能力保留', () => {
    const nested = [[[{ type: TYPE, sso_code: 'deep', state: STATE }]]]
    expect(extractSsoCodeFromWebviewMessages(nested, STATE)).toBe('deep')
    const jsonStr = JSON.stringify({ type: TYPE, sso_code: 'from-json', state: STATE })
    expect(extractSsoCodeFromWebviewMessages(jsonStr, STATE)).toBe('from-json')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
