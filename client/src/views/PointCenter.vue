<template>
  <div class="point-center-page page-container">
    <div class="page-header">
      <h1 class="page-title">{{ t('pointCenter.title') }}</h1>
      <p class="page-subtitle">{{ t('pointCenter.subtitle') }}</p>
    </div>

    <div class="account-card">
      <div class="account-info">
        <span class="account-label">{{ t('pointCenter.availablePoints') }}</span>
        <span class="account-num">{{ account.available_point || 0 }}</span>
        <div class="account-meta">
          <span>{{ t('pointCenter.total') }}: {{ account.total_point || 0 }}</span>
          <span>{{ t('pointCenter.used') }}: {{ account.used_point || 0 }}</span>
          <span>{{ t('pointCenter.level') }}: Lv.{{ account.level || 1 }}</span>
        </div>
      </div>
      <button class="signin-btn" :disabled="signinLoading || signedToday" @click="handleSignin">
        {{ signedToday ? t('pointCenter.signedToday') : t('pointCenter.dailySignin') }}
      </button>
    </div>

    <div class="tabs-row">
      <button v-for="tab in tabs" :key="tab.key" :class="['tab-btn', { active: activeTab === tab.key }]" @click="activeTab = tab.key">
        {{ tab.label }}
      </button>
    </div>

    <div v-loading="loading" class="tab-content">
      <div v-if="activeTab === 'logs'" class="log-list">
        <div v-if="logs.length === 0" class="empty-state">
          <div class="empty-icon">📋</div>
          <p>{{ t('pointCenter.noLogs') }}</p>
        </div>
        <ul v-else class="log-items">
          <li v-for="l in logs" :key="l.id" :class="['log-item', l.type]">
            <div class="log-main">
              <span class="log-desc">{{ l.description || l.action }}</span>
              <span class="log-time">{{ formatTime(l.create_time) }}</span>
            </div>
            <span :class="['log-point', l.type]">{{ l.type === 'add' ? '+' : '' }}{{ l.point }}</span>
          </li>
        </ul>
      </div>

      <div v-if="activeTab === 'goods'" class="goods-list">
        <div v-if="goods.length === 0" class="empty-state">
          <div class="empty-icon">🎁</div>
          <p>{{ t('pointCenter.noGoods') }}</p>
        </div>
        <div v-else class="goods-grid">
          <div v-for="g in goods" :key="g.id" class="goods-card">
            <div class="goods-image">🎁</div>
            <h3 class="goods-name">{{ g.name }}</h3>
            <p class="goods-desc">{{ g.description }}</p>
            <div class="goods-foot">
              <span class="goods-cost">{{ g.point_cost }} {{ t('pointCenter.points') }}</span>
              <span class="goods-stock">{{ t('pointCenter.stock') }} {{ g.stock }}</span>
            </div>
            <button class="exchange-btn" :disabled="g.stock <= 0" @click="handleExchange(g)">{{ t('pointCenter.exchangeNow') }}</button>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'exchanges'" class="exchange-list">
        <div v-if="exchanges.length === 0" class="empty-state">
          <div class="empty-icon">📦</div>
          <p>{{ t('pointCenter.noExchanges') }}</p>
        </div>
        <ul v-else class="exchange-items">
          <li v-for="e in exchanges" :key="e.id" class="exchange-item">
            <span class="ex-name">{{ e.goods_name }}</span>
            <span class="ex-cost">{{ e.total_point }} {{ t('pointCenter.points') }}</span>
            <span :class="['ex-status', `status-${e.status}`]">{{ getStatusLabel(e.status) }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import http from '@/utils/request'
import { useToast } from '@/composables/useToast'
import { ElMessageBox } from 'element-plus'

interface Account {
  total_point: number
  available_point: number
  used_point: number
  level: number
}

interface Log {
  id: number
  type: string
  action: string
  point: number
  balance: number
  description: string
  create_time: string
}

interface Goods {
  id: number
  name: string
  description: string
  point_cost: number
  stock: number
  sold_num: number
}

interface Exchange {
  id: number
  goods_name: string
  total_point: number
  status: number
}

const toast = useToast()
const { t } = useI18n()
const loading = ref(false)
const account = ref<Account>({ total_point: 0, available_point: 0, used_point: 0, level: 1 })
const logs = ref<Log[]>([])
const goods = ref<Goods[]>([])
const exchanges = ref<Exchange[]>([])
const activeTab = ref('logs')
const signinLoading = ref(false)
const signedToday = ref(false)

const tabs = computed(() => [
  { key: 'logs', label: t('pointCenter.tabLogs') },
  { key: 'goods', label: t('pointCenter.tabGoods') },
  { key: 'exchanges', label: t('pointCenter.tabExchanges') },
])

function formatTime(time: string) {
  if (!time) return ''
  return time.slice(0, 16).replace('T', ' ')
}

function getStatusLabel(s: number) {
  return [
    t('pointCenter.statusPending'),
    t('pointCenter.statusShipped'),
    t('pointCenter.statusCompleted'),
    t('pointCenter.statusCancelled'),
  ][s] || t('pointCenter.statusUnknown')
}

async function loadAccount() {
  try {
    const res = await http.get('/point/account')
    account.value = res?.data || account.value
  } catch {
    /* silent */
  }
}

async function loadLogs() {
  loading.value = true
  try {
    const res = await http.get('/point/log/list', { params: { page: 1, limit: 50 } })
    logs.value = res?.data?.data || res?.data || []
  } catch {
    /* silent */
  } finally {
    loading.value = false
  }
}

async function loadGoods() {
  loading.value = true
  try {
    const res = await http.get('/point/goods/list', { params: { page: 1, limit: 20 } })
    goods.value = res?.data?.data || res?.data || []
  } catch {
    /* silent */
  } finally {
    loading.value = false
  }
}

async function loadExchanges() {
  loading.value = true
  try {
    const res = await http.get('/point/exchange/list', { params: { page: 1, limit: 20 } })
    exchanges.value = res?.data?.data || res?.data || []
  } catch {
    /* silent */
  } finally {
    loading.value = false
  }
}

async function handleSignin() {
  signinLoading.value = true
  try {
    const res = await http.post('/point/signin')
    const data = res?.data || {}
    if (data.ok) {
      toast.success(t('pointCenter.signinSuccess', { point: data.point }))
      signedToday.value = true
      loadAccount()
      loadLogs()
    } else {
      toast.error(data.reason === 'daily_limit' ? t('pointCenter.signedToday') : t('pointCenter.signinFailed'))
    }
  } catch {
    toast.error(t('pointCenter.signinFailed'))
  } finally {
    signinLoading.value = false
  }
}

async function handleExchange(g: Goods) {
  try {
    await ElMessageBox.confirm(t('pointCenter.exchangeConfirm', { name: g.name, cost: g.point_cost }), t('pointCenter.exchangeConfirmTitle'), {
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    const _res = await http.post('/point/exchange', { goods_id: g.id, quantity: 1 })
    toast.success(t('pointCenter.exchangeSuccess'))
    loadAccount()
    loadExchanges()
    loadGoods()
  } catch (e: any) {
    toast.error(e?.response?.data?.message || t('pointCenter.exchangeFailed'))
  }
}

onMounted(() => {
  loadAccount()
  loadLogs()
})
</script>

<style scoped>
.page-container {
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px 16px;
}

.page-header {
  margin-bottom: 16px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: $text-main;
  margin: 0;
}

.page-subtitle {
  font-size: 14px;
  color: $text-sec;
  margin: 4px 0 0;
}

.account-card {
  background: linear-gradient(135deg, var(--color-rank-avatar-start), var(--color-rank-avatar-end));
  color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  padding: 20px 24px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.account-label {
  font-size: 13px;
  opacity: 0.9;
}

.account-num {
  font-size: 32px;
  font-weight: 600;
  display: block;
  margin: 4px 0;
}

.account-meta {
  display: flex;
  gap: 14px;
  font-size: 12px;
  opacity: 0.85;
}

.signin-btn {
  background: var(--el-bg-color);
  color: var(--el-color-primary);
  border: none;
  border-radius: var(--global-border-radius);
  padding: 8px 18px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.signin-btn:disabled {
  background: var(--el-fill-color-lighter);
  cursor: not-allowed;
}

.tabs-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.tab-btn {
  padding: 6px 14px;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  font-size: 14px;
  color: $text-main;
}

.tab-btn.active {
  background: $brand-primary;
  color: var(--el-bg-color);
  border-color: $brand-primary;
}

.tab-content {
  min-height: 300px;
}

.log-list,
.exchange-list {
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
}

.log-items,
.exchange-items {
  list-style: none;
  padding: 0;
  margin: 0;
}

.log-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: var(--unified-border-bottom);
}

.log-item:last-child {
  border-bottom: none;
}

.log-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.log-desc {
  font-size: 14px;
  color: $text-main;
}

.log-time {
  font-size: 12px;
  color: $text-sec;
}

.log-point {
  font-size: 16px;
  font-weight: 500;
}

.log-point.add {
  color: var(--el-color-success);
}

.log-point.reduce {
  color: var(--el-color-danger);
}

.goods-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.goods-card {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.goods-image {
  font-size: 40px;
  text-align: center;
  padding: 16px 0;
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
}

.goods-name {
  font-size: 15px;
  font-weight: 500;
  color: $text-main;
  margin: 0;
}

.goods-desc {
  font-size: 12px;
  color: $text-sec;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.goods-foot {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.goods-cost {
  color: $brand-primary;
  font-weight: 500;
}

.goods-stock {
  color: $text-sec;
}

.exchange-btn {
  background: $brand-primary;
  color: var(--el-bg-color);
  border: none;
  border-radius: var(--global-border-radius);
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
}

.exchange-btn:disabled {
  background: var(--el-fill-color-light);
  cursor: not-allowed;
}

.exchange-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: var(--unified-border-bottom);
  gap: 12px;
}

.ex-name {
  flex: 1;
  font-size: 14px;
  color: $text-main;
}

.ex-cost {
  font-size: 14px;
  color: $brand-primary;
  font-weight: 500;
}

.ex-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: var(--global-border-radius);
}

.ex-status.status-0 {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
}

.ex-status.status-1 {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.ex-status.status-2 {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.ex-status.status-3 {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: $text-sec;
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 12px;
}
</style>
