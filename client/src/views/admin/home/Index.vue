<template>
  <div class="admin-home-page" v-loading="loading">
    <h2 class="page-title">{{ t('adminHomeIndex.dataOverview') }}</h2>
    <div class="stat-grid">
      <div v-for="s in stats" :key="s.key" class="stat-card" :style="{ borderLeftColor: s.color }">
        <div class="stat-icon" :style="{ color: s.color }"><el-icon :size="32"><component :is="s.icon" /></el-icon></div>
        <div class="stat-body">
          <div class="stat-value">{{ s.value }}</div>
          <div class="stat-label">{{ s.label }}</div>
        </div>
      </div>
    </div>
    <div class="quick-grid">
      <router-link v-for="q in quickEntries" :key="q.path" :to="q.path" class="quick-card">
        <el-icon :size="24" :color="q.color"><component :is="q.icon" /></el-icon>
        <span class="quick-label">{{ q.title }}</span>
        <span class="quick-sub">{{ q.sub }}</span>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, markRaw } from 'vue'
import { User, Reading, ShoppingCart, Money, Promotion, VideoCamera, ChatDotRound, EditPen } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { adminApi } from '@/api/admin/admin'

const { t } = useI18n()
const loading = ref(false)
const stats = ref([
  { key: 'user', label: t('adminHomeIndex.totalUsers'), value: '0', color: 'var(--el-color-primary)', icon: markRaw(User) },
  { key: 'course', label: t('adminHomeIndex.totalCourses'), value: '0', color: 'var(--el-color-success)', icon: markRaw(Reading) },
  { key: 'order', label: t('adminHomeIndex.totalOrders'), value: '0', color: 'var(--el-color-warning)', icon: markRaw(ShoppingCart) },
  { key: 'revenue', label: t('adminHomeIndex.totalRevenue'), value: '¥0', color: 'var(--el-color-danger)', icon: markRaw(Money) },
])
const quickEntries = [
  { title: t('adminHomeIndex.memberManage'), sub: t('adminHomeIndex.memberManageSub'), path: '/admin/member/list', icon: User, color: 'var(--el-color-primary)' },
  { title: t('adminHomeIndex.courseManage'), sub: t('adminHomeIndex.courseManageSub'), path: '/admin/learn/lesson', icon: Reading, color: 'var(--el-color-success)' },
  { title: t('adminHomeIndex.liveManage'), sub: t('adminHomeIndex.liveManageSub'), path: '/admin/live/channel', icon: VideoCamera, color: 'var(--el-color-warning)' },
  { title: t('adminHomeIndex.orderManage'), sub: t('adminHomeIndex.orderManageSub'), path: '/admin/learn/order', icon: ShoppingCart, color: 'var(--el-color-danger)' },
  { title: t('adminHomeIndex.askManage'), sub: t('adminHomeIndex.askManageSub'), path: '/admin/ask/question', icon: ChatDotRound, color: 'var(--el-color-info)' },
  { title: t('adminHomeIndex.examManage'), sub: t('adminHomeIndex.examManageSub'), path: '/admin/exam/list', icon: EditPen, color: 'var(--el-color-primary)' },
  { title: t('adminHomeIndex.carouselManage'), sub: t('adminHomeIndex.carouselManageSub'), path: '/admin/setting/carousel', icon: Promotion, color: 'var(--el-color-success)' },
  { title: t('adminHomeIndex.rolePermission'), sub: t('adminHomeIndex.rolePermissionSub'), path: '/admin/auth/role', icon: EditPen, color: 'var(--el-color-warning)' },
]
async function load() {
  loading.value = true
  try {
    const r = await adminApi.dashboardStats()
    const d: any = (r as any).data || {}
    if (d.userCount !== undefined) stats.value[0].value = String(d.userCount)
    if (d.courseCount !== undefined) stats.value[1].value = String(d.courseCount)
    if (d.orderCount !== undefined) stats.value[2].value = String(d.orderCount)
    if (d.revenue !== undefined) stats.value[3].value = '¥' + d.revenue
  } finally { loading.value = false }
}
onMounted(load)
</script>

<style scoped lang="scss">
:where(.admin-home-page) {
  .page-title { margin: 0 0 16px; font-size: 22px; color: var(--el-text-color-primary); }
  .stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }

  .stat-card {
    display: flex; align-items: center; gap: 16px;
    padding: 20px; background: var(--el-bg-color);
    border-radius: var(--global-border-radius);
    border-left: 4px solid var(--el-color-primary);
    }
  .stat-value { font-size: 24px; font-weight: 700; color: var(--el-text-color-primary); }
  .stat-label { font-size: 13px; color: var(--el-text-color-secondary); margin-top: 4px; }
  .quick-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }

  .quick-card {
    display: flex; flex-direction: column; gap: 6px;
    padding: 16px; background: var(--el-bg-color);
    border-radius: var(--global-border-radius);
    text-decoration: none;
    transition: transform 0.2s, border-color 0.2s;
    border: var(--unified-border);
    &:hover {  border-color: var(--el-color-primary); }
    .quick-label { font-size: 14px; font-weight: 500; color: var(--el-text-color-primary); }
    .quick-sub { font-size: 12px; color: var(--el-text-color-secondary); }
  }
}
</style>
