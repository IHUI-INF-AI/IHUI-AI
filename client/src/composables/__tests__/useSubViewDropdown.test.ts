/**
 * useSubViewDropdown 单元测试
 *
 * 覆盖：
 *  1. 初始状态：currentView === mainView
 *  2. goTo(view) 切换子视图
 *  3. backToMain() 返回主视图
 *  4. handleEsc 智能处理：子视图 → 主；主视图 → 关闭父级
 *  5. closeAndReset 显式关闭 + 重置
 *  6. 父级 visible 变 false 时自动回到主视图
 *  7. 进入非主视图时自动 focus backButtonRef
 *  8. 自定义 mainView 名称
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { withSetup } from './withSetup'
import { useSubViewDropdown } from '../useSubViewDropdown'

describe('useSubViewDropdown.ts', () => {
  beforeEach(() => {
    // 清理 jsdom 中可能残留的 DOM
    document.body.innerHTML = ''
  })

  describe('初始状态', () => {
    it('默认 mainView = "main"，currentView 初始值应等于 mainView', () => {
      const parentVisible = ref(false)
      const { result, unmount } = withSetup(() =>
        useSubViewDropdown({ parentVisible }),
      )
      expect(result.currentView.value).toBe('main')
      expect(result.mainView).toBe('main')
      unmount()
    })

    it('允许自定义 mainView 与 initialView', () => {
      const parentVisible = ref(false)
      const { result, unmount } = withSetup(() =>
        useSubViewDropdown<'home' | 'settings'>({
          parentVisible,
          mainView: 'home',
          initialView: 'settings',
        }),
      )
      expect(result.mainView).toBe('home')
      expect(result.currentView.value).toBe('settings')
      unmount()
    })
  })

  describe('goTo / backToMain', () => {
    it('goTo("prompts") 后 currentView 应为 "prompts"', async () => {
      const parentVisible = ref(true)
      const { result, unmount } = withSetup(() =>
        useSubViewDropdown<'main' | 'prompts'>({ parentVisible }),
      )
      result.goTo('prompts')
      await nextTick()
      expect(result.currentView.value).toBe('prompts')
      unmount()
    })

    it('backToMain() 后应返回 mainView', async () => {
      const parentVisible = ref(true)
      const { result, unmount } = withSetup(() =>
        useSubViewDropdown<'main' | 'prompts'>({ parentVisible }),
      )
      result.goTo('prompts')
      await nextTick()
      result.backToMain()
      await nextTick()
      expect(result.currentView.value).toBe('main')
      unmount()
    })
  })

  describe('handleEsc 智能处理', () => {
    it('在子视图按 Esc：应返回主视图，且不关闭父级', async () => {
      const parentVisible = ref(true)
      const { result, unmount } = withSetup(() =>
        useSubViewDropdown<'main' | 'prompts'>({ parentVisible }),
      )
      result.goTo('prompts')
      await nextTick()
      result.handleEsc()
      await nextTick()
      expect(result.currentView.value).toBe('main')
      expect(parentVisible.value).toBe(true)
      unmount()
    })

    it('在主视图按 Esc：应关闭父级', async () => {
      const parentVisible = ref(true)
      const { result, unmount } = withSetup(() =>
        useSubViewDropdown<'main' | 'prompts'>({ parentVisible }),
      )
      // 确认当前在主视图
      expect(result.currentView.value).toBe('main')
      result.handleEsc()
      await nextTick()
      expect(parentVisible.value).toBe(false)
      unmount()
    })
  })

  describe('closeAndReset', () => {
    it('应同时关闭父级并回到主视图', async () => {
      const parentVisible = ref(true)
      const { result, unmount } = withSetup(() =>
        useSubViewDropdown<'main' | 'prompts'>({ parentVisible }),
      )
      result.goTo('prompts')
      await nextTick()
      expect(result.currentView.value).toBe('prompts')
      result.closeAndReset()
      await nextTick()
      expect(parentVisible.value).toBe(false)
      expect(result.currentView.value).toBe('main')
      unmount()
    })
  })

  describe('父级 visible 关闭时自动重置', () => {
    it('父级从 true → false：currentView 应自动回到 mainView', async () => {
      const parentVisible = ref(true)
      const { result, unmount } = withSetup(() =>
        useSubViewDropdown<'main' | 'prompts'>({ parentVisible }),
      )
      result.goTo('prompts')
      await nextTick()
      expect(result.currentView.value).toBe('prompts')
      // 模拟父级关闭
      parentVisible.value = false
      await nextTick()
      expect(result.currentView.value).toBe('main')
      unmount()
    })

    it('父级从 true → false 时，关闭状态下重新打开应仍是主视图', async () => {
      const parentVisible = ref(true)
      const { result, unmount } = withSetup(() =>
        useSubViewDropdown<'main' | 'prompts'>({ parentVisible }),
      )
      result.goTo('prompts')
      await nextTick()
      parentVisible.value = false
      await nextTick()
      parentVisible.value = true
      await nextTick()
      expect(result.currentView.value).toBe('main')
      unmount()
    })
  })

  describe('backButtonRef 自动 focus', () => {
    it('进入子视图时应自动 focus 绑定的 DOM 元素', async () => {
      const parentVisible = ref(true)
      const { result, unmount } = withSetup(() =>
        useSubViewDropdown<'main' | 'prompts'>({ parentVisible }),
      )

      // 模拟 backButton 按钮挂载到 DOM
      const btn = document.createElement('button')
      btn.textContent = '返回'
      document.body.appendChild(btn)
      const focusSpy = vi.spyOn(btn, 'focus')
      result.backButtonRef.value = btn

      // 触发进入子视图
      result.goTo('prompts')
      // 轮询 setTimeout 至多 500ms（每 10ms 一次），给 ref 就绪时间
      await new Promise((resolve) => setTimeout(resolve, 600))

      expect(focusSpy).toHaveBeenCalledTimes(1)
      focusSpy.mockRestore()
      unmount()
    })

    it('在主视图时不应 focus', async () => {
      const parentVisible = ref(false)
      const { result, unmount } = withSetup(() =>
        useSubViewDropdown<'main' | 'prompts'>({ parentVisible }),
      )

      const btn = document.createElement('button')
      document.body.appendChild(btn)
      const focusSpy = vi.spyOn(btn, 'focus')
      result.backButtonRef.value = btn

      // 触发 backToMain（已经在主视图，watcher 不应触发 focus）
      result.backToMain()
      // 等待可能的 setTimeout
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(focusSpy).not.toHaveBeenCalled()
      focusSpy.mockRestore()
      unmount()
    })
  })

  describe('AIChat 真实场景（main / prompts）', () => {
    it('应正确复现 AIChat 能力下拉状态机', async () => {
      const showCapabilityDropdown = ref(false)
      const { result, unmount } = withSetup(() =>
        useSubViewDropdown<'main' | 'prompts'>({
          parentVisible: showCapabilityDropdown,
          mainView: 'main',
        }),
      )

      // 1. 初始未打开，停在 main
      expect(result.currentView.value).toBe('main')

      // 2. 打开下拉
      showCapabilityDropdown.value = true
      await nextTick()
      // 3. 进入 prompts 子视图
      result.goTo('prompts')
      await nextTick()
      expect(result.currentView.value).toBe('prompts')

      // 4. 按 Esc：先回到 main（保留父级）
      result.handleEsc()
      await nextTick()
      expect(result.currentView.value).toBe('main')
      expect(showCapabilityDropdown.value).toBe(true)

      // 5. 再按 Esc：关闭父级
      result.handleEsc()
      await nextTick()
      expect(showCapabilityDropdown.value).toBe(false)
      expect(result.currentView.value).toBe('main')

      // 6. 重开下拉，应从 main 开始
      showCapabilityDropdown.value = true
      await nextTick()
      expect(result.currentView.value).toBe('main')

      unmount()
    })
  })
})
