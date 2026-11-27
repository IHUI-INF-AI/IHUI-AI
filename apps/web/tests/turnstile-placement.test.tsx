// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, act } from '@testing-library/react'

import { TurnstileWidget } from '@/components/login/TurnstileWidget'
import {
  LoginWithTurnstile,
  TurnstileSlot,
  useTurnstile,
} from '@/components/login/LoginWithTurnstile'

/**
 * 2026-11-28 用户实测回归:「弹窗后面右上方怎么还有个独立的 CF 人机验证窗」
 *
 * 现场结构:
 *   <LoginWithTurnstile>            ← 外层容器 div.px-4
 *     <AuthShellPage>               ← position:fixed inset-0(全屏遮罩),脱离文档流
 *       <AuthShell> 卡片 …          ← 真正居中的卡片
 *     </AuthShellPage>
 *     <TurnstileWidget/>            ← inline 落点:容器里唯一的在流内元素
 *   </LoginWithTurnstile>
 * fixed 根节点不占文档流 ⇒ widget 被顶到文档最顶端,压在遮罩后面,永远点不到。
 *
 * 本文件钉死两件事:
 * 1) TurnstileWidget 只做显式渲染:画进自己的容器、卸载时 remove(widgetId),不依赖全页扫描;
 * 2) widgetPlacement 决定落点:slot 模式下 widget 只能出现在卡片内部;页面没放 slot 就彻底不渲染。
 */

vi.mock('next/script', () => ({ default: () => null }))

type TurnstileRenderOptions = {
  sitekey: string
  callback?: (token: string) => void
  'error-callback'?: () => void
  'expired-callback'?: () => void
}

const renderMock = vi.fn((_container: HTMLElement, _options: TurnstileRenderOptions) => 'widget-1')
const removeMock = vi.fn((_widgetId: string) => undefined)
const resetMock = vi.fn((_widgetId: string) => undefined)

function installTurnstileApi(): void {
  Object.defineProperty(window, 'turnstile', {
    value: { render: renderMock, remove: removeMock, reset: resetMock },
    configurable: true,
    writable: true,
  })
}

beforeEach(() => {
  renderMock.mockClear()
  removeMock.mockClear()
  resetMock.mockClear()
  installTurnstileApi()
  vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'test-site-key')
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'turnstile')
})

describe('TurnstileWidget 显式渲染', () => {
  it('把 widget 画进自己的容器,而不是靠 SDK 全页扫描 .cf-turnstile', () => {
    const onVerify = vi.fn()
    const { unmount } = render(<TurnstileWidget siteKey="site-key-x" onVerify={onVerify} />)

    expect(renderMock).toHaveBeenCalledTimes(1)
    const [container, options] = renderMock.mock.calls[0]
    expect(container.className).toContain('cf-turnstile')
    expect(container.isConnected).toBe(true)
    expect(options.sitekey).toBe('site-key-x')

    // 回调仍按 props 送达(验证通过 / 过期 / 出错三条线)
    act(() => options.callback?.('token-abc'))
    expect(onVerify).toHaveBeenCalledWith('token-abc')

    unmount()
    expect(removeMock).toHaveBeenCalledWith('widget-1')
  })

  it('api.js 已在此之前加载过时(同页第二个实例 / WebView 二次进入)也能直接渲染', () => {
    // window.turnstile 在组件挂载前就存在 —— 旧隐式实现此时会永远画不出来或留残骸
    const onVerify = vi.fn()
    render(<TurnstileWidget siteKey="site-key-y" onVerify={onVerify} />)
    expect(renderMock).toHaveBeenCalledTimes(1)
  })
})

describe('widgetPlacement 落点', () => {
  it('slot 模式:widget 只出现在卡片内部(slot 位置),不再飘到页面顶端', () => {
    const { getByTestId } = render(
      <LoginWithTurnstile widgetPlacement="slot">
        <div data-testid="fullscreen-shell" style={{ position: 'fixed', inset: 0 }}>
          <div data-testid="card">
            <div data-testid="form">登录表单</div>
            <TurnstileSlot />
          </div>
        </div>
      </LoginWithTurnstile>,
    )

    const containers = document.querySelectorAll('[data-testid="turnstile-container"]')
    expect(containers).toHaveLength(1)
    // 关键判据:容器必须是卡片的后代,而不是 fixed 外壳的兄弟
    expect(getByTestId('card').contains(containers[0])).toBe(true)
    expect(getByTestId('form').parentElement).toBe(getByTestId('card'))
  })

  it('slot 模式但页面没放 slot:一个 widget 都不渲染(不会自己找地方冒出来)', () => {
    render(
      <LoginWithTurnstile widgetPlacement="slot">
        <div data-testid="fullscreen-shell" style={{ position: 'fixed', inset: 0 }}>
          已登录 · 授权并跳转
        </div>
      </LoginWithTurnstile>,
    )
    expect(document.querySelector('[data-testid="turnstile-container"]')).toBeNull()
    expect(renderMock).not.toHaveBeenCalled()
  })

  it('inline 默认档(登录弹窗)保持原行为:widget 跟在表单之后', () => {
    const { getByTestId } = render(
      <LoginWithTurnstile>
        <div data-testid="dialog-form">账号登录</div>
      </LoginWithTurnstile>,
    )
    const container = document.querySelector('[data-testid="turnstile-container"]')
    expect(container).not.toBeNull()
    expect(getByTestId('dialog-form').parentElement?.contains(container)).toBe(true)
  })

  it('slot 档:未验证时提交仍被闸拦住，验证通过后放行', () => {
    // 落点搬到卡片里之后，提交闸必须仍然生效 —— 否则「看得见验证窗」和「必须验证」会脱节。
    const { getByTestId } = render(
      <LoginWithTurnstile widgetPlacement="slot">
        <div style={{ position: 'fixed', inset: 0 }}>
          <div data-testid="card">
            <form data-testid="form">
              <button type="submit">登录</button>
            </form>
            <TurnstileSlot />
          </div>
        </div>
      </LoginWithTurnstile>,
    )

    const form = getByTestId('form')
    const blocked = new Event('submit', { bubbles: true, cancelable: true })
    act(() => {
      form.dispatchEvent(blocked)
    })
    expect(blocked.defaultPrevented).toBe(true)

    const options = renderMock.mock.calls[0][1]
    act(() => options.callback?.('tok-ok'))

    const allowed = new Event('submit', { bubbles: true, cancelable: true })
    act(() => {
      form.dispatchEvent(allowed)
    })
    expect(allowed.defaultPrevented).toBe(false)
  })
})

describe('token 一次性:服务端核销后必须换新票', () => {
  /**
   * Turnstile token 只能被 siteverify 验一次。登录失败重试、同页重发验证码若还拿着上一枚，
   * 后端会判 403「人机验证失败,请重试」/ 429「请先完成人机验证」，而用户明明刚验证过。
   * 这里钉死:`useTurnstile().reset()` ⇒ 本地 token 清空 + widget 收到 SDK reset，
   * 且下一轮 callback 能把新 token 装回来。
   */
  it('reset() 清空本地 token 并对 widget 调 SDK reset，下一轮回调能装回新票', () => {
    function Probe(): React.ReactElement {
      const { token, reset } = useTurnstile()
      return (
        <div>
          <span data-testid="token-state">{token ?? 'none'}</span>
          <button type="button" data-testid="reset-btn" onClick={reset}>
            reset
          </button>
        </div>
      )
    }

    const { getByTestId } = render(
      <LoginWithTurnstile>
        <Probe />
      </LoginWithTurnstile>,
    )

    // 挂载不吃重置信号:刚拿到的票不能被自己白扔
    expect(resetMock).not.toHaveBeenCalled()

    const options = renderMock.mock.calls[0][1]
    act(() => options.callback?.('token-once'))
    expect(getByTestId('token-state').textContent).toBe('token-once')

    act(() => getByTestId('reset-btn').click())
    expect(getByTestId('token-state').textContent).toBe('none')
    expect(resetMock).toHaveBeenCalledWith('widget-1')

    // 重挑战完成后新票回来，提交闸重新放行
    act(() => options.callback?.('token-second'))
    expect(getByTestId('token-state').textContent).toBe('token-second')
  })

  it('enforceSubmitGate=false 的卡片(注册/找回)只借控件不接管提交', () => {
    function Probe(): React.ReactElement {
      const { enabled } = useTurnstile()
      return <span data-testid="enabled-state">{String(enabled)}</span>
    }

    const { getByTestId } = render(
      <LoginWithTurnstile enforceSubmitGate={false}>
        <Probe />
        <form data-testid="form">
          <button type="submit">注册</button>
        </form>
      </LoginWithTurnstile>,
    )

    // provider 真在:enabled=true（表单才敢提示"请先完成人机验证"）
    expect(getByTestId('enabled-state').textContent).toBe('true')

    // 提交不被拦:注册/重置接口本身不做 siteverify，拦了只是白加摩擦
    const evt = new Event('submit', { bubbles: true, cancelable: true })
    act(() => {
      getByTestId('form').dispatchEvent(evt)
    })
    expect(evt.defaultPrevented).toBe(false)
  })

  it('没套 provider 时 enabled=false（表单不该提示去做一件没有控件可做的事）', () => {
    function Probe(): React.ReactElement {
      const { enabled } = useTurnstile()
      return <span data-testid="enabled-state">{String(enabled)}</span>
    }
    const { getByTestId } = render(<Probe />)
    expect(getByTestId('enabled-state').textContent).toBe('false')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
