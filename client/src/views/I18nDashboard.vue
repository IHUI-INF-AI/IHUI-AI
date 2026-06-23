<template>
  <div class="i18n-dashboard" :dir="isCurrentRtl ? 'rtl' : 'ltr'" role="main" aria-labelledby="i18n-title">
    <!-- 标题 -->
    <header class="i18n-header glass scroll-reveal" data-animation="fadeInUp">
      <div class="i18n-header-text">
        <h1 id="i18n-title" class="i18n-title">{{ t('i18nDashboard.title') }}</h1>
        <p class="i18n-subtitle">{{ t('i18nDashboard.subtitle') }}</p>
      </div>
      <div class="i18n-stats" role="status" aria-live="polite">
        <span class="i18n-stat-num">{{ stats?.total_keys ?? 0 }}</span>
        <span class="i18n-stat-label">{{ t('i18nDashboard.statLabel', { langs: stats?.languages ?? 0 }) }}</span>
      </div>
    </header>

    <!-- 语言切换 -->
    <section class="i18n-section glass scroll-reveal" data-animation="fadeInUp" aria-labelledby="i18n-switcher-title">
      <h2 id="i18n-switcher-title" class="i18n-section-title">{{ t('i18nDashboard.languageSwitcher') }}</h2>
      <div class="i18n-grid">
        <LanguageSwitcher v-model="currentLang" @change="onLangChange" />
      </div>
    </section>

    <!-- 9 语言元数据表 -->
    <section class="i18n-section glass scroll-reveal" data-animation="fadeInUp" aria-labelledby="i18n-meta-title">
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
            <tr v-for="m in state.languages" :key="m.code" :class="{ active: m.code === state.currentLang }">
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
    <section class="i18n-section glass scroll-reveal" data-animation="fadeInUp" aria-labelledby="i18n-plural-title">
      <h2 id="i18n-plural-title" class="i18n-section-title">{{ t('i18nDashboard.pluralPreview') }}</h2>
      <p class="i18n-hint">{{ t('i18nDashboard.pluralHint', { key: pluralKey }) }}</p>
      <div class="i18n-plural-grid">
        <div v-for="s in pluralSamples" :key="s.count" class="i18n-plural-card">
          <span class="i18n-plural-count">{{ s.count }}</span>
          <span class="i18n-plural-cat">{{ s.category }}</span>
          <span class="i18n-plural-text">{{ s.text }}</span>
        </div>
      </div>
    </section>

    <!-- 格式化工具 -->
    <section class="i18n-section glass scroll-reveal" data-animation="fadeInUp" aria-labelledby="i18n-format-title">
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

    <!-- 差异对比 -->
    <section class="i18n-section glass scroll-reveal" data-animation="fadeInUp" aria-labelledby="i18n-diff-title">
      <h2 id="i18n-diff-title" class="i18n-section-title">{{ t('i18nDashboard.diffTitle') }}</h2>
      <div class="i18n-diff-controls">
        <label for="i18n-diff-a" class="i18n-label">{{ t('i18nDashboard.diffLangA') }}</label>
        <select id="i18n-diff-a" v-model="diffA" class="i18n-select">
          <option v-for="m in state.languages" :key="m.code" :value="m.code">{{ m.code }} · {{ m.english_name }}</option>
        </select>
        <span class="i18n-diff-vs">vs</span>
        <label for="i18n-diff-b" class="i18n-label">{{ t('i18nDashboard.diffLangB') }}</label>
        <select id="i18n-diff-b" v-model="diffB" class="i18n-select">
          <option v-for="m in state.languages" :key="m.code" :value="m.code">{{ m.code }} · {{ m.english_name }}</option>
        </select>
        <button type="button" class="i18n-btn primary ripple-btn" :disabled="loading" @click="onDiff">{{ t('i18nDashboard.diffBtn') }}</button>
      </div>
      <div v-if="diffResult" class="i18n-diff-summary">
        <p class="i18n-diff-stat">
          <span class="i18n-stat-num">{{ (diffResult.a_missing || []).length }}</span>
          <span class="i18n-stat-label">{{ t('i18nDashboard.diffAMissing') }}</span>
        </p>
        <p class="i18n-diff-stat">
          <span class="i18n-stat-num">{{ (diffResult.b_missing || []).length }}</span>
          <span class="i18n-stat-label">{{ t('i18nDashboard.diffBMissing') }}</span>
        </p>
        <p class="i18n-diff-stat">
          <span class="i18n-stat-num">{{ (diffResult.identical || []).length }}</span>
          <span class="i18n-stat-label">{{ t('i18nDashboard.diffIdentical') }}</span>
        </p>
      </div>
    </section>

    <!-- 同步日志 -->
    <section class="i18n-section glass scroll-reveal" data-animation="fadeInUp" aria-labelledby="i18n-log-title">
      <h2 id="i18n-log-title" class="i18n-section-title">{{ t('i18nDashboard.syncLog') }}</h2>
      <p v-if="state.syncLog.length === 0" class="i18n-state">{{ t('i18nDashboard.noSyncEvents') }}</p>
      <ul v-else class="i18n-log-list" tabindex="0" role="list" :aria-label="t('i18nDashboard.syncLogListAria')">
        <li v-for="ev in state.syncLog.slice(0, 30)" :key="ev.event_id" class="i18n-log-item">
          <span class="i18n-log-time">{{ formatTs(ev.ts) }}</span>
          <span :class="['i18n-log-kind', `kind-${ev.kind}`]">{{ ev.kind }}</span>
          <span class="i18n-log-key">{{ ev.key || '-' }}</span>
          <span class="i18n-log-lang">{{ ev.language || '-' }}</span>
          <span class="i18n-log-actor">{{ ev.actor }}</span>
        </li>
      </ul>
    </section>

    <!-- 翻译记忆库 (TM) -->
    <section class="i18n-section glass scroll-reveal" data-animation="fadeInUp" aria-labelledby="i18n-tm-title">
      <h2 id="i18n-tm-title" class="i18n-section-title">{{ t('i18nDashboard.tmTitle') }}</h2>
      <div class="i18n-tm-search">
        <input
          v-model="tmQuery"
          class="i18n-tm-input"
          type="text"
          :placeholder="t('i18nDashboard.tmSearchPlaceholder')"
          :aria-label="t('i18nDashboard.tmSearchAria')"
          @keyup.enter="onTmSearch"
        />
        <button class="i18n-tm-btn" @click="onTmSearch" :disabled="tmLoading">{{ t('common.search') }}</button>
      </div>
      <p v-if="tmResults.length === 0 && !tmLoading" class="i18n-state">{{ tmSearched ? t('i18nDashboard.tmNoMatch') : t('i18nDashboard.tmInputHint') }}</p>
      <ul v-else class="i18n-tm-list">
        <li v-for="(m, i) in tmResults" :key="i" class="i18n-tm-item">
          <span class="i18n-tm-sim" :class="{ high: m.similarity >= 0.8 }">{{ (m.similarity * 100).toFixed(0) }}%</span>
          <span class="i18n-tm-lang">{{ m.lang }}</span>
          <span class="i18n-tm-key">{{ m.key }}</span>
          <span class="i18n-tm-text">{{ m.text }}</span>
        </li>
      </ul>
    </section>

    <!-- 机器翻译 (MT) + 人工审核 -->
    <section class="i18n-section glass scroll-reveal" data-animation="fadeInUp" aria-labelledby="i18n-mt-title">
      <h2 id="i18n-mt-title" class="i18n-section-title">{{ t('i18nDashboard.mtTitle') }}</h2>
      <div class="i18n-mt-input-row">
        <input
          v-model="mtSourceText"
          class="i18n-tm-input"
          type="text"
          :placeholder="t('i18nDashboard.mtSourcePlaceholder')"
          :aria-label="t('i18nDashboard.mtSourceAria')"
          @keyup.enter="onMtTranslate"
        />
        <select v-model="mtTargetLang" class="i18n-tm-input i18n-mt-lang-select" :aria-label="t('i18nDashboard.targetLangAria')">
          <option v-for="l in state.languages" :key="l.code" :value="l.code">{{ l.code }} · {{ l.english_name }}</option>
        </select>
        <button class="i18n-tm-btn" @click="onMtTranslate" :disabled="mtLoading">{{ t('i18nDashboard.mtTranslate') }}</button>
      </div>
      <div v-if="mtResult" class="i18n-mt-result">
        <div class="i18n-mt-result-row">
          <span class="i18n-mt-label">{{ t('i18nDashboard.mtSource') }}</span>
          <span>{{ mtResult.source_text }}</span>
        </div>
        <div class="i18n-mt-result-row">
          <span class="i18n-mt-label">{{ t('i18nDashboard.mtTranslated') }}</span>
          <span>{{ mtResult.translated_text }}</span>
        </div>
        <div class="i18n-mt-result-row">
          <span class="i18n-mt-label">{{ t('i18nDashboard.mtConfidence') }}</span>
          <span :class="{ 'i18n-tm-sim': true, high: mtResult.confidence >= 0.8 }">{{ (mtResult.confidence * 100).toFixed(0) }}%</span>
          <span class="i18n-mt-status" :class="`status-${mtResult.status}`">{{ mtResult.status }}</span>
        </div>
        <div v-if="mtResult.status === 'pending_review'" class="i18n-mt-actions">
          <button class="i18n-tm-btn i18n-mt-approve" @click="onMtApprove">{{ t('i18nDashboard.mtApprove') }}</button>
          <button class="i18n-tm-btn i18n-mt-reject" @click="onMtReject">{{ t('i18nDashboard.mtReject') }}</button>
        </div>
      </div>
      <p v-else-if="!mtLoading" class="i18n-state">{{ t('i18nDashboard.mtInputHint') }}</p>
    </section>

    <!-- P12-5: 健康度仪表盘 -->
    <section class="i18n-section glass scroll-reveal" data-animation="fadeInUp" aria-labelledby="i18n-health-title">
      <h2 id="i18n-health-title" class="i18n-section-title">{{ t('i18nDashboard.healthTitle') }}</h2>
      <div v-if="health" class="i18n-health-grid">
        <div class="i18n-health-score">
          <span class="i18n-health-num" :style="{ color: healthColor(health.health_score) }">{{ health.health_score.toFixed(1) }}</span>
          <span class="i18n-health-label">{{ t('i18nDashboard.healthScore') }}</span>
        </div>
        <div class="i18n-health-card">
          <span class="i18n-health-card-num">{{ health.total_keys }}</span>
          <span class="i18n-health-card-label">{{ t('i18nDashboard.healthTotalKeys') }}</span>
        </div>
        <div class="i18n-health-card">
          <span class="i18n-health-card-num">{{ health.languages }}</span>
          <span class="i18n-health-card-label">{{ t('i18nDashboard.healthLanguages') }}</span>
        </div>
        <div class="i18n-health-card">
          <span class="i18n-health-card-num">{{ (health.overall_coverage * 100).toFixed(1) }}%</span>
          <span class="i18n-health-card-label">{{ t('i18nDashboard.healthCoverage') }}</span>
        </div>
        <div class="i18n-health-card">
          <span class="i18n-health-card-num">{{ health.pending_mt }}</span>
          <span class="i18n-health-card-label">{{ t('i18nDashboard.healthPendingMt') }}</span>
        </div>
        <div class="i18n-health-card">
          <span class="i18n-health-card-num">{{ health.stale_keys }}</span>
          <span class="i18n-health-card-label">{{ t('i18nDashboard.healthStaleKeys') }}</span>
        </div>
      </div>
      <p v-else class="i18n-state">{{ t('i18nDashboard.loading') }}</p>
    </section>

    <!-- P12-1: 导出 / 导入 -->
    <section class="i18n-section glass scroll-reveal" data-animation="fadeInUp" aria-labelledby="i18n-io-title">
      <h2 id="i18n-io-title" class="i18n-section-title">{{ t('i18nDashboard.ioTitle') }}</h2>
      <div class="i18n-io-row">
        <div class="i18n-io-block">
          <h3 class="i18n-io-subtitle">{{ t('i18nDashboard.export') }}</h3>
          <div class="i18n-io-controls">
            <select v-model="exportLang" class="i18n-select" :aria-label="t('i18nDashboard.exportLangAria')">
              <option value="">{{ t('i18nDashboard.allLanguages') }}</option>
              <option v-for="l in state.languages" :key="l.code" :value="l.code">{{ l.code }}</option>
            </select>
            <select v-model="exportFmt" class="i18n-select" :aria-label="t('i18nDashboard.exportFmtAria')">
              <option value="csv">CSV</option>
              <option value="xliff">XLIFF</option>
            </select>
            <button type="button" class="i18n-btn primary" :disabled="p12Loading" @click="onExport">{{ t('i18nDashboard.exportBtn') }}</button>
          </div>
          <textarea
            v-if="exportResult"
            class="i18n-io-textarea"
            readonly
            :value="exportResult.content"
            :aria-label="t('i18nDashboard.exportResultAria')"
          ></textarea>
        </div>
        <div class="i18n-io-block">
          <h3 class="i18n-io-subtitle">{{ t('i18nDashboard.import') }}</h3>
          <div class="i18n-io-controls">
            <select v-model="importFmt" class="i18n-select" :aria-label="t('i18nDashboard.importFmtAria')">
              <option value="csv">CSV</option>
              <option value="xliff">XLIFF</option>
            </select>
            <select v-model="importConflict" class="i18n-select" :aria-label="t('i18nDashboard.conflictStrategyAria')">
              <option value="overwrite">{{ t('i18nDashboard.conflictOverwrite') }}</option>
              <option value="skip">{{ t('i18nDashboard.conflictSkip') }}</option>
            </select>
            <button type="button" class="i18n-btn primary" :disabled="p12Loading || !importContent.trim()" @click="onImport">{{ t('i18nDashboard.importBtn') }}</button>
          </div>
          <textarea
            v-model="importContent"
            class="i18n-io-textarea"
            :placeholder="t('i18nDashboard.importContentPlaceholder')"
            :aria-label="t('i18nDashboard.importContentAria')"
          ></textarea>
          <p v-if="importResult" class="i18n-io-result">
            {{ t('i18nDashboard.importResult', { imported: importResult.imported, skipped: importResult.skipped }) }}
          </p>
        </div>
      </div>
    </section>

    <!-- P12-2: 版本历史 -->
    <section class="i18n-section glass scroll-reveal" data-animation="fadeInUp" aria-labelledby="i18n-history-title">
      <h2 id="i18n-history-title" class="i18n-section-title">{{ t('i18nDashboard.historyTitle') }}</h2>
      <div class="i18n-io-controls">
        <input
          v-model="historyKey"
          class="i18n-tm-input"
          type="text"
          :placeholder="t('i18nDashboard.historyKeyPlaceholder')"
          :aria-label="t('i18nDashboard.historyKeyAria')"
        />
        <select v-model="historyLang" class="i18n-select" :aria-label="t('i18nDashboard.historyLangAria')">
          <option v-for="l in state.languages" :key="l.code" :value="l.code">{{ l.code }}</option>
        </select>
        <button type="button" class="i18n-btn primary" :disabled="p12Loading || !historyKey.trim()" @click="onShowHistory">{{ t('i18nDashboard.viewHistory') }}</button>
      </div>
      <ul v-if="historyVisible && historyList.length > 0" class="i18n-log-list" tabindex="0" role="list" :aria-label="t('i18nDashboard.historyListAria')">
        <li v-for="v in historyList" :key="v.version" class="i18n-log-item">
          <span class="i18n-log-time">{{ formatTs(v.ts) }}</span>
          <span class="i18n-log-kind">v{{ v.version }}</span>
          <span class="i18n-log-key">{{ v.value }}</span>
          <span class="i18n-log-lang">{{ v.actor }}</span>
          <button type="button" class="i18n-btn" @click="onRollback(v.version)">{{ t('i18nDashboard.rollback') }}</button>
        </li>
      </ul>
      <p v-else-if="historyVisible" class="i18n-state">{{ t('i18nDashboard.noHistory') }}</p>
    </section>

    <!-- P12-3: 批量操作 -->
    <section class="i18n-section glass scroll-reveal" data-animation="fadeInUp" aria-labelledby="i18n-batch-title">
      <h2 id="i18n-batch-title" class="i18n-section-title">{{ t('i18nDashboard.batchTitle') }}</h2>
      <div class="i18n-io-row">
        <div class="i18n-io-block">
          <h3 class="i18n-io-subtitle">{{ t('i18nDashboard.batchDeleteStatus') }}</h3>
          <textarea
            v-model="batchKeysText"
            class="i18n-io-textarea"
            :placeholder="t('i18nDashboard.batchKeysPlaceholder')"
            :aria-label="t('i18nDashboard.batchKeysAria')"
          ></textarea>
          <div class="i18n-io-controls">
            <select v-model="batchLang" class="i18n-select" :aria-label="t('i18nDashboard.batchLangAria')">
              <option v-for="l in state.languages" :key="l.code" :value="l.code">{{ l.code }}</option>
            </select>
            <select v-model="batchStatusValue" class="i18n-select" :aria-label="t('i18nDashboard.batchStatusAria')">
              <option value="approved">approved</option>
              <option value="pending">pending</option>
              <option value="draft">draft</option>
            </select>
            <button type="button" class="i18n-btn" :disabled="p12Loading" @click="onBatchDelete">{{ t('i18nDashboard.batchDeleteBtn') }}</button>
            <button type="button" class="i18n-btn primary" :disabled="p12Loading" @click="onBatchStatus">{{ t('i18nDashboard.batchStatusBtn') }}</button>
          </div>
        </div>
        <div class="i18n-io-block">
          <h3 class="i18n-io-subtitle">{{ t('i18nDashboard.batchPush') }}</h3>
          <textarea
            v-model="batchPushText"
            class="i18n-io-textarea"
            :placeholder="t('i18nDashboard.batchPushPlaceholder')"
            :aria-label="t('i18nDashboard.batchPushAria')"
          ></textarea>
          <div class="i18n-io-controls">
            <button type="button" class="i18n-btn primary" :disabled="p12Loading" @click="onBatchPush">{{ t('i18nDashboard.batchPushBtn') }}</button>
          </div>
        </div>
      </div>
      <p v-if="batchResult" class="i18n-io-result">{{ batchResult }}</p>
    </section>

    <!-- P12-4 + P12-7: MT Provider + V1 退役监控 -->
    <section class="i18n-section glass scroll-reveal" data-animation="fadeInUp" aria-labelledby="i18n-monitor-title">
      <h2 id="i18n-monitor-title" class="i18n-section-title">{{ t('i18nDashboard.monitorTitle') }}</h2>
      <div class="i18n-io-row">
        <div class="i18n-io-block">
          <h3 class="i18n-io-subtitle">{{ t('i18nDashboard.mtProvider') }}</h3>
          <p class="i18n-hint">{{ t('i18nDashboard.current') }}: <code class="i18n-code">{{ mtCurrentProvider || '-' }}</code></p>
          <ul class="i18n-log-list" tabindex="0" role="list" :aria-label="t('i18nDashboard.mtProviderListAria')">
            <li v-for="p in mtProviders" :key="p.id" class="i18n-log-item">
              <span class="i18n-log-kind">{{ p.name }}</span>
              <span class="i18n-log-key">{{ p.id }}</span>
              <span :class="['i18n-tag', { rtl: p.available }]">{{ p.available ? t('i18nDashboard.available') : t('i18nDashboard.unavailable') }}</span>
              <span class="i18n-log-lang">{{ p.description }}</span>
              <span class="i18n-log-actor">{{ p.id === mtCurrentProvider ? t('i18nDashboard.currentTag') : '' }}</span>
            </li>
          </ul>
        </div>
        <div class="i18n-io-block">
          <h3 class="i18n-io-subtitle">{{ t('i18nDashboard.v1Monitor') }}</h3>
          <div v-if="v1Stats" class="i18n-health-grid">
            <div class="i18n-health-card">
              <span class="i18n-health-card-num">{{ v1Stats.total_hits }}</span>
              <span class="i18n-health-card-label">{{ t('i18nDashboard.v1TotalHits') }}</span>
            </div>
            <div class="i18n-health-card">
              <span class="i18n-health-card-num">{{ v1Stats.unique_paths }}</span>
              <span class="i18n-health-card-label">{{ t('i18nDashboard.v1UniquePaths') }}</span>
            </div>
          </div>
          <ul v-if="v1Stats && v1Stats.top_paths.length > 0" class="i18n-log-list" tabindex="0" role="list" :aria-label="t('i18nDashboard.v1TopPathsAria')">
            <li v-for="(p, i) in v1Stats.top_paths" :key="i" class="i18n-log-item">
              <span class="i18n-log-kind">{{ p.hits }}</span>
              <span class="i18n-log-key">{{ p.path }}</span>
            </li>
          </ul>
          <p v-else class="i18n-state">{{ t('i18nDashboard.noV1Hits') }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import LanguageSwitcher from '@/components/i18n/LanguageSwitcher.vue'
import {
  useI18nV2,
  type PluralSample,
  type TmMatch,
  type MTResult,
  type TranslationVersion,
  type HealthStat,
  type V1RetirementStats,
  type MTProvider,
} from '@/composables/useI18nV2'
import { ElMessage } from 'element-plus'

const {
  state,
  currentMeta: _currentMeta,
  isCurrentRtl,
  fetchLanguages,
  setCurrentLang,
  fetchKeys,
  fetchSyncLog,
  fetchStats,
  formatByKind,
  pluralExamples,
  diffLanguages,
  formatRelative,
  searchTm,
  machineTranslate,
  reviewMt,
  fetchMtQueue,
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
} = useI18nV2()

const loading = ref(false)
const currentLang = ref('zh-CN')
const diffA = ref('zh-CN')
const diffB = ref('en-US')
const pluralKey = ref('common.items')
const pluralSamples = ref<PluralSample[]>([])
const diffResult = ref<{
  lang_a: string
  lang_b: string
  a_missing: string[]
  b_missing: string[]
  identical: { key: string; a: string; b: string }[]
  total: number
} | null>(null)
const stats = ref<{
  total_keys: number
  per_language: Record<string, number>
  plural_keys: number
  languages: number
} | null>(null)

const formatNumberPreview = ref('')
const formatCurrencyPreview = ref('')
const formatDatePreview = ref('')
const formatRelativePreview = ref('')

const onLangChange = async (code: string) => {
  try {
    currentLang.value = code
    setCurrentLang(code)
    await refreshFormatPreviews()
    await refreshPlural()
  } catch (e) {
    console.error('[I18nDashboard] 语言切换失败', e)
  }
}

const refreshFormatPreviews = async () => {
  formatNumberPreview.value = (await formatByKind({ kind: 'number', value: 1234567.89, lang: state.currentLang, decimals: 2 })) || ''
  formatCurrencyPreview.value = (await formatByKind({ kind: 'currency', value: 1234.56, lang: state.currentLang, currency: 'USD' })) || ''
  formatDatePreview.value = (await formatByKind({ kind: 'date', value: new Date().toISOString(), lang: state.currentLang, fmt: 'long' })) || ''
  formatRelativePreview.value = formatRelative(new Date(Date.now() - 1000 * 60 * 5), state.currentLang)
}

const refreshPlural = async () => {
  pluralSamples.value = (await pluralExamples(pluralKey.value, state.currentLang)) || []
}

const onDiff = async () => {
  loading.value = true
  try {
    diffResult.value = await diffLanguages(diffA.value, diffB.value)
  } finally {
    loading.value = false
  }
}

const formatTs = (ts: number) => {
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const tmQuery = ref('')
const tmResults = ref<TmMatch[]>([])
const tmLoading = ref(false)
const tmSearched = ref(false)

const onTmSearch = async () => {
  if (!tmQuery.value.trim()) return
  tmLoading.value = true
  try {
    tmResults.value = await searchTm(tmQuery.value, '', 0.3, 10)
    tmSearched.value = true
  } finally {
    tmLoading.value = false
  }
}

const mtSourceText = ref('')
const mtTargetLang = ref('en-US')
const mtResult = ref<MTResult | null>(null)
const mtLoading = ref(false)
const mtQueue = ref<MTResult[]>([])

const onMtTranslate = async () => {
  if (!mtSourceText.value.trim()) return
  mtLoading.value = true
  try {
    mtResult.value = await machineTranslate('mt.preview', 'zh-CN', mtTargetLang.value, mtSourceText.value)
    mtQueue.value = await fetchMtQueue('pending_review')
  } finally {
    mtLoading.value = false
  }
}

const onMtApprove = async () => {
  if (!mtResult.value) return
  try {
    await reviewMt(mtResult.value.key, mtTargetLang.value, 'approve')
    mtResult.value = { ...mtResult.value, status: 'approved' }
    mtQueue.value = await fetchMtQueue('pending_review')
  } catch (e) {
    console.error('[I18nDashboard] 审批失败', e)
    ElMessage.error(t('common.errors.approveFailed'))
  }
}

const onMtReject = async () => {
  if (!mtResult.value) return
  try {
    await reviewMt(mtResult.value.key, mtTargetLang.value, 'reject')
    mtResult.value = { ...mtResult.value, status: 'rejected' }
    mtQueue.value = await fetchMtQueue('pending_review')
  } catch (e) {
    console.error('[I18nDashboard] 拒绝失败', e)
    ElMessage.error(t('common.errors.rejectFailed'))
  }
}

watch(() => state.currentLang, async () => {
  try { await refreshFormatPreviews(); await refreshPlural() } catch (e) { console.error(e) }
})

// ============================================================
// P12-1: 导出 / 导入
// ============================================================
const exportLang = ref('')
const exportFmt = ref<'csv' | 'xliff'>('csv')
const exportResult = ref<{ format: string; content: string; count: number } | null>(null)
const importContent = ref('')
const importFmt = ref<'csv' | 'xliff'>('csv')
const importConflict = ref<'overwrite' | 'skip'>('overwrite')
const importResult = ref<{ imported: number; skipped: number; errors: string[] } | null>(null)
const p12Loading = ref(false)

const onExport = async () => {
  p12Loading.value = true
  try {
    exportResult.value = await exportTranslations(exportLang.value, exportFmt.value)
  } finally {
    p12Loading.value = false
  }
}

const onImport = async () => {
  if (!importContent.value.trim()) return
  p12Loading.value = true
  try {
    importResult.value = await importTranslations(
      importContent.value,
      importFmt.value,
      importConflict.value,
    )
    if (importResult.value && importResult.value.imported > 0) {
      stats.value = await fetchStats()
      await fetchSyncLog(50)
    }
  } catch (e) {
    console.error('[I18nDashboard] 导入后刷新失败', e)
    ElMessage.error(t('common.errors.importRefreshFailed'))
  } finally {
    p12Loading.value = false
  }
}

// ============================================================
// P12-2: 版本历史 / 回滚
// ============================================================
const historyKey = ref('')
const historyLang = ref('zh-CN')
const historyList = ref<TranslationVersion[]>([])
const historyVisible = ref(false)

const onShowHistory = async () => {
  if (!historyKey.value.trim()) return
  p12Loading.value = true
  try {
    historyList.value = await fetchHistory(historyKey.value, historyLang.value)
    historyVisible.value = true
  } finally {
    p12Loading.value = false
  }
}

const onRollback = async (version: number) => {
  p12Loading.value = true
  try {
    const r = await rollbackTranslation(historyKey.value, historyLang.value, version)
    if (r && r.ok) {
      historyList.value = await fetchHistory(historyKey.value, historyLang.value)
      stats.value = await fetchStats()
    }
  } finally {
    p12Loading.value = false
  }
}

// ============================================================
// P12-3: 批量操作
// ============================================================
const batchKeysText = ref('')
const batchLang = ref('zh-CN')
const batchStatusValue = ref('approved')
const batchPushText = ref('')
const batchResult = ref<string>('')

const onBatchDelete = async () => {
  const keys = batchKeysText.value.split('\n').map(k => k.trim()).filter(Boolean)
  if (keys.length === 0) return
  p12Loading.value = true
  try {
    const r = await batchDelete(keys)
    batchResult.value = r ? `删除 ${r.deleted} 个, 未找到 ${r.not_found.length} 个` : '失败'
    if (r && r.deleted > 0) {
      stats.value = await fetchStats()
      await fetchSyncLog(50)
    }
  } catch (e) {
    console.error('[I18nDashboard] 删除后刷新失败', e)
    ElMessage.error(t('common.errors.deleteRefreshFailed'))
  } finally {
    p12Loading.value = false
  }
}

const onBatchStatus = async () => {
  const keys = batchKeysText.value.split('\n').map(k => k.trim()).filter(Boolean)
  if (keys.length === 0) return
  p12Loading.value = true
  try {
    const r = await batchSetStatus(keys, batchLang.value, batchStatusValue.value)
    batchResult.value = r ? `更新 ${r.updated} 个, 跳过 ${r.skipped.length} 个` : '失败'
  } finally {
    p12Loading.value = false
  }
}

const onBatchPush = async () => {
  const lines = batchPushText.value.split('\n').map(l => l.trim()).filter(Boolean)
  const items: Array<{ key: string; lang: string; value: string }> = []
  for (const line of lines) {
    const parts = line.split('\t')
    if (parts.length >= 3) {
      items.push({ key: parts[0], lang: parts[1], value: parts.slice(2).join('\t') })
    }
  }
  if (items.length === 0) return
  p12Loading.value = true
  try {
    const r = await batchPush(items)
    batchResult.value = r ? `推送 ${r.pushed} 个, 失败 ${r.failed.length} 个` : '失败'
    if (r && r.pushed > 0) {
      stats.value = await fetchStats()
      await fetchSyncLog(50)
    }
  } catch (e) {
    console.error('[I18nDashboard] 推送后刷新失败', e)
    ElMessage.error(t('common.errors.pushRefreshFailed'))
  } finally {
    p12Loading.value = false
  }
}

// ============================================================
// P12-4: MT Provider
// ============================================================
const mtProviders = ref<MTProvider[]>([])
const mtCurrentProvider = ref('')

const refreshMtProviders = async () => {
  const r = await listMtProviders()
  if (r) {
    mtProviders.value = r.providers
    mtCurrentProvider.value = r.current
  }
}

// ============================================================
// P12-5: 健康度
// ============================================================
const health = ref<HealthStat | null>(null)

const refreshHealth = async () => {
  health.value = await fetchHealth()
}

const healthColor = (score: number) => {
  if (score >= 80) return 'var(--el-color-success)'
  if (score >= 60) return 'var(--el-color-warning)'
  return 'var(--el-color-danger)'
}

// ============================================================
// P12-7: V1 退役监控
// ============================================================
const v1Stats = ref<V1RetirementStats | null>(null)

const refreshV1Stats = async () => {
  try {
    v1Stats.value = await fetchV1RetirementStats()
  } catch (e) {
    console.error('[I18nDashboard] V1 统计刷新失败', e)
  }
}

onMounted(async () => {
  try {
    await fetchLanguages()
    await fetchKeys()
    await fetchSyncLog(50)
    stats.value = await fetchStats()
    currentLang.value = state.currentLang
    await refreshFormatPreviews()
    await refreshPlural()
    diffResult.value = await diffLanguages(diffA.value, diffB.value)
    // P12
    await refreshHealth()
    await refreshV1Stats()
    await refreshMtProviders()
  } catch (e) {
    console.error('[I18nDashboard] 数据加载失败', e)
    ElMessage.error(t('common.errors.dataLoadFailed'))
  }
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

// ---- 同步日志 ----
.i18n-log-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 320px;
  overflow-y: auto;
}

.i18n-log-item {
  display: grid;
  grid-template-columns: 160px 80px 1fr 80px 100px;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 12px;
  font-family: ui-monospace, monospace;
  color: var(--el-text-color-primary);
}

.i18n-log-time {
  color: var(--el-text-color-regular);
}

.i18n-log-kind {
  font-weight: 600;
}

.i18n-log-kind.kind-create { color: var(--el-color-success); }
.i18n-log-kind.kind-update { color: var(--el-color-primary); }
.i18n-log-kind.kind-delete { color: var(--el-color-danger); }

.i18n-log-key {
  font-family: ui-monospace, monospace;
  color: var(--el-text-color-primary);
}

.i18n-log-lang,
.i18n-log-actor {
  color: var(--el-text-color-regular);
}

.i18n-state {
  margin: 0;
  padding: 18px;
  text-align: center;
  color: var(--el-text-color-regular);
  border: 1px dashed var(--border-unified-color);
  border-radius: var(--global-border-radius);
}

.i18n-tm-search {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.i18n-tm-input {
  flex: 1;
  padding: 8px 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 14px;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color);
}

.i18n-tm-btn {
  padding: 8px 20px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-color-primary);
  color: var(--el-color-white);
  font-size: 14px;
  cursor: pointer;
}

.i18n-tm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.i18n-tm-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}

.i18n-tm-item {
  display: grid;
  grid-template-columns: 60px 80px 1fr 2fr;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 12px;
  color: var(--el-text-color-primary);
}

.i18n-tm-sim {
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.i18n-tm-sim.high {
  color: var(--el-color-success);
}

.i18n-tm-lang {
  color: var(--el-text-color-regular);
  font-family: ui-monospace, monospace;
}

.i18n-tm-key {
  font-family: ui-monospace, monospace;
  color: var(--el-text-color-regular);
}

.i18n-tm-text {
  color: var(--el-text-color-primary);
}

.i18n-mt-input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.i18n-mt-lang-select {
  max-width: 200px;
}

.i18n-mt-result {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
}

.i18n-mt-result-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.i18n-mt-label {
  min-width: 60px;
  color: var(--el-text-color-regular);
}

.i18n-mt-status {
  padding: 2px 8px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.i18n-mt-status.status-approved {
  color: var(--el-color-success);
  border-color: var(--el-color-success);
}

.i18n-mt-status.status-rejected {
  color: var(--el-color-danger);
  border-color: var(--el-color-danger);
}

.i18n-mt-actions {
  display: flex;
  gap: 8px;
}

.i18n-mt-approve {
  background: var(--el-color-success);
  border-color: var(--el-color-success);
}

.i18n-mt-reject {
  background: var(--el-color-danger);
  border-color: var(--el-color-danger);
}

// ---- P12: 健康度仪表盘 ----
.i18n-health-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.i18n-health-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 18px 14px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-lighter);
}

.i18n-health-num {
  font-size: 32px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
}

.i18n-health-label {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.i18n-health-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
}

.i18n-health-card-num {
  font-size: 20px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
}

.i18n-health-card-label {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

// ---- P12: 导出 / 导入 ----
.i18n-io-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.i18n-io-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
}

.i18n-io-subtitle {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.i18n-io-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.i18n-io-textarea {
  width: 100%;
  min-height: 120px;
  padding: 10px 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-family: ui-monospace, monospace;
  resize: vertical;
}

.i18n-io-textarea:focus {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -1px;
}

.i18n-io-result {
  margin: 0;
  font-size: 13px;
  color: var(--el-color-success);
}
</style>
