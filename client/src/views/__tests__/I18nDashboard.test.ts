/**
 * I18nDashboard.vue 组件测试
 *
 * 聚焦 base 选择结果的 localStorage 缓存逻辑（封版前测试补全，不新增功能）：
 * - onMounted 优先读缓存
 * - 缓存失效（TTL 超期 / code 不在白名单 / JSON 结构错误）走 autoPick
 * - 手动切换 diffA 同步写入缓存
 * - 重置按钮清除缓存并重新计算
 * - localStorage 被禁用时静默失败
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

// ---- vi.hoisted: 提升共享 mock 数据，供 vi.mock factory 与测试用例同时访问 ----
// vi.mock factory 会被 hoist 到文件顶部，不能直接引用外部变量，必须用 vi.hoisted
const { mockMessages, MOCK_LANGS } = vi.hoisted(() => {
  // zh-CN 完成度高于 en（zh-CN 有 5 个 key，en 只有 4 个，缺 diffBtn）
  // 这样 autoPick 稳定选 zh-CN，避免字典序干扰
  const mockMessages = {
    value: {
      'zh-CN': {
        i18nDashboard: {
          title: '标题',
          subtitle: '副标题',
          diffResetCacheBtn: '重置',
          diffAutoPickBtn: '自动',
          diffBtn: '对比',
        },
      },
      'en': {
        i18nDashboard: {
          title: 'Title',
          subtitle: 'Subtitle',
          diffResetCacheBtn: 'Reset',
          diffAutoPickBtn: 'Auto',
          // 故意缺 diffBtn，使 en 完成度 < zh-CN
        },
      },
    } as Record<string, Record<string, unknown>>,
  }
  const MOCK_LANGS = [
    { code: 'zh-CN', display_name: '简体中文', english_name: 'Chinese', is_rtl: false, plural_rule: 'other_only', decimal_separator: '.', thousands_separator: ',', currency_position: 'before' as const },
    { code: 'en', display_name: 'English', english_name: 'English', is_rtl: false, plural_rule: 'one_other', decimal_separator: '.', thousands_separator: ',', currency_position: 'before' as const },
  ]
  return { mockMessages, MOCK_LANGS }
})

// ---- mock vue-i18n（覆盖 test-setup.ts 的全局 mock，控制 locale）----
// t 直接回传 key，便于断言 baseHint 文本
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params && key === 'i18nDashboard.diffBaseHint') {
        return `${key}:${params.code}:${params.percent}`
      }
      return key
    },
    locale: { value: 'zh-CN' },
    te: () => true,
    tm: () => ({}),
  }),
}))

// ---- mock @/locales：提供可控的 i18n.global.messages.value ----
// 组件直接 import i18n from '@/locales' 并访问 i18n.global.messages.value
// 2026-06-25 修复#Q: 补全 loadFullLocaleMessages / getCurrentLocale 命名导出,
//   避免 onMounted 调用时抛 "No export is defined" 错误
vi.mock('@/locales', () => ({
  default: {
    global: {
      messages: mockMessages,
      locale: { value: 'zh-CN' },
    },
  },
  loadFullLocaleMessages: vi.fn().mockResolvedValue(undefined),
  getCurrentLocale: () => 'zh-CN',
}))

// ---- mock @/constants/i18nLanguages：简化为 2 语言，code 与 messages key 对齐 ----
vi.mock('@/constants/i18nLanguages', () => ({
  I18N_LANGUAGES: MOCK_LANGS,
  getLanguageMeta: (code: string) => MOCK_LANGS.find(m => m.code === code) || null,
}))

// ---- mock @/utils/i18nRelative：formatRelative 返回固定字符串 ----
vi.mock('@/utils/i18nRelative', () => ({
  formatRelative: () => '5m ago',
}))

// ---- stub LanguageSwitcher 子组件，避免渲染依赖 ----
const LanguageSwitcherStub = defineComponent({
  name: 'LanguageSwitcher',
  props: { modelValue: { type: String, default: 'zh-CN' } },
  emits: ['update:modelValue', 'change'],
  setup(_, { emit }) {
    return () =>
      h('div', { class: 'lang-switcher-stub', 'data-testid': 'lang-switcher' })
  },
})

import I18nDashboard from '../I18nDashboard.vue'

const BASE_CACHE_KEY = 'i18n-dashboard-base-v1'
const BASE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * 写入一份合法的 base 缓存
 */
function seedCache(code: string, ts: number = Date.now()) {
  localStorage.setItem(BASE_CACHE_KEY, JSON.stringify({ code, ts }))
}

/**
 * 读取 diffA select 的当前值
 */
function getDiffAValue(wrapper: ReturnType<typeof mount>): string {
  const sel = wrapper.find('#i18n-diff-a').element as HTMLSelectElement
  return sel.value
}

describe('I18nDashboard.vue', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  // =================== onMounted 缓存读取 ===================
  it('onMounted: 有有效缓存时优先使用缓存值作为 diffA', async () => {
    seedCache('en')
    const wrapper = mount(I18nDashboard, {
      global: {
        stubs: { LanguageSwitcher: LanguageSwitcherStub },
      },
    })
    await flushPromises()
    expect(getDiffAValue(wrapper)).toBe('en')
    // 缓存未被清除
    expect(localStorage.getItem(BASE_CACHE_KEY)).not.toBeNull()
  })

  it('onMounted: 无缓存时调用 autoPick，选择完成度最高的语言', async () => {
    // zh-CN 有 5 个 key，en 也有 5 个；完成度持平时按 code 字典序，zh-CN 在前
    const wrapper = mount(I18nDashboard, {
      global: {
        stubs: { LanguageSwitcher: LanguageSwitcherStub },
      },
    })
    await flushPromises()
    expect(getDiffAValue(wrapper)).toBe('zh-CN')
    // autoPick 会写入缓存
    const raw = localStorage.getItem(BASE_CACHE_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.code).toBe('zh-CN')
    expect(typeof parsed.ts).toBe('number')
  })

  // =================== TTL 失效 ===================
  it('TTL: 缓存 ts 超过 7 天视为失效，走 autoPick', async () => {
    const expiredTs = Date.now() - BASE_CACHE_TTL_MS - 1000
    seedCache('en', expiredTs)
    const wrapper = mount(I18nDashboard, {
      global: {
        stubs: { LanguageSwitcher: LanguageSwitcherStub },
      },
    })
    await flushPromises()
    // 失效后 autoPick 选 zh-CN（完成度持平 + 字典序优先）
    expect(getDiffAValue(wrapper)).toBe('zh-CN')
  })

  it('TTL: 缓存 ts 在 7 天内仍然有效', async () => {
    const validTs = Date.now() - BASE_CACHE_TTL_MS + 60_000 // 差 1 分钟到期
    seedCache('en', validTs)
    const wrapper = mount(I18nDashboard, {
      global: {
        stubs: { LanguageSwitcher: LanguageSwitcherStub },
      },
    })
    await flushPromises()
    expect(getDiffAValue(wrapper)).toBe('en')
  })

  // =================== code 白名单校验 ===================
  it('白名单: 缓存 code 不在 I18N_LANGUAGES 中视为失效', async () => {
    seedCache('fr-FR') // 不在 MOCK_LANGS 中
    const wrapper = mount(I18nDashboard, {
      global: {
        stubs: { LanguageSwitcher: LanguageSwitcherStub },
      },
    })
    await flushPromises()
    // 失效后走 autoPick
    expect(getDiffAValue(wrapper)).toBe('zh-CN')
  })

  // =================== JSON 结构校验 ===================
  it('JSON: 缓存非合法 JSON 时视为失效', async () => {
    localStorage.setItem(BASE_CACHE_KEY, '{not a valid json')
    const wrapper = mount(I18nDashboard, {
      global: {
        stubs: { LanguageSwitcher: LanguageSwitcherStub },
      },
    })
    await flushPromises()
    expect(getDiffAValue(wrapper)).toBe('zh-CN')
  })

  it('JSON: 缓存字段类型错误（code 非 string）时视为失效', async () => {
    localStorage.setItem(BASE_CACHE_KEY, JSON.stringify({ code: 123, ts: Date.now() }))
    const wrapper = mount(I18nDashboard, {
      global: {
        stubs: { LanguageSwitcher: LanguageSwitcherStub },
      },
    })
    await flushPromises()
    expect(getDiffAValue(wrapper)).toBe('zh-CN')
  })

  it('JSON: 缓存字段类型错误（ts 非 number）时视为失效', async () => {
    localStorage.setItem(BASE_CACHE_KEY, JSON.stringify({ code: 'en', ts: 'now' }))
    const wrapper = mount(I18nDashboard, {
      global: {
        stubs: { LanguageSwitcher: LanguageSwitcherStub },
      },
    })
    await flushPromises()
    expect(getDiffAValue(wrapper)).toBe('zh-CN')
  })

  it('JSON: 缓存为 null 时视为失效', async () => {
    localStorage.setItem(BASE_CACHE_KEY, 'null')
    const wrapper = mount(I18nDashboard, {
      global: {
        stubs: { LanguageSwitcher: LanguageSwitcherStub },
      },
    })
    await flushPromises()
    expect(getDiffAValue(wrapper)).toBe('zh-CN')
  })

  // =================== 手动切换 diffA 写缓存 ===================
  it('手动切换: 改变 diffA select 后同步写入缓存', async () => {
    const wrapper = mount(I18nDashboard, {
      global: {
        stubs: { LanguageSwitcher: LanguageSwitcherStub },
      },
    })
    await flushPromises()
    // 初始 autoPick 写入 zh-CN
    expect(JSON.parse(localStorage.getItem(BASE_CACHE_KEY)!).code).toBe('zh-CN')

    // 模拟用户手动切换 select 到 en
    const sel = wrapper.find('#i18n-diff-a')
    await sel.setValue('en')
    await flushPromises()

    // watch diffA 触发 writeCachedBase
    const parsed = JSON.parse(localStorage.getItem(BASE_CACHE_KEY)!)
    expect(parsed.code).toBe('en')
    expect(typeof parsed.ts).toBe('number')
  })

  // =================== 重置按钮 ===================
  it('重置按钮: 点击后清除缓存并重新 autoPick', async () => {
    // 先植入一个 en 缓存
    seedCache('en')
    const wrapper = mount(I18nDashboard, {
      global: {
        stubs: { LanguageSwitcher: LanguageSwitcherStub },
      },
    })
    await flushPromises()
    expect(getDiffAValue(wrapper)).toBe('en')

    // 找到重置按钮（标题含 diffResetCacheBtn）
    const buttons = wrapper.findAll('button')
    const resetBtn = buttons.find(b => b.attributes('title') === 'i18nDashboard.diffResetCacheBtn')
    expect(resetBtn).toBeTruthy()
    await resetBtn!.trigger('click')
    await flushPromises()

    // 重置后重新 autoPick → zh-CN，并重新写入缓存
    expect(getDiffAValue(wrapper)).toBe('zh-CN')
    const parsed = JSON.parse(localStorage.getItem(BASE_CACHE_KEY)!)
    expect(parsed.code).toBe('zh-CN')
  })

  // =================== 自动选择按钮 ===================
  it('自动选择按钮: 点击 onAutoPickBase 写入缓存并更新 baseHint', async () => {
    const wrapper = mount(I18nDashboard, {
      global: {
        stubs: { LanguageSwitcher: LanguageSwitcherStub },
      },
    })
    await flushPromises()

    const buttons = wrapper.findAll('button')
    const autoBtn = buttons.find(b => b.attributes('title') === 'i18nDashboard.diffAutoPickBtn')
    expect(autoBtn).toBeTruthy()
    await autoBtn!.trigger('click')
    await flushPromises()

    // autoPick 选 zh-CN
    expect(getDiffAValue(wrapper)).toBe('zh-CN')
    expect(JSON.parse(localStorage.getItem(BASE_CACHE_KEY)!).code).toBe('zh-CN')
    // baseHint 应被设置（t 返回 i18nDashboard.diffBaseHint:code:percent）
    const hint = wrapper.find('.i18n-diff-base-hint')
    expect(hint.exists()).toBe(true)
    expect(hint.text()).toContain('i18nDashboard.diffBaseHint')
  })

  // =================== localStorage 被禁用（静默失败） ===================
  it('容错: localStorage.setItem 抛错时不影响渲染（静默失败）', async () => {
    // 保留原方法，仅让 setItem 抛错（模拟无痕模式 / 配额满）
    const origSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = vi.fn(() => {
      throw new DOMException('QuotaExceededError')
    })

    try {
      const wrapper = mount(I18nDashboard, {
        global: {
          stubs: { LanguageSwitcher: LanguageSwitcherStub },
        },
      })
      await flushPromises()
      // 组件应正常渲染，未抛错
      expect(wrapper.find('.i18n-dashboard').exists()).toBe(true)
      // autoPick 仍设置了 diffA（内存中），只是写缓存失败
      expect(getDiffAValue(wrapper)).toBe('zh-CN')
    } finally {
      Storage.prototype.setItem = origSetItem
    }
  })

  it('容错: localStorage.getItem 抛错时走 autoPick（静默失败）', async () => {
    const origGetItem = Storage.prototype.getItem
    Storage.prototype.getItem = vi.fn(() => {
      throw new DOMException('SecurityError')
    })

    try {
      const wrapper = mount(I18nDashboard, {
        global: {
          stubs: { LanguageSwitcher: LanguageSwitcherStub },
        },
      })
      await flushPromises()
      expect(wrapper.find('.i18n-dashboard').exists()).toBe(true)
      expect(getDiffAValue(wrapper)).toBe('zh-CN')
    } finally {
      Storage.prototype.getItem = origGetItem
    }
  })

  it('容错: localStorage.removeItem 抛错时重置按钮不报错', async () => {
    seedCache('en')
    const wrapper = mount(I18nDashboard, {
      global: {
        stubs: { LanguageSwitcher: LanguageSwitcherStub },
      },
    })
    await flushPromises()

    const origRemoveItem = Storage.prototype.removeItem
    Storage.prototype.removeItem = vi.fn(() => {
      throw new DOMException('SecurityError')
    })

    try {
      const buttons = wrapper.findAll('button')
      const resetBtn = buttons.find(b => b.attributes('title') === 'i18nDashboard.diffResetCacheBtn')
      // 不应抛错
      await resetBtn!.trigger('click')
      await flushPromises()
      expect(wrapper.find('.i18n-dashboard').exists()).toBe(true)
    } finally {
      Storage.prototype.removeItem = origRemoveItem
    }
  })

  // =================== 完成度计算（autoPick 选最高） ===================
  it('autoPick: zh-CN 完成度高于 en 时选择 zh-CN', async () => {
    // 给 zh-CN 多加一个 key，en 少一个 key
    mockMessages.value['zh-CN'].i18nDashboard = {
      ...mockMessages.value['zh-CN'].i18nDashboard,
      extraKey: '额外',
    }
    const wrapper = mount(I18nDashboard, {
      global: {
        stubs: { LanguageSwitcher: LanguageSwitcherStub },
      },
    })
    await flushPromises()
    expect(getDiffAValue(wrapper)).toBe('zh-CN')
    // 还原
    delete (mockMessages.value['zh-CN'].i18nDashboard as Record<string, unknown>).extraKey
  })

  it('autoPick: en 完成度高于 zh-CN 时选择 en', async () => {
    // en 多一个 key，zh-CN 少
    mockMessages.value['en'].i18nDashboard = {
      ...mockMessages.value['en'].i18nDashboard,
      extraKey: 'extra',
    }
    const wrapper = mount(I18nDashboard, {
      global: {
        stubs: { LanguageSwitcher: LanguageSwitcherStub },
      },
    })
    await flushPromises()
    expect(getDiffAValue(wrapper)).toBe('en')
    // 还原
    delete (mockMessages.value['en'].i18nDashboard as Record<string, unknown>).extraKey
  })

  // =================== 渲染基础断言 ===================
  it('渲染: 正常挂载并展示标题与语言元数据表', async () => {
    const wrapper = mount(I18nDashboard, {
      global: {
        stubs: { LanguageSwitcher: LanguageSwitcherStub },
      },
    })
    await flushPromises()
    expect(wrapper.find('.i18n-dashboard').exists()).toBe(true)
    expect(wrapper.find('#i18n-title').exists()).toBe(true)
    // 元数据表应包含 MOCK_LANGS 的 2 行
    const rows = wrapper.findAll('.i18n-table tbody tr')
    expect(rows.length).toBe(2)
  })
})
