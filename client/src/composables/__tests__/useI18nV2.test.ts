// useI18nV2 单元测试 (P10 阶段)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import http from '@/utils/request'
import { useI18nV2 } from '../useI18nV2'

const SAMPLE_LANGUAGES = [
  {
    code: 'zh-CN',
    display_name: '简体中文',
    english_name: 'Chinese (Simplified)',
    direction: 'ltr',
    is_rtl: false,
    decimal_separator: '.',
    thousands_separator: ',',
    currency_position: 'before',
    first_day_of_week: 1,
    plural_rule: 'other_only',
    number_grouping: 3,
  },
  {
    code: 'en-US',
    display_name: 'English',
    english_name: 'English (US)',
    direction: 'ltr',
    is_rtl: false,
    decimal_separator: '.',
    thousands_separator: ',',
    currency_position: 'before',
    first_day_of_week: 0,
    plural_rule: 'one_other',
    number_grouping: 3,
  },
  {
    code: 'ar',
    display_name: 'العربية',
    english_name: 'Arabic',
    direction: 'rtl',
    is_rtl: true,
    decimal_separator: '٫',
    thousands_separator: '٬',
    currency_position: 'after',
    first_day_of_week: 6,
    plural_rule: 'arabic',
    number_grouping: 3,
  },
  {
    code: 'he',
    display_name: 'עברית',
    english_name: 'Hebrew',
    direction: 'rtl',
    is_rtl: true,
    decimal_separator: '.',
    thousands_separator: ',',
    currency_position: 'after',
    first_day_of_week: 0,
    plural_rule: 'hebrew',
    number_grouping: 3,
  },
  {
    code: 'fr',
    display_name: 'Français',
    english_name: 'French',
    direction: 'ltr',
    is_rtl: false,
    decimal_separator: ',',
    thousands_separator: ' ',
    currency_position: 'after',
    first_day_of_week: 1,
    plural_rule: 'french',
    number_grouping: 3,
  },
]

// 重置全局共享状态 (state 与 _loadedLangs 是模块级单例)
const resetState = () => {
  const { state, clearLangCache } = useI18nV2()
  state.languages = []
  state.keys = []
  state.entries = {}
  state.syncLog = []
  state.currentLang = 'zh-CN'
  state.loading = false
  state.error = null
  clearLangCache()
}

describe('useI18nV2.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    resetState()
    document.documentElement.removeAttribute('dir')
    document.documentElement.removeAttribute('lang')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchLanguages', () => {
    it('成功时填充 state.languages', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { languages: SAMPLE_LANGUAGES, count: 5 } } })
      const { state, fetchLanguages } = useI18nV2()
      const out = await fetchLanguages()
      expect(out).toHaveLength(5)
      expect(state.languages).toHaveLength(5)
      expect(state.currentLang).toBe('zh-CN')
    })

    it('响应 languages 字段缺失时回退到空数组', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: {} } })
      const { state, fetchLanguages } = useI18nV2()
      const out = await fetchLanguages()
      expect(out).toEqual([])
      expect(state.languages).toEqual([])
    })

    it('失败时应写入错误并返回空数组', async () => {
      ;(http.get as any).mockRejectedValue(new Error('network'))
      const { state, fetchLanguages } = useI18nV2()
      const out = await fetchLanguages()
      expect(out).toEqual([])
      expect(state.error).toBe('network')
    })

    it('失败时使用非 Error 对象也能写入 error', async () => {
      ;(http.get as any).mockRejectedValue('plain string error')
      const { state, fetchLanguages } = useI18nV2()
      await fetchLanguages()
      expect(state.error).toBe('plain string error')
    })

    it('localStorage 中有存储且命中时恢复语言', async () => {
      localStorage.setItem('i18n_v2.lang', 'he')
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { languages: SAMPLE_LANGUAGES, count: 5 } } })
      const { state, fetchLanguages } = useI18nV2()
      await fetchLanguages()
      expect(state.currentLang).toBe('he')
      expect(document.documentElement.getAttribute('dir')).toBe('rtl')
    })

    it('localStorage 命中但不在列表中时使用第一个语言', async () => {
      localStorage.setItem('i18n_v2.lang', 'ko')
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { languages: SAMPLE_LANGUAGES, count: 5 } } })
      const { state, fetchLanguages } = useI18nV2()
      await fetchLanguages()
      expect(state.currentLang).toBe('zh-CN')
    })

    it('当前语言不在列表中且无 localStorage 时回退到第一个语言', async () => {
      const { state, fetchLanguages, setCurrentLang } = useI18nV2()
      // 先把 currentLang 设置成列表中不存在的值
      setCurrentLang('xx-XX')
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { languages: SAMPLE_LANGUAGES, count: 5 } } })
      await fetchLanguages()
      expect(state.currentLang).toBe('zh-CN')
    })

    it('localStorage 抛错时静默忽略并走默认逻辑', async () => {
      const original = Storage.prototype.getItem
      Storage.prototype.getItem = vi.fn(() => { throw new Error('quota') })
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { languages: SAMPLE_LANGUAGES, count: 5 } } })
      const { state, fetchLanguages } = useI18nV2()
      await fetchLanguages()
      expect(state.languages).toHaveLength(5)
      Storage.prototype.getItem = original
    })
  })

  describe('setCurrentLang', () => {
    it('切换到 RTL 语言时设置 document.dir=rtl', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { languages: SAMPLE_LANGUAGES, count: 5 } } })
      const { fetchLanguages, setCurrentLang, state, isCurrentRtl } = useI18nV2()
      await fetchLanguages()
      setCurrentLang('ar')
      expect(state.currentLang).toBe('ar')
      expect(isCurrentRtl.value).toBe(true)
      expect(document.documentElement.getAttribute('dir')).toBe('rtl')
    })

    it('切换到 LTR 语言时 document.dir=ltr', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { languages: SAMPLE_LANGUAGES, count: 5 } } })
      const { fetchLanguages, setCurrentLang, state, isCurrentRtl } = useI18nV2()
      await fetchLanguages()
      setCurrentLang('fr')
      expect(state.currentLang).toBe('fr')
      expect(isCurrentRtl.value).toBe(false)
      expect(document.documentElement.getAttribute('dir')).toBe('ltr')
    })

    it('localStorage 持久化当前语言', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { languages: SAMPLE_LANGUAGES, count: 5 } } })
      const { fetchLanguages, setCurrentLang } = useI18nV2()
      await fetchLanguages()
      setCurrentLang('he')
      expect(localStorage.getItem('i18n_v2.lang')).toBe('he')
    })

    it('localStorage 写入失败时静默', async () => {
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = vi.fn(() => { throw new Error('quota') })
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { languages: SAMPLE_LANGUAGES, count: 5 } } })
      const { fetchLanguages, setCurrentLang, state } = useI18nV2()
      await fetchLanguages()
      expect(() => setCurrentLang('en-US')).not.toThrow()
      expect(state.currentLang).toBe('en-US')
      Storage.prototype.setItem = original
    })
  })

  describe('currentMeta / isCurrentRtl', () => {
    it('无语言列表时 currentMeta 为 null, isCurrentRtl 为 false', () => {
      const { currentMeta, isCurrentRtl } = useI18nV2()
      expect(currentMeta.value).toBeNull()
      expect(isCurrentRtl.value).toBe(false)
    })

    it('加载语言后 currentMeta 能正确匹配', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { languages: SAMPLE_LANGUAGES, count: 5 } } })
      const { fetchLanguages, setCurrentLang, currentMeta } = useI18nV2()
      await fetchLanguages()
      setCurrentLang('ar')
      expect(currentMeta.value?.code).toBe('ar')
      expect(currentMeta.value?.is_rtl).toBe(true)
    })
  })

  describe('fetchKeys / fetchEntry / pullTranslations', () => {
    it('fetchKeys 返回 key 列表', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { keys: ['common.welcome', 'common.save'], count: 2 } } })
      const { fetchKeys, state } = useI18nV2()
      const keys = await fetchKeys()
      expect(keys).toEqual(['common.welcome', 'common.save'])
      expect(state.keys).toEqual(['common.welcome', 'common.save'])
    })

    it('fetchKeys 失败时返回空数组', async () => {
      ;(http.get as any).mockRejectedValue(new Error('boom'))
      const { fetchKeys, state } = useI18nV2()
      const keys = await fetchKeys()
      expect(keys).toEqual([])
      expect(state.error).toBe('boom')
    })

    it('fetchEntry 单条获取', async () => {
      ;(http.get as any).mockResolvedValue({
        data: { code: 0, msg: 'ok', data: { key: 'common.welcome', translations: { 'zh-CN': '欢迎' }, plurals: {}, description: '', updated_at: 1, version: 1 } },
      })
      const { fetchEntry } = useI18nV2()
      const out = await fetchEntry('common.welcome')
      expect(out?.translations['zh-CN']).toBe('欢迎')
    })

    it('fetchEntry 失败返回 null', async () => {
      ;(http.get as any).mockRejectedValue(new Error('404'))
      const { fetchEntry, state } = useI18nV2()
      const out = await fetchEntry('nope')
      expect(out).toBeNull()
      expect(state.error).toBe('404')
    })

    it('fetchEntry 成功时回填到 state.entries', async () => {
      ;(http.get as any).mockResolvedValue({
        data: { code: 0, msg: 'ok', data: { key: 'k1', translations: { 'zh-CN': '你好' }, plurals: {}, description: '', updated_at: 1, version: 1 } },
      })
      const { fetchEntry, state } = useI18nV2()
      await fetchEntry('k1')
      expect(state.entries['k1'].translations['zh-CN']).toBe('你好')
    })

    it('pullTranslations 拉取 zh-CN', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { scope: 'zh-CN', keys: { k1: 'v1' }, plurals: {}, count: 1 } } })
      const { pullTranslations } = useI18nV2()
      const out = await pullTranslations('zh-CN')
      expect(out).toEqual({ k1: 'v1' })
    })

    it('pullTranslations 携带 since 参数', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { keys: { k1: 'v1' } } } })
      const { pullTranslations } = useI18nV2()
      await pullTranslations('zh-CN', 1700000000)
      expect(http.get).toHaveBeenCalledWith('/api/v1/i18n-v2/pull', { params: { lang: 'zh-CN', since: 1700000000 } })
    })

    it('pullTranslations 失败返回空对象', async () => {
      ;(http.get as any).mockRejectedValue(new Error('net'))
      const { pullTranslations, state } = useI18nV2()
      const out = await pullTranslations('zh-CN')
      expect(out).toEqual({})
      expect(state.error).toBe('net')
    })

    it('pullTranslations 无参数时不传 lang', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { keys: {} } } })
      const { pullTranslations } = useI18nV2()
      await pullTranslations()
      expect((http.get as any).mock.calls[0][1].params).toEqual({})
    })
  })

  describe('pushTranslation / pushPlural', () => {
    it('pushTranslation 应 POST 正确参数', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { key: 'k1', version: 1, updated_at: 1, translations: { 'en-US': 'Hi' } } } })
      const { pushTranslation } = useI18nV2()
      const out = await pushTranslation('k1', 'en-US', 'Hi', 'tester')
      expect(http.post).toHaveBeenCalledWith('/api/v1/i18n-v2/push', {
        key: 'k1',
        lang: 'en-US',
        value: 'Hi',
        actor: 'tester',
        description: '',
      })
      expect(out?.translations['en-US']).toBe('Hi')
    })

    it('pushTranslation 默认 actor 为 console', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { key: 'k1', version: 1, updated_at: 1, translations: { 'en-US': 'Hi' } } } })
      const { pushTranslation } = useI18nV2()
      await pushTranslation('k1', 'en-US', 'Hi')
      const call = (http.post as any).mock.calls[0]
      expect(call[1].actor).toBe('console')
    })

    it('pushTranslation 失败返回 null', async () => {
      ;(http.post as any).mockRejectedValue(new Error('push fail'))
      const { pushTranslation, state } = useI18nV2()
      const out = await pushTranslation('k1', 'en-US', 'Hi')
      expect(out).toBeNull()
      expect(state.error).toBe('push fail')
    })

    it('pushPlural 应推送复数形式', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { key: 'common.items', version: 1, updated_at: 1, plurals: { 'en-US': { one: 'item', other: 'items' } } } } })
      const { pushPlural } = useI18nV2()
      const out = await pushPlural('common.items', 'en-US', { one: 'item', other: 'items' })
      expect(http.post).toHaveBeenCalledWith('/api/v1/i18n-v2/push-plural', {
        key: 'common.items',
        lang: 'en-US',
        forms: { one: 'item', other: 'items' },
        actor: 'console',
      })
      expect(out?.plurals['en-US'].one).toBe('item')
    })

    it('pushPlural 默认 actor 与失败路径', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { key: 'k', version: 1, updated_at: 1, plurals: {} } } })
      const { pushPlural } = useI18nV2()
      await pushPlural('k', 'en-US', { one: 'a' }, 'admin')
      expect((http.post as any).mock.calls[0][1].actor).toBe('admin')

      ;(http.post as any).mockRejectedValueOnce(new Error('x'))
      const { pushPlural: pp2, state } = useI18nV2()
      const out = await pp2('k', 'en-US', { one: 'a' })
      expect(out).toBeNull()
      expect(state.error).toBe('x')
    })
  })

  describe('diffLanguages / fetchSyncLog / fetchStats', () => {
    it('diffLanguages 返回 diff 数据', async () => {
      ;(http.get as any).mockResolvedValue({
        data: { code: 0, msg: 'ok', data: { lang_a: 'zh-CN', lang_b: 'en-US', a_missing: ['x'], b_missing: [], identical: [], total: 1 } },
      })
      const { diffLanguages } = useI18nV2()
      const out = await diffLanguages('zh-CN', 'en-US')
      expect(out?.a_missing).toEqual(['x'])
    })

    it('diffLanguages 失败返回 null', async () => {
      ;(http.get as any).mockRejectedValue(new Error('d'))
      const { diffLanguages, state } = useI18nV2()
      const out = await diffLanguages('zh-CN', 'en-US')
      expect(out).toBeNull()
      expect(state.error).toBe('d')
    })

    it('fetchSyncLog 返回事件', async () => {
      ;(http.get as any).mockResolvedValue({
        data: { code: 0, msg: 'ok', data: { events: [{ event_id: 'e1', ts: 1, actor: 'u', kind: 'create', key: 'k', language: 'zh-CN', note: '' }], count: 1 } },
      })
      const { fetchSyncLog, state } = useI18nV2()
      const out = await fetchSyncLog(50)
      expect(out).toHaveLength(1)
      expect(state.syncLog).toHaveLength(1)
    })

    it('fetchSyncLog 失败返回空数组', async () => {
      ;(http.get as any).mockRejectedValue(new Error('s'))
      const { fetchSyncLog, state } = useI18nV2()
      const out = await fetchSyncLog()
      expect(out).toEqual([])
      expect(state.error).toBe('s')
    })

    it('fetchStats 返回仓库统计', async () => {
      ;(http.get as any).mockResolvedValue({
        data: { code: 0, msg: 'ok', data: { total_keys: 10, per_language: { 'zh-CN': 10 }, plural_keys: 1, languages: 9 } },
      })
      const { fetchStats } = useI18nV2()
      const out = await fetchStats()
      expect(out?.total_keys).toBe(10)
    })

    it('fetchStats 失败返回 null', async () => {
      ;(http.get as any).mockRejectedValue(new Error('st'))
      const { fetchStats, state } = useI18nV2()
      const out = await fetchStats()
      expect(out).toBeNull()
      expect(state.error).toBe('st')
    })
  })

  describe('translate / pluralExamples / formatByKind', () => {
    it('translate 普通翻译', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { key: 'common.save', lang: 'zh-CN', count: null, text: '保存', is_rtl: false } } })
      const { translate } = useI18nV2()
      const out = await translate('common.save')
      expect(out?.text).toBe('保存')
    })

    it('translate 带 count 时参数正确', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { text: '1 item', is_rtl: false } } })
      const { translate } = useI18nV2()
      await translate('common.item', 1, { name: 'x' })
      const call = (http.post as any).mock.calls[0]
      expect(call[0]).toBe('/api/v1/i18n-v2/translate')
      expect(call[1].count).toBe(1)
      expect(call[1].params).toEqual({ name: 'x' })
    })

    it('translate 失败返回 null', async () => {
      ;(http.post as any).mockRejectedValue(new Error('t'))
      const { translate, state } = useI18nV2()
      const out = await translate('k')
      expect(out).toBeNull()
      expect(state.error).toBe('t')
    })

    it('pluralExamples 返回多 count 示例', async () => {
      ;(http.get as any).mockResolvedValue({
        data: { code: 0, msg: 'ok', data: { key: 'common.items', lang: 'ar', is_rtl: true, samples: [{ count: 0, category: 'zero', text: 'لا عناصر' }] } },
      })
      const { pluralExamples } = useI18nV2()
      const out = await pluralExamples('common.items', 'ar')
      expect(out?.[0].category).toBe('zero')
    })

    it('pluralExamples 自定义 samples 参数', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { samples: [] } } })
      const { pluralExamples } = useI18nV2()
      await pluralExamples('k', 'en-US', '0,1,2')
      const call = (http.get as any).mock.calls[0]
      expect(call[1].params.samples).toBe('0,1,2')
    })

    it('pluralExamples 失败返回 null', async () => {
      ;(http.get as any).mockRejectedValue(new Error('p'))
      const { pluralExamples, state } = useI18nV2()
      const out = await pluralExamples('k', 'en-US')
      expect(out).toBeNull()
      expect(state.error).toBe('p')
    })

    it('formatByKind number 走 POST', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { kind: 'number', lang: 'en-US', result: '1,234.56', is_rtl: false } } })
      const { formatByKind } = useI18nV2()
      const out = await formatByKind({ kind: 'number', value: 1234.56, lang: 'en-US' })
      expect(out).toBe('1,234.56')
    })

    it('formatByKind currency 覆盖默认 USD', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { result: '€1,234.56' } } })
      const { formatByKind } = useI18nV2()
      const out = await formatByKind({ kind: 'currency', value: 1234.56, currency: 'EUR' })
      const call = (http.post as any).mock.calls[0]
      expect(call[1].kind).toBe('currency')
      expect(call[1].currency).toBe('EUR')
      expect(out).toBe('€1,234.56')
    })

    it('formatByKind date 自定义 fmt', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { result: '2025-01-01' } } })
      const { formatByKind } = useI18nV2()
      await formatByKind({ kind: 'date', value: '2025-01-01', fmt: 'short' })
      const call = (http.post as any).mock.calls[0]
      expect(call[1].kind).toBe('date')
      expect(call[1].fmt).toBe('short')
    })

    it('formatByKind plural 携带 count 与 key', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { result: '5 items' } } })
      const { formatByKind } = useI18nV2()
      await formatByKind({ kind: 'plural', count: 5, key: 'common.item' })
      const call = (http.post as any).mock.calls[0]
      expect(call[1].kind).toBe('plural')
      expect(call[1].count).toBe(5)
      expect(call[1].key).toBe('common.item')
    })

    it('formatByKind 失败返回 null', async () => {
      ;(http.post as any).mockRejectedValue(new Error('f'))
      const { formatByKind, state } = useI18nV2()
      const out = await formatByKind({ kind: 'number', value: 1 })
      expect(out).toBeNull()
      expect(state.error).toBe('f')
    })
  })

  describe('formatRelative', () => {
    it('5 秒内应输出"刚刚/just now"等价', () => {
      const { formatRelative } = useI18nV2()
      expect(formatRelative(new Date(), 'zh-CN')).toBe('刚刚')
      expect(formatRelative(new Date(), 'en-US')).toBe('just now')
      expect(formatRelative(new Date(), 'ja')).toBe('今')
    })

    it('分钟/小时/天 应按阈值切换', () => {
      const { formatRelative } = useI18nV2()
      const minutes = new Date(Date.now() - 1000 * 60 * 5)
      const hours = new Date(Date.now() - 1000 * 60 * 60 * 2)
      const days = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3)
      expect(formatRelative(minutes, 'en-US')).toMatch(/min/)
      expect(formatRelative(hours, 'en-US')).toMatch(/hr/)
      expect(formatRelative(days, 'en-US')).toMatch(/d/)
    })

    it('9 种语言均不应抛错', () => {
      const { formatRelative } = useI18nV2()
      const d = new Date(Date.now() - 1000 * 60 * 30)
      for (const code of ['zh-CN', 'zh-TW', 'en-US', 'ja', 'ko', 'ar', 'he', 'fr', 'es']) {
        expect(typeof formatRelative(d, code)).toBe('string')
      }
    })

    it('未来时间应使用 future 短语', () => {
      const { formatRelative } = useI18nV2()
      const future = new Date(Date.now() + 1000 * 60 * 10)
      expect(formatRelative(future, 'en-US')).toBe('in 10 min')
    })

    it('未知语言 fallback 到 en-US', () => {
      const { formatRelative } = useI18nV2()
      const future = new Date(Date.now() + 1000 * 60 * 60 * 2)
      expect(formatRelative(future, 'xx-XX')).toMatch(/^in /)
    })

    it('接受字符串/数字时间戳', () => {
      const { formatRelative } = useI18nV2()
      const past = new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString()
      expect(typeof formatRelative(past, 'en-US')).toBe('string')
      expect(typeof formatRelative(Date.now() - 1000, 'en-US')).toBe('string')
    })

    it('5-60 秒区间应输出秒数', () => {
      const { formatRelative } = useI18nV2()
      const seconds = new Date(Date.now() - 1000 * 30)
      expect(formatRelative(seconds, 'en-US')).toMatch(/sec/)
    })
  })

  describe('TM 翻译记忆', () => {
    it('searchTm 返回匹配列表', async () => {
      ;(http.post as any).mockResolvedValue({
        data: { code: 0, msg: 'ok', data: { matches: [{ key: 'k1', lang: 'en-US', text: 'Hello', similarity: 0.9 }] } },
      })
      const { searchTm } = useI18nV2()
      const out = await searchTm('Hello', 'en-US', 0.5, 5)
      expect(http.post).toHaveBeenCalledWith('/api/v1/i18n-v2/tm/search', {
        source_text: 'Hello',
        lang: 'en-US',
        threshold: 0.5,
        limit: 5,
      })
      expect(out).toHaveLength(1)
      expect(out[0].similarity).toBe(0.9)
    })

    it('searchTm 失败返回空数组', async () => {
      ;(http.post as any).mockRejectedValue(new Error('tm'))
      const { searchTm, state } = useI18nV2()
      const out = await searchTm('x')
      expect(out).toEqual([])
      expect(state.error).toBe('tm')
    })

    it('fetchTmStats 返回统计', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { 'en-US': 10, 'zh-CN': 5 } } })
      const { fetchTmStats } = useI18nV2()
      const out = await fetchTmStats()
      expect(out).toEqual({ 'en-US': 10, 'zh-CN': 5 })
    })

    it('fetchTmStats 失败返回 null', async () => {
      ;(http.get as any).mockRejectedValue(new Error('ts'))
      const { fetchTmStats, state } = useI18nV2()
      const out = await fetchTmStats()
      expect(out).toBeNull()
      expect(state.error).toBe('ts')
    })

    it('searchTm 响应 data.matches 缺失时返回空数组', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: {} } })
      const { searchTm } = useI18nV2()
      const out = await searchTm('x')
      expect(out).toEqual([])
    })

    it('machineTranslate 响应 data 为 null 时返回 null', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: null } })
      const { machineTranslate } = useI18nV2()
      const out = await machineTranslate('k', 'zh-CN', 'en-US', 'x')
      expect(out).toBeNull()
    })

    it('reviewMt 响应 data 为 null 时返回 null', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: null } })
      const { reviewMt } = useI18nV2()
      const out = await reviewMt('k', 'en-US', 'approve')
      expect(out).toBeNull()
    })

    it('fetchMtQueue 响应 data.items 缺失时返回空数组', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: {} } })
      const { fetchMtQueue } = useI18nV2()
      const out = await fetchMtQueue()
      expect(out).toEqual([])
    })

    it('fetchSyncLog 响应 data.events 缺失时返回空数组', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: {} } })
      const { fetchSyncLog, state } = useI18nV2()
      const out = await fetchSyncLog()
      expect(out).toEqual([])
      expect(state.syncLog).toEqual([])
    })

    it('translate 响应 data 为 null 时返回 null', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: null } })
      const { translate } = useI18nV2()
      const out = await translate('k')
      expect(out).toBeNull()
    })

    it('fetchEntry 响应 data 为 null 时返回 null', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: null } })
      const { fetchEntry } = useI18nV2()
      const out = await fetchEntry('k')
      expect(out).toBeNull()
    })

    it('fetchKeys 响应 data 为 null 时 keys 为空', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: null } })
      const { fetchKeys, state } = useI18nV2()
      const out = await fetchKeys()
      expect(out).toEqual([])
      expect(state.keys).toEqual([])
    })

    it('pullTranslations 响应 data 为 null 时返回空对象', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: null } })
      const { pullTranslations } = useI18nV2()
      const out = await pullTranslations('zh-CN')
      expect(out).toEqual({})
    })

    it('pushTranslation 响应 data 为 null 时返回 null', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: null } })
      const { pushTranslation } = useI18nV2()
      const out = await pushTranslation('k', 'en-US', 'v')
      expect(out).toBeNull()
    })

    it('pushPlural 响应 data 为 null 时返回 null', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: null } })
      const { pushPlural } = useI18nV2()
      const out = await pushPlural('k', 'en-US', { one: 'a' })
      expect(out).toBeNull()
    })

    it('pluralExamples 响应 data 为 null 时返回空数组', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: null } })
      const { pluralExamples } = useI18nV2()
      const out = await pluralExamples('k', 'en-US')
      expect(out).toEqual([])
    })
  })

  describe('机器翻译 MT', () => {
    it('machineTranslate 返回结果', async () => {
      ;(http.post as any).mockResolvedValue({
        data: { code: 0, msg: 'ok', data: { key: 'k', source_lang: 'zh-CN', target_lang: 'en-US', source_text: '你好', translated_text: 'Hello', provider: 'google', confidence: 0.95, status: 'pending' } },
      })
      const { machineTranslate } = useI18nV2()
      const out = await machineTranslate('k', 'zh-CN', 'en-US', '你好')
      expect(out?.translated_text).toBe('Hello')
      expect(out?.provider).toBe('google')
    })

    it('machineTranslate 失败返回 null', async () => {
      ;(http.post as any).mockRejectedValue(new Error('mt'))
      const { machineTranslate, state } = useI18nV2()
      const out = await machineTranslate('k', 'zh-CN', 'en-US', 'x')
      expect(out).toBeNull()
      expect(state.error).toBe('mt')
    })

    it('reviewMt 默认 actor 与 reviewed_text', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { key: 'k', status: 'approved' } } })
      const { reviewMt } = useI18nV2()
      await reviewMt('k', 'en-US', 'approve')
      const call = (http.post as any).mock.calls[0]
      expect(call[0]).toBe('/api/v1/i18n-v2/mt/review')
      expect(call[1].actor).toBe('reviewer')
      expect(call[1].reviewed_text).toBe('')
    })

    it('reviewMt 自定义参数', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { key: 'k', status: 'rejected' } } })
      const { reviewMt } = useI18nV2()
      const out = await reviewMt('k', 'en-US', 'reject', '修正文本', 'admin')
      expect(out?.status).toBe('rejected')
    })

    it('reviewMt 失败返回 null', async () => {
      ;(http.post as any).mockRejectedValue(new Error('r'))
      const { reviewMt, state } = useI18nV2()
      const out = await reviewMt('k', 'en-US', 'approve')
      expect(out).toBeNull()
      expect(state.error).toBe('r')
    })

    it('fetchMtQueue 返回队列', async () => {
      ;(http.get as any).mockResolvedValue({
        data: { code: 0, msg: 'ok', data: { items: [{ key: 'k1', status: 'pending' }] } },
      })
      const { fetchMtQueue } = useI18nV2()
      const out = await fetchMtQueue('pending')
      expect(out).toHaveLength(1)
      expect((http.get as any).mock.calls[0][1].params.status).toBe('pending')
    })

    it('fetchMtQueue 默认空 status', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { items: [] } } })
      const { fetchMtQueue } = useI18nV2()
      await fetchMtQueue()
      expect((http.get as any).mock.calls[0][1].params.status).toBe('')
    })

    it('fetchMtQueue 失败返回空数组', async () => {
      ;(http.get as any).mockRejectedValue(new Error('q'))
      const { fetchMtQueue, state } = useI18nV2()
      const out = await fetchMtQueue()
      expect(out).toEqual([])
      expect(state.error).toBe('q')
    })

    it('listMtProviders 返回提供者列表', async () => {
      ;(http.get as any).mockResolvedValue({
        data: { code: 0, msg: 'ok', data: { providers: [{ id: 'google', name: 'Google', available: true, description: 'ok' }], current: 'google', count: 1 } },
      })
      const { listMtProviders } = useI18nV2()
      const out = await listMtProviders()
      expect(out?.providers[0].id).toBe('google')
      expect(out?.current).toBe('google')
    })

    it('listMtProviders 失败返回 null', async () => {
      ;(http.get as any).mockRejectedValue(new Error('p'))
      const { listMtProviders, state } = useI18nV2()
      const out = await listMtProviders()
      expect(out).toBeNull()
      expect(state.error).toBe('p')
    })
  })

  describe('loadLangPack / clearLangCache', () => {
    it('首次加载时拉取并写入 state.entries', async () => {
      ;(http.get as any).mockResolvedValue({
        data: { code: 0, msg: 'ok', data: { keys: { k1: 'v1', k2: 'v2' } } },
      })
      const { loadLangPack, state, clearLangCache } = useI18nV2()
      clearLangCache()
      const out = await loadLangPack('en-US')
      expect(out).toEqual({ k1: 'v1', k2: 'v2' })
      expect(state.entries['k1'].translations['en-US']).toBe('v1')
      expect(state.entries['k2'].translations['en-US']).toBe('v2')
    })

    it('已缓存时不再请求接口, 从 state.entries 提取', async () => {
      ;(http.get as any).mockResolvedValue({
        data: { code: 0, msg: 'ok', data: { keys: { k1: 'v1' } } },
      })
      const { loadLangPack, state, clearLangCache } = useI18nV2()
      clearLangCache()
      await loadLangPack('en-US')
      const callCount = (http.get as any).mock.calls.length
      // 第二次调用应命中缓存, 不再发请求
      const out2 = await loadLangPack('en-US')
      expect(out2).toEqual({ k1: 'v1' })
      expect((http.get as any).mock.calls.length).toBe(callCount)
      expect(state.entries['k1'].translations['en-US']).toBe('v1')
    })

    it('已存在的 entry 会合并新语言的翻译', async () => {
      const { state, loadLangPack, clearLangCache } = useI18nV2()
      clearLangCache()
      state.entries['k1'] = {
        key: 'k1',
        translations: { 'zh-CN': '你好' },
        plurals: {},
        description: '',
        updated_at: 0,
        version: 0,
      }
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { keys: { k1: 'Hello' } } } })
      await loadLangPack('en-US')
      expect(state.entries['k1'].translations['zh-CN']).toBe('你好')
      expect(state.entries['k1'].translations['en-US']).toBe('Hello')
    })

    it('loadLangPack 失败返回空对象', async () => {
      ;(http.get as any).mockRejectedValue(new Error('lp'))
      const { loadLangPack, state, clearLangCache } = useI18nV2()
      clearLangCache()
      const out = await loadLangPack('en-US')
      expect(out).toEqual({})
      expect(state.error).toBe('lp')
    })

    it('loadLangPack 空 lang 时使用 state.currentLang', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { keys: { k1: 'v1' } } } })
      const { loadLangPack, clearLangCache } = useI18nV2()
      clearLangCache()
      await loadLangPack('')
      expect((http.get as any).mock.calls[0][1].params.lang).toBe('zh-CN')
    })

    it('loadLangPack 响应 data 缺失时 keys 默认为空', async () => {
      ;(http.get as any).mockResolvedValue({ data: null })
      const { loadLangPack, state, clearLangCache } = useI18nV2()
      clearLangCache()
      const out = await loadLangPack('en-US')
      expect(out).toEqual({})
      expect(state.entries).toEqual({})
    })

    it('clearLangCache 后再次加载会重新发请求', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { keys: { k1: 'v1' } } } })
      const { loadLangPack, clearLangCache } = useI18nV2()
      clearLangCache()
      await loadLangPack('en-US')
      const callCount = (http.get as any).mock.calls.length
      clearLangCache()
      await loadLangPack('en-US')
      expect((http.get as any).mock.calls.length).toBe(callCount + 1)
    })
  })

  describe('导入导出 (P12-1)', () => {
    it('exportTranslations 默认参数', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { format: 'csv', content: 'a,b', count: 2 } } })
      const { exportTranslations } = useI18nV2()
      const out = await exportTranslations()
      expect((http.get as any).mock.calls[0][1].params).toEqual({ lang: '', fmt: 'csv' })
      expect(out?.format).toBe('csv')
    })

    it('exportTranslations xliff 格式', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { format: 'xliff', content: '<xliff/>', count: 1 } } })
      const { exportTranslations } = useI18nV2()
      const out = await exportTranslations('en-US', 'xliff')
      expect((http.get as any).mock.calls[0][1].params).toEqual({ lang: 'en-US', fmt: 'xliff' })
      expect(out?.format).toBe('xliff')
    })

    it('exportTranslations 失败返回 null', async () => {
      ;(http.get as any).mockRejectedValue(new Error('exp'))
      const { exportTranslations, state } = useI18nV2()
      const out = await exportTranslations()
      expect(out).toBeNull()
      expect(state.error).toBe('exp')
    })

    it('importTranslations 默认参数', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { imported: 3, skipped: 0, errors: [] } } })
      const { importTranslations } = useI18nV2()
      const out = await importTranslations('csv content')
      const call = (http.post as any).mock.calls[0]
      expect(call[0]).toBe('/api/v1/i18n-v2/import')
      expect(call[1].conflict).toBe('overwrite')
      expect(call[1].actor).toBe('importer')
      expect(out?.imported).toBe(3)
    })

    it('importTranslations 自定义 conflict 与 actor', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { imported: 1, skipped: 2, errors: ['x'] } } })
      const { importTranslations } = useI18nV2()
      await importTranslations('xml', 'xliff', 'skip', 'admin')
      const call = (http.post as any).mock.calls[0]
      expect(call[1].fmt).toBe('xliff')
      expect(call[1].conflict).toBe('skip')
      expect(call[1].actor).toBe('admin')
    })

    it('importTranslations 失败返回 null', async () => {
      ;(http.post as any).mockRejectedValue(new Error('imp'))
      const { importTranslations, state } = useI18nV2()
      const out = await importTranslations('x')
      expect(out).toBeNull()
      expect(state.error).toBe('imp')
    })
  })

  describe('版本历史与回滚 (P12-2)', () => {
    it('fetchHistory 返回版本列表', async () => {
      ;(http.get as any).mockResolvedValue({
        data: { code: 0, msg: 'ok', data: { versions: [{ version: 1, value: 'v1', actor: 'a', ts: 1, note: '' }] } },
      })
      const { fetchHistory } = useI18nV2()
      const out = await fetchHistory('k1', 'en-US')
      expect(out).toHaveLength(1)
      expect(out[0].version).toBe(1)
    })

    it('fetchHistory 失败返回空数组', async () => {
      ;(http.get as any).mockRejectedValue(new Error('h'))
      const { fetchHistory, state } = useI18nV2()
      const out = await fetchHistory('k1', 'en-US')
      expect(out).toEqual([])
      expect(state.error).toBe('h')
    })

    it('rollbackTranslation 回滚到指定版本', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { ok: true, version: 2, value: 'restored' } } })
      const { rollbackTranslation } = useI18nV2()
      const out = await rollbackTranslation('k1', 'en-US', 2)
      const call = (http.post as any).mock.calls[0]
      expect(call[1]).toEqual({ key: 'k1', lang: 'en-US', version: 2, actor: 'rollback' })
      expect(out?.value).toBe('restored')
    })

    it('rollbackTranslation 失败返回 null', async () => {
      ;(http.post as any).mockRejectedValue(new Error('rb'))
      const { rollbackTranslation, state } = useI18nV2()
      const out = await rollbackTranslation('k', 'en-US', 1)
      expect(out).toBeNull()
      expect(state.error).toBe('rb')
    })
  })

  describe('批量操作 (P12-3)', () => {
    it('batchDelete 传递 keys 与 actor', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { deleted: 2, not_found: ['x'] } } })
      const { batchDelete } = useI18nV2()
      const out = await batchDelete(['k1', 'k2'], 'admin')
      const call = (http.post as any).mock.calls[0]
      expect(call[0]).toBe('/api/v1/i18n-v2/batch/delete')
      expect(call[1].keys).toEqual(['k1', 'k2'])
      expect(call[1].actor).toBe('admin')
      expect(out?.deleted).toBe(2)
    })

    it('batchDelete 失败返回 null', async () => {
      ;(http.post as any).mockRejectedValue(new Error('bd'))
      const { batchDelete, state } = useI18nV2()
      const out = await batchDelete(['k'])
      expect(out).toBeNull()
      expect(state.error).toBe('bd')
    })

    it('batchSetStatus 默认 actor', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { updated: 1, skipped: [] } } })
      const { batchSetStatus } = useI18nV2()
      const out = await batchSetStatus(['k1'], 'en-US', 'approved')
      const call = (http.post as any).mock.calls[0]
      expect(call[0]).toBe('/api/v1/i18n-v2/batch/status')
      expect(call[1].actor).toBe('batch')
      expect(out?.updated).toBe(1)
    })

    it('batchSetStatus 失败返回 null', async () => {
      ;(http.post as any).mockRejectedValue(new Error('bs'))
      const { batchSetStatus, state } = useI18nV2()
      const out = await batchSetStatus(['k'], 'en-US', 'approved')
      expect(out).toBeNull()
      expect(state.error).toBe('bs')
    })

    it('batchPush 推送 items 列表', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: { pushed: 2, failed: [] } } })
      const { batchPush } = useI18nV2()
      const out = await batchPush([{ key: 'k1', lang: 'en-US', value: 'v1' }], 'admin')
      const call = (http.post as any).mock.calls[0]
      expect(call[0]).toBe('/api/v1/i18n-v2/batch/push')
      expect(call[1].items).toEqual([{ key: 'k1', lang: 'en-US', value: 'v1' }])
      expect(call[1].actor).toBe('admin')
      expect(out?.pushed).toBe(2)
    })

    it('batchPush 失败返回 null', async () => {
      ;(http.post as any).mockRejectedValue(new Error('bp'))
      const { batchPush, state } = useI18nV2()
      const out = await batchPush([{ key: 'k', lang: 'en-US', value: 'v' }])
      expect(out).toBeNull()
      expect(state.error).toBe('bp')
    })
  })

  describe('健康度与 V1 退役 (P12-5 / P12-7)', () => {
    it('fetchHealth 返回健康度', async () => {
      ;(http.get as any).mockResolvedValue({
        data: {
          code: 0, msg: 'ok',
          data: { total_keys: 100, languages: 9, per_lang: { 'zh-CN': 90 }, overall_coverage: 0.9, pending_mt: 2, stale_keys: 1, health_score: 88, mt_penalty: 5, stale_penalty: 7 },
        },
      })
      const { fetchHealth } = useI18nV2()
      const out = await fetchHealth()
      expect(out?.health_score).toBe(88)
      expect(out?.total_keys).toBe(100)
    })

    it('fetchHealth 失败返回 null', async () => {
      ;(http.get as any).mockRejectedValue(new Error('hh'))
      const { fetchHealth, state } = useI18nV2()
      const out = await fetchHealth()
      expect(out).toBeNull()
      expect(state.error).toBe('hh')
    })

    it('fetchV1RetirementStats 返回 V1 退役统计', async () => {
      ;(http.get as any).mockResolvedValue({
        data: {
          code: 0, msg: 'ok',
          data: { total_hits: 5, unique_paths: 2, top_paths: [{ path: '/old', hits: 3 }], last_hit_ts: 1700000000 },
        },
      })
      const { fetchV1RetirementStats } = useI18nV2()
      const out = await fetchV1RetirementStats()
      expect(out?.total_hits).toBe(5)
      expect(out?.top_paths[0].path).toBe('/old')
      expect(out?.last_hit_ts).toBe(1700000000)
    })

    it('fetchV1RetirementStats 支持 last_hit_ts 为 null', async () => {
      ;(http.get as any).mockResolvedValue({
        data: { code: 0, msg: 'ok', data: { total_hits: 0, unique_paths: 0, top_paths: [], last_hit_ts: null } },
      })
      const { fetchV1RetirementStats } = useI18nV2()
      const out = await fetchV1RetirementStats()
      expect(out?.last_hit_ts).toBeNull()
    })

    it('fetchV1RetirementStats 失败返回 null', async () => {
      ;(http.get as any).mockRejectedValue(new Error('v1'))
      const { fetchV1RetirementStats, state } = useI18nV2()
      const out = await fetchV1RetirementStats()
      expect(out).toBeNull()
      expect(state.error).toBe('v1')
    })

    it('响应 data 缺失时回退到 null', async () => {
      ;(http.get as any).mockResolvedValue({ data: null })
      const { fetchV1RetirementStats } = useI18nV2()
      const out = await fetchV1RetirementStats()
      expect(out).toBeNull()
    })

    it('rollbackTranslation 响应 data 为 null 时返回 null', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: null } })
      const { rollbackTranslation } = useI18nV2()
      const out = await rollbackTranslation('k', 'en-US', 1)
      expect(out).toBeNull()
    })

    it('batchDelete 响应 data 为 null 时返回 null', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: null } })
      const { batchDelete } = useI18nV2()
      const out = await batchDelete(['k'])
      expect(out).toBeNull()
    })

    it('batchSetStatus 响应 data 为 null 时返回 null', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: null } })
      const { batchSetStatus } = useI18nV2()
      const out = await batchSetStatus(['k'], 'en-US', 'approved')
      expect(out).toBeNull()
    })

    it('batchPush 响应 data 为 null 时返回 null', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: null } })
      const { batchPush } = useI18nV2()
      const out = await batchPush([{ key: 'k', lang: 'en-US', value: 'v' }])
      expect(out).toBeNull()
    })

    it('listMtProviders 响应 data 为 null 时返回 null', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: null } })
      const { listMtProviders } = useI18nV2()
      const out = await listMtProviders()
      expect(out).toBeNull()
    })

    it('fetchHealth 响应 data 为 null 时返回 null', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: null } })
      const { fetchHealth } = useI18nV2()
      const out = await fetchHealth()
      expect(out).toBeNull()
    })

    it('exportTranslations 响应 data 为 null 时返回 null', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: null } })
      const { exportTranslations } = useI18nV2()
      const out = await exportTranslations()
      expect(out).toBeNull()
    })

    it('importTranslations 响应 data 为 null 时返回 null', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: null } })
      const { importTranslations } = useI18nV2()
      const out = await importTranslations('x')
      expect(out).toBeNull()
    })

    it('fetchHistory 响应 data 为 null 时返回空数组', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: null } })
      const { fetchHistory } = useI18nV2()
      const out = await fetchHistory('k', 'en-US')
      expect(out).toEqual([])
    })

    it('diffLanguages 响应 data 为 null 时返回 null', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: null } })
      const { diffLanguages } = useI18nV2()
      const out = await diffLanguages('zh-CN', 'en-US')
      expect(out).toBeNull()
    })

    it('fetchStats 响应 data 为 null 时返回 null', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: null } })
      const { fetchStats } = useI18nV2()
      const out = await fetchStats()
      expect(out).toBeNull()
    })

    it('fetchTmStats 响应 data 为 null 时返回 null', async () => {
      ;(http.get as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: null } })
      const { fetchTmStats } = useI18nV2()
      const out = await fetchTmStats()
      expect(out).toBeNull()
    })

    it('formatByKind 响应 data.result 缺失时返回 null', async () => {
      ;(http.post as any).mockResolvedValue({ data: { code: 0, msg: 'ok', data: {} } })
      const { formatByKind } = useI18nV2()
      const out = await formatByKind({ kind: 'number', value: 1 })
      expect(out).toBeNull()
    })
  })
})
