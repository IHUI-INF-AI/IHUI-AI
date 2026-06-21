import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockLocalStorage: Record<string, string> = {}

vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    mockLocalStorage[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete mockLocalStorage[key]
  }),
  clear: vi.fn(() => {
    Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key])
  }),
  length: 0,
  key: vi.fn(),
})

vi.stubGlobal('window', {
  matchMedia: vi.fn(() => ({ matches: false })),
})

// mock的body对象，供overlay的parentNode引用
const mockBody = {
  appendChild: vi.fn(),
  removeChild: vi.fn(),
}

const mockOverlay = {
  id: '',
  style: {
    cssText: '',
    background: '',
    transition: '',
    transform: '',
    opacity: '',
  },
  parentNode: mockBody,
}

vi.stubGlobal('document', {
  createElement: vi.fn(() => ({ ...mockOverlay })),
  body: mockBody,
  documentElement: {
    style: {
      setProperty: vi.fn(),
      removeProperty: vi.fn(),
    },
  },
})

vi.stubGlobal('requestAnimationFrame', (cb: () => void) => setTimeout(cb, 0))

describe('themeTransition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  describe('模块导入', () => {
    it('应该成功导入模块', async () => {
      const mod = await import('../themeTransition')
      expect(mod).toBeDefined()
      expect(mod.themeTransitionManager).toBeDefined()
    })
  })

  describe('getConfig', () => {
    it('应该返回当前配置', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      const config = themeTransitionManager.getConfig()
      expect(config).toBeDefined()
      expect(config.type).toBeDefined()
      expect(config.direction).toBeDefined()
      expect(config.speed).toBeDefined()
    })
  })

  describe('setConfig', () => {
    it('应该更新配置', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ type: 'slide' })
      const config = themeTransitionManager.getConfig()
      expect(config.type).toBe('slide')
    })

    it('应该根据speed更新duration', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ speed: 'fast' })
      const config = themeTransitionManager.getConfig()
      expect(config.duration).toBe(150)
    })

    it('应该保持现有duration如果显式设置', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ speed: 'slow', duration: 500 })
      const config = themeTransitionManager.getConfig()
      expect(config.duration).toBe(500)
    })

    it('应该更新easing', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ easing: 'bounce' })
      const config = themeTransitionManager.getConfig()
      expect(config.easing).toBe('bounce')
    })

    it('应该更新overlayColor', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ overlayColor: 'color-mix(in srgb, var(--el-color-primary) 50%, transparent)' })
      const config = themeTransitionManager.getConfig()
      expect(config.overlayColor).toBe('color-mix(in srgb, var(--el-color-primary) 50%, transparent)')
    })
  })

  describe('setPreset', () => {
    it('应该设置预设配置', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      const result = themeTransitionManager.setPreset('smooth-slide')
      expect(result).toBe(true)
      const config = themeTransitionManager.getConfig()
      expect(config.type).toBe('slide')
    })

    it('应该返回false如果预设不存在', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      const result = themeTransitionManager.setPreset('non-existent')
      expect(result).toBe(false)
    })

    it('应该设置zoom预设', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      const result = themeTransitionManager.setPreset('zoom-in')
      expect(result).toBe(true)
      const config = themeTransitionManager.getConfig()
      expect(config.type).toBe('zoom')
    })

    it('应该设置flip预设', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      const result = themeTransitionManager.setPreset('flip-effect')
      expect(result).toBe(true)
      const config = themeTransitionManager.getConfig()
      expect(config.type).toBe('flip')
    })

    it('应该设置ripple预设', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      const result = themeTransitionManager.setPreset('ripple-effect')
      expect(result).toBe(true)
      const config = themeTransitionManager.getConfig()
      expect(config.type).toBe('ripple')
    })

    it('应该设置instant预设', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      const result = themeTransitionManager.setPreset('instant-switch')
      expect(result).toBe(true)
      const config = themeTransitionManager.getConfig()
      expect(config.type).toBe('none')
    })
  })

  describe('getPresets', () => {
    it('应该返回预设列表', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      const presets = themeTransitionManager.getPresets()
      expect(Array.isArray(presets)).toBe(true)
      expect(presets.length).toBeGreaterThan(0)
    })

    it('应该包含内置预设', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      const presets = themeTransitionManager.getPresets()
      const defaultFade = presets.find(p => p.id === 'default-fade')
      expect(defaultFade).toBeDefined()
      expect(defaultFade?.isBuiltIn).toBe(true)
    })
  })

  describe('addPreset', () => {
    it('应该添加自定义预设', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      const newPreset = themeTransitionManager.addPreset({
        name: '自定义预设',
        nameEn: 'Custom Preset',
        config: {
          type: 'fade',
          direction: 'center',
          speed: 'normal',
          duration: 300,
          easing: 'smooth',
          enableOverlay: false,
        },
      })
      expect(newPreset.id).toMatch(/^custom-/)
      expect(newPreset.isBuiltIn).toBe(false)
    })
  })

  describe('removePreset', () => {
    it('应该移除自定义预设', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      const newPreset = themeTransitionManager.addPreset({
        name: '待删除预设',
        nameEn: 'To Delete',
        config: {
          type: 'fade',
          direction: 'center',
          speed: 'normal',
          duration: 300,
          easing: 'smooth',
          enableOverlay: false,
        },
      })
      const result = themeTransitionManager.removePreset(newPreset.id)
      expect(result).toBe(true)
    })

    it('应该不能移除内置预设', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      const result = themeTransitionManager.removePreset('default-fade')
      expect(result).toBe(false)
    })

    it('应该返回false如果预设不存在', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      const result = themeTransitionManager.removePreset('non-existent')
      expect(result).toBe(false)
    })
  })

  describe('getDuration', () => {
    it('应该返回当前duration', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ duration: 400 })
      const duration = themeTransitionManager.getDuration()
      expect(duration).toBe(400)
    })

    it('应该根据speed返回duration', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ speed: 'slow' })
      const duration = themeTransitionManager.getDuration()
      expect(duration).toBe(600)
    })
  })

  describe('getEasing', () => {
    it('应该返回缓动函数', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ easing: 'smooth' })
      const easing = themeTransitionManager.getEasing()
      expect(easing).toBe('cubic-bezier(0.4, 0, 0.2, 1)')
    })

    it('应该返回自定义缓动函数', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ easing: 'linear' })
      const easing = themeTransitionManager.getEasing()
      expect(easing).toBe('linear')
    })

    it('应该返回bounce缓动函数', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ easing: 'bounce' })
      const easing = themeTransitionManager.getEasing()
      expect(easing).toBe('cubic-bezier(0.68, -0.55, 0.265, 1.55)')
    })

    it('应该返回swift缓动函数', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ easing: 'swift' })
      const easing = themeTransitionManager.getEasing()
      expect(easing).toBe('cubic-bezier(0.25, 0.1, 0.25, 1)')
    })
  })

  describe('isCurrentlyTransitioning', () => {
    it('应该返回当前过渡状态', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      const isTransitioning = themeTransitionManager.isCurrentlyTransitioning()
      expect(typeof isTransitioning).toBe('boolean')
    })
  })

  describe('getTransitionCSS', () => {
    it('应该返回CSS变量字符串', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ duration: 300, easing: 'smooth' })
      const css = themeTransitionManager.getTransitionCSS()
      expect(css).toContain('--theme-transition-duration')
      expect(css).toContain('--theme-transition-timing')
    })
  })

  describe('onTransitionComplete', () => {
    it('应该注册回调函数', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      const callback = vi.fn()
      const unsubscribe = themeTransitionManager.onTransitionComplete(callback)
      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
    })

    it('应该取消注册回调函数', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      const callback = vi.fn()
      const unsubscribe = themeTransitionManager.onTransitionComplete(callback)
      unsubscribe()
    })
  })

  describe('executeTransition', () => {
    it('应该在type为none时直接执行回调', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ type: 'none', duration: 0 })
      const callback = vi.fn()
      await themeTransitionManager.executeTransition(callback)
      expect(callback).toHaveBeenCalled()
    })

    it('应该在duration为0时直接执行回调', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ type: 'fade', duration: 0 })
      const callback = vi.fn()
      await themeTransitionManager.executeTransition(callback)
      expect(callback).toHaveBeenCalled()
    })
  })

  describe('applyTransitionToRoot', () => {
    it('应该应用过渡样式到根元素', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.applyTransitionToRoot()
      expect(true).toBe(true)
    })
  })

  describe('resetTransitionOnRoot', () => {
    it('应该重置根元素的过渡样式', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.resetTransitionOnRoot()
      expect(true).toBe(true)
    })
  })

  describe('从localStorage加载配置', () => {
    it('应该从localStorage加载已保存的配置', async () => {
      mockLocalStorage['theme-transition-config'] = JSON.stringify({
        type: 'slide',
        direction: 'right',
        speed: 'fast',
        duration: 150,
        easing: 'linear',
        enableOverlay: true,
      })
      vi.resetModules()
      const { themeTransitionManager } = await import('../themeTransition')
      const config = themeTransitionManager.getConfig()
      expect(config.type).toBe('slide')
    })

    it('应该处理无效的localStorage数据', async () => {
      mockLocalStorage['theme-transition-config'] = 'invalid-json'
      vi.resetModules()
      const { themeTransitionManager } = await import('../themeTransition')
      const config = themeTransitionManager.getConfig()
      expect(config.type).toBe('fade')
    })
  })

  // 以下为补充测试用例，提升覆盖率

  describe('executeTransition - 过渡进行中', () => {
    it('应该在过渡进行中直接执行新回调', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ type: 'fade', duration: 100 })
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      // 启动第一个过渡
      const promise1 = themeTransitionManager.executeTransition(callback1)
      await vi.advanceTimersByTimeAsync(0) // 触发 requestAnimationFrame
      // 此时正在过渡，第二个过渡应直接执行回调
      await themeTransitionManager.executeTransition(callback2)
      expect(callback2).toHaveBeenCalled()
      // 完成第一个过渡
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(100)
      await promise1
      expect(callback1).toHaveBeenCalled()
    })
  })

  describe('executeTransition - prefersReducedMotion', () => {
    it('应该在prefersReducedMotion时直接执行回调', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ type: 'fade', duration: 100 })
      ;(window.matchMedia as any).mockReturnValueOnce({ matches: true })
      const callback = vi.fn()
      await themeTransitionManager.executeTransition(callback)
      expect(callback).toHaveBeenCalled()
    })
  })

  describe('executeTransition - 各种过渡类型', () => {
    it('应该执行fade过渡', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ type: 'fade', duration: 100 })
      const callback = vi.fn()
      const promise = themeTransitionManager.executeTransition(callback)
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(100)
      await promise
      expect(callback).toHaveBeenCalled()
    })

    it('应该执行slide过渡', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ type: 'slide', duration: 100, direction: 'left' })
      const callback = vi.fn()
      const promise = themeTransitionManager.executeTransition(callback)
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(100)
      await promise
      expect(callback).toHaveBeenCalled()
    })

    it('应该执行zoom过渡', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ type: 'zoom', duration: 100 })
      const callback = vi.fn()
      const promise = themeTransitionManager.executeTransition(callback)
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(100)
      await promise
      expect(callback).toHaveBeenCalled()
    })

    it('应该执行flip过渡', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ type: 'flip', duration: 100 })
      const callback = vi.fn()
      const promise = themeTransitionManager.executeTransition(callback)
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(100)
      await promise
      expect(callback).toHaveBeenCalled()
    })

    it('应该执行ripple过渡', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ type: 'ripple', duration: 100 })
      const callback = vi.fn()
      const promise = themeTransitionManager.executeTransition(callback)
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(70) // duration * 0.7
      await vi.advanceTimersByTimeAsync(50) // duration / 2
      await promise
      expect(callback).toHaveBeenCalled()
    })

    it('应该处理未知过渡类型', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ type: 'unknown' as any, duration: 100 })
      const callback = vi.fn()
      await themeTransitionManager.executeTransition(callback)
      expect(callback).toHaveBeenCalled()
    })
  })

  describe('onTransitionComplete - 回调触发', () => {
    it('应该在过渡完成时触发回调', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ type: 'fade', duration: 100 })
      const completeCallback = vi.fn()
      themeTransitionManager.onTransitionComplete(completeCallback)
      const callback = vi.fn()
      const promise = themeTransitionManager.executeTransition(callback)
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(100)
      await promise
      expect(completeCallback).toHaveBeenCalled()
    })
  })

  describe('getEasing - 自定义缓动', () => {
    it('应该返回未知的easing原值', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ easing: 'custom-easing' })
      const easing = themeTransitionManager.getEasing()
      expect(easing).toBe('custom-easing')
    })
  })

  describe('getDuration - 默认值', () => {
    it('应该在duration为0时返回speed对应的duration', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ duration: 0, speed: 'fast' })
      const duration = themeTransitionManager.getDuration()
      expect(duration).toBe(150)
    })
  })

  describe('getConfig - 副本', () => {
    it('应该返回配置的副本', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      const config1 = themeTransitionManager.getConfig()
      config1.type = 'slide'
      const config2 = themeTransitionManager.getConfig()
      expect(config2.type).not.toBe('slide')
    })
  })

  describe('getPresets - 副本', () => {
    it('应该返回预设列表的副本', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      const presets1 = themeTransitionManager.getPresets()
      presets1.push({
        id: 'test',
        name: '测试',
        nameEn: 'Test',
        config: {} as any,
      })
      const presets2 = themeTransitionManager.getPresets()
      expect(presets2.length).toBeLessThan(presets1.length)
    })
  })

  describe('applyTransitionToRoot - 验证调用', () => {
    it('应该调用setProperty设置CSS变量', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.applyTransitionToRoot()
      expect(document.documentElement.style.setProperty).toHaveBeenCalled()
    })
  })

  describe('resetTransitionOnRoot - 验证调用', () => {
    it('应该调用removeProperty移除CSS变量', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.resetTransitionOnRoot()
      expect(document.documentElement.style.removeProperty).toHaveBeenCalled()
    })
  })

  // 补充测试：slide过渡各方向
  describe('补充测试 - slide过渡方向', () => {
    it('应该支持right方向', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ type: 'slide', duration: 100, direction: 'right' })
      const callback = vi.fn()
      const promise = themeTransitionManager.executeTransition(callback)
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(100)
      await promise
      expect(callback).toHaveBeenCalled()
    })

    it('应该支持up方向', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ type: 'slide', duration: 100, direction: 'up' })
      const callback = vi.fn()
      const promise = themeTransitionManager.executeTransition(callback)
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(100)
      await promise
      expect(callback).toHaveBeenCalled()
    })

    it('应该支持down方向', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ type: 'slide', duration: 100, direction: 'down' })
      const callback = vi.fn()
      const promise = themeTransitionManager.executeTransition(callback)
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(100)
      await promise
      expect(callback).toHaveBeenCalled()
    })

    it('应该支持center方向', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ type: 'slide', duration: 100, direction: 'center' })
      const callback = vi.fn()
      const promise = themeTransitionManager.executeTransition(callback)
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(100)
      await promise
      expect(callback).toHaveBeenCalled()
    })
  })

  // 补充测试：自定义overlayColor
  describe('补充测试 - 自定义overlayColor', () => {
    it('应该使用自定义overlayColor执行fade过渡', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ type: 'fade', duration: 100, overlayColor: 'rgba(255,0,0,0.5)' })
      const callback = vi.fn()
      const promise = themeTransitionManager.executeTransition(callback)
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(100)
      await promise
      expect(callback).toHaveBeenCalled()
    })

    it('应该使用自定义overlayColor执行slide过渡', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ type: 'slide', duration: 100, direction: 'left', overlayColor: 'rgba(0,255,0,0.5)' })
      const callback = vi.fn()
      const promise = themeTransitionManager.executeTransition(callback)
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(100)
      await promise
      expect(callback).toHaveBeenCalled()
    })

    it('应该使用自定义overlayColor执行zoom过渡', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ type: 'zoom', duration: 100, overlayColor: 'rgba(0,0,255,0.5)' })
      const callback = vi.fn()
      const promise = themeTransitionManager.executeTransition(callback)
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(100)
      await promise
      expect(callback).toHaveBeenCalled()
    })

    it('应该使用自定义overlayColor执行flip过渡', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ type: 'flip', duration: 100, overlayColor: 'rgba(255,255,0,0.5)' })
      const callback = vi.fn()
      const promise = themeTransitionManager.executeTransition(callback)
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(100)
      await promise
      expect(callback).toHaveBeenCalled()
    })

    it('应该使用自定义overlayColor执行ripple过渡', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ type: 'ripple', duration: 100, overlayColor: 'rgba(255,0,255,0.5)' })
      const callback = vi.fn()
      const promise = themeTransitionManager.executeTransition(callback)
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(70)
      await vi.advanceTimersByTimeAsync(50)
      await promise
      expect(callback).toHaveBeenCalled()
    })
  })

  // 补充测试：saveConfig异常处理
  describe('补充测试 - saveConfig异常', () => {
    it('应该处理localStorage.setItem异常', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      ;(localStorage.setItem as any).mockImplementationOnce(() => {
        throw new Error('存储已满')
      })
      expect(() => themeTransitionManager.setConfig({ type: 'fade' })).not.toThrow()
    })
  })

  // 补充测试：onTransitionComplete取消订阅
  describe('补充测试 - onTransitionComplete取消订阅', () => {
    it('应该正确取消订阅后不触发回调', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      const callback = vi.fn()
      const unsubscribe = themeTransitionManager.onTransitionComplete(callback)
      unsubscribe()
      themeTransitionManager.setConfig({ type: 'fade', duration: 100 })
      const cb = vi.fn()
      const promise = themeTransitionManager.executeTransition(cb)
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(100)
      await promise
      expect(callback).not.toHaveBeenCalled()
    })
  })

  // 补充测试：isCurrentlyTransitioning状态
  describe('补充测试 - 过渡状态', () => {
    it('应该在过渡完成后重置状态', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ type: 'fade', duration: 100 })
      expect(themeTransitionManager.isCurrentlyTransitioning()).toBe(false)
      const promise = themeTransitionManager.executeTransition(() => {})
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(100)
      await promise
      expect(themeTransitionManager.isCurrentlyTransitioning()).toBe(false)
    })
  })

  // 补充测试：getEasing所有内置缓动
  describe('补充测试 - 内置缓动函数', () => {
    it('应该返回ease缓动函数', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ easing: 'ease' })
      expect(themeTransitionManager.getEasing()).toBe('ease')
    })

    it('应该返回easeIn缓动函数', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ easing: 'easeIn' })
      expect(themeTransitionManager.getEasing()).toBe('ease-in')
    })

    it('应该返回easeOut缓动函数', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ easing: 'easeOut' })
      expect(themeTransitionManager.getEasing()).toBe('ease-out')
    })

    it('应该返回easeInOut缓动函数', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ easing: 'easeInOut' })
      expect(themeTransitionManager.getEasing()).toBe('ease-in-out')
    })
  })

  // 补充测试：setPreset完整配置验证
  describe('补充测试 - setPreset完整配置', () => {
    it('应该应用zoom-in预设的完整配置', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setPreset('zoom-in')
      const config = themeTransitionManager.getConfig()
      expect(config.type).toBe('zoom')
      expect(config.enableOverlay).toBe(true)
      expect(config.easing).toBe('bounce')
    })

    it('应该应用instant-switch预设的完整配置', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setPreset('instant-switch')
      const config = themeTransitionManager.getConfig()
      expect(config.duration).toBe(0)
      expect(config.speed).toBe('instant')
    })

    it('应该应用default-fade预设的完整配置', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setPreset('default-fade')
      const config = themeTransitionManager.getConfig()
      expect(config.type).toBe('fade')
      expect(config.direction).toBe('center')
    })

    it('应该应用ripple-effect预设的完整配置', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setPreset('ripple-effect')
      const config = themeTransitionManager.getConfig()
      expect(config.duration).toBe(400)
      expect(config.easing).toBe('easeOut')
    })

    it('应该应用flip-effect预设的完整配置', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setPreset('flip-effect')
      const config = themeTransitionManager.getConfig()
      expect(config.duration).toBe(600)
      expect(config.speed).toBe('slow')
    })

    it('应该应用smooth-slide预设的完整配置', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setPreset('smooth-slide')
      const config = themeTransitionManager.getConfig()
      expect(config.direction).toBe('right')
    })
  })

  // 补充测试：getTransitionCSS内容验证
  describe('补充测试 - getTransitionCSS内容', () => {
    it('应该返回包含duration和easing的CSS', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ duration: 500, easing: 'smooth' })
      const css = themeTransitionManager.getTransitionCSS()
      expect(css).toContain('500ms')
      expect(css).toContain('cubic-bezier(0.4, 0, 0.2, 1)')
    })
  })

  // 补充测试：addPreset添加后可获取
  describe('补充测试 - addPreset后可获取', () => {
    it('应该添加预设后能在列表中找到', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      const newPreset = themeTransitionManager.addPreset({
        name: '测试预设',
        nameEn: 'Test Preset',
        config: {
          type: 'fade',
          direction: 'center',
          speed: 'normal',
          duration: 300,
          easing: 'smooth',
          enableOverlay: false,
        },
      })
      const presets = themeTransitionManager.getPresets()
      expect(presets.find(p => p.id === newPreset.id)).toBeDefined()
    })
  })

  // 补充测试：setConfig不更新duration
  describe('补充测试 - setConfig不更新duration', () => {
    it('应该在不设置speed时保持duration', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ duration: 200 })
      themeTransitionManager.setConfig({ type: 'slide' })
      const config = themeTransitionManager.getConfig()
      expect(config.duration).toBe(200)
    })
  })

  // 补充测试：removeOverlay覆盖
  describe('补充测试 - removeOverlay', () => {
    it('应该在过渡完成后移除overlay', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ type: 'fade', duration: 100 })
      const callback = vi.fn()
      const promise = themeTransitionManager.executeTransition(callback)
      // 运行所有定时器，确保removeOverlay被调用
      await vi.runAllTimersAsync()
      await promise
      expect(callback).toHaveBeenCalled()
      expect(themeTransitionManager.isCurrentlyTransitioning()).toBe(false)
    })

    it('应该调用removeChild移除overlay元素', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      themeTransitionManager.setConfig({ type: 'zoom', duration: 100 })
      const callback = vi.fn()
      const promise = themeTransitionManager.executeTransition(callback)
      await vi.runAllTimersAsync()
      await promise
      // 验证removeChild被调用
      expect(document.body.removeChild).toHaveBeenCalled()
    })

    it('应该处理overlay的parentNode为null的情况', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      // 修改createElement返回的overlay的parentNode为null
      ;(document.createElement as any).mockImplementationOnce(() => ({
        id: '',
        style: { cssText: '', background: '', transition: '', transform: '', opacity: '' },
        parentNode: null,
      }))
      themeTransitionManager.setConfig({ type: 'fade', duration: 100 })
      const callback = vi.fn()
      const promise = themeTransitionManager.executeTransition(callback)
      await vi.runAllTimersAsync()
      await promise
      expect(callback).toHaveBeenCalled()
    })
  })

  // 补充测试：window未定义环境
  describe('补充测试 - window未定义环境', () => {
    it('应该在window未定义时使用默认配置', async () => {
      // 临时设置window为undefined，模拟非浏览器环境
      vi.stubGlobal('window', undefined)
      vi.resetModules()
      const { themeTransitionManager } = await import('../themeTransition')
      const config = themeTransitionManager.getConfig()
      expect(config.type).toBe('fade')
      // 恢复window
      vi.stubGlobal('window', { matchMedia: vi.fn(() => ({ matches: false })) })
    })

    it('应该在window未定义时不保存配置', async () => {
      // 临时设置window为undefined
      vi.stubGlobal('window', undefined)
      vi.resetModules()
      const { themeTransitionManager } = await import('../themeTransition')
      // 调用setConfig触发saveConfig，不应抛出异常
      expect(() => themeTransitionManager.setConfig({ type: 'slide' })).not.toThrow()
      const config = themeTransitionManager.getConfig()
      expect(config.type).toBe('slide')
      // 恢复window
      vi.stubGlobal('window', { matchMedia: vi.fn(() => ({ matches: false })) })
    })
  })

  // 补充测试：getDuration回退到speed
  describe('补充测试 - getDuration回退', () => {
    it('应该在duration为0时回退到speed对应的duration', async () => {
      const { themeTransitionManager } = await import('../themeTransition')
      // 只设置duration为0，不设置speed，避免setConfig自动更新duration
      themeTransitionManager.setConfig({ duration: 0 })
      const duration = themeTransitionManager.getDuration()
      // speed默认为normal，对应300ms
      expect(duration).toBe(300)
    })
  })
})
