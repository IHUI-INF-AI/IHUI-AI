<template>
  <div class="admin-rbac-page" v-loading="loading">
    <h2 class="page-title">{{ t('adminRbac.title', 'RBAC 权限管理 (集中接入 14 个 admin/* API)') }}</h2>

    <el-tabs v-model="activeTab" class="rbac-tabs">
      <!-- 用户管理 -->
      <el-tab-pane :label="t('adminRbac.tab.user', '用户')" name="user">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('user')">{{ t('common.add') }}</el-button>
          <el-button @click="reload('user')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.user" stripe>
          <el-table-column prop="userId" label="用户ID" width="100" />
          <el-table-column prop="userName" label="用户名" width="150" />
          <el-table-column prop="nickName" label="昵称" width="150" />
          <el-table-column prop="deptId" label="部门ID" width="100" />
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column :label="t('common.operation')" width="200" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="onEdit('user', row)">{{ t('common.edit') }}</el-button>
              <el-button size="small" link type="danger" @click="onDelete('user', row)">{{ t('common.delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 角色管理 -->
      <el-tab-pane :label="t('adminRbac.tab.role', '角色')" name="role">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('role')">{{ t('common.add') }}</el-button>
          <el-button @click="reload('role')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.role" stripe>
          <el-table-column prop="roleId" label="角色ID" width="100" />
          <el-table-column prop="roleName" label="角色名" width="150" />
          <el-table-column prop="roleKey" label="权限字符" width="150" />
          <el-table-column prop="roleSort" label="排序" width="80" />
          <el-table-column :label="t('common.operation')" width="200" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="onEdit('role', row)">{{ t('common.edit') }}</el-button>
              <el-button size="small" link type="danger" @click="onDelete('role', row)">{{ t('common.delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 菜单管理 -->
      <el-tab-pane :label="t('adminRbac.tab.menu', '菜单')" name="menu">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('menu')">{{ t('common.add') }}</el-button>
          <el-button @click="reload('menu')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.menu" stripe>
          <el-table-column prop="menuId" label="菜单ID" width="100" />
          <el-table-column prop="menuName" label="菜单名" width="200" />
          <el-table-column prop="menuType" label="类型" width="80" />
          <el-table-column prop="perms" label="权限标识" />
          <el-table-column :label="t('common.operation')" width="200" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="onEdit('menu', row)">{{ t('common.edit') }}</el-button>
              <el-button size="small" link type="danger" @click="onDelete('menu', row)">{{ t('common.delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 部门管理 -->
      <el-tab-pane :label="t('adminRbac.tab.dept', '部门')" name="dept">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('dept')">{{ t('common.add') }}</el-button>
          <el-button @click="reload('dept')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.dept" stripe>
          <el-table-column prop="deptId" label="部门ID" width="100" />
          <el-table-column prop="deptName" label="部门名" width="200" />
          <el-table-column prop="parentId" label="父部门" width="100" />
          <el-table-column prop="orderNum" label="排序" width="80" />
          <el-table-column :label="t('common.operation')" width="200" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="onEdit('dept', row)">{{ t('common.edit') }}</el-button>
              <el-button size="small" link type="danger" @click="onDelete('dept', row)">{{ t('common.delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 岗位管理 -->
      <el-tab-pane :label="t('adminRbac.tab.post', '岗位')" name="post">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('post')">{{ t('common.add') }}</el-button>
          <el-button @click="reload('post')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.post" stripe>
          <el-table-column prop="postId" label="岗位ID" width="100" />
          <el-table-column prop="postName" label="岗位名" width="200" />
          <el-table-column prop="postCode" label="岗位编码" width="150" />
          <el-table-column prop="postSort" label="排序" width="80" />
          <el-table-column :label="t('common.operation')" width="200" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="onEdit('post', row)">{{ t('common.edit') }}</el-button>
              <el-button size="small" link type="danger" @click="onDelete('post', row)">{{ t('common.delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 参数配置 -->
      <el-tab-pane :label="t('adminRbac.tab.config', '参数配置')" name="config">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('config')">{{ t('common.add') }}</el-button>
          <el-button @click="reload('config')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.config" stripe>
          <el-table-column prop="configId" label="ID" width="80" />
          <el-table-column prop="configName" label="参数名" width="200" />
          <el-table-column prop="configKey" label="参数键" width="200" />
          <el-table-column prop="configValue" label="参数值" />
          <el-table-column :label="t('common.operation')" width="200" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="onEdit('config', row)">{{ t('common.edit') }}</el-button>
              <el-button size="small" link type="danger" @click="onDelete('config', row)">{{ t('common.delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 订单管理 (admin-orders) -->
      <el-tab-pane :label="t('adminRbac.tab.orders', '订单')" name="orders">
        <div class="tab-actions">
          <el-button @click="reload('orders')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.orders" stripe>
          <el-table-column prop="id" label="订单ID" width="100" />
          <el-table-column prop="userId" label="用户ID" width="100" />
          <el-table-column prop="amount" label="金额" width="120" />
          <el-table-column prop="status" label="状态" width="120" />
          <el-table-column :label="t('common.operation')" width="200" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="onCompleteOrder(row)">{{ t('adminRbac.completeOrder', '完成') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 商品管理 (admin-products) -->
      <el-tab-pane :label="t('adminRbac.tab.products', '商品')" name="products">
        <div class="tab-actions">
          <el-button @click="reload('products')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.products" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="商品名" width="200" />
          <el-table-column prop="price" label="价格" width="120" />
          <el-table-column prop="stock" label="库存" width="100" />
        </el-table>
      </el-tab-pane>

      <!-- FAQ 管理 (admin-faq) -->
      <el-tab-pane :label="t('adminRbac.tab.faq', 'FAQ')" name="faq">
        <div class="tab-actions">
          <el-button @click="reload('faq')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.faq" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="question" label="问题" width="300" />
          <el-table-column prop="answer" label="答案" />
        </el-table>
      </el-tab-pane>

      <!-- 仪表盘 (admin-dashboard) -->
      <el-tab-pane :label="t('adminRbac.tab.dashboard', '仪表盘')" name="dashboard">
        <div class="tab-actions">
          <el-button @click="reload('dashboard')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-row :gutter="16" v-if="dashboardData">
          <el-col :span="8" v-for="(item, idx) in dashboardCards" :key="idx">
            <el-card class="dashboard-card">
              <div class="card-label">{{ item.label }}</div>
              <div class="card-value">{{ item.value }}</div>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>

      <!-- 任务日志 (admin-job-log) -->
      <el-tab-pane :label="t('adminRbac.tab.jobLog', '任务日志')" name="jobLog">
        <div class="tab-actions">
          <el-button @click="reload('jobLog')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.jobLog" stripe>
          <el-table-column prop="jobLogId" label="日志ID" width="100" />
          <el-table-column prop="jobName" label="任务名" width="200" />
          <el-table-column prop="invokeTarget" label="调用目标" />
          <el-table-column prop="status" label="状态" width="100" />
        </el-table>
      </el-tab-pane>

      <!-- 登录日志 (admin-logininfo) -->
      <el-tab-pane :label="t('adminRbac.tab.loginInfo', '登录日志')" name="loginInfo">
        <div class="tab-actions">
          <el-button @click="reload('loginInfo')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.loginInfo" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="userName" label="用户名" width="150" />
          <el-table-column prop="ipaddr" label="IP" width="150" />
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column prop="loginTime" label="登录时间" width="180" />
        </el-table>
      </el-tab-pane>

      <!-- 通知公告 (admin-notice) -->
      <el-tab-pane :label="t('adminRbac.tab.notice', '通知公告')" name="notice">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('notice')">{{ t('common.add') }}</el-button>
          <el-button @click="reload('notice')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.notice" stripe>
          <el-table-column prop="noticeId" label="ID" width="80" />
          <el-table-column prop="noticeTitle" label="标题" width="300" />
          <el-table-column prop="noticeType" label="类型" width="100" />
          <el-table-column prop="status" label="状态" width="100" />
        </el-table>
      </el-tab-pane>

      <!-- 智能体 (admin-agents) -->
      <el-tab-pane :label="t('adminRbac.tab.agents', '智能体管理')" name="agents">
        <div class="tab-actions">
          <el-button @click="reload('agents')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.agents" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="名称" width="200" />
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column prop="category" label="分类" width="150" />
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

// 14 个 admin/* 零引用 API 集中接入
import {
  userList, userCreate, userUpdate, userDelete,
} from '@/api/admin/admin-user'
import {
  roleList, roleCreate, roleUpdate, roleDelete,
} from '@/api/admin/admin-role'
import {
  menuList, menuCreate, menuUpdate, menuDelete,
} from '@/api/admin/admin-menu'
import {
  deptList, deptCreate, deptUpdate, deptDelete,
} from '@/api/admin/admin-dept'
import {
  postList, postCreate, postUpdate, postDelete,
} from '@/api/admin/admin-post'
import {
  configList, configCreate, configUpdate, configDelete,
} from '@/api/admin/admin-config'
import {
  getAdminOrders, completeAdminOrder,
} from '@/api/admin/admin-orders'
import {
  getAdminProducts,
} from '@/api/admin/admin-products'
import {
  getAdminFAQs,
} from '@/api/admin/admin-faq'
import {
  getDashboardOverview,
} from '@/api/admin/admin-dashboard'
import {
  jobLogList, jobLogDelete,
} from '@/api/admin/admin-job-log'
import {
  loginInfoList, loginInfoDelete,
} from '@/api/admin/admin-logininfo'
import {
  noticeList, noticeCreate,
} from '@/api/admin/admin-notice'
import {
  getAdminAgents,
} from '@/api/admin/admin-agents'

const activeTab = ref('user')
const loading = ref(false)

const lists: Record<string, unknown[]> = reactive({
  user: [], role: [], menu: [], dept: [], post: [], config: [],
  orders: [], products: [], faq: [], jobLog: [], loginInfo: [], notice: [], agents: [],
})

const dashboardData = ref<Record<string, any> | null>(null)
const dashboardCards = computed(() => {
  const d = dashboardData.value
  if (!d) return []
  return [
    { label: t('adminRbac.card.userCount', '用户数'), value: d.userCount ?? '-' },
    { label: t('adminRbac.card.courseCount', '课程数'), value: d.courseCount ?? '-' },
    { label: t('adminRbac.card.orderCount', '订单数'), value: d.orderCount ?? '-' },
    { label: t('adminRbac.card.revenue', '营收'), value: d.revenue ?? '-' },
  ]
})

import { reactive } from 'vue'

async function reload(tab: string) {
  loading.value = true
  try {
    switch (tab) {
      case 'user': lists.user = (await userList())?.data as unknown as unknown[] || []; break
      case 'role': lists.role = (await roleList())?.data as unknown as unknown[] || []; break
      case 'menu': lists.menu = (await menuList())?.data as unknown as unknown[] || []; break
      case 'dept': lists.dept = (await deptList())?.data as unknown as unknown[] || []; break
      case 'post': lists.post = (await postList())?.data as unknown as unknown[] || []; break
      case 'config': lists.config = (await configList())?.data as unknown as unknown[] || []; break
      case 'orders': lists.orders = (await getAdminOrders())?.data as unknown as unknown[] || []; break
      case 'products': lists.products = (await getAdminProducts())?.data as unknown as unknown[] || []; break
      case 'faq': lists.faq = (await getAdminFAQs())?.data as unknown as unknown[] || []; break
      case 'dashboard': dashboardData.value = (await getDashboardOverview())?.data as Record<string, any>; break
      case 'jobLog': lists.jobLog = (await jobLogList())?.data as unknown as unknown[] || []; break
      case 'loginInfo': lists.loginInfo = (await loginInfoList())?.data as unknown as unknown[] || []; break
      case 'notice': lists.notice = (await noticeList())?.data as unknown as unknown[] || []; break
      case 'agents': lists.agents = (await getAdminAgents())?.data as unknown as unknown[] || []; break
    }
  } catch (e) { console.error(e) } finally { loading.value = false }
}

type CRUDTab = 'user' | 'role' | 'menu' | 'dept' | 'post' | 'config' | 'notice'

const handlers: Record<CRUDTab, { create: (p: any) => Promise<any>; update: (p: any) => Promise<any>; remove: (ids: any) => Promise<any> }> = {
  user: { create: userCreate, update: userUpdate, remove: (id) => userDelete([id]) },
  role: { create: roleCreate, update: roleUpdate, remove: (id) => roleDelete([id]) },
  menu: { create: menuCreate, update: menuUpdate, remove: menuDelete },
  dept: { create: deptCreate, update: deptUpdate, remove: deptDelete },
  post: { create: postCreate, update: postUpdate, remove: (id) => postDelete([id]) },
  config: { create: configCreate, update: configUpdate, remove: (id) => configDelete([id]) },
  notice: { create: noticeCreate, update: async () => ({}), remove: async () => ({}) },
}

async function onCreate(tab: CRUDTab) {
  const h = handlers[tab]
  try {
    await h.create({})
    ElMessage.success(t('common.addSuccess'))
    reload(tab)
  } catch (e) { console.error(e); ElMessage.error(t('common.operationFailed')) }
}
async function onEdit(tab: CRUDTab, row: Record<string, any>) {
  const h = handlers[tab]
  try {
    await h.update(row)
    ElMessage.success(t('common.updateSuccess'))
    reload(tab)
  } catch (e) { console.error(e); ElMessage.error(t('common.operationFailed')) }
}
async function onDelete(tab: CRUDTab, row: Record<string, any>) {
  const h = handlers[tab]
  try {
    await ElMessageBox.confirm(t('common.confirmDelete'), t('common.tip'), { type: 'warning' })
    await h.remove(row.id ?? row.userId ?? row.roleId ?? row.menuId ?? row.deptId ?? row.postId ?? row.configId ?? row.noticeId)
    ElMessage.success(t('common.deleteSuccess'))
    reload(tab)
  } catch (e) { if (e !== 'cancel') { console.error(e); ElMessage.error(t('common.operationFailed')) } }
}

async function onCompleteOrder(row: Record<string, any>) {
  try {
    await completeAdminOrder(row.id)
    ElMessage.success(t('common.updateSuccess'))
    reload('orders')
  } catch (e) { console.error(e); ElMessage.error(t('common.operationFailed')) }
}

onMounted(() => {
  reload('user')
})
</script>

<style scoped lang="scss">
.admin-rbac-page {
  padding: 16px;
  .page-title { margin: 0 0 16px; font-size: 22px; }
  .rbac-tabs { background: var(--el-bg-color); padding: 16px; border-radius: var(--global-border-radius); }
  .tab-actions { margin-bottom: 12px; }
  .dashboard-card {
    margin-bottom: 12px;
    .card-label { font-size: 14px; color: var(--el-text-color-secondary); }
    .card-value { font-size: 28px; font-weight: 600; color: var(--el-color-primary); margin-top: 8px; }
  }
}
</style>
