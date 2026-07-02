<template>
  <div class="auth-management-page" v-loading="loading">
    <h2 class="page-title">{{ t('adminAuth.title', '认证与账户管理') }}</h2>

    <el-tabs v-model="activeTab" class="auth-tabs">
      <!-- 用户认证信息 -->
      <el-tab-pane :label="t('adminAuth.tab.info', '认证信息')" name="info">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('info')">{{ t('common.add') }}</el-button>
          <el-button @click="reloadInfo">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="infoList" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="userId" label="用户ID" width="100" />
          <el-table-column prop="realName" label="真实姓名" />
          <el-table-column prop="idCard" label="身份证" />
          <el-table-column prop="verified" label="已认证" width="100">
            <template #default="{ row }">
              <el-tag :type="row.verified ? 'success' : 'info'">
                {{ row.verified ? t('common.yes') : t('common.no') }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="t('common.operation')" width="180" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="onEdit('info', row)">{{ t('common.edit') }}</el-button>
              <el-button size="small" link type="danger" @click="onDelete('info', row)">{{ t('common.delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 第三方账号 -->
      <el-tab-pane :label="t('adminAuth.tab.accounts', '第三方账号')" name="accounts">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('accounts')">{{ t('common.add') }}</el-button>
          <el-button @click="reloadAccounts">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="accountList" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="userId" label="用户ID" width="100" />
          <el-table-column prop="platform" label="平台" width="120" />
          <el-table-column prop="openId" label="OpenID" />
          <el-table-column prop="unionId" label="UnionID" />
          <el-table-column :label="t('common.operation')" width="180" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="onEdit('accounts', row)">{{ t('common.edit') }}</el-button>
              <el-button size="small" link type="danger" @click="onDelete('accounts', row)">{{ t('common.delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- API Token -->
      <el-tab-pane :label="t('adminAuth.tab.tokens', 'API Token')" name="tokens">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('tokens')">{{ t('common.add') }}</el-button>
          <el-button @click="reloadTokens">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="tokenList" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="userId" label="用户ID" width="100" />
          <el-table-column prop="name" label="Token 名称" />
          <el-table-column prop="scopes" label="权限范围" />
          <el-table-column prop="expiresAt" label="过期时间" width="180" />
          <el-table-column :label="t('common.operation')" width="180" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="onEdit('tokens', row)">{{ t('common.edit') }}</el-button>
              <el-button size="small" link type="danger" @click="onDelete('tokens', row)">{{ t('common.delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 验证码 -->
      <el-tab-pane :label="t('adminAuth.tab.veriCodes', '验证码')" name="veriCodes">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('veriCodes')">{{ t('common.add') }}</el-button>
          <el-button @click="reloadVeriCodes">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="veriCodeList" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="target" label="目标(手机/邮箱)" width="180" />
          <el-table-column prop="code" label="验证码" width="120" />
          <el-table-column prop="purpose" label="用途" width="120" />
          <el-table-column prop="expiresAt" label="过期时间" width="180" />
          <el-table-column :label="t('common.operation')" width="180" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="onEdit('veriCodes', row)">{{ t('common.edit') }}</el-button>
              <el-button size="small" link type="danger" @click="onDelete('veriCodes', row)">{{ t('common.delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- VIP 用户 -->
      <el-tab-pane :label="t('adminAuth.tab.userVip', 'VIP用户')" name="userVip">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('userVip')">{{ t('common.add') }}</el-button>
          <el-button @click="reloadUserVip">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="userVipList" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="userId" label="用户ID" width="100" />
          <el-table-column prop="levelId" label="等级ID" width="100" />
          <el-table-column prop="startTime" label="开始时间" width="180" />
          <el-table-column prop="endTime" label="结束时间" width="180" />
          <el-table-column :label="t('common.operation')" width="180" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="onEdit('userVip', row)">{{ t('common.edit') }}</el-button>
              <el-button size="small" link type="danger" @click="onDelete('userVip', row)">{{ t('common.delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- VIP 等级 -->
      <el-tab-pane :label="t('adminAuth.tab.vipLevel', 'VIP等级')" name="vipLevel">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('vipLevel')">{{ t('common.add') }}</el-button>
          <el-button @click="reloadVipLevel">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="vipLevelList" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="等级名称" width="150" />
          <el-table-column prop="level" label="等级" width="80" />
          <el-table-column prop="price" label="价格" width="100" />
          <el-table-column prop="durationDays" label="时长(天)" width="100" />
          <el-table-column prop="description" label="描述" />
          <el-table-column :label="t('common.operation')" width="180" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="onEdit('vipLevel', row)">{{ t('common.edit') }}</el-button>
              <el-button size="small" link type="danger" @click="onDelete('vipLevel', row)">{{ t('common.delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

// 7 个 auth 类 API 集中接入
import {
  getAuthInfoList, createAuthInfo, updateAuthInfo, deleteAuthInfo, exportAuthInfo,
} from '@/api/auth/auth-info'
import {
  getAuthAccountList, createAuthAccount, updateAuthAccount, deleteAuthAccount, exportAuthAccount,
} from '@/api/auth/auth-accounts'
import {
  getAuthTokenList, createAuthToken, updateAuthToken, deleteAuthToken, exportAuthToken,
} from '@/api/auth/auth-tokens'
import {
  getAuthVeriCodeList, createAuthVeriCode, updateAuthVeriCode, deleteAuthVeriCode, exportAuthVeriCode,
} from '@/api/auth/auth-veri-codes'
import {
  getAuthUserVipList, createAuthUserVip, updateAuthUserVip, deleteAuthUserVip, exportAuthUserVip,
} from '@/api/auth/auth-user-vip'
import {
  getAuthVipLevelList, createAuthVipLevel, updateAuthVipLevel, deleteAuthVipLevel, exportAuthVipLevel,
} from '@/api/auth/auth-vip-level'
import {
  createAuthUser,
} from '@/api/auth/auth-user'

const activeTab = ref('info')
const loading = ref(false)

const infoList = ref<unknown[]>([])
const accountList = ref<unknown[]>([])
const tokenList = ref<unknown[]>([])
const veriCodeList = ref<unknown[]>([])
const userVipList = ref<unknown[]>([])
const vipLevelList = ref<unknown[]>([])

async function reloadInfo() {
  loading.value = true
  try { infoList.value = ((await getAuthInfoList())?.data as unknown as unknown[]) || [] }
  catch (e) { console.error(e) } finally { loading.value = false }
}
async function reloadAccounts() {
  loading.value = true
  try { accountList.value = ((await getAuthAccountList())?.data as unknown as unknown[]) || [] }
  catch (e) { console.error(e) } finally { loading.value = false }
}
async function reloadTokens() {
  loading.value = true
  try { tokenList.value = ((await getAuthTokenList())?.data as unknown as unknown[]) || [] }
  catch (e) { console.error(e) } finally { loading.value = false }
}
async function reloadVeriCodes() {
  loading.value = true
  try { veriCodeList.value = ((await getAuthVeriCodeList())?.data as unknown as unknown[]) || [] }
  catch (e) { console.error(e) } finally { loading.value = false }
}
async function reloadUserVip() {
  loading.value = true
  try { userVipList.value = ((await getAuthUserVipList())?.data as unknown as unknown[]) || [] }
  catch (e) { console.error(e) } finally { loading.value = false }
}
async function reloadVipLevel() {
  loading.value = true
  try { vipLevelList.value = ((await getAuthVipLevelList())?.data as unknown as unknown[]) || [] }
  catch (e) { console.error(e) } finally { loading.value = false }
}

type Tab = 'info' | 'accounts' | 'tokens' | 'veriCodes' | 'userVip' | 'vipLevel'

const handlers: Record<Tab, { create: (p: any) => Promise<any>; update: (p: any) => Promise<any>; remove: (id: any) => Promise<any> }> = {
  info: { create: createAuthInfo, update: updateAuthInfo, remove: deleteAuthInfo },
  accounts: { create: createAuthAccount, update: updateAuthAccount, remove: deleteAuthAccount },
  tokens: { create: createAuthToken, update: updateAuthToken, remove: deleteAuthToken },
  veriCodes: { create: createAuthVeriCode, update: updateAuthVeriCode, remove: deleteAuthVeriCode },
  userVip: { create: createAuthUserVip, update: updateAuthUserVip, remove: deleteAuthUserVip },
  vipLevel: { create: createAuthVipLevel, update: updateAuthVipLevel, remove: deleteAuthVipLevel },
}

async function onCreate(tab: Tab) {
  const h = handlers[tab]
  try {
    await h.create({ /* 空对象 -> 由后端生成 */ })
    ElMessage.success(t('common.addSuccess'))
    refreshTab(tab)
  } catch (e) { console.error(e); ElMessage.error(t('common.operationFailed')) }
}
async function onEdit(tab: Tab, row: Record<string, any>) {
  const h = handlers[tab]
  try {
    await h.update(row)
    ElMessage.success(t('common.updateSuccess'))
    refreshTab(tab)
  } catch (e) { console.error(e); ElMessage.error(t('common.operationFailed')) }
}
async function onDelete(tab: Tab, row: Record<string, any>) {
  const h = handlers[tab]
  try {
    await ElMessageBox.confirm(t('common.confirmDelete'), t('common.tip'), { type: 'warning' })
    await h.remove(row.id)
    ElMessage.success(t('common.deleteSuccess'))
    refreshTab(tab)
  } catch (e) { if (e !== 'cancel') { console.error(e); ElMessage.error(t('common.operationFailed')) } }
}

function refreshTab(tab: Tab) {
  const map: Record<Tab, () => Promise<void>> = {
    info: reloadInfo, accounts: reloadAccounts, tokens: reloadTokens,
    veriCodes: reloadVeriCodes, userVip: reloadUserVip, vipLevel: reloadVipLevel,
  }
  return map[tab]()
}

onMounted(() => {
  reloadInfo()
  reloadAccounts()
  reloadTokens()
  reloadVeriCodes()
  reloadUserVip()
  reloadVipLevel()
})
</script>

<style scoped lang="scss">
.auth-management-page {
  padding: 16px;
  .page-title { margin: 0 0 16px; font-size: 22px; }
  .auth-tabs { background: var(--el-bg-color); padding: 16px; border-radius: var(--global-border-radius); }
  .tab-actions { margin-bottom: 12px; }
}
</style>
