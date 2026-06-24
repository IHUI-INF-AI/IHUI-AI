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

    <!-- 9 语言元数据表 -->
    <section class="i18n-section scroll-reveal" data-animation="fadeInUp" aria-labelledby="i18n-meta-title">
      <h2 id="i18n-meta-title" class="i18n-section-title">{{ t('i18nDashboard.metaTitle') }}</h2>
      <div class="i18n-table-wrap">
        <table class="i18n-table" :aria-label="t('i18nDashboard.metaTableAria')">
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
// I18nDashboard - V1 纯前端静态版本
// 替代原 useI18nV2 + 后端 /api/v1/i18n-v2/* 整套体系
// 数据源全部前端静态, 任何时候（无网络/无后端）都好使
// 9 语言元数据: constants/i18nLanguages.ts
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
      timeStyle: 'short',
    }).format(new Date())
  } catch {
    formatDatePreview.value = new Date().toISOString()
  }
  // 相对时间: 5 分钟前
  formatRelativePreview.value = formatRelative(new Date(Date.now() - 1000 * 60 * 5), code)
}

watch(currentLang, () => {
  refreshFormatPreviews()
  refreshPlural()
}, { immediate: true })

// =================== 差异对比 (跨 V1 静态翻译) ===================
interface DiffResult {
  a_missing: string[]
  b_missing: string[]
  identical: { key: string; a: string; b: string }[]
  total: number
}

const diffA = ref('zh-CN')
const diffB = ref('en')
const diffResult = ref<DiffResult | null>(null)

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
  const identical: { key: string; a: string; b: string }[] = []
  for (const k of keys) {
    const a = getNested(msgs[diffA.value], k)
    const b = getNested(msgs[diffB.value], k)
    if (a == null) a_missing.push(k)
    if (b == null) b_missing.push(k)
    if (a != null && b != null && a === b) identical.push({ key: k, a, b })
  }
  diffResult.value = {
    a_missing,
    b_missing,
    identical,
    total: keys.length,
  }
}

onMounted(() => {
  // 初始化一次, 避免初始值在 SSR 期间为空
  refreshFormatPreviews()
  refreshPlural()
  onDiff()
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

// ---- 9 语言表 ----
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
  padding: 2px 8px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.i18n-tag.rtl {
  /* WCAG AA: 4.5:1 contrast. 使用项目主文字色 (#303133) 作为背景, 白字, 对比度 ≈ 12:1 远超 AA */
  background: var(--el-text-color-primary);
  color: var(--el-color-white);
  border-color: var(--el-text-color-primary);
}

.i18n-num {
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
}

// ---- 复数示例 ----
.i18n-plural-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.i18n-plural-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
}

.i18n-plural-count {
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
}

.i18n-plural-cat {
  font-size: 11px;
  color: var(--el-text-color-regular);
  font-family: ui-monospace, monospace;
}

.i18n-plural-text {
  font-size: 14px;
  color: var(--el-text-color-primary);
}

// ---- 格式化工具 ----
.i18n-format-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.i18n-format-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
}

.i18n-format-label {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.i18n-format-val {
  font-size: 18px;
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
  color: var(--el-text-color-primary);
}

.i18n-select {
  height: 36px;
  padding: 0 12px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
}

.i18n-select:hover {
  border-color: var(--border-unified-color-hover);
}

.i18n-diff-vs {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.i18n-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 16px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color);
  cursor: pointer;
  font-family: inherit;
}

.i18n-btn.primary {
  background: var(--el-text-color-primary);
  color: var(--el-bg-color);
  border-color: var(--el-text-color-primary);
}

.i18n-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.i18n-diff-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
}

.i18n-diff-stat {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 6px 10px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-lighter);
}
</style>
