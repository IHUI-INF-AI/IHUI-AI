<template>
  <div class="permission-manager">
    <div class="permission-header">
      <h2>{{ $t('permission.title') }}</h2>
      <div class="header-actions">
        <el-button type="primary" @click="showCreateRole = true">
          <el-icon><Plus /></el-icon>
          {{ $t('permission.createRole') }}
        </el-button>
        <el-button @click="refreshData">
          <el-icon><Refresh /></el-icon>
          {{ $t('common.refresh') }}
        </el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="permission-tabs">
      <el-tab-pane :label="$t('permission.roles')" name="roles">
        <div class="role-list">
          <el-card v-for="role in roles" :key="role.role_id" class="role-card">
            <template #header>
              <div class="role-header">
                <span class="role-name">{{ role.display_name }}</span>
                <el-tag v-if="role.is_system" type="info" size="small">{{ $t('permissionManager.systemRole') }}</el-tag>
              </div>
            </template>
            <div class="role-info">
              <p class="role-desc">{{ role.description }}</p>
              <div class="role-permissions">
                <el-tag
                  v-for="perm in getRolePermissions(role.role_id)"
                  :key="perm.permission_id"
                  size="small"
                  class="perm-tag"
                >
                  {{ perm.display_name }}
                </el-tag>
              </div>
            </div>
            <template #footer>
              <el-button size="small" @click="editRole(role)">
                {{ $t('common.edit') }}
              </el-button>
              <el-button v-if="!role.is_system" size="small" type="danger" @click="deleteRole(role)">
                {{ $t('common.delete') }}
              </el-button>
            </template>
          </el-card>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="$t('permission.users')" name="users">
        <div class="user-toolbar">
          <el-input
            v-model="userSearch"
            :placeholder="$t('permission.searchUser')"
            prefix-icon="Search"
            clearable
            class="search-input"
          />
        </div>
        <el-table :data="filteredUsers" style="width: 100%">
          <el-table-column prop="username" :label="$t('permission.username')" />
          <el-table-column prop="display_name" :label="$t('permission.displayName')" />
          <el-table-column prop="email" :label="$t('permission.email')" />
          <el-table-column :label="$t('permission.roles')">
            <template #default="{ row }">
              <el-tag v-for="r in row.roles" :key="r.role_id" size="small" class="role-tag">
                {{ r.display_name }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="$t('common.actions')" width="200">
            <template #default="{ row }">
              <el-button size="small" @click="assignRoleToUser(row)">
                {{ $t('permission.assignRole') }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane :label="$t('permission.permissions')" name="permissions">
        <el-table :data="permissions" style="width: 100%">
          <el-table-column prop="display_name" :label="$t('permission.permissionName')" />
          <el-table-column prop="name" :label="$t('permission.permissionKey')" />
          <el-table-column prop="resource" :label="$t('permission.resource')" />
          <el-table-column prop="action" :label="$t('permission.action')" />
        </el-table>
      </el-tab-pane>

      <el-tab-pane :label="$t('permission.fileAccess')" name="access">
        <div class="access-toolbar">
          <el-input
            v-model="accessFileId"
            :placeholder="$t('permission.enterFileId')"
            class="file-id-input"
          />
          <el-button type="primary" @click="loadFileAccess">
            {{ $t('permission.query') }}
          </el-button>
        </div>
        <el-table :data="fileAccessList" style="width: 100%">
          <el-table-column prop="user_id" :label="$t('permission.userId')" />
          <el-table-column prop="permission" :label="$t('permission.permission')" />
          <el-table-column prop="granted_by" :label="$t('permission.grantedBy')" />
          <el-table-column prop="granted_at" :label="$t('permission.grantedAt')">
            <template #default="{ row }">
              {{ formatDate(row.granted_at) }}
            </template>
          </el-table-column>
          <el-table-column :label="$t('common.actions')" width="150">
            <template #default="{ row }">
              <el-button size="small" type="danger" @click="revokeAccess(row)">
                {{ $t('permission.revoke') }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="showCreateRole" :title="$t('permission.createRole')" width="500px">
      <el-form :model="newRole" label-width="100px">
        <el-form-item :label="$t('permission.roleName')">
          <el-input v-model="newRole.name" />
        </el-form-item>
        <el-form-item :label="$t('permission.displayName')">
          <el-input v-model="newRole.display_name" />
        </el-form-item>
        <el-form-item :label="$t('permission.description')">
          <el-input v-model="newRole.description" type="textarea" />
        </el-form-item>
        <el-form-item :label="$t('permission.permissions')">
          <el-checkbox-group v-model="newRole.permission_ids">
            <el-checkbox
              v-for="perm in permissions"
              :key="perm.permission_id"
              :value="perm.permission_id"
            >
              {{ perm.display_name }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateRole = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="createRole">{{ $t('common.confirm') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showAssignRole" :title="$t('permission.assignRole')" width="400px">
      <el-form label-width="80px">
        <el-form-item :label="$t('permission.user')">
          <span>{{ selectedUser?.username }}</span>
        </el-form-item>
        <el-form-item :label="$t('permission.roles')">
          <el-select v-model="selectedRoleIds" multiple style="width: 100%">
            <el-option
              v-for="role in roles"
              :key="role.role_id"
              :label="role.display_name"
              :value="role.role_id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAssignRole = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="saveUserRole">{{ $t('common.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">

import { useI18n } from 'vue-i18n'

const { t } = useI18n()
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'
import { useRbac } from '@/utils/rbac'
import { formatDateTime } from '@/utils/format'

const formatDate = (date: string | number | Date) => formatDateTime(date)

interface Role {
  role_id: string
  name: string
  display_name: string
  description?: string
  is_system: boolean
}

interface Permission {
  permission_id: string
  name: string
  display_name: string
  resource: string
  action: string
}

interface User {
  user_id: string
  username: string
  display_name: string
  email: string
  roles: Role[]
}

interface FileAccess {
  user_id: string
  permission: string
  granted_by: string | null
  granted_at: string
  expires_at?: string | null
}

const {
  getRoles, createRole: apiCreateRole, getRolePermissions: fetchRolePermissions,
  getPermissions, assignRole,
  getFileAccessList, revokeFileAccess
} = useRbac()

const activeTab = ref('roles')
const roles = ref<Role[]>([])
const permissions = ref<Permission[]>([])
const users = ref<User[]>([])
const userSearch = ref('')
const accessFileId = ref('')
const fileAccessList = ref<FileAccess[]>([])

const showCreateRole = ref(false)
const showAssignRole = ref(false)
const selectedUser = ref<User | null>(null)
const selectedRoleIds = ref<string[]>([])

const newRole = ref({
  name: '',
  display_name: '',
  description: '',
  permission_ids: [] as string[]
})

const rolePermissionsMap = ref<Record<string, Permission[]>>({})

const filteredUsers = computed(() => {
  if (!userSearch.value) return users.value
  const query = userSearch.value.toLowerCase()
  return users.value.filter(u =>
    u.username.toLowerCase().includes(query) ||
    u.display_name?.toLowerCase().includes(query) ||
    u.email?.toLowerCase().includes(query)
  )
})


async function refreshData() {
  await Promise.all([loadRoles(), loadPermissions()])
}

async function loadRoles() {
  try {
    roles.value = await getRoles()
    for (const role of roles.value) {
      rolePermissionsMap.value[role.role_id] = await fetchRolePermissions(role.role_id)
    }
  } catch {
    ElMessage.error(t('permission.loadRolesFailed'))
  }
}

async function loadPermissions() {
  try {
    permissions.value = await getPermissions()
  } catch {
    ElMessage.error(t('permission.loadPermissionsFailed'))
  }
}

function _getLocalRolePermissions(roleId: string): Permission[] {
  return rolePermissionsMap.value[roleId] || []
}

async function createRole() {
  if (!newRole.value.name || !newRole.value.display_name) {
    ElMessage.warning(t('permission.fillRoleName'))
    return
  }

  try {
    await apiCreateRole(newRole.value)
    ElMessage.success(t('permission.roleCreateSuccess'))
    showCreateRole.value = false
    newRole.value = { name: '', display_name: '', description: '', permission_ids: [] }
    await loadRoles()
  } catch {
    ElMessage.error(t('permission.createRoleFailed'))
  }
}

function editRole(_role: Role) {
  ElMessage.info(t('permission.editDev'))
}

async function deleteRole(role: Role) {
  try {
    await ElMessageBox.confirm(t('permission.confirmDelete', { name: role.display_name }), t('permission.confirmDeleteTitle'), { type: 'warning' })
    ElMessage.success(t('permission.roleDeleteSuccess'))
    await loadRoles()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(t('permission.deleteRoleFailed'))
    }
  }
}

function assignRoleToUser(user: User) {
  selectedUser.value = user
  selectedRoleIds.value = user.roles?.map(r => r.role_id) || []
  showAssignRole.value = true
}

async function saveUserRole() {
  if (!selectedUser.value) return

  try {
    for (const roleId of selectedRoleIds.value) {
      await assignRole(selectedUser.value.user_id, roleId)
    }
    ElMessage.success(t('permission.roleAssignSuccess'))
    showAssignRole.value = false
  } catch {
    ElMessage.error(t('permission.roleAssignFailed'))
  }
}

async function loadFileAccess() {
  if (!accessFileId.value) {
    ElMessage.warning(t('permission.enterFileId'))
    return
  }

  try {
    fileAccessList.value = await getFileAccessList(accessFileId.value)
  } catch {
    ElMessage.error(t('permission.queryFileAccessFailed'))
  }
}

async function revokeAccess(access: FileAccess) {
  try {
    await ElMessageBox.confirm(t('permission.confirmRevoke'), t('permission.revokeTitle'), { type: 'warning' })
    await revokeFileAccess(accessFileId.value, access.user_id)
    ElMessage.success(t('permission.revokeSuccess'))
    await loadFileAccess()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(t('permission.revokeFailed'))
    }
  }
}

onMounted(() => {
  refreshData()
})
</script>

<style scoped>
.permission-manager {
  padding: 20px;
}

.permission-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.permission-header h2 {
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.permission-tabs {
  margin-top: 20px;
}

.role-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.role-card {
  margin-bottom: 0;
}

.role-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.role-name {
  font-weight: 600;
  font-size: 16px;
}

.role-desc {
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
}

.role-permissions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.perm-tag {
  margin: 0;
}

.user-toolbar,
.access-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.search-input {
  width: 300px;
}

.file-id-input {
  width: 300px;
}

.role-tag {
  margin-right: 4px;
}
</style>
