<template>
  <div class="i18n-dashboard" :dir="isRtl ? 'rtl' : 'ltr'" role="main" aria-labelledby="i18n-title">
    <!-- 标题 -->
    <header class="i18n-header scroll-reveal" data-animation="fadeInUp">
      <div class="i18n-header-text">
        <h1 id="i18n-title" class="i18n-title">{{ t('i18nDashboard.title') }}</h1>
        <p class="i18n-subtitle">{{ t('i18nDashboard.subtitle') }}</p>
      </div>
      <div class="i18n-stats" role="status" aria-live="polite">
        <span class="i18n-stat-num">{{ I18N_LANGUAGES.length }}</span>
        <span class="i18n-stat-label">{{ t('i18nDashboard.statLabel', { langs: I18N_LANGUAGES.length }) }}</span>
      </div>
    </header>

    <!-- 语言切换 -->
    <section class="i18n-section scroll-reveal" data-animation="fadeInUp" aria-labelledby="i18n-switcher-title">
      <h2 id="i18n-switcher-title" class="i18n-section-title">{{ t('i18nDashboard.languageSwitcher') }}</h2>
      <div class="i18n-grid">
        <LanguageSwitcher v-model="currentLang" @change="onLangChange" />
      </div>
    </section>

    <!-- 5 语言元数据表 (2026-06-26: 改 9 种为 5 种) -->
    <section class="i18n-section scroll-reveal" data-animation="fadeInUp" aria-labelledby="i18n-meta-title">
      <h2 id="i18n-meta-title" class="i18n-section-title">{{ t('i18nDashboard.metaTitle') }}</h2>
      <div class="i18n-table-wrap">
        <table class="i18n-table" :aria-label="t('i18nDashboard.metaTableAria', { langs: I18N_LANGUAGES.length })">
          <thead>
            <tr>
              <th scope="col">{{ t('i18nDashboard.colCode') }}</th>
              <th scope="col">{{ t('i18nDashboard.colLocalName') }}</th>
              <th scope="col">{{ t('i18nDashboard.colEnglishName') }}</th>
              <th scope="col">{{ t('i18nDashboard.colDirection') }}</th>
              <th scope="col">{{ t('i18nDashboard.colPluralRule') }}</th>
              <th scope="col">{{ t('i18nDashboard.colSeparator') }}</th>
              <th scope="col">{{ t('i18nDashboard.colCurrency') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in I18N_LANGUAGES" :key="m.code" :class="{ active: m.code === currentLang }">
              <td><code class="i18n-code">{{ m.code }}</code></td>
              <td>{{ m.display_name }}</td>
              <td>{{ m.english_name }}</td>
              <td>
                <span :class="['i18n-tag', { rtl: m.is_rtl }]">{{ m.is_rtl ? 'RTL' : 'LTR' }}</span>
              </td>
              <td><code class="i18n-code">{{ m.plural_rule }}</code></td>
              <td><span class="i18n-num">{{ m.decimal_separator }} / {{ m.thousands_separator }}</span></td>
              <td>{{ m.currency_position === 'before' ? t('i18nDashboard.prefix') : t('i18nDashboard.suffix') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 复数示例 (CLDR) -->
    <section class="i18n-section scroll-reveal" data-animation="fadeInUp" aria-labelledby="i18n-plural-title">
      <h2 id="i18n-plural-title" class="i18n-section-title">{{ t('i18nDashboard.pluralPreview') }}</h2>
      <p class="i18n-hint">{{ t('i18nDashboard.pluralHint', { key: currentLang }) }}</p>
      <div class="i18n-plural-grid">
        <div v-for="s in pluralSamples" :key="s.count" class="i18n-plural-card">
          <span class="i18n-plural-count">{{ s.count }}</span>
          <span class="i18n-plural-cat">{{ s.category }}</span>
          <span class="i18n-plural-text">{{ s.text }}</span>
        </div>
      </div>
    </section>

    <!-- 格式化工具 (Intl + 静态相对时间) -->
    <section class="i18n-section scroll-reveal" data-animation="fadeInUp" aria-labelledby="i18n-format-title">
      <h2 id="i18n-format-title" class="i18n-section-title">{{ t('i18nDashboard.formatPreview') }}</h2>
      <div class="i18n-format-grid">
        <div class="i18n-format-card">
          <span class="i18n-format-label">{{ t('i18nDashboard.formatNumber') }}</span>
          <span class="i18n-format-val" data-num>{{ formatNumberPreview }}</span>
        </div>
        <div class="i18n-format-card">
          <span class="i18n-format-label">{{ t('i18nDashboard.formatCurrency') }}</span>
          <span class="i18n-format-val" data-num>{{ formatCurrencyPreview }}</span>
        </div>
        <div class="i18n-format-card">
          <span class="i18n-format-label">{{ t('i18nDashboard.formatDate') }}</span>
          <span class="i18n-format-val">{{ formatDatePreview }}</span>
        </div>
        <div class="i18n-format-card">
          <span class="i18n-format-label">{{ t('i18nDashboard.formatRelative') }}</span>
          <span class="i18n-format-val">{{ formatRelativePreview }}</span>
        </div>
      </div>
    </section>

    <!-- 差异对比 (V1 静态翻译跨语言对比) -->
    <section class="i18n-section scroll-reveal" data-animation="fadeInUp" aria-labelledby="i18n-diff-title">
      <h2 id="i18n-diff-title" class="i18n-section-title">{{ t('i18nDashboard.diffTitle') }}</h2>
      <div class="i18n-diff-controls">
        <label for="i18n-diff-a" class="i18n-label">{{ t('i18nDashboard.diffLangA') }}</label>
        <select id="i18n-diff-a" v-model="diffA" class="i18n-select">
          <option v-for="m in I18N_LANGUAGES" :key="m.code" :value="m.code">{{ m.code }} · {{ m.english_name }}</option>
        </select>
        <button
          type="button"
          class="i18n-btn ghost ripple-btn"
          :title="t('i18nDashboard.diffAutoPickBtn')"
          @click="onAutoPickBase"
        >
          <span aria-hidden="true">★</span>
          {{ t('i18nDashboard.diffAutoPickBtn') }}
        </button>
        <button
          type="button"
          class="i18n-btn ghost ripple-btn"
          :title="t('i18nDashboard.diffResetCacheBtn')"
          @click="onResetCachedBase"
        >
          <span aria-hidden="true">↻</span>
          {{ t('i18nDashboard.diffResetCacheBtn') }}
        </button>
        <span v-if="baseHint" class="i18n-diff-base-hint">{{ baseHint }}</span>
        <span class="i18n-diff-vs">vs</span>
        <label for="i18n-diff-b" class="i18n-label">{{ t('i18nDashboard.diffLangB') }}</label>
        <select id="i18n-diff-b" v-model="diffB" class="i18n-select">
          <option v-for="m in I18N_LANGUAGES" :key="m.code" :value="m.code">{{ m.code }} · {{ m.english_name }}</option>
        </select>
        <button type="button" class="i18n-btn primary ripple-btn" @click="onDiff">{{ t('i18nDashboard.diffBtn') }}</button>
      </div>
      <div v-if="diffResult" class="i18n-diff-summary">
        <p class="i18n-diff-stat">
          <span class="i18n-stat-num">{{ diffResult.a_missing.length }}</span>
          <span class="i18n-stat-label">{{ t('i18nDashboard.diffAMissing') }}</span>
        </p>
        <p class="i18n-diff-stat">
          <span class="i18n-stat-num">{{ diffResult.b_missing.length }}</span>
          <span class="i18n-stat-label">{{ t('i18nDashboard.diffBMissing') }}</span>
        </p>
        <p class="i18n-diff-stat">
          <span class="i18n-stat-num">{{ diffResult.identical.length }}</span>
          <span class="i18n-stat-label">{{ t('i18nDashboard.diffIdentical') }}</span>
        </p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// I18nDashboard - V3 静态精简版 (2026-06-26)
// - 9 语言元数据精简为 5 语言 (zh-CN, zh-TW, en, ja, ko), 与实际支持语言一致
// - 移除翻译记忆库 (TM) section: 用户不接入第三方翻译 API, 不做花钱翻译
// - 移除同步日志 section: 翻译工作流相关, 同步取消
// - 移除机器翻译 (MT) section, 因不接入第三方翻译 API
// 数据源全部前端静态, 任何时候（无网络/无后端）都好使
// 5 语言元数据: constants/i18nLanguages.ts
// 相对时间: utils/i18nRelative.ts
// 复数规则: Intl.PluralRules
// 数字/货币/日期: Intl.NumberFormat / Intl.DateTimeFormat
// 跨语言差异对比: vue-i18n messages 直接遍历

import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import LanguageSwitcher from '@/components/i18n/LanguageSwitcher.vue'
import { I18N_LANGUAGES, getLanguageMeta } from '@/constants/i18nLanguages'
import { formatRelative } from '@/utils/i18nRelative'
import i18n from '@/locales'

const { t, locale } = useI18n()

const currentLang = ref<string>(typeof locale.value === 'string' ? locale.value : 'zh-CN')
const isRtl = computed<boolean>(() => getLanguageMeta(currentLang.value)?.is_rtl ?? false)

const onLangChange = (code: string) => {
  currentLang.value = code
}

// 应用 document.dir / document.lang
watch(currentLang, (lang) => {
  if (typeof document === 'undefined') return
  // 2026-06-24 修正：vue watch 在 ref 包裹的某些类型上可能仍传 Ref，兼容取值
  const code = typeof lang === 'string' ? lang : (lang as { value: string }).value
  const meta = getLanguageMeta(code)
  document.documentElement.setAttribute('dir', meta?.is_rtl ? 'rtl' : 'ltr')
  document.documentElement.setAttribute('lang', code)
}, { immediate: true })

// =================== 复数示例 (Intl.PluralRules) ===================
interface PluralSample { count: number; category: string; text: string }

const pluralSamples = ref<PluralSample[]>([])

const refreshPlural = () => {
  const code = currentLang.value
  const samples: PluralSample[] = []
  let pr: Intl.PluralRules | null = null
  try {
    pr = new Intl.PluralRules(code)
  } catch {
    pr = null
  }
  const counts = [0, 1, 2, 3, 5, 11, 21, 100, 101]
  for (const n of counts) {
    const category = pr ? pr.select(n) : 'other'
    const text = pr?.select(n) === 'one' ? `1 ${code} item` : `${n} ${code} items`
    samples.push({ count: n, category, text })
  }
  pluralSamples.value = samples
}

// =================== 格式化预览 (Intl) ===================
const formatNumberPreview = ref('')
const formatCurrencyPreview = ref('')
const formatDatePreview = ref('')
const formatRelativePreview = ref('')

const refreshFormatPreviews = () => {
  const code = currentLang.value
  try {
    formatNumberPreview.value = new Intl.NumberFormat(code, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(1234567.89)
  } catch {
    formatNumberPreview.value = '1,234,567.89'
  }
  try {
    formatCurrencyPreview.value = new Intl.NumberFormat(code, {
      style: 'currency',
      currency: 'USD',
    }).format(1234.56)
  } catch {
    formatCurrencyPreview.value = '$1,234.56'
  }
  try {
    formatDatePreview.value = new Intl.DateTimeFormat(code, {
      dateStyle: 'long',
    }).format(new Date('2024-03-15T10:00:00Z'))
  } catch {
    formatDatePreview.value = ''
  }
  try {
    formatRelativePreview.value = formatRelative('2024-03-15T10:00:00Z', code)
  } catch {
    formatRelativePreview.value = ''
  }
}

// =================== 差异对比 ===================
interface LangCompletion { code: string; total: number; translated: number; percent: number }
interface DiffResult {
  a_missing: string[]
  b_missing: string[]
  identical: string[]
}

const diffA = ref<string>('zh-CN')
const diffB = ref<string>('en')
const diffResult = ref<DiffResult | null>(null)
const baseHint = ref<string>('')

const BASE_LANG_CACHE_KEY = 'i18n_dashboard_base_lang'

const writeCachedBase = (code: string): void => {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(BASE_LANG_CACHE_KEY, code) } catch { /* ignore */ }
}

const readCachedBase = (): string | null => {
  if (typeof localStorage === 'undefined') return null
  try { return localStorage.getItem(BASE_LANG_CACHE_KEY) } catch { return null }
}

const clearCachedBase = (): void => {
  if (typeof localStorage === 'undefined') return
  try { localStorage.removeItem(BASE_LANG_CACHE_KEY) } catch { /* ignore */ }
}

/**
 * 计算每种语言的"完成度" (i18nDashboard 命名空间下, 非空翻译数 / 总数)
 */
const computeCompletion = (): LangCompletion[] => {
  const msgs = (i18n.global as unknown as {
    messages: { value: Record<string, Record<string, unknown>> }
  }).messages?.value || {}
  const result: LangCompletion[] = []
  for (const m of I18N_LANGUAGES) {
    const tree = msgs[m.code] as { i18nDashboard?: Record<string, unknown> } | undefined
    const sub = tree?.i18nDashboard
    if (!sub) { result.push({ code: m.code, total: 0, translated: 0, percent: 0 }); continue }
    let keys = 0
    let translated = 0
    for (const v of Object.values(sub)) {
      keys++
      if (typeof v === 'string' && v.length > 0) translated++
    }
    const percent = keys === 0 ? 0 : Math.round((translated / keys) * 100)
    result.push({ code: m.code, total: keys, translated, percent })
  }
  // 降序: 完成度高的在前, 持平按语言代码字典序
  result.sort((a, b) => b.percent - a.percent || a.code.localeCompare(b.code))
  return result
}

/**
 * 自动选择完成度最高的语言作 diff base
 */
const pickBaseLang = (): LangCompletion => {
  const list = computeCompletion()
  // 取第一位 (完成度最高)
  return list[0] || { code: 'zh-CN', total: 0, translated: 0, percent: 0 }
}

const refreshBaseHint = (code: string) => {
  // 根据指定 code 计算其完成度
  const list = computeCompletion()
  const found = list.find(x => x.code === code) || { code, total: 0, translated: 0, percent: 0 }
  baseHint.value = t('i18nDashboard.diffBaseHint', { code: found.code, percent: found.percent })
}

const onAutoPickBase = () => {
  const best = pickBaseLang()
  diffA.value = best.code
  writeCachedBase(best.code)
  baseHint.value = t('i18nDashboard.diffBaseHint', { code: best.code, percent: best.percent })
  onDiff()
}

const onResetCachedBase = () => {
  clearCachedBase()
  onAutoPickBase()
}

// 手动切换 diffA 时同步写入缓存 (仅当用户主动改时才写; 内部设置走 onAutoPickBase 自身写)
watch(diffA, (newCode) => {
  // 2026-06-24 修正: watch 回调参数类型可能是 Ref<string>, 兼容取值
  // vue-tsc 5.x 在 strict 模式下对 typeof 守卫不彻底 narrow, 用显式 string 注解强制收窄
  const code: string = typeof newCode === 'string' ? newCode : String((newCode as { value: unknown }).value ?? '')
  writeCachedBase(code)
})

// 提取 vue-i18n 全局 messages 中 i18nDashboard 子树的所有 key
const collectI18nDashboardKeys = (): string[] => {
  const msgs = (i18n.global as unknown as {
    messages: { value: Record<string, Record<string, unknown>> }
  }).messages?.value
  if (!msgs) return []
  const collected = new Set<string>()
  for (const lang of Object.keys(msgs)) {
    const root = msgs[lang] as { i18nDashboard?: Record<string, unknown> } | undefined
    const sub = root?.i18nDashboard
    if (sub && typeof sub === 'object') {
      for (const k of Object.keys(sub)) {
        collected.add(k)
      }
    }
  }
  return Array.from(collected).sort()
}

const getNested = (root: Record<string, unknown> | undefined, key: string): string | undefined => {
  if (!root) return undefined
  const sub = root.i18nDashboard as Record<string, unknown> | undefined
  const v = sub?.[key]
  return typeof v === 'string' ? v : undefined
}

const onDiff = () => {
  const keys = collectI18nDashboardKeys()
  const msgs = (i18n.global as unknown as {
    messages: { value: Record<string, Record<string, unknown>> }
  }).messages?.value || {}
  const a_missing: string[] = []
  const b_missing: string[] = []
  const identical: string[] = []
  for (const k of keys) {
    const aRoot = msgs[diffA.value] as Record<string, unknown> | undefined
    const bRoot = msgs[diffB.value] as Record<string, unknown> | undefined
    const a = getNested(aRoot, k)
    const b = getNested(bRoot, k)
    if (!a) a_missing.push(k)
    if (!b) b_missing.push(k)
    if (a && b && a === b) identical.push(k)
  }
  diffResult.value = { a_missing, b_missing, identical }
}

// =================== 翻译记忆库 (TM) — 已移除 ===================
// 2026-06-26: 用户不要花钱翻译, TM 工作流已取消
// (占位以保留章节标记, 实际功能全部清空)

onMounted(() => {
  refreshPlural()
  refreshFormatPreviews()
  // 尝试恢复缓存的 base lang
  const cached = readCachedBase()
  if (cached && I18N_LANGUAGES.some(m => m.code === cached)) {
    diffA.value = cached
    refreshBaseHint(cached)
  } else {
    onAutoPickBase()
  }
})

// 语言切换时刷新受影响的预览
watch(currentLang, () => {
  refreshPlural()
  refreshFormatPreviews()
})
</script>

<style scoped lang="scss">
.i18n-dashboard {
  display: flex;
  flex-direction: column;
  gap: clamp(16px, 2vw, 24px);
  padding: clamp(12px, 2vw, 20px);
  max-width: 1280px;
  margin: 0 auto;
  color: var(--el-text-color-primary);
}

// ---- 头部 ----
.i18n-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 22px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
}

.i18n-header-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.i18n-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.i18n-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.i18n-stats {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.i18n-stat-num {
  font-size: 24px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
}

.i18n-stat-label {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

// ---- 通用 section ----
.i18n-section {
  padding: 18px 22px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.i18n-section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.i18n-hint {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.i18n-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

// ---- 5 语言表 ----
.i18n-table-wrap {
  overflow-x: auto;
}

.i18n-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.i18n-table thead th {
  text-align: start;
  padding: 10px 12px;
  border-bottom: var(--unified-border-bottom);
  font-weight: 600;
  color: var(--el-text-color-regular);
  background: var(--el-bg-color);
}

.i18n-table tbody td {
  padding: 10px 12px;
  border-bottom: var(--unified-border-bottom);
  color: var(--el-text-color-primary);
}

.i18n-table tbody tr.active {
  background: var(--el-fill-color-lighter);
}

.i18n-table tbody tr:hover {
  background: var(--el-fill-color-lighter);
}

.i18n-code {
  display: inline-block;
  padding: 1px 6px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-family: ui-monospace, monospace;
  font-size: 12px;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-lighter);
}

.i18n-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: var(--global-border-radius);
  font-size: 11px;
  font-weight: 600;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-5);
}

.i18n-tag.rtl {
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning-light-5);
}

.i18n-num {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  color: var(--el-text-color-regular);
}

// ---- 复数卡片 ----
.i18n-plural-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
}

.i18n-plural-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-lighter);
}

.i18n-plural-count {
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
}

.i18n-plural-cat {
  font-size: 10px;
  text-transform: uppercase;
  color: var(--el-color-primary);
  letter-spacing: 0.5px;
}

.i18n-plural-text {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

// ---- 格式化卡片 ----
.i18n-format-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.i18n-format-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-lighter);
}

.i18n-format-label {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--el-text-color-regular);
  letter-spacing: 0.5px;
}

.i18n-format-val {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
}

// ---- 差异对比 ----
.i18n-diff-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.i18n-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.i18n-select,
.i18n-input {
  padding: 6px 10px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font-size: 13px;
  min-width: 120px;
}

.i18n-input {
  flex: 1;
  min-width: 180px;
}

.i18n-btn {
  padding: 6px 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.i18n-btn.primary {
  background: var(--el-color-primary);
  color: var(--el-color-white);
  border-color: var(--el-color-primary);
}

.i18n-btn.primary:hover {
  background: var(--el-color-primary-light-3);
  border-color: var(--el-color-primary-light-3);
}

.i18n-btn.ghost {
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

.i18n-btn.ghost:hover {
  background: var(--el-fill-color-lighter);
  color: var(--el-color-primary);
}

.i18n-diff-vs {
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin: 0 4px;
}

.i18n-diff-base-hint {
  font-size: 12px;
  color: var(--el-text-color-regular);
  font-style: italic;
}

.i18n-diff-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-lighter);
}

.i18n-diff-stat {
  display: flex;
  flex-direction: column;
  align-items: start;
  gap: 2px;
  margin: 0;
}
</style>
