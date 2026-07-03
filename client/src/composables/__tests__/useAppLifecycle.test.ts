// useAppLifecycle 单元测试
// 覆盖：useAppLifecycle 全部行为 + computeScrollFadeProgress 内部函数

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ===== Mock 依赖 =====

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock auth store
const mockLogout = vi.fn()
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    logout: mockLogout,
  })),
}))

// Mock dark mode store
const mockToggleDarkMode = vi.fn()
const mockDarkModeStore = { isDarkMode: false, toggleDarkMode: mockToggleDarkMode }
vi.mock('@/stores/darkMode', () => ({
  useDarkModeStore: vi.fn(() => mockDarkModeStore),
}))

// Mock vue-router (push 必须返回 Promise, 源码里用了 router.push('/').catch())
const mockRouterPush = vi.fn(() => Promise.resolve())
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: mockRouterPush,
  })),
}))

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({
    t: (key: string) => key,
  })),
}))

// Mock useLoginDialog (会话过期通知的"重新登录"按钮 + onClick 回调会调用)
const mockLoginDialogOpen = vi.fn()
vi.mock('@/composables/useLoginDialog', () => ({
  useLoginDialog: vi.fn(() => ({
    open: mockLoginDialogOpen,
  })),
}))

// Mock element-plus（用于 Alt+T 提示 + 会话过期通知）
vi.mock('element-plus', () => ({
  ElMessage: {
    success: vi.fn(),
  },
  ElNotification: vi.fn(() => ({
    close: vi.fn(),
  })),
  ElButton: {
    name: 'ElButton',
  },
}))

// Mock vue 生命周期（直接同步执行 onMounted 回调，保留 onUnmounted）
let mountedCallback: (() => void) | null = null
let unmountedCallback: (() => void) | null = null
vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...actual,
    onMounted: vi.fn((cb: () => void) => {
      mountedCallback = cb
    }),
    onUnmounted: vi.fn((cb: () => void) => {
      unmountedCallback = cb
    }),
  }
})

// ===== 导入被测对象（必须在 mock 之后） =====
import { useAppLifecycle } from '../useAppLifecycle'
import { logger } from '@/utils/logger'
import { ElMessage } from 'element-plus'

// ===== 测试工具：触发 onMounted/onUnmounted =====
const triggerMount = () => {
  if (mountedCallback) mountedCallback()
}
const triggerUnmount = () => {
  if (unmountedCallback) unmountedCallback()
}

// ===== 公共清理 =====
beforeEach(() => {
  vi.clearAllMocks()
  mountedCallback = null
  unmountedCallback = null
  mockDarkModeStore.isDarkMode = false
  // 清理 window 上的全局方法
  delete (window as any).openGlobalChat
  delete (window as any).selectAgent
  delete (window as any).showGlobalNotification
  // 重置 path
  Object.defineProperty(window, 'location', {
    value: { pathname: '/' },
    writable: true,
    configurable: true,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ===== 测试 =====
describe('useAppLifecycle', () => {
  describe('基础返回结构', () => {
    it('应该返回 isHome / install / dispose', () => {
      const lifecycle = useAppLifecycle()
      expect(lifecycle.isHome).toBeDefined()
      expect(lifecycle.isHome.value).toBe(false)
      expect(typeof lifecycle.install).toBe('function')
      expect(typeof lifecycle.dispose).toBe('function')
    })

    it('挂载后 isHome 应该根据 pathname 判定', () => {
      Object.defineProperty(window, 'location', {
        value: { pathname: '/' },
        writable: true,
        configurable: true,
      })
      const lifecycle = useAppLifecycle()
      triggerMount()
      return Promise.resolve().then(() => {
        expect(lifecycle.isHome.value).toBe(true)
      })
    })

    it('挂载后 isHome 在 /home 应为 true', () => {
      Object.defineProperty(window, 'location', {
        value: { pathname: '/home' },
        writable: true,
        configurable: true,
      })
      const lifecycle = useAppLifecycle()
      triggerMount()
      return Promise.resolve().then(() => {
        expect(lifecycle.isHome.value).toBe(true)
      })
    })

    it('挂载后 isHome 在其他路径应为 false', () => {
      Object.defineProperty(window, 'location', {
        value: { pathname: '/dashboard' },
        writable: true,
        configurable: true,
      })
      const lifecycle = useAppLifecycle()
      triggerMount()
      return Promise.resolve().then(() => {
        expect(lifecycle.isHome.value).toBe(false)
      })
    })
  })

  describe('install 行为', () => {
    it('应该在 window 上挂载 keydown / session-expired / open-ai-chat / select-agent / scroll 监听', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')
      const lifecycle = useAppLifecycle()
      lifecycle.install()
      const events = addSpy.mock.calls.map(c => c[0])
      expect(events).toContain('keydown')
      expect(events).toContain('session-expired')
      expect(events).toContain('open-ai-chat')
      expect(events).toContain('select-agent')
      expect(events).toContain('scroll')
    })

    it('onMounted 触发时应自动调用 install', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')
      useAppLifecycle()
      triggerMount()
      expect(addSpy).toHaveBeenCalled()
    })
  })

  describe('dispose 行为', () => {
    it('应该移除所有挂载的事件', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener')
      const lifecycle = useAppLifecycle()
      lifecycle.install()
      lifecycle.dispose()
      const events = removeSpy.mock.calls.map(c => c[0])
      expect(events).toContain('keydown')
      expect(events).toContain('session-expired')
      expect(events).toContain('open-ai-chat')
      expect(events).toContain('select-agent')
      expect(events).toContain('scroll')
    })

    it('onUnmounted 触发时应自动调用 dispose', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener')
      const lifecycle = useAppLifecycle()
      lifecycle.install()
      triggerUnmount()
      expect(removeSpy).toHaveBeenCalled()
    })

    it('多次 dispose 不应抛错', () => {
      const lifecycle = useAppLifecycle()
      lifecycle.install()
      lifecycle.dispose()
      expect(() => lifecycle.dispose()).not.toThrow()
    })
  })

  describe('Alt+T 暗色模式快捷键', () => {
    it('按 Alt+T 应该切换暗色模式', () => {
      const lifecycle = useAppLifecycle()
      lifecycle.install()
      const event = new KeyboardEvent('keydown', { key: 't', altKey: true })
      const preventSpy = vi.spyOn(event, 'preventDefault')
      window.dispatchEvent(event)
      expect(mockToggleDarkMode).toHaveBeenCalled()
      expect(preventSpy).toHaveBeenCalled()
    })

    it('按 Alt+大写 T 也应该切换暗色模式', () => {
      const lifecycle = useAppLifecycle()
      lifecycle.install()
      const event = new KeyboardEvent('keydown', { key: 'T', altKey: true })
      window.dispatchEvent(event)
      expect(mockToggleDarkMode).toHaveBeenCalled()
    })

    it('按 Alt+其他键不应触发切换', () => {
      const lifecycle = useAppLifecycle()
      lifecycle.install()
      const event = new KeyboardEvent('keydown', { key: 'a', altKey: true })
      window.dispatchEvent(event)
      expect(mockToggleDarkMode).not.toHaveBeenCalled()
    })

    it('不按 Alt 时按 T 不应触发', () => {
      const lifecycle = useAppLifecycle()
      lifecycle.install()
      const event = new KeyboardEvent('keydown', { key: 't' })
      window.dispatchEvent(event)
      expect(mockToggleDarkMode).not.toHaveBeenCalled()
    })

    it('切换至深色时应该展示深色提示', async () => {
      mockDarkModeStore.isDarkMode = true
      const lifecycle = useAppLifecycle()
      lifecycle.install()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', altKey: true }))
      // 等待动态 import 解析
      await new Promise(r => setTimeout(r, 0))
      expect(ElMessage.success).toHaveBeenCalled()
    })

    it('切换至浅色时应该展示浅色提示', async () => {
      mockDarkModeStore.isDarkMode = false
      const lifecycle = useAppLifecycle()
      lifecycle.install()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', altKey: true }))
      await new Promise(r => setTimeout(r, 0))
      expect(ElMessage.success).toHaveBeenCalled()
    })
  })

  describe('session-expired 事件', () => {
    it('触发后应调用 auth.logout 和 router.push(/)', () => {
      const lifecycle = useAppLifecycle()
      lifecycle.install()
      window.dispatchEvent(new CustomEvent('session-expired'))
      expect(mockLogout).toHaveBeenCalled()
      expect(mockRouterPush).toHaveBeenCalledWith('/')
    })

    it('应直接调 ElNotification 弹顶部下滑通知(不走 showGlobalNotification 横幅)', async () => {
      const { ElNotification } = await import('element-plus')
      const notify = vi.fn()
      ;(window as any).showGlobalNotification = notify
      const lifecycle = useAppLifecycle()
      lifecycle.install()
      window.dispatchEvent(new CustomEvent('session-expired', { detail: { reason: '凭证已过期' } }))
      expect(notify).not.toHaveBeenCalled()
      expect(ElNotification).toHaveBeenCalled()
      const opts = (ElNotification as unknown as { mock: { calls: Array<[unknown]> } }).mock.calls[0][0] as {
        type: string
        position: string
        duration: number
        customClass: string
        message: unknown
      }
      expect(opts.type).toBe('warning')
      expect(opts.position).toBe('top-left')
      expect(opts.duration).toBe(8000)
      expect(opts.customClass).toBe('session-expired-notification')
      expect(opts.message).toBeDefined()
    })

    it('未提供 reason 时应使用 i18n 文案', async () => {
      const { ElNotification } = await import('element-plus')
      const lifecycle = useAppLifecycle()
      lifecycle.install()
      window.dispatchEvent(new CustomEvent('session-expired'))
      expect(ElNotification).toHaveBeenCalled()
      const opts = (ElNotification as unknown as { mock: { calls: Array<[unknown]> } }).mock.calls[0][0] as {
        title: string
      }
      // title 走 i18n (mock 直接返回 key)
      expect(opts.title).toBe('auth.sessionExpiredTitle')
    })

    it('ElNotification 配置应包含 onClick 回调(点击通知本体可弹登录框)', async () => {
      const { ElNotification } = await import('element-plus')
      const lifecycle = useAppLifecycle()
      lifecycle.install()
      window.dispatchEvent(new CustomEvent('session-expired'))
      const opts = (ElNotification as unknown as { mock: { calls: Array<[unknown]> } }).mock.calls[0][0] as {
        onClick: (e?: MouseEvent) => void
      }
      expect(typeof opts.onClick).toBe('function')
    })

    it('onClick 点击非按钮区域应弹出登录框 + 关闭通知', async () => {
      const { ElNotification } = await import('element-plus')
      const closeFn = vi.fn()
      ;(ElNotification as unknown as { mockReturnValue: unknown }).mockReturnValue = { close: closeFn }
      ;(ElNotification as unknown as (...a: unknown[]) => unknown).mockImplementation(() => ({ close: closeFn }))
      const lifecycle = useAppLifecycle()
      lifecycle.install()
      window.dispatchEvent(new CustomEvent('session-expired'))
      const opts = (ElNotification as unknown as { mock: { calls: Array<[unknown]> } }).mock.calls[0][0] as {
        onClick: (e?: MouseEvent) => void
      }
      // 模拟点击通知本体(无 target 或 target 不在按钮内)
      opts.onClick({ target: document.createElement('div') } as unknown as MouseEvent)
      expect(mockLoginDialogOpen).toHaveBeenCalledWith('login')
      expect(closeFn).toHaveBeenCalled()
    })

    it('onClick 点击按钮区域不应重复弹出登录框(按钮有自己的处理逻辑)', async () => {
      const { ElNotification } = await import('element-plus')
      const closeFn = vi.fn()
      ;(ElNotification as unknown as (...a: unknown[]) => unknown).mockImplementation(() => ({ close: closeFn }))
      const lifecycle = useAppLifecycle()
      lifecycle.install()
      window.dispatchEvent(new CustomEvent('session-expired'))
      const opts = (ElNotification as unknown as { mock: { calls: Array<[unknown]> } }).mock.calls[0][0] as {
        onClick: (e?: MouseEvent) => void
      }
      // 模拟点击 ElButton 内部元素
      const btn = document.createElement('button')
      btn.className = 'el-button'
      const span = document.createElement('span')
      btn.appendChild(span)
      opts.onClick({ target: span } as unknown as MouseEvent)
      expect(mockLoginDialogOpen).not.toHaveBeenCalled()
    })

    it('onClick 点击关闭按钮不应弹出登录框', async () => {
      const { ElNotification } = await import('element-plus')
      const closeFn = vi.fn()
      ;(ElNotification as unknown as (...a: unknown[]) => unknown).mockImplementation(() => ({ close: closeFn }))
      const lifecycle = useAppLifecycle()
      lifecycle.install()
      window.dispatchEvent(new CustomEvent('session-expired'))
      const opts = (ElNotification as unknown as { mock: { calls: Array<[unknown]> } }).mock.calls[0][0] as {
        onClick: (e?: MouseEvent) => void
      }
      // 模拟点击 Element Plus 自带的关闭按钮
      const closeBtn = document.createElement('i')
      closeBtn.className = 'el-notification__closeBtn'
      opts.onClick({ target: closeBtn } as unknown as MouseEvent)
      expect(mockLoginDialogOpen).not.toHaveBeenCalled()
    })
  })

  describe('open-ai-chat 事件', () => {
    it('应用 window.openGlobalChat 存在时调用并传 mode', () => {
      const open = vi.fn()
      ;(window as any).openGlobalChat = open
      const lifecycle = useAppLifecycle()
      lifecycle.install()
      window.dispatchEvent(new CustomEvent('open-ai-chat', { detail: { mode: 'chat' } }))
      expect(open).toHaveBeenCalledWith({ mode: 'chat' })
    })

    it('无 detail 时也应调用', () => {
      const open = vi.fn()
      ;(window as any).openGlobalChat = open
      const lifecycle = useAppLifecycle()
      lifecycle.install()
      window.dispatchEvent(new CustomEvent('open-ai-chat'))
      expect(open).toHaveBeenCalledWith({ mode: undefined })
    })

    it('window.openGlobalChat 不存在时不应抛错', () => {
      const lifecycle = useAppLifecycle()
      lifecycle.install()
      expect(() => {
        window.dispatchEvent(new CustomEvent('open-ai-chat', { detail: { mode: 'chat' } }))
      }).not.toThrow()
    })
  })

  describe('select-agent 事件', () => {
    it('应用 window.selectAgent 存在且提供 agent 时调用', () => {
      const sel = vi.fn()
      ;(window as any).selectAgent = sel
      const lifecycle = useAppLifecycle()
      lifecycle.install()
      const agent = { id: 'a1', name: 'tester' }
      window.dispatchEvent(new CustomEvent('select-agent', { detail: { agent } }))
      expect(sel).toHaveBeenCalledWith(agent)
    })

    it('未提供 agent 时不应调用', () => {
      const sel = vi.fn()
      ;(window as any).selectAgent = sel
      const lifecycle = useAppLifecycle()
      lifecycle.install()
      window.dispatchEvent(new CustomEvent('select-agent'))
      expect(sel).not.toHaveBeenCalled()
    })

    it('window.selectAgent 不存在时不应抛错', () => {
      const lifecycle = useAppLifecycle()
      lifecycle.install()
      expect(() => {
        window.dispatchEvent(new CustomEvent('select-agent', { detail: { agent: { id: 'a' } } }))
      }).not.toThrow()
    })
  })

  describe('scroll 渐变节流', () => {
    it('滚动时应用 rAF 中调用 onScrollFade 回调', () => {
      // jsdom 不会自动触发 rAF，改为同步执行
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        cb(0)
        return 1
      })
      const onScrollFade = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { pathname: '/x' },
        writable: true,
        configurable: true,
      })
      const lifecycle = useAppLifecycle({ onScrollFade })
      lifecycle.install()
      window.dispatchEvent(new Event('scroll'))
      expect(onScrollFade).toHaveBeenCalled()
      vi.unstubAllGlobals()
    })

    it('连续触发滚动时应用 rAF 中合并（不会多次回调）', () => {
      // 通过 spy 验证 rAF 只调度一次
      const rafSpy = vi.fn(() => 1)
      vi.stubGlobal('requestAnimationFrame', rafSpy)
      const onScrollFade = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { pathname: '/x' },
        writable: true,
        configurable: true,
      })
      const lifecycle = useAppLifecycle({ onScrollFade })
      lifecycle.install()
      window.dispatchEvent(new Event('scroll'))
      window.dispatchEvent(new Event('scroll'))
      window.dispatchEvent(new Event('scroll'))
      // 节流：连续触发只调度了 1 次 rAF
      expect(rafSpy).toHaveBeenCalledTimes(1)
      vi.unstubAllGlobals()
    })

    it('dispose 应该取消未执行的 rAF', () => {
      const cancelSpy = vi.fn()
      vi.stubGlobal('requestAnimationFrame', () => 1)
      vi.stubGlobal('cancelAnimationFrame', cancelSpy)
      Object.defineProperty(window, 'location', {
        value: { pathname: '/x' },
        writable: true,
        configurable: true,
      })
      const lifecycle = useAppLifecycle()
      lifecycle.install()
      window.dispatchEvent(new Event('scroll'))
      lifecycle.dispose()
      expect(cancelSpy).toHaveBeenCalledWith(1)
      vi.unstubAllGlobals()
    })

    it('updateScrollFade 内部异常应被 try/catch 兜底', () => {
      const onScrollFade = vi.fn(() => { throw new Error('boom') })
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        cb(0)
        return 1
      })
      Object.defineProperty(window, 'location', {
        value: { pathname: '/x' },
        writable: true,
        configurable: true,
      })
      const lifecycle = useAppLifecycle({ onScrollFade })
      lifecycle.install()
      expect(() => window.dispatchEvent(new Event('scroll'))).not.toThrow()
      vi.unstubAllGlobals()
    })
  })

  describe('computeScrollFadeProgress 内部行为', () => {
    // 通过回调透传 progress 间接覆盖
    const captureProgress = (pathname: string, scrollHeight: number, scrollY: number, innerHeight: number) => {
      // 让 rAF 同步执行
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        cb(0)
        return 1
      })
      Object.defineProperty(window, 'location', {
        value: { pathname },
        writable: true,
        configurable: true,
      })
      Object.defineProperty(document.documentElement, 'scrollHeight', {
        value: scrollHeight,
        configurable: true,
      })
      Object.defineProperty(window, 'scrollY', { value: scrollY, configurable: true })
      Object.defineProperty(window, 'innerHeight', { value: innerHeight, configurable: true })
      let captured = -1
      const lifecycle = useAppLifecycle({
        onScrollFade: (p) => { captured = p },
      })
      lifecycle.install()
      window.dispatchEvent(new Event('scroll'))
      vi.unstubAllGlobals()
      return captured
    }

    it('首页时进度应为 0', () => {
      expect(captureProgress('/', 5000, 0, 800)).toBe(0)
    })

    it('距底部超过阈值时进度应为 0', () => {
      // sh=5000, vh=800, scrollY=0 => 距底 4200 > 400 => 0
      expect(captureProgress('/x', 5000, 0, 800)).toBe(0)
    })

    it('距底部接近 0 时进度应为 1', () => {
      // sh=1000, vh=200, scrollY=800 => 距底 0 => 1
      expect(captureProgress('/x', 1000, 800, 200)).toBe(1)
    })

    it('距底部介于阈值内时进度应介于 0~1', () => {
      // sh=2000, vh=800, scrollY=1000 => 距底 200, 阈值 400 => (400-200)/400=0.5
      const p = captureProgress('/x', 2000, 1000, 800)
      expect(p).toBeGreaterThan(0)
      expect(p).toBeLessThan(1)
    })
  })

  describe('try/catch 兜底', () => {
    it('scroll 事件中 updateScrollFade 抛错时不应影响页面', () => {
      // 通过让 onScrollFade 抛错验证兜底
      const onScrollFade = vi.fn(() => { throw new Error('scroll-error') })
      Object.defineProperty(window, 'location', {
        value: { pathname: '/x' },
        writable: true,
        configurable: true,
      })
      const lifecycle = useAppLifecycle({ onScrollFade })
      lifecycle.install()
      expect(() => window.dispatchEvent(new Event('scroll'))).not.toThrow()
    })
  })
})
