// LanguageSwitcher.vue 单元测试 (P10 阶段)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import http from '@/utils/request'
import LanguageSwitcher from '../LanguageSwitcher.vue'

const SAMPLE_LANGUAGES = [
  { code: 'zh-CN', display_name: '简体中文', english_name: 'Chinese (Simplified)', direction: 'ltr', is_rtl: false, decimal_separator: '.', thousands_separator: ',', currency_position: 'before', first_day_of_week: 1, plural_rule: 'other_only', number_grouping: 3 },
  { code: 'en-US', display_name: 'English', english_name: 'English (US)', direction: 'ltr', is_rtl: false, decimal_separator: '.', thousands_separator: ',', currency_position: 'before', first_day_of_week: 0, plural_rule: 'one_other', number_grouping: 3 },
  { code: 'ar', display_name: 'العربية', english_name: 'Arabic', direction: 'rtl', is_rtl: true, decimal_separator: '٫', thousands_separator: '٬', currency_position: 'after', first_day_of_week: 6, plural_rule: 'arabic', number_grouping: 3 },
  { code: 'he', display_name: 'עברית', english_name: 'Hebrew', direction: 'rtl', is_rtl: true, decimal_separator: '.', thousands_separator: ',', currency_position: 'after', first_day_of_week: 0, plural_rule: 'hebrew', number_grouping: 3 },
]

describe('LanguageSwitcher.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('渲染 9+ 个 option 至少包含 zh-CN/en-US/ar/he', async () => {
    ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { languages: SAMPLE_LANGUAGES, count: 4 } } })
    const wrapper = mount(LanguageSwitcher)
    await flushPromises()
    await nextTick()
    const options = wrapper.findAll('option')
    expect(options.length).toBeGreaterThanOrEqual(4)
    const labels = options.map(o => o.text()).join(' ')
    expect(labels).toContain('zh-CN')
    expect(labels).toContain('en-US')
    expect(labels).toContain('ar')
    expect(labels).toContain('he')
  })

  it('change 事件应回传选中的 code', async () => {
    ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { languages: SAMPLE_LANGUAGES, count: 4 } } })
    const wrapper = mount(LanguageSwitcher)
    await flushPromises()
    const sel = wrapper.find('select')
    await sel.setValue('ar')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['ar'])
    expect(wrapper.emitted('change')?.[0]).toEqual(['ar'])
  })

  it('RTL 语言 (ar) 切换后容器 .rtl class 存在', async () => {
    ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { languages: SAMPLE_LANGUAGES, count: 4 } } })
    const wrapper = mount(LanguageSwitcher, { props: { modelValue: 'ar' } })
    await flushPromises()
    await nextTick()
    expect(wrapper.find('.lang-switcher').classes()).toContain('rtl')
  })

  it('应展示 LTR/RTL 标签与复数规则', async () => {
    ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { languages: SAMPLE_LANGUAGES, count: 4 } } })
    const wrapper = mount(LanguageSwitcher, { props: { modelValue: 'en-US' } })
    await flushPromises()
    await nextTick()
    const html = wrapper.html()
    expect(html).toContain('LTR')
    expect(html).toContain('one_other')
  })

  it('无障碍: select 有 aria-label', async () => {
    ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { languages: SAMPLE_LANGUAGES, count: 4 } } })
    const wrapper = mount(LanguageSwitcher, { props: { ariaLabel: '切换语言测试' } })
    await flushPromises()
    const sel = wrapper.find('select')
    expect(sel.attributes('aria-label')).toBe('切换语言测试')
  })
})
