<template>
  <div class="distribution-page">
    <div class="container">
      <!-- 核心资产概览 -->
      <header class="assets-header ihui-ai-fade-in-top-animation">
        <div class="header-left">
          <h1>{{ t('distribution.title') }}</h1>
          <p class="subtitle">{{ t('distribution.subtitle') }}</p>
        </div>
        <div class="header-right">
          <div v-for="s in statsCards" :key="s.label" class="asset-node">
            <span class="label">{{ s.label.toUpperCase() }}</span>
            <span class="value">{{ s.value }}</span>
          </div>
        </div>
      </header>

      <main class="main-hub ihui-ai-fade-in-top-animation">
        <!-- 快速指挥台 -->
        <section class="command-grid">
          <div class="cmd-card group ihui-ai-card-hover" @click="openInviteDialog">
            <div class="cmd-icon"><Share2 /></div>
            <div class="cmd-body">
              <h3>INVITE_UPLINK</h3>
              <p>GENERATE UNIQUE REFERRAL TOKEN</p>
            </div>
            <div class="cmd-edge"></div>
          </div>
          <div class="cmd-card group ihui-ai-card-hover" @click="openWithdrawDialog">
            <div class="cmd-icon"><Wallet /></div>
            <div class="cmd-body">
              <h3>WITHDRAW_PROTOCOL</h3>
              <p>TRANSFER EARNINGS TO SECURE ACCOUNT</p>
            </div>
            <div class="cmd-edge"></div>
          </div>
          <div class="cmd-card group ihui-ai-card-hover" @click="setActiveTab('records')">
            <div class="cmd-icon"><Activity /></div>
            <div class="cmd-body">
              <h3>DATA_RECORDS</h3>
              <p>ANALYZE TRANSACTION HISTORY</p>
            </div>
            <div class="cmd-edge"></div>
          </div>
        </section>

        <!-- 详细数据矩阵 -->
        <section class="data-matrix card-glass">
          <el-tabs v-model="activeTab" class="tech-tabs">
            <el-tab-pane label="ECO_OVERVIEW" name="overview">
              <div class="overview-grid">
                <!-- 趋势分析 -->
                <div class="trend-panel">
                  <div class="panel-header">
                    <h3>ANALYTIC_TRENDS</h3>
                    <div class="period-pills">
                      <button @click="chartPeriod = '7d'" :class="{ active: chartPeriod === '7d' }">7D</button>
                      <button @click="chartPeriod = '30d'" :class="{ active: chartPeriod === '30d' }">30D</button>
                    </div>
                  </div>
                  <div class="chart-placeholder">
                    <el-icon :size="48"><TrendCharts /></el-icon>
                    <p>REAL-TIME DATA STREAMING...</p>
                  </div>
                </div>

                <!-- 排行榜 -->
                <div class="rank-panel">
                  <h3>ELITE_LEADERBOARD</h3>
                  <div class="rank-list">
                    <div v-for="(item, i) in inviteRanking" :key="item.id" class="rank-row">
                      <span class="idx">{{ String(Number(i) + 1).padStart(2, '0') }}</span>
                      <img :src="item.avatar" :alt="item.username || '用户头像'" class="avatar" loading="lazy" />
                      <span class="name">{{ item.username }}</span>
                      <span class="earnings">¥{{ item.earnings }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="NODE_INVITES" name="invites">
              <div class="table-container">
                <el-table :data="paginatedInvites" class="tech-table">
                  <el-table-column label="ENTITY" width="200">
                    <template #default="{ row }">
                      <div class="entity-cell">
                        <img :src="row.avatar" :alt="row.username || '用户头像'" />
                        <span>{{ row.username }}</span>
                      </div>
                    </template>
                  </el-table-column>
                  <el-table-column prop="email" label="CHANNEL" />
                  <el-table-column label="STAMP" width="150">
                    <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
                  </el-table-column>
                  <el-table-column label="STATUS">
                    <template #default="{ row }">
                      <span class="status-tag" :class="row.status">{{ row.status.toUpperCase() }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="YIELD" width="120">
                    <template #default="{ row }">
                      <span class="yield-val">+¥{{ row.commission || 0 }}</span>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </el-tab-pane>
          </el-tabs>
        </section>
      </main>

      <el-dialog v-model="showInviteDialog" :title="t('distribution.inviteDialog.title')" width="480px" class="tech-dialog">
        <div class="invite-dialog-content">
          <p class="invite-desc">{{ t('distribution.inviteDialog.desc') }}</p>
          <div class="invite-link-box">
            <el-input v-model="inviteLink" readonly class="invite-link-input" />
            <el-button type="primary" @click="copyInviteLink">{{ t('common.copy') }}</el-button>
          </div>
        </div>
      </el-dialog>

      <el-dialog v-model="showWithdrawDialog" :title="t('distribution.withdrawDialog.title')" width="480px" class="tech-dialog">
        <el-form :model="withdrawForm" :rules="withdrawRules" label-width="100px">
          <el-form-item :label="t('distribution.withdrawDialog.amount')" prop="amount">
            <el-input v-model="withdrawForm.amount" type="number" :placeholder="t('distribution.withdrawDialog.amountPlaceholder')" />
          </el-form-item>
          <el-form-item :label="t('distribution.withdrawDialog.method')" prop="method">
            <el-select v-model="withdrawForm.method" style="width: 100%">
              <el-option label="支付宝" value="alipay" />
              <el-option label="微信" value="wechat" />
              <el-option label="银行卡" value="bank" />
            </el-select>
          </el-form-item>
          <el-form-item :label="t('distribution.withdrawDialog.account')" prop="account">
            <el-input v-model="withdrawForm.account" :placeholder="t('distribution.withdrawDialog.accountPlaceholder')" />
          </el-form-item>
          <el-form-item :label="t('distribution.withdrawDialog.realName')" prop="realName">
            <el-input v-model="withdrawForm.realName" :placeholder="t('distribution.withdrawDialog.realNamePlaceholder')" />
          </el-form-item>
          <el-form-item v-if="withdrawForm.method === 'bank'" :label="t('distribution.withdrawDialog.bankName')" prop="bankName">
            <el-input v-model="withdrawForm.bankName" :placeholder="t('distribution.withdrawDialog.bankNamePlaceholder')" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="closeWithdrawDialog">{{ t('common.cancel') }}</el-button>
          <el-button type="primary" :loading="withdrawing" @click="handleWithdraw">{{ t('common.confirm') }}</el-button>
        </template>
      </el-dialog>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Share2, Wallet, Activity, TrendCharts
} from '@/lib/lucide-fallback'
import { useDistributionTabs } from '@/composables/distribution/useDistributionTabs'
import { useDistributionStats } from '@/composables/distribution/useDistributionStats'
import { useDistributionInvites } from '@/composables/distribution/useDistributionInvites'
import { useDistributionInvite } from '@/composables/distribution/useDistributionInvite'
import { useDistributionWithdraw } from '@/composables/distribution/useDistributionWithdraw'
import { formatTime } from '@/utils/format'

const { t } = useI18n()
const _router = useRouter()

const { activeTab, chartPeriod, setActiveTab } = useDistributionTabs()
const { distributionStats, loadStats } = useDistributionStats({ onLoadSuccess: () => {} })
const { inviteRanking, paginatedInvites, loadInvites } = useDistributionInvites()
const { showInviteDialog, inviteLink, copyInviteLink, openInviteDialog: openInvite } = useDistributionInvite()
const { showWithdrawDialog, withdrawForm, withdrawRules, openWithdrawDialog: openWithdraw, closeWithdrawDialog, handleWithdraw, withdrawing } = useDistributionWithdraw({ availableBalance: distributionStats.value.totalEarnings || 0 })

const statsCards = computed(() => [
  { label: 'TOTAL_ASSETS', value: `¥${distributionStats.value.totalEarnings || 0}` },
  { label: 'ACTIVE_INVITES', value: distributionStats.value.totalInvites || 0 },
  { label: 'MONTHLY_YIELD', value: `¥${distributionStats.value.monthlyEarnings || 0}` },
])

const formatDate = (d: string | number | Date | null | undefined) => d ? formatTime(d, 'YYYY-MM-DD') : 'N/A'
const openInviteDialog = () => openInvite()
const openWithdrawDialog = () => openWithdraw()

onMounted(() => { loadStats(); loadInvites(); })
</script>

<style scoped lang="scss">
@use '@/styles/_breakpoints.scss' as bp;

/* ---------- 明亮模式（默认） ---------- */
.distribution-page {
  min-height: 100vh;
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
  position: relative;
  overflow-x: hidden;
}

.container { position: relative; z-index: var(--z-base); max-width: 1400px; margin: 0 auto; padding: 0 40px;

 @include bp.tablet-down { padding: 0 24px; } }

.hub-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 40px 0;
  font-family: var(--font-family-mono);
  .back-link { color: var(--el-text-color-secondary); font-size: 12px; font-weight: 800; &:hover { color: var(--el-text-color-primary); } }
  .hub-label { font-size: 12px; color: var(--el-text-color-secondary); font-weight: 800; letter-spacing: 2px; }
}

.assets-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 40px 0 80px;

  @include bp.tablet-down { flex-direction: column; align-items: flex-start; gap: 48px; }

  .header-left {
    .badge { display: inline-block; padding: 4px 12px; background: var(--el-bg-color); border: var(--unified-border); color: var(--el-color-primary); font-family: var(--font-family-mono); font-size: 12px; font-weight: 800; border-radius: var(--global-border-radius); margin-bottom: 24px; }
    h1 { font-size: 56px; font-weight: 900; letter-spacing: -3px; line-height: 1; margin-bottom: 16px; color: var(--el-text-color-primary); }
    .subtitle { color: var(--el-text-color-secondary); font-size: 18px; max-width: 500px; }
  }

  .header-right {
    display: flex;
    gap: 40px;

    .asset-node {
      text-align: right;
      .label { font-family: var(--font-family-mono); font-size: 12px; color: var(--el-text-color-secondary); font-weight: 800; letter-spacing: 2px; display: block; margin-bottom: 8px; }
      .value { font-family: var(--font-family-mono); font-size: 32px; font-weight: 900; color: var(--el-text-color-primary); }
    }
  }
}

.command-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin-bottom: 80px;

  @include bp.tablet-down { grid-template-columns: 1fr; }
}

.cmd-card {
  background: var(--el-bg-color);
  border: var(--unified-border);
  padding: 40px;
  border-radius: var(--global-border-radius);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.4s;
  display: flex;
  align-items: center;
  gap: 32px;

  &:hover {
    border: 2px solid var(--border-unified-color-hover);
    transform: translateY(-4px);
    background: var(--el-bg-color-hover);
    .cmd-icon { color: var(--el-color-primary); transform: scale(1.1); }
  }

  .cmd-icon { color: var(--el-color-primary); font-size: 32px; transition: all 0.4s; }

  .cmd-body {
    h3 { font-family: var(--font-family-mono); font-size: 14px; font-weight: 800; margin-bottom: 8px; color: var(--el-text-color-primary); }
    p { font-size: 12px; color: var(--el-text-color-secondary); font-weight: 700; }
  }
  .cmd-edge { position: absolute; top: 0; right: 0; width: 30px; height: 30px; background: var(--el-border-color); clip-path: polygon(100% 0, 100% 100%, 0 0); }
}

.data-matrix {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 40px;
  margin-bottom: 120px;
}

:deep(.tech-tabs) {
  .el-tabs__header { margin-bottom: 40px; border-bottom: var(--unified-border-bottom); }

  .el-tabs__item { font-family: var(--font-family-mono); font-size: 12px; font-weight: 800; color: var(--el-text-color-secondary);
    &.is-active { color: var(--el-color-primary); }
  }
  .el-tabs__active-bar { background: var(--el-color-primary); }
}

.overview-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 40px;

 @include bp.tablet-down { grid-template-columns: 1fr; } }

.trend-panel {
  .panel-header { display: flex; justify-content: space-between; margin-bottom: 32px; h3 { font-size: 16px; font-weight: 800; color: var(--el-text-color-primary); } }

  .period-pills {
    display: flex;
    gap: 8px;

    button {
      background: var(--el-bg-color-page);
      border: var(--unified-border);
      color: var(--el-text-color-secondary);
      font-family: var(--font-family-mono);
      font-size: 12px;
      padding: 4px 12px;
      border-radius: var(--global-border-radius);
      cursor: pointer;

      &.active {
        /* stylelint-disable color-no-hex -- 反相配对深底白字, 无对应 token */
        color: #fff;
        background: var(--el-text-color-primary);
        border-color: transparent;
        /* stylelint-enable color-no-hex */
      }
    }
  }

  .chart-placeholder {
    height: 300px;
    background: var(--el-bg-color-page);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    position: relative;
    overflow: hidden;
    p { font-family: var(--font-family-mono); font-size: 12px; color: var(--el-text-color-secondary); font-weight: 800; letter-spacing: 2px; }
  }
}

.rank-panel {
  h3 { font-size: 16px; font-weight: 800; margin-bottom: 32px; color: var(--el-text-color-primary); }
  .rank-list { display: flex; flex-direction: column; gap: 12px; }

  .rank-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px;
    border-radius: var(--global-border-radius);
    &:hover { background: var(--el-fill-color-light); }
    .idx { font-family: var(--font-family-mono); font-size: 12px; color: var(--el-text-color-secondary); font-weight: 800; }
    .avatar { width: 28px; height: 28px; border-radius: var(--global-border-radius); }
    .name { flex: 1; font-size: 14px; font-weight: 600; color: var(--el-text-color-secondary); }
    .earnings { font-family: var(--font-family-mono); font-size: 13px; font-weight: 800; color: var(--el-color-primary); }
  }
}

:deep(.tech-table) {
  background: transparent;

  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: transparent;
  --el-table-border-color: var(--el-border-color);

  .el-table__inner-wrapper::before { display: none; }
  th.el-table__cell { font-family: var(--font-family-mono); font-size: 12px; color: var(--el-text-color-secondary); font-weight: 800; text-transform: uppercase; border-bottom: var(--unified-border-bottom); }
  td.el-table__cell { padding: 20px 0; border-bottom: var(--unified-border-bottom); color: var(--el-text-color-regular); font-size: 13px; }
}

.entity-cell { display: flex; align-items: center; gap: 12px; img { width: 32px; height: 32px; border-radius: var(--global-border-radius); border: var(--unified-border); } }

.status-tag {
  font-family: var(--font-family-mono);
  font-size: 12px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  color: var(--el-text-color-secondary);
  &.active { color: var(--color-emerald-500); border-color: var(--color-emerald-10b981-20); }
  &.paid { color: var(--el-color-primary); border-color: color-mix(in srgb, var(--el-color-primary) 20%, transparent); }
}

.yield-val { font-family: var(--font-family-mono); font-weight: 800; color: var(--el-color-primary); }

@keyframes sweep { from { transform: translateY(-100%); } to { transform: translateY(100%); } }

/* ---------- 暗色模式覆盖 ---------- */
html.dark .distribution-page {
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
}

:where(html.dark) .distribution-page .hub-nav {
  .back-link { color: var(--el-text-color-secondary); &:hover { color: var(--el-text-color-primary); } }
  .hub-label { color: var(--el-text-color-secondary); }
}

:where(html.dark) .distribution-page .assets-header {
  .badge { background: var(--el-fill-color-dark); border-color: var(--border-unified-color); }
  h1 { color: var(--el-text-color-primary); }
  .subtitle { color: var(--el-text-color-secondary); }
  .asset-node .label { color: var(--el-text-color-secondary); }
  .asset-node .value { color: var(--el-text-color-primary); }
}

:where(html.dark) .distribution-page .cmd-card {
  background: var(--el-bg-color);
  border-color: var(--border-unified-color);
  &:hover { background: var(--el-bg-color-hover); .cmd-icon { color: var(--el-color-primary); } }
  .cmd-body p { color: var(--el-text-color-secondary); }
  .cmd-edge { background: var(--el-border-color); clip-path: polygon(100% 0, 100% 100%, 0 0); }
}

:where(html.dark) .distribution-page .data-matrix {
  background: var(--el-fill-color-dark);
  border-color: var(--border-unified-color);
}

html.dark .distribution-page :deep(.tech-tabs) {
  .el-tabs__header { border-bottom-color: var(--border-unified-color); }
  .el-tabs__item { color: var(--el-text-color-secondary); &.is-active { color: var(--el-color-primary); } }
}

:where(html.dark) .distribution-page .trend-panel {
  /* stylelint-disable color-no-hex -- 反相配对深字, 无对应 token */
  .period-pills button { background: var(--el-bg-color-page); border-color: var(--border-unified-color); color: var(--el-text-color-regular); &.active { color: #1a1a1a; background: var(--el-text-color-primary); border-color: var(--border-unified-color-hover); } }
  /* stylelint-enable color-no-hex */
  .chart-placeholder { background: var(--el-bg-color-page); border-color: var(--border-unified-color); p { color: var(--el-text-color-secondary); } }
}

:where(html.dark) :where(.distribution-page) .rank-panel .rank-row {
  &:hover { background: var(--el-fill-color-light); }
  .idx { color: var(--el-text-color-secondary); }
  .name { color: var(--el-text-color-regular); }
}

html.dark .distribution-page :deep(.tech-table) {
  --el-table-border-color: var(--border-unified-color);
  th.el-table__cell { color: var(--el-text-color-regular); border-bottom-color: var(--border-unified-color); }
  td.el-table__cell { border-bottom-color: var(--border-unified-color); color: var(--el-text-color-regular); }
}

html.dark .distribution-page .entity-cell img { border-color: var(--border-unified-color); }

:where(html.dark) .distribution-page .status-tag { border-color: var(--border-unified-color); color: var(--el-text-color-secondary); }

.invite-dialog-content {
  .invite-desc { color: var(--el-text-color-secondary); margin-bottom: 16px; }
  .invite-link-box { display: flex; gap: 12px; align-items: center; }
  .invite-link-input { flex: 1; }
}
</style>
