<template>
  <div class="edu-admin">
    <el-page-header :icon="ArrowLeft" content="返回" @back="goBack">
      <template #content>
        <span class="page-title">{{ t('edu.admin.title') }}</span>
      </template>
    </el-page-header>

    <el-row :gutter="16" class="stats-row" v-loading="loading">
      <el-col :xs="24" :sm="12" :md="6" v-for="stat in stats" :key="stat.label">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-icon" :style="{ background: stat.color }">
            <el-icon :size="24"><component :is="stat.icon" /></el-icon>
          </div>
          <div class="stat-body">
            <div class="stat-value">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="menu-row">
      <el-col :xs="12" :sm="8" :md="6" v-for="m in menus" :key="m.path">
        <el-card class="menu-card" shadow="hover" @click="goMenu(m.path)">
          <el-icon :size="32" :color="m.color"><component :is="m.icon" /></el-icon>
          <div class="menu-label">{{ t(m.labelKey) }}</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft } from '@element-plus/icons-vue'
import {
  Reading, Notebook, EditPen, ChatLineRound, Connection,
  VideoCamera, User, Coin, List, ChatDotRound, Folder, Search, Setting, Bell, Document
} from '@element-plus/icons-vue'

const { t } = useI18n()
const router = useRouter()
const loading = ref(false)

const stats = ref([
  { label: t('edu.admin.stats.totalCourses'), value: 0, color: '#1890ff', icon: Reading },
  { label: t('edu.admin.stats.totalStudents'), value: 0, color: '#52c41a', icon: User },
  { label: t('edu.admin.stats.totalRevenue'), value: '¥0', color: '#faad14', icon: Coin },
  { label: t('edu.admin.stats.todayActive'), value: 0, color: '#f5222d', icon: Bell },
])

const menus = ref([
  { path: '/admin/learn', labelKey: 'edu.admin.menu.course', icon: Reading, color: '#1890ff' },
  { path: '/admin/exam', labelKey: 'edu.admin.menu.exam', icon: EditPen, color: '#52c41a' },
  { path: '/admin/ask', labelKey: 'edu.admin.menu.ask', icon: ChatLineRound, color: '#faad14' },
  { path: '/admin/circle', labelKey: 'edu.admin.menu.circle', icon: Connection, color: '#f5222d' },
  { path: '/admin/live', labelKey: 'edu.admin.menu.live', icon: VideoCamera, color: '#722ed1' },
  { path: '/admin/order', labelKey: 'edu.admin.menu.order', icon: List, color: '#13c2c2' },
  { path: '/admin/member', labelKey: 'edu.admin.menu.member', icon: User, color: '#eb2f96' },
  { path: '/admin/point', labelKey: 'edu.admin.menu.point', icon: Coin, color: '#fa8c16' },
  { path: '/admin/message', labelKey: 'edu.admin.menu.message', icon: ChatDotRound, color: '#a0d911' },
  { path: '/admin/notification', labelKey: 'edu.admin.menu.notification', icon: Bell, color: '#1890ff' },
  { path: '/admin/resource', labelKey: 'edu.admin.menu.resource', icon: Folder, color: '#52c41a' },
  { path: '/admin/search', labelKey: 'edu.admin.menu.search', icon: Search, color: '#faad14' },
  { path: '/admin/setting', labelKey: 'edu.admin.menu.setting', icon: Setting, color: '#722ed1' },
  { path: '/admin/article', labelKey: 'edu.admin.menu.course', icon: Document, color: '#13c2c2' },
])

function goBack() {
  router.back()
}

function goMenu(path: string) {
  router.push(path)
}

onMounted(async () => {
  loading.value = true
  // TODO: load real stats from backend
  // For now, show placeholders to demonstrate the layout
  await new Promise((r) => setTimeout(r, 300))
  stats.value[0].value = 124
  stats.value[1].value = 5832
  stats.value[2].value = '¥84,560'
  stats.value[3].value = 421
  loading.value = false
})
</script>

<style scoped lang="scss">
.edu-admin {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}
.page-title {
  font-size: 20px;
  font-weight: 600;
}
.stats-row {
  margin: 24px 0;
}
.stat-card {
  display: flex;
  align-items: center;
  padding: 16px;
  :deep(.el-card__body) {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 16px;
  }
}
.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-primary);
  margin-right: 16px;
}
.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}
.menu-row {
  margin-top: 16px;
}
.menu-card {
  cursor: pointer;
  text-align: center;
  padding: 32px 16px;
  transition: all 0.2s;
  margin-bottom: 16px;
  &:hover {
    transform: translateY(-4px);
  }
}
.menu-label {
  margin-top: 12px;
  font-size: 14px;
  color: #606266;
}
</style>