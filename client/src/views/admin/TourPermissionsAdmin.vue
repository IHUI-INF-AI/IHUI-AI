<template>
  <div class="tour-perm-page" v-loading="loading">
    <h2 class="page-title">{{ t('tourPerm.title', '旅游平台权限管理 (useTourPermissionsStore)') }}</h2>

    <div class="flex flex-wrap gap-4 stats-row">
      <div class="w-1/4">
        <Card class="stat-card p-5">
          <div class="stat-label">{{ t('tourPerm.currentRole', '当前角色') }}</div>
          <div class="stat-value">{{ currentRole }}</div>
        </Card>
      </div>
      <div class="w-1/4">
        <Card class="stat-card p-5">
          <div class="stat-label">{{ t('tourPerm.totalPerms', '总权限数') }}</div>
          <div class="stat-value">{{ allPermissions.length }}</div>
        </Card>
      </div>
      <div class="w-1/4">
        <Card class="stat-card p-5">
          <div class="stat-label">{{ t('tourPerm.granted', '已授予') }}</div>
          <div class="stat-value">{{ userPermissions.length }}</div>
        </Card>
      </div>
      <div class="w-1/4">
        <Card class="stat-card p-5">
          <div class="stat-label">{{ t('tourPerm.denied', '未授予') }}</div>
          <div class="stat-value">{{ deniedPermissions.length }}</div>
        </Card>
      </div>
    </div>

    <Card class="perm-section"><CardHeader>
        <span>{{ t('tourPerm.allPerms', '所有权限') }}</span>
      </CardHeader><CardContent class="p-5">
            <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-[280px]">权限标识</TableHead>
            <TableHead class="w-[120px]">类别</TableHead>
            <TableHead class="w-[120px]">{{ t('tourPerm.granted', '已授予') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(row, index) in permRows" :key="row.key ?? index">
            <TableCell>{{ row.key }}</TableCell>
            <TableCell>{{ row.category }}</TableCell>
            <TableCell>
              <Tag :type="row.granted ? 'success' : 'info'">
                {{ row.granted ? t('common.yes') : t('common.no') }}
              </Tag>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </CardContent></Card>

    <Card class="role-section"><CardHeader>
        <span>{{ t('tourPerm.roles', '角色映射') }}</span>
      </CardHeader><CardContent class="p-5">
            <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-[150px]">{{ t('tourPerm.role', '角色') }}</TableHead>
            <TableHead class="w-[100px]">{{ t('tourPerm.permCount', '权限数') }}</TableHead>
            <TableHead>{{ t('tourPerm.perms', '权限') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(row, index) in roleRows" :key="row.role ?? index">
            <TableCell>{{ row.role }}</TableCell>
            <TableCell>{{ row.count }}</TableCell>
            <TableCell>
              <Tag v-for="p in row.permissions" :key="p" size="small" style="margin: 2px">{{ p }}</Tag>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </CardContent></Card>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, computed, onMounted } from 'vue'
import { useTourPermissionsStore, type Permission, type Role } from '@/stores/auth/tour-permissions'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Tag } from '@/components/ui/tag'

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
  .stats-row { margin-bottom: 16px; .stat-card { text-align: center; .stat-label { font-size: 14px; color: hsl(var(--muted-foreground)); } .stat-value { font-size: 24px; font-weight: 600; color: hsl(var(--primary)); margin-top: 8px; } } }
  .perm-section, .role-section { margin-bottom: 16px; }
}
</style>
