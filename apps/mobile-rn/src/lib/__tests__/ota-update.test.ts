// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * OTA 状态机取证(2026-10-27 立)。
 *
 * 钉四件事,都是"看起来在跑、其实没跑"的高发点:
 *   ① 环境不支持(dev / web)必须**不碰** expo-updates,而不是先调再兜底;
 *   ② 有更新才下载,下载完才是 ready(否则用户点更新会重启到一个没有更新的包);
 *   ③ 任何失败都只落 error 状态、绝不抛出(自动检查失败不能打扰用户);
 *   ④ 关闭过的一次性提示,在**新一轮**就绪时必须复位 —— 否则更新永远提示不出来。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  checkForUpdateAsync: vi.fn(),
  fetchUpdateAsync: vi.fn(),
  reloadAsync: vi.fn(),
  restart: vi.fn(),
  addUpdatesStateChangeListener: vi.fn(
    (_listener: (e: { context: Record<string, unknown> }) => void) => ({ remove: vi.fn() }),
  ),
}))

vi.mock('expo-updates', () => ({
  checkForUpdateAsync: h.checkForUpdateAsync,
  fetchUpdateAsync: h.fetchUpdateAsync,
  reloadAsync: h.reloadAsync,
  isEnabled: true,
  isEmbeddedLaunch: true,
  updateId: null,
  addUpdatesStateChangeListener: h.addUpdatesStateChangeListener,
}))

/**
 * 原生真重启必须打桩(2026-10-28):release 走 ProcessPhoenix 杀进程,
 * 测试环境里没有这枚原生模块,不打桩就只能测到"模块缺失"分支。
 */
vi.mock('react-native-restart', () => ({
  default: { restart: h.restart },
}))

/**
 * 每个用例都拿一份全新的模块(store 是模块级单例,不重置会串味)。
 *
 * ⚠️ 陷阱(实测踩过):`vi.resetModules()` 之后必须**先重新 import react-native 再改 Platform.OS** ——
 * 否则拿到的是旧实例,而 ota-update 会加载一份新的 react-native(默认 OS='web')⇒
 * 所有用例都会静默落到 unsupported,看起来像"判据写错了",其实是测具自己串了实例。
 */
async function freshModule(opts: { dev?: boolean; os?: 'android' | 'ios' | 'web' } = {}) {
  vi.resetModules()
  vi.stubGlobal('__DEV__', opts.dev ?? false)
  const rn = (await import('react-native')) as unknown as { Platform: { OS: string } }
  Object.defineProperty(rn.Platform, 'OS', { value: opts.os ?? 'android', configurable: true })
  return await import('../ota-update')
}

describe('OTA 状态机:环境判定', () => {
  beforeEach(() => {
    h.checkForUpdateAsync.mockReset()
    h.fetchUpdateAsync.mockReset()
    h.reloadAsync.mockReset()
  })

  it('dev 环境 ⇒ unsupported,且不去调 expo-updates', async () => {
    const mod = await freshModule({ dev: true })
    await expect(mod.checkOtaUpdate()).resolves.toBe('unsupported')
    expect(h.checkForUpdateAsync).not.toHaveBeenCalled()
  })

  it('web 平台 ⇒ unsupported(web 走自己的 PWA 链路)', async () => {
    const mod = await freshModule({ os: 'web' })
    await expect(mod.checkOtaUpdate()).resolves.toBe('unsupported')
    expect(h.checkForUpdateAsync).not.toHaveBeenCalled()
  })
})

describe('OTA 状态机:检查 → 下载 → 就绪', () => {
  beforeEach(() => {
    h.checkForUpdateAsync.mockReset()
    h.fetchUpdateAsync.mockReset()
    h.reloadAsync.mockReset()
  })

  it('有更新 ⇒ 下载并落到 ready', async () => {
    h.checkForUpdateAsync.mockResolvedValue({ isAvailable: true })
    h.fetchUpdateAsync.mockResolvedValue(undefined)
    const mod = await freshModule()
    await expect(mod.checkOtaUpdate()).resolves.toBe('ready')
    expect(h.fetchUpdateAsync).toHaveBeenCalledTimes(1)
  })

  it('downloading 期间原生进度事件驱动读条;isDownloading=false 的事件不采样', async () => {
    h.checkForUpdateAsync.mockResolvedValue({ isAvailable: true })
    let resolveFetch: () => void = () => {}
    h.fetchUpdateAsync.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFetch = resolve
        }),
    )
    const mod = await freshModule()
    const checkPromise = mod.checkOtaUpdate()
    await vi.waitFor(() => expect(mod.otaSnapshot().state).toBe('downloading'))
    expect(mod.otaSnapshot().downloadProgress).toBe(0)
    const listener = h.addUpdatesStateChangeListener.mock.calls.at(-1)?.[0]
    expect(listener).toBeTypeOf('function')
    listener!({ context: { isDownloading: true, downloadProgress: 0.42 } })
    expect(mod.otaSnapshot().downloadProgress).toBe(42)
    // 非 downloading 的状态事件不该把读数写脏(摘掉这条守卫读条会在空闲期乱跳)
    listener!({ context: { isDownloading: false, downloadProgress: 0.9 } })
    expect(mod.otaSnapshot().downloadProgress).toBe(42)
    resolveFetch()
    await expect(checkPromise).resolves.toBe('ready')
  })

  it('无更新 ⇒ up-to-date,且不下载', async () => {
    h.checkForUpdateAsync.mockResolvedValue({ isAvailable: false })
    const mod = await freshModule()
    await expect(mod.checkOtaUpdate()).resolves.toBe('up-to-date')
    expect(h.fetchUpdateAsync).not.toHaveBeenCalled()
  })

  it('检查抛错 ⇒ error,不向上抛', async () => {
    h.checkForUpdateAsync.mockRejectedValue(new Error('offline'))
    const mod = await freshModule()
    await expect(mod.checkOtaUpdate()).resolves.toBe('error')
  })

  it('下载抛错 ⇒ error(不能停在 downloading 假装还在下)', async () => {
    h.checkForUpdateAsync.mockResolvedValue({ isAvailable: true })
    h.fetchUpdateAsync.mockRejectedValue(new Error('download broke'))
    const mod = await freshModule()
    await expect(mod.checkOtaUpdate()).resolves.toBe('error')
  })
})

describe('OTA 状态机:提示的一次性关闭与复位', () => {
  beforeEach(() => {
    h.checkForUpdateAsync.mockReset()
    h.fetchUpdateAsync.mockReset()
    h.reloadAsync.mockReset()
    h.checkForUpdateAsync.mockResolvedValue({ isAvailable: true })
    h.fetchUpdateAsync.mockResolvedValue(undefined)
  })

  it('关闭后 dismissed=true,新一轮就绪时复位为 false', async () => {
    const mod = await freshModule()
    await mod.checkOtaUpdate()
    mod.dismissOtaPrompt()
    expect(mod.otaSnapshot().dismissed).toBe(true)
    await mod.checkOtaUpdate()
    expect(mod.otaSnapshot().dismissed).toBe(false)
  })
})

describe('OTA 状态机:重启生效', () => {
  beforeEach(() => {
    h.reloadAsync.mockReset()
    h.restart.mockReset()
  })

  it('apply ⇒ 调原生真重启 RNRestart.restart,成功返回 true', async () => {
    const mod = await freshModule()
    await expect(mod.applyOtaUpdate()).resolves.toBe(true)
    expect(h.restart).toHaveBeenCalledWith('ota-apply')
  })

  it('**绝不**调 reloadAsync(2026-10-28:它就是灰屏卡死的来源)', async () => {
    const mod = await freshModule()
    await mod.applyOtaUpdate()
    expect(h.reloadAsync).not.toHaveBeenCalled()
  })

  it('原生重启抛错 ⇒ 回到 ready(卡片继续在,可再点一次重试)并返回 false', async () => {
    // 2026-10-27 修的真 bug:原来失败落 error 态,而提示卡只在 ready 渲染
    // ⇒ 卡片直接消失,用户既看不到原因也没有重试入口,只能等下次冷启动。
    h.restart.mockImplementation(() => {
      throw new Error('native module missing')
    })
    const mod = await freshModule()
    await expect(mod.applyOtaUpdate()).resolves.toBe(false)
    expect(mod.otaSnapshot().state).toBe('ready')
    expect(mod.otaSnapshot().lastError).toContain('native module missing')
  })

  it('重启前先把状态推到 installing(重启页要来得及画出来)', async () => {
    const mod = await freshModule()
    // 只在 native 调用里读状态:调用之后进程就没了,这时读到的必须已经是 installing
    let seen: string | null = null
    h.restart.mockImplementation(() => {
      seen = mod.otaSnapshot().state
    })
    await mod.applyOtaUpdate()
    expect(seen).toBe('installing')
  })
})

describe('OTA 状态机:并发去重(自动检查与设置页手动检查会撞车)', () => {
  beforeEach(() => {
    h.checkForUpdateAsync.mockReset()
    h.fetchUpdateAsync.mockReset()
  })

  it('两趟同时进来只真正跑一趟', async () => {
    // 用对象装回调:直接 `let release: (()=>void)|null` 会被 TS 控制流分析收窄成 null(赋值在回调里),
    // 调用处报 "Type 'never' has no call signatures"。
    const gate: { release?: () => void } = {}
    h.checkForUpdateAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          gate.release = () => resolve({ isAvailable: true })
        }),
    )
    h.fetchUpdateAsync.mockResolvedValue(undefined)

    const mod = await freshModule()
    const a = mod.checkOtaUpdate()
    const b = mod.checkOtaUpdate()
    // 等第一趟真正进到 checkForUpdateAsync 内部再放行
    await Promise.resolve()
    gate.release?.()

    await expect(Promise.all([a, b])).resolves.toEqual(['ready', 'ready'])
    expect(h.checkForUpdateAsync).toHaveBeenCalledTimes(1)
    expect(h.fetchUpdateAsync).toHaveBeenCalledTimes(1)
  })
})

describe('OTA 状态机:回前台补查判据', () => {
  beforeEach(() => {
    h.checkForUpdateAsync.mockReset()
    h.fetchUpdateAsync.mockReset()
    h.checkForUpdateAsync.mockResolvedValue({ isAvailable: true })
    h.fetchUpdateAsync.mockResolvedValue(undefined)
  })

  it('从未查过 ⇒ 该补查', async () => {
    const mod = await freshModule()
    expect(mod.shouldAutoRecheck(30 * 60 * 1000)).toBe(true)
  })

  it('已有 ready 在等用户 ⇒ 不补查(否则卡片会被推回 checking 闪一下)', async () => {
    const mod = await freshModule()
    await mod.checkOtaUpdate()
    expect(mod.otaSnapshot().state).toBe('ready')
    expect(mod.shouldAutoRecheck(0)).toBe(false)
  })

  it('用户已关掉提示 ⇒ 不自动补查', async () => {
    const mod = await freshModule()
    await mod.checkOtaUpdate()
    mod.dismissOtaPrompt()
    expect(mod.shouldAutoRecheck(0)).toBe(false)
  })

  it('间隔不足 ⇒ 不补查;超过间隔 ⇒ 补查', async () => {
    h.checkForUpdateAsync.mockResolvedValue({ isAvailable: false })
    const mod = await freshModule()
    await mod.checkOtaUpdate()
    expect(mod.shouldAutoRecheck(30 * 60 * 1000)).toBe(false)
    // 把"上次检查时刻"往回拨 31 分钟
    const now = Date.now()
    const spy = vi.spyOn(Date, 'now').mockReturnValue(now + 31 * 60 * 1000)
    try {
      expect(mod.shouldAutoRecheck(30 * 60 * 1000)).toBe(true)
    } finally {
      spy.mockRestore()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
