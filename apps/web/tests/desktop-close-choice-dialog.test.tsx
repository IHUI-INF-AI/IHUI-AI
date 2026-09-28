// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CloseChoiceDialog 的「恰好一次」契约(2026-09-28 立)。
 *
 * 宿主等这次答复只等 3 秒,超时走它自己的兜底并记一条日志 —— 所以两种失败都得钉住:
 *  - **少答**:事件已投来却没人应答(组件被卸载、用户按了 Esc 却只关窗不留结论);
 *  - **多答**:同一轮询问被投来两次(重复注册 / 重复渲染)就答两次。
 * 用例里"派发两次事件 + 只点一次按钮"这一条证明的是第二种;
 * "没事件就卸载 ⇒ 一次都不答"证明的是第三种失败(把没发生过的事答复出去同样是脏数据)。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

// 桩必须经 vi.hoisted 取名:vi.mock 工厂会在**导入阶段**被调用(早于本文件任何顶层语句),
// 工厂里直接引用 `const resolveMock` 就是 TDZ —— 现象是整份套件 0 个用例、
// 报 "Cannot access 'resolveMock' before initialization"(2026-09-28 踩实)。
const resolveMock = vi.hoisted(() =>
  vi.fn<(choice: string, remember: boolean) => Promise<void>>(async () => {}),
)

vi.mock('next-intl', () => ({
  // 裸渲染会抛 "NextIntlClientProvider context was not found",组件在第一帧就死掉,
  // 于是断言看到的是空 DOM —— 现象会被误读成"接线断了"。桩成 ns.key,断言按 key 名写。
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}))

// 本文件只关心"发没发、发几次":桥里的 ready 闸门与 invoke 参数形状由
// desktop-prefs-bridge.test.ts 单独看守,这里整体替换,免去装 IPC。
vi.mock('@/lib/desktop-prefs-bridge', () => ({
  resolveCloseChoice: resolveMock,
}))

import { CloseChoiceDialog } from '@/components/common/CloseChoiceDialog'

/**
 * 派发的这次必须在 act 里生效:React 19 下未包 act 的 setState 不会立刻 flush,
 * 弹窗停在关着的状态,下面每一条 getByRole 都会变成"找不到元素"
 * (2026-09-28 踩实:报错正文是 <body><div /></body>,和组件真没挂上一模一样)。
 */
function ask() {
  act(() => {
    window.dispatchEvent(new CustomEvent('desktop-close-requested'))
  })
}

beforeEach(() => {
  resolveMock.mockReset()
})

// 卸载也必须在 mock 复位之后:上一个用例留下的对话框,会在卸载兜底里补一发 cancel,
// 那一发落进下一个用例的 mock 计数里 —— 于是"多答一次"的指控落到了无辜的用例头上。
afterEach(() => {
  cleanup()
  resolveMock.mockReset()
})

describe('CloseChoiceDialog', () => {
  it('同一轮询问被投来两次 ⇒ 只答一次,且答的是宿主契约里的档位', () => {
    render(<CloseChoiceDialog />)
    ask()
    ask() // 重复投递:不得起第二轮、更不得答两次
    expect(screen.getByText('settings.desktopAskTitle')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'settings.desktopAskHide' }))
    expect(resolveMock).toHaveBeenCalledTimes(1)
    expect(resolveMock).toHaveBeenCalledWith('hide', false)
  })

  it('答完之后再点别的按钮也不补发(退出/取消/隐藏三钮任一只生效一次)', () => {
    render(<CloseChoiceDialog />)
    ask()
    // 先把三颗都取到手:答完之后弹窗会关,再按名字查第二颗就成了"查不到元素"的假失败。
    const quit = screen.getByRole('button', { name: 'settings.desktopAskQuit' })
    const cancel = screen.getByRole('button', { name: 'settings.desktopAskCancel' })
    const hide = screen.getByRole('button', { name: 'settings.desktopAskHide' })
    fireEvent.click(quit)
    fireEvent.click(cancel)
    fireEvent.click(hide)
    expect(resolveMock).toHaveBeenCalledTimes(1)
    expect(resolveMock).toHaveBeenCalledWith('quit', false)
  })

  it('勾了「记住我的选择」⇒ remember=true 一起交给宿主', () => {
    render(<CloseChoiceDialog />)
    ask()
    fireEvent.click(screen.getByRole('checkbox', { name: 'settings.desktopAskRemember' }))
    fireEvent.click(screen.getByRole('button', { name: 'settings.desktopAskHide' }))
    expect(resolveMock).toHaveBeenCalledWith('hide', true)
  })

  it('卸载时仍有未答的询问 ⇒ 以 cancel 收尾,而不是让宿主空等 3 秒', () => {
    const { unmount } = render(<CloseChoiceDialog />)
    ask()
    unmount()
    expect(resolveMock).toHaveBeenCalledTimes(1)
    expect(resolveMock).toHaveBeenCalledWith('cancel', false)
  })

  it('没问过就别答:未收到事件时卸载不产生任何答复', () => {
    const { unmount } = render(<CloseChoiceDialog />)
    unmount()
    expect(resolveMock).not.toHaveBeenCalled()
  })

  it('已答过之后再卸载 ⇒ 不重复答(卸载兜底不得把上一轮的结论再发一次)', () => {
    const { unmount } = render(<CloseChoiceDialog />)
    ask()
    fireEvent.click(screen.getByRole('button', { name: 'settings.desktopAskCancel' }))
    unmount()
    expect(resolveMock).toHaveBeenCalledTimes(1)
  })

  it('关闭动作(Esc / 遮罩)也按 cancel 留下结论,不是只把窗关掉', () => {
    const { unmount } = render(<CloseChoiceDialog />)
    ask()
    // Radix 的 dismiss 走 onOpenChange(false):Esc 就是这条路径的合成事件版本
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(resolveMock).toHaveBeenCalledTimes(1)
    expect(resolveMock).toHaveBeenCalledWith('cancel', false)
    unmount()
    expect(resolveMock).toHaveBeenCalledTimes(1)
  })

  // 挂载位置锁:这个弹框必须在**全局宿主**里,不能在设置卡片里。
  // 挂在卡片里时只有人在 /settings 才会被问到,其他页面点 × 会静默走宿主的 3 秒兜底 ——
  // 现象是"设了每次询问却从来不问",而类型、测试、接线门全都不会红(本仓最高频失效型:安静)。
  it('弹框挂在全局 provider,且不得被搬回设置卡片(反向锁)', async () => {
    const { readFileSync, existsSync } = await import('node:fs')
    const { join } = await import('node:path')
    // vitest 下 import.meta.url 是 http 形态(vite 转译),不能直接当文件路径;
    // 而"读不到文件"必须喊出找的是哪条路径,否则本锁会退化成"永远绿"。
    const read = (rel: string) => {
      const abs = join(process.cwd(), rel)
      if (!existsSync(abs)) throw new Error(`挂载位置锁找不到被测源文件:${abs}(cwd 不是 apps/web?)`)
      return readFileSync(abs, 'utf8')
    }
    const provider = read('src/providers/global-hooks-provider.tsx')
    const card = read('app/(main)/settings/DesktopSettingsCard.tsx')
    expect(provider).toMatch(/<CloseChoiceDialog\s*\/>/)
    expect(card).not.toMatch(/<CloseChoiceDialog\s*\/>/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
