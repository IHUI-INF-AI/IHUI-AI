<template>
  <div class="edu-admin">
    <el-page-header :icon="ArrowLeft" content="返回" @back="goBack">
      <template #content>
        <span class="page-title">{{ t('edu.admin.title') }}</span>
      </template>
    </el-page-header>

    <div class="flex flex-wrap gap-[16px] stats-row" v-loading="loading">
      <div class="w-full sm:w-1/2 md:w-1/4" v-for="stat in stats" :key="stat.label">
        <Card class="stat-card transition-shadow hover:shadow-md">
          <div class="stat-icon" :style="{ background: stat.color }">
            <component :is="stat.icon" class="h-6 w-6" />
          </div>
          <div class="stat-body">
            <div class="stat-value">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </Card>
      </div>
    </div>

    <div class="flex flex-wrap gap-[16px] menu-row">
      <div class="w-1/2 sm:w-1/3 md:w-1/4" v-for="m in menus" :key="m.path">
        <Card class="menu-card transition-shadow hover:shadow-md" @click="goMenu(m.path)">
          <component :is="m.icon" class="h-8 w-8" :style="{ color: m.color }" />
          <div class="menu-label">{{ t(m.labelKey) }}</div>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Card } from '@/components/ui/card'
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft } from '@element-plus/icons-vue'
import {
  Reading, EditPen, ChatLineRound, Connection,
  VideoCamera, User, Coin, List, ChatDotRound, Folder, Search, Setting, Bell, Document
} from '@element-plus/icons-vue'

const { t } = useI18n()
const router = useRouter()
const loading = ref(false)

const stats = ref([
  { label: t('edu.admin.stats.totalCourses'), value: 0, color: '#1890ff', icon: markRaw(Reading) },
  { label: t('edu.admin.stats.totalStudents'), value: 0, color: '#52c41a', icon: markRaw(User) },
  { label: t('edu.admin.stats.totalRevenue'), value: '¥0', color: '#faad14', icon: markRaw(Coin) },
  { label: t('edu.admin.stats.todayActive'), value: 0, color: '#f5222d', icon: markRaw(Bell) },
])

const menus = ref([
  { path: '/admin/learn', labelKey: 'edu.admin.menu.course', icon: markRaw(Reading), color: '#1890ff' },
  { path: '/admin/exam', labelKey: 'edu.admin.menu.exam', icon: markRaw(EditPen), color: '#52c41a' },
  { path: '/admin/ask', labelKey: 'edu.admin.menu.ask', icon: markRaw(ChatLineRound), color: '#faad14' },
  { path: '/admin/circle', labelKey: 'edu.admin.menu.circle', icon: markRaw(Connection), color: '#f5222d' },
  { path: '/admin/live', labelKey: 'edu.admin.menu.live', icon: markRaw(VideoCamera), color: '#722ed1' },
  { path: '/admin/order', labelKey: 'edu.admin.menu.order', icon: markRaw(List), color: '#13c2c2' },
  { path: '/admin/member', labelKey: 'edu.admin.menu.member', icon: markRaw(User), color: '#eb2f96' },
  { path: '/admin/point', labelKey: 'edu.admin.menu.point', icon: markRaw(Coin), color: '#fa8c16' },
  { path: '/admin/message', labelKey: 'edu.admin.menu.message', icon: markRaw(ChatDotRound), color: '#a0d911' },
  { path: '/admin/notification', labelKey: 'edu.admin.menu.notification', icon: markRaw(Bell), color: '#1890ff' },
  { path: '/admin/resource', labelKey: 'edu.admin.menu.resource', icon: markRaw(Folder), color: '#52c41a' },
  { path: '/admin/search', labelKey: 'edu.admin.menu.search', icon: markRaw(Search), color: '#faad14' },
  { path: '/admin/setting', labelKey: 'edu.admin.menu.setting', icon: markRaw(Setting), color: '#722ed1' },
  { path: '/admin/article', labelKey: 'edu.admin.menu.course', icon: markRaw(Document), color: '#13c2c2' },
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
  border-radius: 8px;
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
  transition: transform 0.2s;
  margin-bottom: 16px;

  &:hover {
    
  }
}

.menu-label {
  margin-top: 12px;
  font-size: 14px;
  color: var(--el-text-color-regular);
}
</style>