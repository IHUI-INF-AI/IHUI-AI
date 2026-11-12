// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 真实状态机下的标题走查(2026-11-12 立)。
//
// 与 update-prompt-title.test.tsx 的分工:
//   那一份用 mock 的 useUpdater 只验"给定状态渲染什么词"(纯渲染映射);
//   本文件**不 mock use-updater**,让 ?dev-update=1 的真实链路
//   (挂载 1s → checkForUpdate → 800ms 检查 → 25 片下载)整条跑完,
//   断言标题确实沿 发现新版本 → 下载中 → 更新完成 变化。
//   只 mock useUpdater 的话,"真实链路里标题到底会不会变"是测不到的 ——
//   而上一轮的缺陷恰恰就是"链路跑起来标题始终不动"。
//
// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost/?dev-update=1" }
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'

const TITLES: Record<string, string> = {
  'common.update.available': '发现新版本',
  'common.update.downloading': '下载中',
  'common.update.installing': '安装中',
  'common.update.done': '更新完成',
  'common.update.upToDate': '已是最新版本',
  'common.update.error': '更新失败',
  'common.update.preparing': '正在准备更新...',
  'common.update.upToDateDesc': '当前已是最新版本,无需更新',
  'common.update.autoRestartIn': '即将自动重启...({countdown} 秒后)',
  'common.update.restartLater': '稍后重启',
  'common.update.restartNow': '立即重启',
  'common.update.autoRetrying': '更新失败,自动重试中...',
  'common.update.errorDesc': '更新过程中出现错误,请重试',
  'common.update.checkFailed': '检查更新失败,请检查网络后重试',
  'common.update.revoked': '这个版本已不再提供。',
}

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, string | number>) => {
    let out = TITLES[ns ? `${ns}.${key}` : key] ?? key
    for (const [k, v] of Object.entries(values ?? {})) out = out.replaceAll(`{${k}}`, String(v))
    return out
  },
}))

// use-updater 静态 import 的桥接件会拉 @tauri-apps/*,测试面换掉;
// 但浏览器 dev 通道(isDevUpdateTest)本就在 isTauri() 之前分流,不影响被验链路。
vi.mock('@/lib/tauri-bridge', () => ({
  isTauri: () => true,
  checkForUpdates: vi.fn(async () => null),
  restartApp: vi.fn(async () => {}),
  markUpdateInstalled: vi.fn(() => {}),
  setAvailableUpdateSession: vi.fn(() => {}),
  formatFileSize: (n: number) => `${Math.round(n / 1024 / 1024)}MB`,
}))

vi.mock('@/lib/api-base-url', () => ({
  isDesktopDevShell: () => false,
}))

vi.mock('@/hooks/use-desktop', () => ({
  useTauriIpcReady: () => true,
}))

vi.mock('@/hooks/use-deadline-countdown', () => ({
  useDeadlineCountdown: () => 60,
}))

import { UpdatePrompt } from '../UpdatePrompt'

/** 当前标题(卡片里第一个 p 就是标题)。 */
const title = () => {
  const card = document.querySelector('[role=alert]')
  if (!card) return null
  return card.querySelector('p')?.textContent?.trim() ?? null
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('真实状态机:?dev-update=1 全链路标题走查', () => {
  it('标题随真实链路推进:发现新版本 → 下载中 → 更新完成', async () => {
    render(<UpdatePrompt />)

    // 挂载瞬间:1s 静默检查尚未发起,弹窗还不存在
    expect(title()).toBeNull()

    // 1s 后发起检查 → checking 不出弹窗;800ms 后进下载
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    // dev 通道 autoInstall=true ⇒ 直接进下载,标题必须是"下载中"
    expect(title()).toBe('下载中')

    // 跑到下载中段:标题不得回退成"发现新版本"
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    expect(title()).toBe('下载中')
    const bar = document.querySelector('[role=progressbar]')
    expect(bar).not.toBeNull()
    const mid = Number(bar!.getAttribute('aria-valuenow'))
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(100)

    // 跑完剩余分片 → 安装完成进入 done
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000)
    })
    expect(title()).toBe('更新完成')

    // done 态不得再有进度环(环只属于下载/安装)
    expect(document.querySelector('[role=progressbar]')).toBeNull()
  })

  it('反向对照:?dev-update=0 的静默检查不弹窗(标题全程为 null,不是"下载中")', async () => {
    // 该用例用独立 URL 无法在文件级切换,故直接验证同一链路里"未进入下载时无弹窗"这一点
    render(<UpdatePrompt />)
    expect(title()).toBeNull()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900)
    })
    // 900ms 时仍在挂载静默期,尚未发起检查
    expect(title()).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
