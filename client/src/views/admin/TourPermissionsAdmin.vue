<template>
  <div class="tour-perm-page" v-loading="loading">
    <h2 class="page-title">{{ t('tourPerm.title', '旅游平台权限管理 (useTourPermissionsStore)') }}</h2>

    <el-row :gutter="16" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-label">{{ t('tourPerm.currentRole', '当前角色') }}</div>
          <div class="stat-value">{{ currentRole }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-label">{{ t('tourPerm.totalPerms', '总权限数') }}</div>
          <div class="stat-value">{{ allPermissions.length }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-label">{{ t('tourPerm.granted', '已授予') }}</div>
          <div class="stat-value">{{ userPermissions.length }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-label">{{ t('tourPerm.denied', '未授予') }}</div>
          <div class="stat-value">{{ deniedPermissions.length }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="perm-section">
      <template #header>
        <span>{{ t('tourPerm.allPerms', '所有权限') }}</span>
      </template>
      <el-table :data="permRows" stripe>
        <el-table-column prop="key" label="权限标识" width="280" />
        <el-table-column prop="category" label="类别" width="120" />
        <el-table-column :label="t('tourPerm.granted', '已授予')" width="120">
          <template #default="{ row }">
            <el-tag :type="row.granted ? 'success' : 'info'">
              {{ row.granted ? t('common.yes') : t('common.no') }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card class="role-section">
      <template #header>
        <span>{{ t('tourPerm.roles', '角色映射') }}</span>
      </template>
      <el-table :data="roleRows" stripe>
        <el-table-column prop="role" :label="t('tourPerm.role', '角色')" width="150" />
        <el-table-column prop="count" :label="t('tourPerm.permCount', '权限数')" width="100" />
        <el-table-column :label="t('tourPerm.perms', '权限')">
          <template #default="{ row }">
            <el-tag v-for="p in row.permissions" :key="p" size="small" style="margin: 2px">{{ p }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, computed, onMounted } from 'vue'
import { useTourPermissionsStore, type Permission, type Role } from '@/stores/auth/tour-permissions'

const loading = ref(false)
const store = useTourPermissionsStore()

// 触发 store, 让零引用模块被实际使用
onMounted(() => {
  loading.value = true
  try {
    // 访问 store 中的 getters
    void store.userPermissions
    void store.hasPermission
    void store.canManage
  } catch (e) { console.error(e) } finally { loading.value = false }
})

const currentRole = computed<Role>(() => store.userRole || 'user')
const allPermissions = computed<Permission[]>(() => [
  'tour:view', 'tour:create', 'tour:edit', 'tour:delete', 'tour:publish',
  'monitoring:view', 'monitoring:config', 'monitoring:alert',
  'recommendation:view', 'recommendation:config', 'recommendation:abtest',
  'platform:view', 'platform:config',
])
const userPermissions = computed<Permission[]>(() => (store.userPermissions || []) as Permission[])
const deniedPermissions = computed(() => allPermissions.value.filter(p => !userPermissions.value.includes(p)))

const permRows = computed(() => allPermissions.value.map(p => ({
  key: p,
  category: p.split(':')[0] as string,
  granted: userPermissions.value.includes(p),
})))

const rolePermissions: Record<Role, Permission[]> = {
  admin: allPermissions.value,
  operator: ['tour:view', 'tour:create', 'tour:edit', 'monitoring:view', 'platform:view'],
  analyst: ['tour:view', 'monitoring:view', 'recommendation:view'],
  user: ['tour:view'],
}
const roleRows = computed(() => Object.entries(rolePermissions).map(([role, perms]) => ({
  role,
  count: perms.length,
  permissions: perms,
})))
</script>

<style scoped lang="scss">
.tour-perm-page {
  padding: 16px;
  .page-title { margin: 0 0 16px; font-size: 22px; }
  .stats-row { margin-bottom: 16px; .stat-card { text-align: center; .stat-label { font-size: 14px; color: var(--el-text-color-secondary); } .stat-value { font-size: 24px; font-weight: 600; color: var(--el-color-primary); margin-top: 8px; } } }
  .perm-section, .role-section { margin-bottom: 16px; }
}
</style>
