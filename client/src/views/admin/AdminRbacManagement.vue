<template>
  <div class="admin-rbac-page" v-loading="loading">
    <h2 class="page-title">{{ t('adminRbac.title', 'RBAC 权限管理 (集中接入 14 个 admin/* API)') }}</h2>

    <Tabs v-model="activeTab" class="rbac-tabs">
      <TabsList>
        <TabsTrigger value="user">{{ t('adminRbac.tab.user', '用户') }}</TabsTrigger>
        <TabsTrigger value="role">{{ t('adminRbac.tab.role', '角色') }}</TabsTrigger>
        <TabsTrigger value="menu">{{ t('adminRbac.tab.menu', '菜单') }}</TabsTrigger>
        <TabsTrigger value="dept">{{ t('adminRbac.tab.dept', '部门') }}</TabsTrigger>
        <TabsTrigger value="post">{{ t('adminRbac.tab.post', '岗位') }}</TabsTrigger>
        <TabsTrigger value="config">{{ t('adminRbac.tab.config', '参数配置') }}</TabsTrigger>
        <TabsTrigger value="orders">{{ t('adminRbac.tab.orders', '订单') }}</TabsTrigger>
        <TabsTrigger value="products">{{ t('adminRbac.tab.products', '商品') }}</TabsTrigger>
        <TabsTrigger value="faq">{{ t('adminRbac.tab.faq', 'FAQ') }}</TabsTrigger>
        <TabsTrigger value="dashboard">{{ t('adminRbac.tab.dashboard', '仪表盘') }}</TabsTrigger>
        <TabsTrigger value="jobLog">{{ t('adminRbac.tab.jobLog', '任务日志') }}</TabsTrigger>
        <TabsTrigger value="loginInfo">{{ t('adminRbac.tab.loginInfo', '登录日志') }}</TabsTrigger>
        <TabsTrigger value="notice">{{ t('adminRbac.tab.notice', '通知公告') }}</TabsTrigger>
        <TabsTrigger value="agents">{{ t('adminRbac.tab.agents', '智能体管理') }}</TabsTrigger>
      </TabsList>
      <!-- 用户管理 -->
      <TabsContent value="user">
        <div class="tab-actions">
          <Button variant="default" @click="onCreate('user')">{{ t('common.add') }}</Button>
          <Button variant="outline" @click="reload('user')">{{ t('common.refresh') }}</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-[100px]">用户ID</TableHead>
              <TableHead class="w-[150px]">用户名</TableHead>
              <TableHead class="w-[150px]">昵称</TableHead>
              <TableHead class="w-[100px]">部门ID</TableHead>
              <TableHead class="w-[100px]">状态</TableHead>
              <TableHead class="w-[200px]">{{ t('common.operation') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(row, index) in lists.user" :key="row.userId ?? index">
              <TableCell>{{ row.userId }}</TableCell>
              <TableCell>{{ row.userName }}</TableCell>
              <TableCell>{{ row.nickName }}</TableCell>
              <TableCell>{{ row.deptId }}</TableCell>
              <TableCell>{{ row.status }}</TableCell>
              <TableCell>
                <Button variant="link" size="sm" @click="onEdit('user', row)">{{ t('common.edit') }}</Button>
                <Button variant="link" size="sm" @click="onDelete('user', row)">{{ t('common.delete') }}</Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TabsContent>

      <!-- 角色管理 -->
      <TabsContent value="role">
        <div class="tab-actions">
          <Button variant="default" @click="onCreate('role')">{{ t('common.add') }}</Button>
          <Button variant="outline" @click="reload('role')">{{ t('common.refresh') }}</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-[100px]">角色ID</TableHead>
              <TableHead class="w-[150px]">角色名</TableHead>
              <TableHead class="w-[150px]">权限字符</TableHead>
              <TableHead class="w-[80px]">排序</TableHead>
              <TableHead class="w-[200px]">{{ t('common.operation') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(row, index) in lists.role" :key="row.roleId ?? index">
              <TableCell>{{ row.roleId }}</TableCell>
              <TableCell>{{ row.roleName }}</TableCell>
              <TableCell>{{ row.roleKey }}</TableCell>
              <TableCell>{{ row.roleSort }}</TableCell>
              <TableCell>
                <Button variant="link" size="sm" @click="onEdit('role', row)">{{ t('common.edit') }}</Button>
                <Button variant="link" size="sm" @click="onDelete('role', row)">{{ t('common.delete') }}</Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TabsContent>

      <!-- 菜单管理 -->
      <TabsContent value="menu">
        <div class="tab-actions">
          <Button variant="default" @click="onCreate('menu')">{{ t('common.add') }}</Button>
          <Button variant="outline" @click="reload('menu')">{{ t('common.refresh') }}</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-[100px]">菜单ID</TableHead>
              <TableHead class="w-[200px]">菜单名</TableHead>
              <TableHead class="w-[80px]">类型</TableHead>
              <TableHead>权限标识</TableHead>
              <TableHead class="w-[200px]">{{ t('common.operation') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(row, index) in lists.menu" :key="row.menuId ?? index">
              <TableCell>{{ row.menuId }}</TableCell>
              <TableCell>{{ row.menuName }}</TableCell>
              <TableCell>{{ row.menuType }}</TableCell>
              <TableCell>{{ row.perms }}</TableCell>
              <TableCell>
                <Button variant="link" size="sm" @click="onEdit('menu', row)">{{ t('common.edit') }}</Button>
                <Button variant="link" size="sm" @click="onDelete('menu', row)">{{ t('common.delete') }}</Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TabsContent>

      <!-- 部门管理 -->
      <TabsContent value="dept">
        <div class="tab-actions">
          <Button variant="default" @click="onCreate('dept')">{{ t('common.add') }}</Button>
          <Button variant="outline" @click="reload('dept')">{{ t('common.refresh') }}</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-[100px]">部门ID</TableHead>
              <TableHead class="w-[200px]">部门名</TableHead>
              <TableHead class="w-[100px]">父部门</TableHead>
              <TableHead class="w-[80px]">排序</TableHead>
              <TableHead class="w-[200px]">{{ t('common.operation') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(row, index) in lists.dept" :key="row.deptId ?? index">
              <TableCell>{{ row.deptId }}</TableCell>
              <TableCell>{{ row.deptName }}</TableCell>
              <TableCell>{{ row.parentId }}</TableCell>
              <TableCell>{{ row.orderNum }}</TableCell>
              <TableCell>
                <Button variant="link" size="sm" @click="onEdit('dept', row)">{{ t('common.edit') }}</Button>
                <Button variant="link" size="sm" @click="onDelete('dept', row)">{{ t('common.delete') }}</Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TabsContent>

      <!-- 岗位管理 -->
      <TabsContent value="post">
        <div class="tab-actions">
          <Button variant="default" @click="onCreate('post')">{{ t('common.add') }}</Button>
          <Button variant="outline" @click="reload('post')">{{ t('common.refresh') }}</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-[100px]">岗位ID</TableHead>
              <TableHead class="w-[200px]">岗位名</TableHead>
              <TableHead class="w-[150px]">岗位编码</TableHead>
              <TableHead class="w-[80px]">排序</TableHead>
              <TableHead class="w-[200px]">{{ t('common.operation') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(row, index) in lists.post" :key="row.postId ?? index">
              <TableCell>{{ row.postId }}</TableCell>
              <TableCell>{{ row.postName }}</TableCell>
              <TableCell>{{ row.postCode }}</TableCell>
              <TableCell>{{ row.postSort }}</TableCell>
              <TableCell>
                <Button variant="link" size="sm" @click="onEdit('post', row)">{{ t('common.edit') }}</Button>
                <Button variant="link" size="sm" @click="onDelete('post', row)">{{ t('common.delete') }}</Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TabsContent>

      <!-- 参数配置 -->
      <TabsContent value="config">
        <div class="tab-actions">
          <Button variant="default" @click="onCreate('config')">{{ t('common.add') }}</Button>
          <Button variant="outline" @click="reload('config')">{{ t('common.refresh') }}</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-[80px]">ID</TableHead>
              <TableHead class="w-[200px]">参数名</TableHead>
              <TableHead class="w-[200px]">参数键</TableHead>
              <TableHead>参数值</TableHead>
              <TableHead class="w-[200px]">{{ t('common.operation') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(row, index) in lists.config" :key="row.configId ?? index">
              <TableCell>{{ row.configId }}</TableCell>
              <TableCell>{{ row.configName }}</TableCell>
              <TableCell>{{ row.configKey }}</TableCell>
              <TableCell>{{ row.configValue }}</TableCell>
              <TableCell>
                <Button variant="link" size="sm" @click="onEdit('config', row)">{{ t('common.edit') }}</Button>
                <Button variant="link" size="sm" @click="onDelete('config', row)">{{ t('common.delete') }}</Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TabsContent>

      <!-- 订单管理 (admin-orders) -->
      <TabsContent value="orders">
        <div class="tab-actions">
          <Button variant="outline" @click="reload('orders')">{{ t('common.refresh') }}</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-[100px]">订单ID</TableHead>
              <TableHead class="w-[100px]">用户ID</TableHead>
              <TableHead class="w-[120px]">金额</TableHead>
              <TableHead class="w-[120px]">状态</TableHead>
              <TableHead class="w-[200px]">{{ t('common.operation') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(row, index) in lists.orders" :key="row.id ?? index">
              <TableCell>{{ row.id }}</TableCell>
              <TableCell>{{ row.userId }}</TableCell>
              <TableCell>{{ row.amount }}</TableCell>
              <TableCell>{{ row.status }}</TableCell>
              <TableCell>
                <Button variant="link" size="sm" @click="onCompleteOrder(row)">{{ t('adminRbac.completeOrder', '完成') }}</Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TabsContent>

      <!-- 商品管理 (admin-products) -->
      <TabsContent value="products">
        <div class="tab-actions">
          <Button variant="outline" @click="reload('products')">{{ t('common.refresh') }}</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-[80px]">ID</TableHead>
              <TableHead class="w-[200px]">商品名</TableHead>
              <TableHead class="w-[120px]">价格</TableHead>
              <TableHead class="w-[100px]">库存</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(row, index) in lists.products" :key="row.id ?? index">
              <TableCell>{{ row.id }}</TableCell>
              <TableCell>{{ row.name }}</TableCell>
              <TableCell>{{ row.price }}</TableCell>
              <TableCell>{{ row.stock }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TabsContent>

      <!-- FAQ 管理 (admin-faq) -->
      <TabsContent value="faq">
        <div class="tab-actions">
          <Button variant="outline" @click="reload('faq')">{{ t('common.refresh') }}</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-[80px]">ID</TableHead>
              <TableHead class="w-[300px]">问题</TableHead>
              <TableHead>答案</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(row, index) in lists.faq" :key="row.id ?? index">
              <TableCell>{{ row.id }}</TableCell>
              <TableCell>{{ row.question }}</TableCell>
              <TableCell>{{ row.answer }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TabsContent>

      <!-- 仪表盘 (admin-dashboard) -->
      <TabsContent value="dashboard">
        <div class="tab-actions">
          <Button variant="outline" @click="reload('dashboard')">{{ t('common.refresh') }}</Button>
        </div>
        <div class="flex flex-wrap gap-4" v-if="dashboardData">
          <div class="w-1/3" v-for="(item, idx) in dashboardCards" :key="idx">
            <Card class="dashboard-card p-5">
              <div class="card-label">{{ item.label }}</div>
              <div class="card-value">{{ item.value }}</div>
            </Card>
          </div>
        </div>
      </TabsContent>

      <!-- 任务日志 (admin-job-log) -->
      <TabsContent value="jobLog">
        <div class="tab-actions">
          <Button variant="outline" @click="reload('jobLog')">{{ t('common.refresh') }}</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-[100px]">日志ID</TableHead>
              <TableHead class="w-[200px]">任务名</TableHead>
              <TableHead>调用目标</TableHead>
              <TableHead class="w-[100px]">状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(row, index) in lists.jobLog" :key="row.jobLogId ?? index">
              <TableCell>{{ row.jobLogId }}</TableCell>
              <TableCell>{{ row.jobName }}</TableCell>
              <TableCell>{{ row.invokeTarget }}</TableCell>
              <TableCell>{{ row.status }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TabsContent>

      <!-- 登录日志 (admin-logininfo) -->
      <TabsContent value="loginInfo">
        <div class="tab-actions">
          <Button variant="outline" @click="reload('loginInfo')">{{ t('common.refresh') }}</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-[80px]">ID</TableHead>
              <TableHead class="w-[150px]">用户名</TableHead>
              <TableHead class="w-[150px]">IP</TableHead>
              <TableHead class="w-[100px]">状态</TableHead>
              <TableHead class="w-[180px]">登录时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(row, index) in lists.loginInfo" :key="row.id ?? index">
              <TableCell>{{ row.id }}</TableCell>
              <TableCell>{{ row.userName }}</TableCell>
              <TableCell>{{ row.ipaddr }}</TableCell>
              <TableCell>{{ row.status }}</TableCell>
              <TableCell>{{ row.loginTime }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TabsContent>

      <!-- 通知公告 (admin-notice) -->
      <TabsContent value="notice">
        <div class="tab-actions">
          <Button variant="default" @click="onCreate('notice')">{{ t('common.add') }}</Button>
          <Button variant="outline" @click="reload('notice')">{{ t('common.refresh') }}</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-[80px]">ID</TableHead>
              <TableHead class="w-[300px]">标题</TableHead>
              <TableHead class="w-[100px]">类型</TableHead>
              <TableHead class="w-[100px]">状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(row, index) in lists.notice" :key="row.noticeId ?? index">
              <TableCell>{{ row.noticeId }}</TableCell>
              <TableCell>{{ row.noticeTitle }}</TableCell>
              <TableCell>{{ row.noticeType }}</TableCell>
              <TableCell>{{ row.status }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TabsContent>

      <!-- 智能体 (admin-agents) -->
      <TabsContent value="agents">
        <div class="tab-actions">
          <Button variant="outline" @click="reload('agents')">{{ t('common.refresh') }}</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-[80px]">ID</TableHead>
              <TableHead class="w-[200px]">名称</TableHead>
              <TableHead class="w-[100px]">状态</TableHead>
              <TableHead class="w-[150px]">分类</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(row, index) in lists.agents" :key="row.id ?? index">
              <TableCell>{{ row.id }}</TableCell>
              <TableCell>{{ row.name }}</TableCell>
              <TableCell>{{ row.status }}</TableCell>
              <TableCell>{{ row.category }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TabsContent>
    </Tabs>
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
  jobLogList,
} from '@/api/admin/admin-job-log'
import {
  loginInfoList,
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
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'

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
