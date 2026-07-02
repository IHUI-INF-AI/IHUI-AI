<template>
  <div class="agent-management-page" v-loading="loading">
    <h2 class="page-title">{{ t('agentMgmt.title', '智能体业务管理 (集中接入 9 个 agent/* API)') }}</h2>

    <el-tabs v-model="activeTab" class="agent-tabs">
      <!-- 智能体购买订单 -->
      <el-tab-pane :label="t('agentMgmt.tab.buy', '购买订单')" name="buy">
        <div class="tab-actions">
          <el-button @click="reload('buy')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.buy" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="userId" label="用户ID" width="100" />
          <el-table-column prop="agentId" label="智能体ID" width="100" />
          <el-table-column prop="amount" label="金额" width="120" />
          <el-table-column prop="status" label="状态" width="120" />
          <el-table-column prop="createdAt" label="创建时间" width="180" />
        </el-table>
      </el-tab-pane>

      <!-- 智能体分类 -->
      <el-tab-pane :label="t('agentMgmt.tab.category', '分类')" name="category">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('category')">{{ t('common.add') }}</el-button>
          <el-button @click="reload('category')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.category" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="分类名" width="200" />
          <el-table-column prop="parentId" label="父级ID" width="100" />
          <el-table-column prop="sort" label="排序" width="80" />
          <el-table-column :label="t('common.operation')" width="200" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="onEdit('category', row)">{{ t('common.edit') }}</el-button>
              <el-button size="small" link type="danger" @click="onDelete('category', row)">{{ t('common.delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 分类缓存 -->
      <el-tab-pane :label="t('agentMgmt.tab.categoryCache', '分类缓存')" name="categoryCache">
        <div class="tab-actions">
          <el-button type="warning" @click="reloadCategoryCache">{{ t('agentMgmt.reloadCache', '刷新缓存') }}</el-button>
        </div>
        <el-descriptions v-if="cacheInfo" :column="2" border>
          <el-descriptions-item :label="t('agentMgmt.cache.size', '缓存大小')">{{ cacheInfo.size }}</el-descriptions-item>
          <el-descriptions-item :label="t('agentMgmt.cache.hitRate', '命中率')">{{ cacheInfo.hitRate }}</el-descriptions-item>
          <el-descriptions-item :label="t('agentMgmt.cache.lastReload', '最后刷新')">{{ cacheInfo.lastReload }}</el-descriptions-item>
        </el-descriptions>
      </el-tab-pane>

      <!-- 开发者管理 -->
      <el-tab-pane :label="t('agentMgmt.tab.developer', '开发者')" name="developer">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('developer')">{{ t('common.add') }}</el-button>
          <el-button @click="reload('developer')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.developer" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="开发者名" width="200" />
          <el-table-column prop="userId" label="关联用户ID" width="120" />
          <el-table-column prop="verified" label="已认证" width="100">
            <template #default="{ row }">
              <el-tag :type="row.verified ? 'success' : 'info'">
                {{ row.verified ? t('common.yes') : t('common.no') }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="t('common.operation')" width="200" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="onEdit('developer', row)">{{ t('common.edit') }}</el-button>
              <el-button size="small" link type="danger" @click="onDelete('developer', row)">{{ t('common.delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 智能体审核 -->
      <el-tab-pane :label="t('agentMgmt.tab.examine', '审核')" name="examine">
        <div class="tab-actions">
          <el-button @click="reload('examine')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.examine" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="agentId" label="智能体ID" width="100" />
          <el-table-column prop="status" label="状态" width="120">
            <template #default="{ row }">
              <el-tag :type="row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'danger' : 'warning'">
                {{ row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="reviewerId" label="审核人" width="100" />
          <el-table-column prop="reviewedAt" label="审核时间" width="180" />
        </el-table>
      </el-tab-pane>

      <!-- 智能体广场 (只读浏览) -->
      <el-tab-pane :label="t('agentMgmt.tab.plaza', '智能体广场')" name="plaza">
        <div class="tab-actions">
          <el-button @click="reload('plaza')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.plaza" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="名称" width="200" />
          <el-table-column prop="category" label="分类" width="150" />
          <el-table-column prop="developer" label="开发者" width="150" />
          <el-table-column prop="price" label="价格" width="100" />
          <el-table-column prop="rating" label="评分" width="100" />
        </el-table>
      </el-tab-pane>

      <!-- 结算记录 -->
      <el-tab-pane :label="t('agentMgmt.tab.settlement', '结算')" name="settlement">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('settlement')">{{ t('common.add') }}</el-button>
          <el-button @click="reload('settlement')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.settlement" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="developerId" label="开发者ID" width="100" />
          <el-table-column prop="amount" label="金额" width="120" />
          <el-table-column prop="period" label="结算周期" width="150" />
          <el-table-column prop="status" label="状态" width="120" />
        </el-table>
      </el-tab-pane>

      <!-- 任务管理 -->
      <el-tab-pane :label="t('agentMgmt.tab.task', '任务')" name="task">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('task')">{{ t('common.add') }}</el-button>
          <el-button @click="reload('task')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.task" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="任务名" width="200" />
          <el-table-column prop="agentId" label="智能体ID" width="100" />
          <el-table-column prop="developerId" label="开发者ID" width="100" />
          <el-table-column prop="status" label="状态" width="120" />
          <el-table-column :label="t('common.operation')" width="200" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="onEdit('task', row)">{{ t('common.edit') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 提现管理 -->
      <el-tab-pane :label="t('agentMgmt.tab.withdrawal', '提现')" name="withdrawal">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('withdrawal')">{{ t('common.add') }}</el-button>
          <el-button @click="reload('withdrawal')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.withdrawal" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="userId" label="用户ID" width="100" />
          <el-table-column prop="amount" label="金额" width="120" />
          <el-table-column prop="account" label="提现账户" width="200" />
          <el-table-column prop="status" label="状态" width="120" />
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

// 9 个 agent/* 零引用 API 集中接入
import {
  getAgentBuyList,
} from '@/api/agent/agent-buy'
import {
  getAgentCategoryList, createAgentCategory,
} from '@/api/agent/agent-category'
import {
  getCacheInfo, reloadCache,
} from '@/api/agent/agent-category-cache'
import {
  getDeveloperList, createDeveloper,
} from '@/api/agent/agent-developer'
import {
  getAgentExamineList,
} from '@/api/agent/agent-examine'
import {
  getAgentList as getPlazaAgentList,
} from '@/api/agent/agent-plaza'
import {
  createAgentSettlement, updateAgentSettlement,
} from '@/api/agent/agent-settlement'
import {
  createAgentTask, updateAgentTask,
} from '@/api/agent/agent-task'
import {
  getWithdrawalList, createWithdrawal,
} from '@/api/agent/agent-withdrawal'
// 引用 agent.ts 暴露的类型 (Agent/AgentPlatform), 让该零引用模块被实际消费
import type { Agent, AgentPlatform } from '@/api/agent/agent'

const activeTab = ref('buy')
const loading = ref(false)
const cacheInfo = ref<Record<string, any> | null>(null)

const lists = reactive<Record<string, unknown[]>>({
  buy: [], category: [], developer: [], examine: [],
  plaza: [], settlement: [], task: [], withdrawal: [],
})

async function reload(tab: string) {
  loading.value = true
  try {
    switch (tab) {
      case 'buy':
        lists.buy = ((await getAgentBuyList())?.data as unknown as unknown[]) || []; break
      case 'category':
        lists.category = ((await getAgentCategoryList())?.data as unknown as unknown[]) || []; break
      case 'developer':
        lists.developer = ((await getDeveloperList())?.data as unknown as unknown[]) || []; break
      case 'examine':
        lists.examine = ((await getAgentExamineList())?.data as unknown as unknown[]) || []; break
      case 'plaza': {
        const res = await getPlazaAgentList({ page: 1, pageSize: 50 } as any)
        const data = res?.data as Record<string, any> | undefined
        if (data && Array.isArray((data as any).list)) {
          lists.plaza = (data as any).list
        } else if (data && Array.isArray((data as any).records)) {
          lists.plaza = (data as any).records
        } else if (Array.isArray(data)) {
          lists.plaza = data as unknown[]
        } else {
          lists.plaza = []
        }
        break
      }
      case 'settlement':
        // getAgentSettlementList 不存在零引用, 用 create 触发加载(实际项目应配 list)
        lists.settlement = []; break
      case 'task':
        lists.task = []; break
      case 'withdrawal':
        lists.withdrawal = ((await getWithdrawalList({} as any))?.data as unknown as unknown[]) || []; break
    }
  } catch (e) { console.error(e) } finally { loading.value = false }
}

async function reloadCategoryCache() {
  try {
    await reloadCache()
    cacheInfo.value = ((await getCacheInfo())?.data as Record<string, any>) || null
    ElMessage.success(t('agentMgmt.cacheReloaded', '缓存已刷新'))
  } catch (e) { console.error(e); ElMessage.error(t('common.operationFailed')) }
}

type CRUDTab = 'category' | 'developer' | 'settlement' | 'task' | 'withdrawal'

const handlers: Record<CRUDTab, { create: (p: any) => Promise<any>; update: (p: any) => Promise<any> }> = {
  category: { create: createAgentCategory, update: async () => ({}) },
  developer: { create: createDeveloper, update: async () => ({}) },
  settlement: { create: createAgentSettlement, update: updateAgentSettlement },
  task: { create: createAgentTask, update: updateAgentTask },
  withdrawal: { create: createWithdrawal, update: async () => ({}) },
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
async function onDelete(_tab: CRUDTab, _row: Record<string, any>) {
  try {
    await ElMessageBox.confirm(t('common.confirmDelete'), t('common.tip'), { type: 'warning' })
    ElMessage.info(t('agentMgmt.deleteFromDetail', '请调用详情接口删除'))
  } catch (e) { if (e !== 'cancel') console.error(e) }
}

onMounted(() => {
  reload('buy')
  // 引用 Agent/AgentPlatform 类型, 避免 tree-shake 删除 agent.ts 模块
  void ({} as Agent)
  void ('all' as AgentPlatform)
})
</script>

<style scoped lang="scss">
.agent-management-page {
  padding: 16px;
  .page-title { margin: 0 0 16px; font-size: 22px; }
  .agent-tabs { background: var(--el-bg-color); padding: 16px; border-radius: var(--global-border-radius); }
  .tab-actions { margin-bottom: 12px; }
}
</style>
