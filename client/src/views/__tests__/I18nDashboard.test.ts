// I18nDashboard.vue 单元测试 (P10 阶段)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: { 'zh-CN': { common: { edit: '编辑', delete: '删除', cancel: '取消', ok: '确定', save: '保存', submit: '提交', search: '搜索', refresh: '刷新', close: '关闭', add: '新增', create: '创建', back: '返回', retry: '重试', clear: '清空', view: '查看' } } },
})

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import http from '@/utils/request'
import I18nDashboard from '@/views/I18nDashboard.vue'

const LANGS = [
  { code: 'zh-CN', display_name: '简体中文', english_name: 'Chinese (Simplified)', direction: 'ltr', is_rtl: false, decimal_separator: '.', thousands_separator: ',', currency_position: 'before', first_day_of_week: 1, plural_rule: 'other_only', number_grouping: 3 },
  { code: 'en-US', display_name: 'English', english_name: 'English (US)', direction: 'ltr', is_rtl: false, decimal_separator: '.', thousands_separator: ',', currency_position: 'before', first_day_of_week: 0, plural_rule: 'one_other', number_grouping: 3 },
  { code: 'ar', display_name: 'العربية', english_name: 'Arabic', direction: 'rtl', is_rtl: true, decimal_separator: '٫', thousands_separator: '٬', currency_position: 'after', first_day_of_week: 6, plural_rule: 'arabic', number_grouping: 3 },
  { code: 'he', display_name: 'עברית', english_name: 'Hebrew', direction: 'rtl', is_rtl: true, decimal_separator: '.', thousands_separator: ',', currency_position: 'after', first_day_of_week: 0, plural_rule: 'hebrew', number_grouping: 3 },
  { code: 'fr', display_name: 'Français', english_name: 'French', direction: 'ltr', is_rtl: false, decimal_separator: ',', thousands_separator: ' ', currency_position: 'after', first_day_of_week: 1, plural_rule: 'french', number_grouping: 3 },
  { code: 'es', display_name: 'Español', english_name: 'Spanish', direction: 'ltr', is_rtl: false, decimal_separator: ',', thousands_separator: '.', currency_position: 'before', first_day_of_week: 1, plural_rule: 'one_other', number_grouping: 3 },
  { code: 'ja', display_name: '日本語', english_name: 'Japanese', direction: 'ltr', is_rtl: false, decimal_separator: '.', thousands_separator: ',', currency_position: 'before', first_day_of_week: 0, plural_rule: 'other_only', number_grouping: 3 },
  { code: 'ko', display_name: '한국어', english_name: 'Korean', direction: 'ltr', is_rtl: false, decimal_separator: '.', thousands_separator: ',', currency_position: 'before', first_day_of_week: 0, plural_rule: 'other_only', number_grouping: 3 },
  { code: 'zh-TW', display_name: '繁體中文', english_name: 'Chinese (Traditional)', direction: 'ltr', is_rtl: false, decimal_separator: '.', thousands_separator: ',', currency_position: 'before', first_day_of_week: 1, plural_rule: 'other_only', number_grouping: 3 },
]

const mockGet = (url: string) => {
  if (url.includes('/languages')) return Promise.resolve({ data: { code: 0, msg: 'ok', data: { languages: LANGS, count: 9 } } })
  if (url.includes('/keys')) return Promise.resolve({ data: { code: 0, msg: 'ok', data: { keys: ['common.welcome', 'common.items', 'common.save'], count: 3 } } })
  if (url.includes('/stats')) return Promise.resolve({ data: { code: 0, msg: 'ok', data: { total_keys: 3, per_language: { 'zh-CN': 3 }, plural_keys: 1, languages: 9 } } })
  if (url.includes('/sync-log')) return Promise.resolve({ data: { code: 0, msg: 'ok', data: { events: [{ event_id: 'e1', ts: 1700000000, actor: 'u', kind: 'create', key: 'k', language: 'zh-CN', note: '' }], count: 1 } } })
  if (url.includes('/diff')) return Promise.resolve({ data: { code: 0, msg: 'ok', data: { lang_a: 'zh-CN', lang_b: 'en-US', a_missing: ['x'], b_missing: [], identical: [], total: 3 } } })
  if (url.includes('/plural/')) return Promise.resolve({ data: { code: 0, msg: 'ok', data: { key: 'common.items', lang: 'zh-CN', is_rtl: false, samples: [{ count: 1, category: 'other', text: '1 项' }, { count: 5, category: 'other', text: '5 项' }] } } })
  if (url.includes('/entry/')) return Promise.resolve({ data: { code: 0, msg: 'ok', data: { key: 'common.welcome', translations: { 'zh-CN': '欢迎' }, plurals: {}, description: '', updated_at: 1, version: 1 } } })
  // P12 端点
  if (url.includes('/health')) return Promise.resolve({ data: { code: 0, msg: 'ok', data: { total_keys: 3, languages: 9, per_lang: { 'zh-CN': 1.0 }, overall_coverage: 0.9, pending_mt: 0, stale_keys: 0, health_score: 90.0, mt_penalty: 0, stale_penalty: 0 } } })
  if (url.includes('/v1-retirement-stats')) return Promise.resolve({ data: { code: 0, msg: 'ok', data: { total_hits: 0, unique_paths: 0, top_paths: [], last_hit_ts: null } } })
  if (url.includes('/mt/providers')) return Promise.resolve({ data: { code: 0, msg: 'ok', data: { providers: [{ id: 'builtin-dict', name: '内置词典', available: true, description: '内置' }], current: 'builtin-dict', count: 1 } } })
  return Promise.resolve({ data: { code: 0, msg: 'ok', data: {} } })
}

describe('I18nDashboard.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    ;(http.get as any).mockImplementation(mockGet)
    ;(http.post as any).mockImplementation((url: string) => {
      if (url.includes('/format')) return Promise.resolve({ data: { code: 0, msg: 'ok', data: { kind: 'number', lang: 'zh-CN', result: '1,234.56', is_rtl: false } } })
      return Promise.resolve({ data: { code: 0, msg: 'ok', data: {} } })
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('应渲染标题与 9 语言元数据表', async () => {
    const wrapper = mount(I18nDashboard, { global: { plugins: [i18n] } })
    await flushPromises()
    await nextTick()
    expect(wrapper.find('#i18n-title').exists()).toBe(true)
    const rows = wrapper.findAll('table tbody tr')
    expect(rows.length).toBeGreaterThanOrEqual(9)
  })

  it('LTR 状态下根元素 dir="ltr"', async () => {
    const wrapper = mount(I18nDashboard, { global: { plugins: [i18n] } })
    await flushPromises()
    await nextTick()
    const root = wrapper.find('.i18n-dashboard')
    expect(root.attributes('dir')).toBe('ltr')
  })

  it('切换到 ar 后根元素 dir="rtl"', async () => {
    const wrapper = mount(I18nDashboard, { global: { plugins: [i18n] } })
    await flushPromises()
    await nextTick()
    const sel = wrapper.find('select.lang-switcher-select')
    await sel.setValue('ar')
    await flushPromises()
    await nextTick()
    const root = wrapper.find('.i18n-dashboard')
    expect(root.attributes('dir')).toBe('rtl')
  })

  it('复数卡片应展示 count + category + text', async () => {
    const wrapper = mount(I18nDashboard, { global: { plugins: [i18n] } })
    await flushPromises()
    await nextTick()
    const cards = wrapper.findAll('.i18n-plural-card')
    expect(cards.length).toBeGreaterThan(0)
    const first = cards[0]
    expect(first.find('.i18n-plural-count').exists()).toBe(true)
    expect(first.find('.i18n-plural-cat').exists()).toBe(true)
    expect(first.find('.i18n-plural-text').exists()).toBe(true)
  })

  it('差异对比应展示 3 个统计 (a_missing / b_missing / identical)', async () => {
    const wrapper = mount(I18nDashboard, { global: { plugins: [i18n] } })
    await flushPromises()
    await nextTick()
    const stats = wrapper.findAll('.i18n-diff-stat')
    expect(stats.length).toBe(3)
  })

  it('同步日志应至少 1 条记录', async () => {
    const wrapper = mount(I18nDashboard, { global: { plugins: [i18n] } })
    await flushPromises()
    await nextTick()
    const items = wrapper.findAll('.i18n-log-item')
    expect(items.length).toBeGreaterThanOrEqual(1)
  })

  it('格式化预览至少 4 个卡片 (数字/货币/日期/相对)', async () => {
    const wrapper = mount(I18nDashboard, { global: { plugins: [i18n] } })
    await flushPromises()
    await nextTick()
    const cards = wrapper.findAll('.i18n-format-card')
    expect(cards.length).toBe(4)
  })

  it('RTL 状态下表格行 active 类应随当前语言切换', async () => {
    const wrapper = mount(I18nDashboard, { global: { plugins: [i18n] } })
    await flushPromises()
    await nextTick()
    const sel = wrapper.find('select.lang-switcher-select')
    await sel.setValue('he')
    await flushPromises()
    await nextTick()
    const html = wrapper.html()
    expect(html).toContain('active')
  })
})
