<template>
  <div class="distribution-team-page page-container">
    <!-- 页面头部 -->
    <div class="page-header radius-auto">
      <h1 class="page-title">
        <el-icon class="title-icon"><Users /></el-icon>
        {{ t('distributionTeam.title') }}
      </h1>
      <p class="page-subtitle">{{ t('distributionTeam.subtitle') }}</p>
    </div>

    <!-- 搜索和筛选 -->
    <div class="search-section radius-auto">
      <div class="search-bar">
        <el-input
          v-model="searchText"
          :placeholder="t('distributionTeam.searchPlaceholder')"
          prefix-icon="Search"
          clearable
          @input="handleSearch"
        />
      </div>

      <!-- Tab筛选 -->
      <div class="tab-container">
        <div
          v-for="tab in tabs"
          :key="tab.value"
          class="tab-item"
          :class="{ active: activeTab === tab.value }"
          @click="handleTabChange(tab.value)"
        >
          {{ tab.label }}
        </div>
      </div>

      <!-- 统计信息 -->
      <div class="stats-bar">
        <span>{{ t('distributionTeam.totalMembers', { count: teamTotal }) }}</span>
        <span>{{ t('distributionTeam.totalCommission') }} ¥{{ totalCommission.toFixed(2) }}</span>
      </div>
    </div>

    <!-- 团队成员列表 -->
    <div class="team-content radius-auto">
      <GlobalLoading v-if="loading" />

      <el-empty
        v-else-if="filteredTeamList.length === 0"
        :description="t('distributionTeam.noMembers')"
      />

      <div v-else class="team-list">
        <div
          v-for="(member, index) in paginatedTeamList"
          :key="member.id"
          class="person-card"
          @click="viewTeamDetail(member.id)"
        >
          <!-- 排名徽章 -->
          <div class="medal">
            <img
              v-if="Number(index) < 3"
              class="medal-img"
              :src="`https://file.aizhs.top/sys-mini/No${Number(index) + 1}@3x.png`"
              alt="勋章"
              loading="lazy"
            />
            <span v-else class="medal-num">{{ Number(index) + 1 }}</span>
          </div>

          <!-- 用户信息 -->
          <div class="person-left">
            <div class="avatar-wrap">
              <img
                v-if="member.avatar"
                class="avatar"
                :src="member.avatar"
                :alt="member.nickname"
                loading="lazy"
              />
              <img
                v-else
                class="avatar"
                src="/images/common/userIcon.svg"
                alt="用户头像"
                loading="lazy"
              />
            </div>
            <div class="person-name">{{ member.nickname }}</div>
          </div>

          <!-- 详细信息 -->
          <div class="person-info">
            <div class="info-row">
              <div>{{ t('distributionTeam.transactionVolume') }}：<span class="highlight">{{ formatToYuan(member.transactionVolume) }}</span></div>
              <div>{{ t('distributionTeam.commission') }}：<span class="highlight">{{ formatToYuan(member.commission) }}</span></div>
            </div>
            <div class="info-row">
              {{ t('distributionTeam.orderCount') }}：<span class="highlight">{{ member.orderNum }}</span>
            </div>
            <div class="info-row">
              {{ t('distributionTeam.inviteTime') }}：<span>{{ formatDate(member.createdAt) }}</span>
            </div>
          </div>

          <!-- 联系按钮 -->
          <img
            v-if="isVip === 2"
            class="contact-btn-img"
            src="https://file.aizhs.top/sys-mini/team1.png"
            alt="联系按钮"
            loading="lazy"
            @click="contactMember(member.openId)"
          />
        </div>
      </div>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="filteredTeamList.length"
          layout="total, sizes, prev, pager, next, jumper"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Users } from '@/lib/lucide-fallback'
import { useDistributionInvites } from '@/composables/distribution/useDistributionInvites'
import GlobalLoading from '@/components/common/GlobalLoading.vue'
import { logger } from '@/utils/logger'
import { formatTime } from '@/utils/format'

const router = useRouter()
const { t } = useI18n()

// 复用useDistributionInvites Composable
const {
  inviteSearch,
  loadingInvites,
  pagination,
  filteredInvites,
  totalCommission,
  loadInvites,
  handleInviteSearch,
} = useDistributionInvites()

// 搜索文本（双向绑定用）
const searchText = computed({
  get: () => inviteSearch.value,
  set: (val: string) => handleInviteSearch(val),
})

// 加载状态
const loading = computed(() => loadingInvites.value)

// Tab 状态
const activeTab = ref('all')

// Tab 配置
const tabs = computed(() => [
  { label: t('distributionTeam.tabAll'), value: 'all' },
  { label: t('distributionTeam.tabActive'), value: 'active' },
  { label: t('distributionTeam.tabInactive'), value: 'inactive' },
])

// 团队总数
const teamTotal = computed(() => filteredInvites.value.length)

// 筛选后的团队列表（映射为模板需要的格式）
const filteredTeamList = computed(() => {
  return filteredInvites.value.map(invite => ({
    id: invite.uuid,
    nickname: invite.nickname || invite.username || '未知用户',
    avatar: invite.avatar,
    transactionVolume: invite.total_amount || 0,
    commission: invite.total_commission || 0,
    orderNum: invite.order_count || 0,
    createdAt: invite.created_at,
    openId: invite.openid || invite.uuid,
  }))
})

// 分页后的团队列表
const paginatedTeamList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredTeamList.value.slice(start, end)
})

// VIP 状态（默认为普通用户）
const isVip = ref(0)

// 分页计算属性
const currentPage = computed({
  get: () => pagination.pagination.page,
  set: (val: number) => {
    pagination.pagination.page = val
  },
})

const pageSize = computed({
  get: () => pagination.pagination.pageSize,
  set: (val: number) => {
    pagination.pagination.pageSize = val
  },
})

// 工具方法
const formatDate = (date: string | Date | null | undefined) => {
  if (!date) return '-'
  return formatTime(date, 'YYYY-MM-DD')
}

// 格式化金额（分转元）
const formatToYuan = (amount: number | undefined | null) => {
  if (!amount) return '¥0.00'
  return `¥${(amount / 100).toFixed(2)}`
}

// 处理搜索
const handleSearch = () => {
  // 搜索时重置分页
  pagination.pagination.page = 1
}

// 处理 Tab 切换
const handleTabChange = (tabValue: string) => {
  activeTab.value = tabValue
  pagination.pagination.page = 1
}

// 联系成员
const contactMember = (openId: string) => {
  // 可以实现联系功能，如打开聊天窗口
  logger.debug('Contact member:', openId)
}

// 查看团队成员详情
const viewTeamDetail = (uuid: string) => {
  router.push(`/distribution/team/${uuid}`)
}

// 页面加载
onMounted(() => {
  loadInvites()
})
</script>

<style scoped lang="scss">
@use '@/styles/desktop-layout.scss' as *;

.distribution-team-page {
  width: 100%;
  min-height: 100vh;
  background-color: var(--el-bg-color-page);
  padding: $desktop-page-padding;
  max-width: 100%;
  margin: 0 auto;

  @media (width <= $desktop-breakpoint-xs) {
    padding: $desktop-page-padding-mobile;
  }
}

.page-header {
  margin-bottom: $desktop-section-gap;
  padding: 24px;
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.page-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 0 0 8px;

  @media (width <= $desktop-breakpoint-sm) {
    font-size: 20px;
  }

  @media (width <= $desktop-breakpoint-xs) {
    font-size: 18px;
  }
}

.title-icon {
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.page-subtitle {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0;

  @media (width <= $desktop-breakpoint-xs) {
    font-size: 12px;
  }
}

.team-content {
  margin-bottom: $desktop-section-gap;
  padding: 24px;
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);

  @media (width <= $desktop-breakpoint-xs) {
    padding: 16px;
  }
}

.team-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 16px;
}

.search-filters {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.team-summary {
  display: flex;
  gap: 24px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.team-table {
  margin-top: 20px;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.commission-amount {
  color: var(--el-color-primary);
  font-weight: 600;
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
