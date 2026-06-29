// useI18nV2 - 国际化深化 composable (P10 阶段)
// 提供: 9 语言元数据、复数翻译、数字/货币/日期格式化、多语言同步
// 与后端 /api/v1/i18n-v2/* 配套
//
// HTTP 响应用 unknown 表示, 每个 res 立即通过 as TypeName 转为具体类型

import { computed, reactive, ref } from 'vue'
import http from '@/utils/request'

// 后端统一包装: {code, msg, data: {...}}, axios 拦截器不拆 data, 这里手动取 data.data
// 用 unknown 索引签名让 data.data?.xxx 可访问 (具体类型用 as TypeName 转换)
type HttpEnvelope = { data?: { data?: { [k: string]: unknown } } }

// 从 HTTP 响应中提取 data.data 并断言为具体类型 T
const extractData = <T>(res: HttpEnvelope): T | null => (res.data?.data ?? null) as T | null

export interface LanguageMeta {
  code: string
  display_name: string
  english_name: string
  direction: 'ltr' | 'rtl'
  is_rtl: boolean
  decimal_separator: string
  thousands_separator: string
  currency_position: 'before' | 'after'
  first_day_of_week: number
  plural_rule: string
  number_grouping: number
}

export interface TranslationEntry {
  key: string
  translations: Record<string, string>
  plurals: Record<string, Record<string, string>>
  description: string
  updated_at: number
  version: number
}

export interface SyncEvent {
  event_id: string
  ts: number
  actor: string
  kind: string
  key: string | null
  language: string | null
  note: string
}

export interface PluralSample {
  count: number
  category: string
  text: string
}

export interface TmMatch {
  key: string
  lang: string
  text: string
  similarity: number
}

export interface MTResult {
  key: string
  source_lang: string
  target_lang: string
  source_text: string
  translated_text: string
  provider: string
  confidence: number
  status: string
}

export interface MTProvider {
  id: string
  name: string
  available: boolean
  description: string
}

export interface TranslationVersion {
  version: number
  value: string
  actor: string
  ts: number
  note: string
}

export interface HealthStat {
  total_keys: number
  languages: number
  per_lang: Record<string, number>
  overall_coverage: number
  pending_mt: number
  stale_keys: number
  health_score: number
  mt_penalty: number
  stale_penalty: number
}

export interface V1RetirementStats {
  total_hits: number
  unique_paths: number
  top_paths: Array<{ path: string; hits: number }>
  last_hit_ts: number | null
}

export interface I18nV2State {
  languages: LanguageMeta[]
  currentLang: string
  keys: string[]
  entries: Record<string, TranslationEntry>
  syncLog: SyncEvent[]
  loading: boolean
  error: string | null
}

const STORAGE_KEY = 'i18n_v2.lang'

// 同步 RTL 状态到 document.dir (供全局样式使用)
const applyDocumentDir = (lang: string, languages: LanguageMeta[]) => {
  if (typeof document === 'undefined') return
  const meta = languages.find(l => l.code === lang)
  const dir = meta?.is_rtl ? 'rtl' : 'ltr'
  document.documentElement.setAttribute('dir', dir)
  document.documentElement.setAttribute('lang', lang)
}

const state = reactive<I18nV2State>({
  languages: [],
  currentLang: 'zh-CN',
  keys: [],
  entries: {},
  syncLog: [],
  loading: false,
  error: null,
})

const setError = (e: unknown) => {
  state.error = e instanceof Error ? e.message : String(e)
}

export function useI18nV2() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  const syncLocal = (lang: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* localStorage 不可用 */
    }
  }

  const fetchLanguages = async (): Promise<LanguageMeta[]> => {
    state.loading = true
    loading.value = true
    try {
      const res: HttpEnvelope = await http.get('/api/v1/i18n-v2/languages')
      // 后端统一包装: {code, msg, data: {count, languages}}
      // axios 拦截器不拆 data, 这里手动取 data.data
      state.languages = (res.data?.data?.languages || []) as LanguageMeta[]
      // 恢复语言
      let stored: string | null = null
      try {
        stored = localStorage.getItem(STORAGE_KEY)
      } catch {
        /* ignore */
      }
      if (stored && state.languages.some(l => l.code === stored)) {
        state.currentLang = stored
      } else if (state.languages.length && !state.languages.some(l => l.code === state.currentLang)) {
        state.currentLang = state.languages[0].code
      }
      applyDocumentDir(state.currentLang, state.languages)
      return state.languages
    } catch (e) {
      setError(e)
      return []
    } finally {
      state.loading = false
      loading.value = false
    }
  }

  const setCurrentLang = (lang: string) => {
    state.currentLang = lang
    syncLocal(lang)
    applyDocumentDir(lang, state.languages)
  }

  const fetchKeys = async (): Promise<string[]> => {
    state.loading = true
    loading.value = true
    try {
      const res: HttpEnvelope = await http.get('/api/v1/i18n-v2/keys')
      state.keys = (res.data?.data?.keys || []) as string[]
      return state.keys
    } catch (e) {
      setError(e)
      return []
    } finally {
      state.loading = false
      loading.value = false
    }
  }

  const fetchEntry = async (key: string): Promise<TranslationEntry | null> => {
    state.loading = true
    loading.value = true
    try {
      const res: HttpEnvelope = await http.get(`/api/v1/i18n-v2/entry/${encodeURIComponent(key)}`)
      const entry = (res.data?.data || null) as TranslationEntry | null
      if (entry && entry.key) state.entries[key] = entry
      return entry
    } catch (e) {
      setError(e)
      return null
    } finally {
      state.loading = false
      loading.value = false
    }
  }

  const pullTranslations = async (
    lang?: string,
    since?: number,
  ): Promise<Record<string, string>> => {
    state.loading = true
    loading.value = true
    try {
      const params: Record<string, string | number> = {}
      if (lang) params.lang = lang
      if (since) params.since = since
      const res: HttpEnvelope = await http.get('/api/v1/i18n-v2/pull', { params })
      return (res.data?.data?.keys || {}) as Record<string, string>
    } catch (e) {
      setError(e)
      return {}
    } finally {
      state.loading = false
      loading.value = false
    }
  }

  const pushTranslation = async (
    key: string,
    lang: string,
    value: string,
    actor = 'console',
  ): Promise<TranslationEntry | null> => {
    state.loading = true
    loading.value = true
    try {
      const res: HttpEnvelope = await http.post('/api/v1/i18n-v2/push', {
        key,
        lang,
        value,
        actor,
        description: '',
      })
      const entry = (res.data?.data || null) as TranslationEntry | null
      if (entry && entry.key) state.entries[entry.key] = entry
      return entry
    } catch (e) {
      setError(e)
      return null
    } finally {
      state.loading = false
      loading.value = false
    }
  }

  const pushPlural = async (
    key: string,
    lang: string,
    forms: Record<string, string>,
    actor = 'console',
  ): Promise<TranslationEntry | null> => {
    state.loading = true
    loading.value = true
    try {
      const res: HttpEnvelope = await http.post('/api/v1/i18n-v2/push-plural', {
        key,
        lang,
        forms,
        actor,
      })
      const entry = (res.data?.data || null) as TranslationEntry | null
      if (entry && entry.key) state.entries[entry.key] = entry
      return entry
    } catch (e) {
      setError(e)
      return null
    } finally {
      state.loading = false
      loading.value = false
    }
  }

  const diffLanguages = async (
    langA: string,
    langB: string,
  ): Promise<{
    lang_a: string
    lang_b: string
    a_missing: string[]
    b_missing: string[]
    identical: { key: string; a: string; b: string }[]
    total: number
  } | null> => {
    state.loading = true
    loading.value = true
    try {
      const res: HttpEnvelope = await http.get('/api/v1/i18n-v2/diff', {
        params: { lang_a: langA, lang_b: langB },
      })
      return extractData<{ lang_a: string; lang_b: string; a_missing: string[]; b_missing: string[]; identical: { key: string; a: string; b: string }[]; total: number }>(res)
    } catch (e) {
      setError(e)
      return null
    } finally {
      state.loading = false
      loading.value = false
    }
  }

  const fetchSyncLog = async (limit = 100): Promise<SyncEvent[]> => {
    state.loading = true
    loading.value = true
    try {
      const res: HttpEnvelope = await http.get('/api/v1/i18n-v2/sync-log', { params: { limit } })
      state.syncLog = (res.data?.data?.events || []) as SyncEvent[]
      return state.syncLog
    } catch (e) {
      setError(e)
      return []
    } finally {
      state.loading = false
      loading.value = false
    }
  }

  const fetchStats = async (): Promise<{
    total_keys: number
    per_language: Record<string, number>
    plural_keys: number
    languages: number
  } | null> => {
    state.loading = true
    loading.value = true
    try {
      const res: HttpEnvelope = await http.get('/api/v1/i18n-v2/stats')
      return extractData<{ total_keys: number; per_language: Record<string, number>; plural_keys: number; languages: number }>(res)
    } catch (e) {
      setError(e)
      return null
    } finally {
      state.loading = false
      loading.value = false
    }
  }

  const formatByKind = async (params: {
    kind: 'number' | 'currency' | 'date' | 'plural'
    value?: number | string
    lang?: string
    decimals?: number
    currency?: string
    fmt?: string
    count?: number
    key?: string
  }): Promise<string | null> => {
    state.loading = true
    loading.value = true
    try {
      const res: HttpEnvelope = await http.post('/api/v1/i18n-v2/format', {
        lang: state.currentLang,
        decimals: 2,
        currency: 'USD',
        fmt: 'long',
        ...params,
      })
      return (res.data?.data?.result ?? null) as string | null
    } catch (e) {
      setError(e)
      return null
    } finally {
      state.loading = false
      loading.value = false
    }
  }

  const translate = async (
    key: string,
    count?: number,
    params: Record<string, unknown> = {},
  ): Promise<{ text: string; is_rtl: boolean } | null> => {
    state.loading = true
    loading.value = true
    try {
      const res: HttpEnvelope = await http.post('/api/v1/i18n-v2/translate', {
        key,
        lang: state.currentLang,
        count: count ?? null,
        params,
      })
      return extractData<{ text: string; is_rtl: boolean }>(res)
    } catch (e) {
      setError(e)
      return null
    } finally {
      state.loading = false
      loading.value = false
    }
  }

  const pluralExamples = async (
    key: string,
    lang: string,
    samples = '0,1,2,3,5,11,21,100,101',
  ): Promise<PluralSample[] | null> => {
    state.loading = true
    loading.value = true
    try {
      const res: HttpEnvelope = await http.get(`/api/v1/i18n-v2/plural/${encodeURIComponent(key)}`, {
        params: { lang, samples },
      })
      return ((res.data?.data as { samples?: PluralSample[] })?.samples || []) as PluralSample[]
    } catch (e) {
      setError(e)
      return null
    } finally {
      state.loading = false
      loading.value = false
    }
  }

  // 计算属性: 当前语言元数据
  const currentMeta = computed<LanguageMeta | null>(() => {
    return state.languages.find(l => l.code === state.currentLang) || null
  })

  // 计算属性: 是否 RTL
  const isCurrentRtl = computed<boolean>(() => currentMeta.value?.is_rtl ?? false)

  // 相对时间 (本地化简化版)
  const formatRelative = (value: Date | number | string, lang = state.currentLang): string => {
    const date = value instanceof Date ? value : new Date(value)
    const diff = (Date.now() - date.getTime()) / 1000
    const absDiff = Math.abs(diff)
    const isPast = diff >= 0
    const phrases: Record<string, { just: string; seconds: string; minutes: string; hours: string; days: string; future: string; past: string }> = {
      'zh-CN': { just: '刚刚', seconds: '{n} 秒', minutes: '{n} 分钟', hours: '{n} 小时', days: '{n} 天', future: '{n}后', past: '{n}前' },
      'zh-TW': { just: '剛剛', seconds: '{n} 秒', minutes: '{n} 分鐘', hours: '{n} 小時', days: '{n} 天', future: '{n}後', past: '{n}前' },
      'en-US': { just: 'just now', seconds: '{n} sec', minutes: '{n} min', hours: '{n} hr', days: '{n} d', future: 'in {n}', past: '{n} ago' },
      ja: { just: '今', seconds: '{n} 秒', minutes: '{n} 分', hours: '{n} 時間', days: '{n} 日', future: '{n}後', past: '{n}前' },
      ko: { just: '방금', seconds: '{n}초', minutes: '{n}분', hours: '{n}시간', days: '{n}일', future: '{n} 후', past: '{n} 전' },
      ar: { just: 'الآن', seconds: '{n} ث', minutes: '{n} د', hours: '{n} س', days: '{n} ي', future: 'خلال {n}', past: 'منذ {n}' },
      he: { just: 'עכשיו', seconds: '{n} שניות', minutes: '{n} דקות', hours: '{n} שעות', days: '{n} ימים', future: 'בעוד {n}', past: 'לפני {n}' },
      fr: { just: "à l'instant", seconds: '{n} s', minutes: '{n} min', hours: '{n} h', days: '{n} j', future: 'dans {n}', past: 'il y a {n}' },
      es: { just: 'ahora', seconds: '{n} s', minutes: '{n} min', hours: '{n} h', days: '{n} d', future: 'en {n}', past: 'hace {n}' },
    }
    const p = phrases[lang] || phrases['en-US']
    if (absDiff < 5) return p.just
    let n = 0
    let unit = ''
    if (absDiff < 60) {
      n = Math.floor(absDiff)
      unit = p.seconds.replace('{n}', String(n))
    } else if (absDiff < 3600) {
      n = Math.floor(absDiff / 60)
      unit = p.minutes.replace('{n}', String(n))
    } else if (absDiff < 86400) {
      n = Math.floor(absDiff / 3600)
      unit = p.hours.replace('{n}', String(n))
    } else {
      n = Math.floor(absDiff / 86400)
      unit = p.days.replace('{n}', String(n))
    }
    return isPast ? p.past.replace('{n}', unit) : p.future.replace('{n}', unit)
  }

  const searchTm = async (
    sourceText: string,
    lang = '',
    threshold = 0.3,
    limit = 10,
  ): Promise<TmMatch[]> => {
    try {
      const res: HttpEnvelope = await http.post('/api/v1/i18n-v2/tm/search', {
        source_text: sourceText,
        lang,
        threshold,
        limit,
      })
      return ((res.data?.data as { matches?: TmMatch[] })?.matches || []) as TmMatch[]
    } catch (e) {
      setError(e)
      return []
    }
  }

  const fetchTmStats = async (): Promise<Record<string, number> | null> => {
    try {
      const res: HttpEnvelope = await http.get('/api/v1/i18n-v2/tm/stats')
      return (res.data?.data || null) as Record<string, number> | null
    } catch (e) {
      setError(e)
      return null
    }
  }

  const machineTranslate = async (
    key: string,
    sourceLang: string,
    targetLang: string,
    sourceText: string,
  ): Promise<MTResult | null> => {
    try {
      const res: HttpEnvelope = await http.post('/api/v1/i18n-v2/mt/translate', {
        key,
        source_lang: sourceLang,
        target_lang: targetLang,
        source_text: sourceText,
      })
      return (res.data?.data || null) as MTResult | null
    } catch (e) {
      setError(e)
      return null
    }
  }

  const reviewMt = async (
    key: string,
    targetLang: string,
    action: string,
    reviewedText = '',
    actor = 'reviewer',
  ): Promise<MTResult | null> => {
    try {
      const res: HttpEnvelope = await http.post('/api/v1/i18n-v2/mt/review', {
        key,
        target_lang: targetLang,
        action,
        reviewed_text: reviewedText,
        actor,
      })
      return (res.data?.data || null) as MTResult | null
    } catch (e) {
      setError(e)
      return null
    }
  }

  const fetchMtQueue = async (status = ''): Promise<MTResult[]> => {
    try {
      const res: HttpEnvelope = await http.get('/api/v1/i18n-v2/mt/queue', { params: { status } })
      return ((res.data?.data as { items?: MTResult[] })?.items || []) as MTResult[]
    } catch (e) {
      setError(e)
      return []
    }
  }

  // 按需懒加载语言包: 仅拉取指定语言的翻译, 缓存到 state.entries
  const _loadedLangs = new Set<string>()

  const loadLangPack = async (lang: string): Promise<Record<string, string>> => {
    const normalized = lang || state.currentLang
    if (_loadedLangs.has(normalized)) {
      // 已缓存: 从 state.entries 中提取
      const result: Record<string, string> = {}
      for (const [key, entry] of Object.entries(state.entries)) {
        if (entry.translations[normalized]) {
          result[key] = entry.translations[normalized]
        }
      }
      return result
    }
    try {
      const res: HttpEnvelope = await http.get('/api/v1/i18n-v2/pull', { params: { lang: normalized } })
      const data = res.data?.data as { keys?: Record<string, string> } | undefined
      const keys = (data?.keys || {}) as Record<string, string>
      // 缓存到 state.entries
      for (const [k, v] of Object.entries(keys)) {
        if (!state.entries[k]) {
          state.entries[k] = {
            key: k,
            translations: { [normalized]: v },
            plurals: {},
            description: '',
            updated_at: 0,
            version: 0,
          }
        } else {
          state.entries[k].translations[normalized] = v
        }
      }
      _loadedLangs.add(normalized)
      return keys
    } catch (e) {
      setError(e)
      return {}
    }
  }

  const clearLangCache = () => {
    _loadedLangs.clear()
  }

  // ============================================================
  // P12-1: 导出 / 导入
  // ============================================================

  const exportTranslations = async (
    lang = '',
    fmt: 'csv' | 'xliff' = 'csv',
  ): Promise<{ format: string; content: string; count: number } | null> => {
    try {
      const res: HttpEnvelope = await http.get('/api/v1/i18n-v2/export', { params: { lang, fmt } })
      return extractData<{ format: string; content: string; count: number }>(res)
    } catch (e) {
      setError(e)
      return null
    }
  }

  const importTranslations = async (
    content: string,
    fmt: 'csv' | 'xliff' = 'csv',
    conflict: 'overwrite' | 'skip' = 'overwrite',
    actor = 'importer',
  ): Promise<{ imported: number; skipped: number; errors: string[] } | null> => {
    try {
      const res: HttpEnvelope = await http.post('/api/v1/i18n-v2/import', {
        content, fmt, conflict, actor,
      })
      return extractData<{ imported: number; skipped: number; errors: string[] }>(res)
    } catch (e) {
      setError(e)
      return null
    }
  }

  // ============================================================
  // P12-2: 版本历史 / 回滚
  // ============================================================

  const fetchHistory = async (key: string, lang: string): Promise<TranslationVersion[]> => {
    try {
      const res: HttpEnvelope = await http.get(`/api/v1/i18n-v2/entry/${encodeURIComponent(key)}/history`, {
        params: { lang },
      })
      return ((res.data?.data as { versions?: TranslationVersion[] })?.versions || []) as TranslationVersion[]
    } catch (e) {
      setError(e)
      return []
    }
  }

  const rollbackTranslation = async (
    key: string,
    lang: string,
    version: number,
    actor = 'rollback',
  ): Promise<{ ok: boolean; version: number; value: string } | null> => {
    try {
      const res: HttpEnvelope = await http.post('/api/v1/i18n-v2/rollback', {
        key, lang, version, actor,
      })
      return extractData<{ ok: boolean; version: number; value: string }>(res)
    } catch (e) {
      setError(e)
      return null
    }
  }

  // ============================================================
  // P12-3: 批量操作
  // ============================================================

  const batchDelete = async (
    keys: string[],
    actor = 'batch',
  ): Promise<{ deleted: number; not_found: string[] } | null> => {
    try {
      const res: HttpEnvelope = await http.post('/api/v1/i18n-v2/batch/delete', { keys, actor })
      return extractData<{ deleted: number; not_found: string[] }>(res)
    } catch (e) {
      setError(e)
      return null
    }
  }

  const batchSetStatus = async (
    keys: string[],
    lang: string,
    status: string,
    actor = 'batch',
  ): Promise<{ updated: number; skipped: string[] } | null> => {
    try {
      const res: HttpEnvelope = await http.post('/api/v1/i18n-v2/batch/status', {
        keys, lang, status, actor,
      })
      return extractData<{ updated: number; skipped: string[] }>(res)
    } catch (e) {
      setError(e)
      return null
    }
  }

  const batchPush = async (
    items: Array<{ key: string; lang: string; value: string }>,
    actor = 'batch',
  ): Promise<{ pushed: number; failed: string[] } | null> => {
    try {
      const res: HttpEnvelope = await http.post('/api/v1/i18n-v2/batch/push', { items, actor })
      return extractData<{ pushed: number; failed: string[] }>(res)
    } catch (e) {
      setError(e)
      return null
    }
  }

  // ============================================================
  // P12-4: MT Provider
  // ============================================================

  const listMtProviders = async (): Promise<{
    providers: MTProvider[]
    current: string
    count: number
  } | null> => {
    try {
      const res: HttpEnvelope = await http.get('/api/v1/i18n-v2/mt/providers')
      return extractData<{ providers: MTProvider[]; current: string; count: number }>(res)
    } catch (e) {
      setError(e)
      return null
    }
  }

  // ============================================================
  // P12-5: 健康度
  // ============================================================

  const fetchHealth = async (): Promise<HealthStat | null> => {
    try {
      const res: HttpEnvelope = await http.get('/api/v1/i18n-v2/health')
      return (res.data?.data || null) as HealthStat | null
    } catch (e) {
      setError(e)
      return null
    }
  }

  // ============================================================
  // P12-7: V1 退役监控
  // ============================================================

  const fetchV1RetirementStats = async (): Promise<V1RetirementStats | null> => {
    try {
      const res: HttpEnvelope = await http.get('/api/v1/i18n-v2/v1-retirement-stats')
      return (res.data?.data || null) as V1RetirementStats | null
    } catch (e) {
      setError(e)
      return null
    }
  }

  return {
    state,
    loading,
    error,
    currentMeta,
    isCurrentRtl,
    fetchLanguages,
    setCurrentLang,
    fetchKeys,
    fetchEntry,
    pullTranslations,
    pushTranslation,
    pushPlural,
    diffLanguages,
    fetchSyncLog,
    fetchStats,
    formatByKind,
    translate,
    pluralExamples,
    formatRelative,
    searchTm,
    fetchTmStats,
    machineTranslate,
    reviewMt,
    fetchMtQueue,
    loadLangPack,
    clearLangCache,
    // P12
    exportTranslations,
    importTranslations,
    fetchHistory,
    rollbackTranslation,
    batchDelete,
    batchSetStatus,
    batchPush,
    listMtProviders,
    fetchHealth,
    fetchV1RetirementStats,
  }
}
