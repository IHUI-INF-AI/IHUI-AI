<template>
  <div class="p19-page">
    <h2 class="p19-title">{{ t('p19AdminDashboard.title') }}</h2>
    <el-row :gutter="16" v-loading="loading">
      <el-col v-for="(item, i) in cards" :key="i" :span="6">
        <el-card shadow="hover">
          <div class="p19-card">
            <div class="p19-card-label">{{ item.label }}</div>
            <div class="p19-card-value">{{ item.value }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>
    <el-card class="p19-margin">
      <h3>{{ t('p19AdminDashboard.recentActivity') }}</h3>
      <el-table :data="logs" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="admin" label="Admin" width="120" />
        <el-table-column prop="action" label="操作" width="140" />
        <el-table-column prop="target" label="目标" />
        <el-table-column prop="created_at" label="时间" width="200" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { adminApi } from '@/api/admin'
import { getAdminActivities } from '@/api/admin-activities'

const { t } = useI18n()
const loading = ref(false)
const cards = ref<Array<{ label: string; value: string }>>([])
const logs = ref<unknown[]>([])

onMounted(async () => {
  loading.value = true
  try {
    const r = await adminApi.dashboardStats() as unknown as { data?: Record<string, unknown> }
    const d = r.data || {}
    cards.value = [
      { label: '用户', value: String(d.userCount ?? 0) },
      { label: '订单', value: String(d.orderCount ?? 0) },
      { label: '课程', value: String(d.courseCount ?? 0) },
      { label: '营收', value: '¥' + Number(d.revenue || 0).toFixed(2) },
    ]
    const lr = await getAdminActivities({ page: 1, pageSize: 20 }) as unknown as { data?: { list?: unknown[] } }
    logs.value = (lr.data?.list || []).map((a: unknown) => {
      const item = a as Record<string, unknown>
      return {
        id: item.id,
        admin: item.userName || item.userId,
        action: item.type,
        target: item.description || '',
        created_at: item.createdAt,
      }
    })
  } catch (e: unknown) {
    const err = e as { message?: string }
    ElMessage.error(t('common.errors.loadFailed') + ': ' + (err?.message || e))
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.p19-page {
  padding: 24px;
}

.p19-title {
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 600;
}

.p19-card-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.p19-card-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.p19-margin {
  margin-top: 16px;
}
</style>
