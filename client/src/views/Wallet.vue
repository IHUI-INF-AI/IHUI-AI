<template>
  <div class="wallet-page">
    <div class="container">
      <!-- 余额预警 -->
      <BalanceAlert
        :balance-cents="balance.balance"
        @action="showRecharge = true"
      />

      <!-- 余额卡片 -->
      <section
        class="balance-card glass scroll-reveal"
        data-animation="fadeInUp"
        aria-labelledby="wallet-balance-heading"
      >
        <div class="balance-info">
          <h2 id="wallet-balance-heading" class="balance-label">{{ t('wallet.accountBalance') }}</h2>
          <div class="balance-amount" aria-live="polite" aria-atomic="true">
            <span class="currency" aria-hidden="true">¥</span>
            <span class="value">{{ formatAmount(balance.balance) }}</span>
          </div>
          <span class="balance-frozen" :aria-label="`${t('wallet.frozen')} ${formatAmount(balance.frozen)} ${t('wallet.yuan')}`">{{ t('wallet.frozen') }}: ¥{{ formatAmount(balance.frozen) }}</span>
        </div>
        <div class="balance-actions" role="group" :aria-label="t('wallet.balanceActions')">
          <button
            type="button"
            class="action-btn primary ripple-btn"
            :aria-label="t('wallet.recharge')"
            @click="showRecharge = true"
          >
            <span class="btn-text">{{ t('wallet.recharge') }}</span>
            <span class="btn-glow" aria-hidden="true"></span>
          </button>
          <button
            type="button"
            class="action-btn secondary ripple-btn"
            :aria-label="t('wallet.withdraw')"
            @click="showWithdraw = true"
          >
            <span class="btn-text">{{ t('wallet.withdraw') }}</span>
            <span class="btn-glow" aria-hidden="true"></span>
          </button>
        </div>
      </section>

      <!-- 汇总卡片 -->
      <section
        class="summary-grid"
        role="region"
        :aria-label="t('wallet.summaryRegion')"
      >
        <div
          v-for="(s, i) in summaryCards"
          :key="i"
          class="summary-card glass scroll-reveal"
          data-animation="fadeInUp"
          role="group"
          :aria-label="`${s.label} ${formatAmount(s.value)} ${t('wallet.yuan')}`"
        >
          <div class="summary-icon" :class="s.type" aria-hidden="true">
            <span>{{ s.icon }}</span>
          </div>
          <div class="summary-content">
            <span class="summary-label">{{ s.label }}</span>
            <span class="summary-value">¥{{ formatAmount(s.value) }}</span>
          </div>
        </div>
      </section>

      <!-- 余额趋势图 -->
      <section
        class="trend-card glass scroll-reveal"
        data-animation="fadeInUp"
        aria-labelledby="wallet-trend-heading"
      >
        <h3 id="wallet-trend-heading" class="section-title">{{ t('wallet.balanceTrend') }}</h3>
        <div
          class="trend-chart"
          role="img"
          :aria-label="t('wallet.trendAria', { days: trendPoints.length, min: formatAmount(minTrendBalance), max: formatAmount(maxTrendBalance) })"
        >
          <svg viewBox="0 0 600 200" preserveAspectRatio="none" class="trend-svg" aria-hidden="true">
            <defs>
              <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" :stop-color="trendStrokeColor" stop-opacity="0.15" />
                <stop offset="100%" :stop-color="trendStrokeColor" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path :d="trendPath" fill="url(#trendGrad)" />
            <path :d="trendLine" fill="none" :stroke="trendStrokeColor" stroke-width="2" />
          </svg>
          <div class="trend-labels" aria-hidden="true">
            <span v-for="(point, idx) in trendPoints" :key="idx" class="trend-label">
              {{ point.date.slice(5) }}
            </span>
          </div>
        </div>
      </section>

      <!-- 过滤栏 -->
      <section
        class="filter-bar glass"
        role="region"
        :aria-label="t('wallet.filterRegion')"
      >
        <div
          class="filter-tabs"
          role="tablist"
          :aria-label="t('wallet.filterByType')"
        >
          <button
            v-for="tab in typeTabs"
            :key="tab.value"
            type="button"
            role="tab"
            :aria-selected="filterTxType === tab.value"
            :tabindex="filterTxType === tab.value ? 0 : -1"
            :class="['filter-tab ripple-btn', { active: filterTxType === tab.value }]"
            @click="filterTxType = tab.value; currentPage = 1; loadTransactions()"
            @keydown.left.prevent="focusPrevTab"
            @keydown.right.prevent="focusNextTab"
          >
            {{ tab.label }}
          </button>
        </div>
        <div class="filter-actions">
          <label class="sr-only" for="wallet-filter-days">{{ t('wallet.timeRange') }}</label>
          <select
            id="wallet-filter-days"
            v-model.number="filterDays"
            class="filter-select"
            @change="loadSummary(); loadTrend()"
          >
            <option :value="7">{{ t('wallet.last7Days') }}</option>
            <option :value="30">{{ t('wallet.last30Days') }}</option>
            <option :value="90">{{ t('wallet.last90Days') }}</option>
          </select>
          <button
            type="button"
            class="export-btn ripple-btn"
            :aria-label="t('wallet.exportCsv')"
            @click="exportTx"
          >
            <span class="btn-text">{{ t('wallet.export') }} CSV</span>
            <span class="btn-glow" aria-hidden="true"></span>
          </button>
        </div>
      </section>

      <!-- 高级过滤 -->
      <section
        class="filter-advanced glass"
        role="region"
        :aria-label="t('wallet.advancedFilter')"
      >
        <div class="adv-field">
          <label class="adv-label" for="wallet-filter-keyword">{{ t('common.search') }}</label>
          <input
            id="wallet-filter-keyword"
            v-model="filterKeyword"
            type="text"
            class="adv-input"
            :placeholder="t('wallet.searchPlaceholder')"
            :aria-label="t('wallet.searchPlaceholder')"
            @keyup.enter="currentPage = 1; loadTransactions()"
          />
        </div>
        <div class="adv-field">
          <label class="adv-label" for="wallet-filter-date">{{ t('wallet.date') }}</label>
          <el-date-picker
            id="wallet-filter-date"
            v-model="filterDateRange"
            type="daterange"
            :range-separator="t('wallet.rangeSeparator')"
            :start-placeholder="t('wallet.startDate')"
            :end-placeholder="t('wallet.endDate')"
            value-format="YYYY-MM-DD"
            format="YYYY-MM-DD"
            class="adv-date"
            @change="onDateChange"
          />
        </div>
        <div class="adv-field">
          <span class="adv-label" id="wallet-amount-label">{{ t('wallet.amount') }}</span>
          <div
            class="adv-amount"
            role="group"
            aria-labelledby="wallet-amount-label"
          >
            <input
              v-model.number="filterMinAmount"
              type="number"
              class="adv-input small"
              :placeholder="t('wallet.minAmount')"
              :aria-label="t('wallet.minAmountAria')"
              min="0"
            />
            <span class="adv-sep" aria-hidden="true">-</span>
            <input
              v-model.number="filterMaxAmount"
              type="number"
              class="adv-input small"
              :placeholder="t('wallet.maxAmount')"
              :aria-label="t('wallet.maxAmountAria')"
              min="0"
            />
            <span class="adv-unit" aria-hidden="true">{{ t('wallet.yuan') }}</span>
          </div>
        </div>
        <div class="adv-actions" role="group" :aria-label="t('wallet.filterActions')">
          <button
            type="button"
            class="adv-btn primary ripple-btn"
            :aria-label="t('wallet.apply')"
            @click="currentPage = 1; loadTransactions()"
          >
            <span class="btn-text">{{ t('wallet.apply') }}</span>
            <span class="btn-glow" aria-hidden="true"></span>
          </button>
          <button
            type="button"
            class="adv-btn secondary ripple-btn"
            :aria-label="t('wallet.reset')"
            @click="resetFilters"
          >
            <span class="btn-text">{{ t('wallet.reset') }}</span>
            <span class="btn-glow" aria-hidden="true"></span>
          </button>
        </div>
      </section>

      <!-- 交易列表 -->
      <section
        class="tx-container glass"
        role="region"
        aria-labelledby="wallet-tx-heading"
        :aria-busy="loading"
      >
        <h3 id="wallet-tx-heading" class="sr-only">{{ t('wallet.transactionList') }}</h3>
        <div v-if="loadError" class="error-state" role="alert">
          <div class="error-icon" aria-hidden="true">⚠</div>
          <p>{{ loadError }}</p>
          <button type="button" class="retry-btn" @click="loadTransactions">{{ t('common.retry') }}</button>
        </div>

        <div v-else-if="loading" class="loading-state" aria-live="polite">
          <div class="spinner" aria-hidden="true"></div>
          <p>{{ t('wallet.loading') }}</p>
        </div>

        <div v-else-if="transactions.length === 0" class="empty-state" role="status">
          <div class="empty-icon" aria-hidden="true">📭</div>
          <p>{{ t('wallet.noTransactions') }}</p>
        </div>

        <ul v-else class="tx-list" role="list">
          <li
            v-for="tx in transactions"
            :key="tx.id"
            class="tx-item scroll-reveal"
            data-animation="fadeInUp"
            role="button"
            tabindex="0"
            :aria-label="`${getTxLabel(tx.tx_type)}，${t('wallet.amount')} ${formatAmount(tx.amount)} ${t('wallet.yuan')}，${getAmountSign(tx.tx_type)}，${formatTime(tx.created_at)}`"
            @click="openTxDetail(tx)"
            @keydown.enter.prevent="openTxDetail(tx)"
            @keydown.space.prevent="openTxDetail(tx)"
          >
            <div class="tx-icon" :class="tx.tx_type" aria-hidden="true">
              <span>{{ getTxIcon(tx.tx_type) }}</span>
            </div>
            <div class="tx-info">
              <div class="tx-desc">{{ tx.description || getTxLabel(tx.tx_type) }}</div>
              <div class="tx-meta">
                <span class="tx-time">{{ formatTime(tx.created_at) }}</span>
                <span v-if="tx.related_order_no" class="tx-order">{{ t('wallet.order') }}: {{ tx.related_order_no }}</span>
              </div>
            </div>
            <div class="tx-amount" :class="getAmountClass(tx.tx_type)">
              <span class="amount-sign" aria-hidden="true">{{ getAmountSign(tx.tx_type) }}</span>
              <span class="amount-value">¥{{ formatAmount(tx.amount) }}</span>
            </div>
          </li>
        </ul>

        <!-- 分页 -->
        <nav
          v-if="totalPages > 1"
          class="pagination"
          role="navigation"
          :aria-label="t('wallet.pagination')"
        >
          <button
            type="button"
            class="page-btn"
            :disabled="currentPage === 1"
            :aria-label="t('wallet.prevPageAria', { current: currentPage, total: totalPages })"
            @click="currentPage--; loadTransactions()"
          >{{ t('wallet.prevPage') }}</button>
          <span class="page-info" aria-live="polite">{{ currentPage }} / {{ totalPages }}</span>
          <button
            type="button"
            class="page-btn"
            :disabled="currentPage === totalPages"
            :aria-label="t('wallet.nextPageAria', { current: currentPage, total: totalPages })"
            @click="currentPage++; loadTransactions()"
          >{{ t('wallet.nextPage') }}</button>
        </nav>
      </section>
    </div>

    <!-- 交易详情弹窗 -->
    <TransactionDetail
      v-if="selectedTx"
      v-model="showTxDetail"
      :transaction="selectedTx"
    />

    <!-- 充值弹窗 -->
    <RechargeDialog
      v-model="showRecharge"
      :balance="balance.balance"
      @success="handleRechargeSuccess"
    />

    <!-- 提现弹窗 -->
    <WithdrawDialog
      v-model="showWithdraw"
      :available="balance.balance"
      @success="handleWithdrawSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { useUserStore } from '@/stores/user'
import { useToast } from '@/composables/useToast'
import { useA11y } from '@/composables/useA11y'
import { useDarkModeStore } from '@/stores/darkMode'
import http from '@/utils/request'
import BalanceAlert from '@/components/BalanceAlert.vue'
import TransactionDetail from '@/components/TransactionDetail.vue'
import RechargeDialog from '@/components/RechargeDialog.vue'
import WithdrawDialog from '@/components/WithdrawDialog.vue'

interface Transaction {
  id: string
  user_id: string
  tx_type: string
  amount: number
  status: string
  description: string | null
  related_order_no: string | null
  created_at: string
}

interface Balance {
  user_id: string
  balance: number
  frozen: number
  updated_at: string
}

interface Summary {
  income: number
  expense: number
  net: number
  tx_count: number
  by_type: Record<string, number>
}

interface TrendPoint {
  date: string
  income: number
  expense: number
  net: number
  balance: number
}

const userStore = useUserStore()
const darkModeStore = useDarkModeStore()
const toast = useToast()
const { announce, focusFirst: _focusFirst, trapFocus: _trapFocus } = useA11y()

const balance = ref<Balance>({ user_id: '', balance: 0, frozen: 0, updated_at: '' })
const summary = ref<Summary>({ income: 0, expense: 0, net: 0, tx_count: 0, by_type: {} })
const trendPoints = ref<TrendPoint[]>([])
const transactions = ref<Transaction[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const filterTxType = ref<string>('all')
const filterDays = ref<number>(30)
const filterKeyword = ref<string>('')
const filterDateRange = ref<[string, string] | null>(null)
const filterMinAmount = ref<number | null>(null)
const filterMaxAmount = ref<number | null>(null)

const showRecharge = ref(false)
const showWithdraw = ref(false)
const showTxDetail = ref(false)
const selectedTx = ref<Transaction | null>(null)

const typeTabs = computed(() => [
  { label: t('wallet.typeAll'), value: 'all' },
  { label: t('wallet.typeIncome'), value: 'income' },
  { label: t('wallet.typeExpense'), value: 'expense' },
  { label: t('wallet.typeRefund'), value: 'refund' },
  { label: t('wallet.typeRecharge'), value: 'recharge' },
])

const summaryCards = computed(() => [
  { label: t('wallet.typeIncome'), value: summary.value.income, type: 'income', icon: '↑' },
  { label: t('wallet.typeExpense'), value: summary.value.expense, type: 'expense', icon: '↓' },
  { label: t('wallet.netIncome'), value: summary.value.net, type: 'net', icon: '∑' },
  { label: t('wallet.txCount'), value: summary.value.tx_count * 100, type: 'count', icon: '#' },
])

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const trendPath = computed(() => buildPath(trendPoints.value, true))
const trendLine = computed(() => buildPath(trendPoints.value, false))
const trendStrokeColor = computed(() => {
  // 依赖 isDarkMode 以便暗色模式切换时重新读取 CSS 变量
  const _isDark = darkModeStore.isDarkMode
  return getComputedStyle(document.documentElement).getPropertyValue('--el-text-color-primary').trim() || 'var(--el-text-color-primary)'
})

// 趋势图极值（供 aria-label 朗读使用）
const minTrendBalance = computed(() => {
  if (!trendPoints.value.length) return 0
  return Math.min(...trendPoints.value.map((p) => p.balance))
})
const maxTrendBalance = computed(() => {
  if (!trendPoints.value.length) return 0
  return Math.max(...trendPoints.value.map((p) => p.balance))
})

// Tablist 焦点导航（左右箭头切换，Home/End 跳到首尾）
const focusPrevTab = (event: KeyboardEvent) => {
  const idx = typeTabs.value.findIndex((tab) => tab.value === filterTxType.value)
  const prev = idx <= 0 ? typeTabs.value.length - 1 : idx - 1
  const target = (event.currentTarget as HTMLElement | null)?.parentElement?.children[prev] as HTMLElement | undefined
  target?.focus()
}
const focusNextTab = (event: KeyboardEvent) => {
  const idx = typeTabs.value.findIndex((tab) => tab.value === filterTxType.value)
  const next = idx >= typeTabs.value.length - 1 ? 0 : idx + 1
  const target = (event.currentTarget as HTMLElement | null)?.parentElement?.children[next] as HTMLElement | undefined
  target?.focus()
}

function buildPath(points: TrendPoint[], fill: boolean): string {
  if (!points.length) return ''
  const max = Math.max(...points.map((p) => p.balance), 1)
  const min = Math.min(...points.map((p) => p.balance), 0)
  const range = max - min || 1
  const w = 600
  const h = 200
  const step = w / Math.max(1, points.length - 1)
  let d = ''
  points.forEach((p, i) => {
    const x = i * step
    const y = h - ((p.balance - min) / range) * h
    d += (i === 0 ? 'M' : 'L') + x + ',' + y
  })
  if (fill) {
    d += ' L' + w + ',' + h + ' L0,' + h + ' Z'
  }
  return d
}

function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2)
}

function getTxIcon(type: string): string {
  return {
    income: '↑',
    expense: '↓',
    refund: '↩',
    recharge: '+',
    withdraw: '-',
  }[type] || '·'
}

function getTxLabel(type: string): string {
  return {
    income: t('wallet.typeIncome'),
    expense: t('wallet.typeExpense'),
    refund: t('wallet.typeRefund'),
    recharge: t('wallet.typeRecharge'),
    withdraw: t('wallet.withdraw'),
  }[type] || type
}

function getAmountSign(type: string): string {
  return ['income', 'refund', 'recharge'].includes(type) ? '+' : '-'
}

function getAmountClass(type: string): string {
  return ['income', 'refund', 'recharge'].includes(type) ? 'positive' : 'negative'
}

async function loadBalance() {
  try {
    const res: any = await http.get('/api/v1/wallet/balance', { params: { user_id: userStore.userId || 'user_001' } })
    if (res?.code === 0) {
      balance.value = res.data
    }
  } catch (_e) {
    // 余额加载失败时提示用户，避免显示 0 余额造成误解
    toast.error(t('common.errors.loadFailed'))
  }
}

async function loadSummary() {
  try {
    const res: any = await http.get('/api/v1/wallet/summary', { params: { user_id: userStore.userId || 'user_001', days: filterDays.value } })
    if (res?.code === 0) {
      summary.value = res.data
    }
  } catch (_e) {
    toast.error(t('common.errors.loadFailed'))
  }
}

async function loadTrend() {
  try {
    const res: any = await http.get('/api/v1/wallet/trend', { params: { user_id: userStore.userId || 'user_001', days: 30 } })
    if (res?.code === 0) {
      trendPoints.value = res.data.trend
    }
  } catch (_e) {
    toast.error(t('common.errors.loadFailed'))
  }
}

// 请求序号：用于 loadTransactions 竞态保护，仅最新请求的响应才会写入数据
let txRequestSeq = 0

async function loadTransactions() {
  const currentSeq = ++txRequestSeq
  loading.value = true
  loadError.value = null
  try {
    const params: Record<string, any> = {
      user_id: userStore.userId || 'user_001',
      page: currentPage.value,
      page_size: pageSize.value,
    }
    if (filterTxType.value !== 'all') params.tx_type = filterTxType.value
    if (filterKeyword.value.trim()) params.keyword = filterKeyword.value.trim()
    if (filterDateRange.value && filterDateRange.value.length === 2) {
      params.start_date = filterDateRange.value[0]
      params.end_date = filterDateRange.value[1] + 'T23:59:59'
    }
    if (filterMinAmount.value !== null && filterMinAmount.value >= 0) {
      params.min_amount = Math.round(filterMinAmount.value * 100)
    }
    if (filterMaxAmount.value !== null && filterMaxAmount.value >= 0) {
      params.max_amount = Math.round(filterMaxAmount.value * 100)
    }
    const res: any = await http.get('/api/v1/wallet/transactions', { params })
    // 竞态保护：若期间发起了新请求，丢弃本次过期响应
    if (currentSeq !== txRequestSeq) return
    if (res?.code === 0) {
      transactions.value = res.data.list
      total.value = res.data.total
      announce(`已加载第 ${currentPage.value} 页，共 ${total.value} 条交易记录`, { politeness: 'polite' })
    } else {
      loadError.value = '加载失败'
      announce('交易记录加载失败', { politeness: 'assertive' })
    }
  } catch (e: any) {
    if (currentSeq !== txRequestSeq) return
    loadError.value = e?.message || '加载失败'
    announce(`交易记录加载失败：${e?.message || '未知错误'}`, { politeness: 'assertive' })
  } finally {
    // 仅当本次是最新请求时才重置 loading，避免被过期请求提前重置
    if (currentSeq === txRequestSeq) {
      loading.value = false
    }
  }
}

function onDateChange() {
  currentPage.value = 1
  loadTransactions()
}

function resetFilters() {
  filterTxType.value = 'all'
  filterKeyword.value = ''
  filterDateRange.value = null
  filterMinAmount.value = null
  filterMaxAmount.value = null
  currentPage.value = 1
  loadTransactions()
  toast.info(t('common.messages.resetFilter'))
}

async function exportTx() {
  try {
    const res: any = await http.get('/api/v1/wallet/export', {
      params: { user_id: userStore.userId || 'user_001', format: 'csv' },
      responseType: 'blob',
    })
    const url = URL.createObjectURL(new Blob([res]))
    const a = document.createElement('a')
    a.href = url
    a.download = `wallet_${userStore.userId || 'user_001'}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t('common.exportSuccess'))
  } catch (_e) {
    toast.error(t('common.errors.exportFailed'))
  }
}

function handleRechargeSuccess() {
  showRecharge.value = false
  toast.success(t('common.messages.rechargeSubmitted'))
  loadBalance()
  loadTransactions()
  loadSummary()
}

function handleWithdrawSuccess() {
  showWithdraw.value = false
  toast.success(t('common.messages.withdrawSubmitted'))
  loadBalance()
  loadTransactions()
  loadSummary()
}

function openTxDetail(tx: Transaction) {
  selectedTx.value = tx
  showTxDetail.value = true
  // 屏幕阅读器播报
  nextTick(() => {
    announce(`已打开交易详情，${getTxLabel(tx.tx_type)}，金额 ${formatAmount(tx.amount)} 元`, {
      politeness: 'polite',
    })
  })
}

onMounted(() => {
  loadBalance()
  loadSummary()
  loadTrend()
  loadTransactions()
})
</script>

<style lang="scss" scoped>
@use '@/styles/variables' as v;

// 设计令牌
$text-sec: var(--el-text-color-secondary);
$text-main: var(--el-text-color-primary);
$brand-primary: v.$primary-color;

.wallet-page {
  min-height: 100vh;
  padding: 24px 0 60px;
  background: var(--el-bg-color-page);
}

.container {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.glass {
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.balance-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32px;
  background: linear-gradient(135deg, var(--el-text-color-primary), var(--el-text-color-regular));
  color: var(--el-bg-color);
  border-radius: var(--global-border-radius);

  .balance-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .balance-label {
    font-size: 14px;
    opacity: 0.8;
  }

  .balance-amount {
    display: flex;
    align-items: baseline;
    gap: 4px;

    .currency {
      font-size: 24px;
      font-weight: 600;
    }

    .value {
      font-size: 48px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
  }

  .balance-frozen {
    font-size: 12px;
    opacity: 0.7;
  }

  .balance-actions {
    display: flex;
    gap: 12px;
  }

  .action-btn {
    position: relative;
    overflow: hidden;
    min-width: 96px;
    height: 44px;
    padding: 0 24px;
    border-radius: var(--global-border-radius);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    border: none;
    transition: all 0.3s;

    .btn-text {
      position: relative;
      z-index: calc(var(--z-base) + 1);
    }

    &.primary {
      background: var(--el-bg-color);
      color: var(--el-text-color-primary);

      &:hover {
        transform: translateY(-2px);
      }
    }

    &.secondary {
      background: transparent;
      color: var(--el-bg-color);
      border: var(--unified-border);

      &:hover {
        background: var(--color-white-10);
      }
    }
  }
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;

  .summary-icon {
    width: 48px;
    height: 48px;
    border-radius: var(--global-border-radius);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    font-weight: 800;
    background: var(--color-black-5);

    &.income { background: var(--el-color-success-light-9); color: var(--el-color-success); }
    &.expense { background: var(--el-color-danger-light-9); color: var(--el-color-danger); }
    &.net { background: var(--el-color-primary-light-9); color: var(--color-blue-1890ff); }
    &.count { background: var(--el-color-warning-light-9); color: var(--el-color-warning); }
  }

  .summary-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .summary-label {
    font-size: 12px;
    color: $text-sec;
  }

  .summary-value {
    font-size: 20px;
    font-weight: 800;
    color: $text-main;
  }
}

.trend-card {
  padding: 24px;

  .section-title {
    font-size: 16px;
    font-weight: 800;
    margin: 0 0 16px;
  }

  .trend-chart {
    width: 100%;
    height: 200px;
  }

  .trend-svg {
    width: 100%;
    height: 200px;
  }

  .trend-labels {
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
    font-size: 11px;
    color: $text-sec;
  }

  .trend-label:nth-child(odd) {
    visibility: hidden;
  }
}

.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  flex-wrap: wrap;
  gap: 12px;
}

.filter-advanced {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  padding: 16px 24px;
  flex-wrap: wrap;

  .adv-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 200px;
  }

  .adv-label {
    font-size: 12px;
    font-weight: 700;
    color: $text-sec;
  }

  .adv-input {
    height: 32px;
    padding: 0 12px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    font-size: 13px;
    background: var(--el-bg-color);
    outline: none;
    transition: border-color 0.2s;

    &:focus {
      border-color: $brand-primary;
    }

    &.small {
      width: 90px;
    }
  }

  .adv-date {
    width: 100%;
  }

  .adv-amount {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .adv-sep {
    color: $text-sec;
  }

  .adv-unit {
    font-size: 12px;
    color: $text-sec;
  }

  .adv-actions {
    display: flex;
    gap: 8px;
  }

  .adv-btn {
    position: relative;
    overflow: hidden;
    height: 32px;
    padding: 0 16px;
    border-radius: var(--global-border-radius);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    border: var(--unified-border);
    background: transparent;
    color: $text-main;
    transition: all 0.2s;

    .btn-text {
      position: relative;
      z-index: calc(var(--z-base) + 1);
    }

    &.primary {
      background: var(--el-text-color-primary);
      color: var(--el-bg-color);
      border-color: var(--el-text-color-primary);

      &:hover {
        opacity: 0.85;
      }
    }

    &.secondary {
      &:hover {
        border-color: $brand-primary;
        color: $brand-primary;
      }
    }
  }
}

.filter-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-tab {
  padding: 6px 16px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  background: transparent;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;

  &.active {
    background: var(--el-text-color-primary);
    color: var(--el-bg-color);
    border-color: var(--el-text-color-primary);
  }

  &:hover:not(.active) {
    border-color: var(--el-text-color-primary);
  }
}

.filter-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-select {
  height: 32px;
  padding: 0 12px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  font-size: 13px;
  background: var(--el-bg-color);
}

.export-btn {
  position: relative;
  overflow: hidden;
  padding: 6px 20px;
  border-radius: var(--global-border-radius);
  background: transparent;
  color: $brand-primary;
  border: var(--unified-border);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: $brand-primary;
    color: var(--el-bg-color);
  }
}

.tx-container {
  padding: 16px 0;
}

.loading-state,
.empty-state,
.error-state {
  padding: 60px 20px;
  text-align: center;
  color: $text-sec;
}

.empty-icon,
.error-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.error-icon {
  color: $brand-primary;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--el-border-color);
  border-top-color: $brand-primary;
  border-radius: 50%;
  margin: 0 auto 12px;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.retry-btn {
  margin-top: 12px;
  padding: 6px 20px;
  border-radius: var(--global-border-radius);
  background: $brand-primary;
  color: var(--el-bg-color);
  border: none;
  font-weight: 700;
  cursor: pointer;
}

.tx-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.tx-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  border-bottom: var(--unified-border-bottom);
  transition: background 0.2s;
  cursor: pointer;

  &:hover {
    background: var(--color-black-2);
  }

  &:last-child {
    border-bottom: none;
  }

  .tx-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--global-border-radius);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 800;
    background: var(--color-black-5);

    &.income, &.refund, &.recharge {
      background: var(--el-color-success-light-9);
      color: var(--el-color-success);
    }

    &.expense, &.withdraw {
      background: var(--el-color-danger-light-9);
      color: var(--el-color-danger);
    }
  }

  .tx-info {
    flex: 1;
    min-width: 0;
  }

  .tx-desc {
    font-size: 14px;
    font-weight: 600;
    color: $text-main;
    margin-bottom: 4px;
  }

  .tx-meta {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: $text-sec;
  }

  .tx-amount {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 800;

    &.positive { color: var(--el-color-success); }
    &.negative { color: var(--el-color-danger); }
  }

  .amount-sign {
    margin-right: 2px;
  }

  .amount-value {
    font-size: 16px;
  }
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  border-top: var(--unified-border);
}

.page-btn {
  padding: 6px 16px;
  border-radius: var(--global-border-radius);
  background: transparent;
  color: $brand-primary;
  border: var(--unified-border);
  font-size: 13px;
  cursor: pointer;

  &:disabled {
    color: var(--el-text-color-disabled);
    border-color: var(--el-border-color);
    cursor: not-allowed;
  }
}

.page-info {
  font-size: 13px;
  color: $text-sec;
}

@media (width <= 720px) {
  .balance-card {
    flex-direction: column;
    text-align: center;
    gap: 20px;

    .balance-amount .value {
      font-size: 36px;
    }
  }

  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
