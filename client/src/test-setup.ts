import { config } from '@vue/test-utils'
import { vi } from 'vitest'

config.global.mocks = {
  $t: (key: string) => key,
}

// 全局 mock vue-i18n，避免每个测试文件单独处理
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: { value: 'zh-CN' },
    te: () => true,
    tm: () => ({}),
  }),
  createI18n: (_options: any) => ({
    install: (app: any) => {
      app.config.globalProperties.$t = (key: string) => key
      app.provide('i18n', {})
    },
  }),
}))

vi.stubGlobal('IntersectionObserver', vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})))

vi.stubGlobal('ResizeObserver', vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})))

vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})))
