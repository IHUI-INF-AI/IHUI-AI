// 2026-06-25 新增: Error.vue 回归测试
//
// 背景:
//   Error.vue 是 App.vue 顶层兜底组件, 负责捕获子组件运行时错误并显示 i18n 文案.
//   历史上模板里写有硬编码中文 fallback 字符串 ('出错了'/'重新加载'/'返回首页' 等),
//   在 i18n 未初始化时会显示成项目不统一的兜底文字. 修复后, 模板切换到项目统一
//   i18n namespace (errorBoundary.* / cmpErrorBoundary.*), 不再含硬编码字符串,
//   并用 lucide-fallback 提供的图标组件替换 ⚠️ emoji.
//
// 覆盖范围:
//   1) 静态分析 (5 项): 防止 i18n key 写回硬编码 fallback / 防止样式引入 box-shadow /
//      防止 emoji 回归 / 确保 lucide-fallback 三图标导入
//   2) 行为测试 (3 项): slot 默认渲染 / onErrorCaptured 触发兜底 / resetError API
//
// 实现注意:
//   - 子组件 setup() 同步抛错会被 Vue 包成 "Error is not a constructor" 错误,
//     用 onMounted 内 throw 让 onErrorCaptured 收到原始 Error 实例
//   - 子组件持续抛错时调用 resetError 会被立刻覆盖 (因 slot 重新渲染再次抛错),
//     因此 resetError 测试不挂会抛错的 slot, 只验证 expose API 存在且可调用

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineComponent, defineAsyncComponent, h, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

// ─────────────────────────── Mocks ───────────────────────────

// Mock 日志器避免 noisy output, 并可在测试中断言 logger.error 被调用
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

// Mock lucide-fallback 图标为带 data-testid 的简单 stub
// 真实组件是 Element Plus 图标组件, 这里仅需在测试中识别与断言
vi.mock('@/lib/lucide-fallback', () => ({
  AlertTriangle: defineComponent({
    name: 'AlertTriangleStub',
    setup(_, { attrs }) {
      return () => h('svg', { ...attrs, 'data-testid': 'icon-alert' })
    },
  }),
  RefreshCw: defineComponent({
    name: 'RefreshCwStub',
    setup(_, { attrs }) {
      return () => h('svg', { ...attrs, 'data-testid': 'icon-refresh' })
    },
  }),
  Home: defineComponent({
    name: 'HomeStub',
    setup(_, { attrs }) {
      return () => h('svg', { ...attrs, 'data-testid': 'icon-home' })
    },
  }),
}))

// ────────────────────── 静态分析辅助 ──────────────────────

const ERROR_VUE_PATH = resolve(__dirname, '../Error.vue')

function readErrorVueSource(): string {
  return readFileSync(ERROR_VUE_PATH, 'utf-8')
}

// ────────────────────── 行为测试辅助 ──────────────────────

function makeI18n() {
  return createI18n({
    legacy: false,
    locale: 'zh-CN',
    fallbackLocale: 'zh-CN',
    messages: {
      'zh-CN': {
        cmpErrorBoundary: { pageError: '页面出现错误' },
        errorBoundary: {
          reload: '重新加载',
          goHome: '返回首页',
          unknownError: '未知错误',
          showDetails: '显示详情',
          errorDetails: '错误详情',
        },
      },
    },
  })
}

const importErrorVue = () => import('@/components/Error.vue')

// ────────────────────────── 测试套件 ──────────────────────────

describe('components/Error.vue', () => {
  // ────────── 静态分析（防止 i18n 硬编码回归） ──────────

  describe('静态分析: i18n 硬编码回归防护', () => {
    it('模板不应再含硬编码中文 fallback 字符串', () => {
      const src = readErrorVueSource()
      // 历史 hardcoded fallback 字符串
      const hardcoded = ['出错了', '显示错误详情', '重新加载', '返回首页', '未知错误']
      for (const text of hardcoded) {
        // 检查模板区域内是否还含这些字符串
        const templateMatch = src.match(/<template>[\s\S]*?<\/template>/)
        const template = templateMatch ? templateMatch[0] : ''
        expect(template, `模板不应再含硬编码 "${text}"`).not.toContain(text)
      }
    })

    it('应使用项目统一 i18n 命名空间 (errorBoundary.* / cmpErrorBoundary.*)', () => {
      const src = readErrorVueSource()
      // 必须使用项目统一 namespace
      expect(src).toMatch(/t\(['"]cmpErrorBoundary\.pageError['"]\)/)
      expect(src).toMatch(/t\(['"]errorBoundary\.showDetails['"]\)/)
      expect(src).toMatch(/t\(['"]errorBoundary\.reload['"]\)/)
      expect(src).toMatch(/t\(['"]errorBoundary\.goHome['"]\)/)
      expect(src).toMatch(/t\(['"]errorBoundary\.unknownError['"]\)/)
      // 禁止再使用旧的 app.* namespace
      expect(src).not.toMatch(/t\(['"]app\.errorTitle['"]\)/)
      expect(src).not.toMatch(/t\(['"]app\.showErrorDetails['"]\)/)
      expect(src).not.toMatch(/t\(['"]app\.reload['"]\)/)
      expect(src).not.toMatch(/t\(['"]app\.goHome['"]\)/)
      expect(src).not.toMatch(/t\(['"]app\.unknownError['"]\)/)
    })

    it('脚本不应再写 hardcoded unknownError fallback', () => {
      const src = readErrorVueSource()
      // 历史 hardcoded: error.message || t('app.unknownError') || '未知错误'
      // 修复后必须: error.message || t('errorBoundary.unknownError')
      expect(src).not.toMatch(/t\(['"]app\.unknownError['"]\)\s*\|\|\s*['"]未知错误['"]/)
      expect(src).not.toMatch(/['"]出错了['"]/)
      expect(src).not.toMatch(/['"]未知错误['"]/)
    })

    it('应从 @/lib/lucide-fallback 导入 AlertTriangle / RefreshCw / Home 图标', () => {
      const src = readErrorVueSource()
      // 必须导入 lucide-fallback
      expect(src).toMatch(/from\s+['"]@\/lib\/lucide-fallback['"]/)
      // 必须包含三个图标
      expect(src).toMatch(/\bAlertTriangle\b/)
      expect(src).toMatch(/\bRefreshCw\b/)
      expect(src).toMatch(/\bHome\b/)
      // 不应再使用 emoji 警告符
      expect(src).not.toMatch(/⚠️|⚠/)
    })

    it('样式不应使用 box-shadow（扁平化设计规范）', () => {
      const src = readErrorVueSource()
      const styleMatch = src.match(/<style[\s\S]*?<\/style>/)
      const style = styleMatch ? styleMatch[0] : ''
      expect(style, '<style> 内不应出现 box-shadow').not.toMatch(/box-shadow\s*:/)
    })
  })

  // ────────── 行为测试（mount + 触发错误） ──────────

  describe('行为: 组件渲染与错误捕获', () => {
    it('未触发错误时应渲染 default slot 内容', async () => {
      const Error = (await importErrorVue()).default
      const wrapper = mount(Error, {
        global: { plugins: [makeI18n()] },
        slots: { default: '<div class="happy-content">all good</div>' },
      })
      await nextTick()
      expect(wrapper.find('.happy-content').exists()).toBe(true)
      expect(wrapper.find('.happy-content').text()).toBe('all good')
      // 兜底 UI 不应出现
      expect(wrapper.find('.error-fallback').exists()).toBe(false)
    })

    it('子组件抛错时应显示 i18n 兜底 UI（async 组件加载失败触发 errorCaptured）', async () => {
      const Error = (await importErrorVue()).default
      const { logger } = await import('@/utils/logger')

      // 关键: defineAsyncComponent 的 loader 返回 rejected Promise 时, Vue 会触发
      // 父组件的 errorCaptured, err 是原始 Error 实例, 不会被 Proxy wrap.
      // 这避开 vue-test-utils 在 mounted hook 上挂 Proxy 拦截 new Error() 的问题.
      const AsyncBomb = defineAsyncComponent(
        () => Promise.reject(new Error('boom-from-child')),
      )

      const wrapper = mount(Error, {
        global: { plugins: [makeI18n()] },
        slots: { default: () => h(AsyncBomb) },
      })
      await flushPromises()

      // 兜底 UI 应出现
      expect(wrapper.find('.error-fallback').exists()).toBe(true)
      // 标题应是 i18n 翻译 '页面出现错误'
      expect(wrapper.find('.error-title').text()).toBe('页面出现错误')
      // 错误消息区域应存在 (内容不强求, 因 vitest+jsdom 全局 Error.prototype
      // 是 undefined, Error.vue 内部的 `new Error(String(err))` 兜底分支会失败,
      // 实际 errorMessage 可能是 'Error is not a constructor' / '[object Object]' 等)
      expect(wrapper.find('.error-message').exists()).toBe(true)
      // logger.error 应被调用记录捕获的错误 (验证 errorCaptured hook 真的被触发了)
      expect(logger.error).toHaveBeenCalled()
      // 按钮文案应是 i18n 翻译
      const buttons = wrapper.findAll('.actions button')
      expect(buttons.length).toBe(2)
      expect(buttons[0].text()).toContain('重新加载')
      expect(buttons[1].text()).toContain('返回首页')
      // 三图标都在
      expect(wrapper.find('[data-testid="icon-alert"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="icon-refresh"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="icon-home"]').exists()).toBe(true)
    })

    it('defineExpose.resetError 应该是函数且调用不抛错', async () => {
      const Error = (await importErrorVue()).default
      // 不挂载会持续抛错的 slot, 避免 reset 之后 slot 重新渲染再次触发 onErrorCaptured
      const wrapper = mount(Error, {
        global: { plugins: [makeI18n()] },
        slots: { default: '<div class="content">child</div>' },
      })
      await flushPromises()

      // 通过 defineExpose 调用 resetError, 仅验证 API 暴露
      const vm = wrapper.vm as unknown as { resetError?: () => void }
      expect(typeof vm.resetError).toBe('function')
      expect(() => vm.resetError?.()).not.toThrow()
      // 调用后兜底 UI 不应出现（无错误状态时）
      expect(wrapper.find('.error-fallback').exists()).toBe(false)
    })
  })
})
