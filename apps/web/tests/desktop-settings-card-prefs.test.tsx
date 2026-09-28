// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DesktopSettingsCard 的偏好控件交付面(2026-09-28 立)。
 *
 * 这里只测**卡片这一层**的五件事(宿主行为归 tests/use-desktop-desktop-prefs.test.ts):
 * 1. 关掉「显示托盘图标」时,发出去的 patch **只有那一项**;
 * 2. `showTrayIcon=false` 时「隐藏到托盘」一档按不下去并给一行原因(不是从界面上抹掉);
 * 3. 写失败必须点名 `desktopSaveFailed`,成功点名 `desktopSaved` —— 保存失败静默是这一族
 *    最常见的"看起来改了、其实没改";
 * 4. 底部那句说明按**有效档位**换措辞(三种),而不是永远写着"会最小化到托盘";
 * 5. 整卡不再留硬编码中文(本次把此前 47 处中文一并收进取词)。
 *
 * `useDesktop` / `next-intl` / `sonner` 都换成可控桩:取词桩直接回 key,所以本测试与语言包的
 * 落地进度无关(键还没加时它照样能判"有没有走 i18n")。
 * 注:mock 工厂里只引用**函数声明**(整体提升),不引用后面的 `const` —— 工厂会在导入阶段就被
 * 跑一次,那时 const 还在 TDZ 里(本仓 use-desktop-ipc-injection.test.ts 同一套形状)。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const updateDesktopPrefsMock = vi.fn()
const toastMock = { success: vi.fn(), error: vi.fn() }

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastMock.success(...args),
    error: (...args: unknown[]) => toastMock.error(...args),
  },
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }))
vi.mock('@/lib/tauri-bridge', () => ({
  isTauri: () => false,
  getLocalizedAppName: () => 'IHUI AI',
}))

// 关闭询问弹窗那套监听在 useDesktop 桩下没有宿主,挂它只会让本测试多一层无关副作用
vi.mock('@/components/common/CloseChoiceDialog', () => ({ CloseChoiceDialog: () => null }))

vi.mock('@/hooks/use-desktop', () => ({
  useDesktop: () => hookState(),
}))

/** 宿主回什么就落什么:卡片只读返回值,不参与裁定 */
let currentPrefs = hostPrefs()

/** 整体提升的函数声明:mock 工厂在导入阶段就会被调用,那时下面的 const 还没初始化 */
function hostPrefs(over: Record<string, unknown> = {}) {
  return {
    showTrayIcon: true,
    closeBehavior: 'ask',
    launchMinimized: false,
    traySingleClick: 'menu',
    unreadBadge: true,
    trayMenuItems: ['new_chat', 'show', 'hide', 'theme', 'settings', 'update', 'quit'],
    ...over,
  }
}

function hookState() {
  return {
    isDesktop: true,
    appInfo: { name: 'IHUI AI', version: '1.2.3', platform: 'windows' },
    isMaximized: false,
    autostartEnabled: false,
    trayAlwaysVisible: true,
    loading: false,
    desktopPrefsLoading: false,
    desktopPrefs: currentPrefs,
    toggleAutostart: vi.fn(async () => {}),
    toggleTrayAlwaysVisible: vi.fn(async () => true),
    updateDesktopPrefs: (patch: Record<string, unknown>) => updateDesktopPrefsMock(patch),
    resetWindow: vi.fn(async () => {}),
    notify: vi.fn(async () => {}),
    minimize: vi.fn(async () => {}),
    toggleMaximize: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  }
}

import { DesktopSettingsCard } from '../app/(main)/settings/DesktopSettingsCard'

async function toggleShowTrayIcon() {
  fireEvent.click(screen.getByRole('switch', { name: 'settings.desktopShowTrayTitle' }))
  await waitFor(() => expect(updateDesktopPrefsMock).toHaveBeenCalled())
}

beforeEach(() => {
  updateDesktopPrefsMock.mockReset()
  toastMock.success.mockReset()
  toastMock.error.mockReset()
  currentPrefs = hostPrefs()
  cleanup()
})

describe('DesktopSettingsCard — 托盘图标与关闭行为', () => {
  it('关托盘图标:patch 只带那一项,成功后提示 desktopSaved', async () => {
    updateDesktopPrefsMock.mockImplementation(async () => {
      currentPrefs = hostPrefs({ showTrayIcon: false, closeBehavior: 'quit' })
      return currentPrefs
    })
    render(<DesktopSettingsCard />)
    await toggleShowTrayIcon()

    expect(updateDesktopPrefsMock).toHaveBeenCalledWith({ showTrayIcon: false })
    expect(toastMock.success).toHaveBeenCalledWith('settings.desktopSaved')
    expect(toastMock.error).not.toHaveBeenCalled()
  })

  it('showTrayIcon=false ⇒「隐藏到托盘」按不下去且给一行原因(不是把档位藏掉)', () => {
    currentPrefs = hostPrefs({ showTrayIcon: false, closeBehavior: 'quit' })
    render(<DesktopSettingsCard />)
    const hideOption = screen.getByRole('button', { name: 'settings.desktopCloseHide' })
    expect((hideOption as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('settings.desktopCloseDisabledHint')).toBeTruthy()
    // 其余档位仍在:藏掉档位会让人以为设置丢了
    expect(screen.getByRole('button', { name: 'settings.desktopCloseAsk' })).toBeTruthy()
  })

  it('写失败 ⇒ 点名 desktopSaveFailed,不谎报已保存', async () => {
    updateDesktopPrefsMock.mockResolvedValue(null)
    render(<DesktopSettingsCard />)
    await toggleShowTrayIcon()
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('settings.desktopSaveFailed'))
    expect(toastMock.success).not.toHaveBeenCalled()
  })

  it('底部那句说明按有效档位换措辞(ask / quit 两种各测一次)', () => {
    const { unmount } = render(<DesktopSettingsCard />)
    expect(screen.getByText('settings.desktopCloseNoteAsk')).toBeTruthy()
    expect(screen.queryByText('settings.desktopCloseNoteQuit')).toBeNull()
    unmount()

    currentPrefs = hostPrefs({ showTrayIcon: false, closeBehavior: 'quit' })
    render(<DesktopSettingsCard />)
    expect(screen.getByText('settings.desktopCloseNoteQuit')).toBeTruthy()
    expect(screen.queryByText('settings.desktopCloseNoteAsk')).toBeNull()
  })

  it('整卡文案一律走 settings 取词(不留一处硬编码中文)', () => {
    render(<DesktopSettingsCard />)
    expect(document.body.textContent ?? '').not.toMatch(/[一-龥]/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
